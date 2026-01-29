# Copilot instructions (ValeDesk)

## Build / run / test / lint

### Prereqs
- Node.js 20+
- Rust 1.74+
- Tauri CLI (`cargo tauri`)

### Install deps
- `npm ci` (preferred; Makefile expects `package-lock.json`)
- If native deps break after Node version changes: `npm rebuild better-sqlite3`

### Dev (recommended)
- `make dev` — starts Vite + Tauri + Node sidecar (sidecar is transpiled first)
- `make dev-ui` — Vite dev server only
- `make dev-tauri` — Tauri only (uses `VALERA_SIDECAR_ENTRY=dist-sidecar/sidecar/main.js`)
- `make dev-sidecar` — transpile sidecar + setup scripts

### Build
- `npm run build` — TypeScript build + Vite build (outputs `dist-react/`)
- `make bundle` — full production bundle (UI build + sidecar binary + `cargo tauri build`)

### Lint / typecheck
- `npm run lint`
- `npm run type-check`

### Tests (Vitest)
- `npm run test`
- Single file: `npm run test -- tests/<name>.spec.ts`
- Single test by name: `npm run test -- -t "test name or regex"`

## High-level architecture

ValeDesk is a **Tauri (Rust) desktop app** with a **React (Vite) UI** and a **Node.js sidecar** process that runs the LLM loop and tool execution.

### Data flow (big picture)
1. **React UI** (`src/ui/`) sends user actions to Rust via Tauri IPC.
2. **Rust backend** (`src-tauri/src/main.rs`) persists state in **SQLite** and forwards events to the sidecar over **stdin**.
3. **Node sidecar** (`src/sidecar/main.ts`) runs the agent loop (OpenAI-compatible by default) and streams `ServerEvent`s back to Rust over **stdout**.
4. Rust emits the JSON payload to the WebView as `server-event`, and the React UI updates.

### Persistence split (important)
- **Rust owns persistence** (SQLite `sessions.db`, todos, scheduled tasks, settings).
- **Sidecar uses an in-memory session store** (`src/sidecar/session-store-memory.ts`) and syncs changes back to Rust via `session.sync` events.

### Where the “agent” lives
- Agent loop: `src/agent/libs/runner-openai.ts` (OpenAI-compatible) and `src/agent/libs/runner.ts` (Claude Agent SDK for `claude-code::...` models)
- Tool dispatch: `src/agent/libs/tools-executor.ts`
- Tool implementations: `src/agent/libs/tools/`
- System prompt template: `src/agent/libs/prompts/system.txt`

## Key repo conventions (non-obvious)

### Tool naming + registration
- Tool names are **`snake_case`** and follow **`verb_noun`** (e.g. `read_file`, `search_web`).
- A tool is typically:
  1) Defined as an OpenAI function-calling tool in `src/agent/libs/tools/<tool>.ts`
  2) Registered in `src/agent/libs/tools/index.ts` (definitions + executor map)

### System prompt is dynamically assembled
- Tools are **not hardcoded** into the system prompt.
- `src/agent/libs/prompts/system.txt` is a template; runtime substitution happens in `prompt-loader.ts` and the tool summary is generated from active tool definitions.

### Tool permission model matters
- The agent supports permission modes (`ask` vs `default`); some tools (notably shell + file writes/edits) require confirmation.
- If adding a tool that can mutate state, ensure it’s handled consistently by the permission gating in the executor.

### Vite port env var
- `vite.config.ts` reads `PORT` from env; keep the variable name exactly `PORT` in `.env`.

### Naming/style conventions used across the repo
- TS files tend to be `kebab-case.ts`; React components are `PascalCase.tsx`.
- Prefer `interface` for object shapes and `type` for unions (per `CURSOR.md` / `.cursor/rules/development.md`).

### Where to look for project-specific rules
- `CURSOR.md` and `.cursor/rules/*` are the authoritative, repo-specific development and architecture notes.
