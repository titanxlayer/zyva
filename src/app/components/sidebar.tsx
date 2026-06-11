import React from 'react';

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-zinc-400 border-r border-zinc-800 h-full p-4">
      <nav className="space-y-2">
        <a href="#" className="block px-3 py-2 rounded bg-zinc-800 text-white font-medium">Dashboard</a>
        <a href="#" className="block px-3 py-2 rounded hover:bg-zinc-800 hover:text-white">Settings</a>
        <a href="#" className="block px-3 py-2 rounded hover:bg-zinc-800 hover:text-white">Analytics</a>
      </nav>
    </aside>
  );
}
