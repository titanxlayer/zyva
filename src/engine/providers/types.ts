/**
 * ZYVA Model Provider abstraction.
 *
 * Every inference backend (reasoning, embeddings, rerank) is accessed through
 * these interfaces so the rest of the runtime never hardcodes a vendor.
 * Users bring their own API keys; ZYVA does not burn shared inference budget.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  reasoning?: string;
  teeAttestation?: string;
  promptTokens?: number;
  completionTokens?: number;
  raw?: unknown;
}

export interface EmbedOptions {
  model: string;
  input: string[];
  dimensions?: number;
  signal?: AbortSignal;
}

export interface RerankOptions {
  model: string;
  query: string;
  documents: string[];
  topN?: number;
  signal?: AbortSignal;
}

export interface RerankHit {
  index: number;
  score: number;
}

/** A backend capable of text generation (reasoning models). */
export interface ReasoningProvider {
  readonly id: string;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
}

/** A backend capable of producing embedding vectors. */
export interface EmbeddingProvider {
  readonly id: string;
  embed(opts: EmbedOptions): Promise<number[][]>;
}

/** A backend capable of reranking candidate documents against a query. */
export interface RerankProvider {
  readonly id: string;
  rerank(opts: RerankOptions): Promise<RerankHit[]>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number, readonly provider?: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
