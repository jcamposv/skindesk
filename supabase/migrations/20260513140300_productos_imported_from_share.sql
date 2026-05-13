-- =============================================================================
-- SkinDesk · productos.imported_from_share — flag share-imported productos
-- =============================================================================
-- When a profesional imports a shared rutina that includes productos
-- missing from her catalog, those productos get cloned into her tenant
-- (see importShareRutinaAction). This column lets the UI surface a "vino
-- de una rutina compartida" badge so the receiver knows to review
-- ingredients, photos, etc. before relying on the auto-created entry.
-- =============================================================================

alter table public.productos
  add column if not exists imported_from_share boolean not null default false;

-- The lookup pattern is "show me imported productos pending review" —
-- partial index keeps the bloat low because most productos won't be
-- flagged.
create index if not exists productos_imported_from_share_idx
  on public.productos (tenant_id, created_at desc)
  where imported_from_share = true;
