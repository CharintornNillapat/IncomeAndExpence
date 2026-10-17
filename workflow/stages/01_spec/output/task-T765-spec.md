# T765 spec: Dashboard redesign UI-1, the page header and row 1

Phase 135 (branch `phase-135-dashboard-ui`, cut from `main` at `ce9983f`). Order: `spec T765: Dashboard redesign task UI-1 in docs/design/dashboard-2026-10/spec.md: the page header and row 1, sections 3 and 4.1 to 4.2.`

**Amendment 1 (owner, 2026-10-17).** It changes the Left over caption and adds a rule; everything else stands.

- **Caption when `keptPercent` is null:**
  - With spending and no income, the kept part reads exactly `No income this period`. It replaces "No income in this period".
  - With no income and no spending, nothing renders under the figure: no `<p>` at all, so the MONTH "after debt due" part is dropped too, even with a debt due.
  - "Nothing earned or spent in this period" is gone.
  - Read as the owner's rule for the kept wording only: with spending and no income in Past 30 days, the unchanged after-debt part still follows it (`No income this period · −฿X after debt due`).
  - The spent and kept bar with its "Spent N%" / "Kept N%" line is not the caption, so it still renders.
- **New rule:** the card never renders `NaN`, `Infinity`, or a `%` without a digit right before it. This holds in any period, the new account included, and covers its text and every `aria-label` in it. Tests: 6.1 test 10 and 6.2 test 5.
- **Assertion change:** the moved unit assertion `getByText('No income in this period')` (`unit/dashboard.test.tsx:149`) now expects `No income this period`. That is the owner's copy change, not a weakened assertion.
- **Changed here:** sections 6.1 (tests 2, 8 and 10), 6.2 (tests 2, 4 and 5), 7.2 and 7.5.

## 1. Goal

Rebuild the top of the Dashboard to match the owner spec: the page header (4.1) and row 1, "cash flow for the period" (4.2). Row 1 is a wide brand-tinted Left over card (figure, kept share, after debt due, daily spending sparkline, spent and kept bar) with two small Income and Spending cards stacked beside it. It follows the section 3 rules that apply to these parts. Every existing Dashboard assertion survives.

## 2. Target files

```
src/components/dashboard/LeftOverCard.tsx        (new)
src/components/dashboard/CashFlowCard.tsx
src/views/DashboardView.tsx
unit/dashboard.test.tsx
tests/dashboard.spec.ts                           (new)
DESIGN.md
docs/audit/test-selector-contract.md
```

