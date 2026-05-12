import "server-only";
import type Stripe from "stripe";

import { paymentFailedHtml } from "@/components/emails/payment-failed";
import { welcomeProfesionalHtml } from "@/components/emails/welcome-profesional";
import { ROUTES } from "@/lib/constants";
import {
  isPlanSlug,
  PLAN_BY_SLUG,
  type BillingPeriod,
  type PlanSlug,
} from "@/lib/plans";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { stripe } from "@/lib/stripe";
import {
  priceIdToPlan,
  stripeIntervalToBillingPeriod,
} from "@/lib/stripe-price-map";
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

  // Event-level idempotency. Insert-or-update the row at the very top so
  // a parallel delivery of the same event sees the row + bails. We DON'T
  // bail solely on existence: if a previous attempt failed transiently,
  // `processed_at` stays NULL and we re-run. Only fully-processed events
  // (processed_at NOT NULL) short-circuit.
  const admin = createAdminClient();

  const { data: eventRow, error: eventInsertErr } = await admin
    .from("stripe_webhook_events")
    .upsert(
      {
        event_id: event.id,
        event_type: event.type,
        // received_at default applies on first insert; ON CONFLICT updates
        // nothing meaningful — we just want the SELECT projection back.
      },
      { onConflict: "event_id", ignoreDuplicates: false },
    )
    .select("processed_at")
    .single();

  if (eventInsertErr) {
    console.error(
      `[stripe-webhook ${event.id} ${event.type}] event-log insert failed`,
      eventInsertErr.message,
    );
    return new Response("Handler error", { status: 500 });
  }
  if (eventRow?.processed_at) {
    console.log(
      `[stripe-webhook ${event.id} ${event.type}] dedup: already processed at ${eventRow.processed_at}`,
    );
    return new Response("ok", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // All three converge on the same upsert. `created` is the safety
        // net for the rare case where it arrives before
        // `checkout.session.completed` finishes; `deleted` flips
        // status='canceled' which the layout hard-gate already handles.
        await handleSubscriptionChange(event);
        break;
      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event);
        break;
      case "invoice.payment_failed":
        // Stripe also fires customer.subscription.updated → past_due, which
        // syncs the cached status. This handler is purely for the user-
        // facing notification.
        await handleInvoicePaymentFailed(event);
        break;
      default:
        // No-op — log only at info level to keep the inbox clean.
        break;
    }

    // Mark processed. If this UPDATE fails, the next retry will simply
    // re-process — idempotent handlers above are designed for that.
    await admin
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("event_id", event.id);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "unknown handler failure";

    // Persist the error message on the event row so super_admin forensics
    // can see what blew up without reading Vercel logs.
    await admin
      .from("stripe_webhook_events")
      .update({ error: message.slice(0, 4000) })
      .eq("event_id", event.id);

    // Two error classes:
    //  - Terminal (`TerminalWebhookError`): the event itself is broken
    //    (missing metadata, bad shape). Retrying won't help — return 200
    //    so Stripe stops resending and we surface the issue via logs.
    //  - Transient (anything else): network blips, DB hiccups. Return 500
    //    so Stripe retries with exponential backoff.
    if (err instanceof TerminalWebhookError) {
      console.error(
        `[stripe-webhook ${event.id} ${event.type}] terminal error, ack with 200:`,
        message,
      );
      // Mark as processed since we've decided not to retry — keeps the
      // dedup contract honest (further retries from the "Resend" button
      // also bail). The error message is preserved above.
      await admin
        .from("stripe_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("event_id", event.id);
      return new Response("ok", { status: 200 });
    }
    console.error(
      `[stripe-webhook ${event.id} ${event.type}] handler failed`,
      err,
    );
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

/**
 * Resolve the plan slug for a Subscription. Priority:
 *   1. Reverse lookup from the Price ID (handles portal upgrades).
 *   2. `metadata.plan` (set at Checkout — wrong after portal upgrades).
 *   3. Existing DB row's plan (last-known-good).
 * Throws Terminal if we can't pick anything sane.
 */
function resolvePlan(args: {
  priceId: string;
  metadataPlan: string | null | undefined;
  fallbackPlan: PlanSlug | null;
  eventId: string;
}): { plan: PlanSlug; billingInterval: BillingPeriod | null } {
  const reverse = priceIdToPlan(args.priceId);
  if (reverse) {
    return { plan: reverse.plan, billingInterval: reverse.billingInterval };
  }
  if (isPlanSlug(args.metadataPlan)) {
    console.warn(
      `[stripe-webhook ${args.eventId}] price ${args.priceId} not in reverse map; falling back to metadata.plan=${args.metadataPlan}`,
    );
    return { plan: args.metadataPlan, billingInterval: null };
  }
  if (args.fallbackPlan) {
    console.warn(
      `[stripe-webhook ${args.eventId}] price ${args.priceId} not in reverse map and no metadata; keeping existing plan=${args.fallbackPlan}`,
    );
    return { plan: args.fallbackPlan, billingInterval: null };
  }
  throw new TerminalWebhookError(
    `cannot resolve plan for price ${args.priceId} (no reverse map, metadata, or existing row)`,
  );
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "subscription" || !session.subscription) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const admin = createAdminClient();
  const logPrefix = `[stripe-webhook ${event.id} checkout.session.completed]`;

  // Subscription-row-level idempotency. We still need this even with the
  // event-level dedup at the top — Stripe's "Resend event" button can
  // emit DIFFERENT event_ids that point at the same subscription.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (existing) {
    console.log(`${logPrefix} sub ${subscriptionId} already exists; skipping`);
    return;
  }

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
  //    parallel. Stripe API ≥2026-04 moved current_period_start/end onto
  //    SubscriptionItem; read them from the first (and, in our case,
  //    only) item.
  const item = subscription.items.data[0];
  const status = mapStripeStatus(subscription.status);
  const billingInterval = stripeIntervalToBillingPeriod(
    item.price.recurring?.interval ?? null,
  );

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
      billing_interval: billingInterval,
      current_period_start: tsToIso(item.current_period_start),
      current_period_end: tsToIso(item.current_period_end),
      trial_end: tsToIso(subscription.trial_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      last_event_id: event.id,
      last_event_created: new Date(event.created * 1000).toISOString(),
    }),
    // After Supabase exchanges the magic-link code, the callback's
    // password_set check will land the user on /auth/setup automatically.
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
    throw new Error(`subscriptions insert failed: ${subInsert.error.message}`);
  }
  if (linkResult.error || !linkResult.data?.properties?.action_link) {
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
    console.error(`${logPrefix} welcome email failed`, mailErr.message);
  }

  console.log(
    `${logPrefix} provisioned tenant ${tenant.id} plan=${plan} interval=${billingInterval}`,
  );
}

