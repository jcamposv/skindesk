import { z } from "zod";

/**
 * Server-side validation for the "Mis servicios" payloads.
 *
 * The per-type session `data` blobs are persisted as JSONB but their shape
 * is fully validated here — one strict schema per service type, combined
 * into a discriminated union by `type`. The TS interfaces consumed by the
 * UI layer (`FacialSession`, `CorporalSession`, etc.) are derived from
 * these schemas via `z.infer`, so the schema is the single source of truth.
 *
 * `.strict()` on every level blocks unknown keys — a typo in the form
 * surfaces immediately as a validation error instead of silently saving.
 */

// ─── Reusable enums (mirror Postgres enums) ─────────────────────────────────

export const serviceTypeEnum = z.enum(["facial", "corporal", "laser", "other"]);
export type ServiceType = z.infer<typeof serviceTypeEnum>;

export const serviceStatusEnum = z.enum([
  "active",
  "paused",
  "completed",
  "cancelled",
]);
export type ServiceStatus = z.infer<typeof serviceStatusEnum>;

export const sessionStatusEnum = z.enum(["completed", "pending", "scheduled"]);
export type SessionStatus = z.infer<typeof sessionStatusEnum>;

export const frequencyEnum = z.enum([
  "semanal",
  "quincenal",
  "mensual",
  "personalizada",
]);
export type FrequencyKey = z.infer<typeof frequencyEnum>;

export const skinReactionEnum = z.enum([
  "sin-reaccion",
  "eritema-leve",
  "eritema-moderado",
  "reaccion-intensa",
]);
export type SkinReaction = z.infer<typeof skinReactionEnum>;

// 0–5 segmented scale. Kept as a strict literal union so the inferred TS
// type stays narrow (matches the UI's tap-bar component).
export const levelScoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type LevelScore = z.infer<typeof levelScoreSchema>;

const fitzpatrickEnum = z.enum(["I", "II", "III", "IV", "V", "VI"]);
const hairThicknessEnum = z.enum(["fino", "medio", "grueso"]);
const laserViewEnum = z.enum(["front", "back"]);

// ─── Per-type session data schemas ──────────────────────────────────────────
// Each `data` field uses sensible string/array caps; the runtime caps are
// generous (the UI itself constrains the active surface), but they prevent
// a malformed client from stuffing megabytes into a single column.

export const facialSessionDataSchema = z
  .object({
    zones: z.array(z.string().max(80)).max(60).default([]),
    skinType: z.string().max(80).default(""),
    skinCondition: z.string().max(80).default(""),
    sensitivity: levelScoreSchema.default(0),
    acne: levelScoreSchema.default(0),
    hydration: levelScoreSchema.default(0),
    products: z.array(z.string().max(120)).max(40).default([]),
    actives: z.array(z.string().max(120)).max(40).default([]),
    devices: z.array(z.string().max(120)).max(40).default([]),
    protocol: z.string().max(5000).default(""),
    reaction: skinReactionEnum.default("sin-reaccion"),
    recommendations: z.string().max(5000).default(""),
  })
  .strict();
export type FacialSession = z.infer<typeof facialSessionDataSchema>;

const corporalPostOpSchema = z
  .object({
    surgeryType: z.string().max(120).default(""),
    surgeryDate: z.string().max(40).default(""),
    doctorName: z.string().max(120).default(""),
    contraindications: z.string().max(5000).default(""),
    swelling: levelScoreSchema.default(0),
    drainageNotes: z.string().max(5000).default(""),
  })
  .strict();

export const corporalSessionDataSchema = z
  .object({
    zones: z.array(z.string().max(80)).max(60).default([]),
    measurementsBefore: z.string().max(2000).default(""),
    measurementsAfter: z.string().max(2000).default(""),
    weight: z.string().max(40).optional(),
    pain: levelScoreSchema.default(0),
    inflammation: levelScoreSchema.default(0),
    fibrosis: levelScoreSchema.default(0),
    cellulite: levelScoreSchema.default(0),
    fluidRetention: levelScoreSchema.default(0),
    technique: z.string().max(200).default(""),
    devices: z.array(z.string().max(120)).max(40).default([]),
    productsOrActives: z.array(z.string().max(120)).max(40).default([]),
    observations: z.string().max(5000).default(""),
    recommendations: z.string().max(5000).default(""),
    postOp: corporalPostOpSchema.optional(),
  })
  .strict();
export type CorporalSession = z.infer<typeof corporalSessionDataSchema>;

export const laserSessionDataSchema = z
  .object({
    view: laserViewEnum.default("front"),
    zones: z.array(z.string().max(80)).max(60).default([]),
    fluence: z.string().max(40).default(""),
    pulseWidth: z.string().max(40).default(""),
    wavelength: z.string().max(40).default(""),
    shotCount: z.string().max(40).default(""),
    powerLevel: z.string().max(80).default(""),
    reaction: skinReactionEnum.default("sin-reaccion"),
    pain: levelScoreSchema.default(0),
    reductionPct: z.string().max(20).default(""),
    nextParams: z.string().max(5000).default(""),
    postCare: z.string().max(5000).default(""),
  })
  .strict();
