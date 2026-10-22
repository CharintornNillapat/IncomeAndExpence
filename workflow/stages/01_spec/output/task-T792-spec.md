# Spec: T792

Phase 143, branch `phase-143-paper-ledger-light-theme` (cut from `main` at `1344a1c`). Docs only. T792 is the first task of the phase: it writes ADR 0103, adds a light-palette section to `DESIGN.md`, opens the Phase 143 ledger section, and commits the owner's design input.

## 1. Goal

Record, as ADR 0103, how the owner's "Paper Ledger" light theme (`docs/design/finlife-light-theme.md`) maps onto the app's existing tokens in `src/index.css`, how a stored category or wallet colour is shown in light mode only (stored data and dark mode unchanged), and what the owner's file gets wrong or leaves open. Describe the target in `DESIGN.md`, open Phase 143 in the ledger, and commit the design file. No `src/` edit.

## 2. Target files

```
docs/design/finlife-light-theme.md
docs/audit/decisions/0103-paper-ledger-light-theme.md
DESIGN.md
docs/audit/task-ledger.md
```

- `docs/design/finlife-light-theme.md` is the owner's file, untracked today. Commit it **byte for byte**: do not edit it (its 77 lines stay as they are, including its `:root[data-theme="light"]` selector and its wrong contrast claim; the ADR records both).
- `docs/audit/decisions/0103-paper-ledger-light-theme.md` is new. Write it first (section 4 holds its full content).
- `docs/audit/task-ledger.md` is bookkeeping, always allowed, but T792 adds the Phase 143 section (section 4.7).
- Not on the automatic-pause list: no money path, no `supabase/`, no `api/`, no `AGENTS.md`, no stage file, no `.claude/agents/`; Production touch points is `none`. The owner asked for a pause after this spec anyway, so the orchestrator waits for the owner's go-ahead before `build T792`.

## 3. Context to read

none (docs only: the builder reads no `docs/contexts/*.md`). The builder reads, for form and for the values it cites:
- `docs/audit/decisions/0102-dashboard-redesign-2026-10.md` and `0038-identity-colour-migration.md`, as the ADR format model (Status block, Date, Context, Decision with `D1..` headings and a `Why`, Consequences).
- `docs/design/finlife-light-theme.md` (the input) and `src/index.css:170-249, 296-307` (the tokens).
- `DESIGN.md:1-60` (colour) and `:140-153` (Deviations).

## 4. Current behaviour, and the content the ADR and `DESIGN.md` must carry

### 4.1 What the code does today

1. Light mode is the `:root` block (`src/index.css:170-209`); dark is the `.dark` class block (`:211-249`; `@custom-variant dark` at `:19`; `useTheme.ts` also sets `data-theme` on `<html>`, but no CSS selects on it). The design file's `:root[data-theme="light"]` selector therefore is **not** used.
2. `@theme inline` (`:251-289`) exposes 37 variables as `--color-*`. So `bg-surface-1` is right in both themes without a `dark:` twin (`docs/contexts/ui-and-e2e.md:8`).
3. Eleven colours are theme-independent, in `@theme` (`:296-307`): `brand-fill #7C3AED`, `brand-fill-hover #6D28D9`, `brand-tint rgba(139,92,246,0.12)`, `brand-line rgba(139,92,246,0.3)`, `income-fill #10B981`, `income-line rgba(16,185,129,0.3)`, `expense-fill #F43F5E`, `expense-line rgba(244,63,94,0.3)`, `pending-fill #F59E0B`, `transfer-fill #38BDF8`, `transfer-line rgba(56,189,248,0.3)`. They cannot change in light only until they become theme variables. Uses in `src/` (`grep`, 2026-10-22): brand-fill 20, brand-tint 12, brand-line 6, brand-fill-hover 6, income-line 9, expense-line 7, expense-fill 3, income-fill 2, pending-fill 1, transfer-fill 0, transfer-line 0.
4. `scripts/wcag-tokens.mjs` reads `:root` and `.dark` (`:52-53`) and fails on any text pair under 4.5:1 on `canvas`, `surface-1`, `surface-2`, `header` (`:66-69`), on `surface-3` and `control-active` for `fg`, `fg-secondary`, `expense-text` (`:72-74`), and others. Two lines are hard-coded to the dark/violet values and must follow the light change in T793: `:96` (brand tint `rgba(139, 92, 246, 0.12)`) and `:99-100` (`#7C3AED`, `#6D28D9`).
5. Stored identity colours: `IDENTITY_PALETTE`, 12 hexes (`src/utils/identityPalette.ts:8-21`), written to categories and wallets (`FinanceContext.tsx:476-484, 498, 512, 526`), kept in step with SQL by `utils/identityColorMigration.ts` and `20261002_phase63_identity_colors.sql`. They are painted from stored data, the same hex in both themes, at: `CategoryList.tsx:64`, `ColorGrid.tsx:62,66,86`, `CategorySpendingCard.tsx:61,141` (SVG `stroke` attribute and a dot), `WalletsSection.tsx:101,120`, `WalletList.tsx:60,87`, `WalletDetail.tsx:146,227`, `AddWalletForm.tsx:167`, `WalletTransferForm.tsx:108` (fallback `'#a8a29e'`), `ui/Chip.tsx:37`, `ui/AllocationBar.tsx:48`, `ui/ProgressBar.tsx:63`, `SmartRulesPanel.tsx:179`, `TransactionRow.tsx:60`, `TransactionDrawer.tsx:113`. Colours not in the palette also exist (`SYSTEM_CATEGORY_COLOR '#6B7385'` at `selectors/ledger.ts:175`, `UNCATEGORIZED_COLOR`, legacy custom hexes, the string `'stone'` from `financeHydration.ts:50,85`).
6. `DESIGN.md:59-60` says identity colours avoid red, green, blue, cyan and amber; `:21-28` gives income green, expense red, transfer blue, pending amber one meaning each.
7. Unit tests assert the stored hex as the inline `backgroundColor` (`unit/categories-page.test.tsx:201,259,384-409`, `unit/tx-row.test.tsx:124`, `unit/ui-display.test.tsx:26,63,80`, `unit/wallets-page.test.tsx:303,311,368-389`). T795 will have to change them; T792 changes none.
8. `index.html:10` `theme-color` and `vite.config.ts:25-26` manifest colours are dark values in both themes today.

