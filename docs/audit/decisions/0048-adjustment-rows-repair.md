# 0048: The three pre-0024 ADJUSTMENT rows are repaired by intent, not by ADR 0024's script

**Status:** Accepted and applied to the live project on 2026-10-03 (14:01:03 UTC), on the owner's word. **Amends** ADR `0024`'s "The 3 production rows are reported, not repaired": they are now repaired, and one of the three is soft-deleted instead of flipped.

**Date:** 2026-10-03

## Context

- **The rows.** Before ADR `0024`, `WalletPopupModal`'s balance editor wrote `Math.abs(diff)` as an ADJUSTMENT, and every ledger path treats ADJUSTMENT as `balance + amount`, so lowering a balance raised it. ADR `0024` fixed the editor and left three production rows to the owner, with a repair query: flip each row negative and take `2 x amount` off its wallet.
- **ADR `0024`'s own warning:** that repair "is correct only if nobody re-corrected those wallets by hand after seeing the wrong balance, and the database cannot know that."
- **What the live project holds** (read-only queries on 2026-10-03, ADR `0024`'s step-1 predicate):

  | Row | Wallet | Description | Amount | Written (UTC) |
  |---|---|---|---|---|
  | `2fd1fc6b-29b1-416d-8602-8231dfea93d8` | "main" `ef7d8b6a-...` | Manual balance adjustment (-$460.00) | +460.00 | 2026-09-01 09:37:14 |
  | `d6ffc280-9f57-4035-9e65-9bab3e16aa21` | "main" `ef7d8b6a-...` | Manual balance adjustment (-$920.00) | +920.00 | 2026-09-01 09:37:37 |
  | `605a07b3-2907-4cad-94e5-1501bed00bc7` | "Sub" `058d890e-...` | Manual balance adjustment (-$0.03) | +0.03 | 2026-09-01 09:38:32 |

  - All three are the owner's, live, and on wallets the owner has since soft-deleted. Net worth leaves a deleted wallet out (`isActiveWallet`), and ADJUSTMENT is never spending or income (L1), so no figure on screen depended on them. Only the rows' sign in the Transactions list was wrong.
  - There is no `balance_after` column; a wallet's history is its ledger rows.
  - `transactions` has no CHECK on `amount` and neither table has a trigger, so the repair's own wallet updates are the only balance changes. One negative ADJUSTMENT written by the fixed editor already existed.

## The timeline that decides it

"main"'s live rows reproduce its stored ฿5,011.77 exactly: opening ฿2,471.77, an expense of ฿340.00, three incomes of ฿500.00, then the two rows.

1. The balance was ฿3,631.77. The owner set ฿3,171.77, a change of −460. The editor credited +460: ฿4,091.77.
2. 23 seconds later the owner saw ฿4,091.77 and set ฿3,171.77 again, a change of −920 (exactly `2 x 460`). Credited again: ฿5,011.77.
3. 8 seconds later the owner deleted the wallet (`updated_at` 09:37:45) and made a new "Main" (09:38:10).

**Both rows aimed at the same balance, ฿3,171.77.** The second is the hand re-correction ADR `0024` warned about. ADR `0024`'s script flips both and lands on ฿2,251.77, ฿920.00 below what the owner set. Once the first row is right, the second has nothing left to correct, and a zero ADJUSTMENT is rejected, so it is soft-deleted.

"Sub"'s row is a single entry, after which the wallet was deleted 4 seconds later; flipping it is the intent.

## Decision

- **Flip** `2fd1fc6b-...` and `605a07b3-...` to −460.00 and −0.03.
- **Soft-delete** `d6ffc280-...` (`is_deleted = true`, amount untouched). Never a hard delete (`CLAUDE.md`).
- **Move the wallets with the ledger:** "main" −1,840.00 (the flip takes `2 x 460`, the delete takes the 920 credit) to ฿3,171.77; "Sub" −0.06 to ฿4,728.93.
- **One transaction, guarded:** every statement matches on the values read (`balance = 5011.77`, `balance = 4728.99`, `amount > 0`, `amount = 920`, `is_deleted = false`), so a wallet or row that moved since would change nothing. The block checks the row counts and "main"'s ledger and raises, rolling back, on any mismatch.
- **The description text is kept.** It says "-$460.00" and is now true. The "$" is the old editor's; the app formats every amount itself.
- **Rejected:** ADR `0024`'s script as written (over-corrects "main" by ฿920.00); leaving the rows (the owner chose to repair).

## Execution

```sql
begin;
-- inside one DO block, each count read with GET DIAGNOSTICS:
update public.wallets set balance = round(balance - 1840, 2), updated_at = now()
 where id = 'ef7d8b6a-31d9-4d1d-aea3-0581c92d6b8e' and balance = 5011.77;   -- 1
update public.wallets set balance = round(balance - 0.06, 2), updated_at = now()
 where id = '058d890e-b0ba-4db3-b6c9-17c6e1d64a30' and balance = 4728.99;   -- 1
update public.transactions set amount = -amount, updated_at = now()
 where id in ('2fd1fc6b-29b1-416d-8602-8231dfea93d8','605a07b3-2907-4cad-94e5-1501bed00bc7')
   and type = 'ADJUSTMENT' and amount > 0 and is_deleted = false;           -- 2
update public.transactions set is_deleted = true, updated_at = now()
 where id = 'd6ffc280-9f57-4035-9e65-9bab3e16aa21'
   and type = 'ADJUSTMENT' and amount = 920 and is_deleted = false;         -- 1
-- then: counts 1, 1, 2, 1, "main"'s live-row sum = its balance = 3171.77,
-- "Sub" = 4728.93, or raise (rolls back)
commit;
```

1. **Dry run**, the same block ending in an unconditional `raise exception` inside `BEGIN ... ROLLBACK`: counts 1, 1, 2, 1; "main" ledger ฿3,171.77, stored ฿3,171.77; "Sub" stored ฿4,728.93; asserts PASS.
2. **Applied** with the assertions as a guard and `COMMIT`: no error.
3. **Read back:**

   | Row / wallet | Before | After |
   |---|---|---|
   | `2fd1fc6b-...` | +460.00, live | −460.00, live |
   | `d6ffc280-...` | +920.00, live | +920.00, `is_deleted` |
   | `605a07b3-...` | +0.03, live | −0.03, live |
   | "main" `ef7d8b6a-...` (deleted) | ฿5,011.77 | ฿3,171.77 |
   | "Sub" `058d890e-...` (deleted) | ฿4,728.99 | ฿4,728.93 |

   - ADR `0024`'s step-1 predicate now finds 0 rows; the project holds 3 negative ADJUSTMENT rows.
   - The live wallets are untouched: Cash ฿19,400.00, Main ฿2,124.55, Sub ฿5,615.74.

## Consequences

- **"main"'s ledger explains its balance:** its live rows sum to ฿3,171.77, the stored balance.
- **"Sub"'s does not, and did not before.** Its live rows sum to ฿6,972.72 against a stored ฿4,728.93, a gap of ฿2,243.79 that predates this repair and is unchanged by it (before: ฿6,972.78 against ฿4,728.99). The gap is within 3 satang of its own "Manual balance adjustment (+$2243.82)" from 2026-08-31, written by the same old editor while the legacy absolute-write paths were in use. It is not repaired here: the wallet is deleted, no figure reads it, and what that row was meant to do is not recoverable from the data.
- **No code, migration or test changes.** The client already renders a negative ADJUSTMENT through `txTypeMetaFor` and `Math.abs`.
