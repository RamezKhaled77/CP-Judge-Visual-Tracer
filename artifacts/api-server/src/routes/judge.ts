import { Router, type IRouter } from "express";
import { CreateSubmissionBody } from "@workspace/api-zod";
import { compileAndRun } from "../lib/cpp-runner";
import { problems } from "../lib/problems";

const router: IRouter = Router();

router.post("/submissions", async (req, res) => {
  const body = CreateSubmissionBody.parse(req.body);
  const problem = problems.find((item) => item.id === body.problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found" });

  const tests = [];
  for (const test of problem.testCases) {
    const result = await compileAndRun(body.code, test.input, 2200);
    if (result.compileError) {
      return res.json({
        verdict: "CE",
        totalRuntimeMs: result.runtimeMs,
        tests: [],
        compileError: result.compileError,
      });
    }
    const normalize = (value: string) => value.split("\n").map((line) => line.trimEnd()).join("\n").trimEnd();
    const actual = result.stdout;
    const passed = !result.timedOut && result.exitCode === 0 && normalize(actual) === normalize(test.expectedOutput);
    tests.push({
      id: test.id,
      verdict: result.timedOut ? "TLE" : result.exitCode !== 0 ? "RE" : passed ? "AC" : "WA",
      actualOutput: actual,
      expectedOutput: test.expectedOutput,
      runtimeMs: result.runtimeMs,
      error: result.exitCode !== 0 ? result.stderr : null,
    });
  }
  const verdict = tests.some((item) => item.verdict === "WA") ? "WA" : tests.some((item) => item.verdict === "TLE") ? "TLE" : tests.some((item) => item.verdict === "RE") ? "RE" : "AC";
  return res.json({ verdict, totalRuntimeMs: tests.reduce((sum, item) => sum + item.runtimeMs, 0), tests, compileError: null });
});

export default router;