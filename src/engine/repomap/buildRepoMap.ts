/**
 * Repo Map — lightweight Aider-style structural context.
 *
 * Produces a concise text summary of every source file in the project:
 *   src/App.tsx
 *     export default function App()
 *     interface Props
 *   src/api/chat.ts
 *     export async function sendMessage(prompt: string)
 *     ...
 *
 * Used as the first block of the agent's system prompt so it always knows
 * what exists in the project without reading every file.
 *
 * Extraction strategy (no parser, just regex):
 *   - TypeScript/JS: export/function/class/interface/const/enum declarations
 *   - Python: def / class / async def
 *   - Rust: fn / struct / impl / trait / pub
 *   - Max N symbols per file to keep the map under the token budget.
 */

import fs from 'fs';
import path from 'path';

const CODE_EXT = /\.(ts|tsx|js|jsx|py|rs|go|java|rb|css|html|json|toml|yaml|yml|md)$/i;
const IGNORE   = new Set(['.git', '.zyva', 'node_modules', '.next', 'dist', 'build', '__pycache__', 'coverage', '.turbo']);
const MAX_SYMBOLS_PER_FILE = 12;
const MAX_FILES            = 80;
const MAX_MAP_CHARS        = 8_000;

type FileEntry = { rel: string; symbols: string[] };

// Per-extension symbol extractors
function extractSymbols(content: string, ext: string): string[] {
  const lines = content.split('\n');
  const symbols: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t && !seen.has(t)) { seen.add(t); symbols.push(t); }
  };

  if (/\.(ts|tsx|js|jsx)$/.test(ext)) {
    const re = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)\s*=|enum\s+(\w+)|const\s+(\w+)\s*(?:=\s*(?:async\s+)?\(|:\s*\w))/;
    for (const line of lines) {
      const m = line.match(re);
      if (m) add((m[1] || m[2] || m[3] || m[4] || m[5] || m[6]) + (line.includes('async') ? ' (async)' : '') + (line.includes('class') ? ' (class)' : '') + (line.includes('interface') ? ' (interface)' : ''));
    }
  } else if (ext === '.py') {
    for (const line of lines) {
      const m = line.match(/^(?:async\s+)?def\s+(\w+)|^class\s+(\w+)/);
      if (m) add((m[1] || m[2]));
    }
  } else if (ext === '.rs') {
    for (const line of lines) {
      const m = line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)|^(?:pub\s+)?struct\s+(\w+)|^(?:pub\s+)?trait\s+(\w+)|^impl\s+(\w+)/);
      if (m) add((m[1] || m[2] || m[3] || m[4]));
    }
  } else if (ext === '.go') {
    for (const line of lines) {
      const m = line.match(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)|^type\s+(\w+)/);
      if (m) add((m[1] || m[2]));
    }
  } else if (ext === '.md') {
    for (const line of lines) {
      const m = line.match(/^#{1,3}\s+(.+)/);
      if (m) add('# ' + m[1]);
    }
  }

  return symbols.slice(0, MAX_SYMBOLS_PER_FILE);
}

function walkDir(dir: string, root: string, entries: FileEntry[]) {
  if (entries.length >= MAX_FILES) return;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (IGNORE.has(item.name)) continue;
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) {
        walkDir(abs, root, entries);
      } else if (CODE_EXT.test(item.name)) {
        const rel = path.relative(root, abs).replace(/\\/g, '/');
        try {
          const content = fs.readFileSync(abs, 'utf-8');
          const ext     = path.extname(item.name).toLowerCase();
          const symbols = extractSymbols(content, ext);
          entries.push({ rel, symbols });
        } catch { /* unreadable file */ }
      }
    }
  } catch { /* permission error */ }
}

/**
 * Build a repo map string for the given project path.
 * Returns a compact text outline, capped at MAX_MAP_CHARS.
 */
export function buildRepoMap(projectPath: string): string {
  if (!fs.existsSync(projectPath)) return '(project not found)';
  const entries: FileEntry[] = [];
  walkDir(projectPath, projectPath, entries);
  if (entries.length === 0) return '(empty project)';

  const lines: string[] = ['## REPO MAP', `${entries.length} files indexed:`];
  for (const { rel, symbols } of entries) {
    lines.push(rel);
    for (const s of symbols) lines.push(`  ${s}`);
  }
  const full = lines.join('\n');
  return full.length > MAX_MAP_CHARS ? full.slice(0, MAX_MAP_CHARS) + '\n...[truncated]' : full;
}
