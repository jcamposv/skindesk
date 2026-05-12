/**
 * Currency formatter shared between server and client components.
 * Lives outside `payment-summary-row.tsx` (which is `"use client"`) so
 * Server Components can import it without crossing the client boundary.
 */
// Currency is tenant-scoped in spirit, but the `tenants` row has no
// `currency` column yet. Default to ARS to match `es-AR` locale and the
// AR-pinned timezone in `tenant-config.ts`. Add a tenant-level override
// when the first international tenant lands.
const TENANT_CURRENCY = "ARS";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: TENANT_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}
