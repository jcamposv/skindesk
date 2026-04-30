"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { stripe } from "@/lib/stripe";
import { createClient, getCurrentSession } from "@/lib/supabase/server";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Creates a Stripe Billing Portal session for the current tenant's customer
 * and redirects to it. The portal lets the profesional change plan, update
 * card, view invoices and cancel — all on Stripe's hosted UI, no extra UX
 * for us to maintain.
 *
 * Requires the Billing Portal to be configured in Stripe Dashboard →
 * Settings → Billing → Customer Portal (default config works fine).
 */
export async function createBillingPortalSessionAction(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  // Only the staff that actually owns a subscription can manage it. Clienta
  // never lands here (her layout doesn't link to /settings).
  if (session.profile.role === "clienta") redirect(ROUTES.dashboard);
  if (!session.profile.tenant_id) redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", session.profile.tenant_id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    // No subscription on file (e.g. super_admin viewing staff /settings).
    // Fail-safe: bounce back home rather than 500'ing.
    redirect(ROUTES.settings);
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl()}${ROUTES.settings}`,
  });

  redirect(portal.url);
}
