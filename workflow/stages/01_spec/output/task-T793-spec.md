# T793 spec: Paper Ledger light values in `src/index.css`

Phase 143, branch `phase-143-paper-ledger-light-theme`. Source of truth for every value: `docs/audit/decisions/0103-paper-ledger-light-theme.md` (D2 to D5), as amended (`expense-text #B6332A`, `surface-3` / `control-active` `#E6E0D5`). Values below are copied from it; if this spec and the ADR ever differ, stop and report.

## 1. Goal

Light mode gets the Paper Ledger colours: the `:root` block takes the ADR 0103 values, and the eleven theme-independent fills move out of `@theme` into `:root` and `.dark` as variables (dark values exactly as today). The `.dark` block's existing 37 variables and every dark colour on screen stay byte-identical, and `node scripts/wcag-tokens.mjs` passes in both themes.

## 2. Target files

- `src/index.css`
- `scripts/wcag-tokens.mjs`
- `unit/theme-tokens.test.ts` (new)
- `DESIGN.md`
- `docs/audit/task-ledger.md` (the T793 row: Status `done`, Notes with the gate results)

No ADR is needed (0103 exists). Not in scope, do not touch: any `src/components/`, `src/utils/`, `docs/contexts/`, `AGENTS.md`.

## 3. Context to read

`docs/contexts/ui-and-e2e.md` (token rules, `wcag-tokens.mjs` reminder at line 8, Playwright rules) and `DESIGN.md` section 1. Also the ADR above in full. `client-state.md` is not needed (no logic).

## 4. Current behaviour

- `:root` (`src/index.css:170-209`) holds 37 slate/violet light values; `.dark` (`:211-249`) the dark set; `@theme inline` (`:251-289`) maps each to `--color-*` (e.g. `--color-brand: var(--brand-text)`, `--color-income: var(--income-text)`).
- The eleven fills are plain `@theme` entries at `:297-307`: `--color-brand-fill`, `-brand-fill-hover`, `-brand-tint`, `-brand-line`, `-income-fill`, `-income-line`, `-expense-fill`, `-expense-line`, `-pending-fill`, `-transfer-fill`, `-transfer-line`. They are the same in both themes, so a class like `bg-brand-fill` cannot be light-only (ADR D5).
- `@theme` at `:296` also holds radii, shadows, font and hero size (`:309-327`); those stay.
- `scripts/wcag-tokens.mjs:52-53` reads `:root` and `.dark` by scanning from `"<selector> {"` to the first `}` (`:13-20`), then merges dark over light. It hard-codes the brand tint as `rgba(139, 92, 246, 0.12)` (`:96`) and the brand fill hexes `#7C3AED` / `#6D28D9` (`:99-100`).
- No unit or Playwright test asserts a fill colour (grep of `unit/` and `tests/` for the hexes and `--color-`: only identity-colour tests, which T795 owns).
- `AGENTS.md` / `DESIGN.md:54`: the primary button fill is stated as `#7C3AED`.

## 5. The change

### 5.1 `src/index.css`

Keep CRLF working-tree line endings as they are (`git ls-files --eol src/index.css` shows `w/crlf`); do not convert the file.

**A. `:root` light values.** Replace the value of each variable (names, order and the `--logged-bg` comment unchanged), and append the eleven fills at the end of the block:

| Variable | New light value |
|---|---|
| `--canvas` | `#F5F2EC` |
| `--header` | `#FFFFFF` |
| `--surface-1` | `#FFFFFF` |
| `--surface-2` | `#EEE9E0` |
| `--surface-3` | `#E6E0D5` |
| `--control-active` | `#E6E0D5` |
| `--line` | `#E0D8CB` |
| `--line-control` | `#CFC5B4` |
| `--line-strong` | `#CFC5B4` |
| `--line-input` | `#8A8172` |
| `--fg` | `#1E1A15` |
| `--fg-secondary` | `#4A4338` |
| `--fg-muted` | `#675F53` |
| `--fg-disabled` | `#A39B8E` |
| `--focus` | `#4338CA` |
| `--scrim` | unchanged `rgba(15, 23, 42, 0.55)` |
| `--brand-text` | `#4338CA` |
| `--brand-soft-bg` | `#ECE8FB` |
| `--brand-soft-line` | `#D9D2F5` |
| `--brand-soft-text` | `#4338CA` |
| `--selected-bg` | `#ECE8FB` |
| `--selected-text` | `#3730A3` |
| `--logged-bg` | `#D9D2F5` |
| `--income-text` | `#0E7650` |
| `--income-bg` | `#ECF4F1` |
| `--expense-text` | `#B6332A` |
| `--expense-bg` | `#FAEFEE` |
| `--transfer-text` | `#245FE2` |
| `--transfer-bg` | `#EEF3FD` |
| `--adjust-text` | `#675F53` |
| `--adjust-bg` | `#EEE9E0` |
| `--chip-text` | `#4A4338` |
| `--danger-line` | `#ECC3C0` |
| `--pending-text` | `#A94E08` |
| `--pending-bg` | `#F9F1EB` |
| `--pending-line` | `#E9CBB5` |
| `--pending-body` | `#78350F` (unchanged) |

