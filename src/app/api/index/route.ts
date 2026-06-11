import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { indexFiles, getVectorStore } from '@/engine/retrieval';

/**
 * Project indexing endpoint.
 *  POST { projectPath }            → (re)index the whole project
 *  POST { projectPath, files }     → index a specific set of files (path->content)
 *  GET  ?path=...                  → report index status (chunk count + backend)
 */

const IGNORE = new Set(['node_modules', '.next', '.git', 'dist', 'out', '.zyva', '.vercel']);
const CODE_EXT = /\.(ts|tsx|js|jsx|py|rs|go|java|rb|php|css|html|md|json|toml|yaml|yml)$/i;

function walk(dir: string, root: string, acc: Record<string, string>, budget = { files: 0 }) {
  if (budget.files > 2000) return;
  for (const item of fs.readdirSync(dir)) {
    if (IGNORE.has(item)) continue;
    const full = path.join(dir, item);
    let stat: fs.Stats;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      walk(full, root, acc, budget);
    } else if (CODE_EXT.test(item) && stat.size < 256 * 1024) {
      const rel = path.relative(root, full).replace(/\\/g, '/');
      try { acc[rel] = fs.readFileSync(full, 'utf-8'); budget.files++; } catch { /* skip */ }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectPath, files } = await req.json();
    if (!projectPath) return NextResponse.json({ success: false, error: 'projectPath required' }, { status: 400 });

    const resolved = path.resolve(projectPath);
    if (!fs.existsSync(resolved)) return NextResponse.json({ success: false, error: 'project not found' }, { status: 404 });

    let toIndex: Record<string, string> = files;
    if (!toIndex) {
      toIndex = {};
      walk(resolved, resolved, toIndex);
    }

    const result = await indexFiles(resolved, toIndex);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const p = new URL(req.url).searchParams.get('path');
    if (!p) return NextResponse.json({ success: false, error: 'path required' }, { status: 400 });
    const store = getVectorStore(path.resolve(p));
    return NextResponse.json({ success: true, backend: store.backend, chunks: await store.count() });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
