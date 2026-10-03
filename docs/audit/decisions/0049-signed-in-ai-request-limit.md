# 0049: Signed-in callers are limited to 120 AI requests a minute per account, counted in Supabase

**Status:** Accepted. Implemented on branch `phase-73-auth-rate-limit`, draft PR. **The migration is not applied to the live project yet,** and its probe has not run there: the owner declined the probe run during the phase. Both must happen before the merge (see "Deploy order").
- **Closes** ADR `0046`'s open consequence: "signed-in callers have no firewall cap".
- **Keeps** ADR `0046`'s guest rule as it is, ADR `0032`'s caller check, and ADR `0022`'s 429 pass-through.

**Date:** 2026-10-03

## Context

- **What a signed-in account could do.** The Vercel firewall's one rule (ADR `0046`) matches requests with no `Authorization` header. A signed-in caller sends one, so the rule never sees it, and the only thing between it and TypeSafe was `checkCaller` needing a token Supabase accepts. Anyone can create an account, so one account could spend the project's TypeSafe credits as fast as it could send requests.
- **The firewall cannot cover it on this plan.** Hobby allows one rate-limit rule, and the guest rule holds it.
- **A count in the functions' memory does not limit an account.** Vercel runs a function on as many instances as traffic needs, and each warm instance has its own memory, so a per-instance count of 120 allows 120 per instance. `checkCaller`'s token cache is per instance for the same reason, which is fine for a cache and not for a limit.

## Decision

- **The count lives in Supabase,** in `public.ai_request_counts`, through one `security definer` function, `consume_ai_quota()` (`supabase/migrations/20261003_phase73_ai_request_quota.sql`):
  - it reads the account from `auth.uid()` only, so the proxy sends no account id and a caller can only add to its own count;
  - it adds one to the account's row for the current minute in one `insert ... on conflict do update`, so concurrent requests cannot read the same count;
  - it deletes the account's rows for earlier minutes, so the table holds at most one row per account;
  - it returns `{"count": n, "retry_after": s}`.
  - The table has row-level security on, no policy and no client grant; the function is executable by `authenticated` (and `service_role`) only.
