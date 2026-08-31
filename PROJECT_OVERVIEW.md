# PROJECT_OVERVIEW — CP Judge & Visual Tracer

> Regenerated from the actual source on branch `main`. Every claim below was re-verified against the current code during this pass; items that contradicted the previous overview are flagged "Changed since last overview".

## 1. What this project is

A web workbench for competitive programmers that **compiles and judges C++17 solutions** against built-in test cases, and **captures a real GDB-driven execution trace** (source line, locals, call stack, and data-structure contents per step) that is replayed in a browser-based player. Problems and traces persist to PostgreSQL via Drizzle ORM when `DATABASE_URL` is set, with automatic in-memory fallbacks otherwise. All user code execution — compile, judge, raw run, and trace — happens inside a Docker sandbox.

## 2. Architecture

`pnpm` workspace monorepo. **Changed since last overview:** the workspace packages moved from `artifacts/*` + `lib/*` (repo root) to `packages/artifacts/*` + `packages/lib/*` (see `pnpm-workspace.yaml`). The repo now also contains a separate, non-core `packages/artifacts/mockup-sandbox` (a UI-preview experiment) that is **not** part of the judge/tracer flow.

| Piece | Location | Notes |
|---|---|---|
| **Frontend** | `packages/artifacts/cp-judge-tracer/src/` | React 19 + Vite 7 SPA. Pages: `pages/home.tsx` (Workbench: problem shelf, code editor, judge/trace controls, raw-output panel), `pages/trace.tsx` (Trace Player). Shell `components/cockpit-shell.tsx`. Routing via wouter (`App.tsx`: `/`, `/trace`, `/trace/:traceId`, 404). |
| **Backend API** | `packages/artifacts/api-server/src/` | Express 5 app. Entry `index.ts` (requires `PORT`), assembly `app.ts`, routes `routes/{health,problems,judge,trace,run}.ts`, execution engine `lib/cpp-runner.ts`, repos `lib/problem-repo.ts` / `lib/trace-repo.ts`, `lib/problems.ts` (built-in catalog), `lib/logger.ts`, `middlewares/{error-handler,job-queue}.ts`. |
| **API contract** | `packages/lib/api-spec/openapi.yaml` | OpenAPI 3.1 — source of truth for codegen. |
| **Generated React client** | `packages/lib/api-client-react/src/generated/` (+ `custom-fetch.ts`) | Orval-generated react-query hooks (`useListProblems`, `useGetProblem`, `useCreateSubmission`, `useCreateTrace`, `useGetTrace`). |
| **Generated Zod schemas** | `packages/lib/api-zod/src/generated/` | Orval-generated Zod schemas (`CreateSubmissionBody`, `CreateTraceBody`, `GetTraceParams`, `GetProblemParams`, `TraceResult`, `TraceStep`, `TraceArray`, `ErrorResponse`, …). |
| **Database layer** | `packages/lib/db/` | Drizzle ORM + `pg`. `src/schema/index.ts` defines `problemsTable` and `tracesTable`. Loaded lazily only when `DATABASE_URL` is set. |
| **Tests** | `api-server/src/__tests__/`, `api-server/src/lib/__tests__/`, `api-server/src/middlewares/__tests__/` | Vitest + supertest (≈20 tests). |

**Execution layer lives inside the API server.** `lib/cpp-runner.ts` compiles, runs, and traces user code exclusively inside the `cp-tracer-sandbox` Docker image (`docker/sandbox.Dockerfile`: non-root `sandboxuser` UID/GID 1000, `g++`, `gdb`) with `--network none`, 256 MB memory (`--memory` + `--memory-swap`, no swap escape), 1 CPU, and a 128 pid cap. Docker is a hard requirement — judge/trace/run fail with a structured 503 if the daemon or image is unavailable. **Changed since last overview:** a concurrency limiter (`jobQueue`) now gates expensive endpoints and returns 429 past a queue depth, and a new raw-execution endpoint `POST /api/run` (`routes/run.ts`) backs the Workbench "Run once" panel.

## 3. Tech stack

