/**
 * ZYVA Extensions Catalog
 * All extensions are real npm packages that run in-browser via Monaco APIs.
 * No VSIX, no Extension Host — everything is browser-compatible.
 */

export interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: 'formatter' | 'theme' | 'language' | 'productivity' | 'linting';
  icon: string;       // gradient or emoji
  iconBg: string;
  installed: boolean; // default
  builtin?: boolean;  // cannot be uninstalled
  npmPackage?: string;
}

export const EXTENSIONS_CATALOG: Extension[] = [
  // ── Tier 1 — Formatters ──────────────────────────────────────────────────
  {
    id: 'prettier',
    name: 'Prettier',
    description: 'Opinionated code formatter. Format on save with Shift+Alt+F. Supports TS, JS, CSS, HTML, JSON, Markdown.',
    author: 'Prettier',
    version: '3.5.3',
    category: 'formatter',
    icon: '✦',
    iconBg: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    installed: true,
    npmPackage: 'prettier',
  },

  // ── Tier 1 — Productivity ────────────────────────────────────────────────
  {
    id: 'emmet',
    name: 'Emmet',
    description: 'Expand abbreviations like div.container>ul>li*3 into full HTML/JSX. Built into ZYVA for HTML, JSX, and TSX files.',
    author: 'Emmet',
    version: '2.4.7',
    category: 'productivity',
    icon: '⚡',
    iconBg: 'linear-gradient(135deg, #f7971e, #ffd200)',
    installed: true,
    npmPackage: 'emmet-monaco-es',
  },
  {
    id: 'bracket-colorizer',
    name: 'Bracket Pair Colorizer',
    description: 'Colorizes matching bracket pairs for easier code navigation. Built into Monaco — zero config.',
    author: 'CoenraadS',
    version: '1.0.0',
    category: 'productivity',
    icon: '{ }',
    iconBg: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    installed: true,
    builtin: true,
  },

  // ── Tier 1 — Icons ───────────────────────────────────────────────────────
  {
    id: 'file-icons',
    name: 'File Icon Theme',
    description: 'Colorful icons for every file type in the Explorer. TypeScript, React, CSS, JSON, Rust, Python and more.',
    author: 'ZYVA',
    version: '1.0.0',
    category: 'productivity',
    icon: '🎨',
    iconBg: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    installed: true,
    builtin: true,
  },

  // ── Tier 1 — Themes ─────────────────────────────────────────────────────
  {
    id: 'theme-dracula',
    name: 'Dracula Theme',
    description: 'The iconic dark theme with purple and green accents. Most popular dark theme for editors.',
    author: 'Dracula',
    version: '3.0.0',
    category: 'theme',
    icon: '🧛',
    iconBg: 'linear-gradient(135deg, #282a36, #6272a4)',
    installed: true,
    npmPackage: 'monaco-themes',
  },
  {
    id: 'theme-monokai',
    name: 'Monokai',
    description: 'Classic Monokai color scheme. Warm, high-contrast, easy on the eyes for long coding sessions.',
    author: 'Wimer Hazenberg',
    version: '3.0.0',
    category: 'theme',
    icon: '🌙',
    iconBg: 'linear-gradient(135deg, #272822, #75715e)',
    installed: false,
    npmPackage: 'monaco-themes',
  },
  {
    id: 'theme-night-owl',
    name: 'Night Owl',
    description: 'A VS Code theme for the night owls. Carefully designed for contrast and readability in low light.',
    author: 'Sarah Drasner',
    version: '3.0.0',
    category: 'theme',
    icon: '🦉',
    iconBg: 'linear-gradient(135deg, #011627, #1d3b53)',
    installed: false,
    npmPackage: 'monaco-themes',
  },
  {
    id: 'theme-github-dark',
    name: 'GitHub Dark',
    description: "GitHub's official dark theme. If you spend your days on GitHub, this will feel like home.",
    author: 'GitHub',
    version: '3.0.0',
    category: 'theme',
    icon: '🐙',
    iconBg: 'linear-gradient(135deg, #0d1117, #161b22)',
    installed: false,
    npmPackage: 'monaco-themes',
  },
  {
    id: 'theme-solarized-dark',
    name: 'Solarized Dark',
    description: 'Precision colors for machines and people. Low contrast, scientifically designed for readability.',
    author: 'Ethan Schoonover',
    version: '3.0.0',
    category: 'theme',
    icon: '☀️',
    iconBg: 'linear-gradient(135deg, #002b36, #073642)',
    installed: false,
    npmPackage: 'monaco-themes',
  },
  {
    id: 'theme-tomorrow-night',
    name: 'Tomorrow Night',
    description: 'Clean, medium contrast dark theme. Great balance between readability and visual comfort.',
    author: 'Chris Kempson',
    version: '3.0.0',
    category: 'theme',
    icon: '🌃',
    iconBg: 'linear-gradient(135deg, #1d1f21, #373b41)',
    installed: false,
    npmPackage: 'monaco-themes',
  },

  // ── Tier 2 — Linting ────────────────────────────────────────────────────
  {
    id: 'eslint',
    name: 'ESLint',
    description: 'Real-time JavaScript/TypeScript linting in the editor. Errors and warnings appear as you type.',
    author: 'ESLint',
    version: '8.0.0',
    category: 'linting',
    icon: '🔍',
    iconBg: 'linear-gradient(135deg, #4b32c3, #8069db)',
    installed: false,
    npmPackage: 'eslint-linter-browserify',
  },

  // ── Tier 2 — Snippets ────────────────────────────────────────────────────
  {
    id: 'react-snippets',
    name: 'ES7+ React Snippets',
    description: 'Type rfc, useState, useEffect shortcuts and expand them into full boilerplate. 50+ React snippets.',
    author: 'dsznajder',
    version: '4.4.3',
    category: 'productivity',
    icon: '⚛️',
    iconBg: 'linear-gradient(135deg, #00b4d8, #0077b6)',
    installed: false,
  },

  // ── ZYVA native ──────────────────────────────────────────────────────────
  {
    id: '0g-bridge',
    name: 'ZYVA 0G Bridge',
    description: 'IDE integration to 0G Storage and 0G Private Computer. Snapshot commits, TEE attestation, semantic memory sync.',
    author: 'ZYVA',
    version: '1.0.0',
    category: 'productivity',
    icon: '⬡',
    iconBg: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
    installed: true,
    builtin: true,
  },
];

// Theme name mapping from extension id to monaco-themes filename
export const THEME_FILE_MAP: Record<string, string> = {
  'theme-dracula': 'Dracula',
  'theme-monokai': 'Monokai',
  'theme-night-owl': 'Night Owl',
  'theme-github-dark': 'GitHub Dark',
  'theme-solarized-dark': 'Solarized-dark',
  'theme-tomorrow-night': 'Tomorrow-Night',
};
