import Link from 'next/link';

export default function GettingStartedDocs() {
  return (
    <DocsPage
      badge="Intro"
      badgeColor="#7c3aed"
      title="Getting Started"
      description="Create your first project, run the dev server, and ship your first app in under 5 minutes."
    >
      <Section title="1. Sign in">
        <p>Go to <a href="https://app.zyva.dev" target="_blank" rel="noopener noreferrer">app.zyva.dev</a> and sign in with <strong>Google</strong>, <strong>GitHub</strong>, or a <strong>Web3 wallet</strong> (MetaMask on 0G Chain).</p>
        <Note type="tip">Sign in with GitHub if you plan to push code to GitHub or deploy to Vercel.</Note>
      </Section>

      <Section title="2. Create a project">
        <ol>
          <li>Click <strong>File → Create Project</strong> (or <code>Ctrl+Shift+P → Create New Project</code>).</li>
          <li>Choose a template — <strong>React + Vite + TypeScript</strong> is recommended for web apps.</li>
          <li>Give it a name and click <strong>Create</strong>.</li>
        </ol>
        <p>ZYVA scaffolds the project and injects three guidance files into the root:</p>
        <ul>
          <li><code>CLAUDE.md</code> — project context for the AI agent</li>
          <li><code>AGENTS.md</code> — stack rules and conventions</li>
          <li><code>DESIGN.md</code> — visual design system</li>
        </ul>
        <p>The AI agent reads these before generating any code so output is always consistent with your stack.</p>
      </Section>

      <Section title="3. Write code with AI">
        <p>Open the <strong>Agent</strong> panel on the right side, type what you want to build, and press Enter. The multi-agent system (Architect → Frontend/Backend → Review) will plan and apply changes directly to your files.</p>
        <Note type="info">All AI inference runs on <a href="https://pc.0g.ai" target="_blank" rel="noopener noreferrer">0G Private Computer</a> — inside a Trusted Execution Environment (TEE). Your prompts and code are not logged by the inference provider.</Note>
      </Section>

      <Section title="4. Preview your app">
        <p>Click the <strong>Preview</strong> button in the editor toolbar. ZYVA runs your project inside the <strong>ZYVA Sandbox</strong> — a full Node.js environment right in your browser — and shows the result in a live preview panel. Hot reload works automatically when you save files.</p>
      </Section>

      <Section title="5. Deploy">
        <p>Ready to ship?</p>
        <ol>
          <li>Open the <strong>Source Control</strong> sidebar panel.</li>
          <li>Write a commit message and click <strong>Commit & Push</strong>.</li>
          <li>ZYVA pushes to GitHub. If this is your first push, a new private repo is created automatically.</li>
          <li>Connect the repo to <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer">Vercel</a> — every future push auto-deploys.</li>
        </ol>
        <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/docs/github-commit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#22c55e', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            GitHub commit guide →
          </Link>
          <Link href="/docs/deploy-vercel" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', color: '#3b82f6', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Deploy to Vercel →
          </Link>
        </div>
      </Section>
    </DocsPage>
  );
}

function DocsPage({ badge, badgeColor, title, description, children }: { badge: string; badgeColor: string; title: string; description: string; children: React.ReactNode }) {
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

function Note({ type, children }: { type: 'info' | 'tip'; children: React.ReactNode }) {
  const c = { info: { bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.25)' }, tip: { bg: 'rgba(34,197,94,.08)', border: 'rgba(34,197,94,.25)' } }[type];
  return <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#b0b5bf' }}>{children}</div>;
}