- **Runtime**: Node.js 24, TypeScript ~5.9.3
- **Package manager**: pnpm, with `minimumReleaseAge: 1440` supply-chain guard (`pnpm-workspace.yaml`).
- **Backend**: `express ^5.2.1`, `cors ^2.8.6`, `pino ^9.14.0` + `pino-http ^10.5.0`, esbuild `0.27.3` bundling (build via `build.mjs`).
- **Testing**: `vitest ^4.1.11`, `supertest ^7.2.2`.
- **Validation**: Zod `^3.25.76` (via `@workspace/api-zod`), consumed directly by routes.
- **Toolchain binaries (in container only)**: `g++ -std=c++17 -g -O0 -fno-omit-frame-pointer`, `gdb --interpreter=mi2`.
- **Frontend**: React 19.1.0, Vite ^7.3.2, Tailwind CSS ^4.1.14 (`@tailwindcss/vite`), TanStack Query ^5.90.21, wouter ^3.3.5, lucide-react, radix-ui component set, framer-motion, `@uiw/react-codemirror` + `@codemirror/lang-cpp` (editor), `sonner`.
- **Data layer**: `drizzle-orm ^0.45.2`, `pg ^8.22.0`, drizzle-zod.
- **Codegen**: Orval v8 (`packages/lib/api-spec/orval.config.ts`).

## 4. How execution flows, end to end

### A. Judge submission (Run judge)
1. `handleJudge()` in `pages/home.tsx` calls `useCreateSubmission().mutate({ data: { code, problemId } })`.
2. `POST /api/submissions` → `routes/judge.ts`. Body validated with `CreateSubmissionBody.parse(req.body)` (Zod).
3. Problem looked up via `getProblem(problemId)` (`problem-repo.ts`): DB if `DATABASE_URL` set, else built-in fixtures.
4. **Compiled once** via `compileSubmission(code)` inside Docker. **Confirmed unchanged** — the compiled binary is then run per test case via `runProgram(program, test.input, problem.limits.timeLimitMs)`; `runtimeMs` excludes compile time.
5. Per-test verdict (AC / WA / TLE / RE) computed in `judge.ts`; **CE is a normal 200** with `verdict:"CE"` + `compileError` (not an HTTP error). Results aggregated → `SubmissionResult`.

### B. Trace request (Visualize execution & Share)
1. `handleTrace()` in `home.tsx` calls `useCreateTrace().mutate({ data: { code, input, problemId } })` → `POST /api/trace`.
2. `routes/trace.ts` validates `CreateTraceBody`, runs `traceWithGdb(code, input)`, and persists via `saveTrace(...)`. If `problemId` was supplied and resolves, `problemId`/`problemName` are stored on the saved trace (so a shared link shows the problem even without in-session navigation state).
3. `traceWithGdb` runs an MI session in Docker:
   - Sets a breakpoint on `main`, runs with stdin redirected (`run < /work/stdin.txt`).
   - Dispatches MI records through token-keyed resolvers.
   - **Static source analysis** (`computeFunctionStarts`, `mainSpan`) drives two gating passes per local/data-structure (see §6).
   - Containers expanded without libstdc++ Python pretty-printers: vectors via direct `_M_start/_M_finish` layout arithmetic; `std::array` via `_M_elems` expressions; map/set/stack/queue via pretty-printed string parsing; structs flattened to dotted locals.
   - Library-internal stops are popped out with `-exec-finish` (budgeted at 400 foreign stops); the trace ends at `main`'s closing brace (or truncates at `TRACE_MAX_STEPS`, default 2000, env-overridable) to avoid post-destruction garbage.
4. Frontend navigates to `/trace/:traceId`; `pages/trace.tsx` fetches via `useGetTrace(traceId)` or, when no `traceId`, reads `sessionStorage["cp-trace-result"]`. A "Share trace" button copies the direct URL.

### C. Raw single-shot run (Run once)
1. `handleRunOnce()` in `home.tsx` does a raw `fetch("/api/run", …)` with `{ code, input }`.
2. `routes/run.ts` returns raw `{ stdout, stderr, exitCode, runtimeMs, timedOut, signal, compileError }` — no verdict. **Changed since last overview:** this endpoint now has its own structured error handling (400 for empty code; 503/500 when the sandbox is unavailable) but does **not** use Zod and does **not** route through the central `errorHandler`.

