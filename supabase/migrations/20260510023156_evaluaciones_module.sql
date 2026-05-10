-- =============================================================================
-- SkinDesk · Evaluaciones module — clinical evaluation tied 1:1 with cliente
-- =============================================================================
-- One evaluación per clienta (UNIQUE on cliente_id). Sections persist as
-- JSONB columns matching the React form shape — autosave writes only the
-- changed sections. RLS mirrors the clientes module so authorization piggy-
-- backs on the existing tenant scoping.
--
-- Sections:
--   datos        — motivo de consulta, facial previo
--   anamnesis    — patologías, alergias, medicación, etc.
--   habitos      — alimentación, sol, rutinas
--   diagnostico  — biotipo, fototipo, mapa facial (pin array)
--   plan         — objetivo + tratamientos sugeridos + sesiones + notas
-- =============================================================================

-- ---------- Enum -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'evaluacion_status') then
    create type public.evaluacion_status as enum (
      'borrador',
      'completada'
    );
  end if;
end $$;

-- ---------- Table ------------------------------------------------------------
create table if not exists public.evaluaciones (
  id                       uuid primary key default gen_random_uuid(),
  -- One evaluación per clienta. CASCADE so deleting the clienta wipes her
  -- evaluación too (no orphan clinical data).
  cliente_id               uuid not null unique
    references public.clientes(id) on delete cascade,
  -- Denormalised tenant for RLS perf. Synced from clientes via trigger.
  tenant_id                uuid not null
    references public.tenants(id) on delete cascade,
  -- Profesional who owns the evaluación. Cached `profesional_nombre` to
  -- avoid joining profiles on every read for the autosave indicator.
  profesional_id           uuid not null
    references public.profiles(id) on delete restrict,
  profesional_nombre       text not null,

  fecha                    date not null default current_date,
  status                   public.evaluacion_status not null default 'borrador',
  ultimo_step              smallint not null default 0,

  -- Section blobs. Default '{}'::jsonb so partial reads never crash on null.
  datos                    jsonb not null default '{}'::jsonb,
  anamnesis                jsonb not null default '{}'::jsonb,
  habitos                  jsonb not null default '{}'::jsonb,
  diagnostico              jsonb not null default '{}'::jsonb,
  plan                     jsonb not null default '{}'::jsonb,

  consentimiento_aceptado  boolean not null default false,
  firma_data_url           text,
  firmante_nombre          text,
  firma_signed_at          timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint evaluaciones_section_objects_check check (
    jsonb_typeof(datos)       = 'object' and
    jsonb_typeof(anamnesis)   = 'object' and
    jsonb_typeof(habitos)     = 'object' and
    jsonb_typeof(diagnostico) = 'object' and
    jsonb_typeof(plan)        = 'object'
  )
);

create index if not exists evaluaciones_tenant_idx
  on public.evaluaciones (tenant_id);
create index if not exists evaluaciones_cliente_idx
  on public.evaluaciones (cliente_id);
create index if not exists evaluaciones_profesional_idx
  on public.evaluaciones (profesional_id);
create index if not exists evaluaciones_updated_idx
  on public.evaluaciones (tenant_id, updated_at desc);

-- ---------- updated_at trigger ----------------------------------------------
drop trigger if exists evaluaciones_set_updated_at on public.evaluaciones;
create trigger evaluaciones_set_updated_at
before update on public.evaluaciones
for each row execute function public.set_updated_at();

-- ---------- tenant_id sync trigger ------------------------------------------
-- Mirrors the clientes pattern. We always pull tenant_id from the cliente
-- row so the client cannot pass a stale or forged value.
create or replace function private.evaluaciones_sync_tenant_id()
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
    raise exception 'Cannot create evaluación for unknown cliente_id %', new.cliente_id
      using errcode = '23503';
  end if;

  new.tenant_id := v_cliente_tenant;
  return new;
end;
$$;

drop trigger if exists evaluaciones_sync_tenant_id_ins on public.evaluaciones;
create trigger evaluaciones_sync_tenant_id_ins
before insert on public.evaluaciones
for each row execute function private.evaluaciones_sync_tenant_id();

drop trigger if exists evaluaciones_sync_tenant_id_upd on public.evaluaciones;
create trigger evaluaciones_sync_tenant_id_upd
before update of cliente_id on public.evaluaciones
for each row execute function private.evaluaciones_sync_tenant_id();

-- ---------- RLS --------------------------------------------------------------
alter table public.evaluaciones enable row level security;
alter table public.evaluaciones force row level security;

-- super_admin: full access across all tenants.
drop policy if exists "evaluaciones_super_admin_all" on public.evaluaciones;
create policy "evaluaciones_super_admin_all"
on public.evaluaciones for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- profesional: full access scoped to their own tenant.
drop policy if exists "evaluaciones_profesional_all" on public.evaluaciones;
create policy "evaluaciones_profesional_all"
on public.evaluaciones for all
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
drop policy if exists "evaluaciones_asistente_select" on public.evaluaciones;
create policy "evaluaciones_asistente_select"
on public.evaluaciones for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

-- asistente edit: gated by 'clientas' edit permission, scoped to tenant.
drop policy if exists "evaluaciones_asistente_update" on public.evaluaciones;
create policy "evaluaciones_asistente_update"
on public.evaluaciones for update
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

drop policy if exists "evaluaciones_asistente_insert" on public.evaluaciones;
create policy "evaluaciones_asistente_insert"
on public.evaluaciones for insert
to authenticated
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','edit'))
);

-- clienta self read: she can read her own evaluación (one-way; cannot edit).
drop policy if exists "evaluaciones_clienta_self_select" on public.evaluaciones;
create policy "evaluaciones_clienta_self_select"
on public.evaluaciones for select
to authenticated
using (
  exists (
    select 1
      from public.clientes c
     where c.id = evaluaciones.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- Grants -----------------------------------------------------------
grant select, insert, update, delete on public.evaluaciones to authenticated;