### 4.2 ADR 0103: header and decisions (the builder writes these, in this order)

Title: `# 0103: Paper Ledger light theme: the owner's palette on the existing tokens, display-only identity colours in light mode`.
Status block: `**Status:** Accepted.` with two bullets: `**Amends** DESIGN.md's identity-colour rule (section 1) for light mode only.` and `**Implemented by** Phase 143 (T793 to T796).` Date `2026-10-22`. A `## Context` listing: the owner's `docs/design/finlife-light-theme.md` (77 lines, light only); `src/index.css:170` / `:211`; ADR 0102 D1 (no new palette) and `docs/design/dashboard-2026-10/spec.md`; ADR 0038 and the palette parity. Then `## Decision` with D1 to D8 below, then `## Consequences` and `## Deliberately not done`.

**D1. Light only; dark byte-identical; no new colour names.** The palette goes onto the `:root` block. The `.dark` block, the dark values of every moved token (D5) and the dark identity values (D7) stay exactly as they are today. The design file's variable names are not added to CSS; they map onto existing tokens (D2 to D4). Why: AGENTS.md and the design file both say dark must not change.

**D2. The 14 non-category tokens, mapped.** A table: design token, the file's hex, the app token(s) that take it. Use exactly this:

| Design token | Hex | App tokens |
|---|---|---|
| `--bg` | `#F5F2EC` | `canvas` |
| `--surface` | `#FFFFFF` | `surface-1`, `header` |
| `--surface-2` | `#EEE9E0` | `surface-2` (`surface-3` and `control-active` are one step darker, `#E6E0D5`: D3b, D4) |
| `--border` | `#E0D8CB` | `line` |
| `--text` | `#1E1A15` | `fg` |
| `--text-muted` | `#675F53` | `fg-muted`, `adjust-text` |
| `--accent` | `#4338CA` | `brand-text`, `brand-soft-text`, `focus`, `brand-fill` (D5) |
| `--accent-hover` | `#3730A3` | `brand-fill-hover` (D5), `selected-text` |
| `--on-accent` | `#FFFFFF` | no token: `ui/Button.tsx:30` already sets `text-white` on the primary fill; white on `#4338CA` is 7.90:1 and on `#3730A3` 9.93:1 |
| `--accent-tint` | `#ECE8FB` | `brand-soft-bg`, `selected-bg`, `brand-tint` (D5) |
| `--accent-tint-border` | `#D9D2F5` | `brand-soft-line`, `logged-bg`, `brand-line` (D5) |
| `--income` | `#0E7A52` | `income-fill` exactly; `income-text` is `#0E7650` (D3a) |
| `--expense` | `#C0362C` | `expense-fill` exactly; `expense-text` is `#B6332A` (D3a, D3b) |
| `--warning` | `#B45309` | `pending-fill` exactly; `pending-text` is `#A94E08` (D3a) |

**D3. Where the design file's own claim is wrong, the text token is darker and the fill keeps the file's value.** The file says every pair passes 4.5:1 on `--bg`, `--surface` and `--surface-2` (`finlife-light-theme.md:76`). Measured with the formula in `scripts/wcag-tokens.mjs:39-50`, it does not:

