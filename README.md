<div align="center">

<img src="landing/assets/logo.png" alt="ZYVA" width="80" height="80" style="border-radius:18px"/>

# ZYVA

**AI-powered Cloud IDE — build and ship apps from your browser.**

[![Release](https://img.shields.io/github/v/release/titanxlayer/zyva?style=flat-square&color=7c3aed)](https://github.com/titanxlayer/zyva/releases)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/titanxlayer/zyva/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/titanxlayer/zyva/actions)
[![0G PC](https://img.shields.io/badge/inference-0G_Private_Computer-7c3aed?style=flat-square)](https://pc.0g.ai)

[**Try Cloud IDE →**](https://app.zyva.dev) · [**Download Desktop**](https://github.com/titanxlayer/zyva/releases) · [**Docs**](https://app.zyva.dev/docs) · [**zyva.dev**](https://zyva.dev)

</div>

---

![ZYVA IDE Screenshot](landing/assets/screenshot.png)

---

## What is ZYVA?

ZYVA is a Lovable-style AI coding environment with two modes:

| | Cloud IDE | Desktop App |
|---|---|---|
| **Access** | Browser — no install | Electron — local |
| **Execution** | WebContainer (browser) + E2B sandbox | Local machine directly |
| **Isolation** | 0G TEE + Firecracker VM per session | User's own machine |
| **Storage** | 0G persistent storage | Local filesystem |
| **AI** | 0G Private Computer (TEE-attested) | 0G Private Computer |

**Cloud IDE is the primary product.** The desktop app stays available for teams that need fully local control.

---

## AI Inference — 0G Private Computer

All inference runs on **[0G Private Computer](https://pc.0g.ai)** — OpenAI-compatible API, every request inside a TEE. No BYOK required.

| Model | Context | Best for |
|---|---|---|
| `minimax-m3` ⭐ | 1M | Multimodal, default |
| `glm-5.1` | 207K | Long-horizon coding |
| `qwen3.7-max` | 1M | Function calling |
| `qwen3.6-plus` | 1M | Multilingual |
| `deepseek-v4-pro` | 1M | Agentic coding |

---

## Stack

| Layer | Technology |
|---|---|
| UI shell | Next.js 16 (App Router), React 19, Monaco editor, Tailwind v4, Zustand, Framer Motion |
| Inference | **0G Private Computer** (`pc.0g.ai`) — OpenAI-compatible, TEE-attested |
| Auth | NextAuth v5 — Google, GitHub OAuth + SIWE wallet (0G Chain) |
| Database | PostgreSQL (Prisma v7) — users, sessions, projects, traces |
| Sandbox | E2B — on-demand, build/install only, torn down after task |
| Git | Real `git commit + push` to GitHub from the IDE Source Control panel |
| Embeddings | Qwen `text-embedding-v4` (DashScope) or local Ollama |
| Rerank | `qwen3-rerank` |
| Vector store | Local file-backed (default) or Qdrant |
| Observability | Local trace store + optional Langfuse |
| Desktop | Electron wrapper around Next.js standalone build |

---

## Repository Map

```
zyva-app/
├── src/
│   ├── app/                    Next.js App Router
│   │   ├── api/
│   │   │   ├── agent/          SSE streaming multi-agent graph
│   │   │   ├── ai/             Chat completions
│   │   │   ├── auth/           NextAuth route handler
│   │   │   ├── git/            Real git commit + push to GitHub
│   │   │   ├── sandbox/        E2B sandbox executor endpoint
│   │   │   ├── terminal/       Secure command execution
│   │   │   ├── traces/         Observability trace list
│   │   │   └── workspace/      File tree, save, create project
│   │   ├── auth/               Sign-in + error pages
│   │   └── docs/               Public documentation pages
│   │
│   ├── components/
│   │   ├── AgentSwarm.tsx      Right panel: Swarm + AI Chat
│   │   ├── ChatComponents.tsx  Markdown, action cards, TEE badge
│   │   ├── IdeBodyClass.tsx    IDE vs page scroll isolation
│   │   ├── LivePreview.tsx     Babel-transpiled iframe preview
│   │   ├── MonacoCodeEditor.tsx Editor + Prettier + Emmet + snippets
│   │   ├── SidebarPanel.tsx    Explorer, Source Control, Extensions
│   │   └── TerminalConsole.tsx Secure terminal with TEE badge
│   │
│   ├── engine/                 ← Core runtime
│   │   ├── config.ts           Central env/config
│   │   ├── execution/
│   │   │   └── e2bExecutor.ts  E2B on-demand sandbox
│   │   ├── git/
│   │   │   └── gitOps.ts       Real git operations
│   │   ├── observability/
│   │   │   └── trace.ts        Trace store + Langfuse forwarder
│   │   ├── orchestrator/       Multi-agent graph (Architect → Review)
│   │   ├── patch/              SEARCH/REPLACE + snapshot/rollback
│   │   ├── providers/
│   │   │   ├── ogpc.ts         0G Private Computer provider ⭐
│   │   │   ├── cerebras.ts     Cerebras (test fallback)
│   │   │   ├── dashscope.ts    Qwen embeddings
│   │   │   └── types.ts        Provider interfaces
│   │   ├── retrieval/          Chunker + vector store + query
│   │   ├── security/           Command policy (allow/approve/deny)
│   │   └── tee/                Honest TEE attestation state
│   │
│   ├── lib/
│   │   ├── auth-guard.ts       API auth middleware helper
│   │   ├── extensions-catalog.ts Extension definitions
│   │   ├── file-icons.ts       File icon mapping
│   │   ├── github.ts           GitHub OAuth token + repo API
│   │   ├── prettier-format.ts  Browser Prettier integration
│   │   ├── prisma.ts           Prisma client singleton
│   │   ├── snippets.ts         React/TS code snippets
│   │   ├── wallet.ts           SIWE wallet signature verify
│   │   └── workspace-isolation.ts Per-user path isolation
│   │
│   ├── auth.ts                 NextAuth v5 config
│   ├── middleware.ts            Edge auth middleware
│   └── store/
│       └── useIdeStore.ts      Zustand global state
│
├── templates/                  Injected into every new user project
│   ├── CLAUDE.md               Entry point for AI agent context
│   ├── AGENTS.md               Stack rules + coding conventions
│   └── DESIGN.md               ZYVA design system (dark, #7c3aed)
│
├── landing/                    Static landing page (zyva.dev)
│   └── assets/
│       ├── logo.png
│       └── screenshot.png
│
├── desktop/                    Electron wrapper
│   ├── main.js
│   ├── prepackage.mjs
│   └── package.json
│
├── prisma/
│   └── schema.prisma           DB schema (users, sessions, projects, traces)
│
├── gateway/                    Standalone embedding gateway (server mode)
│
├── scripts/                    Test + stress-test scripts
│   ├── test-auth-flow.mjs
│   ├── test-extensions.mjs
│   └── test-cloud-stress.mjs
│
└── .github/workflows/
    ├── ci.yml                  Build + lint on push
    └── release.yml             Cross-platform desktop builds on tag
```

---

## Getting Started

```bash
git clone https://github.com/titanxlayer/zyva
cd zyva-app
npm install
npx prisma generate
cp .env.example .env.local   # add your 0G PC API key
npm run dev                  # http://localhost:3000
```

### Environment

| Var | Purpose |
|---|---|
| `OG_PC_API_KEY` | 0G Private Computer — [pc.0g.ai](https://pc.0g.ai) |
| `OG_PC_BASE_URL` | `https://pc.0g.ai/v1` |
| `OG_PC_MODEL` | `minimax-m3` (default) |
| `E2B_API_KEY` | E2B sandbox — [e2b.dev](https://e2b.dev) |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-domain.com` |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth |
| `DASHSCOPE_API_KEY` | Qwen embeddings + rerank |
| `ZYVA_WORKSPACES_ROOT` | Per-user workspace root directory |

### Build desktop

```bash
NEXT_STANDALONE=1 npm run build
cd desktop && npm run dist
```

---

## Security Model

- LLM **never** executes shell directly — all commands go through the policy layer
- **allow** → auto-run safe commands (`npm install`, `tsc`, `eslint`)
- **approve** → requires user confirmation (`rm`, `docker`, chaining)
- **deny** → blocked (`rm -rf`, `sudo`, fork bombs)
- Per-user workspace isolation — paths validated server-side
- E2B sandboxes scoped per user session, torn down after task
- 0G TEE attestation recorded for every inference request

---

## License

MIT — see [LICENSE](LICENSE)

Third-party components retain their licenses. See [NOTICE](NOTICE).
