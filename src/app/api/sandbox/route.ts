import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/engine/config';
import { runBuildTask, requiresE2B, startPreviewSandbox, killPreviewSandbox } from '@/engine/execution/e2bExecutor';
import { classifyCommand } from '@/engine/security/commandPolicy';
import { addTrace } from '@/engine/observability/trace';

/**
 * E2B sandbox endpoint — runs install/build tasks that need native execution.
 * WebContainer handles dev server + preview; this endpoint handles the rest.
 *
 * POST { command, files?, approved? }              → run a build task
 * POST { action: 'preview', files }                → spawn dev server, return public URL
 * → { success, stdout, stderr, exitCode, error? } | { success, url }
 */
export async function POST(req: NextRequest) {
  const cfg = getConfig();
  const startedAt = Date.now();

  if (!cfg.e2b.apiKey) {
    return NextResponse.json({ success: false, error: 'E2B not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();

    // ── Kill a running preview sandbox (tab closed / preview stopped) ────────
    if (body.action === 'kill') {
      const sandboxId = String(body.sandboxId || '');
      if (!sandboxId) return NextResponse.json({ success: false, error: 'No sandboxId' }, { status: 400 });
      const killed = await killPreviewSandbox(sandboxId, cfg.e2b.apiKey);
      return NextResponse.json({ success: killed });
    }

    // ── Live preview: spawn a real E2B dev server and return its public URL ──
    if (body.action === 'preview') {
      const files = (body.files ?? {}) as Record<string, string>;
      if (!Object.keys(files).length) {
        return NextResponse.json({ success: false, error: 'No files provided for preview' }, { status: 400 });
      }
      const out = await startPreviewSandbox({ files, apiKey: cfg.e2b.apiKey, timeoutMs: 300_000 });
      addTrace({ type: 'sandbox', command: 'preview:vite', success: out.success, exitCode: out.success ? 0 : 1, durationMs: Date.now() - startedAt });
      return NextResponse.json(out, { status: out.success ? 200 : 502 });
    }

    const { command, files, approved } = body as {
      command?: string;
      files?: Record<string, string>;
      approved?: boolean;
    };

    if (!command) {
      return NextResponse.json({ success: false, error: 'No command specified' }, { status: 400 });
    }

    // Security classification — same policy as terminal route
    const policy = classifyCommand(command);
    if (policy.decision === 'deny') {
      return NextResponse.json(
        { success: false, blocked: true, decision: 'deny', error: `Command blocked: ${policy.reason}` },
        { status: 403 },
      );
    }
    if (policy.decision === 'approve' && !approved) {
      return NextResponse.json(
        { success: false, needsApproval: true, decision: 'approve', error: `Command requires approval: ${policy.reason}` },
        { status: 412 },
      );
    }

    // Only route to E2B if the command actually needs it
    if (!requiresE2B(command)) {
      return NextResponse.json(
        { success: false, error: 'Command does not require E2B sandbox — run in WebContainer instead' },
        { status: 400 },
      );
    }

    const result = await runBuildTask({
      command,
      files,
      apiKey: cfg.e2b.apiKey,
      timeoutMs: 600_000,
    });

    // Trace the build task
    addTrace({
      type: 'sandbox',
      command,
      success: result.success,
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
