# 0013 — The note is the entry field; TRANSFER leaves the transaction form

**Status:** Accepted
**Date:** 2026-09-23

## Context

`TransactionForm` was shaped before the categorization layers existed. It asked for an amount first, a description second, offered four transaction types in its toggle, and — once anything auto-categorized — *removed* the wallet and category selects from the DOM behind an "Edit details" toggle.

Three things had drifted out of line with how the form is actually used:

1. **The description is what drives the entry, but it was the second field.** Both categorization layers (ADR `0011`, `0012`) read it, and both were reliable enough by Phase 40 that `Netflix subscription` and `ข้าวมันไก่` resolve correctly. Meanwhile the number the user had *already typed inside that note* was discarded: `smartMatcher.ts:32-40` computes an `extractedAmount`, and `TransactionForm.tsx:203-218` never read it. A user typing `ข้าวมันไก่ 60` had to retype `60`.

2. **TRANSFER in the toggle was a second, untested transfer implementation.** `ui-ux-audit-report.md:24` flagged it as duplicating `WalletTransferForm`, which ADR `0008` had already made the wallet-first transfer surface. A grep across all 15 spec files finds **no** reference to `-type-transfer`, `-dest-wallet`, or the `Transfer` toggle label: the branch shipped, was documented as deliberate in ADR `0007`, and was never exercised by anything.

3. **The collapse hid the control that fixes a wrong guess.** An auto-categorization set `autoMatchedCategory`, which flipped `isCollapsed`, which unmounted the category `<select>` entirely. Overriding the model's answer therefore cost two clicks and was invisible until the first one. `tests/jev-classify.spec.ts` had to carry a `revealDetails` helper purely to click that toggle open before it could assert what the classifier had written — the spec was documenting the friction.

## Options considered

**(a) One merged field holding both amount and note.** Rejected on a concrete count. `input[name="amount_expression"]` and `input[id$="-desc"]` would have to resolve to the same element, producing Playwright strict-mode violations across `transaction`, `presets`, `jev-classify` and `categories`, plus `helpers.ts` — which `transaction`, `soft-delete`, `csv` and `storage-persistence` all import. That is 11 of 15 spec files, and none of those breakages is a locator move: they are assertions about two independently editable values. It is also worse UX. A pre-filled amount you can see and correct beats a number buried mid-sentence, and the inline math field (`120/4 + 15*2`, the operator chips, the `Calculated:` badge) has no sensible home inside a free-text note.

**(b) Parse the note into a separate, visible amount field.** Chosen.

**(c) Keep TRANSFER in the toggle and just reorder the fields.** Rejected. Leaving a type in the toggle whose dedicated flow is one line below it, in the shortcut row, is the dead-end the shortcut row exists to remove. ADR `0007` argued the two transfer paths served different intents ("logging activity that happens to be a transfer" vs. "I clicked Transfer on this wallet"); two years of zero test coverage and zero call sites is the evidence against that distinction being real.

## Decision

**The note field moves to the top and becomes the entry point for the whole form.** A new pure util `src/utils/parseExpressInput` pulls an amount — or an inline math expression — out of the note and seeds the amount field below it.

**Anchoring rules, in order:** the whole note is an expression (`60`, `120/4`); a **trailing** run (`ข้าวมันไก่ 60`, `bts 45`, `ค่าไฟ 1200`); a **leading** run (`1200 ค่าไฟ`, the shape `smartMatcher` already recognized). An optional `฿`/`บาท`/`thb`/`baht` marker is tolerated, thousands commas are stripped, and the candidate must evaluate through `safeEvaluateMath` to a value in `(0, 1e9)`.

**The whitespace boundary before a trailing run is load-bearing.** It is what stops `7-11`, `Tx-123` and `iphone15` from being harvested. The known false positive is `lunch for 4` → ฿4; it is visible in the amount field and one keystroke to fix.

### Three rules that are not cosmetic

**A manual edit to the amount field permanently disables extraction for that entry.** `InlineMathInput` gained an `onUserEdit` callback — fired by typing, the quick-amount chips, the operator buttons and the apply-result button, and never by a programmatic `seed` push — which sets `userTouchedRef.current.amount`. Beyond being the right precedence, this is what keeps the suite green: `csv.spec.ts:19`, `soft-delete.spec.ts:21,96` and every `presets.spec.ts` case seed a note ending in six digits (`E2E CSV RoundTrip 123456`) *after* filling the amount by hand, and they assert on amounts and wallet balances. Without the latch each of those fails on a **value**, which the spec-edit policy forbids fixing by editing the assertion. Anything that weakens this rule breaks three spec files at once.

