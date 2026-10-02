# 0040: A new account starts with empty wallets and no debt

**Status:** Accepted. The client change and the tests are on branch `phase-54-empty-starters`. The migration passed its probe and was applied to the live project on 2026-10-02 (version `20261002061331`).
- **Amends** ADR `0024` (F7): the starter wallets no longer need an exemption from opening-balance rows.
- **Amends** ADR `0021`: the unit fixture is now `unit/fixtures/guestLedger.ts`, not the provider's own defaults.
- **Amends** ADR `0039`: `seed_starter_account()` seeds its three wallets at 0.00.
- **Waives** the spec-edit policy for this phase only (see Decision).
- **Closes** audit 001 finding 6 (R-17, R-38, C-5).

**Date:** 2026-10-02

## Context

Audit 001 finding 6 (`anti-slop/audit-001-2026-09-27.md`): the app shows money nobody entered.
- **A guest** opened on three wallets holding ฿7,650 (Main Checking ฿2,500, Cash Wallet ฿150, Savings Reserve ฿5,000) and a Student Loan with ฿4,500 of ฿10,000 left (`DEFAULT_STARTER_WALLETS`, `DEFAULT_STARTER_DEBTS` in `FinanceContext.tsx`).
- **A new sign-up** got ฿10,650 in the real database from `seed_starter_account()` (Checking Account ฿2,500, Cash Wallet ฿150, Savings Reserve ฿8,000), with no ledger row behind any of it. It seeded no debt.

Net worth, the allocation bar, the debt plan and its warning all reported those figures as if they were the user's. R-17 (unsourced statistics), R-38 (fabricated realistic content) and C-5 (fabricated claims) stayed FAIL from audit 002 to audit 012, deferred each time to this phase.

**The owner's decisions (2026-10-02):**
- new guests, `resetToGuestState` and new sign-ups start with the same three wallets at ฿0.00 and no debt;
- tests that need sample money or a debt seed it themselves, through explicit fixtures;
- **new accounts only**;
- **the names stay as they are.**

## Decision

### The starters open at ฿0.00
- **Guest** (`FinanceContext.tsx`): the three `DEFAULT_STARTER_WALLETS` have `balance: 0`. Nothing else about them changes: ids, names, types, colours, icons and order. `DEFAULT_STARTER_DEBTS` is deleted; the `pf_debts` fallback and `resetToGuestState` both use `[]`.
- **Signed in** (`20261003_phase54_zero_starter_seed.sql`): `create or replace function public.seed_starter_account()`, the Phase 64 body with its three balances at `0.00`. The deployed body matched the Phase 64 file md5 for md5 (`06b826c0448ee752dbfbf9f7548813d8`, a read-only check on 2026-10-02), so the new body starts from the file. The grants are stated again.
  - **The filename sorts after `20261002_phase64_*`.** A name dated 2026-10-02 would sort first on a fresh replay, and Phase 64's ฿8,000 body would overwrite it.

The categories and keyword rules are unchanged, and so is everything else Phase 64 decided: once only, the advisory lock, no client fallback.

