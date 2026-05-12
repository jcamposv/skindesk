import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { unwrapNested } from "@/lib/supabase/select-helpers";

/**
 * Server-side aggregators for the profesional dashboard.
 *
 * All reads are RLS-scoped to the caller's tenant — no explicit tenant_id
 * filter is needed in the queries. Each function is wrapped in
 * `React.cache` so multiple components in the same render tree share one
 * roundtrip.
 *
 * For the monthly aggregations we fetch raw rows in the window and bucket
 * in JS instead of using a Postgres function — volumes are well within
 * what fits in one round-trip at v1 scale.
 */

// ─── Shared helpers ─────────────────────────────────────────────────────────

const MONTH_LABEL = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

// Tenant-local timezone for "this month" boundaries. Server `new Date()`
// is UTC; for an AR profesional a payment registered at 22:00 local on
// Mayo 31 would otherwise land in Junio's bucket. Hardcoded for v1; move
// to `tenants.timezone` when multi-region is on the roadmap.
const TENANT_TIMEZONE = "America/Argentina/Buenos_Aires";

/** Today's date in the tenant's timezone as `YYYY-MM-DD`. Uses `en-CA`
 *  locale because it formats dates in ISO 8601 by convention. */
function isoTodayInTenantTz(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TENANT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Returns the first-of-month date string for the month that is
 *  `monthsBack` months before the tenant-local current month. 0 = current. */
function firstOfMonthStr(monthsBack: number): string {
  const today = isoTodayInTenantTz(); // "YYYY-MM-DD"
  const [y, m] = today.split("-").map(Number) as [number, number];
  const month0 = m - 1 - monthsBack;
  // Normalise across year boundaries.
  const year = y + Math.floor(month0 / 12);
  const normalisedMonth0 = ((month0 % 12) + 12) % 12;
  return `${year}-${String(normalisedMonth0 + 1).padStart(2, "0")}-01`;
}

// ─── Stat: clientes activos ─────────────────────────────────────────────────

/** Count of clientes in the caller's tenant. RLS filters automatically.
 *  `count: 'estimated'` reads from `pg_class.reltuples` instead of doing a
 *  sequential count — orders of magnitude faster on large tables, and a
 *  ±5% margin is fine for a stat tile. */
export const getActiveClientesCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("clientes")
    .select("id", { count: "estimated", head: true });
  if (error) {
    console.warn("[dashboard] getActiveClientesCount:", error.message);
    return 0;
  }
  return count ?? 0;
});

// ─── Stat: ingresos del mes ─────────────────────────────────────────────────

/** Sum of payment_transactions.amount for the tenant-local current month. */
export const getMonthlyRevenue = cache(async (): Promise<number> => {
  const monthStart = firstOfMonthStr(0); // first of current month
  const monthEnd = firstOfMonthStr(-1); // first of next month

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("amount")
    .gte("paid_at", monthStart)
    .lt("paid_at", monthEnd);
  if (error) {
    console.warn("[dashboard] getMonthlyRevenue:", error.message);
    return 0;
  }
  return (data ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
});

// ─── Chart: revenue by month (last N months) ────────────────────────────────

export interface RevenuePoint {
  month: string;
  amount: number;
}

/**
 * Bucketed revenue for the last `monthsBack` months (default 6, including
 * the current). Order: oldest → newest, ready to feed `<RevenueChart>`.
 */
export const getRevenueByMonth = cache(
  async (monthsBack = 6): Promise<RevenuePoint[]> => {
    // Window: from the first-of-month `monthsBack - 1` months ago up to today.
    const windowStart = firstOfMonthStr(monthsBack - 1);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("amount, paid_at")
      .gte("paid_at", windowStart);

    if (error) {
      console.warn("[dashboard] getRevenueByMonth:", error.message);
      return [];
    }

    // Pre-fill the buckets so months with zero revenue still render.
    // Keys are `YYYY-MM`; order: oldest → newest.
    const buckets = new Map<string, number>();
    for (let i = monthsBack - 1; i >= 0; i--) {
      buckets.set(firstOfMonthStr(i).slice(0, 7), 0);
    }

    for (const row of data ?? []) {
      // `row.paid_at` is a `YYYY-MM-DD` string from a Postgres `date` column;
      // slicing avoids a `new Date()` parse that would shift to UTC.
      const key = String(row.paid_at).slice(0, 7);
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + Number(row.amount));
      }
    }

    return Array.from(buckets.entries()).map(([key, amount]) => {
      const monthIdx = parseInt(key.slice(5), 10) - 1;
      return { month: MONTH_LABEL[monthIdx] ?? "", amount };
    });
  },
);

// ─── Donut: tratamientos más populares ──────────────────────────────────────

export interface TreatmentSlice {
  name: string;
  value: number;
}

export interface TreatmentRollup {
  slices: TreatmentSlice[];
  total: number;
}

/**
 * Top-N servicios by completed-session count. RLS scopes the join.
 * Uses a nested select on `sesiones → servicios(name)` so we don't need
 * to issue two queries.
 */
export const getTopTreatments = cache(
  async (limit = 4): Promise<TreatmentRollup> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sesiones")
      .select("servicio_id, servicios(name)")
      .eq("status", "completed");

    if (error) {
      console.warn("[dashboard] getTopTreatments:", error.message);
      return { slices: [], total: 0 };
    }

    const counts = new Map<string, number>();
    let total = 0;
    for (const row of data ?? []) {
      const name = unwrapNested(row.servicios)?.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
      total += 1;
    }

    const slices = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, value]) => ({ name, value }));

    return { slices, total };
  },
);

// ─── List: clientes nuevos ──────────────────────────────────────────────────

export interface NewClienteRow {
  id: string;
  name: string;
  /** Relative label like "Hace 3 días". Built at fetch time so RSC stays
   *  pure. */
  joined: string;
}

/** Most recently created clientes for the tenant. `full_name` lives on
 *  `profiles`; we pull it via a nested select. */
export const getNewClientes = cache(
  async (limit = 4): Promise<NewClienteRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clientes")
      .select("id, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[dashboard] getNewClientes:", error.message);
      return [];
    }

    return (data ?? []).map((c) => ({
      id: c.id,
      name: unwrapNested(c.profiles)?.full_name ?? "Clienta",
      joined: relativeAgo(new Date(c.created_at)),
    }));
  },
);

function relativeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;
  }
  const years = Math.floor(days / 365);
  return `Hace ${years} ${years === 1 ? "año" : "años"}`;
}
