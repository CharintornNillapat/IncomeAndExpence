# FinLife Tracker Design System (Dark-Mode First)

## Overview
FinLife Tracker styles a personal money tracker the way crypto analytics dashboards look: a near-black canvas, one violet brand color, bordered panels, and every amount set in monospaced figures that line up in columns. It is built for reading balances and transactions at a glance on a phone. Dark is the look it was designed in; a matching light theme ships alongside it, and the app follows the system setting by default.

**Dial**: ENERGY 2 / RHYTHM 1 / MOTION 1
- **ENERGY 2**: a bold brand color and mono numerals, but this is a daily tool, not a showcase.
- **RHYTHM 1**: a data-dense dashboard; the uniform grid is deliberate so numbers are always where the eye expects them.
- **MOTION 1**: hover, focus, and 150 to 200ms state transitions only. Nothing moves on its own.

**Identity motif**: signed mono numerals. Every amount, everywhere money appears, is JetBrains Mono with `tabular-nums`, with `+` in emerald and `-` in rose. If the logo were removed, this is what still marks the app as FinLife Tracker.

The crypto dashboard is a style reference only. The app tracks Thai Baht wallets and has no crypto or Web3 features, so neither word appears in the UI.

---

## 1. Color Palette (WCAG AA: every text pair >= 4.5:1)

Five hues, one job each. Neutrals (canvas, surfaces, borders, text greys) do not count toward the palette.

| Hue | Meaning | Why |
|---|---|---|
| Violet | Brand, primary action, focus ring | The single accent that says "act here" |
| Emerald | Income, profit, synced | Money in |
| Rose | Expense, loss, destructive | Money out or something you cannot undo |
| Amber | Pending, warning, syncing | Not settled yet |
| Cyan | Transfer, adjustment | Money moving between your own wallets, neither in nor out |

Blue is not part of the palette. It previously competed with violet for the focus ring.

### Surfaces & Borders

| Token | Dark | Light |
|---|---|---|
| Canvas (background) | `#0B0E14` | `#FFFFFF` |
| Surface 1 (card, container) | `#121824` | `#F8FAFC` |
| Surface 2 (hover, input, table) | `#1A2234` | `#F1F5F9` |
| Surface 3 (hover on Surface 2, active segment) | `#243048` | `#E2E8F0` |
| Border default (card, container divider) | `#243048` | `#E2E8F0` |
| Border input (dedicated input token) | `#5E7092` (3.87 / 3.56 / 3.18) | `#7C8BA1` (3.46 / 3.31 / 3.16) |
| Focus ring | `#8B5CF6` | `#7C3AED` |

- **Surface 3** reuses the Border default hex, so it adds no new color. It exists because a control that already sits on Surface 2 (an input, a segmented control) needs one more step for its hover and active state.
- **Border default** is decorative: it separates cards, containers and rows, so it stays subtle. It is never used to mark a field.
- **Border input** is the dedicated token for text fields, selects, textareas and checkboxes. It marks where a field is, so it must reach 3:1 (WCAG 1.4.11 non-text contrast) against Canvas / Surface 1 / Surface 2, wherever the input sits.
  - Softer slate greys do not qualify. Measured on the same three surfaces, `#334155` reaches 1.87 / 1.72 / 1.53 and `#3E4C6D` 2.26 / 2.08 / 1.86 in dark, and `#94A3B8` reaches 2.56 / 2.45 / 2.34 in light. None of them may be an input border.

### Text

Ratios are measured against Canvas / Surface 1 / Surface 2 of the same theme.

| Token | Dark | Light |
|---|---|---|
| Text primary | `#F8FAFC` (18.46 / 16.98 / 15.18) | `#0F172A` (17.85 / 17.06 / 16.30) |
| Text secondary | `#94A3B8` (7.53 / 6.93 / 6.19) | `#475569` (7.58 / 7.24 / 6.92) |
| Text muted | `#8190A6` (5.95 / 5.48 / 4.90) | `#586880` (5.67 / 5.41 / 5.17) |

Muted is for non-critical metadata (timestamps, helper text), and it still passes AA on every surface. There is no text color below 4.5:1.

