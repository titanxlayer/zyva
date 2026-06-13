import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth-guard';
import { assertInsideWorkspace } from '@/lib/workspace-isolation';
import { rollback } from '@/engine/patch/patchEngine';

/**
 * Checkpoint / rollback API.
 *
 * GET  ?projectPath=…          → list all snapshots for the project
 * POST { action:'rollback', projectPath, snapshotId, relPath }  → restore a file
 * POST { action:'list_snaps', projectPath }  → same as GET (for fetch/POST clients)
 */

const SNAPSHOT_DIR_NAME = '.zyva/snapshots';

interface SnapshotEntry {
  id: string;
  relPath: string;
  createdAt: number;
  sizeBytes: number;
  absent: boolean;
}

function listSnapshots(projectPath: string): SnapshotEntry[] {
  const dir = path.join(projectPath, SNAPSHOT_DIR_NAME);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => !f.endsWith('.absent'))
    .map((f) => {
      const abs = path.join(dir, f);
      const stat = fs.statSync(abs);
      // filename: <timestamp>-<path_with_underscores>
      const dashIdx = f.indexOf('-');
      const ts = Number(f.slice(0, dashIdx));
      const relRaw = f.slice(dashIdx + 1).replace(/_/g, path.sep);
      return {
        id: f,
        relPath: relRaw,
        createdAt: isNaN(ts) ? stat.mtimeMs : ts,
        sizeBytes: stat.size,
        absent: fs.existsSync(`${abs}.absent`),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function GET(req: NextRequest) {
  const { userId, error: authError } = await requireAuth();
  if (authError) return authError;

  const projectPath = new URL(req.url).searchParams.get('projectPath') || '';
  if (!projectPath) return NextResponse.json({ success: false, error: 'projectPath required' }, { status: 400 });

  try {
    const resolved = path.resolve(projectPath);
    assertInsideWorkspace(userId, resolved);
    const snaps = listSnapshots(resolved);
    return NextResponse.json({ success: true, snapshots: snaps });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action, projectPath, snapshotId, relPath } = body as {
      action: string; projectPath: string; snapshotId?: string; relPath?: string;
    };

    const resolved = path.resolve(projectPath || '');
    try { assertInsideWorkspace(userId, resolved); }
    catch { return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }); }

    if (action === 'list_snaps') {
      return NextResponse.json({ success: true, snapshots: listSnapshots(resolved) });
    }

    if (action === 'rollback') {
      if (!snapshotId || !relPath) return NextResponse.json({ success: false, error: 'snapshotId and relPath required' }, { status: 400 });
      const ok = rollback(resolved, snapshotId, relPath);
      return NextResponse.json({ success: ok, error: ok ? undefined : 'Snapshot not found or rollback failed' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
