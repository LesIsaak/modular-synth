# CLAUDE.md

Guidance for Claude (and any AI agent) working in this Replit project. Read this first — it explains the environment, the repo layout, and the rules that keep things from breaking.

---

## 1. What this project is

A **pnpm monorepo** running on **Replit** (NixOS Linux container). It hosts multiple deployable "artifacts" behind a single path-based reverse proxy.

Current artifacts:

| Artifact | Path | Kind | What it is |
|----------|------|------|------------|
| `artifacts/modular-synth` | `/` | web (React + Vite) | "OrangeCastle MODULAR Synthesizer" — a browser-based modular synth using the Web Audio API. The flagship app. |
| `artifacts/api-server` | `/api` | api (Express 5) | Backend API server. |
| `artifacts/mockup-sandbox` | `/__mockup` | design | Vite preview server for prototyping UI components in isolation (used by the canvas). |

Shared libraries live in `lib/`:
- `lib/db` — PostgreSQL schema + Drizzle ORM (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec, source of truth for the API contract (`@workspace/api-spec`)
- `lib/api-zod` — generated Zod schemas (`@workspace/api-zod`)
- `lib/api-client-react` — generated React Query hooks (`@workspace/api-client-react`)

---

## 2. The Replit environment — critical facts

- **Linux container on NixOS.** No Docker, no virtual environments, no containerization.
- **Package management is NOT manual.** Do not hand-edit lockfiles. Use pnpm. The repo enforces pnpm via a `preinstall` hook — npm/yarn will be rejected.
- **Apps run via Replit "workflows", not by you running `pnpm dev`.** Each artifact has a workflow that injects required env vars (`PORT`, `BASE_PATH`). Running `pnpm dev` at the root will fail by design.
- **Secrets are managed by Replit.** Never print, echo, or commit secret values. Available secrets in this project: `GITHUB_PAT`, `SESSION_SECRET`. Required env: `DATABASE_URL`.
- **Checkpoints are automatic.** Replit auto-commits the codebase, chat, and DB at the end of each task. You generally don't run `git commit` yourself — it's blocked for the main agent.

### Reverse proxy & routing
A global proxy routes traffic by path using each artifact's `.replit-artifact/artifact.toml`.

- For ad-hoc requests (curl), **always go through the proxy at `localhost:80`**, never a service port directly.
  - Correct: `curl localhost:80/api/healthz`
  - Wrong: `curl localhost:8080/api/healthz`
- Paths are **not** rewritten — each service must handle its own full base path.
- In app code, prefer relative URLs. In the browser, use the artifact's base path prefix (e.g. `import.meta.env.BASE_URL` in Vite). Do **not** use root-relative `/api/...` from a sub-path app — it escapes the prefix.
- Do **not** add Vite proxy configs or custom base URLs to reach other services; the proxy already handles it.
- For external/published access, domains are in `$REPLIT_DOMAINS` (HTTPS, comma-separated). Dev domain is `$REPLIT_DEV_DOMAIN`.

---

## 3. Common commands

Run these from the workspace root (`/home/runner/workspace`).

```bash
# Full typecheck across every package (canonical correctness check)
pnpm run typecheck

# Typecheck a single artifact (faster while iterating)
pnpm --filter @workspace/modular-synth run typecheck

# Build libs only (composite project references)
pnpm run typecheck:libs

# Regenerate API hooks + Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (DEV ONLY)
pnpm --filter @workspace/db run push
```

**Verify artifacts with `typecheck`, not `build`.** `build` needs the workflow-provided `PORT`/`BASE_PATH` and can fail from a plain shell even when the code is correct.

**To run/restart an app, use the workflow** (restart the relevant workflow) or just view the preview pane — do not shell out to `pnpm dev`.

---

## 4. TypeScript / monorepo conventions

- `lib/*` packages are **composite** and emit declarations via `tsc --build`. New libs must add `composite`, `declarationMap`, `emitDeclarationOnly` and be listed in the root `tsconfig.json` `references`.
- `artifacts/*` and `scripts` are **leaf** packages, typechecked with `tsc --noEmit`. They must **not** import from each other — share code via a `lib/*` package instead. Do **not** add them to root `tsconfig.json`.
- When one lib imports another, declare it in that lib's `references`.
- If the editor/LSP and the CLI disagree on types, **trust `pnpm run typecheck`**.
- Workspace package names use the `@workspace/` prefix. Each package declares its own deps. Use `"catalog:"` for deps already pinned in `pnpm-workspace.yaml`.
- devDeps vs deps: static/client-only artifacts → everything in `devDependencies`; server artifacts → runtime imports in `dependencies`, build tools/`@types/*` in `devDependencies`.

## 5. API contract workflow (backend-backed work)

Contract-first. Define the contract in the **OpenAPI spec** (`lib/api-spec`) first, then run codegen. The server validates inputs/outputs with the generated **Zod** schemas; clients use the generated **React Query hooks**. Do not change the OpenAPI `info.title` — it controls generated filenames.

## 6. Logging

**Never use `console.log` in server code.** Use `req.log` inside route handlers and the singleton `logger` elsewhere.

---

## 7. The modular-synth app (the main product)

Browser-based modular synth. React + Vite + TypeScript + Tailwind v4 + Web Audio API.

Key files:
- `artifacts/modular-synth/src/audioEngine.ts` — large (~4300 lines) Web Audio engine. One big `switch (typeId)` builds each module; every module returns `{ outputs, inputs, setParam, destroy, ... }`. `connectAudioPorts`/`disconnectAudioPorts` live at the bottom.
- `artifacts/modular-synth/src/moduleDefinitions.ts` — UI definitions (knobs, selectors, ports) for every module type. Must stay in sync with `audioEngine.ts` (a knob/port defined here but unread in the engine is a "dead control" bug).
- `artifacts/modular-synth/src/pages/synth-app.tsx` — main React component: module/cable state, patch save/load, MIDI, keyboard, undo/redo.

### Web Audio gotchas learned the hard way (Chrome)
1. `GainNode.gain = 0` triggers silence-propagation pruning — use `0.001` to keep an analysis path alive.
2. `BiquadFilter` lowpass below ~10 Hz hits coefficient underflow.
3. Oscillator phase can't be set via a past-timestamp `start()` (Chrome ignores it) — bake phase into a `PeriodicWave` via Fourier coefficients.
4. `AnalyserNode` processes audio even with no connection to `destination` — useful for CV polling and for params that aren't `AudioParam`s (e.g. `WaveShaper.curve`).
5. **Main-thread timer starvation:** tight `setInterval` polling (≤6 ms) on the main thread starves the sequencer/clock `setTimeout` scheduling → global audio latency across *all* modules. Keep CV/AnalyserNode polling at ~16 ms. Make decay/envelope coefficients poll-interval-independent: `coeff = exp(-(POLL_MS/1000) / max(0.001, τseconds))`.

> More durable, non-obvious lessons live in `.agents/memory/` — read `MEMORY.md` (the index) before deep work.

---

## 8. Skills & memory (Replit-specific tooling)

- **Skills** live under `.local/skills/` (and `.local/secondary_skills/`). Each has a `SKILL.md` with authoritative instructions for a task type (deployment, database, integrations, environment-secrets, artifacts, workflows, etc.). Read the relevant `SKILL.md` before doing that kind of work — don't guess.
- **Memory** lives in `.agents/memory/`. `MEMORY.md` is an always-loaded index of one-line pointers to topic files. Record durable, non-obvious lessons there; never store secrets or anything derivable from the code.
- Before asking the user for any API key or third-party credential, check whether a **Replit integration** exists first (see the `integrations` skill). This project already has the **GitHub** integration installed.

---

## 9. Git / publishing

- Remote: `github.com/LesIsaak/modular-synth.git`.
- The main agent's `git commit` and other destructive git ops are blocked (Replit auto-commits via checkpoints). To push to GitHub:
  ```bash
  git push "https://x-access-token:${GITHUB_PAT}@github.com/LesIsaak/modular-synth.git" main
  ```
  Use `GITHUB_PAT` in a bash shell (it's a real env var there) — it is **not** available in the JS code-execution sandbox.
- Publishing/deployment is handled by Replit (build, hosting, TLS, health checks). Use the deployment skill / Publish flow; don't try to hand-roll it.

---

## 10. Quick do / don't

**Do**
- Run `pnpm run typecheck` before considering work done.
- Keep `moduleDefinitions.ts` and `audioEngine.ts` in sync.
- Read the matching `SKILL.md` and `.agents/memory/MEMORY.md` before non-trivial work.
- Go through `localhost:80` for curl; use base-path-prefixed URLs in app code.
- Batch independent tool calls / edits.

**Don't**
- Run `pnpm dev` at the root, or hard-code ports (read `PORT`).
- Print, log, or commit secrets.
- Use `console.log` in server code.
- Make leaf artifacts import each other (use a `lib/*`).
- Edit `.replit` / `artifact.toml` by hand (use the artifacts/workflows skills).