**The ledger stores the note exactly as typed; only the classifier sees the stripped text.** `ข้าวมันไก่ 60` is saved whole and classified as `ข้าวมันไก่`. Stripping at the write path would be lossy, and a mis-parse would then corrupt the note as well as the amount — `lunch for 4` would persist as `lunch for`.

**`InlineMathInput` is re-seeded through a `seed: {key, value}` prop, not a remounting `key`.** The old mechanism (`TransactionForm.tsx:90-95`) existed because `defaultValue` is only honoured while the field is empty, and it was adequate when only a template re-seeded. Express parsing re-seeds on nearly every keystroke, where remounting would discard focus state and error state on each one.

### TRANSFER

**Removed from `TransactionForm` entirely** — the toggle option, the `destinationWalletId` state and its validity effect, the "To Wallet" select, and the field on the submit payload. This amends ADR `0007`: the form's three consumers stand, but `TransferFundsModal` is now the single transfer surface in the app, closing `ui-ux-audit-report.md:24`.

**`DEBT_REPAYMENT` is deliberately treated differently and stays.** Only its *toggle option* goes. `DebtsView.tsx:296-307` is a live caller passing `presetType="DEBT_REPAYMENT" lockType presetDebtId`, `debts.spec.ts` exercises the whole repay flow through it, and `implementation-roadmap.md:56` commits to preserving `#repay-amount-math`, `#repay-wallet-select` and `#confirm-repay-btn`. The asymmetry is the point: TRANSFER had no caller and no coverage, DEBT_REPAYMENT has both.

**The shortcut row is what makes the removal safe.** Below the submit button, `Need to Transfer Funds or Repay Debt?` links to `TransferFundsModal` and the Debts tab. Each link renders only when its caller supplies a handler (`onRequestTransfer` / `onRequestRepayDebt`), so a form that cannot reach a destination shows no link to it — `DebtsView`'s locked repay form shows neither. These are the first callbacks in the app that let a modal hand off to another surface; they follow `App.tsx:171`'s `handleOpenWalletTransactions` shape: close what you came from, then open the destination.

### The collapse

**Deleted.** The wallet and category selects are always mounted. The `Auto-categorized: <name>` badge moves from the description label to the **Category** label — the field it actually wrote — so the guess and the control that overrides it are adjacent. The badge text is unchanged, which is what lets `jev-classify.spec.ts` keep all four of its `getByText(/Auto-categorized:/i)` assertions while dropping only the `revealDetails` click.

## Consequences

- One omni field replaces two-field entry for the common case; the amount field stays fully editable and keeps inline math, and its quick-amount chips (`+100`/`+500`/`+1,000`) are now visible at every breakpoint instead of `sm:hidden`.
- **The transaction form can no longer create a TRANSFER.** Any future need for one goes through `TransferFundsModal`; do not re-add the type to the toggle without reopening this ADR.
- `matchSmartDescription` is **unchanged**. The new parser is a separate util deliberately: `KeywordRulesView` surfaces the matcher's own `extractedAmount`/`cleanDescription` through the `metric-*` testids and `tests/keywords.spec.ts` asserts on exactly that leading-only behaviour.
- `handleQuickAdd` and `handleApplyResult` in `InlineMathInput` now re-evaluate. They previously mutated the field without notifying the parent, leaving `amount`/`isAmountValid` stale and the submit button disabled until the next keystroke. Because they now evaluate, a trailing operator (`60+`) would have raised an error message the instant an operator chip was tapped, so `evaluateAndNotify` treats a trailing operator or open paren as an expected intermediate: reported to the parent as not-yet-valid, but silent on screen.
- No new dependency; `manualChunks` untouched. Everything lands in the lazy `TransactionForm` chunk, so ADR `0010`'s deferral of `vendor-math` is preserved.

## Revisit if

- The `lunch for 4` class of false positive is reported in practice — the fix is a stricter trailing anchor (require a currency marker, or a minimum note length before the number), not abandoning extraction.
- A genuine caller for `presetType="TRANSFER"` appears. It would need the destination-wallet field back; prefer routing it to `TransferFundsModal` first.
- `commitBulkImport` grows note parsing. It currently writes descriptions straight through and never sees this path.
