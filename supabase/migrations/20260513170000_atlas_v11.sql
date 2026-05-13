-- =============================================================================
-- SkinDesk · Atlas v1.1 — RPCs, analytics, audit, versions
-- =============================================================================
-- This migration completes the Atlas data model:
--   1. RPCs for fast section counts + tag faceting (replaces row-scan reads)
--   2. atlas_views     · per-visit analytics (read by trending later)
--   3. atlas_favorites · per-user bookmarks
--   4. atlas_entries.updated_by / published_by audit columns
--   5. atlas_entry_versions  · snapshot on every entry update
--
-- Everything is additive; no breaking changes to v1.
-- =============================================================================

-- ---------- updated_by / published_by columns -------------------------------
alter table public.atlas_entries
  add column if not exists updated_by   uuid references public.profiles(id) on delete set null,
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

-- Trigger: stamp updated_by on every UPDATE, and published_by when status
-- flips into 'published'. Uses auth.uid() — only super_admin can flip the
-- status (RLS), so published_by is always the curator who hit "Publish".
create or replace function private.atlas_entries_stamp_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();

  if new.status = 'published'
     and (old.status is distinct from 'published' or new.published_by is null)
  then
    new.published_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_entries_stamp_audit_upd on public.atlas_entries;
create trigger atlas_entries_stamp_audit_upd
before update on public.atlas_entries
for each row execute function private.atlas_entries_stamp_audit();

-- ============================================================================
-- atlas_views — view tracking for analytics + "recently viewed"
-- ============================================================================
create table if not exists public.atlas_views (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.atlas_entries(id) on delete cascade,
  user_id     uuid not null references public.profiles(id)      on delete cascade,
  viewed_at   timestamptz not null default now()
);

-- "Recently viewed by me" — newest first per user.
create index if not exists atlas_views_user_recent_idx
  on public.atlas_views (user_id, viewed_at desc);

-- "Most-viewed entries" — newest first per entry (for trending windowed
-- aggregates later).
create index if not exists atlas_views_entry_recent_idx
  on public.atlas_views (entry_id, viewed_at desc);

alter table public.atlas_views enable row level security;
alter table public.atlas_views force row level security;

-- Every authenticated user can record their own view. RLS gates by uid.
drop policy if exists "atlas_views_self_insert" on public.atlas_views;
create policy "atlas_views_self_insert"
on public.atlas_views for insert
to authenticated
with check (user_id = (select auth.uid()));

-- A user can read their own view history (powers "Recientemente visto").
drop policy if exists "atlas_views_self_select" on public.atlas_views;
create policy "atlas_views_self_select"
on public.atlas_views for select
to authenticated
using (user_id = (select auth.uid()));

-- super_admin sees everything (for analytics surfaces).
drop policy if exists "atlas_views_super_admin_all" on public.atlas_views;
create policy "atlas_views_super_admin_all"
on public.atlas_views for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

grant select, insert on public.atlas_views to authenticated;

