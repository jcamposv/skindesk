import "server-only";

import { stripe } from "@/lib/stripe";
import {
  PLANS,
  type BillingPeriod,
  type Plan,
  type PlanSlug,
} from "@/lib/plans";

/**
 * Live plan pricing fetched from Stripe.
 *
 * Architecture
 * ─────────────
 * Stripe is the source of truth for amounts and currencies. We read each
 * plan's monthly + (optional) annual Price via the SDK with
 * `currency_options` expanded, then build a flat map the UI consumes:
 *
 *   getPlanPricing() → Record<PlanSlug, { monthly, annual: ... | null }>
 *
 * Each period entry knows its Stripe `priceId` (what we pass to Checkout
 * Session line items) plus a `currencies` map keyed by uppercase ISO code.
 * When you ship "MXN" to Checkout, Stripe picks the matching
 * `currency_option` automatically — no client-side conversion.
 *
 * Caching
 * ───────
 * Module-level Map with a 5-minute TTL. Stripe prices change rarely, and
 * a stale entry never causes a charge mismatch (Checkout re-validates
 * server-side). 5 min keeps the landing snappy on cold starts without
 * leaving stale prices visible for long.
 *
 * Fallback
 * ────────
 * If the Stripe call throws (missing key in preview, network blip),
 * we synthesise a USD-only response from `plan.usdFallbackCents`. The
 * landing stays up; the toggle to non-USD currencies is hidden.
 *
 * Trap avoided
 * ────────────
 * Annual is OPT-IN per plan. If `stripePriceAnnualEnvVar` is unset OR the
 * env var is blank, the plan returns `annual: null` and the landing hides
 * the period toggle entirely.
 */

export interface PriceInfo {
  /** Stripe Price ID — what Checkout Sessions reference. */
  priceId: string;
  /** ISO code of the Price's primary currency (uppercase). */
  primaryCurrency: string;
  /** Every currency the price offers, including the primary. Values are
   *  `unit_amount` in the currency's smallest unit (cents/centavos). */
  currencies: Record<string, { unitAmount: number }>;
  /** `month` | `year`. Always 1 in our catalog. */
  intervalCount: number;
}

export interface PlanPriceBundle {
  monthly: PriceInfo;
  annual: PriceInfo | null;
}

export type PlanPricing = Record<PlanSlug, PlanPriceBundle>;

interface CacheEntry {
  data: PlanPricing;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CacheEntry | null = null;

export async function getPlanPricing(): Promise<PlanPricing> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  const data = await fetchPricingFromStripe();
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

/** Force a refresh on the next read. Wire this to a `price.updated`
 *  webhook later if pricing changes need to propagate within seconds. */
export function invalidatePlanPricingCache(): void {
  cache = null;
}

// ─── Internals ──────────────────────────────────────────────────────────────

async function fetchPricingFromStripe(): Promise<PlanPricing> {
  const result: Partial<PlanPricing> = {};

  // Fetch each plan's prices in parallel. One failure doesn't take down the
  // whole landing — we substitute the offending plan with its USD fallback.
  await Promise.all(
    PLANS.map(async (plan) => {
      try {
        const monthlyPriceId = readEnv(plan.stripePriceEnvVar);
        if (!monthlyPriceId) {
          throw new Error(
            `Missing ${plan.stripePriceEnvVar} — set the env var with the Stripe Price ID.`,
          );
        }
        const annualPriceId = plan.stripePriceAnnualEnvVar
          ? readEnv(plan.stripePriceAnnualEnvVar)
          : null;

        const [monthlyPrice, annualPrice] = await Promise.all([
          stripe.prices.retrieve(monthlyPriceId, {
            expand: ["currency_options"],
          }),
          annualPriceId
            ? stripe.prices.retrieve(annualPriceId, {
                expand: ["currency_options"],
              })
            : Promise.resolve(null),
        ]);

        // Misconfiguration guard: an archived Price still resolves via
        // `prices.retrieve`, so the env var pointing at the wrong id would
        // silently serve stale amounts. Warn loudly — the landing keeps
        // working (Stripe still honours archived prices at Checkout) but
        // the operator sees the issue in logs.
        if (monthlyPrice.active === false) {
          console.warn(
            `[pricing] STRIPE_PRICE_${plan.slug.toUpperCase()} → ${monthlyPriceId} is INACTIVE (archived). Update the env var.`,
          );
        }
        if (annualPrice && annualPrice.active === false) {
          console.warn(
            `[pricing] ${plan.stripePriceAnnualEnvVar} → ${annualPriceId} is INACTIVE (archived). Update the env var.`,
          );
        }

        result[plan.slug] = {
          monthly: stripePriceToInfo(monthlyPrice),
          annual: annualPrice ? stripePriceToInfo(annualPrice) : null,
        };
      } catch (err) {
        console.warn(
          `[pricing] Stripe fetch failed for plan "${plan.slug}":`,
          err instanceof Error ? err.message : err,
        );
        result[plan.slug] = fallbackBundle(plan);
      }
    }),
  );

  return result as PlanPricing;
}

/** Translate a Stripe `Price` object into our flat shape. The SDK returns
 *  `currency_options` as an object whose keys are *lowercase* ISO codes;
 *  we uppercase them so consumers don't have to think about case. */
function stripePriceToInfo(
  price: import("stripe").Stripe.Price,
): PriceInfo {
  const currencies: Record<string, { unitAmount: number }> = {};

  // Primary currency lands first so it's always present even if
  // currency_options is empty.
  const primary = price.currency.toUpperCase();
  if (price.unit_amount != null) {
    currencies[primary] = { unitAmount: price.unit_amount };
  }

  // `currency_options` is a map keyed by lowercase ISO code; values have
  // `unit_amount` in the smallest unit. The primary currency may also
  // appear in this map — last write wins, both should agree.
  const opts = price.currency_options ?? {};
  for (const [code, opt] of Object.entries(opts)) {
    if (opt?.unit_amount != null) {
      currencies[code.toUpperCase()] = { unitAmount: opt.unit_amount };
    }
  }

  return {
    priceId: price.id,
    primaryCurrency: primary,
    currencies,
    intervalCount: price.recurring?.interval_count ?? 1,
  };
}

function fallbackBundle(plan: Plan): PlanPriceBundle {
  return {
    monthly: {
      priceId: "",
      primaryCurrency: "USD",
      currencies: { USD: { unitAmount: plan.usdFallbackCents.month } },
      intervalCount: 1,
    },
    annual:
      plan.usdFallbackCents.year != null
        ? {
            priceId: "",
            primaryCurrency: "USD",
            currencies: { USD: { unitAmount: plan.usdFallbackCents.year } },
            intervalCount: 1,
          }
        : null,
  };
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim() === "") return null;
  return value.trim();
}

