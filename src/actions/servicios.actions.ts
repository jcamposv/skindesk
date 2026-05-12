"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import {
  addSesionSchema,
  servicioCreateSchema,
  type AddSesionInput,
  type ServicioCreateInput,
} from "@/schemas/servicios.schema";
import type { Database } from "@/types/database.types";
import type { ActionState } from "@/types/supabase";

type Json = Database["public"]["Tables"]["sesiones"]["Row"]["payload"];

interface CreateServicioResult {
  servicioId: string;
  firstSessionId: string;
  version: number;
}

interface AddSessionResult {
  sessionId: string;
  /** Service version AFTER the session was attached. Clients pass this on
   *  subsequent calls as `expectedVersion` to detect concurrent edits. */
  servicioVersion: number;
}

/**
 * Create a new service for a clienta + register the first session.
 *
 * Auth: RLS handles authorization. The action gates the role at the app
 * level for a clearer error (profesional / super_admin only; asistente is
 * read-only for this module).
 *
 * Transactionality: Postgres doesn't expose multi-statement transactions
 * via PostgREST out of the box. We INSERT the servicio first, then the
 * first sesion. If the sesion insert fails we attempt a compensating
 * delete on the servicio so the caller doesn't end up with an empty row.
 * For v1 this is acceptable — the failure surface is narrow (almost only
 * a constraint check or RLS denial).
 *
 * Photo orphans: any paths in `firstSession.beforePaths` / `.afterPaths`
 * that were uploaded but never persisted (user cancelled before save) sit
 * unreferenced in storage. Document this here so future work can wire a
 * cleanup cron without surprise.
 */
export async function createServicioAction(
  clienteId: string,
  input: ServicioCreateInput,
): Promise<ActionState<CreateServicioResult>> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "No autenticado." };
  }
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
  }

  const parsed = servicioCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const supabase = await createClient();

  // ─── Insert servicio ─────────────────────────────────────────────────
  const { data: servicio, error: servErr } = await supabase
    .from("servicios")
    .insert({
      // tenant_id, created_by, last_editor_id, version are set by triggers.
      cliente_id: clienteId,
      tenant_id: session.profile.tenant_id ?? "",
      name: v.name,
      service_type: v.serviceType,
      catalog_key: v.catalogKey,
      start_date: v.startDate,
      total_sessions: v.totalSessions,
      frequency: v.frequency,
      status: v.status,
      notes: v.notes || null,
      package_amount: v.packageAmount,
      professional_id: v.professionalId,
      professional_label: v.professionalLabel || null,
      next_appointment: v.nextAppointment,
      tags: v.tags,
      is_post_op: v.isPostOp,
      // Zod-inferred shape is JSON-compatible at runtime; the `Json` row
      // type is recursive and doesn't structurally match strict object
      // shapes, so a narrowing cast is required at this serialization
      // boundary.
      laser_diagnosis:
        v.serviceType === "laser" && v.laserDiagnosis
          ? (v.laserDiagnosis as unknown as Json)
          : null,
    })
    .select("id, version")
    .single();

  if (servErr || !servicio) {
    return { success: false, message: mapPgError(servErr) };
  }

  // ─── Insert first sesion (compensating delete on failure) ────────────
  const fs = v.firstSession;
  const { data: sesion, error: sesErr } = await supabase
    .from("sesiones")
    .insert({
      servicio_id: servicio.id,
      // tenant_id + cliente_id are set by the sync trigger.
      tenant_id: session.profile.tenant_id ?? "",
      cliente_id: clienteId,
      session_number: fs.sessionNumber,
      session_date: fs.date,
      duration_min: fs.durationMin,
      professional_id: fs.professionalId,
      professional_label: fs.professionalLabel || null,
      status: fs.status,
      notes: fs.notes || null,
      before_paths: fs.beforePaths,
      after_paths: fs.afterPaths,
      recommendations: fs.recommendations || null,
      next_suggestion: fs.nextSuggestion,
      payload: fs.payload as unknown as Json, // see laser_diagnosis note above
    })
    .select("id")
    .single();

  if (sesErr || !sesion) {
    await supabase.from("servicios").delete().eq("id", servicio.id);
    return { success: false, message: mapPgError(sesErr) };
  }

  revalidatePath(`${ROUTES.clientes}/${clienteId}`);
  return {
    success: true,
    data: {
      servicioId: servicio.id,
      firstSessionId: sesion.id,
      version: servicio.version,
    },
  };
}

/**
 * Append a session to an existing service.
 *
 * Optimistic concurrency: when `expectedServicioVersion` is provided, the
 * insert is short-circuited if the servicio's version moved on us — we
 * surface a conflict so the UI can refresh and retry. (The session table
 * itself has its own `version`, but the relevant invariant here is "the
 * service hasn't been mutated since the user opened the form".)
 *
 * The `sesiones_bump_servicio` AFTER-INSERT trigger handles auto-completion
 * + next-appointment propagation — the action doesn't touch the parent
 * service.
 */
