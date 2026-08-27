import { eq } from "drizzle-orm";
import {
  runTimeLimitMs,
  compileTimeoutMs as defaultCompileTimeoutMs,
  traceMaxStepsDefault as defaultTraceMaxSteps,
} from "./cpp-runner";
import { problems as builtinProblems, type Problem as PublicProblem } from "./problems";

// Public wire shape: identical to the OpenAPI `Problem` schema (limits are
// intentionally NOT exposed). See lib/api-spec/openapi.yaml.
export type { PublicProblem };

// Internal shape used by the judge/trace routes: a problem plus its resource
// limits. When a problem has no explicit limit (DB NULL or in-memory fixture)
// the env-driven default from cpp-runner is used.
export type ProblemWithLimits = PublicProblem & {
  limits: { timeLimitMs: number; compileTimeoutMs: number; maxTraceSteps: number };
};

type DbModule = {
  db: { select: (...args: any[]) => any };
  problemsTable: {
    id: any; title: any; difficulty: any; description: any; starterCode: any;
    testCases: any; timeLimitMs: any; compileTimeoutMs: any; maxTraceSteps: any;
  };
};

// DB is loaded lazily and only when DATABASE_URL is set, so a server with no
// DB configured never touches pg nor hits the throw in @workspace/db/index.ts.
let dbModulePromise: Promise<DbModule | null> | null = null;
async function loadDb(): Promise<DbModule | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!dbModulePromise) {
    dbModulePromise = import("@workspace/db")
      .then((mod) => mod as unknown as DbModule)
      .catch((error) => {
        console.warn(`[problem-repo] DB unavailable, using in-memory problems: ${String((error as Error)?.message ?? error)}`);
        return null;
      });
  }
  return dbModulePromise;
}

const envDefaults = {
  timeLimitMs: runTimeLimitMs,
  compileTimeoutMs: defaultCompileTimeoutMs,
  maxTraceSteps: defaultTraceMaxSteps,
};

function rowToPublic(row: {
  id: string; title: string; difficulty: string; description: string; starterCode: string;
  testCases: { id: string; input: string; expectedOutput: string }[];
}): PublicProblem {
  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty as PublicProblem["difficulty"],
    description: row.description,
    starterCode: row.starterCode,
    testCases: row.testCases,
  };
}

function defaultLimits(): ProblemWithLimits["limits"] {
  return { ...envDefaults };
}

function builtinToPublic(id: string): ProblemWithLimits | null {
  const p = builtinProblems.find((item) => item.id === id);
  return p ? { ...p, limits: defaultLimits() } : null;
}

function withLimits(row: {
  id: string; title: string; difficulty: string; description: string; starterCode: string;
  testCases: { id: string; input: string; expectedOutput: string }[];
  timeLimitMs: number | null; compileTimeoutMs: number | null; maxTraceSteps: number | null;
}): ProblemWithLimits {
  return {
    ...rowToPublic(row),
    limits: {
      timeLimitMs: row.timeLimitMs ?? runTimeLimitMs,
      compileTimeoutMs: row.compileTimeoutMs ?? defaultCompileTimeoutMs,
      maxTraceSteps: row.maxTraceSteps ?? defaultTraceMaxSteps,
    },
  };
}

export async function listProblems(): Promise<PublicProblem[]> {
  const db = await loadDb();
  if (!db) return builtinProblems;
  try {
    const rows = await db.db.select().from(db.problemsTable);
    return (rows as any[]).map(rowToPublic);
  } catch (error) {
    console.warn(`[problem-repo] DB read failed, using in-memory problems: ${String((error as Error)?.message ?? error)}`);
    return builtinProblems;
  }
}

export async function getProblem(id: string): Promise<ProblemWithLimits | null> {
  const db = await loadDb();
  if (!db) return builtinToPublic(id);
  try {
    const rows = await db.db.select().from(db.problemsTable).where(eq(db.problemsTable.id, id));
    const row = (rows as any[])[0];
    return row ? withLimits(row) : null;
  } catch (error) {
    console.warn(`[problem-repo] DB read failed for "${id}", using in-memory: ${String((error as Error)?.message ?? error)}`);
    return builtinToPublic(id);
  }
}
