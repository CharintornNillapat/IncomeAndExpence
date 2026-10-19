# T783 review: useDebts rounds summary targets to cents with roundToCents (CS-03)

## Round 1

### 1. Metadata
- **Task:** T783
- **Date:** 2026-10-19
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `src/hooks/useDebts.ts`, `unit/debts-page.test.tsx`, `docs/audit/task-ledger.md` (`git check-ignore -v` returned no matches on all three files; `git ls-files --eol` confirmed `w/crlf` on all three files)

### 2. Summary
`useDebts` (`src/hooks/useDebts.ts:41-43`) now wraps `totalTarget`, `remainingTarget`, and `paidTarget` in `roundToCents(...)` from `src/utils/money.ts:22`, preventing IEEE 754 floating-point drift across multi-debt reductions and subtraction in `useDebts().metrics`. A new unit test in `unit/debts-page.test.tsx:221-246` verifies cent rounding across multi-debt addition (`10.1 + 20.2 === 30.3`, `0.1 + 0.2 === 0.3`), agreement with `debtRemaining(debts)`, and single-debt subtraction (`0.3 - 0.1 === 0.2`), and `docs/audit/task-ledger.md` records `T783` and the closed `CS-03` Backlog row.

### 3. Invariants and parity
- **Parity map (`AGENTS.md`):** No parity map row links `src/hooks/useDebts.ts`; verified that `useDebts().metrics.remainingTarget` now matches `debtRemaining(debts)` in `src/selectors/wallets.ts:79-83` (whose doc comment at `:78` cites `useDebts().metrics.remainingTarget`), as both sum `remainingAmount` over non-deleted, non-settled debts and pass the result through `roundToCents`.
- **Changed function and callers read in full (strict mode):**
  - `useDebts` (`src/hooks/useDebts.ts:1-101`): imports `roundToCents` from `'../utils/money'` at line 6 and wraps `totalTarget` (line 41), `remainingTarget` (line 42), and `paidTarget` (line 43) in `roundToCents(...)` before passing `totalTarget` and `remainingTarget` to `payoffPercent` (line 46).
  - `DebtsView` (`src/views/DebtsView.tsx:1-443`) and `DebtSummaryCard` (`src/components/debt/DebtSummaryCard.tsx:1-91`): read `metrics.remainingTarget`, `metrics.totalTarget`, `metrics.paidTarget`, and `metrics.progressPercent`.
  - `DashboardView` (`src/views/DashboardView.tsx:1-217`) and `DebtPayoffCard` (`src/components/dashboard/DebtPayoffCard.tsx:1-103`): read `debtSummary.paidTarget`, `debtSummary.totalTarget`, and `debtSummary.progressPercent`, while `wealth.debtRemaining` calls `debtRemaining(debts)`.
  - Supporting selectors and utilities read in full: `src/selectors/debts.ts:1-128`, `src/selectors/wallets.ts:1-89`, `src/utils/money.ts:1-37`, `src/components/debt/DebtCard.tsx:1-148`.
