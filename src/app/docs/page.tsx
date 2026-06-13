'use client';

import Link from 'next/link';

const DOCS = [
  {
    slug: 'deploy-vercel',
    title: 'Deploy to Vercel via GitHub',
    description: 'Push your project from ZYVA, connect to Vercel, and get auto-deploy on every commit.',
    badge: 'Deploy',
    badgeColor: '#3b82f6',
  },
  {
    slug: 'github-commit',
    title: 'Commit & Push to GitHub',
    description: 'How ZYVA commits your project files directly to a GitHub repository.',
    badge: 'Git',
    badgeColor: '#22c55e',
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Create your first project, run the dev server, and ship your first app.',
    badge: 'Intro',
    badgeColor: '#7c3aed',
  },
];

export default function DocsIndex() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0e12',
      color: '#e8e8ea',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Nav */}
      <header style={{
        position: 'sticky', top: 0,
        background: 'rgba(13,14,18,.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.07)',
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#e8e8ea', letterSpacing: -0.5 }}>ZYVA</span>
            <span style={{ color: 'rgba(255,255,255,.2)', fontSize: 16 }}>/</span>
            <span style={{ color: '#8a8f98', fontSize: 14 }}>Docs</span>
          </Link>
          <Link href="/docs" style={{ color: '#8a8f98', fontSize: 13, textDecoration: 'none' }}>
            All guides →
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
        {/* Hero — book icon + title */}
        <div style={{ textAlign: 'center', padding: '72px 0 48px' }}>
          {/* Book icon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 80, height: 80, borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(124,58,237,.25), rgba(59,130,246,.15))',
            border: '1px solid rgba(124,58,237,.3)',
            marginBottom: 28,
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 12px', letterSpacing: -1 }}>
            ZYVA Documentation
          </h1>
          <p style={{ color: '#8a8f98', fontSize: 17, maxWidth: 520, margin: '0 auto' }}>
            Everything you need to build, deploy, and ship apps with ZYVA Cloud IDE.
          </p>
        </div>

        {/* Doc cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, paddingBottom: 80 }}>
          {DOCS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: '#16171d',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 14,
                padding: '22px 20px',
                cursor: 'pointer',
                transition: 'border-color .15s, background .15s',
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124,58,237,.4)';
                  (e.currentTarget as HTMLDivElement).style.background = '#1c1d26';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.07)';
                  (e.currentTarget as HTMLDivElement).style.background = '#16171d';
                }}
              >
                <span style={{
                  display: 'inline-block',
                  background: `${doc.badgeColor}22`,
                  border: `1px solid ${doc.badgeColor}44`,
                  color: doc.badgeColor,
                  fontSize: 11, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 6, marginBottom: 12,
                }}>
                  {doc.badge}
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8ea', marginBottom: 8 }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 13, color: '#8a8f98', lineHeight: 1.5 }}>
                  {doc.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
