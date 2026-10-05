-- =============================================================================
-- Phase 88 (ADR 0064): consume_ai_quota() refuses a token whose session has
-- ended.
--
-- Until Phase 88 the AI proxies asked the auth server about every new token
-- (`/auth/v1/user`), which refuses a token once its session is gone: signed
-- out, revoked by "Sign out other devices" or "everywhere" (ADR 0024), or the
-- account deleted. That round trip was most of a signed-in request's time on
-- a cold instance. The proxies now check a token's signature and claims
-- themselves, against the project's published signing keys, and a signature
-- stays valid until the token expires (an hour), session or not.
--
-- So the session check moves here. Every signed-in request already calls this
-- function, with the caller's own token, before it reaches TypeSafe (ADR
-- 0049), so the check costs one primary-key read inside a round trip the
-- request makes anyway. A token whose `session_id` names no live session of
-- its own account raises 28000, as a missing account already did; PostgREST
-- answers 403, which the proxies turn into 401.
--
-- A session is live when its row is in auth.sessions and its `not_after`,
-- if it has one, is still ahead. GoTrue deletes the row on every sign-out
-- scope, so a revoked device is refused on its next request, not a minute
-- later as under the old one-minute token cache.
--
-- Re-created from the deployed Phase 73 body (md5 8ddf304887a76367fbb31648f1c445ca,
-- matched to 20261003_phase73_ai_request_quota.sql by the Phase 87 drift
-- check); only the session check is new. The grants are restated.
--
-- Apply BEFORE deploying the Phase 88 proxies. The Phase 73 proxies work with
-- it too (they reach this function only with a token the auth server
-- accepted). Deployed first, the new proxies would accept a revoked session's
-- token until it expires.
--
-- Probe: supabase/tests/20261005_phase88.probe.sql.
-- =============================================================================

create or replace function public.consume_ai_quota()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;

  if not exists (
    select 1
      from auth.sessions s
     where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and s.user_id = v_uid
       and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'Session ended' using errcode = '28000';
  end if;

  delete from public.ai_request_counts
   where user_id = v_uid and window_start < v_window;

  insert into public.ai_request_counts as c (user_id, window_start, request_count)
  values (v_uid, v_window, 1)
  on conflict (user_id, window_start)
  do update set request_count = c.request_count + 1
  returning c.request_count into v_count;

  return jsonb_build_object(
    'count', v_count,
    'retry_after', greatest(1, ceil(extract(epoch from (v_window + interval '1 minute' - clock_timestamp())))::integer)
  );
end;
$$;

revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated, service_role;