### Sandboxing layer (all paths)
`requireSandbox()` verifies `docker info` then `docker image inspect cp-tracer-sandbox:latest`, building it from `docker/sandbox.Dockerfile` if missing (cache reset after each call so image removal is re-detected). `dockerRunArgs()` applies the full isolation set on every container. **User code never executes on the bare host** (compile, run, and GDB sessions all run under `docker run`).

## 5. Data models / API contracts

All paths mounted under `/api` (`app.ts`). Schemas in `packages/lib/api-spec/openapi.yaml`.

### Endpoints

| Method & Path | Handler | Request | Response |
|---|---|---|---|
| `GET /api/healthz` | `routes/health.ts` | — | `{ status: "ok" }` |
| `GET /api/problems` | `routes/problems.ts` | — | `Problem[]` (no `limits` field) |
| `GET /api/problems/:problemId` | `routes/problems.ts` | path param | `Problem` or `404 {error}` |
| `POST /api/submissions` | `routes/judge.ts` | `SubmissionInput` | `SubmissionResult` (CE is a 200) |
| `POST /api/trace` | `routes/trace.ts` | `TraceInput` | `TraceResult` |
| `GET /api/trace/:traceId` | `routes/trace.ts` | path param | `TraceResult` or `404 {error}` |
| `POST /api/run` | `routes/run.ts` | `{ code, input }` (loose) | raw run result |

Non-2xx responses use a consistent envelope (Zod/body-parse → `400`, oversized body → `413`, sandbox down → `503`, capacity → `429`, unknown → `500`) with shape `{ error: string, details?: { path, message }[] }` (see `ErrorResponse`).

### Key shapes (`openapi.yaml`)
- `Problem`: `{ id, title, difficulty: "Easy"|"Medium"|"Hard", description, starterCode, testCases: [{id,input,expectedOutput}] }`
- `SubmissionInput`: `{ code: minLength 1, problemId: minLength 1 }` (verdicts: AC/WA/TLE/RE/CE).
- `TraceInput`: `{ code: minLength 1, input, problemId? }`.
- `TraceStep`: `{ step, line, function, locals: TraceLocal[], stack: TraceFrame[], arrays: TraceArray[], highlights: {array,index,expr}[] }`. **`highlights` is new since last overview.**
- `TraceArray`: `{ name, type, values: string[], indexable: boolean }`. **`indexable` is new** — true for vector/C-array/string (cells subscripted), false for map/set/stack/queue.
- `TraceResult`: `{ id, trace: TraceStep[], source, truncated, error, problemId: string|null, problemName: string|null, createdAt? }`. **`problemId`/`problemName` are new** and are persisted by `trace-repo.ts` (in-memory map capped at 100, plus optional DB row with `result` JSON containing these fields).

## 6. Current state — what works vs. what's stubbed/broken

