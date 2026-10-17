# T766 spec: Dashboard redesign UI-2, row 2 (spending by category with the month line, and debt payoff)

Phase 135 (branch `phase-135-dashboard-ui`, cut from `main` at `ce9983f`; T765 committed as `3f7b3e8`). Order: `spec T766: Dashboard redesign task UI-2 in docs/design/dashboard-2026-10/spec.md: row 2, spending by category with the month comparison line and the debt payoff card, section 4.3.`

## 1. Goal

Rebuild row 2 of the Dashboard to the owner spec, section 4.3:
- **Spending by category:** a donut, the top five categories (name, percent, amount) and a Details link. Under them is the month-to-date comparison line, which shows in every period.
- **Debt payoff:** the overall percent paid, paid of total, and Needed this month. The surplus warning moves into the card. Below that come each active debt and Make a repayment.

Every existing Dashboard assertion survives.

## 2. Target files

```
src/components/dashboard/CategorySpendingCard.tsx
src/components/dashboard/DebtPayoffCard.tsx
src/views/DashboardView.tsx
unit/dashboard.test.tsx
tests/dashboard.spec.ts
DESIGN.md
docs/audit/test-selector-contract.md
```

No ADR (ADR 0102 covers the redesign). No selector change. This task does not ship the phase, so `refactor-log.md` and `baseline-metrics.md` are not touched. Bookkeeping: `docs/audit/task-ledger.md` (section 9).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: styling, the 44 px floor, page contracts, the selector contract and spec-edit policy, Playwright rules.
- `DESIGN.md` section 4 (Amounts, Shared components: `Chip`, `Inset`, `ProgressBar`, `WarningBanner`) and the Dashboard section.
- `docs/design/dashboard-2026-10/spec.md` sections 1 to 4.3 and 5.3. You may open `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` at lines 99 to 172 only; every colour, size and number in it is a mock value.
- Load the `antislop` core skill with `antislop-ui` and `antislop-layoutmobile` while you work.

## 4. Current behaviour

- **Row 2 layout:** `CategorySpendingCard` (7/12) and `DebtPayoffCard` (5/12) sit in an `xl:grid-cols-12` grid (`src/views/DashboardView.tsx:185-198`). Row 1 already breaks at `lg` (T765).
- **The surplus warning** is a standalone `<DebtWarningBanner plan={plan} onReviewPlan={goTo('debts')} />` between row 1 and the net worth card (`DashboardView.tsx:166`, import `:11`). It renders nothing unless `plan.showWarning` (`src/components/dashboard/DebtWarningBanner.tsx:21`), and its test id is `dashboard-debt-warning` (`:38`).
- **`CategorySpendingCard`** (`src/components/dashboard/CategorySpendingCard.tsx:20-51`) takes `rows` and `total`:
  - Its header is the h2 "Spending by category" (`:24`), the subtitle "Excludes debt payments, transfers and balance adjustments" (`:25`) and the total as `Money` (`:27`).
  - With no rows it says "No spending in this period." (`:31`).
  - Otherwise it lists every row with a swatch, the name, `percent.toFixed(1)%`, the amount and a `ProgressBar` (`:33-48`); the percent is computed in the card (`:35`).
  - There is no chart, no link and no month line. The doc comment at `:10` still names the old Cash flow card.
- **`DebtPayoffCard`** (`src/components/dashboard/DebtPayoffCard.tsx:29-87`):
  - Header: the h2 "Debt payoff" and the `All debts` link `#dashboard-all-debts-btn` (`:32-35`).
  - "No active debts." when there are no plan items (`:38-39`).
  - The overall line "<paid> paid of <total>" with `progressPercent.toFixed(1)%`, and an `income` `ProgressBar` (`:42-49`).
  - Then each debt (`:52-79`):
    - id `dashboard-debt-${id}`;
    - the name and `−remaining` in `text-expense`;
    - a `ProgressBar` labelled `${name} payoff progress`;
    - a meta line `${percent}%` or `Overdue`, then ` · due <date>` or ` · no due date`;
    - `฿X / month needed`, in `text-pending` when `exceedsSurplus`.
  - `Make a repayment`, `#dashboard-repay-btn` (`:82-84`).
  - There is no Needed this month figure, and the card has no region name.
