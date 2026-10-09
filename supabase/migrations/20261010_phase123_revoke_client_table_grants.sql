-- =============================================================================
-- Phase 123 (ADR 0099): anon holds nothing on the six ledger tables, and
-- authenticated holds only the four row privileges.
--
-- The schema's default privileges grant every new table in public to anon and
-- authenticated: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and
-- TRIGGER. Row-level security already gives anon no row (every policy is for
-- authenticated, ADR 0098), but a grant with no policy is one policy away from
-- being live, and TRUNCATE is not subject to row-level security at all. The
-- app never uses these tables without a session: a guest stores everything on
-- the device and never loads the client (ADR 0083), and every signed-in read
-- and write runs as authenticated. So anon loses everything, as on profiles
-- (Phase 58s) and ai_request_counts (Phase 73).
--
-- authenticated keeps SELECT, INSERT, UPDATE and DELETE, which the app's direct
-- table reads and writes and Realtime use, all under the per-user policies.
-- It loses TRUNCATE (which RLS does not filter), REFERENCES and TRIGGER, which
-- the app never uses; profiles lost the same three in Phase 58s.
--
-- The ledger functions are SECURITY DEFINER and run as their owner, so no
-- grant here reaches them. service_role keeps every privilege.
--
-- A request without a valid session now gets 42501 from a ledger table
-- instead of zero rows, which the load reports as a failed read (syncError)
-- rather than applying an empty slice.
--
-- Idempotent: a revoke of what is not held does nothing.
--
-- Probe: supabase/tests/20261010_phase123.probe.sql.
-- =============================================================================

revoke all on table
  public.wallets, public.transactions, public.debts,
  public.categories, public.diary_entries, public.keyword_rules
from anon;

revoke truncate, references, trigger on table
  public.wallets, public.transactions, public.debts,
  public.categories, public.diary_entries, public.keyword_rules
from authenticated;
