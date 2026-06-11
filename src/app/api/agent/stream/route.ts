import { NextRequest } from 'next/server';
import { getConfig } from '@/engine/config';
import { CerebrasProvider } from '@/engine/providers/cerebras';
import { runGraph, type GraphEvent } from '@/engine/orchestrator/graph';

/**
 * Server-Sent Events stream of the multi-agent graph. Emits per-agent progress
 * so the UI Swarm panel lights up in real time. No extra inference cost — these
 * are the same model calls, just surfaced live.
 *
 * POST { message, model?, projectName?, projectPath?, activeFile?, fileTreeStr?, history? }
 * → text/event-stream of GraphEvent JSON lines.
 */
const GLM_MAP: Record<string, string> = {
  'glm-5.1': 'zai-glm-4.7', 'glm-5': 'zai-glm-4.7', 'glm-4.7': 'zai-glm-4.7', 'zai-glm-4.7': 'zai-glm-4.7',
};

export async function POST(req: NextRequest) {
  const cfg = getConfig();
  const body = await req.json();
  const { message, model, projectName, projectPath, activeFile, fileTreeStr, history = [] } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: GraphEvent | { type: 'error'; error: string }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };

      if (!message) {
        send({ type: 'error', error: 'No message specified' });
        controller.close();
        return;
      }

      const glm = GLM_MAP[model || 'glm-5.1'] || 'zai-glm-4.7';
      const workspaceContext = `Project: ${projectName || 'none'}\nActive file: ${activeFile || 'none'}\nFile tree:\n${fileTreeStr || '(no project)'}`;
      const normalizedHistory = (history as { sender?: string; role?: string; text?: string; content?: string }[])
        .slice(-4)
        .map((h) => ({
          role: (h.role === 'agent' || h.sender === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: (h.content || h.text || '').substring(0, 400),
        }))
        .filter((m) => m.content);

      try {
        await runGraph({
          task: message,
          model: glm,
          projectPath: projectPath || undefined,
          workspaceContext,
          history: normalizedHistory,
          provider: new CerebrasProvider(cfg.cerebrasApiKey),
          onEvent: (ev) => send(ev),
        });
      } catch (err) {
        send({ type: 'error', error: (err as Error).message });
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
    },
  });
}
