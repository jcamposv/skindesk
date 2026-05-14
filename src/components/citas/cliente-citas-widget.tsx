import { CalendarClockIcon, CalendarOffIcon, CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import type { AgendaCita } from "@/services/citas.service";
import type { CitaStatus } from "@/schemas/citas.schema";
import Link from "next/link";

interface ClienteCitasWidgetProps {
  upcoming: AgendaCita[];
  recent: AgendaCita[];
}

// Display palette mirrors the agenda calendar event pills.
const STATUS_DOT: Record<CitaStatus, string> = {
  pendiente: "#D2A96A",
  confirmada: "#6E8A82",
  completada: "#BB7154",
  cancelada: "#9CA3AF",
  ausente: "#C58F8A",
};

const STATUS_LABEL: Record<CitaStatus, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  ausente: "No asistió",
};

const DAY_FMT = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const TIME_FMT = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Compact two-column widget that lives between the cliente-detail header
 * and the tabs. Surfaces the clienta's upcoming + recent citas without
 * forcing the user to bounce to the agenda. Read-only — interactions
 * happen on the calendar via deep link.
 */
export function ClienteCitasWidget({
  upcoming,
  recent,
}: ClienteCitasWidgetProps) {
  if (upcoming.length === 0 && recent.length === 0) {
    return (
      <section className="rounded-xl border border-border/60 bg-card p-4">
        <header className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-[13px] font-medium tracking-tight">
            Citas
          </h2>
          <Link
            href={ROUTES.agenda}
            className="text-xs font-medium text-[#5C6E6C] hover:underline"
          >
            Abrir agenda
          </Link>
        </header>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-foreground/75">
          <CalendarOffIcon className="size-3.5" aria-hidden />
          Esta clienta no tiene citas agendadas todavía.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 md:grid-cols-2">
      <CitaList
        title="Próximas citas"
        icon={<CalendarClockIcon className="size-3.5" />}
        items={upcoming}
        emptyCopy="Sin próximas citas."
      />
      <CitaList
        title="Historial reciente"
        icon={<CheckIcon className="size-3.5" />}
        items={recent}
        emptyCopy="Sin citas pasadas."
      />
    </section>
  );
}

function CitaList({
  title,
  icon,
  items,
  emptyCopy,
}: {
  title: string;
  icon: React.ReactNode;
  items: AgendaCita[];
  emptyCopy: string;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80">
        {icon}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-foreground/75">{emptyCopy}</p>
      ) : (
        <ul className="grid gap-1.5">
          {items.map((c) => (
            <CitaRow key={c.id} cita={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CitaRow({ cita }: { cita: AgendaCita }) {
  const start = new Date(cita.startAt);
  return (
    <li className="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-background px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-foreground leading-tight">
          {cita.servicioName ?? cita.title ?? "Cita"}
        </p>
        <p className="truncate text-xs font-medium text-foreground/75">
          {DAY_FMT.format(start)} · {TIME_FMT.format(start)}
          {cita.professionalName ? ` · ${cita.professionalName}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        )}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: STATUS_DOT[cita.status] }}
          aria-hidden
        />
        {STATUS_LABEL[cita.status]}
      </span>
    </li>
  );
}
