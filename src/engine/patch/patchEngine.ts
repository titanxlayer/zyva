import fs from 'fs';
import path from 'path';

/**
 * Safe patch engine.
 *  - applyEdits: Aider-style SEARCH/REPLACE with uniqueness validation.
 *  - atomic writes (tmp + rename) so a crash never leaves a half-written file.
 *  - per-action snapshots under <project>/.zyva/snapshots for rollback.
 *
 * The AI proposes scoped patches; it never blindly rewrites whole files without
 * a snapshot existing first.
 */

export interface Edit {
  oldString: string;
  newString: string;
}

export interface ApplyResult {
  ok: boolean;
  snapshotId?: string;
  error?: string;
}

function snapshotDir(projectPath: string) {
  return path.join(projectPath, '.zyva', 'snapshots');
}

function atomicWrite(absPath: string, content: string) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, absPath);
}

/** Snapshot a file's current bytes before mutation. Returns a snapshot id. */
export function snapshot(projectPath: string, relPath: string): string {
  const id = `${Date.now()}-${relPath.replace(/[\\/]/g, '_')}`;
  const abs = path.resolve(projectPath, relPath);
  const dir = snapshotDir(projectPath);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, id);
  if (fs.existsSync(abs)) {
    fs.copyFileSync(abs, dest);
  } else {
    // Record that the file did not exist (so rollback can delete it).
    fs.writeFileSync(`${dest}.absent`, '', 'utf-8');
  }
  return id;
}

export function rollback(projectPath: string, snapshotId: string, relPath: string): boolean {
  const abs = path.resolve(projectPath, relPath);
  const dir = snapshotDir(projectPath);
  const snap = path.join(dir, snapshotId);
  try {
    if (fs.existsSync(`${snap}.absent`)) {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
      return true;
    }
    if (fs.existsSync(snap)) {
      atomicWrite(abs, fs.readFileSync(snap, 'utf-8'));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Apply SEARCH/REPLACE edits to a file with uniqueness checks. */
export function applyEdits(projectPath: string, relPath: string, edits: Edit[]): ApplyResult {
  const abs = path.resolve(projectPath, relPath);
  if (!fs.existsSync(abs)) return { ok: false, error: `file not found: ${relPath}` };

  let content = fs.readFileSync(abs, 'utf-8');
  const snapId = snapshot(projectPath, relPath);

  for (const edit of edits) {
    const normContent = content.replace(/\r\n/g, '\n');
    const normOld = edit.oldString.replace(/\r\n/g, '\n');
    const first = normContent.indexOf(normOld);
    if (first === -1) {
      return { ok: false, snapshotId: snapId, error: `SEARCH block not found in ${relPath}` };
    }
    if (first !== normContent.lastIndexOf(normOld)) {
      return { ok: false, snapshotId: snapId, error: `SEARCH block is ambiguous (multiple matches) in ${relPath}` };
    }
    content = normContent.replace(normOld, edit.newString.replace(/\r\n/g, '\n'));
  }

  atomicWrite(abs, content);
  return { ok: true, snapshotId: snapId };
}

/** Write/overwrite a full file, but always snapshot first for rollback. */
export function writeFileSafe(projectPath: string, relPath: string, content: string): ApplyResult {
  const snapId = snapshot(projectPath, relPath);
  try {
    atomicWrite(path.resolve(projectPath, relPath), content);
    return { ok: true, snapshotId: snapId };
  } catch (e) {
    return { ok: false, snapshotId: snapId, error: (e as Error).message };
  }
}
