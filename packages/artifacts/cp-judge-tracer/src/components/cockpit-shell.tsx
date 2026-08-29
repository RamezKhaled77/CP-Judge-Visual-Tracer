import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Bug,
  ChevronRight,
  ChevronsLeft,
  CircleHelp,
  Cpu,
  FlaskConical,
  Gauge,
  TerminalSquare,
} from "lucide-react";

type CockpitShellProps = {
  children: ReactNode;
  specimenIndex?: number;
  specimenTotal?: number;
};

const STORAGE_KEY = "cplab.sidebar.collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function CockpitShell({ children, specimenIndex = 1, specimenTotal = 1 }: CockpitShellProps) {
  const [location] = useLocation();
  const isTrace = location === "/trace";

  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  };

  const navItems = [
    {
      href: "/",
      label: "Workbench",
      icon: FlaskConical,
      active: !isTrace,
      testId: "link-nav-workbench",
      activeClass: "bg-[#f27f6a] text-[#18272b]",
    },
    {
      href: "/trace",
      label: "Trace player",
      icon: Bug,
      active: isTrace,
      testId: "link-nav-trace",
      activeClass: "bg-[#63c9c2] text-[#18272b]",
    },
  ];

  return (
    <div className="noise app-shell min-h-[100dvh] p-0 text-[var(--ink)] md:p-4">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1700px] overflow-hidden md:min-h-[calc(100dvh-2rem)] md:rounded-[18px] md:border-2 md:border-[#0e1c20] md:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        {/* Collapsible sidebar — pure CSS width + opacity/max-width transitions */}
        <aside
          data-testid="sidebar"
          aria-label="workspace navigation"
          className={`relative z-20 hidden shrink-0 flex-col bg-[#1d3034] text-[#f7f1e4] transition-[width] duration-300 ease-in-out md:flex ${collapsed ? "w-[76px]" : "w-[238px]"}`}
        >
          {/* Collapse / expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-testid="sidebar-toggle"
            className="absolute -right-4 top-[52px] z-40 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0e1c20] bg-[#f27f6a] text-[#18272b] shadow-[0_8px_18px_rgba(0,0,0,0.38)] transition-all duration-200 hover:scale-110 hover:bg-[#ff8a74] hover:shadow-[0_10px_22px_rgba(0,0,0,0.44)] active:scale-95"
          >
            <span
              className={`flex transition-transform duration-300 ease-in-out ${collapsed ? "rotate-180" : "rotate-0"}`}
            >
              <ChevronsLeft size={16} strokeWidth={2.75} />
            </span>
          </button>

          {/* Brand */}
          <div
            className={`border-b border-[#3e5558] transition-all duration-300 ease-in-out ${collapsed ? "flex items-center justify-center px-0 py-6" : "px-6 pb-6 pt-7"}`}
          >
            <Link
              href="/"
              className={`group flex items-center ${collapsed ? "justify-center" : "items-start gap-3"}`}
              data-testid="link-brand-home"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-[#18272b] bg-[#f27f6a] text-[#18272b] shadow-[3px_3px_0_#102024]">
                <TerminalSquare size={19} strokeWidth={2.5} />
              </span>
              <span
                className={`overflow-hidden text-clip transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}
              >
                <span className="block font-display text-[19px] font-bold tracking-[-0.04em] text-[#fbf4e7]">
                  CP / LAB
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#8eaaa8]">
                  visual tracer
                </span>
              </span>
            </Link>
          </div>

          {/* Workspace nav */}
          <div className={`flex flex-1 flex-col py-5 transition-[padding] duration-300 ease-in-out ${collapsed ? "px-0" : "px-3"}`}>
            {collapsed ? (
              <div className="mx-2 mb-4 border-t border-[#3e5558]" />
            ) : (
              <p className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#77918f]">
                Workspace
              </p>
            )}

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  className={`group flex items-center rounded-[8px] py-3 text-sm font-semibold transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${item.active ? item.activeClass : "text-[#c4d0c8] hover:bg-[#29464a]"}`}
                >
                  <span className="shrink-0 transition-transform duration-200 ease-in-out group-hover:scale-105">
                    <item.icon size={17} />
                  </span>
                  <span
                    className={`overflow-hidden text-clip transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}`}
                  >
                    {item.label}
                  </span>
                  {item.active && !collapsed && <ChevronRight className="ml-auto" size={15} />}
                </Link>
              ))}
            </nav>

            {collapsed ? (
              <div className="mt-auto flex justify-center py-5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#63c9c2] shadow-[0_0_10px_2px_rgba(99,201,194,0.6)]" />
              </div>
            ) : (
              <div className="mt-auto rounded-[10px] border border-[#456366] bg-[#213a3e] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#89a6a2]">
                    runtime
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#63c9c2]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#63c9c2]" /> online
                  </span>
                </div>
                <p className="font-display text-sm text-[#f7f1e4]">C++17 sandbox</p>
                <p className="mt-1 text-[11px] leading-4 text-[#9bb2ac]">
                  Runs stay local to this session.
                </p>
              </div>
            )}
          </div>

          {/* Footer hint */}
          {!collapsed && (
            <div className="flex items-center gap-2 border-t border-[#3e5558] px-6 py-5 text-[#9bb2ac] transition-all duration-300 ease-in-out">
              <CircleHelp size={15} />
              <span className="text-[11px]">read the output, not just the verdict</span>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 bg-[var(--cream)]">
          <header className="flex min-h-[68px] items-center justify-between border-b-2 border-[var(--ink)] bg-[var(--cream)] px-4 py-3 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[7px] border-2 border-[var(--ink)] bg-[#f27f6a] md:hidden">
                <Cpu size={16} />
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                  personal laboratory
                </p>
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
              <span
                className="flex items-center gap-2 rounded-full border-2 border-[var(--ink)] bg-[#f2cc68] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em]"
                title={`Specimen ${specimenIndex} of ${specimenTotal}`}
              >
                <Activity size={12} /> {String(specimenIndex).padStart(2, "0")} / {String(specimenTotal).padStart(2, "0")}
              </span>
            </div>
          </header>
          <div className="min-h-[calc(100dvh-68px)]">{children}</div>
        </main>
      </div>
    </div>
  );
}
