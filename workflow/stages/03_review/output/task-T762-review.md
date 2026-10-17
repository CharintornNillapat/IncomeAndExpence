# T762 review: the Left over selector (Dashboard redesign SEL-1)

## Round 1

### Metadata

- Task: T762, Phase 134, branch `phase-134-dashboard-selectors`
- Date: 2026-10-17
- Round: 1
- Verdict: APPROVED
- Target files: `src/selectors/ledger.ts`, `unit/selectors-dashboard.test.ts` (bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T762-build.md`)

### Summary

`leftOverFor(txs, range, today, neededThisMonth, categories?)` (`src/selectors/ledger.ts:98-115`) filters by the L2 range, reuses `cashFlow`, and adds `keptPercent`, `spentShare`, `keptShare` and a MONTH-only `afterDebtDue` rounded with `roundToCents`. The code matches spec section 7 line for line, including the import (`:3`) and the `LeftOver extends CashFlow` type (`:82-92`). Eight new tests in `unit/selectors-dashboard.test.ts:120-245` cover spec groups 1 to 7, and the ledger gains a Phase 134 section with the T762 row.

### Invariants and parity

- Parity map: no row touched (no ledger arithmetic; `cashFlow` and `filterByRange` reused). Confirmed.
- L1: income and spending come only from `cashFlow`, so `isIncome`/`isSpending` apply; test 1 excludes transfer, repayment, adjustment and deleted rows. Holds.
- L2: range comes from `filterByRange`; no bounds re-derived. Test 2 checks DAY 10, WEEK 20, MONTH 40, ALL 50. Holds.
- Rounding: `afterDebtDue` is rounded with `roundToCents` (`:112`); test 3 proves `0.3 - 0.1` gives exactly `0.2`. No inline `Math.round`. Holds.
- `today` is an argument; no clock read in the selector. Holds.
- `cashFlow`, `CashFlow` and `spentPercent` unchanged (diff shows additions only after `:79`). Holds.
- No `NaN`/`Infinity`: `spentShare` division only when `income > 0`; test 6 checks `Number.isFinite` on the empty result. Holds.
- Bar shares: with `income > 0` and `leftOver > 0`, `spending / income` is below 100 and at least 0, so no clamp is needed; `leftOver <= 0` with spending gives 100/0; neither gives 0/0. Holds.
- **Owner check (test group 6):** spending with no income asserts `keptPercent` null (`unit/selectors-dashboard.test.ts:198`), `spentShare` 100 (`:199`) and `keptShare` 0 (`:200`). All three present. Passes.
- Time zones: test 7 switches `process.env.TZ` per zone in nested hooks and restores Bangkok. I checked that the switch takes effect: Vitest 5.0.1 runs forked processes, and a forked Node 24 process reports offset 0 after `TZ=UTC` and -420 after `TZ=Asia/Bangkok`. A worker thread ignores the switch (-420 both times), so this test would silently test one zone only if the pool were ever changed to `threads`. See Non-blocking.
- Nothing exported only for a test: `leftOverFor` and `LeftOver` are for UI-1. Holds.

### Gates run

- `git check-ignore -v` on both targets: exit 1, neither ignored.
- Scope: `git diff --stat`: 3 files, 171 insertions, 1 deletion (`task-ledger.md` +8, `ledger.ts` +35, `selectors-dashboard.test.ts` +129/-1). `git status --porcelain`: those 3 plus the untracked T762 spec and build report. No unannounced file.
- `npm run lint`: exit 0 (node-globals, safe-ids 132 files clean, `tsc --noEmit`, `tsc -p api/tsconfig.json`). Log: `workflow/stages/03_review/output/logs/T762-lint.log`.
- `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts`: 3 files passed, 65 tests passed, 0 failed, 0 skipped.
- `npm run test:unit`: 62 files passed, 1386 tests passed, 0 failed, 0 skipped (48.0s). Log: `workflow/stages/03_review/output/logs/T762-unit.log`.
- Red check (step 6): stashed `src/selectors/ledger.ts`, ran `npx vitest run unit/selectors-dashboard.test.ts -t leftOverFor`: 8 failed, 15 skipped, every failure `TypeError: leftOverFor is not a function`. `git stash pop`; `git status --porcelain` identical before and after.
- Playwright: no affected spec. `leftOverFor` has no caller in `src/` yet, so no spec can see it (spec gate 5).
- `git ls-files --eol`: `ledger.ts`, `selectors-dashboard.test.ts`, `task-ledger.md` all `i/lf w/crlf`.
- Em dashes (Node count): 0 in `ledger.ts`, `selectors-dashboard.test.ts`, `task-ledger.md`, `task-T762-build.md`.

### Not verified

- The selector in the rendered page: nothing calls it until UI-1 (Phase 135).
- The shuffle run (`npm run test:unit:shuffle`): not a gate for this tier. The zone describe restores `Asia/Bangkok` in its own `afterAll`, so order should not matter.

### Blocking

None.

### Non-blocking

- `unit/selectors-dashboard.test.ts:220-244`: the zone tests rely on Vitest's default `forks` pool; under `pool: 'threads'` the `TZ` switch is a no-op and the UTC case would quietly run in the machine's zone. A one-line guard inside the UTC block (`expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(0)`) would make that visible. Skip unless the pool changes.
- Build report says "7 groups" in one place and "8 tests" in another; both are right (group 7 is two tests), just worth saying once.

### Rule candidates

- `docs/contexts/client-state.md`, "Unit tests for this layer": a test that switches `process.env.TZ` mid-file works only in the `forks` pool (a worker thread ignores it). Promote when a second file switches zones mid-file; today only this one does.
