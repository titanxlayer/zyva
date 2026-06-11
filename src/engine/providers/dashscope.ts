import type {
  EmbeddingProvider,
  RerankProvider,
  EmbedOptions,
  RerankOptions,
  RerankHit,
} from './types';
import { ProviderError } from './types';

/**
 * DashScope provider — embeddings (text-embedding-v4) and rerank (qwen3-rerank).
 * Region/base and key come from runtime config.
 */
export class DashScopeProvider implements EmbeddingProvider, RerankProvider {
  readonly id = 'dashscope';

  constructor(
    private readonly apiKey: string,
    private readonly base = 'https://dashscope-intl.aliyuncs.com',
  ) {}

  private headers() {
    if (!this.apiKey) throw new ProviderError('DashScope API key not configured', 401, this.id);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` };
  }

  /** OpenAI-compatible embeddings endpoint. */
  async embed(opts: EmbedOptions): Promise<number[][]> {
    const res = await fetch(`${this.base}/compatible-mode/v1/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: opts.model,
        input: opts.input,
        dimensions: opts.dimensions,
        encoding_format: 'float',
      }),
      signal: opts.signal ?? AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`DashScope embed HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }
    const json = await res.json();
    // Response order matches input order; sort by index defensively.
    return (json.data || [])
      .slice()
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((d: { embedding: number[] }) => d.embedding);
  }

  /** Native rerank service endpoint. */
  async rerank(opts: RerankOptions): Promise<RerankHit[]> {
    const res = await fetch(`${this.base}/api/v1/services/rerank/text-rerank/text-rerank`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: opts.model,
        input: { query: opts.query, documents: opts.documents },
        parameters: { top_n: opts.topN ?? Math.min(opts.documents.length, 5), return_documents: false },
      }),
      signal: opts.signal ?? AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`DashScope rerank HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }
    const json = await res.json();
    return (json.output?.results || []).map((r: { index: number; relevance_score: number }) => ({
      index: r.index,
      score: r.relevance_score,
    }));
  }
}
