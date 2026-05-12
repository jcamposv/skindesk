-- =============================================================================
-- SkinDesk · Productos (Catálogo de productos)
-- =============================================================================
-- Per-professional catalogue of skincare products used to compose routines.
-- This is NOT inventory, NOT ecommerce — purely informational/clinical.
--
-- Design notes
-- ────────────
-- One table (`productos`) carries everything. Skin types, tags and main
-- ingredients are arrays of text constrained by CHECK against an allow-list.
-- That keeps reads to a single round-trip (no join fan-out for the catalog
-- grid), still gives us indexable GIN search on each array, and lets us add
-- a new tag/skin-type by editing the CHECK without a schema change to
-- every catalog row.
--
-- `routines_usage_count` is a denormalised counter the routine builder will
-- maintain via trigger when it lands. Defaults to 0 so the UI works today.
--
-- Soft-archive (`archived_at`) rather than DELETE so existing routines that
-- reference the product don't break. The catalog list filters
-- `archived_at IS NULL`.
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'producto_categoria') then
    create type public.producto_categoria as enum (
      'limpiador',
      'tonico',
      'serum',
      'hidratante',
      'spf',
      'contorno_ojos',
      'mascarilla',
      'exfoliante',
      'regenerante',
      'desmaquillante',
      'agua_micelar',
      'tratamiento_especifico',
      'ampolleta',
      'bruma',
      'balsamo_labios'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'producto_tiempo_dia') then
    create type public.producto_tiempo_dia as enum (
      'am_pm',
      'am',
      'pm'
    );
  end if;
end $$;

-- ---------- Table ------------------------------------------------------------
create table if not exists public.productos (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  -- Owning professional. Asistentes with permission can also edit, but the
  -- "owner" is always the profesional whose tenant this lives under.
  professional_id           uuid references public.profiles(id) on delete set null,

  -- Identity
  name                      text not null check (length(trim(name)) between 1 and 160),
  brand                     text check (brand is null or length(brand) <= 120),
  category                  public.producto_categoria not null,

  -- Photo / fallback illustration
  -- Storage path under the `productos-photos` bucket. NULL means render the
  -- category illustration on the card.
  photo_path                text,

  -- Ingredients
  -- main_ingredients: up to 3, shown as colored tags on the card and in the
  -- routine builder.
  main_ingredients          text[] not null default '{}'::text[],
  -- Full INCI list (optional free text — long lists like
  -- "Aqua, Glycerin, Niacinamide, …").
  ingredients_inci          text,

  -- Skin types (allow-listed). `Todas` is materialised at write time into
  -- the full standard list so reads don't need to special-case it.
  skin_types                text[] not null default '{}'::text[],
  -- Free-text custom types when the professional ticks "Otro".
  custom_skin_types         text[] not null default '{}'::text[],

  -- Application instructions
  application_instruction   text,
  suggested_amount          text check (suggested_amount is null or length(suggested_amount) <= 120),
  absorption_time           text check (absorption_time is null or absorption_time in
    ('sin_espera','1_min','2_min','3_min','5_min','10_min','otro')),
  time_of_day               public.producto_tiempo_dia,
  frequency                 text check (frequency is null or frequency in
    ('diario','3_semana','2_semana','1_semana','indicacion','otro')),

  -- Tags
  additional_tags           text[] not null default '{}'::text[],

  -- Clinical (profesional-only — never exposed in clienta-facing surfaces)
  precautions               text,
  conflicting_ingredients   text[] not null default '{}'::text[],
  clinical_notes            text,

  -- Routines-builder denormalised counter. Updated by trigger when the
  -- routines module ships; today every row sits at 0.
  routines_usage_count      integer not null default 0 check (routines_usage_count >= 0),

  -- Lifecycle
  archived_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Array shape + cardinality guards
  constraint productos_main_ingredients_max_3
    check (array_length(main_ingredients, 1) is null or array_length(main_ingredients, 1) <= 3),
  constraint productos_skin_types_allow_list check (
    skin_types <@ array[
      'normal','mixta','grasa','seca','sensible','acne','madura',
      'pigmentada','deshidratada','ocluida','asfixiada','envejecida'
    ]::text[]
  ),
  constraint productos_additional_tags_allow_list check (
    additional_tags <@ array[
      'anti_acne','antiedad','hidratante','iluminador','despigmentante',
      'calmante','antioxidante','oil_free','sin_fragancia','vegano',
      'exfoliante','post_tratamiento','spf','cc_cream','hipoalergenico',
      'antiinflamatorio','antibacteriano','regenerante','queratolitico',
      'refrescante','peptidos','exosomas','pdrn','enzimas','reparador'
    ]::text[]
  )
);

