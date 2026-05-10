-- =============================================================================
-- SkinDesk · profiles.avatar_path — clean storage delete
-- =============================================================================
-- The avatar UI used to guess the file extension (jpg/png/webp/gif) and
-- attempt to delete each candidate path. That left orphans behind when
-- the extension didn't match, and was a wasted round-trip per attempt.
--
-- New `avatar_path` column stores the exact storage object path (relative
-- to the `avatars` bucket). On replace/delete the action references this
-- value directly — one round-trip, no orphans.
-- =============================================================================

alter table public.profiles
  add column if not exists avatar_path text;

-- Mostly a hint for tooling; the column is nullable on purpose (profiles
-- with no avatar simply have NULL).
comment on column public.profiles.avatar_path is
  'Path inside the `avatars` storage bucket. NULL when no avatar uploaded. Used to delete the exact storage object instead of guessing extensions.';
