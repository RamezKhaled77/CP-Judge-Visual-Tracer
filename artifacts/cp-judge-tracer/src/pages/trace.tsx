import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import type { TraceArray, TraceLocal, TraceResult, TraceStep } from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, Braces, ChevronLeft, ChevronRight, CirclePause, CirclePlay, Clock3, Layers3, Maximize2, RefreshCw, Terminal, X } from "lucide-react";
import { CockpitShell } from "@/components/cockpit-shell";

function EmptyTrace() {
  return (
    <div className="grid-paper flex min-h-[calc(100dvh-68px)] items-center justify-center p-8">
      <div className="max-w-md rounded-[12px] border-2 border-[var(--ink)] bg-[#f7f1e4] p-8 text-center shadow-[5px_5px_0_var(--ink)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[12px] border-2 border-[var(--ink)] bg-[#63c9c2]"><Terminal size={25} /></div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-soft)]">trace player</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">Nothing paused here yet.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Capture a run from the workbench and the player will hold every line, local, frame, and array state for inspection.</p>
        <Link href="/" data-testid="link-return-workbench" className="mt-6 inline-flex items-center gap-2 rounded-[7px] border-2 border-[var(--ink)] bg-[#f27f6a] px-4 py-3 font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)]"><ArrowLeft size={16} /> Return to workbench</Link>
      </div>
    </div>
  );
}

