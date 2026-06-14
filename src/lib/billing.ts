import { prisma } from '@/lib/prisma';

/**
 * Billing — ZYVA credit plans, powered by Helio (hel.io) subscriptions.
 *
 * Plans differ ONLY by monthly credits (+ soft perks). All tiers use the same
 * ZYVA engine. Credits are token-weighted: 1 credit ≈ 10,000 tokens of work.
 *
 * Pay Link URLs come from env (created in the Helio dashboard):
 *   HELIO_PAYLINK_STARTER, HELIO_PAYLINK_TEAM, HELIO_PAYLINK_SCALE, HELIO_PAYLINK_PRO
 * Webhook verification: HELIO_WEBHOOK_TOKEN (the pay link's sharedToken).
 */

export const TOKENS_PER_CREDIT = 10_000;

export interface PlanDef {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  paylinkEnv: string; // env var holding the Helio Pay Link URL
  perks: string[];
}

export const PLANS: Record<string, PlanDef> = {
  free: {
    id: 'free', name: 'Free', priceUsd: 0, credits: 0, paylinkEnv: '',
    perks: ['Bring your own 0G key', 'Community support'],
  },
  starter: {
    id: 'starter', name: 'Starter', priceUsd: 10, credits: 80, paylinkEnv: 'HELIO_PAYLINK_STARTER',
    perks: ['80 Zyva Credits', 'Community support'],
  },
  pro: {
    id: 'pro', name: 'Pro (Early Adopter)', priceUsd: 0, credits: 200, paylinkEnv: 'HELIO_PAYLINK_PRO',
    perks: ['200 Zyva Credits', 'Beta promo — free', 'Email support'],
  },
  team: {
    id: 'team', name: 'Team', priceUsd: 40, credits: 500, paylinkEnv: 'HELIO_PAYLINK_TEAM',
    perks: ['500 Zyva Credits', 'Priority routing', 'Collaborative workspaces'],
  },
  scale: {
    id: 'scale', name: 'Scale', priceUsd: 100, credits: 1500, paylinkEnv: 'HELIO_PAYLINK_SCALE',
    perks: ['1,500 Zyva Credits', 'Claude Fable-5 audit pass', 'Dedicated success manager'],
  },
};

/** Resolve a plan's Helio Pay Link URL from env (empty if not configured). */
export function planPaylink(planId: string): string {
  const def = PLANS[planId];
  if (!def?.paylinkEnv) return '';
  return process.env[def.paylinkEnv] || '';
}

/** Public plan list for the UI (includes live pay link URLs). */
export function listPlansForUi() {
  return Object.values(PLANS)
    .filter((p) => p.id !== 'free')
    .map((p) => ({ id: p.id, name: p.name, priceUsd: p.priceUsd, credits: p.credits, perks: p.perks, paylink: planPaylink(p.id) }));
}

export interface CreditState {
  plan: string;
  planName: string;
  credits: number;
  creditsUsed: number;
  remaining: number;
  planRenewsAt: Date | null;
}

export async function getCreditState(userId: string): Promise<CreditState> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, credits: true, creditsUsed: true, planRenewsAt: true },
  });
  const plan = u?.plan || 'free';
  const credits = u?.credits ?? 0;
  const creditsUsed = u?.creditsUsed ?? 0;
  return {
    plan,
    planName: PLANS[plan]?.name || 'Free',
    credits,
    creditsUsed,
    remaining: Math.max(0, credits - creditsUsed),
    planRenewsAt: u?.planRenewsAt ?? null,
  };
}

/** Activate / renew a plan (called from the Helio webhook). Resets the period. */
export async function activatePlan(userId: string, planId: string, helioSubscriptionId?: string) {
  const def = PLANS[planId];
  if (!def) throw new Error(`Unknown plan: ${planId}`);
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planId,
      credits: def.credits,
      creditsUsed: 0,
      planRenewsAt: renews,
      helioSubscriptionId: helioSubscriptionId ?? undefined,
    },
  });
}

/** Downgrade to free (subscription ended). */
export async function endPlan(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { plan: 'free', credits: 0, creditsUsed: 0, planRenewsAt: null },
  });
}

/** Deduct credits for token usage. Returns the remaining balance. */
export async function chargeTokens(userId: string, tokens: number): Promise<number> {
  const cost = tokens / TOKENS_PER_CREDIT;
  const u = await prisma.user.update({
    where: { id: userId },
    data: { creditsUsed: { increment: cost } },
    select: { credits: true, creditsUsed: true },
  }).catch(() => null);
  if (!u) return 0;
  return Math.max(0, u.credits - u.creditsUsed);
}

/** Has the user got credits left (or is on free/BYOK)? */
export async function hasCredits(userId: string): Promise<boolean> {
  const s = await getCreditState(userId);
  if (s.plan === 'free') return true; // free tier = BYOK, not metered
  return s.remaining > 0;
}
