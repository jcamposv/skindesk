"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import {
  ATLAS_FILE_KINDS,
  ATLAS_SECTIONS,
  blankToNull,
  upsertAtlasEntrySchema,
  type AtlasFileKind,
  type AtlasSection,
} from "@/schemas/atlas.schema";
import { checkAtlasSlugAvailable } from "@/services/atlas.service";
import type { ActionState } from "@/types/supabase";

// ─── Auth gate ──────────────────────────────────────────────────────────────
// Every write here goes through `requireSuperAdmin()`. RLS already blocks
// non-super_admin INSERT/UPDATE/DELETE at the DB; the app-level gate just
// gives a friendlier error message and avoids a wasted round-trip.
// ────────────────────────────────────────────────────────────────────────────

/** Returns a failed `ActionState` when the caller is not super_admin, or
 *  null when the caller is authorised. The returned shape omits `data`, so
 *  it's assignable to `ActionState<T>` for any T (data is optional).
 */
async function requireSuperAdmin(): Promise<{
  success: false;
  message: string;
} | null> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (session.profile.role !== "super_admin") {
    return {
      success: false,
      message: "Solo el super administrador puede administrar el Atlas.",
    };
  }
  return null;
}

function parseUpsertForm(formData: FormData) {
  const rawPosition = formData.get("position");
  const position =
    typeof rawPosition === "string" && rawPosition.trim() !== ""
      ? Number.parseInt(rawPosition, 10) || 0
      : 0;
  return upsertAtlasEntrySchema.safeParse({
    section: formData.get("section"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    bodyMd: formData.get("bodyMd"),
    tags: formData.getAll("tags").map(String),
    status: formData.get("status"),
    position,
    coverPath: formData.get("coverPath"),
  });
}

/** Light UUID v4 validation — we only need to distinguish a real uuid from
 *  garbage. Used by `createAtlasEntryAction` to honour a client-provided id
 *  so the storage path written by the uploader (`entries/<id>/...`) lines
 *  up with the row id. */
function isUuid(value: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createAtlasEntryAction(
  _prev: ActionState<{ entryId: string }> | null,
  formData: FormData,
): Promise<ActionState<{ entryId: string }>> {
  const gate = await requireSuperAdmin();
  if (gate) return gate;

  const parsed = parseUpsertForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const session = await getCurrentSession();
  const supabase = await createClient();
  const d = parsed.data;

  // Honour a client-provided id so the row id matches the storage path the
  // uploader already wrote to (`entries/<id>/cover.<ext>` and friends). If
  // none was provided or it isn't a uuid, Postgres mints one via the
  // column default and we accept the orphan path.
  const providedId = formData.get("id");
  const id = typeof providedId === "string" && isUuid(providedId) ? providedId : undefined;

  const { data, error } = await supabase
    .from("atlas_entries")
    .insert({
      ...(id ? { id } : {}),
      section: d.section,
      title: d.title,
      slug: d.slug,
      description: blankToNull(d.description),
      body_md: blankToNull(d.bodyMd),
      tags: d.tags,
      status: d.status,
      position: d.position,
      cover_path: blankToNull(d.coverPath ?? null),
      author_id: session?.user.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? "No se pudo crear la entrada.",
    };
  }

  revalidatePath(ROUTES.atlasAdmin);
  revalidatePath(ROUTES.atlas);
  revalidatePath(`${ROUTES.atlas}/${d.section}`);
  return {
    success: true,
    message: "Entrada creada.",
    data: { entryId: data.id },
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateAtlasEntryAction(
  entryId: string,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireSuperAdmin();
  if (gate) return gate;

  const parsed = parseUpsertForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const d = parsed.data;

  const { error } = await supabase
    .from("atlas_entries")
    .update({
      section: d.section,
      title: d.title,
      slug: d.slug,
      description: blankToNull(d.description),
      body_md: blankToNull(d.bodyMd),
      tags: d.tags,
      status: d.status,
      position: d.position,
      cover_path: blankToNull(d.coverPath ?? null),
    })
    .eq("id", entryId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(ROUTES.atlasAdmin);
  revalidatePath(`${ROUTES.atlasAdmin}/${entryId}`);
  revalidatePath(ROUTES.atlas);
  revalidatePath(`${ROUTES.atlas}/${d.section}`);
  revalidatePath(`${ROUTES.atlas}/${d.section}/${d.slug}`);
  return { success: true, message: "Cambios guardados." };
}

// ---------------------------------------------------------------------------
// Status helpers (publish / archive)
// ---------------------------------------------------------------------------

export async function setAtlasEntryStatusAction(
  entryId: string,
  status: "draft" | "published" | "archived",
): Promise<ActionState> {
  const gate = await requireSuperAdmin();
  if (gate) return gate;

  const supabase = await createClient();
  const { error } = await supabase
    .from("atlas_entries")
    .update({ status })
    .eq("id", entryId);
  if (error) return { success: false, message: error.message };

  revalidatePath(ROUTES.atlasAdmin);
  revalidatePath(ROUTES.atlas);
  return {
    success: true,
    message:
      status === "published"
        ? "Entrada publicada."
        : status === "archived"
          ? "Entrada archivada."
          : "Entrada marcada como borrador.",
  };
}

// ---------------------------------------------------------------------------
// Delete — hard delete because Atlas content is curated. Cascade clears
// `atlas_files`; storage cleanup runs below.
// ---------------------------------------------------------------------------

export async function deleteAtlasEntryAction(
  entryId: string,
): Promise<ActionState> {
  const gate = await requireSuperAdmin();
  if (gate) return gate;

  const supabase = await createClient();

  // Best-effort storage cleanup: list every object for the entry's prefix
  // and remove them. If the listing fails we still proceed to the row delete
  // — orphans in storage are non-fatal and can be swept later.
  const prefix = `entries/${entryId}`;
  const { data: objects } = await supabase.storage.from("atlas").list(prefix, {
    limit: 1000,
  });
  if (objects && objects.length > 0) {
    await supabase.storage
      .from("atlas")
      .remove(objects.map((o) => `${prefix}/${o.name}`))
      .catch(() => {});
  }

  const { error } = await supabase
    .from("atlas_entries")
    .delete()
    .eq("id", entryId);
  if (error) return { success: false, message: error.message };

  revalidatePath(ROUTES.atlasAdmin);
  revalidatePath(ROUTES.atlas);
  redirect(ROUTES.atlasAdmin);
}

// ---------------------------------------------------------------------------
// Slug availability — live pre-check from the form. Doesn't reserve the
// slug; the DB unique index is still the source of truth.
// ---------------------------------------------------------------------------

export async function checkSlugAvailableAction(input: {
  section: string;
  slug: string;
  excludeId?: string | null;
}): Promise<{ available: boolean }> {
  const session = await getCurrentSession();
  if (!session || session.profile.role !== "super_admin") {
    // Don't leak slug info to non-admins.
    return { available: true };
  }
  if (!(ATLAS_SECTIONS as readonly string[]).includes(input.section)) {
    return { available: true };
  }
  const slug = (input.slug ?? "").trim().toLowerCase();
  if (!slug) return { available: true };
  const ok = await checkAtlasSlugAvailable(
    input.section as AtlasSection,
    slug,
    input.excludeId ?? null,
  );
  return { available: ok };
}

// ---------------------------------------------------------------------------
// File rows — the browser uploads the binary directly to storage, then calls
// this action with the resulting path + metadata. Keeping this server-side
// means RLS gates the row creation independently of any client-side checks.
// ---------------------------------------------------------------------------

interface AttachFileInput {
  entryId: string;
  kind: AtlasFileKind;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position?: number;
}

export async function attachAtlasFileAction(
  input: AttachFileInput,
): Promise<ActionState<{ fileId: string }>> {
  const gate = await requireSuperAdmin();
  if (gate) return gate;

  if (!(ATLAS_FILE_KINDS as readonly string[]).includes(input.kind)) {
    return { success: false, message: "Tipo de archivo no soportado." };
  }
  if (!input.storagePath.startsWith(`entries/${input.entryId}/`)) {
    return { success: false, message: "Ruta de almacenamiento inválida." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atlas_files")
    .insert({
      entry_id: input.entryId,
      kind: input.kind,
      storage_path: input.storagePath,
      original_name: input.originalName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      position: input.position ?? 0,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? "No se pudo registrar el archivo.",
    };
  }
  revalidatePath(`${ROUTES.atlasAdmin}/${input.entryId}`);
  return { success: true, data: { fileId: data.id } };
}

export async function removeAtlasFileAction(
  fileId: string,
): Promise<ActionState> {
  const gate = await requireSuperAdmin();
  if (gate) return gate;

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("atlas_files")
    .select("entry_id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (readErr || !row) {
    return { success: false, message: "Archivo no encontrado." };
  }

  // Best-effort storage cleanup first — if storage fails we still let the
  // row delete proceed so the user can retry without a stuck record.
  await supabase.storage.from("atlas").remove([row.storage_path]).catch(() => {});

  const { error } = await supabase
    .from("atlas_files")
    .delete()
    .eq("id", fileId);
  if (error) return { success: false, message: error.message };

  revalidatePath(`${ROUTES.atlasAdmin}/${row.entry_id}`);
  return { success: true, message: "Archivo eliminado." };
}

// ---------------------------------------------------------------------------
// View tracking — fire-and-forget from the entry detail page. RLS only
// allows users to write rows with their own user_id, so we don't gate
// further here.
// ---------------------------------------------------------------------------

export async function trackAtlasViewAction(
  entryId: string,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { success: false };
  // Only staff sees Atlas — defence in depth on top of RLS.
  const role = session.profile.role;
  if (role !== "super_admin" && role !== "profesional" && role !== "asistente") {
    return { success: false };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("atlas_views").insert({
    entry_id: entryId,
    user_id: session.profile.id,
  });
  if (error) return { success: false, message: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Favorites — toggle per user. RLS scopes inserts/deletes to the caller's
// user_id, so we only need to map "intent" → INSERT or DELETE.
// ---------------------------------------------------------------------------

export async function toggleAtlasFavoriteAction(
  entryId: string,
  shouldFavorite: boolean,
): Promise<ActionState<{ favorited: boolean }>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  const role = session.profile.role;
  if (role !== "super_admin" && role !== "profesional" && role !== "asistente") {
    return { success: false, message: "No tienes acceso al Atlas." };
  }
  const supabase = await createClient();
  if (shouldFavorite) {
    const { error } = await supabase
      .from("atlas_favorites")
      .upsert(
        { entry_id: entryId, user_id: session.profile.id },
        { onConflict: "user_id,entry_id" },
      );
    if (error) return { success: false, message: error.message };
  } else {
    const { error } = await supabase
      .from("atlas_favorites")
      .delete()
      .eq("entry_id", entryId)
      .eq("user_id", session.profile.id);
    if (error) return { success: false, message: error.message };
  }
  revalidatePath(ROUTES.atlas);
  return { success: true, data: { favorited: shouldFavorite } };
}
