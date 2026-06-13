import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { runAgentLoop, type LoopEvent } from '@/engine/orchestrator/runAgentLoop';
import { selfHealingBuild, type BuildEvent } from '@/engine/build/selfHealingBuild';
import { assertInsideWorkspace } from '@/lib/workspace-isolation';
import path from 'path';
import fs from 'fs';

/**
 * Iterative agent loop + self-healing build endpoint.
 *
 * POST {
 *   task: string,
 *   model: string,
 *   projectPath: string,
 *   fileContents?: Record<string,string>,   // current editor state
 *   terminalLogs?: string[],
 *   build?: boolean,                        // run self-healing build after
 *   fullStackPreview?: boolean,             // pass through to preview
 * }
 *
 * → text/event-stream of LoopEvent | BuildEvent JSON lines.
 */
export async function POST(req: NextRequest) {
  const { userId, error: authError } = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const { task, model, projectPath, terminalLogs, build, fileContents } = body as {
    task: string;
    model: string;
    projectPath: string;
    terminalLogs?: string[];
    build?: boolean;
    fileContents?: Record<string, string>;
  };

  if (!task)        return new Response(JSON.stringify({ error: 'task required' }), { status: 400 });
  if (!projectPath) return new Response(JSON.stringify({ error: 'projectPath required' }), { status: 400 });

  const resolved = path.resolve(projectPath);
  try { assertInsideWorkspace(userId, resolved); }
  catch { return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 }); }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: LoopEvent | BuildEvent) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)); } catch { /* stream closed */ }
      };

      try {
        // ── 1. Iterative agent loop ─────────────────────────────────────────
        await runAgentLoop({
          task,
          model,
          projectPath: resolved,
          terminalLogs: terminalLogs ?? [],
          onEvent: send,
        });

        // ── 2. Self-healing build (optional) ───────────────────────────────
        if (build) {
          // Collect current file contents for E2B build
          const files: Record<string, string> = { ...(fileContents ?? {}) };
          // Also read any files changed by the agent directly from disk
          const addFiles = (dir: string, root: string) => {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (['.git', '.zyva', 'node_modules', '.next'].includes(entry.name)) continue;
              const abs = path.join(dir, entry.name);
              const rel = path.relative(root, abs).replace(/\\/g, '/');
              if (entry.isFile()) {
                try { files[rel] = fs.readFileSync(abs, 'utf-8'); } catch { /* skip */ }
              } else if (entry.isDirectory()) {
                addFiles(abs, root);
              }
            }
          };
          addFiles(resolved, resolved);

          await selfHealingBuild({
            projectPath: resolved,
            fileContents: files,
            model,
            task,
            terminalLogs,
            onEvent: send,
          });
        }
      } catch (e) {
        send({ type: 'error', error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
