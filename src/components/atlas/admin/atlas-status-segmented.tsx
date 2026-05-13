"use client";

import { cn } from "@/lib/utils";
import {
  ATLAS_ENTRY_STATUSES,
  ATLAS_ENTRY_STATUS_LABELS,
  type AtlasEntryStatus,
} from "@/schemas/atlas.schema";

interface AtlasStatusSegmentedProps {
  value: AtlasEntryStatus;
  onChange: (next: AtlasEntryStatus) => void;
  disabled?: boolean;
}

/** Color hint per status, surfaced as a small dot so the curator keeps
 *  the brand-tone association (sage = published, honey = draft, rose =
 *  archived) without forcing a full-color background that would clash
 *  with the segmented-control aesthetic. */
const STATUS_DOT: Record<AtlasEntryStatus, string> = {
  draft: "bg-[#D2A96A]",
  published: "bg-[#5C6E6C]",
  archived: "bg-[#C58F8A]",
};

/**
 * Segmented control (iOS / macOS pattern) for the entry status.
 *
 * Replaces the previous three large rounded-pill chips. The segmented
 * control:
 *   · fits the 320px right-column with no wrapping
 *   · reads as a single tri-state input (one selection always visible)
 *   · keeps the color semantic via a 6px dot, not a full-fill background
 *   · matches the professional CMS feel of the rest of the form
 *
 * Accessibility: `role="radiogroup"` + `role="radio"` per segment so screen
 * readers announce it as a single-choice control.
 */
export function AtlasStatusSegmented({
  value,
  onChange,
  disabled = false,
}: AtlasStatusSegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Estado de la entrada"
      className={cn(
        "inline-flex w-full rounded-md border bg-muted/50 p-0.5",
        disabled && "opacity-60",
      )}
    >
      {ATLAS_ENTRY_STATUSES.map((status) => {
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full transition-colors",
                active ? STATUS_DOT[status] : "bg-muted-foreground/40",
              )}
            />
            {ATLAS_ENTRY_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
