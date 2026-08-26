// DB seed — insert the built-in problems (from lib/problems.ts) into Postgres
// along with their per-problem limits. The limit defaults mirror the env
// defaults in cpp-runner. Requires DATABASE_URL to be set (and, ideally, the
// schema pushed via `pnpm --filter @workspace/db run push`).
//
// Run:  pnpm --filter @workspace/api-server run db:seed
import { problems } from "../lib/problems";
import { runTimeLimitMs, compileTimeoutMs, traceMaxStepsDefault } from "../lib/cpp-runner";

const dbModule = await import("@workspace/db");
const { db, problemsTable } = dbModule;
const { pool } = dbModule;

const now = new Date().toISOString();

async function seed() {
  console.log(`Seeding ${problems.length} problems into ${process.env.DATABASE_URL?.split("@").pop() ?? "db"}...`);
  for (const problem of problems) {
    const record = {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      starterCode: problem.starterCode,
      testCases: problem.testCases,
      timeLimitMs: runTimeLimitMs,
      compileTimeoutMs,
      maxTraceSteps: traceMaxStepsDefault,
    };
    await db
      .insert(problemsTable)
      .values(record)
      .onConflictDoUpdate({
        target: problemsTable.id,
        set: {
          title: record.title,
          difficulty: record.difficulty,
          description: record.description,
          starterCode: record.starterCode,
          testCases: record.testCases,
          timeLimitMs: record.timeLimitMs,
          compileTimeoutMs: record.compileTimeoutMs,
          maxTraceSteps: record.maxTraceSteps,
        },
      });
    console.log(`  upserted ${problem.id} (limit ${record.timeLimitMs}ms / ${record.compileTimeoutMs}ms / ${record.maxTraceSteps} steps)`);
  }
  await pool.end();
  console.log("Done.");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
