-- =============================================================================
-- Phase 96 (ADR 0072): delete_user_account(), the account's erasure (PDPA).
--
-- Everything else in this ledger is soft-deleted (ADR 0016, CLAUDE.md). Account
-- deletion is the one hard delete, and it removes the account itself, not only
-- its rows: one `delete from auth.users` for the caller, which every table that
-- references a user follows by its foreign key's ON DELETE CASCADE:
--   - public: wallets, transactions, debts, categories, keyword_rules,
--     diary_entries, profiles (the email and name), ai_request_counts;
--   - auth: sessions, identities, MFA factors and one-time tokens, so every
--     device is signed out and the email can sign up again later as new.
-- Transactions also cascade from their wallet, so no order of deletes is
-- needed and nothing is left half-deleted: it is one statement in one
-- transaction.
--
-- This is the one function that writes to the auth schema (ADR 0024 avoided
-- it for a per-device revoke). Read on live 2026-10-06: the function owner,
-- postgres, holds DELETE on auth.users, and every foreign key to it cascades
-- (auth.scim_users sets null).
--
-- Guards:
--   - the user is auth.uid() only: no session is 42501, and there is no
--     argument that names an account;
--   - p_confirm must be exactly 'DELETE', the phrase the person types, or the
--     call is 22023 and nothing changes, so a client bug cannot erase an
--     account by calling the function with no arguments.
-- Returns the number of rows the account had in each public table, read just
-- before the delete.
--
-- Executable by authenticated only.
--
-- Apply BEFORE deploying the Phase 96 client. Without it the client's Delete
-- account answers that the database needs its update, and deletes nothing.
--
-- Probe: supabase/tests/20261006_phase96.probe.sql.
-- =============================================================================

create or replace function public.delete_user_account(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then
    raise exception 'A signed-in session is required to delete an account' using errcode = '42501';
  end if;

  if p_confirm is distinct from 'DELETE' then
    raise exception 'ACCOUNT_DELETE_NOT_CONFIRMED' using errcode = '22023';
  end if;

  v_rows := jsonb_build_object(
    'wallets',       (select count(*) from public.wallets       where user_id = v_user),
    'transactions',  (select count(*) from public.transactions  where user_id = v_user),
    'debts',         (select count(*) from public.debts         where user_id = v_user),
    'categories',    (select count(*) from public.categories    where user_id = v_user),
    'keyword_rules', (select count(*) from public.keyword_rules where user_id = v_user),
    'diary_entries', (select count(*) from public.diary_entries where user_id = v_user)
  );

  delete from auth.users where id = v_user;
  if not found then
    raise exception 'No account to delete' using errcode = 'P0002';
  end if;

  return jsonb_build_object('deleted', true, 'rows', v_rows);
end;
$$;

revoke all on function public.delete_user_account(text) from public, anon;
grant execute on function public.delete_user_account(text) to authenticated;
