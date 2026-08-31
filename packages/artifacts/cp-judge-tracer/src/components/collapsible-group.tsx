import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// Shared collapsible group used by both the Problem Shelf (Easy/Medium/Hard)
// and the Trace Player's step timeline. Keeps the same smooth expand/collapse
// animation (grid-rows 0fr -> 1fr) so the two never diverge.
export function CollapsibleGroup({
  label,
  summary,
  startCollapsed = true,
  collapsed,
  onCollapsedChange,
  dataTestId,
  headerClassName,
  contentClassName,
  children,
}: {
  label: ReactNode;
  summary?: ReactNode;
  startCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (next: boolean) => void;
  dataTestId?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [internal, setInternal] = useState(startCollapsed);
  const isCollapsed = collapsed ?? internal;
  const toggle = () => {
    const next = !isCollapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternal(next);
  };

  return (
    <div className="mb-2 last:mb-0">
      <button
        type="button"
        onClick={toggle}
        data-testid={dataTestId}
        aria-expanded={!isCollapsed}
        className={`flex w-full items-center justify-between rounded-[6px] bg-[#f1e8d8] px-2 py-1.5 transition-colors hover:bg-[#ece1cf] ${headerClassName ?? ""}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight
            size={13}
            strokeWidth={2.5}
            className={`shrink-0 text-[var(--ink-soft)] transition-transform duration-200 ease-in-out ${isCollapsed ? "rotate-0" : "rotate-90"}`}
          />
          <span className="min-w-0 truncate">{label}</span>
        </span>
        {summary != null && (
          <span className="ml-2 shrink-0 font-mono text-[9px] text-[var(--ink-soft)]">{summary}</span>
        )}
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="overflow-hidden">
          <div className={`mt-1 space-y-1 ${contentClassName ?? ""}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
