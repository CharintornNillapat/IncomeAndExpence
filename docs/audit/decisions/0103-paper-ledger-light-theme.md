# 0103: Paper Ledger light theme: the owner's palette on the existing tokens, display-only identity colours in light mode

**Status:** Accepted.
- **Amends** DESIGN.md's identity-colour rule (section 1) for light mode only.
- **Implemented by** Phase 143 (T793 to T796).

**Date:** 2026-10-22

## Context

1. The owner provided `docs/design/finlife-light-theme.md` (77 lines, light only) specifying the "Paper Ledger" light theme.
2. Light mode is currently defined in `:root` (`src/index.css:170`), dark mode in `.dark` (`src/index.css:211`). The owner's suggested `:root[data-theme="light"]` selector is not used.
3. ADR 0102 D1 established "no new palette, existing semantic tokens, no raw hex" (`docs/design/dashboard-2026-10/spec.md`).
4. ADR 0038 established the 12-colour identity palette and SQL/helper parity (`utils/identityColorMigration.ts`, `20261002_phase63_identity_colors.sql`).

## Decision

### D1. Light only; dark byte-identical; no new colour names

The palette goes onto the `:root` block. The `.dark` block, the dark values of every moved token (D5) and the dark identity values (D7) stay exactly as they are today. The design file's variable names are not added to CSS; they map onto existing tokens (D2 to D4).

Why: AGENTS.md and the design file both say dark must not change.

### D2. The 14 non-category tokens, mapped

The 14 non-category design tokens map onto existing app tokens as follows:

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

### D3. Text tokens darkened for contrast; fills keep the file's values

The design file states that every pair passes 4.5:1 on `--bg`, `--surface` and `--surface-2` (`finlife-light-theme.md:76`). Measured with the formula in `scripts/wcag-tokens.mjs:39-50`, it does not:

| Pair | Ratio | Needed |
|---|---|---|
| `--warning #B45309` on `--bg #F5F2EC` | 4.49 | 4.5 |
| `--warning #B45309` on `--surface-2 #EEE9E0` | 4.15 | 4.5 |
| `--income #0E7A52` on `--surface-2` | 4.43 | 4.5 |
| `--cat-3 #2563EB` as transfer text on `--surface-2` | 4.27 | 4.5 |

- **D3a.** The four text tokens are the file's hue scaled to the least darkening that clears 4.5 on every surface the token sits on. For income, pending and transfer that is `canvas`, `surface-1` and `surface-2` (factors 0.97, 0.94, 0.96): `income-text #0E7650` (4.66 on `surface-2`), `pending-text #A94E08` (4.59), `transfer-text #245FE2` (4.56). For expense it also includes `surface-3` and `control-active` (D3b), factor 0.95: `expense-text #B6332A` (4.97 on `surface-2`, 4.57 on `surface-3`; at factor 0.96, `#B8342A`, it is 4.49 on `surface-3` and fails). The fills (`income-fill`, `expense-fill`, `pending-fill`, `transfer-fill`) keep the file's exact hexes; fills are never text. The file's `#C0362C` as text is 4.56 on `surface-2` but 4.20 on `surface-3` (D3b), which is why expense is darkened for a surface the file does not list.
- **D3b.** `surface-3` and `control-active` take `#E6E0D5` (they equal each other today in light, and `surface-3` equalled `line` there; `line` is now `#E0D8CB`, one step darker than `surface-3`, so the `OverflowMenu` panel border still reads). The file has no hover shade (its `--surface-2` is the only step below `--surface`), so this is derived: 8 levels per channel below `surface-2`, 1.09:1 against it, the same step as `canvas` to `surface-2` (1.08:1; the shipped surface-2 to surface-3 step is 1.13:1 in both themes). Why this and not `#EEE9E0`: a hover on a `surface-2` base (`DiaryEntryForm.tsx:47`, `TransactionForm.tsx:83`, `InlineMathInput.tsx:219`) must show a darker background, not only a text change. What it costs: `wcag-tokens.mjs:72-74` puts `fg`, `fg-secondary` and `expense-text` on `surface-3` and `control-active` (the `OverflowMenu` Delete item sits on `surface-3`, and on `control-active` when hovered), so `expense-text` is darkened to `#B6332A` (D3a). `fg` 13.17 and `fg-secondary` 7.43 pass there with room. Recorded: `income-text`, `pending-text` and `transfer-text` are 4.29, 4.23 and 4.20 on `surface-3`; the script does not place them there and no component does today (every `surface-3` and `control-active` use in `src/`, 2026-10-22, carries `text-fg`, `text-fg-secondary`, a `text-fg-muted` that turns to `text-fg` on hover, or `expense-text`), so T794 must not put them on it without darkening again.

