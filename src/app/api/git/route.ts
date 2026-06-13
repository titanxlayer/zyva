import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { requireAuth } from '@/lib/auth-guard';
import { assertInsideWorkspace, ensureUserWorkspaceSync, getUserProjectPath } from '@/lib/workspace-isolation';
import { getGitHubToken, getGitHubUser, ensureGitHubRepo } from '@/lib/github';
import { ensureRepo, getStatus, setIdentity, commitAll, pushToGitHub, cloneRepo } from '@/engine/git/gitOps';
import { prisma } from '@/lib/prisma';

/**
 * Real Git integration — commit + push to GitHub.
 *
 * POST { action: 'status', projectPath }
 *   → { branch, files }
 * POST { action: 'commit', projectPath, message }
 *   → { ok, output }
 * POST { action: 'push', projectPath, repoName?, private? }
 *   → { ok, repo, output }
 * POST { action: 'commitAndPush', projectPath, message, repoName?, private? }
 *   → full flow in one call
 */
export async function POST(req: NextRequest) {
  const { userId, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action, projectPath } = body as { action: string; projectPath: string };

    // ── clone (import a GitHub repo into the user's workspace) ───────────────
    // Handled before the projectPath check since the path is derived here.
    if (action === 'clone') {
      const fs = await import('fs');
      let repoUrl = String(body.repoUrl || '').trim();
      // Accept "owner/repo" shorthand
      if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoUrl)) {
        repoUrl = `https://github.com/${repoUrl}`;
      }
      // Strict allow-list: only public github.com https URLs (prevents injection/SSRF)
      const m = repoUrl.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
      if (!m) {
        return NextResponse.json({ success: false, error: 'Enter a valid GitHub repo URL (https://github.com/owner/repo)' }, { status: 400 });
      }
      const repoName = m[2].replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
      const branch = typeof body.branch === 'string' ? body.branch : undefined;

      const workspaceRoot = ensureUserWorkspaceSync(userId);
      const dest = getUserProjectPath(userId, repoName);
      if (fs.existsSync(dest)) {
        return NextResponse.json({ success: false, error: `A project named "${repoName}" already exists in your workspace.` }, { status: 409 });
      }

      // Private repos need the user's GitHub token; public repos clone tokenless.
      const token = await getGitHubToken(userId);
      const result = await cloneRepo(workspaceRoot, dest, repoUrl, token || undefined, branch);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.stderr || result.error || 'Clone failed' }, { status: 500 });
      }
      return NextResponse.json({ success: true, projectPath: dest.replace(/\\/g, '/'), name: repoName, repoUrl });
    }

    if (!projectPath) {
      return NextResponse.json({ success: false, error: 'projectPath required' }, { status: 400 });
    }

    const resolved = path.resolve(projectPath);
    try {
      assertInsideWorkspace(userId, resolved);
    } catch {
      return NextResponse.json({ success: false, error: 'Access denied: path outside workspace' }, { status: 403 });
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (action === 'status') {
      await ensureRepo(resolved);
      const status = await getStatus(resolved);
      return NextResponse.json({ success: true, ...status });
    }

    // ── commit ─────────────────────────────────────────────────────────────
    if (action === 'commit' || action === 'commitAndPush') {
      const { message } = body as { message: string };
      if (!message) return NextResponse.json({ success: false, error: 'commit message required' }, { status: 400 });

      await ensureRepo(resolved);

      // Set identity from GitHub user (or generic ZYVA identity)
      const token = await getGitHubToken(userId);
      if (token) {
        const ghUser = await getGitHubUser(token);
        if (ghUser) await setIdentity(resolved, ghUser.name, ghUser.email);
      } else {
        await setIdentity(resolved, 'ZYVA User', `${userId}@zyva.dev`);
      }

      const commit = await commitAll(resolved, message);
      if (!commit.ok && !commit.stdout.includes('nothing to commit')) {
        // "nothing to commit" is not a hard error
        if (commit.stderr.includes('nothing to commit') || commit.stdout.includes('nothing to commit')) {
          return NextResponse.json({ success: true, committed: false, output: 'nothing to commit, working tree clean' });
        }
        return NextResponse.json({ success: false, error: commit.error || commit.stderr, output: commit.stdout });
      }

      if (action === 'commit') {
        return NextResponse.json({ success: true, committed: true, output: commit.stdout });
      }
      // fall through to push for commitAndPush
      body.action = 'push';
    }

    // ── push (also reached from commitAndPush) ───────────────────────────────
    if (body.action === 'push') {
      const token = await getGitHubToken(userId);
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'GitHub not connected. Sign in with GitHub to push.' },
          { status: 412 },
        );
      }

      const repoName = (body.repoName as string) || path.basename(resolved);
      const isPrivate = body.private !== false;

      const repo = await ensureGitHubRepo(token, repoName, isPrivate);
      if (!repo.ok || !repo.cloneUrl) {
        return NextResponse.json({ success: false, error: repo.error || 'Could not create/find repo' }, { status: 500 });
      }

      const push = await pushToGitHub(resolved, repo.cloneUrl, token, 'main');
      if (!push.ok) {
        return NextResponse.json({ success: false, error: push.error || push.stderr, output: push.stdout }, { status: 500 });
      }

      // Persist the project→repo link
      await prisma.project.updateMany({
        where: { userId, path: resolved },
        data: { },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        repo: repo.fullName,
        repoUrl: `https://github.com/${repo.fullName}`,
        output: push.stdout || push.stderr,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
