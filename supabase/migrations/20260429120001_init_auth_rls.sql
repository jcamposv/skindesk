-- =============================================================================
-- SkinDesk · Row Level Security for tenants & profiles
-- =============================================================================
-- Tenancy model:
--   • Super admin sees/manages everything.
--   • Profesional reads & manages everyone in their own tenant
--     (asistente + clienta) and updates their tenant row.
--   • Asistente reads tenant members gated by JSONB permissions
--     (e.g. 'clientas': 'view'|'edit').
--   • Clienta sees only her own profile.
-- =============================================================================

alter table public.tenants  enable row level security;
alter table public.profiles enable row level security;

-- Force RLS even for the table owner (defense in depth)
alter table public.tenants  force row level security;
alter table public.profiles force row level security;

-- -----------------------------------------------------------------------------
-- TENANTS
-- -----------------------------------------------------------------------------

drop policy if exists "tenants_super_admin_all" on public.tenants;
create policy "tenants_super_admin_all"
on public.tenants for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Any tenant member can read their own tenant
drop policy if exists "tenants_members_select" on public.tenants;
create policy "tenants_members_select"
on public.tenants for select
to authenticated
using (id = public.current_tenant_id());

-- Owner (profesional) can update their tenant
drop policy if exists "tenants_owner_update" on public.tenants;
create policy "tenants_owner_update"
on public.tenants for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Tenant creation happens via handle_new_user() (SECURITY DEFINER) — block
-- direct INSERT/DELETE from authenticated to avoid bypass tricks.
drop policy if exists "tenants_block_insert" on public.tenants;
create policy "tenants_block_insert"
on public.tenants for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "tenants_block_delete" on public.tenants;
create policy "tenants_block_delete"
on public.tenants for delete
to authenticated
using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------

drop policy if exists "profiles_super_admin_all" on public.profiles;
create policy "profiles_super_admin_all"
on public.profiles for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Read self
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Update self (cannot change role, tenant_id, or permissions to escalate;
-- enforce immutability by re-checking against the existing row)
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role        = (select role        from public.profiles where id = auth.uid())
  and tenant_id   is not distinct from
                    (select tenant_id   from public.profiles where id = auth.uid())
  and permissions = (select permissions from public.profiles where id = auth.uid())
);

-- Profesional reads everyone in their tenant
drop policy if exists "profiles_profesional_tenant_select" on public.profiles;
create policy "profiles_profesional_tenant_select"
on public.profiles for select
to authenticated
using (
  public.current_role() = 'profesional'
  and tenant_id = public.current_tenant_id()
);

-- Profesional fully manages asistente + clienta in their tenant
drop policy if exists "profiles_profesional_manage_members" on public.profiles;
create policy "profiles_profesional_manage_members"
on public.profiles for all
to authenticated
using (
  public.current_role() = 'profesional'
  and tenant_id = public.current_tenant_id()
  and role in ('asistente','clienta')
)
with check (
  public.current_role() = 'profesional'
  and tenant_id = public.current_tenant_id()
  and role in ('asistente','clienta')
);

-- Asistente reads clientas of the tenant when granted 'clientas' view
drop policy if exists "profiles_asistente_read_clientas" on public.profiles;
create policy "profiles_asistente_read_clientas"
on public.profiles for select
to authenticated
using (
  public.current_role() = 'asistente'
  and tenant_id = public.current_tenant_id()
  and role = 'clienta'
  and public.has_asistente_permission('clientas','view')
);

-- Asistente updates clientas of the tenant when granted 'clientas' edit
drop policy if exists "profiles_asistente_edit_clientas" on public.profiles;
create policy "profiles_asistente_edit_clientas"
on public.profiles for update
to authenticated
using (
  public.current_role() = 'asistente'
  and tenant_id = public.current_tenant_id()
  and role = 'clienta'
  and public.has_asistente_permission('clientas','edit')
)
with check (
  public.current_role() = 'asistente'
  and tenant_id = public.current_tenant_id()
  and role = 'clienta'
  and public.has_asistente_permission('clientas','edit')
);
