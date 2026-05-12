import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

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
import type { ServiceType } from "@/schemas/servicios.schema";

export type { PaymentPlanSummary, PaymentTransaction };

type DB = SupabaseClient<Database>;
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

// ─── Global ledger (Pagos module) ───────────────────────────────────────────
//
// The /pagos page is a tenant-wide payment ledger — every transaction
// across every clienta + servicio. We join cliente, servicio and the
// associated plan in a single nested select; RLS scopes the rows to the
// caller's tenant on the parent `payment_transactions` query.

export interface PaymentListRow {
  id: string;
  paidAt: string;
  amount: number;
  method: PaymentMethod;
  concept: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when the transaction was voided, or null while live. */
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: string | null;
  cliente: { id: string; fullName: string };
  servicio: { id: string; name: string; serviceType: ServiceType } | null;
  /** Linked session (e.g. "abonó la sesión 3"). Null for plan-level payments. */
  sesion: { id: string; sessionNumber: number } | null;
  plan: {
    id: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    status: PaymentStatus;
  } | null;
  registeredBy: string | null;
}

export type PaymentSortField = "paidAt" | "amount" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface ListPaymentsOptions {
  page: number;
  pageSize: number;
  search?: string;
  status?: PaymentStatus | null;
  method?: PaymentMethod | null;
  serviceType?: ServiceType | null;
  /** ISO YYYY-MM-DD, inclusive. */
  dateFrom?: string | null;
  /** ISO YYYY-MM-DD, inclusive. */
  dateTo?: string | null;
  sortBy?: PaymentSortField;
  sortDir?: SortDirection;
}

const SORT_COLUMN: Record<PaymentSortField, string> = {
  paidAt: "paid_at",
  amount: "amount",
  createdAt: "created_at",
};

/**
 * Server-paginated tenant-wide ledger. RLS scopes the parent select.
 * Status / service-type filters live on the joined `payment_plans` and
 * `servicios` rows respectively — we use `!inner` so the filter prunes
 * the parent set instead of just the embedded objects.
 *
 * Cliente search hits `profiles.full_name` via the nested join. We can't
 * `or` across foreign tables in a single query, so search is name-only
 * for v1 — email/phone search is a follow-up if profesionales ask.
 *
 * Voided rows are excluded from the global ledger by default. The
 * partial index `payment_tx_active_tenant_paid_idx` covers the predicate.
 *
 * `count: 'estimated'` reads from `pg_class.reltuples` so the count cost
 * stays sub-millisecond even as the table grows. Off by a few % is fine
 * for the pagination total — accuracy is not the contract here.
 */
export async function listPaymentTransactions(
  supabase: DB,
  options: ListPaymentsOptions,
): Promise<{ rows: PaymentListRow[]; total: number }> {
  const {
    page,
    pageSize,
    search,
    status,
    method,
    serviceType,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
  } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("payment_transactions")
    .select(
      `id, amount, method, paid_at, concept, notes, created_at, updated_at, created_by,
       voided_at, voided_by, void_reason,
       cliente:clientes!inner(
         id,
         profile:profiles!inner(full_name)
       ),
       servicio:servicios!inner(id, name, service_type),
       sesion:sesiones(id, session_number),
       plan:payment_plans!inner(id, total_amount, paid_amount, status),
       registrar:profiles!payment_transactions_created_by_fkey(full_name)`,
      { count: "estimated" },
    )
    .is("voided_at", null)
    .range(from, to);

  // Optional user-driven sort with a stable tiebreaker. Defaults to
  // (paid_at desc, created_at desc) when no sort is requested.
  const sortColumn = sortBy ? SORT_COLUMN[sortBy] : "paid_at";
  const ascending = sortDir === "asc";
  query = query
    .order(sortColumn, { ascending })
    .order("created_at", { ascending: false });

  if (method) query = query.eq("method", method);
  if (status) query = query.eq("plan.status", status);
  if (serviceType) query = query.eq("servicio.service_type", serviceType);
  if (dateFrom) query = query.gte("paid_at", dateFrom);
  if (dateTo) query = query.lte("paid_at", dateTo);

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    // Filter parent rows where the nested profile name matches. `!inner`
    // on the cliente→profile join above is what makes this a parent-row
    // filter rather than a nested-object filter.
    query = query.ilike("cliente.profile.full_name", term);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []).map(mapListRow),
    total: count ?? 0,
  };
}

