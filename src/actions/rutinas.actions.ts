"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import {
  sendRutinaAssignedEmail,
  sendShareInviteEmail,
} from "@/services/notifications.service";
import {
  blankToNull,
  upsertRutinaSchema,
  type RutinaStepInput,
} from "@/schemas/rutinas.schema";
import type { ActionState, InsertTables } from "@/types/supabase";

type RutinaInsert = InsertTables<"rutinas">;
type RutinaStepInsert = InsertTables<"rutina_steps">;
type ProductoInsert = InsertTables<"productos">;

const RUTINAS_PATH = "/rutinas";

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

/** Parse a JSON-serialised payload from the form (steps are too nested for
 *  per-field FormData; the builder posts a single `payload` json string). */
function parseUpsertPayload(raw: unknown) {
  return upsertRutinaSchema.safeParse(raw);
}

interface UpsertOptions {
  rutinaId?: string;
}

async function upsertRutina(
  payload: unknown,
  opts: UpsertOptions = {},
): Promise<ActionState<{ rutinaId: string }>> {
  const parsed = parseUpsertPayload(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: "Revisá los campos de la rutina.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  if (data.steps.length === 0) {
    return { success: false, message: "Agregá al menos un paso a la rutina." };
  }

  // Kind consistency
  if (data.kind === "assignment" && !data.clienteId) {
    return {
      success: false,
      message: "Tienes que elegir la clienta para asignar la rutina.",
    };
  }
  if (data.kind === "template" && data.clienteId) {
    return {
      success: false,
      message: "Una plantilla no puede tener cliente asignada.",
    };
  }

  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session) || !session.profile.tenant_id) {
    return { success: false, message: "No tienes permisos para guardar rutinas." };
  }

  const supabase = await createClient();
  const rutinaInsert: RutinaInsert = {
    tenant_id: session.profile.tenant_id,
    professional_id: session.profile.id,
    kind: data.kind,
    name: data.name,
    momento: data.momento,
    skin_type: blankToNull(data.skinType),
    skin_condition: blankToNull(data.skinCondition),
    main_objective: blankToNull(data.mainObjective),
    general_notes: blankToNull(data.generalNotes),
    tags: data.tags,
    cliente_id: data.kind === "assignment" ? (data.clienteId || null) : null,
    from_template_id: blankToNull(data.fromTemplateId),
    client_message: data.kind === "assignment" ? blankToNull(data.clientMessage) : null,
  };

  let rutinaId = opts.rutinaId ?? null;

  if (rutinaId) {
    // UPDATE rutina row.
    const { error: updErr } = await supabase
      .from("rutinas")
      .update({
        name: rutinaInsert.name,
        momento: rutinaInsert.momento,
        skin_type: rutinaInsert.skin_type,
        skin_condition: rutinaInsert.skin_condition,
        main_objective: rutinaInsert.main_objective,
        general_notes: rutinaInsert.general_notes,
        tags: rutinaInsert.tags,
        client_message: rutinaInsert.client_message,
      })
      .eq("id", rutinaId);
    if (updErr) return { success: false, message: updErr.message };

    // Diff the steps instead of delete-all-and-reinsert. The previous
    // "wipe everything, write it back" strategy fired the usage_count
    // trigger 2×N times per save, generating an UPDATE-productos storm
    // even when the user only renamed a field. Diff keeps the trigger
    // hits to the actually-added or actually-removed steps.
    const stepsErr = await diffSteps(supabase, rutinaId, data.steps);
    if (stepsErr) return { success: false, message: stepsErr };
  } else {
    // INSERT rutina row + all steps.
    const { data: created, error: insErr } = await supabase
      .from("rutinas")
      .insert(rutinaInsert)
      .select("id")
      .single();
    if (insErr || !created) {
      return {
        success: false,
        message: insErr?.message ?? "No se pudo crear la rutina.",
      };
    }
    rutinaId = created.id;

    const stepRows: RutinaStepInsert[] = data.steps.map((s, idx) =>
      stepToRow(s, rutinaId!, idx + 1),
    );
    const { error: stepsErr } = await supabase
      .from("rutina_steps")
      .insert(stepRows);
    if (stepsErr) return { success: false, message: stepsErr.message };
  }

  revalidatePath(RUTINAS_PATH);
  revalidatePath(`${RUTINAS_PATH}/${rutinaId}/editar`);
  if (data.kind === "assignment" && data.clienteId) {
    revalidatePath(`/clientes/${data.clienteId}`);
  }

  return {
    success: true,
    message: opts.rutinaId ? "Cambios guardados." : "Rutina guardada.",
    data: { rutinaId },
  };
}