Appended to `:root` (light fills, ADR D5):

```
--brand-fill: #4338CA;
--brand-fill-hover: #3730A3;
--brand-tint: #ECE8FB;
--brand-line: #D9D2F5;
--income-fill: #0E7A52;
--income-line: rgba(14, 122, 82, 0.3);
--expense-fill: #C0362C;
--expense-line: rgba(192, 54, 44, 0.3);
--pending-fill: #B45309;
--transfer-fill: #2563EB;
--transfer-line: rgba(37, 99, 235, 0.3);
```

**B. `.dark`.** Do not change any existing line. Append the eleven fills with today's `@theme` values exactly:

```
--brand-fill: #7C3AED;
--brand-fill-hover: #6D28D9;
--brand-tint: rgba(139, 92, 246, 0.12);
--brand-line: rgba(139, 92, 246, 0.3);
--income-fill: #10B981;
--income-line: rgba(16, 185, 129, 0.3);
--expense-fill: #F43F5E;
--expense-line: rgba(244, 63, 94, 0.3);
--pending-fill: #F59E0B;
--transfer-fill: #38BDF8;
--transfer-line: rgba(56, 189, 248, 0.3);
```

**C. `@theme inline`.** Add eleven lines, same `--color-*` names as today so no class changes:
`--color-brand-fill: var(--brand-fill);` and likewise for `brand-fill-hover`, `brand-tint`, `brand-line`, `income-fill`, `income-line`, `expense-fill`, `expense-line`, `pending-fill`, `transfer-fill`, `transfer-line`.

**D. `@theme`** (`:296`): delete the eleven `--color-*` fill lines (`:297-307`). Radii, `--shadow-*`, `--font-sans`, `--text-hero` and `--text-hero--line-height` stay exactly as they are. `--shadow-quick-add` keeps its violet rgba (out of scope, ADR "Deliberately not done" does not list it but T794 may revisit; do not touch).

**E. Comments.** Update the comment above the old fills block (`:291-295`) to say the fills are now theme variables set on `:root` and `.dark` (with the `-line` borders 30% of the fill, and the brand fill carrying white text at 5.70:1 in dark and 7.90:1 in light). Update the block comment above `:root` (`:162-168` region) where it says light values are "derived to the same roles" to say light is the Paper Ledger palette of ADR 0103. Do not put a `}` inside any comment placed inside `:root` or `.dark` (`wcag-tokens.mjs:16` slices to the first `}`).

### 5.2 `scripts/wcag-tokens.mjs`

Make these edits only (sim-verified: with 5.1 applied, every pair passes in both themes):

1. `:96`: `const tint = over(parse('rgba(139, 92, 246, 0.12)'), c(s));` becomes `const tint = over(parse(v['brand-tint']), c(s));` (the dark rgba composites as before; the light value is solid, so `over` returns it).
2. `:99-100`: replace the two hard-coded checks with
   `check(theme, 'white on brand-fill', [255, 255, 255, 1], c('brand-fill'), 4.5);` and
   `check(theme, 'white on brand-fill-hover', [255, 255, 255, 1], c('brand-fill-hover'), 4.5);`.
3. After the first, add (light only, because the dark tint is translucent and `c('brand-tint')` would not composite it, which fails in dark with ratios 1.4 to 3.5):
   ```js
   if (theme === 'light') {
     for (const text of ['fg', 'fg-secondary', 'fg-muted', 'expense-text', 'income-text', 'pending-text', 'transfer-text']) {
       check(theme, `${text} on brand-tint`, c(text), c('brand-tint'), 4.5);
     }
   }
   ```
4. Header comment: add that fills and tints are read from the same two blocks. No other change.

Expected light results (from the ADR, reproduced in a scratch copy): white on `brand-fill` 7.90, on `brand-fill-hover` 9.93; `fg` 14.42, `fg-secondary` 8.14, `fg-muted` 5.24, `expense-text` 5.01, `income-text` 4.70, `pending-text` 4.63, `transfer-text` 4.59 on `brand-tint`; `expense-text` on `surface-3` and `control-active` 4.57; dark white on `brand-fill` 5.70 and on hover 7.10 (unchanged).

### 5.3 `DESIGN.md`

