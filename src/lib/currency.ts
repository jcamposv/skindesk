import { z } from "zod";

/**
 * Single source of truth for the business-currency picker.
 *
 * - The list is the *display* contract for the settings UI (flag + country
 *   + currency name + ISO code).
 * - `CURRENCY_CODES` derives from this list and is what we persist in the
 *   `tenants.currency` column and validate at every boundary.
 * - `formatMoney` is the only place in the app that calls
 *   `Intl.NumberFormat` for business money. Never inline.
 *
 * Locale is currency-paired (not user-locale) so a number rendered as
 * `MX$1,200` always reads the same regardless of who's signed in.
 *
 * Update this list AND `supabase/migrations/.._tenants_currency.sql`
 * together — the DB has a CHECK constraint pinning the same set.
 *
 * Stripe / SaaS subscription pricing lives outside this module — that's
 * USD on the SkinDesk billing side, separate from the professional's
 * business currency.
 */
export interface Currency {
  countryCode: string;
  countryName: string;
  flag: string;
  currencyCode: string;
  currencyName: string;
  locale: string;
}

export const CURRENCIES: readonly Currency[] = [
  // Initial-market default — Mexico.
  {
    countryCode: "MX",
    countryName: "México",
    flag: "🇲🇽",
    currencyCode: "MXN",
    currencyName: "Peso mexicano",
    locale: "es-MX",
  },
  // USD shown second — both the global reserve and the official currency
  // of Ecuador, El Salvador, Panama, Puerto Rico.
  {
    countryCode: "US",
    countryName: "Estados Unidos",
    flag: "🇺🇸",
    currencyCode: "USD",
    currencyName: "Dólar estadounidense",
    locale: "en-US",
  },
  {
    countryCode: "CR",
    countryName: "Costa Rica",
    flag: "🇨🇷",
    currencyCode: "CRC",
    currencyName: "Colón costarricense",
    locale: "es-CR",
  },
  {
    countryCode: "CO",
    countryName: "Colombia",
    flag: "🇨🇴",
    currencyCode: "COP",
    currencyName: "Peso colombiano",
    locale: "es-CO",
  },
  {
    countryCode: "NI",
    countryName: "Nicaragua",
    flag: "🇳🇮",
    currencyCode: "NIO",
    currencyName: "Córdoba nicaragüense",
    locale: "es-NI",
  },
  {
    countryCode: "GT",
    countryName: "Guatemala",
    flag: "🇬🇹",
    currencyCode: "GTQ",
    currencyName: "Quetzal guatemalteco",
    locale: "es-GT",
  },
  {
    countryCode: "HN",
    countryName: "Honduras",
    flag: "🇭🇳",
    currencyCode: "HNL",
    currencyName: "Lempira hondureña",
    locale: "es-HN",
  },
  {
    countryCode: "AR",
    countryName: "Argentina",
    flag: "🇦🇷",
    currencyCode: "ARS",
    currencyName: "Peso argentino",
    locale: "es-AR",
  },
  {
    countryCode: "BO",
    countryName: "Bolivia",
    flag: "🇧🇴",
    currencyCode: "BOB",
    currencyName: "Boliviano",
    locale: "es-BO",
  },
  {
    countryCode: "CL",
    countryName: "Chile",
    flag: "🇨🇱",
    currencyCode: "CLP",
    currencyName: "Peso chileno",
    locale: "es-CL",
  },
  {
    countryCode: "CU",
    countryName: "Cuba",
    flag: "🇨🇺",
    currencyCode: "CUP",
    currencyName: "Peso cubano",
    locale: "es-CU",
  },
  {
    countryCode: "DO",
    countryName: "República Dominicana",
    flag: "🇩🇴",
    currencyCode: "DOP",
    currencyName: "Peso dominicano",
    locale: "es-DO",
  },
  {
    countryCode: "PY",
    countryName: "Paraguay",
    flag: "🇵🇾",
    currencyCode: "PYG",
    currencyName: "Guaraní paraguayo",
    locale: "es-PY",
  },
  {
    countryCode: "PE",
    countryName: "Perú",
    flag: "🇵🇪",
    currencyCode: "PEN",
    currencyName: "Sol peruano",
    locale: "es-PE",
  },
  {
    countryCode: "PA",
    countryName: "Panamá",
    flag: "🇵🇦",
    currencyCode: "PAB",
    currencyName: "Balboa panameña",
    locale: "es-PA",
  },
  {
    countryCode: "UY",
    countryName: "Uruguay",
    flag: "🇺🇾",
    currencyCode: "UYU",
    currencyName: "Peso uruguayo",
    locale: "es-UY",
  },
  {
    countryCode: "VE",
    countryName: "Venezuela",
    flag: "🇻🇪",
    currencyCode: "VES",
    currencyName: "Bolívar venezolano",
    locale: "es-VE",
  },
];

