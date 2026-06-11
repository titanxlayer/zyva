import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Vector store abstraction. Two backends:
 *  - LocalVectorStore: file-backed, real float vectors, cosine search. Default,
 *    zero-infra, good for desktop builds.
 *  - QdrantVectorStore: REST adapter, used when ZYVA_VECTOR_STORE=qdrant and a
 *    QDRANT_URL is configured. Same interface, production-grade ANN.
 */

export interface VectorRecord {
  id: string;
  vector: number[];
  payload: {
    path: string;
    content: string;
    startLine: number;
    endLine: number;
    hash: string;
  };
}

export interface SearchHit {
  id: string;
  score: number;
  payload: VectorRecord['payload'];
}

export interface VectorStore {
  readonly backend: string;
  upsert(records: VectorRecord[]): Promise<void>;
  removeByPath(filePath: string): Promise<void>;
  search(vector: number[], topK: number): Promise<SearchHit[]>;
  count(): Promise<number>;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** File-backed store kept under <project>/.zyva/index.json */
export class LocalVectorStore implements VectorStore {
  readonly backend = 'local';
  private readonly file: string;
  private records: VectorRecord[] = [];
  private loaded = false;

  constructor(projectPath: string) {
    this.file = path.join(projectPath, '.zyva', 'index.json');
  }

  private load() {
    if (this.loaded) return;
    try {
      if (fs.existsSync(this.file)) {
        this.records = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      }
    } catch {
      this.records = [];
    }
    this.loaded = true;
  }

  private persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.records), 'utf-8');
    fs.renameSync(tmp, this.file); // atomic replace
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    this.load();
    const incoming = new Set(records.map((r) => r.id));
    this.records = this.records.filter((r) => !incoming.has(r.id)).concat(records);
    this.persist();
  }

  async removeByPath(filePath: string): Promise<void> {
    this.load();
    this.records = this.records.filter((r) => r.payload.path !== filePath);
    this.persist();
  }

  async search(vector: number[], topK: number): Promise<SearchHit[]> {
    this.load();
    return this.records
      .map((r) => ({ id: r.id, score: cosine(vector, r.vector), payload: r.payload }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async count(): Promise<number> {
    this.load();
    return this.records.length;
  }
}

/** Qdrant REST adapter — used only when configured. */
export class QdrantVectorStore implements VectorStore {
  readonly backend = 'qdrant';
  private ready = false;

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly collection: string,
    private readonly dims: number,
  ) {}

  private headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['api-key'] = this.apiKey;
    return h;
  }

  /** Qdrant point ids must be uint or UUID — map any string id to a stable UUID. */
  private toId(id: string): string {
    const h = crypto.createHash('md5').update(id).digest('hex'); // 32 hex chars
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }

  private async ensure() {
    if (this.ready) return;
    const res = await fetch(`${this.url}/collections/${this.collection}`, { headers: this.headers() });
    if (res.status === 404) {
      const create = await fetch(`${this.url}/collections/${this.collection}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ vectors: { size: this.dims, distance: 'Cosine' } }),
      });
      if (!create.ok) throw new Error(`Qdrant create collection failed: ${create.status} ${await create.text()}`);
    }
    this.ready = true;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    await this.ensure();
    const res = await fetch(`${this.url}/collections/${this.collection}/points?wait=true`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({
        points: records.map((r) => ({ id: this.toId(r.id), vector: r.vector, payload: r.payload })),
      }),
    });
    if (!res.ok) throw new Error(`Qdrant upsert failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  async removeByPath(filePath: string): Promise<void> {
    await this.ensure();
    await fetch(`${this.url}/collections/${this.collection}/points/delete?wait=true`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ filter: { must: [{ key: 'path', match: { value: filePath } }] } }),
    });
  }

  async search(vector: number[], topK: number) {
    await this.ensure();
    const res = await fetch(`${this.url}/collections/${this.collection}/points/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ vector, limit: topK, with_payload: true }),
    });
    const json = await res.json();
    return (json.result || []).map((r: { id: string; score: number; payload: VectorRecord['payload'] }) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload,
    }));
  }

  async count(): Promise<number> {
    await this.ensure();
    const res = await fetch(`${this.url}/collections/${this.collection}/points/count`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ exact: true }),
    });
    const json = await res.json();
    return json.result?.count ?? 0;
  }
}
