import {
  CircleDashedIcon,
  CircleDollarSignIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { METHOD_LABEL } from "@/components/clientes/pagos/types";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { PaymentsSummary } from "@/services/pagos.service";

/**
 * KPI strip for the /pagos page hero. Mirrors the visual language of the
 * per-cliente PaymentSummaryRow so the global ledger feels like a familiar
 * extension of the same module.
 *
 * The income / count / top-method tiles follow the active filters so the
 * cards and the table never disagree. The pending-balance tile is always
 * global — it answers "how much money does the studio still need to
 * collect", which is independent of any view filter.
 */
export function PagosSummary({
  summary,
  currency,
}: {
  summary: PaymentsSummary;
  /** Tenant currency code, supplied by the Server Component caller from
   *  `getTenantConfig()`. Server Components don't read the
   *  `CurrencyProvider` context, so the currency travels as a prop. */
  currency: string;
}) {
  const methodLabel = summary.topMethod
    ? METHOD_LABEL[summary.topMethod]
    : "—";
  const isFiltered = summary.windowLabel === "filtered";
  const incomeLabel = isFiltered ? "Ingresos (rango)" : "Ingresos del mes";
  const countLabel = isFiltered ? "Pagos (rango)" : "Pagos del mes";
  const methodTileLabel = isFiltered
    ? "Método más usado (rango)"
    : "Método más usado";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        icon={CircleDollarSignIcon}
        label={incomeLabel}
        value={formatMoney(summary.windowIncome, currency)}
        tone="bg-[#F4F1EC] text-[#8C4A30]"
      />
      <StatTile
        icon={WalletIcon}
        label="Saldo pendiente"
        value={formatMoney(summary.pendingBalance, currency)}
        tone="bg-[#F8EFD7] text-[#7C5E1F]"
      />
      <StatTile
        icon={TrendingUpIcon}
        label={countLabel}
        value={`${summary.windowCount} ${summary.windowCount === 1 ? "pago" : "pagos"}`}
        tone="bg-[#E7ECEA] text-[#4F605C]"
      />
      <StatTile
        icon={CircleDashedIcon}
        label={methodTileLabel}
        value={methodLabel}
        tone="bg-[#FBEFE7] text-[#BB7154]"
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          tone,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/75">
          {label}
        </p>
        <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}
