import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type {
  AssignedService,
  CorporalSession,
  FacialSession,
  FrequencyKey,
  LaserDiagnosis,
  LaserSession,
  OtherSession,
  ServiceStatus,
  ServiceType,
  Session,
  SessionPayload,
  SessionStatus,
} from "@/components/clientes/servicios/types";

type ServicioRow = Database["public"]["Tables"]["servicios"]["Row"];
type SesionRow = Database["public"]["Tables"]["sesiones"]["Row"];

/**
 * Read all services for a clienta, sessions inlined, signed URLs attached
 * for any photo paths so the UI never sees raw storage paths.
 *
 * RLS scopes both selects to the caller's tenant. Wrapped in React.cache so
 * the page + tab share a single round-trip.
 *
 * Implementation note: we issue two queries (servicios + sesiones in their
 * own SELECT) rather than a join because the SDK's `select(... sesiones(*))`
 * nested syntax loses array order and we'd have to re-sort client-side
 * anyway. Two round-trips is fine — both hit indexed columns.
 */
export const getServiciosForCliente = cache(
  async (clienteId: string): Promise<AssignedService[]> => {
    const supabase = await createClient();

    const { data: servicios, error: servErr } = await supabase
      .from("servicios")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (servErr) throw new Error(servErr.message);
    if (!servicios || servicios.length === 0) return [];

    const servicioIds = servicios.map((s) => s.id);
    const { data: sesiones, error: sesErr } = await supabase
      .from("sesiones")
      .select("*")
      .in("servicio_id", servicioIds)
      .order("session_number", { ascending: true });

    if (sesErr) throw new Error(sesErr.message);

    const allPaths = (sesiones ?? []).flatMap((s) => [
      ...s.before_paths,
      ...s.after_paths,
    ]);
    const urlByPath = await signPhotoUrls(allPaths);
    const profileNameById = await fetchProfileNames(
      collectProfessionalIds(servicios, sesiones ?? []),
    );

    const sessionsByService = new Map<string, Session[]>();
    for (const row of sesiones ?? []) {
      const session = rowToSession(row, urlByPath, profileNameById);
      const bucket = sessionsByService.get(row.servicio_id) ?? [];
      bucket.push(session);
      sessionsByService.set(row.servicio_id, bucket);
    }

    return servicios.map((row) =>
      rowToServicio(row, sessionsByService.get(row.id) ?? [], profileNameById),
    );
  },
);

/** Single-service variant used by the addSession action to look up version
 *  + tenant + type without re-fetching the whole list. */
