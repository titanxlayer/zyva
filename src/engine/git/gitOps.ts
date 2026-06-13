import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Real git operations, scoped to a project directory.
 * Used for genuine commit + push to GitHub (no simulation).
 */

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

async function git(cwd: string, args: string, timeoutMs = 60_000): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execAsync(`git ${args}`, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (e: any) {
    return { ok: false, stdout: e.stdout?.trim() || '', stderr: e.stderr?.trim() || '', error: e.message };
  }
}

/** Initialise a repo if not already one. */
export async function ensureRepo(cwd: string): Promise<GitResult> {
  const check = await git(cwd, 'rev-parse --is-inside-work-tree');
  if (check.ok && check.stdout === 'true') return { ok: true, stdout: 'existing repo', stderr: '' };
  return git(cwd, 'init -b main');
}

/** Get current branch name. Returns null if not a repo. */
export async function getCurrentBranch(cwd: string): Promise<string | null> {
  const res = await git(cwd, 'rev-parse --abbrev-ref HEAD');
  if (!res.ok) return null;
  return res.stdout || null;
}

/** Get porcelain status: list of changed files. */
export async function getStatus(cwd: string): Promise<{ branch: string | null; files: { path: string; status: string }[] }> {
  const branch = await getCurrentBranch(cwd);
  const res = await git(cwd, 'status --porcelain=v1');
  const files = res.ok
    ? res.stdout.split('\n').filter(Boolean).map((line) => ({
        status: line.slice(0, 2).trim(),
        path: line.slice(3),
      }))
    : [];
  return { branch, files };
}

/** Configure local git identity (commit author). */
export async function setIdentity(cwd: string, name: string, email: string): Promise<void> {
  await git(cwd, `config user.name "${name.replace(/"/g, '')}"`);
  await git(cwd, `config user.email "${email.replace(/"/g, '')}"`);
}

/** Stage all changes and commit. */
export async function commitAll(cwd: string, message: string): Promise<GitResult> {
  const add = await git(cwd, 'add -A');
  if (!add.ok) return add;
  // Escape double quotes in message
  const safeMsg = message.replace(/"/g, '\\"');
  return git(cwd, `commit -m "${safeMsg}"`);
}

/**
 * Set the origin remote with an embedded OAuth token and push.
 * The token is used only for this push and never persisted in the remote URL
 * that would be committed (it lives only in .git/config which stays server-side).
 */
export async function pushToGitHub(
  cwd: string,
  cloneUrl: string,
  token: string,
  branch = 'main',
): Promise<GitResult> {
  // Build authenticated URL: https://x-access-token:TOKEN@github.com/owner/repo.git
  const authUrl = cloneUrl.replace('https://', `https://x-access-token:${token}@`);

  // Set or update origin
  const hasRemote = await git(cwd, 'remote get-url origin');
  if (hasRemote.ok) {
    await git(cwd, `remote set-url origin "${authUrl}"`);
  } else {
    await git(cwd, `remote add origin "${authUrl}"`);
  }

  const push = await git(cwd, `push -u origin ${branch}`, 120_000);

  // Scrub the token from the remote URL afterwards (leave clean https URL)
  await git(cwd, `remote set-url origin "${cloneUrl}"`).catch(() => {});

  return push;
}
