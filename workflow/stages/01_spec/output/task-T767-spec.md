# T767 spec: Dashboard redesign UI-3, row 3 and the insights card, and the phase ships

Phase 135 (branch `phase-135-dashboard-ui`, cut from `main` at `ce9983f`; T765 is `3f7b3e8`, T766 is `662c528`). Order: `spec T767: Dashboard redesign task UI-3 in docs/design/dashboard-2026-10/spec.md: row 3, recent activity, net worth and wallets, mood and spending, and the insights card placement, sections 4.4 and 4.5`, plus three more parts:
- merge `NetWorthCard` into the net worth and wallets card;
- clean up the five non-blocking notes in the T766 review;
- the owner's decision on the mood strip (option A).

## 1. Goal

Rebuild row 3 of the Dashboard to the owner spec, sections 4.4 and 4.5:
- **Recent activity** sits on the left.
- **The Net worth and wallets card** is on the right. `NetWorthCard` is merged into it, and the old full-width net worth row goes away.
- **The Mood and spending card** sits under it. Its strip lays out the days `moodSpendingDays` already returns for the selected period (owner decision A, with no selector change).
- **The Spending insights card** stays last and full width.

The task also clears T766's five review notes. It ships Phase 135, so it also updates the suite counts, the Dashboard's loading outline and the phase paperwork. Every existing Dashboard assertion survives.

## 2. Target files

```
src/components/dashboard/WalletsSection.tsx
src/components/dashboard/NetWorthCard.tsx            (deleted, see 7.2)
src/components/dashboard/MoodSpendingCard.tsx
src/components/dashboard/RecentActivityCard.tsx
src/components/dashboard/CategorySpendingCard.tsx
src/views/DashboardView.tsx
src/components/ViewLoadingFallback.tsx
src/components/ui/AllocationBar.tsx                  (comment only)
unit/dashboard.test.tsx
tests/dashboard.spec.ts
DESIGN.md
docs/design/dashboard-2026-10/spec.md
docs/audit/test-selector-contract.md
AGENTS.md                                            (suite counts only)
docs/contexts/ui-and-e2e.md                          (suite counts only)
README.md                                            (suite counts only)
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

There is no ADR, because ADR 0102 covers the redesign. There is no selector change. This task ships Phase 135, so it writes `refactor-log.md` and `baseline-metrics.md`. Bookkeeping: `docs/audit/task-ledger.md` (section 9).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: styling, the 44 px floor, page contracts, the selector contract and spec-edit policy, Playwright rules.
- `DESIGN.md` section 4: Amounts, Shared components and the Dashboard section.
- `docs/design/dashboard-2026-10/spec.md` sections 1 to 4. You may open `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` at lines 175 to 268 only. Every colour, size and number in it is a mock value.
- `workflow/stages/03_review/output/task-T765-review.md`, `task-T766-review.md` and their build reports, for the refactor-log entry (7.10).
- Load the `antislop` core skill with `antislop-ui` and `antislop-layoutmobile` while you work (owner memory: always during UI phases).

## 4. Current behaviour

**Page order** (`src/views/DashboardView.tsx`):
1. Row 1 (`:157-165`).
2. `NetWorthCard`, alone and full width, with the comment "Net worth joins the wallets card in UI-3" (`:167-173`).
3. `WalletsSection` (`:175-182`).
4. Row 2 (`:184-197`).
5. Row 3 (`:199-214`): `RecentActivityCard` at `xl:col-span-8` and `MoodSpendingCard` at `xl:col-span-4` in an `xl:grid-cols-12` grid. Rows 1 and 2 break at `lg`.
6. `<section aria-label="Spending insights">` last and full width (`:216-220`). Section 4.5 already holds; it does not move.

**`wealth`** (`:108-116`) is computed once: `netWorth`, `walletTotal`, `debtRemaining` and `shares`. `mood` is `moodSpendingDays(..., timeFilter, today)` (`:133-136`), and `todayLogged` is at `:137`.

**`NetWorthCard`** (`src/components/dashboard/NetWorthCard.tsx:18-46`):
- A `Card padding="lg"` around `data-testid="net-worth-card"`.
- An uppercase h2 "Net worth" with the caption "Wallets − debt" (`:22-23`).
- The figure as `text-4xl`, `text-expense` when negative, followed by `THB` (`:26-30`).
- Two `Inset`s: "In N wallets" with the wallet total, and "Debt remaining" with `−debt` (`:32-43`).
- `theme.spec.ts:63` expects `getByTestId('net-worth-card')` to be visible on the Dashboard.

**`WalletsSection`** (`src/components/dashboard/WalletsSection.tsx:34-120`):
- A `<section aria-labelledby="dashboard-wallets-heading">` with a page-level h2 "Wallets" and three `DashboardLink`s: `#hero-transfer-funds-btn`, `#hero-add-wallet-btn` and `#hero-manage-all-wallets-btn` "Manage wallets" (`:42-61`).
- One `Card` (`:63`) holds `EmptyState` when there are no wallets. Otherwise it holds an `AllocationBar` (`:72-81`) and a `md:grid-cols-2 xl:grid-cols-3` grid of boxed wallet buttons, `#dashboard-wallet-card-{id}` (`:82-115`).
- The ids are driven by `account-and-mobile-nav.spec.ts:209,219`, `transfer-preview.spec.ts:25`, `wallet-forms.spec.ts:42,63,77` and `wallets-page.spec.ts:80`.

