import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// ─── Routine builder integration notes ──────────────────────────────────────
// Before exposing the catalog to clientas, the routine builder MUST wire:
//
//   1. An AFTER INSERT/DELETE trigger on `routine_steps` that maintains
//      `productos.routines_usage_count`. The column is denormalised today
//      and the catalog UI reads it (card badge, list column, stats). No
//      writer updates it yet.
//
//   2. A `productos_public` view with `WITH (security_invoker = true)`
//      that omits `precautions`, `conflicting_ingredients`, and
//      `clinical_notes`. Clienta-facing screens MUST query that view, not
//      this service, so clinical fields stay professional-only.
//
//   3. Conflict warnings can be expressed as
//      `p1.conflicting_ingredients && p2.main_ingredients` over the rows
//      in a routine — GIN-indexed and fast.
//
// Tracked in memory: productos_routine_builder_prerequisites.md
// ─────────────────────────────────────────────────────────────────────────────
import {
  type ProductoCategoria,
  type ProductoSkinType,
  type ProductoSort,
  type ProductoTag,
} from "@/schemas/productos.schema";

type ProductoRow = Database["public"]["Tables"]["productos"]["Row"];

export type Producto = ProductoRow & {
  /** Lazily signed URL — null when the product has no photo OR signing
   *  failed. The card falls back to the category illustration. */
  photoUrl: string | null;
};

interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  category?: ProductoCategoria;
  skinType?: ProductoSkinType;
  tag?: ProductoTag;
  sort?: ProductoSort;
}

interface ListResult {
  items: Producto[];
  totalItems: number;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h — far longer than a page view.

const SORT_MAP: Record<
  ProductoSort,
  { column: keyof ProductoRow; ascending: boolean }
> = {
  name_asc: { column: "name", ascending: true },
  brand_asc: { column: "brand", ascending: true },
  category_asc: { column: "category", ascending: true },
  recent: { column: "created_at", ascending: false },
  most_used: { column: "routines_usage_count", ascending: false },
};

/**
 * List productos for the catalog grid/list. RLS scopes the read to the
 * caller's tenant. The filter shape mirrors the URL params owned by
 * `useTableUrlState`, so the page can pass them through unchanged.
 *
 * `search` matches against name (ILIKE prefix), brand (ILIKE prefix), OR the
 * `main_ingredients` array (contains via `cs`). Postgres handles each branch
 * with its own index — the planner picks; we don't try to outsmart it.
 */
export async function listProductos(params: ListParams): Promise<ListResult> {
  const supabase = await createClient();

  const sort = SORT_MAP[params.sort ?? "recent"];
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("productos")
    .select("*", { count: "exact" })
    .is("archived_at", null);

  if (params.category) {
    query = query.eq("category", params.category);
  }
  if (params.skinType) {
    // PostgREST `cs` translates to `@>` — array contains.
    query = query.contains("skin_types", [params.skinType]);
  }
  if (params.tag) {
    query = query.contains("additional_tags", [params.tag]);
  }
  if (params.search && params.search.length > 0) {
    const term = params.search.trim();
    if (term.length > 0) {
      // Partial match across name, brand, and the trigger-maintained
      // `main_ingredients_text` column. The PostgREST `.or()` mini-DSL
      // treats `,` and `()` as syntax so we strip them out of the term
      // before interpolating. Trigram GIN index on `main_ingredients_text`
      // keeps ILIKE fast — `Niacin` matches `Niacinamide` now.
      const safe = term.replace(/[(),]/g, " ");
      query = query.or(
        [
          `name.ilike.%${safe}%`,
          `brand.ilike.%${safe}%`,
          `main_ingredients_text.ilike.%${safe}%`,
        ].join(","),
      );
    }
  }

  query = query
    .order(sort.column, { ascending: sort.ascending })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const photoUrlByPath = await signPhotoUrls(
    rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p)),
  );

  const items: Producto[] = rows.map((row) => ({
    ...row,
    photoUrl: row.photo_path ? (photoUrlByPath.get(row.photo_path) ?? null) : null,
  }));

  return { items, totalItems: count ?? 0 };
}