export const DEFAULT_CURRENCY_CODE = "MXN" as const;

/** ISO-4217 codes we persist + accept on the wire.
 *  Cast via `unknown` because TS can't prove the runtime array is
 *  non-empty from the static `CURRENCIES` definition. */
export const CURRENCY_CODES = CURRENCIES.map(
  (c) => c.currencyCode,
) as unknown as readonly [string, ...string[]];

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const currencyCodeSchema = z.enum(
  CURRENCY_CODES as unknown as [CurrencyCode, ...CurrencyCode[]],
);

const CURRENCY_BY_CODE: Record<string, Currency> = Object.fromEntries(
  CURRENCIES.map((c) => [c.currencyCode, c]),
);

/** Read a currency descriptor by ISO code. Falls back to the default
 *  (never throws) so a stale value in localStorage / a stale prop can't
 *  blank the screen. */
export function getCurrency(code: string | null | undefined): Currency {
  if (code && CURRENCY_BY_CODE[code]) return CURRENCY_BY_CODE[code];
  return CURRENCY_BY_CODE[DEFAULT_CURRENCY_CODE];
}

/**
 * The ONLY function in the app that formats business money. Every other
 * call site (server component, client hook, CSV exporter, toast string)
 * routes through here.
 *
 * `maximumFractionDigits: 0` matches the previous `formatCurrency` so the
 * display stays consistent — currencies like CLP and PYG never use
 * fractions anyway, and even ones that do (MXN, USD) read cleaner
 * rounded for KPI tiles. If a future surface needs cents, pass
 * `{ maximumFractionDigits: 2 }` explicitly.
 */
export function formatMoney(
  amount: number,
  currencyCode: string | null | undefined,
  options?: { maximumFractionDigits?: number },
): string {
  const c = getCurrency(currencyCode);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.currencyCode,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(amount);
}

/**
 * Currency symbol as the user's locale renders it (e.g. `$`, `MX$`,
 * `S/`, `Bs`). Used for input prefixes, chart Y-axis ticks and any
 * placeholder where the full `formatMoney` output is too long.
 *
 * Cheap to call — `formatToParts(0)` is pure JS. We still memoise per
 * code at module scope because every keystroke in `CurrencyInput`
 * re-renders the parent and we don't want to spin up an `Intl` formatter
 * on every paint.
 */
const SYMBOL_CACHE = new Map<string, string>();

export function getCurrencySymbol(currencyCode: string | null | undefined): string {
  const c = getCurrency(currencyCode);
  const cached = SYMBOL_CACHE.get(c.currencyCode);
  if (cached) return cached;
  const parts = new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.currencyCode,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? "$";
  SYMBOL_CACHE.set(c.currencyCode, symbol);
  return symbol;
}

/**
 * Thousand + decimal separators for the locale's number format.
 *
 * `Intl.NumberFormat(locale)` is the canonical answer: format `1234.5`,
 * look at `formatToParts` for the `group` and `decimal` parts.
 *   · es-MX / es-AR / es-CO → `{ thousand: ".", decimal: "," }`
 *   · en-US / en-EC          → `{ thousand: ",", decimal: "." }`
 *
 * Used by `CurrencyInput` so the visual masking matches what users from
 * each region actually type ("$1,234.56" in US vs "$1.234,56" in MX).
 * Cached because the values never change for a given locale.
 */
const SEPARATOR_CACHE = new Map<string, { thousand: string; decimal: string }>();

export function getNumberSeparators(
  locale: string,
): { thousand: string; decimal: string } {
  const cached = SEPARATOR_CACHE.get(locale);
  if (cached) return cached;
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  const thousand = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const result = { thousand, decimal };
  SEPARATOR_CACHE.set(locale, result);
  return result;
}
