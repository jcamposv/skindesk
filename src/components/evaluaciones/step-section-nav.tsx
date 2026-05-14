"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepSection {
  id: string;
  label: string;
  /** Pre-computed completion flag for this section (derived from form values). */
  done: boolean;
}

interface StepSectionNavProps {
  /** Sections to surface as quick-jump anchors + progress chips. */
  sections: StepSection[];
  /** Class to apply to outer wrapper (so consumers can position it). */
  className?: string;
}

/**
 * Sticky horizontal anchor nav for long wizard steps. Two responsibilities:
 *   1. Quick-jump: clicking an anchor scrolls to the matching <SectionCard id>.
 *   2. Progress: shows X/N completed + each section's checkmark when done.
 *
 * Uses IntersectionObserver to highlight the section currently in view,
 * so the nav stays in sync as the user scrolls naturally.
 */
export function StepSectionNav({ sections, className }: StepSectionNavProps) {
  const doneCount = useMemo(
    () => sections.reduce((acc, s) => acc + (s.done ? 1 : 0), 0),
    [sections],
  );
  const total = sections.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Observe each section card by its id and mark the topmost-visible one as
  // active. Intersection thresholds: any section with >25% visible is a
  // candidate; we pick the one closest to the top of the viewport.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (observerRef.current) observerRef.current.disconnect();

    const visible = new Map<string, IntersectionObserverEntry>();

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry);
          else visible.delete(entry.target.id);
        }
        // Sort visible by intersectionRatio desc, then pick the section with
        // the smallest top offset (closest to viewport top).
        const candidates = Array.from(visible.values()).sort((a, b) => {
          const aTop = a.boundingClientRect.top;
          const bTop = b.boundingClientRect.top;
          return aTop - bTop;
        });
        const next = candidates[0]?.target.id ?? null;
        setActiveId(next);
      },
      { rootMargin: "-100px 0px -50% 0px", threshold: [0.1, 0.25, 0.5] },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    observerRef.current = obs;
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.id).join(",")]);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <div
      className={cn(
        // Stacks below the EvaluacionTab sub-tabs sticky bar (top-0, ~52px tall).
        "sticky top-[52px] z-10 -mx-4 border-b border-border/40 bg-background/85 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1100px] items-center gap-3">
        {/* Progress block — quieter than before: small dot + tabular count. */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-border/50">
            <div
              className="h-full rounded-full bg-[#5C6E6C] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tabular-nums text-xs font-semibold text-foreground/75">
            {doneCount}/{total}
          </span>
        </div>

        {/* Anchor buttons — flat chips, distinct from sub-tabs above. Active
            is the primary visual; done is a quiet check; inactive blends in. */}
        <nav
          aria-label="Secciones del paso"
          className="-mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto px-1 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {sections.map((s, idx) => {
            const isActive = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpTo(s.id)}
                className={cn(
                  "group inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/30",
                  isActive
                    ? "font-semibold text-[#4F605C]"
                    : s.done
                      ? "text-foreground/85 hover:text-foreground"
                      : "text-foreground/65 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                    s.done
                      ? "bg-[#5C6E6C] text-white"
                      : isActive
                        ? "bg-[#F4F1EC] text-[#5C6E6C] ring-1 ring-[#5C6E6C]/40"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.done ? (
                    <CheckIcon className="size-2.5" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
