-- =============================================================================
-- SkinDesk · Atlas dermocosmético (Biblioteca clínica curada centralmente)
-- =============================================================================
-- The Atlas is a platform-managed knowledge library: super_admin authors the
-- content, profesional + asistente consume it read-only, clienta has no
-- access. There is no `tenant_id` on Atlas rows — the content is global to
-- every tenant in the SaaS.
--
-- Sections (fixed, enum-driven so we get index-friendly equality + label
-- mapping in the app):
--   biotipos             · Biotipos cutáneos
--   estados_cutaneos     · Estados cutáneos
--   fitzpatrick          · Escala de Fitzpatrick
--   glogau               · Escala de Glogau
--   piramide_skincare    · Pirámide del skincare
--   principios_activos   · Principios activos
--   compatibilidad_activos · Compatibilidad de activos
--
-- Entries can carry rich-text (markdown body), tags, a cover image and an
-- arbitrary number of attached files of three kinds: pdf, html, image. The
-- HTML files are interactive guides authored externally and rendered inside
-- a sandboxed iframe — we store the file as-is and serve it via signed URL.
--
-- Soft-archive (`archived_at`) is reserved for a future move; today we use
-- a 3-state `status` (draft/published/archived). The reader UI lists only
-- `published` rows.
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'atlas_section') then
    create type public.atlas_section as enum (
      'biotipos',
      'estados_cutaneos',
      'fitzpatrick',
      'glogau',
      'piramide_skincare',
      'principios_activos',
      'compatibilidad_activos'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'atlas_entry_status') then
    create type public.atlas_entry_status as enum (
      'draft',
      'published',
      'archived'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'atlas_file_kind') then
    create type public.atlas_file_kind as enum (
      'pdf',
      'html',
      'image'
    );
  end if;
end $$;

-- ---------- atlas_entries ----------------------------------------------------
create table if not exists public.atlas_entries (
  id            uuid primary key default gen_random_uuid(),
  section       public.atlas_section not null,
  -- Slug is unique within a section so `/atlas/<section>/<slug>` is stable.
  slug          text not null,
  title         text not null check (length(trim(title)) between 1 and 200),
  description   text check (description is null or length(description) <= 600),
  -- Optional markdown body for short articles authored directly in the CMS.
  -- Long-form / interactive content lives in attached files.
  body_md       text,
  tags          text[] not null default '{}'::text[],
  -- Cover storage path under `atlas` bucket. Convention:
  -- `entries/<entry_id>/cover.<ext>`.
  cover_path    text,
  status        public.atlas_entry_status not null default 'draft',
  -- Manual ordering inside a section. Lower first.
  position      integer not null default 0,
  -- Super_admin author. SET NULL on delete so the entry survives staff churn.
  author_id     uuid references public.profiles(id) on delete set null,
  -- Lifecycle
  published_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Search vector. Cannot be a GENERATED column because `to_tsvector(regconfig,
  -- text)` is STABLE, not IMMUTABLE (Postgres rejects it with SQLSTATE 42P17).
  -- We maintain it via the trigger below — same end result, no extra cost on
  -- the read path.
  search_tsv    tsvector,

  constraint atlas_entries_slug_per_section unique (section, slug)
);

-- ---------- atlas_files ------------------------------------------------------
create table if not exists public.atlas_files (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references public.atlas_entries(id) on delete cascade,
  kind           public.atlas_file_kind not null,
  -- Storage path inside the `atlas` bucket. Convention:
  -- `entries/<entry_id>/<file_id>.<ext>`. We never reuse paths across kinds.
  storage_path   text not null,
  original_name  text not null check (length(original_name) <= 240),
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes >= 0),
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- Indexes ----------------------------------------------------------
-- Reader path: list published entries in a section, ordered by position then
-- recency. Partial index keeps the hot path narrow.
create index if not exists atlas_entries_section_published_idx
  on public.atlas_entries (section, position, published_at desc)
  where status = 'published';

-- CMS path: every entry by section + created_at (admin list).
create index if not exists atlas_entries_section_created_idx
  on public.atlas_entries (section, created_at desc);

-- Tag faceting / filter chips.
create index if not exists atlas_entries_tags_gin
  on public.atlas_entries using gin (tags);

-- Full-text search over title/description/tags/body.
create index if not exists atlas_entries_search_gin
  on public.atlas_entries using gin (search_tsv);

-- Files list per entry.
create index if not exists atlas_files_entry_idx
  on public.atlas_files (entry_id, position, created_at);

-- ---------- updated_at trigger ----------------------------------------------
drop trigger if exists atlas_entries_set_updated_at on public.atlas_entries;
create trigger atlas_entries_set_updated_at
before update on public.atlas_entries
for each row execute function public.set_updated_at();

