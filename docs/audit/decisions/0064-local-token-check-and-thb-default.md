# 0064: The AI proxies check a token themselves; the database checks its session; wallets default to THB

**Status:** Accepted. Implemented on branch `phase-88-auth-latency-and-currency-default`, draft PR. Not merged yet. **The two migrations must be applied to the live project before the new proxies deploy** (see "Order of release"); neither is applied yet.
- **Amends** ADR `0032` (how a signed-in caller is checked) and ADR `0050` (what the `auth` timing measures).
- **Amends** ADR `0049`: `consume_ai_quota()` also checks the caller's session.

**Date:** 2026-10-05

## Context

**The token check was most of a signed-in request on a cold instance.** `/api/classify` and `/api/insights` asked Supabase's auth server about every token they had not seen in the last minute (`checkCaller` calling `/auth/v1/user`, ADR `0032`). On production, after the move to `icn1` (ADR `0051`):
- a signed-in classification with a cached token took about 238 ms in the function: `quota` about 36 ms and `ai` about 196 ms;
- an uncached one took 626.3 ms.

That makes the auth round trip roughly 390 ms. Every warm instance pays it once a minute per token, and a cold instance pays it on its first request.

**The auth server's answer meant two things.** The token was genuine, and its session was still open. A device signed out elsewhere ("Sign out other devices", "everywhere", ADR `0024`) was refused here within a minute, which was the token cache's length.

**A wallet's currency still defaulted to `'USD'`.** ADR `0063` recorded this as found.

## Decision

### 1. The proxies check a token's signature and claims themselves

The project signs access tokens with an asymmetric key and publishes the public half at `/auth/v1/.well-known/jwks.json`. On 2026-10-05 that was one ES256 key, served with `Cache-Control: public, max-age=600`. With it, `verifyToken` in each proxy checks a token with Web Crypto and needs no secret.

**The header:**
- **Algorithm:** `ES256` or `RS256` only. `none` and `HS256` are refused before any key is fetched. HS256's key is a shared secret these functions do not hold and should not.
- **Key id:** a `kid` naming a key in the set, of the same algorithm.

**The signature** must verify over `header.payload`.

**The claims** must all hold:
- `exp` is ahead of now;
- `nbf`, if present, is not ahead of now;
- `iss` is this project's `<VITE_SUPABASE_URL>/auth/v1`;
- `aud` is (or includes) `authenticated`;
- `role` is `authenticated`, which refuses the anon and service-role keys;
- `sub` and `session_id` are uuids.

**Results:** anything else is 401. No usable key set (the auth server not answering, or no `VITE_SUPABASE_URL`) is 503, as an unanswered check was before: an unchecked token never spends TypeSafe credits.

**The key set is held per warm instance:**
- **Reused for ten minutes**, the key set's own `max-age`.
- **An unseen `kid` refetches it**, which is how a key rotation is picked up. No more than once every 30 s, so a forged `kid` cannot make every request a fetch.
- **A failed refetch keeps the set already held**, and retries in 30 s.
- **Cost:** an import of the live key and a verify take about 0.05 ms, measured here against the real key.

**Server-Timing's `auth` step** now times this check. It carries `desc="keys"` when the request had to fetch the key set: on a cold instance, every ten minutes, or for a new key. Otherwise it is well under a millisecond.

**The per-token cache is gone.** A check is cheaper than a cache lookup is worth, and the cache was what let a revoked token through for up to a minute.

**The code stays duplicated in both proxies**, as ADR `0032` set out. A shared module would be the functions' first runtime import, a fact `tsc` and the unit suite cannot see. Each proxy imports only the type `webcrypto` from `node:crypto`. No package was added: the `jose` library would have been the first runtime package import in `api/`, for the same unverifiable reason, and Web Crypto covers ES256 and RS256.

### 2. `consume_ai_quota()` refuses a token whose session has ended

A signature stays valid until the token expires, an hour after issue, whether or not its session is still open. Verifying locally alone would let a signed-out or revoked device keep using AI for up to an hour.

Every signed-in request already calls `consume_ai_quota()`, with the caller's own token, before TypeSafe (ADR `0049`). So that function now also requires the token's `session_id` to name a row in `auth.sessions`:
- of the same account;
- with `not_after`, if set, still ahead.

Otherwise it raises 28000, like a missing account. PostgREST answers 403, and the proxies map 401 and 403 from the count to 401.

GoTrue deletes the session row on every sign-out scope, so **a revoked device is refused on its very next request**, sooner than under the old one-minute cache. The check costs one primary-key read inside a round trip the request already makes.

The function is re-created from its deployed Phase 73 body, `8ddf3048...` (matched to the file by the Phase 87 drift check); only the session check is new. Migration: `20261005_phase88_quota_checks_session.sql`.

