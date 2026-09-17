# 0001 — Split the FinanceContext value, not the provider

**Status:** Proposed
**Date:** 2026-09-17

## Context

`FinanceContext.tsx` is 1,589 lines with a 34-member value across 7 domains (auth/sessions, wallets, categories+keyword rules, transactions, debts, diary, UI filters). Sixteen components call `useFinance()` and re-render together on every write. Half the context's public API (`DebtsView`, `SecurityView`, `KeywordRulesView`, CSV/soft-delete paths) has zero test coverage.

Verified fact that drives this decision (audit-report.md correction C1): of the 22 `useCallback`-wrapped functions in the context, only **7 are volatile** (depend on hot state: `addTransaction`, `setTransactionDeleted`/`softDeleteTransaction`/`restoreTransaction`, `commitBulkImport`, `repayDebtAtomic`, `upsertDiaryEntry`). The other 15 depend only on `isAuthenticated`/`currentUser.id`/`[]` and are stable for the entire session.

## Options considered

**(a) Full provider split** — separate providers per domain (wallets, transactions, debts, diary, auth). Rejected: the domain boundaries do not cut where the writes cut. `addTransaction` needs `wallets`, `transactions`, `debts`, `categories` in one scope and rolls three of them back together on failure (`FinanceContext.tsx:1111-1113`). A provider-per-domain would force cross-provider coordination for what is definitionally one transaction — reinventing the single provider with extra indirection. It also requires moving `roundToCents`, `generateIdempotencyKey`, `safeGetLocalStorage`, and `MutationResult` into a leaf module first, adding import edges to a graph that is currently a clean acyclic DAG specifically because `FinanceContext.tsx:1-24` imports no hook and no component.

**(b) Split the value: stable-actions context + volatile-state context** — one `FinanceProvider`, two `createContext` calls nested inside it. `FinanceActionsContext` holds the 15 stable callbacks + `setShowSoftDeleted`; `FinanceStateContext` holds the 12 state members plus, initially, the 7 volatile actions. `useFinance()` survives as a merging shim so the split commit touches zero call sites.

**(c) Leave the context shape alone; fix only memo/dep churn and consumer subscriptions** — e.g. delete `useFinance()` from `App.tsx:61` (task T1), delete `otpPending` (T2). This alone removes most of the measured re-render cost, because `MainApp`'s single subscription is why `React.memo` looks defeated at eight components.

## Decision

**(b), staged after (c).** Do the App-shell fix (T1/T2/T3) first — it is the cheapest change that removes "every consumer re-renders on every write," and it requires zero context surgery. Then split the value (T13, mechanical, shim-guarded) and migrate consumers one file per commit (T14). Only after that, ref-mirror the 7 volatile mutators (T15) so they can move into the actions context — one mutator per commit, mirrored via `useEffect` (never inside a `setState` updater, since `StrictMode` double-invokes those), `repayDebtAtomic` last since it is doubly volatile.

## Consequences

- `AddWalletForm`, `WalletTransferForm`, and `SecurityView` stop re-rendering on every ledger write once they migrate to `useFinanceActions()` / a narrower state read.
- The `useMemo` at `FinanceContext.tsx:1498` (currently 33 `Object.is` comparisons per commit for a memo whose only parent never re-renders) becomes load-bearing only after this split.
- No new import edges; no barrel; the acyclic DAG property is preserved.
- Half the migrated surface (`DebtsView`, `SecurityView`, `KeywordRulesView`) has no test coverage — T12 (characterization tests) is a hard prerequisite for T14 and mandatory for T15.

## Revisit if

Post-split re-render counts (S1-S5 in `baseline-metrics.md`) remain above target after T14 lands. See ADR `0002` for the escalation path if so.
