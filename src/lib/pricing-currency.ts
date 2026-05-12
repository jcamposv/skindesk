import "server-only";

import { cookies, headers } from "next/headers";

import { CURRENCIES, DEFAULT_CURRENCY_CODE } from "@/lib/currency";
import { isBillingPeriod, type BillingPeriod } from "@/lib/plans";

/**
 * Decide which currency to display on the marketing/landing surfaces.
 *
 * Resolution order:
 *   1. Explicit user choice via the `pricing_currency` cookie (set by the
 *      currency toggle).
 *   2. Vercel Edge geo header `x-vercel-ip-country` → currency from
 *      `CURRENCIES` countryCode mapping.
 *   3. USD as the universal fallback (works for every Stripe price that
 *      has USD enabled).
 *
 * Any choice is constrained to `availableCurrencies` — what the Stripe
 * prices actually offer. If the requested currency isn't in the
 * intersection, we walk the list back to USD so the page never shows a
 * currency that won't survive Checkout.
 *
 * IMPORTANT: cookies/headers reads are awaited (Next 16 async APIs).
 * Calling this inside a `use cache` scope is unsafe; read it in the
 * page body and pass the resolved string into cached helpers.
 */

const COUNTRY_TO_CURRENCY: Record<string, string> =
  Object.fromEntries(
    CURRENCIES.map((c) => [c.countryCode, c.currencyCode]),
  );

export async function getPreferredPricingCurrency(
  availableCurrencies: readonly string[],
): Promise<string> {
  if (availableCurrencies.length === 0) return "USD";
  const allowed = new Set(availableCurrencies.map((c) => c.toUpperCase()));

  // 1. Cookie override
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("pricing_currency")?.value?.toUpperCase();
  if (cookieValue && allowed.has(cookieValue)) return cookieValue;

  // 2. Geo header
  const requestHeaders = await headers();
  const country = requestHeaders.get("x-vercel-ip-country")?.toUpperCase();
  if (country) {
    const code = COUNTRY_TO_CURRENCY[country];
    if (code && allowed.has(code)) return code;
  }

  // 3. Universal fallback
  if (allowed.has("USD")) return "USD";
  if (allowed.has(DEFAULT_CURRENCY_CODE)) return DEFAULT_CURRENCY_CODE;
  return availableCurrencies[0]!.toUpperCase();
}

/**
 * Resolve the billing period for the landing.
 *   1. `pricing_period` cookie (set by the period toggle), validated.
 *   2. Default `"month"`.
 *
 * When `supportsAnnual === false` (some plan lacks an annual Price), we
 * lock to `"month"` regardless of the cookie so users don't see a
 * partial annual catalog.
 */
export async function getPreferredBillingPeriod(
  supportsAnnual: boolean,
): Promise<BillingPeriod> {
  if (!supportsAnnual) return "month";
  const cookieStore = await cookies();
  const raw = cookieStore.get("pricing_period")?.value;
  return isBillingPeriod(raw) ? raw : "month";
}
