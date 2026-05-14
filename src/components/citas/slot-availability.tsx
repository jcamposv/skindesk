"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";

import {
  checkCitaAvailabilityAction,
  type SlotAvailabilityResult,
  type SlotSuggestion,
} from "@/actions/citas.actions";
import { cn } from "@/lib/utils";

interface SlotAvailabilityProps {
  startAt: string;
  endAt: string;
  professionalId: string | null;
  /** When editing — excludes this cita from the conflict scan. */
  excludeCitaId?: string;
  /** Called when the user clicks a suggestion chip. */
  onPickSuggestion: (slot: SlotSuggestion) => void;
}

const DEBOUNCE_MS = 400;

const SLOT_FMT = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const RANGE_TIME_FMT = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Live availability hint shown below the date/time inputs in the cita
 * dialog. Hits `checkCitaAvailabilityAction` on a 400ms debounce whenever
 * the watched fields change. Renders:
 *   · a green pill when the slot is free
 *   · a red pill + up to 3 clickable suggestion chips when blocked
 *   · a muted hint when we can't check (no professional selected)
 *
 * Reads-only — never writes to the form on its own. The dialog owns the
 * `form.setValue` calls via `onPickSuggestion`.
 */
export function SlotAvailability({
  startAt,
  endAt,
  professionalId,
  excludeCitaId,
  onPickSuggestion,
}: SlotAvailabilityProps) {
  const [result, setResult] = useState<SlotAvailabilityResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  // Track the last request so a slow response doesn't overwrite a fresher one.
  const reqIdRef = useRef(0);

  const canCheck =
    startAt.length > 0 &&
    endAt.length > 0 &&
    new Date(endAt).getTime() > new Date(startAt).getTime();

  useEffect(() => {
    if (!canCheck) return;
    const reqId = ++reqIdRef.current;
    const handle = window.setTimeout(async () => {
      // Discard if a newer request superseded this one before we started.
      if (reqId !== reqIdRef.current) return;
      setIsChecking(true);
      setResult(null);
      const res = await checkCitaAvailabilityAction({
        startAt,
        endAt,
        professionalId: professionalId ?? null,
        excludeCitaId: excludeCitaId ?? null,
      });
      if (reqId !== reqIdRef.current) return;
      setIsChecking(false);
      setResult(res.success && res.data ? res.data : null);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [startAt, endAt, professionalId, excludeCitaId, canCheck]);

  const handlePick = useCallback(
    (slot: SlotSuggestion) => onPickSuggestion(slot),
    [onPickSuggestion],
  );

  if (!canCheck) return null;

  // Loading + empty initial render — single visual state to avoid layout shift.
  if (isChecking && result == null) {
    return (
      <p
        className="flex items-center gap-1.5 text-sm text-foreground/75"
        aria-live="polite"
      >
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        Verificando disponibilidad…
      </p>
    );
  }

  if (!result) return null;

  // No professional → muted hint, no green/red signal.
  if (professionalId == null) {
    return (
      <p
        className="text-sm text-foreground/75"
        aria-live="polite"
      >
        Asigná un profesional para validar la disponibilidad.
      </p>
    );
  }

  if (result.available) {
    return (
      <p
        className="flex items-center gap-1.5 rounded-md bg-[#EEF3F1] px-2 py-1.5 text-xs font-medium text-[#4F605C]"
        aria-live="polite"
      >
        <CheckCircle2Icon className="size-3.5" aria-hidden />
        Horario disponible
        {isChecking ? (
          <Loader2Icon
            className="ml-1 size-3 animate-spin opacity-60"
            aria-hidden
          />
        ) : null}
      </p>
    );
  }

  // Blocked — show the conflict + suggestion chips.
  const first = result.conflicts[0];
  return (
    <div className="grid gap-2" aria-live="polite">
      <div className="flex items-start gap-1.5 rounded-md bg-[#FBE4E0] px-2 py-1.5 text-xs font-medium text-[#7A3F3C]">
        <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0">
          Conflicto
          {first ? (
            <>
              {" con "}
              <span className="font-semibold">
                {first.title?.trim() ? first.title : "otra cita"}
              </span>
              {" ("}
              {RANGE_TIME_FMT.format(new Date(first.startAt))}
              {" – "}
              {RANGE_TIME_FMT.format(new Date(first.endAt))}
              {")"}
            </>
          ) : (
            "."
          )}
        </span>
      </div>

      {result.suggestions.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/75">
            Próximos horarios disponibles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.suggestions.map((s) => (
              <button
                key={s.startAt}
                type="button"
                onClick={() => handlePick(s)}
                className={cn(
                  "rounded-md border border-[#5C6E6C]/30 bg-[#EEF3F1] px-2.5 py-1 text-xs font-medium text-[#4F605C] transition-colors",
                  "hover:border-[#5C6E6C]/60 hover:bg-[#E0EAE6]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/40",
                )}
              >
                {SLOT_FMT.format(new Date(s.startAt))}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
