# Build report: T792

Phase 143, branch `phase-143-paper-ledger-light-theme`. Docs only; ADR 0103, `DESIGN.md` light palette section, Phase 143 ledger setup, and commit of the owner's design input.

## Files changed (4)

1. `docs/design/finlife-light-theme.md` (target file: owner design input committed byte-for-byte, 77 lines, git hash `a9e7578423f35419dd31e2651383f9fae5bb5379`)
2. `docs/audit/decisions/0103-paper-ledger-light-theme.md` (target file: new ADR 0103 recording mapping, token contrasts, display-only identity variables, and amendments)
3. `DESIGN.md` (target file: added `### Light palette: Paper Ledger (ADR 0103)` section, updated overview, identity colours, and deviations table)
4. `docs/audit/task-ledger.md` (bookkeeping: opened Phase 143 section with T792-T796 rows)

## Tests added

None (docs-only; change cannot alter application behaviour).

## Fail-then-pass evidence

None (docs-only).

## Contrast verification (section 4.6)

Every contrast ratio in the ADR was reproduced before writing with the formula at `scripts/wcag-tokens.mjs:39-50`:
- Table 4.5 text ratios on `canvas` / `surface-1` / `surface-2`:
  - `fg #1E1A15`: 15.48 / 17.30 / 14.31
  - `fg-secondary #4A4338`: 8.74 / 9.76 / 8.07
  - `fg-muted #675F53`: 5.63 / 6.29 / 5.20
  - `brand-text #4338CA`: 7.07 / 7.90 / 6.54
  - `income-text #0E7650`: 5.04 / 5.64 / 4.66
  - `expense-text #B6332A`: 5.38 / 6.01 / 4.97
  - `pending-text #A94E08`: 4.97 / 5.56 / 4.59
  - `transfer-text #245FE2`: 4.93 / 5.51 / 4.56
  - `adjust-text #675F53`: 5.63 / 6.29 / 5.20
- Ratios on `surface-3` / `control-active` (`#E6E0D5`):
  - `fg`: 13.17, `fg-secondary`: 7.43, `expense-text`: 4.57 (min 4.5)
  - Informational: `fg-muted`: 4.79, `income-text`: 4.29, `pending-text`: 4.23, `transfer-text`: 4.20
- Ratios on `brand-tint #ECE8FB`:
  - `fg`: 14.42, `fg-secondary`: 8.14, `fg-muted`: 5.24, `brand-text`: 6.59, `expense-text`: 5.01, `income-text`: 4.70, `pending-text`: 4.63, `transfer-text`: 4.59
- Borders, focus, and fills:
  - `line-input #8A8172`: 3.44 on `canvas`, 3.84 on `surface-1`, 3.18 on `surface-2` (min 3)
  - `focus #4338CA`: 7.07 on `canvas`, 7.90 on `surface-1`, 6.54 on `surface-2`, 6.02 on `surface-3` (min 3)
  - White on `brand-fill #4338CA`: 7.90; white on `brand-fill-hover #3730A3`: 9.93 (min 4.5)
  - `brand-text` vs `line-strong #CFC5B4`: 4.63 (min 3)
  - `chip-text #4A4338` on `adjust-bg #EEE9E0`: 8.07 (min 4.5)
  - `selected-text #3730A3` on `selected-bg #ECE8FB`: 8.28 (min 4.5)
  - `pending-body #78350F` on `pending-bg #F9F1EB`: 8.13 (min 4.5)
- Identity colours on white / on `surface-2`:
  - Tan (`#A16207`): 4.92 / 4.07
  - Blue (`#1E40AF`): 8.72 / 7.21
  - Teal (`#0E7490`): 5.36 / 4.43
  - Peach (`#D97706`): 3.19 / 2.63
  - Rose (`#DB2777`): 4.60 / 3.80
  - Periwinkle (`#2563EB`): 5.17 / 4.27
  - Lavender (`#7C3AED`): 5.70 / 4.71
  - Aqua (`#0891B2`): 3.68 / 3.05
  - Khaki (`#8A6D46`): 4.82 / 3.99
  - Steel (`#5B7A9D`): 4.45 / 3.68
  - Orchid (`#A21CAF`): 6.32 / 5.23
  - Iris (`#6B5FBF`): 5.23 / 4.33
- Tint mixes (8% and 30% over white):
  - `income-bg #ECF4F1` (text on it: 5.04)
  - `expense-bg #FAEFEE` (text on it: 5.33)
  - `transfer-bg #EEF3FD` (text on it: 4.95)
  - `pending-bg #F9F1EB` (text on it: 4.98)
  - `danger-line #ECC3C0`
  - `pending-line #E9CBB5`

