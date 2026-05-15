"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentSession } from "@/lib/supabase/server";
import {
  blankToNull,
  upsertProductoSchema,
} from "@/schemas/productos.schema";
import type { ActionState, InsertTables } from "@/types/supabase";

type ProductoInsert = InsertTables<"productos">;

/** ROUTES.productos isn't part of the constants enum yet — local mirror. */
const PRODUCTOS_PATH = "/productos";

/**
 * Permission gate used by every write action. Profesional always allowed;
 * asistente needs `catalogo:edit` — the dedicated permission key (matches
 * the RLS policy on `public.productos`). Existing asistentes who had
 * `clientas:edit` but not `catalogo:edit` will lose write access until the
 * profesional explicitly grants the new permission.
 */
function canEdit(session: {
  profile: { role: string; permissions: unknown };
}): boolean {
  const role = session.profile.role;
  if (role === "profesional" || role === "super_admin") return true;
  if (role === "asistente") {
    const perms = (session.profile.permissions ?? {}) as Record<
      string,
      string | null
    >;
    return perms.catalogo === "edit";
  }
  return false;
}

/** Parse the FormData entries we accept for the upsert. Multi-valued fields
 *  ride as repeated form keys (RHF + `fd.append(key, value)` per item). */
function parseUpsertForm(formData: FormData) {
  return upsertProductoSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand"),
    category: formData.get("category"),
    photoPath: formData.get("photoPath"),
    mainIngredients: formData.getAll("mainIngredients").map(String),
    ingredientsInci: formData.get("ingredientsInci"),
    skinTypes: formData.getAll("skinTypes").map(String),
    customSkinTypes: formData.getAll("customSkinTypes").map(String),
    applicationInstruction: formData.get("applicationInstruction"),
    suggestedAmount: formData.get("suggestedAmount"),
    absorptionTime: formData.get("absorptionTime"),
    timeOfDay: formData.get("timeOfDay"),
    frequency: formData.get("frequency"),
    additionalTags: formData.getAll("additionalTags").map(String),
    precautions: formData.get("precautions"),
    conflictingIngredients: formData
      .getAll("conflictingIngredients")
      .map(String),
    clinicalNotes: formData.get("clinicalNotes"),
  });
}

/** Shared mapper: Zod-validated form data → DB column shape. The schema's
 *  optional enums round-trip as `"" | enum | undefined`; we narrow back to
 *  `enum | null` via `blankToNull` + a cast. The CHECK constraints in the
 *  migration enforce the value set, so the cast is safe at the DB
 *  boundary. */
function toRow(
  parsed: ReturnType<typeof parseUpsertForm> & { success: true },
  ownership: { tenant_id: string; professional_id: string },
): ProductoInsert {
  const d = parsed.data;
  return {
    ...ownership,
    name: d.name,
    brand: blankToNull(d.brand),
    category: d.category,
    photo_path: blankToNull(d.photoPath),
    main_ingredients: d.mainIngredients,
    ingredients_inci: blankToNull(d.ingredientsInci),
    skin_types: d.skinTypes,
    custom_skin_types: d.customSkinTypes,
    application_instruction: blankToNull(d.applicationInstruction),
    suggested_amount: blankToNull(d.suggestedAmount),
    absorption_time: blankToNull(d.absorptionTime),
    time_of_day: blankToNull(d.timeOfDay) as ProductoInsert["time_of_day"],
    frequency: blankToNull(d.frequency),
    additional_tags: d.additionalTags,
    precautions: blankToNull(d.precautions),
    conflicting_ingredients: d.conflictingIngredients,
    clinical_notes: blankToNull(d.clinicalNotes),
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Lazy-load the full producto row for the edit Sheet. The catalog grid
 * projects only the columns it renders (see `ProductoListItem` and audit
 * Phase 4.1), so when the user clicks "Editar" the form needs to pull the
 * heavy clinical fields (`clinical_notes`, `precautions`, etc.) plus the
 * form-only fields. RLS scopes to the caller's tenant.
 */
export async function getProductoForEditAction(
  id: string,
): Promise<ActionState<import("@/services/productos.service").Producto>> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Inicia sesión para continuar." };
  }
  try {
    const { getProductoById } = await import("@/services/productos.service");
    const producto = await getProductoById(id);
    if (!producto) {
      return { success: false, message: "No encontramos el producto." };
    }
    return { success: true, data: producto };
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Error al cargar el producto.",
    };
  }
}