function stepToRow(
  s: RutinaStepInput,
  rutinaId: string,
  order: number,
): RutinaStepInsert {
  return {
    rutina_id: rutinaId,
    producto_id: s.productoId,
    step_order: order,
    custom_instruction: blankToNull(s.customInstruction),
    custom_amount: blankToNull(s.customAmount),
    custom_absorption_time: blankToNull(s.customAbsorptionTime),
    custom_frequency: blankToNull(s.customFrequency),
    custom_time_of_day:
      blankToNull(s.customTimeOfDay) as RutinaStepInsert["custom_time_of_day"],
    notes: blankToNull(s.notes),
  };
}

/**
 * Sync the rutina's steps to match `incoming` without nuking everything:
 *   1. Delete rows whose id is missing from the incoming payload.
 *   2. Shift every remaining existing row to a negative step_order slot
 *      so the (rutina_id, step_order) unique constraint can't collide
 *      with the final updates that follow.
 *   3. Walk the incoming array: update each existing row to its final
 *      values, insert each new row.
 *
 * Why the negative-slot detour: the unique constraint is immediate, so
 * we can't directly `update step_order = 3` if some other row currently
 * has 3. Moving to negative-only space frees every positive slot.
 *
 * Returns an error message on failure or `null` on success.
 */
type SupabaseAny = Awaited<ReturnType<typeof createClient>>;

async function diffSteps(
  supabase: SupabaseAny,
  rutinaId: string,
  incoming: RutinaStepInput[],
): Promise<string | null> {
  const { data: existing, error: readErr } = await supabase
    .from("rutina_steps")
    .select("id, step_order")
    .eq("rutina_id", rutinaId);
  if (readErr) return readErr.message;
  const existingById = new Map(
    (existing ?? []).map((r) => [r.id, r.step_order]),
  );

  const incomingIds = new Set(
    incoming.filter((s) => s.id).map((s) => s.id),
  );

  // 1. Delete rows the user removed. Trigger drops usage_count for each.
  const toDelete = [...existingById.keys()].filter(
    (id) => !incomingIds.has(id),
  );
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("rutina_steps")
      .delete()
      .in("id", toDelete);
    if (delErr) return delErr.message;
  }

  // 2. Bump remaining rows out of the way so step_order updates can't
  //    collide with each other on the unique (rutina_id, step_order)
  //    constraint. Negative slots are safe because incoming uses 1..N.
  const remaining = [...existingById.keys()].filter((id) =>
    incomingIds.has(id),
  );
  for (let i = 0; i < remaining.length; i++) {
    const { error: bumpErr } = await supabase
      .from("rutina_steps")
      .update({ step_order: -(i + 1) })
      .eq("id", remaining[i]!);
    if (bumpErr) return bumpErr.message;
  }

  // 3. Apply the incoming list. Update existing rows in place (no
  //    trigger fire), insert new rows (one trigger each).
  const inserts: RutinaStepInsert[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const step = incoming[i]!;
    const order = i + 1;
    if (step.id && existingById.has(step.id)) {
      const row = stepToRow(step, rutinaId, order);
      // rutina_id stays the same; skip it from the update payload.
      const { rutina_id: _omit, ...updateCols } = row;
      const { error: updErr } = await supabase
        .from("rutina_steps")
        .update(updateCols)
        .eq("id", step.id);
      if (updErr) return updErr.message;
    } else {
      inserts.push(stepToRow(step, rutinaId, order));
    }
  }
  if (inserts.length > 0) {
    const { error: insErr } = await supabase
      .from("rutina_steps")
      .insert(inserts);
    if (insErr) return insErr.message;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

export async function createRutinaAction(
  payload: unknown,
): Promise<ActionState<{ rutinaId: string }>> {
  return upsertRutina(payload);
}

export async function updateRutinaAction(
  rutinaId: string,
  payload: unknown,
): Promise<ActionState<{ rutinaId: string }>> {
  return upsertRutina(payload, { rutinaId });
}

// ---------------------------------------------------------------------------
// Duplicate template
// ---------------------------------------------------------------------------

export async function duplicateRutinaAction(
  rutinaId: string,
): Promise<ActionState<{ rutinaId: string }>> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session) || !session.profile.tenant_id) {
    return { success: false, message: "No tienes permisos para duplicar." };
  }

  const supabase = await createClient();
  const { data: src, error: readErr } = await supabase
    .from("rutinas")
    .select("*, rutina_steps(*)")
    .eq("id", rutinaId)
    .maybeSingle();
  if (readErr || !src) {
    return { success: false, message: "Rutina no encontrada." };
  }

  const { data: created, error: insErr } = await supabase
    .from("rutinas")
    .insert({
      tenant_id: session.profile.tenant_id,
      professional_id: session.profile.id,
      kind: "template" as const, // duplicates always go to the library
      name: `${src.name} (copia)`,
      momento: src.momento,
      skin_type: src.skin_type,
      skin_condition: src.skin_condition,
      main_objective: src.main_objective,
      general_notes: src.general_notes,
      tags: src.tags,
      from_template_id: src.kind === "template" ? src.id : src.from_template_id,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    return {
      success: false,
      message: insErr?.message ?? "No se pudo duplicar.",
    };
  }

  const sourceSteps = (src.rutina_steps ?? []) as Array<{
    producto_id: string;
    step_order: number;
    custom_instruction: string | null;
    custom_amount: string | null;
    custom_absorption_time: string | null;
    custom_frequency: string | null;
    custom_time_of_day: "am" | "pm" | "both" | null;
    notes: string | null;
  }>;

  if (sourceSteps.length > 0) {
    const ordered = sourceSteps
      .slice()
      .sort((a, b) => a.step_order - b.step_order);
    const rows: RutinaStepInsert[] = ordered.map((s, idx) => ({
      rutina_id: created.id,
      producto_id: s.producto_id,
      step_order: idx + 1,
      custom_instruction: s.custom_instruction,
      custom_amount: s.custom_amount,
      custom_absorption_time: s.custom_absorption_time,
      custom_frequency: s.custom_frequency,
      custom_time_of_day: s.custom_time_of_day,
      notes: s.notes,
    }));
    const { error: stepsErr } = await supabase
      .from("rutina_steps")
      .insert(rows);
    if (stepsErr) return { success: false, message: stepsErr.message };
  }

  revalidatePath(RUTINAS_PATH);
  return {
    success: true,
    message: "Rutina duplicada.",
    data: { rutinaId: created.id },
  };
}