**`RecentActivityCard`** (`src/components/dashboard/RecentActivityCard.tsx:34-67`):
- A `Card padding="none"` with the h2 "Recent activity" and `#dashboard-view-all-transactions-btn`.
- `ActivityFeed`, which uses `TransactionRow` and `DayGroupHeader` with each day's net. This already matches owner spec 4.4.
- There is no region name.

**`MoodSpendingCard`** (`src/components/dashboard/MoodSpendingCard.tsx:28-61`):
- The h2 "Mood & spending" and the subtitle "From your daily diary".
- A vertical list of `mood.days`, newest first (the selector's order, `src/selectors/diary.ts:98-107`, at most `MOOD_DAYS_SHOWN` = 5, `:83`).
- The `prompt()` hint (`:17-21`).
- A full-width primary `Button` `#dashboard-log-mood-btn` at the bottom, "Log today (Ddd, Mmm D)" or "Edit today's entry".
- There is no region name.

**T766 review notes** (`workflow/stages/03_review/output/task-T766-review.md` section 7):
1. `CategorySpendingCard.tsx:12` says the total is `` `cashFlow().spending` ``. `DashboardView.tsx:186` passes `leftOver.spending`.
2. `shown`, `rest`, `percentOf`, `restPercent` and `moreLabel` are computed both in `Donut` (`:26-38`) and in the card (`:103-108`).
3. `:58`: `allSegments.length === 1 ? '100 0' : ...` is redundant. A lone segment's percent is 100, which already gives `100 0`.
4. `DESIGN.md:199`: the rest-row clause sits before "from `spendingByCategory` (L1)".
5. `unit/dashboard.test.tsx:765-834`: scenario 4 (`:822-832`) is identical to scenario 2 (`:794-804`).

**Phase leftovers T765 and T766 assigned to this task:**
- The Dashboard shape in `ViewLoadingFallback` still draws the old layout (`src/components/ViewLoadingFallback.tsx:20-25`).
- `AllocationBar.tsx:56`'s comment cites "The Cash flow card's empty-bar caption", which no longer exists.
- `DESIGN.md:163`'s status line says the page "still follows ADR 0030's layout".
- Suite counts are stale:
  - `AGENTS.md:11`: 1375 tests, 164 tests, 34 specs, 492 runs.
  - `docs/contexts/ui-and-e2e.md:62`.
  - `README.md:10,157,158`.
  - There are now 35 spec files in `tests/`.

**Docs that cite `NetWorthCard`:**
- `DESIGN.md:80`: "Hero number (the Dashboard's Left over, and net worth)".
- `DESIGN.md:326`: the deviation row cites `NetWorthCard.tsx:22`.
- The ledger Backlog row at `docs/audit/task-ledger.md:117`.

**Assertions this task must keep** (`unit/dashboard.test.tsx`):
- `:376-401`, acceptance check 3: `getByTestId('net-worth-card')` text contains `฿9,595.48`, `THB`, `In 3 wallets`, `฿32,172.48` and `−฿22,577.00`. `getByText('฿9,595.48')` has `text-fg`, and a negative net worth has `text-expense`.
- `:502-521`, Mood: the meters `Mood 3 of 5` and `Mood 4 of 5`, `−฿340.00` with `text-expense`, the "Only 2 days logged..." hint, and the buttons `Log today (Mon, Sep 28)` and `Edit today's entry`.
- `:524-585`, Wallets: the three `hero-*` buttons, the transfer call with no argument, `button#dashboard-wallet-card-main` with `Bank Account · 8.3%`, the share-bar name, and the two empty captions.
- `:446-500`, Recent activity: unchanged.

## 5. Parity map

None. There is no ledger arithmetic, and every figure comes from an existing selector.

## 6. Tests to add

Write these first and run them against the unchanged components (red gate, section 8 step 1). They fail today because:
- the three row 3 cards have no region names;
- `WalletsSection` takes no net worth props and has no "Net worth" h2;
- the mood list is newest first and its heading is "Mood & spending".

Card texts that mix `Money` spans with plain text are checked with `toContain` on `textContent`.

### 6.1 `unit/dashboard.test.tsx`

Imports: drop `NetWorthCard`.

**Locator and prop moves.** The assertions stay word for word.

1. **Acceptance check 3** (`:377-401`): render `<WalletsSection wallets={WALLET_LIST} shares={walletShares(WALLET_LIST)} netWorth={...} walletTotal={...} debtRemaining={...} onTransfer={() => {}} onAddWallet={() => {}} onManageWallets={() => {}} onOpenWallet={() => {}} />` in place of `NetWorthCard`.
   - The first test keeps its selector calls for the three figures.
   - The second test passes `wallets={WALLET_LIST}`, `shares={walletShares(WALLET_LIST)}` and `netWorth={-38850} walletTotal={7650} debtRemaining={46500}`.
   - `walletCount` is gone, because the card counts `wallets.length`, which is 3 here.
2. **The three Wallets section tests** (`:525-585`): add `netWorth={netWorth(list, [])} walletTotal={walletTotal(list)} debtRemaining={0}`, where `list` is the wallets that test passes.
3. **The "has no NaN, Infinity or bare %" test** (`:765`): delete scenario 4 (`:822-832`), which repeats scenario 2 exactly (T766 note 5). Keep scenarios 1 to 3.

**New `describe('Net worth and wallets card (owner spec 4.4)')`:**

4. Render it as in move 1 with the spec's sample debts.
   - `const region = screen.getByRole('region', { name: 'Net worth and wallets' })`.
   - Inside it:
     - `getByRole('heading', { level: 2, name: 'Net worth' })`;
     - `getByRole('heading', { level: 3, name: 'Wallets' })`;
     - `getByTestId('net-worth-card')`;
     - the buttons `Transfer`, `Add wallet` and `Manage wallets`;
     - `button#dashboard-wallet-card-main`.
   - The region holds exactly one `[data-testid="net-worth-card"]`.
   - `screen.getAllByText('฿9,595.48')` has length 1.
5. **A new account:** three wallets at 0, no debts, and `netWorth={0} walletTotal={0} debtRemaining={0}`.
   - The region text contains `In 3 wallets`, `฿0.00` and `No money in your wallets yet`.
   - The text plus every `aria-label` in the region does not match `/NaN|Infinity/` or `/(^|[^0-9])%/`.

**New `describe('Mood and spending card (owner spec 4.4, decision A)')`.** Reuse the `entries` and `rows` of the existing Mood describe; keep `TODAY` `2026-09-28`.

6. **Oldest on the left:**
   - `getByRole('region', { name: 'Mood and spending' })` holds `getByRole('heading', { level: 2, name: 'Mood and spending' })`.
   - Its `listitem`s are 2. The first contains `Thu, Sep 3` and has the img `Mood 4 of 5`. The second contains `Sat, Sep 5` and `−฿340.00`.
7. **Five at most, oldest of the five first:**
   - Six entries, `2026-09-22` to `2026-09-27`, mood 3, built like the existing ones.
   - There are 5 `listitem`s. The first contains `Wed, Sep 23` and the last `Sun, Sep 27`.
   - `queryByText(/logged in this period/)` is null.
8. **No diary days:** `moodSpendingDays([], rows, CATEGORIES, 'MONTH', TODAY)`.
   - No `list`.
   - `getByText('No diary days logged in this period. Log a day to see your mood beside your spending.')`.
   - `getByRole('button', { name: 'Log today (Mon, Sep 28)' })`.
   - The NaN and bare `%` check of test 5 passes on the region.

**New `it` in the Recent activity describe:**

9. `renderCard()`; `getByRole('region', { name: 'Recent activity' })` contains `getByRole('button', { name: 'View all' })` and every `[id^="dashboard-tx-"]` in the container.

### 6.2 `tests/dashboard.spec.ts`

**Seed helper** (row 1 and row 2 assertions stay word for word):
- `seedTestTransactions(page, debts = [SAMPLE_STUDENT_LOAN], wallets?: Wallet[], diary: unknown[] = [])` passes `{ debts, wallets }` to `seedLedger`.
- Its init script also writes `localStorage.setItem('pf_diary', JSON.stringify(diary))`. Pass `diary` as the init script's argument: `page.addInitScript((diary) => { ... }, diary)`.
- Import `SAMPLE_WALLETS` from `./helpers` and `type Wallet` from `../src/types`.
- With no wallets passed, `seedLedger` keeps the three ฿0.00 starters, as today.

**New `test.describe('Dashboard row 3: recent activity, net worth and wallets, mood and spending')`.** Use the same `timezoneId` and the same `setFixedTime(new Date('2026-10-16T15:00:00+07:00'))` in a `beforeEach`. Locate the regions with `page.getByRole('region', { name: ..., exact: true })`: "Recent activity", "Net worth and wallets" and "Mood and spending".

`DIARY` is two entries:
- `{ id: 'diary-e2e-1', userId: 'usr-guest-01', date: '2026-10-10', mood: 2, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: now, updatedAt: now }`
- the same with id `diary-e2e-2`, date `2026-10-16` and mood 4.

1. **Seeded, Past 30 days:** `seedTestTransactions(page, [SAMPLE_STUDENT_LOAN], SAMPLE_WALLETS, DIARY)`.
   - **Net worth region:**
     - It contains `฿3,150.00` (7,650 − 4,500), `THB`, `In 3 wallets`, `฿7,650.00` and `−฿4,500.00`.
     - `getByTestId('net-worth-card')` is visible.
     - `#dashboard-wallet-card-wal-main-checking` contains `Main Checking` and `Bank Account · 32.7%`.
     - The img `/^Share of money by wallet: /` is visible.
   - **Recent activity region:**
     - It contains `Today · Fri, Oct 16`.
     - Its `[id^="dashboard-tx-"]` count is 4.
   - **Mood region:**
     - Its `listitem` count is 2. The first contains `Sat, Oct 10` and `−฿2,500.00`, the second `Fri, Oct 16` and `−฿500.00`.
     - The imgs `Mood 2 of 5` and `Mood 4 of 5` are visible.
     - It contains `Only 2 days logged in this period.`.
     - `#dashboard-log-mood-btn` has the text `Edit today's entry`.
   - **Insights last:** run `getByRole('region', { name: 'Mood and spending', exact: true }).evaluate(...)`. It returns whether `document.querySelector('section[aria-label="Spending insights"]')` exists and follows it (`compareDocumentPosition & Node.DOCUMENT_POSITION_FOLLOWING`). Expect `true`.
2. **The strip follows the period:** the same seed. Click `#time-filter-day` and expect `aria-pressed="true"`. The mood region then has 1 `listitem`, containing `Fri, Oct 16`, and contains `Only 1 day logged in this period.`.
3. **Links:** the same seed.
   - Click `#dashboard-view-all-transactions-btn`; `#nav-tab-transactions` has `aria-current="page"`.
   - `gotoTab(page, 'dashboard')`, then click `#hero-manage-all-wallets-btn`; `#nav-tab-wallets` has `aria-current="page"`.
   - `gotoTab(page, 'dashboard')`, then click `#dashboard-log-mood-btn`; `#nav-tab-diary` has `aria-current="page"`.
4. **New account** (clock only, no seed):
   - The net worth region contains `฿0.00`, `In 3 wallets` and `No money in your wallets yet`.
   - Recent activity contains `No transactions recorded yet`.
   - The mood region contains `No diary days logged in this period.` and has 0 `listitem`s. `#dashboard-log-mood-btn` has the text `Log today (Fri, Oct 16)`.
   - `expectCleanCard` passes on all three regions.
5. **Phone width:** `setViewportSize({ width: 390, height: 844 })` with the test 1 seed.
   - The net worth region's `y` is at least the Recent activity region's `y + height - 1`.
   - The mood region's `y` is at least the net worth region's `y + height - 1`.
   - `scrollWidth <= innerWidth`, as in row 1's phone test.

## 7. The change

### 7.1 `src/components/dashboard/CategorySpendingCard.tsx` (T766 notes 1 to 3)

- **`:12` comment:** `` /** `leftOverFor().spending`: the same figure as the Spending card, and the rows' sum. */ ``
- **One computation:**
  - `Donut` takes `{ segments: Segment[]; total: number }`, where `interface Segment { name: string; color: string; percent: number }`. Delete its own `shown`, `rest`, `percentOf`, `shownSegments`, `restPercent`, `moreLabel` and `allSegments` (`:26-47`). It builds `label` and the dash geometry from `segments`.
  - The card keeps its `shown`, `rest`, `percentOf`, `restPercent` and `moreLabel` (`:103-108`) and adds `segments`:
    - the shown rows as `{ name, color, percent: percentOf(row.amount) }`;
    - then, when `rest.length > 0`, `{ name: moreLabel, color: SYSTEM_CATEGORY_COLOR, percent: restPercent }`.
  - Render `<Donut segments={segments} total={total} />`.
- **`:58`:** the dash array is always `` `${p} ${Number((100 - p).toFixed(2))}` ``. A lone segment's `p` is 100, which gives `100 0` (test `:627` keeps passing).

Nothing on screen changes.

### 7.2 `src/components/dashboard/WalletsSection.tsx` becomes the Net worth and wallets card; `NetWorthCard.tsx` is deleted

The owner's order ("Merge NetWorthCard into the net worth and wallets card", as T765's spec planned at its `:222`) is the go-ahead to delete `NetWorthCard.tsx`, a file the builder did not create. Delete it with `git rm`. The file and export keep the name `WalletsSection`, so the comments that cite it (`WalletTransferForm.tsx:73`, ADR 0042) stay true.

