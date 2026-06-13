import Link from 'next/link';

export default function GitHubCommitDocs() {
  return (
    <DocsPage
      badge="Git"
      badgeColor="#22c55e"
      title="Commit & Push to GitHub"
      description="ZYVA Cloud IDE has built-in git — commit your project files and push directly to GitHub without leaving the browser."
    >
      <Section title="Prerequisites">
        <ul>
          <li>Sign in to ZYVA with your <strong>GitHub account</strong> — this is required so ZYVA can push on your behalf.</li>
          <li>Have an open project (File → Create Project or File → Open Folder).</li>
        </ul>
      </Section>

      <Section title="Making your first commit">
        <ol>
          <li>Click the <strong>Source Control</strong> icon in the left sidebar (the branching icon).</li>
          <li>You will see a list of changed files.</li>
          <li>Type a commit message in the text field (e.g. <code>initial commit</code>).</li>
          <li>Click <strong>Commit & Push</strong>.</li>
        </ol>
        <p>That is it. ZYVA will:</p>
        <ul>
          <li>Initialise a git repository in your project folder if there is not one yet.</li>
          <li>Stage all changed files (<code>git add -A</code>).</li>
          <li>Create the commit with your message.</li>
          <li>Create a GitHub repository named after your project (private by default).</li>
          <li>Push to <code>main</code>.</li>
        </ul>
        <Note type="tip">After the first push, the terminal shows a link to your GitHub repository.</Note>
      </Section>

      <Section title="Subsequent commits">
        <p>Every time you make changes and click <strong>Commit & Push</strong>, ZYVA pushes to the same GitHub repo. The Source Control panel shows the number of changed files since your last commit.</p>
      </Section>

      <Section title="What ZYVA does with your GitHub token">
        <p>When you sign in with GitHub, ZYVA requests the <code>repo</code> OAuth scope. This token is stored securely server-side and used only to:</p>
        <ul>
          <li>Create repositories under your account</li>
          <li>Push commits to those repositories</li>
        </ul>
        <p>ZYVA never reads repositories it did not create for you, and never reads your private data beyond what is needed to push.</p>
        <Note type="info">You can revoke ZYVA's access at any time from <a href="https://github.com/settings/applications" target="_blank" rel="noopener noreferrer">github.com/settings/applications</a>.</Note>
      </Section>

      <Section title="The commit author">
        <p>Commits are authored with your GitHub name and email (fetched from the GitHub API at push time). If your email is private on GitHub, ZYVA uses your <code>@users.noreply.github.com</code> address instead.</p>
      </Section>

      <Section title="Troubleshooting">
        <table>
          <thead><tr><th>Problem</th><th>Fix</th></tr></thead>
          <tbody>
            <tr><td>"GitHub not connected"</td><td>Sign out and sign back in with GitHub.</td></tr>
            <tr><td>"nothing to commit"</td><td>No files changed since the last commit.</td></tr>
            <tr><td>Push rejected (non-fast-forward)</td><td>Someone else pushed to the same repo. You may need to resolve conflicts manually via the terminal (<code>git pull --rebase</code>).</td></tr>
          </tbody>
        </table>
      </Section>

      <div style={{ marginTop: 48 }}>
        <Link href="/docs/deploy-vercel" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)',
          color: '#3b82f6', borderRadius: 10, padding: '10px 16px',
          fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}>
          Next: Deploy to Vercel →
        </Link>
      </div>
    </DocsPage>
  );
}

// ── Shared layout (same as deploy-vercel page) ────────────────────────────────

function DocsPage({ badge, badgeColor, title, description, children }: {
  badge: string; badgeColor: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0e12', color: '#e8e8ea', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, background: 'rgba(13,14,18,.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)', zIndex: 10 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, height: 56 }}>
          <Link href="/docs" style={{ color: '#8a8f98', fontSize: 13, textDecoration: 'none' }}>← Docs</Link>
          <span style={{ color: 'rgba(255,255,255,.15)' }}>/</span>
          <span style={{ color: '#e8e8ea', fontSize: 13 }}>{title}</span>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: `${badgeColor}18`, border: `1px solid ${badgeColor}33` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={badgeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <span style={{ display: 'inline-block', background: `${badgeColor}22`, border: `1px solid ${badgeColor}44`, color: badgeColor, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{badge}</span>
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

function Note({ type, children }: { type: 'info' | 'tip' | 'warn'; children: React.ReactNode }) {
  const c = { info: { bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.25)', }, tip: { bg: 'rgba(34,197,94,.08)', border: 'rgba(34,197,94,.25)' }, warn: { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)' } }[type];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#b0b5bf' }}>
      {children}
    </div>
  );
}
