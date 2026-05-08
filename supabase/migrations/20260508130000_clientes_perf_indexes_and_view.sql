-- =============================================================================
-- SkinDesk · Clientes module — performance indexes + status counts view
-- =============================================================================
-- Two follow-ups to the initial clientes module:
--
--   1. Composite index `(tenant_id, status, created_at desc)` so the list-
--      page query can serve `WHERE tenant_id=? AND status=? ORDER BY
--      created_at DESC LIMIT 20` from a single B-tree scan. The previous
--      separate indexes on `(tenant_id)`, `(tenant_id, status)` and
--      `(tenant_id, created_at desc)` each covered a subset of the query
--      plan; the composite covers all the common access patterns at once.
--
--   2. View `public.clientes_status_counts` that pre-aggregates row counts
--      per (tenant_id, status). Replaces a JS-side aggregation that was
--      transferring every clienta's status enum just to count by status.
--      With `security_invoker=true` the underlying RLS on `clientes`
--      applies, so each tenant only sees their own counts. (Per Supabase
--      security checklist: Postgres 15+ views must opt into invoker rights
--      or RLS is bypassed.)
-- =============================================================================

-- ---------- Composite index --------------------------------------------------
create index if not exists clientes_tenant_status_created_idx
  on public.clientes (tenant_id, status, created_at desc);

-- The previous narrow indexes are now redundant for the list-page query.
-- Keep them for ad-hoc queries (status-only filters, created_at scans) since
-- the rows are cheap to maintain on a low-write table.

-- ---------- Aggregated counts view ------------------------------------------
create or replace view public.clientes_status_counts
with (security_invoker = true)
as
  select
    tenant_id,
    status,
    count(*)::int as count
  from public.clientes
  group by tenant_id, status;

comment on view public.clientes_status_counts is
  'Per-tenant clienta count by status. SECURITY INVOKER so RLS on '
  'public.clientes scopes the rows; each tenant only sees their own counts.';

-- Authenticated role needs SELECT on the view; RLS on the underlying table
-- (clientes) is what actually gates the rows.
grant select on public.clientes_status_counts to authenticated;
