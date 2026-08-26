# CP Judge & Visual Tracer

An interactive C++ workbench that runs solutions against built-in problems and turns a captured run into a step-by-step learning trace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run db:seed` — seed the built-in problems (and their limits) into Postgres
- Required env: `DATABASE_URL` — Postgres connection string. The DB is **optional**: judge/trace/problem routes read from Postgres when `DATABASE_URL` is set, and fall back to the in-memory fixtures (`lib/problems.ts`) with env-default limits otherwise. Run `db:push` then `db:seed` once to use the DB.
- Optional limit env vars (defaults in parentheses): `RUN_TIME_LIMIT_MS` (2200), `COMPILE_TIMEOUT_MS` (10000), `TRACE_MAX_STEPS` (2000), `GDB_HARD_TIMEOUT_MS` (10000). Per-problem overrides are read from the `problems` table's `time_limit_ms` / `compile_timeout_ms` / `max_trace_steps` columns when the DB is in use.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cp-judge-tracer/src/pages/home.tsx` — editor, problem shelf, judge controls, and verdicts
- `artifacts/cp-judge-tracer/src/pages/trace.tsx` — local trace playback UI
- `artifacts/cp-judge-tracer/src/index.css` — shared visual theme and utility styles
- `artifacts/api-server/src/lib/problems.ts` — built-in problem fixtures
- `artifacts/api-server/src/lib/cpp-runner.ts` — real g++ compile/run process boundary
- `artifacts/api-server/src/routes/` — health, problems, judge, and trace endpoints
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and schemas

## Architecture decisions

- The first MVP keeps built-in problem data in memory so the editor is immediately usable without a database setup step.
- Judge execution uses debug-friendly compiler flags (`-g -O0 -fno-omit-frame-pointer`) and bounds subprocess output/time.
- Trace payloads are captured server-side by an interactive GDB MI session and played locally in the browser for instant scrubbing.

## Product

Users can select a built-in C++ problem, edit the starter solution, run it against multiple cases, inspect verdicts and compiler/runtime feedback, and open a captured execution trace with source highlighting, timeline controls, locals, call stack, and data-structure panels.

## User preferences

The user prefers the warm cream, dark frame, bold outline, coral/teal/blue reference theme shown in the attached UI references.

## Gotchas

- **Docker is required** to run judge submissions and execution traces: user code (compile, run, and the GDB session) executes inside the `cp-tracer-sandbox` container built from `artifacts/api-server/docker/sandbox.Dockerfile`. Install Docker and have the daemon running locally, or judge/trace requests fail with "Docker is required to run submissions but is not available" instead of falling back to unsandboxed execution.
- **Artifact Vite builds require `PORT` and `BASE_PATH`; workflow runs inject them automatically.**
- **`VITE_API_URL` is required for production builds served from a different origin than the API.** The Vite dev server already proxies `/api/*` to the API (`http://localhost:8080` by default, or `API_ORIGIN`/`VITE_API_ORIGIN`), so local `pnpm dev` works with no extra config. A production `vite build` produces static files with no proxy, so set `VITE_API_URL=<api origin>` at build time to make the generated client target the API origin. Leave it unset for same-origin deployments (frontend and API on the same origin).
- Regenerate API clients with `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
