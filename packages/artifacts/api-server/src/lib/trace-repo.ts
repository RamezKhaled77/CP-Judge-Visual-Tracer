import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { TraceResult, TraceStep } from "@workspace/api-zod";

type DbModule = {
  db: {
    select: (...args: any[]) => any;
    insert: (...args: any[]) => any;
  };
  tracesTable: {
    id: any;
    source: any;
    input: any;
    result: any;
    createdAt: any;
  };
};

let dbModulePromise: Promise<DbModule | null> | null = null;
async function loadDb(): Promise<DbModule | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!dbModulePromise) {
    dbModulePromise = import("@workspace/db")
      .then((mod) => mod as unknown as DbModule)
      .catch((error) => {
        console.warn(
          `[trace-repo] DB unavailable, using in-memory traces: ${String((error as Error)?.message ?? error)}`,
        );
        return null;
      });
  }
  return dbModulePromise;
}

// In-memory fallback cache when DB is not configured (capped at 100 recent traces)
const inMemoryTraces = new Map<string, TraceResult>();
const MAX_IN_MEMORY_TRACES = 100;

export async function saveTrace(data: {
  source: string;
  input: string;
  trace: TraceStep[];
  truncated: boolean;
  error: string | null;
}): Promise<TraceResult> {
  const id = `tr_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const traceResult: TraceResult = {
    id,
    source: data.source,
    trace: data.trace,
    truncated: data.truncated,
    error: data.error,
    createdAt,
  };

  // Always store in in-memory map as well
  if (inMemoryTraces.size >= MAX_IN_MEMORY_TRACES) {
    const oldestKey = inMemoryTraces.keys().next().value;
    if (oldestKey) inMemoryTraces.delete(oldestKey);
  }
  inMemoryTraces.set(id, traceResult);

  const db = await loadDb();
  if (db) {
    try {
      await db.db.insert(db.tracesTable).values({
        id,
        source: data.source,
        input: data.input,
        result: {
          trace: data.trace,
          truncated: data.truncated,
          error: data.error,
        },
        createdAt: new Date(),
      });
    } catch (error) {
      console.warn(
        `[trace-repo] Failed to save trace to DB: ${String((error as Error)?.message ?? error)}`,
      );
    }
  }

  return traceResult;
}

export async function getTrace(id: string): Promise<TraceResult | null> {
  // Check in-memory map first for speed
  const cached = inMemoryTraces.get(id);
  if (cached) return cached;

  const db = await loadDb();
  if (!db) return null;

  try {
    const rows = await db.db
      .select()
      .from(db.tracesTable)
      .where(eq(db.tracesTable.id, id));
    const row = (rows as any[])[0];
    if (!row) return null;

    const result = {
      id: row.id,
      source: row.source,
      trace: row.result.trace ?? [],
      truncated: Boolean(row.result.truncated),
      error: row.result.error ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
    inMemoryTraces.set(id, result);
    return result;
  } catch (error) {
    console.warn(
      `[trace-repo] Failed to fetch trace from DB: ${String((error as Error)?.message ?? error)}`,
    );
    return null;
  }
}