### New accounts only
Stored `pf_wallets` / `pf_debts` and live accounts already seeded keep their data. Nothing migrates them.
- **Real rows may already sit on those balances.** A user who recorded expenses against the old ฿2,500 has a balance that is the old seed plus their ledger. Zeroing it would rewrite their money with no row to explain the change, which is the same defect this phase removes.
- **A seeded account never reaches the inserts again** (Phase 64's once-only rule), so the new function body changes no existing row.
- **A guest's stored wallets are read before any default**, so a returning guest sees what they had.

### The names stay divergent, on purpose
The client keeps "Main Checking"; the server keeps "Checking Account". The owner chose to change only the balances. A rename would touch every spec and unit test that reads a wallet by name, and the server name would move only for new accounts, so existing accounts would still differ.

### The specs seed their own fixtures (spec-edit policy waived)
Until now a fresh context carried the sample money, and many specs asserted on it word for word ("฿7,650.00 across 3 wallets", "฿4,500.00", the transfer preview's projections). That data was the defect, so those specs had to change. **This ADR is the record that the spec-edit policy was waived for this phase**, and of how:
- **`tests/helpers.ts`** exports `SAMPLE_WALLETS` and `SAMPLE_STUDENT_LOAN`, the old values with the same ids, order and colours, and `seedLedger(page, { wallets?, debts? })`.
  - It registers a `page.addInitScript`, so it is called **before `page.goto`**.
  - It writes `pf_wallets` / `pf_debts` **once**, behind a `pf_seeded` marker. Without the marker, every `page.reload()` would re-seed over what the test saved; the reload checks in `soft-delete`, `wallets-page` and `debts-page` depend on it.
- **Each spec that read the old data adds one `seedLedger` call** in its `beforeEach`, before `goto`, and its assertions stay word for word: `soft-delete`, `transaction-edit`, `transfer-preview`, `wallets-page`, `debts-page`, `account-and-mobile-nav` (the "ledger fixes" block) and `smart-rules` (the locked-repay case needs a debt). In every one of these the `goto` sits in a `beforeEach`, so the seed covers the block; the tests in it that create their own wallet or debt do not read the sample rows.
- **`unit/fixtures/guestLedger.ts`** holds the same rows and `seedGuestLedger({ wallets?, debts? })`, which writes localStorage before the provider mounts. It sits inside `unit/` (ADR `0021`'s boundary), and `vitest.config.ts` collects `*.test.*` only, so it is not a test file.

### ADR 0024's F7 exemption stops mattering
F7 gave every user-created wallet with a non-zero opening an ADJUSTMENT "Opening balance" row, and exempted the starters by decision. A ฿0 opening writes no row, so the starters now follow the rule as written, and "a fresh context has no transactions" stays true with no exemption.

## Verification
- **E2E:** a new test in `wallets-page.spec.ts`, outside the seeded block: a fresh guest shows "฿0.00 across 3 wallets", each wallet ฿0.00, and the Debt payoff page shows "No debts tracked yet" with no debt card. Suite 134 -> 135 tests, 402 -> 405 runs.
- **Unit:** two new tests.
  - `ledger-guards`: an unseeded provider has the three wallets at 0 and `debts` is `[]`.
  - `authenticated-ledger`: after sign-out, the reset state has the three wallets at ฿0.00 and no debt.

  Both fail against the old `FinanceContext.tsx`. Unit 586 -> 588.
- **Negative control:** with `transfer-preview.spec.ts`'s `seedLedger` line removed, 6 of its 7 tests fail on chromium (the seventh reads only wallet ids). Restored, 7/7 pass.
- **SQL:** `supabase/tests/20261003_phase54.probe.sql` (`BEGIN ... ROLLBACK`) checks the grants after the re-create; a new account seeded with three wallets summing to 0, each at 0, under the same names, with no debt, no ledger row and nine categories; a second call answering `seeded: false`; and an account seeded before keeping its ฿2,500. **Not run yet.** After it, `20261002_phase64.probe.sql` is re-run, the rule for re-creating a deployed function.

## Consequences
- **Two copies of the starter set** remain, in `seed_starter_account()` and in `FinanceContext.tsx`'s guest defaults (ADR `0039`). Change both together.
- **The empty paths were already safe**, so nothing else in `src/` changed: `walletShares` skips balances of 0 or less and `AllocationBar` handles a total of 0; `Money` prints ฿0.00; `debtPlan([])` returns nothing, so the debt warning renders nothing; the Dashboard says "No active debts." and the Debt payoff page shows its empty state; a transfer from ฿0 warns but is allowed (ADR `0014`).
- **Order of release:** the client does not depend on the migration, so the two can ship in either order. It was applied on 2026-10-02 (`20261002061331`), so a new sign-up now starts at ฿0.00.
- **Existing accounts keep their old seed money.** That is the owner's decision; an account that wants it gone can adjust its balances, which writes ledger rows.
