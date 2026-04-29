-- =============================================================================
-- SkinDesk · Seed data — 1 user per role + 1 tenant
-- =============================================================================
-- Loaded automatically by `supabase db reset` (local dev). For a remote project,
-- copy/paste this into the Supabase SQL editor instead — direct INSERTs into
-- auth.users are not recommended for production but are the canonical way to
-- seed test users in Supabase local dev.
--
-- Test credentials (all use the same password for convenience):
--   super@skindesk.app        / SkinDesk123!  · super_admin
--   cosmetologa@skindesk.app  / SkinDesk123!  · profesional (owns tenant)
--   asistente@skindesk.app    / SkinDesk123!  · asistente   (limited perms)
--   clienta@skindesk.app      / SkinDesk123!  · clienta
-- =============================================================================

do $$
declare
  v_super_id       uuid := '11111111-1111-1111-1111-111111111111';
  v_profesional_id uuid := '22222222-2222-2222-2222-222222222222';
  v_asistente_id   uuid := '33333333-3333-3333-3333-333333333333';
  v_clienta_id     uuid := '44444444-4444-4444-4444-444444444444';
  v_tenant_id      uuid;
  v_password_hash  text := crypt('SkinDesk123!', gen_salt('bf'));
begin
  -- ---------------------------------------------------------------------------
  -- 1) Super admin (no tenant). The handle_new_user() trigger will create
  --    the matching profile from raw_user_meta_data.
  -- ---------------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_super_id, 'authenticated', 'authenticated', 'super@skindesk.app',
    v_password_hash, now(),
    -- role lives in app_metadata: handle_new_user only trusts privileged
    -- roles (super_admin / asistente) when they come from raw_app_meta_data.
    jsonb_build_object(
      'provider','email','providers',jsonb_build_array('email'),
      'role','super_admin'
    ),
    jsonb_build_object('full_name','Súper Admin'),
    now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_super_id, v_super_id::text,
    jsonb_build_object('sub', v_super_id::text, 'email', 'super@skindesk.app'),
    'email', now(), now(), now()
  )
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- 2) Profesional (cosmetóloga). Trigger creates her tenant on the fly.
  -- ---------------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_profesional_id, 'authenticated', 'authenticated', 'cosmetologa@skindesk.app',
    v_password_hash, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'role','profesional',
      'full_name','Carla Estética',
      'business_name','Estética Demo',
      'phone','+57 300 000 0001'
    ),
    now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_profesional_id, v_profesional_id::text,
    jsonb_build_object('sub', v_profesional_id::text, 'email', 'cosmetologa@skindesk.app'),
    'email', now(), now(), now()
  )
  on conflict do nothing;

  -- Read back the tenant the trigger created
  select id into v_tenant_id from public.tenants where owner_id = v_profesional_id;

  if v_tenant_id is null then
    raise exception 'Seed: tenant for profesional was not created. Check handle_new_user() trigger.';
  end if;

  -- ---------------------------------------------------------------------------
  -- 3) Asistente (member of Carla's tenant; agenda+clientas view, no pagos).
  -- ---------------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_asistente_id, 'authenticated', 'authenticated', 'asistente@skindesk.app',
    v_password_hash, now(),
    -- asistente is privileged: role + tenant_id MUST come from app_metadata
    -- (only writable by service_role or seeded directly into auth.users).
    jsonb_build_object(
      'provider','email','providers',jsonb_build_array('email'),
      'role','asistente',
      'tenant_id', v_tenant_id
    ),
    jsonb_build_object(
      'full_name','Lucía Asistente',
      'phone','+57 300 000 0002'
    ),
    now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_asistente_id, v_asistente_id::text,
    jsonb_build_object('sub', v_asistente_id::text, 'email', 'asistente@skindesk.app'),
    'email', now(), now(), now()
  )
  on conflict do nothing;

  update public.profiles
  set permissions = jsonb_build_object(
    'agenda',   'edit',
    'clientas', 'view',
    'pagos',    null,
    'catalogo', 'view'
  )
  where id = v_asistente_id;

  -- ---------------------------------------------------------------------------
  -- 4) Clienta (end customer attached to Carla's tenant).
  -- ---------------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_clienta_id, 'authenticated', 'authenticated', 'clienta@skindesk.app',
    v_password_hash, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'role','clienta',
      'tenant_id', v_tenant_id,
      'full_name','María Clienta',
      'phone','+57 300 000 0003'
    ),
    now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_clienta_id, v_clienta_id::text,
    jsonb_build_object('sub', v_clienta_id::text, 'email', 'clienta@skindesk.app'),
    'email', now(), now(), now()
  )
  on conflict do nothing;

  raise notice 'Seed complete: tenant=%', v_tenant_id;
end $$;
