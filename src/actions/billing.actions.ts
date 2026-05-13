"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import type { ActionState } from "@/types/supabase";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

const RETURN_URL = `${appUrl()}${ROUTES.settings}?from=portal`;
// Distinct return URL after the cancel-flow specifically completes — used
// by the settings page to show a "Suscripción cancelada" toast in addition
// to the generic refresh.
const CANCELED_RETURN_URL = `${appUrl()}${ROUTES.settings}?from=portal&action=canceled`;

/**
 * Loads the tenant's billing context (customer + subscription IDs) for the
 * current session, redirecting on edge cases. Used by the two portal
 * actions below.
 */
async function getBillingContext(): Promise<{
  customerId: string;
  subscriptionId: string | null;
}> {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role === "clienta") redirect(ROUTES.dashboard);
  if (!session.profile.tenant_id) redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("tenant_id", session.profile.tenant_id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    // No subscription on file (e.g. super_admin viewing staff /settings).
    // Fail-safe: bounce back home rather than 500'ing.
    redirect(ROUTES.settings);
  }

  return {
    customerId: subscription.stripe_customer_id,
    subscriptionId: subscription.stripe_subscription_id ?? null,
  };
}

/**
 * Generic Billing Portal session — no specific flow. The user can do
 * anything (update card, view invoices, change plan, cancel). Stripe does
 * not auto-redirect from this surface; the user clicks "Return to ..."
 * when they're done.
 */
export async function createBillingPortalSessionAction(): Promise<void> {
  const { customerId } = await getBillingContext();

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    // `?from=portal` flags the return for `<PortalReturnRefresh>` on the
    // settings page — it triggers a couple of soft router.refresh() calls
    // to close the race between Stripe's redirect and the webhook.
    return_url: RETURN_URL,
  });

  redirect(portal.url);
}

/**
 * Cancel-only Billing Portal flow. Drops the user straight onto Stripe's
 * cancel confirmation screen and — because we set `flow_data.
 * after_completion.redirect` — auto-redirects back to /settings the
 * moment they confirm. Used by the "Cancelar suscripción" secondary
 * action so the user doesn't have to click "Return to …" manually after
 * canceling.
 */
export async function createCancelSubscriptionPortalAction(): Promise<void> {
  const { customerId, subscriptionId } = await getBillingContext();
  if (!subscriptionId) {
    // Without a Stripe subscription id we can't open the cancel flow —
    // fail safe by bouncing back to settings (the user wasn't going to
    // be able to cancel anyway).
    redirect(ROUTES.settings);
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: RETURN_URL,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: { subscription: subscriptionId },
      after_completion: {
        type: "redirect",
        redirect: { return_url: CANCELED_RETURN_URL },
      },
    },
  });

  redirect(portal.url);
}

// ---------------------------------------------------------------------------
// API-direct cancel / reactivate
// ---------------------------------------------------------------------------
//
// These actions skip the Stripe Billing Portal entirely: they call the
// Stripe API server-side (`subscriptions.update(... cancel_at_period_end)`)
// and write the result straight onto our `subscriptions` row via the admin
// client. The Postgres trigger then mirrors `cancel_at_period_end` and
// friends to `tenants` synchronously, so by the time the action returns
// the next render reads the new state — no portal hop, no webhook race.
//
// Webhook still fires asynchronously and re-confirms the same state; the
// double-write is harmless because the values converge.

/**
 * Schedule cancellation of the current tenant's subscription at the end
 * of the current billing period. The user keeps access until then.
 */
export async function cancelSubscriptionAction(): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "No hay sesión activa." };
  if (session.profile.role !== "profesional" || !session.profile.tenant_id) {
    return {
      success: false,
      message: "Solo la profesional dueña del tenant puede cancelar.",
    };
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id")
    .eq("tenant_id", session.profile.tenant_id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return {
      success: false,
      message: "No encontramos una suscripción activa para tu cuenta.",
    };
  }

  try {
    const updated = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true },
    );

    // Reflect the change locally without waiting for the webhook so the
    // settings page re-renders with the new state immediately. The trigger
    // keeps `tenants.cancel_at_period_end` in sync.
    await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: updated.cancel_at_period_end,
        canceled_at: updated.canceled_at
          ? new Date(updated.canceled_at * 1000).toISOString()
          : null,
      })
      .eq("id", subscription.id);
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "No pudimos cancelar la suscripción. Prueba de nuevo.",
    };
  }

  revalidatePath(ROUTES.settings);
  return {
    success: true,
    message: "Cancelación programada. Manténs acceso hasta el fin del período.",
  };
}

/**
 * Undo a scheduled cancellation. Flips `cancel_at_period_end` back to
 * `false`; the subscription continues renewing as before.
 */
export async function reactivateSubscriptionAction(): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { success: false, message: "No hay sesión activa." };
  if (session.profile.role !== "profesional" || !session.profile.tenant_id) {
    return {
      success: false,
      message: "Solo la profesional dueña del tenant puede reactivar.",
    };
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id")
    .eq("tenant_id", session.profile.tenant_id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return {
      success: false,
      message: "No encontramos una suscripción para reactivar.",
    };
  }

  try {
    const updated = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: false },
    );

    await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: updated.cancel_at_period_end,
        canceled_at: null,
      })
      .eq("id", subscription.id);
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "No pudimos reactivar la suscripción. Prueba de nuevo.",
    };
  }

  revalidatePath(ROUTES.settings);
  return {
    success: true,
    message: "Suscripción reactivada. Tu plan continúa renovándose.",
  };
}