**Props:** add `netWorth: number` (doc: "`netWorth` (L3): the wallet total minus what active debts still owe"), `walletTotal: number` and `debtRemaining: number`. Keep the rest. Rewrite the doc comment:
- Owner spec 4.4: one card holding net worth with its wallets-minus-debt caption, then the share bar and a row per active wallet, with Transfer, Add wallet and Manage wallets.
- It keeps the three `hero-*` ids and `#dashboard-wallet-card-{id}`, which the suite drives.
- Net worth keeps `data-testid="net-worth-card"` (`theme.spec.ts`) and is the one figure with the currency code.

**Shell:** `<section aria-label="Net worth and wallets" className="min-w-0">` around `<Card className="flex flex-col gap-4">`. The page-level heading row (`:43-61`) goes.

Inside the card, in order:

1. **Net worth block:** `<div data-testid="net-worth-card" className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">`
   - Left, a `<div className="min-w-0">` holding:
     - `<h2 className="text-base font-semibold text-fg">Net worth</h2>`
     - `<p className="text-xs text-fg-muted mt-0.5">In {n} {n === 1 ? 'wallet' : 'wallets'} <Money value={walletTotal} className="text-fg-secondary" /> · debt <Money value={-debtRemaining} className={debtRemaining > 0 ? 'text-expense' : 'text-fg-secondary'} /></p>`, with `n = wallets.length`. The debt carries its minus, so colour is not the only signal.
   - Right: `<p className="flex items-baseline gap-1.5 shrink-0">` holding:
     - `<Money value={netWorth} className={\`text-2xl font-semibold tracking-tight ${netWorth < 0 ? 'text-expense' : 'text-fg'}\`} />`
     - `<span className="text-xs text-fg-muted">{APP_CURRENCY}</span>`
   - The figure is a card figure now, not the hero (the mock sets it beside the title). `text-2xl` matches the Debt payoff card's percent.
