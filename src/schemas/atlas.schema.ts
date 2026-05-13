import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum mirrors — MUST stay in sync with the Postgres enums in
// `supabase/migrations/20260513150000_atlas_module.sql`.
// ---------------------------------------------------------------------------

export const ATLAS_SECTIONS = [
  "biotipos",
  "estados_cutaneos",
  "fitzpatrick",
  "glogau",
  "piramide_skincare",
  "principios_activos",
  "compatibilidad_activos",
] as const;
export type AtlasSection = (typeof ATLAS_SECTIONS)[number];

export const ATLAS_SECTION_LABELS: Record<AtlasSection, string> = {
  biotipos: "Biotipos cutáneos",
  estados_cutaneos: "Estados cutáneos",
  fitzpatrick: "Escala de Fitzpatrick",
  glogau: "Escala de Glogau",
  piramide_skincare: "Pirámide del skincare",
  principios_activos: "Principios activos",
  compatibilidad_activos: "Compatibilidad de activos",
};

export const ATLAS_SECTION_DESCRIPTIONS: Record<AtlasSection, string> = {
  biotipos:
    "Guía completa de tipos de piel y sus características clínicas.",
  estados_cutaneos:
    "Condiciones, lesiones, alteraciones y diagnóstico del estado cutáneo.",
  fitzpatrick:
    "Clasificación de fototipos I–VI con descripciones y referencias visuales.",
  glogau:
    "Clasificación del fotoenvejecimiento por etapas, edad y características.",
  piramide_skincare:
    "Jerarquía y orden correcto de los activos y capas de skincare.",
  principios_activos:
    "Función, concentraciones, mecanismo, beneficios y contraindicaciones.",
  compatibilidad_activos:
    "Combinaciones permitidas y combinaciones a evitar con explicación clínica.",
};

export const ATLAS_ENTRY_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;
export type AtlasEntryStatus = (typeof ATLAS_ENTRY_STATUSES)[number];

export const ATLAS_ENTRY_STATUS_LABELS: Record<AtlasEntryStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export const ATLAS_FILE_KINDS = ["pdf", "html", "image"] as const;
export type AtlasFileKind = (typeof ATLAS_FILE_KINDS)[number];

export const ATLAS_FILE_KIND_LABELS: Record<AtlasFileKind, string> = {
  pdf: "PDF",
  html: "Guía HTML",
  image: "Imagen",
};

// ---------------------------------------------------------------------------
// Upload constraints — enforced again at upload time on the client. Mirrored
// in the action that records the file row.
// ---------------------------------------------------------------------------

export const ATLAS_FILE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const ATLAS_COVER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const ATLAS_FILE_MIME_BY_KIND: Record<AtlasFileKind, readonly string[]> =
  {
    pdf: ["application/pdf"],
    html: ["text/html", "application/xhtml+xml"],
    image: ["image/jpeg", "image/png", "image/webp"],
  };

/** Reverse map of MIME → kind, used to infer the kind of a dropped file. */
export function atlasFileKindForMime(mime: string): AtlasFileKind | null {
  for (const kind of ATLAS_FILE_KINDS) {
    if ((ATLAS_FILE_MIME_BY_KIND[kind] as readonly string[]).includes(mime)) {
      return kind;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zod — CMS upsert form
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(""));

/** Slug = lowercase letters, digits, hyphens — kept simple so the URL
 *  surface is predictable and migratable. The form normalises on submit. */
export const ATLAS_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// NB: every field stays input === output. Zod `.transform()` and `.default()`
// produce an input/output type split that breaks RHF's
// `Resolver<TFieldValues>` — we mirror the trick used in
// `productos.schema.ts` and coerce / default in the form / action layer
// instead.
export const upsertAtlasEntrySchema = z.object({
  section: z.enum(ATLAS_SECTIONS, { message: "Sección requerida" }),
  title: z
    .string()
    .trim()
    .min(2, "Título muy corto")
    .max(200, "Máximo 200 caracteres"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug muy corto")
    .max(80, "Máximo 80 caracteres")
    .regex(ATLAS_SLUG_REGEX, "Sólo minúsculas, números y guiones"),
  description: optionalText(600),
  bodyMd: optionalText(20000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  status: z.enum(ATLAS_ENTRY_STATUSES),
  position: z.number().int().min(0),
  // Cover image path inside the `atlas` bucket. The uploader writes
  // directly to storage and sets this field on the form — the entry-upsert
  // action persists it as `cover_path`. Empty string means "no cover".
  coverPath: z.string().trim().max(500).optional().or(z.literal("")),
});

export type UpsertAtlasEntryInput = z.infer<typeof upsertAtlasEntrySchema>;

export const ATLAS_ENTRY_FORM_DEFAULTS: UpsertAtlasEntryInput = {
  section: "biotipos",
  title: "",
  slug: "",
  description: "",
  bodyMd: "",
  tags: [],
  status: "draft",
  position: 0,
  coverPath: "",
};

export function blankToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}
