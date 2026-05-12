import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCardIcon, SparklesIcon } from "lucide-react";

import { PagosDateRange } from "@/components/pagos/pagos-date-range";
import { PagosExportButton } from "@/components/pagos/pagos-export-button";
import { PagosSummary } from "@/components/pagos/pagos-summary";
import { PagosTable } from "@/components/pagos/pagos-table";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import { getTenantConfig } from "@/lib/tenant-config";
import {
  paymentMethodEnum,
  paymentStatusEnum,
  type PaymentMethod,
  type PaymentStatus,
} from "@/schemas/pagos.schema";
import {
  getPaymentsSummary,
  listPaymentTransactions,
  type PaymentSortField,
  type SortDirection,
} from "@/services/pagos.service";
import type { ServiceType } from "@/schemas/servicios.schema";

export const metadata: Metadata = {
  title: "Pagos",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SERVICE_TYPES: readonly ServiceType[] = [
  "facial",
  "corporal",
  "laser",
  "other",
];

function parseInt1(
  raw: string | string[] | undefined,
  fallback: number,
): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseStr(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.trim() ? v.trim() : undefined;
}

function parseEnum<T extends string>(
  raw: string | string[] | undefined,
  values: readonly T[],
): T | undefined {
  const v = parseStr(raw);
  if (!v) return undefined;
  return (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

function parseDate(raw: string | string[] | undefined): string | undefined {
  const v = parseStr(raw);
  if (!v) return undefined;
  // Accept only `YYYY-MM-DD` (what the date input emits). Anything else
  // is silently dropped — bookmarks with bad params still render.
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

const SORT_FIELDS: readonly PaymentSortField[] = [
  "paidAt",
  "amount",
  "createdAt",
];
const SORT_DIRS: readonly SortDirection[] = ["asc", "desc"];

export default async function PagosPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  const sp = await searchParams;
  const page = parseInt1(sp.page, 1);
  const pageSize = parseInt1(sp.pageSize, 20);
  const search = parseStr(sp.search);
  const status = parseEnum<PaymentStatus>(
    sp.filter_status,
    paymentStatusEnum.options,
  );
  const method = parseEnum<PaymentMethod>(
    sp.filter_method,
    paymentMethodEnum.options,
  );
  const serviceType = parseEnum<ServiceType>(
    sp.filter_serviceType,
    SERVICE_TYPES,
  );
  const dateFrom = parseDate(sp.dateFrom);
  const dateTo = parseDate(sp.dateTo);
  const sortBy = parseEnum<PaymentSortField>(sp.sortBy, SORT_FIELDS);
  const sortDir = parseEnum<SortDirection>(sp.sortDir, SORT_DIRS);

  const filterPayload = {
    search,
    status,
    method,
    serviceType,
    dateFrom,
    dateTo,
  };

  const supabase = await createClient();
  const [list, summary, tenantConfig] = await Promise.all([
    listPaymentTransactions(supabase, {
      page,
      pageSize,
      ...filterPayload,
      sortBy,
      sortDir,
    }),
    getPaymentsSummary(filterPayload),
    getTenantConfig(),
  ]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6E0D6] px-2.5 py-1 text-[11px] font-medium text-[#8C4A30]">
            <SparklesIcon className="size-3" />
            Vista financiera global
          </span>
          <h1 className="font-heading mt-3 flex items-center gap-2 text-2xl font-medium tracking-tight sm:text-3xl">
            <CreditCardIcon className="size-6 text-[#BB7154]" />
            Pagos
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Registro manual de todos los pagos del estudio. Filtrá por
            clienta, servicio, método o fecha para auditar y conciliar.
          </p>
        </div>
        <PagosExportButton />
      </header>

      <PagosSummary summary={summary} currency={tenantConfig.currency} />

      <PagosDateRange
        initialFrom={dateFrom ?? ""}
        initialTo={dateTo ?? ""}
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <PagosTable rows={list.rows} total={list.total} />
      </div>
    </div>
  );
}
