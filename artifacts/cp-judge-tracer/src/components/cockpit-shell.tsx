import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Bug, ChevronRight, CircleHelp, Cpu, FlaskConical, Gauge, TerminalSquare } from "lucide-react";

type CockpitShellProps = {
  children: ReactNode;
};

export function CockpitShell({ children }: CockpitShellProps) {
  const [location] = useLocation();
  const isTrace = location === "/trace";

  return (
    <div className="noise app-shell min-h-[100dvh] p-0 text-[var(--ink)] md:p-4">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1700px] overflow-hidden md:min-h-[calc(100dvh-2rem)] md:rounded-[18px] md:border-2 md:border-[#0e1c20] md:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <aside className="hidden w-[238px] shrink-0 flex-col bg-[#1d3034] text-[#f7f1e4] md:flex">
          <div className="border-b border-[#3e5558] px-6 pb-6 pt-7">
            <Link href="/" className="group flex items-start gap-3" data-testid="link-brand-home">
              <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-[#18272b] bg-[#f27f6a] text-[#18272b] shadow-[3px_3px_0_#102024]">
                <TerminalSquare size={19} strokeWidth={2.5} />
              </span>
              <span>
                <span className="block font-display text-[19px] font-bold tracking-[-0.04em] text-[#fbf4e7]">CP / LAB</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#8eaaa8]">visual tracer</span>
              </span>
            </Link>
          </div>
          <div className="flex flex-1 flex-col px-3 py-5">
            <p className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#77918f]">Workspace</p>
            <Link
              href="/"
              data-testid="link-nav-workbench"
              className={`group mb-1 flex items-center gap-3 rounded-[8px] px-3 py-3 text-sm font-semibold transition-colors ${!isTrace ? "bg-[#f27f6a] text-[#18272b]" : "text-[#c4d0c8] hover:bg-[#29464a]"}`}
            >
              <FlaskConical size={17} />
              <span>Workbench</span>
              {!isTrace && <ChevronRight className="ml-auto" size={15} />}
            </Link>
            <Link
              href="/trace"
              data-testid="link-nav-trace"
              className={`group flex items-center gap-3 rounded-[8px] px-3 py-3 text-sm font-semibold transition-colors ${isTrace ? "bg-[#63c9c2] text-[#18272b]" : "text-[#c4d0c8] hover:bg-[#29464a]"}`}
            >
              <Bug size={17} />
              <span>Trace player</span>
              {isTrace && <ChevronRight className="ml-auto" size={15} />}
            </Link>

            <div className="mt-auto rounded-[10px] border border-[#456366] bg-[#213a3e] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#89a6a2]">runtime</span>
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#63c9c2]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#63c9c2]" /> online
                </span>
              </div>
              <p className="font-display text-sm text-[#f7f1e4]">C++17 sandbox</p>
              <p className="mt-1 text-[11px] leading-4 text-[#9bb2ac]">Runs stay local to this session.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-[#3e5558] px-6 py-5 text-[#9bb2ac]">
            <CircleHelp size={15} />
            <span className="text-[11px]">read the output, not just the verdict</span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-[var(--cream)]">
          <header className="flex min-h-[68px] items-center justify-between border-b-2 border-[var(--ink)] bg-[var(--cream)] px-4 py-3 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[7px] border-2 border-[var(--ink)] bg-[#f27f6a] md:hidden">
                <Cpu size={16} />
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">personal laboratory</p>
                <p className="font-display text-[17px] font-bold tracking-[-0.03em] sm:text-[19px]">
                  {isTrace ? "make the invisible visible" : "every run leaves a trail"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ink-soft)] sm:flex">
                <Gauge size={14} className="text-[#258b88]" />
                <span>ready to inspect</span>
              </div>
              <span className="flex items-center gap-2 rounded-full border-2 border-[var(--ink)] bg-[#f2cc68] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em]">
                <Activity size={12} /> 01 / 01
              </span>
            </div>
          </header>
          <div className="min-h-[calc(100dvh-68px)]">{children}</div>
        </main>
      </div>
    </div>
  );
}