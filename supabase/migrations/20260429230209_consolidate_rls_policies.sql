-- =============================================================================
-- SkinDesk · Consolidate RLS policies on tenants/profiles
-- =============================================================================
-- The previous migrations split access into separate permissive policies per
-- role: `*_super_admin_all` (FOR ALL) overlapped with each role-specific
-- policy. PostgREST evaluates every permissive policy that matches an action,
-- which the Supabase advisor flags as `multiple_permissive_policies` (lint
-- 0006).
--
-- This migration replaces the old set with one permissive policy per (table,
-- action), where each policy is a single OR expression covering every role
-- that should be allowed. Behavior is preserved exactly.
-- =============================================================================

-- ---------- TENANTS ---------------------------------------------------------

drop policy if exists "tenants_super_admin_all"      on public.tenants;
drop policy if exists "tenants_members_select"       on public.tenants;
drop policy if exists "tenants_owner_update"         on public.tenants;
drop policy if exists "tenants_block_insert"         on public.tenants;
drop policy if exists "tenants_block_delete"         on public.tenants;

-- SELECT: tenant member sees own tenant; super_admin sees all.
create policy "tenants_select"
on public.tenants for select
to authenticated
using (
  id = (select private.current_tenant_id())
  or (select private.is_super_admin())
);

-- UPDATE: owner profesional updates own tenant; super_admin updates any.
create policy "tenants_update"
on public.tenants for update
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_super_admin())
)
with check (
  owner_id = (select auth.uid())
  or (select private.is_super_admin())
);

-- INSERT: only super_admin (regular tenants are created by handle_new_user,
-- which runs SECURITY DEFINER and bypasses RLS).
create policy "tenants_insert"
on public.tenants for insert
to authenticated
with check ((select private.is_super_admin()));

-- DELETE: only super_admin.
create policy "tenants_delete"
on public.tenants for delete
to authenticated
using ((select private.is_super_admin()));

-- ---------- PROFILES --------------------------------------------------------

drop policy if exists "profiles_super_admin_all"            on public.profiles;
drop policy if exists "profiles_self_select"                on public.profiles;
drop policy if exists "profiles_self_update"                on public.profiles;
drop policy if exists "profiles_profesional_tenant_select"  on public.profiles;
drop policy if exists "profiles_profesional_manage_members" on public.profiles;
drop policy if exists "profiles_asistente_read_clientas"    on public.profiles;
drop policy if exists "profiles_asistente_edit_clientas"    on public.profiles;

-- SELECT
create policy "profiles_select"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())                                         -- self
  or (select private.is_super_admin())                             -- super
  or (
    (select private.current_app_role()) = 'profesional'            -- profesional
    and tenant_id = (select private.current_tenant_id())           --   sees everyone in their tenant
  )
  or (
    (select private.current_app_role()) = 'asistente'              -- asistente
    and tenant_id = (select private.current_tenant_id())           --   in tenant
    and role = 'clienta'                                           --   only clientas
    and (select private.has_asistente_permission('clientas','view'))
  )
);

-- UPDATE
-- The anti-escalation trigger profiles_block_self_escalation enforces the
-- "self updates cannot change role/tenant_id/permissions" invariant, so the
-- self branch keeps a cheap (id = auth.uid()) check.
create policy "profiles_update"
on public.profiles for update
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_super_admin())
  or (
    (select private.current_app_role()) = 'profesional'
    and tenant_id = (select private.current_tenant_id())
    and role in ('asistente','clienta')
  )
  or (
    (select private.current_app_role()) = 'asistente'
    and tenant_id = (select private.current_tenant_id())
    and role = 'clienta'
    and (select private.has_asistente_permission('clientas','edit'))
  )
)
with check (
  id = (select auth.uid())
  or (select private.is_super_admin())
  or (
    (select private.current_app_role()) = 'profesional'
    and tenant_id = (select private.current_tenant_id())
    and role in ('asistente','clienta')
  )
  or (
    (select private.current_app_role()) = 'asistente'
    and tenant_id = (select private.current_tenant_id())
    and role = 'clienta'
    and (select private.has_asistente_permission('clientas','edit'))
  )
);

-- INSERT
-- Self-rows come from handle_new_user (SECURITY DEFINER ⇒ bypasses RLS).
-- Through the API only super_admin and profesional (managing tenant members)
-- can insert.
create policy "profiles_insert"
on public.profiles for insert
to authenticated
with check (
  (select private.is_super_admin())
  or (
    (select private.current_app_role()) = 'profesional'
    and tenant_id = (select private.current_tenant_id())
    and role in ('asistente','clienta')
  )
);

-- DELETE
create policy "profiles_delete"
on public.profiles for delete
to authenticated
using (
  (select private.is_super_admin())
  or (
    (select private.current_app_role()) = 'profesional'
    and tenant_id = (select private.current_tenant_id())
    and role in ('asistente','clienta')
  )
);
