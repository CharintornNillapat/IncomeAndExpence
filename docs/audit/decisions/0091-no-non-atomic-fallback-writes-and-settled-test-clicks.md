# 0091: A signed-in ledger write is one database function or nothing; the test helpers wait for tweens to end

**Status:** Accepted. Draft PR; not merged. No migration.
- **Supersedes** the fallback parts of ADR `0022` (the import's insert-then-compensate) and ADR `0023` ("the legacy absolute-write paths remain only as the missing-function fallback"), and ADR `0024`'s fallback for `create_wallet`.
- **Amends** ADR `0058` and `0089`: the shared test helpers wait for running animations before they click.

**Date:** 2026-10-08

## Context

1. **Five signed-in writes kept a fallback for a missing database function:** `addTransaction` (for `transfer_funds` and `record_transaction`), `setTransactionDeleted` (`set_transaction_deleted`), `commitBulkImport` (`import_transactions`) and `addWallet` (`create_wallet`). Each fallback wrote absolute balances and rows in several requests, with compensation after a failure; a failure part-way, or a failed compensation, could debit one wallet without crediting the other. They existed for a project without the migrations. Since Phase 87 (ADR `0063`) every migration replays from empty, and live has had every function since Phase 52, so the fallbacks guarded nothing real and remained the app's only non-atomic money paths. `updateTransaction`, `seedStarterAccount` and `deleteAccount` already had none.
2. **The local WebKit painting stall** (ADR `0058`) failed 4 of about 600 WebKit runs in Phase 114. The one with a full trace and a moving element began with a click during the 200 ms tab slide; ADR `0089` named waiting for running animations as the next thing to test.

## Decision

1. **No fallback.** When one of the five functions is missing (`isMissingRpcError`: `42883` or `PGRST202`, unchanged), the write rolls back its optimistic state, writes no table, and returns `databaseUpdateNeeded()`: `{ success: false, code: 'DATABASE_UPDATE_NEEDED', error: 'This needs the latest database update. Nothing was changed.' }`. `MutationResult` gains the optional `code`.
   - Inside a write's `try`, a missing function throws `MissingLedgerFunction`, so the `catch` rolls back exactly as for any other failure (including ADR `0022`'s re-read when a reload landed underneath), then returns the result.
   - The import and the wallet return it directly: neither has an optimistic state to undo before the call.
   - Every other database error is unchanged: it keeps its message, and an unknown outcome still re-reads (ADR `0023`).
   - Removed with the fallbacks: their compensation blocks and tracking flags, and `commitBulkImport`'s table-shaped `dbPayloads`. `FinanceContext.tsx` is 346 lines shorter.
2. **`settle(page)`** in `tests/helpers.ts` waits until no finite animation or transition is running (`document.getAnimations()`, an endless one such as a spinner left out). It polls every 50 ms on a timer, not on animation frames, which a stalled page does not run. `gotoTab` settles before its click and after the view has slid in, and `addQuickTransaction` before opening Quick Add and after it closes, so the spec's next click does not land mid-tween.

## What it does not change

- **A build from before this phase keeps its own fallback**, and a missing function cannot happen on live: every one of the five is there.
- **A stall on the first click after a page load is not addressed.** Measured on this branch in WebKit and Chromium: nothing animates after `page.goto('/')` (0, 100, 250, 500 and 1000 ms), and a tab change runs its transitions and slide for about 250 ms. Two of Phase 114's four stalls were first clicks after a load, so waiting for animations cannot be the whole answer.

## Tests

- **`unit/authenticated-ledger.test.tsx`:**
  - **New, "a project missing a ledger function" (6):** an expense, a repayment, a transfer, a delete, a CSV import and a new wallet each return the result above, ask for the function once, write no `transactions`, `wallets` or `debts` row, and leave the screen as it was. All six failed first: the fallbacks wrote and reported success.
  - **Removed with the fallbacks:** F1 (the legacy debt write; the RPC path's partial repayment test covers what the user sees), F2 (the legacy import's insert and compensation, 3), `create_wallet`'s two fallback tests, and "a project without the Phase 51 migration".
  - **F6, rewritten** against `record_transaction` (gated and refused), keeps both of its cases: a reload that read nothing does not disarm the rollback, and a clean one still re-reads.
- **Gate:** lint clean; unit 1299/1299 in 56 files; Playwright, first run 484 passed, 6 skipped, 2 failed of 492 (14.4 m), second run 485 passed, 6 skipped, 1 failed (12.6 m), traces on in both: all three the WebKit painting stall; no migration, and live holds all five functions.
- **WebKit, measured:** with `settle` in the helpers, 3 stalls in 656 WebKit runs (the two full runs, 328, and the WebKit project twice over, 328, which had none), against 4 in about 600 in Phase 114: at rates this low the change is not measurable. All three were clicks the helpers do not make, each traced with frames stopping within 0.3 s of the click: Quick Add's submit and the rule chip's dismiss, with `motion-chip` and `data-leaving` elements in the snapshot (a chip's tween), and the Transactions panel's Restore. All came in three-browser runs. The stall is not fixed; the helpers' own clicks no longer land mid-tween.
- **Bundle:** the entry 196,820 / 57,066 to 191,919 / 56,213 B (-4,901 / -853 gzip; `FinanceContext` is in it); all app JS 883,188 / 268,070 to 878,287 / 267,227, 40 files, no other chunk changed; cold start still three scripts.

## Next, if the stall matters

Running the WebKit project with `reducedMotion: 'reduce'` would remove every tween there, in every spec, not just in the helpers. It would also stop WebKit testing the app's motion (Chromium and Firefox still would), and `reduced-motion.spec.ts`'s motion-on group would have to say `no-preference` itself. It is a coverage decision for the owner, and it does not touch the stalls on a first click after a load.
