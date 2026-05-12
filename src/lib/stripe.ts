import "server-only";
import Stripe from "stripe";

/**
 * Server-only Stripe client. Pin the API version so changes in the dashboard
 * "default API version" don't silently break us.
 *
 * Per-plan Price ID resolution now lives in `lib/pricing.ts`, which fetches
 * each Price from Stripe at request time and exposes `resolvePrice(slug,
 * period, currency)`. Don't add a sync `priceIdForPlan` helper here —
 * marketing + checkout both need the live multi-currency view.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Pinned to the latest at the time of writing. Bump deliberately and
  // re-test webhooks (period fields, enums, etc. shift between versions).
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});
