# 0039: The server seeds a new account, once; duplicate categories are soft-deleted

**Status:** Accepted and released. The probe passed; the seed function is applied (`20261002041331`); the client is deployed (`b65b437`); the dedupe ran on 2026-10-02 in the SQL editor, which removed the 27 copies instead of soft-deleting them (see Consequences).
- **Amends** Phase 30's `isSeedingRef` guard: it no longer guards inserts, only one tab's calls.
- **Follows** `20260920_dedupe_categories.sql`, which cleaned up the duplicates that existed on 2026-09-19.

**Date:** 2026-10-02

## Context

`loadSupabaseData` seeded the starter wallets and categories from the client whenever its wallet read came back empty (`mappedWallets.length === 0`). That read includes deleted wallets, so on paper it fired only for an account with no wallet row at all.

**It fired on accounts that were far from empty.** The owner's account has had live wallets since 2026-09-01, yet it was seeded five more times:
- 2026-09-19 02:41 and 04:38 UTC. Their categories were removed by the 2026-09-19 22:47 dedupe; their wallets remain, deleted.
- 2026-09-20 12:05, and 2026-09-22 09:57 and 10:56 UTC. These made today's duplicates: 38 live category rows for 11 names, with 17 transactions spread across the copies.

**The likely cause** is in the row-level-security policies:
- both tables grant access to `authenticated` only;
- a request that arrives without a valid session runs as `anon`, matches no policy, and gets **zero rows and no error**;
- the client could not tell that from a new account;
- the inserts that followed succeeded, so a session was valid moments later, which fits a first load that ran before the session was restored.

Nothing in the database records the role of past requests, so this is a strong inference, not a proof. The fix does not depend on it: whatever made the read empty, an empty read is no longer enough to seed.

**The owner's decisions (2026-10-02):**
- a server-side seed function, with no client fallback;
- duplicate categories soft-deleted, with their transactions and rules re-pointed to the earliest copy;
- the 24 deleted wallets left as they are (no hard deletes);
- no antislop audit (no UI change).

## Decision

### `seed_starter_account()` (`20261002_phase64_seed_starter_account.sql`)
A `security definer` function, `search_path = public, pg_temp`, executable by `authenticated` and `service_role` only:
- **No session, no seed.** `auth.uid()` null raises `28000` ("Sign in required"), so an anonymous call fails loudly instead of looking empty.
- **Once only.** It seeds only an account that has never had a wallet or a category row, **deleted rows included**. A seeded account is never seeded again, whatever it deletes. No marker column is needed, because the app never hard-deletes either kind of row.
- **One at a time.** A per-account, transaction-scoped advisory lock serialises concurrent calls, and the second finds the first one's rows.
- **All or nothing.** The three wallets and nine categories land in one transaction, on spec 5.1's identity colours (ADR 0038). `description` stays NULL (ADR 0012).
- **It returns** `{"seeded": true | false}`.

### The client (`FinanceContext.tsx`)
`seedInitialUserAccount` calls the function and returns one of four outcomes:

| Outcome | What the load does |
|---|---|
| `seeded` | The function seeded; the reload it ran has the rows, so the load stops. |
| `not-new` | The account was seeded before; the load carries on with the other tables. |
| `busy` | A seed is already running in this tab and will reload, so the load stops. |
| `failed` | Any error, including no session and a missing function. The load stops **without applying the empty read**, so what is on screen stays, and `syncError` reads "Could not read wallets", which the sync badge offers to retry. |

**There is no fallback to client inserts.** A project without the function seeds nothing, so the migration is applied **before** this code deploys.

### `20261002_phase64_dedupe_categories.sql`
Data only, idempotent, one DO block:
- **The groups:** one account's live categories that share a trimmed, case-insensitive name. Type is not part of the key, matching `dedupeCategoriesByName` and the 2026-09-20 migration.
- **The winner:** the earliest `created_at`, then the lowest id.
- **Re-pointing:** every transaction (deleted ones included) and keyword rule on a loser moves to the winner.
  - A moved transaction gets `updated_at = now()`, so an edit panel left open on it reports `TRANSACTION_CHANGED` instead of saving over it (ADR 0033).
  - `keyword_rules` has no `updated_at`.
- **The losers** are marked `is_deleted = true`. Nothing is removed, and no amount, wallet or debt changes.

**The live preview** (read-only, 2026-10-02):
- the owner's account goes from 38 live categories to 11, with 27 marked deleted;
- 17 transactions are re-pointed (14 live, 3 deleted), and 0 rules;
- the second account is unchanged at 9.

## Verification
- **The probe,** `supabase/tests/20261002_phase64.probe.sql` (`BEGIN ... ROLLBACK`), checks:
  - the grants;
  - a call with no session refused with `28000`;
  - a new account seeded once, with a second call answering `seeded: false` and adding nothing;
  - an account with only a deleted wallet, or only a deleted category, not seeded;
  - the dedupe:
    - one live winner, its copies marked deleted;
    - every transaction re-pointed with a new `updated_at`, and a row already on the winner left untouched;
    - no amount changed;
    - the rule re-pointed;
    - an older deleted copy left deleted;
    - another account untouched;
    - a second run changing nothing.

  The owner ran it in the Supabase SQL editor against the live schema: `PHASE 64 PROBE OK`.
- **Unit** (`authenticated-ledger.test.tsx`, against a JS stand-in for the function's contract):
  - a new account is seeded only through the function, with no client inserts;
  - a refused call and a missing function seed nothing and report the read as failed;
  - an account seeded before is not seeded again, and the load finishes without looping.

  Three controls each failed their tests:
  - the empty read applied after a failure;
  - "already seeded" treated as a failure;
  - a client insert on the error path.

## Consequences
- **One copy of the starter set now lives in SQL** beside the guest defaults in `FinanceContext.tsx`. A change to either must change both.
- **The deleted wallets stay.** That is 24 in all, 18 of them starter copies, and 7 of the 24 are referenced by transactions. They are invisible in the app.
- **What the dedupe run did:** the 27 duplicate rows were **removed, not marked deleted**: afterwards the table holds 20 category rows, all live, where before it held 47 and none deleted. `20261002_phase64_dedupe_categories.sql` only sets `is_deleted`, so it cannot lower the row count; the run was most likely `20260920_dedupe_categories.sql`, which re-points the same way and then physically deletes the copies. Every money fingerprint is unchanged and nothing references the removed rows. Accepting that or restoring the rows is the owner's open decision.
- **Order of release:**
  1. apply the seed function;
  2. deploy the client;
  3. apply the dedupe.

  The dedupe can run any time after the seed function is live, so no new duplicates appear behind it.
