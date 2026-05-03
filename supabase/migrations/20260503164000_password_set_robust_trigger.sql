-- =============================================================================
-- SkinDesk · Make handle_new_user robust to Supabase's metadata timing
-- =============================================================================
-- The previous version read `app_metadata.password_set` from raw_app_meta_data
-- but in practice Supabase appears to populate that field across multiple
-- writes (provider/providers come from internal logic; our explicit
-- app_metadata may or may not be present at INSERT-trigger time depending
-- on the auth path). We saw the trigger fall back to the heuristic and mark
-- webhook-created users as password_set=true.
--
-- Fix: also accept the override via raw_user_meta_data, which we control
-- directly from the webhook. user_metadata is reliably populated at INSERT
-- time because Supabase doesn't add fields to it. We keep the app_metadata
-- path too so old data / future flows that prefer that channel still work.
-- =============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_user_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_app_meta      jsonb := coalesce(new.raw_app_meta_data,  '{}'::jsonb);
  v_app_role_raw  text  := nullif(v_app_meta  ->> 'role','');
  v_user_role_raw text  := nullif(v_user_meta ->> 'role','');
  v_role          public.app_role;
  v_tenant_id     uuid;
  v_full_name     text  := v_user_meta ->> 'full_name';
  v_business_name text  := v_user_meta ->> 'business_name';
  v_phone         text  := v_user_meta ->> 'phone';
  v_slug          text;
  v_password_set  boolean;
begin
  -- Override resolution order: user_metadata first (we control it from the
  -- webhook, Supabase doesn't touch it), then app_metadata, then fall back
  -- to the encrypted_password heuristic for legacy paths (seed data with
  -- real bcrypt-hashed passwords).
  if v_user_meta ? 'password_set' then
    v_password_set := (v_user_meta ->> 'password_set')::boolean;
  elsif v_app_meta ? 'password_set' then
    v_password_set := (v_app_meta ->> 'password_set')::boolean;
  else
    v_password_set := new.encrypted_password is not null
                      and length(new.encrypted_password) > 0;
  end if;

  if v_app_role_raw is not null then
    v_role      := v_app_role_raw::public.app_role;
    v_tenant_id := nullif(v_app_meta ->> 'tenant_id','')::uuid;
  elsif v_user_role_raw in ('profesional','clienta') then
    v_role := v_user_role_raw::public.app_role;
    if v_role = 'clienta' then
      v_tenant_id := nullif(v_user_meta ->> 'tenant_id','')::uuid;
    end if;
  else
    v_role := 'profesional';
  end if;

  if v_role = 'profesional' and v_tenant_id is null then
    v_slug := lower(regexp_replace(
      coalesce(v_business_name, v_full_name, 'clinica-' || substr(new.id::text, 1, 8)),
      '[^a-z0-9]+', '-', 'g'
    ));

    insert into public.tenants (owner_id, name, slug)
    values (
      new.id,
      coalesce(v_business_name, v_full_name, 'Mi Clínica'),
      v_slug || '-' || substr(new.id::text, 1, 8)
    )
    returning id into v_tenant_id;
  end if;

  insert into public.profiles (
    id, tenant_id, role, full_name, email, phone, password_set
  )
  values (
    new.id, v_tenant_id, v_role, v_full_name, new.email, v_phone, v_password_set
  );

  return new;
end;
$$;
