import { execFile, spawn } from "node:child_process";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SANDBOX_IMAGE = "cp-tracer-sandbox:latest";
export const DOCKER_REQUIRED_MESSAGE =
  "Docker is required to run submissions but is not available. Install Docker, make sure the daemon is running, then restart the API server.";

// ---- Configurable limits (item #4) -------------------------------------
// Previously these were magic constants (2200, 10000, 2000, 10000). Each can
// now be overridden via env; per-problem overrides (e.g. timeLimitMs) are
// handled by the caller (judge/trace routes) and clamped to >= 1 here.
const RUN_TIME_LIMIT_MS_DEFAULT = 2200;
const COMPILE_TIMEOUT_MS_DEFAULT = 10000;
const TRACE_MAX_STEPS_DEFAULT = 2000;
const GDB_HARD_TIMEOUT_MS_DEFAULT = 10000;

function intFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 1 ? raw : fallback;
}

export const runTimeLimitMs = intFromEnv("RUN_TIME_LIMIT_MS", RUN_TIME_LIMIT_MS_DEFAULT);
export const compileTimeoutMs = intFromEnv("COMPILE_TIMEOUT_MS", COMPILE_TIMEOUT_MS_DEFAULT);
export const traceMaxStepsDefault = intFromEnv("TRACE_MAX_STEPS", TRACE_MAX_STEPS_DEFAULT);
export const gdbHardTimeoutMs = intFromEnv("GDB_HARD_TIMEOUT_MS", GDB_HARD_TIMEOUT_MS_DEFAULT);

// Built once per server lifetime; reset to null on failure so a transient
// daemon outage retries on the next request instead of caching the error.
let sandboxReady: Promise<void> | null = null;

async function ensureSandboxImage(): Promise<void> {
  try {
    await execFileAsync("docker", ["info"], { timeout: 15000 });
  } catch (error) {
    throw new Error(`${DOCKER_REQUIRED_MESSAGE} (docker info failed: ${String((error as Error)?.message ?? error)})`);
  }
  const dockerfilePath = path.resolve(process.cwd(), "docker/sandbox.Dockerfile");
  try {
    await execFileAsync("docker", ["image", "inspect", SANDBOX_IMAGE], { timeout: 15000 });
  } catch {
    // Image missing locally; build it from the checked-in Dockerfile.
    const build = await execFileAsync("docker", ["build", "-f", dockerfilePath, "-t", SANDBOX_IMAGE, process.cwd()], {
      timeout: 300000,
      maxBuffer: 16 * 1024 * 1024,
    });
    void build;
  }
}

function requireSandbox(): Promise<void> {
  if (!sandboxReady) {
    // Resolve once, then drop the cached promise so the next request
    // re-verifies image presence. A cached success must not survive the
    // image being removed/pruned between requests — otherwise `docker run`
    // fails later with "image not found" instead of rebuilding. Concurrent
    // calls during a single check still share this in-flight promise.
    sandboxReady = ensureSandboxImage().finally(() => {
      sandboxReady = null;
    });
  }
  return sandboxReady;
}

// Sandbox flags applied to every container: no network, capped memory (no
// swap escape hatch), one CPU core, and a fork-bomb-safe pid cap.
function dockerRunArgs(mountDir: string, name: string): string[] {
  const args = [
    "run",
    "--rm",
    "--name",
    name,
    "--network",
    "none",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "128",
    "-e",
    "HOME=/tmp",
    "-v",
    `${mountDir}:/work`,
    "-w",
    "/work",
  ];
  // Map the host user into the container so bind-mount permissions work;
  // the image's default is non-root too, but uid 0 must never be used.
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  const gid = typeof process.getgid === "function" ? process.getgid() : null;
  if (uid === null || gid === null || uid === 0) return args;
  return [...args, "--user", `${uid}:${gid}`];
}

// Rewrite host paths under mountDir to their /work counterparts inside the
// container. Anything outside mountDir is left untouched and simply will
// not exist in the container.
function mapToWorkPath(hostMount: string, value: string): string {
  if (value === hostMount) return "/work";
  if (value.startsWith(`${hostMount}/`)) return `/work/${value.slice(hostMount.length + 1)}`;
  return value;
}

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtimeMs: number;
  timedOut: boolean;
  // Populated when the process was terminated by an OS signal (e.g. SIGSEGV).
  // null when it exited normally. Docker reports a crashed child's signal as a
  // 128 + signum exit code rather than a real signal on the spawned `docker`
  // process, so this is derived from the exit code when no raw signal is seen.
  signal: string | null;
};

// Docker surfaces a child killed by a signal as a 128 + signum exit code on the
// spawned `docker` process, so map that back to the originating signal name.
function exitCodeToSignal(code: number): string | null {
  if (code < 128) return null;
  const sig = code - 128;
  const names: Record<number, string> = {
    2: "SIGINT",
    4: "SIGILL",
    6: "SIGABRT",
    7: "SIGBUS",
    8: "SIGFPE",
    9: "SIGKILL",
    11: "SIGSEGV",
  };
  return names[sig] ?? `SIG${sig}`;
}