2. **Wallets row:** `<div className="flex items-center justify-between gap-4 pt-4 border-t border-line">` holding:
   - `<h3 id="dashboard-wallets-heading" className="text-sm font-medium text-fg-secondary">Wallets</h3>`
   - the Transfer `DashboardLink` (`#hero-transfer-funds-btn`, still `onClick={() => onTransfer()}` with its comment).
3. **No wallets:** the `EmptyState` exactly as today.
4. **Wallets:**
   - The `AllocationBar` exactly as today.
   - The rows container becomes `<div className="flex flex-col gap-1">`.
   - Each wallet `button` keeps its id, `onClick`, icon tile, name, type and share line, balance `Money` and chevron. Its class becomes `w-full min-w-0 min-h-[44px] flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-control hover:bg-surface-2 text-left transition-control duration-150 cursor-pointer`. That is a plain row in a narrow column, as in the mock; the box and border go.
   - The icon tile becomes `w-9 h-9`, and its `style` stays.
5. **Footer:** `<div className="flex flex-wrap gap-x-6 pt-3 border-t border-line">` holding the `#hero-add-wallet-btn` "Add wallet" and `#hero-manage-all-wallets-btn` "Manage wallets" links, as today.

Import `APP_CURRENCY` from `../../utils/currency`.

