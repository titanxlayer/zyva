import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getCreditState, listPlansForUi } from '@/lib/billing';
import { prisma } from '@/lib/prisma';

/** Current user's plan + credit state + available plans (for the Profile panel). */
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const state = await getCreditState(userId);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).catch(() => null);
  return NextResponse.json({
    success: true,
    ...state,
    plans: listPlansForUi(userId, u?.email || undefined),
  });
}