| Pair | Ratio | Needed |
|---|---|---|
| `--warning #B45309` on `--bg #F5F2EC` | 4.49 | 4.5 |
| `--warning #B45309` on `--surface-2 #EEE9E0` | 4.15 | 4.5 |
| `--income #0E7A52` on `--surface-2` | 4.43 | 4.5 |
| `--cat-3 #2563EB` as transfer text on `--surface-2` | 4.27 | 4.5 |

- **D3a.** The four text tokens are the file's hue scaled to the least darkening that clears 4.5 on every surface the token sits on. For income, pending and transfer that is `canvas`, `surface-1` and `surface-2` (factors 0.97, 0.94, 0.96): `income-text #0E7650` (4.66 on `surface-2`), `pending-text #A94E08` (4.59), `transfer-text #245FE2` (4.56). For expense it also includes `surface-3` and `control-active` (D3b), factor 0.95: `expense-text #B6332A` (4.97 on `surface-2`, 4.57 on `surface-3`; at factor 0.96, `#B8342A`, it is 4.49 on `surface-3` and fails). The fills (`income-fill`, `expense-fill`, `pending-fill`, `transfer-fill`) keep the file's exact hexes; fills are never text. The file's `#C0362C` as text is 4.56 on `surface-2` but 4.20 on `surface-3` (D3b), which is why expense is darkened for a surface the file does not list.
- **D3b.** `surface-3` and `control-active` take `#E6E0D5` (they equal each other today in light, and `surface-3` equalled `line` there; `line` is now `#E0D8CB`, one step darker than `surface-3`, so the `OverflowMenu` panel border still reads). The file has no hover shade (its `--surface-2` is the only step below `--surface`), so this is derived: 8 levels per channel below `surface-2`, 1.09:1 against it, the same step as `canvas` to `surface-2` (1.08:1; the shipped surface-2 to surface-3 step is 1.13:1 in both themes). Why this and not `#EEE9E0`: a hover on a `surface-2` base (`DiaryEntryForm.tsx:47`, `TransactionForm.tsx:83`, `InlineMathInput.tsx:219`) must show a darker background, not only a text change. What it costs: `wcag-tokens.mjs:72-74` puts `fg`, `fg-secondary` and `expense-text` on `surface-3` and `control-active` (the `OverflowMenu` Delete item sits on `surface-3`, and on `control-active` when hovered), so `expense-text` is darkened to `#B6332A` (D3a). `fg` 13.17 and `fg-secondary` 7.43 pass there with room. Recorded: `income-text`, `pending-text` and `transfer-text` are 4.29, 4.23 and 4.20 on `surface-3`; the script does not place them there and no component does today (every `surface-3` and `control-active` use in `src/`, 2026-10-22, carries `text-fg`, `text-fg-secondary`, a `text-fg-muted` that turns to `text-fg` on hover, or `expense-text`), so T794 must not put them on it without darkening again.

**D4. Existing light tokens with no counterpart in the file, and what each becomes.** A table, exactly:

| Token | Today (light) | Becomes | Reason |
|---|---|---|---|
| `surface-3`, `control-active` | `#E2E8F0` | `#E6E0D5` | the file has no hover shade; one visible step darker than `surface-2` (1.09:1), see D3b; `fg` 13.17, `fg-secondary` 7.43, `expense-text` 4.57 on it |
| `line-control`, `line-strong` | `#CBD5E1` | `#CFC5B4` | the file has one border; these are the next step darker; `brand-text` vs `line-strong` (mood meter) 4.63:1, needs 3 |
| `line-input` | `#7C8BA1` | `#8A8172` | input edge needs 3:1 on `canvas`, `surface-1`, `surface-2`: 3.44, 3.84, 3.18 |
| `fg-secondary` | `#475569` | `#4A4338` | a step between `--text` and `--text-muted`: 8.74, 9.76, 8.07 on `canvas`, `surface-1`, `surface-2` |
| `fg-disabled` | `#94A3B8` | `#A39B8E` | exempt from contrast (WCAG 1.4.3 disabled controls) |
| `chip-text` | `#334155` | `#4A4338` | the file says chips are `surface-2` with default text; 8.07:1 on `adjust-bg` |
| `adjust-bg` | `#F1F5F9` | `#EEE9E0` | the file: chip background is `--surface-2` |
| `adjust-text` | `#475569` | `#675F53` | = `--text-muted`: 5.20:1 on `adjust-bg` |
| `selected-text` | `#4C1D95` | `#3730A3` | = `--accent-hover`: 8.28:1 on `selected-bg` |
| `focus` | `#7C3AED` | `#4338CA` | the file has no focus colour; the accent clears 3:1 on every surface (6.54 on `surface-2`, 6.54 on `surface-3`, 7.90 on `header`) |
| `income-bg` | `#ECFDF5` | `#ECF4F1` | 8% of `#0E7A52` over `#FFFFFF`; `income-text` on it 5.04:1 |
| `expense-bg` | `#FFF1F2` | `#FAEFEE` | 8% of `#C0362C` over white; `expense-text` on it 5.33:1 |
| `transfer-bg` | `#F0F9FF` | `#EEF3FD` | 8% of `#2563EB` over white; 4.95:1 |
| `pending-bg` | `#FFFBEB` | `#F9F1EB` | 8% of `#B45309` over white; `pending-text` 4.98:1 |
| `danger-line` | `#FECDD3` | `#ECC3C0` | 30% of `#C0362C` over white |
| `pending-line` | `#FCD34D` | `#E9CBB5` | 30% of `#B45309` over white |
| `pending-body` | `#78350F` | `#78350F` (unchanged) | warm brown already fits; 8.13:1 on `pending-bg` |
| `transfer-text` | `#075985` | `#245FE2` | D3a |
| `scrim` | `rgba(15,23,42,0.55)` | unchanged | an overlay, not a surface |

