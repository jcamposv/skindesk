"use server";

import { revalidatePath } from "next/cache";

import { citaAgendadaHtml } from "@/components/emails/cita-agendada";
import { getCalendarProvider } from "@/lib/calendar-providers";
import { ROUTES } from "@/lib/constants";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import { unwrapNested } from "@/lib/supabase/select-helpers";
import { getTenantConfig } from "@/lib/tenant-config";
import {
  checkAvailabilitySchema,
  citaCreateSchema,
  citaUpdateSchema,
  type CheckAvailabilityInput,
  type CitaCreateInput,
  type CitaUpdateInput,
} from "@/schemas/citas.schema";
import type { ActionState } from "@/types/supabase";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Tenant-local "miércoles 14 de mayo · 15:00" formatter for email bodies. */
function citaWhenFmt(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

interface CitaResult {
  id: string;
  version: number;
}

/**
 * Create a new cita. Tenant_id is filled by the BEFORE INSERT sync
 * trigger from the cliente row — so a client can't pass a forged value
 * even via direct PostgREST.
 *
 * Asistente writes are allowed via RLS gated by
 * `has_asistente_permission('citas','create')`. The action gate below
 * is defense-in-depth; super_admin + profesional always pass.
 */
export async function createCitaAction(
  input: CitaCreateInput,
): Promise<ActionState<CitaResult>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tienes permisos." };
  }

  const parsed = citaCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const supabase = await createClient();

  // Pre-flight overlap check: returns a nice form-field-shaped error
  // ({ errors: { startAt: ['overlap'] } }) instead of leaving the user
  // with a generic 23P01 toast. The EXCLUSION constraint
  // (citas_no_overlap_per_professional) is still the source of truth —
  // this is just a UX layer over it. A concurrent insert that sneaks in
  // between our check and the insert will get caught by the DB.
  const overlap = await detectOverlap(supabase, {
    professionalId: v.professionalId,
    startAt: v.startAt,
    endAt: v.endAt,
  });
  if (overlap) {
    return {
      success: false,
      message: "Conflicto de horario para ese profesional.",
      errors: { startAt: ["overlap"] },
    };
  }

  // Select the joined display fields the email needs in the same round-trip
  // — clienta email + name, optional service name, optional assigned prof.
  const { data, error } = await supabase
    .from("citas")
    .insert({
      // tenant_id is filled by the sync trigger.
      tenant_id: session.profile.tenant_id ?? "",
      cliente_id: v.clienteId,
      servicio_id: v.servicioId ?? null,
      professional_id: v.professionalId,
      professional_label: v.professionalLabel || null,
      title: v.title || null,
      start_at: v.startAt,
      end_at: v.endAt,
      status: v.status,
      notes: v.notes || null,
      cancellation_reason: v.cancellationReason || null,
    })
    .select(
      "id, version, cliente_id, start_at, notes, clientes(profile_id, profiles(full_name, email)), servicios(name), professional:profiles!citas_professional_id_fkey(full_name)",
    )
    .single();

  if (error || !data) {
    // The DB exclusion constraint may also fire (race with another tab).
    if (error?.code === "23P01") {
      return {
        success: false,
        message: "Conflicto de horario para ese profesional.",
        errors: { startAt: ["overlap"] },
      };
    }
    return { success: false, message: mapPgError(error) };
  }

  // Side-effects (both best-effort, never block the action):
  //   1. Notify the clienta via email.
  //   2. Sync to external calendar provider (no-op today; Google later).
  await Promise.allSettled([
    sendCitaAgendadaEmail({
      row: data,
      scheduledByName:
        session.tenant?.name ??
        session.profile.full_name ??
        "Tu cosmetóloga",
    }),
    syncToExternalCalendar(supabase, {
      id: data.id,
      tenantId: session.profile.tenant_id ?? null,
      title: v.title || data.id,
      startAt: v.startAt,
      endAt: v.endAt,
      notes: v.notes || null,
      status: v.status,
    }),
  ]);

  revalidatePath("/profesional");
  revalidatePath("/profesional/agenda");
  revalidatePath(`${ROUTES.clientes}/${data.cliente_id}`);
  return { success: true, data: { id: data.id, version: data.version } };
}

