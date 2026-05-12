import { NextResponse } from "next/server";

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
  listPaymentTransactions,
  type PaymentListRow,
} from "@/services/pagos.service";
import type { ServiceType } from "@/schemas/servicios.schema";
import { METHOD_LABEL, STATUS_LABEL } from "@/components/clientes/pagos/types";
import { SERVICE_TYPE_LABEL } from "@/components/clientes/servicios/types";

/**
 * GET /pagos/export.csv — downloads the current filter result as a CSV.
 *
 * Mirrors the page's searchParams contract (search, filter_status,
 * filter_method, filter_serviceType, dateFrom, dateTo, sortBy, sortDir)
 * so any URL on /pagos can swap `/pagos?…` for `/pagos/export.csv?…` and
 * get the matching dataset. RLS scopes the read.
 *
 * Hard cap at 5_000 rows for v1 — enough for monthly conciliation, not
 * enough to lock up the browser or the DB. Beyond that, the user should
 * filter to a date range. A true streaming export comes later if needed.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ROWS = 5_000;

const SERVICE_TYPES: readonly ServiceType[] = [
  "facial",
  "corporal",
  "laser",
  "other",
];

function pickString(
  raw: string | null,
  predicate: (v: string) => boolean = () => true,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return predicate(trimmed) ? trimmed : undefined;
}

function pickEnum<T extends string>(
  raw: string | null,
  values: readonly T[],
): T | undefined {
  const v = pickString(raw);
  if (!v) return undefined;
  return (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

function pickDate(raw: string | null): string | undefined {
  return pickString(raw, (v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
}

/** RFC-4180-ish CSV escape: wrap in quotes if the value contains a quote,
 *  comma, newline or carriage-return, and escape inner quotes by doubling. */
function csvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// `moneda` is the same ISO code for every row (the tenant operates in
// one currency at a time — no per-tx amount currency yet). Stamping it
// on every line keeps the file self-describing for downstream importers
// that don't read the filename. The currency also lands in the
// `Content-Disposition` filename, so a quick glance at the download is
// enough to identify the export's monetary base.
function rowToCsv(row: PaymentListRow, currencyCode: string): string {
  return [
    row.paidAt,
    row.cliente.fullName,
    row.servicio?.name ?? "",
    row.servicio ? SERVICE_TYPE_LABEL[row.servicio.serviceType] : "",
    row.sesion ? row.sesion.sessionNumber : "",
    row.concept,
    row.amount,
    currencyCode,
    METHOD_LABEL[row.method],
    row.plan ? STATUS_LABEL[row.plan.status] : "",
    row.plan?.totalAmount ?? "",
    row.plan?.paidAmount ?? "",
    row.plan?.balance ?? "",
    row.registeredBy ?? "",
    row.createdAt,
  ]
    .map(csvField)
    .join(",");
}

const HEADERS = [
  "fecha_pago",
  "clienta",
  "servicio",
  "tipo_servicio",
  "sesion",
  "concepto",
  "monto",
  "moneda",
  "metodo",
  "estado_plan",
  "total_paquete",
  "pagado_acumulado",
  "saldo_restante",
  "registrado_por",
  "creado_en",
].join(",");

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return NextResponse.redirect(
      new URL(dashboardForRole(session.profile.role), request.url),
    );
  }

  const url = new URL(request.url);
  const search = pickString(url.searchParams.get("search"));
  const status = pickEnum<PaymentStatus>(
    url.searchParams.get("filter_status"),
    paymentStatusEnum.options,
  );
  const method = pickEnum<PaymentMethod>(
    url.searchParams.get("filter_method"),
    paymentMethodEnum.options,
  );
  const serviceType = pickEnum<ServiceType>(
    url.searchParams.get("filter_serviceType"),
    SERVICE_TYPES,
  );
  const dateFrom = pickDate(url.searchParams.get("dateFrom"));
  const dateTo = pickDate(url.searchParams.get("dateTo"));

  const supabase = await createClient();
  const [{ rows }, tenantConfig] = await Promise.all([
    listPaymentTransactions(supabase, {
      page: 1,
      pageSize: MAX_ROWS,
      search,
      status,
      method,
      serviceType,
      dateFrom,
      dateTo,
    }),
    getTenantConfig(),
  ]);

  const body = [
    HEADERS,
    ...rows.map((r) => rowToCsv(r, tenantConfig.currency)),
  ].join("\n");
  const filename = `pagos-${tenantConfig.currency}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
