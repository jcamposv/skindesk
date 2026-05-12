"use client";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./agenda-calendar.css";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type SlotInfo,
  type View,
  Views,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientePickerItem } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";
import type { AgendaCita } from "@/services/citas.service";

import { CitaDialog, type CitaDialogState } from "./cita-dialog";
import { useCitaMutations } from "./use-cita-mutations";

const locales = { es } as const;
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const MESSAGES = {
  date: "Fecha",
  time: "Hora",
  event: "Cita",
  allDay: "Todo el día",
  week: "Semana",
  work_week: "Semana laboral",
  day: "Día",
  month: "Mes",
  previous: "Anterior",
  next: "Siguiente",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  today: "Hoy",
  agenda: "Agenda",
  noEventsInRange: "No hay citas en este rango.",
  showMore: (count: number) => `+${count} más`,
} as const;

// Visual coding per status — matches the rest of the app's palette.
// Light card background (the event body), darker pill (status chip on top),
// stronger left rail (status accent).
const STATUS_BG: Record<AgendaCita["status"], string> = {
  pendiente: "#FFF6E5",
  confirmada: "#EEF3F1",
  completada: "#FBEFE7",
  cancelada: "#F4F1EC",
  ausente: "#FBE4E0",
};
const STATUS_BORDER: Record<AgendaCita["status"], string> = {
  pendiente: "#D2A96A",
  confirmada: "#6E8A82",
  completada: "#BB7154",
  cancelada: "#9CA3AF",
  ausente: "#C58F8A",
};
const STATUS_TEXT: Record<AgendaCita["status"], string> = {
  pendiente: "#7C5E1F",
  confirmada: "#4F605C",
  completada: "#8C4A30",
  cancelada: "#6B7280",
  ausente: "#7A3F3C",
};
const STATUS_PILL_BG: Record<AgendaCita["status"], string> = {
  pendiente: "#F8E0AE",
  confirmada: "#D4DFDB",
  completada: "#F6D6C2",
  cancelada: "#E5E1DA",
  ausente: "#F4C9C2",
};
const STATUS_LABEL: Record<AgendaCita["status"], string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  ausente: "No asistió",
};

const UNASSIGNED_RESOURCE_ID = "_unassigned";

// Calendar viewport bounds — hoisted to module scope so we don't create
// fresh Date objects on every render (rbc uses these in its own useMemo
// deps; new identities would invalidate downstream memoisation).
const CALENDAR_MIN = new Date(0, 0, 0, 7, 0);
const CALENDAR_MAX = new Date(0, 0, 0, 22, 0);

/** Shape react-big-calendar consumes — start/end as `Date` objects. */
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** Drives the per-professional resource view; `_unassigned` when null. */
  resourceId: string;
  resource: AgendaCita;
}

interface AgendaCalendarProps {
  initialCitas: AgendaCita[];
  clientes: ClientePickerItem[];
  staff: StaffMember[];
  /** Current logged-in profesional — pre-fills the form. */
  currentProfesional: { id: string; full_name: string };
}

/**
 * Calendar shell. Owns the dialog open state + handles slot click (create)
 * and event click (edit). Data fetches live in the server component above
 * us; mutations go through actions + `router.refresh()`.
 */
