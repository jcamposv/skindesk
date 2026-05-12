"use server";

import { revalidatePath } from "next/cache";

import { citaAgendadaHtml } from "@/components/emails/cita-agendada";
import { ROUTES } from "@/lib/constants";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import { unwrapNested } from "@/lib/supabase/select-helpers";
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
const CITA_WHEN_FMT = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

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
  if (!session) return { success: false, message: "No autenticado." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
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
    })
    .select(
      "id, version, cliente_id, start_at, notes, clientes(profile_id, profiles(full_name, email)), servicios(name), professional:profiles!citas_professional_id_fkey(full_name)",
    )
    .single();

  if (error || !data) {
    return { success: false, message: mapPgError(error) };
  }

  // Side-effect: notify the clienta. Awaited so a slow/dead Resend doesn't
  // race the revalidate, but wrapped — a mail failure must NOT roll back
  // the cita the user just successfully scheduled.
  await sendCitaAgendadaEmail({
    row: data,
    scheduledByName:
      session.tenant?.name ??
      session.profile.full_name ??
      "Tu cosmetóloga",
  });

  revalidatePath("/profesional");
  revalidatePath("/profesional/agenda");
  revalidatePath(`${ROUTES.clientes}/${data.cliente_id}`);
  return { success: true, data: { id: data.id, version: data.version } };
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

    const { error: mailErr } = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to: profile.email,
        subject: "Tenés una cita agendada en SkinDesk",
        html: citaAgendadaHtml({
          clientaName: profile.full_name ?? "Clienta",
          scheduledByName,
          servicioName: servicio?.name ?? null,
          whenLabel: CITA_WHEN_FMT.format(new Date(row.start_at)),
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
  if (!session) return { success: false, message: "No autenticado." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
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
    })
    .eq("id", id)
    .select("id, version, cliente_id")
    .single();

  if (error || !data) {
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
  if (!session) return { success: false, message: "No autenticado." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
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
const SUGGESTION_BUSINESS_START_HOUR = 9; // tenant-local
const SUGGESTION_BUSINESS_END_HOUR = 20;
const TENANT_TZ = "America/Argentina/Buenos_Aires";

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
  if (!session) return { success: false, message: "No autenticado." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
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
  const suggestions: SlotSuggestion[] = available
    ? []
    : findFreeSlots({
        from: endMs,
        until: horizonMs,
        durationMs,
        existing: rows.map((r) => ({
          start: new Date(r.start_at).getTime(),
          end: new Date(r.end_at).getTime(),
        })),
        count: 3,
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

/** Walk forward in 15-min steps within tenant business hours and return the
 *  first `count` slots that don't overlap any cita in `existing`. */
function findFreeSlots({
  from,
  until,
  durationMs,
  existing,
  count,
}: {
  from: number;
  until: number;
  durationMs: number;
  existing: { start: number; end: number }[];
  count: number;
}): SlotSuggestion[] {
  const STEP_MS = 15 * 60_000;
  const out: SlotSuggestion[] = [];
  let candidate = roundUpToStep(from, STEP_MS);

  while (candidate < until && out.length < count) {
    const candidateEnd = candidate + durationMs;
    if (
      withinBusinessHours(candidate, candidateEnd) &&
      !overlapsAny(candidate, candidateEnd, existing)
    ) {
      out.push({
        startAt: new Date(candidate).toISOString(),
        endAt: new Date(candidateEnd).toISOString(),
      });
      // Skip past this slot so we don't emit overlapping suggestions.
      candidate = candidateEnd;
      continue;
    }
    candidate += STEP_MS;
  }
  return out;
}

function roundUpToStep(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
}

function overlapsAny(
  start: number,
  end: number,
  events: { start: number; end: number }[],
): boolean {
  for (const e of events) {
    if (e.start < end && e.end > start) return true;
  }
  return false;
}

/** Both start AND end must fall inside the tenant's business window. */
function withinBusinessHours(startMs: number, endMs: number): boolean {
  const startHour = tenantLocalHourFloat(startMs);
  const endHour = tenantLocalHourFloat(endMs);
  // If the candidate end rolls past 20:00 (or crosses midnight) we skip.
  if (endHour < startHour) return false;
  return (
    startHour >= SUGGESTION_BUSINESS_START_HOUR &&
    endHour <= SUGGESTION_BUSINESS_END_HOUR
  );
}

/** Hour-of-day in tenant TZ, as a fractional float (e.g. 9.5 for 09:30). */
function tenantLocalHourFloat(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TENANT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h + m / 60;
}
