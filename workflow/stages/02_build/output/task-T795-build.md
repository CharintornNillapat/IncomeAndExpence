# Build report: T795

Phase 143, branch `phase-143-paper-ledger-light-theme`. Light-mode identity colours (ADR 0103 D7): `--identity-1..12` variables in `:root` and `.dark`, `identityDisplayColor()` helper in `src/utils/identityPalette.ts`, wrapped every stored-colour paint site across 11 components, updated existing unit assertions, added static guard and unit suite in `unit/identity-display.test.ts`, added theme CSS tests in `tests/dashboard.spec.ts`, updated `docs/contexts/ui-and-e2e.md` line 8, and appended Amendment (T795) to ADR 0103.

## Files changed (22)

1. `docs/audit/decisions/0103-paper-ledger-light-theme.md` (target file: appended Amendment (T795) recording paint-site list, picker decision D-a, SVG style decision D-b, primitive wrapping D-c, and guard D-d)
2. `src/utils/identityPalette.ts` (target file: added `identityDisplayColor`, updated header comment)
3. `src/index.css` (target file: appended `--identity-1..12` to `:root` and `.dark`)
4. `src/components/ui/Chip.tsx` (target file: wrapped `color` in `identityDisplayColor` on dot)
5. `src/components/ui/AllocationBar.tsx` (target file: wrapped `s.color` in `identityDisplayColor` on segments)
6. `src/components/ui/ProgressBar.tsx` (target file: wrapped `color` in `identityDisplayColor` on custom fill)
7. `src/components/dashboard/CategorySpendingCard.tsx` (target file: wrapped donut stroke with inline `style` and row dot `backgroundColor`)
8. `src/components/dashboard/WalletsSection.tsx` (target file: wrapped `color-mix` background and `color` in `identityDisplayColor`)
9. `src/components/wallet/WalletList.tsx` (target file: wrapped `color-mix` background and `color` in `identityDisplayColor`)
10. `src/components/wallet/WalletDetail.tsx` (target file: wrapped `color-mix` background, `color`, and picker swatch background in `identityDisplayColor`)
11. `src/components/wallet/AddWalletForm.tsx` (target file: wrapped picker swatch background in `identityDisplayColor`)
12. `src/components/wallet/WalletTransferForm.tsx` (target file: wrapped transfer wallet icon background in `identityDisplayColor`)
13. `src/components/category/CategoryList.tsx` (target file: wrapped category dot background in `identityDisplayColor`)
14. `src/components/category/ColorGrid.tsx` (target file: wrapped blocked, active, and custom swatches in `identityDisplayColor`)
15. `unit/identity-display.test.ts` (target file: new Vitest suite with 3 tests)
16. `unit/categories-page.test.tsx` (target file: updated assertions for `var(--identity-N)`)
17. `unit/tx-row.test.tsx` (target file: updated assertion for `var(--identity-5)`)
18. `unit/ui-display.test.tsx` (target file: updated assertions for `var(--identity-N)` and added raw non-palette check)
19. `unit/wallets-page.test.tsx` (target file: updated assertions for `var(--identity-N)` and removed unused `rgb` helper in edit describe)
20. `tests/dashboard.spec.ts` (target file: added describe with light and dark theme tests for wallet tile and donut circle colours)
21. `docs/contexts/ui-and-e2e.md` (target file: narrowed line 8 data colours rule)
22. `docs/audit/task-ledger.md` (bookkeeping: updated T795 row to done with gate results and actual files changed)

## Tests added

- `unit/identity-display.test.ts`: 3 tests (new suite)
  1. `maps each of the 12 identity colours to var(--identity-N) case-insensitively and returns non-palette colours unchanged`
  2. `defines --identity-1..12 in :root with Paper Ledger light values and in .dark with stored hexes`
  3. `guards that every colour paint site in components and views uses identityDisplayColor or SYSTEM_CATEGORY_COLOR`
- `tests/dashboard.spec.ts`: 2 tests in `Dashboard identity colours (ADR 0103 D7)`
  1. `resolves Paper Ledger identity colours in light theme` (asserts wallet tile color and donut strokes in real browser)
  2. `resolves stored identity colours in dark theme` (asserts wallet tile color and donut strokes in real browser)

## Fail-then-pass evidence

### Red run (against unchanged codebase)
Command:
```powershell
npx vitest run unit/identity-display.test.ts *> workflow/stages/02_build/output/logs/T795-red.log
```
Failure summary from `workflow/stages/02_build/output/logs/T795-red.log`:
```
Test Files  1 failed (1)
     Tests  3 failed (3)
  Duration  1.12s
```
- Test 1 failed: `TypeError: identityDisplayColor is not a function`
- Test 2 failed: `AssertionError: dark --identity-1: expected undefined to be '#D9A066'`
- Test 3 failed: Static guard reported raw paint sites without `identityDisplayColor`

### Green run (after all edits landed)
Command:
```powershell
npx vitest run unit/identity-display.test.ts
```
Output:
```
Test Files  1 passed (1)
     Tests  3 passed (3)
  Duration  289ms
```

## Gate commands and results

1. `npm run lint`:
   - Clean exit 0 (132 files checked; node-globals clean, safe-ids clean, TypeScript clean for app and `api/tsconfig.json`).

2. `npx vitest run unit/identity-display.test.ts unit/theme-tokens.test.ts unit/identity-color-migration.test.ts unit/ui-display.test.tsx unit/tx-row.test.tsx unit/categories-page.test.tsx unit/wallets-page.test.tsx unit/dashboard.test.tsx`:
   - 8 test files, 145 passed in 3.89s.

3. `npm run test:unit`:
   - 66 test files, 1475 passed in 43.47s.
   - Output saved to `workflow/stages/02_build/output/logs/T795-unit.log`.

4. `node scripts/wcag-tokens.mjs`:
   - Clean exit 0. All token pairs pass.

5. Targeted Playwright (Chromium, 10 specs, 50 tests):
   - `npx playwright test tests/dashboard.spec.ts tests/theme.spec.ts tests/wallets-page.spec.ts tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/categories-page.spec.ts tests/categories.spec.ts tests/transaction.spec.ts tests/layout-stability.spec.ts tests/safe-area.spec.ts --project=chromium`
   - 50 passed in 27.1s.

6. Targeted Playwright (all 3 browsers: Chromium, Firefox, WebKit, 10 specs, 150 test runs):
   - `npx playwright test tests/dashboard.spec.ts tests/theme.spec.ts tests/wallets-page.spec.ts tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/categories-page.spec.ts tests/categories.spec.ts tests/transaction.spec.ts tests/layout-stability.spec.ts tests/safe-area.spec.ts`
   - 144 passed, 6 skipped by design (0 failed) in 2.3 min.

7. Verification checks:
   - `git diff --stat HEAD -- src/utils/identityColorMigration.ts src/context/ src/selectors/ supabase/`: clean (0 files changed).
   - `git ls-files --eol`: all 22 target files verified `w/crlf`.
   - Em dash check: 0 em dashes in added lines across git diff; 0 in build report.
   - `node scripts/wcag-tokens.mjs` exits 0 with no pairs added.

## Deliberately not done

- Rewriting any stored colour in database or state (`IDENTITY_PALETTE` hexes stay unchanged).
- Changing dark mode tokens or appearance.
- Wiring `identityDisplayColor` into CSV export, backup export or non-visual outputs.
- Phase closing docs (`docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `AGENTS.md` and `README.md` test counts) belong to T796.
