-- =============================================================================
-- SkinDesk · Productos · Hardening (review feedback)
-- =============================================================================
-- Five fixes bundled together:
--   1. Storage bucket gets file_size_limit + allowed_mime_types so a
--      malicious client can't bypass the 5 MB / JPG-PNG-WEBP browser checks.
--   2. RPC `productos_stats()` returns the 4 stat counters in a single
--      round-trip — replaces 4 separate queries in app code.
--   3. RLS policies swap `clientas` permission key for the dedicated
--      `catalogo` key (already declared in `ASISTENTE_PERMISSION_KEYS`).
--   4. Trigram extension + generated column + GIN index on the joined
--      main_ingredients text so partial-match search works
--      (`Niacin` matches `Niacinamide`).
--   5. Future-proofing comment block documenting the `productos_public`
--      security_invoker view that must exist before exposing the catalog
--      to clientas.
-- =============================================================================

-- ---------- 1. Storage bucket constraints -----------------------------------
-- Belt-and-suspenders on top of the client-side validation in
-- `ProductoPhotoUpload`. The browser already refuses >5 MB and non-image
-- MIME, but a direct API call from an authenticated user could bypass it.
-- These bucket settings make Supabase itself reject the upload.
update storage.buckets
   set file_size_limit    = 5 * 1024 * 1024,                 -- 5 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'productos-photos';

-- ---------- 2. Stats RPC ----------------------------------------------------
-- Single round-trip aggregator. Replaces the 4-query stats fetcher in
-- `getProductosStats`. `security invoker` so RLS still scopes the counts
-- to the caller's tenant. `stable` because the function is read-only
-- and idempotent within a transaction.
create or replace function public.productos_stats()
returns table(
  total      int,
  categories int,
  recent     int,
  used       int
)
language sql
stable
security invoker
set search_path = public
as $$
  with active as (
    select category, created_at, routines_usage_count
      from public.productos
     where archived_at is null
  )
  select
    (select count(*)::int from active),
    (select count(distinct category)::int from active),
    (select count(*)::int from active where created_at >= (now() - interval '7 days')),
    (select count(*)::int from active where routines_usage_count > 0)
$$;

grant execute on function public.productos_stats() to authenticated;

-- ---------- 3. Split asistente permission: clientas → catalogo --------------
-- `catalogo` is already declared in src/types/supabase.ts as a permission
-- key; we just had the policies on `clientas` because the dedicated key
-- wasn't wired yet. Now it is. Existing asistentes with `clientas:edit`
-- but no `catalogo` will lose write access — intentional: the profesional
-- must explicitly grant the new permission.

drop policy if exists "productos_asistente_select" on public.productos;
create policy "productos_asistente_select"
on public.productos for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('catalogo','view'))
);

drop policy if exists "productos_asistente_write" on public.productos;
create policy "productos_asistente_write"
on public.productos for all
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

drop policy if exists "productos_storage_asistente_select" on storage.objects;
create policy "productos_storage_asistente_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('catalogo','view'))
);

drop policy if exists "productos_storage_asistente_write" on storage.objects;
create policy "productos_storage_asistente_write"
on storage.objects for all
to authenticated
using (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('catalogo','edit'))
)
with check (
  bucket_id = 'productos-photos'
  and (select private.current_app_role()) = 'asistente'
  and split_part(name, '/', 1) = (select private.current_tenant_id()::text)
  and (select private.has_asistente_permission('catalogo','edit'))
);

-- ---------- 4. Partial-match ingredient search ------------------------------
-- The `main_ingredients.cs.{term}` filter in `listProductos` requires an
-- EXACT match against an array element ("Niacinamide" matches; "Niacin"
-- does not). Real ingredient search wants partial: typing "ácido" should
-- surface "Ácido Hialurónico" and "Ácido Salicílico".
--
-- Approach: a regular `main_ingredients_text` column maintained by trigger
-- + trigram GIN index. We can't use a `generated always as` column because
-- `array_to_string` is marked STABLE (not IMMUTABLE) by Postgres — locale-
-- dependent — and generated columns require an immutable expression.
-- Trigger-maintained gets us the same outcome with a tiny BEFORE INSERT/
-- UPDATE cost.
create extension if not exists pg_trgm;

alter table public.productos
  add column if not exists main_ingredients_text text not null default '';

create or replace function private.productos_sync_ingredients_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.main_ingredients_text := array_to_string(new.main_ingredients, ' ');
  return new;
end;
$$;

drop trigger if exists productos_sync_ingredients_text on public.productos;
create trigger productos_sync_ingredients_text
before insert or update of main_ingredients on public.productos
for each row execute function private.productos_sync_ingredients_text();

-- Backfill existing rows.
update public.productos
   set main_ingredients_text = array_to_string(main_ingredients, ' ')
 where main_ingredients_text = '' and main_ingredients <> '{}'::text[];

create index if not exists productos_main_ingredients_trgm
  on public.productos
  using gin (main_ingredients_text gin_trgm_ops)
  where archived_at is null;

-- ---------- 5. Routine-builder readiness — forward-looking comment ---------
-- When the routine builder module lands, two things must exist BEFORE
-- exposing products to clientas:
--
--   a) An UPDATE trigger on routine_steps that maintains
--      productos.routines_usage_count. The column is denormalised today
--      and sits at 0; the catalog UI surfaces it, but no writer updates
--      it yet.
--
--   b) A `productos_public` view with `WITH (security_invoker = true)`
--      that projects ONLY the clienta-safe columns:
--        id, name, brand, category, photo_path, main_ingredients,
--        application_instruction, suggested_amount, absorption_time,
--        time_of_day, frequency
--      EXCLUDING precautions, conflicting_ingredients, clinical_notes.
--      The clienta portal queries the view; RLS on `productos` blocks
--      direct access. This keeps clinical fields professional-only.
--
-- This migration intentionally does NOT ship the view because the clienta-
-- facing rutina screens don't exist yet and the view shape depends on
-- them. Reminder for the routine builder sprint.
