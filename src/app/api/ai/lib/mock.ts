/**
 * generateMockResponse
 * Fallback smart demo reply when no AI API key is available.
 * Generates a STATIC single-return landing page to ensure LivePreview renders correctly.
 */
export function generateMockResponse(message: string, projectPath?: string): string {
  const lc = message.toLowerCase();
  const wantsProject = /landing\s*page|website|web\s*app|toko|store|e-?commerce|aplikasi|app|shop/i.test(lc);
  const wantsCreate  = /buat|create|bikin|buatkan|generate|scaffold|init|new|mulai|start|make|build/i.test(lc);
  const wantsComponent = /component|komponen|button|card|form|input|modal|navbar|header|footer/i.test(lc);

  if (wantsCreate && wantsProject) {
    const isStore = /toko|store|e-?commerce|belanja|shop/i.test(lc);
    const projectType = isStore ? 'online-store' : 'landing-page';
    const code = buildLandingPageCode(isStore);

    if (projectPath) {
      return `Sure! Creating a **${projectType}** landing page in your active project.\n\n[ZYVA_FILE: src/App.tsx]\n\`\`\`tsx\n${code}\n\`\`\`\n[/ZYVA_FILE]\n\nLanding page ready! Click **Apply** to write to your project, then check the **Live Preview**.`;
    } else {
      return `Creating a new **${projectType}** project with a full landing page.\n\n[ZYVA_PROJECT: ${projectType}, react]\n\n[ZYVA_FILE: src/App.tsx]\n\`\`\`tsx\n${code}\n\`\`\`\n[/ZYVA_FILE]\n\nClick **Create Project** then **Apply** to start!`;
    }
  }

  if (wantsComponent) {
    const componentCode = buildButtonComponentCode();
    return `Here's a **Button** component you can use in your project.\n\n[ZYVA_FILE: src/components/Button.tsx]\n\`\`\`tsx\n${componentCode}\n\`\`\`\n[/ZYVA_FILE]\n\nClick **Apply** to add this component to your project.`;
  }

  // Generic greeting / help
  return `Hello! I'm **ZYVA Agent** — an autonomous AI coding assistant powered by **0G Inference Engine (GLM-5.1)**.\n\nI can help you:\n- 📦 **Create projects** (React, Vite, Next.js)\n- ✅ **Write & edit** code directly to files\n- 🔍 **Answer questions** about your code\n- 🤖 **Build full-stack apps** with blockchain integration\n\nTry: *"create an online store landing page"* or *"create a new React project"*\n\n> ⚡ Note: Connect your wallet or add a **0G Router Key** in the panel below to enable full AI (Cerebras GLM-5.1).`;
}

