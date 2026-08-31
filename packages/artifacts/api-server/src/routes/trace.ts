import { Router, type IRouter } from "express";
import { CreateTraceBody, GetTraceParams } from "@workspace/api-zod";
import { traceWithGdb } from "../lib/cpp-runner";
import { getTrace, saveTrace } from "../lib/trace-repo";
import { getProblem } from "../lib/problem-repo";
import { jobQueue } from "../middlewares/job-queue";

const router: IRouter = Router();

router.post("/trace", jobQueue, async (req, res) => {
  const body = CreateTraceBody.parse(req.body);
  const result = await traceWithGdb(body.code, body.input);

  // Resolve a problem name when the trace was generated from a known problem,
  // so a shared trace link can show which problem it belongs to even when
  // loaded fresh without in-memory navigation state.
  let problemId: string | null = null;
  let problemName: string | null = null;
  if (body.problemId) {
    const problem = await getProblem(body.problemId);
    if (problem) {
      problemId = problem.id;
      problemName = problem.title;
    }
  }

  const saved = await saveTrace({
    source: body.code,
    input: body.input,
    trace: result.trace,
    truncated: result.truncated,
    error: result.error,
    problemId,
    problemName,
  });
  return res.json(saved);
});

router.get("/trace/:traceId", async (req, res) => {
  const { traceId } = GetTraceParams.parse(req.params);
  const trace = await getTrace(traceId);
  if (!trace) return res.status(404).json({ error: "Trace not found" });
  return res.json(trace);
});

export default router;