"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  CalendarIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  CreditCardIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SERVICE_VISUAL } from "@/components/clientes/servicios/service-type-visual";
import type { AssignedService } from "@/components/clientes/servicios/types";

import { useMoney } from "@/components/providers/currency-provider";
import {
  METHOD_LABEL,
  STATUS_LABEL,
  STATUS_VISUAL,
  type PaymentMethod,
  type PaymentPlanSummary,
} from "./types";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  efectivo: BanknoteIcon,
  transferencia: ArrowLeftRightIcon,
  tarjeta: CreditCardIcon,
  codi: SmartphoneIcon,
  otro: CircleDashedIcon,
};

interface ServicePaymentCardProps {
  service: AssignedService;
  plan: PaymentPlanSummary;
  onRegister: (servicioId: string) => void;
  onDeleteTransaction: (servicioId: string, transactionId: string) => void;
}

export function ServicePaymentCard({
  service,
  plan,
  onRegister,
  onDeleteTransaction,
}: ServicePaymentCardProps) {
  const { format, formatExact } = useMoney();
  const visual = SERVICE_VISUAL[service.serviceType];
  const Icon = visual.icon;
  const statusVisual = STATUS_VISUAL[plan.status];
  const hasTransactions = plan.transactions.length > 0;
  const isPaid = plan.status === "paid";

  // Controlled Collapsible. Seeded from `hasTransactions` on first render
  // (so existing pagos are visible by default); on 0 → 1+ transitions we
  // auto-open so the freshly-registered pago is immediately in view.
  // Disabled when empty — the trigger is non-interactive in that state.
  const [open, setOpen] = useState(hasTransactions);
  const prevCount = useRef(plan.transactions.length);
  useEffect(() => {
    const curCount = plan.transactions.length;
    if (prevCount.current === 0 && curCount > 0) {
      setOpen(true);
    }
    prevCount.current = curCount;
  }, [plan.transactions.length]);

  return (
    <article className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      {/* Header — service identity + status badge */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              visual.iconBg,
              visual.iconColor,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[14px] font-medium tracking-tight">
              {service.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {service.totalSessions}{" "}
              {service.totalSessions === 1 ? "sesión" : "sesiones"} ·{" "}
              {format(plan.totalAmount)} paquete
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            statusVisual.tone,
          )}
        >
          <span className={cn("size-1.5 rounded-full", statusVisual.dot)} />
          {STATUS_LABEL[plan.status]}
        </span>
      </header>

      {/* Money row — total / paid / balance. These are the per-service
          breakdown the profesional reconciles against; show exact cents. */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-dashed bg-card/40 px-3 py-2.5">
        <MoneyCell label="Total" value={formatExact(plan.totalAmount)} />
        <MoneyCell
          label="Cobrado"
          value={formatExact(plan.paidAmount)}
          accent={isPaid ? "text-[#4F605C]" : "text-foreground"}
        />
        <MoneyCell
          label="Saldo"
          value={formatExact(plan.balance)}
          accent={
            plan.balance <= 0
              ? "text-[#4F605C]"
              : "text-[#8C4A30] font-semibold"
          }
        />
      </div>

      {/* Action + transaction toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className={cn(
                  "group flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground",
                  !hasTransactions && "pointer-events-none opacity-60",
                )}
                disabled={!hasTransactions}
              />
            }
          >
            <ChevronDownIcon className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
            <span>
              {hasTransactions
                ? `${plan.transactions.length} ${plan.transactions.length === 1 ? "pago registrado" : "pagos registrados"}`
                : "Sin pagos registrados"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden">
            <ul className="mt-3 grid gap-1.5">
              {plan.transactions.map((tx) => {
                const MethodIcon = METHOD_ICON[tx.method];
                return (
                  <li
                    key={tx.id}
                    className="group/tx flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[12px]"
                  >
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <CalendarIcon className="size-3.5" />
                      {formatDateShort(tx.paidAt)}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatExact(tx.amount)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MethodIcon className="size-3.5" />
                      {METHOD_LABEL[tx.method]}
                    </span>
                    {tx.concept ? (
                      <span className="truncate text-muted-foreground">
                        · {tx.concept}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(service.id, tx.id)}
                      className="ml-auto rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover/tx:opacity-100"
                      aria-label="Eliminar pago"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <Button
          type="button"
          size="sm"
          onClick={() => onRegister(service.id)}
          disabled={isPaid}
          className={cn(
            "gap-1.5",
            isPaid
              ? "bg-muted text-muted-foreground hover:bg-muted"
              : "bg-[#5C6E6C] text-white shadow-sm hover:bg-[#4F605C]",
          )}
        >
          <PlusIcon className="size-3.5" />
          {isPaid ? "Pagado" : "Registrar pago"}
        </Button>
      </div>
    </article>
  );
}

function MoneyCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-[13px] leading-tight",
          accent ?? "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatDateShort(iso: string): string {
  // YYYY-MM-DD → DD/MM (locale-agnostic small label for the row)
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
