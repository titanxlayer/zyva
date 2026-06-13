import Link from 'next/link';

export default function DeployVercelDocs() {
  return (
    <DocsPage
      badge="Deploy"
      badgeColor="#3b82f6"
      title="Deploy to Vercel via GitHub"
      description="Push your project from ZYVA Cloud IDE to GitHub, connect it to Vercel, and get automatic deploys on every commit."
    >
      <Section title="How it works">
        <p>ZYVA uses a one-way pipeline:</p>
        <Flow steps={[
          'You write code in ZYVA Cloud IDE',
          'Click "Commit & Push" — ZYVA pushes to your GitHub repo',
          'Vercel detects the push and auto-deploys your app',
          'Your app is live at your Vercel URL',
        ]} />
        <p>You only need to connect Vercel to GitHub once. After that, every push from ZYVA triggers a deploy automatically — no extra steps.</p>
      </Section>

      <Section title="Step 1 — Sign in with GitHub">
        <p>Open <a href="https://app.zyva.dev/auth/signin" target="_blank" rel="noopener noreferrer">app.zyva.dev</a> and sign in with <strong>GitHub</strong>. This gives ZYVA permission to create and push to repositories on your behalf.</p>
        <Note type="info">ZYVA only requests <code>repo</code> scope — it can read and write your repositories but nothing else.</Note>
      </Section>

      <Section title="Step 2 — Create or open a project">
        <p>In the IDE, go to <strong>File → Create Project</strong> and choose a template (React + Vite recommended for Vercel). Give it a name — this will also be the GitHub repository name.</p>
      </Section>

      <Section title="Step 3 — Commit and push from ZYVA">
        <p>Click the <strong>Source Control</strong> icon in the sidebar (branching icon), write a commit message, and click <strong>Commit & Push</strong>.</p>
        <p>ZYVA will:</p>
        <ol>
          <li>Initialise a git repo in your project (if not already)</li>
          <li>Stage all files and create a commit</li>
          <li>Create a GitHub repository under your account (if it does not exist)</li>
          <li>Push the commit to <code>main</code></li>
        </ol>
        <p>After the push, you will see a link to your GitHub repo in the terminal panel.</p>
      </Section>

      <Section title="Step 4 — Connect Vercel">
        <ol>
          <li>Go to <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer">vercel.com/new</a></li>
          <li>Click <strong>Import Git Repository</strong></li>
          <li>Select the repository ZYVA just pushed to</li>
          <li>Vercel auto-detects the framework (Vite). Leave defaults and click <strong>Deploy</strong></li>
          <li>Your app is live in under a minute</li>
        </ol>
        <Note type="tip">Vercel gives you a free <code>your-project.vercel.app</code> URL. You can add a custom domain later from your Vercel project settings.</Note>
      </Section>

      <Section title="Step 5 — Iterate">
        <p>From this point, your workflow is:</p>
        <Flow steps={[
          'Edit code in ZYVA',
          'Commit & Push from the sidebar',
          'Vercel auto-deploys — your URL updates in ~30 seconds',
        ]} />
        <p>No CI/CD setup needed. Vercel handles it all from the GitHub push.</p>
      </Section>

      <Section title="Troubleshooting">
        <table>
          <thead><tr><th>Problem</th><th>Fix</th></tr></thead>
          <tbody>
            <tr><td>Push fails — "GitHub not connected"</td><td>Sign out and sign back in with GitHub to refresh the OAuth token.</td></tr>
            <tr><td>Vercel shows build error</td><td>Check the Vercel build logs. Usually a missing environment variable or wrong framework setting.</td></tr>
            <tr><td>Repo is private — Vercel can't find it</td><td>In Vercel settings, make sure your GitHub account is connected with access to private repos.</td></tr>
          </tbody>
        </table>
      </Section>
    </DocsPage>
  );
}

// ── Shared layout components ──────────────────────────────────────────────────

function DocsPage({ badge, badgeColor, title, description, children }: {
  badge: string; badgeColor: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0e12', color: '#e8e8ea', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{
        position: 'sticky', top: 0, background: 'rgba(13,14,18,.9)',
        backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)', zIndex: 10,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, height: 56 }}>
          <Link href="/docs" style={{ color: '#8a8f98', fontSize: 13, textDecoration: 'none' }}>← Docs</Link>
          <span style={{ color: 'rgba(255,255,255,.15)' }}>/</span>
          <span style={{ color: '#e8e8ea', fontSize: 13 }}>{title}</span>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        {/* Book icon + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 12,
            background: `${badgeColor}18`, border: `1px solid ${badgeColor}33`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={badgeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <span style={{
            display: 'inline-block', background: `${badgeColor}22`,
            border: `1px solid ${badgeColor}44`, color: badgeColor,
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
          }}>{badge}</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px', letterSpacing: -0.8 }}>{title}</h1>
        <p style={{ color: '#8a8f98', fontSize: 16, margin: '0 0 48px', lineHeight: 1.6 }}>{description}</p>

        <article style={{ fontSize: 15, lineHeight: 1.8 }}>{children}</article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#e8e8ea', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.07)' }}>{title}</h2>
      <div style={{ color: '#b0b5bf', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '8px 0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(124,58,237,.2)', border: '1px solid rgba(124,58,237,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>{i + 1}</div>
            {i < steps.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'rgba(124,58,237,.2)', margin: '2px 0' }} />}
          </div>
          <p style={{ margin: '2px 0 14px', color: '#b0b5bf' }}>{step}</p>
        </div>
      ))}
    </div>
  );
}

function Note({ type, children }: { type: 'info' | 'tip' | 'warn'; children: React.ReactNode }) {
  const colors: Record<string, { bg: string; border: string; icon: string }> = {
    info: { bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.25)', icon: '#3b82f6' },
    tip: { bg: 'rgba(34,197,94,.08)', border: 'rgba(34,197,94,.25)', icon: '#22c55e' },
    warn: { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)', icon: '#f59e0b' },
  };
  const c = colors[type];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#b0b5bf' }}>
      {children}
    </div>
  );
}
