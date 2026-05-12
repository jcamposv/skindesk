/**
 * "Mis servicios" — UI surface types.
 *
 * The per-type session payloads (`FacialSession`, `CorporalSession`,
 * `LaserSession`, `OtherSession`, `LaserDiagnosis`, `SessionPayload`) are
 * derived from the Zod schemas in `@/schemas/servicios.schema` and re-
 * exported here so consumers continue to import from a single module.
 *
 * The DB-row-shaped types (`Session`, `AssignedService`, `ClienteRef`)
 * carry response-only fields (signed photo URLs, version, etc.) and stay
 * defined here.
 */

export type {
  ServiceType,
  ServiceStatus,
  SessionStatus,
  FrequencyKey,
  LevelScore,
  SkinReaction,
  FacialSession,
  CorporalSession,
  LaserSession,
  OtherSession,
  LaserDiagnosis,
  SessionPayload,
} from "@/schemas/servicios.schema";

import type {
  FrequencyKey,
  LaserDiagnosis,
  ServiceStatus,
  ServiceType,
  SessionPayload,
  SessionStatus,
  SkinReaction,
} from "@/schemas/servicios.schema";

// ─── DB row-shaped types (UI consumes these via the service layer) ─────────

export interface Session {
  id: string;
  sessionNumber: number;
  date: string;
  durationMin: number;
  /** Display string — resolved staff name OR `professionalLabel` fallback. */
  professional: string;
  /** FK to `profiles.id` when the responsible staff is a known tenant user. */
  professionalId: string | null;
  /** Free-text fallback for manual / legacy entries (kept in sync with
   *  the DB column of the same name). */
  professionalLabel: string;
  status: SessionStatus;
  notes: string;
  /** Exact storage object paths in the `servicios-photos` bucket. */
  beforePaths: string[];
  afterPaths: string[];
  /** Signed URLs for read, populated by the service layer (60-min expiry). */
  beforeUrls?: string[];
  afterUrls?: string[];
  recommendations: string;
  nextSuggestion?: string;
  payload: SessionPayload;
}

export interface AssignedService {
  id: string;
  name: string;
  serviceType: ServiceType;
  catalogKey: string; // points into CATALOG entry
  startDate: string;
  totalSessions: number;
  frequency: FrequencyKey;
  status: ServiceStatus;
  notes: string;
  packageAmount: number;
  /** Display string — resolved staff name OR `professionalLabel` fallback. */
  professional: string;
  /** FK to `profiles.id` when the responsible staff is a known tenant user. */
  professionalId: string | null;
  /** Free-text fallback for manual / legacy entries. */
  professionalLabel: string;
  nextAppointment?: string;
  tags: string[];
  isPostOp?: boolean;
  laserDiagnosis?: LaserDiagnosis;
  /** Optimistic-concurrency version. Bumped server-side on every UPDATE. */
  version: number;
  sessions: Session[];
}

/**
 * Minimal client identity passed through forms so the photo uploader knows
 * which `<tenant>/<cliente>` prefix to write under. ServiciosTab derives this
 * from the page-level ClienteDetail prop and forwards it down.
 */
export interface ClienteRef {
  tenantId: string;
  clienteId: string;
}

// ─── UI labels (i18n-free for now) ──────────────────────────────────────────

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  facial: "Cuidado facial",
  corporal: "Corporales",
  laser: "Depilación láser",
  other: "Otro servicio",
};

export const SERVICE_TYPE_TAGLINE: Record<ServiceType, string> = {
  facial: "Limpieza, antiedad, peelings y aparatología facial.",
  corporal: "Reductivos, post-operatorio, drenaje y modelado corporal.",
  laser: "Depilación láser por zonas con parámetros clínicos.",
  other: "Tratamientos personalizados o experimentales.",
};

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  active: "Activo",
  paused: "En pausa",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const FREQUENCY_LABEL: Record<FrequencyKey, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  personalizada: "Personalizada",
};

export const REACTION_LABEL: Record<SkinReaction, string> = {
  "sin-reaccion": "Sin reacción",
  "eritema-leve": "Eritema leve",
  "eritema-moderado": "Eritema moderado",
  "reaccion-intensa": "Reacción intensa",
};
