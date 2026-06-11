import React from 'react';
export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0e12', color: '#fff', fontFamily: 'Inter,sans-serif' }}>
      <header style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>ZYVA Store</h1>
      </header>
      <main style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 48, fontWeight: 900 }}>Featured Products</h2>
        <p style={{ color: '#666', fontSize: 16, marginTop: 12 }}>Premium gadgets on 0G Network.</p>
      </main>
    </div>
  );
}