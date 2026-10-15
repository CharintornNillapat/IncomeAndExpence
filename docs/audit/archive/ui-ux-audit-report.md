# UI/UX audit report — FinLife Tracker

**Status: frozen as of Phase 19 (2026-09-19).** Findings are write-once, same discipline as `audit-report.md`. Do not delete a finding when its task ships — append a `> Resolved by T<n>, commit <sha>` note under it instead. Every claim below carries a `path:line` citation, verified against the repository at commit `5d3b606`.

This report covers **redundant user-facing features and fragmented UI**, a distinct concern from `audit-report.md` (which covers context/re-render/dead-code/currency/date findings from Phase 0). See `implementation-roadmap.md` for the phased plan that resolves these findings.

---

## A. Duplicate entry points — add transaction (5 paths)

- `src/components/Navbar.tsx:208-216` `#navbar-quick-add-btn` → `App.tsx` → `QuickAddModal.tsx` → `Modal` + `TransactionForm`.
- `src/views/TransactionsView.tsx:202-210` `#tx-open-add-modal-btn` → `Modal` "Record New Transaction" (`:365-388`) → `TransactionForm`.
- `src/views/DashboardView.tsx:249-255` — `TransactionForm` rendered **inline, always visible**, no modal. Third independent mount of the same form.
- `src/views/DebtsView.tsx:122-130` `#open-repay-modal-${debt.id}` → hand-rolled repay `Modal` (`:248-323`) that creates a `DEBT_REPAYMENT` transaction — duplicates the type `TransactionForm.tsx:200,319-336` already supports.
- `src/components/WalletPopupModal.tsx:254-265,283-313` "Adjust Balance" inline editor creates an `ADJUSTMENT` transaction via a bespoke one-field form.
  > Not a duplicate to unify — see roadmap "Deliberately not changed" #4.

No FAB exists anywhere; `src/components/MobileBottomNav.tsx:26-34` has 7 tab items and no center add button.

## B. Duplicate entry points — transfer funds (7 triggers, 2 implementations)

Shared form `src/components/wallet/WalletTransferForm.tsx:58` is used by `src/views/WalletsView.tsx:160-171` and `src/components/WalletPopupModal.tsx:403-421`. Additional triggers routing to the same shared form: `src/components/dashboard/TotalWealthHero.tsx:62-72`, `src/components/dashboard/WalletAccountsGrid.tsx:138-149`, `src/components/WalletPopupModal.tsx:161-173,333-344,370-380`.

**Second, independent transfer implementation:** `src/components/TransactionForm.tsx:200` (`TRANSFER` type toggle) + `:301-318` ("To Wallet" select, `destinationWalletId` at `:165`). Reachable from all 3 `TransactionForm` mounts (finding A).

## C. WalletPopupModal duplicates whole views

`src/components/WalletPopupModal.tsx:24` tab union, tab bar `:146-202`:

- `OVERVIEW` (`:149`, body `:217-393`) ⟷ `src/views/WalletsView.tsx:61-131` wallet card grid.
- `TRANSFER` (`:163`, body `:396-423`) ⟷ `src/views/WalletsView.tsx:154-172` transfer modal — same shared form, two shells.
- `ADD_WALLET` (`:177`, body `:426-439`) ⟷ `src/views/WalletsView.tsx:134-151` add-wallet modal — same shared form, two shells.
- `TRANSACTIONS`/"Activity" (`:191`, body `:442-501`, hardcoded `.slice(0,15)` at `:70`, own row markup `:467-497`) ⟷ `src/views/TransactionsView.tsx` filtered by wallet — drops pagination, search, type filter, soft-delete toggle, delete/restore.

`WalletPopupModal` state is owned locally by `src/views/DashboardView.tsx:58-60`, so wallet modals are unreachable outside the dashboard tab.

Destructive-action inconsistency: `WalletPopupModal.tsx:271` uses `window.confirm` for wallet delete; `src/views/WalletsView.tsx:89-98` deletes with **no confirmation at all**.

## D. Fragmented transaction row renderers (4 designs)

- `src/components/TransactionTableRow.tsx:27-163` — memoized `<tr>`. 4-way icon (`:43-61`), soft-delete state (`:30-32,96-100`), formula line (`:90-94`), action column (`:140-162`). ASCII `-` sign.
- `src/components/dashboard/RecentTransactionsTable.tsx:77-178` — inline `<tr>`, no icon badge, separate Type column (`:137-158`), U+2212 minus (`:161-177`).
- `src/components/WalletPopupModal.tsx:467-497` — card, 3-way icon, different icon vocabulary (`TrendingUp`/`TrendingDown`).
- `src/components/DiaryEntryCard.tsx:149-166` — color dot, expense-only, ASCII `-`.

The type→icon/color mapping is the most duplicated single fragment (`A:43-61`, `B:137-158`, `C:473-480`).

## E. Fragmented segmented controls (6 sites, 3 shapes)

