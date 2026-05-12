-- =============================================================================
-- SkinDesk · Citas hardening (post-review 2026-05-11)
-- =============================================================================
-- Bundle 6 / Batch A. Closes the double-booking race, adds the
-- cancellation/confirmation/reminder/reschedule columns the spec asks
-- for, wires a status-history audit table, and adds calendar-provider
-- columns so a future Google Calendar sync can land without a schema
-- change. Also moves tenant TZ + business hours into the tenants row
-- (single source of truth).
-- =============================================================================

-- ---------- btree_gist (required by the EXCLUSION constraint) ---------------
create extension if not exists btree_gist;

-- ---------- Tenant config columns (C9) --------------------------------------
-- Single source of truth for what was hardcoded across:
--   src/services/citas.service.ts (todayBoundsIso)
--   src/actions/citas.actions.ts  (CITA_WHEN_FMT, business hours)
--   src/components/citas/agenda-calendar.tsx (min/max)
-- App code reads via getTenantConfig() helper; defaults baked at the
-- column level so a missing config never trips a NULL check.
alter table public.tenants
  add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires',
  add column if not exists business_hours_start time not null default '09:00',
  add column if not exists business_hours_end   time not null default '20:00';

-- ---------- New columns on citas (C2 + C3) ----------------------------------
alter table public.citas
  add column if not exists cancellation_reason   text,
  add column if not exists cancelled_by          uuid references public.profiles(id) on delete set null,
  add column if not exists confirmed_at          timestamptz,
  add column if not exists reminder_sent_at      timestamptz,
  add column if not exists rescheduled_from_id   uuid references public.citas(id) on delete set null,
  -- Generated for "show me 30-min slots" queries + future analytics.
  add column if not exists duration_min          int generated always as
    ((extract(epoch from (end_at - start_at)) / 60)::int) stored,
  -- Calendar-provider sync metadata (no provider today; columns are nullable).
  add column if not exists external_provider     text,
  add column if not exists external_event_id     text,
  add column if not exists external_calendar_id  text,
  add column if not exists external_sync_status  text not null default 'pending',
  add column if not exists external_synced_at    timestamptz;

-- Cross-field rule: a cancelled cita must carry a reason. Old rows have
-- no reason and we don't want the constraint to fail for them, so the
-- check is `status != 'cancelada' OR reason is not null` — true for
-- every non-cancelled historical row.
alter table public.citas drop constraint if exists citas_cancellation_reason_when_cancelled;
alter table public.citas add constraint citas_cancellation_reason_when_cancelled
  check (status <> 'cancelada' or cancellation_reason is not null);

-- external_sync_status only accepts a known set of values.
alter table public.citas drop constraint if exists citas_external_sync_status_known;
alter table public.citas add constraint citas_external_sync_status_known
  check (external_sync_status in ('pending', 'synced', 'error', 'disabled'));

-- ---------- EXCLUSION constraint (C1) ---------------------------------------
-- Prevents two non-cancelled citas with the same professional from
-- overlapping in time. `tstzrange(start_at, end_at)` is half-open
-- [start, end), so back-to-back citas (09:00–10:00 and 10:00–11:00) are
-- legal — they don't overlap.
--
-- Constraint only applies when professional_id IS NOT NULL — unassigned
-- citas (rare but legal) don't compete with anyone for the lane.
alter table public.citas drop constraint if exists citas_no_overlap_per_professional;
alter table public.citas add constraint citas_no_overlap_per_professional
  exclude using gist (
    professional_id with =,
    tstzrange(start_at, end_at) with &&
  )
  where (professional_id is not null and status not in ('cancelada', 'ausente'));

-- ---------- AUTO-fill `confirmed_at` (C6) -----------------------------------
-- Trigger sets confirmed_at the first time status transitions to
-- 'confirmada'. Setting it manually still works (e.g. backfill scripts);
-- the trigger only fills it when it was null.
create or replace function private.citas_set_confirmed_at()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.status = 'confirmada'
     and (TG_OP = 'INSERT' or old.status is distinct from 'confirmada')
     and new.confirmed_at is null
  then
    new.confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists citas_set_confirmed_at_ins on public.citas;
create trigger citas_set_confirmed_at_ins
before insert on public.citas
for each row execute function private.citas_set_confirmed_at();

drop trigger if exists citas_set_confirmed_at_upd on public.citas;
create trigger citas_set_confirmed_at_upd
before update of status on public.citas
for each row execute function private.citas_set_confirmed_at();

