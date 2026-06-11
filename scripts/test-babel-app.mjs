import Babel from '@babel/standalone';

const code = `
import React from 'react';
import { Sidebar } from './components/sidebar';
import Dashboard from './dashboard';

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: 'screen', backgroundColor: '#0d0e12', color: '#ffffff' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <Dashboard />
      </main>
    </div>
  );
}
`;

try {
  const result = Babel.transform(code, {
    presets: ['env', 'react', 'typescript'],
    filename: 'src/App.tsx'
  });
  console.log("SUCCESS:");
  console.log(result.code);
} catch (e) {
  console.log("ERROR:", e.message);
}
