import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtimeMs: number;
  timedOut: boolean;
};

function runProcess(file: string, args: string[], cwd: string, timeoutMs: number, input = ""): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(file, args, {
      cwd,
      env: { PATH: process.env.PATH ?? "" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 256 * 1024) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 256 * 1024) child.kill("SIGKILL");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: error.message, exitCode: 1, runtimeMs: Date.now() - started, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1, runtimeMs: Date.now() - started, timedOut });
    });
    child.stdin.end(input);
  });
}

async function command(
  file: string,
  args: string[],
  options: { cwd: string; timeout: number },
) {
  try {
    const result = await execFileAsync(file, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      maxBuffer: 256 * 1024,
      env: { PATH: process.env.PATH ?? "" },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0, timedOut: false };
  } catch (error: any) {
    return {
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? ""),
      exitCode: typeof error.code === "number" ? error.code : 1,
      timedOut: error.killed === true || error.signal === "SIGTERM",
    };
  }
}

export async function compileAndRun(
  code: string,
  input: string,
  timeoutMs: number,
): Promise<RunResult & { compileError?: string }> {
  const folder = await mkdtemp(`${tmpdir()}/cp-judge-`);
  const source = `${folder}/main.cpp`;
  const binary = `${folder}/main`;
  const started = Date.now();
  try {
    await writeFile(source, code, "utf8");
    const compile = await command("g++", ["-std=c++17", "-g", "-O0", "-fno-omit-frame-pointer", source, "-o", binary], { cwd: folder, timeout: 10000 });
    if (compile.exitCode !== 0 || compile.timedOut) {
      return {
        stdout: "",
        stderr: "",
        exitCode: compile.exitCode,
        runtimeMs: Date.now() - started,
        timedOut: compile.timedOut,
        compileError: compile.stderr || "Compilation failed.",
      };
    }
    const run = await runProcess(binary, [], folder, timeoutMs, input);
    return { ...run, runtimeMs: Date.now() - started };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function compileOnly(code: string) {
  const folder = await mkdtemp(`${tmpdir()}/cp-trace-`);
  const source = `${folder}/main.cpp`;
  const binary = `${folder}/main`;
  try {
    await writeFile(source, code, "utf8");
    const compile = await command("g++", ["-std=c++17", "-g", "-O0", "-fno-omit-frame-pointer", source, "-o", binary], { cwd: folder, timeout: 10000 });
    return { ...compile, folder, source, binary };
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupFolder(folder: string) {
  await rm(folder, { recursive: true, force: true });
}