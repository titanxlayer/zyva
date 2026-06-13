import { NextRequest } from 'next/server';
import { getConfig } from '@/engine/config';
import { CerebrasProvider } from '@/engine/providers/cerebras';
import { OGPrivateComputerProvider, isSupportedModel } from '@/engine/providers/ogpc';
import { runGraph, type GraphEvent } from '@/engine/orchestrator/graph';
import { requireAuth } from '@/lib/auth-guard';

/**
 * Server-Sent Events stream of the multi-agent graph.
 * Primary inference: 0G Private Computer (TEE-attested).
 * Fallback for local testing: Cerebras (when OG_PC_API_KEY not set).
 *
 * POST { message, model?, projectName?, projectPath?, activeFile?, fileTreeStr?, history? }
 * → text/event-stream of GraphEvent JSON lines.
 */

// Cerebras GLM model alias map (for stress-testing only)
const CEREBRAS_GLM_MAP: Record<string, string> = {
  'glm-5.1': 'zai-glm-4.7', 'glm-5': 'zai-glm-4.7', 'glm-4.7': 'zai-glm-4.7', 'zai-glm-4.7': 'zai-glm-4.7',
};

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await requireAuth();
  if (authError) return authError;

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

      // Provider selection: 0G PC (primary) → Cerebras (test fallback)
      let provider;
      let resolvedModel: string;

      if (cfg.ogpc.apiKey) {
        resolvedModel = model && isSupportedModel(model) ? model : cfg.ogpc.model;
        provider = new OGPrivateComputerProvider(cfg.ogpc.apiKey, cfg.ogpc.baseUrl);
      } else if (cfg.cerebrasApiKey) {
        // Stress-test / local dev fallback
        resolvedModel = CEREBRAS_GLM_MAP[model || 'glm-5.1'] || 'zai-glm-4.7';
        provider = new CerebrasProvider(cfg.cerebrasApiKey);
      } else {
        send({ type: 'error', error: 'No inference provider configured. Set OG_PC_API_KEY in .env.local' });
        controller.close();
        return;
      }

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
          model: resolvedModel,
          projectPath: projectPath || undefined,
          workspaceContext,
          history: normalizedHistory,
          provider,
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