export async function addSessionAction(
  servicioId: string,
  input: AddSesionInput,
  expectedServicioVersion?: number,
): Promise<ActionState<AddSessionResult>> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "No autenticado." };
  }
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
  }

  const parsed = addSesionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const supabase = await createClient();

  // Concurrency check: read current version of the parent service. If
  // expected was provided and doesn't match, surface a conflict before
  // touching anything else.
  const { data: parent, error: parentErr } = await supabase
    .from("servicios")
    .select("id, cliente_id, version, total_sessions")
    .eq("id", servicioId)
    .maybeSingle();

  if (parentErr) {
    return { success: false, message: mapPgError(parentErr) };
  }
  if (!parent) {
    return { success: false, message: "Servicio no encontrado." };
  }
  if (
    typeof expectedServicioVersion === "number" &&
    parent.version !== expectedServicioVersion
  ) {
    return {
      success: false,
      message:
        "Otro usuario actualizó este servicio antes que vos. Refrescá la página y reintentá.",
      errors: { version: ["conflict"] },
    };
  }

  const { data: sesion, error: sesErr } = await supabase
    .from("sesiones")
    .insert({
      servicio_id: servicioId,
      tenant_id: session.profile.tenant_id ?? "",
      cliente_id: parent.cliente_id,
      session_number: v.sessionNumber,
      session_date: v.date,
      duration_min: v.durationMin,
      professional_id: v.professionalId,
      professional_label: v.professionalLabel || null,
      status: v.status,
      notes: v.notes || null,
      before_paths: v.beforePaths,
      after_paths: v.afterPaths,
      recommendations: v.recommendations || null,
      next_suggestion: v.nextSuggestion,
      payload: v.payload as unknown as Json,
    })
    .select("id")
    .single();

  if (sesErr || !sesion) {
    return { success: false, message: mapPgError(sesErr) };
  }

  // Re-read parent to get the version after the AFTER-INSERT trigger may
  // have flipped status/next_appointment (which bumps version).
  const { data: parentAfter } = await supabase
    .from("servicios")
    .select("version, cliente_id")
    .eq("id", servicioId)
    .maybeSingle();

  revalidatePath(`${ROUTES.clientes}/${parent.cliente_id}`);
  return {
    success: true,
    data: {
      sessionId: sesion.id,
      servicioVersion: parentAfter?.version ?? parent.version,
    },
  };
}

/**
 * Delete a single photo from `servicios-photos` storage + (if a sessionId
 * is provided) splice it out of the session's path array.
 *
 * Defense in depth (RLS on `storage.objects` already enforces tenant
 * isolation, but the action validates inputs to fail fast and to prevent
 * an in-tenant profesional from passing a guessed path / mismatched
 * sessionId):
 *   1. `path` must start with the caller's own tenant_id prefix.
 *   2. If `sessionId` is given, the row is loaded first and the path must
 *      live in `before_paths` or `after_paths`.
 *   3. Storage delete happens LAST, after both checks pass — so a bad
 *      input never removes the object.
 */
export async function deleteSessionPhotoAction(
  path: string,
  sessionId: string | null,
): Promise<ActionState<{ path: string }>> {
  const authSession = await getCurrentSession();
  if (!authSession) {
    return { success: false, message: "No autenticado." };
  }
  if (
    authSession.profile.role !== "profesional" &&
    authSession.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
  }

  const tenantId = authSession.profile.tenant_id;
  if (!tenantId) {
    return { success: false, message: "Tenant inválido." };
  }
  if (!path.startsWith(`${tenantId}/`)) {
    return { success: false, message: "Path fuera de tu tenant." };
  }

  const supabase = await createClient();

  // If a session row exists, verify the path is actually attached before
  // touching anything. Defends against typos / forged sessionIds.
  let clienteIdForRevalidate: string | null = null;
  let nextBefore: string[] | null = null;
  let nextAfter: string[] | null = null;
  if (sessionId) {
    const { data: row, error: readErr } = await supabase
      .from("sesiones")
      .select("id, cliente_id, before_paths, after_paths")
      .eq("id", sessionId)
      .maybeSingle();

    if (readErr) {
      return { success: false, message: mapPgError(readErr) };
    }
    if (!row) {
      return { success: false, message: "Sesión no encontrada." };
    }
    const inBefore = row.before_paths.includes(path);
    const inAfter = row.after_paths.includes(path);
    if (!inBefore && !inAfter) {
      return {
        success: false,
        message: "La foto no pertenece a esta sesión.",
      };
    }
    nextBefore = inBefore
      ? row.before_paths.filter((p) => p !== path)
      : row.before_paths;
    nextAfter = inAfter
      ? row.after_paths.filter((p) => p !== path)
      : row.after_paths;
    clienteIdForRevalidate = row.cliente_id;
  }

  // Storage delete LAST so a failed verify never leaks an orphan path-row.
  const { error: storageErr } = await supabase.storage
    .from("servicios-photos")
    .remove([path]);
  if (storageErr) {
    return {
      success: false,
      message: `No se pudo eliminar la foto: ${storageErr.message}`,
    };
  }

  if (sessionId && nextBefore && nextAfter) {
    const { error: updErr } = await supabase
      .from("sesiones")
      .update({ before_paths: nextBefore, after_paths: nextAfter })
      .eq("id", sessionId);
    if (updErr) {
      // Storage already gone — the row will surface a missing path on next
      // signed-URL pass, which the mapper drops silently. Bubble the error
      // so the UI can re-fetch and show the truth.
      return { success: false, message: mapPgError(updErr) };
    }
    if (clienteIdForRevalidate) {
      revalidatePath(`${ROUTES.clientes}/${clienteIdForRevalidate}`);
    }
  }

  return { success: true, data: { path } };
}
