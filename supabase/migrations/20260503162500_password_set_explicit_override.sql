-- =============================================================================
-- SkinDesk · profiles.password_set should not be inferred from encrypted_password
-- =============================================================================
-- Modern Supabase fills `auth.users.encrypted_password` with a 60-char bcrypt
-- hash even when `auth.admin.createUser` is called WITHOUT a password (e.g.
-- our Stripe-checkout webhook). The previous trigger inferred password_set
-- from `encrypted_password is not null`, which is now always true at insert
-- time — every webhook-created profesional landed on password_set=true and
-- skipped /auth/setup, defeating the activation flow.
--
-- New rule:
--   1. If `app_metadata.password_set` is explicitly present, use it as-is.
--      The webhook passes `password_set: false`; the future invite flow
--      could pass `true` if it ever ships a pre-set password.
--   2. Otherwise fall back to the encrypted_password heuristic — this keeps
--      the seed (which inserts auth.users rows with bcrypt-hashed real
--      passwords) working correctly without changing seed SQL.
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
  -- Explicit override from app_metadata wins. Falls back to the heuristic
  -- only when no override was passed (e.g. seed data).
  if v_app_meta ? 'password_set' then
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
