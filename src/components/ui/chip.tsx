"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Toggleable chip used across the Evaluaciones wizard for multi-select and
 * single-select chip groups. Mirrors the `.chip` style from the HTML mockup
 * adapted to the project palette (sage/copper/honey).
 */
export type ChipTone = "sage" | "copper" | "honey" | "rose";

const TONES: Record<ChipTone, { off: string; on: string }> = {
  sage: {
    off: "border-border/70 bg-card text-muted-foreground hover:border-[#5C6E6C]/50 hover:bg-[#F4F1EC]/60",
    on: "border-[#5C6E6C] bg-[#E7ECEA] text-[#4F605C]",
  },
  copper: {
    off: "border-border/70 bg-card text-muted-foreground hover:border-[#BB7154]/50 hover:bg-[#FBEFE7]/60",
    on: "border-[#BB7154] bg-[#F6E0D6] text-[#8C4A30]",
  },
  honey: {
    off: "border-border/70 bg-card text-muted-foreground hover:border-[#D2A96A]/50 hover:bg-[#F8EFD7]/60",
    on: "border-[#D2A96A] bg-[#F8EFD7] text-[#7C5E1F]",
  },
  rose: {
    off: "border-border/70 bg-card text-muted-foreground hover:border-[#C58F8A]/60 hover:bg-[#F8EAE9]/60",
    on: "border-[#C58F8A] bg-[#F8EAE9] text-[#7B3D3D]",
  },
};

interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  tone?: ChipTone;
  size?: "sm" | "md";
  asLabel?: boolean;
}

export function Chip({
  pressed,
  onPressedChange,
  tone = "sage",
  size = "md",
  className,
  children,
  type,
  ...props
}: ChipProps) {
  const tones = TONES[tone];
  return (
    <button
      type={type ?? "button"}
      role="switch"
      aria-checked={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) onPressedChange?.(!pressed);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/30 focus-visible:ring-offset-2",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12.5px]",
        pressed ? tones.on : tones.off,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
