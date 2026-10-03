-- =============================================================================
-- Phase 73 (ADR 0049): a per-account count of AI proxy requests.
--
-- Guests are limited by the one Vercel firewall rule the Hobby plan allows
-- (ADR 0046). A signed-in caller skips that rule, because it sends an
-- `Authorization` header, so `/api/classify` and `/api/insights` count each
-- signed-in request here and refuse it with 429 past their limit.
--
-- The count lives in the database, not in the functions' memory: Vercel runs
-- a function on as many instances as traffic needs, each with its own memory,
-- so an in-memory count would allow the limit once per instance.
--
-- `consume_ai_quota()`:
--   - counts the caller from `auth.uid()` only, so an account can only add to
--     its own count; no session raises 28000;
--   - adds one to the caller's row for the current minute (a fixed 60 s
--     window, like the firewall rule) in one statement, so concurrent requests
--     cannot both read the same count;
--   - deletes the caller's rows for earlier minutes, so the table holds at
--     most one row per account;
--   - returns {"count": n, "retry_after": s}: the requests this minute,
--     this one included, and the seconds until the window turns over.
--
-- The limit itself is in the proxies, not here. Calling the function directly
-- only raises one's own count.
--
-- Apply before deploying the proxies that call it: they answer a signed-in
-- request 503 while the function is missing (an uncounted request never
-- reaches TypeSafe), and the client falls back to keyword rules.
--
-- Probe: supabase/tests/20261003_phase73.probe.sql.
-- =============================================================================

create table if not exists public.ai_request_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, window_start)
);

-- Only the function below touches the table: no policy, no client grant.
alter table public.ai_request_counts enable row level security;
revoke all on table public.ai_request_counts from public, anon, authenticated;

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

-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- and authenticated, so the revoke is explicit.
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated, service_role;
