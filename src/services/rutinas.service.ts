import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type {
  RutinaKind,
  RutinaMomento,
} from "@/schemas/rutinas.schema";
import type { Producto } from "@/services/productos.service";

type RutinaRow = Database["public"]["Tables"]["rutinas"]["Row"];
type RutinaStepRow = Database["public"]["Tables"]["rutina_steps"]["Row"];
type ProductoRow = Database["public"]["Tables"]["productos"]["Row"];

/**
 * Producto projection embedded in `RutinaWithSteps`. Deliberately excludes
 * the clinical columns (`clinical_notes`, `conflicting_ingredients`,
 * `ingredients_inci`, `precautions`) so a careless `{step.producto.x}` in
 * the PDF or a future clienta-facing surface can never leak them. If
 * staff-only screens need those fields, fetch the producto directly.
 */
export type RutinaProductoEmbed = Pick<
  ProductoRow,
  | "id"
  | "name"
  | "brand"
  | "category"
  | "main_ingredients"
  | "skin_types"
  | "custom_skin_types"
  | "application_instruction"
  | "suggested_amount"
  | "absorption_time"
  | "frequency"
  | "time_of_day"
  | "additional_tags"
  | "photo_path"
> & { photoUrl: string | null };

export interface RutinaWithSteps extends RutinaRow {
  steps: Array<RutinaStepRow & { producto: RutinaProductoEmbed }>;
}

interface ListLibraryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  momento?: RutinaMomento;
  tag?: string;
  skinType?: string;
}

/** Minimal step preview embedded on each library item so the compact card
 *  can render a numbered list (first 3 by step_order) without a second
 *  round-trip per card. */
export interface LibraryStepPreview {
  step_order: number;
  producto_name: string;
}

