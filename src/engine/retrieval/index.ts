import crypto from 'crypto';
import { getConfig } from '../config';
import { DashScopeProvider } from '../providers/dashscope';
import { chunkFile } from './chunker';
import {
  LocalVectorStore,
  QdrantVectorStore,
  type VectorStore,
  type VectorRecord,
} from './vectorStore';

const CODE_EXT = /\.(ts|tsx|js|jsx|py|rs|go|java|rb|php|css|html|md|json|toml|yaml|yml)$/i;

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function collectionName(projectPath: string): string {
  return 'zyva_' + sha(projectPath);
}

export function getVectorStore(projectPath: string): VectorStore {
  const cfg = getConfig();
  if (cfg.vectorStore === 'qdrant' && cfg.qdrant.url) {
    return new QdrantVectorStore(cfg.qdrant.url, cfg.qdrant.apiKey, collectionName(projectPath), cfg.embed.dims);
  }
  return new LocalVectorStore(projectPath);
}

function embedder() {
  const cfg = getConfig();
  return new DashScopeProvider(cfg.dashscope.apiKey, cfg.dashscope.base);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const cfg = getConfig();
  const provider = embedder();
  const out: number[][] = [];
  // DashScope caps batch size; chunk requests at 10.
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const vecs = await provider.embed({ model: cfg.embed.model, input: batch, dimensions: cfg.embed.dims });
    out.push(...vecs);
  }
  return out;
}

export interface IndexResult {
  backend: string;
  files: number;
  chunks: number;
}

/** Index a set of files (path -> content) into the vector store. */
export async function indexFiles(
  projectPath: string,
  files: Record<string, string>,
): Promise<IndexResult> {
  const store = getVectorStore(projectPath);

  const records: VectorRecord[] = [];
  const pending: { id: string; text: string; payload: VectorRecord['payload'] }[] = [];
  let fileCount = 0;

  for (const [path, content] of Object.entries(files)) {
    if (!CODE_EXT.test(path) || !content.trim()) continue;
    fileCount++;
    await store.removeByPath(path);
    for (const chunk of chunkFile(path, content)) {
      const hash = sha(chunk.content);
      pending.push({
        id: sha(`${path}:${chunk.startLine}:${hash}`),
        text: `// ${path}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`,
        payload: { path, content: chunk.content, startLine: chunk.startLine, endLine: chunk.endLine, hash },
      });
    }
  }

  if (pending.length > 0) {
    const vectors = await embedBatch(pending.map((p) => p.text));
    for (let i = 0; i < pending.length; i++) {
      records.push({ id: pending[i].id, vector: vectors[i], payload: pending[i].payload });
    }
    await store.upsert(records);
  }

  return { backend: store.backend, files: fileCount, chunks: records.length };
}

export interface RetrievedChunk {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  score: number;
  reranked: boolean;
}

/**
 * Two-stage retrieval: embedding cosine recall (topK) -> qwen3-rerank precision.
 * Falls back gracefully to embedding scores if rerank is unavailable.
 */
export async function retrieve(
  projectPath: string,
  query: string,
  opts: { topK?: number; finalN?: number } = {},
): Promise<RetrievedChunk[]> {
  const cfg = getConfig();
  const topK = opts.topK ?? 20;
  const finalN = opts.finalN ?? 5;

  const store = getVectorStore(projectPath);
  if ((await store.count()) === 0) return [];

  const provider = embedder();
  const [queryVec] = await provider.embed({ model: cfg.embed.model, input: [query], dimensions: cfg.embed.dims });
  const hits = await store.search(queryVec, topK);
  if (hits.length === 0) return [];

  // Stage 2: rerank
  try {
    const ranked = await provider.rerank({
      model: cfg.rerankModel,
      query,
      documents: hits.map((h) => `${h.payload.path}\n${h.payload.content}`),
      topN: finalN,
    });
    return ranked.map((r) => ({
      path: hits[r.index].payload.path,
      content: hits[r.index].payload.content,
      startLine: hits[r.index].payload.startLine,
      endLine: hits[r.index].payload.endLine,
      score: r.score,
      reranked: true,
    }));
  } catch {
    return hits.slice(0, finalN).map((h) => ({
      path: h.payload.path,
      content: h.payload.content,
      startLine: h.payload.startLine,
      endLine: h.payload.endLine,
      score: h.score,
      reranked: false,
    }));
  }
}
