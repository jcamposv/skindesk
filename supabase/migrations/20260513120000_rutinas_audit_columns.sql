-- =============================================================================
-- SkinDesk · Rutinas — created_by / updated_by audit columns
-- =============================================================================
-- Adds per-row authorship to `rutinas` and `rutina_steps`. Two professionals
-- can now collaborate on the same template without losing history of who
-- last touched what. The columns are auto-filled by triggers from
-- `auth.uid()` so application code doesn't have to remember to set them.
--
-- Why not just rely on `professional_id` on `rutinas`: that column is the
-- "owner" of the rutina (set on the first save). `updated_by` tracks the
-- actual editor, which can be a different profesional or an asistente.
-- =============================================================================

-- ---------- Columns ---------------------------------------------------------
alter table public.rutinas
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.rutina_steps
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- ---------- Backfill --------------------------------------------------------
-- Existing rows: assume the `professional_id` (rutinas) or the parent's
-- professional_id (rutina_steps) was the original author.
update public.rutinas
   set created_by = coalesce(created_by, professional_id),
       updated_by = coalesce(updated_by, professional_id)
 where created_by is null
    or updated_by is null;

update public.rutina_steps s
   set created_by = coalesce(s.created_by, r.professional_id),
       updated_by = coalesce(s.updated_by, r.professional_id)
  from public.rutinas r
 where s.rutina_id = r.id
   and (s.created_by is null or s.updated_by is null);

-- ---------- Trigger function ------------------------------------------------
-- Fills created_by on INSERT and bumps updated_by on UPDATE. Uses
-- `auth.uid()` so it works for every authenticated caller; `null` is fine
-- when the call originates from a service-role context (migrations,
-- backfills) — the `on delete set null` FK handles that.
create or replace function private.set_audit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.updated_by is null then new.updated_by := auth.uid(); end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end;
$$;

-- ---------- Triggers --------------------------------------------------------
drop trigger if exists rutinas_set_audit on public.rutinas;
create trigger rutinas_set_audit
before insert or update on public.rutinas
for each row execute function private.set_audit_columns();

drop trigger if exists rutina_steps_set_audit on public.rutina_steps;
create trigger rutina_steps_set_audit
before insert or update on public.rutina_steps
for each row execute function private.set_audit_columns();

-- ---------- Indexes ---------------------------------------------------------
-- "Recently edited by me" view (analytics screen later).
create index if not exists rutinas_updated_by_idx
  on public.rutinas (updated_by, updated_at desc)
  where archived_at is null;
