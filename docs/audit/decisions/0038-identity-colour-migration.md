# 0038: Spec 5.1's identity colour migration, on the device and in the cloud

**Status:** Accepted.
- **Implements** spec 5.1 and spec 9's step 5 ("Migration สี"), finishing L9 for stored data.
- **Amends** ADR 0037, which deferred this migration and kept a "Current colour" swatch for the shipped categories in the meantime.

**Date:** 2026-10-02

## Context

Phase 62 gave the colour pickers spec section 1's twelve identity colours and applied L9 (no two categories share a colour) to every new write. The stored colours stayed where they were, by the owner's decision, until this phase. That left:
- every shipped category and every starter wallet on a money colour (red, green, blue, amber), which spec section 3 reserves for money meaning;
- each shipped category's edit form offering its old colour as "Current colour";
- **L9 already broken in stored data.** In the live project the owner's custom "camel" shared `#facc15` with Transport & Fuel, and "กิจนิมนต์" shared `#34d399` with Freelance & Side Gig, because the old seeds were copied when those were made.

**What the live project held** (read-only queries, 2026-10-02):
- **Two accounts.**
  - The owner's: 38 live category rows for 11 names, each shipped category 4 times from the pre-Phase-30 seeding race; and the wallets Cash `#ef4444`, Main `#16a34a` and Sub `#0284c7`.
  - A second: the untouched starter set, with no transactions.
- **Every category row was still on its shipped colour.** No live Expense or Income category was on an identity colour, so nothing would collide.
- **The duplicates:** `20260920_dedupe_categories.sql` is in the repo, yet these duplicates are still live, so that migration was evidently never applied to this project.

**The owner's decisions (2026-10-02):**
- **Scope:** any row, in any account, still on its shipped colour moves, plus spec 5.1's named rows. A colour someone picked stays.
- **Duplicates:** leave them, and recolour every copy, so a transaction filed under any copy shows the new colour. Cleaning them up stays open.
- **Collision (L9):** a target another category already holds becomes the first free identity colour, in palette order. If none is free, the old colour stays.
- **Antislop** runs afterwards, as audit 012 (mode 2).

## Decision

### One table, three places
A row moves only while it is **live** and still holds **the colour it shipped with**. The match is on the trimmed, case-insensitive name and the old colour, case-insensitive.

| Row | Old | New |
|---|---|---|
| Food & Dining | `#f87171` | `#E879A6` Rose |
| Groceries | `#fb923c` | `#F59E6B` Peach |
| Housing & Utilities | `#38bdf8` | `#7DA2F0` Periwinkle |
| Shopping & Apparel | `#a78bfa` | `#B69CF5` Lavender |
| Transport & Fuel | `#facc15` | `#5CC8B8` Aqua |
| Primary Salary | `#4ade80` | `#8FA8C8` Steel |
| Freelance & Side Gig | `#34d399` | `#D98FD0` Orchid |
| Debt Repayment, Balance Adjustment | `#f43f5e`, `#94a3b8` | `#6B7385` (System) |
| camel *(SQL only)* | `#facc15` | `#C7B38A` Khaki |
| กิจนิมนต์ *(SQL only)* | `#34d399` | `#9C8CD9` Iris |
| Main Checking / Checking Account | `#0284c7` | `#6C8EEF` Blue |
| Cash Wallet | `#16a34a` | `#D9A066` Tan |
| Savings Reserve | `#7c3aed` | `#4FB7A8` Teal |
| Cash / Main / Sub *(SQL only)* | `#ef4444` / `#16a34a` / `#0284c7` | Tan / Blue / Teal |

The rows marked *SQL only* are spec 5.1's rows from one account. They live in the migration, never in shipped code. They match by name and old colour in any account; when this was written, only the owner's account held them.

**The collision rule** (L9) runs groups in the table's order:
- every copy of a name gets the same colour;
- when another live Expense or Income category **of a different name** in the same account already holds the target, the group takes the first identity colour nobody holds, and keeps its old one if all twelve are taken;
- the System pair shares `#6B7385` by design. It is never counted as a collision, and a System category never takes a palette colour;
- wallets have no uniqueness rule.

### Where it runs
- **Seeds:**
  - `DEFAULT_SYSTEM_CATEGORIES` starts on the new colours, with the System pair on `SYSTEM_CATEGORY_COLOR`;
  - `DEFAULT_STARTER_WALLETS` and `seedInitialUserAccount`'s wallets start on Blue, Tan and Teal;
  - so a new guest or a new sign-up never sees an old colour.
- **On this device:** `utils/identityColorMigration.ts` (`migrateCategoryColors`, `migrateWalletColors`) runs where `pf_categories` and `pf_wallets` are read at start-up, beside `withDefaultDescriptions`.
  - Like that function, its result is written back on the next write, because the batched writer skips the first render.
  - It is pure and idempotent, so running it on every load is harmless.
- **In the cloud:** `supabase/migrations/20261002_phase63_identity_colors.sql` is one DO block, data only, idempotent.
  - It walks each account in the table's order with the same collision rule.
  - It stamps `updated_at` on the wallets it moves, as `updateWallet` does.
- **Not on the Supabase load.** A display-only remap there would make the screen right while the stored colour never changed, and it would hide whether the SQL had run. The cloud's rows move once, by SQL.

### Applying it
- **The order:** the migration goes to the live project **after** the merge and the deploy, on the owner's word, so no client that still seeds the old colours ships after it.
- **Older clients:** a cached older client can still seed a new account on the old colours. The migration is idempotent and can simply be run again.
- **Before applying:** the probe, `supabase/tests/20261002_phase63.probe.sql`, built three accounts inside `BEGIN ... ROLLBACK` against the live schema, ran the migration twice and printed `PHASE 63 PROBE OK`. Its accounts cover:
  - an owner-like account with duplicates, the named rows, and a custom category already on Rose;
  - a starter account with one colour picked by hand;
  - an account with all twelve colours taken.

### Copy
- **One spelling:** the UI says "Color", as the Categories form already did. "Theme Color" in Add wallet and the "Colour" legend in the wallet edit form become "Color".
- **Named swatches:** a wallet swatch is named by its colour ("Tan", from `identityColorName`) instead of "Colour #D9A066".
- **"Current color":** the swatch stays, for a custom category still on a colour picked before Phase 62.
- **The rules table:** a System category's chip uses `SYSTEM_CATEGORY_COLOR`, as `TransactionRow` does.

## Spec edits
None. `categories-page.spec.ts` still finds Tan free and then Blue, because the shipped categories take Rose, Peach, Periwinkle, Lavender, Aqua, Steel and Orchid.

## Consequences
- **The shipped categories now sit on identity colours,** each a different one. ADR 0037's "Current colour" swatch for them, and `DESIGN.md`'s deviation row for it, are gone.
- **Two copies of the migration rules,** in TypeScript and SQL, must change together. The unit tests and the probe pin the same cases.
- **Still open:**
  - The live duplicate category rows (27 in the owner's account), and `20260920_dedupe_categories.sql` never having been applied there. Cleaning them up is its own decision.
  - Wallets have no uniqueness rule, so two wallets can still share a colour.
