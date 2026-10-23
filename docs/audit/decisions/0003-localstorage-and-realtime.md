# 0003 — localStorage batching interval and realtime debounce/filter strategy

**Status:** Proposed
**Date:** 2026-09-17

## Context

`FinanceContext.tsx:390-413` runs 8 separate `useEffect`s, one per state slice, each doing a full synchronous `JSON.stringify` on every change to that slice — the transactions effect is O(entire ledger). A single `addTransaction` triggers 2-3 full serializations; a failed write's rollback triggers 3 more; a cloud refresh triggers 6.

Separately, `FinanceContext.tsx:658-677` subscribes to a single realtime channel over all 5 `SYNCED_TABLES`. Any `postgres_changes` event on any table calls `loadSupabaseData(currentUser.id)` (`:668`), which refetches all 6 tables unbounded. No debounce, no payload diffing, no `user_id` filter on the subscription itself. A user's own write echoes back and triggers a full refetch of their own entire dataset.

Both fixes (T16, T17) are needed, but the existing 39 Playwright runs are structurally blind to both: no spec reads `localStorage` or reloads the page (each Playwright test gets a fresh browser context), and cloud sync has no honest automated test path at all (every spec runs against the unauthenticated localStorage fallback).

## Options considered

**T16 — localStorage:** (a) leave as 8 independent effects; (b) one batched writer, debounced, with an explicit flush on `pagehide`/`visibilitychange`; (c) batched writer with no flush hook.

**T17 — realtime:** (a) leave as unfiltered full-refetch-on-any-event; (b) add a `user_id` filter to the subscription plus a ~400ms debounce plus self-echo suppression; (c) remove realtime sync entirely, poll on an interval instead.

## Decision

**T16: (b).** One batched, debounced localStorage writer, with a mandatory flush on `pagehide` and `visibilitychange` — a PWA on mobile gets backgrounded aggressively, and losing an unflushed write there is a real durability regression the test suite cannot catch. Also add a mount-skip guard so the batched writer does not immediately re-serialize what `safeGetLocalStorage` (`:101-111`) just parsed on load.

**T17: (b).** Debounce ~400ms, add `filter: user_id=eq.<id>` to the subscription — **first verify the `user_id` column actually exists on all 5 `SYNCED_TABLES`** (`:132`) against `supabase/migrations/`, do not assume it — and suppress self-echo (skip the refetch if the changed row's id matches one this client just wrote). Drop `loadSupabaseData` from the effect's dependency array via a ref, so the channel does not tear down and resubscribe whenever that function's identity changes (`:677`).

Rejected polling (T17 option c): loses the responsiveness benefit realtime sync exists for, and is a larger behavior change than fixing the existing mechanism.

## Consequences

- T16 has no automated regression test. Verification is manual: write a transaction, background the tab (or navigate away), reopen, confirm the write persisted.
- T17 has no automated regression test either. Verification is a manual two-device checklist (write on device A, confirm device B updates without an unbounded refetch storm) plus a `console.count('loadSupabaseData')` instrumentation run before/after a 20-row CSV import, confirming the count collapses from N events to close to 1.
- Both are scheduled last within their respective phases (Phase 6) specifically because they are the highest-risk, least-verifiable items in the whole plan.

## Revisit if

The manual two-device checklist for T17 finds the `user_id` filter does not apply cleanly to one of the 5 tables (e.g. a join table without a direct `user_id` column) — in that case the filter must be scoped per-table rather than applied uniformly to the channel.

## Amendment (T799, Phase 144): an own save does not reload

**Date:** 2026-10-23

### Context

Three gaps caused signed-in writes on this client to trigger full cloud reloads:
1. **Ids marked only after the remote call:** TRANSFER, diary writes, and server-generated insert ids left a window where an incoming echo arrived before the id was added to `recentLocalWriteIds`, scheduling an unnecessary reload.
2. **An echo consumed its mark:** `update_transaction` (reverse then apply) and `create_wallet` with an opening balance update a wallet row twice in one transaction; the first echo deleted the id from `recentLocalWriteIds`, leaving the second echo to schedule a reload.
3. **Full reload on successful save:** `upsertDiaryEntry` called `refreshFromCloud()` after every successful save despite already receiving the saved row, and CSV import echoes triggered an extra reload after its initial fetch.

### Decisions

1. **Mark known ids before the call:** every write marks the row ids it knows before dispatching the request. A server-generated id is marked as soon as the response returns it.
2. **Judge echoes when the debounce timer fires:** an event is evaluated when the 400 ms debounce fires rather than on arrival. Unmarked event ids are collected in a pending set. When the timer fires, a reload runs only if at least one remembered id remains unmarked in `recentLocalWriteIds`, or if a trigger with no row id requested a reload (`online`, `visibilitychange`, re-`SUBSCRIBED`, or an event without an id).
3. **Echoes do not consume marks:** an incoming echo matching a marked id no longer deletes that id from the set. The id remains suppressed for its full 5 s window (`LOCAL_ECHO_SUPPRESS_MS`), so multiple echoes from a single atomic operation stay quiet.
4. **Apply returned rows instead of reloading:** a write that receives its saved row back applies it directly to local state and does not call `refreshFromCloud()` (the diary save). A write whose response lacks row data keeps its single reload (the CSV import), but its echoes are marked so they add no second reload.

### Unchanged

- The 400 ms debounce interval (`REALTIME_RELOAD_DEBOUNCE_MS`), the 5 s suppression window (`LOCAL_ECHO_SUPPRESS_MS`), the `user_id` subscription filter, and the 30 s staleness window (`CLOUD_STALE_AFTER_MS`).
- All recovery re-reads on failure or unknown outcomes (T69 mid-flight reloads, `DEBT_OVERPAYMENT`, unexpected responses, transport failures).
- Reconnection triggers and all ledger arithmetic.

### Limits

1. If an echo arrives more than 400 ms before its own HTTP response, it will still trigger a single reload. This is a redundant read, not an incorrect state.
2. If another device modifies a row that this client wrote within the preceding 5 s and no other row is touched, that change is not picked up until the next sync trigger (remote write to another row, reconnect, tab return after 30 s, or manual Sync now).
