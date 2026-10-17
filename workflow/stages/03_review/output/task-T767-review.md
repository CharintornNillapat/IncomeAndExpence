# T767 review: Dashboard redesign UI-3, row 3, and the Phase 135 paperwork

## Round 2

### 1. Metadata

- **Task:** T767, Phase 135 (`phase-135-dashboard-ui`; base `662c528`)
- **Date:** 2026-10-17
- **Round:** 2 (fix round 1)
- **Verdict:** APPROVED
- **Target files:** as round 1. The fix touched `docs/audit/refactor-log.md` only, plus the build report.

### 2. Summary

The Phase 135 `refactor-log.md` entry was rewritten as the round 1 fix block asked:
- the header carries `<sha>` placeholders;
- the brief describes each task correctly;
- the Changed lists match `git show --stat` for `3f7b3e8` and `662c528` and the T767 working tree;
- the T765 and T766 Verified lines are the ledger's Gate result cells, word for word;
- the Surprises are the three sourced items.

### 3. Invariants and parity

- **Scope of the fix:** of the 18 changed files, only `docs/audit/refactor-log.md` is newer than the round 1 review file. The code, tests and other docs are as reviewed and gated in round 1.
- **Paths:** every path cited in the entry is tracked (`git ls-files --error-unmatch`), except `src/components/dashboard/NetWorthCard.tsx`. The entry marks that one "(deleted)", and `git log -1 -- <path>` finds it.
- **Ledger copy:** the T765 and T766 Verified lines equal their ledger cells exactly (a scripted `grep -F` match).
- **Parity map:** no row touched.

### 4. Gates run

| # | Command | Result |
|---|---|---|
| 1 | Path check on every `.tsx`, `.ts` and `.md` path in the entry | All tracked; `NetWorthCard.tsx` is deleted and found in history |
| 2 | `git ls-files --eol docs/audit/refactor-log.md docs/audit/task-ledger.md` | Both `w/crlf` |
| 3 | U+2014 in the added lines of both files | 0 and 0 |
| 4 | `git status --porcelain` | Same as round 1, plus this review file (untracked stage output) |

The fix is docs-only, so round 1's code gates stand: lint, unit 1432/1432, twelve specs 71/71 on Chromium and 207 passed with 6 skipped on three browsers, the full suite, the build, wcag, line endings and em dashes.

### 5. Not verified

- **The visual check by eye** is the owner's, after merge.
- **The round 1 non-blocking notes** were not taken: test 9's row loop still checks nothing, and the build report's description is still inaccurate. Neither was required.

### 6. Blocking

None.

### 7. Non-blocking

Round 1's notes 1 to 3 still apply. Note 1, test 9, would be a one-line change in a later task.

### 8. Rule candidates

Round 1's two candidates stand: build refactor-log entries from `git show --stat` and the ledger, and the stash rules for a staged deletion and an LF file.

## Round 1

### 1. Metadata

- **Task:** T767, Phase 135 (`phase-135-dashboard-ui`; base `662c528`, T766)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** CHANGES REQUESTED
- **Target files:**
  - `src/components/dashboard/WalletsSection.tsx`, `NetWorthCard.tsx` (deleted, staged), `MoodSpendingCard.tsx`, `RecentActivityCard.tsx` and `CategorySpendingCard.tsx`
  - `src/views/DashboardView.tsx`, `src/components/ViewLoadingFallback.tsx` and `src/components/ui/AllocationBar.tsx`
  - `unit/dashboard.test.tsx` and `tests/dashboard.spec.ts`
  - `DESIGN.md`, `docs/design/dashboard-2026-10/spec.md` and `docs/audit/test-selector-contract.md`
  - `AGENTS.md`, `docs/contexts/ui-and-e2e.md` and `README.md`
  - `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`
  - Bookkeeping: `docs/audit/task-ledger.md`
- `git check-ignore -v` on every target: none ignored (exit 1).

### 2. Summary

Row 3 now matches the spec:
- **Recent activity** is a named region, 7/12 from `lg`.
- **Net worth and wallets** (`WalletsSection`) is one card: net worth with its caption and THB, then a Wallets h3 with Transfer, the share bar, plain wallet rows, and Add wallet and Manage wallets.
- **Mood and spending** shows a strip of the selector's days, oldest on the left (decision A), with Log today in the header.

