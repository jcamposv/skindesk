-- =============================================================================
-- SkinDesk · Pagos hardening (2/2) — soft-delete, audit log, view, indexes,
-- session linkage
-- =============================================================================
-- Runs AFTER `_pagos_hardening.sql` so the new enum values ('codi',
-- 'cancelled') are committed and usable inside this transaction.
--
-- Changes:
--   1. payment_transactions soft-delete (voided_at / voided_by / void_reason)
--   2. Recompute trigger ignores voided rows; emits 'cancelled' when every
--      tx on a plan is voided.
--   3. payment_transactions_history append-only audit log + trigger
--   4. payment_plans_pending_balance view (security_invoker)
--   5. payment_transactions.sesion_id nullable FK
--   6. Composite indexes for the hot list-query shapes
-- =============================================================================

-- ---------- 1. Soft-delete columns ------------------------------------------
alter table public.payment_transactions
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references public.profiles(id) on delete restrict,
  add column if not exists void_reason text;

-- Partial index: every list query in /pagos filters `voided_at is null`, so
-- the index only stores live rows. Keeps the working set tight even after
-- years of voids.
create index if not exists payment_tx_active_tenant_paid_idx
  on public.payment_transactions (tenant_id, paid_at desc)
  where voided_at is null;

-- ---------- 2. Recompute trigger respects voided ----------------------------
create or replace function private.payment_tx_recompute_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_total numeric;
  v_paid numeric;
  v_status public.payment_status;
  v_voided_count integer;
  v_total_count integer;
begin
  v_plan_id := coalesce(new.payment_plan_id, old.payment_plan_id);

  select total_amount
    into v_total
    from public.payment_plans
   where id = v_plan_id;

  if v_total is null then
    return coalesce(new, old);
  end if;

  -- Sum only non-voided rows so the rollup matches what the UI lists.
  select coalesce(sum(amount), 0)
    into v_paid
    from public.payment_transactions
   where payment_plan_id = v_plan_id
     and voided_at is null;

  -- Mark the plan 'cancelled' iff every transaction ever attached has been
  -- voided. Plans without any transaction stay 'pending'.
  select count(*) filter (where voided_at is not null),
         count(*)
    into v_voided_count, v_total_count
    from public.payment_transactions
   where payment_plan_id = v_plan_id;

  if v_total_count > 0 and v_voided_count = v_total_count then
    v_status := 'cancelled';
  elsif v_total <= 0 or v_paid <= 0 then
    v_status := 'pending';
  elsif v_paid >= v_total then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  update public.payment_plans
     set paid_amount = v_paid,
         status = v_status
   where id = v_plan_id;

  return coalesce(new, old);
end;
$$;

-- ---------- 3. Append-only audit log ----------------------------------------
create table if not exists public.payment_transactions_history (
  history_id      bigserial primary key,
  tx_id           uuid not null,
  tenant_id       uuid not null,
  op              char(1) not null check (op in ('I','U','D','V')),
  amount          numeric(10,2),
  method          public.payment_method,
  paid_at         date,
  concept         text,
  notes           text,
  void_reason     text,
  voided_at       timestamptz,
  voided_by       uuid,
  changed_by      uuid,
  changed_at      timestamptz not null default now(),
  prev_version    integer,
  next_version    integer
);

create index if not exists payment_tx_history_tx_idx
  on public.payment_transactions_history (tx_id, changed_at desc);
create index if not exists payment_tx_history_tenant_idx
  on public.payment_transactions_history (tenant_id, changed_at desc);

create or replace function private.payment_tx_write_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
  v_op char(1);