- **The limit is in the proxies: 120 a minute per account,** a fixed 60 s window like the guest rule. Each proxy calls `consume_ai_quota()` with the caller's own token and the anon key, and answers **429 with `Retry-After`** past 120.
- **One count for both proxies,** as the guest rule shares its count: a caller's classify and insights requests add to the same row.
- **Where it runs:** after the missing-key 404 and `checkCaller`, before the body is read. Every signed-in request counts, including one the proxy then rejects as malformed. That also makes the limit checkable for free: an empty-body burst gets 400 up to the limit and 429 past it, with no TypeSafe call.
- **Every request asks for the count,** even while `checkCaller` remembers the token. The count is the one thing that must not be cached.
- **Failure answers, all without calling TypeSafe:**
  - the database refuses the token (401; one can expire inside `checkCaller`'s one-minute cache): **401**;
  - no answer (timeout, a 5xx, the function missing, a 403 from missing grants, a reply without a count): **503**, as `checkCaller` answers an unanswered token check. An uncounted request never spends credits.
- **Guests are not counted in code.** The firewall rule does that, per IP, and nothing about it changes.
- **The client is unchanged.** It already reads a 429 as "no suggestion this time" (live typing), a backoff (the CSV classifier, ADR `0019`) and the local summary (insights, ADR `0020`), and only a 404 switches either feature off. Two new browser tests pin that.
- **`checkQuota` is duplicated in both proxies,** like `checkCaller` (ADR `0032`): a shared module would be the first runtime import between the functions.

**Rejected:**
- **A count in memory,** per instance: see Context.
- **Edge Config:** built for configuration that is read often and written rarely; a counter is written on every request.
- **A key-value store (Upstash, Vercel KV):** a new service and a new dependency, where Supabase is already called from both proxies and holds the accounts.
- **The Pro plan's extra firewall rules:** a cost decision for the owner, and an IP-keyed rule would still not be per account.

## Verification

- **Unit** (`unit/proxy-contract.test.ts`, +35; 62 -> 97, so 672 -> 707). A stub keeps one count per token, as the database keeps one row per account. For each proxy:
  - the 121st request from one account gets 429 and the first 120 reach TypeSafe;
  - the 429 carries `Retry-After` from the count and `Cache-Control: no-store`, and its body is `{"error":"Too many requests."}` only;
  - two accounts are counted apart;
  - the count is asked on every request, though the token check runs once;
  - the count request carries the caller's token and the anon key, with an empty body;
  - with empty bodies, requests 1 to 120 get 400 and the 121st 429, with no TypeSafe call;
  - 130 guest requests are never counted;
  - a token the auth server refused is never counted;
  - a 401 from the database is 401, and 403, 404, 429, 500, 503, a network failure, a reply that is not JSON and a reply without a count are each 503.

  And once for both: 60 classify and 60 insights requests from one account, then the 121st is 429 at either proxy.
  The existing caller-check tests answer the count request as well, well under the limit.
- **Mutations** (`api/classify.ts`, each run against the file):

  | Mutation | Tests failed |
  |---|---|
  | the limit check removed | 5 |
  | `>=` for `>` (the 120th refused) | 2 |
  | not counted while the token is cached | 4 |
  | a non-OK count reply let through (fail open) | 5 |
  | guests counted too | 9 |
  | a database 401 answered 503 | 1 |
  | counted after the body is validated | 2 |
  | no `Retry-After` | 1 |

- **E2E** (+2; 142 -> 144 tests, 426 -> 432 runs; both in specs that already intercept, so no new intercepting spec):
  - `jev-classify.spec.ts`: a 429 leaves no suggestion and the category as it was; the next unmatched note is asked again and answered; the entry saves;
  - `insights.spec.ts`: a 429 shows the local summary with its figures and no error text, and Refresh asks again.
  - **Negative control:** with the client switching off on a 429 as it does on a 404, both fail on chromium (the second request never comes).
- **SQL probe** (`supabase/tests/20261003_phase73.probe.sql`, `BEGIN ... ROLLBACK`):
  - the grants, RLS and `security definer`;
  - no session raises 28000;
  - one account counts 1 to 121 with a `retry_after` between 1 and 60, and a second account starts at 1;
  - the table refuses a direct read as `authenticated`;
  - a new minute starts at 1 and deletes the account's earlier rows;
  - deleting an account deletes its count.
  - **Not yet run against the live schema** (declined during the phase). It runs before the migration is applied.
- **Gate:** lint clean; unit 707/707 in 29 files; Playwright 431/432. The one failure was a WebKit click timing out "waiting for ... stable" in `presets.spec.ts:79`, a spec this phase does not touch, with no assertion failing; that spec then passed 30/30 on WebKit (`--repeat-each=5`). These are the local WebKit timeouts earlier phases recorded in the baseline metrics.

## Deploy order

1. Run the probe against the live schema (the migration pasted in place of `\ir`), and its negative control (the `+ 1` removed, which must fail at "2 A 121st count").
2. Apply the migration to the live project.
3. Merge. Production then counts signed-in requests.

Deployed before step 2, a signed-in caller's AI requests get 503 and fall back to keyword rules and the local summary, as for any outage; guests are unaffected. This PR's preview deployment, if it carries the Supabase settings, behaves that way until step 2.

## Consequences

- **Each signed-in AI request costs one more round trip,** to the database, on top of `checkCaller`'s cached one. Guests pay nothing new.
- **A fixed window allows up to 240 at a boundary** (120 at the end of one minute and 120 at the start of the next), as the guest rule allows 60.
- **A CSV import of more than 120 distinct notes in a minute,** signed in, leaves the rest without a suggestion: the classifier retries a 429 once after 400 ms and goes on (ADR `0019`). Keyword-rule categories still apply. The client does not read `Retry-After`.
- **The limit is a number in two files** (`AI_REQUESTS_PER_MINUTE` in both proxies); changing it means changing both.
- **The check needs the database.** When Supabase does not answer, signed-in callers lose AI suggestions (503) until it does. That is the same trade `checkCaller` made: an unverified or uncounted request never spends credits.
- **Calling `consume_ai_quota()` directly** only raises the caller's own count.
