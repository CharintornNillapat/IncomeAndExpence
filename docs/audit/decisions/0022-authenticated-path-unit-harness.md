# 0022 — A unit harness for the signed-in write path, run outside `act()`

**Status:** Accepted. **Amends** ADR `0011`'s proxy status mapping (an upstream 429 is now passed through) and extends ADR `0021`'s unit suite with a second, deliberately different harness.
**Date:** 2026-09-26

## Context

The post-Phase-49 architectural review found two defects that corrupt data **only for signed-in users**:

| Finding | Where | What goes wrong |
|---|---|---|
| F1 | `addTransaction`, `FinanceContext.tsx` | A debt repayment lowers the debt optimistically, then — after the insert's `await` — re-reads `debtsRef.current`, which the ref-mirror effect has already moved to the optimistic value, and subtracts the payment a second time. ฿1,000 off ฿4,500 shows ฿3,500 and writes **฿2,500** to Supabase. The realtime echo is suppressed, so nothing looks wrong until a reload. |
| F2 | `commitBulkImport` | The batch insert's `error` is discarded, the wallet deltas are written anyway, and `insertedCount` reports every row. A rejected import still moves money. |

Neither is reachable by any existing test, for two independent reasons.

**Every test runs unauthenticated.** All 22 Playwright specs and `unit/ledger-guards.test.tsx` exercise the local-storage branch. The provider's auth effect returns early on `!isSupabaseConfigured`, which is exactly what makes ADR `0021`'s harness inert and safe — and exactly what hides the branch both defects live in.

**`act()` hides the bug class even once the branch is reached.** `ledger-guards.test.tsx` wraps every action in `act()`. `act()` flushes React's pending work before control returns to the awaited code, so the ref-mirror effect lands in an idealized order. Under `act()` the F1 repro writes the correct 3,500; without it, 2,500. CLAUDE.md already names this bug class ("never read a value assigned inside a `setState` updater after the call that scheduled it", T63) — and the one harness that could have caught a recurrence is structurally unable to see it.

## Decision: a second harness, `unit/authenticated-ledger.test.tsx`

It mounts the real `FinanceProvider`, as ADR `0021`'s does, with three differences.

### 1. Supabase is replaced with `vi.mock`, not an export

`vi.mock('../src/lib/supabase', …)` substitutes the module the provider already imports, with `isSupabaseConfigured: true` and a fake client. **Nothing in `src/` is exported for the test**, which keeps ADR `0021`'s rule intact.

The fake client:
- answers `auth.getSession()` with a fixed user and captures the `onAuthStateChange` callback, so a test can fire a cloud reload on demand;
- returns a chainable, recording query builder from `from(table)` — every `{ table, op, payload, filter }` is kept so a test can assert on **what was sent**, not only on local state;
- serves rows from an in-memory seed and lets a test inject `{ error }` per table and operation;
- answers `channel()` with an inert `on`/`subscribe` chain, so no WebSocket exists.

### 2. Every fake call resolves on a macrotask

The builder is a thenable that settles on `setTimeout(0)`, not a resolved promise. A microtask would let the awaited code resume before React commits; a macrotask gives React the same window to commit and run effects that a real network round-trip does. That is the interleaving F1 depends on, and the harness has to reproduce it rather than idealize it away.

### 3. Actions run without `act()`

The file sets `globalThis.IS_REACT_ACT_ENVIRONMENT = false` and reads state through `waitFor`. **This is the file's reason to exist, not a style choice.** `ledger-guards.test.tsx` keeps its `act()` wrapping — it tests the local path, where there is no `await` between the optimistic write and the read, so `act()` hides nothing there.

### The negative control is part of the decision

The F1 test must be run against the unfixed code first and must fail **at 2,500**. A harness that passes on the broken code has not proven it can see the bug; that failure is the evidence that the macrotask resolution and the absence of `act()` are doing their job.

## Decision: compute once, from the ref, before any `setState`

F1's fix is the rule CLAUDE.md already states, applied to the one site that missed it. The debt's new remainder is computed once, from `debtsRef.current`, alongside `sourceNewBalance`, and that single value feeds both the optimistic `setDebts` and the remote write. No read of a ref after an `await` feeds a remote write any more.

ADR `0016`'s guard does not move, and its `Math.max(0, …)` floor stays: it still defends against a stale `debtsRef` racing a repayment from another device.

## Decision: a failed import moves nothing

`commitBulkImport` now checks the insert's `error` and returns before any balance write. A wallet write that fails after a successful insert is compensated the way `addTransaction` compensates — already-written wallets restored, inserted rows **soft**-deleted, never hard-deleted — and the call returns a `MutationResult`. The view keeps the preview open on failure and disables the commit button while a commit is in flight.

This is **not** import deduplication. ADR `0019` and `csv.spec.ts` still assert that two separate imports of the same row produce two rows; the in-flight guard only stops one click from landing twice.

Balance writes stay absolute (`walletsRef` + delta). That is the review's F3, and its cure is server-side relative updates — a Phase 51 decision, not this one.

## Amendment to ADR 0011: an upstream 429 is passed through

Both proxies mapped every upstream failure except 401 to 503. The client's batch backoff keys on 429 (`jevClassifier.classifyOnce` → `rate-limited`), so the three unit tests pinning that backoff described a status production never emitted. The proxies now return 429 for an upstream 429; 401 still maps to 502 and everything else to 503. `classifyDescription`'s contract is untouched — the live-typing path still collapses every failure to `null`.

### The proxy contract test needed no tsconfig split — and why that is itself a finding

`unit/proxy-contract.test.ts` imports the exported `POST` handlers directly — no new export is needed.

*Planned:* exclude it from the root config and type-check it under `api/tsconfig.json`, on the premise that the root program has no Node types and would fail on `process`.

*Found:* the root program already has Node types, and has had since papaparse arrived. `@types/papaparse/index.d.ts` carries `/// <reference types="node" />`, and `src/utils/csvExchange.ts` imports papaparse, so `process` and `Buffer` are global across the root program regardless of its `types: [...]` array — a triple-slash reference is not filtered by it. `tsc --explainFiles` names the chain. Root `tsc` passed with the test in place, so the split was dropped as unneeded rather than added on a false premise. Were that reference ever removed upstream, `npm run lint` would fail loudly on this file, not silently.

The consequence reaches past this test: CLAUDE.md's rule not to add Node types to the root config, "because `process` would type-check inside `src/`", describes a guard that is not currently in force. That is recorded in CLAUDE.md and the refactor log as a pre-existing gap. Closing it — a lint rule, or a `src/`-only config — is out of this phase's scope.

## Consequences

- The signed-in branch of `addTransaction` and `commitBulkImport` has tests for the first time.
- A future ordering or ref-mirror test belongs in the no-`act()` harness. Putting it under `act()` would pass on broken code.
- The harness proves client behaviour against a fake. It proves nothing about the database; the RPC and Postgres-backed tests are Phase 51's.
- Deferred, by name: F3 (absolute balance writes) and F4 (retry-unsafe insert) to Phase 51; F5 (sign-out data hygiene), the Security surface and mobile navigation to Phase 52; F7 (opening-balance ledger rows) and F8 (DEBT_REPAYMENT rows in CSV) to Phase 51's reconciliation work, because both change visible ledger contents.
