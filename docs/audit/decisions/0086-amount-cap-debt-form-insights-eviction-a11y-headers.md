# 0086: One amount cap, checked in the field; refused saves clear on edit; the Add Debt form starts empty; sign-out clears cached insights; one h1 per page; a Permissions-Policy

**Status:** Accepted. Released: code `128f2bb`, docs `b0eeb5f`, hash backfill `d85805a`, merged into `main` as `ecf9a31` (PR #61); Vercel `dpl_7VSiyAZmpdMsWoGFKpqsypCitVkF` READY in `icn1`, sending the `Permissions-Policy`. No migration.
- **Amends** ADR `0081` (the amount field): it refuses an amount over the cap.
- **Amends** ADR `0024` (F5, sign-out clears the device): the insights cache goes too.
- **Amends** ADR `0035` (Debt payoff page): the Add Debt form has no default figures.
- **Amends** ADR `0068` (response headers): a `Permissions-Policy`.
- **Amends** ADR `0043` (Modal): every dialog is named by its heading, checked by a source scan.

**Date:** 2026-10-07

## Context

The owner's live audit, findings 9, 10, 12, 13, 16 and 20.

1. **Finding 9.** Every write schema caps an amount at ฿999,999,999.99 ("Amount too large"), but the amount field (`evaluateAmountInput`) checked only that an amount was above zero. So the field showed any figure as valid, the save refused it, and a figure past a double's cent precision was offered as a different number: `99999999999999999` evaluated to `100000000000000080`. The database's `numeric(15,2)` holds more than the cap, so the cap is the app's own. `DebtSchema` (Add Debt) had no upper bound at all.
2. **Finding 10.** A refused save's message (`useSubmitHandler`'s `error`) stayed on screen while the person corrected the amount, in the entry form, the transfer form and the edit panel.
3. **Finding 12.** The Add Debt form opened on ฿5,000 total, 4.5% APR, a ฿200 minimum and a due date of 2026-12-31, so a name and Save added a debt nobody owed. The fixed date ages into an overdue debt.
4. **Finding 13.** `insightsClient` caches each month's verdict under `pf_insights::<user id>::<month>`. A verdict names the account's categories, and sign-out (`resetToGuestState`) removed `LEDGER_STORAGE_KEYS` only, so the next person on the device found them.
5. **Finding 16.** The navbar's brand ("FinLife Tracker") was an `h1`, so every page had two: the brand and the view's `PageHeader`.
6. **Finding 20.** The responses carried no `Permissions-Policy`.

## Decision

1. **`MAX_AMOUNT` (999,999,999.99) and `MAX_AMOUNT_ERROR` ("Amount can't be over ฿999,999,999.99") live in `utils/money.ts`.**
   - Every schema uses them: `TransactionSchema`, `DebtSchema` (new), `DebtEditSchema`, `PresetSchema`, and the backup file's `money`. `WalletSchema`'s opening balance keeps its own wording.
   - **`evaluateAmountInput` refuses an amount over the cap, after rounding to cents,** so the field never offers what the save would refuse. `999999999.994` rounds to `.99` and passes; `999999999.995` rounds to ฿1,000,000,000.00 and is refused.
   - The edit panel's own check refuses it too, so its Save stays off.
2. **A refused save's message clears when the amount changes:**
   - `TransactionForm` clears it in `handleAmountEvaluated`, which typing, a chip and a seed from the note all reach. Editing the note alone leaves it.
   - `WalletTransferForm` clears it on the field's report and on Transfer all.
   - `EditTransactionPanel` clears it on any draft edit, since its message describes the draft that was sent.
3. **The Add Debt form starts empty, with an example in each placeholder** (e.g. 120000, 80000, 4.5, 3000).
   - The due date starts empty too.
   - A blank total is 0, which `DebtSchema` refuses (the field is `required` as well).
   - A blank Remaining still owes the whole total, and a blank rate, minimum or date is absent.
   - Every field resets after a save.
4. **`resetToGuestState` removes every `pf_insights::` key** after the ledger keys, collecting them before removing any. `pf_insights_collapsed` (the card's fold) and the theme are device preferences and stay. The prefix lives in `FinanceContext.tsx`, and the unit test checks it against the cache's own reader, so the two cannot drift silently.
5. **The brand is a `<p>`.** Each view's `PageHeader` is the page's one `h1`. `tests/theme.spec.ts` now checks the brand as text in the banner, and exactly one `h1`.
6. **Dialogs:** all 14 `<Modal>` uses already passed a `title` or a `titleId`, so each dialog is named by its heading through `aria-labelledby`. **`unit/dialog-names.test.tsx` pins it:**
   - the primitive links its heading for a `title` and for a custom `header`'s `titleId`;
   - a scan of `src/` with the TypeScript parser fails on any `<Modal>` given neither.
7. **`Permissions-Policy: camera=(), geolocation=(), microphone=(self)`** in `vercel.json`. The microphone stays for the note's dictation (ADR `0018`); nothing uses the camera or location.

## Not changed

- **The database's `numeric(15,2)` columns.** The cap is enforced in the client, where every write is validated; a server-side check would need a migration.
- **The insights card's fold preference and the theme** survive sign-out, as device settings.

## Tests

- **`unit/inline-math-seed.test.tsx` (+6):** `evaluateAmountInput` at the cap:
  - `.99` and `.994` pass;
  - `.995`, `1000000000`, `999999999+1` and `99999999999999999` are refused with the cap's message.
- **`unit/stale-errors.test.tsx` (new, 2):**
  - the entry form keeps a refused save's message through a note edit and drops it on an amount edit;
  - the transfer form drops a refused transfer's message on an amount edit.
- **`unit/debts-page.test.tsx` (+3):**
  - the Add Debt form opens with all five figures empty and examples in the placeholders;
  - a name alone adds nothing;
  - a total alone owes all of it, interest-free, with no due date.
- **`unit/ledger-guards.test.tsx` (+1):** sign-out removes three cached months across two accounts, and keeps the fold and the theme.
- **`unit/security-headers.test.ts` (+1):** the `Permissions-Policy`.
- **`unit/dialog-names.test.tsx` (new, 3):** see decision 6.
  - These pass on today's code by design.
  - **Negative control:** with `EditDebtModal`'s title removed, the scan failed and named `components/debt/EditDebtModal.tsx:153`.
- **Specs updated:**
  - `debts.spec.ts`, `soft-delete.spec.ts` and `debts-page.spec.ts` fill the total (and, in `debts.spec`, the rate and minimum) that the form used to supply.
  - `debt-repayment.spec.ts`'s `createDebt` fills ฿5,000 and ฿200 as its own defaults.
  - `theme.spec.ts` checks the brand and the single `h1`.
  - Every asserted figure is unchanged.
- **Red first:** the 11 tests of changed behaviour failed on the unfixed code. The two amounts at or under the cap and the three dialog tests pass on today's code by design.
