# 0051: The functions run in icn1 (Seoul), beside the database

**Status:** Proposed. Implemented on branch `phase-75-function-region-opt`, draft PR. Not merged; the before-and-after measurement below decides whether it stays.
- **Acts on** ADR `0050`'s finding: on production the per-account count (ADR `0049`) was most of a signed-in request.

**Date:** 2026-10-04

## Context

- **Where things run today:**
  - The proxies run in Vercel's default region, `iad1` (Washington, D.C.). The project has no region setting, and `x-vercel-id` reads `sin1::iad1::...`: a request from Thailand enters at Singapore and runs in the US.
  - The Supabase project is in `ap-northeast-2` (Seoul).
  - TypeSafe's region is not known.
- **What that costs** (ADR `0050`, one signed-in request on production): `auth;dur=0.0;desc="cached", quota;dur=614.5, ai;dur=134.3, total;dur=750.2`.
  - The count is 82% of the handler's time. Postgres runs it in about 8 ms, so the rest is the trip from Washington to Seoul and back.
  - A token not cached on the instance pays the same trip again for `auth` (`/auth/v1/user`, in the same Supabase project).
- **The guests' side, measured before this change** (2026-10-03 23:33 UTC, this machine in Thailand, 10 guest `POST {}` to `/api/classify`):
  - all `400` from `sin1::iad1`, with `Server-Timing: total` of 0.5 to 4.8 ms;
  - wall time 0.364 to 0.376 s once warm (the last five), and 0.60 to 1.29 s for the first five.

  The function's own time is negligible, so the warm ~0.37 s is the network between Singapore and Washington.
- **Who uses it.** The app is Thai Baht only and keeps its calendar days at UTC+7, so its users are in Thailand.

## Decision

- **`vercel.json` sets one key, `regions: ["icn1"]`** (Seoul). Vercel documents it as the default region for every function in the project, so it covers both `api/classify.ts` and `api/insights.ts`.
  - It is the project's only `vercel.json` setting. Framework detection, the `api/` functions and the static build are unchanged, and the static files are still served from the edge.
- **One region, no failover list.** Hobby runs functions in one region.
- **Expected effect, to be measured, not assumed:**
  - `quota` and an uncached `auth` should fall from hundreds of milliseconds to tens, because they become calls inside one region;
  - the trip from a user in Thailand to the function should get shorter;
  - `ai` may get longer, if TypeSafe is in the US. 134 ms from Washington suggests it is closer to there than to Seoul.

**Rejected:**
- **Moving the database to the US** instead: a Supabase region move is a migration of the whole project, and it would put the data further from its users.
- **Keeping `iad1` and caching the count:** ADR `0049` forbids it. A cached count is not a limit.
- **Per-function regions** (`functions["api/insights.ts"].regions`): both proxies make the same two Supabase calls, so they belong in the same place.

## Verification

- **Nothing local can see a region.** Playwright answers `/api/*` itself, and the unit suite calls the handlers directly. The gate shows only that nothing else moved: lint clean; unit 725/725; Playwright 432/432 in 6.7 m.
- **Preview deployments cannot measure the signed-in path:**
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for production only, so on a preview a signed-in request gets 503 from `checkCaller`, and the preview's client has no Supabase at all;
  - previews are behind Vercel's login (`ssoProtection: all_except_custom_domains`).

  The preview's deployment record does show its `regions`, which confirms that the configuration took.
- **The measurement is on production, before and after the merge,** with the same requests:
  - **Guest, from this machine:** 10 `POST {}` to `/api/classify` (free: 400 before any TypeSafe call). Read `x-vercel-id` (`::icn1::` after) and the wall time.
  - **Signed in, from the owner's browser:** 3 to 5 Quick Add notes that no keyword rule matches, one `Server-Timing` value each, from DevTools. Notes no rule matches are what reach `/api/classify`.
- **Decision rule:**
  - keep `icn1` if the signed-in median `total` falls;
  - revert (delete `vercel.json`, or set `iad1`) if it rises, because a slower `ai` outweighed a faster `quota`.

## Consequences

- **Request content is processed in Seoul instead of Washington.** It is the same note text, category names and monthly aggregates (ADR `0020`), sent on to TypeSafe as before.
- **A future function lands in `icn1` by default.** A function that talks mostly to a service elsewhere would need its own `functions[...].regions`.
- **Rolling back is a one-line change and a redeploy;** nothing else depends on the region.
