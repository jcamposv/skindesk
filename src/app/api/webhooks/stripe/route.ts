import "server-only";
import type Stripe from "stripe";

import { paymentFailedHtml } from "@/components/emails/payment-failed";
import { welcomeProfesionalHtml } from "@/components/emails/welcome-profesional";
import { ROUTES } from "@/lib/constants";
import { isPlanSlug, PLAN_BY_SLUG, type PlanSlug } from "@/lib/plans";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

// Use the Node runtime so we can call `request.text()` for raw signature
// verification. The Edge runtime would also work but the service-role
// client is more comfortable on Node.
export const runtime = "nodejs";
// Webhooks must always go through the handler, not be cached.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "verification failed";
    console.error("[stripe-webhook] signature verification failed", message);
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object);
        break;
      case "invoice.payment_failed":
        // Stripe also fires customer.subscription.updated → past_due, which
        // syncs the cached status. This handler is purely for the user-
        // facing notification.
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        // No-op — log only at info level to keep the inbox clean.
        break;
    }
  } catch (err) {
    // Two error classes:
    //  - Terminal (`TerminalWebhookError`): the event itself is broken
    //    (missing metadata, bad shape). Retrying won't help — return 200
    //    so Stripe stops resending and we surface the issue via logs.
    //  - Transient (anything else): network blips, DB hiccups. Return 500
    //    so Stripe retries with exponential backoff.
    if (err instanceof TerminalWebhookError) {
      console.error(
        `[stripe-webhook] terminal error for ${event.type}, ack with 200:`,
        err.message,
      );
      return new Response("ok", { status: 200 });
    }
    console.error(`[stripe-webhook] handler for ${event.type} failed`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

class TerminalWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerminalWebhookError";
  }
}

/**
 * Map a Stripe subscription status to our DB enum. Stripe occasionally adds
 * new statuses (e.g. `paused`); collapse anything we don't model into a
 * sensible default rather than letting Postgres reject the insert and
 * trigger an infinite Stripe retry loop.
 */