- **Data:**
  - `monthToDate(txs, today, categories?)` (`src/selectors/ledger.ts:145-163`) returns:
    - `days` (N);
    - `thisMonth` and `lastMonth`, each `{ start, end, spending, leftOver }`;
    - `spendingChange` and `leftOverChange`, `null` when last month's figure is 0.
  - Nothing renders it yet. `plan.totalRequired` is the sum of the rounded per-debt figures (`src/selectors/debts.ts:115`).
  - `formatMonthName('2026-10')` is `"October"` (`src/utils/date.ts:92-94`); `monthKeyOf` is at `:97`. `SYSTEM_CATEGORY_COLOR` is exported from `src/selectors/ledger.ts:175`.
  - `DashboardLink` is the Dashboard's text link with a 44 px box (`src/components/dashboard/DashboardLink.tsx:12-20`).
- **Assertions this task must keep** (`unit/dashboard.test.tsx`):
  - `:123`: acceptance check 1 finds the category card by `getByRole('heading', { name: 'Spending by category' }).closest('div')!.parentElement!` and expects its text to contain the Spending figure. The total moves to the donut centre, so this locator must move (6.1).
  - `:127-132`: two `listitem`s, no repayment, adjustment or transfer names.
  - `:410-416`: exactly two `/\/ month needed/` texts (`฿3,293.43` with `text-pending`, `฿494.91` without), and `/due Jan 1, 2027/`.
  - `:418-422`: `Gift payoff progress` at 100, and exactly two `/^100\.0% · no due date$/`. This exact-text match is why the per-debt meta line keeps its wording (no "paid", no "ends").
  - `:424-428`: `/^Overdue/` with `text-expense`.
  - `:391-408`: `DebtWarningBanner` rendered alone, which is unchanged.
- **Playwright:** `theme.spec.ts:57` and `toast-layering.spec.ts:68` match the heading "Debt payoff" after leaving the Dashboard (unchanged). `tests/dashboard.spec.ts` (T765) declares `seedTestTransactions(page: any)` and `expectCleanCard` inside the row 1 `describe` (`:7-43`).

## 5. Parity map

None. No ledger arithmetic, and every figure comes from an existing selector.

## 6. Tests to add

Write these first and run them against the unchanged components (red gate, section 8 step 1). They fail today for these reasons:
- `CategorySpendingCard` has no region name, donut, Details link or month line, and takes no `monthToDate`/`onOpenDetails` props (also `tsc` errors).
- `DebtPayoffCard` has no "Needed this month", no region name and no banner inside.
- The Playwright row 2 tests find no region named "Spending by category" or "Debt payoff".

Card texts that mix `Money` spans with plain text (the month line, "paid of") are checked with `toContain` on the card's `textContent`. `getByText` sees only an element's own text nodes.

### 6.1 `unit/dashboard.test.tsx`

Imports: add `monthToDate` to the `../src/selectors/ledger` import; `CategorySpend` is a type import from the same module.

**Locator moves** (the assertions stay word for word):

1. Acceptance check 1 (`:110-125`): render `<CategorySpendingCard rows={rows} total={flow.spending} monthToDate={monthToDate(ROWS, TODAY, CATEGORIES)} onOpenDetails={() => {}} />`. Find the card with `screen.getByRole('region', { name: 'Spending by category' })` in place of the `closest('div')!.parentElement!` chain. The `toContain(spending)` and row-sum assertions stay.
2. "Leaves repayments..." (`:127-132`): the same two new props. The `listitem` count of 2 and the name check stay.
3. The four `DebtPayoffCard` tests (`:410-428`) keep their props and assertions unchanged. They must still pass with the banner inside the card: `:410` uses surplus 3,106.78, so the banner now renders inside. Its text "needs ฿3,293.43 a month" holds neither "/ month needed" nor "due Jan 1".

**New `describe('Spending by category card (owner spec 4.3)')`.** Use `TODAY` `2026-09-28` (N = 28, since August has 31 days) and build `CategorySpend` rows directly where noted.

4. **Top five and the rest:** seven rows, `A` to `G`, amounts 700, 600, 500, 400, 300, 200 and 100 (total 2,800), colours of your choice.
   - Six `listitem`s. The first contains `25.0%` and `฿700.00`. The sixth contains `2 more categories` and `10.7%`, and no `฿`.
   - `getByRole('img', { name: 'Spending by category: A 25.0%, B 21.4%, C 17.9%, D 14.3%, E 10.7%, 2 more categories 10.7%' })`.
   - The svg has 7 `circle`s (track plus six segments). The card text contains `฿2,800.00` and `total spent`.
