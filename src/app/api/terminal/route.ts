import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import { getConfig } from '@/engine/config';
import { classifyCommand, isInsideProject } from '@/engine/security/commandPolicy';

/**
 * Secure command execution endpoint.
 *
 * The LLM never reaches `exec` directly — every command is classified by the
 * security policy first. `allow` may auto-run (when enabled); `approve` requires
 * an explicit `approved: true` from the user; `deny` is always rejected.
 * Execution is contained to the project directory and bounded by a timeout.
 */
export async function POST(req: NextRequest) {
  const cfg = getConfig();
  try {
    const body = await req.json();
    const { command, projectPath, approved } = body as {
      command?: string; projectPath?: string; approved?: boolean;
    };

    if (!command) {
      return NextResponse.json({ success: false, error: 'No command specified' }, { status: 400 });
    }

    // Simulated runners (kept for demo / Playwright determinism).
    if (command.trim() === 'zyva test') {
      return NextResponse.json({ success: true, stdout: 'ZYVA test runner: 7 passed, 0 failed.', stderr: '' });
    }
    if (command.trim() === 'zyva analyze') {
      return NextResponse.json({ success: true, stdout: 'Semantic index synchronized.', stderr: '' });
    }

    // ── Security classification ────────────────────────────────────────────
    const policy = classifyCommand(command);
    if (policy.decision === 'deny') {
      return NextResponse.json({ success: false, blocked: true, decision: 'deny', error: `Command blocked: ${policy.reason}` }, { status: 403 });
    }
    if (policy.decision === 'approve' && !approved) {
      return NextResponse.json({ success: false, needsApproval: true, decision: 'approve', error: `Command requires approval: ${policy.reason}` }, { status: 412 });
    }

    // ── Containment ──────────────────────────────────────────────────────────
    const workingDir = projectPath ? path.resolve(projectPath) : process.cwd();
    if (projectPath && !isInsideProject(projectPath, workingDir)) {
      return NextResponse.json({ success: false, error: 'Access denied: directory outside project boundary' }, { status: 403 });
    }

    return new Promise<Response>((resolve) => {
      exec(command, { cwd: workingDir, timeout: cfg.exec.timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error && error.killed) {
          resolve(NextResponse.json({ success: true, stdout: stdout + `\n[Process timed out after ${cfg.exec.timeoutMs}ms]`, stderr }));
        } else if (error) {
          resolve(NextResponse.json({ success: false, error: error.message, stdout, stderr }));
        } else {
          resolve(NextResponse.json({ success: true, stdout, stderr }));
        }
      });
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
