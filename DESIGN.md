# FinLife Tracker Design System

## Overview
FinLife Tracker is a personal money tracker for Thai Baht wallets, with a daily diary beside it. It is built for reading balances and transactions at a glance, on a phone or a desktop. Dark is the look it was designed in, and a matching light theme ships alongside it. The app follows the system setting by default.

**Source of truth.** Since Phase 55 the direction is `docs/design/finlife-redesign-spec.md` (the redesign spec and its mockup). This file keeps the rules the app enforces and the reason for each. Where the two differ, the difference is listed under "Deviations from the spec" with its reason.

**Dial**: ENERGY 2 / RHYTHM 1 / MOTION 1
- **ENERGY 2**: one violet accent on quiet dark surfaces. This is a daily tool, not a showcase.
- **RHYTHM 1**: a data-dense dashboard. The uniform grid is deliberate, so numbers are always where the eye expects them.
- **MOTION 1**: hover, focus, and 150 to 200ms state transitions only. Nothing moves on its own.

**Identity motif**: meaning-coloured, signed amounts in tabular figures. Every amount carries its sign (`+`, `−`, or none for a transfer) and the colour of what it means. The digits line up in columns. If the logo were removed, this is what still marks the app as FinLife Tracker.

---

## 1. Colour

### Hues: one meaning each (spec section 3)

| Hue | Token | Meaning | Never |
|---|---|---|---|
| Green | `income` | Income, a positive result, debt payoff progress | A wallet or category colour |
| Red | `expense` | Spending, debt still owed, delete | A wallet colour, an allocation bar |
| Blue | `transfer` | Money moving between your own wallets | Anything else |
| Grey | `adjust` | A balance adjustment, a debt repayment, a system category | |
| Violet | `brand` | One primary button per area, the active nav tab, a selected option, focus | Decoration |
| Amber | `pending` | Something that really needs fixing: a warning, a sync in progress | Ordinary values ("Avg food") |

- **Cards keep a neutral border** (`line`). A card is never outlined green or red; the colour sits on the number.
- **A net or left-over figure** is `fg` when positive and `expense` when negative. It never takes the income green.
- **A selected option looks the same everywhere**: `selected` background, `focus` ring, `on-selected` text. A segmented control uses `control-active`.

### Tokens
Values live in `src/index.css`, on `:root` (light) and `.dark`. `@theme inline` maps them to Tailwind utilities, so one class covers both themes.

| Role | Token | Dark (spec) | Light |
|---|---|---|---|
| Page | `canvas` | `#0B0E14` | `#FFFFFF` |
| Header | `header` | `#0F131B` | `#F8FAFC` |
| Card | `surface-1` | `#131722` | `#F8FAFC` |
| Box inside a card, input | `surface-2` | `#0F131B` | `#F1F5F9` |
| Menu, hover on a card | `surface-3` | `#1A1F2B` | `#E2E8F0` |
| Selected segment | `control-active` | `#262B3A` | `#E2E8F0` |
| Divider, card edge, progress track | `line` | `#1F2532` | `#E2E8F0` |
| Secondary-button edge | `line-control` | `#252B38` | `#CBD5E1` |
| Dashed edge, menu edge | `line-strong` | `#2A3140` | `#CBD5E1` |
| Input edge | `line-input` | `#5E7092` | `#7C8BA1` |
| Text 1 / 2 / 3 | `fg` / `fg-secondary` / `fg-muted` | `#E8EAF0` / `#A3AABB` / `#8A93A6` | `#0F172A` / `#475569` / `#586880` |
| Disabled text | `fg-disabled` | `#4A5163` | `#94A3B8` |
| Chip text (on `adjust` tint) | `chip-text` | `#C9CFDC` | `#334155` |
| Danger-button edge | `danger-line` | `#4A2227` | `#FECDD3` |

Each hue has a text token and a solid `-tint` background: `income`, `expense`, `transfer`, `adjust`, `pending` (plus `pending-line` and `pending-body` for the warning banner), and `brand-soft` for the active nav tab. The primary button fill is `#7C3AED` with white text, at 5.70:1 in both themes.

### Contrast (WCAG AA)
Every text token passes 4.5:1 on every surface it can sit on, in both themes. Every hue passes on its own tint. `fg-muted` is the faintest text allowed: 5.80:1 on a dark card. Input edges and the focus outline reach 3:1 (WCAG 1.4.11); the outline is checked against every surface it can sit on, header and menu included. Run `node scripts/wcag-tokens.mjs` after changing any value; it reads `src/index.css` and exits 1 on a failure. `fg-disabled` is exempt, as WCAG exempts disabled controls.