### 7.3 `src/components/dashboard/MoodSpendingCard.tsx` (decision A)

- Wrap the card in `<section aria-labelledby="dashboard-mood-title" className="min-w-0">`. The `Card` loses `h-full`: `className="flex flex-col gap-4"`.
- **Header:** `<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">` holding two things:
  - The title block: `<h2 id="dashboard-mood-title" className="text-base font-semibold text-fg">Mood and spending</h2>` and the unchanged subtitle.
  - `<Button id="dashboard-log-mood-btn" variant="soft" onClick={onOpenDiary}>` with the same two labels. It loses `block` and `mt-auto`.
- **Strip,** when `mood.days.length > 0`: `<ul className="flex flex-wrap gap-2">` over `[...mood.days].reverse()` (oldest on the left; the selector's newest-first order is unchanged).
  - Each `li` is keyed by date: `className="flex-1 basis-24 min-w-0 flex flex-col items-center gap-1.5 rounded-inner bg-surface-2 px-2 py-2.5 text-center"`.
  - It holds `<span className="text-xs text-fg-muted">{formatWeekdayDate(day.date)}</span>`, `<MoodMeter mood={day.mood} />` and the existing `Money` (`value={-day.spending}`, its classes with `text-sm` swapped for `text-xs`).
- **Hint:** unchanged, after the strip.
- **Doc comment:** owner spec 4.4, decision A. The strip lays out the diary days `moodSpendingDays` returns for the page's period, at most five, oldest on the left. There are no placeholder days, so no selector change.

### 7.4 `src/components/dashboard/RecentActivityCard.tsx`

Wrap the `Card` in `<section aria-labelledby="dashboard-activity-title" className="min-w-0 h-full">`, and give the h2 `id="dashboard-activity-title"`. Nothing else changes. Add one doc line: owner spec 4.4 keeps this card's rows and behaviour.

### 7.5 `src/views/DashboardView.tsx`

- Remove the `NetWorthCard` import (`:8`), its block and comment (`:167-173`), and the standalone `WalletsSection` (`:175-182`).
- **Row 3** (`:199-214`) becomes `<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">` with:
  - `<div className="lg:col-span-7">`: `RecentActivityCard`, with props unchanged;
  - `<div className="lg:col-span-5 flex flex-col gap-4">`:
    - `WalletsSection` with today's props plus `netWorth={wealth.netWorth} walletTotal={wealth.walletTotal} debtRemaining={wealth.debtRemaining}`;
    - then `MoodSpendingCard`, unchanged.
- The insights `section` stays last and full width, unchanged.

### 7.6 `src/components/ViewLoadingFallback.tsx` and `src/components/ui/AllocationBar.tsx`

- `SHAPES.dashboard` (`:20-25`) becomes:
  - `HEADER`
  - `{ heights: ['h-56', 'h-56'], columns: 'lg:grid-cols-2' }`
  - `{ heights: ['h-96', 'h-96'], columns: 'lg:grid-cols-2' }`
  - `{ heights: ['h-96', 'h-96'], columns: 'lg:grid-cols-2' }`
  - `{ heights: ['h-40'] }`

  That is the header, rows 1 to 3 and the insights card. The file stays LF.
- `AllocationBar.tsx:56`, comment only: `// Same size and token as the Dashboard's other captions (text-xs, fg-muted).`

### 7.7 `DESIGN.md`

- **`:80`:** `| Hero number (the Dashboard's Left over) | 44px / 600, −1px tracking |`.
- **`:163`, the status line:** `**Status:** shipped in Phase 135 (UI) on the selectors Phase 134 added. The authority is \`docs/design/dashboard-2026-10/spec.md\`. Its mock shows layout only: every colour, size and number in it is a mock value.`
- **`:199`** (T766 note 4): `A donut and the top five (name, percent, amount) from \`spendingByCategory\` (L1); any further categories are one grey segment and one "N more categories" row with its percent.` The rest of that cell stays.
- **`:203`:** `| Row 3: Mood and spending | A strip of the diary days \`moodSpendingDays\` returns for the period, at most five, oldest on the left, each with its mood and that day's spending; an empty line when there are none; Log today. |`
- **`:205`:** "selectors Phase 134 adds" becomes "selectors Phase 134 added".
- **`:326`:** drop `` `NetWorthCard.tsx:22`, `` from the list of examples.

Change no other line.

### 7.8 `docs/design/dashboard-2026-10/spec.md:61`

`   - **Mood and spending** (mock 251 to 266): the diary days \`moodSpendingDays\` returns for the selected period, laid out as a strip, oldest on the left (owner decision A, T767: no selector change, no placeholder days); the empty line when no diary days; Log today.`

### 7.9 `docs/audit/test-selector-contract.md`

- **The `dashboard.spec.ts` ids line (`:28`):** add `#dashboard-log-mood-btn`, `#dashboard-view-all-transactions-btn`, `#dashboard-wallet-card-*`, `#hero-manage-all-wallets-btn`, `#nav-tab-diary` and `#nav-tab-wallets`, kept in alphabetical order. Add the test id `net-worth-card`.
- **The `dashboard.spec.ts` text-locator line (`:74`):** add the regions "Recent activity", "Net worth and wallets" and "Mood and spending", plus the "Spending insights" section found by `aria-label`.

### 7.10 Phase paperwork and suite counts

**Counts:** take them from the gate runs (8.4 and 8.7) and from `npx playwright test --list` (its last line gives tests and files).
- `AGENTS.md:11`: the Vitest tests and files, and the Playwright tests, specs and runs on three browsers. Change nothing else in `AGENTS.md`.
- `docs/contexts/ui-and-e2e.md:62`: tests, specs, runs, passed and skipped by design. Name the skip reasons as the full run shows them.
- `README.md:10,157,158`: the same figures.

**`docs/audit/baseline-metrics.md`:** a `### Phase 135 - delta against Phase 134` section at the top of "Figures", in the Phase 134 format:
- the entry chunk, all app JS (and file count) and CSS, raw and gzip, measured by "How to measure" with the repo's `.env` present (never read or print it);
- Vitest;
- the full Playwright run (8.7) with its log path.

**`docs/audit/refactor-log.md`:** a `## Phase 135 - Dashboard UI: T765-T767 (2026-10-17, code \`<sha>\`, merged \`<sha>\`)` entry above Phase 134, in its format.
- The first line is ADR `0102`.
- **Changed:** files per task.
- **Verified:** each task's gate line from the ledger.
- **Surprises:** from the T765 and T766 reviews and this build.
- **Deliberately not done:** at least:
  - the mock's seven-day strip with empty days (owner decision A);
  - the header and nav restyle and the darker brand theme (owner spec 6, "Later");
  - the hero token (Backlog);
  - the visual check by eye in both themes at 1280 px and phone width, which is the owner's, after merge.

## 8. Gates

Save full-suite output under `workflow/stages/02_build/output/logs/`. Before Playwright, check ports 3000 and 3100 for stale servers. Never edit `src/` while Playwright runs.

1. **Red,** before any `src/` change:
   - `npx vitest run unit/dashboard.test.tsx`: the new tests fail; record it.
   - `npx playwright test tests/dashboard.spec.ts --project=chromium`: the row 3 tests fail, and the row 1 and row 2 tests pass.
2. `npm run lint`
3. `npx vitest run unit/dashboard.test.tsx unit/transactions-page.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`
4. `npm run test:unit` (log `T767-unit.log`).
5. Run these specs with `--project=chromium`:

   ```
   npx playwright test tests/dashboard.spec.ts tests/theme.spec.ts tests/account-and-mobile-nav.spec.ts tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts tests/wallets-page.spec.ts tests/layout-stability.spec.ts tests/reduced-motion.spec.ts tests/date-boundary.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/toast-layering.spec.ts --project=chromium
   ```
6. The same twelve specs without a project filter.
7. `npm test`: the full suite on three browsers, because this task ships the phase and its figures go into the docs (log `T767-e2e-full.log`).
8. Run `npm run clean`, then `npm run build`, and measure as in `baseline-metrics.md`. The build is clean.
9. `node scripts/wcag-tokens.mjs` passes.
10. **Line endings:** `git ls-files --eol` on every changed file shows the same `w/` column as before the change: `src/components/ViewLoadingFallback.tsx` `w/lf`, every other target `w/crlf`.
11. **No new em dash:** for each changed file, the added lines of `git diff -U0 -- <file>` contain no U+2014. Count them with the `node -e` one-liner from T766's spec gate 9. It prints 0 for each file.
12. This command prints nothing:

    ```
    grep -n "text-\[[0-9]*px\]\|#[0-9A-Fa-f]\{6\}" src/components/dashboard/WalletsSection.tsx src/components/dashboard/MoodSpendingCard.tsx src/components/dashboard/RecentActivityCard.tsx src/components/dashboard/CategorySpendingCard.tsx
    ```
13. `git grep -n "NetWorthCard" -- src unit tests DESIGN.md AGENTS.md docs/contexts` prints nothing.
14. **Docs check:** every count written in 7.10 matches the logs of gates 4 and 7 and the `--list` output. Every path and line cited in the new refactor-log entry exists.
15. `git status --porcelain` lists only the target files (with `NetWorthCard.tsx` as deleted), `docs/audit/task-ledger.md` and this task's stage outputs.

## 9. Bookkeeping

In `docs/audit/task-ledger.md`:
- **Phase 135 table:** after T766, add `| T767 | Dashboard redesign UI-3: row 3, net worth and wallets merged, mood strip, insights last; T766 notes; Phase 135 paperwork (owner spec 4.4 to 4.5) | <the target files> | done | | <gate results> |`, with `Commit` left empty.
- **Backlog hero row (`:117`):** change `` `NetWorthCard.tsx:28` and `LeftOverCard.tsx` `` to `` `LeftOverCard.tsx` (the net worth figure is a card figure since T767) ``. Its Status stays `todo`.

## 10. Production touch points

None. There is no SQL, no `/api/*` request, no sign-in, no `vercel.json` or workflow change and no dependency.

One Stop-and-ask item comes near: deleting `NetWorthCard.tsx`, a file the builder did not create. The owner's T767 order ("Merge NetWorthCard into the net worth and wallets card") is the go-ahead in this session. This spec lists `AGENTS.md` among its targets, so the orchestrator pauses for the owner before `build T767` anyway.

## 11. Out of scope

- **Any selector:** `moodSpendingDays`, `MOOD_DAYS_SHOWN` and the selector's comments (`src/selectors/diary.ts:82,86` still say "Mood & spending"). Selectors are a money path and decision A rules out a change. There are no placeholder or zero-filled days.
- **The insights card:** `SpendingInsightsCard.tsx` and its section, which are already last and full width.
- **Shared components:** `ActivityFeed`, `TransactionRow`, `DayGroupHeader`, `MoodMeter` (its comment says "Mood & spending"; leave it), `DashboardLink`, `EmptyState` and `Button`.
- **The hero token** (the Backlog row) and `LeftOverCard.tsx`.
- **Renaming `WalletsSection`:** the file and export keep their name.
- **Other comments:** `WalletTransferForm.tsx:73` and the ADRs, which still cite `WalletsSection` correctly.
- **`tests/helpers.ts`,** and every spec other than `tests/dashboard.spec.ts`.
- **The rest of `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`:** only their counts change.
