# 0030 — Dashboard redesign: one period, every figure through a selector, the shared pieces on screen

**Status:** Accepted.
- **Implements** `docs/design/finlife-redesign-spec.md` section 9 step 4 for the first page, the Dashboard (spec 6.1), in Phase 57.
- **Puts on screen** ADR `0028`'s L3 to L5, L8 and L11 selectors, and ADR `0029`'s `PageHeader`, `AllocationBar`, `WarningBanner`, `TransactionRow` and `DayGroupHeader`.
- **Keeps** ADR `0020`'s insights card, with its own period named.
- **Closes** audit 004 finding 2 (the focus outline fading in from the text colour).

**Date:** 2026-09-28

## Context

Phases 55 and 56 shipped what the pages are built from, but the Dashboard still had the old layout:
- a wallet-total hero;
- three metric cards with coloured edges;
- a carded wallet grid with "Tap to inspect" and a share bar on every card;
- a debt card with no per-debt plan;
- a recent-transactions table whose labels ("General", "Main Wallet") came from inline code, not the display selectors.

Most of the spec's logic was built but not yet on any screen: net worth (L3), the per-debt monthly need and its warning (L4, L5), the adjustment-pair fold (L8) and the day net (L11).

The owner's decisions (2026-09-28):
1. **The insights card stays.** It is restyled and titled with its own months ("September vs August"), so it does not claim the page's period. Its behaviour and `insights.spec.ts` are unchanged.
2. **`main` takes the spec's padding** for every view (16px on mobile, 32/40/48px from `md`). `max-w-7xl` stays until every page is redesigned.
3. **`theme.spec.ts:58` moves its locator** from the text "Total Money Across All Wallets" to `data-testid="net-worth-card"`. The assertion is the same, and this is the phase's only spec edit.
4. **antislop in mode 2**, audit 005 after the phase.

## Decision

### One period, computed once
`DashboardView` filters the rows by the period once (L2) and computes every figure from `src/selectors/`. The cards receive figures and only lay them out.
- **`cashFlow`** (new) reuses `sumIncome` and `sumSpending`. The Cash flow card's Spending and the category card's total are therefore the same number to the cent in every period, which is spec 10's first acceptance check. The unit test pins it, and the MCP pass read it in all four periods.
- **Net worth** is `netWorth(wallets, debts)` (L3). The inset boxes show the wallet total and the debt remaining, the second signed and red.
- **The debt plan** is `debtPlan(debts, today, monthlySurplus(...))`, computed once for both the banner and the debt card. The surplus is always the past 30 days (L5), whatever period the page shows.
- **Recent activity** sorts the live rows newest first and folds a cancelling adjustment pair (L8). It shows six items and takes each day's net from `groupByDay` over all of that day's rows (L11), not only the rows shown.
- **Mood & spending** comes from a new `moodSpendingDays` selector. It lists the diary days in the period, each with that day's `sumSpending`, so a repayment or a transfer on a diary day never reads as spending.
- **`walletShares`** (new) shares positive balances only, the same rule as `AllocationBar`. A card in debt neither takes a share nor shrinks the others'.

### What the Playwright suite needed kept
The Dashboard is the landing view, so it mounts in every one of the 357 runs.
- **Ids that stay:**
  - `#time-filter-*`;
  - `#hero-transfer-funds-btn`, `#hero-add-wallet-btn` and `#hero-manage-all-wallets-btn`, now the Wallets section's links;
  - `#dashboard-wallet-card-{id}`, now a real `<button>`;
  - `#dashboard-view-all-transactions-btn`;
  - every `insights-*` id.
- **`metric-card-expense`** moves onto the Cash flow card's Spending cell, which holds only that figure. `date-boundary.spec.ts` checks it contains `฿1,000.00` and not `฿3,000.00`, and `−฿1,000.00` satisfies both.
- **The section's Transfer link calls its handler with no argument.** A unit test found the click event reaching `onTransfer`. Wired straight to `onOpenTransfer(walletId?)`, the event would have been read as a wallet id, and `transfer-preview.spec.ts` expects the form's own defaults.
- **New ids use a `dashboard-` prefix.** Specs filter on the Debt Payoff page's `debt-card-`, `open-repay-modal-` and `settle-debt-`, and on the Transactions page's `tx-row-`, straight after a tab switch, while the Dashboard may still be leaving.
- **Each description renders once**, since `transaction.spec.ts` and `storage-persistence.spec.ts` use strict `getByText`. No part of the page is rendered twice for a breakpoint.

### The focus outline no longer fades in (audit 004 finding 2)
Tailwind's `transition-colors` includes `outline-color`. For its first 150ms the global outline was drawn in the text colour.
- A named utility, `transition-control`, lists color, background-color, border-color, text-decoration-color, fill and stroke, with Tailwind's own timing and `duration-*` hook, and no outline.
- It replaces `transition-colors` everywhere in `src/`. Before the phase there were 58 uses in 28 files; after it, `transition-control` has 52 uses in 25 files, since the rewritten Dashboard files need fewer.
- Measured in the MCP pass: the outline reads `rgb(124, 58, 237)` on the first read after focus, on buttons, links, the period control, wallet rows and nav tabs.
- The five `transition-all` uses are left: none is on a focusable element.

### Deviations from the mockup, and why
- **Monthly figures print in full**, as "฿4,391.23 / month needed" rather than "~฿4,391/mo". CLAUDE.md formats every displayed amount with `formatCurrencyAmount`.
- **Mood spending is signed** ("−฿340.00"). The mockup's amounts are red alone, which spec section 7 forbids.
- **The spent-vs-left bar is a single `ProgressBar`** on the neutral track, with the percentage in the caption. The mockup's green remainder would read as income, and the caption already states the share.
- **The greeting follows the local hour.** The mockup's "Good morning" is static.
- **The header description** reads "every figure below uses the selected period", because the control sits below the text on a phone, not to its right.
- **Rows are not clickable yet.** `TransactionRow` gets `onSelect` with the Transactions page's editor. A row that looked clickable and did nothing would be worse.

### Layout
- A 12-column grid at `md` holds the hero at 5/7. At `xl` the next two rows are 7/5 and 8/4, and below that they stack (spec section 8).
- The Cash flow card is a container: its three figures sit side by side only when the card is at least 28rem wide.
- The wallet rows are one, two or three columns.

## Consequences

- **Removed:** `TotalWealthHero`, `CashflowMetricsCards`, `WalletAccountsGrid`, `CategoryExpenseDistribution`, `DebtPayoffOverview` and `RecentTransactionsTable`. The inline top-5 and share arithmetic go with them.
- **Still unused on any screen:**
  - L6, L7, L10 and L13 appear only through `TransactionRow`.
  - L9 (`usedColors`) and L12 (pagination) wait for the Categories and Transactions pages.
- **The Dashboard now reads the diary.** A diary write re-renders it, which it already did through the shared state context.
- **`transition-colors` is not used in `src/`.** A new control uses `transition-control`, and DESIGN.md records the rule.
