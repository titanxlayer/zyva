import type { EmbeddingProvider, EmbedOptions } from './types';
import { ProviderError } from './types';

/**
 * Local embedding provider via Ollama (offline, free, private).
 * Default model: a small Qwen embedding (e.g. qwen3-embedding:0.6b).
 * Ideal for desktop installs — code never leaves the user's machine.
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'ollama';

  constructor(private readonly base = 'http://localhost:11434') {}

  async embed(opts: EmbedOptions): Promise<number[][]> {
    // Ollama's /api/embed accepts a single string or an array.
    const res = await fetch(`${this.base.replace(/\/$/, '')}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: opts.model, input: opts.input }),
      signal: opts.signal ?? AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(`Ollama embed HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, this.id);
    }
    const json = await res.json();
    // Ollama returns { embeddings: number[][] }
    return json.embeddings || (json.embedding ? [json.embedding] : []);
  }
}