`NetWorthCard.tsx` is deleted. The T766 notes, the loading outline, the `AllocationBar` comment, `DESIGN.md`, the counts and the metrics are all done as specified.

The code, tests, counts and metrics are correct. The one problem is the new `refactor-log.md` entry, which records false facts about T765 and T766 (section 6).

### 3. Invariants and parity

- **Parity map:** no row touched. No selector, ledger or `api/` code changed.
- **D5, figures computed once:** `DashboardView.tsx` passes `wealth.netWorth`, `walletTotal` and `debtRemaining` (all computed at `:108-116`) to `WalletsSection`. No card computes money. The mood strip only reverses the selector's array, a copy (`MoodSpendingCard.tsx:47`).
- **Decision A:** `moodSpendingDays` and `MOOD_DAYS_SHOWN` are unchanged. No placeholder days. The strip follows the period (Playwright "The strip follows the period").
- **Ids and kept assertions:**
  - `net-worth-card`, the three `hero-*` ids and `dashboard-wallet-card-*` are kept, and the specs that drive them pass on three browsers.
  - Acceptance check 3's assertions are word for word. Only the component and its props moved.
  - The Mood and Wallets assertions are unchanged.
  - New ids use the `dashboard-` prefix. Card titles are h2; "Wallets" is an h3 inside the card.
  - `theme.spec.ts:53`'s "Wallets" heading is on the Wallets page, where the Dashboard is not mounted.
- **Colour and signs:** the debt in the caption is signed and `expense` only when owed. The net worth figure is `fg`, or `expense` when negative. `fg-muted` and `expense-text` on `surface-2` (the mood tiles) pass in both themes: 5.17 and 6.03, and 5.74 and 6.72 (`wcag-tokens.mjs`).
- **44 px:** wallet rows `min-h-[44px]`; Log today is `ui/Button` (44 px base); links are `DashboardLink`.
- **T766 notes:** all five done. The `Donut` takes `segments`; the dash array has no lone-segment branch (one segment still gives `100 0`, test passes); `DESIGN.md:199` reads cleanly; scenario 4 removed.
- **Insights last:** unchanged `section`, still last (Playwright `compareDocumentPosition` check).

### 4. Gates run

| # | Command | Result | Log |
|---|---|---|---|
| 0 | Ports 3000 and 3100 | No listener before the runs | |
| 1 | Red, by stash (step 6) of `src/components/dashboard/` and `src/views/DashboardView.tsx` (see section 5) | `npx vitest run unit/dashboard.test.tsx`: 8 failed, 40 passed (48). The 8 are acceptance check 3 (2), test 9, the two net worth tests and the three mood tests. `npx playwright test tests/dashboard.spec.ts --project=chromium`: 4 failed (row 3 Past 30 days, strip follows period, New account, Phone width), 11 passed. Row 3 Links passes on the old code because those ids already existed. After `git stash pop --index`, `git status --porcelain` is identical to the snapshot and the stash list is empty | `logs/T767-red-e2e.log` |
| 2 | `npm run lint` | Exit 0 (node-globals and safe-ids 132 files, both `tsc`) | `logs/T767-lint.log` |
| 3 | `npx vitest run unit/dashboard.test.tsx unit/transactions-page.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx` | 5/5 files, 116/116 passed | |
| 4 | `npm run test:unit` | 62/62 files, 1432/1432 passed (41.74 s) | `logs/T767-unit.log` |
| 5 | The twelve specs with `--project=chromium` | 71/71 passed (37.5 s) | `logs/T767-e2e-chromium.log` |
| 6 | The twelve specs, all three browsers | 207 passed, 6 skipped by design, 0 failed (3.0 m) | `logs/T767-e2e-all.log` |
| 7 | `npm test` (full suite) | 537 runs: 530 passed, 6 skipped, 1 failed (10.4 m). The failure is WebKit `csv-classify.spec.ts:309`: `#commit-import-btn` waited 15 s for "stable". That is the documented WebKit-on-Windows paint stall (ADR 0058, `ui-and-e2e.md`), in a spec this task does not touch. Rerun alone, `csv-classify.spec.ts --project=webkit`: 11/11 passed. The builder's run had 531 passed | `logs/T767-e2e-full.log`, `logs/T767-csv-webkit-rerun.log` |
| 7b | `npx playwright test --list` | 537 tests in 35 files (179 per browser), matching `AGENTS.md`, `ui-and-e2e.md` and `README.md` | |
| 8 | `npm run clean`, then `npm run build` | Clean. Entry `index-wgYjfCND.js` 193,252 / 56,336 B gzip. CSS `index-z3bqoA9P.css` 52,884 / 10,209 B. All app JS 884,332 / 268,499 B in 39 files. Every figure equals `baseline-metrics.md`'s new section | `logs/T767-build.log` |
| 9 | `node scripts/wcag-tokens.mjs` | All token pairs pass | |
| 10 | `git ls-files --eol` on the changed files | `ViewLoadingFallback.tsx` `w/lf`, all others `w/crlf`, as before | |
| 11 | U+2014 in added lines | 0 for each of the 18 changed files | |
| 12 | `grep` for `text-[Npx]` and raw hex in the four cards | No match (exit 1) | |
| 13 | `git grep -n "NetWorthCard" -- src unit tests DESIGN.md AGENTS.md docs/contexts` | No match (exit 1) | |
| 14 | Docs check (counts, refactor-log paths) | Counts match. **The refactor-log entry fails**: see section 6 | |
| 15 | `git diff --stat`, `git status --porcelain` | Only the targets (`NetWorthCard.tsx` staged as deleted), `task-ledger.md` and the T767 stage outputs | |