// ─── Helpers exported for the UI ────────────────────────────────────────────

/**
 * True when every plan has both a monthly AND an annual price configured.
 * The landing uses this to decide whether to render the mensual↔anual
 * toggle — when one plan lacks annual, we hide the toggle so we never
 * land on a state where a card has nothing to render.
 */
export function pricingSupportsAnnual(pricing: PlanPricing): boolean {
  return Object.values(pricing).every((b) => b.annual !== null);
}

/**
 * The set of currencies offered by EVERY plan in the given period — the
 * intersection. Drives the currency toggle: a currency is only selectable
 * if all three plans can be quoted in it.
 */
export function commonCurrencies(
  pricing: PlanPricing,
  period: BillingPeriod,
): string[] {
  const bundles = Object.values(pricing);
  if (bundles.length === 0) return ["USD"];
  const first = bundles[0]![period === "month" ? "monthly" : "annual"];
  if (!first) return ["USD"];

  const candidate = Object.keys(first.currencies);
  return candidate.filter((code) =>
    bundles.every((b) => {
      const info = period === "month" ? b.monthly : b.annual;
      return info != null && code in info.currencies;
    }),
  );
}

/**
 * Look up the priceId + unit amount for a (plan, period, currency) tuple,
 * falling back to the primary currency of the requested period.
 */
export function resolvePrice(
  pricing: PlanPricing,
  slug: PlanSlug,
  period: BillingPeriod,
  currency: string,
): { priceId: string; unitAmount: number; currency: string } | null {
  const bundle = pricing[slug];
  const info = period === "month" ? bundle.monthly : bundle.annual;
  if (!info) return null;

  const upper = currency.toUpperCase();
  const direct = info.currencies[upper];
  if (direct) {
    return {
      priceId: info.priceId,
      unitAmount: direct.unitAmount,
      currency: upper,
    };
  }
  // Fallback: the requested currency isn't configured on this Price. Log
  // so the operator notices — they probably forgot to add the currency
  // option in Stripe, or `commonCurrencies()` filtering let a code through
  // that it shouldn't have.
  console.warn(
    `[pricing] resolvePrice fallback: plan=${slug} period=${period} requested=${upper} → primary=${info.primaryCurrency}`,
  );
  const primary = info.currencies[info.primaryCurrency];
  if (primary) {
    return {
      priceId: info.priceId,
      unitAmount: primary.unitAmount,
      currency: info.primaryCurrency,
    };
  }
  return null;
}
