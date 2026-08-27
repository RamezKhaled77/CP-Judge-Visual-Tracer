# PROJECT_OVERVIEW — CP Judge & Visual Tracer

> Updated to reflect the codebase state on branch `main`.

## 1. What this project is

A web workbench for competitive programmers that **compiles and judges C++17 solutions** against built-in test cases, and **captures a real GDB-driven execution trace** (source line, locals, call stack at each step) that is replayed in a browser-based playback player. Problem and trace data are persisted in PostgreSQL via Drizzle ORM when `DATABASE_URL` is set, with an automatic in-memory fallback when unconfigured.

## 2. Architecture

The repo is a pnpm workspace monorepo (`pnpm-workspace.yaml`: `artifacts/*`, `lib/*`, `scripts`) with these active pieces:

| Piece | Location | Notes |
|---|---|---|
| **Frontend** | `artifacts/cp-judge-tracer/src/` | React 19 + Vite 7 SPA. Pages: `pages/home.tsx` (problem shelf, code editor, judge controls, results), `pages/trace.tsx` (trace player). Shell: `components/cockpit-shell.tsx`. Routing via wouter (`App.tsx`: `/`, `/trace`, `/trace/:traceId`, 404). |
| **Backend API** | `artifacts/api-server/src/` | Express 5 app. Entry `index.ts` (requires `PORT` env), app assembly `app.ts`, routes in `routes/{health,problems,judge,trace}.ts`, execution logic in `lib/cpp-runner.ts`, problem repo in `lib/problem-repo.ts`, trace repo in `lib/trace-repo.ts`. |
| **API contract** | `lib/api-spec/openapi.yaml` | OpenAPI 3.1 spec — source of truth for generated clients/schemas. |
| **Generated React client** | `lib/api-client-react/src/generated/` (+ `custom-fetch.ts`) | Orval-generated react-query hooks (`useListProblems`, `useGetProblem`, `useCreateSubmission`, `useCreateTrace`, `useGetTrace`). |
| **Generated Zod schemas** | `lib/api-zod/src/generated/` | Orval-generated Zod schemas used by the server routes to validate request bodies and path parameters. |
| **Database layer** | `lib/db/` | Drizzle ORM + `pg`. `src/schema/index.ts` defines `problemsTable` and `tracesTable`. Lazily loaded by `problem-repo.ts` and `trace-repo.ts` when `DATABASE_URL` is set. |
| **Test Suite** | `artifacts/api-server/src/__tests__/`, `lib/__tests__/`, `middlewares/__tests__/` | Automated Vitest suite covering MI parser functions, concurrency job queue, and API route contracts. |

**Execution/trace layer lives inside the API server**: `lib/cpp-runner.ts` compiles, runs, and traces user code exclusively inside the `cp-tracer-sandbox` Docker image (`docker/sandbox.Dockerfile`: non-root, g++, gdb) with `--network none`, 256MB memory (no swap), 1 CPU, and a pid cap of 128. Docker is a hard requirement — both judge and trace fail loudly with 503 if the daemon is unavailable.

## 3. Tech stack

- **Runtime**: Node.js 24, TypeScript ~5.9.3
- **Package manager**: pnpm, supply-chain guard `minimumReleaseAge: 1440`
- **Backend**: `express ^5.2.1`, `cors ^2.8.6`, `pino ^9.14.0` + `pino-http ^10.5.0` logging, esbuild 0.27.3 bundling
- **Testing**: `vitest ^4.1.11`, `supertest ^7.2.2`
- **Validation**: Zod via `@workspace/api-zod`
- **Toolchain binaries (system/container)**: `g++` (flags `-std=c++17 -g -O0 -fno-omit-frame-pointer`), `gdb --interpreter=mi2`
- **Frontend**: React 19.1.0, Vite ^7.3.2, Tailwind CSS ^4.1.14 (`@tailwindcss/vite`), TanStack Query ^5.90.21, wouter ^3.3.5, lucide-react icons, shadcn/radix UI component set, framer-motion
- **Data layer**: drizzle-orm ^0.45.2, drizzle-kit, pg ^8.22.0, drizzle-zod
- **Codegen**: Orval v8.23.0 (`lib/api-spec/orval.config.ts`)

