import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useParams } from "wouter";
import { useGetTrace, getGetTraceQueryKey } from "@workspace/api-client-react";
import type { TraceArray, TraceLocal, TraceResult, TraceStep } from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePause,
  CirclePlay,
  Clock3,
  FastForward,
  Gauge,
  HelpCircle,
  Keyboard,
  Layers3,
  Loader2,
  Maximize2,
  Moon,
  RefreshCw,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import { CockpitShell } from "@/components/cockpit-shell";
import { CollapsibleGroup } from "@/components/collapsible-group";
import { useEditorTheme } from "@/lib/editor-theme";

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

function EmptyTrace() {
  return (
    <div className="grid-paper flex min-h-[calc(100dvh-68px)] items-center justify-center p-8">
      <div className="max-w-md rounded-[12px] border-2 border-[var(--ink)] bg-[#f7f1e4] p-8 text-center shadow-[5px_5px_0_var(--ink)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[12px] border-2 border-[var(--ink)] bg-[#63c9c2]">
          <Terminal size={25} />
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-soft)]">trace player</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">Nothing paused here yet.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
          Capture a run from the workbench and the player will hold every line, local, frame, and array state for inspection.
        </p>
        <Link
          href="/"
          data-testid="link-return-workbench"
          className="mt-6 inline-flex items-center gap-2 rounded-[7px] border-2 border-[var(--ink)] bg-[#f27f6a] px-4 py-3 font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)]"
        >
          <ArrowLeft size={16} /> Return to workbench
        </Link>
      </div>
    </div>
  );
}

function LoadingTrace() {
  return (
    <div className="grid-paper flex min-h-[calc(100dvh-68px)] items-center justify-center p-8">
      <div className="flex items-center gap-3 rounded-[10px] border-2 border-[var(--ink)] bg-[var(--cream)] px-6 py-5 shadow-[4px_4px_0_var(--ink)]">
        <Loader2 className="animate-spin text-[#258b88]" size={20} />
        <span className="font-mono text-xs uppercase tracking-[0.14em]">loading saved trace</span>
      </div>
    </div>
  );
}

