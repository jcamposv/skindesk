-- =============================================================================
-- SkinDesk · Evaluaciones — audit columns, drop denorm, optimistic concurrency
-- =============================================================================
-- Three changes bundled (single transaction):
--
--   1. Audit columns (T2.1)
--      - `created_by`    uuid not null  → who created the row (set on insert)
--      - `last_editor_id` uuid not null → who last edited the row (set on update)
--      Both reference profiles(id). Set + maintained by triggers; the action
--      no longer needs to send `profesional_id` nor `profesional_nombre`.
--
--   2. Drop denormalized `profesional_nombre` (T2.2)
--      The service can join profiles by created_by to surface the name.
--      Avoids drift when a profesional renames their profile.
--
--   3. Optimistic concurrency `version` (T2.3)
--      Bumped on every UPDATE via trigger. The action sends the previous
--      version in WHERE; a mismatch → 0 rows affected → 409 conflict toast.
--      Prevents silent overwrites when two tabs / two users edit at once.
-- =============================================================================

-- ---------- Schema changes ---------------------------------------------------

alter table public.evaluaciones
  add column if not exists created_by    uuid references public.profiles(id) on delete restrict,
  add column if not exists last_editor_id uuid references public.profiles(id) on delete restrict,
  add column if not exists version       integer not null default 1;

-- Backfill audit columns from the existing `profesional_id` so existing rows
-- have a sane author. After this migration, `profesional_id` is dropped.
update public.evaluaciones
   set created_by    = coalesce(created_by, profesional_id),
       last_editor_id = coalesce(last_editor_id, profesional_id)
 where created_by is null or last_editor_id is null;

alter table public.evaluaciones
  alter column created_by    set not null,
  alter column last_editor_id set not null;

-- Drop the denormalized name + the now-unused profesional_id column.
alter table public.evaluaciones
  drop column if exists profesional_nombre,
  drop column if exists profesional_id;

create index if not exists evaluaciones_created_by_idx
  on public.evaluaciones (created_by);
create index if not exists evaluaciones_last_editor_idx
  on public.evaluaciones (last_editor_id);

-- ---------- Trigger: stamp audit columns + bump version ---------------------
-- BEFORE INSERT: set `created_by` and `last_editor_id` to caller's auth.uid()
-- BEFORE UPDATE: bump `version`, refresh `last_editor_id`, FREEZE `created_by`
--
-- The trigger ignores any client-provided values for these columns — they
-- are server-assigned, so the API can't forge them.
create or replace function private.evaluaciones_audit_and_version()
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
      raise exception 'evaluaciones audit: auth.uid() is null'
        using errcode = '42501';
    end if;
    new.created_by    := v_caller;
    new.last_editor_id := v_caller;
    new.version       := 1;
  elsif (TG_OP = 'UPDATE') then
    -- Preserve created_by no matter what the client tries to send.
    new.created_by    := old.created_by;
    -- last_editor_id is rewritten only when there's an actual editor; for
    -- safety, fall back to OLD if auth.uid() is null (shouldn't happen
    -- under RLS but defends the invariant).
    new.last_editor_id := coalesce(v_caller, old.last_editor_id);
    new.version       := old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists evaluaciones_audit_ins on public.evaluaciones;
create trigger evaluaciones_audit_ins
before insert on public.evaluaciones
for each row execute function private.evaluaciones_audit_and_version();

drop trigger if exists evaluaciones_audit_upd on public.evaluaciones;
create trigger evaluaciones_audit_upd
before update on public.evaluaciones
for each row execute function private.evaluaciones_audit_and_version();