Pill-in-tray: `src/views/DashboardView.tsx:218-235` (period filter), `src/components/TransactionForm.tsx:199-219` (type toggle), `src/components/AuthModal.tsx:127-160` (signin/signup). Underline strip: `src/components/WalletPopupModal.tsx:146-202` — 4 copy-pasted buttons, not a `.map()`. Choice grids (excluded from unification, see roadmap #5): `src/views/DiaryView.tsx:254-275` (mood), `:314-335` (food).

## F. Badge/pill drift (~7 shapes, inconsistent tint alpha)

Category tint alpha inconsistent across `${color}15|20|25`: `src/components/TransactionTableRow.tsx:76-83,121-126`, `src/components/dashboard/RecentTransactionsTable.tsx:89-95,107-119`, `src/views/KeywordRulesView.tsx:183-188` (now `184-188` post edit). Invalid `py-0.2` Tailwind class (silently dropped) at `src/components/TransactionTableRow.tsx:71,77`, `src/components/dashboard/RecentTransactionsTable.tsx:90`, `src/components/DiaryEntryCard.tsx:69`, `src/views/DiaryView.tsx:204`.

## G. Progress bars (4 copies, 3 clamping behaviours)

`src/components/DebtCardItem.tsx:87-92` and `src/components/dashboard/DebtPayoffOverview.tsx:37-42` are byte-identical (`Math.min(100, pct)`). `src/components/dashboard/CategoryExpenseDistribution.tsx:50-55` is **unclamped**. `src/components/dashboard/WalletAccountsGrid.tsx:126-134` uses `Math.min(100, Math.max(0, pct))`.

## H. Empty states (only 1 of 6 is structured; 4 surfaces have none)

Structured (icon+heading+hint, no CTA): `src/components/dashboard/RecentTransactionsTable.tsx:57-68`. Bare text: `src/views/TransactionsView.tsx:308-313`, `src/components/WalletPopupModal.tsx:461-464`, `src/views/DiaryView.tsx:388-389`, `src/components/dashboard/CategoryExpenseDistribution.tsx:33-34`. **No empty state at all:** `src/views/KeywordRulesView.tsx:174`, `src/views/DebtsView.tsx:113-121`, `src/views/WalletsView.tsx:62`, `src/components/dashboard/WalletAccountsGrid.tsx:56`.

## I. Card shell fragmentation (~6 variants, ~25 sites)

Highest-leverage duplicate: the `flex justify-between` + `h2` + `p` header banner, near-identical across all 7 views (`DashboardView.tsx:209`, `DiaryView.tsx:174`, `DebtsView.tsx:92`, `WalletsView.tsx:29`, `TransactionsView.tsx:158`, `SecurityView.tsx:126`, `KeywordRulesView.tsx:39`). Inconsistent shadow token (`shadow-xs`/`shadow-2xs`/`shadow-sm`) and padding (`p-5`/`p-6`/`p-5 sm:p-6`) across nominally-equal cards.

## J. Currency/minus-glyph drift (soft, non-blocking)

No `formatCurrencyAmount` violations found — the only `toFixed`/`toLocaleString`/literal-`฿` sites are the documented exemptions (`csvExchange.ts`, `mathEvaluator.ts`, `AnimatedCounter.tsx`, `currency.ts` itself). Two soft drifts: `src/components/AnimatedCounter.tsx:24` re-implements the same `Intl`/`toLocaleString` options instead of importing a shared constant; minus glyph is inconsistent (U+2212 at `RecentTransactionsTable.tsx:173`, `CashflowMetricsCards.tsx:76`; ASCII `-` at `TransactionTableRow.tsx:135`, `WalletPopupModal.tsx:492`, `DiaryEntryCard.tsx:163`, `CashflowMetricsCards.tsx:112`).

## K. Architecture drift from CLAUDE.md

- `src/components/Navbar.tsx:52-53` calls both `useFinanceState()` and `useFinanceActions()` despite being app-shell chrome rendered unconditionally by `App.tsx:145`. `CLAUDE.md:81` asserts Navbar "call[s] neither." Every ledger write re-renders the navbar.
- `CLAUDE.md:79` still describes 6 volatile mutators living in the state context; task T15 moved them to the actions context via ref-mirroring.

## L. Playwright suite fragility (freeze-list; see `test-selector-contract.md`)

`tests/helpers.ts:26`'s `gotoTab` asserted `toHaveClass(/bg-stone-900/)` — a Tailwind-class assertion gating every navigation in the suite. `tests/date-boundary.spec.ts:92` used an xpath ancestor keyed on `rounded-2xl`. `tests/keywords.spec.ts:20,23,26,29,47,49` used `div.flex.justify-between` filtered by label text. `tests/diary.spec.ts:34` used a bare `page.locator('p')`. `tests/transaction.spec.ts:51,110` used `.first()` on `locator('form').filter({hasText:/Record Transaction/i})` — not a live bug today (the Dashboard's `TransactionForm` is the only match while `QuickAddModal` stays unmounted when closed, per `Modal.tsx:77-78`'s `AnimatePresence` gate), but a latent one once Phase 22 makes multiple `TransactionForm` mounts routine.
> Resolved by T31-T32 (Phase 19), commit pending — see `test-selector-contract.md`.
