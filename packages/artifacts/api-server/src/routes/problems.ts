import { Router, type IRouter } from "express";
import { GetProblemParams } from "@workspace/api-zod";
import { getProblem, listProblems } from "../lib/problem-repo";

const router: IRouter = Router();

router.get("/problems", async (_req, res) => res.json(await listProblems()));
router.get("/problems/:problemId", async (req, res) => {
  const { problemId } = GetProblemParams.parse(req.params);
  const problem = await getProblem(problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found" });
  // Public response: strip internal limits so the wire shape stays as the
  // OpenAPI `Problem` schema. getProblem returns ProblemWithLimits (has a
  // `limits` property) — drop it before sending.
  const { limits: _limits, ...publicProblem } = problem;
  return res.json(publicProblem);
});

export default router;