function runProcess(file: string, args: string[], cwd: string, timeoutMs: number, input = ""): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    // NOTE: user code runs inside the sandbox container only — never fall back to a bare host spawn.
    const name = `cp-tracer-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const child = spawn(
      "docker",
      [...dockerRunArgs(cwd, name), "-i", SANDBOX_IMAGE, mapToWorkPath(cwd, file), ...args.map((arg) => mapToWorkPath(cwd, arg))],
      {
        cwd,
        env: { PATH: process.env.PATH ?? "" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    // Best-effort cleanup if the CLI dies before the container does (--rm
    // only triggers when the client sees the container exit).
    const forceRemove = () => {
      execFile("docker", ["rm", "-f", name], { timeout: 10000 }, () => {});
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      forceRemove();
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
      forceRemove();
      resolve({ stdout, stderr: error.message, exitCode: 1, runtimeMs: Date.now() - started, timedOut, signal: null });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        runtimeMs: Date.now() - started,
        timedOut,
        signal: signal ?? exitCodeToSignal(code ?? 1),
      });
    });
    child.stdin.end(input);
  });
}

async function command(
  file: string,
  args: string[],
  options: { cwd: string; timeout: number },
) {
  // NOTE: compilation runs inside the sandbox container as well — headers/preprocessor
  // abuse and compiler-crash bugs must not touch the host.
  const name = `cp-tracer-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dockerArgs = [
    ...dockerRunArgs(options.cwd, name),
    "-i",
    SANDBOX_IMAGE,
    mapToWorkPath(options.cwd, file),
    ...args.map((arg) => mapToWorkPath(options.cwd, arg)),
  ];
  try {
    const result = await execFileAsync("docker", dockerArgs, {
      timeout: options.timeout,
      killSignal: "SIGKILL",
      maxBuffer: 256 * 1024,
      env: { PATH: process.env.PATH ?? "" },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0, timedOut: false };
  } catch (error: any) {
    execFile("docker", ["rm", "-f", name], { timeout: 10000 }, () => {});
    return {
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? ""),
      exitCode: typeof error.code === "number" ? error.code : 1,
      timedOut: error.killed === true || error.signal === "SIGKILL" || error.signal === "SIGTERM",
    };
  }
}

export type CompiledSubmission = {
  folder: string;
  binary: string;
};

