import path from 'path';

/**
 * Execution security policy.
 *
 * The LLM never executes shell directly. Every command is classified here:
 *  - allow:   safe, may auto-run inside the workspace
 *  - approve: must be confirmed by the user before running
 *  - deny:    never run (destructive / outside scope)
 */

export type Decision = 'allow' | 'approve' | 'deny';

export interface PolicyResult {
  decision: Decision;
  reason: string;
}

// Commands that may auto-run (matched on the first token / known scripts).
const ALLOW = [
  /^npm (install|ci|run (dev|build|start|lint|test)|test)\b/,
  /^pnpm (install|run (dev|build|start|lint|test))\b/,
  /^yarn (install|dev|build|start|lint|test)\b/,
  /^(npx )?(eslint|prettier|tsc|vitest|jest|playwright)\b/,
  /^(python -m )?pytest\b/,
  /^cargo (build|test|check|run)\b/,
  /^(echo|ls|cat|pwd|node -v|npm -v)\b/,
];

// Always-dangerous patterns -> hard deny.
const DENY = [
  /\brm\s+-rf?\b/,
  /\bsudo\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /:\(\)\s*\{\s*:\|:&\s*\}/, // fork bomb
  /\b(shutdown|reboot|halt|poweroff)\b/,
  /\bgit\s+push\b.*--force/,
  />\s*\/dev\/sd[a-z]/,
];

// Needs explicit approval (powerful but sometimes legitimate).
const APPROVE = [
  /\brm\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bcurl\b|\bwget\b/,
  /\|\s*(ba)?sh\b/,
  /\bdocker\b/,
  /\bkubectl\b/,
  /\bgit\s+(push|reset|clean|checkout)\b/,
  /\bnpm\s+publish\b/,
  /[;&|]{1,2}/, // command chaining
];

export function classifyCommand(raw: string): PolicyResult {
  const cmd = raw.trim();
  if (!cmd) return { decision: 'deny', reason: 'empty command' };

  for (const re of DENY) {
    if (re.test(cmd)) return { decision: 'deny', reason: `blocked dangerous pattern: ${re}` };
  }
  for (const re of APPROVE) {
    if (re.test(cmd)) return { decision: 'approve', reason: 'requires user approval' };
  }
  for (const re of ALLOW) {
    if (re.test(cmd)) return { decision: 'allow', reason: 'safe allowlisted command' };
  }
  // Unknown -> safest default is to ask.
  return { decision: 'approve', reason: 'unrecognized command, approval required' };
}

/** Ensure a resolved working directory stays inside the project boundary. */
export function isInsideProject(projectPath: string, workingDir: string): boolean {
  const root = path.resolve(projectPath);
  const wd = path.resolve(workingDir);
  return wd === root || wd.startsWith(root + path.sep);
}
