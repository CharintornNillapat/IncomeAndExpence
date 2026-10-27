# Review: T814

## Round 2

### 1. Metadata
- Task: T814, branch `phase-149-transactions-views`
- Date: 2026-10-27
- Round: 2 (re-review after fix round 1)
- Verdict: APPROVED
- Target files: `docs/audit/test-selector-contract.md`, `tests/transactions-views.spec.ts` (two added assertions), `DESIGN.md`, `docs/audit/task-ledger.md` (unchanged this round).

### 2. Summary
Both round-1 blocking items are fixed. The `dashboard.spec.ts` contract line is back to HEAD (the diff has no `-`/`+` on it; the only per-spec line changes are the new `transactions-views.spec.ts` ids line and its text line). The new ids line now lists `#mobile-nav-tab-transactions` and `#view-loading-fallback`. The builder also took both non-blocking suggestions (test 5 asserts the drawer shows "E2E Bus", spec line 246; test 19 asserts `#tx-show-deleted` is unchecked after the reload, line 636).

### 3. Invariants and parity
- Spec-asserted DOM ids: by script, every `#id` literal in the spec is in the ids line, either verbatim or covered by its wildcard (`#tx-row-*`, `#tx-cal-day-*`, `#tx-menu-*-btn-*`, `#tx-select-row-*`, `#diary-day-tx-link-*`, `#diary-cal-day-*`); the 33 "misses" the script printed are all concrete instances of those wildcards. The two round-1 omissions are now present.
- `git diff --stat HEAD -- src unit supabase api AGENTS.md` empty. `git status --porcelain`: DESIGN.md, task-ledger, the contract, the new spec, and the T814 spec, build and review files only.
- Owner files: ADR 0109 `4b233a30...`, design spec `2711cad4...`, unchanged.
- CRLF: DESIGN.md and the contract `w/crlf`; 0 bare LF in DESIGN.md, the contract, the ledger, the spec and the build report. Em dashes: 0 in those files and 0 in `git diff -U0 HEAD`.
- Red run (round 1) still valid: the fix only added two passing assertions to tests 5 and 19; the three inverse-edit targets (tests 8, 19 focus, 22) are untouched.

### 4. Gates run (logs in `workflow/stages/03_review/output/logs/`)
- `npm run lint`: exit 0 (`T814-r2-lint.log`).
- `node scripts/wcag-tokens.mjs`: "All token pairs pass".
- `npx playwright test tests/transactions-views.spec.ts --project=chromium`: 26 passed, 0 failed, 0 skipped (29.8s) (`T814-r2-e2e-chromium.log`).
- `npx playwright test tests/transactions-views.spec.ts`: 78 passed, 0 failed, 0 skipped (2.0m) (`T814-r2-e2e-all.log`).
- `npx playwright test tests/transactions-views.spec.ts --project=webkit --repeat-each=3`: 78 passed (2.0m) (`T814-r2-e2e-webkit-x3.log`).
- Ports 3000/3100 clear before the run.

### 5. Not verified
- As in round 1: no pixel look at the select-all box; no full unit suite (no unit-tier path changed).

### 6. Blocking
None.

### 7. Non-blocking
- The "Fix round 1" section in `task-T814-build.md` is garbled (control characters from backslash escapes: "pm run lint", "ode scripts", "tests" with a tab, the owner hash prefixes mangled, and the counts "( passed", "8 passed" where 26/78 were meant). The real results are in my logs above; the builder's report text should not be quoted as is. Bookkeeping only.