// Compile user code ONCE into the sandbox. The judge compiles a submission a
// single time and then calls runProgram() per test case against the same
// binary, instead of recompiling identical source for every test. On failure
// the temp folder is removed here and a compile error returned.
export async function compileSubmission(
  code: string,
): Promise<{ ok: true; program: CompiledSubmission } | { ok: false; compileError: string; timedOut: boolean }> {
  await requireSandbox();
  const folder = await mkdtemp(`${tmpdir()}/cp-judge-`);
  const source = `${folder}/main.cpp`;
  const binary = `${folder}/main`;
  try {
    await writeFile(source, code, "utf8");
    const compile = await command(
      "g++",
      ["-std=c++17", "-g", "-O0", "-fno-omit-frame-pointer", source, "-o", binary],
      { cwd: folder, timeout: compileTimeoutMs },
    );
    if (compile.exitCode !== 0 || compile.timedOut) {
      await rm(folder, { recursive: true, force: true });
      return {
        ok: false,
        compileError: compile.stderr || "Compilation failed.",
        timedOut: compile.timedOut,
      };
    }
    return { ok: true, program: { folder, binary } };
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

// Run an already-compiled binary once against a single test input. runtimeMs
// reflects this execution only (no compile time folded in).
export async function runProgram(program: CompiledSubmission, input: string, timeoutMs: number): Promise<RunResult> {
  return runProcess(program.binary, [], program.folder, timeoutMs, input);
}

// Single-shot convenience (compile once, run one input). The judge path uses
// compileSubmission + runProgram directly; compileAndRun stays for any caller
// that wants a self-contained compile-then-run of one input.
export async function compileAndRun(
  code: string,
  input: string,
  timeoutMs: number,
): Promise<RunResult & { compileError?: string }> {
  const compiled = await compileSubmission(code);
  if (!compiled.ok) {
    return {
      stdout: "",
      stderr: "",
      exitCode: 1,
      runtimeMs: 0,
      timedOut: compiled.timedOut,
      signal: null,
      compileError: compiled.compileError,
    };
  }
  try {
    return await runProgram(compiled.program, input, timeoutMs);
  } finally {
    await rm(compiled.program.folder, { recursive: true, force: true });
  }
}

export async function compileOnly(code: string) {
  await requireSandbox();
  const folder = await mkdtemp(`${tmpdir()}/cp-trace-`);
  const source = `${folder}/main.cpp`;
  const binary = `${folder}/main`;
  try {
    await writeFile(source, code, "utf8");
    const compile = await command("g++", ["-std=c++17", "-g", "-O0", "-fno-omit-frame-pointer", source, "-o", binary], { cwd: folder, timeout: compileTimeoutMs });
    return { ...compile, folder, source, binary };
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupFolder(folder: string) {
  await rm(folder, { recursive: true, force: true });
}

export function miField(record: string, field: string) {
  const match = record.match(new RegExp(`${field}="((?:\\\\.|[^"])*)"`));
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") ?? "";
}

export function miObjects(record: string, marker: string) {
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

export function miFrames(record: string) {
  return miObjects(record, "frame={").map((frame) => ({
    function: miField(frame, "func") || "??",
    line: Number(miField(frame, "line")) || 0,
    file: miField(frame, "fullname") || miField(frame, "file"),
  })).filter((frame) => frame.line > 0);
}

// GDB renders C++ reference locals (e.g. `int& x`, structured bindings
// `auto& [v, c]`) as `@0xADDRESS: value` — the address of the referred-to
// object followed by its dereferenced value. The address prefix is noise for a
// learner and reads like garbage, so surface only the underlying value.
function cleanLocalValue(value: string | null): string | null {
  if (value === null) return null;
  const refMatch = value.match(/^@0x[0-9a-fA-F]+:\s*(.*)$/);
  return refMatch ? refMatch[1] : value;
}

export function miVariables(record: string) {
  return [...record.matchAll(/\{name="((?:\\.|[^"])*)"(?:,arg="(?:\\.|[^"]*)")?,type="((?:\\.|[^"])*)"(?:,value="((?:\\.|[^"])*)")?\}/g)]
    .map((match) => ({
      name: match[1].replace(/\\"/g, '"'),
      type: match[2].replace(/\\"/g, '"'),
      value: cleanLocalValue(match[3] !== undefined ? match[3].replace(/\\"/g, '"') : null),
    }));
}

// --- Declaration-line filtering -----------------------------------------
// GDB (especially at -O0) reports every function-scope local as in scope for
// the whole body, even before its declaration line has executed — surfacing
// uninitialized garbage (and, worse, variables declared many lines later).
// We recover each variable's declaration line from the source so we can hide a
// local / data-structure until execution has actually reached that line.
// Container construction (`vector<int> a(n)`) only "happens" once we step past
// the declaration line, so the rule is strict: visible IFF currentLine >
// declarationLine (the declaration has executed).

// Strip comments and literals so a variable name inside a `// note` or a string
// literal is never mistaken for its declaration.
function stripSourceNoise(line: string): string {
  return line
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function wordOccurs(line: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(line);
}

// Keywords that, when appearing immediately before a name, mean the name is NOT
// being declared (e.g. `return x`, `if (x`, `while (x`). Used so a usage line is
// never mistaken for a declaration.
const DECL_KEYWORD_STOP = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "catch", "try",
  "return", "sizeof", "delete", "new", "throw", "goto", "continue", "break",
  "default", "using", "typedef", "static_assert",
]);

// True when `line` is a *declaration* of `varName` (a type/decl-specifier
// precedes the name), as opposed to a mere usage. This lets us find the
// variable's own declaration line even when the same name is declared in
// several blocks (shadowing): we then gate visibility on the most recent such
// declaration at or before the current line, not the first occurrence.
function declaresName(line: string, varName: string): boolean {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b([A-Za-z_]\\w*(?:\\s*<[^<>]*>)?)\\s*[*&]*\\s+${escaped}\\b`);
  const match = re.exec(line);
  if (!match) return false;
  return !DECL_KEYWORD_STOP.has(match[1]);
}

// GDB pretty-prints associative/sequential containers into a readable string
// (e.g. `std::map with 3 elements = {[1] = 2, [2] = 2, [3] = 3}` or
// `std::deque with 1 element = {40 '('}`). Parse that into per-element display
// strings so non-vector containers render readably instead of a `{...}` blob.
// `associative` keeps the `key → value` pairing (maps); otherwise elements are
// a plain comma-separated sequence (sets, stacks, queues).
function parsePrettyContainer(value: string, associative: boolean): string[] | null {
  const open = value.indexOf("{");
  const close = value.lastIndexOf("}");
  if (open < 0 || close < open) return [];
  const body = value.slice(open + 1, close);
  if (/error reading variable/.test(body)) return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return [];
  if (associative) {
    const pairs: string[] = [];
    const re = /\[([^\]]+)\]\s*=\s*([^,}]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) pairs.push(`${m[1].trim()} → ${m[2].trim()}`);
    return pairs;
  }
  return body.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

// Containers whose elements are addressed by an integer index (so array-index
// highlighting applies). Maps/sets/stacks/queues are keyed/top-addressed and
// are rendered from GDB's pretty-printed value instead.
function isIndexableType(type: string): boolean {
  return (
    /^std::vector</.test(type) ||
    /^std::array</.test(type) ||
    /^std::string/.test(type) ||
    /\]$/.test(type)
  );
}

// Map each top-level function to the 1-based line its definition starts on.
// The allow-list of control keywords guards against `if`/`for`/`while` et al.
// being mistaken for function definitions (their parameter lists contain `;`).
const FN_DEF_RE = /^[\w:~<>,*&\s]+\b([A-Za-z_]\w*)\s*\([^;{]*\)\s*\{?$/;
const FN_DEF_BLACKLIST = new Set(["if", "for", "while", "switch", "catch", "return"]);
function computeFunctionStarts(source: string): { name: string; start: number }[] {
  const lines = source.split("\n");
  const fns: { name: string; start: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = FN_DEF_RE.exec(stripSourceNoise(lines[i]));
    if (match && !FN_DEF_BLACKLIST.has(match[1])) fns.push({ name: match[1], start: i + 1 });
  }
  return fns;
}

// [start, end] line span (1-based) of `main`, used only for teardown
// detection. Deliberately independent of `computeFunctionStarts` (which uses a
// strict definition regex that misses single-line bodies like
// `int main(){ ... }`), so it correctly handles both styles.
function mainSpan(source: string): { start: number; end: number } | null {
  const lines = source.split("\n");
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(?:inline\s+)?[A-Za-z_][\w:]*\s+main\s*\(/.test(lines[i])) {
      startLine = i + 1;
      break;
    }
  }
  if (startLine < 0) return null;
  let depth = 0;
  let opened = false;
  for (let i = startLine - 1; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") {
        if (opened && --depth === 0) return { start: startLine, end: i + 1 };
      }
    }
  }
  return { start: startLine, end: lines.length };
}

// Line (1-based) at or before `currentLine` within `funcName` where `varName`
// is *declared*. Returns the most recent declaration so that, for a shadowed
// name, the in-scope (innermost/most-recent) declaration gates visibility —
// this is what hides an uninitialised second-loop `i` on its own declaration
// line instead of using the first loop's earlier declaration line.
// Falls back to the first textual occurrence when no declaration pattern is
// recognised (keeps behaviour for unusual declarations intact). Returns null
// when nothing can be determined, in which case callers prefer to *show* the
// variable rather than hide real state.
function declarationLine(
  source: string,
  functions: { name: string; start: number }[],
  funcName: string,
  varName: string,
  currentLine: number,
): number | null {
  const fn = functions.find((f) => f.name === funcName);
  if (!fn) return null;
  const lines = source.split("\n");
  let fnEnd = lines.length;
  for (const f of functions) {
    if (f.start > fn.start && f.start < fnEnd) fnEnd = f.start;
  }
  const limit = Math.min(currentLine, fnEnd);
  let lastDecl: number | null = null;
  for (let i = fn.start - 1; i < limit; i++) {
    if (declaresName(stripSourceNoise(lines[i]), varName)) lastDecl = i + 1;
  }
  if (lastDecl !== null) return lastDecl;
  for (let i = fn.start - 1; i < fnEnd; i++) {
    if (wordOccurs(stripSourceNoise(lines[i]), varName)) return i + 1;
  }
  return null;
}

// First line (1-based) at or before `currentLine` within `funcName` where
// `varName` is *assigned* (initialiser, `=`, compound assignment, `cin >>`,
// increment/decrement). Used alongside declarationLine so a scalar stays hidden
// until its value is actually established — otherwise the stop on the
// declaration/assignment statement (before it executes) surfaces uninitialised
// stack garbage. Detection is deliberately conservative: it only recognises
// explicit assignments, so a variable modified indirectly (e.g. via a function
// call) is simply shown a stop early rather than wrongly hidden.
function assignmentLine(
  source: string,
  functions: { name: string; start: number }[],
  funcName: string,
  varName: string,
  currentLine: number,
): number | null {
  const fn = functions.find((f) => f.name === funcName);
  if (!fn) return null;
  const lines = source.split("\n");
  let fnEnd = lines.length;
  for (const f of functions) {
    if (f.start > fn.start && f.start < fnEnd) fnEnd = f.start;
  }
  const limit = Math.min(currentLine, fnEnd);
  const re = new RegExp(
    `\\b${varName}\\b\\s*(=(?!=)|\\+=|-=|\\*=|\\/=|%=|\\|=|\\^=|\\+\\+|--)`,
  );
  const cinRe = new RegExp(`(?:cin\\s*>>|>>)\\s*\\b${varName}\\b`);
  // Return the FIRST assignment at or before the current line: a scalar only
  // holds uninitialised garbage before its first assignment — once assigned,
  // every later stop (including its own reassignment) holds a valid value.
  for (let i = fn.start - 1; i < limit; i++) {
    const noise = stripSourceNoise(lines[i]);
    if (re.test(noise) || cinRe.test(noise)) return i + 1;
  }
  return null;
}

// Children of a -var-list-children --all-values response. `value` is null when
// the field is absent from the record; "" (present but empty, e.g. the pseudo
// public/private accessor children of struct varobjs) stays distinct.
export type MiChild = { name: string; exp: string; type: string; value: string | null; numchild: number };

export function miChildren(record: string): MiChild[] {
  return miObjects(record, "child={").map((object) => ({
    name: miField(object, "name"),
    exp: miField(object, "exp"),
    type: miField(object, "type"),
    value: /(?:^|,)value="/.test(object) ? miField(object, "value") : null,
    numchild: Number(miField(object, "numchild")) || 0,
  }));
}

export async function traceWithGdb(code: string, input: string, maxSteps = traceMaxStepsDefault) {
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
    arrays: { name: string; type: string; values: string[]; indexable: boolean }[];
    highlights: { array: string; index: number; expr: string }[];
  }[] = [];

  // Static source analysis used to gate variable/array visibility by
  // declaration line (see captureStep). Computed once per trace.
  const functions = computeFunctionStarts(code);
  // Span of `main` (start/end lines). Used to stop the trace at `main`'s end
  // (see captureStep / finish) so the final frame reflects live state, not
  // GDB's post-destruction epilogue where freed containers read as garbage.
  const mainSpanResult = mainSpan(code);
  const mainStart = mainSpanResult?.start ?? null;
  const mainEndLine = mainSpanResult?.end ?? null;
  const rootName = (name: string): string => name.split(".")[0];
  const isVisible = (name: string, func: string, line: number): boolean => {
    // Compiler-internal temporaries (range-for helpers, etc.) are never user
    // state — always hide them.
    if (name.startsWith("__")) return false;
    const decl = declarationLine(code, functions, func, rootName(name), line);
    const assign = assignmentLine(code, functions, func, rootName(name), line);
    // A scalar is only meaningful once its declaration AND first assignment
    // have executed — this hides uninitialised stack garbage shown at the
    // declaration/assignment statement's own stop (before it runs).
    const ready = Math.max(decl ?? Number.NEGATIVE_INFINITY, assign ?? Number.NEGATIVE_INFINITY);
    if (!Number.isFinite(ready)) return true; // ambiguous → prefer to show
    return line > ready;
  };

  return new Promise<{ trace: typeof trace; error: string | null; truncated: boolean }>((resolve) => {
    // NOTE: the GDB session runs inside the sandbox container — user debug symbols
    // and the traced process never execute on the bare host.
    const name = `cp-tracer-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const gdb = spawn(
      "docker",
      [...dockerRunArgs(compiled.folder, name), "-i", SANDBOX_IMAGE, "gdb", "--interpreter=mi2", "/work/main"],
      {
        cwd: compiled.folder,
        env: { PATH: process.env.PATH ?? "" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let token = 1;
    // Token-keyed resolvers: each MI command's N^done/N^error result line is
    // delivered to exactly one awaiting exec() caller, so responses can never
    // be mis-attributed to a different command.
    const pendingResults = new Map<number, (line: string) => void>();
    let current: { function: string; line: number } | null = null;
    let frames: { function: string; line: number }[] = [];
    let stderr = "";
    let finished = false;
    let exitingTruncated = false;
    let scratchCounter = 0;
    let foreignStops = 0;
    const FOREIGN_STOP_BUDGET = 400;

    // Caps bound the per-step expansion work (payload size and latency).
    const MAX_AGGREGATES_PER_STEP = 8;
    const MAX_ELEMENTS_PER_ARRAY = 64;
    const MAX_MEMBERS_PER_STRUCT = 16;
    const MAX_TOTAL_LOCALS = 48;

    // Track in-flight gdb-mi.log writes so finish() can drain them before
    // deleting the temp folder — otherwise a straggler append hits ENOENT.
    const logWrites: Promise<unknown>[] = [];
    const writeLog = (text: string) => {
      if (finished) return;
      logWrites.push(appendFile(logPath, text).catch(() => {}));
    };

    const finish = async (error: string | null, truncated = false) => {
      if (finished) return;
      // Single-line `main` shares its closing brace with the body, so the
      // line-based teardown drop in captureStep can't fire; the final captured
      // frame is still GDB's post-destruction epilogue (freed containers). Drop
      // it so the trace ends on the last real user statement instead. Only on
      // normal completion (errors already truncate/abort meaningfully).
      if (
        error === null &&
        mainStart !== null &&
        mainEndLine !== null &&
        mainEndLine === mainStart &&
        trace.length > 0 &&
        trace[trace.length - 1].arrays.length > 0
      ) {
        trace.pop();
      }
      finished = true;
      clearTimeout(timer);
      if (!gdb.killed) gdb.kill("SIGTERM");
      execFile("docker", ["rm", "-f", name], { timeout: 10000 }, () => {});
      await Promise.allSettled(logWrites);
      if (error === null && process.env.PRESERVE_MI_LOG !== "1") {
        await cleanupFolder(compiled.folder);
      }
      // Failed traces keep their temp folder (including gdb-mi.log) around
      // for post-mortem debugging; /tmp is transient so this stays bounded.
      resolve({ trace, error, truncated });
    };
    const timer = setTimeout(() => void finish("GDB trace timed out.", true), gdbHardTimeoutMs);

    // Serialized MI request/response. Every command awaits its own token's
    // result (^error included — callers decide whether it is fatal).
    const exec = (command: string): Promise<string> =>
      new Promise((resolveLine) => {
        const id = token++;
        pendingResults.set(id, resolveLine);
        gdb.stdin.write(`${id}${command}\n`);
      });

    // Watchdog variant for MI commands that touch user memory or types whose
    // backing state can be garbage — bounded wait so a stuck exchange can
    // never stall the whole request until the global timer.
    const execWatchdog = (command: string, subject: string): Promise<string> =>
      new Promise<string>((resolveLine, rejectLine) => {
        const id = token++;
        const watchdog = setTimeout(() => {
          pendingResults.delete(id);
          rejectLine(
            new Error(
              `GDB stalled expanding "${subject}" — the value is likely read from uninitialized memory. Trace stopped at step ${trace.length}.`,
            ),
          );
        }, 750);
        pendingResults.set(id, (line) => {
          clearTimeout(watchdog);
          resolveLine(line);
        });
        gdb.stdin.write(`${id}${command}\n`);
      });

    // Numeric GDB expression evaluation (BigInt for full 64-bit pointers).
    // Returns null on ^error / unparseable output. Expressions containing
    // commas must be quoted — the arg-splitter treats bare spaces/newlines
    // as separators otherwise.
    const evalNum = async (expr: string, subject: string): Promise<bigint | null> => {
      const line = await execWatchdog(`-data-evaluate-expression "${expr}"`, subject);
      if (line.includes("^error")) return null;
      const raw = miField(line, "value");
      const tokenMatch = raw.match(/-?(?:0x[0-9a-fA-F]+|\d+)/);
      if (!tokenMatch) return null;
      try {
        return BigInt(tokenMatch[0]);
      } catch {
        return null;
      }
    };

    // std::vector contents WITHOUT libstdc++ Python pretty-printers (they
    // wedge GDB forever when reading half-initialized containers). Instead,
    // direct layout arithmetic on _M_impl._M_start/_M_finish — plain memory
    // reads that fail fast with ^error instead of hanging.
    const MAX_VECTOR_BYTES = BigInt(MAX_ELEMENTS_PER_ARRAY) * 64n; // generous absolute byte ceiling
    const expandVector = async (
      agg: { name: string; type: string },
      arraysOut: { name: string; type: string; values: string[]; indexable: boolean }[],
    ): Promise<void> => {
      const base = `${agg.name}._M_impl`;
      // Serialized on purpose — every exec() is a strict request/response
      // exchange over one stdio pipe.
      const startPtr = await evalNum(`${base}._M_start`, agg.name);
      const finishPtr = startPtr === null ? null : await evalNum(`${base}._M_finish`, agg.name);
      if (startPtr === null || finishPtr === null || startPtr === 0n || finishPtr < startPtr) {
        return; // uninitialized / implausible container state: show nothing yet
      }
      const stride = await evalNum(
        `((unsigned long)&${base}._M_start[1]) - ((unsigned long)&${base}._M_start[0])`,
        agg.name,
      );
      if (stride === null || stride <= 0n) return;
      const elementCount = Number((finishPtr - startPtr) / stride);
      if (!Number.isFinite(elementCount) || elementCount <= 0 || BigInt(elementCount) * stride > MAX_VECTOR_BYTES) {
        return; // wild span implies garbage pointers even if individually nonzero
      }
      const values: string[] = [];
      for (let index = 0; index < Math.min(elementCount, MAX_ELEMENTS_PER_ARRAY); index++) {
        const line = await execWatchdog(
          `-data-evaluate-expression "${agg.name}._M_impl._M_start[${index}]"`,
          agg.name,
        );
        if (line.includes("^error")) break;
        values.push(miField(line, "value") || "{...}");
      }
      if (values.length > 0) {
        arraysOut.push({ name: agg.name, type: agg.type, values, indexable: true });
      }
    };

    // Expand one aggregate local into either an `arrays` entry (sequence types
    // with clean element children) or flattened locals rows (structs).
    const expandAggregate = async (
      agg: { name: string; type: string },
      arraysOut: { name: string; type: string; values: string[]; indexable: boolean }[],
      localsOut: { name: string; type: string; value: string }[],
    ): Promise<void> => {
      // Map / set / stack / queue: GDB won't expose element children through a
      // varobj, but printing the whole container yields a readable pretty-print.
      // Parse that into per-element rows so the panel shows key→value pairs
      // (maps) or the contents in order (stacks/queues/sets) rather than `{...}`.
      const isAssoc = /^std::(unordered_)?map</.test(agg.type);
      const isSet = /^std::(unordered_)?set</.test(agg.type);
      const isStack = /^std::stack</.test(agg.type);
      const isQueue = /^std::(priority_)?queue</.test(agg.type);
      if (isAssoc || isSet || isStack || isQueue) {
        const whole = await execWatchdog(`-data-evaluate-expression "${agg.name}"`, agg.name);
        if (!whole.includes("^error")) {
          const val = miField(whole, "value") || "";
          const parsed = parsePrettyContainer(val, isAssoc);
          if (parsed !== null) {
            arraysOut.push({
              name: agg.name,
              type: agg.type,
              values: parsed.slice(0, MAX_ELEMENTS_PER_ARRAY),
              indexable: false,
            });
            return;
          }
        }
        // Evaluation failed or memory was unreadable — skip rather than show a
        // misleading `{...}` blob.
        return;
      }
      if (/^std::vector</.test(agg.type)) {
        // Python-free layout walk; cannot hang regardless of memory state.
        await expandVector(agg, arraysOut);
        return;
      }
      // std::array contents come from pure expressions — the element count is
      // part of the type itself ("std::array<T, N>"), so no varobj child
      // navigation is needed (child object ids proved unreliable across GDB
      // versions for deeper nesting).
      const stdArrayMatch = agg.type.match(/^std::array<.*,\s*(\d+)\s*>$/);
      if (stdArrayMatch) {
        const length = Math.min(Number(stdArrayMatch[1]), MAX_ELEMENTS_PER_ARRAY);
        const values: string[] = [];
        for (let index = 0; index < length; index++) {
          const line = await execWatchdog(
            `-data-evaluate-expression "${agg.name}._M_elems[${index}]"`,
            agg.name,
          );
          if (line.includes("^error")) break;
          values.push(miField(line, "value") || "{...}");
        }
        if (values.length > 0) {
          arraysOut.push({ name: agg.name, type: agg.type, values, indexable: true });
        }
        return;
      }
      const varName = `tracerVar${scratchCounter++}`;
      const created = await exec(`-var-create ${varName} * ${agg.name}`);
      try {
        if (miField(created, "displayhint") === "string") {
          // Strings pretty-print their full content into the varobj value and
          // their children are just characters — keep the readable string.
          localsOut.push({ name: agg.name, type: agg.type, value: miField(created, "value") || "{...}" });
          return;
        }

        // NOTE: unlike earlier assumptions, numchild=0 + has_more=1 here is NOT
        // an unhealthy marker — dynamic containers report that shape normally
        // and expect -var-list-children to materialize their children. Listing
        // may however hang inside the pretty-printer when backing memory is
        // garbage (declaration-line stops); every expansion command therefore
        // runs under a watchdog below instead of being filtered here.
        const kids = await execWatchdog(`-var-list-children --all-values ${varName}`, agg.name);
        const allChildren = miChildren(kids);
        const pseudoAccessors = new Set(["public", "private", "protected"]);
        const accessors = allChildren.filter((child) => pseudoAccessors.has(child.exp));
        const realChildren = allChildren.filter((child) => !pseudoAccessors.has(child.exp));

        if (accessors.length > 0 && realChildren.length === 0) {
          // Struct/class varobj: members hide under public/private/protected
          // groups — flatten them one level as dotted locals rows.
          for (const accessor of accessors.slice(0, 4)) {
            // `accessor.name` is already the fully qualified varobj path;
            // prefixing varName again produces an invalid object reference.
            const groupId = accessor.name || `${varName}.${accessor.exp}`;
            const group = await execWatchdog(`-var-list-children --all-values ${groupId}`, agg.name);
            const members = miChildren(group);

            // std::array pattern: a lone fixed-size member (e.g. int _M_elems[2])
            // holds the actual storage — promote it to a proper array view so the
            // panel shows element boxes instead of one `{...}` blob.
            const soleStorageMember =
              members.length === 1 &&
              members[0].type.endsWith("]") &&
              !members[0].type.startsWith("std::");
            if (soleStorageMember) {
              const storage = await execWatchdog(`-var-list-children --all-values ${members[0].name}`, agg.name);
              const elements = miChildren(storage).filter((child) => /^\[?\d+\]?$/.test(child.exp));
              if (elements.length > 0) {
                arraysOut.push({
                  name: agg.name,
                  type: agg.type,
                  values: elements.slice(0, MAX_ELEMENTS_PER_ARRAY).map((child) => child.value ?? "{...}"),
                  indexable: true,
                });
                return;
              }
            }

            for (const member of members.slice(0, MAX_MEMBERS_PER_STRUCT)) {
              localsOut.push({
                name: `${agg.name}.${member.exp}`,
                type: member.type || member.exp,
                value: member.value ?? "{...}",
              });
            }
          }
          return;
        }

        const indexLike =
          realChildren.length > 0 && realChildren.every((child) => /^\[?\d+\]?$/.test(child.exp));
        if (kids.includes('displayhint="array"') || indexLike) {
          // Sequence container (C array / std::vector / std::array): exactly
          // the row of boxes the ArraysPanel renders.
          arraysOut.push({
            name: agg.name,
            type: agg.type,
            values: realChildren.slice(0, MAX_ELEMENTS_PER_ARRAY).map((child) => child.value ?? "{...}"),
            indexable: true,
          });
          return;
        }

        // Non-sequence composite without accessor grouping: flatten whatever
        // children exist so values stay readable instead of `{...}` blobs.
        for (const member of realChildren.slice(0, MAX_MEMBERS_PER_STRUCT)) {
          localsOut.push({
            name: `${agg.name}.${member.exp}`,
            type: member.type || member.exp,
            value: member.value ?? "{...}",
          });
        }
      } finally {
        await exec(`-var-delete ${varName}`).catch(() => undefined);
      }
    };

    // One trace step per *stopped event: stack, locals (with aggregate
    // expansion), push step, then continue stepping.
    const captureStep = async (stoppedFrame: { function: string; line: number }): Promise<void> => {
      current = stoppedFrame;
      frames = miFrames(await exec("-stack-list-frames"));
      const varsLine = await exec("-stack-list-variables --simple-values");
      const entries = miVariables(varsLine);

      const scalars = entries.filter((entry): entry is { name: string; type: string; value: string } => entry.value !== null);
      const aggregates = entries.filter((entry) => entry.value === null).slice(0, MAX_AGGREGATES_PER_STEP);

      const locals: { name: string; type: string; value: string }[] = [];
      const arrays: { name: string; type: string; values: string[]; indexable: boolean }[] = [];
      // Scalars: only those whose declaration line has already executed.
      for (const entry of scalars) {
        if (locals.length >= MAX_TOTAL_LOCALS) break;
        if (isVisible(entry.name, current.function, current.line)) locals.push({ ...entry });
      }
      // Aggregates (containers/structs): expand only once declared, so unbuilt
      // containers (e.g. `vector<int> a(n)` before it runs) stay hidden.
      for (const agg of aggregates) {
        if (locals.length >= MAX_TOTAL_LOCALS) break;
        if (isVisible(agg.name, current.function, current.line)) await expandAggregate(agg, arrays, locals);
      }

      // Index-highlighting: for each visible data structure, if the current
      // source line reads/writes a single element `name[idx]` with a
      // side-effect-free index expression resolvable in scope, record the
      // accessed index so the UI can mark that cell. 2-D access and any
      // expression that could mutate state (++, calls) are skipped.
      const highlights: { array: string; index: number; expr: string }[] = [];
      const sourceLine = code.split("\n")[current.line - 1] ?? "";
      const safeExpr = /^[\w]+(?:\s*[-+*/]\s*(?:[\w]+|\d+))*$/;
      for (const array of arrays) {
        if (!isIndexableType(array.type)) continue;
        const re = new RegExp(
          `\\b${array.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\[([^\\]]*?)\\]`,
        );
        const match = sourceLine.match(re);
        if (!match) continue;
        const expr = match[1].trim();
        if (expr.includes("[") || !safeExpr.test(expr)) continue;
        try {
          const value = await evalNum(expr, `${array.name}[${expr}]`);
          if (value !== null && value >= 0n && value <= 1000000n) {
            highlights.push({ array: array.name, index: Number(value), expr });
          }
        } catch {
          // index evaluation stalled/errored — leave the cell unhighlighted
        }
      }

      trace.push({
        step: trace.length,
        line: current.line,
        function: current.function,
        locals: locals.slice(0, MAX_TOTAL_LOCALS),
        stack: frames.map(({ function: fn, line: ln }) => ({ function: fn, line: ln })),
        arrays,
        highlights,
      });

      if (trace.length >= maxSteps) {
        exitingTruncated = true;
        await exec("-gdb-exit");
        return;
      }
      // Stop at the end of `main`: the next step would enter GDB's function-exit
      // epilogue, where local containers are destructed and their varobjs still
      // resolve to freed memory (garbage). Capturing that frame only shows
      // meaningless values, so we end on the last real user statement instead.
      // Guarded to multi-line `main` (closing brace on its own line) — a
      // single-line `main` would match this on its first statement.
      if (
        mainEndLine !== null &&
        mainStart !== null &&
        mainEndLine > mainStart &&
        current.function === "main" &&
        current.line === mainEndLine
      ) {
        await exec("-gdb-exit").catch(() => undefined);
        void finish(null, exitingTruncated || trace.length >= maxSteps);
        return;
      }
      await exec("-exec-step");
    };

    const captureStopped = (record: string) => {
      const frame = miFrames(record)[0];
      const reason = miField(record, "reason");
      if (reason.startsWith("exited")) {
        void finish(null, exitingTruncated || trace.length >= maxSteps);
        return;
      }
      if (!frame) {
        // Source-less library stop: step again rather than fabricating a frame.
        if (reason === "end-stepping-range" || reason === "") {
          void exec("-exec-step").catch(() => undefined);
        } else {
          void finish(`GDB stopped without a current source frame (reason: ${reason || "unknown"}).`);
        }
        return;
      }
      if (!frame.file.endsWith("/main.cpp")) {
        // Stopped inside STL/allocator internals: libstdc++ headers compile
        // with debug info into the user TU, so -exec-step enters them. Pop
        // back out with -exec-finish (one level per call) instead of stepping
        // through internals line by line — cheap "step over" semantics that
        // survive even tight loops calling inline container methods.
        foreignStops += 1;
        if (foreignStops > FOREIGN_STOP_BUDGET) {
          void finish("Trace stepped too deep inside standard-library internals.", true);
          return;
        }
        void exec("-exec-finish").catch(() => undefined);
        return;
      }
      void captureStep({ function: frame.function, line: frame.line }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!finished) void finish(`GDB capture failed: ${message}`);
      });
    };

    gdb.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      writeLog(text);
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        if (line.startsWith("*stopped")) {
          if (!finished) captureStopped(line);
          continue;
        }
        const resultMatch = line.match(/^(\d+)\^(done|error|connected|running|exit)/);
        if (!resultMatch) continue;
        const id = Number(resultMatch[1]);
        const resolver = pendingResults.get(id);
        if (resolver) {
          pendingResults.delete(id);
          resolver(line);
        }
      }
    });
    gdb.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    gdb.on("error", (error) => void finish(`Unable to launch GDB: ${error.message}`));
    gdb.on("close", (code) => {
      if (!finished && code !== 0) void finish(stderr.trim() || `GDB exited with code ${code ?? 1}.`);
      // Graceful -gdb-exit ends with close(0); resolve via a no-op wait that
      // lets any straggling log writes flush inside finish().
      else if (!finished && code === 0) void finish(null, exitingTruncated);
    });

    const setup = async (): Promise<void> => {
      // NOTE: deliberately NO -enable-pretty-printing. libstdc++ Python
      // printers hang forever on containers whose backing memory is not yet
      // initialized (declaration-line stops); all extraction below uses
      // python-free static varobjs / raw expressions instead.
      await exec("-gdb-set pagination off");
      await exec("-gdb-set confirm off");
      await exec('-interpreter-exec console "set step-mode off"');
      await exec("-break-insert main");
      await exec(`-interpreter-exec console "run < /work/stdin.txt"`);
    };
    void setup().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!finished) void finish(`GDB setup failed: ${message}`);
    });
  });
}