export const getServicioById = cache(
  async (servicioId: string): Promise<AssignedService | null> => {
    const supabase = await createClient();

    const { data: row, error } = await supabase
      .from("servicios")
      .select("*")
      .eq("id", servicioId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    const { data: sesiones, error: sesErr } = await supabase
      .from("sesiones")
      .select("*")
      .eq("servicio_id", servicioId)
      .order("session_number", { ascending: true });

    if (sesErr) throw new Error(sesErr.message);

    const allPaths = (sesiones ?? []).flatMap((s) => [
      ...s.before_paths,
      ...s.after_paths,
    ]);
    const urlByPath = await signPhotoUrls(allPaths);
    const profileNameById = await fetchProfileNames(
      collectProfessionalIds([row], sesiones ?? []),
    );

    const mappedSessions = (sesiones ?? []).map((s) =>
      rowToSession(s, urlByPath, profileNameById),
    );
    return rowToServicio(row, mappedSessions, profileNameById);
  },
);

// ─── Mappers ────────────────────────────────────────────────────────────────

function rowToServicio(
  row: ServicioRow,
  sessions: Session[],
  profileNameById: Map<string, string>,
): AssignedService {
  return {
    id: row.id,
    name: row.name,
    serviceType: row.service_type as ServiceType,
    catalogKey: row.catalog_key,
    startDate: row.start_date,
    totalSessions: row.total_sessions,
    frequency: row.frequency as FrequencyKey,
    status: row.status as ServiceStatus,
    notes: row.notes ?? "",
    packageAmount: row.package_amount == null ? 0 : Number(row.package_amount),
    professional: resolveProfessionalName(
      row.professional_id,
      row.professional_label,
      profileNameById,
    ),
    professionalId: row.professional_id,
    professionalLabel: row.professional_label ?? "",
    nextAppointment: row.next_appointment ?? undefined,
    tags: row.tags ?? [],
    isPostOp: row.is_post_op,
    laserDiagnosis:
      row.laser_diagnosis == null
        ? undefined
        : (row.laser_diagnosis as unknown as LaserDiagnosis),
    version: row.version,
    sessions,
  };
}

function rowToSession(
  row: SesionRow,
  urlByPath: Map<string, string>,
  profileNameById: Map<string, string>,
): Session {
  return {
    id: row.id,
    sessionNumber: row.session_number,
    date: row.session_date,
    durationMin: row.duration_min,
    professional: resolveProfessionalName(
      row.professional_id,
      row.professional_label,
      profileNameById,
    ),
    professionalId: row.professional_id,
    professionalLabel: row.professional_label ?? "",
    status: row.status as SessionStatus,
    notes: row.notes ?? "",
    beforePaths: row.before_paths ?? [],
    afterPaths: row.after_paths ?? [],
    beforeUrls: pickUrls(row.before_paths ?? [], urlByPath),
    afterUrls: pickUrls(row.after_paths ?? [], urlByPath),
    recommendations: row.recommendations ?? "",
    nextSuggestion: row.next_suggestion ?? undefined,
    payload: rowPayloadToSessionPayload(
      row.payload as unknown as { type?: string; data?: unknown } | null,
    ),
  };
}

function pickUrls(paths: string[], urlByPath: Map<string, string>): string[] {
  return paths
    .map((p) => urlByPath.get(p))
    .filter((u): u is string => Boolean(u));
}

/**
 * Defensive coercion — the DB stores the payload as JSONB and the row type
 * is `Json`. We trust the discriminator but default each variant to a safe
 * empty shape so the UI never sees `undefined` for required fields.
 */
function rowPayloadToSessionPayload(
  raw: { type?: string; data?: unknown } | null,
): SessionPayload {
  const type = raw?.type;
  const data = (raw?.data ?? {}) as Record<string, unknown>;
  if (type === "facial") {
    return { type: "facial", data: { ...emptyFacial(), ...(data as Partial<FacialSession>) } };
  }
  if (type === "corporal") {
    return {
      type: "corporal",
      data: { ...emptyCorporal(), ...(data as Partial<CorporalSession>) },
    };
  }
  if (type === "laser") {
    return { type: "laser", data: { ...emptyLaser(), ...(data as Partial<LaserSession>) } };
  }
  return { type: "other", data: { ...emptyOther(), ...(data as Partial<OtherSession>) } };
}

function emptyFacial(): FacialSession {
  return {
    zones: [],
    skinType: "",
    skinCondition: "",
    sensitivity: 0,
    acne: 0,
    hydration: 0,
    products: [],
    actives: [],
    devices: [],
    protocol: "",
    reaction: "sin-reaccion",
    recommendations: "",
  };
}

function emptyCorporal(): CorporalSession {
  return {
    zones: [],
    measurementsBefore: "",
    measurementsAfter: "",
    pain: 0,
    inflammation: 0,
    fibrosis: 0,
    cellulite: 0,
    fluidRetention: 0,
    technique: "",
    devices: [],
    productsOrActives: [],
    observations: "",
    recommendations: "",
  };
}

function emptyLaser(): LaserSession {
  return {
    view: "front",
    zones: [],
    fluence: "",
    pulseWidth: "",
    wavelength: "",
    shotCount: "",
    powerLevel: "",
    reaction: "sin-reaccion",
    pain: 0,
    reductionPct: "",
    nextParams: "",
    postCare: "",
  };
}

function emptyOther(): OtherSession {
  return {
    category: "",
    objective: "",
    treatedArea: "",
    protocolNotes: "",
    products: [],
    devices: [],
    recommendations: "",
  };
}

// ─── Signed URL helper ──────────────────────────────────────────────────────

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Sign every supplied path in one batch call. Returns a Map from path →
 * signed URL. RLS on `storage.objects` gates the call — anything the caller
 * doesn't have access to is silently omitted.
 */
async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const unique = Array.from(new Set(paths));
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("servicios-photos")
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) {
    // Don't fail the page render if a single bucket call fails — log and
    // continue with empty URL map.
    console.warn("[servicios] failed to sign photo URLs:", error.message);
    return out;
  }
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) {
      out.set(entry.path, entry.signedUrl);
    }
  }
  return out;
}

// ─── Professional name resolution ───────────────────────────────────────────

function collectProfessionalIds(
  servicios: { professional_id: string | null }[],
  sesiones: { professional_id: string | null }[],
): string[] {
  const set = new Set<string>();
  for (const s of servicios) if (s.professional_id) set.add(s.professional_id);
  for (const s of sesiones) if (s.professional_id) set.add(s.professional_id);
  return Array.from(set);
}

/**
 * Batch-fetch `profiles.full_name` for every referenced FK in one round-trip.
 * RLS scopes the read to the caller's tenant; an ID whose row is invisible
 * to the caller simply falls back to the row's `professional_label`.
 */
async function fetchProfileNames(
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  if (error) {
    console.warn("[servicios] failed to fetch profile names:", error.message);
    return out;
  }
  for (const p of data ?? []) {
    if (p.full_name) out.set(p.id, p.full_name);
  }
  return out;
}

/** Display rule: resolved FK name wins; otherwise the free-text label. */
function resolveProfessionalName(
  professionalId: string | null,
  professionalLabel: string | null,
  byId: Map<string, string>,
): string {
  if (professionalId) {
    const name = byId.get(professionalId);
    if (name) return name;
  }
  return professionalLabel ?? "";
}