5. **One category:** the single segment's `stroke-dasharray` is `100 0`, and the img name is `Spending by category: <name> 100.0%`.
6. **Empty:** `rows={[]}` and `total={0}` show `No spending in this period.`, no `img` and no `listitem`. The month line still renders (its lead `September 1 to 28:` is present).
7. **Month line, spending down:**
   - `tx` rows: INCOME 10,000 (`cat-salary`, `2026-09-01`); EXPENSE 3,000 (`cat-food`, `2026-09-10`); EXPENSE 6,000 (`cat-food`, `2026-08-10`).
   - Use `monthToDate(rows, TODAY, CATEGORIES)` and `rows={[]}`.
   - `getByText('September 1 to 28:')`.
   - The card's `textContent` contains `฿3,000.00 spent, against ฿6,000.00 in August 1 to 28.` and `+฿7,000.00 left over.`
   - `getByText(\`${MINUS}50% vs Aug\`)` has class `bg-adjust-tint`.
8. **Month line, spending up:** this month 3,000 (`2026-09-10`), last month 2,400 (`2026-08-10`). `getByText('+25% vs Aug')` has class `bg-expense-tint`, and the left-over figure `−฿3,000.00` has class `text-expense`.
9. **Month line, nothing last month:** only the September rows of test 7.
   - `queryByText(/vs Aug/)` is null.
   - The text contains `against ฿0.00 in August 1 to 28.`
   - The card's `textContent` plus every `aria-label` does not match `/NaN|Infinity/` or `/(^|[^0-9])%/`.
10. **Day 1:** `monthToDate(rows, '2026-10-01', CATEGORIES)` gives `getByText('October 1:')`, and the text contains `in September 1.`
11. **Details:** clicking `getByRole('button', { name: 'Details' })` calls `onOpenDetails` once.
12. **No NaN, Infinity or bare `%`:** for each of these, the same check as test 9 over the whole card:
    - tests 4, 6 and 8;
    - an all-empty `monthToDate([], TODAY, CATEGORIES)` with `rows={[]}`.

**New `describe('Debt payoff card (owner spec 4.3)')`,** with the `debts` of acceptance check 4 (`:392`) and `paid={5677.21} total={28254.21} progressPercent={20.1}`:

13. **Overall and needed:** with surplus 10,000:
    - `getByText('20.1%')` has class `text-income`, and the card text contains `20.1% paid off`.
    - The card text contains `฿5,677.21 of ฿28,254.21`.
    - `getByText('Needed this month')` is present, and `getByText('฿3,788.34')` (3,293.43 + 494.91) has class `text-expense`.
    - `queryByRole('note')` is null.
14. **Warning inside the card:** with surplus 3,106.78 and `onOpenDebts = vi.fn()`, `within(getByRole('region', { name: 'Debt payoff' })).getByRole('note')` contains `SPayLater needs ฿3,293.43 a month`. Clicking its `Review plan` calls `onOpenDebts` once.

### 6.2 `tests/dashboard.spec.ts`

**Restructure** (row 1 assertions stay word for word):
- Move `expectCleanCard` and `seedTestTransactions` to module scope, above the row 1 `describe`.
- Type the page parameter as `Page` (`import { test, expect, type Locator, type Page }`).
- Give the seed a second parameter, `debts = [SAMPLE_STUDENT_LOAN]`, passed to `seedLedger`.
- Add a fourth row to the seed: `tx-e2e-dash-housing`, EXPENSE 6,000 on `cat-housing`, dated `2026-09-05`. It is outside Past 30 days (from `2026-09-16`), This week and Today, so no row 1 figure that a test asserts changes. Only All time moves, and only `expectCleanCard` reads it.

**New `test.describe('Dashboard row 2: spending by category and debt payoff')`.** Use the same `timezoneId` and `setFixedTime(new Date('2026-10-16T15:00:00+07:00'))` in a `beforeEach`. Locate the cards with `page.getByRole('region', { name: 'Spending by category', exact: true })` and `{ name: 'Debt payoff', exact: true }`.

1. **Past 30 days:**
   - The category region contains `฿3,000.00`, `total spent`, `Food & Dining`, `83.3%`, `฿2,500.00`, `Groceries`, `16.7%` and `฿500.00`.
   - The image `Spending by category: Food & Dining 83.3%, Groceries 16.7%` is visible.
   - The region also contains `October 1 to 16:`, `฿3,000.00 spent, against ฿6,000.00 in September 1 to 16.`, `+฿7,000.00 left over.` and `−50% vs Sep` (U+2212).
   - The debt region contains `55.0%`, `paid off`, `฿5,500.00 of ฿10,000.00`, `Needed this month`, `฿1,500.00`, `Student Loan`, `−฿4,500.00`, `55.0% · due Dec 31, 2026` and `฿1,500.00 / month needed`.
   - The debt region has 0 `role=note`.
