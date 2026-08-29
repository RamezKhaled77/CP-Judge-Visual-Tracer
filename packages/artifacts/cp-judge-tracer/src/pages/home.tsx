import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateSubmission, useCreateTrace, useGetProblem, useListProblems, getGetProblemQueryKey, getListProblemsQueryKey } from "@workspace/api-client-react";
import type { Problem, SubmissionResult, TraceResult } from "@workspace/api-client-react";
import { AlertTriangle, BookOpen, Check, CirclePlay, Clock, Code2, Database, FileCode2, Loader2, Sparkles, WandSparkles, X } from "lucide-react";
import { CockpitShell } from "@/components/cockpit-shell";
import { CodeEditor } from "@/components/code-editor";

const MINIMAL_STARTER = `#include <bits/stdc++.h>
using namespace std;

int main() {
    \n}
`;

function LoadingPanel() {
  return (
    <div className="grid-paper flex min-h-[450px] items-center justify-center p-8">
      <div className="flex items-center gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--cream)] px-5 py-4 shadow-[3px_3px_0_var(--ink)]">
        <Loader2 className="animate-spin text-[#e66f5c]" size={18} />
        <span className="font-mono text-xs uppercase tracking-[0.12em]">loading problem shelf</span>
      </div>
    </div>
  );
}

