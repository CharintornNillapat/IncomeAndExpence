# T765 review: Dashboard redesign UI-1, the page header and row 1

## Round 1

### 1. Metadata

- **Task:** T765, Phase 135 (`phase-135-dashboard-ui`, cut from `main` at `ce9983f`)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:**
  - `src/components/dashboard/LeftOverCard.tsx` (new)
  - `src/components/dashboard/CashFlowCard.tsx`
  - `src/views/DashboardView.tsx`
  - `unit/dashboard.test.tsx`
  - `tests/dashboard.spec.ts` (new)
  - `DESIGN.md`
  - `docs/audit/test-selector-contract.md`
  - Bookkeeping: `docs/audit/task-ledger.md`
- `git check-ignore -v` on every target: none ignored (exit 1).

### 2. Summary

Row 1 is now a brand-tinted `LeftOverCard`, next to two small `CashFlowCard`s (Income, Spending) that stack beside it from `lg`.
- The Left over card shows the figure, the kept line and, in MONTH only, after debt due. It also has the inline SVG sparkline (WEEK and MONTH) and the spent and kept bar.
- `DashboardView` computes `leftOverFor` and `dailySpendingSeries` once, with `plan` moved above them. `NetWorthCard` moves unchanged to a full-width row above the wallets until UI-3.
- The header needed no change.
- Amendment 1 is implemented as written: `No income this period`, no `<p>` with no rows, and no NaN, Infinity or bare `%`.

### 3. Invariants and parity

- **Parity map:** no row touched. No ledger arithmetic changed, and no selector file changed.
- **D5 (figures computed once in `DashboardView`):** holds. The card derives only the sparkline scale and its highest point, as the spec allows (`LeftOverCard.tsx:21-41`).
- **Acceptance check 1 (one Spending figure):** holds. `CategorySpendingCard` and the Spending card both read `leftOver.spending` (`DashboardView.tsx:186`, `:162`), and `leftOverFor` filters with the same `filterByRange` as `periodRows`.
- **Amounts:** every figure goes through `Money` or `formatCurrencyAmount`, with U+2212 for negatives. No raw hex and no `text-[Npx]` (gate 10).
- **Colour is never the only signal:** income keeps `+`, spending keeps `−`, and a negative left over is signed and `text-expense`.
- **Ids:** `metric-card-income`, `metric-card-expense`, `metric-card-net` and `net-worth-card` are kept. New ids start `dashboard-`, and no other page's prefix is used.
- **Headings:** one `h1` (header unchanged). Card titles are `h2`.
- **Charts:** the sparkline is `role="img"` with a label that states the figures, and nothing animates. The bar is `aria-hidden`, and the visible "Spent N%" / "Kept N%" is its text.
- **Layout:** one render path. One column on a phone, side by side from `sm`, 8/4 from `lg`. The phone test confirms no horizontal scroll at 390 px.
- **Amendment 1:**
  - `hasRows` gates the only `<p>` and the after-debt part (`LeftOverCard.tsx:74`, `:87`, `:115`).
  - The null-percent wording is exactly `No income this period` (`:79`).
  - Every `%` follows `Math.round` of a finite number (`:81`, `:83`, `:140-141`).
- **Spec-edit policy:** the moved unit assertions survive (locator moves). The one wording change is the owner's (`No income this period`). No assertion was deleted or weakened.

### 4. Gates run

| # | Command | Result | Log |
|---|---|---|---|
| 0 | Ports 3000 and 3100 | No listener before the runs | |
| 1 | Red, by stash (stage 03 step 6): `git stash push -u --` the three `src/` files | `npx vitest run unit/dashboard.test.tsx`: 1 file failed, `Failed to resolve import "../src/components/dashboard/LeftOverCard"`. `npx playwright test tests/dashboard.spec.ts --project=chromium`: 5 failed, each waiting for the `Left over` region. After `git stash pop`, `git status --porcelain` matched the pre-stash snapshot; the stash list is empty | `workflow/stages/03_review/output/logs/T765-red-e2e.log` |
| 2 | `npm run lint` | Clean: node-globals 133 files, safe-ids 133 files, both `tsc` runs | |
| 3 | `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx` | 4/4 files, 75/75 tests passed | |
| 4 | `npm run test:unit` | 62/62 files, 1415/1415 tests passed (53.44s) | `workflow/stages/03_review/output/logs/T765-unit.log` |
| 5 | The six specs with `--project=chromium` | 20/20 passed (21.0s) | `workflow/stages/03_review/output/logs/T765-e2e-chromium.log` |
| 6 | The same six specs on all three browsers | 58 passed, 2 skipped by design, 0 failed (1.3m) | `workflow/stages/03_review/output/logs/T765-e2e-all.log` |
| 7 | `node scripts/wcag-tokens.mjs` | All token pairs pass | |
| 8 | `git ls-files --eol` on the five existing files; Node count on the two new files | All `w/crlf`. `LeftOverCard.tsx` has 146 CRLF and 0 bare LF; `dashboard.spec.ts` has 145 CRLF and 0 bare LF | |
| 9 | Em dash count over the seven targets plus `task-ledger.md` | 0 in each | |
| 10 | `grep` for `text-[Npx]` and raw hex in the two card files | No match (exit 1) | |
| 11 | `git diff --stat`, `git status --porcelain` | Only the targets, `task-ledger.md` and the T765 stage outputs. Nothing unannounced except the unit-file line in Non-blocking 1 | |

### 5. Not verified

- **Visual check by eye** in both themes at 1280 px and 390 px. The owner spec schedules it after Phase 135 merges. The contrast of text on `brand-tint` rests on the scratch measurement in the spec, since `wcag-tokens.mjs` has no such pair.
- **The full Playwright suite (34 specs).** The spec's gates name six affected specs; every other spec also lands on the Dashboard, but none reads row 1 by id or text (contract grep).
- **A production build and bundle delta.** Not a gate for this task; UI-3 records it when it ships the phase.

### 6. Blocking

None.

### 7. Non-blocking

1. `unit/dashboard.test.tsx:402` swaps a literal U+2014 character for its JavaScript escape (backslash u2014) in acceptance check 4's `not.toContain`.
   - This is the same string, so the assertion is unchanged.
   - The build report does not mention it. It was needed because the spec's gate 9 counted every em dash in the file, including one that tests for the absence of an em dash. That gate was the spec's mistake, not the builder's.
2. `tests/dashboard.spec.ts:19`: `seedTestTransactions(page: any)` could be typed `Page` (import `type Page` from `@playwright/test`). It is not a lint error.
3. `unit/dashboard.test.tsx` `it.each(RANGES)('... for %s', ...)` prints `[object Object]` in the test name. `$range` would name the period.
4. `tests/dashboard.spec.ts:99-100`: `boundingBox()` does not wait for visibility. A `toBeVisible()` on both regions first would make the phone test more robust on a slow WebKit run. It passed on all three browsers here.

### 8. Rule candidates

- **Em dash gates count added lines, not whole files** (for example, count U+2014 only in the `+` lines of `git diff -U0 <file>`). Existing tests legitimately assert against an em dash, and a whole-file count forces an unrelated edit. This is for stage 01's Rules once a spec uses it.

STATUS: T765 | APPROVED | workflow/stages/03_review/output/task-T765-review.md
