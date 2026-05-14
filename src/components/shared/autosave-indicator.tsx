"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CloudUploadIcon, Loader2Icon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AutosaveStatus } from "@/components/evaluaciones/use-autosave";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  onSaveNow: () => void;
}

/**
 * Pill-shaped autosave indicator. Reused across forms (datos personales,
 * evaluación, etc.) so the user always sees the same affordance.
 *
 *  · idle without history → suppressed (nothing to communicate yet)
 *  · saving               → 🟨 "Guardando…" + spinner
 *  · dirty                → 🟧 "Cambios sin guardar" + "Guardar ahora" CTA
 *  · saved                → 🟩 "Guardado · hace 12s" with relative time
 */
export function AutosaveIndicator(props: AutosaveIndicatorProps) {
  // Remount on each new save — the relative-time hook starts fresh from the
  // new timestamp. Avoids syncing prop→state in an effect.
  return (
    <AutosaveIndicatorInner
      key={props.lastSavedAt?.getTime() ?? "none"}
      {...props}
    />
  );
}

function AutosaveIndicatorInner({
  status,
  lastSavedAt,
  onSaveNow,
}: AutosaveIndicatorProps) {
  const relative = useRelativeTime(lastSavedAt);

  if (status === "idle" && !lastSavedAt) return null;

  if (status === "saving") {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full bg-[#F8EFD7] px-2.5 py-1 text-xs font-medium text-[#7C5E1F]"
      >
        <Loader2Icon className="size-3 animate-spin" />
        Guardando…
      </span>
    );
  }

  if (status === "dirty") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#F6E0D6] px-2.5 py-1 text-xs font-medium text-[#8C4A30]"
        >
          <CloudUploadIcon className="size-3" />
          Cambios sin guardar
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSaveNow}
          className="h-7 gap-1 px-2 text-xs"
        >
          <SaveIcon className="size-3" />
          Guardar ahora
        </Button>
      </div>
    );
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full bg-[#E7ECEA] px-2.5 py-1 text-xs font-medium text-[#4F605C]"
    >
      <CheckIcon className="size-3" />
      Guardado{relative ? ` · ${relative}` : ""}
    </span>
  );
}

/** Returns "ahora", "hace 5s", "hace 2m". Re-mounts (via parent `key`) when
 *  the `date` prop changes, so we only run an interval here for ticking. */
function useRelativeTime(date: Date | null): string | null {
  const [text, setText] = useState<string | null>(() =>
    date ? formatRelative(date) : null,
  );

  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => {
      setText(formatRelative(date));
    }, 15000);
    return () => clearInterval(id);
  }, [date]);

  return text;
}

function formatRelative(date: Date): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 5) return "ahora";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  return `hace ${diffH}h`;
}