/** Route a freshly-created/updated cita through the active calendar
 *  provider. Writes the result back into `external_*` columns so the
 *  provider stays stateless and we keep an audit trail. Today's
 *  `LocalCalendarProvider` returns `disabled` and the columns just track
 *  that fact. */
async function syncToExternalCalendar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    id: string;
    tenantId: string | null;
    title: string;
    startAt: string;
    endAt: string;
    notes: string | null;
    status: Database["public"]["Tables"]["citas"]["Row"]["status"];
  },
): Promise<void> {
  try {
    const provider = getCalendarProvider(payload.tenantId);
    const result = await provider.upsert({
      citaId: payload.id,
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      notes: payload.notes,
      status: payload.status,
    });
    await supabase
      .from("citas")
      .update({
        external_provider: provider.name,
        external_event_id: result.externalEventId,
        external_sync_status: result.status,
        external_synced_at: new Date().toISOString(),
      })
      .eq("id", payload.id);
  } catch (err) {
    console.warn("[calendar-sync] unexpected error:", err);
  }
}

// ─── Email side-effect ──────────────────────────────────────────────────────

type CitaInsertReturn = {
  id: string;
  start_at: string;
  notes: string | null;
  clientes:
    | {
        profile_id: string;
        profiles: { full_name: string | null; email: string } | null;
      }
    | { profile_id: string; profiles: unknown }[]
    | null;
  servicios: { name: string } | { name: string }[] | null;
  professional:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
};

async function sendCitaAgendadaEmail({
  row,
  scheduledByName,
}: {
  row: CitaInsertReturn;
  scheduledByName: string;
}): Promise<void> {
  try {
    const cliente = unwrapNested(row.clientes);
    const profile = unwrapNested(cliente?.profiles) as
      | { full_name: string | null; email: string }
      | null;
    if (!profile?.email) return; // No address → nothing to send.

    const servicio = unwrapNested(row.servicios);
    const professional = unwrapNested(row.professional);
    const tenant = await getTenantConfig();

    const { error: mailErr } = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to: profile.email,
        subject: "Tienes una cita agendada en SkinDesk",
        html: citaAgendadaHtml({
          clientaName: profile.full_name ?? "Clienta",
          scheduledByName,
          servicioName: servicio?.name ?? null,
          whenLabel: citaWhenFmt(tenant.timezone).format(new Date(row.start_at)),
          professionalName: professional?.full_name ?? null,
          notes: row.notes,
          appUrl: getAppUrl(),
        }),
      },
      // Idempotency: the cita id is unique. If the action retries on a 5xx
      // Resend response we won't send twice within the 24h dedupe window.
      { idempotencyKey: `cita-agendada/${row.id}` },
    );
    if (mailErr) {
      console.warn("[cita-agendada] resend error:", JSON.stringify(mailErr));
    }
  } catch (err) {
    // Swallow — email is a best-effort side-effect, never block the action.
    console.warn("[cita-agendada] unexpected error:", err);
  }
}

/**
 * Update an existing cita. Optimistic concurrency: caller passes the
 * `expectedVersion` it last read; if the row was bumped in the
 * meantime we surface a 409-shaped error so the UI can refresh.
 */
