"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import {
  evaluacionPatchSchema,
  type EvaluacionPatchInput,
} from "@/schemas/evaluacion.schema";
import type { Database } from "@/types/database.types";
import type { ActionState } from "@/types/supabase";

type Json = Database["public"]["Tables"]["evaluaciones"]["Row"]["datos"];

interface UpsertResult {
  evaluacionId: string;
  /** New version after the write. Clients should send this on the next call
   *  as `expectedVersion` to detect concurrent edits. */
  version: number;
}

/**
 * Upsert the cliente's evaluación.
 *
 * Auth: relies on the existing `evaluaciones_*` RLS policies — the caller
 * must be the tenant's profesional, an asistente w/ `clientas:edit`, or
 * super_admin. We don't pre-validate the cliente row: RLS will reject
 * cross-tenant writes with a clear error code we map below.
 *
 * Concurrency: when `expectedVersion` is provided, the UPDATE is
 * conditioned on `WHERE version = expectedVersion`. On mismatch, 0 rows
 * are affected and we surface a 409-style conflict so the UI can recover
 * (refresh + retry). The first-ever save (no row yet) skips the check.
 *
 * Audit: `created_by` and `last_editor_id` are stamped server-side via
 * triggers — the action sends nothing for those columns.
 */
export async function upsertEvaluacionAction(
  clienteId: string,
  patch: EvaluacionPatchInput,
  expectedVersion?: number,
): Promise<ActionState<UpsertResult>> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Inicia sesión para continuar." };
  }

  const callerRole = session.profile.role;
  const allowed =
    callerRole === "profesional" ||
    callerRole === "asistente" ||
    callerRole === "super_admin";
  if (!allowed) {
    return { success: false, message: "No tienes permisos." };
  }

  const parsed = evaluacionPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  // Read the existing row (if any) to know whether to INSERT or UPDATE.
  // RLS scopes this read to our tenant — we trust the result.
  const { data: existing, error: readErr } = await supabase
    .from("evaluaciones")
    .select("id, version")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (readErr) {
    return { success: false, message: mapPgError(readErr) };
  }

  // ─── Build the JSONB patch (only sections present in the input) ─────
  const sectionUpdate: {
    datos?: Json;
    anamnesis?: Json;
    habitos?: Json;
    diagnostico?: Json;
    plan?: Json;
  } = {};
  if (parsed.data.datos !== undefined)
    sectionUpdate.datos = parsed.data.datos as Json;
  if (parsed.data.anamnesis !== undefined)
    sectionUpdate.anamnesis = parsed.data.anamnesis as Json;
  if (parsed.data.habitos !== undefined)
    sectionUpdate.habitos = parsed.data.habitos as Json;
  if (parsed.data.diagnostico !== undefined)
    sectionUpdate.diagnostico = parsed.data.diagnostico as Json;
  if (parsed.data.plan !== undefined)
    sectionUpdate.plan = parsed.data.plan as Json;

  // ─── INSERT path (no row yet) ───────────────────────────────────────
  if (!existing) {
    const { data: inserted, error: insErr } = await supabase
      .from("evaluaciones")
      .insert({
        cliente_id: clienteId,
        // tenant_id, created_by, last_editor_id, version are all set by
        // BEFORE triggers — passing arbitrary values is harmless.
        tenant_id: session.profile.tenant_id ?? "",
        created_by: session.profile.id,
        last_editor_id: session.profile.id,
        ...sectionUpdate,
      })
      .select("id, version")
      .single();

    if (insErr) {
      return { success: false, message: mapPgError(insErr) };
    }
    revalidatePath(`${ROUTES.clientes}/${clienteId}`);
    return {
      success: true,
      data: { evaluacionId: inserted.id, version: inserted.version },
    };
  }

  // ─── UPDATE path with optional CAS check ────────────────────────────
  let query = supabase
    .from("evaluaciones")
    .update(sectionUpdate)
    .eq("id", existing.id);

  if (typeof expectedVersion === "number") {
    query = query.eq("version", expectedVersion);
  }

  const { data: updated, error: updErr } = await query
    .select("id, version")
    .maybeSingle();

  if (updErr) {
    return { success: false, message: mapPgError(updErr) };
  }

  // 0 rows updated when the version didn't match → conflict.
  if (!updated) {
    return {
      success: false,
      message:
        "Otro usuario actualizó esta evaluación antes que vos. Refrescá la página y reintentá.",
      errors: { version: ["conflict"] },
    };
  }

  revalidatePath(`${ROUTES.clientes}/${clienteId}`);
  return {
    success: true,
    data: { evaluacionId: updated.id, version: updated.version },
  };
}
