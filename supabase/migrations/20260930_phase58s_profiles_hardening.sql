-- =============================================================================
-- Phase 58s: public.profiles hardening (ADR 0032)
--
--   1. No client writes to public.profiles. The update policy only checked the
--      row's id, and `authenticated` held UPDATE on every column, so a signed-in
--      user could set their own `role` to 'ADMIN' or rewrite their `email`.
--      Nothing reads `role` today; this closes the door before anything does.
--      The app never writes this table, so no client path loses anything.
--   2. handle_user_updated - keeps profiles.email and profiles.name in step
--      with auth.users. The Account modal renames through
--      `supabase.auth.updateUser({ data: { name } })`, which writes only
--      auth.users.raw_user_meta_data, so profiles.name went stale on a rename.
--
-- Reading your own profile is unchanged ("Users can view their own profile").
-- The service role keeps its grants.
--
-- No frontend depends on this migration, so it can be applied at any time.
--
-- Verify with supabase/tests/20260930_phase58s.probe.sql (BEGIN ... ROLLBACK).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Client writes removed
--
-- The schema's default privileges grant every table to anon and authenticated,
-- which is how both came to hold INSERT/UPDATE/DELETE/TRUNCATE here. RLS
-- already blocked INSERT and DELETE (no policy), but a grant with no policy is
-- one policy away from being live, so the grants go too. anon keeps nothing:
-- it has no policy to read through either.
-- -----------------------------------------------------------------------------
drop policy if exists "Users can update their own profile" on public.profiles;

revoke all on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;


-- -----------------------------------------------------------------------------
-- 2. handle_user_updated
--
-- Hardened like handle_new_user (Phase 52): SECURITY DEFINER with a pinned
-- search_path, EXECUTE revoked from every client role and granted to the auth
-- service explicitly.
--
-- - It only updates an existing row. handle_new_user owns creating it.
-- - auth.users.email is nullable (a phone-only account) while profiles.email is
--   not, so a null email keeps the old one rather than failing the auth write.
-- - A missing or blank metadata name keeps the old name, matching
--   handle_new_user, which never stores an empty one.
-- - The trigger's WHEN clause fires only when the email or the metadata name
--   actually changes, so a sign-in (last_sign_in_at, tokens) never runs it.
-- - It does not swallow errors. A failure here fails the auth write, which is
--   loud; a swallowed one would be exactly the silent drift this fixes. The
--   update above cannot violate a constraint: email is coalesced and name has
--   none.
-- -----------------------------------------------------------------------------
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles p
     set email = coalesce(new.email, p.email),
         name  = coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), p.name)
   where p.id = new.id;
  return new;
end;
$$;

revoke all on function public.handle_user_updated() from public, anon, authenticated;
grant execute on function public.handle_user_updated() to supabase_auth_admin;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row
  when (old.email is distinct from new.email
        or (old.raw_user_meta_data->>'name') is distinct from (new.raw_user_meta_data->>'name'))
  execute function public.handle_user_updated();
