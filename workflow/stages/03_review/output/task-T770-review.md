# T770 review: current test counts in AGENTS.md and README.md, and T767 note 1 (test 9)

## Round 1

### 1. Metadata

- **Task:** T770, Phase 137 (`phase-137-small-fixes`; base `9ca857f`, T769)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `AGENTS.md`, `README.md`, `unit/dashboard.test.tsx`, `docs/audit/refactor-log.md`. Bookkeeping: `docs/audit/task-ledger.md`.
- `git check-ignore -v` on every target and the ledger: none ignored (exit 1).

### 2. Summary

`AGENTS.md:11` and `README.md:157` now say 1438 unit tests, matching the suite. Test 9 ("sits in a named region containing the View all button and activity items") now renders the card with an `onOpenTransaction` handler, so its rows get their `dashboard-tx-` ids. It asserts there are exactly 4 rows and that each is inside the region, so the loop now runs. The Phase 137 refactor-log entry and the ledger cover T770.

### 3. Invariants and parity

- **Parity map:** no row touched. No file under `src/` or `tests/` changed, and no id moved.
- **Test code:** `renderCard` (`unit/dashboard.test.tsx:480-494`) and test 9 (`:526-535`) match spec section 6 character for character. The other four tests in the describe still call `renderCard()` with no argument (`:496`, `:506`, `:512`, `:521`), so their render is unchanged. Passing `onOpenTransaction={undefined}` is valid, because `tsconfig.json` does not set `exactOptionalPropertyTypes`, and lint passes.
- **The 4 rows:** with the handler set, `ActivityFeed.tsx:74` gives ids to the expense, transfer, repayment and income rows. The folded adjustment pair is a `dashboard-adjustment-pair-` button, and its rows render only when opened (`:110`), so 4 is right.
- **Counts:** only `1432` changed to `1438` on each line. The Playwright figures on both lines and `README.md:158` are untouched, and they are current.
- **Refactor-log:** the header now reads `T769-T770` and keeps its `<sha>` placeholders. T770 text is appended to the brief, Changed and Verified. T769's text, Surprises and Deliberately not done are unchanged. Every T770 figure in it matches the build report and this review's runs.
- **Ledger:** the T770 row sits under Phase 137 with an empty Commit cell. The section title is unchanged, and no Backlog row changed.

### 4. Gates run

| # | Command | Result | Log |
|---|---|---|---|
| 0 | Ports 3000 and 3100 | No listener (no Playwright run is needed; `--list` starts no server) | |
| 1 | Red evidence (spec section 6; step 6's stash does not apply, since no non-test change) | The builder's log shows `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"`: 1 failed, 48 skipped; "expected to have a length of 4 but got +0", `- 4 + 0`, at `dashboard.test.tsx:531:18`. That is the spec's red reason | `workflow/stages/02_build/output/logs/T770-red.log` |
| 2 | `npm run lint` | Exit 0 (safe-ids 132 files, both `tsc`) | `logs/T770-lint.log` |
| 3 | `npx vitest run unit/dashboard.test.tsx` | 49/49 passed, the same count as before | |
| 4 | `npm run test:unit` | 62/62 files, 1438/1438 passed (48.88 s) | `logs/T770-unit.log` |
| 5 | Docs count check | Gate 4's 1438 tests and 62 files equal `AGENTS.md:11` and `README.md:157`. `npx playwright test --list`: "Total: 537 tests in 35 files", matching both lines. `git grep -n "1432" -- AGENTS.md README.md docs/contexts`: no match (exit 1) | |
| 6 | `git ls-files --eol` on the four targets and the ledger | All `w/crlf` | |
| 7 | U+2014 in added lines (Node, over the `+` lines of `git diff -U0`) | 13 added lines, 0 em dashes. Whole-file count 0 in every touched file and in the build report | |
| 8 | `git diff --stat`, `git status --porcelain` | 5 files, 13 insertions, 9 deletions: the four targets and `task-ledger.md`. Untracked: the T770 spec and build report only | |

### 5. Not verified

- **The red run** was not repeated by the reviewer. Doing it means editing the test, which stage 03 does not allow. The builder's log is the evidence, and it shows the expected failure.
- **The owner's extra check** (`items={[]}` failing and then restored) is taken from the build report. The final file has `items={foldAdjustmentPairs(ROWS)}` (`:484`), so the temporary edit was undone.

### 6. Blocking

None.

### 7. Non-blocking

None.

### 8. Rule candidates

1. **For `workflow/stages/01_spec/CONTEXT.md` section 6, or stage 03 step 6:** when a task only strengthens a test, the red step happens inside the test file: add the assertion first, record it failing, then complete the change. The reviewer checks the red log, because a stash has nothing to remove. T770 used this, and it worked.

STATUS: T770 | APPROVED | workflow/stages/03_review/output/task-T770-review.md