function ProblemShelf({
  problems,
  selectedId,
  onSelect,
}: {
  problems: Problem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? problems.filter((p) => p.title.toLowerCase().includes(q)) : problems;
    const order = ["Easy", "Medium", "Hard"];
    const byDiff = new Map<string, Problem[]>();
    for (const p of filtered) {
      if (!byDiff.has(p.difficulty)) byDiff.set(p.difficulty, []);
      byDiff.get(p.difficulty)!.push(p);
    }
    return order
      .filter((d) => byDiff.has(d))
      .map((d) => ({ difficulty: d, items: byDiff.get(d)! }));
  }, [problems, query]);

  const diffColor = (difficulty: string, selected: boolean) =>
    selected
      ? "text-[#503430]"
      : difficulty === "Easy"
        ? "text-[#258b88]"
        : difficulty === "Medium"
          ? "text-[#9a7a12]"
          : "text-[#9e4039]";

  return (
    <section className="flex w-full shrink-0 flex-col border-b-2 border-[var(--ink)] bg-[#e9dfce] lg:w-[240px] lg:border-b-0 lg:border-r-2">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-soft)]">problem shelf</p>
          <p className="mt-1 font-display text-lg font-bold">Pick a specimen</p>
        </div>
        <span className="rounded-full border border-[var(--ink)] bg-[#f7f1e4] px-2 py-1 font-mono text-[10px]">{problems.length.toString().padStart(2, "0")}</span>
      </div>
      <div className="px-4 pb-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search problems…"
          data-testid="input-problem-search"
          className="w-full rounded-[6px] border-2 border-[#a99880] bg-[#f7f1e4] px-3 py-2 font-mono text-[11px] outline-none transition-shadow focus:border-[var(--ink)] focus:shadow-[2px_2px_0_var(--ink)]"
        />
      </div>
      <div className="thin-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-center font-mono text-[10px] text-[var(--ink-soft)]">No matches</p>
        ) : (
          groups.map((group) => {
            const isCollapsed = Boolean(collapsed[group.difficulty]);
            return (
              <div key={group.difficulty} className="mb-2">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [group.difficulty]: !c[group.difficulty] }))}
                  data-testid={`group-${group.difficulty}`}
                  className="flex w-full items-center justify-between rounded-[6px] bg-[#f1e8d8] px-2 py-1.5 transition-colors hover:bg-[#ece1cf]"
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--ink-soft)]">{group.difficulty}</span>
                  <span className="font-mono text-[9px] text-[var(--ink-soft)]">{isCollapsed ? "+" : "−"} {String(group.items.length).padStart(2, "0")}</span>
                </button>
                {!isCollapsed && (
                  <div className="mt-1 space-y-1">
                    {group.items.map((item) => {
                      const selected = selectedId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelect(item.id)}
                          data-testid={`button-problem-${item.id}`}
                          className={`flex w-full items-center justify-between gap-2 rounded-[6px] border px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 ${selected ? "border-[var(--ink)] bg-[#f27f6a] shadow-[3px_3px_0_var(--ink)]" : "border-transparent bg-[#f7f1e4] hover:border-[var(--ink)]"}`}
                        >
                          <span className={`truncate text-[12px] font-medium leading-4 ${selected ? "text-[#503430]" : "text-[var(--ink)]"}`}>{item.title}</span>
                          <span className={`shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] ${diffColor(item.difficulty, selected)}`}>{item.difficulty}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="mt-auto hidden border-t border-[#cbbfac] p-4 lg:block">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">small ritual</p>
        <p className="mt-2 text-[11px] leading-4 text-[var(--ink-soft)]">Run once for the answer. Trace once for the reason.</p>
      </div>
    </section>
  );
}

function ResultPanel({ result }: { result: SubmissionResult | null }) {
  if (!result) {
    return (
      <div className="grid-paper flex min-h-[185px] items-center justify-center border-t-2 border-[var(--ink)] bg-[#ede4d5] p-6 lg:min-h-[205px]">
        <div className="max-w-[370px] text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[9px] border-2 border-[var(--ink)] bg-[#f2cc68]"><Sparkles size={18} /></div>
          <p className="font-display text-lg font-bold">Your output will land here</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">Judge it for a verdict, or send it to the tracer when the answer is not enough.</p>
        </div>
      </div>
    );
  }
  const passed = result.verdict === "AC";
  return (
    <section className="border-t-2 border-[var(--ink)] bg-[#ede4d5] p-4 sm:p-5" data-testid="panel-submission-result">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border-2 border-[var(--ink)] ${passed ? "bg-[#63c9c2]" : "bg-[#f27f6a]"}`}>
            {passed ? <Check size={19} strokeWidth={3} /> : <AlertTriangle size={18} />}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">latest judge</p>
            <p className="truncate font-display text-xl font-bold tracking-[-0.03em]">{result.verdict}</p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full border-2 border-[var(--ink)] bg-[#f7f1e4] px-3 py-1.5 font-mono text-[10px]">{result.totalRuntimeMs} ms total</span>
      </div>
      {result.compileError && (
        <pre className="mb-4 max-h-28 overflow-auto rounded-[7px] border-2 border-[#9e4039] bg-[#f8c1b4] p-3 font-mono text-[11px] leading-5 text-[#542c2a]" data-testid="text-compile-error">{result.compileError}</pre>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {result.tests.map((test, index) => {
          const testPassed = test.verdict === "AC";
          const isTle = test.verdict === "TLE";
          const isRe = test.verdict === "RE";
          const iconBg = testPassed ? "bg-[#63c9c2]" : isTle ? "bg-[#f2cc68]" : "bg-[#f27f6a]";
          return (
            <div key={test.id} className="flex items-center justify-between rounded-[7px] border border-[#b7aa96] bg-[#f7f1e4] px-3 py-2.5" data-testid={`row-test-${test.id}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                  {testPassed ? <Check size={12} strokeWidth={3} /> : isTle ? <Clock size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">case {index + 1}</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--ink-soft)]">{test.runtimeMs} ms · {test.verdict}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type RawRun = {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtimeMs: number;
  timedOut: boolean;
  compileError: string | null;
};

function RawOutputPanel({ run, isRunning, onRun }: { run: RawRun | null; isRunning: boolean; onRun: () => void }) {
  return (
    <section className="mt-6 border-t border-[#b7aa96] pt-4" data-testid="panel-raw-output">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-[#258b88]" />
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.17em]">raw output</p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          data-testid="button-run-once"
          className="flex items-center gap-1.5 rounded-[6px] border-2 border-[var(--ink)] bg-[#7ca8ef] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5 hover:shadow-[2px_2px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isRunning ? <Loader2 size={12} className="animate-spin" /> : <CirclePlay size={12} />} run once
        </button>
      </div>
      {isRunning ? (
        <div className="flex items-center gap-2 rounded-[7px] border-2 border-[#b7aa96] bg-[#f7f1e4] p-3 font-mono text-[11px] text-[var(--ink-soft)]">
          <Loader2 size={14} className="animate-spin" /> executing…
        </div>
      ) : !run ? (
        <div className="rounded-[7px] border-2 border-dashed border-[#b7aa96] bg-[#f1e8d8] p-4 text-center font-mono text-[11px] text-[var(--ink-soft)]">
          Run your code to see raw output here
        </div>
      ) : run.compileError ? (
        <pre className="max-h-44 overflow-auto rounded-[7px] border-2 border-[#9e4039] bg-[#f8c1b4] p-3 font-mono text-[11px] leading-5 text-[#542c2a]" data-testid="text-raw-compile-error">{run.compileError}</pre>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
            <span className={`rounded-full border border-[var(--ink)] px-2 py-0.5 ${run.exitCode === 0 && !run.timedOut ? "bg-[#63c9c2]" : "bg-[#f27f6a]"}`}>exit {run.exitCode}{run.timedOut ? " · TLE" : ""}</span>
            <span>{run.runtimeMs} ms</span>
          </div>
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">stdout</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[7px] border-2 border-[#b7aa96] bg-[#f7f1e4] p-3 font-mono text-[11px] leading-5 text-[var(--ink)]" data-testid="text-raw-stdout">{run.stdout || "(empty)"}{run.stdout && !run.stdout.endsWith("\n") ? "\n" : ""}</pre>
          </div>
          {run.stderr && (
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9e4039]">stderr</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[7px] border-2 border-[#9e4039] bg-[#f8c1b4] p-3 font-mono text-[11px] leading-5 text-[#542c2a]" data-testid="text-raw-stderr">{run.stderr}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const problemsQuery = useListProblems({ query: { queryKey: getListProblemsQueryKey() } });
  const problems = useMemo(() => problemsQuery.data ?? [], [problemsQuery.data]);
  const [selectedId, setSelectedId] = useState("");
  const [code, setCode] = useState(MINIMAL_STARTER);
  const [traceInput, setTraceInput] = useState("");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [notice, setNotice] = useState("");

  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (!didAutoSelect.current && !selectedId && problems[0]) {
      setSelectedId(problems[0].id);
      didAutoSelect.current = true;
    }
  }, [problems, selectedId]);

  const problemQuery = useGetProblem(selectedId, {
    query: { enabled: Boolean(selectedId), queryKey: getGetProblemQueryKey(selectedId) },
  });
  const problem = problemQuery.data;

  useEffect(() => {
    if (problem) {
      setCode(problem.starterCode || MINIMAL_STARTER);
      setTraceInput(problem.testCases[0]?.input ?? "");
      setResult(null);
      setNotice("");
    }
  }, [problem?.id]);

  const submission = useCreateSubmission();
  const trace = useCreateTrace();

  const handleJudge = () => {
    if (!selectedId || !code.trim()) return;
    setNotice("");
    submission.mutate({ data: { code, problemId: selectedId } }, {
      onSuccess: (nextResult) => setResult(nextResult),
      onError: (error) => setNotice(error instanceof Error ? error.message : "The judge could not be reached."),
    });
  };

  const handleReset = () => {
    const starter = problem?.starterCode || MINIMAL_STARTER;
    if (code.trim().length > 0 && code !== starter) {
      if (!window.confirm("Reset the editor to the starter template? Your current code will be discarded.")) return;
    }
    setCode(starter);
  };

  const handleClear = () => {
    setSelectedId("");
    setCode(MINIMAL_STARTER);
    setTraceInput("");
    setResult(null);
    setRawRun(null);
    setNotice("");
  };

  const [rawRun, setRawRun] = useState<RawRun | null>(null);
  const [isRunningOnce, setIsRunningOnce] = useState(false);

  const handleRunOnce = async () => {
    if (!code.trim()) return;
    setIsRunningOnce(true);
    setRawRun(null);
    setNotice("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input: traceInput }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = "The run failed.";
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed?.error) message = parsed.error;
        } catch {
          if (text) message = text.slice(0, 300);
        }
        setNotice(message);
        return;
      }
      setRawRun((await res.json()) as RawRun);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not reach the API server: ${error.message}. Is the api-server running (default PORT=8080)?`
          : "Could not reach the API server. Make sure it is running.",
      );
    } finally {
      setIsRunningOnce(false);
    }
  };

  const handleTrace = () => {
    if (!code.trim()) return;
    setNotice("");
    const effectiveTraceInput = traceInput.trim().length > 0 ? traceInput : (problem?.testCases[0]?.input ?? "");
    trace.mutate({ data: { code, input: effectiveTraceInput } }, {
      onSuccess: (traceResult: TraceResult) => {
        sessionStorage.setItem("cp-trace-result", JSON.stringify(traceResult));
        setLocation(`/trace/${traceResult.id}`);
      },
      onError: (error) => setNotice(error instanceof Error ? error.message : "The tracer could not start. Check whether the Docker/GDB sandbox is available."),
    });
  };

  const chooseProblem = (id: string) => {
    setSelectedId(id);
    setResult(null);
  };

  return (
    <CockpitShell specimenIndex={selectedId ? problems.findIndex((p) => p.id === selectedId) + 1 : 0} specimenTotal={problems.length}>
      <div className="flex min-h-[calc(100dvh-68px)] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="rounded-[6px] border-2 border-[var(--ink)] bg-[#7ca8ef] px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]">bench 01</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">select / edit / observe</span>
          </div>
          <Link href="/trace" data-testid="link-open-trace" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#258b88] transition-colors hover:text-[var(--ink)]">
            <WandSparkles size={14} /> open last trace
          </Link>
        </div>

        {problemsQuery.isLoading ? <LoadingPanel /> : problemsQuery.isError ? (
          <div className="grid-paper flex min-h-[470px] items-center justify-center p-8">
            <div className="max-w-sm rounded-[10px] border-2 border-[var(--ink)] bg-[#f8c1b4] p-6 text-center shadow-[4px_4px_0_var(--ink)]">
              <AlertTriangle className="mx-auto mb-3" />
              <p className="font-display text-xl font-bold">The shelf is offline</p>
              <p className="mt-2 text-xs leading-5 text-[#5e3935]">Built-in problems could not be loaded. Check the API server, then refresh this workspace.</p>
              <button type="button" onClick={() => problemsQuery.refetch()} data-testid="button-retry-problems" className="mt-4 rounded-[6px] border-2 border-[var(--ink)] bg-[#f7f1e4] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5">Retry shelf</button>
            </div>
          </div>
        ) : problems.length === 0 ? (
          <div className="grid-paper flex min-h-[470px] items-center justify-center p-8 text-center">
            <div><Database className="mx-auto mb-3 text-[#258b88]" size={28} /><p className="font-display text-xl font-bold">No specimens yet</p><p className="mt-1 text-sm text-[var(--ink-soft)]">The problem shelf is empty.</p></div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <ProblemShelf problems={problems} selectedId={selectedId} onSelect={chooseProblem} />
            <div className="min-w-0 flex-1 bg-[#f1e8d8]">
              <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_330px]">
                <div className="min-w-0 border-b-2 border-[var(--ink)] xl:border-b-0 xl:border-r-2">
                  <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-bold">{problem?.title ?? "Free code"}</p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">{problem ? `${problem.difficulty} / editable fixture` : "no specimen selected"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={handleClear} data-testid="button-clear-workspace" className="flex items-center gap-1.5 rounded-[6px] border-2 border-[var(--ink)] bg-[#f7f1e4] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5 hover:bg-[#fffdf7] hover:shadow-[2px_2px_0_var(--ink)]">Clear</button>
                      <span className="hidden items-center gap-1.5 rounded-full border border-[#b7aa96] bg-[#f7f1e4] px-2.5 py-1.5 font-mono text-[9px] uppercase text-[var(--ink-soft)] sm:flex"><Code2 size={12} /> cpp</span>
                    </div>
                  </div>
                  <CodeEditor code={code} setCode={setCode} isPending={submission.isPending || trace.isPending} onReset={handleReset} />
                </div>
                <aside className="grid-paper min-h-[290px] bg-[#e9dfce] p-5 sm:p-6">
                  <div>
                    <div className="mb-5 flex items-center gap-2">
                      <BookOpen size={17} className="text-[#258b88]" />
                      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.17em]">briefing</p>
                    </div>
                    {problemQuery.isLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 w-3/4 animate-pulse bg-[#d7cbb8]" />
                        <div className="h-4 w-full animate-pulse bg-[#d7cbb8]" />
                        <div className="h-4 w-5/6 animate-pulse bg-[#d7cbb8]" />
                      </div>
                    ) : problem ? (
                      <>
                        <p className="text-sm leading-6 text-[var(--ink-soft)]" data-testid="text-problem-description">{problem.description}</p>
                        {problem.testCases.length > 0 && (
                          <div className="mt-5 border-t border-[#b7aa96] pt-4">
                            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--ink-soft)]">example</p>
                            <div className="overflow-hidden rounded-[6px] border-2 border-[#b7aa96]">
                              <div className="grid grid-cols-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                                <div className="border-b border-r border-[#b7aa96] bg-[#f1e8d8] px-2 py-1.5">input</div>
                                <div className="border-b border-[#b7aa96] bg-[#f1e8d8] px-2 py-1.5">output</div>
                              </div>
                              <pre className="whitespace-pre-wrap break-words border-b border-r border-[#b7aa96] bg-[#f7f1e4] px-2 py-1.5 font-mono text-[11px] leading-5 text-[var(--ink)]">{problem.testCases[0].input}</pre>
                              <pre className="whitespace-pre-wrap break-words bg-[#f7f1e4] px-2 py-1.5 font-mono text-[11px] leading-5 text-[var(--ink)]">{problem.testCases[0].expectedOutput}</pre>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-[var(--ink-soft)]" data-testid="text-no-problem">No problem selected. Write your own code and use <span className="font-mono">Run once</span> to execute it.</p>
                    )}
                    <div className="mt-6 border-t border-[#b7aa96] pt-4">
                      <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--ink-soft)]">trace stdin</span><span className="font-mono text-[9px] text-[#258b88]">optional</span></div>
                      <textarea value={traceInput} onChange={(event) => setTraceInput(event.target.value)} data-testid="input-trace-stdin" className="h-20 w-full resize-none rounded-[6px] border-2 border-[#a99880] bg-[#f7f1e4] p-2.5 font-mono text-[11px] leading-5 outline-none transition-shadow focus:border-[var(--ink)] focus:shadow-[2px_2px_0_var(--ink)]" placeholder="Input passed to main() — leave empty to reuse the sample input" />
                      <p className="mt-2 text-[10px] leading-4 text-[var(--ink-soft)]">Leave empty to reuse the problem's sample input. Large inputs may produce very long traces.</p>
                    </div>
                    <RawOutputPanel run={rawRun} isRunning={isRunningOnce} onRun={handleRunOnce} />
                  </div>
                  <div className="mt-6 flex flex-col gap-2 self-end">
                    <button type="button" onClick={handleTrace} disabled={trace.isPending || !code.trim()} data-testid="button-visualize-trace" className="flex items-center justify-center gap-2 rounded-[7px] border-2 border-[var(--ink)] bg-[#63c9c2] px-4 py-3 font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-55">
                      {trace.isPending ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />} {trace.isPending ? "capturing..." : "Visualize execution"}
                    </button>
                    <button type="button" onClick={handleJudge} disabled={submission.isPending || !selectedId || !code.trim()} data-testid="button-run-judge" className="flex items-center justify-center gap-2 rounded-[7px] border-2 border-[var(--ink)] bg-[#f27f6a] px-4 py-3 font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-55">
                      {submission.isPending ? <Loader2 className="animate-spin" size={16} /> : <CirclePlay size={16} />} {submission.isPending ? "running tests..." : "Run judge"}
                    </button>
                  </div>
                </aside>
              </div>
              {notice && <div className="mx-4 mt-4 flex items-start gap-2 rounded-[7px] border-2 border-[#9e4039] bg-[#f8c1b4] px-3 py-2.5 text-xs leading-5 text-[#542c2a] sm:mx-5" data-testid="status-runtime-error"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{notice}</span></div>}
              <ResultPanel result={result} />
            </div>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-[var(--ink)] bg-[#f7f1e4] px-4 py-3 sm:px-7">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--ink-soft)]"><span className="h-2 w-2 rounded-full bg-[#63c9c2]" /> sandbox connected</div>
          <div className="flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--ink-soft)]"><span>stdin aware</span><span>line-by-line ready</span></div>
        </footer>
      </div>
    </CockpitShell>
  );
}