-- ---------- Status history (C4) ---------------------------------------------
create table if not exists public.cita_status_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  cita_id     uuid not null references public.citas(id)   on delete cascade,
  from_status public.cita_status,
  to_status   public.cita_status not null,
  changed_by  uuid references public.profiles(id) on delete set null,
  changed_at  timestamptz not null default now(),
  reason      text
);

create index if not exists cita_status_history_cita_idx
  on public.cita_status_history (cita_id, changed_at desc);
create index if not exists cita_status_history_tenant_idx
  on public.cita_status_history (tenant_id, changed_at desc);

create or replace function private.citas_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Only log when status actually changes.
  if old.status is distinct from new.status then
    insert into public.cita_status_history
      (tenant_id, cita_id, from_status, to_status, changed_by, reason)
    values
      (new.tenant_id, new.id, old.status, new.status,
       (select auth.uid()),
       case when new.status = 'cancelada' then new.cancellation_reason else null end);
  end if;
  return new;
end;
$$;

drop trigger if exists citas_log_status_change on public.citas;
create trigger citas_log_status_change
after update of status on public.citas
for each row execute function private.citas_log_status_change();

-- RLS for history table — mirrors citas (read-only from the app; rows
-- only ever inserted by the trigger).
alter table public.cita_status_history enable row level security;
alter table public.cita_status_history force row level security;

drop policy if exists "csh_super_admin_select" on public.cita_status_history;
create policy "csh_super_admin_select"
on public.cita_status_history for select to authenticated
using ((select private.is_super_admin()));

drop policy if exists "csh_profesional_select" on public.cita_status_history;
create policy "csh_profesional_select"
on public.cita_status_history for select to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

drop policy if exists "csh_asistente_select" on public.cita_status_history;
create policy "csh_asistente_select"
on public.cita_status_history for select to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('citas','view'))
);

drop policy if exists "csh_clienta_self_select" on public.cita_status_history;
create policy "csh_clienta_self_select"
on public.cita_status_history for select to authenticated
using (
  exists (
    select 1
      from public.citas ci
      join public.clientes c on c.id = ci.cliente_id
     where ci.id = cita_status_history.cita_id
       and c.profile_id = (select auth.uid())
  )
);

grant select on public.cita_status_history to authenticated;

-- ---------- Clienta self-update RLS policy (C5) -----------------------------
-- Clientas can flip pending/confirmed → confirmed/cancelled from the
-- portal. The asymmetric `using`/`with check` enforces both ends of the
-- transition.
drop policy if exists "citas_clienta_self_update" on public.citas;
create policy "citas_clienta_self_update"
on public.citas for update to authenticated
using (
  status in ('pendiente', 'confirmada')
  and exists (
    select 1
      from public.clientes c
     where c.id = citas.cliente_id
       and c.profile_id = (select auth.uid())
  )
)
with check (
  status in ('confirmada', 'cancelada')
  and exists (
    select 1
      from public.clientes c
     where c.id = citas.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- Harden the audit + sync triggers (C7) ---------------------------
create or replace function private.citas_audit_and_version()
returns trigger
language plpgsql
security definer
-- Explicit `auth` on the search path so `auth.uid()` resolves to the
-- real function even if a malicious schema is prepended elsewhere.
set search_path = public, auth
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if (TG_OP = 'INSERT') then
    if v_caller is null then
      raise exception 'citas audit: auth.uid() is null' using errcode = '42501';
    end if;
    new.created_by     := v_caller;
    new.last_editor_id := v_caller;
    new.version        := 1;
  elsif (TG_OP = 'UPDATE') then
    new.created_by     := old.created_by;
    new.last_editor_id := coalesce(v_caller, old.last_editor_id);
    new.version        := old.version + 1;
  end if;
  return new;
end;
$$;

create or replace function private.citas_sync_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cliente_tenant uuid;
begin
  select tenant_id
    into v_cliente_tenant
    from public.clientes
   where id = new.cliente_id;
  if v_cliente_tenant is null then
    raise exception 'Cannot create cita for unknown cliente_id %', new.cliente_id
      using errcode = '23503';
  end if;
  new.tenant_id := v_cliente_tenant;
  return new;
end;
$$;

-- ---------- Partial index for active citas (C8) -----------------------------
-- Covers the "calendar window of non-cancelled events" read pattern more
-- selectively than the existing (tenant_id, start_at) index.
create index if not exists citas_tenant_active_start_idx
  on public.citas (tenant_id, start_at)
  where status not in ('cancelada', 'ausente');

-- Unique calendar-provider event id (webhook upsert helper).
create unique index if not exists citas_external_event_unique_idx
  on public.citas (external_provider, external_event_id)
  where external_event_id is not null;
