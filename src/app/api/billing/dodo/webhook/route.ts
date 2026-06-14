import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { activatePlan, endPlan, planFromDodoProduct, PLANS } from '@/lib/billing';
import { addTrace } from '@/engine/observability/trace';

/**
 * Dodo Payments webhook (card checkout).
 *
 * Dodo uses the Standard Webhooks spec (svix-style):
 *   headers: webhook-id, webhook-timestamp, webhook-signature
 *   signature = base64( HMAC-SHA256( `${id}.${timestamp}.${body}`, secret ) )
 *   the webhook-signature header is a space-separated list of `v1,<sig>` entries.
 *
 * The signing secret (env DODO_WEBHOOK_SECRET) is the `whsec_...` value from the
 * Dodo dashboard. We strip the `whsec_` prefix and base64-decode the key.
 *
 * Events we act on:
 *   subscription.active | subscription.renewed → activatePlan
 *   subscription.cancelled | subscription.expired | subscription.failed → endPlan
 *   payment.succeeded (one-off) → activatePlan
 *
 * The buyer is matched via metadata.userId (passed in the checkout URL) or email.
 */

export const dynamic = 'force-dynamic';

function verifyStandardWebhook(
  rawBody: string,
  id: string | null,
  timestamp: string | null,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  // Dodo secrets look like `whsec_<base64>`; the key is the base64 part.
  const keyB64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(keyB64, 'base64');
  } catch {
    key = Buffer.from(keyB64, 'utf8');
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // Header is space-separated `v1,<sig>` pairs; any match passes.
  const candidates = signatureHeader.split(' ').map((p) => {
    const idx = p.indexOf(',');
    return idx >= 0 ? p.slice(idx + 1) : p;
  });
  return candidates.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

function pick<T = unknown>(obj: Record<string, unknown> | undefined, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const secret = process.env.DODO_WEBHOOK_SECRET || '';
  const rawBody = await req.text();
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signature = req.headers.get('webhook-signature');

  if (!verifyStandardWebhook(rawBody, id, timestamp, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { type?: string; data?: Record<string, unknown> };
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  const event = (body.type || '').toLowerCase();
  const data = (body.data || {}) as Record<string, unknown>;

  // metadata may live on data.metadata, and product id on data.product_id /
  // data.product_cart[0].product_id depending on event shape.
  const meta = (pick<Record<string, unknown>>(data, 'metadata') || {}) as Record<string, unknown>;
  const customer = (pick<Record<string, unknown>>(data, 'customer') || {}) as Record<string, unknown>;
  const email = String(pick(customer, 'email') || pick(data, 'email') || pick(meta, 'email') || '').toLowerCase().trim();
  const metaUserId = String(pick(meta, 'userId') || '');

  let productId = String(pick(data, 'product_id', 'productId') || '');
  if (!productId) {
    const cart = pick<Array<Record<string, unknown>>>(data, 'product_cart');
    if (Array.isArray(cart) && cart[0]) productId = String(pick(cart[0], 'product_id', 'productId') || '');
  }
  const planId = planFromDodoProduct(productId);

  addTrace({ type: 'billing:dodo', event, command: `user=${metaUserId || email} product=${productId} plan=${planId}`, success: true });

  // Resolve the user
  let user = null;
  if (metaUserId) user = await prisma.user.findUnique({ where: { id: metaUserId } }).catch(() => null);
  if (!user && email) user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
  if (!user) {
    addTrace({ type: 'billing:dodo', event, success: false, error: `no user for userId=${metaUserId} email=${email}` });
    return NextResponse.json({ received: true, matched: false }, { status: 200 });
  }

  try {
    const activateEvents = ['subscription.active', 'subscription.renewed', 'payment.succeeded'];
    const endEvents = ['subscription.cancelled', 'subscription.expired', 'subscription.failed', 'subscription.on_hold'];
    if (activateEvents.includes(event)) {
      if (planId && PLANS[planId]) {
        await activatePlan(user.id, planId, String(pick(data, 'subscription_id', 'payment_id', 'id') || ''));
      }
    } else if (endEvents.includes(event)) {
      await endPlan(user.id);
    }
  } catch (e) {
    addTrace({ type: 'billing:dodo', event, success: false, error: (e as Error).message });
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true, matched: true, plan: planId });
}
