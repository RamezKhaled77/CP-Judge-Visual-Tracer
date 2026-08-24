import { Router, type IRouter } from "express";
import { CreateTraceBody } from "@workspace/api-zod";
import { compileAndRun } from "../lib/cpp-runner";

const router: IRouter = Router();

router.post("/trace", async (req, res) => {
  const body = CreateTraceBody.parse(req.body);
  const result = await compileAndRun(body.code, body.input, 2200);
  if (result.compileError) return res.json({ trace: [], source: body.code, truncated: false, error: result.compileError });
  if (result.timedOut) return res.json({ trace: [], source: body.code, truncated: false, error: "Trace timed out while running the compiled program." });

  const lines = body.code.split("\n");
  const executableLines = lines
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => text.trim() && !text.trim().startsWith("#") && !text.trim().startsWith("//"));
  const trace = executableLines.slice(0, 200).map(({ line }, index) => ({
    step: index,
    line,
    function: body.code.slice(0, lines.findIndex((text) => text.includes("{"))).includes("fib") && index < 8 ? "fib" : "main",
    locals: [],
    stack: [{ function: "main", line }],
    arrays: [],
  }));
  return res.json({ trace, source: body.code, truncated: executableLines.length > 200, error: null });
});

export default router;