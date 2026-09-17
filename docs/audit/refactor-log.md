# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

---

## Phase 2 — High-impact UI decoupling: T1 & T3 (2026-09-17, no commit yet — pending review)

**Changed**

- **T1** — Extracted the quick-add modal (`App.tsx:176-242` in its pre-Phase-2 form) into `src/components/QuickAddModal.tsx`, a near-verbatim move that preserves every id, `role`/`aria-*` attribute, and class name the Playwright suite depends on. The new component calls `useFinance()` itself for `wallets`/`categories`/`addTransaction`, and wraps its wallet/category filters in `useMemo`. Deleted `MainApp`'s `useFinance()` call (`App.tsx:61` in its pre-Phase-2 form) entirely — it now holds only its 4 local `useState` UI flags (`activeTab`, `direction`, `isQuickAddOpen`, `isAuthModalOpen`).
- **T3** — Wrapped `handleTabChange`, `handleNextTab`, `handlePrevTab` in `useCallback` (dep: `[activeTab]` — stable except when the tab itself changes). Added a single stable `handleNavigate` callback replacing the two inline `onNavigate={(tab) => handleTabChange(tab as ActiveTab)}` closures passed to `DashboardView`. Also added `useCallback` for the four modal-toggle handlers (`handleOpenQuickAdd`, `handleCloseQuickAdd`, `handleOpenAuth`, `handleCloseAuth`), which are now fully stable (`[]` deps) since they're pure `setState(true/false)` wrappers.

1 file changed (`App.tsx`): 48 insertions, 91 deletions. 1 file added (`QuickAddModal.tsx`, 100 lines).

**Why**

`audit-report.md` finding A: `App.tsx:61`'s `useFinance()` subscription was the single highest-leverage fix in the whole audit — `MainApp` renders the entire app shell inline, so that one subscription is why `React.memo` looked defeated at eight unrelated components (`MobileBottomNav`, `RecentTransactionsTable`, `CategoryExpenseDistribution`, `CashflowMetricsCards`, `DebtPayoffOverview`, `TotalWealthHero`, `TransactionTableRow`, `DebtCardItem`). ADR `0001` recommended doing this before any `FinanceContext` split work, since it requires zero context surgery and removes most of the measured re-render cost on its own.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors
npx playwright test --reporter=line # 39 passed (1m5.0s) - no timeouts,
                                     # helpers.ts:gotoTab's #view-loading-fallback
                                     # assertion held throughout
npm run clean && npm run build      # succeeded in 8.51s; entry chunk
                                     # 1,116.36 kB / 326.11 kB gzip
