# Review: T795

## Round 1

### 1. Metadata

- Task: T795, light-mode identity colours (ADR 0103 D7)
- Date: 2026-10-23
- Round: 1
- Verdict: APPROVED
- Branch `phase-143-paper-ledger-light-theme`, base `c5c2358`
- Target files: the 21 listed in the spec; all 22 reported by the builder (21 targets plus the ledger row) match `git status`. `git check-ignore -v` on the targets: none ignored.

### 2. Summary

Adds `--identity-1..12` to `:root` (Paper Ledger values) and `.dark` (stored hexes) and `identityDisplayColor()` in `identityPalette.ts`. Every one of the 15 paint sites in the spec is wrapped: the three primitives (`Chip`, `AllocationBar`, `ProgressBar`), the dashboard card sites, the wallet tiles and pickers, the category list and `ColorGrid`. The donut ring moved to `style={{ stroke }}`. The existing unit assertions were rewritten as specced and a static guard test was added. ADR 0103 Amendment (T795) and `ui-and-e2e.md` line 8 were written.

### 3. Invariants and parity

- Scope: `git status --porcelain` shows only spec targets, the spec/build reports and the ledger row. `git diff --stat` for `src/utils/identityColorMigration.ts`, `src/context/`, `src/selectors/`, `supabase/` is empty. `IDENTITY_PALETTE` values unchanged (diff only adds a comment sentence and the new function).
- Parity `identityColorMigration.ts` vs `20261002_phase63_identity_colors.sql`: not touched; `unit/identity-color-migration.test.ts` green and unedited.
- Parity spec DOM ids vs `test-selector-contract.md`: no id edited; swatch ids and `aria-pressed`, `onChange(hex)`, `key` still use the stored hex (only the `style` line changed in each picker).
- Dark mode: the `.dark` block holds exactly the stored hexes (test 2 compares each to `IDENTITY_PALETTE`), and no existing token changed. The light values match the spec table, hard-coded in the test.
- `SYSTEM_CATEGORY_COLOR` lines (`CategorySpendingCard.tsx:157`, `CategoryList.tsx:89`) left alone.
- Donut: `strokeDasharray` and `strokeDashoffset` remain attributes.
- CRLF: `git ls-files --eol` shows `w/crlf` on all 21 changed tracked files.
- Em dashes: 0 in added diff lines, the new test file and the build report.
- Existing assertions are kept, with only the expected value changed (plus the one added `#0ea5e9` render in `ui-display`, as specced).

### 4. Gates run

Logs under `workflow/stages/03_review/output/logs/`.

- `npm run lint`: exit 0 (132 files; node-globals, safe-ids, both `tsc` clean).
- `npx vitest run` on the 8 spec files: 8 files, 145 passed, 0 failed.
- `npm run test:unit`: 66 files, 1475 passed, 0 failed, 0 skipped (`T795-unit.log`).
- `node scripts/wcag-tokens.mjs`: exit 0, all token pairs pass.
- Playwright, the 10 specs, `--project=chromium`: 50 passed (`T795-pw-chromium.log`). No stale servers on 3000/3100 beforehand.
- Playwright, the 10 specs, all browsers: 144 passed, 6 skipped, 0 failed (`T795-pw-all.log`). The 6 skips are the by-design ones the builder also saw.
- The builder's claimed numbers all reproduce, despite its session going idle mid-build.

Red run (step 6): `git status --porcelain` recorded, then `git stash push -- src` (all `src` files are `w/crlf`, none excluded). With the new `unit/identity-display.test.ts` untouched, `npx vitest run unit/identity-display.test.ts` gave 3 failed of 3: `identityDisplayColor is not a function`; `dark --identity-1: expected undefined to be '#D9A066'`; the guard listing raw paint sites. `git stash pop --index` restored the tree and `git status --porcelain` is identical to the recorded one.

### 5. Not verified

- The Playwright dashboard colour tests were not run against the stashed (unfixed) `src`; their red state is by inspection only (the circle would have no `style` and the attribute would stay the raw hex). They pass on the fixed code in all three browsers.
- No visual check by eye in a browser; the `toHaveCSS` assertions on the resolved wallet tile colour and the donut stroke in light and dark stand in for it.
- The full 35-spec Playwright suite was not run (the spec asks for the 10 specs only).

### 6. Blocking

None.

### 7. Non-blocking

- Each edited component puts the new `import { identityDisplayColor }` line above `import React`. `ColorGrid.tsx` now has two imports from `../../utils/identityPalette` (lines 1 and 3); merge them into one.
- `identityPalette.ts` header comment reflows to a short orphan line ("ADR 0038) moved the"); rewrap it.
- `unit/wallets-page.test.tsx` leaves a stray blank line where the `rgb` helper was removed.
- ADR Amendment labels the guard "D-d"; the spec's D-d is "sign, not colour". Harmless, but the amendment omits the spec's D-c idempotence note and the sign decision.

### 8. Rule candidates

- Once T795 is merged, the line in `ui-and-e2e.md` (already narrowed) is the rule; the guard test enforces it. T796 only checks it.

### 9. Fix block

Not applicable (APPROVED).