## 4. How execution flows, end to end

### A. Judge submission (Run judge)

1. User clicks **Run judge** → `handleJudge()` in `artifacts/cp-judge-tracer/src/pages/home.tsx` calls `useCreateSubmission().mutate({ data: { code, problemId } })`.
2. Request goes to `POST /api/submissions` → `artifacts/api-server/src/routes/judge.ts`. Body validated with `CreateSubmissionBody.parse(req.body)`.
3. Route looks up the problem via `getProblem(problemId)` in `lib/problem-repo.ts` (Postgres DB with fallback to built-in fixtures).
4. Code is **compiled ONCE** via `compileSubmission(code)` inside the Docker sandbox.
5. The compiled binary is executed per test case via `runProgram(compiled.program, test.input, timeLimitMs)`. `runtimeMs` measures execution time without compilation time included.
6. Per-test verdict computed in `routes/judge.ts` (AC / WA / TLE / RE). Results aggregated and returned as `SubmissionResult`.

### B. Trace request (Visualize execution & Share)

1. User clicks **Visualize execution** → `handleTrace()` in `home.tsx` calls `useCreateTrace().mutate({ data: { code, input } })` → `POST /api/trace`.
2. `routes/trace.ts` validates body, runs `traceWithGdb(code, input)`, and persists the result via `saveTrace(...)` in `lib/trace-repo.ts`.
3. `traceWithGdb` runs an MI session in Docker:
   - Sets breakpoints on `main`, runs with console stdin redirection (`run < /work/stdin.txt`).
   - Dispatches MI records using token-keyed resolvers.
   - Inspects `std::vector` (layout pointer arithmetic), `std::array` (expression reads), C arrays, and flattened struct members.
   - Pops out of library internals via `-exec-finish` and uses a 750ms watchdog for memory expansion.
4. Response is `TraceResult` (includes unique `id` and `createdAt`).
5. Frontend navigates to `/trace/:traceId`. `pages/trace.tsx` fetches the trace via `useGetTrace(traceId)` and provides a "Share trace" button to copy the direct URL.

## 5. Data models / API contracts

All paths mounted under `/api` (`app.ts`). Schemas defined in `lib/api-spec/openapi.yaml`.

### Endpoints

| Method & Path | Handler | Request | Response |
|---|---|---|---|
| `GET /api/healthz` | `routes/health.ts` | — | `{ status: string }` (`"ok"`) |
| `GET /api/problems` | `routes/problems.ts` | — | `Problem[]` |
| `GET /api/problems/:problemId` | `routes/problems.ts` | path param | `Problem` or `404` |
| `POST /api/submissions` | `routes/judge.ts` | `SubmissionInput` | `SubmissionResult` |
| `POST /api/trace` | `routes/trace.ts` | `TraceInput` | `TraceResult` |
| `GET /api/trace/:traceId` | `routes/trace.ts` | path param | `TraceResult` or `404` |

### Shapes

```yaml
Problem:            { id, title, difficulty, description, starterCode: string,
                      testCases: [{ id, input, expectedOutput }] }
SubmissionInput:    { code: string(minLength 1), problemId: string }
TestCaseResult:     { id, verdict, actualOutput, expectedOutput: string,
                      runtimeMs: number, error: string|null }
SubmissionResult:   { verdict, totalRuntimeMs: number,
                      tests: TestCaseResult[], compileError: string|null }
TraceInput:         { code: string(minLength 1), input: string }
TraceLocal:         { name, type, value: string }
TraceFrame:         { function: string, line: number }
TraceArray:         { name, type: string, values: string[] }
TraceStep:          { step: number, line: number, function: string,
                      locals: TraceLocal[], stack: TraceFrame[], arrays: TraceArray[] }
TraceResult:        { id: string, trace: TraceStep[], source: string,
                      truncated: boolean, error: string|null, createdAt?: string }
```