export type LaserSession = z.infer<typeof laserSessionDataSchema>;

export const otherSessionDataSchema = z
  .object({
    category: z.string().max(120).default(""),
    objective: z.string().max(200).default(""),
    treatedArea: z.string().max(200).default(""),
    protocolNotes: z.string().max(5000).default(""),
    products: z.array(z.string().max(120)).max(40).default([]),
    devices: z.array(z.string().max(120)).max(40).default([]),
    recommendations: z.string().max(5000).default(""),
  })
  .strict();
export type OtherSession = z.infer<typeof otherSessionDataSchema>;

// ─── Laser-only diagnosis (filled once, not per session) ────────────────────

export const laserDiagnosisSchema = z
  .object({
    fitzpatrick: z.union([fitzpatrickEnum, z.literal("")]).default(""),
    hairColor: z.string().max(80).default(""),
    hairThickness: z.union([hairThicknessEnum, z.literal("")]).default(""),
    equipment: z.string().max(120).default(""),
    contraindications: z.string().max(5000).default(""),
    observations: z.string().max(5000).default(""),
  })
  .strict();
export type LaserDiagnosis = z.infer<typeof laserDiagnosisSchema>;

// ─── Per-type payload schemas + discriminated union ─────────────────────────
// Exported individually so the form layer can pick a single variant
// (RHF works best with a non-union schema; the server still validates
// against the union below).

export const facialPayloadSchema = z
  .object({ type: z.literal("facial"), data: facialSessionDataSchema })
  .strict();
export const corporalPayloadSchema = z
  .object({ type: z.literal("corporal"), data: corporalSessionDataSchema })
  .strict();
export const laserPayloadSchema = z
  .object({ type: z.literal("laser"), data: laserSessionDataSchema })
  .strict();
export const otherPayloadSchema = z
  .object({ type: z.literal("other"), data: otherSessionDataSchema })
  .strict();

export const sessionPayloadSchema = z.discriminatedUnion("type", [
  facialPayloadSchema,
  corporalPayloadSchema,
  laserPayloadSchema,
  otherPayloadSchema,
]);
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

// ─── Session base shape ─────────────────────────────────────────────────────
// Every field that lives on a Session row regardless of service_type.
// Defined as a shape (plain object map) so it can be spread into per-type
// form schemas via `z.object({ ...sesionBaseShape, payload })`.

const sesionBaseShape = {
  sessionNumber: z.number().int().min(1),
  date: z.string().min(1), // ISO date (YYYY-MM-DD)
  durationMin: z.number().int().min(0).max(720),
  // Professional identity is FK + free-text fallback. One of:
  //   · `professionalId` set, `professionalLabel` empty → known staff member.
  //   · `professionalId` null, `professionalLabel` set → manual entry.
  //   · both empty → not assigned.
  professionalId: z.string().uuid().nullable().default(null),
  professionalLabel: z.string().max(200).default(""),
  status: sessionStatusEnum.default("completed"),
  notes: z.string().max(5000).default(""),
  beforePaths: z.array(z.string().min(1).max(500)).max(12).default([]),
  afterPaths: z.array(z.string().min(1).max(500)).max(12).default([]),
  recommendations: z.string().max(5000).default(""),
  nextSuggestion: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
};

// ─── Single-session payload (used on add-session and the first-session
//     embedded in createServicio) ─────────────────────────────────────────────

export const sesionCreateSchema = z
  .object({ ...sesionBaseShape, payload: sessionPayloadSchema })
  .strict();

export type SesionCreateInput = z.infer<typeof sesionCreateSchema>;

// ─── Per-type sesion form schemas (RHF-ready, single payload variant) ──────

export const facialSesionFormSchema = z
  .object({ ...sesionBaseShape, payload: facialPayloadSchema })
  .strict();
export type FacialSesionFormInput = z.infer<typeof facialSesionFormSchema>;

export const corporalSesionFormSchema = z
  .object({ ...sesionBaseShape, payload: corporalPayloadSchema })
  .strict();
export type CorporalSesionFormInput = z.infer<typeof corporalSesionFormSchema>;

export const laserSesionFormSchema = z
  .object({ ...sesionBaseShape, payload: laserPayloadSchema })
  .strict();
export type LaserSesionFormInput = z.infer<typeof laserSesionFormSchema>;

export const otherSesionFormSchema = z
  .object({ ...sesionBaseShape, payload: otherPayloadSchema })
  .strict();
export type OtherSesionFormInput = z.infer<typeof otherSesionFormSchema>;

/**
 * Factory: pick the right per-type session form schema at runtime. RHF's
 * `useForm` is called unconditionally with the dispatched schema, so the
 * form state has a concrete (non-union) shape that's easy to address with
 * `register` / `Controller`.
 */
