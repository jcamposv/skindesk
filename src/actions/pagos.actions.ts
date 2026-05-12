"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import {
  paymentRegisterSchema,
  type PaymentRegisterInput,
} from "@/schemas/pagos.schema";
import type { ActionState } from "@/types/supabase";

interface RegisterPaymentResult {
  transactionId: string;
  planId: string;
}

/**
 * Register a manual payment against a servicio's payment plan.
 *
 * The plan is looked up by `servicio_id` — it's auto-created by the
 * `servicios_create_payment_plan` trigger so every servicio always has a
 * 1:1 plan. RLS gates the lookup to the caller's tenant.
 *
 * The `payment_tx_recompute_plan` AFTER trigger handles the rollup
 * (`paid_amount` + `status`) — the action doesn't touch the plan row.
 *
 * Auth: profesional + super_admin write; asistente read-only.
 */
export async function registerPaymentAction(
  servicioId: string,
  input: PaymentRegisterInput,
): Promise<ActionState<RegisterPaymentResult>> {
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

  const parsed = paymentRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Payload inválido.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const supabase = await createClient();

  // Look up the plan for this servicio. RLS gates by tenant — if the row
  // is invisible the lookup returns null, treated as 404.
  const { data: plan, error: planErr } = await supabase
    .from("payment_plans")
    .select("id, cliente_id")
    .eq("servicio_id", servicioId)
    .maybeSingle();

  if (planErr) {
    return { success: false, message: mapPgError(planErr) };
  }
  if (!plan) {
    return {
      success: false,
      message: "El servicio no tiene un plan de pago. Recargá la página.",
    };
  }

  const { data: tx, error: txErr } = await supabase
    .from("payment_transactions")
    .insert({
      payment_plan_id: plan.id,
      // tenant_id + servicio_id + cliente_id are filled by the sync trigger.
      tenant_id: session.profile.tenant_id ?? "",
      servicio_id: servicioId,
      cliente_id: plan.cliente_id,
      amount: v.amount,
      method: v.method,
      paid_at: v.paidAt,
      concept: v.concept || null,
      notes: v.notes || null,
    })
    .select("id, payment_plan_id")
    .single();

  if (txErr || !tx) {
    return { success: false, message: mapPgError(txErr) };
  }

  revalidatePath(`${ROUTES.clientes}/${plan.cliente_id}`);
  // Also bust the profesional dashboard so "Ingresos del Mes" + revenue
  // chart pick up the new transaction without a manual hard refresh.
  revalidatePath("/profesional");
  return {
    success: true,
    data: { transactionId: tx.id, planId: tx.payment_plan_id },
  };
}

/**
 * Delete a manual payment. The recompute trigger reflects the change on
 * the plan's rollup automatically. RLS scopes the delete to the tenant.
 */
export async function deletePaymentAction(
  transactionId: string,
): Promise<ActionState<{ id: string }>> {
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

  const supabase = await createClient();

  // Read to grab cliente_id for the revalidate path.
  const { data: row, error: readErr } = await supabase
    .from("payment_transactions")
    .select("id, cliente_id")
    .eq("id", transactionId)
    .maybeSingle();

  if (readErr) {
    return { success: false, message: mapPgError(readErr) };
  }
  if (!row) {
    return { success: false, message: "Pago no encontrado." };
  }

  const { error: delErr } = await supabase
    .from("payment_transactions")
    .delete()
    .eq("id", transactionId);

  if (delErr) {
    return { success: false, message: mapPgError(delErr) };
  }

  revalidatePath(`${ROUTES.clientes}/${row.cliente_id}`);
  revalidatePath("/profesional");
  return { success: true, data: { id: transactionId } };
}
