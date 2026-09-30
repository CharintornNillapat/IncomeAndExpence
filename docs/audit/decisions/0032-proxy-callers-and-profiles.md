# 0032 — Who may spend TypeSafe credits, and who may write `public.profiles`

**Status:** Accepted.
- **Amends** ADR `0011` and `0020`: the two `/api/*` proxies now check their caller, and the Vercel firewall limits guests.
- **Amends** ADR `0024`: `public.profiles` takes no client writes, and a trigger keeps it in step with `auth.users`.
- **Phase:** 58s, a security phase run between 58a and 58b.

**Date:** 2026-09-30

## Context

An outside review (Antigravity, `AGY_AUDIT300926.md`, not committed) made two claims it rated critical. Both were checked against the code, production and the live database before anything changed.

**1. The AI proxies are open.** It was true.
- Neither `api/classify.ts` nor `api/insights.ts` checked a session, an origin or a rate. The client sent no `Authorization` header.
- The production domain answered an anonymous `curl` from anywhere. Bodies that fail validation were used for the check, so no credits were spent.
- `TYPESAFE_API_KEY` is set for production and preview.
- ADR `0011`'s forbidden keys still hold, so a caller cannot write the question or read anything. The harm is cost and denial: a padded body at the upstream limit of 1,200 requests a minute costs very roughly $15 to $30 an hour (an estimate from ADR `0011`'s prices, not a measurement), and real users get 429s and fall back to keyword rules while it runs.
- Preview deployments sit behind Vercel's login (a deployment URL answered 401), so only the production domain was open.

**2. `public.profiles` has drifted from the client.** It had not.
- 2 users, 2 profiles, 0 name or email mismatches, and every `role` was `USER`. Nothing in the app, no policy and no function reads `role`.
- **The real problem was one the review missed.** The update policy checked only `auth.uid() = id`, and `authenticated` held UPDATE on every column. **Any signed-in user could set their own `role` to `'ADMIN'`** or rewrite their `email`. It was harmless only because nothing trusts `role` yet.
- Drift was possible, though: the Account modal renames through `supabase.auth.updateUser({ data: { name } })`, which never reaches `profiles.name`.

The owner's decisions (2026-09-30):
1. **Option (iii) for the proxies:** verify a Supabase token when one is sent, keep guests, and limit guests per IP in the Vercel firewall. A 401 or 429 degrades to keyword rules.
2. **Firewall limits:** 30 requests a minute per IP without an `Authorization` header, 120 a minute per IP for everyone. A guest's CSV import past about 30 distinct notes falls back to keyword rules, which is acceptable.
3. **`profiles`:** remove client writes, and sync the name and email from `auth.users` with a hardened trigger. Probe first, apply live only on the owner's word.
4. The owner re-saves `TYPESAFE_API_KEY` as "sensitive" in Vercel (it is flagged `readable-secret`) and reviews TypeSafe's spend caps.

## Decision

### The proxies: `checkCaller`
Each `POST` runs, in order: a missing key answers 404 (unchanged, so the client still latches off), then `checkCaller`, then the body.
- **No `Authorization` header: a guest, allowed.** The app works signed out, and guests keep Jev.
- **A header that is not `Bearer <token>`: 401.** The scheme is case-insensitive (RFC 7235).
- **A token: the auth server decides**, through `GET /auth/v1/user` with the anon key. That is the same server-side check as `verifySession` (ADR `0024`, amended).
  - Refused (401 or 403): **401**.
  - No answer (a timeout, a 5xx, a 429, or a deployment without the Supabase settings): **503**. An unverified token never spends credits, and the failure is not the caller's.
- **An accepted token is remembered for 60 s** per warm instance (at most 500), so live typing does not add an auth round-trip to every suggestion. A token revoked inside that minute keeps classifying until the minute ends; it can do nothing else here.
- **TypeSafe is never called on a 401 or 503.** Each refusal's unit test asserts exactly that.