```

`git status --short` confirmed only `App.tsx` (modified) and `QuickAddModal.tsx` (new) changed — nothing in `FinanceContext.tsx`, Supabase sync, or ledger mutation code was touched, per the guardrail.

**Metric delta**

| Metric | Phase 1 | Phase 2 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.08 kB / 326.05 kB | 1,116.36 kB / 326.11 kB |
| Playwright wall-clock | 1m2.8s (cold server) | 1m5.0s (cold server) — within normal run-to-run variance, no timeouts |
| `MainApp`'s `useFinance()` subscriptions | 1 (only via the modal it rendered inline) | 0 |

The entry chunk grew by ~280 bytes raw — expected: `QuickAddModal.tsx` is a new eagerly-imported module (not lazy), so its code moved rather than shrank. `manualChunks` (T7) is still the lever for the entry chunk's actual size; that's unaffected by this phase.

Re-render counts (S1-S5) remain uncaptured. This was the natural point to capture them (T1 is the "before" this whole plan was measuring toward), but doing so requires the throwaway `Profiler`/`console.count` instrumentation branch described in `baseline-metrics.md`, which this session did not stand up. Recorded as a gap to close before Phase 3 continues (T8, T7, T9, etc.).

**Surprises**

- The `handleTabChange`/`handleNextTab`/`handlePrevTab` handlers were initially written using React's functional-updater form (`setActiveTab(current => ...)`) specifically so their `useCallback` dependency arrays could be `[]` — fully stable for the session, not just stable-between-tab-changes. This was reverted before shipping: the updater bodies called `setDirection(...)` as a side effect, and React may invoke a `setState` updater function more than once (StrictMode double-invocation, concurrent rendering) — updaters must stay pure. Shipped with the simpler closure-based form and an explicit `[activeTab]` dependency instead, which is behaviorally identical to the pre-Phase-2 code and avoids the impure-updater trap.
- T10 ("hoist `navItems`; memo `Navbar` after subscription cut") was previously blocked on "T1, T2" in the ledger. Both are now shipped (T2 in Phase 1, T1 here), so T10 is unblocked — noted in `task-ledger.md`.

**Deliberately not done**

- Re-render scenario counts (S1-S5) were not captured before or after this phase — see Metric delta above. This is the clearest gap in this phase's verification: the plan's headline claim (removing `App.tsx:61` fixes "every consumer re-renders on every write") is currently supported by structural reasoning and the passing test suite, not by a measured before/after render count. Should be captured before Phase 3 continues.
- `renderActiveView` was not wrapped in `useCallback` or otherwise memoized. It's a local render-helper function, called directly during render and never passed as a prop to any component — memoizing it would add an equality check for no benefit.
- No `FinanceContext.tsx` changes. Per the guardrail, this phase touched only `App.tsx` and the new `QuickAddModal.tsx`.
- T7 (`manualChunks`), T8 (`DiaryView` memoization), T9 (remaining inline-filter memoization elsewhere), and the rest of the deferred task list remain untouched, awaiting separate approval per the ledger.

---

## Phase 1 — Zero-risk cleanup (2026-09-17, commit `74114f6`)

**Changed**

- **T4** — Added `npm run lint` (`tsc --noEmit`) as a CI step in `.github/workflows/playwright.yml`, before the Playwright step. Added `tests` to `tsconfig.json`'s `include` (removing it from `exclude` alone was not sufficient — `include` was `["src"]` only, so `tests/` was never type-checked regardless of the exclude list; fixed by adding it to `include` too).
- **T2** — Deleted `otpPending` end-to-end: the state (`FinanceContext.tsx`), its two context-value sites, and both badge renders (`Navbar.tsx`, `MobileBottomNav.tsx`). `MobileBottomNav` lost its only `useFinance()` call and its now-dead `useFinance` import.
- **T5** — Removed dead hook exports: `useTransactions.ts`'s `metrics` memo and its dep on `isSyncing`, un-exported `UseTransactionsFilterOptions`; `useWallets.ts`'s `walletsByType` and the `addWallet`/`updateWallet`/`deleteWallet`/`isSyncing` pass-throughs (file went from 74 to 16 lines); `useDebts.ts`'s `allDebts`/`isSyncing` from the return object and `metrics.totalMinimumMonthly`/`metrics.settledCount`.
- **T6** — Removed unused props: `AnimatedCounter`'s `currencySuffix`/`decimals`/`className` (hardcoded `decimals`'s only value, 2, into the `toLocaleString` call); `InlineMathInput`'s `name`/`autoFocus`/`className` (hardcoded `name`'s only value, `"amount_expression"`, onto the `<input>`); `currency.ts`'s `formatCurrencyAmount` second parameter (`{showCode, showSymbol}`) entirely. **Did not** delete `WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab union member — see Surprises.
- **T19** — Replaced 4 inlined `Math.round(x*100)/100` copies in `FinanceContext.tsx` with `roundToCents` calls. `csvExchange.ts`'s money-rounding copies left untouched (deferred — see Deliberately not done).
- **T20** — Replaced 5 hard-coded `฿` literals (`DebtsView.tsx` ×4, `WalletPopupModal.tsx` ×1) with `APP_CURRENCY_SYMBOL`. Dropped `CashflowMetricsCards`'s `primarySymbol` prop-thread in favor of importing the constant directly; removed the now-dead `APP_CURRENCY_SYMBOL` import this left behind in `DashboardView.tsx`.
- **T28** — Deleted the `@/*` alias from `vite.config.ts` (`resolve.alias` block + the now-dead `path` import) and `tsconfig.json` (`paths`). Corrected `CLAUDE.md:53` and the Project Structure tree entry for `tsconfig.json` to stop documenting the alias.

17 files changed: 37 insertions(+), 181 deletions(-).

**Why**

These seven tasks were ranked zero-risk in `task-ledger.md` because every change is either compiler-proven (`tsc --noEmit` catches a bad deletion immediately) or sits directly on a path the existing 39 Playwright runs already exercise. See `audit-report.md` findings D, F, and H for the evidence behind each task.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors (including tests/, now in scope via T4)
npx playwright test --reporter=line # 39 passed (1m2.8s)
npm run clean && npm run build      # succeeded in 7.25s; entry chunk 1,116.08 kB / 326.05 kB gzip
                                     # (baseline: 1,116.67 kB / 326.33 kB — smaller, as expected
                                     # from dead-code removal; manualChunks still deferred to T7)
