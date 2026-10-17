# T770 spec: current test counts in AGENTS.md and README.md, and T767 note 1 (test 9)

Phase 137 (`phase-137-small-fixes`). Spec date 2026-10-17. No ADR: a doc count fix and a test that is made to check what it claims, with no rule or behaviour change.

## 1. Goal

Make the unit test count that `AGENTS.md` and `README.md` state match the suite (1438, not 1432). Make test 9 of the Recent activity block in `unit/dashboard.test.tsx`, which the T767 review's non-blocking note 1 flagged, check its rows instead of looping over none.

## 2. Target files

```
AGENTS.md
README.md
unit/dashboard.test.tsx
docs/audit/refactor-log.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

`docs/audit/baseline-metrics.md` is **not** a target: T770 adds no test and changes no bundle, so the Phase 137 figures T769 wrote (62 files, 1438 tests) stay true.

## 3. Context to read

None. The test change uses only the props shown in section 4, and the doc change is two numbers.

## 4. Current behaviour

**Counts**
- `AGENTS.md:11` says "Vitest in `unit/` (1432 tests, 62 files, ...)".
- `README.md:157` says "Vitest: 1432 tests in 62 files".
- The suite has 1438 tests in 62 files. Evidence: `npm run test:unit` on `9ca857f` printed "Test Files 62 passed (62)" and "Tests 1438 passed (1438)" (`workflow/stages/03_review/output/logs/T770-spec-unit-count.log`). The ledger's T769 Gate result also says 1438 (`docs/audit/task-ledger.md:126`). T768 added 4 tests and T769 added 2, and neither updated these two lines.
- The Playwright figures are current: `npx playwright test --list` prints "Total: 537 tests in 35 files", which matches `AGENTS.md:11` (179 tests, 35 specs, 537 runs) and `README.md:158`. They do not change.
- `git grep` for `1432` outside `docs/audit/` and `workflow/` finds only those two lines. `docs/contexts/ui-and-e2e.md:62` states Playwright figures only, and they are current.

**Test 9**
- In `unit/dashboard.test.tsx:470-533` (describe "Recent activity: L8 fold, L11 nets, and no placeholder labels"), the T767 review's "test 9" is the last test, "sits in a named region containing the View all button and activity items", at `:525-533`. The T767 review cited `:517-524`; T769's added tests moved it down 8 lines.
- `renderCard()` (`:480-492`) renders `RecentActivityCard` without `onOpenTransaction`.
- `RecentActivityCard` passes that prop through to `ActivityFeed` (`src/components/dashboard/RecentActivityCard.tsx:20`, `:64`). `ActivityFeed` gives a row an id only when the prop is set: `id={onOpenTransaction ? \`${idPrefix}-tx-${tx.id}\` : undefined}` (`src/components/transaction/ActivityFeed.tsx:74`).
- So in test 9, `container.querySelectorAll('[id^="dashboard-tx-"]')` returns an empty list, and the `for` loop at `:530-532` runs zero times. The test checks only the region and View all. It would still pass if every row were rendered outside the region, or if no rows were rendered at all.
- With the prop set, the `ROWS` fixture (`:471-478`) renders 4 rows with a `dashboard-tx-` id: the expense, the transfer, the repayment and the income. The two cancelling adjustments fold into one pair button (`ActivityFeed.tsx:96-109`, id `dashboard-adjustment-pair-...`, which does not match the prefix). Their rows only render when the pair is opened (`:110`), and test 9 does not open it.

## 5. Parity map

None. No row of `AGENTS.md`'s map is touched. No id changes, so `docs/audit/test-selector-contract.md` is unaffected.

## 6. Tests to add

No new test. Test 9 is strengthened in place, so the unit count stays 1438.

Make exactly these edits in `unit/dashboard.test.tsx`:

1. `renderCard` takes the handler as an optional parameter and passes it on. The other four tests call it with no argument, so their render does not change:

   ```tsx
   function renderCard(onOpenTransaction?: (txId: string) => void) {
     const nets = new Map(groupByDay(ROWS, CATEGORIES).map((day) => [day.date, day.net]));
     return render(
       <RecentActivityCard
         items={foldAdjustmentPairs(ROWS)}
         dayNets={nets}
         wallets={WALLETS}
         categories={CATEGORIES}
         today={TODAY}
         onViewAll={() => {}}
         onOpenTransaction={onOpenTransaction}
       />
     );
   }
   ```

2. Test 9 becomes (keep its title):

   ```tsx
   it('sits in a named region containing the View all button and activity items', () => {
     const { container } = renderCard(() => {});
     const region = screen.getByRole('region', { name: 'Recent activity' });
     expect(within(region).getByRole('button', { name: 'View all' })).toBeTruthy();
     const rows = container.querySelectorAll('[id^="dashboard-tx-"]');
     expect(rows).toHaveLength(4);
     for (const el of rows) {
       expect(region.contains(el)).toBe(true);
     }
   });
   ```

**Red first (stage 02 step 4).** There is no app change for a stash to remove, so the red step happens inside the test file, in this order:
1. Edit test 9 only: add the `rows` const and `expect(rows).toHaveLength(4)`, and loop over `rows`. Keep `renderCard()` with no argument, and leave `renderCard` unchanged.
2. Run `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"`. It must fail with an expected length of 4 and a received length of 0. That is the T767 note: without the handler there are no rows to check. Save the output to `workflow/stages/02_build/output/logs/T770-red.log`.
3. Make edit 1 and change the call to `renderCard(() => {})`. Rerun the same command: it passes.

**Review (stage 03 step 6).** The stash does not apply, because there is no non-test change. The reviewer checks the red log from step 2, and confirms from the diff that the final test matches the code above and that the other four tests in the describe still call `renderCard()` with no argument.

## 7. Gates

The union of the docs-only row (`AGENTS.md`, `README.md`, `refactor-log.md`) and the `unit/` row (`unit/dashboard.test.tsx`). The `unit/` row is a code tier, so the task also runs lint and the full unit suite. No Playwright spec is affected: no file under `src/` or `tests/` changes, and no id moves.

1. `npm run lint`: exit 0.
2. `npx vitest run unit/dashboard.test.tsx`: every test passes, the same count as before the change.
3. `npm run test:unit`, saved to `workflow/stages/02_build/output/logs/T770-unit.log`: 62 files, 1438 passed.
4. Docs count check:
   - Gate 3's totals equal the new figures on `AGENTS.md:11` and `README.md:157` (1438 tests, 62 files).
   - `npx playwright test --list` ends "Total: 537 tests in 35 files", which still matches the Playwright figures on both lines.
   - `git grep -n "1432" -- AGENTS.md README.md docs/contexts` finds nothing (exit 1).
5. `git ls-files --eol AGENTS.md README.md unit/dashboard.test.tsx docs/audit/refactor-log.md docs/audit/task-ledger.md`: all `w/crlf`, as now.
6. 0 U+2014 in the added lines of every changed file: a Node count of U+2014 over the `+` lines of `git diff -U0`.
7. `git diff --stat` and `git status --porcelain`: only the four targets, `docs/audit/task-ledger.md` and the T770 stage outputs.

## 8. Production touch points

None. Nothing on the Stop and ask first list is needed. Under the ICM pause rule, the orchestrator pauses after this spec because `AGENTS.md` is a target.

## 9. Out of scope

- **Counts:** on `AGENTS.md:11`, change only `1432` to `1438`. On `README.md:157`, change only `1432` to `1438`. Leave every other number, `README.md:158`, `docs/contexts/ui-and-e2e.md:62` (current) and the rest of both files as they are.
- **Ledger and metrics history:** leave the historical figures in `docs/audit/baseline-metrics.md`, `refactor-log.md`'s earlier entries and the ledger's earlier rows alone.
- **Tests:** change no test in `unit/dashboard.test.tsx` other than `renderCard` and test 9 as written in section 6. Do not pass the handler in the other four Recent activity tests, and do not rename test 9.
- **T767's other notes:** note 2 (that build report's wording) and note 3 (the metrics file-count line) are not part of T770.
- **App code:** no file under `src/` changes. `ActivityFeed.tsx` and `RecentActivityCard.tsx` behave as intended.
- **Backlog:** T770 comes from a review note, not a Backlog row, so no Backlog Status changes.

## Bookkeeping and the phase entry

- **Ledger:** add the T770 row under the existing `## Phase 137` section of `docs/audit/task-ledger.md`, below T769. Files: the four targets. Leave `Commit` empty. Leave the section title as it is.
- **`docs/audit/refactor-log.md`:** T770 joins the Phase 137 entry (`:22-31`) and does not add a new one.
  - Change the header's `Small fixes: T769` to `Small fixes: T769-T770` and change nothing else in the header.
  - Append one sentence to the brief naming T770: the unit count on `AGENTS.md` and `README.md` brought to 1438, and the T767 review's test 9 made to count its 4 rows.
  - Append T770's files to **Changed**, and its gate results from this section 7 to **Verified**.
  - Add to **Surprises** only what the build turns up, or nothing.
  - Leave T769's text unchanged.