begin
  if (TG_OP = 'INSERT') then
    v_op := 'I';
    insert into public.payment_transactions_history (
      tx_id, tenant_id, op, amount, method, paid_at, concept, notes,
      void_reason, voided_at, voided_by, changed_by, prev_version, next_version
    ) values (
      new.id, new.tenant_id, v_op, new.amount, new.method, new.paid_at,
      new.concept, new.notes, new.void_reason, new.voided_at, new.voided_by,
      v_caller, null, new.version
    );
    return new;
  elsif (TG_OP = 'UPDATE') then
    -- Distinguish a "void" (voided_at goes NULL → NOT NULL) from edits so
    -- the audit timeline can render the right verb.
    if old.voided_at is null and new.voided_at is not null then
      v_op := 'V';
    else
      v_op := 'U';
    end if;
    insert into public.payment_transactions_history (
      tx_id, tenant_id, op, amount, method, paid_at, concept, notes,
      void_reason, voided_at, voided_by, changed_by, prev_version, next_version
    ) values (
      new.id, new.tenant_id, v_op, new.amount, new.method, new.paid_at,
      new.concept, new.notes, new.void_reason, new.voided_at, new.voided_by,
      v_caller, old.version, new.version
    );
    return new;
  elsif (TG_OP = 'DELETE') then
    v_op := 'D';
    insert into public.payment_transactions_history (
      tx_id, tenant_id, op, amount, method, paid_at, concept, notes,
      void_reason, voided_at, voided_by, changed_by, prev_version, next_version
    ) values (
      old.id, old.tenant_id, v_op, old.amount, old.method, old.paid_at,
      old.concept, old.notes, old.void_reason, old.voided_at, old.voided_by,
      v_caller, old.version, null
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists payment_tx_history_ins on public.payment_transactions;
create trigger payment_tx_history_ins
after insert on public.payment_transactions
for each row execute function private.payment_tx_write_history();

drop trigger if exists payment_tx_history_upd on public.payment_transactions;
create trigger payment_tx_history_upd
after update on public.payment_transactions
for each row execute function private.payment_tx_write_history();

drop trigger if exists payment_tx_history_del on public.payment_transactions;
create trigger payment_tx_history_del
after delete on public.payment_transactions
for each row execute function private.payment_tx_write_history();

-- ---------- RLS on the audit log --------------------------------------------
-- Read-only at the SQL layer. The trigger is the sole writer (security
-- definer), so we never grant INSERT/UPDATE/DELETE on the table to
-- authenticated roles — there's no app-side mutation surface.
alter table public.payment_transactions_history enable row level security;
alter table public.payment_transactions_history force row level security;

drop policy if exists "payment_tx_history_super_admin_all" on public.payment_transactions_history;
create policy "payment_tx_history_super_admin_all"
on public.payment_transactions_history for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "payment_tx_history_profesional_select" on public.payment_transactions_history;
create policy "payment_tx_history_profesional_select"
on public.payment_transactions_history for select
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

drop policy if exists "payment_tx_history_asistente_select" on public.payment_transactions_history;
create policy "payment_tx_history_asistente_select"
on public.payment_transactions_history for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

grant select on public.payment_transactions_history to authenticated;

-- ---------- 4. Pending-balance view -----------------------------------------
-- Replaces the per-request full scan in getPaymentsSummary. RLS on
-- payment_plans applies to the caller (security_invoker), so no
-- cross-tenant leakage is possible. The view returns at most one row per
-- tenant — the index `payment_plans_tenant_status_idx` covers the filter.
drop view if exists public.payment_plans_pending_balance;
create view public.payment_plans_pending_balance
with (security_invoker = true)
as
select
  pp.tenant_id,
  count(*) filter (
    where pp.total_amount > pp.paid_amount
      and pp.status not in ('paid','cancelled')
  ) as plans_with_balance,
  coalesce(
    sum(pp.total_amount - pp.paid_amount) filter (
      where pp.total_amount > pp.paid_amount
        and pp.status not in ('paid','cancelled')
    ),
    0
  ) as pending_balance
from public.payment_plans pp
group by pp.tenant_id;

grant select on public.payment_plans_pending_balance to authenticated;

-- ---------- 5. Session linkage ----------------------------------------------
-- A payment can be tied to a specific session (useful for "this clienta
-- abonó la sesión 3"). Nullable so most plan-level payments stay simple.
-- `on delete set null` — deleting a sesión keeps the financial record.
alter table public.payment_transactions
  add column if not exists sesion_id uuid references public.sesiones(id) on delete set null;

create index if not exists payment_tx_sesion_idx
  on public.payment_transactions (sesion_id)
  where sesion_id is not null;

-- ---------- 6. Composite indexes for hot filters ----------------------------
-- Filter by method: leading tenant satisfies RLS, then method, then date.
-- Partial on `voided_at is null` because the UI never lists voided rows.
create index if not exists payment_tx_tenant_method_paid_idx
  on public.payment_transactions (tenant_id, method, paid_at desc)
  where voided_at is null;

-- Filter by tipo de servicio: leading tenant + service_type matches RLS,
-- then PG joins to payment_transactions on servicio_id.
create index if not exists servicios_tenant_service_type_idx
  on public.servicios (tenant_id, service_type);