-- ---------- search_tsv trigger ----------------------------------------------
-- Keeps the FTS column in sync with title/description/tags/body. Runs on
-- INSERT and on UPDATE of any source column; the WHEN clause skips writes
-- that don't touch FTS-relevant fields so unrelated updates (status flips,
-- position bumps) don't pay the tokenisation cost.
create or replace function private.atlas_entries_set_search_tsv()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('spanish', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(coalesce(new.tags, '{}'::text[]), ' ')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.body_md, '')), 'C');
  return new;
end;
$$;

drop trigger if exists atlas_entries_set_search_tsv_ins on public.atlas_entries;
create trigger atlas_entries_set_search_tsv_ins
before insert on public.atlas_entries
for each row execute function private.atlas_entries_set_search_tsv();

drop trigger if exists atlas_entries_set_search_tsv_upd on public.atlas_entries;
create trigger atlas_entries_set_search_tsv_upd
before update of title, description, tags, body_md on public.atlas_entries
for each row execute function private.atlas_entries_set_search_tsv();

-- ---------- status / lifecycle trigger --------------------------------------
-- Keeps published_at / archived_at in sync with the status enum. The CMS
-- doesn't have to remember to set them.
create or replace function private.atlas_entries_sync_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := coalesce(new.published_at, now());
  end if;

  if new.status = 'archived' and (old.status is distinct from 'archived' or new.archived_at is null) then
    new.archived_at := coalesce(new.archived_at, now());
  end if;

  -- Re-publishing clears the archived stamp so the row reads as fresh.
  if new.status = 'published' and new.archived_at is not null then
    new.archived_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_entries_sync_lifecycle_ins on public.atlas_entries;
create trigger atlas_entries_sync_lifecycle_ins
before insert on public.atlas_entries
for each row execute function private.atlas_entries_sync_lifecycle();

drop trigger if exists atlas_entries_sync_lifecycle_upd on public.atlas_entries;
create trigger atlas_entries_sync_lifecycle_upd
before update of status on public.atlas_entries
for each row execute function private.atlas_entries_sync_lifecycle();

-- ---------- RLS · atlas_entries ---------------------------------------------
alter table public.atlas_entries enable row level security;
alter table public.atlas_entries force row level security;

-- super_admin: full access (CMS).
drop policy if exists "atlas_entries_super_admin_all" on public.atlas_entries;
create policy "atlas_entries_super_admin_all"
on public.atlas_entries for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- profesional + asistente: SELECT only, only `published` rows. Atlas content
-- is global to the SaaS — there is no tenant_id on the row.
drop policy if exists "atlas_entries_staff_select_published" on public.atlas_entries;
create policy "atlas_entries_staff_select_published"
on public.atlas_entries for select
to authenticated
using (
  status = 'published'
  and (select private.current_app_role()) in ('profesional','asistente')
);

-- NB: clienta has no policy → no access. Defence-in-depth on top of the
-- staff-only route guard in the Next.js layout.

-- ---------- RLS · atlas_files -----------------------------------------------
alter table public.atlas_files enable row level security;
alter table public.atlas_files force row level security;

-- super_admin: full access.
drop policy if exists "atlas_files_super_admin_all" on public.atlas_files;
create policy "atlas_files_super_admin_all"
on public.atlas_files for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- staff: SELECT only, and only files whose parent entry is published.
-- We join via `exists` rather than a denormalised `status` column on the
-- file row so the source of truth stays on `atlas_entries`.
drop policy if exists "atlas_files_staff_select_published" on public.atlas_files;
create policy "atlas_files_staff_select_published"
on public.atlas_files for select
to authenticated
using (
  (select private.current_app_role()) in ('profesional','asistente')
  and exists (
    select 1 from public.atlas_entries e
    where e.id = atlas_files.entry_id
      and e.status = 'published'
  )
);

-- ---------- Grants -----------------------------------------------------------
grant select, insert, update, delete on public.atlas_entries to authenticated;
grant select, insert, update, delete on public.atlas_files   to authenticated;

-- ============================================================================
-- Storage bucket · `atlas`
-- ============================================================================
-- Private bucket, signed-URL access. Path convention:
--   entries/<entry_id>/cover.<ext>
--   entries/<entry_id>/<file_id>.<ext>
insert into storage.buckets (id, name, public)
values ('atlas', 'atlas', false)
on conflict (id) do nothing;

-- super_admin: full access — needed for upload (INSERT), preview (SELECT),
-- overwrite (UPDATE) and cleanup (DELETE). Upsert specifically needs all of
-- INSERT + SELECT + UPDATE.
drop policy if exists "atlas_storage_super_admin" on storage.objects;
create policy "atlas_storage_super_admin"
on storage.objects for all
to authenticated
using (
  bucket_id = 'atlas'
  and (select private.is_super_admin())
)
with check (
  bucket_id = 'atlas'
  and (select private.is_super_admin())
);

-- staff (profesional + asistente): SELECT only — they consume content. The
-- service issues signed URLs on their behalf so direct bucket access is
-- effectively read-only.
drop policy if exists "atlas_storage_staff_select" on storage.objects;
create policy "atlas_storage_staff_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'atlas'
  and (select private.current_app_role()) in ('profesional','asistente')
);
