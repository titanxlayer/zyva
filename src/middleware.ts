import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Edge-compatible middleware.
 * Uses next-auth JWT directly — no DB, no Node built-ins.
 * Redirects unauthenticated users to /auth/signin.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: auth pages, NextAuth API, static assets, docs (public)
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/docs') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: true,
  });

  if (!token) {
    const appUrl = process.env.NEXTAUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const signInUrl = new URL('/auth/signin', appUrl);
    signInUrl.searchParams.set('callbackUrl', `${appUrl}${pathname}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