export async function updateCitaAction(
  id: string,
  input: CitaUpdateInput,
  expectedVersion?: number,
): Promise<ActionState<CitaResult>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tienes permisos." };
  }

  const parsed = citaUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const supabase = await createClient();

  if (typeof expectedVersion === "number") {
    const { data: current, error: readErr } = await supabase
      .from("citas")
      .select("version, cliente_id")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { success: false, message: mapPgError(readErr) };
    if (!current) return { success: false, message: "Cita no encontrada." };
    if (current.version !== expectedVersion) {
      return {
        success: false,
        message:
          "Otro usuario actualizó esta cita. Refrescá la página y reintentá.",
        errors: { version: ["conflict"] },
      };
    }
  }

  // Same overlap pre-flight as create — excludes the cita being edited.
  const overlap = await detectOverlap(supabase, {
    professionalId: v.professionalId,
    startAt: v.startAt,
    endAt: v.endAt,
    excludeCitaId: id,
  });
  if (overlap) {
    return {
      success: false,
      message: "Conflicto de horario para ese profesional.",
      errors: { startAt: ["overlap"] },
    };
  }

  // When the user moves the cita to `cancelada`, stamp `cancelled_by`.
  // The DB also requires `cancellation_reason` (check constraint).
  const cancelledBy =
    v.status === "cancelada" ? session.profile.id : null;

  const { data, error } = await supabase
    .from("citas")
    .update({
      cliente_id: v.clienteId,
      servicio_id: v.servicioId ?? null,
      professional_id: v.professionalId,
      professional_label: v.professionalLabel || null,
      title: v.title || null,
      start_at: v.startAt,
      end_at: v.endAt,
      status: v.status,
      notes: v.notes || null,
      cancellation_reason: v.cancellationReason || null,
      cancelled_by: cancelledBy,
    })
    .eq("id", id)
    .select("id, version, cliente_id")
    .single();

  if (error || !data) {
    if (error?.code === "23P01") {
      return {
        success: false,
        message: "Conflicto de horario para ese profesional.",
        errors: { startAt: ["overlap"] },
      };
    }
    return { success: false, message: mapPgError(error) };
  }

  revalidatePath("/profesional");
  revalidatePath("/profesional/agenda");
  revalidatePath(`${ROUTES.clientes}/${data.cliente_id}`);
  return { success: true, data: { id: data.id, version: data.version } };
}

/** Hard-delete a cita. The UI uses this for "cancel and remove";
 *  marking a cita `cancelada` is a separate flow via `updateCitaAction`. */
export async function deleteCitaAction(
  id: string,
): Promise<ActionState<{ id: string }>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tienes permisos." };
  }

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("citas")
    .select("cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { success: false, message: mapPgError(readErr) };
  if (!row) return { success: false, message: "Cita no encontrada." };

  const { error: delErr } = await supabase
    .from("citas")
    .delete()
    .eq("id", id);
  if (delErr) return { success: false, message: mapPgError(delErr) };

  revalidatePath("/profesional");
  revalidatePath("/profesional/agenda");
  revalidatePath(`${ROUTES.clientes}/${row.cliente_id}`);
  return { success: true, data: { id } };
}

// ─── Service picker (used by the cita dialog) ──────────────────────────────

export interface CitaServicioOption {
  id: string;
  name: string;
  status: string;
}

/** Returns the clienta's services for the cita form's optional "Servicio"
 *  picker. RLS-scoped (the caller can only see her tenant's clientas).
 *  Cheap query — single round-trip, capped at 50. */
export async function listServiciosForClienteCitaAction(
  clienteId: string,
): Promise<ActionState<CitaServicioOption[]>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!clienteId) return { success: true, data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("servicios")
    .select("id, name, status")
    .eq("cliente_id", clienteId)
    .order("start_date", { ascending: false })
    .limit(50);
  if (error) return { success: false, message: mapPgError(error) };
  return {
    success: true,
    data: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
    })),
  };
}

