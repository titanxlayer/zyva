// ZYVA Embedding Gateway
// Dependency-free Node service. Holds the upstream key server-side, applies a
// content-hash cache and per-key quota, and exposes /embed + /rerank.
// Runs on a normal CPU VPS. Upstream: DashScope (Qwen) by default; TEI optional.

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.PORT || '8090', 10);
const UPSTREAM = process.env.ZYVA_EMBED_UPSTREAM || 'dashscope'; // 'dashscope' | 'tei'
const DASHSCOPE_BASE = process.env.DASHSCOPE_BASE || 'https://dashscope-intl.aliyuncs.com';
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY || '';
const TEI_URL = process.env.TEI_URL || ''; // e.g. http://tei:80 (HF text-embeddings-inference)
const RERANK_MODEL = process.env.ZYVA_RERANK_MODEL || 'qwen3-rerank';

// Auth: comma-separated client keys. Empty = open (dev only).
const CLIENT_KEYS = (process.env.ZYVA_GATEWAY_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
// Per-key daily quota (embeddings count). 0 = unlimited.
const DAILY_QUOTA = parseInt(process.env.ZYVA_GATEWAY_DAILY_QUOTA || '0', 10);

const cache = new Map(); // contentHash -> number[]
const quota = new Map(); // key -> { day, count }
const MAX_CACHE = parseInt(process.env.ZYVA_GATEWAY_CACHE_MAX || '50000', 10);

function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function checkAuth(req) {
  if (CLIENT_KEYS.length === 0) return { ok: true, key: 'anon' };
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return CLIENT_KEYS.includes(token) ? { ok: true, key: token } : { ok: false };
}

function bumpQuota(key, n) {
  if (!DAILY_QUOTA) return true;
  const day = new Date().toISOString().slice(0, 10);
  const q = quota.get(key);
  if (!q || q.day !== day) { quota.set(key, { day, count: n }); return n <= DAILY_QUOTA; }
  q.count += n;
  return q.count <= DAILY_QUOTA;
}

async function dashscopeEmbed(model, inputs, dimensions) {
  const res = await fetch(`${DASHSCOPE_BASE}/compatible-mode/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DASHSCOPE_KEY}` },
    body: JSON.stringify({ model, input: inputs, dimensions, encoding_format: 'float' }),
  });
  if (!res.ok) throw new Error(`dashscope ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function teiEmbed(inputs) {
  const res = await fetch(`${TEI_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) throw new Error(`tei ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json(); // number[][]
}

async function embed(model, inputs, dimensions) {
  // Serve from cache where possible; only embed cache misses.
  const keys = inputs.map((t) => hash(`${model}:${dimensions}:${t}`));
  const missingIdx = [];
  const result = new Array(inputs.length);
  keys.forEach((k, i) => { if (cache.has(k)) result[i] = cache.get(k); else missingIdx.push(i); });

  if (missingIdx.length) {
    const missTexts = missingIdx.map((i) => inputs[i]);
    const vecs = UPSTREAM === 'tei' ? await teiEmbed(missTexts) : await dashscopeEmbed(model, missTexts, dimensions);
    missingIdx.forEach((origIdx, j) => {
      result[origIdx] = vecs[j];
      if (cache.size < MAX_CACHE) cache.set(keys[origIdx], vecs[j]);
    });
  }
  return { embeddings: result, cached: inputs.length - missingIdx.length, computed: missingIdx.length };
}

async function rerank(model, query, documents, topN) {
  const res = await fetch(`${DASHSCOPE_BASE}/api/v1/services/rerank/text-rerank/text-rerank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DASHSCOPE_KEY}` },
    body: JSON.stringify({ model: model || RERANK_MODEL, input: { query, documents }, parameters: { top_n: topN || 5 } }),
  });
  if (!res.ok) throw new Error(`rerank ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.output?.results || []).map((r) => ({ index: r.index, score: r.relevance_score }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20 * 1024 * 1024) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, upstream: UPSTREAM, cache: cache.size });
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  const auth = checkAuth(req);
  if (!auth.ok) return send(res, 401, { error: 'unauthorized' });

  try {
    const body = JSON.parse((await readBody(req)) || '{}');
    if (req.url === '/embed') {
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      if (!bumpQuota(auth.key, inputs.length)) return send(res, 429, { error: 'daily quota exceeded' });
      const out = await embed(body.model || 'text-embedding-v4', inputs, body.dimensions || 1024);
      return send(res, 200, out);
    }
    if (req.url === '/rerank') {
      const results = await rerank(body.model, body.query, body.documents || [], body.top_n);
      return send(res, 200, { results });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => console.log(`ZYVA embedding gateway on :${PORT} (upstream=${UPSTREAM}, auth=${CLIENT_KEYS.length ? 'on' : 'open'})`));
