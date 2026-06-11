import type {
  ReasoningProvider,
  GenerateOptions,
  GenerateResult,
} from './types';
import { ProviderError } from './types';

/**
 * Cerebras reasoning provider (OpenAI-compatible streaming chat completions).
 * Used for GLM models during testing. Key comes from the runtime config, never
 * hardcoded in source.
 */
export class CerebrasProvider implements ReasoningProvider {
  readonly id = 'cerebras';
  private readonly base = 'https://api.cerebras.ai/v1/chat/completions';

  constructor(private readonly apiKey: string) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    if (!this.apiKey) throw new ProviderError('Cerebras API key not configured', 401, this.id);

    const res = await fetch(this.base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 16384,
        stream: true,
      }),
      signal: opts.signal ?? AbortSignal.timeout(120000),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Cerebras HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    let reasoning = '';
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (!value) continue;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { done = true; break; }
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta;
          if (delta?.content) content += delta.content;
          if (delta?.reasoning) reasoning += delta.reasoning;
        } catch { /* ignore partial frames */ }
      }
    }

    return { text: (content || reasoning).trim(), reasoning: reasoning || undefined };
  }
}
