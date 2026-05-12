import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum mirrors — must stay in sync with the Postgres CHECK constraints in
// `supabase/migrations/20260512193257_productos_module.sql`. If you add a
// value here, you must also add it to the CHECK constraint or the row will
// be rejected at INSERT.
// ---------------------------------------------------------------------------

export const PRODUCTO_CATEGORIAS = [
  "limpiador",
  "tonico",
  "serum",
  "hidratante",
  "spf",
  "contorno_ojos",
  "mascarilla",
  "exfoliante",
  "regenerante",
  "desmaquillante",
  "agua_micelar",
  "tratamiento_especifico",
  "ampolleta",
  "bruma",
  "balsamo_labios",
] as const;
export type ProductoCategoria = (typeof PRODUCTO_CATEGORIAS)[number];

export const PRODUCTO_CATEGORIA_LABELS: Record<ProductoCategoria, string> = {
  limpiador: "Limpiador",
  tonico: "Tónico",
  serum: "Sérum",
  hidratante: "Hidratante",
  spf: "SPF",
  contorno_ojos: "Contorno de ojos",
  mascarilla: "Mascarilla",
  exfoliante: "Exfoliante",
  regenerante: "Regenerante",
  desmaquillante: "Desmaquillante",
  agua_micelar: "Agua micelar",
  tratamiento_especifico: "Tratamiento específico",
  ampolleta: "Ampolleta",
  bruma: "Bruma",
  balsamo_labios: "Bálsamo labios",
};

/** Standard skin types (the ones rendered as chips, minus "Todas" and "Otro"
 *  which are interaction sugar — `Todas` expands to all of these at submit
 *  time, `Otro` lands in `customSkinTypes`). */
export const PRODUCTO_SKIN_TYPES = [
  "normal",
  "mixta",
  "grasa",
  "seca",
  "sensible",
  "acne",
  "madura",
  "pigmentada",
  "deshidratada",
  "ocluida",
  "asfixiada",
  "envejecida",
] as const;
export type ProductoSkinType = (typeof PRODUCTO_SKIN_TYPES)[number];

export const PRODUCTO_SKIN_TYPE_LABELS: Record<ProductoSkinType, string> = {
  normal: "Normal",
  mixta: "Mixta",
  grasa: "Grasa",
  seca: "Seca",
  sensible: "Sensible",
  acne: "Acné",
  madura: "Madura",
  pigmentada: "Pigmentada",
  deshidratada: "Deshidratada",
  ocluida: "Ocluida",
  asfixiada: "Asfixiada",
  envejecida: "Envejecida",
};

export const PRODUCTO_TAGS = [
  "anti_acne",
  "antiedad",
  "hidratante",
  "iluminador",
  "despigmentante",
  "calmante",
  "antioxidante",
  "oil_free",
  "sin_fragancia",
  "vegano",
  "exfoliante",
  "post_tratamiento",
  "spf",
  "cc_cream",
  "hipoalergenico",
  "antiinflamatorio",
  "antibacteriano",
  "regenerante",
  "queratolitico",
  "refrescante",
  "peptidos",
  "exosomas",
  "pdrn",
  "enzimas",
  "reparador",
] as const;
export type ProductoTag = (typeof PRODUCTO_TAGS)[number];

export const PRODUCTO_TAG_LABELS: Record<ProductoTag, string> = {
  anti_acne: "Anti-acné",
  antiedad: "Antiedad",
  hidratante: "Hidratante",
  iluminador: "Iluminador",
  despigmentante: "Despigmentante",
  calmante: "Calmante",
  antioxidante: "Antioxidante",
  oil_free: "Oil-free",
  sin_fragancia: "Sin fragancia",
  vegano: "Vegano",
  exfoliante: "Exfoliante",
  post_tratamiento: "Post-tratamiento",
  spf: "SPF",
  cc_cream: "CC Cream",
  hipoalergenico: "Hipoalergénico",
  antiinflamatorio: "Antiinflamatorio",
  antibacteriano: "Antibacteriano",
  regenerante: "Regenerante",
  queratolitico: "Queratolítico",
  refrescante: "Refrescante",
  peptidos: "Péptidos",
  exosomas: "Exosomas",
  pdrn: "PDRN",
  enzimas: "Enzimas",
  reparador: "Reparador",
};

export const PRODUCTO_ABSORPTION_TIMES = [
  "sin_espera",
  "1_min",
  "2_min",
  "3_min",
  "5_min",
  "10_min",
  "otro",
] as const;
export type ProductoAbsorptionTime = (typeof PRODUCTO_ABSORPTION_TIMES)[number];

export const PRODUCTO_ABSORPTION_LABELS: Record<ProductoAbsorptionTime, string> = {
  sin_espera: "Sin espera",
  "1_min": "1 min",
  "2_min": "2 min",
  "3_min": "3 min",
  "5_min": "5 min",
  "10_min": "10 min",
  otro: "Otro",
};

