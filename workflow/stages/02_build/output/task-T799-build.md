# Build report: T799

Phase 144, branch `phase-144-smooth-sync-and-tabs`. Third task of the phase; does not ship the phase.

## 1. Files changed (6 files)

- `docs/audit/decisions/0003-localstorage-and-realtime.md`
- `src/context/FinanceContext.tsx`
- `src/context/DiaryContext.tsx`
- `docs/contexts/client-state.md`
- `unit/authenticated-ledger.test.tsx`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

Added 9 unit tests in `unit/authenticated-ledger.test.tsx` under `describe('an own save does not reload (T799, ADR 0003 amendment)', ...)` and renamed the existing test at line 2135 to `'a new day is one insert under the account, and the saved row shows without a reload'`.

### Red run (Gate 1)

Command: `npx vitest run unit/authenticated-ledger.test.tsx -t "T799"`
Log: `workflow/stages/02_build/output/logs/T799-red.log`

Result: exactly 7 tests failed, 2 passed (9 total in the block; 130 other tests in the file skipped via `-t`):
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > an expense whose echoes arrive before its response`: FAIL (`expected 1 to be 0` on `writes('wallets', 'select')`)
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > a transfer whose echoes arrive before its response`: FAIL (`expected 1 to be 0` on `writes('wallets', 'select')`)
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > a money edit that keeps its wallet`: FAIL (`expected 1 to be 0` on `writes('wallets', 'select')`)
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > a new wallet with an opening balance`: FAIL (`expected 1 to be 0` on `writes('wallets', 'select')`)
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > a diary save for a new day`: FAIL (`expected 1 to be 0` on `writes('wallets', 'select')`)
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > a diary save for a day already logged`: FAIL (`expected 1 to be 0` on `writes('wallets', 'select')`)
- `unit/authenticated-ledger.test.tsx > an own save does not reload (T799, ADR 0003 amendment) > a CSV import reads once`: FAIL (`expected 2 to be 1` on `writes('wallets', 'select')`)

2 GUARD tests passed in the block:
- `guard: a change from another device still reloads`: PASS
- `guard: another device's row in the same window as an own save still reloads`: PASS

### Green run (Gates 3 & 4)

All 9 new tests pass after implementation (`npx vitest run unit/authenticated-ledger.test.tsx -t "T799"`: 9 passed, 0 failed). Full file `unit/authenticated-ledger.test.tsx`: 139 passed.

## 3. Gates

1. **Red run:** verified (7 failed, 2 passed). Log: `workflow/stages/02_build/output/logs/T799-red.log`.
2. **`npm run lint`:** clean (node-globals 133 files clean, safe-ids 133 files clean, `tsc --noEmit` and `tsc -p api/tsconfig.json` 0 errors).
3. **Targeted unit:** `npx vitest run unit/authenticated-ledger.test.tsx unit/diary-context.test.tsx unit/ledger-guards.test.tsx unit/navbar-sync-badge.test.tsx unit/entity-ids.test.tsx unit/rerender-matrix.test.tsx unit/supabase-lazy-provider.test.tsx` -> 7 files passed, 218 tests passed (48.36s).
4. **Shuffle check:** `npx vitest run unit/authenticated-ledger.test.tsx --sequence.shuffle` run 3 times, all 139 passed each time (run 1: 46.11s, run 2: 46.39s, run 3: 46.14s).
5. **Full unit suite:** `npm run test:unit` -> 68 files passed, 1500 tests passed (71.35s). Log: `workflow/stages/02_build/output/logs/T799-unit.log`.
6. **Playwright Chromium:** `npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/wallets.spec.ts tests/csv.spec.ts tests/debt-repayment.spec.ts tests/diary.spec.ts tests/diary-page.spec.ts --project=chromium` -> 27 passed (33.3s).
7. **Playwright all browsers:** `npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/wallets.spec.ts tests/csv.spec.ts tests/debt-repayment.spec.ts tests/diary.spec.ts tests/diary-page.spec.ts` -> 81 passed across 3 browsers (2.3m). Log: `workflow/stages/02_build/output/logs/T799-e2e.log`.
8. **Line endings:** verified via `git ls-files --eol`: `w/lf` for `docs/audit/decisions/0003-localstorage-and-realtime.md` (no CR present) and `w/crlf` for all other files (`src/context/FinanceContext.tsx`, `src/context/DiaryContext.tsx`, `docs/contexts/client-state.md`, `unit/authenticated-ledger.test.tsx`, `docs/audit/task-ledger.md`).
9. **Em dashes:** verified with substring checks: 0 em dashes added in `git diff` and 0 em dashes in the build report.
10. **Scope:** `git diff --stat` and `git status --porcelain` confirm only the 6 allowed target/bookkeeping files were modified.

## 4. Deliberately not done

- `deleteDiaryEntry` remains unchanged per spec (it deletes locally and rolls back on failure; unexpected outcome fallback uses `refreshFromCloud`).
- No server-side migrations or RPC changes: client-side echo suppression and local state application satisfy the entire contract.
- Phase closing docs (`refactor-log.md`, `baseline-metrics.md`, test counts in `AGENTS.md` and `README.md`): reserved for the task that ships the phase.