// ─── Overlap helper (pre-flight for create/update) ─────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Returns `true` if a non-cancelled cita already exists in [startAt, endAt)
 * for `professionalId`. When `professionalId` is null we can't meaningfully
 * check (unassigned citas don't compete for a lane), so we return `false`.
 *
 * Cheap targeted check — uses the `(tenant_id, professional_id, start_at)`
 * composite index. Hits the DB only when there's a professional to check.
 */
async function detectOverlap(
  supabase: SupabaseClient<Database>,
  {
    professionalId,
    startAt,
    endAt,
    excludeCitaId,
  }: {
    professionalId: string | null;
    startAt: string;
    endAt: string;
    excludeCitaId?: string;
  },
): Promise<boolean> {
  if (!professionalId) return false;
  let query = supabase
    .from("citas")
    .select("id", { head: true, count: "exact" })
    .eq("professional_id", professionalId)
    .not("status", "in", "(cancelada,ausente)")
    .lt("start_at", endAt)
    .gt("end_at", startAt);
  if (excludeCitaId) query = query.neq("id", excludeCitaId);
  const { count, error } = await query;
  if (error) {
    // Defensive: on read failure, let the DB EXCLUSION constraint be the
    // last line of defense rather than blocking the user.
    console.warn("[citas] detectOverlap read failed:", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

// ─── Availability check ─────────────────────────────────────────────────────

export interface SlotConflict {
  id: string;
  title: string | null;
  startAt: string;
  endAt: string;
}

export interface SlotSuggestion {
  startAt: string;
  endAt: string;
}

export interface SlotAvailabilityResult {
  available: boolean;
  /** Up to 3 conflicting citas, ordered by start. */
  conflicts: SlotConflict[];
  /** Up to 3 alternative free slots of the same duration, after `endAt`. */
  suggestions: SlotSuggestion[];
}

const SUGGESTION_HORIZON_DAYS = 14;

/**
 * Reports whether the requested (startAt, endAt) overlaps any non-cancelled
 * cita for the given professional, and offers up to 3 alternative slots of
 * the same duration in the next 14 days.
 *
 * Single round-trip: we fetch the professional's upcoming citas once and
 * compute conflicts + suggestions JS-side. The `(tenant_id,
 * professional_id, start_at)` composite index on `citas` covers this scan.
 *
 * If `professionalId` is null we cannot meaningfully check conflicts, so
 * we report available=true and skip the DB call.
 */
export async function checkCitaAvailabilityAction(
  input: CheckAvailabilityInput,
): Promise<ActionState<SlotAvailabilityResult>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tienes permisos." };
  }

  const parsed = checkAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { startAt, endAt, professionalId, excludeCitaId } = parsed.data;

  // Without a professional we can't tell who'd conflict — surface as
  // "available" so the UI doesn't show a false red flag. UI may render a
  // muted hint instead.
  if (!professionalId) {
    return {
      success: true,
      data: { available: true, conflicts: [], suggestions: [] },
    };
  }

  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  const durationMs = endMs - startMs;
  const horizonMs = startMs + SUGGESTION_HORIZON_DAYS * 86_400_000;

  const supabase = await createClient();
  // Fetch all non-cancelled citas for THIS professional in the next 14d
  // window. The composite index lets the planner skip the rest of the
  // tenant's load. Hard cap at 200 — well above any realistic load.
  const { data, error } = await supabase
    .from("citas")
    .select("id, title, start_at, end_at")
    .eq("professional_id", professionalId)
    .not("status", "in", "(cancelada,ausente)")
    .lt("start_at", new Date(horizonMs).toISOString())
    .gt("end_at", new Date(startMs).toISOString())
    .order("start_at", { ascending: true })
    .limit(200);

  if (error) {
    return { success: false, message: mapPgError(error) };
  }

  // Exclude the cita being edited from the scan, then split into:
  //  · conflicts that overlap the requested window
  //  · the rest (used to find free gaps for suggestions)
  const rows = (data ?? []).filter((r) => r.id !== excludeCitaId);
  const conflictsAll: SlotConflict[] = [];
  for (const r of rows) {
    const s = new Date(r.start_at).getTime();
    const e = new Date(r.end_at).getTime();
    if (s < endMs && e > startMs) {
      conflictsAll.push({
        id: r.id,
        title: r.title,
        startAt: r.start_at,
        endAt: r.end_at,
      });
    }
  }
  const available = conflictsAll.length === 0;

  // Only compute suggestions when blocked — otherwise the form is happy
  // and the UI hides the suggestions row.
  const tenant = await getTenantConfig();
  const suggestions: SlotSuggestion[] = available
    ? []
    : findFreeSlotsLinear({
        from: endMs,
        until: horizonMs,
        durationMs,
        existing: rows
          .map((r) => ({
            start: new Date(r.start_at).getTime(),
            end: new Date(r.end_at).getTime(),
          }))
          .sort((a, b) => a.start - b.start),
        count: 3,
        timezone: tenant.timezone,
        businessHoursStart: tenant.businessHoursStart,
        businessHoursEnd: tenant.businessHoursEnd,
      });

  return {
    success: true,
    data: {
      available,
      conflicts: conflictsAll.slice(0, 3),
      suggestions,
    },
  };
}

/**
 * Linear gap-walk over a sorted event list. For each gap that's large
 * enough, splits it into business-hours windows and emits the earliest
 * `count` slots that fit a `durationMs`-long cita.
 *
 * O(n + count) over the existing-events array (vs the old O(steps × n)
 * fixed-step walk) — scales cleanly when the professional has many
 * upcoming events.
 */
function findFreeSlotsLinear({
  from,
  until,
  durationMs,
  existing,
  count,
  timezone,
  businessHoursStart,
  businessHoursEnd,
}: {
  from: number;
  until: number;
  durationMs: number;
  existing: { start: number; end: number }[];
  count: number;
  timezone: string;
  businessHoursStart: number;
  businessHoursEnd: number;
}): SlotSuggestion[] {
  const out: SlotSuggestion[] = [];
  let cursor = from;
  // Tail sentinel so the loop emits a final gap from the last event to `until`.
  const events = [...existing, { start: until, end: until }];

  for (const ev of events) {
    if (out.length >= count) break;
    if (ev.start <= cursor) {
      cursor = Math.max(cursor, ev.end);
      continue;
    }
    // Free gap [cursor, ev.start) — try to fit slots inside it, clipping
    // each candidate into the tenant's business window for its local day.
    let slot = roundUpToStep(cursor, 15 * 60_000);
    while (slot + durationMs <= ev.start && out.length < count) {
      const slotEnd = slot + durationMs;
      const window = businessHoursWindowFor(
        slot,
        timezone,
        businessHoursStart,
        businessHoursEnd,
      );
      if (slot < window.startMs) {
        // Before today's business hours — jump to the start of business.
        slot = window.startMs;
        continue;
      }
      if (slotEnd > window.endMs) {
        // Past today's business hours — jump to tomorrow's start.
        slot = window.nextDayStartMs;
        continue;
      }
      out.push({
        startAt: new Date(slot).toISOString(),
        endAt: new Date(slotEnd).toISOString(),
      });
      slot = slotEnd;
    }
    cursor = ev.end;
  }
  return out;
}

function roundUpToStep(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
}

/** Returns the business-hours window for the local day containing `ms`,
 *  plus the start-of-business of the next day. All UTC millisecond
 *  timestamps. Computed via `Intl.DateTimeFormat` for DST safety. */
function businessHoursWindowFor(
  ms: number,
  timezone: string,
  startHour: number,
  endHour: number,
): { startMs: number; endMs: number; nextDayStartMs: number } {
  const day = localDay(ms, timezone); // { y, m, d } in tenant TZ
  const startMs = utcMsFromLocal(day, startHour, timezone);
  const endMs = utcMsFromLocal(day, endHour, timezone);
  const nextDay = addDays(day, 1);
  const nextDayStartMs = utcMsFromLocal(nextDay, startHour, timezone);
  return { startMs, endMs, nextDayStartMs };
}

function localDay(
  ms: number,
  timezone: string,
): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Approximate UTC ms for "hour:minute" of a local day in `timezone`.
 *  Uses a single offset probe — accurate enough since we round to 15-min
 *  steps and AR has no DST as of 2026. */
function utcMsFromLocal(
  day: { y: number; m: number; d: number },
  hourFloat: number,
  timezone: string,
): number {
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  // Probe: build a Date assumed in UTC, then ask Intl what hour that
  // displays as in the tenant TZ — the delta is the offset.
  const probeUtc = Date.UTC(day.y, day.m - 1, day.d, h, m);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(probeUtc));
  const probeH = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const probeM = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const probeFloat = probeH + probeM / 60;
  const offsetMs = (probeFloat - hourFloat) * 3_600_000;
  return probeUtc - offsetMs;
}

function addDays(
  day: { y: number; m: number; d: number },
  n: number,
): { y: number; m: number; d: number } {
  const d = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
  };
}
