"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Sí/No segmented toggle. Mimics the `.sn-btn` pattern from the HTML mockup.
 *
 * Three states: undefined (no choice yet), true ("Sí"), false ("No"). Use
 * `value={undefined}` to show neither pill highlighted on initial mount.
 */
interface YesNoToggleProps {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
  size?: "sm" | "md";
  yesLabel?: string;
  noLabel?: string;
  className?: string;
  name?: string;
  disabled?: boolean;
}

export function YesNoToggle({
  value,
  onChange,
  size = "md",
  yesLabel = "Sí",
  noLabel = "No",
  className,
  name,
  disabled,
}: YesNoToggleProps) {
  const padding = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        "inline-flex overflow-hidden rounded-full border border-border/70 bg-card",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === true}
        onClick={() => onChange(true)}
        className={cn(
          "transition-colors font-medium",
          padding,
          value === true
            ? "bg-[#5C6E6C] text-white"
            : "text-muted-foreground hover:bg-[#F4F1EC]/60 hover:text-foreground",
        )}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === false}
        onClick={() => onChange(false)}
        className={cn(
          "border-l border-border/70 transition-colors font-medium",
          padding,
          value === false
            ? "bg-[#F8EAE9] text-[#7B3D3D]"
            : "text-muted-foreground hover:bg-[#F4F1EC]/60 hover:text-foreground",
        )}
      >
        {noLabel}
      </button>
    </div>
  );
}