- Tokens table (`:37-52`): rewrite the Light column to the values in 5.1.A for the 14 rows (Page `#F5F2EC`; Header `#FFFFFF`; Card `#FFFFFF`; Box inside a card `#EEE9E0`; Menu / hover `#E6E0D5`; Selected segment `#E6E0D5`; Divider `#E0D8CB`; Secondary-button edge `#CFC5B4`; Dashed edge `#CFC5B4`; Input edge `#8A8172`; Text `#1E1A15` / `#4A4338` / `#675F53`; Disabled `#A39B8E`; Chip text `#4A4338`; Danger edge `#ECC3C0`). Dark column unchanged.
- `:54`: the primary fill sentence becomes: the primary button fill is `brand-fill`, `#7C3AED` in dark (5.70:1) and `#4338CA` in light (7.90:1), with white text. Add that the eleven fills are theme variables.
- `:63` status line: change "target ... until T793 rewrites its Light column" to say the Light column and the palette values are in force from T793 (Phase 143), and that the identity colours (D7) follow in T795.
- No other DESIGN.md change; do not touch the Paper Ledger table, the Deviations table or the identity section.
- Docs count check: any number you write must match the CSS (11 fills, 14 palette rows).

### 5.4 `unit/theme-tokens.test.ts` (new)

Vitest, no DOM. Read `src/index.css` with `readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')` (same pattern as `unit/dashboard.test.tsx:175`; use `String(...)` around the path as it does if `tsc` needs it). Cases:

1. For each of the eleven fill names, `.dark` defines `--<name>` with today's dark value (the table in 5.1.B, copied into the test as a frozen record), and `:root` defines it too (any value, plus the exact light values from 5.1.A: assert the record).
2. `@theme inline` maps `--color-<name>: var(--<name>)` for all eleven.
3. The plain `@theme {` block (text between `@theme {` and its closing brace, which has no nested braces) contains no `--color-` entry.
4. `.dark` still holds the 37 frozen pre-change dark variables with their values (freeze the 37 `name: value` pairs from `src/index.css:212-248` at HEAD in the test, so a later edit to dark fails here).

Block extraction: find `"<selector> {"` and slice to the first `}` as `wcag-tokens.mjs:13-20` does; parse `--name: value;`.

Red first (AGENTS.md money-path rule does not apply, since this is not a money path, but the repo habit does): write the test, run `npx vitest run unit/theme-tokens.test.ts` against the unchanged `src/index.css`, and save the failure to `workflow/stages/02_build/output/logs/T793-red.log`. It must fail cases 1, 2 and 3 (today the fills are in `@theme`, `:root` lacks them, `@theme inline` lacks the maps); case 4 passes today and must keep passing. Then make the CSS change and see it go green.

## 6. Parity map

None of the `AGENTS.md` rows. (The ADR 0103 / DESIGN.md pair is kept in step by 5.3.)

## 7. Gates

Changed paths: `src/index.css`, `scripts/`, `unit/`, `DESIGN.md`. Union of the tiers:

```
node scripts/wcag-tokens.mjs
npm run lint
npx vitest run unit/theme-tokens.test.ts
npm run test:unit
npx playwright test tests/theme.spec.ts tests/dashboard.spec.ts tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/wallets-page.spec.ts tests/categories-page.spec.ts --project=chromium
npx playwright test tests/theme.spec.ts tests/dashboard.spec.ts tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/wallets-page.spec.ts tests/categories-page.spec.ts
```

Notes for the Builder:
- `safe-area.spec.ts` and `layout-stability.spec.ts` are included on purpose (ADR 0103 D5, T774 lesson), though no size changes.
- A palette change reaches every page, so after the two runs above also run `npm test` (all specs, all browsers) once and save it to `workflow/stages/02_build/output/logs/`. Save the full unit and Playwright output to logs too.
- Before Playwright: check ports 3000 and 3100 for stale dev servers; never edit `src/` while Playwright runs.
- Docs check: `git ls-files --eol src/index.css scripts/wcag-tokens.mjs DESIGN.md unit/theme-tokens.test.ts` (existing files stay `w/crlf`; match the repo for the new file), and the em dash count on added lines (Node one-liner in `workflow/stages/01_spec/CONTEXT.md`) is 0.
- Visual check (not a gate, but report it): `npm run dev`, light mode as a guest on the Dashboard, once, and say what you saw (cream page, white cards, indigo primary button). Do not sign in.

## 8. Production touch points

None. No SQL, no `/api/*`, no Vercel or workflow edit, no dependency, no commit by the Builder.

## 9. Out of scope

- Component re-pointing and new light-only tokens (T794): `LeftOverCard` border, progress tracks, mood dots, `WalletTransferForm.tsx` `#a8a29e`.
- `--identity-1..12`, `identityDisplayColor`, anything in `src/utils/identityPalette.ts` (T795). Identity tests in `unit/` stay as they are.
- Any dark value; `--scrim`; `--shadow-quick-add`; radii; `theme-color` in `index.html` and `vite.config.ts`.
- `docs/contexts/ui-and-e2e.md` (T796). `AGENTS.md` unit counts (1463 tests, 63 files) go stale by the new test file; T796's baseline-metrics entry reports the new counts, and the owner updates `AGENTS.md` then. Do not edit `AGENTS.md` here (it would trigger an owner pause).
- Renaming any `--color-*` class name, a `[data-theme]` selector, `refactor-log.md`, `baseline-metrics.md`.
