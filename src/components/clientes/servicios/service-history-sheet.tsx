"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { SessionDetailExpanded } from "./session-detail-expanded";
import {
  SERVICE_TYPE_LABEL,
  type AssignedService,
  type Session,
} from "./types";
import { SERVICE_VISUAL } from "./service-type-visual";

interface ServiceHistorySheetProps {
  service: AssignedService | null;
  onClose: () => void;
}

/**
 * History viewer — centered Dialog at `max-w-6xl × 90vh`. Not a side sheet,
 * because each session expands to show a 2-column detail (read-only map +
 * clinical fields) that needs real horizontal room. The mobile case
 * collapses to nearly full viewport via `w-[calc(100%-1rem)]`.
 *
 * Each completed session is a collapsible row. Scheduled / pending rows
 * render flat — they have nothing to expand yet.
 *
 * Export name is kept for backward compatibility with existing imports
 * (it's still referred to as "ServiceHistorySheet" upstream).
 */
export function ServiceHistorySheet({
  service,
  onClose,
}: ServiceHistorySheetProps) {
  return (
    <Dialog open={service != null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex h-[90vh] w-[calc(100%-1rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          {service ? (
            <HistoryBody service={service} onClose={onClose} />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Body ───────────────────────────────────────────────────────────────────

function HistoryBody({
  service,
  onClose,
}: {
  service: AssignedService;
  onClose: () => void;
}) {
  const completed = service.sessions.filter((s) => s.status === "completed").length;
  const visual = SERVICE_VISUAL[service.serviceType];
  const Icon = visual.icon;

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b px-5 pt-4 pb-3 lg:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              visual.iconBg,
              visual.iconColor,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
              Historial · {SERVICE_TYPE_LABEL[service.serviceType]}
            </p>
            <DialogPrimitive.Title className="truncate font-heading text-base font-medium tracking-tight">
              {service.name}
            </DialogPrimitive.Title>
            <p className="truncate text-[12px] text-muted-foreground">
              {completed} de {service.totalSessions} sesiones · toca una sesión
              para ver el detalle clínico.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cerrar"
        >
          <XIcon className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-6">
        <ol className="relative grid gap-3 border-l border-border/60 pl-5">
          {service.sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              serviceType={service.serviceType}
            />
          ))}
        </ol>
      </div>
    </>
  );
}

// ─── Single timeline row ────────────────────────────────────────────────────

function SessionRow({
  session,
  serviceType,
}: {
  session: Session;
  serviceType: AssignedService["serviceType"];
}) {
  const isCompleted = session.status === "completed";
  const isScheduled = session.status === "scheduled";
  const visual = SERVICE_VISUAL[serviceType];
  // Completed sessions are expandable; scheduled/pending rows render flat
  // (no payload to display yet).
  const expandable = isCompleted;
  const [open, setOpen] = useState(false);

  return (
    <li
      className={cn(
        "relative grid gap-2 rounded-2xl border p-4 transition-colors",
        isCompleted
          ? "border-border/60 bg-card"
          : isScheduled
            ? "border-[#BB7154]/40 bg-[#FBEFE7]/40"
            : "border-dashed border-border/50 bg-muted/30",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -left-[33px] top-5 flex size-6 items-center justify-center rounded-full border-4 border-background",
          isCompleted
            ? "bg-[#5C6E6C] text-white"
            : isScheduled
              ? "bg-[#BB7154] text-white"
              : "bg-muted text-muted-foreground",
        )}
      >
        {isCompleted ? (
          <CheckCircle2Icon className="size-3" />
        ) : (
          <ClockIcon className="size-3" />
        )}
      </span>

      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          "grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 text-left",
          expandable && "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-[11px] font-bold",
            isCompleted
              ? `${visual.iconBg} ${visual.iconColor}`
              : "bg-muted text-muted-foreground",
          )}
        >
          #{session.sessionNumber}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight">
            {formatDate(session.date)}
          </p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <UserIcon className="size-2.5" />
            {session.professional}
            <span aria-hidden className="mx-1 opacity-50">·</span>
            <CalendarDaysIcon className="size-2.5" />
            {session.durationMin} min
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
            isCompleted
              ? "border-[#5C6E6C]/30 bg-[#E7ECEA] text-[#4F605C]"
              : isScheduled
                ? "border-[#BB7154]/30 bg-[#F6E0D6] text-[#8C4A30]"
                : "border-border/60 bg-muted/40 text-muted-foreground",
          )}
        >
          {isCompleted ? "Completada" : isScheduled ? "Agendada" : "Pendiente"}
        </span>
        {expandable ? (
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        ) : (
          <span aria-hidden className="size-4" />
        )}
      </button>

      {session.notes && !open ? (
        <p className="text-[12px] text-foreground/85">{session.notes}</p>
      ) : null}

      {expandable && open ? (
        <SessionDetailExpanded session={session} serviceType={serviceType} />
      ) : null}
    </li>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