### Semantic Colors

Fills and badge tints use the 500 shade. Text uses the shade in the table, because the 500 shades fail as text on some surfaces.

| Meaning | Fill / badge tint | Text (dark) | Text (light) |
|---|---|---|---|
| Brand (violet) | `#8B5CF6`, tint `rgba(139, 92, 246, 0.12)` | `#A78BFA` (>= 5.84) | `#7C3AED` (>= 5.20) |
| Income (emerald) | `#10B981`, tint `rgba(16, 185, 129, 0.12)` | `#10B981` (>= 6.26) | `#047857` (>= 5.01) |
| Expense (rose) | `#F43F5E`, tint `rgba(244, 63, 94, 0.12)` | `#FB7185` (>= 5.90) | `#BE123C` (>= 5.74) |
| Pending (amber) | `#F59E0B`, tint `rgba(245, 158, 11, 0.12)` | `#F59E0B` (>= 7.39) | `#B45309` (>= 4.58) |
| Transfer (cyan) | `#06B6D4`, tint `rgba(6, 182, 212, 0.12)` | `#06B6D4` (>= 6.54) | `#0E7490` (>= 4.89) |

### Primary Button
- Fill `#7C3AED` (Violet-600) with white text: 5.70:1, in both themes.
- Violet-500 `#8B5CF6` is never a fill behind white text (4.23:1 fails).

---

## 2. Typography & Numerical Formatting

- **Sans (UI)**: system stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
  - Why: loads nothing and feels native in the installed PWA. The character comes from the mono numerals, not the sans.
- **Mono (numbers only)**: `"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, "Leelawadee UI", Thonburi, "Noto Sans Thai", monospace`, always with `tabular-nums`.
  - Order matters. The system monospace fonts come before the Thai fonts so that, if the web font has not loaded yet, digits still fall back to a monospace face rather than a proportional Thai UI font.
  - Why: digits and decimal points line up vertically in tables and lists, which is the identity motif.
  - The only web font the app loads. It is self-hosted (latin subset) and precached by the service worker, so it works offline and makes no third-party request. Used for amounts, balances, and badges, never for headings or body copy.
  - **`฿` comes from the fallback, by design.** JetBrains Mono has no U+0E3F glyph in any build, including the full upstream font, so no subset can add it. `Leelawadee UI`, `Thonburi` and `Noto Sans Thai` are the Thai-capable system fonts on Windows, Apple platforms and Android; the browser takes `฿` from the first font in the stack that has it.
  - This keeps columns aligned: every amount starts with exactly one `฿`, so the fallback glyph has the same width on every row and the digits after it still come from JetBrains Mono.

### Scales
- **Display Balance**: 36px / 40px bold, mono, tracking-tight
- **H1 (View Titles)**: 24px semibold, tracking-tight
- **H2 (Section Cards)**: 18px semibold
- **Body Regular**: 14px regular (line-height 20px)
- **Label / Metric**: 12px medium, uppercase, tracking-wider
- **Badge / Micro**: 11px mono, medium

### Case
- Uppercase with tracking-wider is only for compact metric labels, currency symbols, and tickers.
  - Why: short labels above a number read as a legend, not as a sentence.
- Everything else uses sentence case: headings, buttons, helper text, empty states, and loading text.

---

## 3. Elevation & Borders

- **Radius**:
  - `sm` (4px): badges, table cells, micro buttons
  - `DEFAULT` (8px): inputs, buttons, modals, dropdowns
  - `lg` (12px): main dashboard cards
  - `full` (9999px): wallet avatars, template chips
  - Why: radius grows with the size of the container, so hierarchy reads from shape as well as size.
- **Borders**: 1px solid Border default (`#243048` dark, `#E2E8F0` light) on every card and panel. No borderless floating surfaces.
  - Why: panels are defined by edges, not by shadows.
- **Shadow**: `modal-depth`: `0 20px 40px -15px rgba(0, 0, 0, 0.7)` on modals and the update toast only.
  - Why: those are the only layers that actually sit above the page.
