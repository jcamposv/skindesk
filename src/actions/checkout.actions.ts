"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

import { checkoutSchema } from "@/schemas/checkout.schema";
import { PLAN_BY_SLUG } from "@/lib/plans";
import {
  commonCurrencies,
  getPlanPricing,
  resolvePrice,
} from "@/lib/pricing";
import { getPreferredPricingCurrency } from "@/lib/pricing-currency";
import { stripe } from "@/lib/stripe";
import type { ActionState } from "@/types/supabase";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Deterministic key so a double-submit (slow network, user double-clicks)
 * within the same 5-minute window returns the existing Stripe session
 * instead of creating a duplicate. Plan + period + currency are all in
 * the key so swapping any of them creates a fresh session — the user's
 * intent has changed.
 */
function checkoutIdempotencyKey(input: {
  email: string;
  plan: string;
  period: string;
  currency: string;
  fullName: string;
  businessName: string;
}): string {
  const fiveMinBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return createHash("sha256")
    .update(
      [
        input.email,
        input.plan,
        input.period,
        input.currency,
        input.fullName,
        input.businessName,
        fiveMinBucket,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

/**
 * Builds a Stripe Checkout Session in subscription mode and redirects
 * the caller to Stripe's hosted page. Account creation happens later in
 * the `checkout.session.completed` webhook — we never write to Supabase
 * here.
 *
 * The plan + business_name + full_name are stuffed into `metadata` so
 * the webhook can read them when creating the user/tenant. Email is
 * forwarded to Stripe so the receipt and customer record use the same
 * address.
 *
 * Multi-currency
 * ──────────────
 * Currency comes from cookie (set by the marketing toggle) → geo
 * detection → USD fallback, intersected with what Stripe actually
 * offers for the chosen (plan, period). We pass the lowercase ISO code
 * to `sessions.create({ currency })`; Stripe then resolves the matching
 * `currency_option` on the referenced Price. If the price doesn't
 * support the chosen currency, Stripe charges in its primary currency.
 *
 * Period (mensual / anual)
 * ────────────────────────
 * Annual is opt-in per plan via `STRIPE_PRICE_<SLUG>_ANNUAL`. If the
 * submitted period isn't available for the plan, we fall back to
 * monthly so the user always reaches Checkout instead of an error.
 */
export async function createCheckoutSessionAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  // Period coercion: any missing/empty value lands on monthly. The
  // schema itself stays strict (`z.enum`) so a malformed string surfaces
  // as a form error rather than silently becoming the default.
  const rawPeriod = formData.get("period");
  const periodInput =
    typeof rawPeriod === "string" && rawPeriod.length > 0 ? rawPeriod : "month";

  const parsed = checkoutSchema.safeParse({
    plan: formData.get("plan"),
    period: periodInput,
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    businessName: formData.get("businessName"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los datos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { plan, period, fullName, email, businessName } = parsed.data;
  const planConfig = PLAN_BY_SLUG[plan];

  // Resolve the right (priceId, currency) pair from live Stripe data.
  // Cookie/geo currency preference is filtered against the plan's
  // actually-supported set so we never ship Stripe a currency it can't
  // honour.
  const pricing = await getPlanPricing();
  const requestedPeriod = period;
  const effectivePeriod = pricing[plan].annual ? requestedPeriod : "month";
  const available = commonCurrencies(pricing, effectivePeriod);
  const currency = await getPreferredPricingCurrency(available);
  const resolved = resolvePrice(pricing, plan, effectivePeriod, currency);

  if (!resolved || !resolved.priceId) {
    console.error("[checkout] no Stripe price for", {
      plan,
      period: effectivePeriod,
      currency,
    });
    return {
      success: false,
      message:
        "No pudimos preparar el pago. Avísanos para revisar la configuración.",
    };
  }

  // Both the Checkout Session and the resulting Subscription get the
  // same metadata, so the webhook can read it from either object —
  // Stripe doesn't copy session metadata to the subscription
  // automatically.
  const metadata = {
    plan,
    period: effectivePeriod,
    currency: resolved.currency,
    full_name: fullName,
    business_name: businessName,
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: resolved.priceId, quantity: 1 }],
        // Stripe expects lowercase ISO; `resolved.currency` is upper.
        currency: resolved.currency.toLowerCase(),
        // Trial flips on/off via plan config; the super admin can later
        // toggle trials per-plan from the dashboard once that UI exists.
        subscription_data: {
          ...(planConfig.trialDays > 0
            ? { trial_period_days: planConfig.trialDays }
            : {}),
          metadata,
        },
        metadata,
        success_url: `${appUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl()}/?canceled=1`,
        // Allow promo codes for launch incentives.
        allow_promotion_codes: true,
      },
      {
        idempotencyKey: checkoutIdempotencyKey({
          email,
          plan,
          period: effectivePeriod,
          currency: resolved.currency,
          fullName,
          businessName,
        }),
      },
    );
  } catch (err) {
    // Log the raw error for debugging — but NEVER expose Stripe's
    // internal messages to the user (they can leak ids, env detail, or
    // scary jargon).
    console.error("[checkout] stripe.create failed", err);
    return {
      success: false,
      message:
        "No pudimos iniciar el pago. Intentá de nuevo en unos minutos o escríbenos si persiste.",
    };
  }

  if (!session.url) {
    console.error("[checkout] stripe returned no session.url", session.id);
    return {
      success: false,
      message: "No pudimos iniciar el pago. Intentá de nuevo en unos minutos.",
    };
  }

  redirect(session.url);
}
