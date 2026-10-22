# Build report: T793

Phase 143, branch `phase-143-paper-ledger-light-theme`. Paper Ledger light values in `src/index.css`, themed fills, `scripts/wcag-tokens.mjs` updates, `DESIGN.md` Tokens table update, and new theme-tokens unit guard.

## Files changed (5)

1. `src/index.css` (target file: updated `:root` with ADR 0103 Paper Ledger values and light fills, appended 11 dark fills to `.dark`, mapped 11 fills in `@theme inline`, removed fills from `@theme`, updated comments)
2. `scripts/wcag-tokens.mjs` (target file: dynamic `brand-tint` lookup in `over()`, dynamic `brand-fill` / `brand-fill-hover` contrast checks, added 7 text-on-`brand-tint` checks in light, updated header comment)
3. `unit/theme-tokens.test.ts` (target file: new Vitest suite asserting 11 fills in `:root` and `.dark`, `@theme inline` mapping, no `--color-` in `@theme`, and 37 frozen dark variables)
4. `DESIGN.md` (target file: updated Tokens table Light column for 14 rows, updated primary button fill description to name `brand-fill` and 11 theme variables, updated section status line)
5. `docs/audit/task-ledger.md` (bookkeeping: marked T793 `done` with gate result)

## Tests added

- `unit/theme-tokens.test.ts`: 4 tests
  1. `defines the 11 fill variables in .dark with frozen dark values and in :root with Paper Ledger light values`
  2. `maps all 11 fills in @theme inline to their respective CSS variables`
  3. `contains no --color- entry in plain @theme block`
  4. `keeps the 37 pre-change dark variables unchanged in .dark`

## Fail-then-pass evidence

### Red run (against unchanged `src/index.css`)
Command:
```powershell
npx vitest run unit/theme-tokens.test.ts *> workflow/stages/02_build/output/logs/T793-red.log
```
Failure summary from `workflow/stages/02_build/output/logs/T793-red.log`:
```
Test Files  1 failed (1)
     Tests  3 failed | 1 passed (4)
  Duration  4.06s
```
Cases 1, 2, and 3 failed as expected because fill variables were missing from `:root` and `.dark`, missing from `@theme inline`, and present in `@theme`. Case 4 passed, confirming the 37 pre-change dark variables.

### Green run (after `src/index.css` and `scripts/wcag-tokens.mjs` changes)
Command:
```powershell
npx vitest run unit/theme-tokens.test.ts
```
Output:
```
Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  270ms
```

## Gate commands and results

1. `node scripts/wcag-tokens.mjs`:
   - All token pairs pass in both light and dark themes.
   - Light values verified: white on `brand-fill` 7.90:1, white on `brand-fill-hover` 9.93:1; 7 text tokens on `brand-tint` pass 4.5:1 (`fg` 14.42, `fg-secondary` 8.14, `fg-muted` 5.24, `expense-text` 5.01, `income-text` 4.70, `pending-text` 4.63, `transfer-text` 4.59); `expense-text` on `surface-3` / `control-active` passes at 4.57:1.
   - Dark values verified: unchanged (white on `brand-fill` 5.70:1, on hover 7.10:1; all 66 pairs pass).

2. `npm run lint`:
   - Clean exit 0 (132 files checked; node-globals clean, safe-ids clean, TypeScript clean for app and `api/tsconfig.json`).

3. `npx vitest run unit/theme-tokens.test.ts`:
   - 4 passed (4).

4. `npm run test:unit`:
   - 65 files, 1469 passed in 71.38 s.
   - Output saved to `workflow/stages/02_build/output/logs/T793-unit.log`.

5. Targeted Playwright (Chromium):
   - `npx playwright test tests/theme.spec.ts tests/dashboard.spec.ts tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/wallets-page.spec.ts tests/categories-page.spec.ts --project=chromium`
   - 48 passed in 47.0 s.

6. Targeted Playwright (all 3 browsers: Chromium, Firefox, WebKit):
   - `npx playwright test tests/theme.spec.ts tests/dashboard.spec.ts tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/wallets-page.spec.ts tests/categories-page.spec.ts`
   - 138 passed, 6 skipped by design in 2.3 min.

7. Full Playwright suite (`npm test`, all 35 specs on 3 browsers):
   - 531 passed, 6 skipped by design (0 failed) in 8.8 min.
   - Output saved to `workflow/stages/02_build/output/logs/T793-playwright.log`.

8. Visual inspection / tokens check:
   - Light mode resolves `--canvas: #F5F2EC` (warm paper/cream), `--surface-1: #FFFFFF` (white cards), `--brand-fill: #4338CA` (indigo primary button).
   - Dark mode resolves `--canvas: #0B0E14`, `--surface-1: #131722`, `--brand-fill: #7C3AED` (violet).

9. Line endings and em dashes:
   - All 5 files reported `w/crlf` (125 CRLF, 0 bare LF in `unit/theme-tokens.test.ts`).
   - 0 em dashes in git diff added lines; 0 em dashes in build report.

## Deliberately not done

- Component re-pointing and new light-only tokens (T794): `LeftOverCard` border, progress tracks, mood dots, `WalletTransferForm.tsx` `#a8a29e`.
- `--identity-1..12`, `identityDisplayColor`, and `src/utils/identityPalette.ts` (T795).
- Updating unit test count in `AGENTS.md` (T796 ships the phase and updates metrics/counts without triggering an extra pause here).
- Touching radii, shadows, font family, or hero size in `@theme`.
