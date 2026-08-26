import { execFile, spawn } from "node:child_process";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
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

function miField(record: string, field: string) {
  const match = record.match(new RegExp(`${field}="((?:\\\\.|[^"])*)"`));
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") ?? "";
}

function miObjects(record: string, marker: string) {
  const objects: string[] = [];
  let searchFrom = 0;
  while (true) {
    const markerIndex = record.indexOf(marker, searchFrom);
    if (markerIndex < 0) break;
    const start = markerIndex + marker.length - 1;
    let depth = 0;
    let escaped = false;
    let quoted = false;
    for (let index = start; index < record.length; index++) {
      const char = record[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (!quoted && char === "{") depth++;
      if (!quoted && char === "}") {
        depth--;
        if (depth === 0) {
          objects.push(record.slice(start + 1, index));
          searchFrom = index + 1;
          break;
        }
      }
    }
    if (searchFrom <= markerIndex) break;
  }
  return objects;
}

function miFrames(record: string) {
  return miObjects(record, "frame={").map((frame) => ({
    function: miField(frame, "func") || "??",
    line: Number(miField(frame, "line")) || 0,
  })).filter((frame) => frame.line > 0);
}

function miVariables(record: string) {
  return [...record.matchAll(/\{name="((?:\\.|[^"])*)",type="((?:\\.|[^"])*)",value="((?:\\.|[^"])*)"\}/g)]
    .map((match) => ({
      name: match[1].replace(/\\"/g, '"'),
      type: match[2].replace(/\\"/g, '"'),
      value: match[3].replace(/\\"/g, '"'),
    }))
    .filter((local) => local.name !== "main" && local.name !== "fib");
}

export async function traceWithGdb(code: string, input: string, maxSteps = 2000) {
  const compiled = await compileOnly(code);
  if (compiled.exitCode !== 0 || compiled.timedOut) {
    await cleanupFolder(compiled.folder);
    return { trace: [], error: compiled.stderr || "Compilation failed before tracing.", truncated: false };
  }

  const inputPath = `${compiled.folder}/stdin.txt`;
  const logPath = `${compiled.folder}/gdb-mi.log`;
  await writeFile(inputPath, input, "utf8");
  const trace: {
    step: number;
    line: number;
    function: string;
    locals: { name: string; type: string; value: string }[];
    stack: { function: string; line: number }[];
    arrays: { name: string; type: string; values: string[] }[];
  }[] = [];

  return new Promise<{ trace: typeof trace; error: string | null; truncated: boolean }>((resolve) => {
    const gdb = spawn("gdb", ["--interpreter=mi2", compiled.binary], {
      cwd: compiled.folder,
      env: { PATH: process.env.PATH ?? "" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let token = 1;
    let pending: "setup" | "stack" | "locals" | "exit" = "setup";
    let current: { function: string; line: number } | null = null;
    let frames: { function: string; line: number }[] = [];
    let stderr = "";
    let finished = false;

    const finish = async (error: string | null, truncated = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!gdb.killed) gdb.kill("SIGTERM");
      await cleanupFolder(compiled.folder);
      resolve({ trace, error, truncated });
    };
    const timer = setTimeout(() => void finish("GDB trace timed out.", true), 10000);
    const send = (command: string, next: typeof pending) => {
      pending = next;
      gdb.stdin.write(`${token++}${command}\n`);
    };
    const captureStopped = (record: string) => {
      const frame = miFrames(record)[0];
      const reason = miField(record, "reason");
      if (reason.startsWith("exited")) {
        void finish(null, trace.length >= maxSteps);
        return;
      }
      if (!frame) {
        void finish("GDB stopped without a current source frame.");
        return;
      }
      current = frame;
      send("-stack-list-frames", "stack");
    };

    gdb.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      void appendFile(logPath, text);
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        if (line.startsWith("*stopped")) {
          captureStopped(line);
          continue;
        }
        if (!/^\d+\^(?:done|error)/.test(line)) continue;
        if (line.includes("^error")) {
          void finish(`GDB command failed: ${miField(line, "msg") || line}`);
          continue;
        }
        if (pending === "stack") {
          frames = miFrames(line);
          send("-stack-list-variables --simple-values", "locals");
        } else if (pending === "locals" && current) {
          trace.push({
            step: trace.length,
            line: current.line,
            function: current.function,
            locals: miVariables(line),
            stack: frames,
            arrays: [],
          });
          if (trace.length >= maxSteps) {
            send("-gdb-exit", "exit");
          } else {
            send("-exec-step", "setup");
          }
        } else if (pending === "exit") {
          void finish(null, true);
        }
      }
    });
    gdb.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    gdb.on("error", (error) => void finish(`Unable to launch GDB: ${error.message}`));
    gdb.on("close", (code) => {
      if (!finished && code !== 0) void finish(stderr.trim() || `GDB exited with code ${code ?? 1}.`);
    });

    send("-gdb-set pagination off", "setup");
    send("-gdb-set confirm off", "setup");
    send('-interpreter-exec console "set step-mode off"', "setup");
    send(`-inferior-tty-set ${inputPath}`, "setup");
    send("-break-insert main", "setup");
    send("-exec-run", "setup");
  });
}