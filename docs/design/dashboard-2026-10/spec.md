# Dashboard redesign, 2026-10: spec and task plan

Owner: Charintorn. Source design: `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` (a static mock, dark only, sample data, raw hex colours).

**This file is the authority for the redesign, not the HTML.** The HTML shows layout and intent only. Read it only when a task here names a section of it. Every colour, size and number in it is a mock value: the real ones come from `src/index.css` tokens, `DESIGN.md` and `src/selectors/`.

## 1. Decisions

- **D1. No new palette.** The redesign uses the existing semantic tokens in both themes (light and dark). The mock's gold accent maps to the `brand` hue, its green to `income`, its coral to `expense`, its grey transfer rows to the `transfer` hue (blue in the app, not grey). No raw hex anywhere.
- **D2. Dashboard body only.** The app header, nav, sync badge and Quick Add stay as they are. The mock's pill nav, Add entry button and avatar are out of scope (a later phase may take them).
- **D3. The AI insights card stays.** It is not in the mock, so it keeps its current behaviour and moves to the end of the page, full width. Removing it is a separate owner decision.
- **D4. Month comparison compares like with like.** The mock compares October 1 to 16 with all of September. The real line compares day 1 to day N of this month with day 1 to day N of last month (N clamped to last month's length).
- **D5. Every figure is computed once in `DashboardView`** from `src/selectors/`, as today (ADR 0030). Cards only lay out.

## 2. Token mapping

| Mock colour | Meaning | Use |
|---|---|---|
| `#0B0F1A` page | page ground | `bg-canvas` |
| `#121828` card | card surface | `bg-surface-1` with `rounded-card` |
| `#1E2639`, `#1A2238` tracks, chips | inner surface | `bg-surface-2` or `bg-surface-3` |
| `#1A2135` dividers | edge | `border-line` |
| `#ECEEF4` / `#A3ABBE` / `#7A849B` text | text | `text-fg` / `text-fg-secondary` / `text-fg-muted` |
| `#D9B26A` gold accent and its tints | the Left over hero, primary emphasis | `brand` hue (`text-brand`, `bg-brand-soft`, `-tint`, `-line`) |
| `#4FD1A5` green | income | `income` hue |
| `#FF8A7A` coral | spending, debt still owed | `expense` hue |
| `#7A849B` transfer rows | transfer, not counted | `transfer` hue (blue in the app, not grey) |
| `#7AA7FF` net worth figure | none | `text-fg`. Do not add a colour for it |
| category and wallet hues | identity | the record's own `color` (data colours are exempt), tinted the way existing chips tint them |
| debt paid-off bar | progress | the existing `ProgressBar` and its tokens |

Type: one face, IBM Plex Sans Thai, `tabular-nums`, sizes from `DESIGN.md`'s scale. The mock's 44 px hero figure becomes the largest display size in that scale. No `text-[Npx]`.

## 3. Rule fixes the mock needs

1. **44 px hit boxes:** the period buttons (34 px) and Log today (36 px) grow to 44, or sit in a 44 px box. Use `SegmentedControl` and `ui/Button`.
2. **Amounts:** every amount through `formatCurrencyAmount` or `ui/Money`, two decimals, U+2212 for negatives. The mock's whole-baht figures (฿4,208) are not a format to copy.
3. **Signs and colour:** colour is never the only signal. Income keeps its `+`, spending its minus, transfers say not counted, as `txTypeMetaFor` does today.
4. **No duplicate sync state:** the mock's Synced dot in the page subtitle is dropped; `NavbarSyncBadge` in the header already shows it.
5. **One h1:** `PageHeader` holds the greeting and the date. Card titles are h2.
6. **Ids:** keep every Dashboard id and test id listed in `docs/audit/test-selector-contract.md`. New ids start `dashboard-`. Never use another page's prefix (`tx-row-`, `debt-card-`, `open-repay-modal-`, `settle-debt-`, `wallet-entity-`).
7. **Charts:** the sparkline and donut are inline SVG with `role=img` and an `aria-label` that states the figures. The category list beside the donut is the text equivalent. No chart library, no animation, nothing moves under reduced motion.
8. **Loading and empty:** each card has a static outline while loading (no pulse). A new account with no data shows `฿0.00` figures and short empty lines, never `NaN` or `Infinity`.
9. **Layout:** fluid, `max-w-7xl` main as today. Rows wrap to one column at phone width. One render path per breakpoint, no hidden duplicates.
10. **Links and actions:** Details and View all go to the Transactions tab; All debts and Make a repayment go to the Debt payoff tab; Manage goes to the Wallets tab; Log today goes to the Diary tab; Transfer opens the shell `TransferFundsModal` through `onOpenTransfer()` with no click event; Add wallet opens `AddWalletModal`. Use the existing tab routing.

## 4. Sections

Order top to bottom. Each names its data. NEW means a selector that does not exist yet (section 5).

1. **Page header:** existing `PageHeader` (greeting, long date) and the period `SegmentedControl` (Today, This week, Past 30 days, All time = DAY, WEEK, MONTH, ALL).
2. **Row 1, cash flow for the period** (mock lines 59 to 95):
   - **Left over** (wide card, `brand` tint): left over amount (NEW 5.1), kept percent of income, after debt due (NEW 5.1, shown only for MONTH), the daily spending sparkline (NEW 5.2, hidden for DAY and ALL), and the spent and kept bar.
   - **Income** and **Spending** (two small cards stacked): totals from the existing cash-flow selector.
3. **Row 2:**
   - **Spending by category** (mock 99 to 138): donut plus top-5 list (name, percent, amount) from `spendingByCategory`; subtitle says it excludes debt payments, transfers and adjustments; under it the month comparison line (NEW 5.3), shown in every period because it is always month-to-date.
   - **Debt payoff** (mock 140 to 172): overall percent paid via `payoffPercent` on the totals, paid of total, needed this month from `debtPlan` / `requiredMonthly` (with the existing surplus warning when it applies), then each active debt: name, amount left, its bar, its payment-date end, its monthly. Make a repayment button.
4. **Row 3:**
   - **Recent activity** (mock 177 to 208): the latest rows grouped by day, each day with its net, using the same grouping and net rule as the Transactions page (`groupByDay`, transfers shown but not counted). Keep the existing row component and its behaviour.
   - **Net worth and wallets** (mock 211 to 249): net worth from `netWorth` with its wallets minus debt caption, the share bar and list from `walletShares` (active wallets only), Transfer, Add wallet and Manage.
   - **Mood and spending** (mock 251 to 266): the week strip from `moodSpendingDays`, the empty line when no diary days, Log today.
5. **AI insights card** (D3): unchanged, full width, last.

## 5. New selectors

All pure, in `src/selectors/`, taking `today` as an ISO string, rounding with `roundToCents`, using `isIncome` / `isSpending` (debt payments, transfers and adjustments excluded). Each gets unit tests, including `TZ=UTC` and `TZ=Asia/Bangkok`.

1. **Left over:** for a `TimeRange`, `leftOver = income - spending`; `keptPercent = leftOver / income * 100`, `null` when income is 0; `spentShare` and `keptShare` for the bar (clamped 0 to 100; a negative left over shows a full spent bar); `afterDebtDue = leftOver - neededThisMonth` (from `debtPlan`), defined for MONTH only.
2. **Daily spending series:** one point per local day in the range, from `daySpending`, oldest first, zero-filled: WEEK 8 points, MONTH 31. Every series covers exactly the days of `filterByRange` for its period. `null` for DAY and ALL.
3. **Month-to-date comparison:** spending and left over for day 1 to N of this month against day 1 to N of last month (N = today's day, clamped to last month's length), and the percent change, `null` when last month's figure is 0.

## 6. Phases and tasks

Do Phase 132 (SL-02, the transfer refresh bug) first. Then, in order. Each line is a ready order for MASTER; the reviewer expands it from this file.

### Phase 133: dashboard-redesign-docs (docs only)

Before the task, put this file and the HTML in `docs/design/dashboard-2026-10/`. MASTER will stop on the untracked files; reply that they belong to this task.

- **DOC-1:** `task next: Dashboard redesign task DOC-1 in docs/design/dashboard-2026-10/spec.md. Commit this spec and the source HTML, write the next ADR recording decisions D1 to D5, rewrite the Dashboard section of DESIGN.md to match sections 2 to 4, and add an AGENTS.md routing row: dashboard redesign tasks read this spec, and read the source HTML only for the mock lines a task names, as the one exception to the docs/design html rule.`

### Phase 134: dashboard-selectors (money path, pauses after each spec)

- **SEL-1:** `task next: Dashboard redesign task SEL-1 in docs/design/dashboard-2026-10/spec.md: the left over selector, section 5.1, with unit tests first.`
- **SEL-2:** `task next: Dashboard redesign task SEL-2 in docs/design/dashboard-2026-10/spec.md: the daily spending series, section 5.2, with unit tests first.`
- **SEL-3:** `task next: Dashboard redesign task SEL-3 in docs/design/dashboard-2026-10/spec.md: the month-to-date comparison, section 5.3, with unit tests first.`

### Phase 135: dashboard-ui

Each task keeps every existing Dashboard assertion (locator moves only, per the spec-edit policy), adds Playwright coverage for its section with `seedLedger`, and updates the selector contract for new ids.

- **UI-1:** `task next: Dashboard redesign task UI-1 in docs/design/dashboard-2026-10/spec.md: the page header and row 1, sections 3 and 4.1 to 4.2.`
- **UI-2:** `task next: Dashboard redesign task UI-2 in docs/design/dashboard-2026-10/spec.md: row 2, spending by category with the month comparison line and the debt payoff card, section 4.3.`
- **UI-3:** `task next: Dashboard redesign task UI-3 in docs/design/dashboard-2026-10/spec.md: row 3, recent activity, net worth and wallets, mood and spending, and the insights card placement, sections 4.4 and 4.5.`

After Phase 135 merges, check the Dashboard by eye in both themes, at 1280 px and at phone width.

### Later, only if wanted

- Header and nav restyle (the mock's pill nav, Add entry, avatar). Touches every page.
- A darker brand theme closer to the mock's navy and gold, as a token change in `src/index.css` checked with `node scripts/wcag-tokens.mjs`.
