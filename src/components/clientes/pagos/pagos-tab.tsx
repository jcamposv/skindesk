"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import {
  registerPaymentAction,
  deletePaymentAction,
} from "@/actions/pagos.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AssignedService } from "@/components/clientes/servicios/types";
import type { PaymentPlanSummary } from "@/services/pagos.service";
import type { PaymentRegisterInput } from "@/schemas/pagos.schema";

import { useMoney } from "@/components/providers/currency-provider";

import { PaymentSummaryRow } from "./payment-summary-row";
import { ServicePaymentCard } from "./service-payment-card";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { METHOD_LABEL } from "./types";

interface PagosTabProps {
  /** Same servicios prop ServiciosTab consumes — payments hang off them. */
  services: AssignedService[];
  /** Server-fetched payment plans, keyed by servicioId. Mutations go
   *  through server actions + `router.refresh()` — we don't mirror state. */
  initialPlans: Record<string, PaymentPlanSummary>;
}

type FilterKey = "all" | "withBalance" | "paid";

/**
 * Manual payment ledger tab. Plans are auto-created server-side (one per
 * servicio) by a Postgres trigger; we only ever insert / delete
 * transactions. The plan's `paid_amount` + `status` rollup is maintained
 * by a second trigger so the UI shows fresh totals on every refresh.
 *
 * Data flow: `initialPlans` is the source of truth. Mutations call the
 * server action and then `router.refresh()` so the RSC re-fetches with
 * RLS scoping intact.
 */
