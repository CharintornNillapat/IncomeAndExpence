# 0105: One cloud load per signed-in user

**Status:** Accepted
**Date:** 2026-10-24

## Context

Following Phase 144, opening the app signed in still displayed the Syncing badge and performed unexpected redraws. Investigation into `@supabase/auth-js` 2.116.0 (`GoTrueClient.js`) revealed multiple overlapping cloud load triggers:

1. Two full loads back-to-back on startup: `setupAuth` in `FinanceContext.tsx` awaits `client.auth.getSession()` and runs a full `loadSupabaseData`, then subscribes to `client.auth.onAuthStateChange`. Upon subscription, `onAuthStateChange` calls `_emitInitialSession` (`GoTrueClient.js:3631-3669`), which emits `INITIAL_SESSION` with the current session. The auth listener treated every event with a session as a reason to reload all tables. In addition, `_recoverAndRefresh` can notify `SIGNED_IN` from initialization (`GoTrueClient.js:4165`, queued and flushed at `:360-377`, `:4336-4346`).
2. Tab visibility changes: switching back to the tab invokes `_onVisibilityChanged` (`GoTrueClient.js:4747-4777`), which triggers `_recoverAndRefresh`. That notifies `SIGNED_IN` again for a valid session (`:4165`) or `TOKEN_REFRESHED` (`:4282`), causing another full cloud reload through the auth listener even though the realtime effect already has a 30 s stale check (ADR 0023).
3. Token refresh and cross-tab broadcasts: hourly token refreshes notify `TOKEN_REFRESHED` (`:4282`), and `BroadcastChannel` re-emits auth events across open tabs (`:277-286`, `:4352-4353`), multiplying redundant loads.
4. Profile identity: every auth event constructed a brand-new `currentUser` object (`FinanceContext.tsx:988-992`), invalidating the context state memo and triggering unnecessary subscriber re-renders across the app.

## Options considered

**(a) Filter by event name: load cloud data only on `SIGNED_IN`.**
Rejected. `@supabase/auth-js` emits `SIGNED_IN` repeatedly on every hidden-to-visible tab return (`_onVisibilityChanged:4747` -> `_recoverAndRefresh:4165`) and re-broadcasts it to other tabs. Filtering for `SIGNED_IN` alone would leave the tab-return reload in place. Furthermore, ADR 0083 relies on `INITIAL_SESSION` carrying a session that completed before the listener subscribed.

**(b) Key on the user id via `loadedUserIdRef`.**
Chosen. Track the active loaded user ID in a ref (`loadedUserIdRef`). The auth listener triggers `loadSupabaseData` only when the incoming user ID differs from `loadedUserIdRef`. Events for the same user only update changed profile fields, preserving the `currentUser` object identity when values are unchanged.

**(c) Drop the `getSession()` load and load only from `INITIAL_SESSION`.**
Rejected. It alters the startup path established in ADR 0083 without solving the problem, as subsequent tab-return `SIGNED_IN` events would still trigger reloads without option (b)'s guard.

## Decision

**(b).** In `src/context/FinanceContext.tsx`:
1. Introduce `loadedUserIdRef = useRef<string | null>(null)`.
2. Encapsulate session adoption in an inner helper `adoptSession(user: AuthUser)`. It constructs the profile object and updates `currentUser` only if `id`, `email`, or `name` changed, avoiding re-renders when attributes match.
3. If `loadedUserIdRef.current === user.id`, `adoptSession` returns immediately without reloading data. Otherwise, it sets `loadedUserIdRef.current = user.id` before awaiting `loadSupabaseData(user.id)`. Setting the ref prior to the await prevents concurrent events from triggering overlapping loads.
4. Route both the startup `getSession()` path and the `onAuthStateChange` handler through `adoptSession`.
5. `resetToGuestState` clears `loadedUserIdRef.current = null`, ensuring that signing back in (even as the same user) performs a fresh cloud load. `SIGNED_OUT` handling remains unchanged (ADR 0024).

## Consequences

- Exactly one cloud load occurs upon opening the app signed in.
- Returning to an open tab within 30 s triggers zero table reads. Reconnection reconciliation remains governed by the realtime effect's 30 s stale check (ADR 0023).
- Token refresh (`TOKEN_REFRESHED`), `INITIAL_SESSION`, and cross-tab broadcasts for the current user reload nothing. Profile updates (`USER_UPDATED`, e.g. rename in Account modal via `updateUser`) update `currentUser` without reloading the ledger.
- Realtime table changes from other devices continue to be delivered through the Postgres changes subscription.
- A single cold startup load that exceeds 1 s displays the Syncing badge per the ADR 0026 amendment.
- Unit test harnesses trigger reloads using `actions().refreshFromCloud()` instead of firing synthetic auth events.

## Revisit if

`@supabase/auth-js` fundamentally alters its session event lifecycle, or if the client architecture introduces account switching between multiple active users without an intervening sign-out.
