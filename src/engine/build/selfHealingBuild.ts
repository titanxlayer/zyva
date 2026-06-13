/**
 * Self-healing build loop.
 *
 * After the agent writes code, this:
 *   1. Runs npm run build (or tsc) inside E2B (isolated, no side-effects on the VPS).
 *   2. If it fails, feeds the errors back into runAgentLoop for a fix pass.
 *   3. Repeats up to MAX_HEAL_ROUNDS times.
 *   4. Returns whether the build passed and the final stdout.
 *
 * When E2B is not configured, falls back to running tsc locally
 * (cheaper, catches type errors without npm install).
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getConfig } from '../config';
import { runBuildTask } from '../execution/e2bExecutor';
import type { LoopEvent } from '../orchestrator/runAgentLoop';
import { runAgentLoop } from '../orchestrator/runAgentLoop';

const execAsync = promisify(exec);

const MAX_HEAL_ROUNDS = 3;
const LOCAL_TSC_TIMEOUT = 60_000;

export type BuildEvent =
  | { type: 'build_start'; round: number }
  | { type: 'build_pass'; round: number; stdout: string }
  | { type: 'build_fail'; round: number; errors: string }
  | { type: 'heal_start'; round: number }
  | LoopEvent;

export interface SelfHealOptions {
  projectPath: string;
  fileContents: Record<string, string>; // files to pass to E2B (current workspace snapshot)
  model: string;
  task: string;
  terminalLogs?: string[];
  onEvent?: (ev: BuildEvent) => void;
}

export interface SelfHealResult {
  passed: boolean;
  rounds: number;
  finalStdout: string;
  filesChanged: string[];
}

async function runBuild(
  fileContents: Record<string, string>,
  cfg: ReturnType<typeof getConfig>,
  projectPath: string,
): Promise<{ ok: boolean; output: string }> {
  if (cfg.e2b.apiKey) {
    // Run in E2B (isolated)
    const result = await runBuildTask({
      command: 'npm install --no-audit --no-fund && npm run build',
      files: fileContents,
      apiKey: cfg.e2b.apiKey,
      timeoutMs: 300_000,
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    return { ok: result.success, output };
  }

  // Fallback: run tsc locally inside the project (faster, no npm install)
  if (!fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
    return { ok: true, output: '(no tsconfig.json — skipping type check)' };
  }
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
      cwd: projectPath,
      timeout: LOCAL_TSC_TIMEOUT,
    });
    return { ok: true, output: stdout + stderr };
  } catch (e: any) {
    return { ok: false, output: (e.stdout + e.stderr).slice(0, 4000) };
  }
}

export async function selfHealingBuild(opts: SelfHealOptions): Promise<SelfHealResult> {
  const cfg = getConfig();
  const emit = (ev: BuildEvent) => { try { opts.onEvent?.(ev); } catch { /* ignore */ } };
  const filesChanged: string[] = [];
  let fileContents = { ...opts.fileContents };

  for (let round = 1; round <= MAX_HEAL_ROUNDS; round++) {
    emit({ type: 'build_start', round });
    const { ok, output } = await runBuild(fileContents, cfg, opts.projectPath);

    if (ok) {
      emit({ type: 'build_pass', round, stdout: output });
      return { passed: true, rounds: round, finalStdout: output, filesChanged };
    }

    emit({ type: 'build_fail', round, errors: output });

    if (round >= MAX_HEAL_ROUNDS) break;

    // Ask the agent to fix the errors
    emit({ type: 'heal_start', round });
    const healTask = `The build failed. Fix all errors so the build passes.\n\nBuild errors:\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\`\n\nDo NOT change any unrelated code. Use the run_command tool to verify the fix works.`;

    try {
      const result = await runAgentLoop({
        task: healTask,
        model: opts.model,
        projectPath: opts.projectPath,
        terminalLogs: opts.terminalLogs,
        maxSteps: 8,
        onEvent: (ev) => emit(ev as BuildEvent),
      });
      filesChanged.push(...result.filesChanged.filter((f) => !filesChanged.includes(f)));

      // Re-read changed files for the next build attempt
      for (const f of result.filesChanged) {
        const abs = path.join(opts.projectPath, f);
        if (fs.existsSync(abs)) {
          fileContents[f] = fs.readFileSync(abs, 'utf-8');
        }
      }
    } catch {
      /* heal attempt failed — let next round try the original build */
    }
  }

  const { output } = await runBuild(fileContents, cfg, opts.projectPath);
  return { passed: false, rounds: MAX_HEAL_ROUNDS, finalStdout: output, filesChanged };
}
