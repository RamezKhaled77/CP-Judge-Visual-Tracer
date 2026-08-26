import { Router, type IRouter } from "express";
import { CreateSubmissionBody } from "@workspace/api-zod";
import { cleanupFolder, compileSubmission, runProgram } from "../lib/cpp-runner";
import { getProblem } from "../lib/problem-repo";
import { jobQueue } from "../middlewares/job-queue";

const router: IRouter = Router();

router.post("/submissions", jobQueue, async (req, res) => {
  const body = CreateSubmissionBody.parse(req.body);
  const problem = await getProblem(body.problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found" });

  // Compile ONCE per submission, then run each test case against the same
  // binary. Recompiling identical source for every test was a large waste of
  // wall-clock time on multi-test problems.
  const compiled = await compileSubmission(body.code);
  if (!compiled.ok) {
    return res.json({ verdict: "CE", totalRuntimeMs: 0, tests: [], compileError: compiled.compileError });
  }
  try {
    const tests = [];
    for (const test of problem.testCases) {
      const result = await runProgram(compiled.program, test.input, problem.limits.timeLimitMs);
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
  } finally {
    await cleanupFolder(compiled.program.folder);
  }
});

export default router;
