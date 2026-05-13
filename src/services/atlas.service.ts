import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import {
  ATLAS_SECTIONS,
  type AtlasEntryStatus,
  type AtlasSection,
} from "@/schemas/atlas.schema";
import type { Database } from "@/types/database.types";

// ─── Atlas read API ────────────────────────────────────────────────────────
// Everything in this file runs server-side. RLS already gates Atlas content
// to authenticated staff (super_admin sees all rows; profesional + asistente
// see published ones). Clienta has no policy → blocked at the DB level on
// top of the staff-only route guard.
// ────────────────────────────────────────────────────────────────────────────

export type AtlasEntryRow = Database["public"]["Tables"]["atlas_entries"]["Row"];
export type AtlasFileRow = Database["public"]["Tables"]["atlas_files"]["Row"];

export interface AtlasEntry extends AtlasEntryRow {
  /** Signed cover URL — null when the entry has no cover OR signing failed. */
  coverUrl: string | null;
}

export interface AtlasFile extends AtlasFileRow {
  /** Signed URL for the viewer — used for PDF/image and as a download
   *  fallback for HTML. HTML guides are served via the internal route
   *  handler (see `htmlRoute`) to guarantee correct Content-Type. */
  url: string;
  /** Internal route serving the HTML with `text/html` headers. Only
   *  populated when `kind === 'html'`. */
  htmlRoute: string | null;
}

/**
 * 30-minute signed URL — chosen as the single TTL for every storage path
 * we surface (cover thumbnails, attachment PDFs/images, HTML bundles).
 *
 * Why 30 min:
 *  - Landing / section pages are ISR with `revalidate = 60`, so signed URLs
 *    embedded in cached HTML are at most ~60 s old when served. 30 min of
 *    validity easily covers the cache window + a generous browser-side
 *    fetch grace period.
 *  - Reader pages aren't cached and re-sign on each request, so 30 min
 *    only needs to outlive a single reading session — long enough for the
 *    user to scroll/download without breakage, short enough that a link
 *    leaked via screenshot / history sync rots before it's useful.
 *
 * DO NOT bump this for a future "share to clienta" feature. Direct
 * Supabase signed URLs are NOT revocable, NOT auditable, and NOT
 * rate-limitable — they're inappropriate as an external sharing primitive.
 * The right architecture for share-to-clienta is:
 *   1. `atlas_share_tokens` table (token, entry_id, expires_at, revoked_at)
 *   2. Server route (`/api/atlas/share/[token]/[fileId]`) that validates
 *      the token, logs access, and proxies the file bytes — never hands
 *      the underlying signed URL to the browser.
 * The existing `/api/atlas/files/[fileId]/html` route is the pattern.
 */
export const ATLAS_SIGNED_URL_TTL = 60 * 30;

// ---------------------------------------------------------------------------
// Sections — counts come from a single RPC call (`atlas_section_counts`).
// Cheaper than scanning every row to bucket in JS.
// ---------------------------------------------------------------------------

export interface AtlasSectionWithCount {
  section: AtlasSection;
  publishedCount: number;
}

export const listAtlasSectionCounts = cache(
  async (): Promise<AtlasSectionWithCount[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("atlas_section_counts");
    if (error) throw new Error(error.message);

    const counts = new Map<AtlasSection, number>();
    for (const row of data ?? []) {
      counts.set(row.section, Number(row.published_count));
    }
    // Always return the canonical 7-section order — sections that don't
    // yet have a row show up with count 0 so the landing card renders
    // "Próximamente" instead of disappearing.
    return ATLAS_SECTIONS.map((section) => ({
      section,
      publishedCount: counts.get(section) ?? 0,
    }));
  },
);

// ---------------------------------------------------------------------------
// Tag faceting per section. RPC `atlas_tags_for_section` returns tags +
// frequency for the published rows in a section, ordered by popularity.
// ---------------------------------------------------------------------------