2. **The month line ignores the period:** click `#time-filter-day` and expect `aria-pressed="true"`. The category region then contains `Groceries` and `100.0%`, and still `October 1 to 16:` and `−50% vs Sep`.
3. **Links:**
   - Click `#dashboard-category-details-btn`; `#nav-tab-transactions` has `aria-current="page"`.
   - `await gotoTab(page, 'dashboard')`, click `#dashboard-repay-btn`; `#nav-tab-debts` has `aria-current="page"`.
4. **New account** (clock only, no seed):
   - The category region contains `No spending in this period.`, `October 1 to 16:` and `฿0.00 spent, against ฿0.00 in September 1 to 16.`, and not `vs Sep`.
   - `expectCleanCard` passes on it.
   - The debt region contains `No active debts.`
5. **The warning sits in the card:**
   - Seed with `debts = [{ ...SAMPLE_STUDENT_LOAN, id: 'debt-e2e-big', name: 'Big loan', totalAmount: 60000, remainingAmount: 60000 }]`. That is 20,000 a month for 3 months, against a surplus of 7,000.
   - The debt region's `getByRole('note')` is visible and contains `Big loan needs ฿20,000.00 a month`.
   - `page.getByTestId('dashboard-debt-warning')` has count 1.

## 7. The change

### 7.1 `src/components/dashboard/CategorySpendingCard.tsx`

**Props:** `{ rows: CategorySpend[]; total: number; monthToDate: MonthToDate; onOpenDetails: () => void }`. Update the doc comment: owner spec 4.3. `total` is `leftOverFor`'s spending, the same figure as the Spending card. The percents and donut geometry are computed here; they are display, not money.

**Shell:**
- `<section aria-labelledby="dashboard-category-title" className="min-w-0 h-full">` around `<Card className="h-full flex flex-col gap-5">`.
- Header row (`flex items-start justify-between gap-4`): the h2 `id="dashboard-category-title"` "Spending by category" with its subtitle unchanged, and `<DashboardLink id="dashboard-category-details-btn" onClick={onOpenDetails}>Details</DashboardLink>` on the right.
- The top-right total `Money` is removed (it moves to the donut centre).

**Body:**
- With no rows, keep `<p className="text-sm text-fg-muted py-6 text-center">No spending in this period.</p>`.
- Otherwise `<div className="flex flex-wrap items-center gap-x-8 gap-y-6">` holding the donut and the list.

**Shown rows:**
- `shown = rows.slice(0, 5)`, and `rest = rows.slice(5)`.
- `percentOf(amount) = total > 0 ? (amount / total) * 100 : 0`.
- `restPercent` is the sum of the rest's percents.
- `moreLabel` is `` `${rest.length} more ${rest.length === 1 ? 'category' : 'categories'}` ``.

**Donut** (a local function component):
- The outer box is `relative w-42 h-42 shrink-0 mx-auto`.
- `<svg role="img" aria-label={label} viewBox="0 0 42 42" className="w-42 h-42 block">`. Inside:
  - The track: `<circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth={5} className="stroke-surface-2" />`.
  - One circle per shown row, plus one for the rest when there is any. The rest uses `SYSTEM_CATEGORY_COLOR`.
- Segment `i` has `stroke={color}`, `strokeDasharray={\`${p} ${100 - p}\`}` and `strokeDashoffset={25 - before}`.
  - `p` is its percent and `before` is the sum of the earlier segments' percents. Round each to 2 decimals with `Number(x.toFixed(2))`.
  - A lone row gives `100 0`.
- `label` is `Spending by category: ` followed by each segment's `${name} ${p.toFixed(1)}%`, joined with `, `. The rest is named `moreLabel`.
- The centre is `absolute inset-0 flex flex-col items-center justify-center pointer-events-none`. It holds `<Money value={total} className="text-xl font-semibold text-fg" />` and `<span className="text-xs text-fg-muted">total spent</span>`.

