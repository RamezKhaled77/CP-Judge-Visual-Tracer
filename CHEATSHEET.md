# CP Judge & Visual Tracer — Run Cheat Sheet

## What it is
A web workbench for competitive programmers:
- **Judge** C++17 solutions against built-in test cases (AC / WA / TLE / RE / CE).
- **Trace** a GDB MI execution (line, locals, call stack, arrays) and replay it in the browser.
- Judging/tracing runs inside an isolated Docker sandbox (`cp-tracer-sandbox`, g++ + gdb).
- Persists to Postgres/Drizzle **only if `DATABASE_URL` is set** — otherwise falls back to in-memory (no DB setup needed to run).

## Requirements
- **Node.js 20+** (project targets 24; tested here on v20.20.0)
- **pnpm** (tested here on 10.33.0)
- **Docker daemon running** — hard requirement. Judge/trace return 503 if it's down; the sandbox image is auto-built from `packages/artifacts/api-server/docker/sandbox.Dockerfile` the first time if missing.

## First-time setup
```bash
cd /home/ramez/Ramez-Station/Projects/CP-visual-tracer
pnpm install          # installs all workspace packages
```
(Optional) verify the sandbox image exists:
```bash
docker image inspect cp-tracer-sandbox:latest   # missing? → auto-built on first run
```

## Run it (two terminals)

**1) API server** — `PORT` is REQUIRED (throws if missing):
```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```
This builds (`node ./build.mjs`) then starts `node ./dist/index.mjs`.
Listen on `http://localhost:8080`.

**2) Frontend (web app)** — `PORT` and `BASE_PATH` are REQUIRED:
```bash
PORT=21424 BASE_PATH=/ pnpm --filter @workspace/cp-judge-tracer run dev
```
Vite dev server on `http://localhost:21424`. It **proxies `/api/*` → `http://localhost:8080`** (override with `API_ORIGIN` / `VITE_API_ORIGIN`), so you can just open the frontend URL.

## Tip: already-running instance
If `PORT=8080` throws `EADDRINUSE`, an API server for this project is likely already running. Check and re-use it:
```bash
ss -tlnp | grep -E ':8080|:3000'
# pid's cmdline will show node ./dist/index.mjs (api) and vite (frontend)
```

## Verify it works
```bash
# API health (note: path is /healthz, not /health)
curl -s http://localhost:8080/api/healthz        # → {"status":"ok"}

# Problems list
curl -s http://localhost:8080/api/problems        # → JSON array of ~20 problems

# Through the frontend proxy
curl -s http://localhost:21424/api/healthz

# Real end-to-end judge submit (Docker compile, takes a few seconds)
curl -s -X POST http://localhost:8080/api/submissions \
  -H 'Content-Type: application/json' \
  -d '{"problemId":"sum-two","code":"#include <bits/stdc++.h>\nusing namespace std;\n\nint main(){ int a,b; cin>>a>>b; cout<<a+b<<\"\\n\"; }"}'
# → {"verdict":"AC","tests":[{"verdict":"AC"},...]}
```

## API routes (all under /api)
| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | liveness probe |
| GET | `/problems` | list problems |
| POST | `/submissions` | judge a submission `{problemId, code}` |
| POST | `/trace` | create a trace (returns `{id, ...}`) |
| GET | `/trace/:traceId` | fetch a stored trace |

## Frontend routes
| Path | Purpose |
|---|---|
| `/` | Problem shelf + CodeMirror editor + judge controls |
| `/trace/:traceId` | Trace playback player (scrub, speed, keyboard shortcuts) |

## Other useful commands (from repo root)
```bash
pnpm test                        # run the Vitest test suite
pnpm run typecheck               # tsc across all workspace packages
pnpm run build                   # typecheck + bundle everything
pnpm --filter @workspace/api-server run db:seed   # seed problems into Postgres
pnpm --filter @workspace/api-spec run codegen     # regen client/zod after OpenAPI change
```

## Ports & env summary
| Var | Required | Purpose |
|---|---|---|
| `PORT` | ✅ (both) | API listen port / Vite dev port |
| `BASE_PATH` | ✅ (frontend only) | Vite base path (use `/`) |
| `API_ORIGIN` / `VITE_API_ORIGIN` | ❌ | Frontend proxy target (default `http://localhost:8080`) |
| `DATABASE_URL` | ❌ | Enables Postgres/Drizzle persistence (defaults to in-memory) |
| `PRESERVE_MI_LOG` | ❌ | Keep GDB MI debug logs when set to `1` |

## Gotchas
- Kill leftover processes before restarting: `pkill -f 'dist/index.mjs'` and `pkill -f 'vite.*cp-judge-tracer'`, or you'll hit `EADDRINUSE`.
- The `dev` script for the API rebuilds then restarts; if you're iterating, that's fine, just expect the rebuild noise.
- No DB → data resets on restart; set `DATABASE_URL` for persistence.