export const listAtlasTagsForSection = cache(
  async (section: AtlasSection): Promise<string[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("atlas_tags_for_section", {
      p_section: section,
    });
    if (error) {
      console.warn("[atlas] tags rpc failed:", error.message);
      return [];
    }
    return (data ?? []).map((row) => row.tag);
  },
);

// ---------------------------------------------------------------------------
// Entries — list & detail
// ---------------------------------------------------------------------------

interface ListEntriesParams {
  section?: AtlasSection;
  search?: string;
  tag?: string;
  /** super_admin pulls every row from the CMS. Reader pages omit the param
   *  and the default keeps only `published`. */
  statuses?: readonly AtlasEntryStatus[];
  page?: number;
  pageSize?: number;
}

export interface ListEntriesResult {
  items: AtlasEntry[];
  totalItems: number;
}

export async function listAtlasEntries(
  params: ListEntriesParams = {},
): Promise<ListEntriesResult> {
  const supabase = await createClient();

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("atlas_entries")
    .select("*", { count: "exact" });

  // Default — reader pages omit `statuses`, so we narrow to published.
  const statuses = params.statuses ?? (["published"] as const);
  if (statuses.length === 1) {
    query = query.eq("status", statuses[0]);
  } else {
    query = query.in("status", [...statuses]);
  }

  if (params.section) {
    query = query.eq("section", params.section);
  }

  if (params.tag) {
    query = query.contains("tags", [params.tag]);
  }

  if (params.search && params.search.trim().length > 0) {
    // Two-pronged: ILIKE on title / description for prefix-friendly matches
    // (Niacin → Niacinamida), and a tsvector match on the generated
    // search_tsv column for stem-aware Spanish search ("rosácea" → "rosacea"
    // base form). The OR is fine — Postgres picks the cheaper plan per row.
    const term = params.search.trim().replace(/[(),]/g, " ");
    const ftsTerm = term.split(/\s+/).filter(Boolean).join(" & ");
    if (ftsTerm.length > 0) {
      query = query.or(
        [
          `title.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `search_tsv.fts(spanish).${ftsTerm}`,
        ].join(","),
      );
    }
  }

  // Published-first ordering: section landing pages want the curator's
  // `position` then most-recent published.
  query = query
    .order("position", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const coverUrlByPath = await signPaths(
    rows
      .map((r) => r.cover_path)
      .filter((p): p is string => Boolean(p)),
  );
  const items: AtlasEntry[] = rows.map((row) => ({
    ...row,
    coverUrl: row.cover_path
      ? coverUrlByPath.get(row.cover_path) ?? null
      : null,
  }));

  return { items, totalItems: count ?? 0 };
}

/** Resolve an entry by section + slug for the reader detail page. */
export const getAtlasEntryBySlug = cache(
  async (
    section: AtlasSection,
    slug: string,
    options: { publishedOnly?: boolean } = { publishedOnly: true },
  ): Promise<AtlasEntry | null> => {
    const supabase = await createClient();
    let q = supabase
      .from("atlas_entries")
      .select("*")
      .eq("section", section)
      .eq("slug", slug);
    if (options.publishedOnly !== false) q = q.eq("status", "published");
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const cover = data.cover_path
      ? (await signPaths([data.cover_path])).get(data.cover_path) ?? null
      : null;
    return { ...data, coverUrl: cover };
  },
);

/** CMS variant: fetch by ID regardless of status. RLS still gates to
 *  super_admin for non-published rows. */
export const getAtlasEntryById = cache(
  async (id: string): Promise<AtlasEntry | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("atlas_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const cover = data.cover_path
      ? (await signPaths([data.cover_path])).get(data.cover_path) ?? null
      : null;
    return { ...data, coverUrl: cover };
  },
);

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Per-request cached list of an entry's attached files. The file list
 *  itself is tiny (metadata + storage path); the heavy work — fetching
 *  the actual HTML body — is deferred to the route handler `/api/atlas/
 *  files/[id]/html`, which only runs when the user expands the file. */
export const listAtlasFilesByEntry = cache(
  async (entryId: string): Promise<AtlasFile[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("atlas_files")
      .select("*")
      .eq("entry_id", entryId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const signed = await signPaths(rows.map((r) => r.storage_path));
    return rows.map((row) => ({
      ...row,
      url: signed.get(row.storage_path) ?? "",
      htmlRoute:
        row.kind === "html" ? `/api/atlas/files/${row.id}/html` : null,
    }));
  },
);

// ---------------------------------------------------------------------------
// Views & favorites (read side)
// ---------------------------------------------------------------------------

/** Returns the last `limit` distinct entry ids the current user opened. */
export const listRecentlyViewedEntries = cache(
  async (limit = 6): Promise<AtlasEntry[]> => {
    const supabase = await createClient();
    // We over-fetch then dedupe in JS — the DB index is on (user_id,
    // viewed_at desc), so the scan is cheap; dedup in SQL would need a
    // distinct-on which doesn't play with our PostgREST builder.
    const { data: views, error } = await supabase
      .from("atlas_views")
      .select("entry_id, viewed_at")
      .order("viewed_at", { ascending: false })
      .limit(limit * 4);
    if (error || !views || views.length === 0) return [];
    const seen = new Set<string>();
    const entryIds: string[] = [];
    for (const row of views) {
      if (seen.has(row.entry_id)) continue;
      seen.add(row.entry_id);
      entryIds.push(row.entry_id);
      if (entryIds.length === limit) break;
    }
    if (entryIds.length === 0) return [];
    return loadEntriesByIds(entryIds);
  },
);

/** Set of entry ids the current user has starred. The detail page uses
 *  the boolean form via `isAtlasEntryFavorite`. */
export const listAtlasFavorites = cache(async (): Promise<AtlasEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atlas_favorites")
    .select("entry_id, created_at")
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];
  return loadEntriesByIds(data.map((row) => row.entry_id));
});

/** Flat list of every distinct tag used across the Atlas, sorted. Backs
 *  the tag autocomplete in the CMS form. Cached per-request. */
export const listAllAtlasTags = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atlas_entries")
    .select("tags");
  if (error || !data) return [];
  const set = new Set<string>();
  for (const row of data) {
    for (const tag of row.tags ?? []) set.add(tag);
  }
  return [...set].sort();
});

export const isAtlasEntryFavorite = cache(
  async (entryId: string): Promise<boolean> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("atlas_favorites")
      .select("entry_id")
      .eq("entry_id", entryId)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  },
);

// ---------------------------------------------------------------------------
// Slug availability — used by the CMS to surface collisions before submit
// ---------------------------------------------------------------------------

export async function checkAtlasSlugAvailable(
  section: AtlasSection,
  slug: string,
  excludeId: string | null,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("atlas_slug_available", {
    p_section: section,
    p_slug: slug,
    p_exclude_id: excludeId ?? undefined,
  });
  if (error) {
    console.warn("[atlas] slug rpc failed:", error.message);
    return true; // fail-open: the DB unique index still rejects collisions
  }
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function loadEntriesByIds(ids: string[]): Promise<AtlasEntry[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atlas_entries")
    .select("*")
    .in("id", ids);
  if (error || !data) return [];
  // Preserve the input order so "recently viewed" stays MRU-first.
  const byId = new Map(data.map((row) => [row.id, row]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const coverUrlByPath = await signPaths(
    ordered.map((r) => r.cover_path).filter((p): p is string => Boolean(p)),
  );
  return ordered.map((row) => ({
    ...row,
    coverUrl: row.cover_path
      ? coverUrlByPath.get(row.cover_path) ?? null
      : null,
  }));
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const unique = Array.from(new Set(paths));
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("atlas")
    .createSignedUrls(unique, ATLAS_SIGNED_URL_TTL);
  if (error) {
    console.warn("[atlas] failed to sign URLs:", error.message);
    return out;
  }
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}
