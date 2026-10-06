-- =============================================================================
-- Phase 102 (ADR 0078): the 20260909 transfer_funds signature, the one that
-- takes p_user_id, refuses every call and asks for a reload.
--
-- Phase 93 (ADR 0069) added the signature that reads the user from the
-- session, and kept this one for builds cached before it: a PWA keeps running
-- an older build until it reloads. This one is still a SECURITY DEFINER
-- function that `authenticated` may execute, so the advisor lists it (S2a).
--
-- Why refuse rather than drop: a dropped function answers PGRST202, which
-- every client since 20260909 reads as "migration not applied" and answers
-- with the legacy three-write transfer, which is not atomic (ADR 0069). This
-- body raises P0001 instead. The builds that call it throw on any other error,
-- roll back their optimistic balances before anything is written, and show
-- the message, so a transfer from an old build fails visibly and never moves
-- money the non-atomic way. Read in that build's FinanceContext (main at
-- f44d3e4, before Phase 93): isMissingRpcError matches only 42883, PGRST202
-- or "could not find the function".
--
-- The function keeps its name, parameters, defaults, return type and grants
-- (CREATE OR REPLACE keeps the owner and privileges, and they are restated
-- below), so an old build's call still reaches it, not a 404. It runs as the
-- caller (SECURITY INVOKER) with an empty search_path: it reads nothing.
--
-- The session signature, transfer_funds(p_source_wallet_id, ...), is not
-- touched. PostgREST picks between the two by argument names, and the current
-- client sends no p_user_id. A later phase drops this signature.
--
-- Probe: supabase/tests/20261006_phase102.probe.sql.
-- =============================================================================

create or replace function public.transfer_funds(
  p_user_id           uuid,
  p_source_wallet_id  uuid,
  p_dest_wallet_id    uuid,
  p_amount            numeric,
  p_idempotency_key   text,
  p_notes             text    default null,
  p_date              date    default current_date,
  p_raw_input         text    default null,
  p_allow_negative    boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'OUTDATED_CLIENT: Please reload the app to continue.';
end;
$$;

revoke all on function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean) from public, anon;
grant execute on function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean) to authenticated, service_role;