**List:** `<ul className="flex-1 basis-70 min-w-0 flex flex-col gap-1">`.
- Each shown row is an `li` keyed `row.categoryId ?? 'uncategorized'`, with `className="flex items-center gap-3 py-1.5 text-sm"`. In order:
  - A neutral tile `<span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-control bg-surface-2 flex items-center justify-center">` holding a `w-2.5 h-2.5 rounded-full` dot in `row.color`. The category colour is the dot only, as `Chip` does.
  - The name, `flex-1 min-w-0 truncate text-fg`.
  - `<span className="w-14 shrink-0 text-right text-xs text-fg-muted">{p.toFixed(1)}%</span>`.
  - `<Money value={row.amount} className="w-24 shrink-0 text-right font-semibold text-fg" />`.
- When `rest.length > 0`, one more `li` keyed `more`, with the same layout:
  - a dot in `SYSTEM_CATEGORY_COLOR`;
  - the name `moreLabel`;
  - its percent;
  - an empty `<span className="w-24 shrink-0" />` in place of an amount. No money is summed in a component (`AGENTS.md`: money figures come from `src/selectors/`).
- Remove the per-row `ProgressBar`; the donut replaces it.

**Month line** (always rendered, last in the card): `<Inset className="mt-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">`.

From `const m = monthToDate`:
- `thisName = formatMonthName(monthKeyOf(m.thisMonth.start))` and `lastName = formatMonthName(monthKeyOf(m.lastMonth.start))`.
- `span(name) = m.days === 1 ? \`${name} 1\` : \`${name} 1 to ${m.days}\``.
- `short = lastName.slice(0, 3)`. The en-US long month names start with their short forms.

The text is `<p className="flex-1 basis-80 min-w-0 text-sm text-fg-secondary">`. In JSX it reads: `<span className="font-semibold text-fg">{span(thisName)}:</span>`, `{' '}`, `<Money value={m.thisMonth.spending} className="font-medium text-fg" />`, `{' spent, against '}`, `<Money value={m.lastMonth.spending} className="font-medium text-fg" />`, `{\` in ${span(lastName)}. \`}`, `<Money value={m.thisMonth.leftOver} showPlus className={'font-medium ' + (m.thisMonth.leftOver < 0 ? 'text-expense' : 'text-fg')} />`, `{' left over.'}`.

For example: "October 1 to 16: ฿3,000.00 spent, against ฿6,000.00 in September 1 to 16. +฿7,000.00 left over."

The comparison is stated as both figures, not as their difference, so the card does no money arithmetic.

**Pill** (only when `m.spendingChange !== null`):
- `r = Math.round(m.spendingChange)`.
- The text is `` `${r < 0 ? MINUS : r > 0 ? '+' : ''}${Math.abs(r)}% vs ${short}` `` (import `MINUS` from `utils/currency`).
- `className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold "`, followed by:
  - `bg-expense-tint text-expense` when `r > 0`: spending rose, in spending's hue;
  - otherwise the neutral chip pair `bg-adjust-tint text-chip-text`.
- Green is income's hue only (`DESIGN.md` section 1), so a fall in spending is not coloured green. The sign and the words carry the meaning.

With `spendingChange` null there is no pill and no `%` anywhere. No icon.

### 7.2 `src/components/dashboard/DebtPayoffCard.tsx`

Wrap the card in `<section aria-labelledby="dashboard-debts-title" className="min-w-0 h-full">`. The h2 gets `id="dashboard-debts-title"`. Keep the header link, the empty line, the debt list (`:52-79`, word for word) and the button. Replace the overall block (`:41-50`) with, in order:

1. The overall block, `<div className="flex flex-col gap-2.5">`:
   - A row `flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1` holding:
     - `<p className="text-2xl font-semibold text-income">{progressPercent.toFixed(1)}%<span className="text-sm font-normal text-fg-secondary"> paid off</span></p>`
     - `<p className="text-xs text-fg-muted"><Money value={paid} /> of <Money value={total} /></p>`
   - The existing `ProgressBar` (`tone="income" size="md" label="Overall payoff progress"`), unchanged.
2. `<Inset className="px-4 py-3 flex items-center justify-between gap-4">`, holding `<span className="text-sm text-fg-secondary">Needed this month</span>` and `<Money value={plan.totalRequired} className="text-base font-semibold text-expense" />`. The box stays neutral (`surface-2`, a checked pair): colour is on the number, as on every card.
3. `<DebtWarningBanner plan={plan} onReviewPlan={onOpenDebts} />` (import it). It renders nothing unless `plan.showWarning`.

Update the doc comment: owner spec 4.3. The surplus warning now lives in this card.

### 7.3 `src/views/DashboardView.tsx`

