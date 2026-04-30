"use server";

import { redirect } from "next/navigation";

import { checkoutSchema } from "@/schemas/checkout.schema";
import { PLAN_BY_SLUG } from "@/lib/plans";
import { priceIdForPlan, stripe } from "@/lib/stripe";
import type { ActionState } from "@/types/supabase";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
    session = await stripe.checkout.sessions.create({
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
    });
  } catch (err) {
    console.error("[checkout] stripe.create failed", err);
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "No pudimos iniciar el pago, intenta de nuevo.",
    };
  }

  if (!session.url) {
    return { success: false, message: "Stripe no devolvió URL de pago." };
  }

  redirect(session.url);
}
