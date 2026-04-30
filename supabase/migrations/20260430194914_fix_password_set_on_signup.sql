-- =============================================================================
-- SkinDesk · Set profiles.password_set based on auth.users.encrypted_password
-- =============================================================================
-- The trigger that mirrors auth.users into public.profiles previously left
-- password_set at its default (false), which is wrong for users that were
-- created WITH a password — e.g. the seed (`crypt(..., gen_salt('bf'))`)
-- and the eventual `auth.admin.createUser({ password })` flows. Without this
-- fix, those users get bounced to /auth/setup on every login despite having
-- a working password.
--
-- The webhook flow (which calls `auth.admin.createUser` without a password)
-- continues to land on `password_set = false` and lands on /auth/setup as
-- intended.
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
  v_password_set  boolean := new.encrypted_password is not null
                              and length(new.encrypted_password) > 0;
begin
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