// ---------------------------------------------------------------------------
// Archive (soft delete)
// ---------------------------------------------------------------------------

export async function archiveRutinaAction(
  rutinaId: string,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session)) {
    return { success: false, message: "No tienes permisos para eliminar." };
  }

  const supabase = await createClient();
  // We need cliente_id for the revalidate path before the trigger ripples.
  const { data: row } = await supabase
    .from("rutinas")
    .select("cliente_id")
    .eq("id", rutinaId)
    .maybeSingle();

  // Clear share_token on archive so /rutinas/share/<token> can never
  // resolve a deleted rutina. Re-archiving (un-archive → re-archive) will
  // mint a fresh token if the user wants one again.
  const { error } = await supabase
    .from("rutinas")
    .update({
      archived_at: new Date().toISOString(),
      share_token: null,
    })
    .eq("id", rutinaId);
  if (error) return { success: false, message: error.message };

  revalidatePath(RUTINAS_PATH);
  if (row?.cliente_id) revalidatePath(`/clientes/${row.cliente_id}`);
  return { success: true, message: "Rutina eliminada." };
}

// ---------------------------------------------------------------------------
// Assign a template to a clienta — clones the template into an
// `assignment` rutina + steps.
// ---------------------------------------------------------------------------

export async function assignRutinaToClienteAction(
  templateId: string,
  clienteId: string,
  message?: string,
): Promise<ActionState<{ rutinaId: string; emailSent: boolean }>> {
  if (!templateId || !clienteId) {
    return {
      success: false,
      message: "Faltan datos para asignar.",
    };
  }

  const session = await getCurrentSession();
  if (!session) return { success: false, message: "Inicia sesión para continuar." };
  if (!canEdit(session) || !session.profile.tenant_id) {
    return { success: false, message: "No tienes permisos para asignar rutinas." };
  }

  const supabase = await createClient();

  const { data: tpl, error: readErr } = await supabase
    .from("rutinas")
    .select("*, rutina_steps(*)")
    .eq("id", templateId)
    .eq("kind", "template")
    .maybeSingle();
  if (readErr || !tpl) {
    return { success: false, message: "Plantilla no encontrada." };
  }

  // Sanity: the clienta must belong to the caller's tenant. RLS would
  // already block the insert, but pre-checking gives a clearer message.
  // We also pick up the clienta's profile + email here so we can send
  // the notification at the end of the action.
  const { data: cliente, error: cliErr } = await supabase
    .from("clientes")
    .select("id, profile:profiles!inner(full_name, email)")
    .eq("id", clienteId)
    .maybeSingle();
  if (cliErr || !cliente) {
    return { success: false, message: "Clienta no encontrada en tu tenant." };
  }

  const { data: created, error: insErr } = await supabase
    .from("rutinas")
    .insert({
      tenant_id: session.profile.tenant_id,
      professional_id: session.profile.id,
      kind: "assignment" as const,
      name: tpl.name,
      momento: tpl.momento,
      skin_type: tpl.skin_type,
      skin_condition: tpl.skin_condition,
      main_objective: tpl.main_objective,
      general_notes: tpl.general_notes,
      tags: tpl.tags,
      cliente_id: clienteId,
      from_template_id: templateId,
      client_message: blankToNull(message ?? null),
    })
    .select("id")
    .single();
  if (insErr || !created) {
    return {
      success: false,
      message: insErr?.message ?? "No se pudo asignar la rutina.",
    };
  }

  const sourceSteps = (tpl.rutina_steps ?? []) as Array<{
    producto_id: string;
    step_order: number;
    custom_instruction: string | null;
    custom_amount: string | null;
    custom_absorption_time: string | null;
    custom_frequency: string | null;
    custom_time_of_day: "am" | "pm" | "both" | null;
    notes: string | null;
  }>;

  if (sourceSteps.length > 0) {
    const ordered = sourceSteps
      .slice()
      .sort((a, b) => a.step_order - b.step_order);
    const rows: RutinaStepInsert[] = ordered.map((s, idx) => ({
      rutina_id: created.id,
      producto_id: s.producto_id,
      step_order: idx + 1,
      custom_instruction: s.custom_instruction,
      custom_amount: s.custom_amount,
      custom_absorption_time: s.custom_absorption_time,
      custom_frequency: s.custom_frequency,
      custom_time_of_day: s.custom_time_of_day,
      notes: s.notes,
    }));
    const { error: stepsErr } = await supabase
      .from("rutina_steps")
      .insert(rows);
    if (stepsErr) return { success: false, message: stepsErr.message };
  }

  revalidatePath(RUTINAS_PATH);
  revalidatePath(`/clientes/${clienteId}`);

  // Notify the clienta — non-blocking. If she has no email on file we
  // skip; if Resend fails, we surface it in `data.emailSent` and let the
  // UI tell the user, but we DON'T roll back the assignment (the
  // profesional already pressed "Asignar" with intent — losing the email
  // shouldn't lose the assignment).
  const clienteProfile = Array.isArray(cliente.profile)
    ? cliente.profile[0]
    : cliente.profile;
  const clienteEmail = clienteProfile?.email?.trim();
  let emailSent = false;
  if (clienteEmail) {
    const result = await sendRutinaAssignedEmail({
      tenantId: session.profile.tenant_id,
      recipientEmail: clienteEmail,
      clienteName: clienteProfile.full_name ?? "Clienta",
      profesionalName: session.profile.full_name ?? "Tu profesional",
      rutinaName: tpl.name,
      message: blankToNull(message ?? null),
    });
    emailSent = result.ok;
  }

  return {
    success: true,
    message: clienteEmail
      ? emailSent
        ? "Rutina asignada — le avisamos por email."
        : "Rutina asignada. No pudimos enviar el email."
      : "Rutina asignada. La clienta no tiene email registrado.",
    data: { rutinaId: created.id, emailSent },
  };
}

