# 0025 — Semantic design tokens: the stone palette is retired

**Status:** Accepted. **Implements** `DESIGN.md` (committed in Phase 53, T183). **Partly closes** antislop audit 001 findings 1-3 (text contrast) and 9 (no recorded direction); the rest of that audit is Phase 53b.
**Date:** 2026-09-27

## Context

Until Phase 53 the app had no design direction on record. Its look was Tailwind's warm `stone-*` scale with emerald as the primary accent, written as literal light/dark pairs at every call site: about 1,440 `stone-*` classes plus some 350 emerald, rose, amber, indigo and blue ones across 44 files.

Two problems came from that shape:

- **Contrast failed in both themes, in 180+ places.** Antislop audit 001 measured `text-stone-400` at 2.59:1 on white (86 uses), `dark:text-stone-500` at 3.64:1 on `stone-900` (62 uses), and `text-emerald-600` / white-on-`emerald-600` at 3.67:1. Every one was a class chosen per site, so no single fix could reach them.
- **Nothing tied a colour to a meaning.** Emerald meant "money in" on a cashflow card, "primary action" on the dark-mode Quick Add, "selected" on a chip and "synced" on the navbar badge. Indigo meant "transfer" in one table and "a generic accent" in the next.

`DESIGN.md` now sets the direction: slate surfaces, violet as the one brand colour, and five hues with one job each.

## Decision

### Tokens are CSS variables that flip with the theme

`src/index.css` defines each token twice, once on `:root` (light) and once on `.dark`. `@theme inline` then maps the variables onto Tailwind colour utilities. So `bg-surface-1` is the right colour in both themes, and a migrated class never needs a `dark:` twin.

- **Neutrals:** `canvas`, `surface-1`, `surface-2`, `surface-3`, `line`, `line-input`, `fg`, `fg-secondary`, `fg-muted`, `focus`, `scrim`.
- **Semantic text:** `brand`, `income`, `expense`, `pending`, `transfer`. Each flips to the shade that passes on the current theme's surfaces.
- **Theme-independent (plain `@theme`):**
  - `*-fill` (the 500 shades): for dots, bars and swatches, never behind text. The one exception is `brand-fill`, which carries white text at 5.70:1.
  - `*-tint` (12%) and `*-line` (30%): for badges and banners.
  - `shadow-modal` and `shadow-quick-add`: the only elevations DESIGN.md allows.
  - `font-mono` and `font-sans`.

**Rejected: remapping Tailwind's `stone-*` scale in `@theme`.** It would have been a tiny diff, but:

- `stone-400` would then name a slate colour.
- The light and dark sides of each old pair used different stone steps, so no single remap could hit DESIGN.md's values in both themes.
- The contrast failures were per-site choices, not scale values.

**Rejected: paired static tokens** (`bg-surface-1 dark:bg-surface-1-dark`). They keep today's doubling at every site for no gain.

### A colour is chosen by meaning, not by the old class

Emerald split in two:

- **`income`:** money in, success, synced.
- **`brand`:** the app's primary action, active tab, selection or a generic highlight.

The same test applied to indigo and blue: `transfer` when the element is about moving money between the user's own wallets, `brand` or `focus` otherwise.

Colours that come from data were exempt and left alone:

- a wallet's or category's own `color`;
- `categoryTint` / `CategoryChip`;
- chart segments.

### Contrast is checked by a script, not by eye

`scripts/wcag-tokens.mjs` reads the two token blocks straight from `src/index.css` and checks:

- every text token on `canvas` / `surface-1` / `surface-2`, and primary and secondary text on `surface-3`, at 4.5:1;
- `line-input` and `focus` at 3:1 (WCAG 1.4.11);
- every semantic text colour on its own tint composited over `surface-1` and `surface-2`, which is where badges put it;
- white on the brand fill and its hover.

The tint check found the one place DESIGN.md's own values fell short: light-mode `#B45309` (amber) and `#0E7490` (cyan) reach only 4.22 to 4.40:1 on their own 12% tints. Light `pending` and `transfer` text therefore use `#92400E` and `#155E75`, and DESIGN.md's table records why. Every pair now passes.

**Input borders use DESIGN.md's `#5E7092` / `#7C8BA1`, not the softer `#334155` / `#3E4C6D` / `#94A3B8` proposed at the start of the phase.** Those measured 1.53 to 2.56:1 against the surfaces an input sits on, and 3:1 is the floor for a boundary that marks where a field is.

### Radius and elevation follow DESIGN.md section 3

| Element | Radius |
|---|---|
| Badges and micro buttons | 4 px (`rounded-sm`) |
| Inputs, buttons, modals and inset panels | 8 px (`rounded-lg`) |
| Cards | 12 px (`rounded-xl`) |
| Avatars, dots and chips | full |

Cards lost their shadows; a 1px `line` border defines them instead. Only the modal panel, the update toast and the mobile Quick Add keep one.

### The baht sign comes from a fallback font

JetBrains Mono has no U+0E3F glyph. This was checked against the full upstream TTF's `cmap`, not only Google's subsets. `--font-mono` therefore lists:

1. the web font;
2. the system monospace faces;
3. the Thai-capable system fonts (`Leelawadee UI`, `Thonburi`, `Noto Sans Thai`).

The system monospace faces come before the Thai fonts, so digits stay monospaced even before the web font has loaded (it is added in Phase 53b). Every amount starts with exactly one `฿`, so the fallback glyph does not break column alignment.

## Consequences

- `grep -rE "(stone|emerald|rose|amber|indigo|blue|...)-[0-9]{2,3}" src` returns only a historical comment in `index.css`. A palette class added later stands out in review.
- A theme or contrast change is now one edit in `index.css` plus `node scripts/wcag-tokens.mjs`.
- Bundle: CSS 78,908 -> 45,533 B; all JS 1,365,069 -> 1,341,862 B. Most of the JS saving is the deleted `dark:` halves of class strings.
- **No test changed.** No spec asserted on a colour class (Phase 19 moved them onto `data-testid`s). An attribute-and-text-node diff of all 44 changed files against HEAD found no change to any id, `data-testid`, `aria-*`, `title`, `placeholder` or visible text.

## Left open, deliberately

- **ADJUSTMENT colour.** DESIGN.md says adjustments render in cyan with no sign. ADR `0024` gave them a direction, and `unit/tx-cells.test.tsx` pins that an upward ADJUSTMENT uses the income tint. `txTypeMeta` keeps ADR `0024`'s income/expense-by-direction treatment. `RecentTransactionsTable`'s own per-type scheme (it already diverged, see T49) maps ADJUSTMENT to `transfer`. This needs a decision, not a guess.
- **Blur, motion, the hero's orbs and pulsing dot, `AnimatedCounter`, skeletons, the sync badge's states, touch targets and copy** were recoloured only. Phase 53b changes them.
- **Two `<select>`s still have no focus indicator:** `WalletPopupModal`'s activity filter and `WalletTransferForm`'s source and destination. They are in 53b's contrast task (T195).
