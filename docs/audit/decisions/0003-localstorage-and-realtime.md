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
