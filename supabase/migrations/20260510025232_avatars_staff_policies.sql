-- =============================================================================
-- SkinDesk · `avatars` bucket — staff-managed clienta avatars
-- =============================================================================
-- The original `avatars` bucket policies (20260429230208) only allow each
-- user to write to their own folder (`<auth.uid()>/...`). That works for
-- staff editing their OWN profile picture, but not for a profesional
-- uploading a clienta's profile photo on her behalf.
--
-- Path scheme stays unchanged: `<user_id>/<filename>`. We just open the
-- write surface so:
--   - profesional        → can manage avatars for any profile in their tenant
--                          whose role is 'clienta' or 'asistente'.
--   - asistente w/ edit  → can manage clienta avatars in their tenant.
--   - clienta            → still only self (existing policy covers that).
--
-- We use SECURITY DEFINER helpers to read profiles.tenant_id without
-- recursing on the profiles policy. The first folder of the storage path
-- is parsed via `(storage.foldername(name))[1]` and joined to profiles.id.
-- =============================================================================

-- profesional: manage clienta + asistente avatars in their tenant.
drop policy if exists "avatars_profesional_manage_tenant" on storage.objects;
create policy "avatars_profesional_manage_tenant"
on storage.objects for all
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.current_app_role()) = 'profesional'
  and exists (
    select 1
      from public.profiles p
     where p.id::text = (storage.foldername(name))[1]
       and p.tenant_id = (select private.current_tenant_id())
       and p.role in ('clienta','asistente')
  )
)
with check (
  bucket_id = 'avatars'
  and (select private.current_app_role()) = 'profesional'
  and exists (
    select 1
      from public.profiles p
     where p.id::text = (storage.foldername(name))[1]
       and p.tenant_id = (select private.current_tenant_id())
       and p.role in ('clienta','asistente')
  )
);

-- asistente w/ clientas:edit: manage clienta avatars in their tenant.
drop policy if exists "avatars_asistente_manage_tenant" on storage.objects;
create policy "avatars_asistente_manage_tenant"
on storage.objects for all
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.current_app_role()) = 'asistente'
  and (select private.has_asistente_permission('clientas','edit'))
  and exists (
    select 1
      from public.profiles p
     where p.id::text = (storage.foldername(name))[1]
       and p.tenant_id = (select private.current_tenant_id())
       and p.role = 'clienta'
  )
)
with check (
  bucket_id = 'avatars'
  and (select private.current_app_role()) = 'asistente'
  and (select private.has_asistente_permission('clientas','edit'))
  and exists (
    select 1
      from public.profiles p
     where p.id::text = (storage.foldername(name))[1]
       and p.tenant_id = (select private.current_tenant_id())
       and p.role = 'clienta'
  )
);
