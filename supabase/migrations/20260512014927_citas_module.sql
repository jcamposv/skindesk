-- =============================================================================
-- SkinDesk · Citas (agenda) module
-- =============================================================================
-- Scheduled appointments. A cita is the *calendar event*, not the clinical
-- record — completing a cita does NOT auto-create a sesion. The cosmetóloga
-- registers sesiones explicitly from the Servicios tab. Citas may optionally
-- reference a servicio for context (so the form knows it's a continuation
-- of an existing treatment) but they also support standalone events
-- (consultas, first-time evaluations).
--
-- Mirrors the existing pattern:
--   · `tenant_id` denormalised + synced from cliente
--   · BEFORE triggers stamp audit cols + bump version
--   · RLS scoped per role; asistente write-allowed via
--     `has_asistente_permission('citas','create')` so a future permission
--     toggle in settings can flip it on without a migration.
-- =============================================================================

-- ---------- Enum ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cita_status') then
    create type public.cita_status as enum (
      'pendiente',
      'confirmada',
      'completada',
      'cancelada',
      'ausente'
    );
  end if;
end $$;

-- ---------- citas table -----------------------------------------------------
create table if not exists public.citas (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  cliente_id         uuid not null references public.clientes(id) on delete cascade,
  -- Optional FK: standalone citas (consultations) carry null here.
  servicio_id        uuid references public.servicios(id) on delete set null,
  -- Responsible professional (canonical FK + free-text fallback, mirrors
  -- the servicios.professional_id pattern).
  professional_id    uuid references public.profiles(id) on delete set null,
  professional_label text,

  title              text,
  start_at           timestamptz not null,
  end_at             timestamptz not null,
  status             public.cita_status not null default 'pendiente',
  notes              text,

  version            integer not null default 1,
  created_by         uuid references public.profiles(id) on delete restrict,
  last_editor_id     uuid references public.profiles(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint citas_end_after_start check (end_at > start_at)
);

-- ---------- Indexes ---------------------------------------------------------
-- Calendar's main read pattern is "give me events between [from, to] for
-- this tenant". `(tenant_id, start_at)` covers that; we also keep a
-- (tenant_id, professional_id, start_at) for per-staff filtering and a
-- (cliente_id, start_at desc) for the cliente-detail flow.
create index if not exists citas_tenant_start_idx
  on public.citas (tenant_id, start_at);
create index if not exists citas_tenant_prof_start_idx
  on public.citas (tenant_id, professional_id, start_at);
create index if not exists citas_cliente_start_idx
  on public.citas (cliente_id, start_at desc);
create index if not exists citas_tenant_status_idx
  on public.citas (tenant_id, status);

-- ---------- updated_at trigger ---------------------------------------------
drop trigger if exists citas_set_updated_at on public.citas;
create trigger citas_set_updated_at
before update on public.citas
for each row execute function public.set_updated_at();

-- ---------- tenant_id sync trigger -----------------------------------------
create or replace function private.citas_sync_tenant_id()
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
    raise exception 'Cannot create cita for unknown cliente_id %', new.cliente_id
      using errcode = '23503';
  end if;

  new.tenant_id := v_cliente_tenant;
  return new;
end;
$$;

drop trigger if exists citas_sync_tenant_id_ins on public.citas;
create trigger citas_sync_tenant_id_ins
before insert on public.citas
for each row execute function private.citas_sync_tenant_id();

drop trigger if exists citas_sync_tenant_id_upd on public.citas;
create trigger citas_sync_tenant_id_upd
before update of cliente_id on public.citas
for each row execute function private.citas_sync_tenant_id();

-- ---------- audit + optimistic concurrency ----------------------------------
create or replace function private.citas_audit_and_version()
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
      raise exception 'citas audit: auth.uid() is null' using errcode = '42501';
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

drop trigger if exists citas_audit_ins on public.citas;
create trigger citas_audit_ins
before insert on public.citas
for each row execute function private.citas_audit_and_version();

drop trigger if exists citas_audit_upd on public.citas;
create trigger citas_audit_upd
before update on public.citas
for each row execute function private.citas_audit_and_version();

-- ---------- RLS -------------------------------------------------------------
alter table public.citas enable row level security;
alter table public.citas force row level security;

drop policy if exists "citas_super_admin_all" on public.citas;
create policy "citas_super_admin_all"
on public.citas for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "citas_profesional_all" on public.citas;
create policy "citas_profesional_all"
on public.citas for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

-- Asistente: read always; insert/update gated by has_asistente_permission.
-- Letting them schedule citas is the most common assistant workflow.
drop policy if exists "citas_asistente_select" on public.citas;
create policy "citas_asistente_select"
on public.citas for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('citas','view'))
);

drop policy if exists "citas_asistente_insert" on public.citas;
create policy "citas_asistente_insert"
on public.citas for insert
to authenticated
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('citas','create'))
);

drop policy if exists "citas_asistente_update" on public.citas;
create policy "citas_asistente_update"
on public.citas for update
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('citas','update'))
)
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('citas','update'))
);

-- Clienta self-read: own appointments only.
drop policy if exists "citas_clienta_self_select" on public.citas;
create policy "citas_clienta_self_select"
on public.citas for select
to authenticated
using (
  exists (
    select 1
      from public.clientes c
     where c.id = citas.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- Grants ----------------------------------------------------------
grant select, insert, update, delete on public.citas to authenticated;
