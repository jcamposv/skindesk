-- =============================================================================
-- SkinDesk · Library stats RPC
-- =============================================================================
-- `getLibraryStats` (src/services/rutinas.service.ts) used to pull every
-- non-archived template row from `rutinas` just to count buckets in JS.
-- For a tenant with hundreds of templates that's a meaningful round-trip
-- + RLS-evaluation cost for a 4-cell stat strip on the library page.
--
-- This RPC moves the bucket counting into the planner via FILTER. The
-- function is `stable` (no writes), `security invoker` (so RLS still
-- evaluates against the calling user — multi-tenant safety preserved).
--
-- Returns the same shape `getLibraryStats` exposes today; the service
-- swaps the row-scan for `supabase.rpc('rutinas_library_stats').single()`.
-- =============================================================================

create or replace function public.rutinas_library_stats()
returns table (total integer, am integer, pm integer, ambos integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::integer as total,
    count(*) filter (where momento = 'am')::integer as am,
    count(*) filter (where momento = 'pm')::integer as pm,
    -- Column is named `ambos` (Spanish) because `both` is a Postgres
    -- reserved keyword in column position; the service maps it back to
    -- the JS-side field name `both` for callers.
    count(*) filter (where momento = 'both' or momento is null)::integer as ambos
  from public.rutinas
  where kind = 'template' and archived_at is null
$$;

comment on function public.rutinas_library_stats() is
  'Bucket-count of rutinas templates (am / pm / both) for the library '
  'stat strip. Replaces the JS-side row scan in src/services/rutinas.service.ts. '
  'Security invoker — RLS applies to the calling user, so the function '
  'is tenant-safe by design.';