### 8. Rule candidates
- None new (round 1's candidate stands).

## Round 1

### 1. Metadata
- Task: T814 (Phase 149 task 6, Playwright spec and DESIGN.md), branch `phase-149-transactions-views`
- Date: 2026-10-27
- Round: 1
- Verdict: CHANGES REQUESTED
- Target files: `tests/transactions-views.spec.ts` (new), `DESIGN.md`, `docs/audit/test-selector-contract.md`, plus bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all four: not ignored.

### 2. Summary
The new spec (26 tests, 814 lines, CRLF) is green on three browsers, and the three inverse edits fail exactly as the spec says. DESIGN.md's Transactions section, the heat token row and the contrast sentence match the code. One real defect: the builder's edit to the contract file also rewrote the `dashboard.spec.ts` line (see Blocking), so the contract now misstates which spec uses which id.

### 3. Invariants and parity
- Parity row "Spec-asserted DOM ids": every `#id`, `[id^=]`, `[id$=]` literal in the spec is somewhere in the contract file, but two are not in the new spec's own line (`#mobile-nav-tab-transactions`, `#view-loading-fallback`) and the first was put in the wrong spec's line. See Blocking.
- No `src/`, `unit/`, `supabase/`, `api/`, `AGENTS.md` change: `git diff --stat HEAD -- src unit supabase api AGENTS.md` empty. `git status --porcelain` lists only DESIGN.md, task-ledger, the contract, the new spec, and the T814 spec and build report.
- Owner files: `git hash-object` of ADR 0109 and the design spec gives `4b233a30...` and `2711cad4...`, equal to T813's.
- Line endings: DESIGN.md and the contract `w/crlf`; no bare LF in either, in the ledger, or in the new spec (814 CRLF, 0 bare LF).
- Em dashes: 0 in `git diff -U0 HEAD`, 0 in the spec, 0 in the build report. (The minus sign U+2212 in amounts is expected.)
- DESIGN.md facts checked against code: heat values equal `src/index.css:196-198` (light) and `:269-271` (dark); `scripts/wcag-tokens.mjs` has the `fg`/`expense-text`/`focus` pairs on each heat step and passes; sr-only "Actions" column and sticky blurred header (`TransactionsTable.tsx:44-46`, `:167-168`); 44px hit area with 16px drawn box (`SelectCheckbox.tsx`); bar on `brand-soft`, `role="status"` count, "Clear"/"Cancel", pinned `fixed` bar on the phone (`TxBulkBar.tsx`); row menu items and the danger tone on Delete (`TransactionsTable.tsx:268-302`); 7/12 and 5/12 split (`TransactionsView.tsx:823,835`); today's inset focus ring (`TxCalendar.tsx:70`); day panel strings (`TxDayPanel.tsx`). `:265` ("No trash button on a row") is gone; the diary chip line says "in the Table view only". All consistent.
- Spec follows the plan: all 26 tests present with the spec's titles. Test 9 sits in its own describe after test 15 in file order (spec order was after 8); harmless.

### 4. Gates run (all by me, logs in `workflow/stages/03_review/output/logs/`)
- `npm run lint`: exit 0 (`T814-lint.log`).
- `node scripts/wcag-tokens.mjs`: "All token pairs pass", heat steps included.
- Red run, spec 6.3, three inverse edits applied by hand then reverted by hand (`T814-red.log`): 3 failed.
  1. test 8, `#tx-cal-day-2026-10-10` `Expected pattern: /bg-heat-1/`, received class string containing `bg-heat-3`.
  2. test 19, `#tx-search-input` `Expected: focused`, `Received: inactive`.
  3. test 22, `#tx-select-all` `Expected: 1`, `Received: 0`.
  After the revert `git hash-object tests/transactions-views.spec.ts` = `bf3f05c51bdeb14e1fa3020f73d12e5309d0e899` both before and after, and `git status --porcelain` is identical to the one recorded before.
- `npx playwright test tests/transactions-views.spec.ts --project=chromium`: 26 passed, 0 failed, 0 skipped (27.4s) (`T814-e2e-chromium.log`).
- `npx playwright test tests/transactions-views.spec.ts` (three browsers): 78 passed, 0 failed, 0 skipped (2.0m) (`T814-e2e-all.log`).
- `npx playwright test tests/transactions-views.spec.ts --project=webkit --repeat-each=3`: 78 passed (1.8m) (`T814-e2e-webkit-x3.log`).
- `npx playwright test --list`: Total 639 tests in 37 files (213 tests, 37 specs, 639 runs); matches the build report. Ports 3000/3100 clear before the run.

### 5. Not verified
- A pixel look at the select-all box against the row boxes (spec section 10 asks to note it if it looks off-centre): I did not open a browser to look; no layout assertion covers it.
- Full unit suite not run: no unit-tier path changed.
- DESIGN.md prose claims about the Add form opening "on that day" and the diary hand-off rest on the spec's passing tests 14 and 15, not on a separate code read.

### 6. Blocking
- `docs/audit/test-selector-contract.md:32` - the `dashboard.spec.ts` entry was rewritten from `#nav-tab-transactions` to `` `#mobile-nav-tab-transactions, #nav-tab-transactions` `` (one backtick span, two ids). `dashboard.spec.ts` uses no `mobile-nav-tab` id (grep count 0), so the contract now misattributes an id to another spec and the line no longer lists `#nav-tab-transactions` as its own id. This is an unannounced change to a neighbour spec's line - restore the line to `` `#nav-tab-transactions` `` exactly as at HEAD.
- `docs/audit/test-selector-contract.md:58` (the new `transactions-views.spec.ts` ids line) - missing `#mobile-nav-tab-transactions` (used by `gotoTransactions`, spec lines 95-98) and `#view-loading-fallback` (spec line 100); the spec section 7 says the line lists every id the finished spec uses. Add both to that line, in the alphabetical position used by the neighbours.

### 7. Non-blocking
- Test 5 skips the spec's check that the Edit drawer shows the row's title (`#tx-drawer` visible only). Cheap to add: `toContainText('E2E Bus')` on `#tx-drawer`.
- Test 19 ends with "reload, then both are gone" but never sets Show deleted off (the toggle resets on reload, so the assertion holds); a one-line `expect(page.locator('#tx-show-deleted')).not.toBeChecked()` would make that explicit.
- Build report section 3 lists four stop-rule adjustments; the first two (mobile nav helper, debounce) are real adaptations, and item 3/4 are described as adjustments but are the spec's own approach. Fine.
- Build report says "Obsolete 'no spec uses these yet' removed" and so on; checked and true.

### 8. Rule candidates
- A contract edit by search-and-replace on a shared id can hit several spec lines; AGENTS.md or `ui-and-e2e.md` could say "when you add an id to a spec's contract line, diff the file and confirm only that spec's line changed". Not promoted: no code enforces it.

### 9. Fix block
```
fix T814 (stage file: workflow/stages/02_build/CONTEXT.md)
Round 1 blocking items, both in docs/audit/test-selector-contract.md only (no spec or src change):
1. Line 32, the dashboard.spec.ts entry: restore `#nav-tab-transactions` exactly as at HEAD (undo the "#mobile-nav-tab-transactions, #nav-tab-transactions" rewrite). Confirm with git diff that the only changed per-spec lines are the new transactions-views.spec.ts line.
2. The transactions-views.spec.ts ids line: add `#mobile-nav-tab-transactions` and `#view-loading-fallback`.
Optional (non-blocking): test 5 asserts the drawer shows "E2E Bus"; test 19 asserts #tx-show-deleted is unchecked after the reload. If you touch the spec, rerun the chromium, three-browser and webkit x3 gates and keep CRLF.
Gates to rerun: re-check by script that every id literal in tests/transactions-views.spec.ts is in the transactions-views.spec.ts line of the contract; CRLF (no bare LF) on the contract; 0 em dashes in the added diff lines.
Append a "Fix round 1" section to workflow/stages/02_build/output/task-T814-build.md.
```
