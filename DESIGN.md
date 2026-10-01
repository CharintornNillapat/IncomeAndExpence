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
Wallets and categories take their own colour from the muted identity palette in spec section 1. It avoids red, green, blue, cyan and amber, which carry money meaning. Since Phase 59 (audit 008) the wallet colour picker, in Add wallet and in Edit, offers exactly those twelve colours. The migration of existing colours, the starter wallets' included, is a later phase (spec section 5.1).

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
- **A control's colour transition is `transition-control`, never `transition-colors`** (Phase 57, audit 004 finding 2). Tailwind's `transition-colors` also animates `outline-color`, which made the outline fade in from the text colour; `transition-control` lists the same colour properties without it.

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
| `OverflowMenu` | `ui/OverflowMenu` | "⋯" for rare or destructive actions. `surface-3` menu, `line-strong` edge, Delete in red, full keyboard support, no entrance animation. With `triggerLabel` the trigger is a secondary button with text and a chevron, for a page-level menu such as "Import / export" (ADR 0031). |
| `TransactionRow` | `transaction/TransactionRow` | 36px tile, the L6/L7 title and second line, the L10/L13 chip (none for a transfer), a signed amount. The whole row is a button when it can be selected. |
| `DayGroupHeader` | `transaction/DayGroupHeader` | "Yesterday · Sun, Sep 27" and the day's L11 net: `fg` when zero or more, `expense` when negative, always signed. |

Exceptions that keep their own markup, each for a reason:
- Inside another control: the dismiss crosses in `CategorySuggestionChip`, `SaveRuleChip` and the preset chips, the note field's microphone, and the calculator keys.
- Selection grids: the colour and icon pickers, and the diary's mood, activity and meal buttons, which share one selected style since Phase 61 (`selected`, a `focus` border, `on-selected`).
- Text links: "View all", "Download sample", the form's shortcut row. On the Dashboard they are `dashboard/DashboardLink`, a `<button>` drawn as a link with a 44px hit box.
- The mobile centre Quick Add and the transfer swap button. Each is a single, round shape.

### Page layout (spec section 6)
- `main` pads 16px on phones and 32px top, 40px sides, 48px bottom from `md`. It keeps `max-w-7xl` until every page is redesigned (see Deviations).
- Sections are 24px apart. Card rows sit on a 12-column grid with 16px gaps.

### Dashboard (spec 6.1, ADR 0030)
One period for the whole page, chosen in the `PageHeader`. Every figure comes from `src/selectors/`, computed once in the view.

| Block | Width (`xl` / `md`) | Rules |
|---|---|---|
| PageHeader | full | A greeting by the local hour, the long date, and the period control. |
| Net worth | 5/12 / 5/12 | `netWorth` (L3) with "THB", the only place the code shows. Insets: "In N wallets" and "Debt remaining" (signed, red). |
| Cash flow | 7/12 / 7/12 | Income, Spending and Left over on a neutral edge. Left over is `fg`, red only when negative. One `ProgressBar` of the share of income spent. |
| Debt warning | full | `WarningBanner`, only when L5 fires. Names the debt when exactly one outruns the surplus. |
| Wallets | full | A plain heading with its links, then one card: `AllocationBar` and one button row per wallet ("type · share%"). |
| Spending by category | 7/12 / full | `spendingByCategory` (L1), total at the right, a caption naming what is excluded. |
| Debt payoff | 5/12 / full | Overall progress, then each debt with its L4 figure, in `pending` when it alone passes the surplus; "Overdue" in red. |
| Recent activity | 8/12 / full | `TransactionRow`s under `DayGroupHeader`s (L11), with a cancelling adjustment pair folded into one expandable row (L8). |
| Mood & spending | 4/12 / full | Diary days in the period, a five-bar meter (no emoji) and that day's signed spending. |
| Spending insights | full | ADR 0020's card, titled with its own months. |

