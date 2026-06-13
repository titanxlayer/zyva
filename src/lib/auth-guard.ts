import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * Auth guard for API routes.
 * Returns the userId from the session, or a 401 response if not authenticated.
 */
export async function requireAuth(): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { userId: session.user.id, error: null };
}
