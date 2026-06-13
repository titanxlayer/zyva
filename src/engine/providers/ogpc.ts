import type { ReasoningProvider, GenerateOptions, GenerateResult } from './types';
import { ProviderError } from './types';

/**
 * 0G Private Computer provider (OpenAI-compatible, TEE-attested).
 * Sole inference provider for ZYVA Cloud IDE.
 * base: https://pc.0g.ai/v1/chat/completions
 */

export const SUPPORTED_MODELS = [
  'minimax-m3',
  'glm-5.1',
  'qwen3.7-max',
  'qwen3.6-plus',
  'deepseek-v4-pro',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

export function isSupportedModel(model: string): model is SupportedModel {
  return SUPPORTED_MODELS.includes(model as SupportedModel);
}

export class OGPrivateComputerProvider implements ReasoningProvider {
  readonly id = 'ogpc';
  private readonly base: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = 'https://pc.0g.ai/v1',
  ) {
    this.base = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    if (!this.apiKey) throw new ProviderError('0G PC API key not configured', 401, this.id);

    const model = opts.model && isSupportedModel(opts.model) ? opts.model : 'minimax-m3';

    const res = await fetch(this.base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 16384,
        stream: true,
      }),
      signal: opts.signal ?? AbortSignal.timeout(120000),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(
        `0G PC HTTP ${res.status}: ${body.slice(0, 200)}`,
        res.status,
        this.id,
      );
    }

    // Record TEE attestation header if present
    const teeAttestation = res.headers.get('x-tee-attestation') ?? undefined;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
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
        } catch { /* ignore partial frames */ }
      }
    }

    return {
      text: content.trim(),
      teeAttestation,
    };
  }
}