/** Generates a static single-return landing page — no multi-step conditional returns */
function buildLandingPageCode(isStore: boolean): string {
  const name = isStore ? 'ZYVA Store' : 'ZYVA';
  const tagline = isStore
    ? 'Decentralized Commerce — Premium gadgets on 0G Network'
    : 'Build the future with 0G Network AI';

  return [
    "import React from 'react';",
    "",
    "const products = [",
    "  { id: 1, name: 'Vortex Quantum Pro', price: 'Rp 2.499.000', cat: 'Gadget', rating: '4.9', img: 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400&auto=format&fit=crop&q=60', desc: 'Next-gen smartphone with 0G AI neural chipset.' },",
    "  { id: 2, name: 'Chronos Smartwatch X', price: 'Rp 1.899.000', cat: 'Wearable', rating: '4.8', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=60', desc: 'Manage your autonomous nodes from your wrist.' },",
    "  { id: 3, name: 'AeroBuds Pro 3', price: 'Rp 1.299.000', cat: 'Audio', rating: '4.7', img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=60', desc: 'ANC earbuds with 3D spatial audio technology.' },",
    "  { id: 4, name: 'Nova Lightpad 12', price: 'Rp 4.599.000', cat: 'Tablet', rating: '4.9', img: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=400&auto=format&fit=crop&q=60', desc: '4K tablet with smart stylus for creators.' },",
    "  { id: 5, name: 'Lumina Ring Pro', price: 'Rp 750.000', cat: 'Accessories', rating: '4.6', img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=60', desc: 'Professional LED ring light for streaming.' },",
    "  { id: 6, name: 'Synapse Hub Router', price: 'Rp 3.199.000', cat: 'Network', rating: '4.9', img: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&auto=format&fit=crop&q=60', desc: 'Gigabit mesh router with blockchain integration.' },",
    "];",
    "",
    "export default function App() {",
    "  return (",
    "    <div style={{ minHeight: '100vh', background: '#0d0e12', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', display: 'flex', flexDirection: 'column' }}>",
    "",
    "      {/* Promo Banner */}",
    "      <div style={{ background: 'linear-gradient(90deg,#007acc,#4ec9b0)', padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#000', letterSpacing: 1 }}>",
    "        ⚡ 15% OFF Launch Discount! Code: ZYVA0G &bull; Powered by 0G Network",
    "      </div>",
    "",
    "      {/* Header */}",
    "      <header style={{ position: 'sticky', top: 0, zIndex: 40, backdropFilter: 'blur(12px)', background: 'rgba(13,14,18,0.92)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>",
    "        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>",
    "          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'linear-gradient(135deg,#007acc,#4ec9b0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#000' }}>Z</div>",
    "          <div>",
    "            <div style={{ fontWeight: 800, fontSize: 17, background: 'linear-gradient(90deg,#007acc,#4ec9b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>" + name + "</div>",
    "            <div style={{ fontSize: 9, color: '#555', letterSpacing: 3, fontFamily: 'monospace' }}>0G DECENTRALIZED</div>",
    "          </div>",
    "        </div>",
    "        <nav style={{ display: 'flex', gap: 20, fontSize: 13, color: '#aaa' }}>",
    "          <a href='#' style={{ color: '#4ec9b0', textDecoration: 'none', fontWeight: 600 }}>Home</a>",
    "          <a href='#' style={{ color: '#aaa', textDecoration: 'none' }}>Products</a>",
    "          <a href='#' style={{ color: '#aaa', textDecoration: 'none' }}>About</a>",
    "          <a href='#' style={{ color: '#aaa', textDecoration: 'none' }}>Contact</a>",
    "        </nav>",
    "        <button style={{ background: 'linear-gradient(90deg,#007acc,#4ec9b0)', color: '#000', border: 'none', borderRadius: 9, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>",
    "          Connect Wallet",
    "        </button>",
    "      </header>",
    "",
    "      {/* Hero Section */}",
    "      <section style={{ padding: '80px 24px 60px', textAlign: 'center', background: 'radial-gradient(ellipse at 50% 0%, rgba(0,122,204,0.15) 0%, transparent 70%)' }}>",
    "        <div style={{ display: 'inline-block', background: 'rgba(78,201,176,0.1)', border: '1px solid rgba(78,201,176,0.3)', borderRadius: 20, padding: '4px 14px', fontSize: 11, color: '#4ec9b0', fontWeight: 700, marginBottom: 20, letterSpacing: 1 }}>",
    "          ✦ Powered by 0G Inference Engine (GLM-5.1)",
    "        </div>",
    "        <h1 style={{ fontSize: 54, fontWeight: 900, margin: '0 0 16px', background: 'linear-gradient(90deg,#fff,#4ec9b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>",
    "          " + tagline,
    "        </h1>",
    "        <p style={{ color: '#666', fontSize: 16, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 }}>",
    "          Premium products verified on-chain. Every purchase secured by 0G Network's decentralized infrastructure.",
    "        </p>",
    "        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>",
    "          <button style={{ background: 'linear-gradient(90deg,#007acc,#4ec9b0)', color: '#000', border: 'none', borderRadius: 10, padding: '13px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>",
    "            🛒 Shop Now",
    "          </button>",
    "          <button style={{ background: 'transparent', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '13px 28px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>",
    "            Learn More →",
    "          </button>",
    "        </div>",
    "        {/* Stats */}",
    "        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: 48, flexWrap: 'wrap' }}>",
    "          {[['10K+', 'Happy Customers'], ['500+', 'Products'], ['99.9%', 'Uptime on 0G'], ['24/7', 'AI Support']].map(([v, l]) => (",
    "            <div key={l} style={{ textAlign: 'center' }}>",
    "              <div style={{ fontSize: 26, fontWeight: 900, background: 'linear-gradient(90deg,#007acc,#4ec9b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{v}</div>",
    "              <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{l}</div>",
    "            </div>",
    "          ))}",
    "        </div>",
    "      </section>",
    "",
    "      {/* Products Grid */}",
    "      <main style={{ flex: 1, padding: '48px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>",
    "        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>",
    "          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Featured Products</h2>",
    "          <div style={{ display: 'flex', gap: 8 }}>",
    "            {['All', 'Gadget', 'Wearable', 'Audio'].map(c => (",
    "              <button key={c} style={{ background: c === 'All' ? 'linear-gradient(90deg,#007acc,#4ec9b0)' : '#1e1f26', color: c === 'All' ? '#000' : '#aaa', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: c === 'All' ? 700 : 500, cursor: 'pointer' }}>{c}</button>",
    "            ))}",
    "          </div>",
    "        </div>",
    "        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>",
    "          {products.map(p => (",
    "            <div key={p.id} style={{ background: '#16171d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>",
    "              <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>",
    "                <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />",
    "                <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(13,14,18,0.85)', border: '1px solid rgba(78,201,176,0.3)', color: '#4ec9b0', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{p.cat}</span>",
    "              </div>",
    "              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>",
    "                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>",
    "                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.name}</h3>",
    "                  <span style={{ fontSize: 11, color: '#f6ad55', fontWeight: 700 }}>★ {p.rating}</span>",
    "                </div>",
    "                <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.5 }}>{p.desc}</p>",
    "                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>",
    "                  <span style={{ fontWeight: 800, color: '#4ec9b0', fontSize: 14 }}>{p.price}</span>",
    "                  <div style={{ display: 'flex', gap: 6 }}>",
    "                    <button style={{ background: '#272833', color: '#aaa', border: 'none', borderRadius: 9, padding: '7px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Detail</button>",
    "                    <button style={{ background: 'linear-gradient(90deg,#007acc,#4ec9b0)', color: '#000', border: 'none', borderRadius: 9, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Buy</button>",
    "                  </div>",
    "                </div>",
    "              </div>",
    "            </div>",
    "          ))}",
    "        </div>",
    "      </main>",
    "",
    "      {/* Features */}",
    "      <section style={{ padding: '60px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>",
    "        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 40 }}>Why Choose 0G Network?</h2>",
    "        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>",
    "          {[",
    "            { icon: '🔒', title: 'On-chain Verified', desc: 'Every product authenticity verified on 0G Network.' },",
    "            { icon: '⚡', title: 'GLM-5.1 AI', desc: 'Powered by 0G Inference Engine for smart recommendations.' },",
    "            { icon: '🌐', title: 'Decentralized', desc: 'No central authority. Your data, your control.' },",
    "            { icon: '💎', title: 'Premium Quality', desc: 'Curated products from verified sellers worldwide.' },",
    "          ].map(f => (",
    "            <div key={f.title} style={{ background: '#16171d', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 24, textAlign: 'center' }}>",
    "              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>",
    "              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>{f.title}</h3>",
    "              <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.6 }}>{f.desc}</p>",
    "            </div>",
    "          ))}",
    "        </div>",
    "      </section>",
    "",
    "      {/* Footer */}",
    "      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center', color: '#444', fontSize: 11 }}>",
    "        <div style={{ marginBottom: 8, fontWeight: 700, color: '#666', fontSize: 12 }}>© 2026 " + name + " &middot; Decentralized on 0G Network</div>",
    "        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11 }}>",
    "          <a href='#' style={{ color: '#4ec9b0', textDecoration: 'none' }}>Privacy</a>",
    "          <a href='#' style={{ color: '#555', textDecoration: 'none' }}>Terms</a>",
    "          <a href='#' style={{ color: '#555', textDecoration: 'none' }}>Support</a>",
    "        </div>",
    "      </footer>",
    "    </div>",
    "  );",
    "}",
  ].join('\n');
}