### Transactions (spec 6.2, ADRs 0031 and 0033)
- **Header:** `PageHeader` "Transactions" with "Click any row to edit it", an "Import / export" menu, and the one primary button, "Add transaction".
- **Filter row:** search (grows to fill), date range, wallet, category, a type control (All / Income / Expense / Transfer), and Show deleted. On a phone the selects share their rows evenly.
- **List:** one card, with a summary line at the top (the range, In, Out, and what is not counted). Below it, `DayGroupHeader`s and `TransactionRow` buttons, inset 8px so a row's focus ring has room, and "Load 25 more" at the foot.
- **Panel:** the selected row's edit panel. It sits inline at 4/12 beside the list from `lg` and opens as a sheet or dialog below that. The choice is made in JavaScript, so it is never rendered twice. The selected row takes the soft violet with a 3px violet edge.
  - **For income, expense and transfer:** a type control, the amount at 24px in the type's colour (it takes a sum, like `100+50`), the note, Category and Wallet side by side when there is room (From and To for a transfer), the date, then "Save changes" (primary) beside "Delete" (danger).
  - **For a repayment or an adjustment:** the money as text, its wallet (and a repayment's debt) as read-only lines, one line saying only the note and date can change, then the note and date fields.
  - **Save changes is disabled until something changes.** The line above it says why when the edit is incomplete, and "Changes saved" after a save. A failure shows in the red banner.
  - **For a deleted row:** its details, read-only, with Restore.
- **No trash button on a row.** Deleting happens in the panel.
- **Dashboard hand-off:** a Recent activity row opens its row here with the panel open.

### Wallets (spec 6.3, ADR 0034)
- **Header:** `PageHeader` "Wallets" with "฿X across N wallets" (active wallets only), a secondary "Transfer" with the blue transfer icon, and the one primary button, "Add wallet".
- **Layout:** master-detail from `lg`: 5/7 up to `xl`, then the spec's 4/8. Below `lg` the list stands alone, and a tapped wallet opens in a sheet. The choice is made in JavaScript, so the detail is never rendered twice.
- **List:**
  - one card holding the `AllocationBar`, then a row per wallet: a 40px tinted tile, the name (it wraps rather than truncating), the type and its share, and the balance;
  - the selected row takes the soft violet with a 3px violet edge, as a selected transaction does;
  - a dashed "Add wallet" ends the rows;
  - archived wallets sit under a collapsed "Archived (N)" with Unarchive.
- **Detail:**
  - **Header:** a 52px tile, the name, and "Cash · created Oct 1, 2026". Edit (secondary) and a "⋯" menu with "Archive wallet" and "Delete wallet…" (red) sit on the right.
  - **Balance box:** an inset with the balance at 40px (red when negative) and THB, plus "Transfer out" and "Adjust balance". The two buttons sit beside the figure from `xl` and under it below that.
  - **Adjust balance** opens a one-field editor in the box. Its line says the difference is recorded as a balance adjustment.
  - **Edit** opens a form under the header: name, type, colour swatches in 44px boxes, then "Save changes" and Cancel.
  - **Activity:** "Recent activity in <wallet>" and "View all", then the wallet's 10 newest rows through `ActivityFeed`. A transfer is signed by its direction: `+` arriving, `−` leaving. A cancelling adjustment pair folds into one dashed row (L8).
- **No trash button and no "Active Source" badge.** Delete and Archive live in the menu and confirm first. Delete says how many transactions stay and still count, and that the balance leaves the totals.
- **Dashboard hand-off:** a Dashboard wallet row opens the page with that wallet selected. The wallet popup is gone.
- **Closing the sheet returns focus to the wallet row that opened it**, as every `Modal` now does (audit 008).

### Debt payoff (spec 6.4, ADR 0035)
- **Header:** `PageHeader` "Debt payoff" with "N active debts · sorted by due date" and the one primary button, "Add debt".
- **Summary:** one card, three columns once it is 42rem wide, stacked below that:
  - Still owed, in red, "of ฿X borrowed";
  - Paid off, as a percentage, with a `ProgressBar` and "฿X repaid" in green;
  - when L5 fires, an amber note box with "Needed per month to hit every due date", the total and the gap; otherwise an inset "On track" with the monthly figure.
- **Cards:** two columns from `md`, the active debts nearest due date first (overdue at the top, undated last).
  - **Header:** the name, then the interest tag ("4.5% APR" or "Interest-free") and the due tag. "Due <date> · ~N months" is amber when the debt alone needs more a month than the surplus (L5). An overdue debt reads "Overdue · due <date>" in red; an undated one, "No due date". A "⋯" menu holds "Edit debt" and "Delete debt…" (red).
  - **Body:** "Still owed" at 28px in red, then "N% paid" beside a `ProgressBar`, then three insets: Borrowed, Repaid (green) and Needed / month (amber with the same L5 condition). The insets become label-and-figure rows when the card is under 24rem.
  - **Actions:** "Make repayment" (primary) and "Mark as paid off" (secondary, ✓), side by side when there is room.
- **Paid off (N):** a plain heading and the paid-off cards, open, below the active ones. They keep "100% Fully Settled!" and "✓ Debt Fully Settled", and only their menu.
- **Caption:** "Debt repayments move money out of a wallet but aren't counted as spending."
- **Mark as paid off confirms first**, in a dialog that is not styled as destructive. It says it records no payment and moves no money. A failure stays in the dialog.
- **Edit** is a dialog: title, Borrowed, interest, minimum and due date. What is still owed is shown beside Borrowed as text, never as a field, and Borrowed can't go below it.
- **Focus:** after a write-off or a repayment that clears the debt, focus goes to the card's "⋯"; after a delete, to "Add debt". Every other dialog returns focus to its opener.

### Daily diary (spec 6.5, ADR 0036)
- **Header:** `PageHeader` "Daily diary" with a secondary "Export JSON", the one export of the diary.
- **Layout:** the form at 7/12 and, beside it at 5/12, the calendar over the recent entries, from `lg`; stacked below that.
- **Form:**
  - **Header:** "Thursday, Oct 1" and "Today · spent ฿X in N transactions so far" (L1 spending only), with ‹, "Pick date" and ›. The › is disabled on today, and the picker stops at today.
  - **Mood:** five 44px buttons, each a number over its word: Very low, Low, Neutral, Good, Great.
  - **Activity:** Rest day / Workout; Workout shows a one-line note.
  - **Meals:** Clean / home, Average, Fast food / junk.
  - **One selected style for all three:** `selected` background, a `focus` border, `on-selected` text, bold. No colour by meaning, and no emoji anywhere on the page.
  - **Notes**, then "Save entry". A day with no entry starts with no mood picked, and Save is disabled with "Pick a mood to save." under it.
- **Calendar:**
  - Monday first, each day a 44px button named in full ("Wed, Sep 30, logged");
  - a logged day is on `logged`, today has an inset `focus` ring (white when today is the form's day, on the brand fill), a future day is `fg-disabled` and disabled;
  - the day in the form is in the brand fill;
  - a legend and "N days logged in September", with ‹ › for the month (› disabled on the current one).
- **Recent entries:**
  - newest first, ten at a time;
  - each has the day (spec 4.10's label), its spending in red (signed), a five-bar `MoodMeter`, and "Good · Workout · Clean / home meals · 2 transactions";
  - "2 transactions" is a link that opens the Transactions page on that day;
  - the workout note, then the note in an inset;
  - Edit entry and Delete entry… (red) in the "⋯" menu. Delete confirms first.
- **Transactions, filtered to a day:** a soft "Only Wed, Sep 30 ×" button in the filter row; it, or a range change, clears the day.

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
| Editing row background `#1C1930`; selected wallet `#1C1930` with edge `#4B3F86` | `brand-soft` (`#1E1A33`) with the 3px `focus` edge, for both | Two near-identical violets would be two tokens for one meaning, and a selected row looks the same on every page. |
| Header title "FinLife" | "FinLife Tracker" | `theme.spec.ts` finds the heading by that name. |
| Dark only | Dark and light | The owner kept the light theme (2026-09-28). Light values are derived per role and pass the same checks. |
| "Display settings" icon button | The theme button keeps its own label ("Theme: Dark. Click to switch.") | Spec section 11: name a button for what it does. |
| Pages full width | `main` keeps `max-w-7xl` (1280px) | Temporary, until every page is redesigned: the old Transactions table and forms would stretch across a wide screen (owner, 2026-09-28, ADR 0030). |
| "~฿4,391/mo needed" | "฿4,391.23 / month needed" | Every displayed amount goes through `formatCurrencyAmount`. |
| Mood-row spending red, unsigned | Signed, `−฿340.00` | Spec section 7: colour never carries the meaning alone. |
| Spent-vs-left bar in red and green | One `ProgressBar` of the spent share on the neutral track | A green remainder would read as income; the caption states the share. |
| Static "Good morning" | Greeting by the local hour | The page is open at every hour. |
| "…uses the period on the right" | "…uses the selected period" | On a phone the control sits below the text. |
| Edit panel: every row edits type, amount, wallets and category | A repayment or an adjustment edits only its note and date | Its money is tied to a debt's remainder or to a counted balance; changing it is a delete and a new entry (owner, 2026-09-28, ADR 0033). |
| Edit panel: Category and Wallet side by side | Side by side from a 320px panel; stacked below that, as in the inline panel at `lg` | Two selects in under 320px cut their names off. |
| Wallets: 4/12 and 8/12, one column below 1280 | Master-detail from `lg` (1024) at 5/7, the spec's 4/8 from `xl` | At 1024 a 4/12 list cut every wallet name off; the Transactions panel is inline from `lg` too (ADR 0033). |
| Wallets: the balance box's buttons beside the 40px figure | Beside it from `xl`, under it below that | In the 5/7 detail and the sheet they wrapped into a column next to the number. |
| A transfer row: "Transfer" over "Main → Cash" only | "Main → Cash · Funds transfer" when the transfer has a note of its own | The title is always "Transfer", so a note the user wrote would otherwise disappear. |
| Debt payoff: three summary columns | Three from a 42rem card, stacked below | At 390 and from 768 to 900 the three figures would not fit side by side. |
| Debt payoff: Borrowed, Repaid and Needed / month as three boxes | Three boxes from a 24rem card, label-and-figure rows below | Three ฿ figures in a narrow card would wrap or be cut off. |
| Debt payoff: no section for paid-off debts | An open "Paid off (N)" section below the active ones | The owner's decision (2026-10-01, ADR 0035): a paid-off debt between the active ones hid the order by due date. |
| Debt payoff: the due tag for a dated debt only | "Overdue · due <date>" in red, and "No due date" | Both cases exist in the ledger and need a tag of their own. |
| Diary: the form beside the calendar and list | Beside them from `lg`; stacked below | Spec 8: one column below 1024. |
| Diary: a new day's mood unspecified | No mood picked, and Save waits for one | The owner's decision (2026-10-01, ADR 0036): a preset mood would be saved by an accidental tap. |
| Diary: the recent entries' count unspecified | Ten at a time, with "Show N more" | A long diary would make the right column far taller than the form. |
| Diary: the selected day unmarked in the calendar | The day in the form is in the brand fill | Otherwise the calendar does not show which day the form holds. |
