# 0014 — The transfer form shows direction and consequence

**Status:** Accepted
**Date:** 2026-09-23

## Context

ADR `0013` removed TRANSFER from `TransactionForm` entirely, making `TransferFundsModal`/`WalletTransferForm` the app's **only** transfer surface. That raised the bar for the one form left, and it was not meeting it.

1. **The balance was buried in option text.** `{w.name} ({formatCurrencyAmount(w.balance)})` inside the two `<option>` lists was the only place a balance appeared anywhere in the form. A user could not see what a transfer *would do* until after committing it — and a transfer is the one operation in the app that moves money without changing net worth, so "did that land where I meant it to?" is the entire question.
2. **Nothing rendered direction.** `From Wallet` and `To Wallet` were two equal cells of a `sm:grid-cols-2` grid. The form described a movement using a layout that expressed none.
3. **A latent desync sat underneath.** The destination `<select>` filtered the source out of its own option list but never reconciled `destWalletId`. Changing the source to the wallet already selected as destination left state pointing at a wallet no longer in the list. Invisible while nothing rendered it; a live preview would have shown balances for a wallet the user had not selected.

## Options considered

**(a) Replace both `<select>`s with tappable wallet cards.** The best-looking result, and rejected on a hard constraint. `tests/wallet-forms.spec.ts` asserts both selectors are **visible** (`:22-23,50`) and reads them with `.inputValue()` (`:25,52`). A card is not a form control and a `hidden`/`sr-only` select fails `toBeVisible()`. Reworking those four assertions is not a locator move — "the control is visible" does not survive the change — so the spec-edit policy forbids it. Keeping the suite's only transfer coverage intact is worth more than the visual.

**(b) Cards for display with the selects retained beside them as a compact "change" dropdown.** Two controls bound to one value, which is exactly the shape that produced the desync in (3).

**(c) Keep the `<select>` as the control and build the card *around* it.** Chosen.

## Decision

**Each side of the transfer is a panel; the `<select>` lives inside it, restyled borderless and transparent.** The panel carries the wallet's colour-tinted icon badge, the control, the current balance, and — once there is a valid amount — the projected balance beneath it. A swap button sits between them; the grid is `sm:grid-cols-[1fr_auto_1fr]` on desktop and stacks on mobile with the arrow rotated a quarter turn so direction reads top-to-bottom.

`tests/wallet-forms.spec.ts` passes **completely unedited** through this change. That is the point of (c), and it is the phase's regression guard.

### The preview mirrors the ledger, it does not approximate it

`sourceAfter = roundToCents(balance - amount)` and `destAfter = roundToCents(balance + amount)` — the same two lines `addTransaction` runs for a TRANSFER. To share them, `roundToCents` moved out of `FinanceContext.tsx` (module-private since it was written) into **`src/utils/money.ts`**, which `FinanceContext` now imports. This was already-identified deferred work (`refactor-log.md:1942`).

Honest about what that bought: **no currently-reachable input renders differently.** `formatCurrencyAmount` rounds to 2dp anyway, balances arrive from `Decimal(15,2)`, and amounts are cent-clean out of `safeEvaluateMath`. The extraction is worth doing because the alternative is a *second* rounding implementation in the UI layer, which is precisely what the "no inlined `Math.round(x*100)/100` at a ledger site" rule exists to prevent. `roundToTwoDecimals` in `mathEvaluator.ts` stays separate, as it always has — it carries a magnitude-scaled epsilon nudge for half-cent input expressions and must not be merged with this.

No new plumbing was needed: `InlineMathInput.onAmountEvaluated` already fires on every keystroke, so the preview is derived state on render. No effect, no debounce, no context change.

### `formatCurrencyAmount`, not `AnimatedCounter`

The obvious guess is wrong here. `AnimatedCounter` always animates **from 0 on mount** and re-runs its tween on every `value` change, so a per-keystroke preview would sweep 0 → balance and restart on each character typed. It also cannot carry a sign glyph, because ADR `0009` forbids giving its ref'd span any React children. Static formatted text with a CSS colour transition is the correct instrument.

### Overdraft warns; it never blocks

When the projection goes negative the number renders rose and an amber note names the shortfall. `canSubmit` is **unchanged**. A `CREDIT_CARD` wallet legitimately carries a negative balance, so a hard gate would break a real case to satisfy an aesthetic one — and `WalletAccountsGrid` already styles negative balances in rose, so the app has always accepted them. `tests/transfer-preview.spec.ts` pins the non-blocking behaviour explicitly so a later phase cannot quietly turn it into a gate.

### Swap, which is also the desync fix

Both selects now list every wallet, and picking the wallet already on the other side **swaps the two** rather than leaving one stale. The explicit swap button is the same operation on a button. This preserves `wallet-forms.spec.ts`'s `src.inputValue() !== dst.inputValue()` invariant by construction rather than by filtering.

### Smaller calls

- **"Transfer all"** seeds the amount with the source balance through `InlineMathInput`'s `seed` prop — added in Phase 41 for the express note parser and unused until now.
- **Fewer than two wallets** renders `EmptyState` instead of a form. Previously both ids degraded to `''` and submit sat permanently disabled with no explanation.
- **`maxWidthClassName="max-w-lg"`** on the modal; `Modal`'s `max-w-md` default is too tight for two panels side by side.

## Consequences

- The form gained a panel sub-component that is **deliberately local to its file**, not a shared primitive. The icon-badge + name + balance block exists in four other places (`WalletsView`, `WalletAccountsGrid`, `WalletPopupModal` ×2) which have **already diverged** on size and weight; per ADR `0006`, forcing convergence would be a visual regression rather than a cleanup. A fifth local variant is the correct outcome, not a TODO.
- The redesign is entirely off the critical path: `grep -l 'overdraws' dist/assets/*.js` resolves only to `TransferFundsModal-*.js`. The entry chunk moved **+0.01 kB**, which is the `roundToCents` import and nothing else.
- `roundToCents` now has two consumers, so a change to it is a change to the ledger *and* to what the user was shown before consenting. Keep them in lockstep.

## Revisit if

- A third consumer needs the wallet panel — at that point it earns extraction to `src/components/wallet/`, following `AddWalletForm`'s precedent, and the four divergent call sites should be surveyed properly rather than assumed convergent.
- The transfer path stops going through `addTransaction` — the preview's arithmetic is a deliberate mirror of it and would silently drift.
- A hard overdraft block is genuinely wanted. It needs a per-wallet-type rule (`CREDIT_CARD` must stay exempt), not a blanket `balance >= amount` gate.
