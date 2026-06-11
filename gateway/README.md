# ZYVA Embedding Gateway

Standalone embedding/rerank service. Holds the upstream key server-side, applies
a **content-hash cache** (identical chunks embedded once, shared across users)
and **per-key daily quota**, and exposes a small HTTP API. Runs on a **normal CPU
VPS** — no GPU required.

The desktop client points to it with:

```
ZYVA_EMBED_BACKEND=gateway
ZYVA_GATEWAY_URL=https://zyva.titanxlayer.com/embed-gateway
ZYVA_GATEWAY_KEY=<client key>
```

## Run

Local:
```bash
node --env-file=.env.local server.mjs
```

Docker:
```bash
docker build -t zyva-gateway .
docker run -d --name zyva-gateway -p 8090:8090 --env-file .env.local zyva-gateway
```

## API

- `GET /health` → `{ ok, upstream, cache }`
- `POST /embed` `{ model, input: string[], dimensions }` → `{ embeddings, cached, computed }`
- `POST /rerank` `{ model, query, documents: string[], top_n }` → `{ results: [{ index, score }] }`

Auth: `Authorization: Bearer <key>` when `ZYVA_GATEWAY_KEYS` is set.

## Upstream options

- `ZYVA_EMBED_UPSTREAM=dashscope` (default) — proxy to Qwen `text-embedding-v4`. CPU VPS fine; you pay per token.
- `ZYVA_EMBED_UPSTREAM=tei` + `TEI_URL` — self-host the model with HF Text Embeddings Inference (flat server cost, no per-token). Add a GPU only when throughput demands.
