import { Router, type IRouter } from "express";
import { GetProblemParams } from "@workspace/api-zod";
import { problems } from "../lib/problems";

const router: IRouter = Router();

router.get("/problems", (_req, res) => res.json(problems));
router.get("/problems/:problemId", (req, res) => {
  const { problemId } = GetProblemParams.parse(req.params);
  const problem = problems.find((item) => item.id === problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found" });
  return res.json(problem);
});

export default router;