- **Money invariants and edge cases checked (strict mode):**
  1. **Multi-debt addition drift (`10.1 + 20.2`, `0.1 + 0.2`):** `roundToCents(30.299999999999997) === 30.3` and `roundToCents(0.30000000000000004) === 0.3`. Verified in `unit/debts-page.test.tsx:222-233`.
  2. **Subtraction drift on already-rounded targets (`0.3 - 0.1`):** Even after `totalTarget` (`0.3`) and `remainingTarget` (`0.1`) are rounded to cents, `0.3 - 0.1` in IEEE 754 is `0.19999999999999998`; wrapping `Math.max(0, totalTarget - remainingTarget)` in `roundToCents` produces `0.2`. Verified in `unit/debts-page.test.tsx:235-245`.
  3. **Sign and non-negative floor on `paidTarget` (ADR `0084`):** When a legacy or restored debt has `remainingAmount > totalAmount` (`totalTarget - remainingTarget < 0`), `Math.max(0, ...)` clamps to `0` and `roundToCents(0)` returns `+0` (never `-0` or negative). Verified by `unit/debts-page.test.tsx:177-185`.
  4. **Zero-borrowed and empty-ledger bounds (ADR `0079`, `0080`, `0081`):** With no live debts (`liveDebts.length === 0`), `totalTarget === 0`, `remainingTarget === 0`, `paidTarget === 0`, and `progressPercent === 0`. With live debts whose `totalAmount` sums to `0`, `totalTarget === 0` and `payoffPercent(0, remainingTarget, 100)` returns `100`. Verified by `unit/debts-page.test.tsx:170-175` and `unit/selectors-debts.test.ts:174-207`.
  5. **Soft-deleted and settled rows:** `liveDebts` filters out `d.isDeleted` (`src/hooks/useDebts.ts:22`), so soft-deleted debts contribute `0` to `totalTarget`, `remainingTarget`, and `paidTarget`. Settled live debts (`d.isSettled && !d.isDeleted`) contribute `d.totalAmount` to `totalTarget` and `0` to `remainingTarget`, so their full borrowed amount counts in `paidTarget`. Verified by `unit/debts-page.test.tsx:95-106`, `:215-219`.
  6. **Transfers and concurrency guards:** `useDebts` is a pure read/projection hook over `FinanceContext` state and delegates writes to `addDebt`, `editDebt`, `settleDebt`, and `deleteDebt` untouched; no transfer or concurrency path is modified.
- **Scope and formatting:**
  - `git diff --stat` and `git status --porcelain` show only `src/hooks/useDebts.ts`, `unit/debts-page.test.tsx`, `docs/audit/task-ledger.md`, and the untracked stage output files (`task-T783-spec.md`, `task-T783-build.md`).
  - Zero em dashes in the git diff and across all touched and stage output files.

### 4. Gates run
- **Red-run verification (stash check, step 6):**
  - Stashed `src/hooks/useDebts.ts` (`git stash push -- src/hooks/useDebts.ts`) and ran `npx vitest run unit/debts-page.test.tsx -t "CS-03"`: **1 file, 29 tests: 1 failed, 28 skipped** in 1.83s (`AssertionError: expected 30.299999999999997 to be 30.3` at `unit/debts-page.test.tsx:230`). Restored with `git stash pop --index` and confirmed `git status --porcelain` and `git ls-files --eol` (`w/crlf`) matched pre-stash state.
- `npm run lint`: **0 errors** (`check:node-globals`: 132 files in `src`, no Node globals; `check:safe-ids`: 132 files in `src`, no id from the time alone; `tsc --noEmit`: 0 errors; `tsc -p api/tsconfig.json`: 0 errors).
- `npx vitest run unit/debts-page.test.tsx unit/selectors-debts.test.ts unit/dashboard.test.tsx`: **3 files, 98 tests: 98 passed, 0 failed, 0 skipped** (6.67s).
- `npm run test:unit`: **63 files, 1446 tests: 1446 passed, 0 failed, 0 skipped** (89.25s). Log: `workflow/stages/03_review/output/logs/T783-unit.log`.
- `npx playwright test tests/debts.spec.ts tests/debts-page.spec.ts --project=chromium`: **2 files, 4 tests: 4 passed, 0 failed, 0 skipped** (19.3s). Log: `workflow/stages/03_review/output/logs/T783-playwright-chromium.log`.
- `npx playwright test tests/debts.spec.ts tests/debts-page.spec.ts`: **2 files, 12 tests (chromium, firefox, webkit): 12 passed, 0 failed, 0 skipped** (43.8s). Log: `workflow/stages/03_review/output/logs/T783-playwright-all.log`.

### 5. Not verified
- None.

### 6. Blocking
- None.

### 7. Non-blocking
- `src/components/debt/DebtCard.tsx:54` computes per-card `const repaid = Math.max(0, debt.totalAmount - remaining);` without `roundToCents` before passing `repaid` to `<Money value={repaid} />` (which formats to 2 decimals via `formatCurrencyAmount`). Out of scope for T783 (`task-T783-spec.md:134`).

### 8. Rule candidates
- None.
