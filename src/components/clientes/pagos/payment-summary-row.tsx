"use client";

import {
  CircleDashedIcon,
  CircleDollarSignIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface PaymentSummaryRowProps {
  totalAmount: number;
  paidAmount: number;
  balance: number;
  unpaidServiceCount: number;
}

export function PaymentSummaryRow({
  totalAmount,
  paidAmount,
  balance,
  unpaidServiceCount,
}: PaymentSummaryRowProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        icon={CircleDollarSignIcon}
        label="Total facturado"
        value={formatCurrency(totalAmount)}
        tone="bg-[#F4F1EC] text-[#8C4A30]"
      />
      <StatTile
        icon={TrendingUpIcon}
        label="Cobrado"
        value={formatCurrency(paidAmount)}
        tone="bg-[#E7ECEA] text-[#4F605C]"
      />
      <StatTile
        icon={WalletIcon}
        label="Saldo pendiente"
        value={formatCurrency(balance)}
        tone="bg-[#F8EFD7] text-[#7C5E1F]"
      />
      <StatTile
        icon={CircleDashedIcon}
        label="Servicios con saldo"
        value={`${unpaidServiceCount} ${unpaidServiceCount === 1 ? "servicio" : "servicios"}`}
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
  icon: React.ComponentType<{ className?: string }>;
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
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
