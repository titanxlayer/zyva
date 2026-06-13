# ZYVA Monorepo Restructure — Plan

## Goal

Reorganize the repo into a workspace-based monorepo so the AI engine is shared,
cloud and desktop are separate apps, and templates/landing live at the top level.

## Target structure

```
zyva/
├── packages/
│   ├── engine/        SHARED brain — orchestrator, patch, retrieval, security, providers, observability, tee, config
│   ├── cloud/         Next.js 16 cloud IDE (imports @zyva/engine)
│   └── desktop/       Electron app (wraps the cloud build)
├── templates/         CLAUDE.md, AGENTS.md, DESIGN.md (injected into user projects)
├── landing/           Static landing page
├── docs/
└── package.json       npm workspaces root
```

## Current reality (important)

- `src/engine/` is imported by 7 API routes via the `@/engine/...` alias.
- `desktop/` does NOT import engine directly — it packages the Next.js standalone
  build (`../.next/standalone`). So today the engine ships *inside* the Next.js app.
- `landing/` and `templates/` are standalone, no code dependency.

This means: the engine split is mostly about clean boundaries + reusability later.
Desktop will keep wrapping the cloud build for now.

---

## Phase 0 — Cleanup (do first, low risk)

- [ ] Delete `temp_opencode/` (18MB research dump, not needed)
- [ ] Move root `dashboard.tsx` into `src/` (or delete if unused)
- [ ] Confirm `.gitignore` covers `node_modules`, `.next`, `desktop/dist`, `desktop/build`
- [ ] Commit a clean baseline before restructuring

## Phase 1 — Set up workspace skeleton

- [ ] Create root `package.json` with `"workspaces": ["packages/*", "landing"]`
- [ ] Create `packages/` directory
- [ ] Decide package manager: npm workspaces (simplest, already using npm)

## Phase 2 — Extract the engine package

- [ ] Move `src/engine/` → `packages/engine/src/`
- [ ] Add `packages/engine/package.json` (name: `@zyva/engine`, type: module)
- [ ] Add `packages/engine/tsconfig.json`
- [ ] Export a clean public API via `packages/engine/src/index.ts`
      (orchestrator, patch, retrieval, security, observability, providers, config, tee)

## Phase 3 — Move cloud app

- [ ] Move remaining `src/` (app, components, store, App.tsx) → `packages/cloud/`
- [ ] Move `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`,
      `playwright.config.ts`, `next-env.d.ts` → `packages/cloud/`
- [ ] Move `package.json` deps → `packages/cloud/package.json`, add `"@zyva/engine": "*"`
- [ ] Replace all `@/engine/...` imports with `@zyva/engine` (7 files)
- [ ] Update `tsconfig.json` paths so `@/*` points to cloud src, `@zyva/engine` resolves to the package
- [ ] Move `scripts/` (test scripts) → `packages/cloud/scripts/`

## Phase 4 — Move desktop app

- [ ] Move `desktop/` → `packages/desktop/`
- [ ] Update `electron-builder` config: `extraResources.from` →
      `../cloud/.next/standalone` (path changes after move)
- [ ] Update `prepackage.mjs` paths
- [ ] Verify build output location still works

## Phase 5 — Wire up scripts at root

- [ ] Root `package.json` scripts:
      - `dev` → run cloud dev
      - `build` → build engine then cloud
      - `build:desktop` → build cloud standalone then package desktop
      - `lint` → lint all packages
- [ ] Ensure `@zyva/engine` builds before cloud (workspace dependency order)

## Phase 6 — Verify everything

- [ ] `npm install` at root resolves workspaces, no broken links
- [ ] `npm run build` (cloud) succeeds, no missing engine imports
- [ ] `npm run dev` works, AI chat + agent endpoints functional
- [ ] Desktop packaging produces a working build
- [ ] Existing test scripts still run
- [ ] Landing page unaffected (still deploys to VPS the same way)

---

## Risks & notes

- **Biggest risk:** broken imports after moving engine. Mitigate by doing Phase 2-3
  in one focused session and running the build immediately.
- **Next.js standalone + workspace:** Next must trace the `@zyva/engine` package into
  the standalone output. May need `output: "standalone"` + `outputFileTracingRoot`
  set to the monorepo root in `next.config.ts`.
- **Desktop path coupling:** desktop depends on the cloud build output path — update
  carefully in Phase 4.
- **Do NOT** change engine logic during the move. Pure relocation + import rewrites only.
  Behavior changes come in a separate PR.

## Suggested order of PRs

1. PR #1 — Phase 0 cleanup
2. PR #2 — Phase 1-3 (workspace + engine + cloud) — the big one, test thoroughly
3. PR #3 — Phase 4-5 (desktop + root scripts)
4. PR #4 — docs update (README structure, this plan marked done)

## Out of scope (later)

- E2B integration for cloud sandbox execution
- WebContainer preview wiring
- Auto-injecting `templates/*` into new user projects
- 0G Storage persistence layer
