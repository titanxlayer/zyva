import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { activatePlan, endPlan, PLANS } from '@/lib/billing';
import { addTrace } from '@/engine/observability/trace';

/**
 * Helio (MoonPay Commerce) subscription webhook.
 *
 * Helio sends an `X-Signature` header = HMAC-SHA256(body, sharedToken).
 * Events: CREATED | STARTED | RENEWED | ENDED.
 * We map the paid amount → plan tier and match the user by email or meta.userId.
 *
 * Setup (Helio dashboard):
 *   1. Create a subscription Pay Link per tier (Starter $10, Team $40, Scale $100, Pro $0).
 *   2. Create a webhook → this URL, copy its sharedToken into HELIO_WEBHOOK_TOKEN.
 *   3. Put each Pay Link URL into HELIO_PAYLINK_STARTER / _TEAM / _SCALE / _PRO.
 */

export const dynamic = 'force-dynamic';

function verifySignature(rawBody: string, signature: string | null, sharedToken: string): boolean {
  if (!signature || !sharedToken) return false;
  const expected = crypto.createHmac('sha256', sharedToken).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// Distinct prices → tier (Pro is the free promo).
function planFromAmount(usd: number): string | null {
  const rounded = Math.round(usd);
  if (rounded === 10) return 'starter';
  if (rounded === 40) return 'team';
  if (rounded === 100) return 'scale';
  if (rounded === 0) return 'pro';
  return null;
}

function pick<T = unknown>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const sharedToken = process.env.HELIO_WEBHOOK_TOKEN || '';
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  if (!verifySignature(rawBody, signature, sharedToken)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { event?: string; transactionObject?: Record<string, unknown> };
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  const event = (body.event || '').toUpperCase();
  const tx = (body.transactionObject || {}) as Record<string, unknown>;

  // Extract customer email + meta + amount defensively (payload shape varies).
  const meta = (pick<Record<string, unknown>>(tx, 'meta', 'metadata') || {}) as Record<string, unknown>;
  const customer = (pick<Record<string, unknown>>(tx, 'customerDetails', 'customer') || {}) as Record<string, unknown>;
  const email = String(pick(meta, 'email') || pick(customer, 'email') || pick(tx, 'email') || '').toLowerCase().trim();
  const metaUserId = String(pick(meta, 'userId') || '');
  // amount can be normalized USD on the paylink
  const amountRaw = pick<number | string>(tx, 'amountUsd', 'normalizedPrice', 'priceUsd', 'amount') ?? 0;
  const usd = typeof amountRaw === 'string' ? parseFloat(amountRaw) : Number(amountRaw);

  addTrace({ type: 'billing:webhook', event, command: `email=${email || metaUserId} usd=${usd}`, success: true });

  // Resolve the user
  let user = null;
  if (metaUserId) user = await prisma.user.findUnique({ where: { id: metaUserId } }).catch(() => null);
  if (!user && email) user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
  if (!user) {
    addTrace({ type: 'billing:webhook', event, success: false, error: `no user for email=${email} userId=${metaUserId}` });
    return NextResponse.json({ received: true, matched: false }, { status: 200 });
  }

  const planId = planFromAmount(usd);

  try {
    if (event === 'STARTED' || event === 'RENEWED' || event === 'CREATED') {
      if (planId && PLANS[planId]) {
        await activatePlan(user.id, planId, String(pick(tx, 'subscriptionId', 'id') || ''));
      }
    } else if (event === 'ENDED') {
      await endPlan(user.id);
    }
  } catch (e) {
    addTrace({ type: 'billing:webhook', event, success: false, error: (e as Error).message });
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true, matched: true, plan: planId });
}