/**
 * Single transaction with cliente + servicio + plan context for the
 * payment detail page.
 */
export const getPaymentTransactionById = cache(
  async (id: string): Promise<PaymentListRow | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_transactions")
      .select(
        `id, amount, method, paid_at, concept, notes, created_at, updated_at, created_by,
         voided_at, voided_by, void_reason,
         cliente:clientes!inner(
           id,
           profile:profiles!inner(full_name)
         ),
         servicio:servicios!inner(id, name, service_type),
         sesion:sesiones(id, session_number),
         plan:payment_plans!inner(id, total_amount, paid_amount, status),
         registrar:profiles!payment_transactions_created_by_fkey(full_name)`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapListRow(data);
  },
);

/**
 * Count of sesiones for a servicio split by completed vs total — used in
 * the payment detail to show "2 / 6 sesiones" progress. Two `head: true`
 * counts is one round-trip each; cheap enough at v1 volumes.
 */
export const getServicioSessionsProgress = cache(
  async (
    servicioId: string,
  ): Promise<{ completed: number; total: number }> => {
    const supabase = await createClient();
    const [{ count: total }, { count: completed }] = await Promise.all([
      supabase
        .from("sesiones")
        .select("id", { count: "exact", head: true })
        .eq("servicio_id", servicioId),
      supabase
        .from("sesiones")
        .select("id", { count: "exact", head: true })
        .eq("servicio_id", servicioId)
        .eq("status", "completed"),
    ]);
    return { completed: completed ?? 0, total: total ?? 0 };
  },
);

export interface PaymentsSummary {
  /** Sum of `amount` for transactions matching the active filters
   *  (defaults to the tenant-local current month). */
  windowIncome: number;
  /** Total outstanding balance across active payment plans. Always
   *  global — independent of the table filters. */
  pendingBalance: number;
  /** Count of transactions matching the active filters. */
  windowCount: number;
  /** Most-used payment method inside the filtered window. */
  topMethod: PaymentMethod | null;
  /** Echoes back the window the summary describes so the UI can render
   *  a "Este mes" / "Rango filtrado" label. */
  windowLabel: "month" | "filtered";
}

/**
 * KPI rollup that respects the active filters.
 *
 * When the page is unfiltered (no date range, no method/status/serviceType),
 * the summary defaults to the tenant-local current month. The moment the
 * user applies any filter, the rollup follows — otherwise the cards
 * silently disagree with the table.
 *
 * Pending balance always comes from `payment_plans_pending_balance`, a
 * `security_invoker=true` view that aggregates server-side. RLS scopes
 * the view to the caller's tenant. One row, no client-side sum.
 */