### Identity colours (wallets and categories)
Wallets and categories take their own colour from the muted identity palette in spec section 1. It avoids red, green, blue, cyan and amber, which carry money meaning. The migration of existing colours is a later phase (spec section 5.1).

---

## 2. Typography

- **One family: IBM Plex Sans Thai**, weights 400 / 500 / 600 / 700. It covers Thai, Latin and the baht sign `฿` in one face.
  - It is self-hosted (the thai and latin subsets only, 8 files, 118 kB) and precached by the service worker. So it works offline and makes no third-party request.
  - The system stack after it (`system-ui`, `Leelawadee UI`, `Thonburi`, `Noto Sans Thai`, ...) paints only until it loads.
- **Numbers are not monospace.** `body` sets `font-variant-numeric: tabular-nums`, so every digit has the same width and columns still align.
  - Why: the spec drops the mono face. Tabular figures keep the alignment the mono face was there for, without a second font.

### Scale (spec section 2)
| Use | Size / weight |
|---|---|
| Page title (h1) | 26px / 600 |
| Card title (h2) | 17px / 600 |
| Section label | 12 to 13px / 600, uppercase, 0.4px tracking, `fg-secondary` or `fg-muted` |
| Body | 14px / 400 to 500 |
| Caption | 12 to 13px, `fg-muted` |
| Hero number (net worth) | 44px / 600, −1px tracking |
| KPI number | 28px / 600 |
| Amount in a list row | 15px / 600 |

### Case
- Uppercase is only for compact section labels, column headers and tickers.
  - Why: short labels above a number read as a legend, not as a sentence.
- Everything else is sentence case: headings, buttons, helper text, empty states and loading text.

---

## 3. Shape, elevation and blur

- **Radius**: `rounded-card` 16px, `rounded-inner` 12px (a box inside a card), `rounded-control` 10px, `rounded-button` 8px, `rounded-full` for dots and swatches.
  - Why: radius grows with the size of the container, so hierarchy reads from shape as well as size.
- **Borders**: 1px `line` on every card and panel. Panels are defined by edges, not by shadows.
- **Shadow**: `shadow-modal` on modals and the update toast only, the layers that sit above the page.
- **Glow**: one only, `shadow-quick-add` on the mobile centre Quick Add button, the app's most frequent action.
- **Blur**: only the mobile bottom nav and a sticky table header, where content scrolls underneath. Modal scrims are a solid `scrim`; panels are opaque.
- **No decorative backgrounds**: no orbs, grids or gradients behind a number.

---

## 4. Components

### Amounts (spec section 4.8)
- Format through `formatCurrencyAmount`: `฿1,234.56`, and a negative as `−฿1,234.56` (U+2212 before the symbol).
- Income `+฿` green. Spending `−฿` red. A transfer `฿` blue, unsigned, except inside one wallet's own view, where it is `+` arriving or `−` leaving. An adjustment `+` or `−` in grey. A debt repayment `−` in grey: it is not spending (spec L1).
- "THB" appears only beside the hero number.
- Numbers render their final value immediately. No count-up.
  - Why: a figure that is still moving can be read as the wrong amount.

### Header (spec section 4.1)
- One sticky row, 64px (56px under 768px), `header` background with a `line` bottom edge.
- Logo, then the six tabs left-aligned. The active tab is `brand-soft` with `aria-current="page"`.
- On the right: the sync status, the theme button, the account controls, and "Add entry".
- No total balance in the header; the dashboard shows it.
- Under 768px the tabs give way to the bottom nav.

### Touch targets
- **44x44px minimum hit box** on every interactive element. A small visual (a swatch, a pill, a checkbox) sits inside a 44px box rather than growing.

### Focus (spec section 7)
- **One focus style:** every control reached by keyboard shows `outline: 2px solid var(--focus); outline-offset: 2px`, from one global `:focus-visible` rule.
- A control whose 44px box is invisible (the sync badge) moves the outline onto what is drawn.
- Inputs keep their own 2px `focus` ring instead, in the same violet.
- Never remove an outline without one of these in its place.

### Inputs
- `surface-2` background, 1px `line-input` edge, 2px `focus` ring.

### Shared components (spec section 4, ADR 0029)
Build a screen from these, not from a re-typed class string.