State in the ADR that the 8% and 30% mixes use the file's own hex (`--income`, `--expense`, `--cat-3`, `--warning`) over `#FFFFFF`, rounded per channel (the `expense-bg` and `danger-line` mixes use the fill `#C0362C`, not the darker `expense-text`); the file itself says "~10% opacity" for the tiles, and 8% keeps each hue's text at 4.5:1 or better on its tint over white (the file's own `--warning` on a 10% tint over white is 4.39).

**D5. The eleven theme-independent colours become theme variables.** In T793: move them from `@theme` (`:296-307`) to `:root` and `.dark` as variables, exposed by `@theme inline` as the same `--color-*` names (so no class name changes). Dark values are today's values exactly. Light values:

| Variable | Light | Dark (today, unchanged) |
|---|---|---|
| `brand-fill` | `#4338CA` | `#7C3AED` |
| `brand-fill-hover` | `#3730A3` | `#6D28D9` |
| `brand-tint` | `#ECE8FB` (solid) | `rgba(139, 92, 246, 0.12)` |
| `brand-line` | `#D9D2F5` (solid) | `rgba(139, 92, 246, 0.3)` |
| `income-fill` | `#0E7A52` | `#10B981` |
| `income-line` | `rgba(14, 122, 82, 0.3)` | `rgba(16, 185, 129, 0.3)` |
| `expense-fill` | `#C0362C` | `#F43F5E` |
| `expense-line` | `rgba(192, 54, 44, 0.3)` | `rgba(244, 63, 94, 0.3)` |
| `pending-fill` | `#B45309` | `#F59E0B` |
| `transfer-fill` | `#2563EB` | `#38BDF8` |
| `transfer-line` | `rgba(37, 99, 235, 0.3)` | `rgba(56, 189, 248, 0.3)` |

Radii, shadows, the font and the hero size stay in `@theme`. Why: the design file wants the primary button, the Left over card, the kept bar, income and expense fills in its palette in light mode, and these classes (`bg-brand-fill`, `bg-brand-tint`, `bg-expense-fill`, ...) cannot be light-only while they sit in `@theme`. `--text-hero`'s own CI lesson (T774) applies: T793 runs `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts` even though no size changes.

**D6. How a component is re-pointed (T794's rule).** A component moves to a different token only when its **dark** resolved colour stays what it is today: either the token it moves to already has the same dark value, or a new theme token is added whose `.dark` value is today's resolved dark value and whose light value is the design file's. Never a `dark:` twin on a token (`docs/contexts/ui-and-e2e.md:8`). A mapping in section 3 of the file that cannot be done under this rule stays as it is and goes in the T796 refactor-log "Deliberately not done". The ADR lists the known cases for T794's spec to settle: the Left over card border (`LeftOverCard.tsx:93` `border-line`; the file wants `accent-tint-border`; `DESIGN.md:30` keeps cards on a neutral edge, so this is the one card-edge exception, light only, and only as a new token); progress and Spent/Kept tracks (`LeftOverCard.tsx:135` and `ui/ProgressBar` use `line`; the file says `surface-2`); the empty mood dots (`line-strong`, the file says `--border`); the active tab's weight (`Navbar.tsx` `font-medium`, the file says semibold: that is typography, which the file's own rule 4 forbids changing, so it stays `font-medium`); `WalletTransferForm.tsx:108`'s `'#a8a29e'` fallback becomes a token class (the file: "no hard-coded hex in components").

**D7. Identity colours: display-only in light mode.** Stored hex, SQL, `identityColorMigration.ts`, `IDENTITY_PALETTE`, the swatch names and dark mode do not change. In light mode only, a stored palette colour is painted as a Paper Ledger value.
- **Mechanism (T795):** twelve variables `--identity-1` to `--identity-12`, numbered in `IDENTITY_PALETTE` order. `.dark` sets each to the stored hex (so dark is pixel-identical); `:root` sets the light value below. A function `identityDisplayColor(color: string): string` in `src/utils/identityPalette.ts` returns `var(--identity-N)` when `color` matches a palette hex case-insensitively, and returns `color` unchanged for anything else (`#6B7385`, legacy hexes, `'stone'`). Every site in section 4.1 item 5 that paints a stored colour calls it, picker swatches included; `identityColorName` and `isIdentityColor` still take the stored hex.
- **Why not the alternatives:** rewriting stored hexes changes dark mode and needs a live Supabase migration plus the SQL/helper parity (stop-and-ask); a JS theme hook re-renders every leaf and needs `isDark` plumbed to every paint site; attribute selectors cannot reach `stroke`, `color-mix` and `style` uses alike. A CSS variable works in `backgroundColor`, `color-mix(in srgb, var(...) 18%, transparent)` (`WalletsSection.tsx:120`) and SVG, and falls back to nothing when the variable is absent, so T795 must check `stroke` as an SVG attribute (`CategorySpendingCard.tsx:61`) in a real browser and use `style` if the attribute does not take `var()`.
- **The twelve values.** The five the file gives (`--cat-1..5`) are used verbatim and matched by role: the file names ซื้อของทั่วไป, ค่าข้าว, บิล & ค่าบริการ, บุหรี่, เสื้อผ้า, which are the shipped Groceries (Peach), Food & Dining (Rose), Housing & Utilities (Periwinkle), the brown one (Khaki) and Shopping & Apparel (Lavender). The other seven are derived to the same lightness range, kept at least 3:1 on a white card, and kept off the money hues where possible. Exactly:

| # | Name | Stored (dark) | Light | on white | on `surface-2` | Source |
|---|---|---|---|---|---|---|
| 1 | Tan | `#D9A066` | `#A16207` | 4.92 | 4.07 | derived |
| 2 | Blue | `#6C8EEF` | `#1E40AF` | 8.72 | 7.21 | derived |
| 3 | Teal | `#4FB7A8` | `#0E7490` | 5.36 | 4.43 | derived |
| 4 | Peach | `#F59E6B` | `#D97706` | 3.19 | 2.63 | file `--cat-1` |
| 5 | Rose | `#E879A6` | `#DB2777` | 4.60 | 3.80 | file `--cat-2` |
| 6 | Periwinkle | `#7DA2F0` | `#2563EB` | 5.17 | 4.27 | file `--cat-3` |
| 7 | Lavender | `#B69CF5` | `#7C3AED` | 5.70 | 4.71 | file `--cat-5` |
| 8 | Aqua | `#5CC8B8` | `#0891B2` | 3.68 | 3.05 | derived |
| 9 | Khaki | `#C7B38A` | `#8A6D46` | 4.82 | 3.99 | file `--cat-4` |
| 10 | Steel | `#8FA8C8` | `#5B7A9D` | 4.45 | 3.68 | derived |
| 11 | Orchid | `#D98FD0` | `#A21CAF` | 6.32 | 5.23 | derived |
| 12 | Iris | `#9C8CD9` | `#6B5FBF` | 5.23 | 4.33 | derived |

- Recorded honestly: Peach `#D97706` (the file's value) is 3.19:1 on white and 2.63:1 on `surface-2`; a chip dot and a donut segment always sit beside the category's name, so colour is not the only signal. Teal `#4FB7A8` was first `#0F766E`, which is 20 apart (CIE76) from `income-text`; `#0E7490` is 43 apart. The closest light pairs are Teal/Aqua (12), Blue/Periwinkle (18), Blue/Iris (19) and Aqua/Steel (20), against Teal/Aqua 6 and Blue/Periwinkle 14 in the dark set: the light set separates at least as well. The owner may swap any derived value; the five from the file are the owner's.
- **Amendment of `DESIGN.md:60`, light mode only:** identity colours may be blue (Blue, Periwinkle, Steel), amber or orange (Tan, Peach), or cyan (Teal, Aqua). Periwinkle `#2563EB` equals `transfer-fill` `#2563EB` (the file's cat-3 for transfer tiles); Peach and Tan sit near `pending` amber (CIE76 18 and 16 from `#B45309`). No identity value is red or green. Income versus expense is told apart by the sign (`+` and the `−` U+2212), never by colour alone, as the file's rule and `DESIGN.md:107` say; a transfer says it is not counted. The dark rule (avoid red, green, blue, cyan, amber) stays in force for dark.

**D8. Conflicts checked against ADR 0102 and `docs/design/dashboard-2026-10/spec.md`.** Record each:
1. 0102 D1 "no new palette, existing semantic tokens, no raw hex": **no conflict.** The token names and count stay; only their light values change, and 0102 itself lists a brand-theme change "as a token change in `src/index.css` checked with `node scripts/wcag-tokens.mjs`" (`spec.md:101`). One wording point: the `brand` hue is violet in dark and indigo (`#4338CA`) in light; `DESIGN.md` is reworded (4.4).
2. 0102 D2 "header and nav stay": **no conflict.** D2 left the mock's pill nav and avatar out; the design file recolours the existing nav, Add entry and period switcher with tokens only and changes no layout (its rule 4).
3. 0102 / `spec.md:9, 27` "transfer rows use the `transfer` hue, blue in the app": **consistent** with the file's `--cat-3` for transfer tiles; `transfer-fill` is `#2563EB` (D5). The file's "category-style colours" for wallet bars are the identity colours (D7).
4. `spec.md:28` net worth figure is `text-fg`: unchanged; the file only colours the debt figure `expense`.
5. `DESIGN.md:30-31` neutral card edge and "net or left-over is `fg`, `expense` when negative, never income green": kept; the Left over card border is the one exception (D6), and the file does not recolour the figure.
6. The file's "no hard-coded hex in components" vs `docs/contexts/ui-and-e2e.md:8` "data colours are exempt": the identity mechanism (D7) meets the file's rule by going through variables; the exemption stays for colours outside the palette.
7. `DESIGN.md:155` ProgressBar track `line`, `DayGroupHeader` `surface-2`, mood meter `line-strong`: D6.
8. The file's contrast claim: false for four pairs (D3).
9. Out of the file's reach: `index.html:10` `theme-color` and `vite.config.ts:25-26` are dark values in both themes already; not touched (Deliberately not done).

**`## Consequences`** (bullets): T793 changes `src/index.css`, `scripts/wcag-tokens.mjs` (lines `:96`, `:99-100`: light uses the solid tint and the new fills; add `fg`, `fg-secondary`, `fg-muted`, `expense-text`, `income-text`, `pending-text`, `transfer-text` on `brand-tint` for light (figures against `#ECE8FB` in 4.5; T793 recomputes them)) and `DESIGN.md`'s Tokens table. T794 follows D6. T795 changes the paint sites in 4.1 item 5, adds a unit guard that no component paints a stored colour without `identityDisplayColor`, and rewrites the unit assertions in 4.1 item 7. T796 closes the docs and adds the `identityDisplayColor` rule to `docs/contexts/ui-and-e2e.md` (a rule enters the contexts only once the code complies). A hover on a `surface-2` base shows a 1.09:1 step in light (D3b); `income-text`, `pending-text` and `transfer-text` stay off `surface-3`. Stored colours are never rewritten, so a signed-in user's rows are identical in the cloud, in exports and in dark.
**`## Deliberately not done`**: rewriting stored colours; changing dark; `theme-color` and manifest colours (a light/dark pair needs `media` meta tags and a CSP-hash check on `index.html`); a `[data-theme]` selector; new `--cat-*` tokens (the identity variables replace them); the active-tab weight.

### 4.3 Values the gate checks (text-landed)

The builder copies these into the ADR from this block, not retyped. The gate script in section 7 reads this block and checks every hex appears in the ADR.

```text
ADR-HEX
#F5F2EC #FFFFFF #EEE9E0 #E0D8CB #1E1A15 #675F53 #4338CA #3730A3 #ECE8FB #D9D2F5
#0E7A52 #C0362C #B45309 #0E7650 #A94E08 #245FE2 #CFC5B4 #8A8172 #4A4338 #A39B8E
#ECF4F1 #FAEFEE #EEF3FD #F9F1EB #ECC3C0 #E9CBB5 #78350F #2563EB
#A16207 #1E40AF #0E7490 #D97706 #DB2777 #7C3AED #0891B2 #8A6D46 #5B7A9D #A21CAF #6B5FBF
#E6E0D5 #B6332A
#D9A066 #6C8EEF #4FB7A8 #F59E6B #E879A6 #7DA2F0 #B69CF5 #5CC8B8 #C7B38A #8FA8C8 #D98FD0 #9C8CD9
END
```

(Pairs already checked by the spec author, at commit `1344a1c`, and again after the amendment (`surface-3` and `control-active` `#E6E0D5`, `expense-text` `#B6332A`), by running a copy of `scripts/wcag-tokens.mjs` against a temporary `:root` with the D2 to D5 values: all 66 light pairs and all dark pairs pass, with the two hard-coded lines in item 4.1.4 replaced by the light values, and so do the 8 text-on-`brand-tint #ECE8FB` pairs T793 adds (Consequences). The reviewer repeats this from the table, with the formula at `scripts/wcag-tokens.mjs:39-50`.)

### 4.4 `DESIGN.md` edit (the builder's exact scope)

Add one new section, titled `### Light palette: Paper Ledger (ADR 0103)`, immediately after the "Identity colours" subsection (after `DESIGN.md:60`, before the `---` at `:62`). Contents, in this order:
1. A status line in the form ADR 0102's Dashboard section uses: `**Status:** target, shipped by Phases 143 (T793 to T796). The Tokens table above shows the values in force until T793 rewrites its Light column.`
2. One sentence: the authority is `docs/design/finlife-light-theme.md` and ADR 0103; light only; dark unchanged.
3. The D2 table (14 tokens) and the D4 list collapsed to one sentence naming the roles, not the whole table; link both to ADR 0103 for the full values.
4. The rule: `brand` is violet in dark and indigo in light; text tokens `income-text`, `expense-text`, `pending-text`, `transfer-text` are darker than their fills (D3a); `surface-3` and `control-active` are `#E6E0D5` in light, one visible step darker than `surface-2`, so a hover on a `surface-2` base shows (D3b); fills and text of one hue are different tokens.
5. The identity-colour rule for light mode (D7): stored colours do not change; light mode paints them through `--identity-N`; the amendment to the line above (blue, amber, cyan allowed in light only).
6. The 12-row table of D7 (stored, light, name).

Also edit, in the same file: line 4's "Dark is the look it was designed in, and a matching light theme ships alongside it" gets `The light theme is the Paper Ledger palette (ADR 0103).` appended; line 59 "Identity colours" first paragraph gets one sentence at its end: `In light mode they are painted through the Paper Ledger values below (ADR 0103).`; and a new row in "Deviations from the spec" after line 151's "Dark only | Dark and light" row: `| Light values "derived per role" | The Paper Ledger palette, mapped onto the same tokens | The owner's light-theme spec, 2026-10-22 (ADR 0103). |` (match that table's column count and order by reading it first). Do not change the Tokens table's Light column (T793 does) or any other line.

### 4.5 Contrast evidence the ADR carries

A short table in the ADR, "Text pairs on `canvas` / `surface-1` / `surface-2`" (ratios, 2 decimals, from the formula above):

| Token | `canvas` | `surface-1` | `surface-2` |
|---|---|---|---|
| `fg #1E1A15` | 15.48 | 17.30 | 14.31 |
| `fg-secondary #4A4338` | 8.74 | 9.76 | 8.07 |
| `fg-muted #675F53` | 5.63 | 6.29 | 5.20 |
| `brand-text #4338CA` | 7.07 | 7.90 | 6.54 |
| `income-text #0E7650` | 5.04 | 5.64 | 4.66 |
| `expense-text #B6332A` | 5.38 | 6.01 | 4.97 |
| `pending-text #A94E08` | 4.97 | 5.56 | 4.59 |
| `transfer-text #245FE2` | 4.93 | 5.51 | 4.56 |
| `adjust-text #675F53` | 5.63 | 6.29 | 5.20 |

and, as lines under it: on `header #FFFFFF` each equals its `surface-1` figure; on `surface-3` and `control-active` `#E6E0D5` `fg` 13.17, `fg-secondary` 7.43, `expense-text` 4.57 (needs 4.5), and for information `fg-muted` 4.79, `income-text` 4.29, `pending-text` 4.23, `transfer-text` 4.20; on `brand-tint #ECE8FB` `fg` 14.42, `fg-secondary` 8.14, `fg-muted` 5.24, `brand-text` 6.59, `expense-text` 5.01, `income-text` 4.70, `pending-text` 4.63, `transfer-text` 4.59; `line-input` 3.44 / 3.84 / 3.18 (needs 3); `focus` 7.07 / 7.90 / 6.54, and 6.02 on `surface-3` (needs 3); white on `brand-fill` 7.90 and on its hover 9.93.

### 4.6 Verify before writing

Every number in the ADR must be reproduced by the builder with the formula at `scripts/wcag-tokens.mjs:39-50`, not copied from this spec unchecked. Where one differs from the spec by more than 0.01, the builder reports it in its build report and uses its own figure; it does not change a hex.

### 4.7 Ledger edit (exact)

In `docs/audit/task-ledger.md`, insert before `## Backlog` (currently `:82`), after the Phase 142 table, this section (match the Phase 142 block's shape; the `Files` cells in backticks):

```
## Phase 143 - Paper Ledger light theme (ADR 0103)

Branch `phase-143-paper-ledger-light-theme`, cut from `main` at `1344a1c`. No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T792 | ADR 0103: map the Paper Ledger palette onto the existing tokens, display-only light-mode identity colours, DESIGN.md light palette section; commit the design input | `docs/design/finlife-light-theme.md`, `docs/audit/decisions/0103-paper-ledger-light-theme.md`, `DESIGN.md`, `docs/audit/task-ledger.md` | in-progress | | |
| T793 | Light `:root` values and themed fills in `src/index.css` (D2 to D5); `scripts/wcag-tokens.mjs` follows; DESIGN.md Tokens table Light column | `src/index.css`, `scripts/wcag-tokens.mjs`, `DESIGN.md`, `docs/audit/task-ledger.md` | todo | | |
| T794 | Re-point the components whose token differs from the design file's section 3, under D6; the `#a8a29e` fallback in `WalletTransferForm.tsx` | `src/components/`, `src/index.css`, `docs/audit/task-ledger.md` | todo | | |
| T795 | Light-mode identity colours: `--identity-1..12`, `identityDisplayColor`, the paint sites in 4.1 item 5, the unit assertions and a guard test | `src/utils/identityPalette.ts`, `src/index.css`, `src/components/`, `unit/`, `docs/contexts/ui-and-e2e.md`, `docs/audit/task-ledger.md` | todo | | |
| T796 | Phase 143 closing docs: refactor-log entry (with Surprises and Deliberately not done), baseline-metrics section | `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` | todo | | |
```

Leave T792's `Commit` empty and set its `Gate result` and `Status` (`done`) when it lands, as the ledger's header says.

## 5. Parity map

none touched by T792. Two rows constrain T795 and are named in the ADR: the identity-colour row (`utils/identityColorMigration.ts` with `20261002_phase63_identity_colors.sql`: stored hexes must not move) and the spec-asserted DOM ids row (no id changes in T793 to T795).

## 6. Tests to add

none. T792 changes only Markdown (an ADR, `DESIGN.md`, the ledger, a committed design file): no behaviour can change. Stage 02 step 4 and stage 03 step 6 do not apply. (The code tasks T793 to T795 get their own specs; T795 is where tests first change.)

## 7. Gates

AGENTS.md's tier for a docs-only change: nothing, unless a doc states a count or path, which is then checked against the code. T792 states paths and `file:line` references, so:

```
git status --porcelain
git diff --stat
git ls-files --eol DESIGN.md docs/audit/task-ledger.md docs/audit/decisions/0103-paper-ledger-light-theme.md
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/decisions/0103-paper-ledger-light-theme.md workflow/stages/01_spec/output/task-T792-spec.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
node -e "const fs=require('fs');const s=fs.readFileSync('workflow/stages/01_spec/output/task-T792-spec.md','utf8');const b=s.split('ADR-HEX')[1].split('END')[0];const hex=[...new Set(b.match(/#[0-9A-F]{6}/g))];const a=fs.readFileSync('docs/audit/decisions/0103-paper-ledger-light-theme.md','utf8').toUpperCase();const miss=hex.filter(h=>!a.includes(h));console.log(hex.length,'hex checked, missing:',miss.join(' ')||'none')"
git diff --no-index --stat /dev/null docs/design/finlife-light-theme.md
node scripts/wcag-tokens.mjs
```

Expected: `git status --porcelain` shows only the four target files plus the three stage outputs and nothing under `src/`, `unit/`, `tests/`, `scripts/`, `supabase/`, `api/`; the two `git ls-files --eol` lines for the existing files show `w/crlf` kept (the new ADR should match: CRLF, as the other ADRs); em dash counts 0 in the ADR, in the spec and in the diff's added lines; the text-landed script prints `none` (53 hexes, the number in section 4.3); the design file's `git diff --no-index` stat shows 77 lines added with no edit (and `git hash-object docs/design/finlife-light-theme.md` equals the value taken before the build, which the builder records in its report); `node scripts/wcag-tokens.mjs` still prints `All token pairs pass.` (nothing in `src/index.css` moved). Also verify by hand that every `file:line` the ADR cites exists as cited (`grep -n` each) and that the ADR's contrast numbers reproduce (section 4.6).

## 8. Production touch points

none. No SQL, no `/api/*` request, no MCP or CLI write, no signing in, no dependency, no file deletion. The orchestrator's commit of this task on the phase branch is the standing go-ahead in `AGENTS.md`'s ICM section; it stages the four target files by path, plus `task-T792-spec.md`, `task-T792-build.md` and `task-T792-review.md`.

## 9. Out of scope

- Any edit under `src/`, `unit/`, `tests/`, `scripts/`, `supabase/`, `api/`, `public/`, `index.html`, `vite.config.ts` or `vercel.json`. In particular, do not touch `src/index.css` (T793), the components (T794), `identityPalette.ts` (T795), or `scripts/wcag-tokens.mjs` (T793).
- The Tokens table's Light column in `DESIGN.md` (T793), `docs/contexts/ui-and-e2e.md` (T795, once the code complies), `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` (T796, which ships the phase), `AGENTS.md`, `README.md`.
- Editing `docs/design/finlife-light-theme.md` (commit it unchanged), `docs/design/finlife-redesign-spec.md`, any HTML under `docs/design/`, `docs/audit/archive/`.
- Rewriting stored colours, the phase 63 SQL, or `utils/identityColorMigration.ts`.
- The PWA `theme-color` and manifest colours.
- Choosing different values from the tables above: the mapping is the plan. If a number does not reproduce (4.6), report it; do not change a hex on your own.
