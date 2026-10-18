# Review: T776

## Round 1

### 1. Metadata

- Task: T776, useTransactions honours an explicit includeDeleted: true (CS-01), phase 139, branch `phase-139-subagent-trial`
- Date: 2026-10-18
- Round: 1
- Verdict: APPROVED
- Target files: `src/hooks/useTransactions.ts`, `unit/use-transactions.test.tsx` (new), `docs/audit/task-ledger.md` (bookkeeping)

### 2. Summary

Line 68 (`if (includeDeleted && !showSoftDeleted && tx.isDeleted) return false;`) is removed and `showSoftDeleted` is dropped from the Stage 1 memo dependency array; nothing else changed in the hook. The memo body no longer reads `showSoftDeleted`, which is still destructured (line 20) and returned, so there is no unused variable. Two unit tests pin the explicit option and the default. The ledger gets a Phase 139 section with a T776 row and a Backlog row for CS-01.

### 3. Invariants and parity

- Parity map: no row touched (spec says none). Confirmed: no `FinanceContext.tsx`, SQL or `api/` change.
- `git check-ignore -v` on all three targets: no output (none ignored).
- Scope: `git status --porcelain` shows only the two target modifications, the new test, the ledger, and the spec and build reports (bookkeeping). `git diff --stat`: ledger 9 insertions, hook 1 insertion and 2 deletions. No unannounced file.
- Hook diff is exactly line 68 removed plus the dependency array edit. Full memo text read: with the default (`includeDeleted = showSoftDeleted`) behaviour is unchanged; line 67 still drops deleted rows when `includeDeleted` is false.
- Only caller `TransactionsView.tsx` passes no `includeDeleted`, so app behaviour is unchanged.
- Line endings: `src/hooks/useTransactions.ts` and `docs/audit/task-ledger.md` `i/lf w/crlf`; the new test is `w/crlf` (untracked, via `-o -c`).
- Em dashes: 0 added in `git diff -U0 HEAD`; 0 in the test, build report and spec.
- Ledger: Phase 139 section sits above `## Backlog`, in Phase 138's table format; Backlog row matches the UI-01 shape (three cells) with status `done in Phase 139 (T776)`.

### 4. Gates run

- `npm run lint`: exit 0 (node-globals 132 files clean, safe-ids 132 files clean, both tsc clean).
- `npx vitest run unit/use-transactions.test.tsx unit/transactions-page.test.tsx`: 2 files passed, 26 tests passed, 0 failed.
- `npm run test:unit`: 63 files passed, 1440 tests passed, 0 failed, 0 skipped. Log: `workflow/stages/03_review/output/logs/T776-unit.log`.
- `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts --project=chromium`: 12 passed. Log: `workflow/stages/03_review/output/logs/T776-pw-chromium.log`.
- `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts` (3 browsers): 36 passed. Log: `workflow/stages/03_review/output/logs/T776-pw-all.log`.
- Ports 3000 and 3100: no listeners before Playwright.
- Red check (step 6): `git status --porcelain` recorded; `git stash push -- src/hooks/useTransactions.ts` (file is `w/crlf`, so stashing is safe); `npx vitest run unit/use-transactions.test.tsx` gave 1 failed, 1 passed, with `AssertionError: expected [ 'tx-live' ] to include 'tx-gone'` on test 1 and test 2 passing; `git stash pop --index`; `git status --porcelain` identical to the recorded one and the hook diff is intact (1 insertion, 2 deletions).

### 5. Not verified

- Nothing outstanding. The Playwright specs do not exercise `includeDeleted: true` (no caller passes it); only the unit test covers it.

### 6. Blocking

None.

### 7. Non-blocking

- Test 2 asserts `toEqual(['tx-live'])` before the toggle, which depends on seed order only for a single row; fine.
- The build report says "1 passed, 2 passed" in the green run line; a typo for "2 passed". The ledger gate row is accurate.

### 8. Rule candidates

None.

### 9. Fix block

Not applicable (APPROVED).