### 3. `wallets.currency` defaults to `'THB'`

`20261005_wallet_default_thb.sql` changes the default and nothing else.

Nothing relied on the old default:
- the client sends `APP_CURRENCY`;
- `create_wallet` falls back to `'THB'`;
- the starter seed writes `'THB'`;
- the app never reads the stored value (`mapWalletRow` sets `APP_CURRENCY`).

**Four live wallets still say `'USD'`** (read-only, 2026-10-05):
- all soft-deleted;
- created on 2026-08-31 in one account, before `create_wallet` existed;
- labelled by the old default;
- two with one transaction each.

They are left as found: relabelling rows is a data change for the owner to decide.

**Rejected:**
- **A longer cache of the auth server's answer:** it trades revocation for speed, the opposite of what was wanted.
- **The project's HS256 shared secret:** it would mean a new secret in Vercel and a key that can mint tokens, when the project already publishes ES256 public keys.
- **Local verification without the session check:** a revoked device would keep AI for up to an hour.
- **The `jose` library:** see above.

## Order of release

1. **Apply `20261005_phase88_quota_checks_session.sql` before the new proxies deploy.** The Phase 73 proxies work with it: they only reach the function with a token the auth server accepted. Deployed first, the new proxies would accept a revoked session's token until it expires.
2. Apply `20261005_wallet_default_thb.sql` (independent of the code).
3. Merge; Vercel deploys.
4. Run `npm run schema:drift` against live: no rows.
5. Measure a signed-in request's `Server-Timing` on production, uncached and warm.

## Re-running a replaced migration is unsafe

The Phase 87 probe re-ran `20261003_phase73_ai_request_quota.sql`. After Phase 88 that would put back the function without the session check, and the replay test caught it. A migration that re-creates a function must never be run again once a later file has replaced that function. The migration history exists to stop a tool doing so. The test helper now runs each probe against its own schema:
- **`inlineProbe(probe, { applied: true })`** leaves out a probe's migration includes, as each probe's header says to do once they are applied.
- **The Phase 87 probe** runs on the files up to Phase 87.

## Verification

- **Unit, 895 in 33 files.**
  - `unit/proxy-contract.test.ts` signs real ES256 tokens with a key pair it makes, and serves the public half as the key set, in both proxies. It covers:
    - a valid token, with the key set fetched once and reused, and fetched again after ten minutes;
    - the audience as an array;
    - 401 for a token that is expired, has no expiry, is not valid yet, has another issuer, audience or role (anon, service), or has a missing or non-uuid `sub` or `session_id`;
    - 401 for altered claims, another key under a known `kid`, `alg` none or HS256, no `kid`, or a malformed token (before any fetch);
    - a rotation picked up, and an unknown `kid` refetched at most every 30 s;
    - 503 when the key set cannot be had (5xx, 404, a network error, not JSON, no key list), and 401 for an empty one;
    - stale keys kept when a refetch fails;
    - 401 for a quota answer of 401 or 403 (an ended session);
    - the Server-Timing steps.
  - `unit/migration-replay.test.ts` replays all 15 files and runs:
    - the Phase 88 probe before and after its migrations: a live session counted; no, empty, expired, another account's, unknown and malformed sessions refused before counting; a signed-out session refused; the THB default;
    - the Phase 73 probe against the new function.
- **Negative controls**, each failing only its own tests:
  - the signature not enforced (2);
  - the expiry not checked (4);
  - the session claim not checked (2);
  - a 403 from the count not mapped to 401 (1);
  - the session check left out of the migration (both Phase 88 probe runs).
- **The live key:** imported and verified with the same Web Crypto calls; 0.05 ms per check.
- **Drift against live (read-only):** with the new files, every kind of object matches live except two rows, both intended: `wallets.currency` (`'USD'` to `'THB'`) and `consume_ai_quota()`'s body. With those two rows left out, the column and function hashes equal live's. The history lacks the two new names.
- **Lint** clean; **full Playwright** in the refactor log. Every spec mocks `/api/*`, so the proxies' behaviour is pinned by the unit suite.

## Consequences

- **A signed-in request no longer waits on the auth server.** The expected function time on a cold token is about the warm one's, roughly 240 ms instead of 626 ms; the real figure is measured after release (step 5).
- **Revocation is faster than before**, at no extra round trip.
- **The functions need `VITE_SUPABASE_URL` but no new secret.** `VITE_SUPABASE_ANON_KEY` is still needed for the count.
- **If the project moves to a new signing key,** the proxies follow on the first token signed with it (at most 30 s after their last fetch). If it ever moves to HS256 only, every signed-in AI request answers 401 until this changes.
