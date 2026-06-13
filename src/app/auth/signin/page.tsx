'use client';

import { signIn } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { buildSignMessage } from '@/lib/wallet';
import dynamic from 'next/dynamic';

// Load real IDE in background — no SSR needed
const IDEApp = dynamic(() => import('@/app/page'), { ssr: false });

export default function SignInPage() {
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  // Subtle parallax on mouse move
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!cardRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 6;
      cardRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  async function handleWalletSignIn() {
    setWalletLoading(true);
    setError('');
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        setError('No wallet detected. Install MetaMask or another EVM wallet.');
        return;
      }
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      if (!address) throw new Error('No account selected');
      try {
        await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x40E9' }] });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0x40E9', chainName: '0G Chain', nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 }, rpcUrls: ['https://evmrpc-testnet.0g.ai'], blockExplorerUrls: ['https://chainscan-galileo.0g.ai'] }],
          });
        }
      }
      const nonce = Date.now().toString();
      const message = buildSignMessage({ address, nonce });
      const signature = await ethereum.request({ method: 'personal_sign', params: [message, address] });
      await signIn('wallet', { address, message, signature, callbackUrl: '/' });
    } catch (err: any) {
      setError(err.message || 'Wallet sign-in failed');
    } finally {
      setWalletLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Real IDE rendered in background ──────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        userSelect: 'none',
        filter: 'blur(3px) brightness(0.35)',
        transform: 'scale(1.02)', // hide blur edge artifacts
        transformOrigin: 'center',
      }}>
        <IDEApp />
      </div>

      {/* ── Dark vignette overlay ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Purple glow behind card ───────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(124,58,237,.22) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Floating login card ───────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: 400,
          zIndex: 20,
          transition: 'transform 0.12s ease-out',
        }}
      >
        <div style={{
          background: 'rgba(18,19,26,0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(124,58,237,.3)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 0 0 1px rgba(124,58,237,.08), 0 32px 80px rgba(0,0,0,.7), 0 0 60px rgba(124,58,237,.1)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              fontSize: 32, fontWeight: 900, letterSpacing: -1.5,
              background: 'linear-gradient(90deg, #fff 30%, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>ZYVA</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginTop: 5, fontWeight: 500 }}>
              Sign in to Cloud IDE
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Google */}
            <button onClick={() => signIn('google', { callbackUrl: '/' })} style={btn('rgba(255,255,255,.07)', '#e8e8ea')}>
              <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

            {/* GitHub */}
            <button onClick={() => signIn('github', { callbackUrl: '/' })} style={btn('rgba(255,255,255,.07)', '#e8e8ea')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Continue with GitHub
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
              <span style={{ color: '#4b5563', fontSize: 11 }}>or connect wallet</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
            </div>

            {/* Wallet */}
            <button
              onClick={handleWalletSignIn}
              disabled={walletLoading}
              style={btn('rgba(124,58,237,.12)', '#a78bfa', '1px solid rgba(124,58,237,.35)')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
                <circle cx="17" cy="14" r="1" fill="currentColor"/>
              </svg>
              {walletLoading ? 'Connecting…' : 'Connect Wallet · 0G Chain'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 14, padding: '9px 13px',
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 8, color: '#fca5a5', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <p style={{ textAlign: 'center', color: '#374151', fontSize: 11, marginTop: 22 }}>
            By signing in you agree to our{' '}
            <a href="https://zyva.dev/#legal" style={{ color: '#6b7280' }}>Terms</a>
          </p>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; }
        button:hover { opacity: 0.82 !important; }
        button:active { transform: scale(0.98) !important; }
        button:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }
      `}</style>
    </div>
  );
}

function btn(bg: string, color: string, border = '1px solid rgba(255,255,255,.08)'): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 9, padding: '11px 16px', borderRadius: 10,
    background: bg, color, border,
    fontWeight: 700, fontSize: 13,
    transition: 'opacity .15s, transform .1s',
    width: '100%',
  };
}
