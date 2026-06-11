import type {
  EmbeddingProvider,
  RerankProvider,
  EmbedOptions,
  RerankOptions,
  RerankHit,
} from './types';
import { ProviderError } from './types';

/**
 * ZYVA Gateway provider — the desktop client talks to a self-hosted ZYVA
 * embedding gateway (which holds the real key / model server-side, applies a
 * content-hash cache and per-key quota). The client never sees the upstream key.
 */
export class ZyvaGatewayProvider implements EmbeddingProvider, RerankProvider {
  readonly id = 'zyva-gateway';

  constructor(private readonly url: string, private readonly key: string) {}

  private headers() {
    if (!this.url) throw new ProviderError('ZYVA gateway URL not configured', 500, this.id);
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.key) h['Authorization'] = `Bearer ${this.key}`;
    return h;
  }

  async embed(opts: EmbedOptions): Promise<number[][]> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}/embed`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: opts.model, input: opts.input, dimensions: opts.dimensions }),
      signal: opts.signal ?? AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Gateway embed HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }
    return (await res.json()).embeddings || [];
  }

  async rerank(opts: RerankOptions): Promise<RerankHit[]> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}/rerank`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: opts.model, query: opts.query, documents: opts.documents, top_n: opts.topN }),
      signal: opts.signal ?? AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Gateway rerank HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }
    return (await res.json()).results || [];
  }
}
