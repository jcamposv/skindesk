-- =============================================================================
-- SkinDesk · Partial index on non-cancelled citas
-- =============================================================================
-- The `clientes_list_view` view (see 20260514120000_clientes_list_view.sql)
-- computes `last_appointment_at` per row with:
--   select start_at from citas
--    where cliente_id = c.id
--      and start_at < now()
--      and status <> 'cancelada'
--    order by start_at desc
--    limit 1
--
-- The existing `citas_cliente_start_idx (cliente_id, start_at desc)` covers
-- the order/limit but not the status filter, so tenants with many cancelled
-- citas pay a heap-fetch tax on every list page render.
--
-- A partial index restricted to `status <> 'cancelada'` lets the planner
-- index-only-scan when the subquery is hot. Cost: trivial (cancelled rows
-- are a minority and the index excludes them). No new constraint.
-- =============================================================================

create index if not exists citas_cliente_active_start_idx
  on public.citas (cliente_id, start_at desc)
  where status <> 'cancelada';

comment on index public.citas_cliente_active_start_idx is
  'Partial index used by clientes_list_view.last_appointment_at to avoid '
  'scanning cancelled citas. Mirrors citas_cliente_start_idx but excludes '
  'the cancelled subset.';
