-- =============================================================================
-- SkinDesk · routine_imports — audit log for share-link imports
-- =============================================================================
-- Every time a profesional imports a rutina via /rutinas/share/<token>, we
-- write a row here. Gives the source profesional a "who imported my
-- template" surface later, lets us answer analytics questions ("does the
-- import flow get used?", "how often do receivers include the missing
-- productos?"), and decouples the audit from `rutinas.from_template_id`
-- (which only carries the latest fork relation, not the whole history).
-- =============================================================================

create table if not exists public.routine_imports (
  id                        uuid primary key default gen_random_uuid(),
  source_rutina_id          uuid not null references public.rutinas(id) on delete cascade,
  source_tenant_id          uuid not null references public.tenants(id) on delete cascade,
  target_rutina_id          uuid not null references public.rutinas(id) on delete cascade,
  target_tenant_id          uuid not null references public.tenants(id) on delete cascade,
  target_professional_id    uuid references public.profiles(id) on delete set null,

  -- Did the receiver opt to clone missing productos? Tracks the choice
  -- they made in the import dialog so we can tell apart "imported a
  -- partial rutina" from "imported the full rutina + N productos".
  included_missing          boolean not null default false,
  missing_producto_count    int     not null default 0,
  imported_productos        int     not null default 0,

  created_at                timestamptz not null default now()
);

create index if not exists routine_imports_source_idx
  on public.routine_imports (source_rutina_id, created_at desc);

create index if not exists routine_imports_target_idx
  on public.routine_imports (target_tenant_id, created_at desc);

-- ---------- RLS -------------------------------------------------------------
-- The receiving profesional sees their own import history; the source
-- profesional sees imports of their own templates. super_admin sees all.
alter table public.routine_imports enable row level security;
alter table public.routine_imports force row level security;

drop policy if exists "routine_imports_super_admin_all" on public.routine_imports;
create policy "routine_imports_super_admin_all"
on public.routine_imports for all
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

-- Both source-side and target-side profesionales can read.
drop policy if exists "routine_imports_tenant_select" on public.routine_imports;
create policy "routine_imports_tenant_select"
on public.routine_imports for select
to authenticated
using (
  (select private.current_app_role()) in ('profesional','asistente')
  and (
    source_tenant_id = (select private.current_tenant_id())
    or target_tenant_id = (select private.current_tenant_id())
  )
);

-- Inserts come only from the import action — server-action context with
-- the user's session, so RLS sees the receiver. with_check pins to the
-- target tenant so a malicious payload can't log imports against another
-- tenant's "incoming" surface.
drop policy if exists "routine_imports_target_insert" on public.routine_imports;
create policy "routine_imports_target_insert"
on public.routine_imports for insert
to authenticated
with check (
  target_tenant_id = (select private.current_tenant_id())
);

grant select, insert on public.routine_imports to authenticated;
