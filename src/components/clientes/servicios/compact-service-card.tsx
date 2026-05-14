"use client";

import { CalendarDaysIcon, HistoryIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  SERVICE_TYPE_LABEL,
  type AssignedService,
} from "./types";
import { SERVICE_VISUAL, STATUS_VISUAL } from "./service-type-visual";

interface CompactServiceCardProps {
  service: AssignedService;
  onShowHistory: (serviceId: string) => void;
}

/**
 * Dense single-row variant of ServiceCard. Used in the "Histórico" group
 * (completados / cancelados) where the cosmetóloga wants to scan a list,
 * not study each card. Keeps the type icon + name + completion summary so
 * the visual identity survives, drops session dots and tags.
 */
export function CompactServiceCard({
  service,
  onShowHistory,
}: CompactServiceCardProps) {
  const visual = SERVICE_VISUAL[service.serviceType];
  const status = STATUS_VISUAL[service.status];
  const Icon = visual.icon;

  const completed = service.sessions.filter((s) => s.status === "completed").length;
  const startDate = formatDate(service.startDate);
  const isCancelled = service.status === "cancelled";

  return (
    <button
      type="button"
      onClick={() => onShowHistory(service.id)}
      className={cn(
        "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:border-[#BB7154]/40 hover:bg-[#FBEFE7]/20",
        isCancelled && "opacity-70",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          visual.iconBg,
          visual.iconColor,
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p
            className={cn(
              "truncate text-[13px] font-medium text-foreground",
              isCancelled && "line-through decoration-muted-foreground/50",
            )}
          >
            {service.name}
          </p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0 text-[11px] font-medium",
              status.classes,
            )}
          >
            <span aria-hidden className={cn("size-1 rounded-full", status.dot)} />
            {status.label}
          </span>
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-foreground/75">
          <span>{SERVICE_TYPE_LABEL[service.serviceType]}</span>
          <span aria-hidden className="opacity-40">·</span>
          <CalendarDaysIcon className="size-2.5" />
          <span>{startDate}</span>
          <span aria-hidden className="opacity-40">·</span>
          <span className="tabular-nums">
            {completed}/{service.totalSessions} sesiones
          </span>
        </p>
      </div>

      <span className="hidden shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:border-[#BB7154]/30 group-hover:bg-card group-hover:text-[#8C4A30] sm:inline-flex">
        <HistoryIcon className="size-3" />
        Historial
      </span>
    </button>
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
