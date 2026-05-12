"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import {
  DEFAULT_CURRENCY_CODE,
  formatMoney,
  getCurrency,
  getCurrencySymbol,
  type Currency,
} from "@/lib/currency";

/**
 * Context-only carrier for the tenant's currency. The provider is mounted
 * once at the (staff) layout level — every client component reads from it
 * via `useMoney()`, which keeps Dashboard / Pagos / Plan-de-pagos /
 * Service-payment cards decoupled from Configuración.
 *
 * Why a context (vs. props): currency reaches into every screen with a
 * money value (tab nav inside cliente detail, dialogs, toast strings,
 * KPI tiles). Threading it as a prop would mean editing every interim
 * component for a non-changing piece of tenant config. A context with a
 * stable default is the right granularity here.
 *
 * Server components don't need the provider — they call `formatMoney`
 * directly with the currency they got from `getTenantConfig()`.
 */
const CurrencyContext = createContext<string>(DEFAULT_CURRENCY_CODE);

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

interface UseMoneyReturn {
  /** ISO-4217 code currently active. */
  currency: string;
  /** Full descriptor (flag / name / locale) for UI badges and copy. */
  descriptor: Currency;
  /** Locale-rendered symbol (`$`, `MX$`, `S/`, `Bs`, …). For input
   *  prefixes, chart ticks, terse placeholders. */
  symbol: string;
  /**
   * Format a number with the active currency. Defaults to 0 fraction
   * digits (KPI-tile glance look). Pass `{ maximumFractionDigits: 2 }`
   * for detail/exact surfaces (per-transaction amounts, balances on
   * the detail page, the register-dialog header).
   */
  format: (
    amount: number,
    options?: { maximumFractionDigits?: number },
  ) => string;
  /** Convenience for the exact-display surfaces (detail page, dialogs).
   *  Equivalent to `format(amount, { maximumFractionDigits: 2 })`. */
  formatExact: (amount: number) => string;
}

/**
 * Read currency + bound formatter inside any client component.
 *
 * The hook returns a memoised pair of formatters so passing them as
 * dependencies stays stable across normal re-renders. The `descriptor`
 * exposes the locale / flag for surfaces that want to show the picked
 * currency (e.g. the settings hero). The `symbol` is what
 * `CurrencyInput` and chart axes want when they can't fit the full
 * formatted value.
 *
 * Convention used in this codebase:
 *   · KPI tiles & aggregate glances → `format(n)` (0 digits, default)
 *   · Per-tx amounts / balance breakdowns / dialog header → `formatExact(n)`
 */
export function useMoney(): UseMoneyReturn {
  const currency = use(CurrencyContext);
  return useMemo(
    () => ({
      currency,
      descriptor: getCurrency(currency),
      symbol: getCurrencySymbol(currency),
      format: (
        amount: number,
        options?: { maximumFractionDigits?: number },
      ) => formatMoney(amount, currency, options),
      formatExact: (amount: number) =>
        formatMoney(amount, currency, { maximumFractionDigits: 2 }),
    }),
    [currency],
  );
}