function mapStripeStatus(
  status: Stripe.Subscription.Status,
): Database["public"]["Enums"]["subscription_status"] {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return status;
    // `paused` and any future Stripe-only status: surface as past_due so
    // the dashboard gate knows access should be restricted, without
    // failing the webhook.
    default:
      return "past_due";
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription" || !session.subscription) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const admin = createAdminClient();

  // Idempotency: if we've already created the subscription row for this
  // Stripe subscription, skip everything. Stripe retries webhooks and the
  // dashboard "Resend event" button is one click away.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (existing) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const planRaw = session.metadata?.plan ?? subscription.metadata?.plan;
  if (!isPlanSlug(planRaw)) {
    throw new TerminalWebhookError(
      `missing or invalid plan metadata: ${planRaw} (session ${session.id})`,
    );
  }
  const plan: PlanSlug = planRaw;
  const planConfig = PLAN_BY_SLUG[plan];

  const fullName =
    session.metadata?.full_name ??
    subscription.metadata?.full_name ??
    session.customer_details?.name ??
    "Profesional";
  const businessName =
    session.metadata?.business_name ??
    subscription.metadata?.business_name ??
    fullName;
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    null;
  if (!email) {
    throw new TerminalWebhookError(
      `no email on checkout.session ${session.id}`,
    );
  }

  // 1) Find-or-create the Supabase auth user. This is idempotent on its own
  //    so a retry after a partial failure (e.g. user created, subscription
  //    insert failed) will just reuse the existing user.
  const userId = await ensureProfesionalUser(admin, {
    email,
    fullName,
    businessName,
  });

  // 2) The handle_new_user trigger created a tenant for this profesional.
  //    Read its id (we own it via owner_id).
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (tenantErr || !tenant) {
    throw new TerminalWebhookError(
      `no tenant for owner ${userId}: ${tenantErr?.message}`,
    );
  }

  // 3) Persist the subscription AND mint the activation magic link in
  //    parallel — the two operations are independent (insert needs tenant.id
  //    + subscription details which we already have, generateLink only needs
  //    the email). Saves ~100-200ms on the webhook handler. Stripe API
  //    ≥2026-04 moved current_period_start/end onto SubscriptionItem; read
  //    them from the first (and, in our case, only) item.
  const item = subscription.items.data[0];
  const status = mapStripeStatus(subscription.status);
  const [subInsert, linkResult] = await Promise.all([
    admin.from("subscriptions").insert({
      tenant_id: tenant.id,
      plan,
      status,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: item.price.id,
      current_period_start: tsToIso(item.current_period_start),
      current_period_end: tsToIso(item.current_period_end),
      trial_end: tsToIso(subscription.trial_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }),
    // After Supabase exchanges the magic-link code, the callback's
    // password_set check will land the user on /auth/setup automatically.
    // The `?next=/auth/setup` here is a hint for older flows that pass
    // through; the callback is the source of truth.
    admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(
          "/auth/setup",
        )}`,
      },
    }),
  ]);

  if (subInsert.error) {
    // Transient: Postgres / network. Let Stripe retry.
    throw new Error(`subscriptions insert failed: ${subInsert.error.message}`);
  }
  if (linkResult.error || !linkResult.data?.properties?.action_link) {
    // Transient: Supabase auth API hiccup. Stripe retry will replay this
    // event; idempotency on subscriptions skips the DB ops, only the email
    // resend executes.
    throw new Error(`generateLink failed: ${linkResult.error?.message}`);
  }
  const linkData = linkResult.data;

  const { error: mailErr } = await resend.emails.send(
    {
      from: EMAIL_FROM,
      to: email,
      subject: "Activá tu cuenta de SkinDesk",
      html: welcomeProfesionalHtml({
        fullName,
        planName: planConfig.name,
        magicLink: linkData.properties.action_link,
        appUrl: appUrl(),
      }),
    },
    { idempotencyKey: `welcome-profesional/${subscription.id}` },
  );
  if (mailErr) {
    // Don't throw — the account is fully provisioned. A failed email is
    // recoverable from the user's side ("forgot my magic link" → request
    // again). Log loudly so we notice.
    console.error("[stripe] welcome email failed", mailErr.message);
  }
}

// ---------------------------------------------------------------------------
// customer.subscription.updated / deleted
// ---------------------------------------------------------------------------

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
): Promise<void> {
  const admin = createAdminClient();
  const status = mapStripeStatus(subscription.status);
  const item = subscription.items.data[0];

  await admin
    .from("subscriptions")
    .update({
      status,
      stripe_price_id: item.price.id,
      current_period_start: tsToIso(item.current_period_start),
      current_period_end: tsToIso(item.current_period_end),
      trial_end: tsToIso(subscription.trial_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? tsToIso(subscription.canceled_at)
        : null,
    })
    .eq("stripe_subscription_id", subscription.id);
}

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  // The matching customer.subscription.updated event already flipped the
  // tenant cache to past_due (driving the in-app banner). Here we only
  // notify the customer.
  // Stripe API ≥2026-04 nests the subscription ref under invoice.parent.
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;
  const email = invoice.customer_email;
  if (!email) return;

  const admin = createAdminClient();
  const { data: subRow } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  // No row yet (e.g. failed invoice fired before checkout.session.completed
  // landed) — skip rather than guess. We'll catch it on the next cycle.
  if (!subRow) return;

  const planConfig = PLAN_BY_SLUG[subRow.plan];
  const amountDue = formatStripeAmount(invoice.amount_due, invoice.currency);
  const nextAttempt = invoice.next_payment_attempt
    ? formatSpanishDate(invoice.next_payment_attempt)
    : null;

  const { error: mailErr } = await resend.emails.send(
    {
      from: EMAIL_FROM,
      to: email,
      subject: "Tu pago de SkinDesk no se procesó",
      html: paymentFailedHtml({
        planName: planConfig.name,
        amountDue,
        nextAttempt,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        manageBillingUrl: `${appUrl()}${ROUTES.settings}`,
      }),
    },
    { idempotencyKey: `payment-failed/${invoice.id}` },
  );
  if (mailErr) {
    console.error("[stripe] payment-failed email failed", mailErr.message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureProfesionalUser(
  admin: ReturnType<typeof createAdminClient>,
  args: { email: string; fullName: string; businessName: string },
): Promise<string> {
  // Try to create first — the common case is a brand-new user.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: args.email,
    email_confirm: true,
    app_metadata: { role: "profesional" },
    user_metadata: {
      full_name: args.fullName,
      business_name: args.businessName,
    },
  });
  if (!error && created.user) return created.user.id;

  // Duplicate email path (e.g. user retried checkout, or test environments).
  // Look up via the indexed `profiles.email` (lower(email)) — single round
  // trip, scales to any tenant volume, doesn't depend on listUsers pagination.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", args.email)
    .maybeSingle();
  if (profile) return profile.id;

  throw new TerminalWebhookError(
    `could not create or find user for ${args.email}: ${error?.message ?? "not found"}`,
  );
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function tsToIso(ts: number | null | undefined): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/**
 * Stripe API ≥2026-04 moved the subscription ref off `invoice.subscription`
 * and onto `invoice.parent.subscription_details.subscription`. Returns the
 * id (or null) regardless of whether the field is expanded.
 */
function subscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details") return null;
  const sub = parent.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

const SPANISH_DATE = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatSpanishDate(unixSeconds: number): string {
  return SPANISH_DATE.format(new Date(unixSeconds * 1000));
}

function formatStripeAmount(amountSmallestUnit: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountSmallestUnit / 100);
}
