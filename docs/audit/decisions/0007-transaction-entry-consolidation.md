# 0007 — Transaction entry consolidation: one configurable `TransactionForm`, two deliberate exceptions

**Status:** Accepted
**Date:** 2026-09-19

## Context

Before Phase 22, creating a ledger transaction was possible from 5 independently hand-rolled surfaces (`docs/audit/ui-ux-audit-report.md` finding A): `DashboardView`'s own inline `TransactionForm` mount, the Quick Add modal (already `TransactionForm`), `TransactionsView`'s Add Transaction modal (already `TransactionForm`), `DebtsView`'s bespoke repay form (its own fields, calling `useDebts().repayDebt`/`repayDebtAtomic`), and `WalletPopupModal`'s inline Adjust Balance editor (a one-field balance reconciliation, creating an `ADJUSTMENT` transaction).

Reading `FinanceContext.tsx` in full before touching `DebtsView.tsx` (T38) surfaced the actual dependency: `repayDebtAtomic` is not a distinct atomic code path. It validates the debt/wallet, resolves the debt-repayment category, and calls the exact same `addTransaction({..., type: 'DEBT_REPAYMENT', debtId, categoryId})` that `TransactionForm`'s own `handleSubmit` already calls directly. The debt's `remainingAmount` decrement and auto-settle-at-zero behavior live inside `addTransaction` itself, gated only on `data.type === 'DEBT_REPAYMENT' && data.debtId` — not on which function called it. There was no correctness reason for a second form to exist.

## Options considered

**(a) Leave all 5 surfaces as independent implementations.** Status quo. Rejected — each one duplicates field validation, wallet/category lookup, and idempotency-key handling with its own drift risk (the debt form's minimum-payment pre-fill, for instance, existed nowhere else and was silently lost when not explicitly ported — see Consequences).

**(b) Route every transaction-creating surface, including Adjust Balance, through one fully generic `TransactionForm`.** Rejected. Adjust Balance is a one-field wallet reconciliation (new balance in, one `ADJUSTMENT` transaction out) triggered inline from inside an already-open wallet card. Routing it through `TransactionForm` would force that flow through a type toggle, a category picker, and a destination-wallet field the user has no reason to touch for "I recounted my cash and it's actually ฿4,850" — a worse UX in exchange for code reuse that doesn't actually reduce user-facing complexity.

**(c) Extend `TransactionForm` with configuration props so it can *represent* the standard-entry, quick-add, and debt-repayment cases through props rather than rewritten JSX, then retire every surface whose UX genuinely matches what `TransactionForm` already renders.** Chosen.

## Decision

**(c).** `TransactionForm` (`src/components/TransactionForm.tsx`) is the single entry engine for every flow that needs its full shape (type toggle across EXPENSE/INCOME/TRANSFER/DEBT_REPAYMENT, category, wallet, description, math-expression amount), configured via 5 optional props added in T36: `idPrefix`, `presetType`, `lockType`, `presetDebtId`, `presetWalletId`. Passing none of them reproduces the pre-T36 behavior exactly (verified: zero behavior change for existing callers).

Three consumers remain, each a legitimate distinct entry point into the same engine, not a duplicate:
- **`QuickAddModal`** (`src/components/QuickAddModal.tsx`) — the default, no-preset case. Reached from `Navbar`'s quick-add button and `DashboardView`'s "Record a Transaction" CTA, both opening the one instance `App.tsx` owns.
- **`TransactionsView`**'s Add Transaction modal — same, no-preset case, for the transactions log's own "add" action.
- **`DebtsView`**'s repay modal — `TransactionForm` with `lockType`/`presetDebtId`/`presetWalletId` set, submitting through the view's own `addTransaction` call (T38's discovery above means this needed no special debt-repayment code path — the generic engine already produces the correct ledger row and triggers the correct decrement/auto-settle).

**`WalletPopupModal`'s Adjust Balance editor stays a separate, bespoke one-field form** — option (b) above, rejected. It is the one transaction-creating surface deliberately *not* on this engine.

**The wallet-to-wallet "Transfer Funds" flow (the hero button, wallet-card shortcuts, `WalletsView`'s header button) is also not on this engine — by design, not by omission.** `TransactionForm`'s own TRANSFER type option (with its destination-wallet field) *is* available to whichever of the 3 consumers above the user opens for a general "log a transaction" purpose. But the dedicated wallet-first transfer action goes through a separate, purpose-built `WalletTransferForm` (via the shell-level `TransferFundsModal`, `src/components/wallet/TransferFundsModal.tsx`) — a narrower 2-wallets-plus-amount form with no type toggle, category, or description field to skip past. That consolidation is Phase 23's own decision, recorded separately in `0008-wallet-surface-ownership.md`. Two transfer paths coexist on purpose: one inside the generic ledger form (for "I'm logging activity and it happens to be a transfer"), one dedicated (for "I clicked Transfer on this specific wallet").

## Consequences

- **Add-transaction surfaces: 5 → 3** (Quick Add, Transactions-log Add, Debt repay) **+ 1 deliberately separate** (Adjust Balance) **+ 1 deliberately separate transfer path** (`WalletTransferForm`/`TransferFundsModal`, covered by ADR 0008). Not "4 → 1" — this ADR's whole point is that 2 of the original 5 had a genuine reason to stay off the shared engine.
- **`repayDebt`/`repayDebtAtomic` (`useDebts.ts`, `FinanceContext.tsx`) are now dead code** — `grep -rn "repayDebt" src/` outside their own definitions returns nothing. Deliberately not deleted in T38 (out of that task's stated scope, and `FinanceContext.tsx` deletions were judged to expand an already-high-risk phase's blast radius). Anyone touching `FinanceContext.tsx`'s debt-repayment logic should know these are unreachable, not assume they're a second live path to keep in sync.
- **The debt-repayment amount field lost its minimum-payment pre-fill.** The retired hand-rolled form seeded the amount from `debt.minimumPayment`; no `presetAmount` prop exists on `TransactionForm` (not part of T36's prop list), so this is a real, user-visible regression in convenience, not just an internal refactor. `debts.spec.ts` fills the amount itself so no test caught it. A `presetAmount` prop would restore it if the product decision is to bring it back.
- Any future transaction-creating surface should default to reusing `TransactionForm` via its existing 5 props before writing a new form. A genuine exception needs the same test this ADR applied to Adjust Balance: does the flow need meaningfully fewer fields than `TransactionForm` always shows, in a context where showing them anyway would be worse UX, not just "this one form has a nicer layout for tab X."

## Revisit if

- A product decision wants the minimum-payment pre-fill back — add `presetAmount`, don't re-introduce a second repay form.
- A 4th generic-entry surface is proposed — it should be a 4th `TransactionForm` consumer, not a new implementation, unless it hits the same "meaningfully fewer fields, worse UX otherwise" test Adjust Balance passed.
- `repayDebt`/`repayDebtAtomic` cross 6 months with zero call sites and no plan to reintroduce them — candidate for an explicit dead-code removal task (out of this phase's scope, flagged here so it isn't lost).