export async function createProductoAction(
  _prev: ActionState<{ productoId: string }> | null,
  formData: FormData,
): Promise<ActionState<{ productoId: string }>> {
  const parsed = parseUpsertForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session) || !session.profile.tenant_id) {
    return { success: false, message: "No tienes permisos para crear productos." };
  }

  const supabase = await createClient();
  const row = toRow(parsed, {
    tenant_id: session.profile.tenant_id,
    professional_id: session.profile.id,
  });

  const { data, error } = await supabase
    .from("productos")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? "No se pudo crear el producto.",
    };
  }

  revalidatePath(PRODUCTOS_PATH);
  return {
    success: true,
    message: "Producto guardado.",
    data: { productoId: data.id },
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProductoAction(
  productoId: string,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseUpsertForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session) || !session.profile.tenant_id) {
    return { success: false, message: "No tienes permisos para editar productos." };
  }

  const supabase = await createClient();
  const d = parsed.data;

  // RLS already gates the UPDATE to the tenant — we don't pass tenant_id /
  // professional_id in the SET clause to avoid accidentally re-keying a row
  // whose owner left the tenant.
  const { error } = await supabase
    .from("productos")
    .update({
      name: d.name,
      brand: blankToNull(d.brand),
      category: d.category,
      photo_path: blankToNull(d.photoPath),
      main_ingredients: d.mainIngredients,
      ingredients_inci: blankToNull(d.ingredientsInci),
      skin_types: d.skinTypes,
      custom_skin_types: d.customSkinTypes,
      application_instruction: blankToNull(d.applicationInstruction),
      suggested_amount: blankToNull(d.suggestedAmount),
      absorption_time: blankToNull(d.absorptionTime),
      time_of_day: blankToNull(d.timeOfDay) as ProductoInsert["time_of_day"],
      frequency: blankToNull(d.frequency),
      additional_tags: d.additionalTags,
      precautions: blankToNull(d.precautions),
      conflicting_ingredients: d.conflictingIngredients,
      clinical_notes: blankToNull(d.clinicalNotes),
    })
    .eq("id", productoId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(PRODUCTOS_PATH);
  return { success: true, message: "Cambios guardados." };
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

/**
 * Clone a product with a "(copia)" suffix. The new row owns the same
 * tenant + same professional as the source, but does NOT copy the photo —
 * cloning images requires a storage round-trip and routine rebuilds rarely
 * need the same photo on the duplicate. The user can re-upload if needed.
 */
export async function duplicateProductoAction(
  productoId: string,
): Promise<ActionState<{ productoId: string }>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session) || !session.profile.tenant_id) {
    return { success: false, message: "No tienes permisos para duplicar productos." };
  }

  const supabase = await createClient();
  const { data: source, error: readErr } = await supabase
    .from("productos")
    .select("*")
    .eq("id", productoId)
    .maybeSingle();

  if (readErr || !source) {
    return { success: false, message: "Producto no encontrado." };
  }

  const { data: created, error: insertErr } = await supabase
    .from("productos")
    .insert({
      tenant_id: session.profile.tenant_id,
      professional_id: session.profile.id,
      name: `${source.name} (copia)`,
      brand: source.brand,
      category: source.category,
      photo_path: null,
      main_ingredients: source.main_ingredients,
      ingredients_inci: source.ingredients_inci,
      skin_types: source.skin_types,
      custom_skin_types: source.custom_skin_types,
      application_instruction: source.application_instruction,
      suggested_amount: source.suggested_amount,
      absorption_time: source.absorption_time,
      time_of_day: source.time_of_day,
      frequency: source.frequency,
      additional_tags: source.additional_tags,
      precautions: source.precautions,
      conflicting_ingredients: source.conflicting_ingredients,
      clinical_notes: source.clinical_notes,
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    return {
      success: false,
      message: insertErr?.message ?? "No se pudo duplicar el producto.",
    };
  }

  revalidatePath(PRODUCTOS_PATH);
  return {
    success: true,
    message: "Producto duplicado.",
    data: { productoId: created.id },
  };
}

// ---------------------------------------------------------------------------
// Archive (soft delete)
// ---------------------------------------------------------------------------

/**
 * Soft-archive. We never DELETE so existing/future routines that reference
 * the product keep working. The catalog list filters `archived_at IS NULL`,
 * making the row invisible everywhere it matters.
 *
 * The UI warns when `routines_usage_count > 0` before calling this — the
 * action itself doesn't gate (the routine builder may want a "force archive"
 * even when in-use).
 */
export async function archiveProductoAction(
  productoId: string,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session)) {
    return { success: false, message: "No tienes permisos para eliminar productos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("productos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", productoId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(PRODUCTOS_PATH);
  return { success: true, message: "Producto eliminado." };
}

