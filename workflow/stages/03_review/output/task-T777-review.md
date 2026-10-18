# Review: T777

## Round 1

### 1. Metadata

- Task: T777, setTransactionDeleted re-fetches instead of restoring a stale snapshot (T69)
- Date: 2026-10-18
- Round: 1
- Verdict: APPROVED
- Target files: `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/audit/task-ledger.md` (bookkeeping). `git check-ignore -v` on all three: exit 1, none ignored.

### 2. Summary

`setTransactionDeleted` now snapshots `cloudRevisionRef` at the start and, on failure, re-fetches with `refreshFromCloud()` when a clean reload landed mid-flight. Otherwise it restores the snapshot as before, with the `rpcOutcomeUnknown` re-read in the `else` and the `MissingLedgerFunction` return moved after it, the same layout as `addTransaction`. The build adds four tests (delete and restore, each with and without a reload) and updates the ledger rows the spec names.

### 3. Invariants and parity

- Parity row 1 (`setTransactionDeleted` arithmetic vs ledger RPCs): no arithmetic or SQL changed. Only the failure path's choice between rollback and re-fetch changed. `authenticated-ledger` and `ledger-guards` both pass (176/176).
- Source diff matches spec section 6 exactly: 2 added snapshot lines after `previousDebts` (`:2061-2062`), and the catch reshaped at `:2201-2221`. No change outside `setTransactionDeleted`. `console.error`, the error-message block and the dependency array are unchanged. Since `cloudRevisionRef` is a ref, the dependency array did not need a change.
- `MissingLedgerFunction` move: it is thrown before `rpcOutcomeUnknown` can be set, so on that path the `else` only restores, as before. If a reload landed, the path now re-fetches before returning `databaseUpdateNeeded()`, which matches `addTransaction`'s order (`:1965-1988`).
- The guest path is unaffected: it returns before the `try`.
- Tests follow the spec's text fragment by fragment: gate, reload, refuse, deleted-first with a trailing macrotask. No new harness helper and no change to the fake RPC.
- Scope: `git status --porcelain` shows only the 3 target files plus the untracked spec and build report. Nothing unannounced.
- Line endings: all three files are `i/lf w/crlf`.

### 4. Gates run (reviewer's own runs)

| Command | Result | Log |
|---|---|---|
| Red: `git stash push -- src/context/FinanceContext.tsx`, then `npx vitest run unit/authenticated-ledger.test.tsx -t "mid-flight"` | 1 file failed; 2 failed, 2 passed, 123 skipped (127). A and B fail at `:1251:48` and `:1289:48` with `expected 0 to be greater than 0` (no wallet re-read), as the spec predicts; C and D pass. After `git stash pop --index`, `git status --porcelain` is identical to the pre-stash record | `workflow/stages/03_review/output/logs/T777-red.log` |
| Green: same `-t "mid-flight"` command | 1 file passed; 4 passed, 123 skipped | `.../logs/T777-green.log` |
| `npm run lint` | exit 0 (node-globals 132 files clean, safe-ids 132 files clean, both tsc runs clean) | `.../logs/T777-lint.log` |
| `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx` | 2/2 files, 176 passed, 0 failed | `.../logs/T777-related.log` |
| `npm run test:unit` | 63/63 files, 1444 passed, 0 failed, 0 skipped (45.62s) | `.../logs/T777-unit.log` |
| Ports 3000/3100 | clear before each Playwright run | n/a |
| `npx playwright test tests/soft-delete.spec.ts --project=chromium` | 6 passed (18.2s) | `.../logs/T777-e2e-chromium.log` |
| `npx playwright test tests/soft-delete.spec.ts` | 18 passed across 3 browsers (51.6s) | `.../logs/T777-e2e-all.log` |
| Em dash count in added lines (`git diff -U0 HEAD`) | 0 | n/a |
| `git ls-files --eol` (3 files) | `w/crlf` for all | n/a |

### 5. Not verified

- No live behaviour was tested, and none is needed: the fix is client-only and the spec's production touch points are `none`.
- The re-fetch-fails case (a reload landed, then the re-fetch reads nothing) was not tested. It is out of scope by the spec (section 9). It behaves the same as in `addTransaction`.

### 6. Blocking

(none)

### 7. Non-blocking

- `unit/authenticated-ledger.test.tsx:23-24` has 2 em dashes in the file header comment. They were there before this task (HEAD has the same 2), the task added none, and they are not user-facing.
- The new catch comment says "a realtime reload", but the tests trigger the reload through the auth callback. The wording was copied from `addTransaction`, and `cloudRevisionRef` counts any clean load, so the comment is fine.

### 8. Rule candidates

(none)
