import { getConfig } from '../config';
import { CerebrasProvider } from '../providers/cerebras';
import type { ReasoningProvider, ChatMessage } from '../providers/types';
import { retrieve, type RetrievedChunk } from '../retrieval';
import { Trace } from '../observability/trace';

/**
 * Bounded agent runtime.
 *
 * This replaces the previous "single fetch + fake swarm animation" with a real,
 * observable, bounded execution path:
 *   retrieve context -> build prompt -> reason (with retry cap) -> return
 *
 * Hard limits prevent runaway execution:
 *   - MAX_RETRIES on transient provider errors
 *   - token budget via maxTokens
 *   - no recursive self-invocation
 *
 * Multi-agent decomposition (Architect/Frontend/Backend/Debug/Review) plugs in
 * behind this same interface; today it runs a single bounded reasoning step.
 */

const MAX_RETRIES = 2;

export interface RunAgentInput {
  message: string;
  model: string;
  systemPrompt: string;
  history: ChatMessage[];
  projectPath?: string;
  reasoningProvider?: ReasoningProvider;
}

export interface RunAgentOutput {
  text: string;
  source: string;
  retrieval: RetrievedChunk[];
  traceId: string;
  tokens?: { prompt?: number; completion?: number };
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentOutput> {
  const cfg = getConfig();
  const trace = new Trace(input.message);
  trace.set({ model: input.model });

  // ── 1. Retrieval (real embeddings + rerank) ────────────────────────────────
  let retrieval: RetrievedChunk[] = [];
  if (input.projectPath) {
    const rspan = trace.span('retrieval', { projectPath: input.projectPath });
    try {
      retrieval = await retrieve(input.projectPath, input.message, { topK: 20, finalN: 5 });
      rspan.end({ hits: retrieval.length, reranked: retrieval.some((r) => r.reranked) });
    } catch (e) {
      rspan.end({ error: (e as Error).message });
    }
  }

  // ── 2. Build context-injected prompt ───────────────────────────────────────
  let contextBlock = '';
  if (retrieval.length > 0) {
    contextBlock = '\n\n## RELEVANT CODE (semantic retrieval)\n' +
      retrieval
        .map((r) => `### ${r.path}:${r.startLine}-${r.endLine} (score ${(r.score * 100).toFixed(1)}%)\n\`\`\`\n${r.content.slice(0, 1200)}\n\`\`\``)
        .join('\n');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: input.systemPrompt + contextBlock },
    ...input.history,
    { role: 'user', content: input.message },
  ];

  // ── 3. Reason with bounded retry ────────────────────────────────────────────
  const provider = input.reasoningProvider ?? new CerebrasProvider(cfg.cerebrasApiKey);
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const gspan = trace.span('reason', { provider: provider.id, attempt });
    try {
      const result = await provider.generate({
        model: input.model,
        messages,
        temperature: 0.3,
        maxTokens: 16384,
      });
      gspan.end({ chars: result.text.length });
      trace.set({
        source: `${provider.id} (${input.model})`,
        tokens: { prompt: result.promptTokens, completion: result.completionTokens },
      });
      await trace.flush();
      return {
        text: result.text,
        source: `${provider.id} (${input.model})`,
        retrieval,
        traceId: trace.record.id,
        tokens: { prompt: result.promptTokens, completion: result.completionTokens },
      };
    } catch (e) {
      lastErr = e as Error;
      gspan.end({ error: lastErr.message });
    }
  }

  trace.set({ error: lastErr?.message });
  await trace.flush();
  throw lastErr ?? new Error('agent failed');
}
