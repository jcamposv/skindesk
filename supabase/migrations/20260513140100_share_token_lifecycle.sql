-- =============================================================================
-- SkinDesk · share_token lifecycle — created_at / expires_at / last_accessed_at
-- =============================================================================
-- Until now the share_token was a single text column with no temporal
-- metadata. The resolver had no way to enforce expiry and the owner had
-- no way to tell whether anyone had even opened the link. This adds the
-- three timestamps that turn the token into a proper share resource.
--
-- expires_at is NULL by default (no expiry) so the existing tokens keep
-- working. The owner can set an expiry at generation time or later. The
-- resolver filters `expires_at IS NULL OR expires_at > now()`.
-- =============================================================================

alter table public.rutinas
  add column if not exists share_token_created_at      timestamptz,
  add column if not exists share_token_expires_at      timestamptz,
  add column if not exists share_token_last_accessed_at timestamptz;

-- ---------- Trigger ---------------------------------------------------------
-- Keeps share_token_created_at in sync with share_token itself:
--   · share_token flips null → value     → set created_at = now()
--   · share_token flips value → null     → null all three timestamps
--   · share_token flips value → new value → reset created_at + last_accessed
create or replace function private.sync_share_token_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.share_token is not null then
      new.share_token_created_at := coalesce(new.share_token_created_at, now());
    end if;
    return new;
  end if;

  if old.share_token is distinct from new.share_token then
    if new.share_token is null then
      new.share_token_created_at      := null;
      new.share_token_expires_at      := null;
      new.share_token_last_accessed_at := null;
    else
      new.share_token_created_at      := now();
      new.share_token_last_accessed_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rutinas_share_token_timestamps on public.rutinas;
create trigger rutinas_share_token_timestamps
before insert or update of share_token on public.rutinas
for each row execute function private.sync_share_token_timestamps();

-- ---------- Index: resolver hot path ---------------------------------------
-- Partial unique index on share_token. We can't push `expires_at > now()`
-- into the predicate (Postgres requires IMMUTABLE functions there), so
-- the resolver filters expiry at query time. The partial index is still
-- tiny because most rutinas have no share_token.
-- The previous index (rutinas_share_token_idx) is kept — same definition,
-- still useful. No drop here.

-- ---------- Helper RPC: bump last_accessed_at safely ------------------------
-- Called from the share resolver (admin client path). Bumps the column
-- without re-running the audit triggers — we don't want every view to
-- count as an "update" in updated_at terms.
create or replace function public.touch_share_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rutinas
     set share_token_last_accessed_at = now()
   where share_token = p_token
     and (share_token_expires_at is null or share_token_expires_at > now());
$$;

revoke all on function public.touch_share_token(text) from public;
-- The resolver runs through the admin client in our app — but grant
-- execute to authenticated too in case a future flow wants to call it
-- without admin escalation. Tightly scoped: it only updates one column.
grant execute on function public.touch_share_token(text) to authenticated;
