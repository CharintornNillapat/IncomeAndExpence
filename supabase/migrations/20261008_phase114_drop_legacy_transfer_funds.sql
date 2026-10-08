-- =============================================================================
-- Phase 114 (ADR 0090): drop the 20260909 transfer_funds signature, the one
-- that takes p_user_id.
--
-- Phase 93 (ADR 0069) added the session signature and kept this one for
-- builds cached before it; Phase 102 (ADR 0078) made it refuse every call with
-- OUTDATED_CLIENT, so that a pre-Phase 93 build failed visibly instead of
-- getting PGRST202 and taking the legacy three-write transfer. ADR 0090 holds
-- the evidence that no such build is left: no OUTDATED_CLIENT and no call to
-- rpc/transfer_funds in the logs since Phase 102 was applied, and every live
-- session seen after Phase 93's client shipped.
--
-- The session signature, transfer_funds(p_source_wallet_id, ...), is not
-- touched. No cascade: nothing depends on this signature, and if something
-- did, the drop should fail rather than take it along.
--
-- Probe: supabase/tests/20261008_phase114.probe.sql.
-- =============================================================================

drop function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean);