### 5. Not verified

- **The visual check by eye** (both themes, 1280 px and phone width) is the owner's, after the merge. The phone-width Playwright test checks the stacking and the absence of horizontal scroll only.
- **Stash scope:** `ViewLoadingFallback.tsx` and `AllocationBar.tsx` were left out of step 6's stash.
  - `ViewLoadingFallback.tsx` is LF under `core.autocrlf`, so a stash round-trip would have rewritten it to CRLF.
  - `AllocationBar.tsx` is a comment-only change.
  - No new test depends on either.
- **The stash path:** `git stash push -- src/components/dashboard/NetWorthCard.tsx` fails, because a staged deletion matches no path, so the folder was stashed instead.

### 6. Blocking

1. `docs/audit/refactor-log.md:22-41` records false facts. Gate 14 requires every cited path to exist, and the entry is the permanent record. Rewrite the entry from the commits and the ledger, as in the fix block:
   - **Changed, T765:** lists `DashboardHero.tsx`, `SpendingSummaryCard.tsx` and `QuickActions.tsx`, which have never existed in the repo (`git log --all` finds none). It omits `CashFlowCard.tsx`, which T765 rewrote (`git show --stat 3f7b3e8`).
   - **Changed and brief, T766:** say `CashFlowCard.tsx` was "deleted via `git rm`". It exists and is rendered at `DashboardView.tsx:161-162`. T766 never touched it (`git show --stat 662c528`).
   - **The brief, T765:** credits T765 with an "MTD change". The month line is T766's.
   - **Verified:** the T765 and T766 figures (1413 and 1422 unit tests, "Playwright 5 specs on Chromium (32 passed)", "production build clean") contradict the ledger's gate cells: 1415 and 1426; e2e 20/20 and 21/21 on Chromium, and 58 and 61 passed with 2 skipped on three browsers; no build.
   - **Surprises:** says `renderCard()` "needed `onOpenTransaction`". The test does not pass it (`unit/dashboard.test.tsx:459-468`). The other three items are not surprises.
   - **The header:** reads "code `3f7b3e8`, `662c528`, and T767" in place of the spec's `code \`<sha>\`, merged \`<sha>\``. The deploy record fills the shas, as for Phase 134.

### 7. Non-blocking

