-- =============================================================================
-- SkinDesk · Clientes module — domain table, RLS, storage buckets
-- =============================================================================
-- Layered on top of the auth/profile model:
--   profiles  → identity (auth.users 1:1, role, full_name, email, phone, avatar)
--   clientes  → cosmetological domain data (1:1 with a profile of role 'clienta')
--
-- Phase 1 wires only "datos personales". Tabs 2-10 (anamnesis, hábitos, rutinas,
-- pagos, servicios, archivos, historial, fotos) get their own tables in later
-- migrations.
-- =============================================================================

-- ---------- Enum -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cliente_status') then
    create type public.cliente_status as enum (
      'nueva',
      'seguimiento',
      'activa',
      'inactiva'
    );
  end if;
end $$;

-- ---------- Table ------------------------------------------------------------
create table if not exists public.clientes (
  id                        uuid primary key default gen_random_uuid(),
  -- 1:1 with the profiles row created by handle_new_user() when the
  -- profesional invites a clienta. Cascade so deleting the auth user wipes
  -- the cosmetological row too.
  profile_id                uuid not null unique references public.profiles(id) on delete cascade,
  -- Denormalised for RLS perf; kept in sync via trigger below so the FK can
  -- never drift from profiles.tenant_id.
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,

  -- Datos personales (tab 1)
  birth_date                date,
  address                   text,
  occupation                text,
  civil_status              text,
  emergency_contact_name    text,
  emergency_contact_phone   text,
  referral_source           text,

  -- Lifecycle / triage
  status                    public.cliente_status not null default 'nueva',
  notes                     text,

  -- Active service tags rendered on the list card (e.g.
  -- ["Limpieza facial profunda", "Hidratación con dermapen"]).
  -- Will become a junction table once the servicios module ships.
  services_active           jsonb not null default '[]'::jsonb,

  -- Cached agenda fields populated by the citas module (Phase 2). Kept
  -- nullable so the list view degrades gracefully until citas exists.
  last_appointment_at       timestamptz,
  next_appointment_at       timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint clientes_services_active_is_array
    check (jsonb_typeof(services_active) = 'array')
);

create index if not exists clientes_tenant_idx       on public.clientes (tenant_id);
create index if not exists clientes_status_idx       on public.clientes (tenant_id, status);
create index if not exists clientes_next_cita_idx    on public.clientes (tenant_id, next_appointment_at);
create index if not exists clientes_created_idx      on public.clientes (tenant_id, created_at desc);

-- ---------- updated_at trigger ----------------------------------------------
drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

-- ---------- tenant_id sync trigger ------------------------------------------
-- We denormalise tenant_id from profiles for RLS perf. This guarantees the
-- copy on clientes is always equal to the profile's tenant_id at INSERT and
-- on every UPDATE — clients can't desync them by passing a stale tenant_id.
create or replace function private.clientes_sync_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_tenant uuid;
  v_profile_role   public.app_role;
begin
  select tenant_id, role
    into v_profile_tenant, v_profile_role
    from public.profiles
   where id = new.profile_id;

  if v_profile_tenant is null then
    raise exception 'Cannot create cliente for a profile without a tenant'
      using errcode = '23514';
  end if;

  if v_profile_role <> 'clienta' then
    raise exception 'clientes.profile_id must reference a profile with role = clienta (got %)', v_profile_role
      using errcode = '23514';
  end if;

  new.tenant_id := v_profile_tenant;
  return new;
end;
$$;

drop trigger if exists clientes_sync_tenant_id_ins on public.clientes;
create trigger clientes_sync_tenant_id_ins
before insert on public.clientes
for each row execute function private.clientes_sync_tenant_id();

drop trigger if exists clientes_sync_tenant_id_upd on public.clientes;
create trigger clientes_sync_tenant_id_upd
before update of profile_id on public.clientes
for each row execute function private.clientes_sync_tenant_id();

-- ---------- RLS --------------------------------------------------------------
alter table public.clientes enable row level security;
alter table public.clientes force row level security;

-- super_admin: full access across all tenants.
drop policy if exists "clientes_super_admin_all" on public.clientes;
create policy "clientes_super_admin_all"
on public.clientes for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- profesional: full access scoped to their own tenant.
drop policy if exists "clientes_profesional_all" on public.clientes;
create policy "clientes_profesional_all"
on public.clientes for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

-- asistente view: gated by 'clientas' permission, scoped to tenant.
drop policy if exists "clientes_asistente_select" on public.clientes;
create policy "clientes_asistente_select"
on public.clientes for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

-- asistente edit: gated by 'clientas' permission with edit level.
drop policy if exists "clientes_asistente_update" on public.clientes;
create policy "clientes_asistente_update"
on public.clientes for update
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','edit'))
)
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','edit'))
);

drop policy if exists "clientes_asistente_insert" on public.clientes;
create policy "clientes_asistente_insert"
on public.clientes for insert
to authenticated
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','edit'))
);

-- clienta self read: she sees her own row only.
drop policy if exists "clientes_clienta_self_select" on public.clientes;
create policy "clientes_clienta_self_select"
on public.clientes for select
to authenticated
using (profile_id = (select auth.uid()));

-- ---------- Grants -----------------------------------------------------------
grant select, insert, update, delete on public.clientes to authenticated;

-- ============================================================================
-- Storage buckets — created here, UI wiring lands in Phase 2.
-- ============================================================================
-- Two private buckets:
--   clientes-files   → consents, lab results, PDFs (tab "Archivos")
--   clientes-photos  → before/after evolution photos (tab "Fotos de evolución")
-- Path convention (enforced by policy): <tenant_id>/<cliente_id>/<filename>

insert into storage.buckets (id, name, public)
values ('clientes-files', 'clientes-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('clientes-photos', 'clientes-photos', false)
on conflict (id) do nothing;

-- super_admin: full storage access across the two buckets.
drop policy if exists "clientes_storage_super_admin" on storage.objects;
create policy "clientes_storage_super_admin"
on storage.objects for all
to authenticated
using (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.is_super_admin())
)
with check (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.is_super_admin())
);

-- profesional: full access to objects under their tenant prefix.
-- Path layout: tenant_id/cliente_id/filename → split_part(name,'/',1) is tenant_id.
drop policy if exists "clientes_storage_profesional" on storage.objects;
create policy "clientes_storage_profesional"
on storage.objects for all
to authenticated
using (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.current_app_role()) = 'profesional'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
)
with check (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.current_app_role()) = 'profesional'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
);

-- asistente read: gated by 'clientas' view permission, tenant prefix.
drop policy if exists "clientes_storage_asistente_select" on storage.objects;
create policy "clientes_storage_asistente_select"
on storage.objects for select
to authenticated
using (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','view'))
);

-- asistente write: gated by 'clientas' edit permission, tenant prefix.
drop policy if exists "clientes_storage_asistente_write" on storage.objects;
create policy "clientes_storage_asistente_write"
on storage.objects for all
to authenticated
using (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','edit'))
)
with check (
  bucket_id in ('clientes-files','clientes-photos')
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','edit'))
);

-- clienta read: only objects under her own cliente_id folder.
drop policy if exists "clientes_storage_clienta_self_select" on storage.objects;
create policy "clientes_storage_clienta_self_select"
on storage.objects for select
to authenticated
using (
  bucket_id in ('clientes-files','clientes-photos')
  and exists (
    select 1
      from public.clientes c
     where c.profile_id = (select auth.uid())
       and split_part(storage.objects.name, '/', 2) = c.id::text
       and split_part(storage.objects.name, '/', 1) = c.tenant_id::text
  )
);
