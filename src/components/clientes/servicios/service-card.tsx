"use client";

import { CalendarDaysIcon, HistoryIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  FREQUENCY_LABEL,
  SERVICE_TYPE_LABEL,
  type AssignedService,
} from "./types";
import { SERVICE_VISUAL, STATUS_VISUAL } from "./service-type-visual";

interface ServiceCardProps {
  service: AssignedService;
  onAddSession: (serviceId: string) => void;
  onShowHistory: (serviceId: string) => void;
}

/**
 * Single service tile in the grid. Holds:
 *  - type icon + name + start date
 *  - status badge + frequency
 *  - progress bar + session dots (completed visually distinct from pending)
 *  - tag chips
 *  - actions: +Sesión, Ver historial
 */
export function ServiceCard({
  service,
  onAddSession,
  onShowHistory,
}: ServiceCardProps) {
  const visual = SERVICE_VISUAL[service.serviceType];
  const status = STATUS_VISUAL[service.status];
  const Icon = visual.icon;

  const completed = service.sessions.filter((s) => s.status === "completed").length;
  const progressPct = Math.min(100, Math.round((completed / service.totalSessions) * 100));
  const startDate = formatDate(service.startDate);
  const next = service.nextAppointment ? formatDate(service.nextAppointment) : null;

  return (
    <article
      className={cn(
        "group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm ring-1 transition-shadow hover:shadow-md sm:p-6",
        visual.ringColor,
      )}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            visual.iconBg,
            visual.iconColor,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            {SERVICE_TYPE_LABEL[service.serviceType]}
          </p>
          <h3 className="mt-0.5 truncate font-heading text-base font-medium tracking-tight text-foreground">
            {service.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
            <CalendarDaysIcon className="size-3" />
            Inicio · {startDate} · {FREQUENCY_LABEL[service.frequency]}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
            status.classes,
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
      </header>

      {/* Progress */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
          <span>
            Sesión <span className="font-semibold text-foreground">{completed}</span> de {service.totalSessions}
          </span>
          <span className="font-medium tabular-nums text-foreground/80">
            {progressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-full rounded-full bg-gradient-to-r from-[#5C6E6C] to-[#BB7154] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: service.totalSessions }).map((_, i) => {
            const session = service.sessions[i];
            const isCompleted = session?.status === "completed";
            const isScheduled = session?.status === "scheduled";
            return (
              <span
                key={i}
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                  isCompleted
                    ? "bg-[#BB7154] text-white"
                    : isScheduled
                      ? "border-2 border-dashed border-[#BB7154] text-[#8C4A30]"
                      : "border border-border/60 bg-muted/40 text-muted-foreground/70",
                )}
                title={
                  isCompleted
                    ? `Sesión ${i + 1} · completada`
                    : isScheduled
                      ? `Sesión ${i + 1} · agendada`
                      : `Sesión ${i + 1} · pendiente`
                }
              >
                {i + 1}
              </span>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      {service.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {service.tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-[#F4F1EC] px-2 py-0.5 text-[10.5px] font-medium text-foreground/75"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Footer */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <div className="min-w-0">
          {next ? (
            <p className="truncate text-[11.5px] text-muted-foreground">
              <span className="font-medium text-foreground/80">Próxima:</span> {next}
            </p>
          ) : (
            <p className="truncate text-[11.5px] text-muted-foreground">
              Sin próxima cita programada.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-[12px]"
            onClick={() => onShowHistory(service.id)}
          >
            <HistoryIcon className="size-3.5" />
            Historial
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 bg-[#BB7154] px-2.5 text-[12px] text-white shadow-sm hover:bg-[#A56146]"
            onClick={() => onAddSession(service.id)}
            disabled={service.status === "completed" || service.status === "cancelled"}
          >
            <PlusIcon className="size-3.5" />
            Sesión
          </Button>
        </div>
      </footer>
    </article>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
