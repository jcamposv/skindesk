-- =============================================================================
-- SkinDesk · Security & RLS performance hardening
-- =============================================================================
-- Applies the recommendations from the Supabase Postgres best-practices review:
--
--   1. Wrap auth.uid() and SECURITY DEFINER helpers in `(select ...)` so they
--      are evaluated once per query, not per row (5-100x speedup on RLS).
--   2. Replace the triple-subquery `with check` on profiles_self_update with a
--      single BEFORE UPDATE trigger that blocks self-escalation of role,
--      tenant_id, and permissions.
--   3. Rename public.current_role() → public.current_app_role() to avoid
--      colliding with Postgres' built-in current_role.
--   4. Drop the unused uuid-ossp extension; enable pg_stat_statements for
--      query observability.
--   5. Sync profiles.email when auth.users.email changes.
-- =============================================================================

-- ---------- Extensions -------------------------------------------------------
create extension if not exists pg_stat_statements;
drop extension if exists "uuid-ossp";

-- ---------- Rename current_role → current_app_role --------------------------
-- Built-in `current_role` (no schema) returns the session role. Naming our
-- helper the same forces us to always schema-qualify it; renaming removes the
-- footgun.

create or replace function public.current_app_role()
returns public.app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_app_role() to authenticated;

-- ---------- Anti-escalation trigger for profiles ----------------------------
-- Replaces the per-row triple subquery in profiles_self_update.with_check.
-- When the caller updates their own row and is not super_admin, block any
-- change to role / tenant_id / permissions.

create or replace function public.profiles_block_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role public.app_role;
begin
  -- Not a self-update (or running outside an auth context) → nothing to check.
  -- Other policies (super_admin_all, profesional_manage_members, etc.) already
  -- gate non-self updates.
  if v_caller is null or v_caller <> old.id then
    return new;
  end if;

  select role into v_caller_role from public.profiles where id = v_caller;

  -- Super admin can change anything, including their own role/tenant.
  if v_caller_role = 'super_admin' then
    return new;
  end if;

  if new.role <> old.role
     or new.tenant_id is distinct from old.tenant_id
     or new.permissions <> old.permissions
  then
    raise exception 'Cannot self-modify role, tenant_id, or permissions'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_block_self_escalation on public.profiles;
create trigger profiles_block_self_escalation
before update on public.profiles
for each row execute function public.profiles_block_self_escalation();

-- ---------- Sync auth.users.email → public.profiles.email -------------------
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
after update of email on auth.users
for each row execute function public.handle_auth_user_email_change();

-- =============================================================================
-- Recreate every RLS policy with `(select helper())` wrappers
-- =============================================================================
-- TENANTS ---------------------------------------------------------------------

drop policy if exists "tenants_super_admin_all" on public.tenants;
create policy "tenants_super_admin_all"
on public.tenants for all
to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists "tenants_members_select" on public.tenants;
create policy "tenants_members_select"
on public.tenants for select
to authenticated
using (id = (select public.current_tenant_id()));

drop policy if exists "tenants_owner_update" on public.tenants;
create policy "tenants_owner_update"
on public.tenants for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "tenants_block_insert" on public.tenants;
create policy "tenants_block_insert"
on public.tenants for insert
to authenticated
with check ((select public.is_super_admin()));

drop policy if exists "tenants_block_delete" on public.tenants;
create policy "tenants_block_delete"
on public.tenants for delete
to authenticated
using ((select public.is_super_admin()));

-- PROFILES --------------------------------------------------------------------

drop policy if exists "profiles_super_admin_all" on public.profiles;
create policy "profiles_super_admin_all"
on public.profiles for all
to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

-- Self update: trigger profiles_block_self_escalation enforces the no-escalate
-- invariant. Policy itself stays cheap.
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "profiles_profesional_tenant_select" on public.profiles;
create policy "profiles_profesional_tenant_select"
on public.profiles for select
to authenticated
using (
  (select public.current_app_role()) = 'profesional'
  and tenant_id = (select public.current_tenant_id())
);

drop policy if exists "profiles_profesional_manage_members" on public.profiles;
create policy "profiles_profesional_manage_members"
on public.profiles for all
to authenticated
using (
  (select public.current_app_role()) = 'profesional'
  and tenant_id = (select public.current_tenant_id())
  and role in ('asistente','clienta')
)
with check (
  (select public.current_app_role()) = 'profesional'
  and tenant_id = (select public.current_tenant_id())
  and role in ('asistente','clienta')
);

drop policy if exists "profiles_asistente_read_clientas" on public.profiles;
create policy "profiles_asistente_read_clientas"
on public.profiles for select
to authenticated
using (
  (select public.current_app_role()) = 'asistente'
  and tenant_id = (select public.current_tenant_id())
  and role = 'clienta'
  and (select public.has_asistente_permission('clientas','view'))
);

drop policy if exists "profiles_asistente_edit_clientas" on public.profiles;
create policy "profiles_asistente_edit_clientas"
on public.profiles for update
to authenticated
using (
  (select public.current_app_role()) = 'asistente'
  and tenant_id = (select public.current_tenant_id())
  and role = 'clienta'
  and (select public.has_asistente_permission('clientas','edit'))
)
with check (
  (select public.current_app_role()) = 'asistente'
  and tenant_id = (select public.current_tenant_id())
  and role = 'clienta'
  and (select public.has_asistente_permission('clientas','edit'))
);

-- ---------- Drop the old current_role() (no longer referenced) --------------
revoke execute on function public.current_role() from authenticated;
drop function if exists public.current_role();
