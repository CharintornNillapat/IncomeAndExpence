# Build report: T794

Phase 143, branch `phase-143-paper-ledger-light-theme`. Re-point four components to Paper Ledger light tokens (`LeftOverCard.tsx`, `SegmentedControl.tsx`, `MoodSpendingCard.tsx`, `MoodMeter.tsx`), replace `#a8a29e` fallback in `WalletTransferForm.tsx` with new token `wallet-fallback`, introduce five new theme tokens (`hero-line`, `segment-active`, `mood-tile`, `mood-empty`, `wallet-fallback`) across `:root`, `.dark`, and `@theme inline` in `src/index.css`, update `scripts/wcag-tokens.mjs`, append Amendment to ADR 0103, update `DESIGN.md` and `docs/contexts/ui-and-e2e.md`, add 3 tests to `unit/theme-tokens.test.ts`, and run all gates.

## Files changed (12)

1. `docs/audit/decisions/0103-paper-ledger-light-theme.md` (target file: appended Amendment (T794) with section 4 verdicts, five tokens table, and recorded 2.52:1 dark figure)
2. `src/index.css` (target file: added `--hero-line`, `--segment-active`, `--mood-tile`, `--mood-empty`, `--wallet-fallback` to `:root`, `.dark`, and `@theme inline`)
3. `src/components/dashboard/LeftOverCard.tsx` (target file: replaced `border-line` with `border-hero-line`, updated comment regarding neutral line vs hero-line exception)
4. `src/components/dashboard/MoodSpendingCard.tsx` (target file: replaced `bg-surface-2` with `bg-mood-tile` on the day list item)
5. `src/components/diary/MoodMeter.tsx` (target file: replaced `bg-line-strong` with `bg-mood-empty` on empty mood bars)
6. `src/components/ui/SegmentedControl.tsx` (target file: replaced `bg-control-active` with `bg-segment-active` on the active pill, updated doc comment)
7. `src/components/wallet/WalletTransferForm.tsx` (target file: added `bg-wallet-fallback` class to icon tile, changed style to `wallet?.color ? { backgroundColor: wallet.color } : undefined`, removed raw `#a8a29e` hex)
8. `scripts/wcag-tokens.mjs` (target file: updated mood-meter check to `mood-empty`, added `fg on segment-active`, `fg-muted on mood-tile`, `expense-text on mood-tile`, and light-only `white on wallet-fallback`)
9. `unit/theme-tokens.test.ts` (target file: added 3 tests verifying the 5 tokens, dark invariants, component source usages, and removal of raw fallback hex)
10. `DESIGN.md` (target file: updated lines 30, 32, 71, 183, 212, and added 5 rows to Tokens table)
11. `docs/contexts/ui-and-e2e.md` (target file: added the 5 classes to line 7 token list)
12. `docs/audit/task-ledger.md` (bookkeeping: updated T794 row to done with gate results and actual files changed)

## Tests added

- `unit/theme-tokens.test.ts`: 3 tests (suite total: 7 tests)
  1. `defines the five T794 tokens with light and dark values and preserves dark invariants (ADR 0103 D6)`
  2. `points the four components at the new tokens`
  3. `has no hard-coded fallback hex in WalletTransferForm`

## Fail-then-pass evidence

### Red run (against unchanged components and stylesheet)
Command:
```powershell
npx vitest run unit/theme-tokens.test.ts *> workflow/stages/02_build/output/logs/T794-red.log
```
Failure summary from `workflow/stages/02_build/output/logs/T794-red.log`:
```
Test Files  1 failed (1)
     Tests  3 failed | 4 passed (7)
  Duration  1.23s
```
- Test 5 failed: `AssertionError: light token --hero-line: expected undefined to be '#D9D2F5'`
- Test 6 failed: `AssertionError: expected 'import React...' to contain 'border-hero-line'`
- Test 7 failed: `AssertionError: expected 'import React...' to contain 'bg-wallet-fallback'`
The 4 existing tests passed.

### Green run (after component, CSS, and WCAG script changes)
Command:
```powershell
npx vitest run unit/theme-tokens.test.ts
```
Output:
```
Test Files  1 passed (1)
     Tests  7 passed (7)
  Duration  391ms
```

## Gate commands and results

1. `npx vitest run unit/theme-tokens.test.ts`:
   - 7 passed (7) in 391ms.

2. `node scripts/wcag-tokens.mjs`:
   - Clean exit 0. All token pairs pass in both themes.
   - Verified new checks:
     - `white on wallet-fallback` (light): 3.84:1 (min 3:1)
     - `fg on segment-active` (light): 14.31:1, (dark): 11.72:1 (min 4.5:1)
     - `fg-muted on mood-tile` (light): 5.63:1, (dark): 6.03:1 (min 4.5:1)
     - `expense-text on mood-tile` (light): 5.38:1, (dark): 6.72:1 (min 4.5:1)
     - `brand-text vs mood-empty (mood meter)` (light): 5.59:1, (dark): 5.72:1 (min 3:1)

3. `npm run lint`:
   - Clean exit 0 (132 files checked; node-globals clean, safe-ids clean, TypeScript clean for app and `api/tsconfig.json`).

4. `npm run test:unit`:
   - 65 files, 1472 passed in 61.33s.
   - Output saved to `workflow/stages/02_build/output/logs/T794-unit.log`.

5. Targeted Playwright (Chromium):
   - `npx playwright test tests/theme.spec.ts tests/dashboard.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/layout-stability.spec.ts --project=chromium`
   - 35 passed in 31.4s.

6. Full Playwright suite (all 35 specs on 3 browsers):
   - `npx playwright test`
   - 531 passed, 6 skipped by design (0 failed) in 9.4 min.
   - Output saved to `workflow/stages/02_build/output/logs/T794-playwright.log`.

7. Verifications:
   - `git diff --stat HEAD`: exactly 12 target files changed.
   - `git ls-files --eol`: all 12 files verified `w/crlf`.
   - Em-dash check: 0 em dashes in added lines across git diff; 0 in build report.
   - Confirm by hand: every `.dark` value in `src/index.css` above the new five is unchanged (additions only in `.dark`, no changed line).

## Deliberately not done

- Identity and category display colours, `identityDisplayColor()`, `--identity-1..12`, the `wallet.color` wrapping (T795; left `wallet.color` as a plain read).
- Phase closing docs (`docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `AGENTS.md` and `README.md` test counts) belong to T796.
- Mappings in section 3 of design file settled as "stays" in ADR 0103 Amendment:
  - Progress track and Spent/Kept track staying `line`.
  - Inactive tab colour staying `fg-secondary`.
  - Repayment button outline staying `variant="soft"`.
  - Link hover colour staying underline only without colour change.
  - Active tab weight staying `font-medium`.