function TraceNotFound() {
  return (
    <div className="grid-paper flex min-h-[calc(100dvh-68px)] items-center justify-center p-8">
      <div className="max-w-md rounded-[12px] border-2 border-[var(--ink)] bg-[#f8c1b4] p-8 text-center shadow-[5px_5px_0_var(--ink)]">
        <AlertTriangle className="mx-auto mb-4 text-[#9e4039]" size={32} />
        <h1 className="font-display text-2xl font-bold">Trace not found</h1>
        <p className="mt-2 text-sm leading-6 text-[#542c2a]">
          The requested execution trace does not exist or may have expired from temporary storage.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-[7px] border-2 border-[var(--ink)] bg-[#f7f1e4] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5"
        >
          <ArrowLeft size={14} /> Back to workbench
        </Link>
      </div>
    </div>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

const GROUP_THRESHOLD = 20;
const CHUNK_SIZE = 5;
const HEADER_SIZE = 36;

function StepRail({
  trace,
  activeStep,
  onSelect,
}: {
  trace: TraceStep[];
  activeStep: number;
  onSelect: (index: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const isDesktop = useIsDesktop();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  // Which step groups are collapsed. Absent => collapsed (default).
  const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});

  const filteredSteps = useMemo(() => {
    if (!filter.trim()) return trace.map((item, index) => ({ item, index }));
    const query = filter.trim().toLowerCase();
    return trace
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item, index }) =>
          item.function.toLowerCase().includes(query) ||
          String(item.line).includes(query) ||
          String(index).includes(query) ||
          String(item.step).includes(query),
      );
  }, [trace, filter]);

  const filterActive = filter.trim().length > 0;
  const useGroups = !filterActive && trace.length > GROUP_THRESHOLD;

  // Chunk the (flat) timeline into groups of CHUNK_SIZE consecutive steps.
  const groups = useMemo(() => {
    const out: { start: number; end: number; size: number; index: number }[] = [];
    for (let i = 0; i < trace.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, trace.length);
      out.push({ start: i, end, size: end - i, index: Math.floor(i / CHUNK_SIZE) });
    }
    return out;
  }, [trace]);

  const itemSize = isDesktop ? 72 : 121;

  // When playing back, make sure the current step's group is expanded so the
  // active step is never hidden inside a collapsed group.
  useEffect(() => {
    if (!useGroups) return;
    const gi = Math.floor(activeStep / CHUNK_SIZE);
    setCollapsedGroups((prev) => (prev[gi] ? { ...prev, [gi]: false } : prev));
  }, [activeStep, useGroups]);

  // Keep the active step in view as playback advances (works for both the flat
  // and the grouped/windowed layouts).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let target: number | null = null;
    if (useGroups) {
      let acc = 0;
      for (const g of groups) {
        const open = !collapsedGroups[g.index];
        const h = HEADER_SIZE + (open ? g.size * itemSize : 0);
        if (g.index === Math.floor(activeStep / CHUNK_SIZE)) {
          target = acc;
          break;
        }
        acc += h;
      }
    } else {
      const activeIdx = filteredSteps.findIndex(({ index }) => index === activeStep);
      if (activeIdx < 0) return;
      target = activeIdx * itemSize;
    }
    if (target == null) return;
    const viewStart = isDesktop ? el.scrollTop : el.scrollLeft;
    const viewSize = isDesktop ? el.clientHeight : el.clientWidth;
    if (target < viewStart || target + itemSize > viewStart + viewSize) {
      const t = Math.max(0, target - viewSize / 2 + itemSize / 2);
      el.scrollTo({ [isDesktop ? "top" : "left"]: t, behavior: "smooth" });
    }
  }, [activeStep, useGroups, filteredSteps, groups, collapsedGroups, itemSize, isDesktop]);

  // Reset scroll position whenever the filter changes the list contents.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ [isDesktop ? "top" : "left"]: 0 });
    setScroll(0);
  }, [filter, isDesktop]);

  const renderStepButton = ({ item, index }: { item: TraceStep; index: number }) => (
    <button
      key={`${item.step}-${item.line}-${index}`}
      type="button"
      onClick={() => onSelect(index)}
      data-testid={`button-trace-step-${item.step}`}
      style={{ height: itemSize }}
      className={`flex min-w-[105px] flex-col justify-center rounded-[8px] border-2 px-3 text-left transition-all lg:min-w-0 ${
        activeStep === index
          ? "border-[var(--ink)] bg-[#f27f6a] shadow-[3px_3px_0_var(--ink)]"
          : "border-transparent bg-[#f1e8d8] hover:border-[var(--ink)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium">#{String(item.step).padStart(2, "0")}</span>
        <span className="font-mono text-[9px] text-[var(--ink-soft)]">L{item.line}</span>
      </div>
      <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--ink-soft)]">
        {item.function}
      </p>
    </button>
  );

  // ---- Flat (short or filtered) layout: keep the original windowed list ----
  const viewport = scrollRef.current
    ? isDesktop
      ? scrollRef.current.clientHeight
      : scrollRef.current.clientWidth
    : isDesktop
      ? 520
      : 110;
  const visibleCount = Math.ceil(viewport / itemSize) + 4;
  const start = Math.max(0, Math.floor(scroll / itemSize) - 2);
  const end = Math.min(filteredSteps.length, start + visibleCount);
  const windowItems = filteredSteps.slice(start, end);
  const spacerBefore = start * itemSize;
  const spacerAfter = (filteredSteps.length - end) * itemSize;

  // ---- Grouped layout: window over groups, each group uses the shared
  // collapsible animation. ----
  let groupPositions: { top: number; height: number }[] = [];
  let groupTotal = 0;
  if (useGroups) {
    let acc = 0;
    groupPositions = groups.map((g) => {
      const open = !collapsedGroups[g.index];
      const h = HEADER_SIZE + (open ? g.size * itemSize : 0);
      const top = acc;
      acc += h;
      return { top, height: h };
    });
    groupTotal = acc;
  }
  const overscan = itemSize * 3;
  const visibleGroups = useGroups
    ? groups.filter((g, i) => {
        const p = groupPositions[i];
        return p.top + p.height > scroll - overscan && p.top < scroll + viewport + overscan;
      })
    : [];
  const groupSpacerBefore = visibleGroups.length ? groupPositions[groups.indexOf(visibleGroups[0])].top : 0;
  const lastGroup = visibleGroups.length ? visibleGroups[visibleGroups.length - 1] : null;
  const lastIdx = lastGroup ? groups.indexOf(lastGroup) : -1;
  const groupSpacerAfter =
    useGroups && lastIdx >= 0 ? Math.max(0, groupTotal - (groupPositions[lastIdx].top + groupPositions[lastIdx].height)) : 0;

  return (
    <aside className="thin-scrollbar flex w-full shrink-0 flex-col border-b-2 border-[var(--ink)] bg-[#e9dfce] p-3 lg:w-[190px] lg:border-b-0 lg:border-r-2 lg:p-4">
      <div className="mb-2 hidden lg:block">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">timeline</p>
        <p className="mt-1 font-display text-lg font-bold">{trace.length} moments</p>
      </div>

      <div className="relative mb-2 shrink-0">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter steps..."
          aria-label="Filter steps"
          className="w-full rounded-[6px] border border-[#cbbfac] bg-[#f7f1e4] py-1.5 pl-7 pr-6 font-mono text-[10px] outline-none transition-colors focus:border-[var(--ink)]"
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => setScroll(isDesktop ? e.currentTarget.scrollTop : e.currentTarget.scrollLeft)}
        className="thin-scrollbar flex gap-2 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-y-auto"
      >
        {useGroups ? (
          groups.length === 0 ? (
            <div className="py-4 text-center font-mono text-[10px] text-[var(--ink-soft)]">No moments</div>
          ) : (
            <>
              <div aria-hidden style={isDesktop ? { height: groupSpacerBefore } : { width: groupSpacerBefore }} />
              {visibleGroups.map((g) => {
                const slice = trace.slice(g.start, g.end);
                const lines = slice.map((s) => s.line);
                const lo = Math.min(...lines);
                const hi = Math.max(...lines);
                return (
                  <CollapsibleGroup
                    key={g.index}
                    dataTestId={`group-steps-${g.index}`}
                    collapsed={!collapsedGroups[g.index]}
                    onCollapsedChange={(next) => setCollapsedGroups((prev) => ({ ...prev, [g.index]: !next }))}
                    headerClassName={isDesktop ? "h-[36px]" : "h-[46px]"}
                    label={
                      <span className="flex flex-col items-start leading-tight">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                          Steps {g.start}–{g.end - 1}
                        </span>
                        <span className="font-mono text-[8px] text-[#9a7a12]">
                          L{lo}–L{hi}
                        </span>
                      </span>
                    }
                    summary={
                      <>
                        {collapsedGroups[g.index] ? "+" : "−"} {String(g.size).padStart(2, "0")}
                      </>
                    }
                  >
                    {slice.map((item, k) => renderStepButton({ item, index: g.start + k }))}
                  </CollapsibleGroup>
                );
              })}
              <div aria-hidden style={isDesktop ? { height: groupSpacerAfter } : { width: groupSpacerAfter }} />
            </>
          )
        ) : filteredSteps.length === 0 ? (
          <div className="py-4 text-center font-mono text-[10px] text-[var(--ink-soft)]">No matching moments</div>
        ) : (
          <>
            <div aria-hidden style={isDesktop ? { height: spacerBefore } : { width: spacerBefore }} />
            {windowItems.map(({ item, index }) => renderStepButton({ item, index }))}
            <div aria-hidden style={isDesktop ? { height: spacerAfter } : { width: spacerAfter }} />
          </>
        )}
      </div>
    </aside>
  );
}

function SourcePanel({
  source,
  activeLine,
  problemName,
}: {
  source: string;
  activeLine: number;
  problemName?: string | null;
}) {
  const lines = source.split("\n");
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const { theme, toggle } = useEditorTheme();
  const isDark = theme === "dark";

  const chrome = isDark
    ? {
        section: "bg-[#24373a]",
        border: "border-[#496264]",
        barText: "text-[#c4d0c8]",
        icon: "text-[#63c9c2]",
        muted: "text-[#789492]",
        active: "bg-[#344e51] text-[#fff4df]",
        lineText: "text-[#bed0c4]",
        lineNumber: "text-[#6b8684]",
        btnBorder: "border-[#496264]",
        btnText: "text-[#a4bdb6]",
        btnHover: "hover:border-[#63c9c2] hover:text-[#63c9c2]",
      }
    : {
        section: "bg-[#f6f8fa]",
        border: "border-[#d0d7de]",
        barText: "text-[#57606a]",
        icon: "text-[#0b6e6a]",
        muted: "text-[#57606a]",
        active: "bg-[#eaeef0] text-[#1f2328]",
        lineText: "text-[#24292f]",
        lineNumber: "text-[#6a737d]",
        btnBorder: "border-[#d0d7de]",
        btnText: "text-[#57606a]",
        btnHover: "hover:border-[#0b6e6a] hover:text-[#0b6e6a]",
      };

  useEffect(() => {
    const activeEl = lineRefs.current[activeLine];
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeLine]);

  return (
    <section className={`flex min-h-[405px] min-w-0 flex-1 flex-col ${chrome.section}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${chrome.border} ${chrome.barText}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Terminal size={15} className={chrome.icon} />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] sm:inline">captured source</span>
          {problemName && (
            <span
              className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${isDark ? "border-[#63c9c2]/40 bg-[#63c9c2]/15 text-[#cdeeea]" : "border-[#0b6e6a]/30 bg-[#0b6e6a]/10 text-[#0b6e6a]"}`}
              title="Problem being traced"
              data-testid="text-source-problem"
            >
              <BookOpen size={11} className={chrome.icon} />
              <span className="truncate">{problemName}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{chrome.muted}</span>
          <button
            type="button"
            onClick={toggle}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle source view theme"
            data-testid="button-toggle-source-theme"
            className={`flex items-center rounded border px-1.5 py-1 transition-colors ${chrome.btnBorder} ${chrome.btnText} ${chrome.btnHover}`}
          >
            {isDark ? <Sun size={12} /> : <Moon size={12} />}
          </button>
        </div>
      </div>
      <div
        className="thin-scrollbar flex-1 overflow-auto py-4 font-mono text-[12px] leading-[1.75]"
        data-testid="panel-trace-source"
      >
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const isActive = activeLine === lineNumber;
          return (
            <div
              key={`${index}-${line}`}
              ref={(el) => {
                lineRefs.current[lineNumber] = el;
              }}
              className={`flex min-w-max px-4 transition-colors ${isActive ? `active-line ${chrome.active}` : chrome.lineText}`}
            >
              <span className={`line-number inline-block w-8 shrink-0 pr-3 text-right ${chrome.lineNumber}`}>{lineNumber}</span>
              <span className="whitespace-pre">{line || " "}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LocalsPanel({ locals, previousLocals }: { locals: TraceLocal[]; previousLocals: TraceLocal[] }) {
  const previous = new Map(previousLocals.map((local) => [local.name, local.value]));
  return (
    <section className="min-w-0 border-b-2 border-[var(--ink)] bg-[#f7f1e4] p-4 xl:border-b-0 xl:border-r-2">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Braces size={15} className="text-[#e66f5c]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]">locals</p>
        </div>
        <span className="font-mono text-[9px] text-[var(--ink-soft)]">{locals.length} vars</span>
      </div>
      {locals.length === 0 ? (
        <p className="rounded border border-dashed border-[#b7aa96] p-3 text-xs text-[var(--ink-soft)]">
          No local values at this line.
        </p>
      ) : (
        <div className="space-y-2">
          {locals.map((local) => {
            const changed = previous.has(local.name) && previous.get(local.name) !== local.value;
            return (
              <div
                key={local.name}
                className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[6px] border px-2.5 py-2 transition-colors ${
                  changed ? "border-[var(--ink)] bg-[#f2cc68]" : "border-[#cbbfac] bg-[#eee5d6]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] font-medium">{local.name}</p>
                  <p className="truncate font-mono text-[9px] text-[var(--ink-soft)]">{local.type}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <p
                    className="max-w-[110px] truncate rounded bg-[#f7f1e4] px-1.5 py-0.5 font-mono text-[11px]"
                    data-testid={`text-local-${local.name}`}
                  >
                    {local.value}
                  </p>
                  {changed && <span className="font-mono text-[8px] uppercase tracking-[0.08em]">changed</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StackPanel({ stack }: { stack: TraceStep["stack"] }) {
  return (
    <section className="min-w-0 border-b-2 border-[var(--ink)] bg-[#f1e8d8] p-4 xl:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 size={15} className="text-[#258b88]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]">call stack</p>
        </div>
        <span className="font-mono text-[9px] text-[var(--ink-soft)]">{stack.length} frames</span>
      </div>
      {stack.length === 0 ? (
        <p className="rounded border border-dashed border-[#b7aa96] p-3 text-xs text-[var(--ink-soft)]">
          Stack is empty.
        </p>
      ) : (
        <div className="space-y-2">
          {stack.map((frame, index) => (
            <div
              key={`${frame.function}-${frame.line}-${index}`}
              className={`flex items-center justify-between rounded-[6px] border px-2.5 py-2 font-mono text-[10px] ${
                index === 0 ? "border-[var(--ink)] bg-[#63c9c2]" : "border-[#cbbfac] bg-[#e9dfce]"
              }`}
            >
              <span className="truncate">{frame.function}</span>
              <span className="ml-2 text-[var(--ink-soft)]">L{frame.line}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Collapse noisy STL type names into a readable form: drop the `std::` prefix
// and the default allocator template argument (e.g. `std::vector<int,
// std::allocator<int>>` -> `vector<int>`).
function simplifyType(type: string): string {
  let t = type.replace(/^std::/, "").replace(/std::/g, "");
  t = t.replace(/,\s*std::allocator<[^>]*>/g, "");
  t = t.replace(/,\s*allocator<[^>]*>/g, "");
  t = t.replace(/basic_string/g, "string");
  return t;
}

const MAX_RENDERED_CELLS = 50;

function ArraysPanel({
  arrays,
  highlights = [],
}: {
  arrays: TraceArray[];
  highlights?: { array: string; index: number; expr: string }[];
}) {
  if (!arrays.length) return null;
  return (
    <section className="border-t-2 border-[var(--ink)] bg-[#e9dfce] p-4 sm:p-5" data-testid="panel-trace-arrays">
      <div className="mb-3 flex items-center gap-2">
        <DatabaseIcon />
        <p className="font-mono text-[10px] uppercase tracking-[0.15em]">data structures</p>
        <span className="font-mono text-[9px] text-[var(--ink-soft)]">observed in frame</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {arrays.map((array) => {
          const active = new Map(
            highlights
              .filter((h) => h.array === array.name)
              .map((h) => [h.index, h.expr] as const),
          );
          const shown = array.values.slice(0, MAX_RENDERED_CELLS);
          const extra = array.values.length - shown.length;
          return (
            <div
              key={array.name}
              className="flex min-w-[220px] flex-col rounded-[8px] border-2 border-[var(--ink)] bg-[#f7f1e4] p-3 shadow-[3px_3px_0_rgba(25,42,46,0.2)]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium">{array.name}</span>
                <span className="font-mono text-[9px] text-[var(--ink-soft)]" title={array.type}>
                  {simplifyType(array.type)}
                </span>
              </div>
              <div className="array-scroll thin-scrollbar overflow-x-auto">
                <div className="flex min-w-max gap-1 pb-0.5">
                  {shown.map((value, index) => {
                    const expr = active.get(index);
                    const isActive = expr !== undefined;
                    return (
                      <div key={index} className="flex flex-col items-center gap-0.5">
                        {array.indexable && (
                          <span
                            className={`font-mono text-[8px] ${isActive ? "font-bold text-[#9e4039]" : "text-[var(--ink-soft)]"}`}
                          >
                            {index}
                          </span>
                        )}
                        <div
                          className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-1 font-mono text-[10px] ${
                            isActive
                              ? "border-[#9e4039] bg-[#f8c1b4]"
                              : "border-[#b7aa96] bg-[#f2cc68]"
                          }`}
                          title={expr ? `${array.name}[${expr}]` : undefined}
                        >
                          {value}
                        </div>
                        {isActive && (
                          <span className="font-mono text-[8px] font-bold text-[#9e4039]">{expr}</span>
                        )}
                      </div>
                    );
                  })}
                  {extra > 0 && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-[8px] text-[var(--ink-soft)]">…</span>
                      <div className="flex h-8 items-center justify-center rounded-[4px] border border-dashed border-[#b7aa96] bg-[#eee5d6] px-2 font-mono text-[10px] text-[var(--ink-soft)]">
                        +{extra}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {array.values.length > MAX_RENDERED_CELLS && (
                <p className="mt-1 font-mono text-[8px] text-[var(--ink-soft)]">
                  showing first {MAX_RENDERED_CELLS} of {array.values.length} elements
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DatabaseIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-[4px] border-2 border-[var(--ink)] bg-[#7ca8ef]">
      <span className="h-2 w-2 rounded-full bg-[var(--ink)]" />
    </span>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const shortcuts = [
    { key: "Space", desc: "Play / Pause playback" },
    { key: "← / →", desc: "Step backward / forward" },
    { key: "Home / End", desc: "Jump to first / last step" },
    { key: "R", desc: "Reset timeline to beginning" },
    { key: "1 - 5", desc: "Change playback speed (0.5x - 8x)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-[10px] border-2 border-[var(--ink)] bg-[#f7f1e4] p-5 shadow-[5px_5px_0_var(--ink)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[#258b88]" />
            <h3 className="font-display font-bold">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--ink-soft)] hover:bg-[#e9dfce] hover:text-[var(--ink)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-[6px] border border-[#cbbfac] bg-[#ede4d5] px-3 py-2 text-xs"
            >
              <span className="text-[var(--ink-soft)]">{s.desc}</span>
              <kbd className="rounded border border-[var(--ink)] bg-[#f7f1e4] px-2 py-0.5 font-mono text-[10px] font-semibold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-[6px] border-2 border-[var(--ink)] bg-[#f27f6a] py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default function Trace() {
  const params = useParams<{ traceId?: string }>();
  const traceId = params.traceId;

  // Remote trace query when traceId is in URL
  const remoteQuery = useGetTrace(traceId ?? "", {
    query: {
      enabled: Boolean(traceId),
      queryKey: getGetTraceQueryKey(traceId ?? ""),
    },
  });

  // Local fallback trace from sessionStorage
  const [sessionTrace] = useState<TraceResult | null>(() => {
    try {
      const raw = sessionStorage.getItem("cp-trace-result");
      return raw ? (JSON.parse(raw) as TraceResult) : null;
    } catch {
      return null;
    }
  });

  const traceResult = traceId ? remoteQuery.data ?? null : sessionTrace;

  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [copied, setCopied] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Playback timer driven by speed multiplier (base interval 800ms)
  useEffect(() => {
    if (!isPlaying || !traceResult?.trace.length) return;
    const intervalMs = Math.max(50, Math.round(800 / speed));
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        if (current >= traceResult.trace.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, traceResult?.trace.length]);

  const totalSteps = traceResult?.trace.length ?? 0;

  const stepForward = useCallback(() => {
    if (!totalSteps) return;
    setActiveStep((step) => Math.min(totalSteps - 1, step + 1));
  }, [totalSteps]);

  const stepBackward = useCallback(() => {
    if (!totalSteps) return;
    setActiveStep((step) => Math.max(0, step - 1));
  }, [totalSteps]);

  const jumpToStart = useCallback(() => {
    setIsPlaying(false);
    setActiveStep(0);
  }, []);

  const jumpToEnd = useCallback(() => {
    if (!totalSteps) return;
    setIsPlaying(false);
    setActiveStep(totalSteps - 1);
  }, [totalSteps]);

  // Skip to the next/previous step whose source line differs from the current
  // one — a fast way to jump between "interesting" points without scrubbing
  // every single step.
  const nextChangeStep = useCallback(() => {
    if (!totalSteps || !traceResult) return;
    const current = traceResult.trace[activeStep];
    if (!current) return;
    for (let i = activeStep + 1; i < totalSteps; i++) {
      if (traceResult.trace[i].line !== current.line) {
        setIsPlaying(false);
        setActiveStep(i);
        return;
      }
    }
  }, [activeStep, totalSteps, traceResult]);

  const prevChangeStep = useCallback(() => {
    if (!totalSteps || !traceResult) return;
    const current = traceResult.trace[activeStep];
    if (!current) return;
    for (let i = activeStep - 1; i >= 0; i--) {
      if (traceResult.trace[i].line !== current.line) {
        setIsPlaying(false);
        setActiveStep(i);
        return;
      }
    }
  }, [activeStep, totalSteps, traceResult]);

  const togglePlay = useCallback(() => {
    if (!totalSteps) return;
    setIsPlaying((p) => !p);
  }, [totalSteps]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepBackward();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepForward();
      } else if (e.code === "Home") {
        e.preventDefault();
        jumpToStart();
      } else if (e.code === "End") {
        e.preventDefault();
        jumpToEnd();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        jumpToStart();
      } else if (e.key === "1") {
        setSpeed(0.5);
      } else if (e.key === "2") {
        setSpeed(1);
      } else if (e.key === "3") {
        setSpeed(2);
      } else if (e.key === "4") {
        setSpeed(4);
      } else if (e.key === "5") {
        setSpeed(8);
      } else if (e.key === "?") {
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, stepBackward, stepForward, jumpToStart, jumpToEnd]);

  const current = traceResult?.trace[activeStep];
  const source = useMemo(() => traceResult?.source ?? "", [traceResult?.source]);

  const handleCopyLink = () => {
    if (!traceResult?.id) return;
    const url = `${window.location.origin}/trace/${traceResult.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (traceId && remoteQuery.isLoading) {
    return (
      <CockpitShell>
        <LoadingTrace />
      </CockpitShell>
    );
  }

  if (traceId && remoteQuery.isError) {
    return (
      <CockpitShell>
        <TraceNotFound />
      </CockpitShell>
    );
  }

  if (!traceResult) {
    return (
      <CockpitShell>
        <EmptyTrace />
      </CockpitShell>
    );
  }

  return (
    <CockpitShell>
      <div className="flex min-h-[calc(100dvh-68px)] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[#f7f1e4] px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              data-testid="link-trace-back"
              className="flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-[var(--ink)] bg-[#e9dfce] transition-transform hover:-translate-x-0.5"
            >
              <ArrowLeft size={15} />
            </Link>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                captured run / debugger view
              </p>
              <p className="font-display text-xl font-bold tracking-[-0.04em]">Execution trace</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              data-testid="button-shortcuts"
              title="Keyboard shortcuts (?)"
              className="flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-[var(--ink)] bg-[#e9dfce] transition-transform hover:-translate-y-0.5"
            >
              <Keyboard size={14} />
            </button>
            {traceResult.id && (
              <button
                type="button"
                onClick={handleCopyLink}
                data-testid="button-share-trace"
                className="flex items-center gap-1.5 rounded-[6px] border-2 border-[var(--ink)] bg-[#f7f1e4] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5"
              >
                {copied ? <Check size={12} className="text-[#258b88]" /> : <Share2 size={12} />}
                {copied ? "Link copied!" : "Share trace"}
              </button>
            )}
            {traceResult.truncated && (
              <span className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[#f2cc68] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em]">
                <Maximize2 size={11} /> trace truncated
              </span>
            )}
            {traceResult.problemName && (
              <span
                className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[#f7f1e4] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                title="Problem being traced"
                data-testid="text-trace-problem"
              >
                <BookOpen size={12} className="text-[#258b88]" /> {traceResult.problemName}
              </span>
            )}
            <span className="rounded-full border-2 border-[var(--ink)] bg-[#63c9c2] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em]">
              {traceResult.trace.length} steps
            </span>
          </div>
        </div>

        {traceResult.error && (
          <div
            className="mx-4 mt-4 flex items-start gap-2 rounded-[7px] border-2 border-[#9e4039] bg-[#f8c1b4] px-3 py-2.5 text-xs leading-5 text-[#542c2a] sm:mx-6"
            data-testid="status-trace-error"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{traceResult.error}</span>
          </div>
        )}

        {traceResult.trace.length === 0 ? (
          <div className="grid-paper flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <X className="mx-auto mb-3 text-[#e66f5c]" />
              <p className="font-display text-2xl font-bold">No executable moments</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                The sandbox returned no trace steps. Check the runtime message above.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <StepRail
              trace={traceResult.trace}
              activeStep={activeStep}
              onSelect={(index) => {
                setActiveStep(index);
                setIsPlaying(false);
              }}
            />
            <div className="min-w-0 flex-1 bg-[#f1e8d8]">
              {/* Playback Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[#e9dfce] px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                  <span className="rounded bg-[#f27f6a] px-2 py-1 font-semibold">
                    step {String(current?.step ?? 0).padStart(2, "0")}
                  </span>
                  <span className="text-[var(--ink-soft)]">
                    line {current?.line} / {current?.function}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Speed Selector */}
                  <div className="flex items-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] p-0.5">
                    <span className="px-1.5 text-[var(--ink-soft)]" title="Playback Speed">
                      <Gauge size={12} />
                    </span>
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        data-testid={`button-speed-${s}`}
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-medium transition-colors ${
                          speed === s ? "bg-[#258b88] text-white font-bold" : "text-[var(--ink-soft)] hover:bg-[#ede4d5]"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={jumpToStart}
                      disabled={activeStep === 0}
                      data-testid="button-jump-start"
                      title="Jump to Start (Home)"
                      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"
                    >
                      <SkipBack size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={stepBackward}
                      disabled={activeStep === 0}
                      data-testid="button-previous-step"
                      title="Step Backward (←)"
                      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      data-testid="button-play-trace"
                      title="Play/Pause (Space)"
                      className="flex h-8 items-center gap-1.5 rounded-[5px] border-2 border-[var(--ink)] bg-[#63c9c2] px-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] transition-transform hover:-translate-y-0.5"
                    >
                      {isPlaying ? <CirclePause size={13} /> : <CirclePlay size={13} />}
                      {isPlaying ? "pause" : "play"}
                    </button>
                    <button
                      type="button"
                      onClick={stepForward}
                      disabled={activeStep === totalSteps - 1}
                      data-testid="button-next-step"
                      title="Step Forward (→)"
                      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={prevChangeStep}
                      disabled={activeStep === 0}
                      data-testid="button-previous-change"
                      title="Previous line change"
                      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={nextChangeStep}
                      disabled={activeStep === totalSteps - 1}
                      data-testid="button-next-change"
                      title="Next line change"
                      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={jumpToEnd}
                      disabled={activeStep === totalSteps - 1}
                      data-testid="button-jump-end"
                      title="Jump to End (End)"
                      className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--ink)] bg-[#f7f1e4] transition-colors hover:bg-[#f2cc68] disabled:opacity-40"
                    >
                      <SkipForward size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step Scrubber Bar */}
              <div className="border-b border-[#cbbfac] bg-[#e3d7c3] px-4 py-1.5 sm:px-5">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalSteps - 1)}
                    value={activeStep}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setActiveStep(Number(e.target.value));
                    }}
                    aria-label="Timeline scrubber"
                    className="h-1.5 w-full accent-[#258b88] cursor-pointer"
                  />
                  <span className="shrink-0 font-mono text-[9px] text-[var(--ink-soft)]">
                    {activeStep + 1} / {totalSteps}
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-col xl:flex-row">
                <SourcePanel source={source} activeLine={current?.line ?? 0} problemName={traceResult.problemName} />
                <div className="grid min-w-0 flex-1 grid-cols-1 bg-[#f7f1e4] sm:grid-cols-2 xl:block xl:w-[370px] xl:flex-none">
                  <LocalsPanel
                    locals={current?.locals ?? []}
                    previousLocals={traceResult.trace[activeStep - 1]?.locals ?? []}
                  />
                  <StackPanel stack={current?.stack ?? []} />
                </div>
              </div>
              <ArraysPanel arrays={current?.arrays ?? []} highlights={current?.highlights ?? []} />
              <div className="flex items-center justify-between border-t border-[#b7aa96] bg-[#f7f1e4] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-soft)] sm:px-5">
                <span className="flex items-center gap-2">
                  <Clock3 size={13} /> paused at line {current?.line}
                </span>
                <span className="flex items-center gap-3">
                  <span className="hidden sm:inline text-[var(--ink-soft)]">Press ? for shortcuts</span>
                  <span>
                    frame {activeStep + 1} of {traceResult.trace.length}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </CockpitShell>
  );
}