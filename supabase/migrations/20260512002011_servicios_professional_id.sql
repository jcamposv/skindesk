-- =============================================================================
-- SkinDesk · Servicios · `professional` text → `professional_id` FK
-- =============================================================================
-- Replaces the free-text `professional` column on `servicios` and `sesiones`
-- with:
--   · `professional_id uuid references public.profiles(id) on delete set null`
--     — canonical FK so analytics, joins, and renames work cleanly.
--   · `professional_label text` — fallback for manual / legacy entries that
--     don't correspond to a known staff member (preserves the
--     ProfesionalSelect "custom" path documented in the UI).
--
-- Backfill strategy: resolve the old text against `profiles.full_name`
-- scoped to the row's tenant. Unique match → `professional_id`. Anything
-- else (no match, ambiguous match) → falls into `professional_label` so the
-- cosmetóloga never loses the information she typed.
--
-- The old `professional` text column is dropped at the end.
-- =============================================================================

-- ---------- 1. Add new columns ----------------------------------------------
alter table public.servicios
  add column if not exists professional_id    uuid references public.profiles(id) on delete set null,
  add column if not exists professional_label text;

alter table public.sesiones
  add column if not exists professional_id    uuid references public.profiles(id) on delete set null,
  add column if not exists professional_label text;

-- ---------- 2. Indexes for "all activity by professional X" queries --------
create index if not exists servicios_tenant_prof_idx
  on public.servicios (tenant_id, professional_id);

create index if not exists sesiones_tenant_prof_idx
  on public.sesiones (tenant_id, professional_id);

-- ---------- 3. Backfill from the old text column ----------------------------
-- Only apply when there's a *unique* full_name match within the same tenant.
-- Ambiguous matches stay text-only so we don't silently bind a session to
-- the wrong profile.
update public.servicios s
   set professional_id = p.id
  from public.profiles p
 where p.tenant_id   = s.tenant_id
   and p.full_name   = s.professional
   and s.professional is not null
   and s.professional <> ''
   and (
     select count(*) from public.profiles p2
      where p2.tenant_id = s.tenant_id
        and p2.full_name = s.professional
   ) = 1;

-- Everything unresolved → keep the original text as a label.
update public.servicios
   set professional_label = professional
 where professional is not null
   and professional <> ''
   and professional_id is null;

update public.sesiones s
   set professional_id = p.id
  from public.profiles p
 where p.tenant_id   = s.tenant_id
   and p.full_name   = s.professional
   and s.professional is not null
   and s.professional <> ''
   and (
     select count(*) from public.profiles p2
      where p2.tenant_id = s.tenant_id
        and p2.full_name = s.professional
   ) = 1;

update public.sesiones
   set professional_label = professional
 where professional is not null
   and professional <> ''
   and professional_id is null;

-- ---------- 4. Drop the old text column -------------------------------------
alter table public.servicios drop column if exists professional;
alter table public.sesiones  drop column if exists professional;
