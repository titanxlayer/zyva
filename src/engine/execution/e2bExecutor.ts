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

// ── Live preview sandbox (real public URL) ───────────────────────────────────

export interface PreviewSandboxOptions {
  files: Record<string, string>;
  apiKey: string;
  /** How long the sandbox stays alive before E2B reclaims it (ms). */
  timeoutMs?: number;
  /** If true, also start a backend process on BACKEND_PORT and return its URL. */
  fullStack?: boolean;
}

export interface PreviewSandboxResult {
  success: boolean;
  url?: string;           // frontend URL (Vite)
  backendUrl?: string;    // backend URL (Express/Hono on BACKEND_PORT)
  sandboxId?: string;
  error?: string;
}

const PREVIEW_DIR  = '/home/user/app';
const PREVIEW_PORT = 5173;
const BACKEND_PORT = 3001;

/** Detect if the project has a backend entry file that should be started separately. */
function detectBackendEntry(files: Record<string, string>): string | null {
  const backendEntries = ['server.ts', 'server.js', 'api/index.ts', 'api/index.js', 'backend/index.ts', 'backend/server.ts'];
  for (const e of backendEntries) {
    if (files[e] || files[`src/${e}`]) return files[e] ? e : `src/${e}`;
  }
  return null;
}

/** Scaffold a Vite project so a bare src/App.tsx still boots. */
function scaffoldPreviewFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [p, c] of Object.entries(files)) {
    if (c != null && c !== '') out[p.replace(/^\/+/, '')] = c;
  }
  if (!out['package.json']) {
    out['package.json'] = JSON.stringify({
      name: 'zyva-preview', private: true, type: 'module',
      scripts: { dev: `vite --host --port ${PREVIEW_PORT}` },
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.3.1', typescript: '^5.4.0', vite: '^5.3.1' },
    }, null, 2);
  }
  // Always force an E2B-friendly vite config (host binding + allow proxied host header)
  out['vite.config.ts'] =
    `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n` +
    `export default defineConfig({ plugins: [react()], server: { host: true, port: ${PREVIEW_PORT}, strictPort: true, allowedHosts: true } });`;
  if (!out['index.html']) {
    out['index.html'] =
      `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>ZYVA Preview</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;
  }
  if (!out['src/main.tsx'] && !out['src/main.jsx']) {
    out['src/main.tsx'] =
      `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);`;
  }
  return out;
}

/**
 * Spawn an E2B sandbox running the Vite dev server and return its public URL.
 * The sandbox is intentionally NOT killed — it serves the preview until E2B
 * reclaims it after `timeoutMs`.
 */
export async function startPreviewSandbox(opts: PreviewSandboxOptions): Promise<PreviewSandboxResult> {
  const timeoutMs = opts.timeoutMs ?? 600_000; // 10 min auto-off
  let sandbox: Sandbox | null = null;
  try {
    sandbox = await Sandbox.create({ apiKey: opts.apiKey, timeoutMs });

    const files = scaffoldPreviewFiles(opts.files);
    for (const [filePath, content] of Object.entries(files)) {
      await sandbox.files.write(`${PREVIEW_DIR}/${filePath}`, content);
    }

    // Install deps (blocking) then start dev server (background).
    const install = await sandbox.commands.run('npm install --no-audit --no-fund', {
      cwd: PREVIEW_DIR, timeoutMs: 240_000,
    }).catch((e: unknown) => ({ exitCode: 1, stderr: (e as Error).message }));
    if ((install as { exitCode: number }).exitCode !== 0) {
      return { success: false, error: `install failed: ${(install as { stderr?: string }).stderr?.slice(0, 300) || 'unknown'}` };
    }

    await sandbox.commands.run(`npm run dev`, { cwd: PREVIEW_DIR, background: true });

    // Give Vite a moment to bind the port.
    await new Promise((r) => setTimeout(r, 3500));

    const host = sandbox.getHost(PREVIEW_PORT);
    let backendUrl: string | undefined;

    // ── Full-stack: start backend if detected ─────────────────────────────────
    if (opts.fullStack) {
      const backendEntry = detectBackendEntry(opts.files);
      if (backendEntry) {
        const backendCmd = backendEntry.endsWith('.ts')
          ? `npx tsx ${backendEntry} &`
          : `node ${backendEntry} &`;
        await sandbox.commands.run(
          `PORT=${BACKEND_PORT} ${backendCmd}`,
          { cwd: PREVIEW_DIR, background: true },
        ).catch(() => { /* non-fatal */ });
        await new Promise((r) => setTimeout(r, 2000));
        try {
          backendUrl = `https://${sandbox.getHost(BACKEND_PORT)}`;
        } catch { /* backend may not have bound */ }
      }
    }

    return { success: true, url: `https://${host}`, backendUrl, sandboxId: sandbox.sandboxId };
  } catch (err) {
    if (sandbox) { try { await sandbox.kill(); } catch { /* ignore */ } }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Kill a preview sandbox immediately (e.g. when the user closes the preview tab). */
export async function killPreviewSandbox(sandboxId: string, apiKey: string): Promise<boolean> {
  try {
    return await Sandbox.kill(sandboxId, { apiKey });
  } catch {
    return false;
  }
}
