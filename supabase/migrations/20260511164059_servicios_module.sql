-- =============================================================================
-- SkinDesk · Servicios module — assigned services + sessions
-- =============================================================================
-- Mirrors the evaluaciones + clientes pattern:
--   · denormalised tenant_id synced from the cliente row
--   · BEFORE triggers stamp audit columns (created_by / last_editor_id)
--     and bump `version` for optimistic concurrency
--   · RLS scoped per role (super_admin · profesional · asistente · clienta)
--   · separate private storage bucket `servicios-photos` for before/after
--     session photos, isolated by tenant_id path prefix
--
-- Domain shape:
--   servicios  — one row per assigned service (facial / corporal / laser / other)
--   sesiones   — one row per session of a service; payload JSONB is a
--                discriminated union shaped by `service_type`.
--
-- Asistente write permission is OUT OF SCOPE for this module — they read only.
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_type') then
    create type public.service_type as enum (
      'facial',
      'corporal',
      'laser',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'service_status') then
    create type public.service_status as enum (
      'active',
      'paused',
      'completed',
      'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum (
      'completed',
      'pending',
      'scheduled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'frequency_key') then
    create type public.frequency_key as enum (
      'semanal',
      'quincenal',
      'mensual',
      'personalizada'
    );
  end if;
end $$;

-- ---------- servicios --------------------------------------------------------
create table if not exists public.servicios (
  id                 uuid primary key default gen_random_uuid(),
  -- Denormalised for RLS perf; kept in sync via trigger.
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  cliente_id         uuid not null references public.clientes(id) on delete cascade,

  name               text not null check (length(name) between 1 and 200),
  service_type       public.service_type not null,
  catalog_key        text not null,
  start_date         date not null,
  total_sessions     integer not null default 1 check (total_sessions > 0),
  frequency          public.frequency_key not null default 'quincenal',
  status             public.service_status not null default 'active',
  notes              text,
  package_amount     numeric(10,2),
  professional       text,
  next_appointment   date,
  tags               text[] not null default '{}',
  is_post_op         boolean not null default false,
  -- Only laser services may carry a diagnosis.
  laser_diagnosis    jsonb,

  version            integer not null default 1,
  created_by         uuid references public.profiles(id) on delete restrict,
  last_editor_id     uuid references public.profiles(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint servicios_laser_diagnosis_only_when_laser
    check (laser_diagnosis is null or service_type = 'laser'),
  constraint servicios_laser_diagnosis_is_object
    check (laser_diagnosis is null or jsonb_typeof(laser_diagnosis) = 'object')
);

create index if not exists servicios_tenant_idx        on public.servicios (tenant_id);
create index if not exists servicios_cliente_idx       on public.servicios (cliente_id);
create index if not exists servicios_tenant_status_idx on public.servicios (tenant_id, status);
create index if not exists servicios_tenant_next_idx   on public.servicios (tenant_id, next_appointment);
create index if not exists servicios_tenant_created_idx on public.servicios (tenant_id, created_at desc);

-- ---------- sesiones ---------------------------------------------------------
create table if not exists public.sesiones (
  id                 uuid primary key default gen_random_uuid(),
  -- Denormalised for RLS perf; kept in sync via trigger.
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  servicio_id        uuid not null references public.servicios(id) on delete cascade,
  -- Also denormalised so RLS can scope reads without an extra join.
  cliente_id         uuid not null references public.clientes(id) on delete cascade,

  session_number     integer not null check (session_number >= 1),
  session_date       date not null,
  duration_min       integer not null default 60 check (duration_min >= 0),
  professional       text,
  status             public.session_status not null default 'completed',
  notes              text,
  -- Exact storage object paths in the `servicios-photos` bucket.
  before_paths       text[] not null default '{}',
  after_paths        text[] not null default '{}',
  recommendations    text,
  next_suggestion    date,
  -- Discriminated union keyed by parent service_type. The frontend SessionPayload
  -- maps 1:1 — facial/corporal/laser/other variants.
  payload            jsonb not null,

  version            integer not null default 1,
  created_by         uuid references public.profiles(id) on delete restrict,
  last_editor_id     uuid references public.profiles(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint sesiones_payload_is_object
    check (jsonb_typeof(payload) = 'object'),
  constraint sesiones_photo_caps
    check (cardinality(before_paths) <= 12 and cardinality(after_paths) <= 12),
  constraint sesiones_unique_session_number
    unique (servicio_id, session_number)
);

create index if not exists sesiones_tenant_idx          on public.sesiones (tenant_id);
create index if not exists sesiones_servicio_order_idx  on public.sesiones (servicio_id, session_number);
create index if not exists sesiones_cliente_date_idx    on public.sesiones (cliente_id, session_date desc);

-- ---------- updated_at triggers ---------------------------------------------
drop trigger if exists servicios_set_updated_at on public.servicios;
create trigger servicios_set_updated_at
before update on public.servicios
for each row execute function public.set_updated_at();

drop trigger if exists sesiones_set_updated_at on public.sesiones;
create trigger sesiones_set_updated_at
before update on public.sesiones
for each row execute function public.set_updated_at();

-- ---------- tenant_id sync triggers -----------------------------------------
-- servicios.tenant_id is pulled from the cliente row. Clients can't desync it
-- by passing a stale or forged value.
create or replace function private.servicios_sync_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_tenant uuid;
begin
  select tenant_id
    into v_cliente_tenant
    from public.clientes
   where id = new.cliente_id;

  if v_cliente_tenant is null then
    raise exception 'Cannot create servicio for unknown cliente_id %', new.cliente_id
      using errcode = '23503';
  end if;

  new.tenant_id := v_cliente_tenant;
  return new;
end;
$$;

drop trigger if exists servicios_sync_tenant_id_ins on public.servicios;
create trigger servicios_sync_tenant_id_ins
before insert on public.servicios
for each row execute function private.servicios_sync_tenant_id();

drop trigger if exists servicios_sync_tenant_id_upd on public.servicios;
create trigger servicios_sync_tenant_id_upd
before update of cliente_id on public.servicios
for each row execute function private.servicios_sync_tenant_id();

-- sesiones.tenant_id + sesiones.cliente_id are pulled from the parent servicio.
create or replace function private.sesiones_sync_parent_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio record;
begin
  select tenant_id, cliente_id
    into v_servicio
    from public.servicios
   where id = new.servicio_id;

  if not found then
    raise exception 'Cannot create sesion for unknown servicio_id %', new.servicio_id
      using errcode = '23503';
  end if;

  new.tenant_id  := v_servicio.tenant_id;
  new.cliente_id := v_servicio.cliente_id;
  return new;
end;
$$;

drop trigger if exists sesiones_sync_parent_refs_ins on public.sesiones;
create trigger sesiones_sync_parent_refs_ins
before insert on public.sesiones
for each row execute function private.sesiones_sync_parent_refs();

drop trigger if exists sesiones_sync_parent_refs_upd on public.sesiones;
create trigger sesiones_sync_parent_refs_upd
before update of servicio_id on public.sesiones
for each row execute function private.sesiones_sync_parent_refs();

-- ---------- audit + optimistic-concurrency triggers -------------------------
-- Identical shape to private.evaluaciones_audit_and_version().
create or replace function private.servicios_audit_and_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if (TG_OP = 'INSERT') then
    if v_caller is null then
      raise exception 'servicios audit: auth.uid() is null' using errcode = '42501';
    end if;
    new.created_by     := v_caller;
    new.last_editor_id := v_caller;
    new.version        := 1;
  elsif (TG_OP = 'UPDATE') then
    new.created_by     := old.created_by;
    new.last_editor_id := coalesce(v_caller, old.last_editor_id);
    new.version        := old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists servicios_audit_ins on public.servicios;
create trigger servicios_audit_ins
before insert on public.servicios
for each row execute function private.servicios_audit_and_version();

drop trigger if exists servicios_audit_upd on public.servicios;
create trigger servicios_audit_upd
before update on public.servicios
for each row execute function private.servicios_audit_and_version();

create or replace function private.sesiones_audit_and_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if (TG_OP = 'INSERT') then
    if v_caller is null then
      raise exception 'sesiones audit: auth.uid() is null' using errcode = '42501';
    end if;
    new.created_by     := v_caller;
    new.last_editor_id := v_caller;
    new.version        := 1;
  elsif (TG_OP = 'UPDATE') then
    new.created_by     := old.created_by;
    new.last_editor_id := coalesce(v_caller, old.last_editor_id);
    new.version        := old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists sesiones_audit_ins on public.sesiones;
create trigger sesiones_audit_ins
before insert on public.sesiones
for each row execute function private.sesiones_audit_and_version();

drop trigger if exists sesiones_audit_upd on public.sesiones;
create trigger sesiones_audit_upd
before update on public.sesiones
for each row execute function private.sesiones_audit_and_version();

-- ---------- sesiones → servicios rollup (AFTER INSERT) ----------------------
-- When a session lands:
--   · Auto-flip the parent service to `completed` once the count of
--     completed sessions reaches `total_sessions`. Frees the operator from
--     manually moving the service to the histórico.
--   · Bubble `next_suggestion` onto `servicios.next_appointment` so the
--     card stays current without an extra write from the action.
create or replace function private.sesiones_bump_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio record;
  v_completed_count integer;
begin
  select id, status, total_sessions
    into v_servicio
    from public.servicios
   where id = new.servicio_id;

  if v_servicio.id is null then
    return new;
  end if;

  select count(*)
    into v_completed_count
    from public.sesiones
   where servicio_id = new.servicio_id
     and status = 'completed';

  if v_servicio.status = 'active'
     and v_completed_count >= v_servicio.total_sessions then
    update public.servicios
       set status = 'completed',
           next_appointment = null
     where id = new.servicio_id;
  elsif new.next_suggestion is not null then
    update public.servicios
       set next_appointment = new.next_suggestion
     where id = new.servicio_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sesiones_bump_servicio_ins on public.sesiones;
create trigger sesiones_bump_servicio_ins
after insert on public.sesiones
for each row execute function private.sesiones_bump_servicio();

-- ---------- RLS · servicios -------------------------------------------------
alter table public.servicios enable row level security;
alter table public.servicios force row level security;

-- super_admin: full access across all tenants.
drop policy if exists "servicios_super_admin_all" on public.servicios;
create policy "servicios_super_admin_all"
on public.servicios for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- profesional: full access scoped to their tenant.
drop policy if exists "servicios_profesional_all" on public.servicios;
create policy "servicios_profesional_all"
on public.servicios for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

-- asistente: READ-ONLY, gated by the existing 'clientas' view permission.
drop policy if exists "servicios_asistente_select" on public.servicios;
create policy "servicios_asistente_select"
on public.servicios for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

-- clienta self read: only her own services.
drop policy if exists "servicios_clienta_self_select" on public.servicios;
create policy "servicios_clienta_self_select"
on public.servicios for select
to authenticated
using (
  exists (
    select 1
      from public.clientes c
     where c.id = servicios.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- RLS · sesiones --------------------------------------------------
alter table public.sesiones enable row level security;
alter table public.sesiones force row level security;

drop policy if exists "sesiones_super_admin_all" on public.sesiones;
create policy "sesiones_super_admin_all"
on public.sesiones for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "sesiones_profesional_all" on public.sesiones;
create policy "sesiones_profesional_all"
on public.sesiones for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

drop policy if exists "sesiones_asistente_select" on public.sesiones;
create policy "sesiones_asistente_select"
on public.sesiones for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

drop policy if exists "sesiones_clienta_self_select" on public.sesiones;
create policy "sesiones_clienta_self_select"
on public.sesiones for select
to authenticated
using (
  exists (
    select 1
      from public.clientes c
     where c.id = sesiones.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- Grants -----------------------------------------------------------
grant select, insert, update, delete on public.servicios to authenticated;
grant select, insert, update, delete on public.sesiones  to authenticated;

-- =============================================================================
-- Storage bucket — `servicios-photos` for before/after session photos.
-- Path layout (enforced by policy): <tenant_id>/<cliente_id>/<uuid>.<ext>
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'servicios-photos',
  'servicios-photos',
  false,
  5242880,                                                -- 5 MiB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- super_admin: full storage access on the bucket.
drop policy if exists "servicios_storage_super_admin" on storage.objects;
create policy "servicios_storage_super_admin"
on storage.objects for all
to authenticated
using (
  bucket_id = 'servicios-photos'
  and (select private.is_super_admin())
)
with check (
  bucket_id = 'servicios-photos'
  and (select private.is_super_admin())
);

-- profesional: full access to objects under their tenant prefix.
drop policy if exists "servicios_storage_profesional" on storage.objects;
create policy "servicios_storage_profesional"
on storage.objects for all
to authenticated
using (
  bucket_id = 'servicios-photos'
  and (select private.current_app_role()) = 'profesional'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
)
with check (
  bucket_id = 'servicios-photos'
  and (select private.current_app_role()) = 'profesional'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
);

-- asistente: read only, gated by 'clientas' view permission, tenant prefix.
drop policy if exists "servicios_storage_asistente_select" on storage.objects;
create policy "servicios_storage_asistente_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'servicios-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','view'))
);

-- clienta read: only objects under her own cliente_id folder.
drop policy if exists "servicios_storage_clienta_self_select" on storage.objects;
create policy "servicios_storage_clienta_self_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'servicios-photos'
  and exists (
    select 1
      from public.clientes c
     where c.profile_id = (select auth.uid())
       and split_part(storage.objects.name, '/', 2) = c.id::text
       and split_part(storage.objects.name, '/', 1) = c.tenant_id::text
  )
);
