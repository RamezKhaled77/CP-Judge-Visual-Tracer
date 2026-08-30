import { Router, type IRouter } from "express";
import { compileAndRun, runTimeLimitMs, DOCKER_REQUIRED_MESSAGE } from "../lib/cpp-runner";
import { jobQueue } from "../middlewares/job-queue";

const router: IRouter = Router();

// Single-shot, non-judged execution: compile once and run the user's code
// against one input (typically the same stdin box used for tracing). Returns
// raw stdout/stderr/exit code only — no verdict, no per-test breakdown. This
// backs the "raw output" panel in the workbench, which is distinct from the
// full multi-case judge at POST /api/submissions.
router.post("/run", jobQueue, async (req, res) => {
  const body = req.body ?? {};
  const code = typeof body.code === "string" ? body.code : "";
  const input = typeof body.input === "string" ? body.input : "";
  if (code.length === 0) {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const result = await compileAndRun(code, input, runTimeLimitMs);
    return res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      runtimeMs: result.runtimeMs,
      timedOut: result.timedOut,
      signal: result.signal ?? null,
      compileError: result.compileError ?? null,
    });
  } catch (error) {
    // compileAndRun can throw when the sandbox is unavailable (Docker down,
    // image build failure, etc.). Surface the real reason instead of letting
    // it bubble to the central handler as a generic 500.
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith(DOCKER_REQUIRED_MESSAGE) ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

export default router;