// ---------------------------------------------------------------------------
// customer.subscription.created / updated / deleted
// ---------------------------------------------------------------------------

async function handleSubscriptionChange(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const admin = createAdminClient();
  const eventCreated = new Date(event.created * 1000).toISOString();
  const logPrefix = `[stripe-webhook ${event.id} ${event.type}]`;

  // Race protection: don't overwrite a row with state older than what we
  // already have. Stripe doesn't guarantee delivery order; an outdated
  // event arriving after a newer one would otherwise clobber the latest
  // state. Tie-break uses Stripe's `created` timestamp.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan, last_event_created")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (
    existing?.last_event_created &&
    new Date(existing.last_event_created) >= new Date(eventCreated)
  ) {
    console.log(
      `${logPrefix} skipping out-of-order event (row ${existing.last_event_created} >= event ${eventCreated})`,
    );
    return;
  }

  const status = mapStripeStatus(subscription.status);
  const item = subscription.items.data[0];
  const { plan, billingInterval } = resolvePlan({
    priceId: item.price.id,
    metadataPlan: subscription.metadata?.plan ?? null,
    fallbackPlan: (existing?.plan ?? null) as PlanSlug | null,
    eventId: event.id,
  });
  const resolvedInterval =
    billingInterval ??
    stripeIntervalToBillingPeriod(item.price.recurring?.interval ?? null);

  if (!existing) {
    // Row doesn't exist yet — likely a `subscription.created` arriving
    // before `checkout.session.completed` finished. Let checkout.session
    // do the provisioning (user+tenant+email); we just skip until the
    // row exists. The webhook will be retried for `subscription.updated`
    // on the next state change anyway; for `subscription.created`,
    // checkout.session.completed will fire shortly after and populate
    // everything.
    console.log(
      `${logPrefix} sub ${subscription.id} not in DB yet — waiting for checkout.session.completed`,
    );
    return;
  }

  const { error } = await admin
    .from("subscriptions")
    .update({
      plan,
      status,
      stripe_price_id: item.price.id,
      billing_interval: resolvedInterval,
      current_period_start: tsToIso(item.current_period_start),
      current_period_end: tsToIso(item.current_period_end),
      trial_end: tsToIso(subscription.trial_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? tsToIso(subscription.canceled_at)
        : null,
      last_event_id: event.id,
      last_event_created: eventCreated,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    throw new Error(`subscriptions update failed: ${error.message}`);
  }

  console.log(
    `${logPrefix} sub ${subscription.id} → plan=${plan} interval=${resolvedInterval} status=${status}`,
  );
}

// ---------------------------------------------------------------------------
// customer.subscription.trial_will_end
// ---------------------------------------------------------------------------

async function handleTrialWillEnd(event: Stripe.Event): Promise<void> {
  // Stripe fires this 3 days before `trial_end`. We don't send an email
  // here yet — Stripe's own Smart Retries + the in-app banner cover the
  // "trial is ending" UX. This is the hook point for a future targeted
  // notification (CTA: add payment method now).
  //
  // Logging the event ties the audit trail to whatever follow-up the
  // marketing team wires next.
  const subscription = event.data.object as Stripe.Subscription;
  console.log(
    `[stripe-webhook ${event.id} customer.subscription.trial_will_end] sub=${subscription.id} trial_end=${tsToIso(subscription.trial_end)}`,
  );
}

// ---------------------------------------------------------------------------
// invoice.payment_succeeded
// ---------------------------------------------------------------------------

async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
): Promise<void> {
  // No-op handler for now — Stripe sends the receipt automatically and
  // `customer.subscription.updated` already advances the local period.
  // Keeping the branch wired lets us add a hook later (referrer credits,
  // accounting export, etc.) without changing the dispatch table.
  const invoice = event.data.object as Stripe.Invoice;
  console.log(
    `[stripe-webhook ${event.id} invoice.payment_succeeded] invoice=${invoice.id} amount_paid=${invoice.amount_paid} currency=${invoice.currency}`,
  );
}

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const logPrefix = `[stripe-webhook ${event.id} invoice.payment_failed]`;

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
  if (!subRow) {
    console.log(`${logPrefix} no sub row yet for ${subscriptionId}; skipping`);
    return;
  }

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
    console.error(`${logPrefix} payment-failed email failed`, mailErr.message);
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
  // `password_set: false` is read by the handle_new_user trigger (in BOTH
  // user_metadata and app_metadata for safety: Supabase populates
  // raw_app_meta_data in stages and the trigger may fire before our explicit
  // fields land there, while raw_user_meta_data is reliable at INSERT time).
  // The trigger seeds profiles.password_set = false so the activation flow
  // lands on /auth/setup. We can't infer "no password" from
  // `encrypted_password` because Supabase fills that with a random bcrypt
  // hash even when no password is supplied to admin.createUser.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: args.email,
    email_confirm: true,
    app_metadata: { role: "profesional", password_set: false },
    user_metadata: {
      full_name: args.fullName,
      business_name: args.businessName,
      password_set: false,
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