## 6. Current state — what works vs what's stubbed/broken

| Feature | State | Evidence |
|---|---|---|
| C++ compilation | ✅ Working | `compileSubmission` / `compileOnly` in `lib/cpp-runner.ts` inside Docker. |
| Judging / verdicts | ✅ Working | `routes/judge.ts`; compile-once architecture with pure runtime measurement. |
| Sandboxing | ✅ Working | Docker containerization (`cp-tracer-sandbox`), non-root UID/GID mapping, 256MB memory cap, 1 CPU, 128 PID limit, `--network none`. |
| GDB tracing (steps, line, locals) | ✅ Real, working | Token-dispatched MI session, aggregate extraction without python pretty-printers, library step-over. |
| Call stack view | ✅ Working | Real `-stack-list-frames` output per step → `TraceStep.stack` → `StackPanel`. |
| Data-structure (array) view | ✅ Working | Vector layout arithmetic and array element extraction → `ArraysPanel`. |
| Locals view | ✅ Working | Full expansion of scalars and struct/class members (`p.x`). |
| Frontend playback & sharing | ✅ Working | Step scrubbing, play/pause, changed-value highlighting, direct `/trace/:traceId` routing, and link copying. |
| Database & Persistence | ✅ Working | Drizzle schema with hybrid lazy-loading (`problem-repo.ts`, `trace-repo.ts`) and built-in fallback. |
| Test suite | ✅ Working | Automated Vitest suite for MI parsers, middleware, and route contracts. |

## 7. How to run it locally

Prerequisites: **Node.js 24+, pnpm, Docker** (for running compilation/judge/tracer sandboxes).

```bash
# 1. Install dependencies
pnpm install

# 2. Run automated tests
pnpm test

# 3. Regenerate client & zod schemas if OpenAPI spec changes
pnpm --filter @workspace/api-spec run codegen

# 4. Start the API server
PORT=8080 pnpm --filter @workspace/api-server run dev

# 5. In another terminal, start the web app
PORT=21424 BASE_PATH=/ pnpm --filter @workspace/cp-judge-tracer run dev
```

Optional commands:
```bash
pnpm run typecheck                                   # tsc across all workspace packages
pnpm run build                                       # typecheck + bundle everything
pnpm --filter @workspace/api-server run db:seed      # seed built-in problems to Postgres
```

## 8. Remaining Roadmap & Improvements

### Medium Priority (UI & Editor Polish)
1. ~~**Rich Code Editor**: Replace raw `<textarea>` with Monaco Editor or CodeMirror 6 for C++ syntax highlighting, indentation, and bracket pairing.~~ **DONE** — CodeMirror 6 integrated in `components/code-editor.tsx` with `@codemirror/lang-cpp`, custom dark theme palette, auto-closing brackets, syntax highlighting, and line numbers.
2. ~~**Player Speed & Shortcuts**: Add playback speed options (0.5x, 1x, 2x, 5x) and keyboard shortcuts (Space, Arrow keys, Home/End, R) in `trace.tsx`.~~ **DONE** — Playback speed selector (`0.25x` to `8x`), timeline scrubber bar, step search/filter in `StepRail`, and full keyboard navigation (<kbd>Space</kbd>, <kbd>←</kbd>/<kbd>→</kbd>, <kbd>Home</kbd>/<kbd>End</kbd>, <kbd>R</kbd>, <kbd>1-5</kbd>, <kbd>?</kbd> shortcuts modal).
3. ~~**Problem Catalog & Schema**: Expand problem bank and refine `difficulty` to enum `[Easy, Medium, Hard]`.~~ **DONE** — 20 problems across Easy (7), Medium (9), Hard (4); `difficulty` is now a strict enum in `openapi.yaml`, generated as `ProblemDifficulty` const-object in `@workspace/api-client-react`; colour-coded badges in ProblemShelf.

### Scope for Later
4. **User Submissions History**: Persist user submissions table with verdicts and timestamps.
5. **Multi-language Tracing**: Support Python 3 (`pdb`/`sys.settrace`) and Rust.

