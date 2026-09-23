# 0016 — A debt repayment cannot exceed what is owed, and a reversed one gives it back

**Status:** Accepted. **Amends ADR `0015`**, which recorded the overpayment asymmetry and deliberately left it unfixed.
**Date:** 2026-09-23

## Context

ADR `0015` gave the repay form a live payoff preview and, in doing so, documented an asymmetry it chose not to fix:

> `addTransaction` debits the wallet the **full** `data.amount` (`FinanceContext.tsx:1537`) while the debt floors at zero (`:1565`). Pay ฿500 against a ฿100 remaining debt and ฿400 leaves the wallet against nothing.

That ADR warned about it in amber, left `canSubmit` alone, and wrote an explicit escape hatch: *"if that behaviour is ever fixed in the ledger, revise the note with it."* This is that fix.

## What the audit found that the bug report did not

Searching for every write path that touches `Debt.remainingAmount` found **four**, where the reported bug named one:

| Path | Debt handling before this ADR |
|---|---|
| `addTransaction` (`:1561` local, `:1695` remote) | Decrements, floored at zero — the reported asymmetry |
| **`setTransactionDeleted` (`:1827`)** | **None whatsoever** |
| `commitBulkImport` (`:1968`) | None — and correctly so: `ImportRowValidation` (`types.ts:152`) carries no `debtId`, so a CSV row cannot target a debt |
| `settleDebt` (`:2143`) | Zeroes the debt with no wallet debit and no ledger row |

**`setTransactionDeleted` was the larger hole**, and nothing in the suite touched it — `soft-delete.spec.ts:95`'s balance-invariant test uses an EXPENSE, so no spec had ever driven a repayment through delete and restore.

```
record ฿1,000 repayment    wallet −1,000   debt −1,000   balanced
soft-delete it             wallet +1,000   debt    —     ฿1,000 of debt cleared for free
restore it                 wallet −1,000   debt    —     paid twice for one reduction
```

Repeatable in both directions. The overpayment bug requires a user to type too large a number; this one fires on an ordinary undo.

## Decision

### 1. Reject; never clamp

`addTransaction` returns `{ success: false, error }` when a `DEBT_REPAYMENT` exceeds the target's `remainingAmount`. It does **not** silently reduce the amount.

Clamping was the alternative and is worse than the bug it fixes: it writes a ledger row for an amount the user never entered, while the form's own submit button still names the amount they typed. A ledger that quietly disagrees with the instruction that produced it is not an improvement on one that loses money visibly. The same reasoning already rules out auto-clamping the amount field (ADR `0015`, option (b)).

### 2. The guard's position is load-bearing

It sits in a three-line window: **after** the `existingTx` idempotency replay check (`:1512-1516`), **before** `inFlightIdempotencyKeys.current.add(clientKey)` (`:1518`). Both edges are real failures, not style:

- **Before the replay check**, a legitimate retry of an already-committed payment that settled its debt would be rejected, because `remainingAmount` is already zero. Replaying a success would start returning an error.
- **After the `add`**, the `finally` that releases the key (`:1786`) belongs to a `try` that only begins after the optimistic writes. An early return in between leaks the key permanently — and `useIdempotencyKey` **reuses the key on retry after a failure**, rotating only on success. The user would correct the amount, resubmit, and get `Duplicate transaction submission in progress.` forever. The form would be bricked by its own validation.

Placed correctly, nothing has been written yet, so rollback, idempotency and the compensation ladder are all untouched.

### 3. The `Math.max(0, …)` floors stay

Both (`:1565`, `:1698`) are now unreachable for new writes. They are kept as defensive floors, not removed as dead code: `debtsRef.current` can be stale against a concurrent repayment from another device, and without the floor that race writes a **negative** remaining balance rather than clamping to zero. Guard first, floor second.

### 4. Soft-delete and restore move the debt with the wallet

`setTransactionDeleted` reverses the debt decrement on delete and reapplies it on restore, using the same shape as its existing wallet handling: values computed up front (never read back out of a `setState` updater — this function was fixed for exactly that race in T63), an optimistic `setDebts`, `previousDebts` in the rollback snapshot, a remote write ordered **with the wallet writes and before the `is_deleted` flag**, and a compensating write in the `catch`.

`isSettled` is recomputed in both directions, so reversing a payment that settled a debt un-settles it and makes the card actionable again.

### 5. `settleDebt` is exempt, and that is a decision rather than an oversight

The ✓ button zeroes a debt with no wallet debit and no ledger row. Under a strict reading of double-entry that is an asymmetry in the opposite direction — debt vanishes, no money moved.

It stays. It reads as a deliberate "written off, or paid outside this app" affordance, and making it accounting-pure would turn a one-tap button into a wallet picker that writes a repayment the user did not ask for. Recorded here so a later audit finds a decision rather than assuming nobody looked.

## Consequences

- **`CLAUDE.md`'s rule "Do NOT turn the debt overpayment warning into a submit gate" is deleted**, in the same commit as the code that contradicts it. A standing rule that the shipped code violates is worse than no rule.
- **A Phase 43 test is inverted on purpose.** `debt-repayment.spec.ts`'s *"overpaying warns but never blocks"* asserted `#confirm-repay-btn` `toBeEnabled()`. The spec-edit policy forbids weakening an assertion, and this is not that: it is an authorized reversal of the behaviour the assertion existed to pin, anticipated in writing by ADR `0015`. The test is rewritten to pin the opposite contract and renamed to say so.
- **The amber note changes job.** Same `repay-overpayment-note` testid, same render condition, opposite meaning — it described a consequence the user was about to accept, and now states a limit and names the chip that satisfies it. Recorded in `test-selector-contract.md`, because a selector whose meaning inverts while its name holds still is exactly what that document exists to catch.
- **This phase puts bytes on the critical path**, unlike Phase 43. `FinanceContext` is eager, so both guards land in the entry chunk. Small, but non-zero and reported as measured.

## Known limitations

- **Reversal is uncapped.** Restoring a pre-Phase-44 overpayment computes `remaining + amount` with no upper bound, so `remainingAmount` can exceed `totalAmount` for legacy rows. Capping would silently discard the difference — the same sin as clamping. Phase 43's `displayPercent` clamp and `ProgressMeter`'s internal clamp already absorb it, so it renders as 100% rather than breaking.
- **Existing overpaid ledgers are not repaired.** The guard is a write-time constraint, not a migration. Nothing scans history for rows written before it.
- **The ledger guard is unreachable from the UI** once the client gate exists, and this project has no unit-test runner — only Playwright. It is deliberately left untested rather than covered by a test that proves nothing; its correctness rests on review and on mirroring the wallet-resolution guard immediately above it.

## Revisit if

- A second surface gains the ability to write a `DEBT_REPAYMENT` — a CSV import that learns `debtId`, or an API. The guard lives in `addTransaction`, so any path that bypasses it bypasses the constraint.
- A unit-test runner is introduced. The ledger guard and the reversal arithmetic are the first two things that should get direct tests.
- Legitimate over-payment turns out to be a real need (interest or fees the `Debt` model does not carry). The right answer is then to model those, not to relax this guard.
