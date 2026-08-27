import { pgTable, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

// Built-in problems are persisted here so they can be edited / extended at
// runtime and so each problem can carry its own resource limits (item #4).
// The API keeps limits internal-only (see lib/problem-repo.ts); the public
// Problem shape exposed over the wire does NOT include the limit columns.
export const problemsTable = pgTable("problems", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull(),
  description: text("description").notNull(),
  starterCode: text("starter_code").notNull(),
  testCases: jsonb("test_cases")
    .$type<{ id: string; input: string; expectedOutput: string }[]>()
    .notNull(),
  // Per-problem limits are optional; a NULL means "use the env default".
  timeLimitMs: integer("time_limit_ms"),
  compileTimeoutMs: integer("compile_timeout_ms"),
  maxTraceSteps: integer("max_trace_steps"),
});

export type InsertProblem = typeof problemsTable.$inferInsert;
export type Problem = typeof problemsTable.$inferSelect;

export const tracesTable = pgTable("traces", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  input: text("input").notNull(),
  result: jsonb("result")
    .$type<{
      trace: {
        step: number;
        line: number;
        function: string;
        locals: { name: string; type: string; value: string }[];
        stack: { function: string; line: number }[];
        arrays: { name: string; type: string; values: string[] }[];
      }[];
      truncated: boolean;
      error: string | null;
    }>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertTrace = typeof tracesTable.$inferInsert;
export type TraceRecord = typeof tracesTable.$inferSelect;


