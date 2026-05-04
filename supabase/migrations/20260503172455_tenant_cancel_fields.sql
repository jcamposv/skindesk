-- =============================================================================
-- SkinDesk · Mirror cancel_at_period_end + current_period_end onto tenants
-- =============================================================================
-- Layouts and banners want to show "your plan ends on X" without joining
-- `subscriptions` on every server render. Extend the cached projection on
-- `tenants` (already holds plan + subscription_status) with these two fields,
-- and update the sync trigger to keep them current.
--
-- Backfill at the end so existing tenants pick up the values from their
-- current `subscriptions` row.
-- =============================================================================

-- ---------- Add columns ----------------------------------------------------
alter table public.tenants
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end   timestamptz;

-- ---------- Replace the sync trigger to mirror the new fields --------------
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
         current_period_end    = new.current_period_end
   where id = new.tenant_id;
  return new;
end;
$$;

-- ---------- Backfill -------------------------------------------------------
-- Pull the latest values from each tenant's existing subscription row. The
-- subscriptions.tenant_id is unique so this is a safe single-row update.
update public.tenants t
   set cancel_at_period_end = coalesce(s.cancel_at_period_end, false),
       current_period_end   = s.current_period_end
  from public.subscriptions s
 where s.tenant_id = t.id;
