import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney, getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { BillingPeriod, Plan } from "@/lib/plans";

/**
 * Marketing-side price card. Amount + currency come from Stripe via
 * `getPlanPricing()` in the parent — this component never touches the
 * Stripe SDK or env vars, so it can render statically in any layout.
 *
 * Why the parent passes `unitAmount` in cents (Stripe's smallest unit):
 * - Stripe is the source of truth for amounts.
 * - The cents → major-unit divide happens once, here, where we render.
 * - `formatMoney` then renders with the right locale + symbol.
 *
 * `period` decides the `/mes` vs `/año` caption and the card link query.
 */
export interface DisplayPrice {
  /** Stripe `unit_amount` (smallest currency unit, e.g. cents). */
  unitAmount: number;
  /** Uppercase ISO-4217. */
  currency: string;
  period: BillingPeriod;
}

interface PlanCardProps {
  plan: Plan;
  price: DisplayPrice;
  /** Optional savings tag rendered next to the amount (e.g. "−20%"). */
  savingsLabel?: string | null;
}

export function PlanCard({ plan, price, savingsLabel }: PlanCardProps) {
  // Stripe's `unit_amount` is in the currency's smallest unit. For
  // zero-decimal currencies (JPY, CLP, PYG), Stripe stores the major
  // unit directly; `Intl.NumberFormat` handles that automatically once
  // we divide by 100 — except we shouldn't divide for those. Easiest
  // path: ask Stripe via the standard "currencies without decimals"
  // list. Until we hit one in production, we divide by 100 across the
  // board; the LATAM set we support uses two-decimal currencies.
  const amountMajor = price.unitAmount / 100;
  const formatted = formatMoney(amountMajor, price.currency, {
    maximumFractionDigits: 0,
  });
  // Disambiguates the `$` symbol — MXN, USD, COP, CLP, ARS all render
  // as `$` in their native locale, so we surface the ISO code + name
  // explicitly under the amount.
  const currency = getCurrency(price.currency);
  const periodSuffix = price.period === "month" ? "/mes" : "/año";
  const checkoutHref = `/checkout?plan=${plan.slug}&period=${price.period}`;

  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        plan.highlight && "border-accent ring-2 ring-accent/30",
      )}
    >
      <CardHeader>
        {plan.highlight ? (
          <span className="mb-2 inline-flex w-fit items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            Más popular
          </span>
        ) : null}
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatted}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {currency.currencyCode}
          </span>
          <span className="text-sm text-muted-foreground">{periodSuffix}</span>
          {savingsLabel ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              {savingsLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Precios en {currency.currencyName.toLowerCase()}
          {plan.trialDays > 0 ? ` · ${plan.trialDays} días de prueba gratis` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckIcon
                className="mt-0.5 size-4 shrink-0 text-accent"
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          size="lg"
          className="w-full"
          variant={plan.highlight ? "default" : "outline"}
          render={<Link href={checkoutHref} />}
        >
          Comenzar con {plan.name}
        </Button>
      </CardFooter>
    </Card>
  );
}