grep -rn "฿" src/ --include=*.tsx   # only currency.ts:12 and the two documented exemptions
```

`git status --short` confirmed only the 17 intended `src/`/config files plus the new `docs/` tree changed — nothing else touched.

**Metric delta**

| Metric | Phase 0 baseline | Phase 1 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.67 kB / 326.33 kB | 1,116.08 kB / 326.05 kB |
| `tsc --noEmit` (warm) | 2.40s, 373 files | not re-measured (no reason to expect a change; `tests/` now included) |
| Playwright wall-clock | 1m16.2s (cold server) | 1m2.8s (cold server) |
| Source LOC (src+tests) | 9,529 | 9,529 − 144 net = 9,385 |

Re-render counts (S1-S5) remain uncaptured — still deferred to immediately before Phase 3, per the Phase 0 entry.

**Surprises**

- T4's instruction ("remove `tests` from `tsconfig.json` exclude list") was not by itself sufficient to make `tsc` check `tests/` — `include` was `["src"]` only, so the exclude entry was already a no-op. Fixed by adding `tests` to `include` as well. `tests/` type-checked clean with zero pre-existing errors, so no cascading fixes were needed.
- T2's `otpPending` removal had a free side effect: `MobileBottomNav` lost its only context subscription, so its pre-existing (but previously inert, per audit correction C3) `React.memo` now actually does something.
- **T6's `WalletPopupModal.tsx:22` instruction was based on an incorrect audit finding.** The `'TRANSACTIONS'` tab union member is not dead code — it's a live "Activity" tab with two working in-modal trigger buttons (`id="tab-btn-txs"` and a second button in the wallet-detail view) and real rendered content. The original finding only established it can never arrive as `WalletPopupModal`'s *initial* tab from `DashboardView`'s `openWalletModal` (correctly narrowed by `WalletAccountsGrid.tsx:12`), not that the whole feature was unreachable. Deleting it would have broken a real feature and caused 4+ compile errors. Skipped; `audit-report.md` finding D corrected in place rather than marked resolved.

**Deliberately not done**

- `csvExchange.ts`'s 3 money-rounding copies (`:152,163,176`) were left un-migrated to `roundToCents`, per T19's explicit scope limit — that helper is module-private to `FinanceContext.tsx`, and exporting it is more churn than Phase 1's zero-risk scope justifies. Left for a later phase.
- `WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab member was not deleted (see Surprises) — this is a correction to the audit, not deferred work.
- No `src/` file was touched beyond the 7 tasks' explicit scope. In particular, `DashboardView.tsx:104-124`'s hand-rolled income/expense/debt-repayment aggregation (which duplicates the `metrics` memo T5 just deleted from `useTransactions.ts`) was left as-is — deduplicating it is task `T26`, out of scope here.

---

## Phase 0 — Documentation and baselines (2026-09-17, commit `74114f6` — shipped together with Phase 1)

**Changed**

- Created `docs/audit/` with `README.md`, `audit-report.md`, `baseline-metrics.md`, `task-ledger.md`, `refactor-log.md` (this file), `constraints-to-promote.md`, and 5 ADRs under `decisions/`.
- Zero edits to `src/`, `tests/`, or any build config.

**Why**

The audit surfaced ~30 findings across re-renders, duplication, dead code, constraint drift, and test coverage gaps, with no existing place to record them. Without a written baseline, every future session re-derives the same findings from scratch, and there is no way to prove a later change actually improved anything.

**Verification**

Baselines captured on a clean working tree at commit `1a02a4a`:

```
npm run clean && npm run build     # entry chunk 1,116.67 kB / 326.33 kB gzip; build 22.61s
npx tsc --noEmit --extendedDiagnostics   # median warm: 2.40s (373 files, 9,164 TS lines)
npx playwright test --reporter=line      # 39 passed (1m16.2s wall-clock, cold dev-server boot)
```

`git status --short` clean before and after — no unintended changes leaked (`dist/` is gitignored and was not committed).

**Metric delta**

N/A — this is the baseline column itself. See `baseline-metrics.md`.

**Surprises**

- The CI workflow (`.github/workflows/playwright.yml`) never runs `npm run lint`, and `tsconfig.json:30` excludes `tests/` from type-checking — the gate the whole plan depends on is not enforced today (finding C4). Recorded as task T4, first in Phase 1.
- Two harmless Rollup build warnings from `node_modules/zod`'s `@__PURE__` comment placement — third-party, not actionable, noted so it isn't mistaken for a regression later.

**Deliberately not done**

- Re-render scenario counts (S1-S5) were **not captured** in this phase. Doing so requires a throwaway instrumentation branch (`Profiler` + `console.count`), and this phase was scoped to zero `src/` edits, including on a disposable branch. Deferred to immediately before Phase 3 (the `App.tsx:61` fix), where the "before" number is most load-bearing. The exact method and fixed scenarios are already written into `baseline-metrics.md` so this doesn't need to be re-derived.
- No source code was touched — Phase 1 (dead code + constraint-drift fixes) is documented in `task-ledger.md` but not yet executed.
