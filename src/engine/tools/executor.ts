/**
 * Tool executor — runs tool calls from the agent loop.
 * Every tool is sandboxed to projectPath and bounded by the command policy.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSafe, applyEdits, snapshot } from '../patch/patchEngine';
import { classifyCommand, isInsideProject } from '../security/commandPolicy';
import { getProjectDb } from '../db/projectDb';
import type { ToolCall, ToolResult } from './types';

const execAsync = promisify(exec);

const MAX_CMD_TIMEOUT = 60_000; // 60s per tool command

/** Execute a single tool call and return its result. */
export async function executeTool(
  call: ToolCall,
  projectPath: string,
  opts: {
    terminalLogs?: string[];  // for read_terminal
    maxFileSize?: number;     // byte cap for read_file (default 64KB)
  } = {},
): Promise<ToolResult> {
  const { name, id, args } = call;
  const maxFileSize = opts.maxFileSize ?? 65_536;

  try {
    switch (name) {
      // ── read_file ───────────────────────────────────────────────────────────
      case 'read_file': {
        const rel = String(args.path ?? '');
        const abs = path.resolve(projectPath, rel);
        if (!isInsideProject(projectPath, abs)) return err(id, name, 'Access denied: outside workspace');
        if (!fs.existsSync(abs))                 return err(id, name, `File not found: ${rel}`);
        const stat = fs.statSync(abs);
        if (stat.isDirectory())                  return err(id, name, `${rel} is a directory, use list_dir`);
        if (stat.size > maxFileSize) {
          const partial = fs.readFileSync(abs, 'utf-8').slice(0, maxFileSize);
          return ok(id, name, partial + `\n[...truncated at ${maxFileSize} bytes]`);
        }
        return ok(id, name, fs.readFileSync(abs, 'utf-8'));
      }

      // ── write_file ──────────────────────────────────────────────────────────
      case 'write_file': {
        const rel     = String(args.path ?? '');
        const content = String(args.content ?? '');
        const abs     = path.resolve(projectPath, rel);
        if (!isInsideProject(projectPath, abs)) return err(id, name, 'Access denied: outside workspace');
        const result = writeFileSafe(projectPath, rel, content);
        return result.ok
          ? ok(id, name, `Written ${content.split('\n').length} lines to ${rel} (snapshot ${result.snapshotId})`)
          : err(id, name, result.error ?? 'write failed');
      }

      // ── apply_edit ──────────────────────────────────────────────────────────
      case 'apply_edit': {
        const rel         = String(args.path ?? '');
        const search      = String(args.search ?? '');
        const replacement = String(args.replacement ?? '');
        const abs         = path.resolve(projectPath, rel);
        if (!isInsideProject(projectPath, abs)) return err(id, name, 'Access denied: outside workspace');
        const result = applyEdits(projectPath, rel, [{ oldString: search, newString: replacement }]);
        return result.ok
          ? ok(id, name, `Applied edit to ${rel} (snapshot ${result.snapshotId})`)
          : err(id, name, result.error ?? 'apply_edit failed');
      }

      // ── list_dir ────────────────────────────────────────────────────────────
      case 'list_dir': {
        const rel = String(args.path ?? '');
        const abs = rel ? path.resolve(projectPath, rel) : projectPath;
        if (!isInsideProject(projectPath, abs)) return err(id, name, 'Access denied: outside workspace');
        if (!fs.existsSync(abs)) return err(id, name, `Path not found: ${rel || '.'}`);
        const IGNORE = new Set(['.git', '.zyva', 'node_modules', '.next', 'dist', 'build', '__pycache__']);
        const entries = fs.readdirSync(abs, { withFileTypes: true })
          .filter((e) => !IGNORE.has(e.name))
          .map((e) => `${e.isDirectory() ? 'dir ' : 'file'} ${e.name}`)
          .join('\n');
        return ok(id, name, entries || '(empty directory)');
      }

      // ── grep ────────────────────────────────────────────────────────────────
      case 'grep': {
        const pattern = String(args.pattern ?? '');
        const glob    = String(args.glob ?? '**/*');
        if (!pattern) return err(id, name, 'pattern is required');
        const grepCmd = `grep -rn --include="${glob.replace(/\*\*\/\*/g, '*')}" -E "${pattern.replace(/"/g, '\\"')}" .`;
        try {
          const { stdout } = await execAsync(grepCmd, {
            cwd: projectPath,
            timeout: 15_000,
            maxBuffer: 512 * 1024,
          });
          return ok(id, name, stdout.trim() || '(no matches)');
        } catch (e: any) {
          // grep exits 1 when no matches — that's not a real error
          if (e.code === 1) return ok(id, name, '(no matches)');
          return err(id, name, e.message?.slice(0, 300));
        }
      }

      // ── run_command ─────────────────────────────────────────────────────────
      case 'run_command': {
        const cmd = String(args.command ?? '').trim();
        const policy = classifyCommand(cmd);
        if (policy.decision === 'deny')
          return err(id, name, `Command blocked: ${policy.reason}`);
        if (policy.decision === 'approve')
          return err(id, name, `Command requires user approval: ${policy.reason}. Use the terminal manually.`);
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: projectPath,
            timeout: MAX_CMD_TIMEOUT,
            maxBuffer: 2 * 1024 * 1024,
          });
          const out = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
          return ok(id, name, out || '(no output)');
        } catch (e: any) {
          const out = [e.stdout?.trim(), e.stderr?.trim(), e.message].filter(Boolean).join('\n');
          return err(id, name, out.slice(0, 2000));
        }
      }

      // ── read_terminal ───────────────────────────────────────────────────────
      case 'read_terminal': {
        const n = Math.min(Number(args.lines ?? 50), 500);
        const logs = opts.terminalLogs ?? [];
        const recent = logs.slice(-n).join('\n');
        return ok(id, name, recent || '(terminal is empty)');
      }

      // ── db_query ────────────────────────────────────────────────────────────
      case 'db_query': {
        const sql    = String(args.sql ?? '').trim();
        const params = Array.isArray(args.params) ? args.params as (string | number | null)[] : [];
        if (!sql) return err(id, name, 'sql is required');
        const db = await getProjectDb(projectPath);
        try {
          const results = await db.query(sql, params);
          return ok(id, name, JSON.stringify(results, null, 2));
        } catch (e) {
          return err(id, name, (e as Error).message);
        }
      }

      default:
        return err(id, name, `Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(id, name, `Unexpected error: ${(e as Error).message}`);
  }
}

function ok(id: string, name: string, output: string): ToolResult {
  return { id, name, output };
}

function err(id: string, name: string, error: string): ToolResult {
  return { id, name, output: '', error };
}

/** Parse tool calls from a model response chunk. Returns calls + remaining text. */
export function parseToolCalls(text: string): { calls: ToolCall[]; rest: string } {
  const calls: ToolCall[] = [];
  const seenIds = new Set<string>();
  let rest = text;
  // Match JSON objects on their own line(s) that have a "tool" key
  const jsonBlockRe = /```json\s*(\{[\s\S]*?\})\s*```/g;
  const inlineRe = /^\s*(\{"tool":\s*"[^"]+",[\s\S]*?\})\s*$/gm;
  for (const re of [jsonBlockRe, inlineRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(m[1] || m[0]);
        if (typeof parsed.tool === 'string' && typeof parsed.id === 'string' && !seenIds.has(parsed.id)) {
          seenIds.add(parsed.id);
          calls.push({ id: parsed.id, name: parsed.tool, args: parsed.args ?? {} });
          rest = rest.replace(m[0], '');
        }
      } catch { /* not valid JSON */ }
    }
  }
  return { calls, rest: rest.trim() };
}

/** Check if the model issued a "done" signal. */
export function parseDoneSignal(text: string): { done: boolean; summary: string } {
  const m = text.match(/\{"done"\s*:\s*true[^}]*\}/);
  if (!m) return { done: false, summary: '' };
  try {
    const parsed = JSON.parse(m[0]);
    return { done: !!parsed.done, summary: String(parsed.summary ?? '') };
  } catch {
    return { done: true, summary: '' };
  }
}

/**
 * Fallback parser: the model may emit [ZYVA_FILE]/[ZYVA_EDIT] blocks instead of
 * JSON tool calls (its natural format). Convert them to tool calls so the loop
 * still applies the changes. Returns synthetic write_file / apply_edit calls.
 */
export function parseZyvaBlocks(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let i = 0;

  const fileRe = /\[ZYVA_FILE:\s*(.+?)\]\s*```[\w]*\n?([\s\S]*?)(?:```\s*(?:\[\/ZYVA_FILE\])?|\[\/ZYVA_FILE\]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = fileRe.exec(text)) !== null) {
    const path = m[1].trim();
    const content = m[2].replace(/```\s*$/, '').replace(/\[\/ZYVA_FILE\]\s*$/, '').trim();
    if (content.length > 5) calls.push({ id: `zf${i++}`, name: 'write_file', args: { path, content } });
  }

  const editRe = /\[ZYVA_EDIT:\s*(.+?)\]\s*([\s\S]*?)(?:\[\/ZYVA_EDIT\]|(?=\[ZYVA_|$))/g;
  while ((m = editRe.exec(text)) !== null) {
    const path = m[1].trim();
    const srRe = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;
    let sm: RegExpExecArray | null;
    while ((sm = srRe.exec(m[2])) !== null) {
      calls.push({ id: `ze${i++}`, name: 'apply_edit', args: { path, search: sm[1], replacement: sm[2] } });
    }
  }
  return calls;
}
