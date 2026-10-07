# 0088: The open tab lives in the URL's hash; `/api/insights` serves accounts only; both proxies cap the body

**Status:** Accepted. Code `9ad6faa`, draft PR; not merged. No migration.
- **Closes** audit findings 14 (no URL per view) and 6 (guests spending TypeSafe credits through `/api/insights`).
- **Amends** ADR `0020` (the insights card's guest path), `0032` (who may call the proxies) and `0046` (the guests' firewall rule now protects `/api/classify` alone in practice).

**Date:** 2026-10-07

## Context

1. **Finding 14.** Every view was `/`. Back left the app, a refresh opened the Dashboard, and no view could be bookmarked or linked. `App.tsx` kept the tab in state only.
2. **Finding 6.** Both proxies let a guest through (ADR `0032`), limited only by the Vercel firewall's 30 requests a minute per IP (ADR `0046`). Every guest's insights request is a TypeSafe call billed to the project, and a guest's monthly wrap-up needs no model: `selectLocalPattern` writes the same kind of verdict on the device, through the same renderer. Live typing (`/api/classify`) is different: a guest's suggestions are a core feature.
3. **Neither proxy capped the body.** `req.json()` read whatever arrived (Vercel's own limit is 4.5 MB) before the validators refused it.

## Decision

1. **The open tab is in the hash: `#/transactions`, `#/wallets`, `#/debts`, `#/diary`, `#/categories`; the Dashboard is the bare URL** (`src/utils/tabRoute.ts`).
   - **A hash, not a path,** so the server, the service worker's navigation fallback and `vercel.json` stay as they are: every URL is still `/`. A path would need a rewrite in `vercel.json` for a deep link's first load.
   - **Moving to another tab pushes a history entry**; opening the tab already open pushes none. The swipe gesture and every hand-off (a Dashboard row, "View all", a diary day) go through the same `handleTabChange`.
   - **`popstate` shows the tab the URL names**, which covers Back, Forward and a hash typed into the address bar (a fragment navigation fires `popstate`).
   - **Only `#/<tab>` names a tab.** Anything else opens the Dashboard and the URL is left alone, so a Supabase sign-in redirect (`#access_token=...`) is still there for supabase-js to read. Nothing writes the URL on load.
   - The brief's "Settings" is no tab: Account & Security is a dialog (ADR `0024`), and the sixth tab is Categories.
2. **`/api/insights` refuses a guest with 401 `{"error":"Sign in to use insights."}`**, after the missing-key 404 (so an unconfigured deployment still latches the client off) and before the count and the body. A guest is never counted and fetches no keys.
   - **The client sends a guest nothing.** `fetchInsight` checks `authorizationHeader()`, which for a guest without a stored session loads no supabase-js (ADR `0083`), and returns the local verdict marked `signInNeeded`.
   - **The card says so:** "Written on this device. Sign in for a summary from Jev." (`insights-signin-note`), in place of "Offline summary, generated on this device.", which stays for a signed-in fallback. A guest is not offline.
   - `/api/classify` keeps serving guests.
3. **Both proxies read the body through `readBody`, capped at 64 KB:** a declared `Content-Length` over it is 413 before anything is read, and the bytes are measured after; invalid JSON is 400 as before. Every refusal is the same `{"error": ...}` JSON with `Cache-Control: no-store`. The largest body either validator accepts, with Thai at three bytes a character, is under 60 KB, and a test builds it. `MAX_BODY_BYTES` and `readBody` are identical in both files, pinned by `unit/proxy-parity.test.ts`.

## Not changed

- **The firewall rule** still covers both paths. A guest's insights request now gets 401 without a TypeSafe call, so the rule's work there is only to bound that.
- **A body sent without a length is read whole before it is measured** (up to Vercel's 4.5 MB). Reading the stream in chunks would stop sooner; it is marked `ponytail:` in `readBody`.
- **Back does not close an open dialog.** A dialog stays open over the tab Back shows, as a tab change from the dialog's own links does. Before this phase, Back left the app.

## Tests

- **`unit/tab-route.test.ts` (new):** every tab's hash, nine hashes that open the Dashboard (an auth redirect, an unknown tab, the wrong case, an inherited property name), the Dashboard's bare URL keeping its query, a round trip of every tab. Red before `tabRoute.ts` existed.
- **`tests/routing.spec.ts` (new, 4):** each tab writes its hash, and Back and Forward walk them (a repeated tab adds no entry); a refresh keeps the tab; `/#/diary` opens the diary and `/#/settings` the Dashboard; a typed hash opens its tab. All 4 failed against `main`'s `App.tsx`.
- **`unit/proxy-contract.test.ts`:**
  - the endpoint table says which proxy serves guests, and the insights tests that ran as a guest now sign in;
  - insights refuses a guest with 401, no key fetch, no count and no TypeSafe call, and its refusal carries only `total` in `Server-Timing`;
  - both proxies answer 413 to a body over 64 KB and to a declared `Content-Length` over it, the latter without reading the body;
  - the largest valid body of each fits the cap.
  - 7 failed first (with the 2 below, 9).
- **`unit/proxy-auth-client.test.ts`:** a guest, and a build without Supabase, send no insights request and get `signInNeeded`; a signed-in fallback does not. Red first.
- **`unit/insights-card.test.tsx` (new, 7):** the model path `tests/insights.spec.ts` drove as a guest until now, signed in through a mock of `authorizationHeader`: no request before Generate, the payload carries no ledger text or id, the verdict renders the ledger's figures, the cache, Refresh, a 429; and the guest's note with no request. Undoing the client's guest check fails the guest test.
- **`tests/insights.spec.ts`:** 8 tests to 2. A guest's summary is written on the device with the sign-in note and no request, counted by a route handler; the collapse test is unchanged.
- **Gate:** lint clean; unit 1284/1284 in 55 files; Playwright 470 passed, 6 skipped, 1 failed of 477 (8.2 m); schema drift run `37644947758`: no drift, 19 migrations.
- **WebKit stalls (ADR `0058`), recorded, not fixed:** the new insights test stalled once in the full run, and the two new specs on WebKit 15 times over stalled twice in 90. Each time a click waited on "visible, enabled and stable" and the trace's screencast stopped within 0.3 s of it, with no frame after. The unchanged `transaction` and `wallets-page` specs on WebKit 10 times over passed 100 of 100 on both this branch and `main`, and `main`'s insights spec 120 of 120: nothing measured ties the stall to this code.
