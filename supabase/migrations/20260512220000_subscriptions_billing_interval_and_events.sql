-- =============================================================================
-- SkinDesk · Subscription correctness: billing_interval + event dedup +
--            race-safe webhook updates
-- =============================================================================
-- Three correctness gaps shipped together:
--
--   1. billing_interval ("month" | "year") denormalised on subscriptions +
--      mirrored to tenants. Today the app can't tell a yearly sub from a
--      monthly one without re-fetching the Stripe Price — breaks every
--      report and "your plan ends on X" surface for annual subs.
--
--   2. last_event_id + last_event_created on subscriptions. Stripe doesn't
--      guarantee webhook order — a `customer.subscription.updated` for an
--      old state can arrive after a newer one. We use the event's
--      Stripe-side `created` timestamp as a tie-break and refuse updates
--      that would overwrite newer state.
--
--   3. stripe_webhook_events for event-level idempotency. Stripe retries
--      events on 5xx (and on the "Resend" button). Data-level idempotency
--      via `subscriptions.stripe_subscription_id` UNIQUE covers
--      `checkout.session.completed` but not future side-effectful handlers
--      (invoice.payment_succeeded → credits, trial_will_end → email).
--      One log line + UNIQUE on event_id stops all of them at the door.
--
-- All changes are additive. The webhook handler can roll out independently:
-- columns nullable for back-compat, events table empty until the new
-- handler starts writing to it.
-- =============================================================================

-- ---------- 1. billing_interval on subscriptions ----------------------------
alter table public.subscriptions
  add column if not exists billing_interval text;

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_interval_check;

alter table public.subscriptions
  add constraint subscriptions_billing_interval_check
  check (billing_interval is null or billing_interval in ('month','year'));

-- ---------- 1b. billing_interval mirror on tenants --------------------------
-- The layout banner ("your plan ends on X") wants to say "tu plan mensual"
-- or "tu plan anual" without joining subscriptions. Same projection
-- strategy used for plan + status + current_period_end.
alter table public.tenants
  add column if not exists billing_interval text;

alter table public.tenants
  drop constraint if exists tenants_billing_interval_check;

alter table public.tenants
  add constraint tenants_billing_interval_check
  check (billing_interval is null or billing_interval in ('month','year'));

-- ---------- 2. Race protection: track Stripe event time on the sub row -----
alter table public.subscriptions
  add column if not exists last_event_id      text,
  add column if not exists last_event_created timestamptz;

-- ---------- 3. stripe_webhook_events ----------------------------------------
-- Append-only log of every Stripe event we've received. INSERTs go through
-- the webhook handler (service_role); authenticated users never write.
-- super_admin can read for forensics; tenant members cannot.
create table if not exists public.stripe_webhook_events (
  id            bigserial primary key,
  event_id      text not null unique,
  event_type    text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (event_type, received_at desc);
create index if not exists stripe_webhook_events_unprocessed_idx
  on public.stripe_webhook_events (received_at desc)
  where processed_at is null;

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

drop policy if exists "stripe_webhook_events_super_admin_select" on public.stripe_webhook_events;
create policy "stripe_webhook_events_super_admin_select"
on public.stripe_webhook_events for select
to authenticated
using ((select private.is_super_admin()));

-- No INSERT/UPDATE/DELETE policy for `authenticated`. The webhook uses the
-- service_role client which bypasses RLS — same pattern as `subscriptions`.

grant select on public.stripe_webhook_events to authenticated;

-- ---------- 4. Update the sync trigger to mirror billing_interval ----------
create or replace function private.sync_tenant_subscription_cache()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.tenants
     set plan                  = new.plan,
         subscription_status   = new.status,
         cancel_at_period_end  = new.cancel_at_period_end,
         current_period_end    = new.current_period_end,
         billing_interval      = new.billing_interval
   where id = new.tenant_id;
  return new;
end;
$$;

-- Re-attach defensively in case the trigger spec changed between
-- migrations. `drop if exists` is a no-op when already absent.
drop trigger if exists subscriptions_sync_tenant_cache on public.subscriptions;
create trigger subscriptions_sync_tenant_cache
after insert or update on public.subscriptions
for each row execute function private.sync_tenant_subscription_cache();

-- ---------- 5. Backfill: nothing to do for existing rows -------------------
-- Existing subscriptions all keep `billing_interval IS NULL` until the next
-- Stripe event fires for them — the webhook will fill it from
-- `subscription.items.data[0].price.recurring.interval`. We don't backfill
-- here because doing so would require Stripe API calls inside a migration,
-- and the only production rows in flight are monthly (per the env config).
