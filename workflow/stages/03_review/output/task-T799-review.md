# Review: T799

## Round 1

### 1. Metadata

- **Task:** T799, Phase 144 (`phase-144-smooth-sync-and-tabs`), HEAD `2868d31`
- **Date:** 2026-10-23
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `docs/audit/decisions/0003-localstorage-and-realtime.md`, `src/context/FinanceContext.tsx`, `src/context/DiaryContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/contexts/client-state.md` (plus bookkeeping `docs/audit/task-ledger.md`). `git check-ignore -v` on all five: none ignored (exit 1).

### 2. Summary

The realtime handler no longer consumes a marked id on its first echo, and it now decides at the end of the 400 ms debounce whether any remembered unmarked id is still unmarked (or a no-id trigger asked), so a server id marked just after its echo no longer reloads. TRANSFER marks both wallets before `transfer_funds`; the CSV import marks wallets and debts before its RPC and the inserted ids after it; the diary save marks a known id before the update and applies the `.select().single()` row instead of calling `refreshFromCloud()`. ADR 0003 gains an amendment, `client-state.md` gains one rule, and nine tests plus an echo-capable fake channel pin the behaviour.

### 3. Invariants and parity

- **Parity: `addTransaction` / `setTransactionDeleted` arithmetic vs `_ledger_apply_effect`:** the only hunk in `addTransaction` moves `markLocalWrite(sourceWallet.id)` / `markLocalWrite(destWallet.id)` from after the response (old `:1895-1896`) to just before `supabase.rpc('transfer_funds', ...)` (`:1857-1858`). No arithmetic, rounding, RPC argument, optimistic update or rollback line is in the diff. Pass.
- **No other parity row touched** (no `api/`, `supabase/`, `types.ts`, DOM id, `index.html`).
- **Recovery re-reads byte for byte:** the FinanceContext hunks sit at `:572`, `:1088`, `:1123`, `:1139`, `:1846`, `:1892`, `:2536`, `:2569`. `commitBulkImport`'s failure branch (`:2554-2580`: missing-RPC return, `!rpcError || isUnknownOutcomeError` re-read, `DEBT_OVERPAYMENT` re-read, error return) appears in no hunk; the `:2569` hunk starts after its closing brace. `addTransaction`'s unknown-outcome catch, `setTransactionDeleted`, `updateTransaction`'s `undo`, and `addWallet`'s two re-reads are untouched. Pass.
- **A change from another device still reloads:** an unmarked event calls `scheduleReload(rowId)`; at fire time `remote` is true when any pending id is absent from `recentLocalWriteIds` (`:1138`). An event without an id, `online`, stale `visibilitychange` and re-`SUBSCRIBED` call `scheduleReload()` and set `reloadRequested`, so they always reload. Both guard tests (8, 9) pass with and without the change. Pass. Known limit (documented in ADR Limits 2): a remote change to a row this client marked in the last 5 s, arriving alone, waits for the next trigger.
- **Diary save, both cases:** existing day: `markLocalWrite(existing.id)` before the update, then `setDiaryEntries` maps the row with the same id to `mapDiaryRow(upserted)`. New day: the insert echo (server id) is pending, `markLocalWrite(saved.id)` lands before the debounce fires, and the row is prepended (`[saved, ...prev]`), matching the guest branch. A null `upserted` falls back to `refreshFromCloud()` and `{ success: true }`. Error path unchanged. Tests 5 and 6 plus the two existing diary tests (now served by the applied row, not a reload) pass. Pass.
- **Realtime effect:** deps unchanged `[isAuthenticated, currentUser.id, verifySession]`; cleanup unchanged; `pendingEchoIds` and `reloadRequested` are per-effect locals and reset on each fire. Constants 400 ms / 5 s / 30 s unchanged.
- **Line endings:** `w/crlf` kept for FinanceContext, DiaryContext, the test, client-state.md, task-ledger.md; ADR 0003 `w/lf`, 0 CR bytes.
- **Em dashes:** 0 in added lines (spec's node check). ADR 0003 (7) and the test file (2) carry pre-existing em dashes, same count as HEAD; none user-facing.
- **Scope:** `git status --porcelain` and `git diff --stat` show the five targets, `docs/audit/task-ledger.md`, and the untracked spec and build report. Nothing unannounced.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| Red: `git stash push -- src/context/FinanceContext.tsx src/context/DiaryContext.tsx`; `npx vitest run unit/authenticated-ledger.test.tsx -t "T799"`; `git stash pop --index` | 7 failed, 2 passed, 130 skipped (139). Failing: tests 1-7 as the spec lists; guards 8 and 9 pass. `git status --porcelain` and `git diff --stat -- src/context` identical before and after | `workflow/stages/03_review/output/logs/T799-red.log` |
| `npm run lint` | exit 0 (node-globals 133 clean, safe-ids 133 clean, both `tsc` runs clean) | `.../logs/T799-lint.log` |
| `npx vitest run unit/authenticated-ledger.test.tsx unit/diary-context.test.tsx unit/ledger-guards.test.tsx unit/navbar-sync-badge.test.tsx unit/entity-ids.test.tsx unit/rerender-matrix.test.tsx unit/supabase-lazy-provider.test.tsx` | 7 files passed, 218 tests passed, 0 failed (48.76s) | `.../logs/T799-targeted.log` |
| `npm run test:unit` | 68 files passed, 1500 tests passed, 0 failed, 0 skipped (68.87s); 1491 + 9 new | `.../logs/T799-unit.log` |
| `npx vitest run unit/authenticated-ledger.test.tsx --sequence.shuffle` x3 | 139/139 passed each run (46.20s, 46.20s, 46.15s) | `.../logs/T799-shuffle-{1,2,3}.log` |
| Ports 3000 / 3100 | free | |
| Playwright 7 specs `--project=chromium` | 27 passed (30.4s) | `.../logs/T799-e2e-chromium.log` |
| Playwright 7 specs, all browsers | 81 passed, 0 failed, 0 skipped (2.0m) | `.../logs/T799-e2e.log` |

### 5. Not verified

- The real Supabase Realtime ordering (echo vs HTTP response) in a browser; the unit fake fires echoes synchronously inside the write, which models the "echo beats response" worst case only. No signed-in Playwright path exists (sign-in from a dev server is stop-and-ask).
- No stash exclusions: both stashed source files are `w/crlf`.

### 6. Blocking

(none)

### 7. Non-blocking

- `docs/audit/decisions/0003-localstorage-and-realtime.md` Context: spec 5a asked for one line of evidence per gap (file:line); the amendment describes each gap but cites no lines. Fine as is.
- Build report section 2 says the two diary red tests failed with `expected 1 to be 0`; the reviewer's red run shows `got 2` (the save's own re-read plus the echo reload). The failing assertion is the same; only the report's number is off.
- Pre-existing, not introduced here: `markLocalWrite` called twice for one id keeps the first timer, so the id expires 5 s after its first mark, not its last. With echoes no longer consuming marks this matters a little more (a second write to the same wallet within 5 s may get one extra reload), but the result is a wasted read, not a wrong screen.
- The diary save now writes local state after an `await` without the sign-out epoch check `loadSupabaseData` has; every other ledger write already does the same, so this matches existing practice.

### 8. Rule candidates

- None new: the builder already added the "Own echoes never reload" bullet to `docs/contexts/client-state.md`, and the code complies.
