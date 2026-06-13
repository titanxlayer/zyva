'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get('error');

  const messages: Record<string, string> = {
    OAuthSignin: 'Error starting sign-in. Try again.',
    OAuthCallback: 'Error completing sign-in. Try again.',
    OAuthCreateAccount: 'Could not create account.',
    Callback: 'Sign-in callback error.',
    CredentialsSignin: 'Invalid credentials. Check your wallet signature.',
    default: 'An unexpected error occurred.',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d0e12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#16171d', border: '1px solid rgba(239,68,68,.3)',
        borderRadius: 16, padding: '40px 36px', maxWidth: 400, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: '#e8e8ea', fontWeight: 800, marginBottom: 8 }}>Sign-in error</h2>
        <p style={{ color: '#8a8f98', fontSize: 14, marginBottom: 24 }}>
          {messages[error || 'default'] || messages.default}
        </p>
        <a href="/auth/signin" style={{
          display: 'inline-block', padding: '10px 20px', background: '#7c3aed',
          color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          Try again
        </a>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
