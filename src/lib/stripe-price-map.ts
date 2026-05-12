import "server-only";

import {
  PLANS,
  type BillingPeriod,
  type PlanSlug,
} from "@/lib/plans";

/**
 * Reverse map: `stripe_price_id → { plan, billingInterval }`.
 *
 * The webhook needs this on every `customer.subscription.{created,updated}`
 * event. Stripe Subscription Items carry the new Price after a portal-driven
 * upgrade/downgrade, but the slug we cache on `subscriptions.plan` is our
 * own enum — without a reverse lookup, a user who upgrades Básico → Pro via
 * Customer Portal keeps "basico" in the DB forever.
 *
 * Built lazily from `PLANS × env vars`. The env vars are pinned per env
 * (dev/prod), so the map is stable for the process lifetime — cached on
 * first read. Missing env vars are silently skipped (the plan just won't
 * round-trip for the missing period); we don't throw because annual is
 * legitimately opt-in.
 */

export interface PriceMapping {
  plan: PlanSlug;
  billingInterval: BillingPeriod;
}

let cache: Map<string, PriceMapping> | null = null;

function ensureCache(): Map<string, PriceMapping> {
  if (cache) return cache;
  const next = new Map<string, PriceMapping>();
  for (const plan of PLANS) {
    const monthly = readEnv(plan.stripePriceEnvVar);
    if (monthly) next.set(monthly, { plan: plan.slug, billingInterval: "month" });
    if (plan.stripePriceAnnualEnvVar) {
      const annual = readEnv(plan.stripePriceAnnualEnvVar);
      if (annual) next.set(annual, { plan: plan.slug, billingInterval: "year" });
    }
  }
  cache = next;
  return cache;
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim() === "") return null;
  return value.trim();
}

/**
 * Find which plan + period a Stripe Price belongs to. Returns null when
 * the ID isn't part of our catalogue — the caller decides whether to
 * keep the existing plan or surface an error.
 */
export function priceIdToPlan(priceId: string): PriceMapping | null {
  return ensureCache().get(priceId) ?? null;
}

/**
 * Test seam: force the cache to rebuild on next read. The env vars are
 * stable in normal runtime, but tests / dev hot-reloads sometimes need
 * to bust the memo after rewriting `.env`.
 */
export function _resetStripePriceMapForTests(): void {
  cache = null;
}

/** Read Stripe's recurring interval ("month" | "year") off a Subscription
 *  Item and narrow it to our app's `BillingPeriod`. Anything else (week,
 *  day) collapses to "month" because our app only sells those two cadences
 *  — guarded so an exotic price doesn't crash the webhook. */
export function stripeIntervalToBillingPeriod(
  interval: string | null | undefined,
): BillingPeriod {
  return interval === "year" ? "year" : "month";
}