export function AgendaCalendar({
  initialCitas,
  clientes,
  staff,
  currentProfesional,
}: AgendaCalendarProps) {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState<Date>(new Date());
  const [byResource, setByResource] = useState(false);

  // null = no dialog. `{ mode: "create", slot }` opens a blank form
  // pre-filled with the clicked slot. `{ mode: "edit", cita }` opens
  // the edit form.
  const [dialogState, setDialogState] = useState<CitaDialogState | null>(null);

  const closeDialog = useCallback(() => setDialogState(null), []);
  const { isPending, handleCreate, handleUpdate, handleDelete } =
    useCitaMutations({ onSuccess: closeDialog });

  const events: CalendarEvent[] = useMemo(
    () =>
      initialCitas.map((c) => ({
        id: c.id,
        title: c.title,
        start: new Date(c.startAt),
        end: new Date(c.endAt),
        resourceId: c.professionalId ?? UNASSIGNED_RESOURCE_ID,
        resource: c,
      })),
    [initialCitas],
  );

  // Resource columns for the "Ver por profesionales" view. Always tail
  // with a "Sin asignar" lane so citas without a professional don't drop
  // out of the calendar entirely.
  const resources = useMemo(
    () => [
      ...staff.map((s) => ({
        resourceId: s.id,
        resourceTitle: s.fullName,
      })),
      { resourceId: UNASSIGNED_RESOURCE_ID, resourceTitle: "Sin asignar" },
    ],
    [staff],
  );

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => {
      const status = event.resource.status;
      return {
        style: {
          backgroundColor: STATUS_BG[status],
          borderLeft: `3px solid ${STATUS_BORDER[status]}`,
          color: STATUS_TEXT[status],
          borderRadius: "8px",
          fontSize: "12px",
          padding: "2px 6px",
        },
      };
    },
    [],
  );

  const calendarComponents = useMemo(
    () => ({
      event: CitaEventCard,
      resourceHeader: ResourceHeaderCell,
    }),
    [],
  );

  function handleSelectSlot(slot: SlotInfo) {
    // In resource view the clicked slot knows its `resourceId` (the
    // professional's column). Pre-fill the dialog with that professional
    // so the user doesn't have to pick it again.
    const resourceId = (slot as SlotInfo & { resourceId?: string }).resourceId;
    const prefillProfessional =
      resourceId && resourceId !== UNASSIGNED_RESOURCE_ID
        ? resourceId
        : undefined;
    setDialogState({
      mode: "create",
      defaults: {
        startAt: slot.start.toISOString(),
        endAt: slot.end.toISOString(),
        professionalId: prefillProfessional,
      },
    });
  }

  function handleSelectEvent(event: CalendarEvent) {
    setDialogState({ mode: "edit", cita: event.resource });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-medium tracking-tight">
          Agenda
        </h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              // Resource view only renders in DAY — flip both at once.
              setByResource((b) => {
                if (!b) setView(Views.DAY);
                return !b;
              });
            }}
            className={cn(
              "gap-1.5",
              byResource &&
                "border-[#BB7154]/40 bg-[#F6E0D6] text-[#8C4A30] hover:bg-[#F1D2C2]",
            )}
          >
            <UsersIcon className="size-3.5" />
            {byResource ? "Vista combinada" : "Ver por profesionales"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const now = new Date();
              const end = new Date(now.getTime() + 60 * 60 * 1000);
              setDialogState({
                mode: "create",
                defaults: {
                  startAt: now.toISOString(),
                  endAt: end.toISOString(),
                },
              });
            }}
            className="gap-1.5 bg-[#BB7154] text-white shadow-sm hover:bg-[#A56146]"
          >
            + Agendar
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "rbc-shell rounded-xl border border-border/60 bg-card p-2",
          byResource && "rbc-shell-resources",
          isPending && "pointer-events-none opacity-70",
        )}
        style={{ height: "82vh" }}
      >
        <Calendar
          localizer={localizer}
          culture="es"
          messages={MESSAGES}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={
            byResource
              ? [Views.DAY]
              : [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]
          }
          defaultView={Views.WEEK}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          step={30}
          timeslots={2}
          min={CALENDAR_MIN}
          max={CALENDAR_MAX}
          eventPropGetter={eventPropGetter}
          components={calendarComponents}
          resources={byResource ? resources : undefined}
          resourceIdAccessor={byResource ? "resourceId" : undefined}
          resourceTitleAccessor={byResource ? "resourceTitle" : undefined}
          popup
        />
      </div>

      {dialogState != null ? (
        <CitaDialog
          state={dialogState}
          clientes={clientes}
          staff={staff}
          currentProfesional={currentProfesional}
          saving={isPending}
          onClose={() => setDialogState(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

// ─── Custom calendar children ───────────────────────────────────────────────

/**
 * Event card with a status pill on top + clienta + service line —
 * matches the resource-view design in the reference screenshot.
 */
function CitaEventCard({ event }: { event: CalendarEvent }) {
  const c = event.resource;
  // Row 1 stays at one line — pill + name share the row, truncate on the
  // name so the pill is always visible. Row 2 (service) only renders when
  // the slot has vertical room; we let `overflow: hidden` on the parent
  // clip it cleanly on tiny 15-min slots without warping row 1.
  return (
    <div className="flex h-full min-w-0 flex-col gap-0.5 overflow-hidden leading-tight">
      <div className="flex min-w-0 items-center gap-1">
        <span
          className="inline-flex shrink-0 items-center rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: STATUS_PILL_BG[c.status],
            color: STATUS_TEXT[c.status],
          }}
        >
          {STATUS_LABEL[c.status]}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
          {c.clienteName}
        </span>
      </div>
      {c.servicioName ? (
        <span className="truncate text-[10.5px] opacity-75">
          {c.servicioName}
        </span>
      ) : null}
    </div>
  );
}

/** Resource column header — avatar circle (initials) over the name. */
function ResourceHeaderCell({
  label,
}: {
  label: ReactNode;
}) {
  const name = typeof label === "string" ? label : String(label ?? "");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-[#F6E0D6] text-[10.5px] font-semibold text-[#8C4A30] ring-1 ring-[#BB7154]/20">
        {initials || "·"}
      </span>
      <span className="text-[11px] font-medium text-foreground/80">
        {name}
      </span>
    </div>
  );
}
