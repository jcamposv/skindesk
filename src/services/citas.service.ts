import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { unwrapNested } from "@/lib/supabase/select-helpers";
import type { Database } from "@/types/database.types";
import type { CitaStatus } from "@/schemas/citas.schema";

type CitaRow = Database["public"]["Tables"]["citas"]["Row"];

export interface AgendaCita {
  id: string;
  title: string;
  startAt: string; // ISO datetime
  endAt: string;
  status: CitaStatus;
  clienteId: string;
  clienteName: string;
  servicioId: string | null;
  servicioName: string | null;
  professionalId: string | null;
  professionalName: string;
  notes: string;
  version: number;
}

/**
 * Read citas overlapping the [from, to] half-open window. The calendar
 * passes its current view's bounds; we fetch only what's needed to
 * render plus a little padding the caller can add to cover scroll/scroll
 * boundaries.
 *
 * The query is RLS-scoped — both the citas filter and the joined
 * clientes/servicios/profiles rows are visible only within the caller's
 * tenant. Nested selects pull display names in one round-trip.
 */
export const getCitasInRange = cache(
  async (fromIso: string, toIso: string): Promise<AgendaCita[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("citas")
      .select(
        "id, title, start_at, end_at, status, notes, version, cliente_id, servicio_id, professional_id, professional_label, clientes(profile_id, profiles(full_name)), servicios(name), professional:profiles!citas_professional_id_fkey(full_name)",
      )
      .lt("start_at", toIso)
      .gte("end_at", fromIso)
      .order("start_at", { ascending: true })
      // Hard cap so a future bug or a runaway tenant can't flood the
      // calendar. 500 events in a ±35d window is well above any realistic
      // load; if we ever hit it we'll surface a "too many" UI affordance.
      .limit(500);

    if (error) {
      console.warn("[citas] getCitasInRange:", error.message);
      return [];
    }

    return (data ?? []).map(rowToAgendaCita);
  },
);

/** Total citas scheduled to start today (tenant-local). Used by the
 *  profesional dashboard's "Citas Hoy" stat tile. */
export const getCitasHoyCount = cache(async (): Promise<number> => {
  const { dayStart, dayEnd } = todayBoundsIso();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("citas")
    .select("id", { count: "estimated", head: true })
    .gte("start_at", dayStart)
    .lt("start_at", dayEnd);
  if (error) {
    console.warn("[citas] getCitasHoyCount:", error.message);
    return 0;
  }
  return count ?? 0;
});

/** Next N citas after `now`. Used by the dashboard's "Próximas citas"
 *  list. */
export const getProximasCitas = cache(
  async (limit = 4): Promise<AgendaCita[]> => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("citas")
      .select(
        "id, title, start_at, end_at, status, notes, version, cliente_id, servicio_id, professional_id, professional_label, clientes(profile_id, profiles(full_name)), servicios(name), professional:profiles!citas_professional_id_fkey(full_name)",
      )
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.warn("[citas] getProximasCitas:", error.message);
      return [];
    }
    return (data ?? []).map(rowToAgendaCita);
  },
);

// ─── Mapper ─────────────────────────────────────────────────────────────────

type CitaQueryRow = CitaRow & {
  clientes: { profile_id: string; profiles: { full_name: string | null } } | null;
  servicios: { name: string } | null;
  professional: { full_name: string | null } | null;
};

function rowToAgendaCita(row: unknown): AgendaCita {
  // The nested select returns objects-or-arrays-or-null per join, so we
  // address the casts in one place rather than spreading them through
  // call sites.
  const r = row as CitaQueryRow;
  const cliente = unwrapNested(r.clientes);
  const clienteProfile = unwrapNested(cliente?.profiles);
  const servicio = unwrapNested(r.servicios);
  const prof = unwrapNested(r.professional);

  const clienteName = clienteProfile?.full_name ?? "Clienta";
  const fallbackTitle = servicio?.name
    ? `${clienteName} · ${servicio.name}`
    : clienteName;

  return {
    id: r.id,
    title: r.title?.trim() ? r.title : fallbackTitle,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status as CitaStatus,
    notes: r.notes ?? "",
    version: r.version,
    clienteId: r.cliente_id,
    clienteName,
    servicioId: r.servicio_id,
    servicioName: servicio?.name ?? null,
    professionalId: r.professional_id,
    professionalName:
      prof?.full_name ?? r.professional_label ?? "",
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT_TIMEZONE = "America/Argentina/Buenos_Aires";

/** "Today" bounds as UTC ISO datetimes, anchored to the tenant TZ so a
 *  query at 22:00 local doesn't roll into tomorrow. */
function todayBoundsIso(): { dayStart: string; dayEnd: string } {
  const localToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: TENANT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  // The local day in the tenant TZ. Convert each end of the day to UTC
  // ISO so the >= and < range works against `timestamptz` columns.
  const [y, m, d] = localToday.split("-").map(Number) as [number, number, number];
  // Offset for AR is -03:00 year-round (no DST as of 2026).
  const dayStart = `${y}-${pad(m)}-${pad(d)}T00:00:00-03:00`;
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  const ty = tomorrow.getUTCFullYear();
  const tm = tomorrow.getUTCMonth() + 1;
  const td = tomorrow.getUTCDate();
  const dayEnd = `${ty}-${pad(tm)}-${pad(td)}T00:00:00-03:00`;
  return { dayStart, dayEnd };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
