-- =============================================================================
-- SkinDesk · Rutinas (Constructor + Biblioteca)
-- =============================================================================
-- Two concepts that share the same shape:
--   · template   — reusable routine in the library, no cliente_id
--   · assignment — instance assigned to a specific clienta, evolves
--                  independently from the template it was forked from
--
-- Single table `rutinas` with a `kind` discriminator. Steps live in
-- `rutina_steps` with FK to a product from the catalog.
-- =============================================================================

-- ---------- Enums -----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rutina_kind') then
    create type public.rutina_kind as enum ('template','assignment');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rutina_momento') then
    create type public.rutina_momento as enum ('am','pm','both');
  end if;
end $$;

-- ---------- rutinas ---------------------------------------------------------
create table if not exists public.rutinas (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  professional_id     uuid references public.profiles(id) on delete set null,

  kind                public.rutina_kind   not null,
  name                text                 not null check (length(trim(name)) between 1 and 160),
  momento             public.rutina_momento not null default 'both',

  -- Skin classification (the profesional types these per routine; allow-
  -- listed via productos.schema for the chips, but stored as text so we
  -- can extend without DB migration).
  skin_type           text,
  skin_condition      text,

  main_objective      text,
  general_notes       text,

  -- Free-text routine tags ("Anti-acné", "Post-facial", custom).
  tags                text[] not null default '{}'::text[],

  -- ASSIGNMENT-only fields. Enforced by CHECK at the bottom: cliente_id is
  -- NOT NULL when kind = 'assignment' and NULL when kind = 'template'.
  cliente_id          uuid references public.clientes(id) on delete cascade,
  from_template_id    uuid references public.rutinas(id) on delete set null,
  client_message      text,

  -- TEMPLATE-only: token used to share the routine with another SkinDesk
  -- professional. Nullable until the user generates one. Unique so
  -- /rutinas/share/<token> can lookup directly.
  share_token         text unique,

  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint rutinas_kind_consistency check (
    (kind = 'template'   and cliente_id is null) or
    (kind = 'assignment' and cliente_id is not null)
  ),
  constraint rutinas_template_no_message check (
    kind = 'assignment' or client_message is null
  )
);

-- ---------- rutina_steps ----------------------------------------------------
create table if not exists public.rutina_steps (
  id                       uuid primary key default gen_random_uuid(),
  rutina_id                uuid not null references public.rutinas(id) on delete cascade,
  producto_id              uuid not null references public.productos(id) on delete restrict,

  -- Order index. 1-based for human-readable display; UNIQUE per rutina so
  -- the UI doesn't have to deduplicate.
  step_order               int  not null check (step_order >= 1),

  -- Per-step overrides — null = use the product's default value.
  custom_instruction       text,
  custom_amount            text,
  custom_absorption_time   text check (custom_absorption_time is null or custom_absorption_time in
    ('sin_espera','1_min','2_min','3_min','5_min','10_min','otro')),
  custom_frequency         text check (custom_frequency is null or custom_frequency in
    ('diario','3_semana','2_semana','1_semana','indicacion','otro')),
  custom_time_of_day       public.rutina_momento,
  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (rutina_id, step_order)
);

-- ---------- Indexes ---------------------------------------------------------
-- Library list: tenant + kind=template + not-archived, ordered by recent.
create index if not exists rutinas_library_idx
  on public.rutinas (tenant_id, created_at desc)
  where kind = 'template' and archived_at is null;

-- Cliente assignments: scoped per cliente, ordered by recent.
create index if not exists rutinas_cliente_active_idx
  on public.rutinas (cliente_id, created_at desc)
  where kind = 'assignment' and archived_at is null;

-- Step join: covers `select * from rutina_steps where rutina_id = X order by step_order`.
create index if not exists rutina_steps_rutina_order_idx
  on public.rutina_steps (rutina_id, step_order);

-- Producto reverse lookup (count usage, conflict detection later).
create index if not exists rutina_steps_producto_idx
  on public.rutina_steps (producto_id);

-- Share-token lookup (covered by UNIQUE, but partial cleans up the index
-- size — most rutinas have no token).
create index if not exists rutinas_share_token_idx
  on public.rutinas (share_token)
  where share_token is not null;

-- ---------- updated_at triggers --------------------------------------------
drop trigger if exists rutinas_set_updated_at on public.rutinas;
create trigger rutinas_set_updated_at
before update on public.rutinas
for each row execute function public.set_updated_at();

drop trigger if exists rutina_steps_set_updated_at on public.rutina_steps;
create trigger rutina_steps_set_updated_at
before update on public.rutina_steps
for each row execute function public.set_updated_at();

-- ---------- tenant + professional sync trigger -----------------------------
create or replace function private.rutinas_sync_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_role   public.app_role;
begin
  if new.professional_id is null then
    return new;
  end if;

  select tenant_id, role
    into v_tenant, v_role
    from public.profiles
   where id = new.professional_id;

  if v_tenant is null then
    raise exception 'rutinas.professional_id references a profile without a tenant'
      using errcode = '23514';
  end if;

  if v_role not in ('profesional','asistente') then
    raise exception 'rutinas.professional_id must be profesional or asistente (got %)', v_role
      using errcode = '23514';
  end if;

  new.tenant_id := v_tenant;
  return new;
end;
$$;

drop trigger if exists rutinas_sync_tenant_id_ins on public.rutinas;
create trigger rutinas_sync_tenant_id_ins
before insert on public.rutinas
for each row execute function private.rutinas_sync_tenant_id();

drop trigger if exists rutinas_sync_tenant_id_upd on public.rutinas;
create trigger rutinas_sync_tenant_id_upd
before update of professional_id on public.rutinas
for each row execute function private.rutinas_sync_tenant_id();

