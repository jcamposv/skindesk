"use client";

import { cn } from "@/lib/utils";

import type { LevelScore } from "./types";

interface LevelScaleProps {
  label: string;
  value: LevelScore;
  onChange: (next: LevelScore) => void;
  /** Visual tone — picks the active-step color. */
  tone?: "rose" | "honey" | "sage" | "copper";
  /** Override the 0 → 5 captions. */
  scaleHints?: [string, string];
}

const TONE: Record<NonNullable<LevelScaleProps["tone"]>, string> = {
  rose: "bg-[#C58F8A] border-[#C58F8A]",
  honey: "bg-[#D2A96A] border-[#D2A96A]",
  sage: "bg-[#5C6E6C] border-[#5C6E6C]",
  copper: "bg-[#BB7154] border-[#BB7154]",
};

/**
 * 0–5 segmented level selector — used for sensitivity, pain, hydration, etc.
 * Replaces a slider so values are explicit and tap-friendly on mobile (no
 * need to drag for sub-step precision).
 */
export function LevelScale({
  label,
  value,
  onChange,
  tone = "copper",
  scaleHints = ["Bajo", "Alto"],
}: LevelScaleProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground/85">
          {label}
        </label>
        <span className="text-xs font-medium text-foreground/80">
          {value}/5
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-1"
      >
        {[0, 1, 2, 3, 4, 5].map((step) => {
          const isActive = step <= value;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={step === value}
              onClick={() => onChange(step as LevelScore)}
              className={cn(
                "h-7 flex-1 rounded-md border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/30",
                isActive
                  ? `text-white ${TONE[tone]}`
                  : "border-border/60 bg-card text-muted-foreground hover:bg-[#F4F1EC]/50",
              )}
            >
              {step}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-foreground/70">
        <span>{scaleHints[0]}</span>
        <span>{scaleHints[1]}</span>
      </div>
    </div>
  );
}
