# 0033 — Editing a transaction: one locked RPC that reverses the old effect and applies the new one

**Status:** Accepted.
- **Implements** spec 6.2's edit panel, which Phase 58a (ADR `0031`) deferred.
- **Adds** a fifth ADR `0023` ledger RPC, `update_transaction`.
- **Closes** audit 005 finding 4 (the Dashboard's Recent activity rows did nothing on a click), and audit 006 findings 1, 2 and 5 (see "Smaller changes").

**Date:** 2026-09-30

## Context

Until this phase nothing in the app could edit a transaction. A wrong amount, a wrong wallet or a wrong type meant deleting the row and entering it again. Spec 6.2 asks for an edit panel in the selected row's drawer:
- a type control;
- a 24px amount coloured by type;
- the note, and Category beside Wallet (or From and To for a transfer);
- the date;
- "Save changes" beside "Delete".

An edit is a ledger write. It has to reverse the row's old effect and apply the new one, and for a signed-in user it has to do both atomically, relative to what the server holds, under ADRs `0016`, `0022`, `0023` and `0024`.

The owner's decisions:
- **From the Phase 58a plan (2026-09-28):**
  - income, expense and transfer change type among themselves, and edit amount, wallet or From/To, category, note and date;
  - a debt repayment or an adjustment edits only its note and date;
  - a new `EditTransactionPanel`, so `TransactionForm` and ADR `0013` stay as they are;
  - no fallback when the function is missing.
- **2026-09-30:**
  - an edit made against an older version of the row is refused and the page re-reads;
  - a Playwright spec with three guest tests;
  - Dashboard Recent-activity rows open their row on the Transactions page;
  - antislop mode 2 (audit 007).

## Decision

### `update_transaction` (`20260930_phase58b_update_transaction.sql`, applied 2026-09-30)
It takes the **full desired row**, not a patch, runs as `security definer` with the user from `auth.uid()` only, and does this in one database transaction:
1. **Lock the row** (owner-filtered). A deleted row is refused: "Restore this transaction before editing it".
2. **Type rules.**
   - A repayment or an adjustment must send back its type, amount, wallets and category unchanged, and its `raw_input` is kept whatever is sent.
   - Every other row may only become income, an expense or a transfer.
3. **Replay:** a request equal to the row returns `changed: false` and moves nothing. This runs **before** step 4, or a retry after a lost response would be refused as stale by its own first attempt.
4. **Stale guard:** `p_expected_updated_at` names the version the client edited. If the row has changed since, it raises `TRANSACTION_CHANGED`.
5. **Validate**, for the three types whose money can change:
   - amount above zero;
   - a transfer has two different wallets and no category (as `transfer_funds` writes it);
   - no other type has a destination.

   For every row: a note of 1 to 255 characters, a date, and the category owned or a system one.
6. **Lock every wallet on either side**, in id order: the transaction, then its wallets by id, as everywhere in the ledger.
   - A wallet the row already uses may have been deleted, because its reversal still has to land, as `set_transaction_deleted` allows.
   - A newly chosen wallet must be live and the caller's.
7. **`_ledger_apply_effect(old, −1)` then `(new, +1)`**, only when the money changed. The debt leg is always null: a repayment's money cannot change, so an edit never locks or moves a debt.
8. **Write the row** and return it with `balances` for every wallet it locked.

There is no overdraft check (ADR `0014`).

**Verified** with `supabase/tests/20260930_phase58b.probe.sql` inside `BEGIN … ROLLBACK`:
- **the first run caught a real bug**: the amount check also ran on adjustments, whose amount is signed, so a note-only edit of a downward adjustment was refused. The money checks now run only for the three editable types, and probe step 10 pins the case;
- the probed body's md5 matched the file (`fd45c13d…`);
- three negative controls, each a one-line mutation of the function in the same transaction, failed as designed:
  - with no reversal of the old effect, Cash read ฿4,850 instead of ฿4,950;
  - with replay moved after the stale guard, a retry got `TRANSACTION_CHANGED`;
  - with the deleted-wallet check removed, a deleted wallet was accepted;
- after applying, the deployed md5 matched, and the 58b, 58s and 52 probes all passed.

### The client: `updateTransaction(id, edit)`
- **Validation, before any optimistic write:** `editRuleError` mirrors the function's rules in its own words, then `TransactionSchema` checks the merged row. An edit that changes nothing returns success and writes nothing.
- **Arithmetic:** `walletEffects(tx)` maps each wallet to its signed movement, term for term `_ledger_apply_effect` with sign +1. An edit's movement is the new row's effects minus the old row's, computed from the refs **before any `setState`** (ADR `0022`).
- **Guest:** the optimistic write is the write.
- **Signed in:** one `update_transaction` call carrying `p_expected_updated_at`, read before the optimistic write replaced it. The mapped row and every returned balance replace the optimistic ones.
- **Failures:**
  - **a missing function rolls back and says "Editing needs the latest database update."** There is no legacy fallback: an edit written as absolute balances could not be made atomic, which is the whole of ADR `0023`;
  - `TRANSACTION_CHANGED` rolls back, re-reads, and says the row changed on another device;
  - an error with no SQLSTATE (ADR `0023`'s unknown outcome), or a success with no row, rolls back and re-reads;
  - a realtime reload landing mid-flight re-reads instead of restoring a stale snapshot (T69).

### The panel: `EditTransactionPanel`
- **Placement:** it is the selected row's drawer body for a live row. A deleted row keeps the read-only details and Restore ("Restore it to edit it").
- **The amount field** is a plain input that also takes a formula through `safeEvaluateMath`, the add form's evaluator. That lets it be 24px and coloured by type as the spec asks; `InlineMathInput`'s fixed styling could not. A formula becomes `rawInput`, a plain number clears it, and an untouched amount keeps the row's.
- **Type changes:** switching to a transfer clears the category and picks a second wallet. A From or To select with no choice shows "Choose a wallet" rather than a wallet the draft does not hold.
- **Repayment and adjustment:** the money is shown as text, with a line saying only the note and date can change.
- **Save changes** is disabled until something changes. It says why when the edit is incomplete ("Enter an amount greater than zero"), shows a failure in the alert banner, and reports "Changes saved".
- **Baseline:** a newer version of the row, from a save or a cloud reload, becomes the panel's baseline.
- Field ids are `tx-edit-*`; Save is `tx-save-btn-{id}`. None starts with `tx-row-`.

### Why not `TransactionForm`
ADR `0013` removed TRANSFER from `TransactionForm`'s type toggle and made the note drive the form. An edit needs TRANSFER, must not re-parse an existing note into its amount, and must not offer the smart-rule chip or templates. **ADR `0013` governs `TransactionForm` only**; this panel is a separate surface with its own rules.

## Smaller changes that came with it
- **The panel is inline from `lg`** (1024px), not `xl` (audit 006 finding 2). The list keeps about 620px there.
- **The header says "Click any row to edit it"**, the spec's text (audit 006 finding 5).
- **The CSV import's three sparkle icons are gone** (audit 006 finding 1). "Classify remaining with Jev" takes `Tags`, and the confidence badges carry only their percentage.
- **Dashboard Recent activity rows are buttons** (audit 005 finding 4). A click opens the row on the Transactions page with its panel, through an App-level hand-off shaped exactly like the wallet filter's (`initialSelectedTxId`, consumed on mount). Their ids are `dashboard-tx-{id}`: specs match `tx-row-` page-wide.

## Tests
- **`authenticated-ledger`:** an `update_transaction` stand-in and 10 tests. Five mutations were caught; one proposed control (reading the ref after the optimistic write) was not a real failure mode, because nothing awaits between the two, and was replaced by the real one (sending the optimistic timestamp).
- **`ledger-guards`** (guest): 9 tests, including transfer to income, a From/To swap, and a downward adjustment's note. Two mutations were caught.
- **`transactions-page`:** 8 new tests. Four mutations were caught once the transfer test checked that Save is enabled rather than the select's displayed value.
- **`tests/transaction-edit.spec.ts`:** 3 guest tests, intercepting nothing. A control that dropped the wallet write failed two of them. The suite is 122 tests, 366 runs.

## Consequences
- Every transaction a user can see can now be corrected in place. A repayment's or an adjustment's money still cannot: correcting one is a delete and a new entry, which keeps ADR `0016`'s debt arithmetic in one place.
- An edit's history is not kept: the row holds its latest values and `updated_at`. An audit trail would be a table of its own.
- **The live database has the function**, so no signed-in user sees the missing-function message. A self-hosted copy without the migration would.