function StepRail({ trace, activeStep, onSelect }: { trace: TraceStep[]; activeStep: number; onSelect: (index: number) => void }) {
  return (
    <aside className="thin-scrollbar flex w-full shrink-0 gap-2 overflow-x-auto border-b-2 border-[var(--ink)] bg-[#e9dfce] p-3 lg:w-[170px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r-2 lg:p-4">
      <div className="hidden pb-2 lg:block">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">timeline</p>
        <p className="mt-1 font-display text-lg font-bold">{trace.length} moments</p>
      </div>
      {trace.map((item, index) => (
        <button
          key={`${item.step}-${item.line}`}
          type="button"
          onClick={() => onSelect(index)}
          data-testid={`button-trace-step-${item.step}`}
          className={`min-w-[105px] rounded-[8px] border-2 px-3 py-2.5 text-left transition-all lg:min-w-0 ${activeStep === index ? "border-[var(--ink)] bg-[#f27f6a] shadow-[3px_3px_0_var(--ink)]" : "border-transparent bg-[#f1e8d8] hover:border-[var(--ink)]"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-medium">#{String(item.step).padStart(2, "0")}</span>
            <span className="font-mono text-[9px] text-[var(--ink-soft)]">L{item.line}</span>
          </div>
          <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--ink-soft)]">{item.function}</p>
        </button>
      ))}
    </aside>
  );
}

function SourcePanel({ source, activeLine }: { source: string; activeLine: number }) {
  const lines = source.split("\n");
  return (
    <section className="flex min-h-[405px] min-w-0 flex-1 flex-col bg-[#24373a]">
      <div className="flex items-center justify-between border-b border-[#496264] px-4 py-3 text-[#c4d0c8]">
        <div className="flex items-center gap-2"><Terminal size={15} className="text-[#63c9c2]" /><span className="font-mono text-[10px] uppercase tracking-[0.15em]">captured source</span></div>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#789492]">read only</span>
      </div>
      <div className="thin-scrollbar flex-1 overflow-auto py-4 font-mono text-[12px] leading-[1.75]" data-testid="panel-trace-source">
        {lines.map((line, index) => (
          <div key={`${index}-${line}`} className={`flex min-w-max px-4 ${activeLine === index + 1 ? "active-line text-[#fff4df]" : "text-[#bed0c4]"}`}>
            <span className="line-number inline-block w-8 shrink-0 pr-3 text-right">{index + 1}</span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LocalsPanel({ locals }: { locals: TraceLocal[] }) {
  return (
    <section className="min-w-0 border-b-2 border-[var(--ink)] bg-[#f7f1e4] p-4 xl:border-b-0 xl:border-r-2">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Braces size={15} className="text-[#e66f5c]" /><p className="font-mono text-[10px] uppercase tracking-[0.15em]">locals</p></div><span className="font-mono text-[9px] text-[var(--ink-soft)]">{locals.length} vars</span></div>
      {locals.length === 0 ? <p className="rounded border border-dashed border-[#b7aa96] p-3 text-xs text-[var(--ink-soft)]">No local values at this line.</p> : <div className="space-y-2">{locals.map((local) => <div key={local.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[6px] border border-[#cbbfac] bg-[#eee5d6] px-2.5 py-2"><div className="min-w-0"><p className="truncate font-mono text-[11px] font-medium">{local.name}</p><p className="truncate font-mono text-[9px] text-[var(--ink-soft)]">{local.type}</p></div><p className="max-w-[110px] truncate rounded bg-[#f2cc68] px-1.5 py-0.5 font-mono text-[11px]" data-testid={`text-local-${local.name}`}>{local.value}</p></div>)}</div>}
    </section>
  );
}

function StackPanel({ stack }: { stack: TraceStep["stack"] }) {
  return (
    <section className="min-w-0 border-b-2 border-[var(--ink)] bg-[#f1e8d8] p-4 xl:border-b-0">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Layers3 size={15} className="text-[#258b88]" /><p className="font-mono text-[10px] uppercase tracking-[0.15em]">call stack</p></div><span className="font-mono text-[9px] text-[var(--ink-soft)]">{stack.length} frames</span></div>
      {stack.length === 0 ? <p className="rounded border border-dashed border-[#b7aa96] p-3 text-xs text-[var(--ink-soft)]">Stack is empty.</p> : <div className="space-y-2">{stack.map((frame, index) => <div key={`${frame.function}-${frame.line}-${index}`} className={`flex items-center justify-between rounded-[6px] border px-2.5 py-2 font-mono text-[10px] ${index === 0 ? "border-[var(--ink)] bg-[#63c9c2]" : "border-[#cbbfac] bg-[#e9dfce]"}`}><span className="truncate">{frame.function}</span><span className="ml-2 text-[var(--ink-soft)]">L{frame.line}</span></div>)}</div>}
    </section>
  );
}

function ArraysPanel({ arrays }: { arrays: TraceArray[] }) {
  if (!arrays.length) return null;
  return (
    <section className="border-t-2 border-[var(--ink)] bg-[#e9dfce] p-4 sm:p-5" data-testid="panel-trace-arrays">
      <div className="mb-3 flex items-center gap-2"><DatabaseIcon /><p className="font-mono text-[10px] uppercase tracking-[0.15em]">data structures</p><span className="font-mono text-[9px] text-[var(--ink-soft)]">observed in frame</span></div>
      <div className="flex gap-4 overflow-x-auto pb-1">{arrays.map((array) => <div key={array.name} className="min-w-[220px] rounded-[8px] border-2 border-[var(--ink)] bg-[#f7f1e4] p-3 shadow-[3px_3px_0_rgba(25,42,46,0.2)]"><div className="mb-2 flex items-center justify-between"><span className="font-mono text-xs font-medium">{array.name}</span><span className="font-mono text-[9px] text-[var(--ink-soft)]">{array.type}</span></div><div className="flex gap-1">{array.values.map((value, index) => <div key={`${value}-${index}`} className="flex h-8 min-w-8 items-center justify-center rounded-[4px] border border-[#b7aa96] bg-[#f2cc68] px-1 font-mono text-[10px]">{value}</div>)}</div></div>)}</div>
    </section>
  );
}

function DatabaseIcon() {
  return <span className="flex h-5 w-5 items-center justify-center rounded-[4px] border-2 border-[var(--ink)] bg-[#7ca8ef]"><span className="h-2 w-2 rounded-full bg-[var(--ink)]" /></span>;
}

export default function Trace() {
  const [traceResult] = useState<TraceResult | null>(() => {
    try {
      const raw = sessionStorage.getItem("cp-trace-result");
      return raw ? JSON.parse(raw) as TraceResult : null;
    } catch {
      return null;
    }
  });
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || !traceResult?.trace.length) return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        if (current >= traceResult.trace.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [isPlaying, traceResult?.trace.length]);

  const current = traceResult?.trace[activeStep];
  const source = useMemo(() => traceResult?.source ?? "", [traceResult?.source]);

  if (!traceResult) return <CockpitShell><EmptyTrace /></CockpitShell>;

  const reset = () => {
    setIsPlaying(false);
    setActiveStep(0);
  };

  return (
    <CockpitShell>
      <div className="flex min-h-[calc(100dvh-68px)] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[#f7f1e4] px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Link href="/" data-testid="link-trace-back" className="flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-[var(--ink)] bg-[#e9dfce] transition-transform hover:-translate-x-0.5"><ArrowLeft size={15} /></Link>
            <div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">captured run / debugger view</p><p className="font-display text-xl font-bold tracking-[-0.04em]">Execution trace</p></div>
          </div>
          <div className="flex items-center gap-2">{traceResult.truncated && <span className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[#f2cc68] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em]"><Maximize2 size={11} /> trace truncated</span>}<span className="rounded-full border-2 border-[var(--ink)] bg-[#63c9c2] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em]">{traceResult.trace.length} steps</span></div>
        </div>
        {traceResult.error && <div className="mx-4 mt-4 flex items-start gap-2 rounded-[7px] border-2 border-[#9e4039] bg-[#f8c1b4] px-3 py-2.5 text-xs leading-5 text-[#542c2a] sm:mx-6" data-testid="status-trace-error"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{traceResult.error}</span></div>}
        {traceResult.trace.length === 0 ? <div className="grid-paper flex flex-1 items-center justify-center p-8"><div className="text-center"><X className="mx-auto mb-3 text-[#e66f5c]" /><p className="font-display text-2xl font-bold">No executable moments</p><p className="mt-1 text-sm text-[var(--ink-soft)]">The sandbox returned no trace steps. Check the runtime message above.</p></div></div> : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <StepRail trace={traceResult.trace} activeStep={activeStep} onSelect={(index) => { setActiveStep(index); setIsPlaying(false); }} />
            <div className="min-w-0 flex-1 bg-[#f1e8d8]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[#e9dfce] px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]"><span className="rounded bg-[#f27f6a] px-2 py-1">step {String(current?.step ?? 0).padStart(2, "0")}</span><span className="text-[var(--ink-soft)]">line {current?.line} / {current?.function}</span></div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={reset} data-testid="button-reset-trace" className="flex h-8 items-center gap-1.5 rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] px-2.5 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors hover:bg-[#f2cc68]"><RefreshCw size={12} /> reset</button>
                  <button type="button" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0} data-testid="button-previous-step" className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"><ChevronLeft size={16} /></button>
                  <button type="button" onClick={() => setIsPlaying((playing) => !playing)} data-testid="button-play-trace" className="flex h-8 items-center gap-1.5 rounded-[5px] border-2 border-[var(--ink)] bg-[#63c9c2] px-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] transition-transform hover:-translate-y-0.5">{isPlaying ? <CirclePause size={13} /> : <CirclePlay size={13} />}{isPlaying ? "pause" : "play"}</button>
                  <button type="button" onClick={() => setActiveStep((step) => Math.min(traceResult.trace.length - 1, step + 1))} disabled={activeStep === traceResult.trace.length - 1} data-testid="button-next-step" className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"><ChevronRight size={16} /></button>
                </div>
              </div>
              <div className="flex min-h-0 flex-col xl:flex-row">
                <SourcePanel source={source} activeLine={current?.line ?? 0} />
                <div className="grid min-w-0 flex-1 grid-cols-1 bg-[#f7f1e4] sm:grid-cols-2 xl:block xl:w-[370px] xl:flex-none">
                  <LocalsPanel locals={current?.locals ?? []} />
                  <StackPanel stack={current?.stack ?? []} />
                </div>
              </div>
              <ArraysPanel arrays={current?.arrays ?? []} />
              <div className="flex items-center justify-between border-t border-[#b7aa96] bg-[#f7f1e4] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-soft)] sm:px-5"><span className="flex items-center gap-2"><Clock3 size={13} /> paused at line {current?.line}</span><span>frame {activeStep + 1} of {traceResult.trace.length}</span></div>
            </div>
          </div>
        )}
      </div>
    </CockpitShell>
  );
}