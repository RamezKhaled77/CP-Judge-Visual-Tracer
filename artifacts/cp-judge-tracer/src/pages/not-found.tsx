import { Link } from "wouter";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="noise app-shell flex min-h-[100dvh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[12px] border-2 border-[var(--ink)] bg-[var(--cream)] p-8 shadow-[5px_5px_0_var(--ink)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[9px] border-2 border-[var(--ink)] bg-[#f27f6a]"><Compass size={22} /></span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">route not found</span>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-[-0.06em]">Wrong bench.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">That route is outside the laboratory map. Head back to the workbench and pick a specimen.</p>
        <Link href="/" data-testid="link-404-home" className="mt-6 inline-flex items-center gap-2 rounded-[7px] border-2 border-[var(--ink)] bg-[#63c9c2] px-4 py-3 font-semibold transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)]"><ArrowLeft size={16} /> Back to workbench</Link>
      </div>
    </div>
  );
}