| Feature | State | Evidence |
|---|---|---|
| C++ compilation (once per submission; also per raw run and per trace) | ✅ Working | `compileSubmission`/`compileAndRun`/`compileOnly` in `lib/cpp-runner.ts`, all in Docker. |
| Judging / verdicts (AC/WA/TLE/RE/CE) | ✅ Working | `routes/judge.ts`; compile-once architecture; CE returned as 200. |
| Sandboxing | ✅ Working | `dockerRunArgs()` applies `--network none`, 256m mem+swap, 1 CPU, 128 pids, non-root UID/GID mapping; image auto-built if absent. |
| GDB tracing (steps, line, locals, call stack) | ✅ Real, working | `traceWithGdb` token-keyed MI session; `StackPanel`, `LocalsPanel`. |
| Declaration-line visibility (locals + containers) | ✅ Working / improved | `declarationLine()` + `assignmentLine()` + `isVisible()` hide a var/container until its declaration **and** first assignment have executed; **handles shadowing** by gating on the most-recent declaration at/before the current line (not the first). Added since last overview. |
| Container rendering | ✅ Working | Vector/array are indexed (`indexable:true`) with per-cell index labels + highlights; map/set/stack/queue rendered from pretty-printed value (`indexable:false`), no misleading index labels. `ArraysPanel` + `simplifyType()`. |
| Index highlighting | ✅ Working | `captureStep` evaluates `name[idx]` on the current source line (safe expr only) and records `{array,index,expr}`; `ArraysPanel` marks the cell. |
| Frontend playback & sharing | ✅ Working | Step scrubber, play/pause, speed 0.25×–8×, line-change jumps, keyboard shortcuts, direct `/trace/:traceId` route + link copy, `sessionStorage` fallback. |
| Problem name in player | ✅ Working | `text-trace-problem` (`trace.tsx:934`) and `text-source-problem` (`trace.tsx:415`) render `traceResult.problemName`; persisted by `trace-repo`, so reload/shared links resolve it. **Changed since last overview** — now correctly persisted rather than relying on nav state. |
| Database & persistence | ✅ Working | Drizzle schema with lazy load + in-memory fallbacks (`problem-repo`, `trace-repo`). |
| Concurrency limiting | ✅ Working | `jobQueue` caps `MAX_CONCURRENT_JOBS` (default 2) with `MAX_QUEUE_DEPTH` (default 8) → 429 past depth. |
| Timeline grouping | ✅ Working | Steps grouped past `GROUP_THRESHOLD = 20` into `CHUNK_SIZE = 5` chunks using the shared `CollapsibleGroup` (also used by the Problem Shelf). **Changed since last overview.** |
| Shared theme preference | ✅ Working | `lib/editor-theme.ts` (`EDITOR_THEME_KEY="cp-editor-theme"`) keeps Workbench editor and Trace Player source view in sync via `localStorage` + `storage` event. |
| `CodeEditor` (CodeMirror 6) | ✅ Working | `components/code-editor.tsx` with `@codemirror/lang-cpp`, custom dark/light themes, line numbers, bracket matching, close-brackets. |

**Nothing is stubbed or broken in the core judge/tracer path.** Known gaps are listed in §7.

## 7. Known issues

- **Top-level typecheck does not cover the artifacts (real gap).** `pnpm run typecheck` runs `tsc --build` (only `packages/lib/{db,api-client-react,api-zod}` via root `tsconfig.json` references) then `pnpm -r --filter "./artifacts/**" --filter "./scripts"`. Those filters match **nothing** under `packages/`, so it prints `No projects matched the filters` and exits — `api-server` and `cp-judge-tracer` are **never typechecked** at the top level. Run them directly (`pnpm --filter @workspace/api-server run typecheck`, `pnpm --filter @workspace/cp-judge-tracer run typecheck`). **Changed since last overview:** this is now a genuine coverage hole, not just a cosmetic message — the workspace rename (`packages/*`) was not reflected in the root typecheck filters.
- **`/api/run` bypasses the central error middleware and Zod.** It does its own 400/503/500 shaping and parses the body manually. This is coherent but inconsistent with the other routes; a thrown error from `compileAndRun` is caught locally rather than by `errorHandler`. Minor loose end.
- **Recursion step-detail (could not reproduce a current gap).** The earlier concern that the tracer "only steps into the first of two recursive calls" (e.g. `fib(n-1)+fib(n-2)`) was re-examined: `traceWithGdb` uses `-exec-step` and continues stepping through the entire program, so after `fib(n-1)` returns it steps into `fib(n-2)`. No code path was found that would skip the second branch. **Recommend a regression test** (see §10) to lock this in, since subtle MI-stepping changes could reintroduce it.
- **No automated tests for the sandbox/tracer core** (see §9). Regressions in declaration-line gating, container parsing, and error mapping have historically been caught only by manual/agent verification.
- **Frontend has no automated tests** at all (no vitest/jest config in `cp-judge-tracer`). All UI behavior is manually verified.

## 8. How to run it locally

Prerequisites: **Node.js 24+, pnpm, Docker** (required for compile/judge/run/trace sandboxes).

```bash
# 1. Install dependencies (workspace is packages/*)
pnpm install

# 2. Run automated backend tests
pnpm --filter @workspace/api-server run test

# 3. Regenerate client & zod schemas if the OpenAPI spec changes
pnpm --filter @workspace/api-spec run codegen

# 4. Start the API server (PORT is required)
PORT=8080 pnpm --filter @workspace/api-server run dev

# 5. In another terminal, start the web app
PORT=21424 BASE_PATH=/ pnpm --filter @workspace/cp-judge-tracer run dev
```