-- ---------- Indexes ----------------------------------------------------------
-- Tenant-scoped reads land on this first; partial WHERE archived_at IS NULL
-- because the list view never shows archived rows.
create index if not exists productos_tenant_active_idx
  on public.productos (tenant_id, created_at desc)
  where archived_at is null;

create index if not exists productos_tenant_category_idx
  on public.productos (tenant_id, category)
  where archived_at is null;

create index if not exists productos_tenant_name_idx
  on public.productos (tenant_id, lower(name))
  where archived_at is null;

create index if not exists productos_skin_types_gin
  on public.productos using gin (skin_types)
  where archived_at is null;

create index if not exists productos_tags_gin
  on public.productos using gin (additional_tags)
  where archived_at is null;

create index if not exists productos_main_ingredients_gin
  on public.productos using gin (main_ingredients)
  where archived_at is null;

-- ---------- updated_at trigger ----------------------------------------------
drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
before update on public.productos
for each row execute function public.set_updated_at();

-- ---------- tenant + professional sync trigger ------------------------------
-- The client sends `professional_id` in the insert (the action layer pulls
-- it from the session). Below trigger guarantees tenant_id matches whatever
-- tenant the professional belongs to, regardless of what the client passed.
create or replace function private.productos_sync_tenant_id()
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
    raise exception 'productos.professional_id references a profile without a tenant'
      using errcode = '23514';
  end if;

  -- Only profesional / asistente can own a product. Defence in depth on
  -- top of the RLS policies below.
  if v_role not in ('profesional','asistente') then
    raise exception 'productos.professional_id must be profesional or asistente (got %)', v_role
      using errcode = '23514';
  end if;

  new.tenant_id := v_tenant;
  return new;
end;
$$;

drop trigger if exists productos_sync_tenant_id_ins on public.productos;
create trigger productos_sync_tenant_id_ins
before insert on public.productos
for each row execute function private.productos_sync_tenant_id();

drop trigger if exists productos_sync_tenant_id_upd on public.productos;
create trigger productos_sync_tenant_id_upd
before update of professional_id on public.productos
for each row execute function private.productos_sync_tenant_id();

-- ---------- RLS --------------------------------------------------------------
alter table public.productos enable row level security;
alter table public.productos force row level security;

-- super_admin: full access.
drop policy if exists "productos_super_admin_all" on public.productos;
create policy "productos_super_admin_all"
on public.productos for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- profesional: full access scoped to own tenant.
drop policy if exists "productos_profesional_all" on public.productos;
create policy "productos_profesional_all"
on public.productos for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

-- asistente view: re-uses 'clientas' permission for now. When the permission
-- catalogue grows ("productos:view/edit") we'll split.
drop policy if exists "productos_asistente_select" on public.productos;
create policy "productos_asistente_select"
on public.productos for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

drop policy if exists "productos_asistente_write" on public.productos;
create policy "productos_asistente_write"
on public.productos for all
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

-- NB: clientas have no policy here — clinical notes / conflicts are
-- professional-only. The routine builder will project public-safe fields
-- through a security_invoker view in a future migration.

-- ---------- Grants -----------------------------------------------------------
grant select, insert, update, delete on public.productos to authenticated;

-- ============================================================================
-- Storage bucket — productos-photos
-- ============================================================================
-- Private bucket. Path convention: <tenant_id>/<producto_id>/<filename>
insert into storage.buckets (id, name, public)
values ('productos-photos', 'productos-photos', false)
on conflict (id) do nothing;

-- super_admin: full access.
drop policy if exists "productos_storage_super_admin" on storage.objects;
create policy "productos_storage_super_admin"
on storage.objects for all
to authenticated
using (
  bucket_id = 'productos-photos'
  and (select private.is_super_admin())
)
with check (
  bucket_id = 'productos-photos'
  and (select private.is_super_admin())
);

-- profesional: full access to tenant prefix.
drop policy if exists "productos_storage_profesional" on storage.objects;
create policy "productos_storage_profesional"
on storage.objects for all
to authenticated
using (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'profesional'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
)
with check (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'profesional'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
);

-- asistente read: gated by clientas:view.
drop policy if exists "productos_storage_asistente_select" on storage.objects;
create policy "productos_storage_asistente_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','view'))
);

-- asistente write: gated by clientas:edit. Upsert needs INSERT+SELECT+UPDATE
-- — the FOR ALL policy below covers all three.
drop policy if exists "productos_storage_asistente_write" on storage.objects;
create policy "productos_storage_asistente_write"
on storage.objects for all
to authenticated
using (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','edit'))
)
with check (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('clientas','edit'))
);