/**
 * Hard cap on `listProductosForBuilder`. The builder catalog ships every
 * product in one payload so the user can drag/drop without an extra
 * round-trip. Once a tenant exceeds this we surface a hint inside the
 * catalog (`isCapped`) telling the user to refine the search. Bump only
 * after we benchmark `createSignedUrls` time + browser RAM at the new
 * ceiling.
 */
export const BUILDER_CATALOG_LIMIT = 200;

export type BuilderProductoRow = Pick<
  ProductoRow,
  | "id"
  | "name"
  | "brand"
  | "category"
  | "main_ingredients"
  | "application_instruction"
  | "suggested_amount"
  | "absorption_time"
  | "frequency"
  | "time_of_day"
  | "photo_path"
> & { photoUrl: string | null };

export interface BuilderCatalogResult {
  items: BuilderProductoRow[];
  /** True when the result hit `BUILDER_CATALOG_LIMIT`. Callers should
   *  surface a hint to refine the search. */
  isCapped: boolean;
  /** Number of products matching the (optional) search filter, before
   *  the cap was applied. `null` when not computed (no search). */
  totalMatching: number | null;
}

interface ListBuilderParams {
  /** Server-side search across name, brand, main ingredients. */
  search?: string;
}

/** Catalog snapshot used by the routine builder. Lightweight projection
 *  (no clinical notes) — enough for the catalog column + step rendering.
 *  RLS scopes to the caller's tenant. Capped at `BUILDER_CATALOG_LIMIT`. */
export const listProductosForBuilder = cache(
  async (params: ListBuilderParams = {}): Promise<BuilderCatalogResult> => {
    const supabase = await createClient();
    let query = supabase
      .from("productos")
      .select(
        "id, name, brand, category, main_ingredients, application_instruction, suggested_amount, absorption_time, frequency, time_of_day, photo_path",
        { count: "exact" },
      )
      .is("archived_at", null);

    const term = params.search?.trim();
    if (term && term.length > 0) {
      // ILIKE on name + brand. Ingredients live in a text[] so we use the
      // contains operator separately when the term looks like a single
      // ingredient (no spaces). Commas / parens are stripped to keep the
      // PostgREST `.or` parser happy.
      const safe = term.replace(/[(),]/g, " ");
      query = query.or(
        [`name.ilike.%${safe}%`, `brand.ilike.%${safe}%`].join(","),
      );
    }

    query = query
      .order("name", { ascending: true })
      .limit(BUILDER_CATALOG_LIMIT);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const photoUrlByPath = await signPhotoUrls(
      rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p)),
    );
    const items: BuilderProductoRow[] = rows.map((row) => ({
      ...row,
      photoUrl: row.photo_path
        ? photoUrlByPath.get(row.photo_path) ?? null
        : null,
    }));
    const totalMatching = count ?? null;
    const isCapped =
      totalMatching !== null && totalMatching > BUILDER_CATALOG_LIMIT;
    return { items, isCapped, totalMatching };
  },
);

export const getProductoById = cache(
  async (id: string): Promise<Producto | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const signed = data.photo_path
      ? (await signPhotoUrls([data.photo_path])).get(data.photo_path) ?? null
      : null;
    return { ...data, photoUrl: signed };
  },
);

export interface ProductosStats {
  totalActive: number;
  activeCategories: number;
  addedThisWeek: number;
  usedInRoutines: number;
}

/**
 * Stat cards on top of the catalog page. One round-trip via the
 * `productos_stats()` RPC — replaces four separate count queries plus a
 * row-fetching DISTINCT trick. RLS scopes the counts to the caller's
 * tenant (the RPC is `security invoker`).
 *
 * Wrapped in React.cache so the page reads it once per request.
 */
export const getProductosStats = cache(async (): Promise<ProductosStats> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("productos_stats").single();
  if (error) throw new Error(error.message);
  return {
    totalActive: data?.total ?? 0,
    activeCategories: data?.categories ?? 0,
    addedThisWeek: data?.recent ?? 0,
    usedInRoutines: data?.used ?? 0,
  };
});

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const unique = Array.from(new Set(paths));
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("productos-photos")
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn("[productos] failed to sign photo URLs:", error.message);
    return out;
  }
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}
