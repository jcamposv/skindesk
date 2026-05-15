import { MoonIcon, SunIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  RUTINA_MOMENTO_LABELS,
  RUTINA_MOMENTO_SHORT,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";

interface MomentoChipProps {
  momento: RutinaMomento;
  /**
   * `ring`   → neutral surface with a ring border (default; matches the
   *            library card badge sitting on a white card header).
   * `solid`  → tinted background per moment, used inside denser surfaces
   *            like the detail Sheet's session header where we want a
   *            stronger visual hierarchy.
   */
  variant?: "ring" | "solid";
  /** When false, render the short label ("AM"/"PM"/"Ambos"). When true,
   *  render the long label ("Mañana"/"Noche"/"Mañana y noche"). */
  longLabel?: boolean;
  className?: string;
}

/** Unified chip used wherever a rutina's momento (AM/PM/Both) needs a
 *  pill rendering — replaces near-duplicate copies that existed in
 *  rutina-library-card and rutina-detail-sheet. */
export function MomentoChip({
  momento,
  variant = "ring",
  longLabel = false,
  className,
}: MomentoChipProps) {
  const label = longLabel
    ? RUTINA_MOMENTO_LABELS[momento]
    : RUTINA_MOMENTO_SHORT[momento];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        variant === "ring"
          ? "bg-card text-foreground ring-1 ring-border"
          : momento === "am"
            ? "bg-[#F8EFD7] text-[#7C5E1F]"
            : momento === "pm"
              ? "bg-[#F0ECFB] text-[#6B4FA0]"
              : "bg-[#E7ECEA] text-[#4F605C]",
        className,
      )}
    >
      {momento === "am" ? (
        <SunIcon className="size-3 text-[#C47A2B]" />
      ) : momento === "pm" ? (
        <MoonIcon className="size-3 text-[#6B4FA0]" />
      ) : (
        <>
          <SunIcon className="size-3 text-[#C47A2B]" />
          <MoonIcon className="size-3 text-[#6B4FA0]" />
        </>
      )}
      {label}
    </span>
  );
}
