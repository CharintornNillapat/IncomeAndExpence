# UI/UX unification roadmap — Phases 19–29 (T31–T50)

Companion to `ui-ux-audit-report.md`. Findings there map to phases here. Continues the `refactor-log.md` numbering (last shipped: Phase 18) and the `task-ledger.md` task-id sequence (last shipped: T30).

## Verification protocol (every phase)

```
npm run lint
npx playwright test tests/<named>.spec.ts --project=chromium
npm run build
CI=true npx playwright test      # all 87 must pass
```

Then a `refactor-log.md` entry (Changed / Why / Verification / Correctness notes / Deliberately not done), a `task-ledger.md` row, a `baseline-metrics.md` column, and a follow-up commit backfilling the sha into the log heading (existing two-commit pattern).

## Spec-edit policy

Editing a spec is allowed when an assertion **survives and only its locator moves**; forbidden when an assertion would be **deleted or weakened**. Spec edits ship in the same commit as the code change they follow from, and the full 87 must be green immediately before and after.

---

## Phase 19 — Selector hardening + audit docs (T31–T33) · Risk Low

Resolves finding L. `tests/helpers.ts:26`'s `toHaveClass(/bg-stone-900/)` gates every navigation in the suite; a restyle in Phases 25-27 would break all 87 runs without this phase first.

- **T31** — additive `aria-current="page"` + `data-testid="nav-tab-${id}"` on `Navbar.tsx` tabs and `data-testid="mobile-nav-tab-${id}"` + `aria-current` on `MobileBottomNav.tsx`. `tests/helpers.ts:26` migrates to `toHaveAttribute('aria-current', 'page')`.
- **T32** — additive `data-testid` at the fragile anchors: `metric-card-income|expense|net` on `CashflowMetricsCards.tsx` (retires the `date-boundary.spec.ts:92` xpath), `metric-extracted-amount|matched-category|inferred-type|cleaned-description` on `KeywordRulesView.tsx`'s sandbox rows, `diary-entry-notes` on `DiaryEntryCard.tsx`'s notes paragraph, and a new `formTestId` prop on `TransactionForm.tsx` wired as `tx-form-dashboard` / `tx-form-quickadd` / `tx-form-page` at its three call sites (`DashboardView.tsx`, `QuickAddModal.tsx`, `TransactionsView.tsx`) ahead of Phase 22.
- **T33** — this document, `ui-ux-audit-report.md`, and `test-selector-contract.md`.

**Commit split:** Commit A (T31+T32) is additive-only — attributes and a new optional prop, zero behavior change — and must pass all 87 with **zero spec edits**, proving additivity. Commit B (T33 + helper/spec migration) updates `tests/helpers.ts` and the 4 affected specs to the new attributes.

---

## Phase 20 — Navbar de-subscription (T34) · Risk Low-Medium

Resolves finding K. Its own phase so the re-render delta is attributable, not blended with a pixel diff from a later phase.

New `src/components/navbar/NavbarLedgerStatus.tsx` becomes the sole subscriber (`useFinanceState()` for `totalNetWorth`/`isAuthenticated`/`isSyncing`/`currentUser`, `useFinanceActions()` for `signOut`), rendering the sync badge, `AnimatedCounter` net-worth block, and account/sign-in cluster in identical DOM positions with identical ids. `Navbar.tsx` keeps `activeTab`, `NAV_ITEMS`, `useTheme()`, and the quick-add/auth callbacks — becomes props-only, so `React.memo` on it is real. Same commit corrects the stale `CLAUDE.md:79` sentence.

**Breaks:** `auth.spec` (`#navbar-signin-btn`), `theme.spec` (`#navbar-theme-toggle-btn`) — mitigated by preserving ids/sibling order verbatim.

---

## Phase 21 — Transaction type tokens (T35) · Risk Low

Resolves half of finding D. New `src/components/transaction/txTypeMeta.ts`: per-type `label`, `icon`, `compactIcon`, `tint`, `sign`. `src/utils/currency.ts` gains a shared `Intl` options constant (imported by `AnimatedCounter.tsx:24`) and a `MINUS` const standardising display on U+2212 (finding J). Pure data, no DOM restructure — first among primitives because Phase 22 and Phase 28 both consume it.

---

## Phase 22 — One transaction entry engine (T36–T38) · Risk High

Resolves finding A. **Survivors:** Navbar quick-add, TransactionsView modal. **Retired:** DashboardView inline form, DebtsView hand-rolled repayment body. **Kept:** WalletPopupModal's Adjust Balance (see "Deliberately not changed" below).

