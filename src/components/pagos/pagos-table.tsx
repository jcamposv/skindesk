"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  CircleDashedIcon,
  CreditCardIcon,
  EyeIcon,
  SmartphoneIcon,
  UserIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { DataTable } from "@/components/data-table";
import type { FilterConfig, RowAction } from "@/components/data-table";
import { SortableHeader } from "@/components/pagos/sortable-header";
import { useMoney } from "@/components/providers/currency-provider";
import {
  METHOD_LABEL,
  STATUS_LABEL,
  STATUS_VISUAL,
  type PaymentMethod,
  type PaymentStatus,
} from "@/components/clientes/pagos/types";
import { SERVICE_VISUAL } from "@/components/clientes/servicios/service-type-visual";
import { SERVICE_TYPE_LABEL } from "@/components/clientes/servicios/types";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { paymentMethodEnum, paymentStatusEnum } from "@/schemas/pagos.schema";
import type { PaymentListRow } from "@/services/pagos.service";
import type { ServiceType } from "@/schemas/servicios.schema";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  efectivo: BanknoteIcon,
  transferencia: ArrowLeftRightIcon,
  tarjeta: CreditCardIcon,
  codi: SmartphoneIcon,
  otro: CircleDashedIcon,
};

const SERVICE_TYPES: readonly ServiceType[] = [
  "facial",
  "corporal",
  "laser",
  "other",
];

const FILTERS: FilterConfig[] = [
  {
    id: "status",
    label: "Estado",
    type: "select",
    options: paymentStatusEnum.options.map((s) => ({
      label: STATUS_LABEL[s as PaymentStatus],
      value: s,
    })),
  },
  {
    id: "method",
    label: "Método",
    type: "select",
    options: paymentMethodEnum.options.map((m) => ({
      label: METHOD_LABEL[m as PaymentMethod],
      value: m,
    })),
  },
  {
    id: "serviceType",
    label: "Tipo de servicio",
    type: "select",
    options: SERVICE_TYPES.map((t) => ({
      label: SERVICE_TYPE_LABEL[t],
      value: t,
    })),
  },
];

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): string {
  // `paid_at` is a Postgres `date` column → render via UTC parse so the
  // displayed day matches what's stored, free of browser-TZ slip.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FORMAT.format(new Date(Date.UTC(y, m - 1, d)));
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const visual = STATUS_VISUAL[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        visual.tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", visual.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function MethodCell({ method }: { method: PaymentMethod }) {
  const Icon = METHOD_ICON[method];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
      <Icon className="size-3.5 text-muted-foreground" />
      {METHOD_LABEL[method]}
    </span>
  );
}

function ServiceCell({
  servicio,
  sesion,
}: {
  servicio: PaymentListRow["servicio"];
  sesion: PaymentListRow["sesion"];
}) {
  if (!servicio) {
    return (
      <span className="text-xs text-muted-foreground/70">Pago general</span>
    );
  }
  const visual = SERVICE_VISUAL[servicio.serviceType];
  const Icon = visual.icon;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          visual.iconBg,
          visual.iconColor,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">
          {servicio.name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {SERVICE_TYPE_LABEL[servicio.serviceType]}
          {sesion ? ` · Sesión ${sesion.sessionNumber}` : ""}
        </p>
      </div>
    </div>
  );
}

export function PagosTable({
  rows,
  total,
}: {
  rows: PaymentListRow[];
  total: number;
}) {
  const router = useRouter();
  // Per-row amounts in a ledger should show cents — rounding $1234.56 to
  // $1235 quietly drops conciliation accuracy. Aggregate tiles above the
  // table still use `format` (0 digits) because they're for glance.
  const { formatExact } = useMoney();

  const columns = useMemo<ColumnDef<PaymentListRow, unknown>[]>(
    () => [
      {
        id: "paidAt",
        header: () => <SortableHeader sortKey="paidAt" label="Fecha" />,
        cell: ({ row }) => (
          <span className="text-[12.5px] tabular-nums text-foreground/80">
            {formatDate(row.original.paidAt)}
          </span>
        ),
      },
      {
        id: "cliente",
        header: "Clienta",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F4F1EC] text-[#8C4A30]">
              <UserIcon className="size-3.5" />
            </span>
            <span className="truncate text-[13px] font-medium text-foreground">
              {row.original.cliente.fullName}
            </span>
          </div>
        ),
        meta: { className: "min-w-[200px]" },
      },
      {
        id: "servicio",
        header: "Servicio",
        cell: ({ row }) => (
          <ServiceCell
            servicio={row.original.servicio}
            sesion={row.original.sesion}
          />
        ),
        meta: { className: "min-w-[220px]" },
      },
      {
        id: "concept",
        header: "Concepto",
        cell: ({ row }) => {
          const v = row.original.concept;
          return v ? (
            <span className="truncate text-[12.5px] text-foreground/80">
              {v}
            </span>
          ) : (
            <span className="text-[12.5px] text-muted-foreground/70">—</span>
          );
        },
      },
      {
        id: "amount",
        header: () => <SortableHeader sortKey="amount" label="Monto" />,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatExact(row.original.amount)}
          </span>
        ),
      },
      {
        id: "method",
        header: "Método",
        cell: ({ row }) => <MethodCell method={row.original.method} />,
      },
      {
        id: "status",
        header: "Estado",
        cell: ({ row }) =>
          row.original.plan ? (
            <StatusBadge status={row.original.plan.status} />
          ) : (
            <span className="text-[12.5px] text-muted-foreground/70">—</span>
          ),
      },
      {
        id: "balance",
        header: "Saldo restante",
        cell: ({ row }) => {
          const balance = row.original.plan?.balance ?? 0;
          return (
            <span
              className={cn(
                "tabular-nums text-[12.5px]",
                balance > 0
                  ? "font-semibold text-[#8C4A30]"
                  : "text-[#4F605C]",
              )}
            >
              {formatExact(balance)}
            </span>
          );
        },
      },
      {
        id: "registeredBy",
        header: "Registrado por",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {row.original.registeredBy ?? "Sistema"}
          </span>
        ),
      },
    ],
    // `format` is memoised by `useMoney` and only changes when the
    // tenant currency does, so this dependency stays stable across
    // normal re-renders but follows a currency switch in real time.
    [formatExact],
  );

  const rowActions = useMemo<RowAction<PaymentListRow>[]>(
    () => [
      {
        id: "view",
        label: "Ver detalle",
        icon: EyeIcon,
        onClick: (r) => router.push(`${ROUTES.pagos}/${r.id}`),
      },
    ],
    [router],
  );

  return (
    <DataTable<PaymentListRow>
      mode="server"
      columns={columns}
      data={rows}
      totalItems={total}
      defaultPageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      searchable
      searchPlaceholder="Buscar por nombre de clienta…"
      filters={FILTERS}
      rowActions={rowActions}
      onRowClick={(r) => router.push(`${ROUTES.pagos}/${r.id}`)}
      getRowId={(r) => r.id}
      emptyTitle="Sin pagos registrados"
      emptyDescription="Cuando registres pagos desde la perfil de una clienta, los vas a ver aquí."
      emptyIcon={WalletIcon}
    />
  );
}