| Component | Where | Rules |
|---|---|---|
| `Button` | `ui/Button` | Four variants: primary (the one main action in an area), secondary, soft (`brand-soft`), danger (red text, `danger-line` edge). `type="button"` unless it submits. |
| `IconButton` | `ui/IconButton` | 44 x 44. A required `label` becomes `aria-label` and `title`. Tones: neutral, danger, income. |
| `SegmentedControl` | `ui/SegmentedControl` | A `surface-1` tray with the selected option on `control-active` in bold, exposed as `aria-pressed`, or as `role="tab"` + `aria-selected` when it switches content. |
| `Chip` | `ui/Chip` | A neutral pill (`adjust` tint, `chip-text`). The item's colour is a 7px dot and nowhere else. System categories use the grey `#6B7385` dot. |
| `Card`, `Inset` | `ui/Card` | Card: `surface-1`, `rounded-card`, 24 to 28px padding, neutral edge. Inset: a box inside a card, `surface-2`, `rounded-inner`. |
| `PageHeader` | `ui/PageHeader` | h1 and one line on the left, actions on the right, no card. |
| `ProgressBar` | `ui/ProgressBar` | A `line` track 6, 8 or 10px tall, the fill by meaning (payoff is `income`) or an item's own colour. It prints no number. |
| `AllocationBar` | `ui/AllocationBar` | One bar split by share, 3px gaps, each item's own colour; only positive values take a share. Its name lists the shares. |
| `WarningBanner` | `ui/WarningBanner` | `pending` tint and edge, a triangle, `role="note"`, an optional action. For something to fix, never for a normal value. |
| `OverflowMenu` | `ui/OverflowMenu` | "⋯" for rare or destructive actions. `surface-3` menu, `line-strong` edge, Delete in red, full keyboard support, no entrance animation. |
| `TransactionRow` | `transaction/TransactionRow` | 36px tile, the L6/L7 title and second line, the L10/L13 chip (none for a transfer), a signed amount. The whole row is a button when it can be selected. |
| `DayGroupHeader` | `transaction/DayGroupHeader` | "Yesterday · Sun, Sep 27" and the day's L11 net: `fg` when zero or more, `expense` when negative, always signed. |

Exceptions that keep their own markup, each for a reason:
- Inside another control: the dismiss crosses in `CategorySuggestionChip`, `SaveRuleChip` and the preset chips, the note field's microphone, and the calculator keys.
- Selection grids: the colour and icon pickers, the diary's mood and meal buttons. Their selected style is the page phase's.
- Text links: "View all", "Download sample", the form's shortcut row.
- The mobile centre Quick Add and the transfer swap button. Each is a single, round shape.

### Sync indicator (header)
Five states. The first is for guests; the other four are for a signed-in user, checked in this order.

| State | When | Look | Behaviour |
|---|---|---|---|
| Local | Guest | Muted pill, `○` "Local" | Tapping it opens sign-in |
| Offline | Signed in, browser offline | Muted pill, `○` "Offline" | Shows the app is using local data |
| Syncing | A cloud load is running | Amber pill, `⟳` spinning | Spins only while a sync runs |
| Sync failed | The last cloud load failed | Red pill, `⚠` | Tapping it retries; a failed load is never silent |
| Synced | Otherwise | Green dot and "Synced" | None |

### Loading states
- One static skeleton per loading region, shaped like the content it replaces. No pulse, no shimmer, no stacked spinners.

### Icons
- Lucide, stroke style, sized to the text beside them. One transaction icon set everywhere: ↙ income, ↗ expense, ⇄ transfer, +/− adjustment.

---

## 5. Do's and don'ts

1. **Do** colour an amount by what it means, and always give it a sign or an icon. Colour is never the only signal.
2. **Do** keep a neutral 1px `line` edge on every card.
3. **Do** check every text colour against every surface it sits on, in both themes.
4. **Do** keep transitions to 150 to 200ms, on hover, focus and state changes only.
5. **Don't** use floating, bouncing, pulsing, scaling or count-up animations. Continuous motion is allowed only while real work runs: the Syncing spinner, a submit in flight, the microphone while it records.
6. **Don't** add a glow, blur or decorative background beyond section 3.
7. **Don't** hide sync errors.

---

## Deviations from the spec

| Spec | App | Why |
|---|---|---|
| `--border-control` `#252B38` on inputs | Inputs keep `line-input` `#5E7092`; `#252B38` is `line-control`, for secondary buttons only | `#252B38` is 1.26:1 on a card, under WCAG 1.4.11's 3:1 for an input's edge. A button's label identifies it; an input has only its edge. |
| Header buttons and `IconButton` 40px | 44px | The app's 44px floor (section 4). The owner kept it for every control, header included (2026-09-28, ADR 0029). |
| Editing row background `#1C1930` | `brand-soft` (`#1E1A33`) | Two near-identical violets would be two tokens for one meaning. |
| Header title "FinLife" | "FinLife Tracker" | `theme.spec.ts` finds the heading by that name. |
| Dark only | Dark and light | The owner kept the light theme (2026-09-28). Light values are derived per role and pass the same checks. |
| "Display settings" icon button | The theme button keeps its own label ("Theme: Dark. Click to switch.") | Spec section 11: name a button for what it does. |