- **T36** — `TransactionForm.tsx` gains `idPrefix`, `presetType`, `lockType`, `presetDebtId`/`presetWalletId`.
- **T37** — DashboardView drops the inline form for `#dash-open-add-modal-btn` → `QuickAddModal`. Spec change: `transaction.spec.ts:51,110,55,119` swap the form locator for a button click + dialog scope; assertions kept verbatim.
- **T38** — DebtsView repay modal body becomes `<TransactionForm presetType="DEBT_REPAYMENT" lockType idPrefix="repay" />`, preserving `#repay-amount-math`/`#repay-wallet-select`/`#confirm-repay-btn`.

---

## Phase 23 — Wallet surface ownership (T39–T41) · Risk High

Resolves finding C. `WalletPopupModal` **collapses; it is not promoted to shell level** (promotion would need wallet data above view level, conflicting with the fix in Phase 20). Both `DashboardView` and `WalletsView` mount their own instance instead.

- **T39** — keep OVERVIEW + ADJUST only; retire TRANSFER/ADD_WALLET tabs (WalletsView owns those). Tab strip becomes a `.map()`.
- **T40** — TRANSACTIONS tab becomes a 5-row preview on Phase-21 tokens + "View all" handoff to `TransactionsView`, rather than a half-reimplementation.
- **T41** — `TotalWealthHero`/`WalletAccountsGrid` transfer/add-wallet triggers become callback props into WalletsView's single modal instance.

---

## Phase 24 — ConfirmDialog (T42) · Risk Medium

Resolves the destructive-action inconsistency in finding C. New `src/components/ui/ConfirmDialog.tsx` over `Modal.tsx`, applied only to irreversible deletes: wallet delete (`WalletsView.tsx:89-98` has none today — a real bug; `WalletPopupModal.tsx:271`'s `window.confirm`), and debt delete. Transaction soft-delete stays one click (reversible via restore).

---

## Phase 25 — SectionHeader + Card (T43–T44) · Risk Medium

Resolves finding I. `SectionHeader` first (highest leverage — the 7-view header banner), then `Card` (~25 sites, standardises `shadow-xs`, retains `rounded-2xl`).

---

## Phase 26 — Badge, ProgressMeter, EmptyState (T45–T47) · Risk Low-Medium

Resolves findings F, G, H. `Badge`/`CategoryChip` collapses tint-alpha drift and fixes `py-0.2`. `ProgressMeter` normalizes the 3 clamping behaviours (including the unclamped `CategoryExpenseDistribution.tsx:50-55`). `EmptyState` reaches the 4 surfaces with none.

---

## Phase 27 — SegmentedControl (T48) · Risk Medium

Resolves the pill-in-tray half of finding E (period filter, type toggle, signin/signup tabs). Diary choice grids excluded — see "Deliberately not changed" below.

---

## Phase 28 — Transaction row cells (T49) · Risk High, last

Re-scopes deferred `T25` (rejected as one component — a row serving table/compact/card/diary needs a boolean feature matrix worse than the duplication it replaces). Ships shared **cells** (`TxTypeIcon`, `TxAmount`, `TxCategoryChip`, `TxSoftDeletedTag`) over Phase-21 tokens; each of the 4 renderers keeps its own layout.

---

## Phase 29 — Closeout (T50) · Risk Low

ADRs `0006-ui-primitive-inventory.md`, `0007-transaction-entry-consolidation.md`, `0008-wallet-surface-ownership.md`. Final `baseline-metrics.md` column. `CLAUDE.md` gains primitive-inventory and entry-point rules only for what shipped, per the existing promotion rule.

---

## Deliberately not changed

1. `ReloadPrompt.tsx:34-36` — a toast, not a dialog; forcing `Modal.tsx` adds an unwanted focus trap/backdrop.
2. The 4 transaction-row renderers as one component (Phase 28 ships cells instead).
3. `AnimatedCounter`'s currency exemption (ADR 0004 stands; only the `Intl` options constant is shared).
4. `WalletPopupModal`'s Adjust Balance — a one-field wallet reconciliation, not a ledger entry; routing it through `TransactionForm` would expose fields the user must ignore.
5. Diary mood/food grids — not segmented controls; merging would produce a props matrix.
6. Transaction soft-delete confirmation — reversible via restore; a confirm is a UX regression.
7. `formStyles` exceptions already adjudicated in Phase 17 (`WalletPopupModal` compact editors, `TransactionsView`'s `min-h-[44px]` filter bar, `AuthModal`/`TransactionForm` `text-sm` inputs).

## Reused, not rebuilt

`src/components/Modal.tsx` · `src/utils/formStyles.ts` · `src/utils/mapUtils.ts` (`buildLookupMap`) · `src/utils/currency.ts` (`formatCurrencyAmount`) · `src/utils/date.ts` · `src/components/wallet/AddWalletForm.tsx` + `WalletTransferForm.tsx` · `src/hooks/useTransactions|useWallets|useDebts` · `tests/helpers.ts`.
