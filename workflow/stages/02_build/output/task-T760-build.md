# Build report: T760

Phase 132: A transfer with an unknown outcome re-reads the cloud (SL-02).

## Files changed (5 files + build report)

1. `src/context/FinanceContext.tsx`:
   - Updated `addTransaction`'s `TRANSFER` branch error handling around lines 1848-1853:
     - Checked `if (isUnknownOutcomeError(rpcError)) rpcOutcomeUnknown = true;` before re-throwing `rpcError`.
     - Checked `if (!payload?.transaction) { rpcOutcomeUnknown = true; throw new Error('transfer_funds returned an unexpected response'); }` when the RPC returns no transaction row.
2. `unit/authenticated-ledger.test.tsx`:
   - Added `reads` and `transfer` helper functions to `describe('a signed-in transfer through transfer_funds (Phase 93, ADR 0069)', ...)`.
   - Added Test A: `'re-reads after a lost response instead of showing a rollback the server never made (SL-02)'`.
   - Added Test B: `'re-reads after a success with no row, since the money may have moved (SL-02)'`.
   - Added Test C: `'only rolls back, with no re-read, when the server refuses with a SQLSTATE'`.
3. `docs/audit/baseline-metrics.md`:
   - Added `### Phase 132 - delta against Phase 129` section at top of Figures with entry chunk, all app JS, CSS, Vitest, and Playwright metrics.
4. `docs/audit/refactor-log.md`:
   - Added Phase 132 entry above Phase 131 documenting changes, gate verifications, surprises (none), and deliberately not done scope.
5. `docs/audit/task-ledger.md`:
   - Added Phase 132 section with T760 row marked done with gate results; left Commit cell empty.
   - Updated SL-02 Backlog row status to `done in Phase 132 (T760)`.
   - Appended owner-decided Backlog row for `setTransactionDeleted` lacking `cloudRevisionAtStart` check.

## Tests added and fail-then-pass evidence

- Added three tests in `unit/authenticated-ledger.test.tsx`:
  - Test A: lost response triggers re-read via `refreshFromCloud` instead of plain rollback.
  - Test B: success with empty transaction payload triggers re-read via `refreshFromCloud`.
  - Test C: rejection with SQLSTATE only rolls back without cloud re-read (prevents over-fix).
- **Red run evidence** (`workflow/stages/02_build/output/logs/T760-red.log`):
  - Command: `npx vitest run unit/authenticated-ledger.test.tsx -t "transfer_funds"`
  - Test A failed: `AssertionError: expected 0 to be greater than 0` at line 1712 (`expect(reads()).toBeGreaterThan(readsBefore)`)
  - Test B failed: `AssertionError: expected 0 to be greater than 0` at line 1734 (`expect(reads()).toBeGreaterThan(readsBefore)`)
  - Test C passed (`only rolls back, with no re-read, when the server refuses with a SQLSTATE`)
  - Existing test passed (`names no user: the server takes it from the session`)
  - Summary: 2 failed | 2 passed | 118 skipped
- **Green run evidence**:
  - Targeted unit run: 4/4 transfer_funds tests passed; all 122 tests in `unit/authenticated-ledger.test.tsx` passed; all 49 tests in `unit/ledger-guards.test.tsx` passed (171 passed total).
  - Full suite: 1378/1378 passed in 62 files.

## Gate commands and results

1. Gate 1 (Red first money path):
   - Command: `npx vitest run unit/authenticated-ledger.test.tsx -t "transfer_funds" 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T760-red.log`
   - Result: Tests A and B failed as expected; Test C and existing test passed.
   - Log path: `workflow/stages/02_build/output/logs/T760-red.log`

2. Gate 2 (`npm run lint`):
   - `check:node-globals`: 132 files in src, no Node globals.
   - `check:safe-ids`: 132 files in src, no id from the time alone.
   - `tsc --noEmit`: clean.
   - `tsc -p api/tsconfig.json`: clean.
   - Result: clean, exit 0.

3. Gate 3 (Targeted unit tests):
   - Command: `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx`
   - Result: 2 test files passed, 171 tests passed in 38.16s, exit 0.

4. Gate 4 (Full unit test suite):
   - Command: `npm run test:unit 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T760-unit.log`
   - Result: 62 test files passed, 1378 tests passed (1375 + 3) in 49.85s, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T760-unit.log`

5. Gate 5 (Stale dev server check):
   - Checked ports 3000 and 3100 (`Get-NetTCPConnection -LocalPort 3000,3100 -State Listen`). Both clear.

6. Gate 6 (Playwright Chromium):
   - Command: `npx playwright test tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts --project=chromium`
   - Result: 11 passed in 46.4s, exit 0.

7. Gate 7 (Playwright all 3 browsers):
   - Command: `npx playwright test tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T760-e2e.log`
   - Result: 33 passed in 56.8s across Chromium, Firefox, WebKit (11 tests x 3 browsers), 0 failed, 0 flaky, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T760-e2e.log`

8. Gate 8 (Production build and asset metrics):
   - Command: clean build with `.env` present (`Remove-Item -Recurse -Force dist; npm run build`)
   - Result: clean build in 5.11s, exit 0.
   - Entry chunk: `index-C7LsbYem.js`, 191,696 B raw (+22 B), 55,810 B gzip (+8 B against Phase 129 `index-BB5386eR.js`, 191,674 / 55,802).
   - All app JS: 878,229 B raw (+22 B), 266,912 B gzip (-30 B), 40 files (0 delta against Phase 129 878,207 / 266,942, 40 files).
   - CSS: `index-CqllkKUj.css`, 52,759 B raw (0 delta), 10,159 B gzip (0 delta against Phase 129 `index-CqllkKUj.css`, 52,759 / 10,159).

9. Gate 9 (Static checks):
   - `git diff --stat`: exactly 5 files modified (4 target files + `docs/audit/task-ledger.md`), 101 insertions, 3 deletions.
   - `FinanceContext.tsx` diff: only `:1848-1853` region modified.
   - Occurrences of `rpcOutcomeUnknown = true`: 4 times in `addTransaction` (was 2), 6 times in file (was 4).
   - `git ls-files --eol`: all 5 touched files report `w/crlf`.
   - `git diff -U0 | Select-String -Pattern ([char]0x2014)`: 0 em dashes found.

## Not done

- None. All edits from the spec were completed. Out-of-scope items (SL-01, SL-03, `markLocalWrite` order in TRANSFER, and `setTransactionDeleted` cloudRevision check) are documented in `docs/audit/refactor-log.md` and tracked in `docs/audit/task-ledger.md`.
