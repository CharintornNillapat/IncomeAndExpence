# 0015 — The repay form shows the payoff goal it is moving

**Status:** Accepted, **amended by ADR `0016`** (2026-09-23). The "Overpayment warns; it never blocks" decision below was **reversed** once the ledger stopped permitting an overpayment at all — see `0016-debt-repayment-integrity.md`. That section is left as written rather than edited: an ADR records what was decided when, and the escape hatch it left ("if that behaviour is ever fixed in the ledger, revise the note with it") is the mechanism that produced `0016`.
**Date:** 2026-09-23

## Context

Phases 41 and 42 gave the other two money-moving surfaces a sense of consequence — the note drives the transaction form (ADR `0013`), the transfer form previews both balances (ADR `0014`). The repay modal was the one left untouched, and it had become the least informative of the three.

1. **The debt's remaining balance appeared nowhere in the modal.** `DebtsView` passes `presetDebtId`, which suppresses the `Debt Target` select — the only control that would have rendered `{d.name} ({formatCurrencyAmount(d.remainingAmount)} remaining)`. The user was asked to type a repayment against a number last seen on the card *behind* the modal.
2. **The progress bar the whole view is built around only moved after the write committed.** A payoff goal is the point of the feature, and the form said nothing about where a payment lands you on it.
3. **The three amounts people actually type had no shortcut.** Settling meant reading the remainder off the card and re-typing it exactly. `minimumPayment` was already stored on every debt and rendered on the card, but was not actionable anywhere.

## The asymmetry this surfaced

`addTransaction` debits the wallet the **full** `data.amount` (`FinanceContext.tsx:1537`) while the debt floors at zero (`:1565`, `Math.max(0, roundToCents(...))`, mirrored on the remote path at `:1698`).

Pay ฿500 against a ฿100 remaining debt and ฿400 leaves the wallet against nothing. The transaction records ฿500, the debt settles, and the excess is simply gone from the ledger's point of view.

**This ADR does not change that behaviour.** It is pre-existing, and fixing it is a ledger change with its own risk surface. What changed is that the preview is the first surface in a position to say so *before* the user consents, and it now does.

## Options considered

**(a) Block submit when the amount exceeds the remainder.** Tempting, because the money-for-nothing case above is nearly always a mistake. Rejected: it removes a case the ledger permits (interest and fees the debt model does not carry, which a user may legitimately be paying through this form), and it changes the gating of `#confirm-repay-btn`, which `tests/debts.spec.ts` exercises. A behaviour change is not the right payload for a phase whose purpose is to make existing behaviour visible.

**(b) Silently clamp the amount down to the remainder.** Rejected outright. It overwrites a number the user typed by hand, which is precisely what ADR `0013`'s manual-amount latch exists to prevent. A form that quietly rewrites its own input is worse than one that warns.

**(c) Warn in amber, leave submit enabled.** Chosen, following ADR `0014`'s overdraft precedent. The note names the excess *and* states that the full amount still leaves the wallet — the second half is what makes it worth rendering at all.

**(d) Put the chips and preview in `DebtsView`'s modal shell rather than in `TransactionForm`.** Rejected. The chips must reach `InlineMathInput`'s `seed`, which is `TransactionForm`'s own `amountSeed` state, and the preview must read the live evaluated `amount`. Hoisting either means new props that expose form internals — an `onAmountChange` callback and a seed handle — which leaks more of the shared engine than the `DEBT_REPAYMENT` branch it would avoid. `TransactionForm` already carries three such branches (the `Debt Target` select, the submit label, the default description).

## Decision

**A payoff block renders inside `TransactionForm`, under the amount input, whenever `type === 'DEBT_REPAYMENT'` resolves to a live debt.** It holds the quick-payoff chips, the projected remaining balance, and a projected `ProgressMeter`.

### The preview mirrors the ledger, it does not approximate it

```ts
projectedRemaining = Math.max(0, roundToCents(debt.remainingAmount - plannedPayment));
```

That is `FinanceContext.tsx:1565` verbatim, sharing `roundToCents` from `src/utils/money.ts` — extracted in Phase 42 for exactly this reason. The progress figure mirrors `DebtCardItem.tsx:21-22`, with its `isSettled ? 0 : remainingAmount` branch collapsed because `projectedRemaining` is already the post-payment number and a settled debt is zero by construction.

No new plumbing: `InlineMathInput.onAmountEvaluated` already fires on every keystroke, so the whole block is derived state on render. No effect, no debounce, no context change.

### A chip sets the manual-amount latch itself

`InlineMathInput`'s `seed` effect deliberately never fires `onUserEdit`, so seeding alone would leave `userTouchedRef.current.amount` false and let a note typed afterwards overwrite the chip's value. The chip handler sets the latch directly, exactly as `handleApplyPreset` does. **A chip is an explicit choice of amount and outranks the note parser from that point on** — the same contract ADR `0013` gives to typing in the field by hand, reached through a new entry point. Pinned by a test.

Seeding rather than remounting also matters: `defaultValue` is only honoured while the field is empty, and a remounting `key` would discard focus and error state.

### The container stays mounted without an amount — a deliberate divergence from ADR `0014`

The transfer preview vanishes from the DOM entirely when there is no valid amount. This one does not, because of gap (1) above: with `presetDebtId` set, the payoff block is the *only* place the debt's remaining balance appears in the modal, so hiding it empty-handed restores the original problem. The `→ projected` half and the delta still disappear, which keeps a `toHaveCount(0)` assertion available at the right granularity.

### Smaller calls

- **"Minimum Due" renders only when `0 < minimumPayment < remainingAmount`.** At or above the remainder it duplicates "Pay in full" *and* trips the overpayment warning — noise, not a shortcut.
- **The two notes are mutually exclusive.** Overpayment renders the amber note, which already states that the debt settles; an *exact* payoff renders the emerald settle note. Never both.
- **`formatCurrencyAmount`, not `AnimatedCounter`** — same reasoning as ADR `0014`. It animates from 0 on mount, re-tweens per keystroke, and ADR `0009` forbids children in its span.
- **Chips reuse the template-chip styling**, this form's existing "apply a stored value" affordance. `InlineMathInput`'s emerald quick-amount chips mean *add to what is there*, which is the wrong signal for a target amount.

## Consequences

- `tests/debts.spec.ts` is this phase's regression guard and passes **unedited**. It is the only spec touching any repay selector, and `#repay-amount-math` / `#repay-wallet-select` / `#confirm-repay-btn` are untouched: chips seed *through* the amount input rather than replacing it.
- `roundToCents` now has three consumers. A change to it is a change to the ledger *and* to two previews shown before consent. Keep them in lockstep.
- `TransactionForm` carries one more `DEBT_REPAYMENT` branch. This is the fourth; at a fifth, or at a second locked-type caller, the debt-specific markup earns extraction into `src/components/transaction/`.
- The overpayment note is now the only place in the app that describes the full-debit/floored-debt asymmetry. If that behaviour is ever fixed in the ledger, this note must be revised or removed with it.

## Revisit if

- The ledger starts clamping the wallet debit to the remainder, or records the excess as a separate transaction. The overpayment note would then be describing behaviour that no longer exists.
- A hard overpayment block is genuinely wanted. It needs a decision about legitimate over-payment (interest, fees) first, not a blanket `amount <= remainingAmount` gate.
- A second caller mounts `TransactionForm` with `presetType="DEBT_REPAYMENT"`. The payoff block's ids are derived from `idPrefix || formId` and would need checking for collisions.
