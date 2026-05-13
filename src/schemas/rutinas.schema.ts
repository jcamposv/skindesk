import { z } from "zod";

import {
  PRODUCTO_ABSORPTION_TIMES,
  PRODUCTO_FREQUENCIES,
} from "./productos.schema";

/**
 * Form-friendly enum: accepts a value in the enum OR an empty string.
 * Output type narrows to `T[number] | ""`, so RHF consumers don't need
 * `as` casts on `setValue` / form defaults. Database-side: read with
 * `?? ""` (the DB column is nullable text; this schema doesn't accept
 * `null`).
 */
function nullableEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.union([z.enum(values), z.literal("")]);
}

/** Normalise a DB value (potentially `null`) into the form's `T[number] | ""`
 *  string before handing it to RHF. */
export function dbEnumToForm<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T | "" {
  if (!value) return "";
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

// ---------------------------------------------------------------------------
// Enum mirrors — sync with rutinas_module migration
// ---------------------------------------------------------------------------

export const RUTINA_KINDS = ["template", "assignment"] as const;
export type RutinaKind = (typeof RUTINA_KINDS)[number];

export const RUTINA_MOMENTOS = ["am", "pm", "both"] as const;
export type RutinaMomento = (typeof RUTINA_MOMENTOS)[number];

export const RUTINA_MOMENTO_LABELS: Record<RutinaMomento, string> = {
  am: "Mañana / AM",
  pm: "Noche / PM",
  both: "AM + PM",
};

export const RUTINA_MOMENTO_SHORT: Record<RutinaMomento, string> = {
  am: "AM",
  pm: "PM",
  both: "AM + PM",
};

/** Curated routine tags — UI-only allow-list. Free-text tags are also
 *  supported (the column is `text[]`). The list drives the chips toolbar
 *  and the library filter. */
export const RUTINA_TAGS = [
  "anti_acne",
  "antiedad",
  "hidratacion",
  "antimanchas",
  "calmante",
  "post_facial",
  "post_laser",
  "antibrillo",
  "luminosidad",
  "barrera",
  "sensibilidad",
  "express",
  "completa",
] as const;
export type RutinaTag = (typeof RUTINA_TAGS)[number];

export const RUTINA_TAG_LABELS: Record<RutinaTag, string> = {
  anti_acne: "Anti-acné",
  antiedad: "Antiedad",
  hidratacion: "Hidratación",
  antimanchas: "Antimanchas",
  calmante: "Calmante",
  post_facial: "Post-facial",
  post_laser: "Post-láser",
  antibrillo: "Antibrillo",
  luminosidad: "Luminosidad",
  barrera: "Reparación barrera",
  sensibilidad: "Sensibilidad",
  express: "Express",
  completa: "Completa",
};

/** Library card visual identity — 6 hand-picked SkinDesk-palette gradients.
 *  Picked deterministically from the routine name's hash so the same routine
 *  always shows the same gradient. */
export const RUTINA_GRADIENTS = [
  "from-[#E7ECEA] to-[#F4F1EC]", // sage → cream
  "from-[#F6E0D6] to-[#FBEFE7]", // peach → blush
  "from-[#F8EFD7] to-[#F4F1EC]", // honey → cream
  "from-[#F8EAE9] to-[#FBEFE7]", // rose → blush
  "from-[#E7ECEA] to-[#F8EFD7]", // sage → honey
  "from-[#FBEFE7] to-[#F4F1EC]", // blush → cream
] as const;

/** Stable hash-to-index for the gradient picker. */
export function gradientForRutina(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return RUTINA_GRADIENTS[Math.abs(hash) % RUTINA_GRADIENTS.length]!;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(""));

/** Step inside a routine. Either created from scratch (id="") or edited
 *  (id=uuid). The action diffs against the DB to insert/update/delete. */
export const rutinaStepSchema = z.object({
  id: z.string().trim(),
  productoId: z.string().uuid({ message: "Producto inválido" }),
  stepOrder: z.number().int().min(1),
  customInstruction: optionalText(2000),
  customAmount: optionalText(120),
  // nullableEnum coerces invalid/null inputs to "" so callers don't need
  // `as`-casts. Output is `"" | "<enum value>"`.
  customAbsorptionTime: nullableEnum(PRODUCTO_ABSORPTION_TIMES),
  customFrequency: nullableEnum(PRODUCTO_FREQUENCIES),
  customTimeOfDay: nullableEnum(RUTINA_MOMENTOS),
  notes: optionalText(2000),
});

export type RutinaStepInput = z.infer<typeof rutinaStepSchema>;

export const upsertRutinaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nombre muy corto")
    .max(160, "Máximo 160 caracteres"),
  kind: z.enum(RUTINA_KINDS),
  momento: z.enum(RUTINA_MOMENTOS),
  skinType: optionalText(60),
  skinCondition: optionalText(120),
  mainObjective: optionalText(240),
  generalNotes: optionalText(4000),
  tags: z.array(z.string().trim().min(1).max(40)),
  // assignment-only
  clienteId: z.string().uuid().optional().or(z.literal("")),
  fromTemplateId: z.string().uuid().optional().or(z.literal("")),
  clientMessage: optionalText(2000),
  // steps — at least 1; the message also drives the inline microcopy in
  // the builder header so the user sees the same wording client + server.
  steps: z
    .array(rutinaStepSchema)
    .min(1, "Agregá al menos un paso a la rutina."),
});

export type UpsertRutinaInput = z.infer<typeof upsertRutinaSchema>;

export const RUTINA_FORM_DEFAULTS: UpsertRutinaInput = {
  name: "",
  kind: "template",
  momento: "both",
  skinType: "",
  skinCondition: "",
  mainObjective: "",
  generalNotes: "",
  tags: [],
  clienteId: "",
  fromTemplateId: "",
  clientMessage: "",
  steps: [],
};

export function blankToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Estimated total time (minutes) — sums absorption times of all steps minus
// the last one (no waiting after the last step).
// ---------------------------------------------------------------------------

const ABSORPTION_MINUTES: Record<string, number> = {
  sin_espera: 0,
  "1_min": 1,
  "2_min": 2,
  "3_min": 3,
  "5_min": 5,
  "10_min": 10,
  otro: 2,
};

/** Compute the routine's estimated application time. Falls back to the
 *  product's default absorption_time when the step doesn't override. */
export function estimateRutinaMinutes(
  steps: Array<{
    customAbsorptionTime?: string | null;
    productoAbsorptionTime?: string | null;
  }>,
): number {
  if (steps.length === 0) return 0;
  // Skip the LAST step's absorption — the application is over.
  const waitingSteps = steps.slice(0, -1);
  // Each application is ~30s of physical action; we round to 1 min/step.
  const applicationMinutes = steps.length;
  const waitMinutes = waitingSteps.reduce((acc, s) => {
    const t = s.customAbsorptionTime || s.productoAbsorptionTime || "sin_espera";
    return acc + (ABSORPTION_MINUTES[t] ?? 0);
  }, 0);
  return applicationMinutes + waitMinutes;
}