- **Glow**: one only. `quick-add-glow`: `0 0 20px rgba(139, 92, 246, 0.2)` on the mobile centre Quick Add button.
  - Why: it is the app's most frequent action and the one element raised above the bottom nav.
  - No glow on cards, focus rings, badges, balances, or backgrounds.
- **Backdrop blur**: only on the mobile bottom navigation bar and sticky table headers.
  - Why: content scrolls underneath them, so the blur keeps the rows legible behind.
  - Everything else uses solid surface colors (Surface 1: `#121824` dark, `#F8FAFC` light), including modal panels. Modal overlays are a solid dim scrim, not a blur.
- **No decorative backgrounds**: no ambient color blobs or orbs behind balance headers, no grids, no gradients.
  - Why: the balance is the focal point; nothing sits behind it competing for attention.

---

## 4. Components & Mobile Ergonomics

### Buttons & Touch Targets
- **Minimum Hit Box**: 44x44px on every interactive element, including the sync badge, filter segments, collapse toggles, delete icons, checkboxes, and modal close buttons.
- **Primary Action**: fill `#7C3AED`, white text, 2px violet focus ring. No glow.
- **Secondary / Ghost**: Surface 1 fill, Border default outline, hover border violet.
- **Destructive**: rose outline, rose tint fill on hover.

### Inputs & Express Forms
- Surface 2 background (`#1A2234` dark, `#F1F5F9` light), one step off the card it sits on so the field reads as a well. 1px Border input outline (`#5E7092` dark, `#7C8BA1` light). Applies to text fields, selects, textareas, and checkboxes.
- Focus: 2px violet focus ring (`#8B5CF6` dark, `#7C3AED` light). Never remove an outline without this ring in its place.
- Numeric inputs: always `inputmode="decimal"` and mono.

### Cards & Ledger Tables
- 1px Border default, Surface 1 background.
- Numbers in mono with `tabular-nums`, so decimal points and digits align vertically.
- Signed values: `+` in emerald text, `-` in rose text. Transfers and adjustments in cyan text with no sign.
- Numbers render their final value immediately. No count-up animation on balances.
  - Why: a figure that is still moving can be read as the wrong amount.

### Sync Indicator (navbar badge)
One indicator, in the navbar badge. There is no second status dot elsewhere (the dashboard hero has none).

Five states. The first applies to guests; the other four to a signed-in user, checked in this order.

| State | When | Look | Behavior |
|---|---|---|---|
| Local | Guest, not signed in | Muted text, `○` "Local" | Tapping it opens sign-in |
| Offline | Signed in, browser offline | Muted text, `○` "Offline" | Shows the app is using local data |
| Syncing | A cloud load is running | Amber `⟳`, spinning | Spins only while a sync is actually running |
| Sync failed | The last cloud load failed to read a table | Rose `⚠` | Tapping it retries; a failed load is never silent |
| Synced | Otherwise | Static emerald dot `●` | None |

### Loading States
- One skeleton per loading region, shaped like the content it replaces.
- Skeletons are static Surface 2 blocks. They do not pulse or shimmer.
- No stacked indicators (spinner + pulse + bouncing dots together). Loading text, if any, is sentence case.

### Icons
- Lucide, stroke style, sized to the text beside them.
  - Why: one minimalist stroke set keeps every icon consistent across views.

---

## 5. Do's and Don'ts

1. **Do** use mono and `tabular-nums` for all wallet balances, amounts, and transaction rows.
2. **Do** keep 1px Border default (`#243048` dark, `#E2E8F0` light) between card components.
3. **Do** check every text color against every surface it sits on, in both themes (minimum 4.5:1).
4. **Do** keep transitions to 150 to 200ms, on hover, focus, and state changes only.
5. **Don't** use floating, bouncing, pulsing, scaling, or count-up animations. Continuous motion is allowed only while real work is running: the Syncing spinner, a spinner on a submit that is in flight, and the microphone indicator while it is recording. It stops the moment the work stops.
6. **Don't** add a glow, blur, or decorative background beyond the ones listed in section 3.
7. **Don't** hide sync errors. Use the five-state sync indicator in section 4.