// ---------------------------------------------------------------------------
// Share token — generate/revoke a token for cross-professional sharing
// ---------------------------------------------------------------------------

/** Build the canonical share URL server-side so we don't trust the
 *  browser's `window.location.origin` (which leaks preview hosts and
 *  localhost into copied / emailed links). */
function buildShareUrl(token: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}${ROUTES.rutinas}/share/${token}`;
}

export async function generateShareTokenAction(
  rutinaId: string,
): Promise<ActionState<{ shareToken: string; shareUrl: string }>> {
  // Shared surface requires an active membership AND restricts to
  // profesionales (asistentes can't generate links — the receiver-side
  // gate blocks them anyway, and we want the policy consistent).
  const guard = await requireActiveProfesional();
  if (!guard.ok) return { success: false, message: guard.message };

  const supabase = await createClient();
  // Only allow tokens on templates. Assignments hold private clienta data.
  const { data: row, error: readErr } = await supabase
    .from("rutinas")
    .select("kind, share_token")
    .eq("id", rutinaId)
    .maybeSingle();
  if (readErr || !row) {
    return { success: false, message: "Rutina no encontrada." };
  }
  if (row.kind !== "template") {
    return {
      success: false,
      message: "Solo las plantillas de la biblioteca pueden compartirse.",
    };
  }

  if (row.share_token) {
    return {
      success: true,
      message: "Link existente reutilizado.",
      data: { shareToken: row.share_token, shareUrl: buildShareUrl(row.share_token) },
    };
  }

  const token = randomUUID().replace(/-/g, "");
  const { error: updErr } = await supabase
    .from("rutinas")
    .update({ share_token: token })
    .eq("id", rutinaId);
  if (updErr) return { success: false, message: updErr.message };

  revalidatePath(RUTINAS_PATH);
  return {
    success: true,
    message: "Link de compartir generado.",
    data: { shareToken: token, shareUrl: buildShareUrl(token) },
  };
}

/**
 * Email the share link to another professional. Tiny Zod validation on
 * the email shape; the heavy lifting lives in the notifications service
 * which writes a `notification_events` audit row for every send.
 *
 * The action does NOT auto-mint a token — caller must have already
 * generated one via `generateShareTokenAction` and pass the rutina id.
 * Keeps the surface obvious: "generate" creates the token, "email"
 * sends it.
 */
export async function sendShareInviteAction(
  rutinaId: string,
  recipientEmail: string,
): Promise<ActionState<{ providerId?: string }>> {
  const guard = await requireActiveProfesional();
  if (!guard.ok) return { success: false, message: guard.message };
  const { session, tenantId } = guard;

  // Light email validation — full RFC compliance not needed; we just
  // want to reject obvious garbage before calling Resend.
  const email = recipientEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Email inválido." };
  }

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("rutinas")
    .select("name, kind, share_token")
    .eq("id", rutinaId)
    .maybeSingle();
  if (readErr || !row) {
    return { success: false, message: "Rutina no encontrada." };
  }
  if (row.kind !== "template") {
    return {
      success: false,
      message: "Solo las plantillas pueden compartirse.",
    };
  }
  if (!row.share_token) {
    return {
      success: false,
      message: "Generá el link primero antes de enviarlo.",
    };
  }

  const result = await sendShareInviteEmail({
    tenantId,
    recipientEmail: email,
    rutinaName: row.name,
    senderName: session.profile.full_name ?? "Una profesional",
    shareUrl: buildShareUrl(row.share_token),
  });

  if (!result.ok) {
    return {
      success: false,
      message: result.error ?? "No se pudo enviar el email.",
    };
  }
  return {
    success: true,
    message: `Link enviado a ${email}.`,
    data: { providerId: result.providerId },
  };
}

export async function revokeShareTokenAction(
  rutinaId: string,
): Promise<ActionState> {
  // Same gate as generate — keeps the lifecycle symmetric.
  const guard = await requireActiveProfesional();
  if (!guard.ok) return { success: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rutinas")
    .update({ share_token: null })
    .eq("id", rutinaId);
  if (error) return { success: false, message: error.message };
  revalidatePath(RUTINAS_PATH);
  return { success: true, message: "Link revocado." };
}

// ---------------------------------------------------------------------------
// Share import — clone a shared template into the caller's tenant
// ---------------------------------------------------------------------------

/** Analyze result returned to the share viewer so the client knows what
 *  to render in the import dialog (existing match count + list of
 *  productos that would need to be imported). */
export interface ShareImportAnalysis {
  rutinaName: string;
  /** Total source steps. */
  totalSteps: number;
  /** Steps whose producto already exists (by name+brand match) in the
   *  caller's catalog. */
  existingCount: number;
  /** Productos referenced by the source rutina that the caller doesn't
   *  have in their catalog. Importing them is the only way to keep those
   *  steps when cloning. */
  missingProductos: Array<{
    sourceId: string;
    name: string;
    brand: string | null;
    category: string;
  }>;
  /** True when the rutina already belongs to the caller's tenant — the
   *  UI swaps the "Importar" CTA for an "Abrir en la biblioteca" link. */
  alreadyOwned: boolean;
}

/**
 * Normalised match key for producto reconciliation during share import.
 * Targets the common "same product, different formatting" cases:
 *   · case + whitespace differences
 *   · parenthetical extras  ("(unscented)", "(50ml)")
 *   · volume suffixes       ("16oz", "50 ml", "30mL")
 *   · diacritics             ("sérum" vs "serum")
 *   · brand omitted on one side
 *
 * Deliberately conservative — we'd rather match too few (and ask the
 * receiver to import the producto) than too many (and silently link a
 * step to the wrong producto).
 */
function normalisePart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/\([^)]*\)/g, " ") // drop parenthetical content
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ml|oz|gr?|kg|l)\b/g, " ") // volume suffixes
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchKey(name: string, brand: string | null): string {
  return `${normalisePart(name)}|${normalisePart(brand ?? "")}`;
}

/** Allowed-roles + active-membership guard shared by analyze + import. */
async function requireActiveProfesional(): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>; tenantId: string }
  | { ok: false; message: string }
> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Inicia sesión para continuar." };
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "super_admin"
  ) {
    return { ok: false, message: "Solo profesionales pueden importar." };
  }
  if (session.profile.role !== "super_admin") {
    const status = session.tenant?.subscription_status ?? null;
    if (status !== "active" && status !== "trialing") {
      return { ok: false, message: "Necesitas una membresía activa." };
    }
  }
  if (!session.profile.tenant_id && session.profile.role !== "super_admin") {
    return { ok: false, message: "Sin tenant asociado." };
  }
  return {
    ok: true,
    session,
    tenantId: session.profile.tenant_id ?? "",
  };
}

export async function analyzeShareImport(
  token: string,
): Promise<ActionState<ShareImportAnalysis>> {
  const guard = await requireActiveProfesional();
  if (!guard.ok) return { success: false, message: guard.message };
  const { session, tenantId } = guard;

  const admin = createAdminClient();
  const { data: source, error: srcErr } = await admin
    .from("rutinas")
    .select(
      "id, name, tenant_id, rutina_steps(producto_id, productos(name, brand, category))",
    )
    .eq("share_token", token)
    .eq("kind", "template")
    .is("archived_at", null)
    .maybeSingle();
  if (srcErr) return { success: false, message: srcErr.message };
  if (!source) return { success: false, message: "Plantilla no encontrada." };

  // Same-tenant case: the receiver already owns this rutina. Don't
  // double-create — the UI surfaces an "open in library" path instead.
  if (source.tenant_id === tenantId) {
    return {
      success: true,
      data: {
        rutinaName: source.name,
        totalSteps: (source.rutina_steps ?? []).length,
        existingCount: 0,
        missingProductos: [],
        alreadyOwned: true,
      },
    };
  }

  // Receiver's catalog (RLS-scoped via the user-bound client) — match by
  // case-insensitive name + brand.
  const supabase = await createClient();
  const { data: localProductos } = await supabase
    .from("productos")
    .select("id, name, brand")
    .is("archived_at", null);
  const localByKey = new Map<string, string>();
  for (const p of localProductos ?? []) {
    localByKey.set(matchKey(p.name, p.brand), p.id);
  }

  type SourceStepRow = {
    producto_id: string;
    productos:
      | { name: string; brand: string | null; category: string }
      | { name: string; brand: string | null; category: string }[]
      | null;
  };
  const sourceSteps = (source.rutina_steps ?? []) as SourceStepRow[];

  let existingCount = 0;
  const missingMap = new Map<
    string,
    { name: string; brand: string | null; category: string }
  >();
  for (const step of sourceSteps) {
    const prod = Array.isArray(step.productos)
      ? step.productos[0] ?? null
      : step.productos;
    if (!prod) continue;
    const key = matchKey(prod.name, prod.brand);
    if (localByKey.has(key)) {
      existingCount++;
    } else if (!missingMap.has(step.producto_id)) {
      missingMap.set(step.producto_id, prod);
    }
  }

  void session;
  return {
    success: true,
    data: {
      rutinaName: source.name,
      totalSteps: sourceSteps.length,
      existingCount,
      missingProductos: Array.from(missingMap.entries()).map(
        ([sourceId, p]) => ({
          sourceId,
          name: p.name,
          brand: p.brand,
          category: p.category,
        }),
      ),
      alreadyOwned: false,
    },
  };
}

interface ImportShareOptions {
  /** When true, also clone any producto missing from the receiver's
   *  catalog so every source step survives. When false, those steps are
   *  silently dropped from the new rutina. */
  includeMissing: boolean;
}

export async function importShareRutinaAction(
  token: string,
  opts: ImportShareOptions,
): Promise<ActionState<{ rutinaId: string; importedProductos: number }>> {
  const guard = await requireActiveProfesional();
  if (!guard.ok) return { success: false, message: guard.message };
  const { session, tenantId } = guard;

  const admin = createAdminClient();
  // Fetch source rutina + steps (with safe producto projection). Admin
  // client because the source typically lives in a different tenant.
  const { data: source, error: srcErr } = await admin
    .from("rutinas")
    .select(
      "id, name, momento, skin_type, skin_condition, main_objective, general_notes, tags, tenant_id, rutina_steps(*, productos(id, name, brand, category, main_ingredients, skin_types, custom_skin_types, application_instruction, suggested_amount, absorption_time, frequency, time_of_day, additional_tags))",
    )
    .eq("share_token", token)
    .eq("kind", "template")
    .is("archived_at", null)
    .maybeSingle();
  if (srcErr) return { success: false, message: srcErr.message };
  if (!source) return { success: false, message: "Plantilla no encontrada." };
  if (source.tenant_id === tenantId) {
    return {
      success: false,
      message: "Esta rutina ya pertenece a tu biblioteca.",
    };
  }

  const supabase = await createClient();

  // Build the producto-id remap: source.producto_id → receiver's catalog id.
  const { data: localProductos } = await supabase
    .from("productos")
    .select("id, name, brand")
    .is("archived_at", null);
  const localByKey = new Map<string, string>();
  for (const p of localProductos ?? []) {
    localByKey.set(matchKey(p.name, p.brand), p.id);
  }

  type ProductoEmbed = {
    id: string;
    name: string;
    brand: string | null;
    category: ProductoInsert["category"];
    main_ingredients: string[] | null;
    skin_types: string[] | null;
    custom_skin_types: string[] | null;
    application_instruction: string | null;
    suggested_amount: string | null;
    absorption_time: string | null;
    frequency: string | null;
    time_of_day: ProductoInsert["time_of_day"];
    additional_tags: string[] | null;
  };
  type SourceStep = {
    producto_id: string;
    step_order: number;
    custom_instruction: string | null;
    custom_amount: string | null;
    custom_absorption_time: string | null;
    custom_frequency: string | null;
    custom_time_of_day: RutinaStepInsert["custom_time_of_day"];
    notes: string | null;
    productos: ProductoEmbed | ProductoEmbed[] | null;
  };
  const sourceSteps = (source.rutina_steps ?? []) as SourceStep[];

  const productoIdMap = new Map<string, string>();
  const missingDetails = new Map<string, ProductoEmbed>();
  for (const step of sourceSteps) {
    const prod = Array.isArray(step.productos)
      ? step.productos[0] ?? null
      : step.productos;
    if (!prod) continue;
    const key = matchKey(prod.name, prod.brand);
    const localId = localByKey.get(key);
    if (localId) {
      productoIdMap.set(step.producto_id, localId);
    } else if (!missingDetails.has(step.producto_id)) {
      missingDetails.set(step.producto_id, prod);
    }
  }

  // Clone missing productos when the receiver opted in. Photos aren't
  // copied — storage paths point at the source tenant's bucket and the
  // receiver has no RLS to read them. The user can re-upload after
  // import if they want the visuals.
  let importedProductos = 0;
  if (opts.includeMissing && missingDetails.size > 0) {
    const rows: ProductoInsert[] = Array.from(missingDetails.values()).map(
      (p) => ({
        tenant_id: tenantId,
        professional_id: session.profile.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        main_ingredients: p.main_ingredients ?? [],
        skin_types: p.skin_types ?? [],
        custom_skin_types: p.custom_skin_types ?? [],
        application_instruction: p.application_instruction,
        suggested_amount: p.suggested_amount,
        absorption_time: p.absorption_time,
        frequency: p.frequency,
        time_of_day: p.time_of_day,
        additional_tags: p.additional_tags ?? [],
        // Flag so the receiver's catalog UI can badge these productos as
        // "vinieron de una rutina compartida". Clinical fields + photo
        // are missing, so the badge prompts a review.
        imported_from_share: true,
      }),
    );
    const { data: createdProductos, error: pErr } = await supabase
      .from("productos")
      .insert(rows)
      .select("id, name, brand");
    if (pErr) return { success: false, message: pErr.message };
    // Map each created row back to its source id by name+brand.
    const createdByKey = new Map(
      (createdProductos ?? []).map((p) => [
        matchKey(p.name, p.brand),
        p.id,
      ]),
    );
    for (const [srcId, p] of missingDetails) {
      const newId = createdByKey.get(matchKey(p.name, p.brand));
      if (newId) productoIdMap.set(srcId, newId);
    }
    importedProductos = createdProductos?.length ?? 0;
  }

  // Drop steps whose producto we couldn't resolve.
  const ordered = sourceSteps
    .slice()
    .sort((a, b) => a.step_order - b.step_order)
    .filter((s) => productoIdMap.has(s.producto_id));
  if (ordered.length === 0) {
    return {
      success: false,
      message:
        "Ninguno de los productos de la rutina existe en tu catálogo. Vuelve a importar con la opción de copiar productos.",
    };
  }

  // Create the cloned rutina. The tenant_id trigger keys off
  // professional_id, so we don't set it directly.
  const { data: newRutina, error: rutErr } = await supabase
    .from("rutinas")
    .insert({
      tenant_id: tenantId,
      professional_id: session.profile.id,
      kind: "template" as const,
      name: `${source.name} (importada)`,
      momento: source.momento,
      skin_type: source.skin_type,
      skin_condition: source.skin_condition,
      main_objective: source.main_objective,
      general_notes: source.general_notes,
      tags: source.tags,
      from_template_id: source.id,
    })
    .select("id")
    .single();
  if (rutErr || !newRutina) {
    return {
      success: false,
      message: rutErr?.message ?? "No se pudo crear la rutina.",
    };
  }

  const stepInserts: RutinaStepInsert[] = ordered.map((s, idx) => ({
    rutina_id: newRutina.id,
    producto_id: productoIdMap.get(s.producto_id)!,
    step_order: idx + 1,
    custom_instruction: s.custom_instruction,
    custom_amount: s.custom_amount,
    custom_absorption_time: s.custom_absorption_time,
    custom_frequency: s.custom_frequency,
    custom_time_of_day: s.custom_time_of_day,
    notes: s.notes,
  }));
  const { error: stepsErr } = await supabase
    .from("rutina_steps")
    .insert(stepInserts);
  if (stepsErr) return { success: false, message: stepsErr.message };

  // Audit the import. Non-blocking — if this fails we still keep the
  // rutina (the user got what they wanted; the missing audit row is on
  // us, not on them). Logs only enough to answer "who imported what"
  // analytics later — no clinical data.
  await supabase.from("routine_imports").insert({
    source_rutina_id: source.id,
    source_tenant_id: source.tenant_id,
    target_rutina_id: newRutina.id,
    target_tenant_id: tenantId,
    target_professional_id: session.profile.id,
    included_missing: opts.includeMissing,
    missing_producto_count: missingDetails.size,
    imported_productos: importedProductos,
  });

  revalidatePath(RUTINAS_PATH);
  return {
    success: true,
    message:
      importedProductos > 0
        ? `Rutina importada (+${importedProductos} productos nuevos).`
        : "Rutina importada.",
    data: { rutinaId: newRutina.id, importedProductos },
  };
}
