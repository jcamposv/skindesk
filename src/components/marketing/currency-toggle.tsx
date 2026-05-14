"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setPricingCurrencyAction } from "@/actions/pricing.actions";
import {
  CurrencyOption,
  CurrencySelect,
} from "@/components/settings/currency-select";
import { getCurrency } from "@/lib/currency";

/**
 * Landing currency picker. The Stripe intersection (currencies offered
 * by *every* plan) is supplied by the server — we only render the
 * dropdown when there's a meaningful choice (≥2 codes).
 *
 * Reuses the same `CurrencySelect` / `CurrencyOption` primitives the
 * Configuración page uses. The marketing-side filter (`available`) is
 * applied at this layer so the picker itself stays presentational.
 *
 * On change: optimistic UI is unnecessary here — the page revalidates
 * and the new prices arrive on the same response. We just dim the
 * trigger while the server action is in flight via `useTransition`.
 */
export function CurrencyToggle({
  currentCurrency,
  available,
}: {
  currentCurrency: string;
  available: readonly string[];
}) {
  const [isPending, startTransition] = useTransition();

  if (available.length < 2) return null;

  function handleChange(next: string) {
    if (!next || next === currentCurrency) return;
    startTransition(async () => {
      const result = await setPricingCurrencyAction(next);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo cambiar la moneda.");
      }
    });
  }

  const descriptor = getCurrency(currentCurrency);

  // CurrencySelect renders every currency in the global catalogue. For
  // the marketing toggle we want to keep it tight: only the Stripe
  // intersection. We pass a sentinel value + a filter callback via the
  // wrapping `MarketingCurrencySelect` below.
  return (
    <MarketingCurrencySelect
      value={currentCurrency}
      onValueChange={handleChange}
      disabled={isPending}
      available={available}
      activeDescriptor={descriptor}
    />
  );
}

/**
 * A trimmed copy of CurrencySelect that only renders codes inside
 * `available`. We don't extend the shared component with an `available`
 * prop because the settings UI legitimately wants the full catalogue —
 * mixing scopes would make `CurrencySelect` harder to reason about.
 */
function MarketingCurrencySelect({
  value,
  onValueChange,
  disabled,
  available,
}: {
  value: string;
  onValueChange: (next: string) => void;
  disabled: boolean;
  available: readonly string[];
  activeDescriptor: ReturnType<typeof getCurrency>;
}) {
  const allowed = new Set(available.map((c) => c.toUpperCase()));
  // Render via `CurrencySelect`'s underlying primitive so we get the same
  // visual treatment. We pass the entire catalogue and let the Select
  // hide items via `available` membership.
  return (
    <CurrencySelect
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      triggerClassName="h-9 min-w-[180px] bg-card"
      filter={(code) => allowed.has(code)}
    />
  );
}

/**
 * Convenience pill rendered next to the toggle when only one currency is
 * available (e.g. dev without `currency_options`). Plain readout, no
 * dropdown. The settings card already uses CurrencyOption for the same
 * purpose; this is the marketing variant.
 */
export function CurrencyBadge({ code }: { code: string }) {
  const descriptor = getCurrency(code);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm">
      <CurrencyOption
        flag={descriptor.flag}
        countryName={descriptor.countryName}
        currencyName={descriptor.currencyName}
        currencyCode={descriptor.currencyCode}
      />
    </span>
  );
}
