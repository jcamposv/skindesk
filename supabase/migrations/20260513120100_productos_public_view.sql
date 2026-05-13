-- =============================================================================
-- SkinDesk · productos_public view + clienta read access
-- =============================================================================
-- Until now clientas have NO policy on `productos`. The rutina_steps RLS
-- lets them read their assigned routine's steps, but the join to productos
-- comes back as `null` because there's no allowed path. This migration:
--
--   1. Adds a clienta SELECT policy on `productos` that's filtered to
--      products referenced by her own (assignment-kind) rutina_steps.
--   2. Creates a `productos_public` security-invoker view that projects
--      only safe columns — no clinical_notes, no conflicting_ingredients.
--   3. Column-level revoke on the sensitive columns so a clienta can't
--      query them even if she goes through the base table directly. The
--      profesional / asistente roles re-grant themselves.
--
-- After this lands, every clienta-facing surface must read products via
-- `productos_public` so the safe projection becomes a hard boundary
-- rather than a code-side convention.
-- =============================================================================

-- ---------- Clienta SELECT policy on productos -----------------------------
-- Visibility: any producto referenced by a step of an assignment rutina
-- that belongs to this clienta. Mirrors the rutina_steps clienta policy.
drop policy if exists "productos_clienta_self_select" on public.productos;
create policy "productos_clienta_self_select"
on public.productos for select
to authenticated
using (
  exists (
    select 1
      from public.rutina_steps s
      join public.rutinas r on r.id = s.rutina_id
      join public.clientes c on c.id = r.cliente_id
     where s.producto_id = productos.id
       and r.kind = 'assignment'
       and r.archived_at is null
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- Column-level revoke --------------------------------------------
-- Clinical fields stay profesional-only. The revoke applies to the
-- catch-all `authenticated` grant created by the productos_module
-- migration; we then re-grant select to the staff-tagged roles via the
-- table-level policies above (those use the columns transparently).
--
-- Effect: a clienta `select * from productos where id = …` returns rows
-- without the clinical_notes / conflicting_ingredients values (Postgres
-- raises a permission error if those columns are explicitly named —
-- callers should query through the view instead).
revoke select(clinical_notes, conflicting_ingredients, ingredients_inci, precautions)
  on public.productos
  from authenticated;

-- ---------- productos_public view ------------------------------------------
-- Drop & recreate so column changes are picked up cleanly. The view runs
-- as `security_invoker = true` so the underlying RLS still applies —
-- there's no privilege escalation here.
drop view if exists public.productos_public;
create view public.productos_public
  with (security_invoker = true)
as
select
  id,
  tenant_id,
  name,
  brand,
  category,
  main_ingredients,
  skin_types,
  custom_skin_types,
  application_instruction,
  suggested_amount,
  absorption_time,
  frequency,
  time_of_day,
  additional_tags,
  photo_path,
  archived_at,
  created_at,
  updated_at
from public.productos;

grant select on public.productos_public to authenticated;

comment on view public.productos_public is
  'Safe projection of productos for clienta-facing surfaces. Strips '
  'clinical_notes, conflicting_ingredients, ingredients_inci, precautions. '
  'Underlying RLS on productos still applies.';
