import "server-only";
import Stripe from "stripe";

import { PLAN_BY_SLUG, type PlanSlug } from "@/lib/plans";

/**
 * Server-only Stripe client. Pin the API version so changes in the dashboard
 * "default API version" don't silently break us.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Pinned to the latest at the time of writing. Bump deliberately and
  // re-test webhooks (period fields, enums, etc. shift between versions).
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

/**
 * Resolves the Stripe Price ID for a plan from env vars. Throws at request
 * time (not at import) so a missing env var only surfaces when checkout is
 * actually attempted.
 */
export function priceIdForPlan(slug: PlanSlug): string {
  const plan = PLAN_BY_SLUG[slug];
  const priceId = process.env[plan.stripePriceEnvVar];
  if (!priceId) {
    throw new Error(
      `[stripe] Missing env var ${plan.stripePriceEnvVar} for plan "${slug}"`,
    );
  }
  return priceId;
}
