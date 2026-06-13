/**
 * E2B Executor — cloud sandbox for install/build tasks that cannot run in WebContainer.
 *
 * Rules:
 * - Spawned on-demand per Build_Task, torn down immediately after.
 * - Max 8 vCPU / 8GB RAM per sandbox (E2B plan limit).
 * - NEVER used as a persistent dev server (that is WebContainer's job).
 * - Streams stdout/stderr back to the caller via an async generator.
 */

import { Sandbox } from '@e2b/code-interpreter';

export interface BuildTaskOptions {
  /** Shell command to run (e.g. "npm install", "npm run build") */
  command: string;
  /** Files to write into the sandbox before running the command */
  files?: Record<string, string>;
  /** Timeout in ms — defaults to 600 000 (10 min) */
  timeoutMs?: number;
  /** E2B API key */
  apiKey: string;
  /** Called with each stdout/stderr line as it arrives */
  onOutput?: (line: string, stream: 'stdout' | 'stderr') => void;
}

export interface BuildTaskResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

/**
 * Run a single build/install command in an isolated E2B sandbox.
 * The sandbox is created, used, and destroyed within this call.
 */
export async function runBuildTask(opts: BuildTaskOptions): Promise<BuildTaskResult> {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  let sandbox: Sandbox | null = null;
  let stdout = '';
  let stderr = '';

  try {
    sandbox = await Sandbox.create({
      apiKey: opts.apiKey,
      timeoutMs,
    });

    // Write any provided files into the sandbox
    if (opts.files) {
      for (const [filePath, content] of Object.entries(opts.files)) {
        await sandbox.files.write(filePath, content);
      }
    }

    const result = await sandbox.runCode(opts.command, {
      onStdout: (out) => {
        stdout += out.line + '\n';
        opts.onOutput?.(out.line, 'stdout');
      },
      onStderr: (err) => {
        stderr += err.line + '\n';
        opts.onOutput?.(err.line, 'stderr');
      },
      timeoutMs,
    });

    const success = !result.error;
    return {
      success,
      exitCode: result.error ? 1 : 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      error: result.error?.value,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      exitCode: -1,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      error: message,
    };
  } finally {
    // Always tear down — never leave a sandbox running
    if (sandbox) {
      try { await sandbox.kill(); } catch { /* ignore */ }
    }
  }
}

/**
 * Classify whether a command should be sent to E2B or handled in WebContainer.
 * Only commands that require native OS-level execution go to E2B.
 */
export function requiresE2B(command: string): boolean {
  const cmd = command.trim().toLowerCase();
  // npm install / yarn add / pnpm install — may require native binaries
  if (/^(npm|yarn|pnpm|bun)\s+(install|i|add|ci)\b/.test(cmd)) return true;
  // Native build tools
  if (/^(cargo|go\s+build|pip\s+install|poetry\s+install|bundle\s+install)\b/.test(cmd)) return true;
  // node-gyp / native compilation
  if (/node-gyp|node_modules\/.bin\/node-gyp/.test(cmd)) return true;
  return false;
}
