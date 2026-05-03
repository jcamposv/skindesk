"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

import { checkoutSchema } from "@/schemas/checkout.schema";
import { PLAN_BY_SLUG } from "@/lib/plans";
import { priceIdForPlan, stripe } from "@/lib/stripe";
import type { ActionState } from "@/types/supabase";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Deterministic key so a double-submit (slow network, user double-clicks)
 * within the same 5-minute window returns the existing Stripe session
 * instead of creating a duplicate. After 5 minutes a fresh retry gets a
 * new session — that's intentional, the plan/inputs may have changed.
 */
function checkoutIdempotencyKey(input: {
  email: string;
  plan: string;
  fullName: string;
  businessName: string;
}): string {
  const fiveMinBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return createHash("sha256")
    .update(
      `${input.email}|${input.plan}|${input.fullName}|${input.businessName}|${fiveMinBucket}`,
    )
    .digest("hex")
    .slice(0, 32);
}

/**
 * Builds a Stripe Checkout Session in subscription mode and redirects the
 * caller to Stripe's hosted page. Account creation happens later in the
 * `checkout.session.completed` webhook — we never write to Supabase here.
 *
 * The plan + business_name + full_name are stuffed into `metadata` so the
 * webhook can read them when creating the user/tenant. Email is forwarded
 * to Stripe so the receipt and customer record use the same address.
 */
export async function createCheckoutSessionAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = checkoutSchema.safeParse({
    plan: formData.get("plan"),
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

  const { plan, fullName, email, businessName } = parsed.data;
  const planConfig = PLAN_BY_SLUG[plan];

  // Both the Checkout Session and the resulting Subscription get the same
  // metadata, so the webhook can read it from either object — Stripe doesn't
  // copy session metadata to the subscription automatically.
  const metadata = {
    plan,
    full_name: fullName,
    business_name: businessName,
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
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
          fullName,
          businessName,
        }),
      },
    );
  } catch (err) {
    // Log the raw error for debugging — but NEVER expose Stripe's internal
    // messages to the user (they can leak ids, env detail, or scary jargon).
    console.error("[checkout] stripe.create failed", err);
    return {
      success: false,
      message:
        "No pudimos iniciar el pago. Intentá de nuevo en unos minutos o escribinos si persiste.",
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
