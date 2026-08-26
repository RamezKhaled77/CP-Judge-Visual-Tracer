# CP Judge & Visual Tracer

An interactive C++ workbench that runs solutions against built-in problems and turns a captured run into a step-by-step learning trace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (only needed for future persistence)

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

- Artifact Vite builds require `PORT` and `BASE_PATH`; workflow runs inject them automatically.
- Regenerate API clients with `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