export function PagosTab({ services, initialPlans }: PagosTabProps) {
  const router = useRouter();
  const { format: formatMoney } = useMoney();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [registerForId, setRegisterForId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Build a Map for O(1) lookup as we iterate the services list.
  const planByServicio = useMemo(
    () => new Map(Object.entries(initialPlans)),
    [initialPlans],
  );

  // Plans aligned to the services array (preserves servicio sort order).
  const plans: PaymentPlanSummary[] = useMemo(
    () =>
      services.map(
        (s) =>
          planByServicio.get(s.id) ?? {
            // Defensive fallback — should never happen since the
            // servicios_create_payment_plan trigger auto-creates one for
            // every servicio. If it does (e.g. a row predates the
            // migration backfill), we render a synthetic empty plan so
            // the UI keeps rendering.
            servicioId: s.id,
            planId: "",
            totalAmount: s.packageAmount,
            paidAmount: 0,
            balance: s.packageAmount,
            status: "pending" as const,
            transactions: [],
          },
      ),
    [services, planByServicio],
  );

  const stats = useMemo(() => {
    const totalAmount = plans.reduce((a, p) => a + p.totalAmount, 0);
    const paidAmount = plans.reduce((a, p) => a + p.paidAmount, 0);
    const balance = Math.max(0, totalAmount - paidAmount);
    const unpaidServiceCount = plans.filter(
      (p) => p.totalAmount > 0 && p.status !== "paid",
    ).length;
    return { totalAmount, paidAmount, balance, unpaidServiceCount };
  }, [plans]);

  const filteredPairs = useMemo(() => {
    return services
      .map((service, idx) => ({ service, plan: plans[idx]! }))
      .filter(({ plan }) => {
        if (plan.totalAmount <= 0) return false;
        if (filter === "withBalance") return plan.balance > 0;
        if (filter === "paid") return plan.status === "paid";
        return true;
      });
  }, [services, plans, filter]);

  const targetEntry = useMemo(() => {
    if (!registerForId) return null;
    const idx = services.findIndex((s) => s.id === registerForId);
    if (idx < 0) return null;
    return { service: services[idx]!, plan: plans[idx]! };
  }, [registerForId, services, plans]);

  function handleRegister(
    servicioId: string,
    input: PaymentRegisterInput,
  ): Promise<void> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await registerPaymentAction(servicioId, input);
        if (!result.success) {
          toast.error(result.message ?? "No se pudo registrar el pago.");
          resolve();
          return;
        }
        const svcName =
          services.find((s) => s.id === servicioId)?.name ?? "Servicio";
        toast.success(`Pago registrado · ${svcName}`, {
          description: `${formatMoney(input.amount)} · ${METHOD_LABEL[input.method]}`,
        });
        router.refresh();
        resolve();
      });
    });
  }

  function handleDeleteTransaction(_servicioId: string, transactionId: string) {
    startTransition(async () => {
      const result = await deletePaymentAction(transactionId);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo eliminar el pago.");
        return;
      }
      toast.success("Pago eliminado.");
      router.refresh();
    });
  }

  const hasServicesWithPrice = services.some((s) => s.packageAmount > 0);

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F1EC] text-[#BB7154]">
              <CreditCardIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-medium tracking-tight">
                Plan de pagos
              </h2>
              <p className="text-sm text-foreground/75">
                Resumen financiero por servicio y registro manual de pagos.
                Sin cobros online — solo asentás lo que la clienta ya pagó.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <PaymentSummaryRow
            totalAmount={stats.totalAmount}
            paidAmount={stats.paidAmount}
            balance={stats.balance}
            unpaidServiceCount={stats.unpaidServiceCount}
          />
        </div>
      </header>

      {hasServicesWithPrice ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="Todos"
              count={plans.filter((p) => p.totalAmount > 0).length}
            />
            <FilterChip
              active={filter === "withBalance"}
              onClick={() => setFilter("withBalance")}
              label="Con saldo"
              count={plans.filter((p) => p.balance > 0).length}
            />
            <FilterChip
              active={filter === "paid"}
              onClick={() => setFilter("paid")}
              label="Pagados"
              count={plans.filter((p) => p.status === "paid").length}
            />
          </div>

          {filteredPairs.length > 0 ? (
            <div className="grid gap-3">
              {filteredPairs.map(({ service, plan }) => (
                <ServicePaymentCard
                  key={service.id}
                  service={service}
                  plan={plan}
                  onRegister={(id) => setRegisterForId(id)}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              ))}
            </div>
          ) : (
            <EmptyFilteredState
              onClear={() => setFilter("all")}
              filter={filter}
            />
          )}
        </>
      ) : (
        <EmptyTabState />
      )}

      <RegisterPaymentDialog
        service={targetEntry?.service ?? null}
        plan={targetEntry?.plan ?? null}
        onClose={() => setRegisterForId(null)}
        onSubmit={handleRegister}
        saving={isPending}
      />
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-[#BB7154] bg-[#F6E0D6] font-medium text-[#8C4A30]"
          : "border-border/60 bg-card text-muted-foreground hover:border-[#BB7154]/40 hover:bg-[#FBEFE7]/20",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
          active ? "bg-white/80 text-[#8C4A30]" : "bg-muted/60",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyFilteredState({
  filter,
  onClear,
}: {
  filter: FilterKey;
  onClear: () => void;
}) {
  const copy =
    filter === "withBalance"
      ? "No hay servicios con saldo pendiente."
      : filter === "paid"
        ? "Todavía ningún servicio fue cobrado por completo."
        : "Sin servicios en este filtro.";

  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card/40 p-8 text-center">
      <p className="text-[13px] font-medium text-foreground">{copy}</p>
      <Button type="button" variant="outline" size="sm" onClick={onClear}>
        Ver todos
      </Button>
    </div>
  );
}

function EmptyTabState() {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[#F6E0D6] text-[#8C4A30]">
        <SparklesIcon className="size-5" />
      </span>
      <div className="grid gap-1">
        <h3 className="font-heading text-base">
          Todavía no hay servicios con precio asignado
        </h3>
        <p className="max-w-md text-sm text-foreground/75">
          Agregá un servicio con monto de paquete desde la pestaña “Servicios”
          y vuelve aquí para registrar los pagos manuales de la clienta.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="cta"
          size="sm"
          className="gap-1.5"
          disabled
        >
          <PlusIcon className="size-4" />
          Registrar pago
        </Button>
      </div>
    </div>
  );
}
