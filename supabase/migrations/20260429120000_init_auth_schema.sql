-- =============================================================================
-- SkinDesk · Auth & Multi-tenant base schema
-- =============================================================================
-- Designed roles:
--   super_admin   → SkinDesk staff. Global access. No tenant.
--   profesional   → Cosmetóloga (tenant owner, paying customer).
--   asistente     → Team member of a tenant; granular permissions in JSONB.
--   clienta       → End customer of a profesional; sees only her own data.
--
-- Tables: tenants, profiles
-- Helpers (SECURITY DEFINER, used by RLS):
--   public.current_role(), public.current_tenant_id(),
--   public.is_super_admin(), public.has_asistente_permission()
-- Trigger: auth.users INSERT → handle_new_user() creates profile (and tenant
-- when role=profesional self-signs).
-- =============================================================================

-- ---------- Extensions -------------------------------------------------------
create extension if not exists pgcrypto;       -- gen_random_uuid(), crypt()
create extension if not exists "uuid-ossp";

-- ---------- Enums ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'super_admin',
      'profesional',
      'asistente',
      'clienta'
    );
  end if;
end $$;

-- ---------- Tables -----------------------------------------------------------

-- Tenants (one per cosmetóloga / business)
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete restrict,
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tenants_owner_idx on public.tenants (owner_id);

-- Profiles extends auth.users 1-to-1
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  tenant_id    uuid references public.tenants (id) on delete set null,
  role         public.app_role not null,
  full_name    text,
  email        text not null,
  phone        text,
  avatar_url   text,
  -- Asistente-only granular permissions:
  --   { "agenda": "view"|"edit", "pagos": "view"|"edit",
  --     "clientas": "view"|"edit", "catalogo": "view"|"edit" }
  -- Empty for other roles.
  permissions  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Tenant required for everyone except super_admin
  constraint profiles_tenant_required check (
    role = 'super_admin' or tenant_id is not null
  )
);

create index if not exists profiles_tenant_idx on public.profiles (tenant_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------- updated_at trigger ----------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------- Helpers (SECURITY DEFINER) --------------------------------------
-- These read the caller's profile bypassing RLS; they MUST live in a schema
-- callable from policies and have a fixed search_path to be injection-safe.

create or replace function public.current_role()
returns public.app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
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

-- Granular check for asistente permissions.
-- perm_key examples: 'agenda','pagos','clientas','catalogo'
-- perm_level: 'view' (default) or 'edit'
create or replace function public.has_asistente_permission(
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

-- ---------- New-user trigger -------------------------------------------------
-- When auth.users gets a row, mirror it into public.profiles. If the new user
-- self-signed as 'profesional', create their tenant first. Other roles must
-- supply tenant_id in raw_user_meta_data (set by the inviting profesional).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role          public.app_role := coalesce(
                    nullif(v_meta ->> 'role','')::public.app_role,
                    'clienta'
                  );
  v_tenant_id     uuid := nullif(v_meta ->> 'tenant_id','')::uuid;
  v_full_name     text := v_meta ->> 'full_name';
  v_business_name text := v_meta ->> 'business_name';
  v_phone         text := v_meta ->> 'phone';
  v_slug          text;
begin
  -- Self-signup as profesional creates a tenant on the fly.
  if v_role = 'profesional' and v_tenant_id is null then
    v_slug := lower(regexp_replace(
      coalesce(v_business_name, v_full_name, 'clinica-' || substr(new.id::text, 1, 8)),
      '[^a-z0-9]+', '-', 'g'
    ));

    insert into public.tenants (owner_id, name, slug)
    values (
      new.id,
      coalesce(v_business_name, v_full_name, 'Mi Clínica'),
      v_slug || '-' || substr(new.id::text, 1, 8) -- guarantee uniqueness
    )
    returning id into v_tenant_id;
  end if;

  insert into public.profiles (id, tenant_id, role, full_name, email, phone)
  values (new.id, v_tenant_id, v_role, v_full_name, new.email, v_phone);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Grants -----------------------------------------------------------
-- Authenticated users need access to tables (RLS gates rows in next migration).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_asistente_permission(text, text) to authenticated;
