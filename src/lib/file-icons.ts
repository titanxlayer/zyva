/**
 * File icon mapping — extension → { icon, color }
 * Used in the Explorer file tree to replace the generic FileCode2 icon.
 */

export interface FileIconDef {
  icon: string;   // emoji or short text
  color: string;  // tailwind text color or hex
}

export const FILE_ICON_MAP: Record<string, FileIconDef> = {
  // TypeScript
  ts:   { icon: 'TS', color: '#3178c6' },
  tsx:  { icon: 'TS', color: '#3178c6' },
  // JavaScript
  js:   { icon: 'JS', color: '#f7df1e' },
  jsx:  { icon: 'JS', color: '#f7df1e' },
  mjs:  { icon: 'JS', color: '#f7df1e' },
  cjs:  { icon: 'JS', color: '#f7df1e' },
  // Style
  css:  { icon: 'CS', color: '#2965f1' },
  scss: { icon: 'SC', color: '#c69' },
  less: { icon: 'LE', color: '#1d365d' },
  // Markup
  html: { icon: 'HT', color: '#e44d26' },
  svg:  { icon: 'SV', color: '#ffb13b' },
  // Data
  json: { icon: '{}', color: '#f5de19' },
  yaml: { icon: 'YM', color: '#cb171e' },
  yml:  { icon: 'YM', color: '#cb171e' },
  toml: { icon: 'TM', color: '#9c4121' },
  // Docs
  md:   { icon: 'MD', color: '#519aba' },
  mdx:  { icon: 'MD', color: '#519aba' },
  txt:  { icon: 'TX', color: '#858585' },
  // Systems
  rs:   { icon: 'RS', color: '#dea584' },
  py:   { icon: 'PY', color: '#3572A5' },
  go:   { icon: 'GO', color: '#00add8' },
  sh:   { icon: 'SH', color: '#89e051' },
  bat:  { icon: 'BA', color: '#c1f12e' },
  // Config
  env:  { icon: '🔒', color: '#e5c07b' },
  gitignore: { icon: '.G', color: '#f05133' },
  lock: { icon: '🔐', color: '#858585' },
  // Misc
  ico:  { icon: '🖼', color: '#858585' },
  png:  { icon: '🖼', color: '#858585' },
  jpg:  { icon: '🖼', color: '#858585' },
  jpeg: { icon: '🖼', color: '#858585' },
  gif:  { icon: '🖼', color: '#858585' },
  wasm: { icon: 'WA', color: '#654ff0' },
};

export function getFileIcon(filename: string): FileIconDef {
  const parts = filename.toLowerCase().split('.');
  // Handle dotfiles like .gitignore, .env
  if (parts.length === 2 && parts[0] === '') {
    return FILE_ICON_MAP[parts[1]] || FILE_ICON_MAP[filename.replace('.', '')] || { icon: '·', color: '#858585' };
  }
  const ext = parts.pop() || '';
  return FILE_ICON_MAP[ext] || { icon: '·', color: '#858585' };
}

// Special folder icons
export const FOLDER_ICON_MAP: Record<string, string> = {
  src:          '📂',
  components:   '🧩',
  pages:        '📄',
  api:          '🔌',
  lib:          '📚',
  hooks:        '🪝',
  utils:        '🔧',
  types:        '🏷️',
  assets:       '🖼️',
  public:       '🌐',
  styles:       '🎨',
  engine:       '⚙️',
  store:        '🗄️',
  node_modules: '📦',
  '.git':       '🔀',
  '.next':      '▲',
};

export function getFolderIcon(folderName: string): string {
  return FOLDER_ICON_MAP[folderName.toLowerCase()] || '📁';
}
