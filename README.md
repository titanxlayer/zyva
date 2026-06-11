# ZYVA

**Build apps with AI — in the cloud or on your desktop.** ZYVA is an AI coding environment with a VS Code–style workspace, real semantic codebase memory, a bounded multi-agent graph, and a security-first execution layer.

- **Cloud IDE** (coming soon) — full browser workspace backed by 0G TEE + Firecracker VM + persistent storage. No install required.
- **Desktop app** — same AI workspace running locally on your machine, full offline support.

AI inference is powered by **[0G Private Computer](https://pc.0g.ai)** — OpenAI-compatible, every request runs inside a TEE on the 0G network. No BYOK required.

---

## Stack

| Layer | Technology |
|---|---|
| UI shell | Next.js 16 (App Router), React 19, Monaco editor, Tailwind v4, Zustand, Framer Motion |
| Reasoning | **0G Private Computer** (`pc.0g.ai`) — OpenAI-compatible, TEE-attested. Models: MiniMax-M3, GLM-5.1, Qwen3.7-Max, Qwen3.6-Plus, DeepSeek-V4-Pro |
| Embeddings | Qwen — `text-embedding-v4` (DashScope cloud) or local Qwen (Ollama); switchable |
| Rerank | `qwen3-rerank` (two-stage retrieval) |
| Vector store | Local file-backed store (default, offline) or Qdrant (server/team) |
| Parser/chunker | Code-aware semantic chunker (tree-sitter seam) |
| Orchestration | Bounded multi-agent graph: Architect → Frontend/Backend → Review (SSE streaming) |
| Patch engine | Aider-style SEARCH/REPLACE + atomic writes + per-action snapshot & rollback |
| Execution | Command policy (allow / approve / deny) + project containment + timeout |
| Observability | Local trace store (always on) + optional Langfuse |

---

## Architecture

```mermaid
flowchart TD
    subgraph Desktop["ZYVA Desktop (user machine)"]
        UI["UI Shell<br/>Monaco · Chat · Live Preview · Swarm panel"]
        Store["State (Zustand)"]
        subgraph Engine["src/engine — runtime"]
            Orch["Orchestrator<br/>runAgent · multi-agent graph"]
            Retr["Retrieval<br/>chunker → embed → store → rerank"]
            Patch["Patch engine<br/>SEARCH/REPLACE · snapshot · rollback"]
            Sec["Security<br/>command policy · containment"]
            Obs["Observability<br/>trace store"]
            Prov["Providers<br/>reasoning · embedding · rerank"]
        end
        VS["Vector store (local)"]
    end

    subgraph External["External / optional"]
        LLM["0G Private Computer<br/>(pc.0g.ai — TEE-attested)<br/>MiniMax-M3 · GLM-5.1 · Qwen3.7-Max<br/>Qwen3.6-Plus · DeepSeek-V4-Pro"]
        EMB["Qwen embeddings<br/>(DashScope or local Ollama)"]
        QD["Qdrant (optional)"]
        LF["Langfuse (optional)"]
    end

    UI <--> Store --> Orch
    Orch --> Retr --> Prov
    Orch --> Prov
    Prov --> LLM
    Prov --> EMB
    Retr --> VS
    Retr -. team mode .-> QD
    Orch --> Patch
    Orch --> Sec
    Orch --> Obs -. optional .-> LF
```

### Retrieval (semantic memory)

```mermaid
flowchart LR
    F["File change / index"] --> C["Semantic chunker"]
    C --> E["Qwen embeddings<br/>(text-embedding-v4 / local)"]
    E --> S["Vector store<br/>(local / Qdrant)"]
    Q["User query"] --> QE["Embed query"]
    QE --> KNN["Cosine top-K"]
    S --> KNN
    KNN --> RR["qwen3-rerank<br/>top-N"]
    RR --> CTX["Inject context → reasoning model"]
```

### Multi-agent graph (bounded)

```mermaid
flowchart LR
    T["Task"] --> A["Architect<br/>plan (1-4 steps)"]
    A --> R{"route step"}
    R -->|UI| FE["Frontend agent"]
    R -->|API/logic| BE["Backend agent"]
    FE --> RV["Review agent"]
    BE --> RV
    RV -->|issues| DBG["Debug agent<br/>(bounded retry ≤1)"]
    DBG --> RV
    RV -->|ok| OUT["Aggregated scoped patches"]
```

Hard bounds: max steps, max retries, token caps, **no recursive self-invocation**. Every node is traced; progress streams to the Swarm panel via SSE.

---

## Security model

- The LLM **never** executes shell directly. Commands are classified:
  - **allow** — safe, may auto-run (`npm install`, `npm run build`, `eslint`, `tsc`, `pytest`…)
  - **approve** — requires explicit user confirmation (`rm`, `chmod`, `curl|bash`, `docker`, chaining…)
  - **deny** — never run (`rm -rf`, `sudo`, fork bombs, disk writes…)
- Execution is contained to the project directory and bounded by a timeout.
- Secrets live in `.env.local` (gitignored) and are never shipped in the client binary or exposed over HTTP.
- TEE status is reported honestly (`TEE Runtime Connected · Sandbox Active`); ZYVA does **not** claim "verified" attestation until a real quote exists.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # add your 0G Private Computer API key
npm run dev                  # http://localhost:3000
```

### Environment

See `.env.example`. Key variables:

| Var | Purpose |
|---|---|
| `OG_PC_API_KEY` | 0G Private Computer API key — get from [pc.0g.ai](https://pc.0g.ai) |
| `OG_PC_BASE_URL` | `https://pc.0g.ai/v1` (default) |
| `OG_PC_MODEL` | default model (e.g. `minimax-m3`, `glm-5.1`, `qwen3.7-max`, `qwen3.6-plus`, `deepseek-v4-pro`) |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE` | Qwen embeddings + rerank |
| `ZYVA_EMBED_BACKEND` | `dashscope` \| `local` (Ollama) \| `gateway` |
| `ZYVA_EMBED_MODEL` / `ZYVA_EMBED_DIMS` | embedding model + dimensions (default 1024) |
| `ZYVA_VECTOR_STORE` | `local` (default) \| `qdrant` |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant (team mode) |
| `LANGFUSE_*` | optional observability |
| `ZYVA_AUTORUN_COMMANDS` | allow auto-run of allowlisted commands |

### Optional services (server/team mode)

```bash
docker compose up -d        # Qdrant (6333) + Langfuse (3030)
```

---

## Project structure

```
src/
  app/                 Next.js routes + API (chat, agent/run, agent/stream, index, terminal, traces, workspace)
  components/          UI (editor, chat, live preview, swarm panel)
  store/               Zustand state
  engine/              ← the real runtime (original ZYVA code, white-label)
    providers/         model provider abstraction (reasoning / embedding / rerank)
    retrieval/         chunker, vector store (local + Qdrant), index + query
    orchestrator/      runAgent + multi-agent graph + agent roles
    patch/             SEARCH/REPLACE patch engine + snapshot/rollback
    security/          command policy + containment
    observability/     trace store (+ Langfuse forwarder)
    tee/               honest TEE runtime state
gateway/               standalone embedding gateway (server mode)
landing/               static landing page
```

---

## Tests

```bash
node --env-file=.env.local scripts/test-cerebras.mjs
node scripts/test-preview-flow.mjs       # agent codes + live preview
node scripts/test-swarm-stream.mjs       # multi-agent streaming to Swarm panel
```

---

## License & notices

White-label product. Third-party components (when adapted) retain their licenses — see `NOTICE`. Permissive (MIT/Apache-2.0) only; no GPL/AGPL embedded.
