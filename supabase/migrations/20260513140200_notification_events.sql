-- =============================================================================
-- SkinDesk · notification_events — outbound email audit log
-- =============================================================================
-- The notifications service (src/services/notifications.service.ts) writes
-- one row per email send attempt. Lets us answer:
--   · Did the assignment notification reach the clienta?
--   · How many share invites have been sent?
--   · Is Resend rejecting our sends?
--
-- One row per send-attempt; status is the lifecycle. Resend's webhooks
-- (delivery/bounce) can later update the row in place if we wire them up.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type public.notification_kind as enum (
      'share_invite',
      'rutina_assigned'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type public.notification_status as enum (
      'queued',
      'sent',
      'failed',
      'delivered',
      'bounced'
    );
  end if;
end $$;

create table if not exists public.notification_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  kind          public.notification_kind   not null,
  recipient     text                       not null,
  -- Free-form payload: rutina name, sender's display name, share token,
  -- etc. Stored as jsonb so we can re-render the same email later for
  -- debugging without round-tripping the React template.
  payload       jsonb                      not null default '{}'::jsonb,
  status        public.notification_status not null default 'queued',
  provider_id   text,
  error         text,
  created_at    timestamptz                not null default now(),
  sent_at       timestamptz
);

create index if not exists notification_events_tenant_idx
  on public.notification_events (tenant_id, created_at desc);

create index if not exists notification_events_kind_recipient_idx
  on public.notification_events (kind, recipient, created_at desc);

-- ---------- RLS -------------------------------------------------------------
alter table public.notification_events enable row level security;
alter table public.notification_events force row level security;

drop policy if exists "notification_events_super_admin_all" on public.notification_events;
create policy "notification_events_super_admin_all"
on public.notification_events for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- Staff (profesional + asistente) can read their tenant's own events for
-- the future "did the email go out?" surface.
drop policy if exists "notification_events_tenant_select" on public.notification_events;
create policy "notification_events_tenant_select"
on public.notification_events for select
to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select private.current_app_role()) in ('profesional','asistente')
);

-- Inserts go through the notifications service (server actions). The
-- service supplies tenant_id explicitly; with-check pins to caller's
-- tenant.
drop policy if exists "notification_events_tenant_insert" on public.notification_events;
create policy "notification_events_tenant_insert"
on public.notification_events for insert
to authenticated
with check (
  tenant_id is null
  or tenant_id = (select private.current_tenant_id())
);

grant select, insert on public.notification_events to authenticated;
