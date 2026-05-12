"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setBillingPeriodAction } from "@/actions/pricing.actions";
import { cn } from "@/lib/utils";
import type { BillingPeriod } from "@/lib/plans";

/**
 * Mensual ↔ Anual segmented toggle.
 *
 * The server decides whether to render this (`pricingSupportsAnnual` —
 * every plan must have an annual Price). When rendered, the toggle
 * writes the `pricing_period` cookie via a server action; the page
 * revalidates and the cards re-render with the new amounts.
 *
 * Why a server action instead of `router.refresh` after a cookie write:
 * `revalidatePath("/")` busts the cached render of the page tree, which
 * a plain cookie write wouldn't do. The toggle ends up with the same
 * latency as a normal Server Component re-render — no flash.
 *
 * The two buttons share visual weight; the active state is communicated
 * via background contrast (not bold + color) so the inactive option is
 * still obviously interactive — a common segmented-control trap.
 */
export function PeriodToggle({
  current,
  /** Annual savings copy ("ahorrá 2 meses" / "−20%"). Optional — the
   *  parent computes it from `commonCurrencies` + amounts. */
  annualHint,
}: {
  current: BillingPeriod;
  annualHint?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function pick(next: BillingPeriod) {
    if (next === current) return;
    startTransition(async () => {
      const result = await setBillingPeriodAction(next);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo cambiar el período.");
      }
    });
  }

  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-full border bg-card p-1 text-[12.5px] transition-opacity",
        isPending && "opacity-70",
      )}
      role="group"
      aria-label="Período de facturación"
    >
      <PeriodButton
        active={current === "month"}
        onClick={() => pick("month")}
        label="Mensual"
      />
      <PeriodButton
        active={current === "year"}
        onClick={() => pick("year")}
        label="Anual"
        suffix={annualHint}
      />
    </div>
  );
}

function PeriodButton({
  active,
  onClick,
  label,
  suffix,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  suffix?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {suffix ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
            active
              ? "bg-background/15 text-background"
              : "bg-accent/15 text-accent-foreground",
          )}
        >
          {suffix}
        </span>
      ) : null}
    </button>
  );
}