export interface LibraryListResult {
  items: Array<
    Database["public"]["Tables"]["rutinas"]["Row"] & {
      stepCount: number;
      stepsPreview: LibraryStepPreview[];
    }
  >;
  totalItems: number;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// Library — kind = 'template'
// ---------------------------------------------------------------------------

export async function listLibraryRutinas(
  params: ListLibraryParams = {},
): Promise<LibraryListResult> {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // One round-trip: full rutinas row + step count + the first ~6 steps
  // ordered by step_order. We use a second embed (`steps_preview`) for the
  // ordered list since PostgREST can't aggregate + sort in the same alias.
  // Limited at 6 (capped via embedded `limit`) so a 20-step routine doesn't
  // dump 20 rows into the response — the card only needs 3, the spare 3 cover
  // future "show first 5" tweaks without a service change.
  let query = supabase
    .from("rutinas")
    .select(
      `*,
       rutina_steps(count),
       steps_preview:rutina_steps(step_order, producto:productos(name))`,
      { count: "exact" },
    )
    .order("step_order", {
      referencedTable: "steps_preview",
      ascending: true,
    })
    .limit(6, { referencedTable: "steps_preview" })
    .eq("kind", "template")
    .is("archived_at", null);

  if (params.search && params.search.trim().length > 0) {
    const safe = params.search.trim().replace(/[(),]/g, " ");
    query = query.or(
      [
        `name.ilike.%${safe}%`,
        `main_objective.ilike.%${safe}%`,
      ].join(","),
    );
  }
  if (params.momento) query = query.eq("momento", params.momento);
  if (params.tag) query = query.contains("tags", [params.tag]);
  if (params.skinType) query = query.eq("skin_type", params.skinType);

  query = query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const items = (data ?? []).map((row) => {
    const raw = row as RutinaRow & {
      rutina_steps?: { count: number }[];
      steps_preview?: Array<{
        step_order: number;
        producto: { name: string | null } | { name: string | null }[] | null;
      }>;
    };
    const stepCount = Array.isArray(raw.rutina_steps)
      ? (raw.rutina_steps[0]?.count ?? 0)
      : 0;
    const stepsPreview: LibraryStepPreview[] = (raw.steps_preview ?? [])
      .map((s) => {
        const prod = Array.isArray(s.producto) ? s.producto[0] : s.producto;
        return {
          step_order: s.step_order,
          producto_name: prod?.name ?? "Producto",
        };
      })
      .sort((a, b) => a.step_order - b.step_order);
    const { rutina_steps: _a, steps_preview: _b, ...rest } = raw;
    void _a;
    void _b;
    return { ...(rest as RutinaRow), stepCount, stepsPreview };
  });

  return { items, totalItems: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Assigned routines for a clienta
// ---------------------------------------------------------------------------

export const listRutinasForCliente = cache(
  async (
    clienteId: string,
  ): Promise<Array<RutinaRow & { stepCount: number }>> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("rutinas")
      .select("*, rutina_steps(count)")
      .eq("kind", "assignment")
      .eq("cliente_id", clienteId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const stepCount = Array.isArray(row.rutina_steps)
        ? (row.rutina_steps[0]?.count ?? 0)
        : 0;
      const { rutina_steps: _omit, ...rest } = row as RutinaRow & {
        rutina_steps?: { count: number }[];
      };
      void _omit;
      return { ...(rest as RutinaRow), stepCount };
    });
  },
);

// ---------------------------------------------------------------------------
// Single rutina with full step join (used by the builder)
// ---------------------------------------------------------------------------

export const getRutinaWithSteps = cache(
  async (id: string): Promise<RutinaWithSteps | null> => {
    const supabase = await createClient();

    const { data: rutina, error: rutErr } = await supabase
      .from("rutinas")
      .select("*")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (rutErr) throw new Error(rutErr.message);
    if (!rutina) return null;

    // Narrowed producto projection — clinical fields are intentionally
    // OFF this list. Anything that wants clinical data must fetch the
    // producto directly through `getProductoById`.
    const PRODUCTO_EMBED_COLS =
      "id, name, brand, category, main_ingredients, skin_types," +
      " custom_skin_types, application_instruction, suggested_amount," +
      " absorption_time, frequency, time_of_day, additional_tags, photo_path";

    const { data: steps, error: stepsErr } = await supabase
      .from("rutina_steps")
      .select(`*, producto:productos(${PRODUCTO_EMBED_COLS})`)
      .eq("rutina_id", id)
      .order("step_order", { ascending: true });
    if (stepsErr) throw new Error(stepsErr.message);

    // Sign photo URLs for all referenced productos.
    const photoPaths = (steps ?? [])
      .map((s) => {
        const p = unwrapProducto(s.producto);
        return p?.photo_path ?? null;
      })
      .filter((p): p is string => Boolean(p));
    const photoUrlByPath = await signPhotoUrls(photoPaths);

    return {
      ...rutina,
      steps: (steps ?? []).map((s) => {
        const producto = unwrapProducto(s.producto);
        return {
          ...(s as RutinaStepRow),
          producto: {
            ...(producto as Omit<RutinaProductoEmbed, "photoUrl">),
            photoUrl: producto?.photo_path
              ? photoUrlByPath.get(producto.photo_path) ?? null
              : null,
          },
        };
      }),
    };
  },
);

/** Same as `getRutinaWithSteps` but also returns the kind so the caller
 *  can decide whether the user can edit it. */
export const getRutinaSummary = cache(
  async (
    id: string,
  ): Promise<Pick<RutinaRow, "id" | "name" | "kind" | "cliente_id"> | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("rutinas")
      .select("id, name, kind, cliente_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
);

// ---------------------------------------------------------------------------
// Public share viewer — resolves a share_token to a rutina + steps
// ---------------------------------------------------------------------------

/**
 * Resolves a rutina by its public `share_token`. Used by the unauth'd
 * `/rutinas/share/<token>` viewer.
 *
 * Security:
 *  - Uses the admin client (bypasses RLS) — required because the caller
 *    is anonymous.
 *  - Hard filters: `kind = 'template'` (assignments hold clienta data —
 *    never shareable) and `archived_at IS NULL` (archived rutinas are
 *    revoked; see `archiveRutinaAction`).
 *  - Returns the same `RutinaWithSteps` shape as the staff service,
 *    with the same clinical-stripped producto projection — so a
 *    careless `{step.producto.x}` in the viewer can't leak clinical
 *    notes.
 */
export async function getRutinaByShareToken(
  token: string,
): Promise<RutinaWithSteps | null> {
  const supabase = createAdminClient();

  const { data: rutina, error: rutErr } = await supabase
    .from("rutinas")
    .select("*")
    .eq("share_token", token)
    .eq("kind", "template")
    .is("archived_at", null)
    .maybeSingle();
  if (rutErr) throw new Error(rutErr.message);
  if (!rutina) return null;

  const PRODUCTO_EMBED_COLS =
    "id, name, brand, category, main_ingredients, skin_types," +
    " custom_skin_types, application_instruction, suggested_amount," +
    " absorption_time, frequency, time_of_day, additional_tags, photo_path";

  const { data: steps, error: stepsErr } = await supabase
    .from("rutina_steps")
    .select(`*, producto:productos(${PRODUCTO_EMBED_COLS})`)
    .eq("rutina_id", rutina.id)
    .order("step_order", { ascending: true });
  if (stepsErr) throw new Error(stepsErr.message);

  // Sign photo URLs through the admin client too — anon visitors don't
  // have storage policies on `productos-photos`, so a regular client
  // would error out here.
  const photoPaths = (steps ?? [])
    .map((s) => {
      const p = unwrapProducto(s.producto);
      return p?.photo_path ?? null;
    })
    .filter((p): p is string => Boolean(p));
  const photoUrlByPath = await signPhotoUrlsAdmin(photoPaths);

  return {
    ...rutina,
    steps: (steps ?? []).map((s) => {
      const producto = unwrapProducto(s.producto);
      return {
        ...(s as RutinaStepRow),
        producto: {
          ...(producto as Omit<RutinaProductoEmbed, "photoUrl">),
          photoUrl: producto?.photo_path
            ? photoUrlByPath.get(producto.photo_path) ?? null
            : null,
        },
      };
    }),
  };
}

async function signPhotoUrlsAdmin(
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const unique = Array.from(new Set(paths));
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("productos-photos")
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) return out;
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stats helper for the library page
// ---------------------------------------------------------------------------

export interface RutinasLibraryStats {
  total: number;
  am: number;
  pm: number;
  both: number;
}

export const getLibraryStats = cache(
  async (): Promise<RutinasLibraryStats> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("rutinas")
      .select("momento")
      .eq("kind", "template")
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const counts = { total: rows.length, am: 0, pm: 0, both: 0 };
    for (const r of rows) {
      if (r.momento === "am") counts.am++;
      else if (r.momento === "pm") counts.pm++;
      else counts.both++;
    }
    return counts;
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProductoEmbedRaw = Omit<RutinaProductoEmbed, "photoUrl">;

function unwrapProducto(p: unknown): ProductoEmbedRaw | null {
  if (!p) return null;
  if (Array.isArray(p)) return (p[0] ?? null) as ProductoEmbedRaw | null;
  return p as ProductoEmbedRaw;
}

async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const unique = Array.from(new Set(paths));
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("productos-photos")
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) return out;
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}

// Re-exported types referenced from the schema-mirror & the UI
export type { RutinaKind, Producto };
