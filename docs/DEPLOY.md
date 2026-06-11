# ZYVA — Deploy & Packaging

## Modes

ZYVA runs in two modes, chosen entirely by env — same codebase:

| Mode | Embeddings | Vector store | Keys | Server? |
|---|---|---|---|---|
| **Desktop (local)** | local Qwen via Ollama | local file store | BYO (user) | none |
| **Desktop + ZYVA Cloud** | ZYVA gateway | local or Qdrant | gateway holds key | gateway + (opt) Qdrant |

### Desktop local (offline, private, free)

`.env.local`:
```
ZYVA_EMBED_BACKEND=local
OLLAMA_BASE=http://localhost:11434
ZYVA_LOCAL_EMBED_MODEL=qwen3-embedding:0.6b
ZYVA_VECTOR_STORE=local
```
Requires Ollama with a Qwen embedding model pulled (`ollama pull qwen3-embedding:0.6b`).
No code leaves the machine. Reranking is skipped gracefully if no rerank backend is set.

### Desktop + gateway (team / managed inference)

```
ZYVA_EMBED_BACKEND=gateway
ZYVA_GATEWAY_URL=https://zyva.titanxlayer.com/embed-gateway
ZYVA_GATEWAY_KEY=<per-user key>
ZYVA_VECTOR_STORE=local        # or qdrant for team sync
```

## Desktop installers (Electron)

ZYVA keeps its server runtime (API routes + engine), so the desktop wrapper runs
the Next **standalone** server as a child process and opens a window to it.

Build locally:
```bash
npm ci && npm run build          # produces .next/standalone
cd desktop && npm install && npm run dist   # outputs installers in desktop/dist
```

CI: tag a release (`git tag v0.1.0 && git push --tags`) → `.github/workflows/release.yml`
builds `.exe` / `.dmg` / `.deb` / `.AppImage` on a 3-OS matrix and uploads artifacts.

> Note: the desktop packaging is a working scaffold; validate `npm run dist` on each
> target OS before publishing the first release.

## Server / VPS (gateway + landing)

On the existing VPS (e.g. `zyva.titanxlayer.com`), as an isolated container — it
does **not** run user code, only proxies embeddings:

```bash
cd gateway
docker build -t zyva-gateway .
docker run -d --name zyva-gateway -p 8090:8090 --env-file .env.local zyva-gateway
```
Route `zyva.titanxlayer.com/embed-gateway` → `http://zyva-gateway:8090` via your
reverse proxy (Traefik/Nginx), same pattern as the Titan services.

Landing page: static `landing/index.html` → Cloudflare Pages or the VPS web root.

Optional team services:
```bash
docker compose up -d   # Qdrant (6333) + Langfuse (3030)
```