**The check is duplicated in both files, deliberately**, as `json` and `isPlainObject` already are. A shared `api/_auth.ts` would be the first runtime import between these functions. Whether Vercel resolves a sibling import under `"type": "module"` is the kind of fact `tsc` and the unit suite cannot see; the default-export hang (ADR `0011`'s note) was that kind. Change both copies together.

**Why a guest with a bogus header is harmless:** the firewall's guest rule keys on the header being absent, so adding any header moves a caller to the 120-a-minute rule. But a header must then carry a token the auth server accepts, or `checkCaller` answers 401 before TypeSafe. A caller cannot buy the looser limit without an account.

### The client
- `authorizationHeader()` in `src/lib/supabase.ts` returns `{ Authorization: 'Bearer <access token>' }` while signed in and `{}` otherwise. It never throws; a failed session read sends the request as a guest.
- `jevClassifier.classifyOnce` and `insightsClient.fetchInsight` spread it into their headers. A guest sends **no** `Authorization` header at all, which is what the proxy and the firewall read as a guest.
- **A 401 is `unavailable` for that call and never latches.** A batch stops; the next live-typing call asks again, because a refreshed token may pass. Only a 404 latches for the session, as before. `insightsClient` already fell back to the local verdict on any non-OK status.
- `classifyDescription`'s contract is unchanged: every failure is still `null`.

### The firewall
Two custom rules on the paths `/api/classify` and `/api/insights`, keyed by IP, fixed 60 s window, answering 429:
- "AI proxy: guests 30/min per IP": the `Authorization` header is absent.
- "AI proxy: all callers 120/min per IP": every request.

A 429 from the firewall is the status `batchClassifier` already backs off on, and the live-typing path already reads as "no suggestion".

**Not created by this phase.** The Vercel API answered `404 Seawall Config not found` to every attempt (`PUT` and `PATCH` of the firewall configuration, by project id and by name). The project has never had a firewall configuration, and the API does not create one. No CLI or token is available on this machine. The owner creates the rules in the dashboard (Firewall, Configure, New rule), or opens the Firewall tab once so a configuration exists and the API call is retried.

### `public.profiles` (`20260930_phase58s_profiles_hardening.sql`)
- **No client writes.** The update policy is dropped. `anon` loses every grant, and `authenticated` keeps only SELECT, still through "Users can view their own profile". The service role keeps its grants, so only it can change `role`.
- **`handle_user_updated`**, fired `after update of email, raw_user_meta_data on auth.users`:
  - hardened like `handle_new_user` (Phase 52): SECURITY DEFINER, `search_path = public, pg_temp`, EXECUTE revoked from PUBLIC, `anon` and `authenticated`, granted to `supabase_auth_admin`;
  - a WHEN clause fires it only when the email or the metadata name actually changes, so a sign-in never runs it;
  - a null email (a phone-only account; `auth.users.email` is nullable, `profiles.email` is not) and a missing or blank name keep the old values;
  - it updates an existing row only; `handle_new_user` owns creating it;
  - it does not swallow errors. A failure would fail the auth write loudly, and a swallowed one is the silent drift this fixes. The update cannot violate a constraint.
- **The client does not read `profiles`**, as the review suggested. Nothing needs `role`, and a read would add one more way for the cloud load to fail.

### Verification
- **Probe** `supabase/tests/20260930_phase58s.probe.sql`, inside `BEGIN … ROLLBACK`:
  - before applying: `PHASE 58S PROBE OK`;
  - two negative controls failed as designed: with no migration, `3 self-promotion to ADMIN was not refused (no error)` (the hole, shown live and rolled back), and with the WHEN clause removed, `5 fired on an unrelated metadata key`;
  - applied with `apply_migration`; the deployed `handle_user_updated` body's md5 (`01cc3db9…`, 210 characters, CRs stripped) matches the file;
  - after applying: the probe without its `\ir` line, `PHASE 58S PROBE OK`, and the Phase 52 probe, `PHASE 52 PROBE OK`;
  - live afterwards: 2 users, 2 profiles, 0 probe rows, 0 mismatches.
- **Unit:** `proxy-contract` gains a caller-check block per endpoint; `proxy-auth-client` (new) drives `authorizationHeader`, `classifyOnce` and `fetchInsight` under a stubbed environment. Five mutations were each caught:
  - `classify` ignoring the check: 13 failures;
  - `insights` accepting a failing auth server and caching nothing: 4;
  - the classifier sending no header, or latching on a 401: 2;
  - the insights client latching on a 401: 1;
  - the insights client sending no header: 1.

## Consequences
- A signed-in user's Jev and insights work as before, with one auth round-trip a minute at most per warm instance.
- A guest keeps Jev, limited to 30 requests a minute per IP once the firewall rules exist. **Until then, a guest is exactly as unlimited as before this phase.** The token check alone protects nothing, because an attacker simply sends no header.
- An attacker rotating IPs still gets 30 guest requests a minute per address. Closing that would mean taking Jev away from guests, which the owner declined.
- `profiles.role` can now change only through the service role, so a future policy may trust it.
- **Recorded, not fixed:** `handle_new_user` inserts `new.email` into a NOT NULL column, so a phone-only sign-up would fail. The app offers email sign-up only.
- Leaked-password protection is off in Supabase Auth; that is a dashboard setting for the owner.
