-- =============================================================================
-- SkinDesk · Move SECURITY DEFINER helpers to a `private` schema and
--             harden handle_new_user() against self-escalation.
-- =============================================================================
-- WHY:
--   1. Supabase security checklist: SECURITY DEFINER functions must NOT live
--      in a schema exposed via the Data API. `public` is exposed; `private`
--      is not (and is not listed in [api].schemas).
--   2. handle_new_user() previously trusted raw_user_meta_data for `role` and
--      `tenant_id`. Anyone with the anon key could call
--          auth.signUp({ data: { role: 'super_admin' } })
--      and the trigger would happily create a super_admin profile. Now:
--        · raw_app_meta_data (only writable by service_role) is the trusted
--          source for role / tenant_id.
--        · raw_user_meta_data is only honoured for self-signup-safe roles
--          ('profesional' and 'clienta'). 'super_admin' / 'asistente' must
--          come from app_metadata.
--        · The default for /register without an explicit role is now
--          'profesional' (the only public self-signup target on this app).
-- =============================================================================

-- ---------- private schema --------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;
-- IMPORTANT: do NOT add `private` to config.toml [api].schemas; PostgREST
-- must not see this schema. Helpers are reachable from RLS policies because
-- `authenticated` has USAGE on the schema and EXECUTE on each function.

-- ---------- Helpers (recreated in private) ----------------------------------
create or replace function private.current_app_role()
returns public.app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.current_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function private.has_asistente_permission(
  perm_key text,
  perm_level text default 'view'
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with me as (
    select role, permissions from public.profiles where id = auth.uid()
  )
  select
    case
      when (select role from me) <> 'asistente' then false
      when perm_level = 'view' then
        coalesce((select permissions ->> perm_key from me) in ('view','edit'), false)
      when perm_level = 'edit' then
        coalesce((select permissions ->> perm_key from me) = 'edit', false)
      else false
    end
$$;

grant execute on function private.current_app_role()                   to authenticated;
grant execute on function private.current_tenant_id()                  to authenticated;
grant execute on function private.is_super_admin()                    to authenticated;
grant execute on function private.has_asistente_permission(text, text) to authenticated;

-- ---------- Hardened handle_new_user ----------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_user_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_app_meta      jsonb := coalesce(new.raw_app_meta_data,  '{}'::jsonb);
  v_app_role_raw  text  := nullif(v_app_meta  ->> 'role','');
  v_user_role_raw text  := nullif(v_user_meta ->> 'role','');
  v_role          public.app_role;
  v_tenant_id     uuid;
  v_full_name     text  := v_user_meta ->> 'full_name';
  v_business_name text  := v_user_meta ->> 'business_name';
  v_phone         text  := v_user_meta ->> 'phone';
  v_slug          text;
begin
  -- Resolve role + tenant_id from the only trusted sources.
  if v_app_role_raw is not null then
    -- Trusted: app_metadata is only writable by the service_role
    -- (auth.admin.createUser / inviteUserByEmail with app_metadata).
    v_role      := v_app_role_raw::public.app_role;
    v_tenant_id := nullif(v_app_meta ->> 'tenant_id','')::uuid;
  elsif v_user_role_raw in ('profesional','clienta') then
    -- Self-signup safelist. 'super_admin' / 'asistente' would be ignored.
    v_role := v_user_role_raw::public.app_role;
    if v_role = 'clienta' then
      v_tenant_id := nullif(v_user_meta ->> 'tenant_id','')::uuid;
    end if;
  else
    -- /register without an explicit role → new cosmetóloga.
    v_role := 'profesional';
  end if;

  -- Profesional with no tenant_id ⇒ create the tenant on the fly.
  if v_role = 'profesional' and v_tenant_id is null then
    v_slug := lower(regexp_replace(
      coalesce(v_business_name, v_full_name, 'clinica-' || substr(new.id::text, 1, 8)),
      '[^a-z0-9]+', '-', 'g'
    ));

    insert into public.tenants (owner_id, name, slug)
    values (
      new.id,
      coalesce(v_business_name, v_full_name, 'Mi Clínica'),
      v_slug || '-' || substr(new.id::text, 1, 8)
    )
    returning id into v_tenant_id;
  end if;

  insert into public.profiles (id, tenant_id, role, full_name, email, phone)
  values (new.id, v_tenant_id, v_role, v_full_name, new.email, v_phone);

  return new;
end;
$$;

-- ---------- Anti-escalation trigger fn (moved to private) -------------------
create or replace function private.profiles_block_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role public.app_role;
begin
  if v_caller is null or v_caller <> old.id then
    return new;
  end if;

  select role into v_caller_role from public.profiles where id = v_caller;

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

-- ---------- Email-sync trigger fn (moved to private) ------------------------
create or replace function private.handle_auth_user_email_change()
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

-- ---------- Re-bind triggers to private.* -----------------------------------
drop trigger if exists on_auth_user_created            on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop trigger if exists on_auth_user_email_change       on auth.users;
create trigger on_auth_user_email_change
after update of email on auth.users
for each row execute function private.handle_auth_user_email_change();

drop trigger if exists profiles_block_self_escalation  on public.profiles;
create trigger profiles_block_self_escalation
before update on public.profiles
for each row execute function private.profiles_block_self_escalation();

-- ============================================================================
-- Recreate every RLS policy that referenced the public.* helpers so they
-- now call private.*.
-- ============================================================================

-- TENANTS --------------------------------------------------------------------

drop policy if exists "tenants_super_admin_all" on public.tenants;
create policy "tenants_super_admin_all"
on public.tenants for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "tenants_members_select" on public.tenants;
create policy "tenants_members_select"
on public.tenants for select
to authenticated
using (id = (select private.current_tenant_id()));

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
with check ((select private.is_super_admin()));

drop policy if exists "tenants_block_delete" on public.tenants;
create policy "tenants_block_delete"
on public.tenants for delete
to authenticated
using ((select private.is_super_admin()));

-- PROFILES -------------------------------------------------------------------

drop policy if exists "profiles_super_admin_all" on public.profiles;
create policy "profiles_super_admin_all"
on public.profiles for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

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
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

drop policy if exists "profiles_profesional_manage_members" on public.profiles;
create policy "profiles_profesional_manage_members"
on public.profiles for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
  and role in ('asistente','clienta')
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
  and role in ('asistente','clienta')
);

drop policy if exists "profiles_asistente_read_clientas" on public.profiles;
create policy "profiles_asistente_read_clientas"
on public.profiles for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and role = 'clienta'
  and (select private.has_asistente_permission('clientas','view'))
);

drop policy if exists "profiles_asistente_edit_clientas" on public.profiles;
create policy "profiles_asistente_edit_clientas"
on public.profiles for update
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and role = 'clienta'
  and (select private.has_asistente_permission('clientas','edit'))
)
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and role = 'clienta'
  and (select private.has_asistente_permission('clientas','edit'))
);

-- ============================================================================
-- Drop the old public.* helpers — every reference now points at private.*.
-- ============================================================================
revoke execute on function public.current_app_role()                   from authenticated;
revoke execute on function public.current_tenant_id()                  from authenticated;
revoke execute on function public.is_super_admin()                     from authenticated;
revoke execute on function public.has_asistente_permission(text, text) from authenticated;

drop function if exists public.current_app_role();
drop function if exists public.current_tenant_id();
drop function if exists public.is_super_admin();
drop function if exists public.has_asistente_permission(text, text);
drop function if exists public.handle_new_user();
drop function if exists public.handle_auth_user_email_change();
drop function if exists public.profiles_block_self_escalation();