export const PRODUCTO_TIEMPO_DIA = ["am_pm", "am", "pm"] as const;
export type ProductoTiempoDia = (typeof PRODUCTO_TIEMPO_DIA)[number];

export const PRODUCTO_TIEMPO_DIA_LABELS: Record<ProductoTiempoDia, string> = {
  am_pm: "Mañana y noche",
  am: "Solo mañana / AM",
  pm: "Solo noche / PM",
};

export const PRODUCTO_FREQUENCIES = [
  "diario",
  "3_semana",
  "2_semana",
  "1_semana",
  "indicacion",
  "otro",
] as const;
export type ProductoFrequency = (typeof PRODUCTO_FREQUENCIES)[number];

export const PRODUCTO_FREQUENCY_LABELS: Record<ProductoFrequency, string> = {
  diario: "Diario",
  "3_semana": "3 veces por semana",
  "2_semana": "2 veces por semana",
  "1_semana": "1 vez por semana",
  indicacion: "Según indicación",
  otro: "Otro",
};

export const PRODUCTO_SORTS = [
  "name_asc",
  "brand_asc",
  "category_asc",
  "recent",
  "most_used",
] as const;
export type ProductoSort = (typeof PRODUCTO_SORTS)[number];

export const PRODUCTO_SORT_LABELS: Record<ProductoSort, string> = {
  name_asc: "A-Z",
  brand_asc: "Marca",
  category_asc: "Categoría",
  recent: "Más recientes",
  most_used: "Más usados en rutinas",
};

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(""));

/**
 * Single source of truth for the "Agregar producto" / "Editar producto"
 * form. Mirrors the columns in `public.productos` 1:1 so the server action
 * doesn't have to re-map field names.
 *
 * Trimming: every text field is trimmed by Zod. Empty strings are converted
 * to null in the server action via `blankToNull`.
 *
 * Arrays: chip groups use the enum mirrors above. `mainIngredients` is
 * capped at 3 to match the DB CHECK; the form also enforces this in the UI
 * so users see "Máximo 3 ingredientes" before submit.
 */
// `.default()` on Zod arrays produces an input/output type split that breaks
// RHF's `Resolver<TFieldValues>` — we keep schema input === output and rely
// on `PRODUCTO_FORM_DEFAULTS` to seed the form. Same trick used in
// `createClientaSchema`.
export const upsertProductoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nombre muy corto")
    .max(160, "Máximo 160 caracteres"),
  brand: optionalText(120),
  category: z.enum(PRODUCTO_CATEGORIAS, {
    message: "Categoría requerida",
  }),
  photoPath: z.string().trim().max(500).optional().or(z.literal("")),
  mainIngredients: z
    .array(z.string().trim().min(1).max(80))
    .max(3, "Máximo 3 ingredientes principales"),
  ingredientsInci: optionalText(4000),
  skinTypes: z.array(z.enum(PRODUCTO_SKIN_TYPES)),
  customSkinTypes: z.array(z.string().trim().min(1).max(40)),
  applicationInstruction: optionalText(2000),
  suggestedAmount: optionalText(120),
  // Optional enums: empty string is the "—" UI sentinel; converted to null
  // in the action via `blankToNull`.
  absorptionTime: z
    .union([z.enum(PRODUCTO_ABSORPTION_TIMES), z.literal("")])
    .optional(),
  timeOfDay: z
    .union([z.enum(PRODUCTO_TIEMPO_DIA), z.literal("")])
    .optional(),
  frequency: z
    .union([z.enum(PRODUCTO_FREQUENCIES), z.literal("")])
    .optional(),
  additionalTags: z.array(z.enum(PRODUCTO_TAGS)),
  // ⚠️ The following three fields are PROFESSIONAL-ONLY. They must never
  // be exposed to clientas. When the routine builder ships, clienta-facing
  // surfaces must read from a `productos_public` security_invoker view
  // that excludes these columns. See:
  // memory/productos_routine_builder_prerequisites.md
  precautions: optionalText(2000),
  conflictingIngredients: z.array(z.string().trim().min(1).max(120)),
  clinicalNotes: optionalText(4000),
});

export type UpsertProductoInput = z.infer<typeof upsertProductoSchema>;

/** Default empty value used by `useForm({ defaultValues })`. */
export const PRODUCTO_FORM_DEFAULTS: UpsertProductoInput = {
  name: "",
  brand: "",
  category: "serum",
  photoPath: "",
  mainIngredients: [],
  ingredientsInci: "",
  skinTypes: [],
  customSkinTypes: [],
  applicationInstruction: "",
  suggestedAmount: "",
  absorptionTime: "",
  timeOfDay: "",
  frequency: "",
  additionalTags: [],
  precautions: "",
  conflictingIngredients: [],
  clinicalNotes: "",
};

/** Coerce empty string to null — used by the server action when persisting. */
export function blankToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}