/** Simple reusable button component */
function buildButtonComponentCode(): string {
  return [
    "import React from 'react';",
    "",
    "interface ButtonProps {",
    "  children: React.ReactNode;",
    "  variant?: 'primary' | 'secondary' | 'outline';",
    "  size?: 'sm' | 'md' | 'lg';",
    "  disabled?: boolean;",
    "  className?: string;",
    "}",
    "",
    "export function Button({ children, variant = 'primary', size = 'md', disabled = false, className = '' }: ButtonProps) {",
    "  const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all cursor-pointer border-none';",
    "  const variants = {",
    "    primary: 'bg-gradient-to-r from-[#007acc] to-[#4ec9b0] text-black hover:opacity-90',",
    "    secondary: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',",
    "    outline: 'bg-transparent border border-zinc-700 text-zinc-300 hover:border-[#007acc] hover:text-[#4ec9b0]',",
    "  };",
    "  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };",
    "",
    "  return (",
    "    <button",
    "      className={[base, variants[variant], sizes[size], disabled ? 'opacity-40 cursor-not-allowed' : '', className].join(' ')}",
    "      disabled={disabled}",
    "    >",
    "      {children}",
    "    </button>",
    "  );",
    "}",
    "",
    "// Usage example:",
    "export default function ButtonDemo() {",
    "  return (",
    "    <div className='flex flex-col gap-4 p-8 bg-zinc-950 min-h-screen items-start'>",
    "      <h1 className='text-2xl font-bold text-white mb-4'>Button Component</h1>",
    "      <div className='flex gap-3 flex-wrap'>",
    "        <Button variant='primary'>Primary</Button>",
    "        <Button variant='secondary'>Secondary</Button>",
    "        <Button variant='outline'>Outline</Button>",
    "      </div>",
    "      <div className='flex gap-3 flex-wrap items-center'>",
    "        <Button size='sm'>Small</Button>",
    "        <Button size='md'>Medium</Button>",
    "        <Button size='lg'>Large</Button>",
    "      </div>",
    "      <Button disabled>Disabled</Button>",
    "    </div>",
    "  );",
    "}",
  ].join('\n');
}
