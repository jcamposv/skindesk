-- =============================================================================
-- SkinDesk · Per-tenant currency
-- =============================================================================
-- Each tenant (business) picks the currency it operates in. Used by the
-- app to format every money value (income KPIs, payments table, plan
-- balances, client detail, payment forms). NOT a conversion rate — we
-- never recompute amounts; we only label them.
--
-- Default 'MXN' because the initial market is Mexico. The check
-- constraint pins the allowed set to LATAM minus Brazil + USD, matching
-- the in-app picker. Update the list here AND in src/lib/currency.ts in
-- lockstep if you ever add a currency.
-- =============================================================================

alter table public.tenants
  add column if not exists currency text not null default 'MXN';

-- Drop a stale constraint name from a previous migration draft (if any),
-- then add the canonical one. `if exists` keeps the migration re-runnable.
alter table public.tenants
  drop constraint if exists tenants_currency_allowed;

alter table public.tenants
  add constraint tenants_currency_allowed check (
    currency in (
      'MXN','USD','CRC','COP','NIO','GTQ','HNL',
      'ARS','BOB','CLP','CUP','DOP','PYG','PEN','PAB','UYU','VES'
    )
  );
