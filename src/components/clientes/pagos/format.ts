/**
 * Pagos-module formatter compatibility shim.
 *
 * The canonical helper is `formatMoney(amount, currencyCode)` in
 * `src/lib/currency.ts`. Server Components call it directly with
 * `tenantConfig.currency`; Client Components reach it via the
 * `useMoney()` hook. This file re-exports `formatMoney` as the
 * historical alias so older imports keep compiling.
 *
 * Do NOT add a no-arg variant here — every money render must declare
 * which currency it speaks. Defaults belong in the provider, not in
 * the formatter.
 */
export { formatMoney as formatCurrency, formatMoney } from "@/lib/currency";
