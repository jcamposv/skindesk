-- =============================================================================
-- SkinDesk · Stripe-backed subscriptions + tenant plan column
-- =============================================================================
-- Each tenant has at most one subscription, mirroring the Stripe Customer →
-- Subscription model. We cache the plan slug + status on `public.tenants` so
-- the profesional layout can gate without joining `subscriptions` on every
-- page load. The `subscriptions` row remains the source of truth and is the
-- only thing the webhook writes to.
-- =============================================================================

-- ---------- Enums -----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_slug') then
    create type public.plan_slug as enum ('basico', 'pro', 'clinica');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    -- Mirrors the Stripe `Subscription.status` enum we care about.
    create type public.subscription_status as enum (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid'
    );
  end if;
end $$;

-- ---------- tenants.plan + tenants.subscription_status ----------------------
alter table public.tenants
  add column if not exists plan public.plan_slug,
  add column if not exists subscription_status public.subscription_status;

create index if not exists tenants_subscription_status_idx
  on public.tenants (subscription_status);

-- ---------- subscriptions ---------------------------------------------------
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null unique references public.tenants(id) on delete cascade,
  plan                     public.plan_slug not null,
  status                   public.subscription_status not null,
  stripe_customer_id       text not null,
  stripe_subscription_id   text not null unique,
  stripe_price_id          text not null,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_end                timestamptz,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ---------- Mirror plan + status onto public.tenants ------------------------
-- Whenever the webhook upserts a subscription, sync the cached fields on the
-- tenant. Cleaner than maintaining the cache from the application layer.

create or replace function private.sync_tenant_subscription_cache()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.tenants
     set plan = new.plan,
         subscription_status = new.status
   where id = new.tenant_id;
  return new;
end;
$$;

drop trigger if exists subscriptions_sync_tenant_cache on public.subscriptions;
create trigger subscriptions_sync_tenant_cache
after insert or update on public.subscriptions
for each row execute function private.sync_tenant_subscription_cache();

-- ---------- RLS -------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

-- Read: super_admin sees all; profesional/asistente see their tenant's row.
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select"
on public.subscriptions for select
to authenticated
using (
  (select private.is_super_admin())
  or tenant_id = (select private.current_tenant_id())
);

-- INSERT/UPDATE/DELETE: nobody from authenticated. The webhook uses the
-- service_role client which bypasses RLS entirely. This makes the table
-- effectively read-only for app users — the only way to mutate is through
-- the Stripe → webhook → service_role path.

grant select on public.subscriptions to authenticated;
