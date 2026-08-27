import { Router, type IRouter } from "express";
import { CreateTraceBody, GetTraceParams } from "@workspace/api-zod";
import { traceWithGdb } from "../lib/cpp-runner";
import { getTrace, saveTrace } from "../lib/trace-repo";
import { jobQueue } from "../middlewares/job-queue";

const router: IRouter = Router();

router.post("/trace", jobQueue, async (req, res) => {
  const body = CreateTraceBody.parse(req.body);
  const result = await traceWithGdb(body.code, body.input);
  const saved = await saveTrace({
    source: body.code,
    input: body.input,
    trace: result.trace,
    truncated: result.truncated,
    error: result.error,
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