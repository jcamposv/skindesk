"use client";

import { useMemo } from "react";
import { CheckCircle2Icon, CheckIcon, ClockIcon } from "lucide-react";

import { formatDateLong, isPastDate, isToday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlanData, PlanSesion } from "@/types/evaluacion";

/**
 * Cronograma de sesiones — read-side render for plans with `sesiones`.
 * Clicking a session toggle calls `onToggleSesion` (managed by the
 * parent via `useOptimistic`, so the visual flip is instant).
 */
interface PlanProgressViewProps {
  plan: PlanData;
  sesiones: PlanSesion[];
  onToggleSesion: (id: string) => void;
  pending: boolean;
}

export function PlanProgressView({
  plan,
  sesiones,
  onToggleSesion,
  pending,
}: PlanProgressViewProps) {
  const completedCount = useMemo(
    () => sesiones.filter((s) => s.completada).length,
    [sesiones],
  );
  const total = sesiones.length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <div className="grid gap-4">
      {/* Header row — objetivo + progress */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          {plan.objetivoPrincipal ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/75">
                Objetivo
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-foreground">
                {plan.objetivoPrincipal}
              </p>
            </>
          ) : null}
          <p className="mt-2 text-sm text-foreground/75 tabular-nums">
            Progreso general ·{" "}
            <span className="font-semibold text-foreground">
              {completedCount} de {total} sesiones
            </span>
            {plan.frecuencia ? (
              <>
                <span className="mx-1.5 text-foreground/40">·</span>
                <span>{plan.frecuencia}</span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-xs font-bold tabular-nums",
            percent === 100
              ? "bg-[#E7ECEA] text-[#4F605C]"
              : "bg-[#F4F1EC] text-[#4F605C]",
          )}
        >
          {percent === 100 ? <CheckCircle2Icon className="size-3.5" /> : null}
          {percent}% completado
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-[#5C6E6C] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/75">
          Cronograma de sesiones
        </p>
        <ol className="grid gap-2">
          {sesiones.map((s, idx) => (
            <SesionProgressRow
              key={s.id}
              sesion={s}
              order={idx + 1}
              disabled={pending}
              onToggle={() => onToggleSesion(s.id)}
            />
          ))}
        </ol>
      </div>

      {plan.tratamientos.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/75">
            Tratamientos sugeridos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.tratamientos.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-[#E7ECEA] px-3 py-1 text-sm font-medium text-[#4F605C]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {plan.notasClinicas ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground/75">
            Notas clínicas
          </p>
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground/85">
            {plan.notasClinicas}
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface SesionProgressRowProps {
  sesion: PlanSesion;
  order: number;
  disabled: boolean;
  onToggle: () => void;
}

function SesionProgressRow({
  sesion,
  order,
  disabled,
  onToggle,
}: SesionProgressRowProps) {
  const done = sesion.completada;
  const today = isToday(sesion.fecha);
  const past = !done && isPastDate(sesion.fecha);
  const tone: "done" | "today" | "future" = done
    ? "done"
    : today || past
      ? "today"
      : "future";

  const statusLabel = done
    ? formatDateLong(sesion.fecha)
    : today
      ? "Hoy"
      : past
        ? `Atrasada · ${formatDateLong(sesion.fecha)}`
        : formatDateLong(sesion.fecha);

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        tone === "done"
          ? "border-[#5C6E6C]/30 bg-[#E7ECEA]/40"
          : tone === "today"
            ? "border-[#BB7154]/40 bg-[#FBEFE7]/50"
            : "border-border/60 bg-card",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={done ? "Marcar como pendiente" : "Marcar como completada"}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/40 disabled:opacity-60",
          tone === "done"
            ? "bg-[#5C6E6C] hover:bg-[#4F605C]"
            : tone === "today"
              ? "bg-[#BB7154] hover:bg-[#A56146]"
              : "bg-muted text-foreground/70 hover:bg-foreground/15",
        )}
      >
        {done ? (
          <CheckIcon className="size-4" strokeWidth={3} />
        ) : tone === "today" ? (
          <ClockIcon className="size-4" />
        ) : (
          <span className="text-xs font-bold tabular-nums">{order}</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[15px] font-semibold",
            done ? "text-[#4F605C]" : "text-foreground",
          )}
        >
          {sesion.nombre || `Sesión ${order}`}
        </p>
        {sesion.descripcion ? (
          <p className="truncate text-xs text-foreground/75">
            {sesion.descripcion}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold tabular-nums",
          tone === "today" ? "text-[#8C4A30]" : "text-foreground/65",
        )}
      >
        {statusLabel}
      </span>
    </li>
  );
}

/** Legacy view for plans persisted before `sesiones` existed. Kept as a
 *  fallback render so old data still has a reasonable display. */
export function PlanSummary({ plan }: { plan: PlanData }) {
  return (
    <div className="grid gap-4">
      {plan.objetivoPrincipal ? (
        <div className="rounded-xl border-l-2 border-[#BB7154] bg-[#FBF9F4] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            Objetivo del tratamiento
          </p>
          <p className="mt-1 text-[13.5px] text-foreground">
            {plan.objetivoPrincipal}
          </p>
        </div>
      ) : null}

      {plan.tratamientos.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">
            Tratamientos sugeridos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.tratamientos.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-[#E7ECEA] px-3 py-1 text-sm font-medium text-[#4F605C]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {plan.numeroSesiones ? (
          <SmallStat label="Número de sesiones" value={plan.numeroSesiones} />
        ) : null}
        {plan.frecuencia ? (
          <SmallStat label="Frecuencia" value={plan.frecuencia} />
        ) : null}
      </div>

      {plan.notasClinicas ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground/80">
            Notas clínicas
          </p>
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-[13px] text-foreground/85">
            {plan.notasClinicas}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
        {label}
      </p>
      <p className="mt-0.5 text-[13.5px] font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}