Zero differences exceeded 0.01 against the spec.

## Gate commands and results

1. `git status --porcelain`:
   - Only 4 target files (`docs/design/finlife-light-theme.md`, `docs/audit/decisions/0103-paper-ledger-light-theme.md`, `DESIGN.md`, `docs/audit/task-ledger.md`) and workflow stage output files. No modifications under `src/`, `unit/`, `tests/`, `scripts/`, `supabase/`, `api/`.

2. `git diff --stat`:
   - `DESIGN.md`: 48 insertions, 2 deletions.
   - `docs/audit/task-ledger.md`: 12 insertions.

3. `git ls-files --eol`:
   - `DESIGN.md`: `w/crlf`.
   - `docs/audit/task-ledger.md`: `w/crlf`.
   - `docs/audit/decisions/0103-paper-ledger-light-theme.md`: CRLF line endings verified with node script (193 CRLF, 0 bare LF).

4. Em dash counts:
   - In `docs/audit/decisions/0103-paper-ledger-light-theme.md`: 0.
   - In `workflow/stages/01_spec/output/task-T792-spec.md`: 0.
   - In git diff added lines: 0.
   - In this build report: 0.

5. Text-landed hex verification:
   - All 53 unique hexes in the spec's `ADR-HEX` block confirmed present in ADR 0103 (`53 hex checked, missing: none`).

6. `git diff --no-index --stat /dev/null docs/design/finlife-light-theme.md`:
   - 77 lines added, byte-for-byte match to owner's input file (git hash `a9e7578423f35419dd31e2651383f9fae5bb5379`).

7. `node scripts/wcag-tokens.mjs`:
   - Clean exit 0: `All token pairs pass.` (66 light pairs, 66 dark pairs pass).

## Deliberately not done

- Commit cell for T792 in `docs/audit/task-ledger.md` left empty (deploy record fills it).
- Did not edit `src/index.css` or `scripts/wcag-tokens.mjs` (reserved for T793).
- Did not change component markup or styles (reserved for T794).
- Did not touch `identityPalette.ts` or add CSS variables (reserved for T795).
- Did not edit `docs/design/finlife-light-theme.md` (committed byte for byte).


## Fix round 1

### Blocking items fixed

1. **DESIGN.md component row citations (D8 item 7)**:
   - Replaced stale `DESIGN.md:155` citation in `docs/audit/decisions/0103-paper-ledger-light-theme.md` with exact current line numbers: `DESIGN.md:187` (`ProgressBar` track `line`), `DESIGN.md:192` (`DayGroupHeader` `surface-2`), and mood meter (`line-strong`).
   - Verified lines against current `DESIGN.md`: line 187 is `ProgressBar`, line 192 is `DayGroupHeader`.

2. **DESIGN.md sign rule citation (D7)**:
   - Replaced `DESIGN.md:107` with `DESIGN.md:150` in ADR 0103, accounting for the 43 lines inserted by this task.
   - Verified line against current `DESIGN.md`: line 150 is the "Income `+฿` green. Spending `−฿` red" rule bullet.

3. **Self-contained paint sites reference (D7 & Consequences)**:
   - Replaced transient "section 4.1 item 5" and "4.1 item 5" spec references in lines 120 and 181 with self-contained descriptions: "every site that paints a stored category or wallet colour (T795's spec lists them)".

### Gates rerun and verified

1. **Text-landed hex script**:
   - `53 hex checked, missing: none`. All 53 unique hexes present in ADR 0103.
2. **Em dash count**:
   - 0 in ADR 0103, 0 in added git diff lines, 0 in spec, 0 in build report.
3. **Line endings**:
   - 193 CRLF, 0 bare LF in ADR 0103. `DESIGN.md` and `task-ledger.md` report `w/crlf`.
4. **git status --porcelain**:
   - Only 4 target files (`docs/design/finlife-light-theme.md`, `docs/audit/decisions/0103-paper-ledger-light-theme.md`, `DESIGN.md`, `docs/audit/task-ledger.md`) and workflow stage output files.
5. **Design file input**:
   - Byte-for-byte unchanged: 77 lines, hash `a9e7578423f35419dd31e2651383f9fae5bb5379`.
6. **Token check**:
   - `node scripts/wcag-tokens.mjs` clean exit 0 (`All token pairs pass.`).

All blocking items from Round 1 are resolved.
