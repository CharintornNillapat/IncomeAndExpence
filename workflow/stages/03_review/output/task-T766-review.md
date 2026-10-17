# T766 review: Dashboard redesign UI-2, row 2

## Round 1

### 1. Metadata

- **Task:** T766, Phase 135 (`phase-135-dashboard-ui`; base `3f7b3e8`, T765)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:**
  - `src/components/dashboard/CategorySpendingCard.tsx`
  - `src/components/dashboard/DebtPayoffCard.tsx`
  - `src/views/DashboardView.tsx`
  - `unit/dashboard.test.tsx`
  - `tests/dashboard.spec.ts`
  - `DESIGN.md`
  - `docs/audit/test-selector-contract.md`
  - Bookkeeping: `docs/audit/task-ledger.md`
- `git check-ignore -v` on every target: none ignored (exit 1).

### 2. Summary

**`CategorySpendingCard`** is now a named region with:
- a Details link;
- an inline SVG donut with the total in its centre;
- the top five rows, plus one grey "N more categories" row with a percent and no amount;
- the month-to-date line, which always shows, with a signed pill when last month had spending.

**`DebtPayoffCard`** is a named region with:
- "N% paid off" and "paid of total";
- a neutral "Needed this month" box;
- the surplus warning, moved in from the page.

The per-debt rows are word for word as before. `DashboardView` computes `monthToDate` once, drops the standalone banner, and moves row 2 to `lg`.

### 3. Invariants and parity

- **Parity map:** no row touched. No selector or ledger code changed.
- **D5, figures computed once:**
  - `monthToDate` is computed in `DashboardView.tsx:100`.
  - The card adds up no money. The rest row has no amount (`CategorySpendingCard.tsx:166`), and the month line states both months' figures instead of their difference (`:177-186`).
  - Percents and donut offsets are computed in the card, which is display, as the spec allows.
- **Acceptance check 1 (one Spending figure):** holds. The category card gets `leftOver.spending` (`DashboardView.tsx:186`), and the moved assertion finds it in the donut centre.
- **Kept assertions:**
  - `/^100\.0% · no due date$/`, `/due Jan 1, 2027/`, the two `/ month needed` texts, `/^Overdue/` and the two `listitem`s all pass unchanged.
  - The per-debt block is identical apart from indentation (`DebtPayoffCard.tsx` diff).
- **Colour and signs:**
  - The pill is signed (U+2212 or `+`). It is `expense` only when spending rose, and the neutral chip pair otherwise.
  - The left over is signed and `text-expense` when negative.
  - The category colour is only the dot in a neutral tile.
  - No raw hex and no `text-[Npx]` (gate 10).
- **The warning lives once, in the card:** `dashboard-debt-warning` has count 1 (Playwright test 5). `DebtWarningBanner.tsx` is unchanged.
- **Ids:** `dashboard-all-debts-btn`, `dashboard-repay-btn` and `dashboard-debt-*` are kept. The new ids `dashboard-category-details-btn`, `dashboard-category-title` and `dashboard-debts-title` use the `dashboard-` prefix. Card titles stay `h2`.
- **Spec-edit policy:** row 1's Playwright assertions are unchanged; only the helpers moved to module scope. The added September seed row is outside every period a row 1 assertion reads.

### 4. Gates run

| # | Command | Result | Log |
|---|---|---|---|
| 0 | Ports 3000 and 3100 | No listener before the runs | |
| 1 | Red, by stash (stage 03 step 6) of the three `src/` files | `npx vitest run unit/dashboard.test.tsx`: 12 failed, 30 passed (42); the failures are acceptance check 1 plus the 11 new tests. `npx playwright test tests/dashboard.spec.ts --project=chromium`: 5 failed (all row 2), 5 passed (row 1). After `git stash pop`, status matched the snapshot; the stash list is empty | `workflow/stages/03_review/output/logs/T766-red-e2e.log` |
| 2 | `npm run lint` | Clean (node-globals and safe-ids 133 files, both `tsc`) | |
| 3 | `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx` | 4/4 files, 86/86 tests passed | |
| 4 | `npm run test:unit` | 62/62 files, 1426/1426 tests passed (78.85s) | `workflow/stages/03_review/output/logs/T766-unit.log` |
| 5 | Six specs with `--project=chromium` | 21/21 passed (44.4s) | `workflow/stages/03_review/output/logs/T766-e2e-chromium.log` |
| 6 | The same six specs on all three browsers | 61 passed, 2 skipped by design, 0 failed (1.5m) | `workflow/stages/03_review/output/logs/T766-e2e-all.log` |
| 7 | `node scripts/wcag-tokens.mjs` | All token pairs pass | |
| 8 | `git ls-files --eol` on the eight changed files | All `w/crlf` | |
| 9 | U+2014 in the added lines of each changed file | 0 for each | |
| 10 | `grep` for `text-[Npx]` and raw hex in the two cards | No match (exit 1) | |
| 11 | `git diff --stat`, `git status --porcelain` | Only the seven targets, `task-ledger.md` and the T766 stage outputs | |

### 5. Not verified

- **Visual check by eye** (donut, wrapping at `lg` and on a phone, both themes): scheduled after Phase 135 merges. The donut's `stroke-surface-2` track and the pill pairs are token pairs that `wcag-tokens.mjs` covers (`chip-text on adjust-bg`, `expense-text on expense-bg`). Category dot colours are data colours.
- **The full Playwright suite:** only the six affected specs were run, per the spec.

### 6. Blocking

None.

### 7. Non-blocking

1. `CategorySpendingCard.tsx:12`: the `total` doc comment still says `` `cashFlow().spending` ``. The figure now comes from `leftOverFor`'s spending (which wraps `cashFlow`), so the comment is half updated.
2. `CategorySpendingCard.tsx:26-38` and `:103-108`: `shown`, `rest`, `percentOf`, `restPercent` and `moreLabel` are computed twice, in `Donut` and in the card. Computing them once in the card and passing the segments to `Donut` would remove about 12 lines.
3. `CategorySpendingCard.tsx:58`: `allSegments.length === 1 ? '100 0'` is redundant. One segment's `p` is already 100, which gives `100 0`.
4. `DESIGN.md:199`: following the spec's wording, the new clause landed before "from `spendingByCategory` (L1)", so that source now reads as if it belonged to the rest row. "A donut and the top five (name, percent, amount) from `spendingByCategory` (L1); any further categories are..." reads cleanly. The spec's instruction caused this, not the builder.
5. `unit/dashboard.test.tsx`: in "has no NaN, Infinity or bare % across scenarios", scenarios 2 and 4 are identical (both empty rows with an empty `monthToDate`). The spec's list named test 6 and an all-empty case, which were the same thing.

### 8. Rule candidates

None new. T765's candidate (count em dashes in added lines only) was used as gate 9 here and worked as intended.

STATUS: T766 | APPROVED | workflow/stages/03_review/output/task-T766-review.md
