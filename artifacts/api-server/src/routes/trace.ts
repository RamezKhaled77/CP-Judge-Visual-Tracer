import { Router, type IRouter } from "express";
import { CreateTraceBody } from "@workspace/api-zod";
import { traceWithGdb } from "../lib/cpp-runner";

const router: IRouter = Router();

router.post("/trace", async (req, res) => {
  const body = CreateTraceBody.parse(req.body);
  const result = await traceWithGdb(body.code, body.input);
  return res.json({
    trace: result.trace,
    source: body.code,
    truncated: result.truncated,
    error: result.error,
  });
});

export default router;