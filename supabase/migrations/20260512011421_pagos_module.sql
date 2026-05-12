-- =============================================================================
-- SkinDesk · Pagos module — manual payment ledger per servicio
-- =============================================================================
-- Manual-only: the professional registers payments AFTER they happen (cash,
-- transfer, offline card, etc.). There is NO Stripe on the clienta side —
-- Stripe in this app is only the SaaS subscription the professional pays
-- SkinDesk.
--
-- Domain shape:
--   payment_plans         — one row per servicio (1:1). Carries total_amount
--                           (initialised from servicios.package_amount),
--                           paid_amount (recomputed by trigger), and status.
--   payment_transactions  — N:1 with payment_plans. One row per manual cobro.
--
-- Mirrors the servicios pattern: denormalised tenant_id synced from parent,
-- BEFORE triggers stamp audit cols and bump version, AFTER triggers keep
-- the denorm rollup (paid_amount + status) in sync with the transaction
-- ledger. RLS gives profesional full tenant-scoped access, asistente
-- read-only (via clientas:view), clienta self-read.
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum (
      'efectivo',
      'transferencia',
      'tarjeta',
      'otro'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pending',
      'partial',
      'paid'
    );
  end if;
end $$;

-- ---------- payment_plans ----------------------------------------------------
create table if not exists public.payment_plans (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  servicio_id     uuid not null references public.servicios(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete cascade,

  total_amount    numeric(10,2) not null default 0 check (total_amount >= 0),
  paid_amount     numeric(10,2) not null default 0 check (paid_amount >= 0),
  status          public.payment_status not null default 'pending',
  notes           text,

  version         integer not null default 1,
  created_by      uuid references public.profiles(id) on delete restrict,
  last_editor_id  uuid references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint payment_plans_unique_servicio unique (servicio_id)
);

create index if not exists payment_plans_tenant_idx        on public.payment_plans (tenant_id);
create index if not exists payment_plans_cliente_idx       on public.payment_plans (cliente_id);
create index if not exists payment_plans_tenant_status_idx on public.payment_plans (tenant_id, status);

-- ---------- payment_transactions --------------------------------------------
create table if not exists public.payment_transactions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  payment_plan_id   uuid not null references public.payment_plans(id) on delete cascade,
  -- Denormalised so we can filter by servicio / cliente without an extra join.
  servicio_id       uuid not null references public.servicios(id) on delete cascade,
  cliente_id        uuid not null references public.clientes(id) on delete cascade,

  amount            numeric(10,2) not null check (amount > 0 and amount <= 10000000),
  method            public.payment_method not null,
  paid_at           date not null,
  concept           text,
  notes             text,

  version           integer not null default 1,
  created_by        uuid references public.profiles(id) on delete restrict,
  last_editor_id    uuid references public.profiles(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists payment_tx_tenant_idx       on public.payment_transactions (tenant_id);
create index if not exists payment_tx_plan_idx         on public.payment_transactions (payment_plan_id);
create index if not exists payment_tx_cliente_date_idx on public.payment_transactions (cliente_id, paid_at desc);

-- ---------- updated_at triggers ---------------------------------------------
drop trigger if exists payment_plans_set_updated_at on public.payment_plans;
create trigger payment_plans_set_updated_at
before update on public.payment_plans
for each row execute function public.set_updated_at();

drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

-- ---------- tenant_id sync triggers -----------------------------------------
-- payment_plans pulls tenant + cliente from the servicio.
create or replace function private.payment_plans_sync_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio record;
begin
  select tenant_id, cliente_id
    into v_servicio
    from public.servicios
   where id = new.servicio_id;

  if not found then
    raise exception 'Cannot create payment_plan for unknown servicio_id %', new.servicio_id
      using errcode = '23503';
  end if;

  new.tenant_id  := v_servicio.tenant_id;
  new.cliente_id := v_servicio.cliente_id;
  return new;
end;
$$;

drop trigger if exists payment_plans_sync_refs_ins on public.payment_plans;
create trigger payment_plans_sync_refs_ins
before insert on public.payment_plans
for each row execute function private.payment_plans_sync_refs();

drop trigger if exists payment_plans_sync_refs_upd on public.payment_plans;
create trigger payment_plans_sync_refs_upd
before update of servicio_id on public.payment_plans
for each row execute function private.payment_plans_sync_refs();

-- payment_transactions pulls tenant + servicio + cliente from the plan.
create or replace function private.payment_tx_sync_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
begin
  select tenant_id, servicio_id, cliente_id
    into v_plan
    from public.payment_plans
   where id = new.payment_plan_id;

  if not found then
    raise exception 'Cannot create payment_transaction for unknown payment_plan_id %', new.payment_plan_id
      using errcode = '23503';
  end if;

  new.tenant_id   := v_plan.tenant_id;
  new.servicio_id := v_plan.servicio_id;
  new.cliente_id  := v_plan.cliente_id;
  return new;
end;
$$;

drop trigger if exists payment_tx_sync_refs_ins on public.payment_transactions;
create trigger payment_tx_sync_refs_ins
before insert on public.payment_transactions
for each row execute function private.payment_tx_sync_refs();

drop trigger if exists payment_tx_sync_refs_upd on public.payment_transactions;
create trigger payment_tx_sync_refs_upd
before update of payment_plan_id on public.payment_transactions
for each row execute function private.payment_tx_sync_refs();

-- ---------- audit + optimistic-concurrency triggers -------------------------
create or replace function private.payment_plans_audit_and_version()
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
      raise exception 'payment_plans audit: auth.uid() is null' using errcode = '42501';
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

create or replace function private.payment_tx_audit_and_version()
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
      raise exception 'payment_transactions audit: auth.uid() is null' using errcode = '42501';
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

-- ---------- Recompute trigger: keep payment_plans rollup in sync ------------
-- Fires on every transaction INSERT/UPDATE/DELETE. Recomputes paid_amount =
-- sum(transactions) and status based on its relation to total_amount.
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
begin
  -- On INSERT/UPDATE → NEW carries plan_id. On DELETE → OLD does.
  v_plan_id := coalesce(new.payment_plan_id, old.payment_plan_id);

  select total_amount
    into v_total
    from public.payment_plans
   where id = v_plan_id;

  if v_total is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0)
    into v_paid
    from public.payment_transactions
   where payment_plan_id = v_plan_id;

  if v_total <= 0 or v_paid <= 0 then
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

-- ---------- Auto-create payment_plan when a servicio is inserted ------------
-- Every servicio gets a 1:1 plan with `total_amount` seeded from
-- `package_amount`. The professional can then register transactions
-- against it. If package_amount is 0 the plan still exists (pending).
create or replace function private.servicios_create_payment_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payment_plans (servicio_id, total_amount)
  values (new.id, coalesce(new.package_amount, 0))
  on conflict (servicio_id) do nothing;
  return new;
end;
$$;

drop trigger if exists servicios_create_payment_plan_aft on public.servicios;
create trigger servicios_create_payment_plan_aft
after insert on public.servicios
for each row execute function private.servicios_create_payment_plan();

-- ---------- Backfill: create plans for existing servicios -------------------
-- One-off insert for the rows that pre-date this migration. The audit
-- trigger isn't attached yet so this won't fail on auth.uid() being null
-- (we're running as the migration role). After this we wire the audit +
-- recompute triggers below.
insert into public.payment_plans (servicio_id, total_amount)
select s.id, coalesce(s.package_amount, 0)
  from public.servicios s
 where not exists (
   select 1 from public.payment_plans pp where pp.servicio_id = s.id
 );

-- ---------- Wire audit + recompute triggers ---------------------------------
drop trigger if exists payment_plans_audit_ins on public.payment_plans;
create trigger payment_plans_audit_ins
before insert on public.payment_plans
for each row execute function private.payment_plans_audit_and_version();

drop trigger if exists payment_plans_audit_upd on public.payment_plans;
create trigger payment_plans_audit_upd
before update on public.payment_plans
for each row execute function private.payment_plans_audit_and_version();

drop trigger if exists payment_tx_audit_ins on public.payment_transactions;
create trigger payment_tx_audit_ins
before insert on public.payment_transactions
for each row execute function private.payment_tx_audit_and_version();

drop trigger if exists payment_tx_audit_upd on public.payment_transactions;
create trigger payment_tx_audit_upd
before update on public.payment_transactions
for each row execute function private.payment_tx_audit_and_version();

drop trigger if exists payment_tx_recompute_plan_ins on public.payment_transactions;
create trigger payment_tx_recompute_plan_ins
after insert on public.payment_transactions
for each row execute function private.payment_tx_recompute_plan();

drop trigger if exists payment_tx_recompute_plan_upd on public.payment_transactions;
create trigger payment_tx_recompute_plan_upd
after update on public.payment_transactions
for each row execute function private.payment_tx_recompute_plan();

drop trigger if exists payment_tx_recompute_plan_del on public.payment_transactions;
create trigger payment_tx_recompute_plan_del
after delete on public.payment_transactions
for each row execute function private.payment_tx_recompute_plan();

-- ---------- RLS · payment_plans ---------------------------------------------
alter table public.payment_plans enable row level security;
alter table public.payment_plans force row level security;

drop policy if exists "payment_plans_super_admin_all" on public.payment_plans;
create policy "payment_plans_super_admin_all"
on public.payment_plans for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "payment_plans_profesional_all" on public.payment_plans;
create policy "payment_plans_profesional_all"
on public.payment_plans for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

drop policy if exists "payment_plans_asistente_select" on public.payment_plans;
create policy "payment_plans_asistente_select"
on public.payment_plans for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

drop policy if exists "payment_plans_clienta_self_select" on public.payment_plans;
create policy "payment_plans_clienta_self_select"
on public.payment_plans for select
to authenticated
using (
  exists (
    select 1
      from public.clientes c
     where c.id = payment_plans.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- RLS · payment_transactions --------------------------------------
alter table public.payment_transactions enable row level security;
alter table public.payment_transactions force row level security;

drop policy if exists "payment_tx_super_admin_all" on public.payment_transactions;
create policy "payment_tx_super_admin_all"
on public.payment_transactions for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

drop policy if exists "payment_tx_profesional_all" on public.payment_transactions;
create policy "payment_tx_profesional_all"
on public.payment_transactions for all
to authenticated
using (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
)
with check (
  (select private.current_app_role()) = 'profesional'
  and tenant_id = (select private.current_tenant_id())
);

drop policy if exists "payment_tx_asistente_select" on public.payment_transactions;
create policy "payment_tx_asistente_select"
on public.payment_transactions for select
to authenticated
using (
  (select private.current_app_role()) = 'asistente'
  and tenant_id = (select private.current_tenant_id())
  and (select private.has_asistente_permission('clientas','view'))
);

drop policy if exists "payment_tx_clienta_self_select" on public.payment_transactions;
create policy "payment_tx_clienta_self_select"
on public.payment_transactions for select
to authenticated
using (
  exists (
    select 1
      from public.clientes c
     where c.id = payment_transactions.cliente_id
       and c.profile_id = (select auth.uid())
  )
);

-- ---------- Grants ----------------------------------------------------------
grant select, insert, update, delete on public.payment_plans        to authenticated;
grant select, insert, update, delete on public.payment_transactions to authenticated;
