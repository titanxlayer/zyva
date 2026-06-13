import type { ReasoningProvider, GenerateOptions, GenerateResult } from './types';
import { ProviderError } from './types';

/**
 * ZYVA Provider — DigitalOcean Inference Router (router:zyva-v1)
 *
 * Task-based routing on DO:
 *   bug-fixing              → Gemma 4
 *   code-generation         → DeepSeek V4 Flash + Claude Fable-5
 *   test-writing            → DeepSeek V4 Flash
 *   code-performance        → DeepSeek V4 Pro + DeepSeek V4 Flash + Claude Fable-5
 *   fallback                → OpenAI GPT-oss-120b
 *
 * Access: INTERNAL ONLY — not exposed in user-facing model dropdown.
 * Use for stress testing and internal benchmarking only.
 *
 * Rate limits (per key/day):
 *   Tokens/day:   40,000,000
 *   Tokens/min:   800,000
 *   Requests:     300/window
 */

export const ZYVA_MODEL_ID = 'router:zyva-v1';

// Max tokens for agentic coding tasks — safe ceiling within rate limits
const ZYVA_MAX_TOKENS = 8192;

export interface ZyvaRateLimitInfo {
  limitTokensPerDay: number;
  remainingTokensPerDay: number;
  limitTokensPerMinute: number;
  remainingTokensPerMinute: number;
  limitRequests: number;
  remainingRequests: number;
  selectedRoute: string;
}

export class ZyvaProvider implements ReasoningProvider {
  readonly id = 'zyva';
  private readonly base = 'https://inference.do-ai.run/v1/chat/completions';
  public lastRateLimit: ZyvaRateLimitInfo | null = null;

  constructor(private readonly apiKey: string) {}

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    if (!this.apiKey) throw new ProviderError('ZYVA (DO) API key not configured', 401, this.id);

    const res = await fetch(this.base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: ZYVA_MODEL_ID,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: Math.min(opts.maxTokens ?? ZYVA_MAX_TOKENS, ZYVA_MAX_TOKENS),
        stream: true,
      }),
      signal: opts.signal ?? AbortSignal.timeout(120_000),
    });

    // Capture rate limit headers
    this.lastRateLimit = {
      limitTokensPerDay: parseInt(res.headers.get('x-ratelimit-limit-tokens-per-day') || '0'),
      remainingTokensPerDay: parseInt(res.headers.get('x-ratelimit-remaining-tokens-per-day') || '0'),
      limitTokensPerMinute: parseInt(res.headers.get('x-ratelimit-limit-tokens-per-minute') || '0'),
      remainingTokensPerMinute: parseInt(res.headers.get('x-ratelimit-remaining-tokens-per-minute') || '0'),
      limitRequests: parseInt(res.headers.get('x-ratelimit-limit-requests') || '0'),
      remainingRequests: parseInt(res.headers.get('x-ratelimit-remaining-requests') || '0'),
      selectedRoute: res.headers.get('x-model-router-selected-route') || 'unknown',
    };

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`ZYVA HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }

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
          if (delta?.content) { content += delta.content; opts.onToken?.(delta.content); }
        } catch { /* ignore partial frames */ }
      }
    }

    return { text: content.trim() };
  }
}