### D4. Existing light tokens with no counterpart in the file, and what each becomes

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

The 8% and 30% mixes use the file's own hex (`--income`, `--expense`, `--cat-3`, `--warning`) over `#FFFFFF`, rounded per channel (the `expense-bg` and `danger-line` mixes use the fill `#C0362C`, not the darker `expense-text`). The file itself says "~10% opacity" for the tiles, and 8% keeps each hue's text at 4.5:1 or better on its tint over white (the file's own `--warning` on a 10% tint over white is 4.39).

### D5. The eleven theme-independent colours become theme variables

In T793: move them from `@theme` (`src/index.css:296-307`) to `:root` and `.dark` as variables, exposed by `@theme inline` as the same `--color-*` names (so no class name changes). Dark values are today's values exactly. Light values:

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

### D6. How a component is re-pointed (T794's rule)

A component moves to a different token only when its **dark** resolved colour stays what it is today: either the token it moves to already has the same dark value, or a new theme token is added whose `.dark` value is today's resolved dark value and whose light value is the design file's. Never a `dark:` twin on a token (`docs/contexts/ui-and-e2e.md:8`). A mapping in section 3 of the file that cannot be done under this rule stays as it is and goes in the T796 refactor-log "Deliberately not done".

Known cases for T794's spec to settle:
- The Left over card border (`LeftOverCard.tsx:93` `border-line`; the file wants `accent-tint-border`; `DESIGN.md:30` keeps cards on a neutral edge, so this is the one card-edge exception, light only, and only as a new token).
- Progress and Spent/Kept tracks (`LeftOverCard.tsx:135` and `ui/ProgressBar` use `line`; the file says `surface-2`).
- The empty mood dots (`line-strong`, the file says `--border`).
- The active tab's weight (`Navbar.tsx` `font-medium`, the file says semibold: that is typography, which the file's own rule 4 forbids changing, so it stays `font-medium`).
- `WalletTransferForm.tsx:108`'s `'#a8a29e'` fallback becomes a token class (the file: "no hard-coded hex in components").

### D7. Identity colours: display-only in light mode

Stored hex, SQL, `identityColorMigration.ts`, `IDENTITY_PALETTE`, the swatch names and dark mode do not change. In light mode only, a stored palette colour is painted as a Paper Ledger value.