export function sesionFormSchemaFor(type: ServiceType) {
  switch (type) {
    case "facial":
      return facialSesionFormSchema;
    case "corporal":
      return corporalSesionFormSchema;
    case "laser":
      return laserSesionFormSchema;
    case "other":
      return otherSesionFormSchema;
  }
}

export type SesionFormInput =
  | FacialSesionFormInput
  | CorporalSesionFormInput
  | LaserSesionFormInput
  | OtherSesionFormInput;

// ─── New-service payload (= servicio + first session in one shot) ──────────

// Shared field map for servicio creation; reused below by the per-type
// form variants (which swap `firstSession` for a typed form variant).
const servicioBaseShape = {
  name: z.string().min(1).max(200),
  serviceType: serviceTypeEnum,
  catalogKey: z.string().min(1).max(120),
  startDate: z.string().min(1),
  totalSessions: z.number().int().min(1).max(60),
  frequency: frequencyEnum,
  status: serviceStatusEnum.default("active"),
  notes: z.string().max(5000).default(""),
  packageAmount: z.number().min(0).max(1_000_000).default(0),
  // Same FK + label fallback as `sesionCreateSchema.professional*`.
  professionalId: z.string().uuid().nullable().default(null),
  professionalLabel: z.string().max(200).default(""),
  nextAppointment: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  tags: z.array(z.string().max(80)).max(20).default([]),
  isPostOp: z.boolean().default(false),
  laserDiagnosis: laserDiagnosisSchema.nullable().optional(),
};

export const servicioCreateSchema = z
  .object({ ...servicioBaseShape, firstSession: sesionCreateSchema })
  .strict()
  .refine(
    // Non-laser services must not carry a diagnosis. (The shape is strict so
    // we can compare against `null`/`undefined` directly — no Object.keys
    // hack like the passthrough version needed.)
    (v) => v.serviceType === "laser" || v.laserDiagnosis == null,
    {
      message: "laserDiagnosis is only valid when serviceType is 'laser'",
      path: ["laserDiagnosis"],
    },
  )
  .refine((v) => v.firstSession.payload.type === v.serviceType, {
    message: "firstSession.payload.type must match serviceType",
    path: ["firstSession", "payload", "type"],
  });

export type ServicioCreateInput = z.infer<typeof servicioCreateSchema>;

// ─── Add-session payload — same as sesionCreateSchema; explicit alias keeps
//     the action signature symmetric with the create-service one. ────────────

export const addSesionSchema = sesionCreateSchema;
export type AddSesionInput = SesionCreateInput;

// ─── Per-type servicio form schemas (RHF-ready) ─────────────────────────────
// Mirror `servicioCreateSchema` but with a single, non-union `firstSession`
// variant matching the chosen `serviceType`. The cross-field refinements
// from `servicioCreateSchema` collapse here because the discriminator is
// fixed — `firstSession.payload.type` is literal, and `laserDiagnosis` is
// gated by the schema variant itself.

export const facialServicioCreateFormSchema = z
  .object({
    ...servicioBaseShape,
    serviceType: z.literal("facial"),
    laserDiagnosis: z.null().optional(),
    firstSession: facialSesionFormSchema,
  })
  .strict();
export type FacialServicioCreateFormInput = z.infer<
  typeof facialServicioCreateFormSchema
>;

export const corporalServicioCreateFormSchema = z
  .object({
    ...servicioBaseShape,
    serviceType: z.literal("corporal"),
    laserDiagnosis: z.null().optional(),
    firstSession: corporalSesionFormSchema,
  })
  .strict();
export type CorporalServicioCreateFormInput = z.infer<
  typeof corporalServicioCreateFormSchema
>;

export const laserServicioCreateFormSchema = z
  .object({
    ...servicioBaseShape,
    serviceType: z.literal("laser"),
    // Laser services REQUIRE a diagnosis (override the optional in base).
    laserDiagnosis: laserDiagnosisSchema,
    firstSession: laserSesionFormSchema,
  })
  .strict();
export type LaserServicioCreateFormInput = z.infer<
  typeof laserServicioCreateFormSchema
>;

export const otherServicioCreateFormSchema = z
  .object({
    ...servicioBaseShape,
    serviceType: z.literal("other"),
    laserDiagnosis: z.null().optional(),
    firstSession: otherSesionFormSchema,
  })
  .strict();
export type OtherServicioCreateFormInput = z.infer<
  typeof otherServicioCreateFormSchema
>;

/** Pick the right per-type wizard form schema at runtime. */
export function servicioCreateFormSchemaFor(type: ServiceType) {
  switch (type) {
    case "facial":
      return facialServicioCreateFormSchema;
    case "corporal":
      return corporalServicioCreateFormSchema;
    case "laser":
      return laserServicioCreateFormSchema;
    case "other":
      return otherServicioCreateFormSchema;
  }
}

export type ServicioCreateFormInput =
  | FacialServicioCreateFormInput
  | CorporalServicioCreateFormInput
  | LaserServicioCreateFormInput
  | OtherServicioCreateFormInput;
