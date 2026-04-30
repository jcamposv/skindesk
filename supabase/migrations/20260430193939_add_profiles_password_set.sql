-- =============================================================================
-- SkinDesk · Track whether a profile has a password set
-- =============================================================================
-- Profesionales onboarded via Stripe checkout never get a password during
-- account creation — they activate via magic link and then set a password
-- on /auth/setup. We can't rely on the magic-link `?next=/auth/setup` query
-- param surviving the Supabase redirect chain (allowlist matching strips
-- params), so we track the state in the DB and the callback reads it
-- directly. Source of truth lives close to RLS, no JWT staleness.
-- =============================================================================

alter table public.profiles
  add column if not exists password_set boolean not null default false;

-- Backfill: any existing user that already has an encrypted password in
-- auth.users obviously has a password set. Seeded users (super_admin,
-- profesional, asistente, clienta) all have encrypted_password populated
-- by the seed; magic-link-only users (created post-Stripe-checkout before
-- this migration) do NOT — they stay at false and will land on /auth/setup
-- on their next callback.
update public.profiles p
   set password_set = true
  from auth.users u
 where p.id = u.id
   and u.encrypted_password is not null
   and length(u.encrypted_password) > 0;