- **Mechanism (T795):** twelve variables `--identity-1` to `--identity-12`, numbered in `IDENTITY_PALETTE` order. `.dark` sets each to the stored hex (so dark is pixel-identical); `:root` sets the light value below. A function `identityDisplayColor(color: string): string` in `src/utils/identityPalette.ts` returns `var(--identity-N)` when `color` matches a palette hex case-insensitively, and returns `color` unchanged for anything else (`#6B7385`, legacy hexes, `'stone'`). Every site that paints a stored category or wallet colour calls it, picker swatches included (T795's spec lists them); `identityColorName` and `isIdentityColor` still take the stored hex.
- **Why not the alternatives:** rewriting stored hexes changes dark mode and needs a live Supabase migration plus the SQL/helper parity (stop-and-ask); a JS theme hook re-renders every leaf and needs `isDark` plumbed to every paint site; attribute selectors cannot reach `stroke`, `color-mix` and `style` uses alike. A CSS variable works in `backgroundColor`, `color-mix(in srgb, var(...) 18%, transparent)` (`WalletsSection.tsx:120`) and SVG, and falls back to nothing when the variable is absent, so T795 must check `stroke` as an SVG attribute (`CategorySpendingCard.tsx:61`) in a real browser and use `style` if the attribute does not take `var()`.
- **The twelve values.** The five the file gives (`--cat-1..5`) are used verbatim and matched by role: the file names ซื้อของทั่วไป, ค่าข้าว, บิล & ค่าบริการ, บุหรี่, เสื้อผ้า, which are the shipped Groceries (Peach), Food & Dining (Rose), Housing & Utilities (Periwinkle), the brown one (Khaki) and Shopping & Apparel (Lavender). The other seven are derived to the same lightness range, kept at least 3:1 on a white card, and kept off the money hues where possible:

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
- **Amendment of `DESIGN.md:60`, light mode only:** identity colours may be blue (Blue, Periwinkle, Steel), amber or orange (Tan, Peach), or cyan (Teal, Aqua). Periwinkle `#2563EB` equals `transfer-fill` `#2563EB` (the file's cat-3 for transfer tiles); Peach and Tan sit near `pending` amber (CIE76 18 and 16 from `#B45309`). No identity value is red or green. Income versus expense is told apart by the sign (`+` and the `−` U+2212), never by colour alone, as the file's rule and `DESIGN.md:150` say; a transfer says it is not counted. The dark rule (avoid red, green, blue, cyan, amber) stays in force for dark.

### D8. Conflicts checked against ADR 0102 and dashboard redesign spec

1. 0102 D1 "no new palette, existing semantic tokens, no raw hex": **no conflict.** The token names and count stay; only their light values change, and 0102 itself lists a brand-theme change "as a token change in `src/index.css` checked with `node scripts/wcag-tokens.mjs`" (`spec.md:101`). The `brand` hue is violet in dark and indigo (`#4338CA`) in light; `DESIGN.md` is reworded accordingly.
2. 0102 D2 "header and nav stay": **no conflict.** D2 left the mock's pill nav and avatar out; the design file recolours the existing nav, Add entry and period switcher with tokens only and changes no layout (its rule 4).
3. 0102 / `spec.md:9, 27` "transfer rows use the `transfer` hue, blue in the app": **consistent** with the file's `--cat-3` for transfer tiles; `transfer-fill` is `#2563EB` (D5). The file's "category-style colours" for wallet bars are the identity colours (D7).
4. `spec.md:28` net worth figure is `text-fg`: unchanged; the file only colours the debt figure `expense`.
5. `DESIGN.md:30-31` neutral card edge and "net or left-over is `fg`, `expense` when negative, never income green": kept; the Left over card border is the one exception (D6), and the file does not recolour the figure.
6. The file's "no hard-coded hex in components" vs `docs/contexts/ui-and-e2e.md:8` "data colours are exempt": the identity mechanism (D7) meets the file's rule by going through variables; the exemption stays for colours outside the palette.
7. `DESIGN.md:187` (`ProgressBar` track `line`), `DESIGN.md:192` (`DayGroupHeader` `surface-2`), and the mood meter (`line-strong`): D6.
8. The file's contrast claim: false for four pairs (D3).
9. Out of the file's reach: `index.html:10` `theme-color` and `vite.config.ts:25-26` are dark values in both themes already; not touched (Deliberately not done).

### Contrast evidence

Text pairs on `canvas` / `surface-1` / `surface-2` (ratios, 2 decimals, from `scripts/wcag-tokens.mjs:39-50`):

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

- On `header #FFFFFF` each equals its `surface-1` figure.
- On `surface-3` and `control-active` `#E6E0D5`: `fg` 13.17, `fg-secondary` 7.43, `expense-text` 4.57 (needs 4.5); and for information: `fg-muted` 4.79, `income-text` 4.29, `pending-text` 4.23, `transfer-text` 4.20.
- On `brand-tint #ECE8FB`: `fg` 14.42, `fg-secondary` 8.14, `fg-muted` 5.24, `brand-text` 6.59, `expense-text` 5.01, `income-text` 4.70, `pending-text` 4.63, `transfer-text` 4.59.
- `line-input #8A8172`: 3.44 on `canvas`, 3.84 on `surface-1`, 3.18 on `surface-2` (needs 3).
- `focus #4338CA`: 7.07 on `canvas`, 7.90 on `surface-1`, 6.54 on `surface-2`, and 6.02 on `surface-3` (needs 3).
- White on `brand-fill #4338CA`: 7.90; white on `brand-fill-hover #3730A3`: 9.93.

## Consequences

- T793 changes `src/index.css`, `scripts/wcag-tokens.mjs` (lines `:96`, `:99-100`: light uses the solid tint and the new fills; add `fg`, `fg-secondary`, `fg-muted`, `expense-text`, `income-text`, `pending-text`, `transfer-text` on `brand-tint` for light) and `DESIGN.md`'s Tokens table.
- T794 follows D6 for component token re-pointing.
- T795 changes every site that paints a stored category or wallet colour (T795's spec lists them), adds a unit guard that no component paints a stored colour without `identityDisplayColor`, and rewrites unit assertions.
- T796 closes the docs and adds the `identityDisplayColor` rule to `docs/contexts/ui-and-e2e.md`.
- A hover on a `surface-2` base shows a 1.09:1 step in light (D3b); `income-text`, `pending-text` and `transfer-text` stay off `surface-3`.
- Stored colours are never rewritten, so a signed-in user's rows are identical in the cloud, in exports and in dark.

## Deliberately not done

- Rewriting stored colours in database or migrations.
- Changing dark mode tokens or appearance.
- `theme-color` and manifest colours in `index.html:10` and `vite.config.ts:25-26` (a light/dark pair needs `media` meta tags and a CSP-hash check on `index.html`).
- A `[data-theme]` CSS selector.
- New `--cat-*` tokens in CSS (the identity variables replace them).
- The active-tab font weight (stays `font-medium` per typography rules).

## Amendment (T794)

### Component token re-pointing verdicts (ADR 0103 D6)

Section 3 of `docs/design/finlife-light-theme.md` evaluated against the components in the codebase:

1. **Top nav:** `--surface` bg, `--border` bottom border (`Navbar.tsx:97` `bg-header border-b border-line`) is OK.
2. **Active tab:** `accent-tint` bg + `accent` text (`Navbar.tsx:142` `bg-brand-soft text-brand-soft-text`) is OK. Weight stays `font-medium` (typography rule).
3. **Inactive tabs:** `text-muted` (`Navbar.tsx:143` `text-fg-secondary`). **Stays.** `fg-secondary` is the step ADR D4 added between `text` and `text-muted`; dark `#A3AABB` vs `fg-muted` `#8A93A6` would change dark appearance, and a new token would only re-state `fg-muted` for one control.
4. **Add entry:** `accent` bg, hover `accent-hover` (`Button.tsx:30` `bg-brand-fill hover:bg-brand-fill-hover text-white`) is OK.
5. **Period switcher container:** `--surface` container + `--border` (`SegmentedControl.tsx:77` `bg-surface-1 ... border-line`) is OK.
6. **Period switcher selected segment:** `--surface-2` bg + `--text` (`SegmentedControl.tsx:105` `bg-control-active`). **Change (new token `segment-active`)**: mapping directly to `surface-2` would turn dark `#262B3A` into `#0F131B`, violating D6 dark byte-invariance.
7. **Hero card ground:** `accent-tint` bg (`LeftOverCard.tsx:93` `bg-brand-tint`) is OK.
8. **Hero card border:** `accent-tint-border` border (`LeftOverCard.tsx:93` `border-line`). **Change (new token `hero-line`)**: `brand-line` is translucent violet in dark, which would change it; this is the one card-edge exception (DESIGN.md line 30, ADR D6).
9. **Sparkline stroke:** `accent` (`LeftOverCard.tsx:58` `stroke-brand`) is OK.
10. **Spent/Kept:** Spent `expense`, Kept `accent` (`LeftOverCard.tsx:136-137` `bg-expense-fill`, `bg-brand-fill`) is OK.
11. **Income / Spending cards:** `surface`, `income` / `expense` amounts (`CashFlowCard.tsx`) is OK.
12. **Donut hole & comparison box:** `surface` / `surface-2` (`CategorySpendingCard.tsx:114,169`) is OK.
13. **Debt payoff % and fill:** `income` (`DebtPayoffCard.tsx`) is OK.
14. **Debt payoff track:** `surface-2` (`ProgressBar.tsx:59` `bg-line`). **Stays.** `DebtPayoffCard.tsx:72-77` puts `ProgressBar` inside an `Inset` (`surface-2`): a `surface-2` track would match its ground (1.00:1) and vanish in light; in dark, `surface-2` `#0F131B` is darker than `line` `#1F2532`, a dark change. The Spent/Kept gap track at `LeftOverCard.tsx:135` (`bg-line`) is not a progress track in the design file and also stays.
15. **"Needed this month":** `bg` or `surface-2`, amount `expense` (`DebtPayoffCard.tsx` `Inset` + `text-expense`) is OK (`surface-2`).
16. **Negative debt balance:** `expense` (`DebtPayoffCard.tsx` `text-expense`) is OK.
17. **"Make a repayment" outline:** transparent bg, `accent` border and text (`DebtPayoffCard.tsx:95` `Button variant="soft"`). **Stays.** An outline requires a per-button variant and two new tokens, and `soft` is shared by Log today and other buttons. Listed in T796 Deliberately not done.
18. **Date header rows:** `surface-2` (`DayGroupHeader.tsx:25` `bg-surface-2`) is OK.
19. **Expense / transfer icon tile:** at ~10% tint (`txTypeMeta.ts`) is OK (8% solid tint, ADR D4).
20. **Category chips:** `surface-2` + dot (`Chip.tsx` `bg-adjust-tint`) is OK.
21. **Debt figure:** `expense` (`WalletsSection.tsx:61`) is OK.
22. **Mood day tiles:** `--bg` (`MoodSpendingCard.tsx:50` `bg-surface-2`). **Change (new token `mood-tile`)**: using `canvas` `#0B0E14` would change dark `#0F131B`.
23. **Filled mood dots:** `accent` (`MoodMeter.tsx:12` `bg-brand`) is OK.
24. **Empty mood dots:** `--border` (`MoodMeter.tsx:12` `bg-line-strong`). **Change (new token `mood-empty`)**: `line` is `#1F2532` in dark, which would change dark `#2A3140`.
25. **Mood amounts:** `expense`, 0 in `text-muted` (`MoodSpendingCard.tsx:56`) is OK.
26. **Links:** `accent`, hover `accent-hover` (`DashboardLink.tsx:15` `text-brand hover:underline`). **Stays.** Adding a hover colour is new behaviour (not a re-point), and `brand-fill-hover` as text would be `#6D28D9` on dark `#131722` (under 4.5:1). Listed in T796 Deliberately not done.
27. **Wallet icon fallback:** (`WalletTransferForm.tsx:108`). **Change (new token `wallet-fallback`)**: replaces raw `#a8a29e` hex fallback with a semantic token.

### Five theme tokens (T794)

| Variable | Class | Dark (today's value) | Light | Replaces | Light value source |
|---|---|---|---|---|---|
| `hero-line` | `border-hero-line` | `#1F2532` (`line`) | `#D9D2F5` | `border-line` on the Left over card | `--accent-tint-border` |
| `segment-active` | `bg-segment-active` | `#262B3A` (`control-active`) | `#EEE9E0` | `bg-control-active` on the pill | `--surface-2` |
| `mood-tile` | `bg-mood-tile` | `#0F131B` (`surface-2`) | `#F5F2EC` | `bg-surface-2` on a day tile | `--bg` |
| `mood-empty` | `bg-mood-empty` | `#2A3140` (`line-strong`) | `#E0D8CB` | `bg-line-strong` on an empty bar | `--border` |
| `wallet-fallback` | `bg-wallet-fallback` | `#A8A29E` (pre-existing hex) | `#8A8172` (`line-input` light) | `'#a8a29e'` fallback | derived: white on it is 3.84:1 (3:1 needed for icon) |

### Contrast and dark figures recorded

- In light mode, white on `wallet-fallback` (`#8A8172`) is 3.84:1 (clearing the 3:1 non-text contrast threshold).
- In dark mode, white on `wallet-fallback` (`#A8A29E`) is 2.52:1. This is a pre-existing figure from the hard-coded JSX hex, preserved under D6 dark byte-invariance, and recorded here as known and unchanged.
