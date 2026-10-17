# T763 review: the daily spending series (Dashboard redesign SEL-2)

## Round 1

### Metadata

- Task: T763, Phase 134, branch `phase-134-dashboard-selectors` (on top of T762's `e6fb160`)
- Date: 2026-10-17
- Round: 1
- Verdict: APPROVED
- Target files: `src/selectors/diary.ts`, `unit/selectors-dashboard.test.ts`, `docs/design/dashboard-2026-10/spec.md` (bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T763-build.md`)

### Summary

`dailySpendingSeries(txs, range, today, categories?)` (`src/selectors/diary.ts:53-66`) returns one `{ date, spending }` point per local day from the range's start through `today`, oldest first and zero-filled, each from `daySpending` over the `filterByRange` rows: 8 for WEEK, 31 for MONTH, `null` for DAY and ALL. The code, imports (`:4-5`) and `SpendingPoint` type (`:39-44`) match spec 7.1 exactly. `spec.md:69` changed to 7.2's new line, and nine tests (`unit/selectors-dashboard.test.ts:247-385`) cover spec groups 1 to 7, including the owner's future-dated case.

### Invariants and parity

- Parity map: no row touched (reuses `daySpending`, `filterByRange`, `rangeBounds`; no ledger arithmetic). Confirmed.
- L1: each point is `daySpending(...).spending`, so `isSpending` and per-day `roundToCents` apply. Test 4 excludes income, transfer, repayment, a movement-category expense, adjustment and a deleted row, and gets exactly `0.3` from `0.1 + 0.2`. Holds.
- L2 and the owner's 8-point WEEK: the loop starts at `rangeBounds(range, today).start` (today - 7 or today - 30) and ends at `today`. Tests 1, 2 and 7 check 8 and 31 points and their first and last dates. Holds.
- Matches the card: test 6 shows the series sums to `leftOverFor(...).spending` for WEEK and MONTH. Holds.
- Owner decision, series ends at today: the future-dated test (`:328-345`) checks no point for tomorrow, lengths 8 and 31, and series sum close to `leftOverFor(...).spending - 30`. Since the series sum is the in-range total (test 6), that equality also proves the card counts the row. Holds; see Non-blocking for an explicit check.
- `today` is an argument; dates are stepped with `shiftIsoDate` and compared as ISO strings (`date <= today`). Holds.
- Time zones: the new block asserts the zone took effect (`getTimezoneOffset` 0 in UTC, -420 in Bangkok) before checking 2026-10-10 to 2026-10-17, 2026-09-17, and the 2026-12-27 to 2027-01-03 crossing. Holds in both.
- No import cycle: `diary.ts` imports `ledger.ts`, `timeRange.ts`, `utils/date`; none imports `diary.ts`. `daySpending`, `moodSpendingDays`, `diaryMonth` unchanged in the diff. Holds.
- `spec.md`: one line changed, exactly 7.2's new text; section 5.1 and 5.3 untouched. Holds.

### Gates run

- `git check-ignore -v` on all three targets: exit 1, none ignored.
- Scope: `git diff --stat`: 4 files, 174 insertions, 3 deletions (`task-ledger.md` +1, `spec.md` 1/1, `diary.ts` +31/-1, `selectors-dashboard.test.ts` +141/-1). `git status --porcelain`: those 4 plus the untracked T763 spec and build report. No unannounced file.
- `npm run lint`: exit 0. Log: `workflow/stages/03_review/output/logs/T763-lint.log`.
- `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/diary-page.test.tsx unit/selectors-debts.test.ts`: 4 files passed, 91 tests passed, 0 failed, 0 skipped.
- `npm run test:unit`: 62 files passed, 1395 tests passed, 0 failed, 0 skipped (50.4s). Log: `workflow/stages/03_review/output/logs/T763-unit.log`.
- Red check (step 6): stashed `src/selectors/diary.ts`, ran `npx vitest run unit/selectors-dashboard.test.ts -t dailySpendingSeries`: 9 failed, 23 skipped, every failure `TypeError: dailySpendingSeries is not a function`. `git stash pop`; `git status --porcelain` identical before and after.
- `git diff --numstat docs/design/dashboard-2026-10/spec.md`: `1	1`.
- Playwright: no affected spec. `dailySpendingSeries` has no caller in `src/`, and the existing diary selectors are unchanged.
- `git ls-files --eol`: `diary.ts`, `selectors-dashboard.test.ts`, `spec.md`, `task-ledger.md` all `i/lf w/crlf`.
- Em dashes (Node count): 0 in all four touched files and the build report.

### Not verified

- The sparkline on the page: nothing draws it until UI-1 (Phase 135).
- `npm run test:unit:shuffle`: not a gate for this tier. Both zone blocks restore `Asia/Bangkok` in their own `afterAll`.

### Blocking

None.

### Non-blocking

- `unit/selectors-dashboard.test.ts:328-345`: the future-dated test proves the card counts the row only through the sum equality. An explicit `expect(flow.spending).toBeCloseTo(<test 6's figure for this range> + 30, 10)` would state the owner's first condition in plain words. The logic is already caught, so this is optional.
- Tests 1 and 3 repeat the same three rows; a shared `const` would save a few lines.

### Rule candidates

- None new. T762's candidate (a mid-file `TZ` switch works only in the `forks` pool) now covers two zone blocks, both in `selectors-dashboard.test.ts`; the new one carries the offset guard. Still one file, so not yet promoted.
