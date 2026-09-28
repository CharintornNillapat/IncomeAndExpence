# 0029 — Shared components: fourteen pieces, one focus style, drop-ins now and the rest with their pages

**Status:** Accepted.
- **Implements** `docs/design/finlife-redesign-spec.md` section 9 step 3 (section 4, the shared components), for Phase 56.
- **Amends** ADR `0006` (UI primitive inventory):
  - `ProgressMeter` becomes `ProgressBar`;
  - `CategoryChip` and `categoryTint` become `Chip`;
  - `Badge` loses its amber tone;
  - `formStyles`' button strings are replaced by `Button`.
- **Closes** audit 003 finding 4 (header focus) and finding 3 (the amber repayment badge).

**Date:** 2026-09-28

## Context

Phase 55 shipped the spec's tokens, font and Amount rule (ADR `0027`) and its money selectors (ADR `0028`). Section 4 of the spec lists fourteen shared components the pages are then built from.

The code had grown without them:
- **Buttons.** About 40 hand-typed button class strings, three `formStyles` constants (one never used), and no danger or soft variant.
- **Focus.** Not one `<button>` in the app had a focus style. Every button showed the browser's default outline, which is audit 003 finding 4 across the app, not only in the header.
- **Icon buttons.** `AuthModal`'s close button had no name at all. Two more had a `title` only, and both were under 44px.
- **SegmentedControl** exposed its selection to no assistive technology.
- **Category chips** tinted the chip with the category colour and wrote the text in it, so contrast depended on the category and no token covered it.
- **Transaction rows.** Three different renderers, and none was clickable.
- **Missing pieces.** No page header, day header, allocation bar, warning banner or overflow menu existed.

The owner's decisions (2026-09-28):
1. **Build and unit-test all fourteen.** Adopt now only the drop-ins, the pieces that replace existing markup without changing a flow: Button, IconButton, SegmentedControl, Chip, Amount, ProgressBar and Card, plus the header focus fix. PageHeader, TransactionRow, DayGroupHeader, AllocationBar, WarningBanner and OverflowMenu wait for the page phases, where their layouts land. No spec edits.
2. **One global focus rule**, not per component.
3. **44px everywhere**, the header and `IconButton` included, where the spec draws 40px.

## Decision

### One focus style, set once
`@layer base { :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px } }` is the spec's section 7 style, applied to everything a keyboard reaches.
- **Fields keep** their `focus:outline-none focus:ring-2 ring-focus` pair: the same violet, and they already replaced the outline.
- **The sync badge moves its outline onto the drawn pill.** Its 44px box is invisible, so an outline on the box would float around empty space. The badge button sets `focus-visible:outline-none` and the pill takes `group-focus-visible:outline-*`.
- **WCAG coverage.** `wcag-tokens.mjs` now checks `focus` against canvas, the surfaces, the header and `surface-3` at 3:1. The lowest is 3.89:1 on a dark menu.

### Button and IconButton
- **`Button`** has four variants: primary, secondary, soft and danger.
  - Sizes are `md` (in-card), `lg` (a form submit that grows from `sm`) and `header`, all with a 44px minimum.
  - It defaults to `type="button"` and passes `type="submit"` and native `disabled` through. About twelve Playwright steps find submit buttons by `button[type="submit"]` and assert `toBeEnabled`.
  - `buttonClass()` gives the look to a non-button element.
- **`IconButton`** requires `label`, so a nameless icon button is a type error, pinned by a `@ts-expect-error` test. The label becomes both `aria-label` and `title`, never `sr-only` text, which would put a second copy of the name into the page text that `getByText` searches.
- **The `formStyles` button strings are deleted**, not aliased. A utility module importing a component would invert the dependency, and every caller moved.
- **`TransactionForm`'s and the transfer form's submits** lose their special grey disabled look. They are now primary buttons at 50% opacity, like every other disabled button.

### Chip: colour on the dot only
- **`Chip`** is `adjust-tint` behind a new `chip-text` token (`#C9CFDC` dark, `#334155` light). It passes 10.09:1 and 9.45:1 and is now in the WCAG script.
- **The 7px dot** carries the item's colour. System categories use the grey `#6B7385`, now exported as `SYSTEM_CATEGORY_COLOR`.
- **The debt repayment badge becomes a grey system chip with the same text.** Amber is for things to fix (spec section 3), and a repayment is not one. This removes `Badge`'s only amber use, so the tone goes.

### ProgressBar
The same clamp as `ProgressMeter`, on the spec's `line` track, in three heights, with `role="progressbar"`, `aria-valuenow` and a name. It prints no number: each caller keeps its own `toFixed(1)` label, which the suite reads (`20.0%`, `55.0%`). The width change is now a 200ms tween, where the old one took 500ms, outside DESIGN.md's 150 to 200ms.

### Built now, adopted with the pages
- **`TransactionRow`**
  - Built on the L6/L7/L10/L13 selectors, so it cannot print "No category", "General", the default "Transaction" or a raw enum. A transfer has no chip, and is signed only inside one wallet.
  - With `onSelect` the whole row is a `<button>`; without it, a `<div>`.
  - Adopting it in the page phase must keep:
    - `tr[id^="tx-row-"]`, whose element type is part of the selector;
    - the date as text inside each row (`presets.spec.ts` filters rows by it), which is what the `meta` slot is for.
- **`OverflowMenu`**
  - Items exist only while the menu is open. A spec that asserts an action is absent (`settle-debt-*` count 0, `delete-category-cat-food` count 0) must open the menu first, or it passes for the wrong reason.
  - Moving `tx-delete-btn-*`, `delete-wallet-*` or `delete-debt-*` into a menu adds an "open the menu" step to their specs. That is a locator move, which the spec-edit policy allows.
- **`DayGroupHeader`** uses a new `formatDayLabel(iso, today)` in `utils/date.ts`, built from local calendar parts like `formatDayInfo`.
- **`PageHeader`** is an `h1` by default. Adopting it must keep each view's heading text.
- **`AllocationBar`**
  - Widths come from `flex-grow`, so the parts always fill the bar exactly.
  - Only positive values take a share.
  - The name lists every share, so the colour never carries the meaning alone.
- **`WarningBanner`** is a `role="note"` in the pending tokens. The three amber boxes already on screen move to it with their pages.

### Left as they are, with reasons
Controls that live inside another control keep their own markup:
- the chip dismiss crosses;
- the note field's microphone;
- the calculator keys.

Also left:
- the colour, icon, mood and meal pickers, whose selected style is the page phase's;
- text links;
- the round mobile Quick Add and the transfer swap button.

## Consequences

- **The Playwright suite runs unedited** (357 runs). No id, testid, element type or asserted string changed. The theme button's label changed from "Current theme is Dark. Click to switch." to "Theme: Dark. Click to switch."; no spec reads it.
- **The unused components cost nothing yet.** Nothing imports them, so they are tree-shaken out of the build until a page adopts them.
- **Visible changes on today's screens:**
  - every card is 16px round, with 24 or 28px padding;
  - every button has one shape per variant;
  - chips are grey with a coloured dot;
  - progress tracks use `line`;
  - the dashboard's recent table no longer prints "THB" after each amount;
  - keyboard focus is visible, violet and consistent everywhere.
- **Still open:** audit 003 findings 1 and 2 (the raw enum in the wallet activity list, "General" and "No category"). `TransactionRow` fixes both once the page phase adopts it.
