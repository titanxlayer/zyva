import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/engine/config';
import { runBuildTask, requiresE2B } from '@/engine/execution/e2bExecutor';
import { classifyCommand } from '@/engine/security/commandPolicy';
import { addTrace } from '@/engine/observability/trace';

/**
 * E2B sandbox endpoint — runs install/build tasks that need native execution.
 * WebContainer handles dev server + preview; this endpoint handles the rest.
 *
 * POST { command, files?, approved? }
 * → { success, stdout, stderr, exitCode, error? }
 */
export async function POST(req: NextRequest) {
  const cfg = getConfig();
  const startedAt = Date.now();

  if (!cfg.e2b.apiKey) {
    return NextResponse.json({ success: false, error: 'E2B not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
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