export const getPaymentsSummary = cache(
  async (
    options: Omit<ListPaymentsOptions, "page" | "pageSize"> = {},
  ): Promise<PaymentsSummary> => {
    const supabase = await createClient();

    const hasFilters =
      Boolean(options.dateFrom) ||
      Boolean(options.dateTo) ||
      Boolean(options.method) ||
      Boolean(options.status) ||
      Boolean(options.serviceType) ||
      Boolean(options.search?.trim());

    const { start, end } = currentMonthBoundsAR();

    // Single SELECT shape for both branches (the joins are cheap thanks to
    // FK indexes and unused embeds don't hurt). Keeps the SDK's type
    // parser happy — a conditional literal blew it up.
    const TX_SELECT =
      "amount, method, " +
      "plan:payment_plans!inner(status), " +
      "servicio:servicios!inner(service_type), " +
      "cliente:clientes!inner(profile:profiles!inner(full_name))";

    let txQuery = supabase
      .from("payment_transactions")
      .select(TX_SELECT)
      .is("voided_at", null);

    if (hasFilters) {
      if (options.dateFrom) txQuery = txQuery.gte("paid_at", options.dateFrom);
      if (options.dateTo) txQuery = txQuery.lte("paid_at", options.dateTo);
      if (options.method) txQuery = txQuery.eq("method", options.method);
      if (options.status) txQuery = txQuery.eq("plan.status", options.status);
      if (options.serviceType) {
        txQuery = txQuery.eq("servicio.service_type", options.serviceType);
      }
      if (options.search?.trim()) {
        txQuery = txQuery.ilike(
          "cliente.profile.full_name",
          `%${options.search.trim()}%`,
        );
      }
    } else {
      txQuery = txQuery.gte("paid_at", start).lt("paid_at", end);
    }

    const [{ data: txData, error: txErr }, { data: viewData, error: viewErr }] =
      await Promise.all([
        txQuery,
        supabase
          .from("payment_plans_pending_balance")
          .select("pending_balance")
          .maybeSingle(),
      ]);

    if (txErr) throw new Error(txErr.message);
    if (viewErr) throw new Error(viewErr.message);

    const txRows = (txData ?? []) as unknown as Array<{
      amount: number | string;
      method: PaymentMethod;
    }>;
    const windowIncome = txRows.reduce((acc, r) => acc + Number(r.amount), 0);
    const windowCount = txRows.length;

    // Bucket methods to find the most-used in the window. Deterministic
    // tie-break: methods compared by enum order, so reloads return the
    // same value when two methods share the count.
    const methodCounts = new Map<PaymentMethod, number>();
    for (const r of txRows) {
      methodCounts.set(r.method, (methodCounts.get(r.method) ?? 0) + 1);
    }
    let topMethod: PaymentMethod | null = null;
    let topCount = 0;
    for (const [m, c] of methodCounts) {
      if (c > topCount) {
        topMethod = m;
        topCount = c;
      }
    }

    return {
      windowIncome,
      pendingBalance: Number(viewData?.pending_balance ?? 0),
      windowCount,
      topMethod,
      windowLabel: hasFilters ? "filtered" : "month",
    };
  },
);

// ─── List-row mapper ────────────────────────────────────────────────────────

type ListJoinRow = {
  id: string;
  amount: number | string;
  method: PaymentMethod;
  paid_at: string;
  concept: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  cliente: {
    id: string;
    profile: { full_name: string | null } | { full_name: string | null }[] | null;
  } | null;
  servicio: {
    id: string;
    name: string;
    service_type: ServiceType;
  } | null;
  sesion:
    | { id: string; session_number: number }
    | { id: string; session_number: number }[]
    | null;
  plan: {
    id: string;
    total_amount: number | string;
    paid_amount: number | string;
    status: PaymentStatus;
  } | null;
  registrar:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
};

function unwrap<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapListRow(raw: unknown): PaymentListRow {
  const row = raw as ListJoinRow;
  const profile = unwrap(row.cliente?.profile ?? null);
  const registrar = unwrap(row.registrar);
  const sesion = unwrap(row.sesion);
  const total = row.plan ? Number(row.plan.total_amount) : 0;
  const paid = row.plan ? Number(row.plan.paid_amount) : 0;
  return {
    id: row.id,
    paidAt: row.paid_at,
    amount: Number(row.amount),
    method: row.method,
    concept: row.concept ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    cliente: {
      id: row.cliente?.id ?? "",
      fullName: profile?.full_name ?? "Clienta",
    },
    servicio: row.servicio
      ? {
          id: row.servicio.id,
          name: row.servicio.name,
          serviceType: row.servicio.service_type,
        }
      : null,
    sesion: sesion
      ? { id: sesion.id, sessionNumber: sesion.session_number }
      : null,
    plan: row.plan
      ? {
          id: row.plan.id,
          totalAmount: total,
          paidAmount: paid,
          balance: Math.max(0, total - paid),
          status: row.plan.status,
        }
      : null,
    registeredBy: registrar?.full_name ?? null,
  };
}

/** Tenant-local current-month boundary as `YYYY-MM-DD` strings, end-exclusive.
 *  Hardcoded to AR for v1 to stay aligned with dashboard.service. */
function currentMonthBoundsAR(): { start: string; end: string } {
  const tz = "America/Argentina/Buenos_Aires";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m] = today.split("-").map(Number) as [number, number];
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { start, end };
}
