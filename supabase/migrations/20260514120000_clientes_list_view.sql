-- =============================================================================
-- SkinDesk · Clientes list view — real-time aggregates
-- =============================================================================
-- The `clientes` table carries three "cached" columns from the original
-- module migration:
--   · services_active        jsonb (default '[]')
--   · last_appointment_at    timestamptz
--   · next_appointment_at    timestamptz
--
-- These were meant to be populated by triggers from the citas/servicios
-- modules — but those modules shipped without wiring up the cache, so the
-- columns stay empty and the list page shows blank cells.
--
-- Triggers can't honour `next_appointment_at` correctly anyway: that field
-- depends on `now()`, so a cita that was "next" yesterday is "last" today
-- without any write happening. The only correct shape is to compute the
-- three values at read time. This view does exactly that.
--
-- Reads:
--   · public.servicios (cliente_id, status='active') → name list
--   · public.citas     (cliente_id, start_at, status) → last + next
-- Indexes already in place cover both subqueries.
--
-- Security: SECURITY INVOKER so RLS on `clientes`, `servicios`, `citas`,
-- and `profiles` applies. Each tenant only sees its own rows.
-- =============================================================================

create or replace view public.clientes_list_view
with (security_invoker = true)
as
select
  c.id,
  c.tenant_id,
  c.profile_id,
  c.status,
  c.birth_date,
  c.created_at,
  c.updated_at,
  -- Active services as a jsonb array of names (drop-in compatible with the
  -- legacy `clientes.services_active` column the table cell already reads).
  coalesce(
    (
      select jsonb_agg(s.name order by s.created_at desc)
      from public.servicios s
      where s.cliente_id = c.id
        and s.status = 'active'
    ),
    '[]'::jsonb
  ) as services_active,
  -- Most recent cita that has happened (any status except cancelada — a
  -- cancelled cita never took place so it shouldn't count as "last").
  (
    select ci.start_at
    from public.citas ci
    where ci.cliente_id = c.id
      and ci.start_at < now()
      and ci.status <> 'cancelada'
    order by ci.start_at desc
    limit 1
  ) as last_appointment_at,
  -- Earliest upcoming cita that is still on the calendar.
  (
    select ci.start_at
    from public.citas ci
    where ci.cliente_id = c.id
      and ci.start_at >= now()
      and ci.status in ('pendiente', 'confirmada')
    order by ci.start_at asc
    limit 1
  ) as next_appointment_at
from public.clientes c;

comment on view public.clientes_list_view is
  'Clientes list with real-time aggregates: services_active (jsonb array '
  'of active service names), last_appointment_at, next_appointment_at. '
  'SECURITY INVOKER so RLS on clientes/servicios/citas/profiles applies.';

-- Authenticated role needs SELECT on the view; RLS on the underlying tables
-- is what actually gates the rows. PostgREST detects the `profile_id`
-- column and inherits the FK relationship from `public.clientes` so the
-- existing `profile:profiles!inner(...)` embedded resource keeps working.
grant select on public.clientes_list_view to authenticated;