Optional:
```bash
pnpm --filter @workspace/api-server run db:seed   # seed built-in problems to Postgres (needs DATABASE_URL)
pnpm --filter @workspace/api-server run typecheck # typecheck api-server directly
pnpm --filter @workspace/cp-judge-tracer run typecheck # typecheck frontend directly
```

## 9. Test coverage

Backend has **≈20 automated tests** across three files (verified to exist and pass via `vitest run`):
- `src/__tests__/routes.test.ts` — route contracts: `GET /healthz`, `GET /problems` (no `limits` leak), `GET /problems/:id` (200 + 404), `POST /submissions` (400 on invalid body, 404 on unknown problem), `POST /trace` (400 on missing code), `GET /trace/:id` (404 + round-trip save/get).
- `src/lib/__tests__/mi-parser.test.ts` — GDB MI parsers (`miField`, `miObjects`, `miFrames`, `miVariables`, `miChildren`).
- `src/middlewares/__tests__/job-queue.test.ts` — concurrency cap and 429 overflow behavior.

**What is NOT covered by automated tests** (only manually / agent-verified in past fix rounds):
- `cpp-runner.ts` sandbox execution end-to-end (Docker build, `dockerRunArgs` isolation, compile-once, `runProcess` signal mapping).
- `traceWithGdb` correctness: declaration-line + assignment-line gating, shadowing, container expansion (vector layout arithmetic, map/set/stack/queue parsing), highlight computation.
- `error-handler.ts` mapping (400 Zod, 413 too-large, 503 Docker, 500) — only the route-level 400/404 paths are tested; the middleware fallbacks and 413/503 branches are untested.
- `problem-repo`/`trace-repo` DB + in-memory fallback logic.
- The entire frontend (`home.tsx`, `trace.tsx`, `code-editor.tsx`, `collapsible-group.tsx`, theme sync) — **zero** automated UI tests.

The gap between "verified once by an agent" and "covered by a repeatable test" is the single biggest risk for this project: the trickiest, most regression-prone logic (tracer visibility/container handling, sandbox error mapping) has no safety net.

## 10. Recommended Improvements

### Critical
1. **Add automated tests for the tracer core (`traceWithGdb` gating + container rendering).** These are the most subtle, hardest-to-eyeball parts of the codebase and have caused repeated manual-debugging rounds. A fixture-based harness (feed known source + expected visibility/containers per step) would catch declaration-line, shadowing, and container-parsing regressions that are currently invisible to CI.
2. **Add automated tests for `error-handler.ts`.** Verify the 400 (Zod), 413 (oversized body), and 503 (Docker-down) branches actually map to the right status/shapes — only 404/400 route paths are currently covered. A regression in the sandbox-availability path (which fails loudly with 503) is high-impact and untested.
3. **Fix the top-level typecheck filters** (`package.json` root `typecheck` script) so `api-server` and `cp-judge-tracer` are actually checked — change `./artifacts/**` → `./packages/artifacts/**` and `./scripts` → `./packages/scripts`. Until then, type errors in the two most important packages can ship unseen.

### Important
4. **Route `/api/run` through the central `errorHandler` + Zod** for consistency, or at least extract its error shaping into the shared handler, so all endpoints share one error contract.
5. **Add a recursion regression test** (e.g. `fib(n-1)+fib(n-2)`) confirming both recursive branches are captured, to close the open question in §7 and prevent silent reintroduction.
6. **Add at least smoke-level frontend tests** (e.g. a Playwright or vitest+Testing-Library pass) for the Workbench judge flow and the Trace Player step navigation, since the UI has zero automated coverage today.
7. **Make the in-memory trace cache TTL/expiry explicit** rather than relying on `/tmp` transience + a 100-entry cap; shared links currently depend on the process staying alive and the cap not having evicted the id.

### Nice to have
8. **Multi-language tracing** (Python `pdb`/`sys.settrace`, Rust) — scoped earlier, no work started.
9. **User submissions history** persisted table (verdicts + timestamps).
10. **Surface `problemId` in the Trace Player header** as a clickable link back to the Workbench problem, not just the name text.
11. **Configurable `TRUNCATED` UX**: when a trace is truncated at `TRACE_MAX_STEPS`, the player already shows a "trace truncated" badge; consider linking it to a note that deeper steps exist beyond the cap.