No ADR: ADR 0102 already records the redesign. This task does not ship the phase (UI-3 does), so it does not touch `refactor-log.md` or `baseline-metrics.md`. Bookkeeping: `docs/audit/task-ledger.md` (section 9).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: styling, the 44 px floor, motion, page contracts, the selector contract and spec-edit policy, Playwright rules.
- `DESIGN.md` section 2 (type scale), section 4 Amounts and Shared components, and the Dashboard section (`DESIGN.md:161-206`).
- `docs/design/dashboard-2026-10/spec.md` sections 1 to 4.2. You may open `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` at lines 59 to 95 only (row 1); every colour, size and number in it is a mock value.
- Load the `antislop` core skill with `antislop-ui` and `antislop-layoutmobile` while you work (the owner's standing rule for UI phases).

## 4. Current behaviour

- **Header (4.1): already compliant, no change.** `PageHeader` renders the one `h1` with the greeting and `formatLongDate(today)` (`src/views/DashboardView.tsx:134-136`, `src/components/ui/PageHeader.tsx:20`). The period control is `SegmentedControl` `size="sm"` with ids `time-filter-day|week|month|all` (`DashboardView.tsx:138-144`, `PERIODS` at `:31-36`). Both sizes have a 44 px hit box (`src/components/ui/SegmentedControl.tsx:36`). The page shows no sync state. Rules 1 (period part), 4 and 5 already hold for the header.
- **Row 1 today** is `NetWorthCard` (5/12) next to `CashFlowCard` (7/12) in a `md:grid-cols-12` grid (`DashboardView.tsx:148-160`).
- `CashFlowCard` (`src/components/dashboard/CashFlowCard.tsx:32-70`) takes `flow`, `periodName`, `periodDates`. It renders one card with the uppercase `h2` "Cash flow · {periodName}" (`:35`), three cells with test ids `metric-card-income`, `metric-card-expense`, `metric-card-net` (`:40`, `:47`, `:54`), a `ProgressBar` of the spent share (`:66`) and a caption (`caption()`, `:16-21`) that reads "No income in this period" / "Nothing earned or spent in this period" without income.
- `flow` is `cashFlow(periodRows, categoryMap)` (`DashboardView.tsx:89`). `CategorySpendingCard` gets `total={flow.spending}` (`:175`). That keeps acceptance check 1 (one Spending figure) true.
- `plan = debtPlan(...)` is computed at `:104-107`, after `flow`.
- The Phase 134 selectors exist but nothing renders them yet. `leftOverFor(txs, range, today, neededThisMonth, categories?)` (`src/selectors/ledger.ts:99-115`) filters by the range itself and returns `CashFlow` plus `keptPercent` (`null` without income, negative when spending passed income), `spentShare`/`keptShare` (sum 100 with income; 100/0 or 0/0 without), and `afterDebtDue` (MONTH only, else `null`). `dailySpendingSeries(txs, range, today, categories?)` (`src/selectors/diary.ts:53-67`) returns 8 points for WEEK, 31 for MONTH, `null` for DAY and ALL.
- Tokens: `bg-brand-tint` is `rgba(139, 92, 246, 0.12)` (`src/index.css:299`); fills `bg-expense-fill`, `bg-brand-fill` (`:297`, `:303`); `bg-brand-soft` with `text-brand-soft-text` is a checked pair (`scripts/wcag-tokens.mjs:91`). I measured text on `brand-tint` over `canvas` and `surface-1` with a scratch copy of `scripts/wcag-tokens.mjs`. Every pair passes 4.5:1 in both themes; the lowest are `fg-muted` 4.68 (light, over `surface-1`) and 4.87 (light, over `canvas`), and `expense-text` 5.19 (light).
- No text-size token exists above Tailwind's defaults; the shipped hero figure is `text-4xl font-semibold tracking-tight` (`src/components/dashboard/NetWorthCard.tsx:28`). Card titles on this page are `h2` `text-base font-semibold text-fg` (`CategorySpendingCard.tsx:24`, `DebtPayoffCard.tsx:32`).
- Specs that read row 1: `date-boundary.spec.ts:88-101` (`#time-filter-week`, then `metric-card-expense` contains `฿1,000.00` and not `฿3,000.00`); `theme.spec.ts:63` (`net-worth-card` visible); `auth.spec.ts:104-105` and `reduced-motion.spec.ts:35-36` (`#time-filter-week`). Unit: `unit/dashboard.test.tsx:99-151` (acceptance check 1 and the Left over net rule).
- `DESIGN.md` lines this task makes stale: `:80` "Hero number (net worth)", `:108` "THB appears only beside the hero number", `:326` cites `CashFlowCard.tsx:35` as an uppercase section label, `:335` the "Spent-vs-left bar" deviation row.

## 5. Parity map

None. No ledger arithmetic changes; the figures come from existing selectors.

## 6. Tests to add

Write these first and run them against the unchanged code (red gate, section 8 step 1). The new unit tests fail because `src/components/dashboard/LeftOverCard.tsx` does not exist (import error) and `CashFlowCard` has no `kind`/`amount` props. The new Playwright spec fails because the page has no region named "Left over".

### 6.1 `unit/dashboard.test.tsx`

Imports: add `LeftOverCard` from `../src/components/dashboard/LeftOverCard`, `leftOverFor` to the `../src/selectors/ledger` import, and `dailySpendingSeries` to the `../src/selectors/diary` import. `cashFlow` stays imported (acceptance check 1 uses it). TZ is already `Asia/Bangkok`; `TODAY` is `2026-09-28` (a Monday).

Locator moves (the assertions stay word for word):

1. Acceptance check 1 (`:110-125`): render `<CashFlowCard kind="spending" amount={flow.spending} />` in place of the old `CashFlowCard` call. The `metric-card-expense` and category-card assertions are unchanged.
2. "Left over follows the net rule" (`:135-151`): render `<LeftOverCard data={leftOverFor(rows, 'DAY', TODAY, 0, CATEGORIES)} series={null} periodName="today" periodDates="Sep 28" />` with the same rows. Find the figure with `screen.getByText(\`+${formatCurrencyAmount(300)}\`)` and `screen.getByText(\`${MINUS}${formatCurrencyAmount(200)}\`)` in place of `getByTestId('metric-card-net').lastElementChild`. The text, `text-fg`, not-`text-income` and `text-expense` assertions stay. The "No income in this period" assertion becomes `screen.getByText('No income this period')` (Amendment 1; exact match, since DAY has no after-debt part).

New `describe('Left over card (owner spec 4.2)')`, rows built with the existing `tx()` (dated `TODAY`), income on `cat-salary`, spending on `cat-food`. The kept line and the after-debt figure share one `<p>`, so match caption words with a regex (`getByText(/70% of income kept/)`); a `Money` figure is its own span and matches exactly:

3. **MONTH with a debt due:** income 10,000, spending 3,000, `leftOverFor(rows, 'MONTH', TODAY, 1500, CATEGORIES)`. Expect the texts `+฿7,000.00`, `70% of income kept`, `฿5,500.00`, `after debt due` (regex), `Spent 30%`, `Kept 70%`.
4. **No after-debt line outside MONTH:** the same rows with `'DAY'` give `queryByText(/after debt due/)` null.
5. **Spending passed income:** income 1,000, spending 1,200, `'MONTH'`, needed 100. Expect `Spent 20% more than earned`, the figure `−฿200.00` with `text-expense`, and the after-debt figure `−฿300.00` with `text-expense`.
6. **Sparkline:** spending 2,500 on `TODAY`, `series = dailySpendingSeries(rows, 'WEEK', TODAY, CATEGORIES)`, `periodName="this week"`. Expect `getByRole('img', { name: 'Daily spending, this week: highest ฿2,500.00 on Mon, Sep 28' })`. Its `polyline`'s `points` attribute splits into 8 pairs, and none contains `NaN`.
7. **No sparkline without a series:** `series={null}` gives `queryByRole('img')` null.
8. **New account:** `leftOverFor([], 'MONTH', TODAY, 0, CATEGORIES)` with `dailySpendingSeries([], 'MONTH', TODAY, CATEGORIES)` and `periodName="past 30 days"`. Expect:
   - the figure `฿0.00` (unsigned);
   - `container.querySelector('p')` null (the caption is the card's only `<p>`, so this proves no caption and no empty `<p>`);
   - `queryByText(/after debt due/)` null and `queryByText(/No income/)` null;
   - the img name `Daily spending, past 30 days: nothing spent`;
   - `container.innerHTML` not matching `/NaN|Infinity/`.
   
   Render it again with needed 1500 (`leftOverFor([], 'MONTH', TODAY, 1500, CATEGORIES)`): still no `<p>` and no `after debt due`.
9. **Income and Spending cards:** `<CashFlowCard kind="income" amount={10000} />` shows heading `Income` (`getByRole('heading', { name: 'Income' })`) and `+฿10,000.00` with `text-income`. `kind="spending" amount={3000}` shows heading `Spending` and `−฿3,000.00` with `text-expense`.
10. **No NaN, Infinity or bare percent, in any period (Amendment 1):** a `describe` with `it.each` over the four ranges `DAY`, `WEEK`, `MONTH`, `ALL`.
    - **Periods:** each range's `periodName` is `today`, `this week`, `past 30 days` or `all time`.
    - **Datasets:** six, rows dated `TODAY` and `2026-09-25`:
      - empty;
      - income only (1,000);
      - spending only (250);
      - income 1,000 with spending 300;
      - spending past income (income 1,000, spending 1,200);
      - income 3 with spending 1 (a kept share that rounds, 66.67%).
    - **Each render:** every dataset with needed 0 and again with needed 1,500. Render `<LeftOverCard data={leftOverFor(rows, range, TODAY, needed, CATEGORIES)} series={dailySpendingSeries(rows, range, TODAY, CATEGORIES)} periodName=... periodDates="x" />`, then `unmount()`.
    - **Assertions:**
      - `container.innerHTML` does not match `/NaN|Infinity/`; this covers the attributes and the sparkline points.
      - Build one string from `container.textContent` and every `aria-label` value (`container.querySelectorAll('[aria-label]')`). It does not match `/NaN|Infinity/` or `/(^|[^0-9])%/`.
    - **Why it fails today:** the module is missing, like every test here. The red case it guards is a caption or label built from a `null` or non-finite percent (`Math.round(null)` gives `0`, `Math.round(NaN)` gives `NaN`), or a template that prints `%` beside an empty value.

### 6.2 `tests/dashboard.spec.ts` (new)

`test.describe('Dashboard row 1: left over, income and spending')` with `test.use({ timezoneId: 'Asia/Bangkok' })`. Each test, before `page.goto('/')`:

- `await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'))`.
- For the seeded tests, `await seedLedger(page, { debts: [SAMPLE_STUDENT_LOAN] })`: remaining 4,500, due 2026-12-31, so 3 months left and ฿1,500.00 needed this month.
- Then one `page.addInitScript` that writes `pf_transactions`, the way `date-boundary.spec.ts:57-83` does. Use base fields `userId: 'usr-guest-01'`, `walletId: 'wal-main-checking'`, `isDeleted: false`, `createdBy`, `createdAt`/`updatedAt` = `new Date().toISOString()`, and three rows:
  - `tx-e2e-dash-income`: INCOME 10,000 on `cat-salary`, dated `2026-10-01`.
  - `tx-e2e-dash-food`: EXPENSE 2,500 on `cat-food`, dated `2026-10-10`.
  - `tx-e2e-dash-groceries`: EXPENSE 500 on `cat-groceries`, dated `2026-10-16`.
  
  No test reloads, so the script needs no guard. Do not change `tests/helpers.ts`.

Locate the cards with `page.getByRole('region', { name: 'Left over', exact: true })` and the test ids. `exact: true` matters: "Spending insights" is also a region.

1. **Past 30 days (default):** the Left over region contains `+฿7,000.00`, `70% of income kept`, `฿5,500.00 after debt due`, `Spent 30%`, `Kept 70%`, `Sep 16 – Oct 16`. The image `Daily spending, past 30 days: highest ฿2,500.00 on Sat, Oct 10` is visible. `metric-card-income` contains `+฿10,000.00`; `metric-card-expense` contains `−฿3,000.00` (U+2212).
2. **Today and This week:** click `#time-filter-day` and expect `aria-pressed="true"`. Left over then contains `−฿500.00` and `No income this period`, not `after debt due`, and the region has 0 `img`. `metric-card-expense` contains `−฿500.00`; `metric-card-income` contains `฿0.00`. Click `#time-filter-week`: the image `Daily spending, this week: highest ฿2,500.00 on Sat, Oct 10` is visible and `after debt due` is absent.
3. **Phone width:** `page.setViewportSize({ width: 390, height: 844 })`, seeded. The Income region (`getByRole('region', { name: 'Income', exact: true })`)'s top is at or below the Left over region's bottom (bounding boxes). `document.documentElement.scrollWidth <= window.innerWidth`.
4. **New account:** no seeding (clock only).
   - In Past 30 days, Left over contains `฿0.00`, `region.locator('p')` has count 0, and it contains neither `No income` nor `after debt due`. The image `Daily spending, past 30 days: nothing spent` is visible.
   - Then click `#time-filter-day`, `#time-filter-week`, `#time-filter-month` and `#time-filter-all` in turn. After each, `aria-pressed="true"` is on the clicked button, `region.locator('p')` has count 0, and `expectCleanCard(region)` passes.
5. **Every period, seeded (Amendment 1):** seeded as above. Click the four period buttons in the same order, wait for `aria-pressed="true"` each time, then call `expectCleanCard(region)`.

Define `expectCleanCard(region)` once in the spec file, as a plain async function:

- It builds one string from `await region.innerText()` and every `aria-label` in the region (`region.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))`).
- It expects that string not to match `/NaN|Infinity/`, nor `/(^|[^0-9])%/` (a `%` with no digit right before it).

No fixed waits: the `aria-pressed` assertion is the wait.

## 7. The change

### 7.1 `src/components/dashboard/CashFlowCard.tsx`: one small card

Replace the component. New props: `{ kind: 'income' | 'spending'; amount: number }` (`amount` is the positive total from the selector). Output:

```tsx
<section aria-labelledby={`dashboard-${kind}-title`} data-testid={kind === 'income' ? 'metric-card-income' : 'metric-card-expense'} className="min-w-0">
  <Card className="h-full flex flex-col gap-3">   {/* padding md, p-6 */}
    <h2 id={`dashboard-${kind}-title`} className="flex items-center gap-2.5 text-base font-semibold text-fg">
      <span aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 {bg-income-tint text-income | bg-expense-tint text-expense}">
        {ArrowDownLeft | ArrowUpRight, className="w-4 h-4"}
      </span>
      {Income | Spending}
    </h2>
    {income:   <Money value={amount} showPlus className="text-2xl font-semibold text-income" />}
    {spending: <Money value={-amount} className="text-2xl font-semibold text-expense" />}
  </Card>
</section>
```

No `truncate` on the amount. Update the doc comment: Income or Spending for the period, from `leftOverFor`'s totals. `metric-card-expense` holds the Spending figure that `date-boundary.spec.ts` reads. Drop the `ProgressBar` import and `caption()`.

### 7.2 `src/components/dashboard/LeftOverCard.tsx` (new)

Props: `{ data: LeftOver; series: SpendingPoint[] | null; periodName: string; periodDates: string }` (types from `selectors/ledger` and `selectors/diary`). It computes no money figure; only the sparkline scale and its highest point (D5: the card lays out).

```
<section aria-labelledby="dashboard-left-over-title" data-testid="metric-card-net"
         className="h-full bg-brand-tint border border-line rounded-card p-6 flex flex-col gap-4">
  header row (flex, items-center, justify-between, gap-3):
    <h2 id="dashboard-left-over-title" className="flex items-center gap-2.5 text-base font-semibold text-fg">
      <span aria-hidden="true" className="w-8 h-8 rounded-full bg-brand-soft text-brand-soft-text flex items-center justify-center shrink-0"><PiggyBank className="w-4 h-4" /></span>
      Left over
    </h2>
    <span className="text-xs text-fg-muted">{periodDates}</span>
  figure row (flex flex-wrap items-end justify-between gap-x-6 gap-y-4):
    <div className="min-w-0">
      <Money value={data.leftOver} showPlus className={`text-4xl font-semibold tracking-tight ${data.leftOver < 0 ? 'text-expense' : 'text-fg'}`} />
      {hasRows && <p className="text-sm text-fg-secondary mt-1">{keptLine}{afterDebt}</p>}
    </div>
    {series && <Sparkline .../>}
  bar block (flex flex-col gap-1.5):
    <div aria-hidden="true" className="flex gap-[3px] h-2 w-full rounded-full overflow-hidden bg-line">
      {data.spentShare > 0 && <div className="bg-expense-fill" style={{ flexGrow: data.spentShare, flexBasis: 0 }} />}
      {data.keptShare > 0 && <div className="bg-brand-fill" style={{ flexGrow: data.keptShare, flexBasis: 0 }} />}
    </div>
    <div className="flex justify-between text-xs text-fg-muted"><span>Spent {Math.round(data.spentShare)}%</span><span>Kept {Math.round(data.keptShare)}%</span></div>
</section>
```

- `hasRows` (Amendment 1) is `data.income !== 0 || data.spending !== 0`. When it is false, render no `<p>` at all: no caption, no after-debt part, no empty element. This is the card's only `<p>`.
- `keptLine` (Amendment 1): when `keptPercent === null` (only reachable with spending and no income once `hasRows` holds), exactly `'No income this period'`. When `keptPercent >= 0`, `` `${Math.round(keptPercent)}% of income kept` ``. Otherwise `` `Spent ${Math.round(-keptPercent)}% more than earned` ``.
- **Never `NaN`, `Infinity` or a bare `%` (Amendment 1):**
  - It applies to the card's text and every `aria-label`, in every period, the new account included.
  - Every `%` the card prints comes from `Math.round` of a finite number, right after the digits: the kept line, "Spent N%" and "Kept N%".
  - A percent that is `null` prints no `%` text; the kept line has its own wording for that case.
  - Do not add a `%` anywhere else in the card.
- `afterDebt`: only when `hasRows` and `data.afterDebtDue !== null` (MONTH). In JSX: `{' · '}`, then `<Money value={data.afterDebtDue} className={'font-medium ' + (afterDebtDue < 0 ? 'text-expense' : 'text-fg')} />` then `{' after debt due'}`, so the line reads "70% of income kept · ฿5,500.00 after debt due". Show it whenever the selector defines it, even when nothing is due; the owner spec gates it on MONTH only.
- The bar is `aria-hidden`: the visible "Spent N%" / "Kept N%" line is its text. Its sum is always 100 or 0, so `flexGrow` fills it exactly. It has no transition, so nothing moves.
- `PiggyBank` (lucide-react, already installed), not the mock's briefcase: the briefcase is the Primary Salary category's icon (`FinanceContext.tsx:481`) and would read as income.
- **Sparkline** (a local function in this file, not exported): `<svg role="img" aria-label={label} viewBox="0 0 300 56" preserveAspectRatio="none" className="flex-1 basis-44 max-w-xs h-14 block">`.
  - Let `max` be the highest `spending` and `n = points.length` (8 or 31, never below 2).
  - Point `i` is at `x = i * 300 / (n - 1)` and `y = max > 0 ? 54 - (spending / max) * 50 : 54`, each rounded to 2 decimals.
  - Draw a `<polygon>` of `0,56`, the points and `300,56`, with `className="fill-brand" fillOpacity={0.15}`. Over it draw a `<polyline>` of the points, `fill="none"`, `className="stroke-brand"`, `strokeWidth={2}`, `strokeLinejoin="round"` and `vectorEffect="non-scaling-stroke"`.
  - `label` is `` `Daily spending, ${periodName}: highest ${formatCurrencyAmount(max)} on ${formatWeekdayDate(date)}` ``, where `date` is the oldest point holding `max`. When `max === 0` it is `` `Daily spending, ${periodName}: nothing spent` ``.
- Doc comment: owner spec 4.2 (ADR 0102); figures from `leftOverFor` and `dailySpendingSeries`, computed in `DashboardView`. The brand tint is the page's one brand emphasis; the edge stays the neutral `line`. Text on the tint passes 4.5:1 in both themes (the figures from section 4 of this spec).

### 7.3 `src/views/DashboardView.tsx`

- Imports: `cashFlow` leaves the `../selectors/ledger` import and `leftOverFor` joins it; `dailySpendingSeries` joins the `../selectors/diary` import; add `LeftOverCard`.
- Move the `plan` memo (`:104-107`) above the period figures. Replace `flow` (`:89`) with `leftOver = useMemo(() => leftOverFor(transactions, timeFilter, today, plan.totalRequired, categoryMap), [transactions, timeFilter, today, plan.totalRequired, categoryMap])`. Add `series = useMemo(() => dailySpendingSeries(transactions, timeFilter, today, categoryMap), [transactions, timeFilter, today, categoryMap])`. Keep `periodRows` and `categoryRows`. `leftOverFor` filters with the same `filterByRange`, so Spending stays one figure.
- Update the `:86-87` comment: Left over, the Income and Spending cards and the category card read the same period, so Spending is one figure (acceptance check 1).
- `CategorySpendingCard` gets `total={leftOver.spending}`.
- Replace the row at `:148-160` with:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
  <div className="lg:col-span-8">
    <LeftOverCard data={leftOver} series={series} periodName={period.name} periodDates={formatRangeLabel(timeFilter, today)} />
  </div>
  <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
    <CashFlowCard kind="income" amount={leftOver.income} />
    <CashFlowCard kind="spending" amount={leftOver.spending} />
  </div>
</div>
```

  One column on a phone. From `sm` the two small cards sit side by side under Left over. From `lg` they stack beside it (8/4, the mock's 2:1). One render path.
- `NetWorthCard` is not in the new row 1 (it joins the wallets card in UI-3). Until then, render it unchanged, alone and full width, between `DebtWarningBanner` and `WalletsSection`. That keeps `net-worth-card` (`theme.spec.ts:63`) and acceptance check 3. Add a one-line comment there: Net worth joins the wallets card in UI-3 (owner spec 4.4).
- Do not change the header, `PERIODS`, the other rows or the insights card.

### 7.4 `DESIGN.md`

- `:80`: `| Hero number (the Dashboard's Left over, and net worth) | 44px / 600, −1px tracking |`.
- `:108`: `- "THB" appears only beside the net worth figure.`
- `:326`: drop `` `CashFlowCard.tsx:35`, `` from the list of examples; the rest of the row stays.
- `:335`: replace the row with `| Spent-vs-left bar in red and green | Spent in \`expense\` and kept in \`brand\`, one bar with "Spent N%" and "Kept N%" under it | A green remainder would read as income; the 2026-10 owner spec (4.2) colours the kept part brand. |`.
- Nothing else: the Dashboard section's status line stays until UI-3 ships the phase.

### 7.5 `docs/audit/test-selector-contract.md`

- Before the `date-boundary.spec.ts` line, add ``- `dashboard.spec.ts`: ids `#time-filter-all`, `#time-filter-day`, `#time-filter-month`, `#time-filter-week`; test ids `metric-card-expense`, `metric-card-income` ``.
- Under "Text and title locators", add a line: `` `dashboard.spec.ts`: the regions "Left over" and "Income" (matched with `exact: true`, since "Spending insights" is also a region) and the sparkline's name, "Daily spending, <period>: highest ฿X on <Ddd, Mmm D>" or "...: nothing spent", and the caption text "No income this period". ``
- The new element ids `dashboard-left-over-title`, `dashboard-income-title` and `dashboard-spending-title` are not listed, because no spec uses them.

## 8. Gates

Run each and put the command and result in the build report. Save full-suite output under `workflow/stages/02_build/output/logs/`. Check ports 3000 and 3100 for stale dev servers before Playwright. Never edit `src/` while Playwright runs.

1. Red, before any `src/` change: `npx vitest run unit/dashboard.test.tsx` (new tests fail, the moved ones fail on the missing module too; record it) and `npx playwright test tests/dashboard.spec.ts --project=chromium` (fails: no "Left over" region).
2. `npm run lint`
3. `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`
4. `npm run test:unit`
5. `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/auth.spec.ts tests/reduced-motion.spec.ts tests/layout-stability.spec.ts --project=chromium`
6. The same six specs without a project filter (Chromium, Firefox, WebKit).
7. `node scripts/wcag-tokens.mjs` still passes (no token changed; a sanity check).
8. `git ls-files --eol` on the five changed existing files shows `w/crlf` kept. The two new files match their neighbours (CRLF in the working tree).
9. No em dash: `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').split(String.fromCharCode(0x2014)).length - 1)"` over the seven target files prints 0 for each.
10. `grep -n "text-\[[0-9]*px\]\|#[0-9A-Fa-f]\{6\}" src/components/dashboard/LeftOverCard.tsx src/components/dashboard/CashFlowCard.tsx` prints nothing (no raw size, no raw hex).
11. `git status --porcelain` lists only the target files, `docs/audit/task-ledger.md` and this task's stage outputs.

## 9. Bookkeeping

In `docs/audit/task-ledger.md`, before `## Backlog`, add a Phase 135 section in the Phase 134 section's form:

- the heading `## Phase 135 - Dashboard UI: the redesigned page (ADR 0102)`;
- the line ``Branch `phase-135-dashboard-ui`, cut from `main` at `ce9983f`.``;
- the table header;
- the row `| T765 | Dashboard redesign UI-1: page header and row 1 (owner spec 3, 4.1 to 4.2) | <the seven target files> | done | | <gate results> |`, with `Commit` left empty.

In the Backlog, add the row `| DESIGN.md's Hero number is 44px, but the code sets it with \`text-4xl\` (36px): \`NetWorthCard.tsx:28\` and \`LeftOverCard.tsx\`. A \`--text-hero\` token would close it | Phase 135, T765's spec | todo |`.

## 10. Production touch points

None. No SQL, no `/api/*`, no sign-in, no `vercel.json` or workflow change, no new dependency (`lucide-react` is installed), and no file deleted.

## 11. Out of scope

- Rows 2 and 3, `DebtWarningBanner`'s place, `WalletsSection`, `NetWorthCard`'s content and the insights card (UI-2, UI-3). `NetWorthCard` only moves (7.3).
- `PageHeader`, `SegmentedControl`, `PERIODS` and the header description text.
- Any selector (`src/selectors/` is a money path), `src/index.css` tokens (no `--text-hero` here, see the Backlog row), `scripts/wcag-tokens.mjs`, `tests/helpers.ts`, `ui/AllocationBar`, `ui/ProgressBar`.
- `ViewLoadingFallback`'s Dashboard skeleton (`src/components/ViewLoadingFallback.tsx:20-25`): it is reshaped once the whole page is final, in UI-3.
- The stale "Cash flow card" comments at `src/selectors/ledger.ts:69`, `src/components/ui/AllocationBar.tsx:56` and `src/components/dashboard/CategorySpendingCard.tsx:10`. `ledger.ts` is a money path; the other two are left for UI-3 so they change once.
- Suite counts in `AGENTS.md` and `docs/contexts/ui-and-e2e.md` (164 tests, 34 specs): UI-3 updates them when it ships the phase.
- Deleting any file.