1. `unit/dashboard.test.tsx:517-524` (test 9) cannot fail on its row check:
   - `ActivityFeed` gives a row an id only when `onOpenTransaction` is passed (`ActivityFeed.tsx:74`), and `renderCard()` does not pass it.
   - So `querySelectorAll('[id^="dashboard-tx-"]')` is empty and the loop runs zero times.
   - The region and View all checks are real, and Playwright row 3 test 1 counts the 4 rows.
   - The spec's wording allowed this. Passing `onOpenTransaction={() => {}}` in that render, or asserting the count is above 0, would make it bite.
2. The build report misdescribes the code in places (the code follows the spec):
   - It names an `onSelectWallet` prop. It is `onOpenWallet`.
   - It says the section is `aria-labelledby="dashboard-wallets-heading"`. It is `aria-label="Net worth and wallets"`.
   - It says `DESIGN.md:80` changed "tracking". The label changed.
   - It says the mood hint shows "when `mood.days.length === 0`". It shows below five logged days, as before.
   - It says the seed "seeds 2 wallets". The helper takes optional wallets, and the tests pass `SAMPLE_WALLETS` (3).
3. The full run's file count fell from 40 to 39 JS files. That is expected with `NetWorthCard` gone from the view's graph, but the metrics line could say why.

### 8. Rule candidates

1. **For `workflow/stages/02_build/CONTEXT.md`:** build a phase's `refactor-log.md` entry from the commits and the ledger, never from memory.
   - **Changed:** each task's `git show --stat <sha>`.
   - **Verified:** each task's ledger Gate result cell, copied.
   - **Surprises:** only items a review or build report names.
2. **For `workflow/stages/03_review/CONTEXT.md` step 6:**
   - Stash a staged deletion through its folder's path, and restore with `git stash pop --index` so the deletion stays staged.
   - Leave an LF file out of the stash under `core.autocrlf`, because the pop rewrites it to CRLF.

### 9. Fix block

```
fix T767 (stage file: workflow/stages/02_build/CONTEXT.md)

Blocking 1: rewrite the Phase 135 entry in docs/audit/refactor-log.md (lines 22-41). Change no other file except docs/audit/task-ledger.md if its T767 gate cell needs the fix noted.

- Header, exactly: ## Phase 135 - Dashboard UI: T765-T767 (2026-10-17, code `<sha>`, merged `<sha>`)
- Brief: ADR `0102`. The Dashboard body rebuilt to the 2026-10 owner spec: the page header and row 1, Left over with its sparkline beside the Income and Spending cards (T765); row 2, spending by category with the donut and the month-to-date line, and debt payoff with the surplus warning inside (T766); row 3, recent activity, net worth merged into the wallets card, the mood strip (owner decision A), the insights card last, the T766 review notes and the phase paperwork (T767).
- Changed: build each task's list from `git show --stat 3f7b3e8` (T765), `git show --stat 662c528` (T766) and `git status --porcelain` (T767), leaving out workflow/stages files. T765 modified CashFlowCard.tsx and added LeftOverCard.tsx; nothing was deleted until T767's NetWorthCard.tsx. Name no file that the commands do not list.
- Verified: copy each task's Gate result cell from docs/audit/task-ledger.md for T765 and T766 word for word. For T767, keep your line but replace "0 references to NetWorthCard across repo" with "0 NetWorthCard references in src, unit, tests, DESIGN.md, AGENTS.md and docs/contexts".
- Surprises: only these, true and sourced: T765's em-dash gate counted the whole file, including a test that asserts no em dash, so that test's literal became an escape (T765 review note 1; later specs count added lines only); T766's spec placed DESIGN.md's rest-row clause before the data source (fixed in T767); the full-suite WebKit run can stall a click on Windows for 15 s (csv-classify, ADR 0058), which passed on rerun in T767's review.
- Deliberately not done: keep your four items.

Gates to rerun: for every path in the entry, `git ls-files --error-unmatch <path>` succeeds, or the entry marks it deleted and `git log --oneline -1 -- <path>` finds it; `git ls-files --eol docs/audit/refactor-log.md` shows w/crlf; 0 U+2014 in the added lines; `git status --porcelain` unchanged apart from refactor-log.md, task-ledger.md and the T767 build report.
```

STATUS: T767 | CHANGES REQUESTED | workflow/stages/03_review/output/task-T767-review.md