- Remove the standalone `DebtWarningBanner` (`:166`) and its import (`:11`).
- Add `monthToDate` to the `../selectors/ledger` import. Add `const mtd = useMemo(() => monthToDate(transactions, today, categoryMap), [transactions, today, categoryMap]);` beside `leftOver`, with a one-line comment: always month-to-date, whatever the period (owner spec 4.3, D4).
- Row 2 (`:185-198`): `xl:grid-cols-12` becomes `lg:grid-cols-12`, and `xl:col-span-7` / `xl:col-span-5` become `lg:col-span-7` / `lg:col-span-5`, matching row 1.
- Pass `monthToDate={mtd}` and `onOpenDetails={goTo('transactions')}` to `CategorySpendingCard`. `DebtPayoffCard`'s props are unchanged.
- Row 3 and everything else stay.

### 7.4 `DESIGN.md`

In the Dashboard table's "Row 2: Spending by category" row (`:199`), replace "A donut and the top five (name, percent, amount)" with "A donut and the top five (name, percent, amount); any further categories are one grey segment and one "N more categories" row with its percent". Leave the rest of the row and every other line.

### 7.5 `docs/audit/test-selector-contract.md`

- **The `dashboard.spec.ts` ids line:** add `#dashboard-category-details-btn`, `#dashboard-repay-btn`, `#nav-tab-debts` and `#nav-tab-transactions`, kept in alphabetical order.
- **The `dashboard.spec.ts` text-locator line:** add the regions "Spending by category" and "Debt payoff" (`exact: true`), the donut's name "Spending by category: <name> <p>%, ...", the month line's "<Month> 1 to N:" lead and "vs <Mmm>" pill, and "Needed this month".

## 8. Gates

Save full-suite output under `workflow/stages/02_build/output/logs/`. Before Playwright, check ports 3000 and 3100 for stale servers; `toast-layering.spec.ts` uses 3100. Never edit `src/` while Playwright runs.

1. **Red,** before any `src/` change: `npx vitest run unit/dashboard.test.tsx` (the new tests fail; record it) and `npx playwright test tests/dashboard.spec.ts --project=chromium` (the row 2 tests fail; the row 1 tests still pass).
2. `npm run lint`
3. `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`
4. `npm run test:unit`
5. `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/layout-stability.spec.ts tests/reduced-motion.spec.ts --project=chromium`
6. The same six specs without a project filter.
7. `node scripts/wcag-tokens.mjs` passes.
8. `git ls-files --eol` on all seven target files shows `w/crlf`.
9. **No new em dash:** for each target file, `git diff -U0 -- <file>` lines starting with `+` contain no U+2014. Count with `node -e "const s=require('child_process').execSync('git diff -U0 -- ' + process.argv[1]).toString(); console.log(process.argv[1], s.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n').split(String.fromCharCode(0x2014)).length - 1)" <file>`. It prints 0 for each.
10. `grep -n "text-\[[0-9]*px\]\|#[0-9A-Fa-f]\{6\}" src/components/dashboard/CategorySpendingCard.tsx src/components/dashboard/DebtPayoffCard.tsx` prints nothing.
11. `git status --porcelain` lists only the target files, `docs/audit/task-ledger.md` and this task's stage outputs.

## 9. Bookkeeping

In `docs/audit/task-ledger.md`'s Phase 135 table, after the T765 row, add `| T766 | Dashboard redesign UI-2: row 2, spending by category with the month line, and debt payoff (owner spec 4.3) | <the seven target files> | done | | <gate results> |`, with `Commit` left empty.

## 10. Production touch points

None. No SQL, no `/api/*`, no sign-in, no `vercel.json` or workflow change, no dependency, no deleted file.

## 11. Out of scope

- Any selector: no "Other" money total, no top-five selector. The rest row shows a percent and no amount.
- `DebtWarningBanner.tsx` itself: it only moves into the card. `ProgressBar`, `WarningBanner`, `DashboardLink`.
- The per-debt meta line's wording. The owner mock says "% paid · ends <date>", but `:418-422` asserts `^100\.0% · no due date$` exactly, and "due" is what the Debt payoff page says.
- Row 3, `NetWorthCard`, `WalletsSection`, the insights card and `ViewLoadingFallback` (UI-3).
- The stale comment at `src/components/ui/AllocationBar.tsx:56` (UI-3). The one at `CategorySpendingCard.tsx:10` is fixed here, since the file is rewritten.
- `tests/helpers.ts`.
- Suite counts in `AGENTS.md` and `docs/contexts/ui-and-e2e.md` (UI-3 ships the phase).