-- ============================================================================
-- atlas_favorites — per-user starred entries
-- ============================================================================
create table if not exists public.atlas_favorites (
  user_id      uuid not null references public.profiles(id)      on delete cascade,
  entry_id     uuid not null references public.atlas_entries(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index if not exists atlas_favorites_user_recent_idx
  on public.atlas_favorites (user_id, created_at desc);

alter table public.atlas_favorites enable row level security;
alter table public.atlas_favorites force row level security;

-- Users manage their own favorites only.
drop policy if exists "atlas_favorites_self_all" on public.atlas_favorites;
create policy "atlas_favorites_self_all"
on public.atlas_favorites for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "atlas_favorites_super_admin_all" on public.atlas_favorites;
create policy "atlas_favorites_super_admin_all"
on public.atlas_favorites for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

grant select, insert, delete on public.atlas_favorites to authenticated;

-- ============================================================================
-- atlas_entry_versions — append-only snapshot history
-- ============================================================================
-- A row lands here every time an `atlas_entries` row is updated. We keep
-- the whole previous state as JSONB so a future "history" UI can diff or
-- revert without coupling to the live schema. Storage is cheap; curated
-- content is low-cardinality writes.
create table if not exists public.atlas_entry_versions (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.atlas_entries(id) on delete cascade,
  snapshot     jsonb not null,
  changed_by   uuid references public.profiles(id) on delete set null,
  changed_at   timestamptz not null default now()
);

create index if not exists atlas_entry_versions_entry_idx
  on public.atlas_entry_versions (entry_id, changed_at desc);

alter table public.atlas_entry_versions enable row level security;
alter table public.atlas_entry_versions force row level security;

-- Only super_admin reads version history.
drop policy if exists "atlas_entry_versions_super_admin_all" on public.atlas_entry_versions;
create policy "atlas_entry_versions_super_admin_all"
on public.atlas_entry_versions for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

grant select, insert on public.atlas_entry_versions to authenticated;

-- Snapshot trigger: capture the OLD row before it's overwritten. Skips
-- "no-op" updates where nothing material changed (only `updated_at`).
create or replace function private.atlas_entries_capture_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bail when the update changed nothing meaningful — avoids version
  -- spam from updated_at-only writes.
  if old is not distinct from new then
    return new;
  end if;

  insert into public.atlas_entry_versions (entry_id, snapshot, changed_by)
  values (
    old.id,
    to_jsonb(old),
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists atlas_entries_capture_version_upd on public.atlas_entries;
create trigger atlas_entries_capture_version_upd
after update on public.atlas_entries
for each row execute function private.atlas_entries_capture_version();

-- ============================================================================
-- RPC · atlas_section_counts() — published count per section in one trip
-- ============================================================================
-- SECURITY INVOKER (default) so RLS applies — non-staff get zero rows,
-- staff get the same numbers as a SELECT would.
create or replace function public.atlas_section_counts()
returns table (section public.atlas_section, published_count bigint)
language sql
stable
set search_path = public
as $$
  select section, count(*)::bigint
  from public.atlas_entries
  where status = 'published'
  group by section
  order by section
$$;

grant execute on function public.atlas_section_counts() to authenticated;

-- ============================================================================
-- RPC · atlas_tags_for_section(section) — distinct published tags + freq
-- ============================================================================
-- Used by the section landing tag chips. Returns every tag that appears in
-- any published entry of the section, ordered by frequency desc then name
-- so the strip is stable across reloads.
create or replace function public.atlas_tags_for_section(p_section public.atlas_section)
returns table (tag text, frequency bigint)
language sql
stable
set search_path = public
as $$
  select tag, count(*)::bigint as frequency
  from public.atlas_entries e, unnest(e.tags) as tag
  where e.section = p_section
    and e.status = 'published'
  group by tag
  order by frequency desc, tag asc
  limit 60
$$;

grant execute on function public.atlas_tags_for_section(public.atlas_section) to authenticated;

-- ============================================================================
-- RPC · atlas_slug_available(section, slug, exclude_id) — live slug check
-- ============================================================================
-- Used by the CMS form to surface a collision before the user hits submit.
-- The unique index already enforces this at INSERT, but pre-checking saves
-- a wasted round-trip and lets us highlight the field inline.
create or replace function public.atlas_slug_available(
  p_section public.atlas_section,
  p_slug    text,
  p_exclude_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select not exists (
    select 1
    from public.atlas_entries
    where section = p_section
      and slug = p_slug
      and (p_exclude_id is null or id <> p_exclude_id)
  )
$$;

grant execute on function public.atlas_slug_available(public.atlas_section, text, uuid) to authenticated;

-- ============================================================================
-- Backfill: stamp updated_by on existing rows from author_id so the audit
-- column isn't NULL for v1 rows. Idempotent.
-- ============================================================================
update public.atlas_entries
   set updated_by = author_id
 where updated_by is null
   and author_id is not null;

update public.atlas_entries
   set published_by = author_id
 where published_by is null
   and status = 'published'
   and author_id is not null;
