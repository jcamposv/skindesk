import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type {
  PaymentMethod,
  PaymentStatus,
} from "@/schemas/pagos.schema";
import type {
  PaymentPlanSummary,
  PaymentTransaction,
} from "@/components/clientes/pagos/types";

export type { PaymentPlanSummary, PaymentTransaction };

type PaymentPlanRow = Database["public"]["Tables"]["payment_plans"]["Row"];
type PaymentTransactionRow =
  Database["public"]["Tables"]["payment_transactions"]["Row"];

/**
 * Read every payment plan + its transactions for a clienta in two
 * round-trips. RLS scopes both selects to the caller's tenant. Wrapped in
 * `React.cache` so the page + tab share a single fetch per request.
 *
 * Returns a Map keyed by `servicioId` so the UI can do an O(1) lookup as
 * it renders each ServiceCard.
 */
export const getPaymentPlansForCliente = cache(
  async (clienteId: string): Promise<Map<string, PaymentPlanSummary>> => {
    const supabase = await createClient();

    const { data: plans, error: planErr } = await supabase
      .from("payment_plans")
      .select("*")
      .eq("cliente_id", clienteId);

    if (planErr) throw new Error(planErr.message);
    if (!plans || plans.length === 0) return new Map();

    const planIds = plans.map((p) => p.id);
    const { data: txs, error: txErr } = await supabase
      .from("payment_transactions")
      .select("*")
      .in("payment_plan_id", planIds)
      .order("paid_at", { ascending: false });

    if (txErr) throw new Error(txErr.message);

    const txByPlan = new Map<string, PaymentTransaction[]>();
    for (const row of txs ?? []) {
      const bucket = txByPlan.get(row.payment_plan_id) ?? [];
      bucket.push(rowToTransaction(row));
      txByPlan.set(row.payment_plan_id, bucket);
    }

    const out = new Map<string, PaymentPlanSummary>();
    for (const row of plans) {
      out.set(row.servicio_id, rowToPlan(row, txByPlan.get(row.id) ?? []));
    }
    return out;
  },
);

// ─── Mappers ────────────────────────────────────────────────────────────────

function rowToPlan(
  row: PaymentPlanRow,
  transactions: PaymentTransaction[],
): PaymentPlanSummary {
  const totalAmount = Number(row.total_amount);
  const paidAmount = Number(row.paid_amount);
  return {
    servicioId: row.servicio_id,
    planId: row.id,
    totalAmount,
    paidAmount,
    balance: Math.max(0, totalAmount - paidAmount),
    status: row.status as PaymentStatus,
    transactions,
  };
}

function rowToTransaction(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    paidAt: row.paid_at,
    concept: row.concept ?? "",
    notes: row.notes ?? "",
  };
}