-- ---------- Maintain productos.routines_usage_count -------------------------
-- AFTER INSERT/DELETE on rutina_steps adjusts the denormalised counter.
-- Excludes archived rutinas so "Eliminé la rutina" doesn't keep inflating
-- the count.
create or replace function private.rutina_steps_sync_usage_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  if tg_op = 'INSERT' then
    select archived_at is null into v_active
      from public.rutinas where id = new.rutina_id;
    if coalesce(v_active, false) then
      update public.productos
         set routines_usage_count = routines_usage_count + 1
       where id = new.producto_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select archived_at is null into v_active
      from public.rutinas where id = old.rutina_id;
    if coalesce(v_active, false) then
      update public.productos
         set routines_usage_count = greatest(routines_usage_count - 1, 0)
       where id = old.producto_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists rutina_steps_usage_count on public.rutina_steps;
create trigger rutina_steps_usage_count
after insert or delete on public.rutina_steps
for each row execute function private.rutina_steps_sync_usage_count();

-- Archive ripple: when a rutina is archived, decrement the usage counter
-- for every step it had (and increment again when un-archived).
create or replace function private.rutinas_sync_usage_on_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    update public.productos p
       set routines_usage_count = greatest(p.routines_usage_count - sub.cnt, 0)
      from (
        select producto_id, count(*)::int as cnt
          from public.rutina_steps
         where rutina_id = new.id
         group by producto_id
      ) sub
     where p.id = sub.producto_id;
  elsif old.archived_at is not null and new.archived_at is null then
    update public.productos p
       set routines_usage_count = p.routines_usage_count + sub.cnt
      from (
        select producto_id, count(*)::int as cnt
          from public.rutina_steps
         where rutina_id = new.id
         group by producto_id
      ) sub
     where p.id = sub.producto_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rutinas_usage_on_archive on public.rutinas;
create trigger rutinas_usage_on_archive
after update of archived_at on public.rutinas
for each row execute function private.rutinas_sync_usage_on_archive();

-- ---------- RLS · rutinas ---------------------------------------------------
alter table public.rutinas enable row level security;
alter table public.rutinas force row level security;

-- super_admin
drop policy if exists "rutinas_super_admin_all" on public.rutinas;
create policy "rutinas_super_admin_all"
on public.rutinas for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- profesional: full access in own tenant.
drop policy if exists "rutinas_profesional_all" on public.rutinas;
create policy "rutinas_profesional_all"
on public.rutinas for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

-- asistente — re-uses the dedicated `catalogo` permission. Building a
-- routine consumes catalog products, so view/edit on catalog implies the
-- same here. When the permission catalogue grows we can split into a
-- `rutinas` key.
drop policy if exists "rutinas_asistente_select" on public.rutinas;
create policy "rutinas_asistente_select"
on public.rutinas for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('catalogo','view'))
);

drop policy if exists "rutinas_asistente_write" on public.rutinas;
create policy "rutinas_asistente_write"
on public.rutinas for all
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('catalogo','edit'))
)
with check (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('catalogo','edit'))
);

-- clienta SELF: her assigned routines only. Clinical fields stay
-- profesional-only; for clienta-facing surfaces we'll project a
-- security_invoker view that strips clinical_notes/conflicting fields.
drop policy if exists "rutinas_clienta_self_select" on public.rutinas;
create policy "rutinas_clienta_self_select"
on public.rutinas for select
to authenticated
using (
  kind = 'assignment'
  and cliente_id in (
    select id from public.clientes where profile_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.rutinas to authenticated;

-- ---------- RLS · rutina_steps ---------------------------------------------
alter table public.rutina_steps enable row level security;
alter table public.rutina_steps force row level security;

-- super_admin
drop policy if exists "rutina_steps_super_admin_all" on public.rutina_steps;
create policy "rutina_steps_super_admin_all"
on public.rutina_steps for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- staff (profesional + asistente) — access scoped via the parent rutina.
drop policy if exists "rutina_steps_staff_all" on public.rutina_steps;
create policy "rutina_steps_staff_all"
on public.rutina_steps for all
to authenticated
using (
  exists (
    select 1 from public.rutinas r
     where r.id = rutina_steps.rutina_id
       and r.tenant_id = (select private.current_tenant_id())
       and (
         (select private.current_app_role()) = 'profesional'
         or (
           (select private.current_app_role()) = 'asistente'
           and (select private.has_asistente_permission('catalogo','edit'))
         )
       )
  )
)
with check (
  exists (
    select 1 from public.rutinas r
     where r.id = rutina_steps.rutina_id
       and r.tenant_id = (select private.current_tenant_id())
       and (
         (select private.current_app_role()) = 'profesional'
         or (
           (select private.current_app_role()) = 'asistente'
           and (select private.has_asistente_permission('catalogo','edit'))
         )
       )
  )
);

-- asistente view-only — separate policy because the FOR ALL above requires edit.
drop policy if exists "rutina_steps_asistente_view" on public.rutina_steps;
create policy "rutina_steps_asistente_view"
on public.rutina_steps for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and (select private.has_asistente_permission('catalogo','view'))
  and exists (
    select 1 from public.rutinas r
     where r.id = rutina_steps.rutina_id
       and r.tenant_id = (select private.current_tenant_id())
  )
);

-- clienta self read — her assigned routine's steps.
drop policy if exists "rutina_steps_clienta_self_select" on public.rutina_steps;
create policy "rutina_steps_clienta_self_select"
on public.rutina_steps for select
to authenticated
using (
  exists (
    select 1 from public.rutinas r
     join public.clientes c on c.id = r.cliente_id
     where r.id = rutina_steps.rutina_id
       and r.kind = 'assignment'
       and c.profile_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.rutina_steps to authenticated;
