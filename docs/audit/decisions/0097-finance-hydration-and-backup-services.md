# 0097: The cloud load's reads and the restore's row rewriting move to `src/services/`

**Status:** Accepted. Branch `phase-121-finance-context-hygiene`; not merged. No migration.
- **Readability only.** No behaviour, state contract, test or fixture changes. Re-renders were settled by ADR `0093` and `0094`, and this phase does not touch them.

**Date:** 2026-10-09

## Context

1. **`src/context/FinanceContext.tsx` was 3,090 lines.** The diary, the smart rules and the templates had already left for contexts of their own (ADR `0092` to `0094`), and the re-render matrix says no view-level noise is left. What remained large was code, not state. The longest single piece that holds no React state is the cloud load: six reads, each followed by the sign-out epoch check, and the row mappers.
2. **The owner's brief:** move the cloud hydration and the backup restore's glue into `src/services/`, keep every rule `CLAUDE.md` attaches to them, change no test, and record what could not move and why.

## Decision

1. **`src/services/financeHydration.ts`** (212 lines) holds:
   - `mapWalletRow`, `mapTransactionRow` and `mapDebtRow`, moved unchanged and exported, because the provider's writes map the rows their RPCs return (`create_wallet`, the ledger writes);
   - `mapCategoryRow`, the categories mapping that was written inline in the loader; module-private, since only the load uses it;
   - `SeedOutcome`, the type of the starter seed's answer;
   - **`readCloudSlices(userId, deps)`**: the six reads in their old order (wallets, categories, keyword rules, debts, transactions, diary), each followed by `deps.signedOutMeanwhile()`, each slice applied through the setter in `deps`. An empty wallet read still asks `deps.seed` before anything is applied, and sets the same `syncError` text for `update-needed` and `failed`. It returns the tables whose read failed, or `null` when the load stopped early. A thrown error propagates to the caller's `catch`, as before.
2. **`src/services/financeBackup.ts`** (29 lines) holds `backupAsGuest(data, guestUserId)`: the six slices with every row's `userId` set to the guest's, and `keepPreset`, the filter that keeps a template unless it names a wallet or category the backup does not hold. Parsing stays in `utils/accountExport.ts` (`parseAccountBackup`, ADR `0075`/`0076`), which this phase does not touch.
3. **What stays in `FinanceProvider`, and why:**
   - **`loadSupabaseData` itself:** `setIsSyncing`, the epoch capture (`authEpochRef`), and the clean-load bookkeeping. `cloudRevisionRef` and `lastCloudLoadAtRef` move, and `syncError` clears, only when the returned list is empty; a non-empty list logs and sets `Could not read ...`; the `catch` sets `Could not reach the server` unless signed out meanwhile. These are the rules ADR `0022`, `0023`, `0024` and `0026` hang on the load, so they stay where the refs live and read in one place.
   - **`seedInitialUserAccount`:** it is a write (`seed_starter_account()`), guarded by the provider's `isSeedingRef` and reloading through `loadSupabaseDataRef`. It also uses `isMissingRpcError`, which every ledger write uses; moving it would mean moving that too. The service receives it as `deps.seed`.
   - **`restoreBackup`'s refusal when signed in, and its slice replacement:** like the sign-out reset, the restore replaces every slice, and `CLAUDE.md` keeps both in the provider (ADR `0092`'s "three things"). Only the row rewriting moved.
   - **The batched `localStorage` writer, `resetToGuestState`, the auth effect, the realtime effect (`SYNCED_TABLES`), the guest defaults (`DEFAULT_SYSTEM_CATEGORIES`, passed to the service as `defaultCategories`), and every ledger write.** None is hydration. `DEFAULT_SYSTEM_CATEGORIES` is also the initial state and the reset's.
4. **The client is the same live binding.** `financeHydration.ts` imports `supabase` from `src/lib/supabase`, as `DiaryContext` and `KeywordRulesContext` already do. An ES module import is live, so it reads the loaded client; the unit suites' `vi.mock('../src/lib/supabase')` replaces the module for every importer, so the signed-in harness reaches the new file with no change. Nothing in `src/` imports a value from `@supabase/supabase-js`.
5. **No export was added for a test.** The three mappers are exported because the provider uses them; `mapCategoryRow` stays private.
6. **One timing difference, within a task.** The bookkeeping now runs when `readCloudSlices`' promise resolves: a few microtasks after the last slice is set, instead of in the same synchronous run. No macrotask can fall in between, React schedules the default-priority updates on a later task either way, and every unit suite that observes the load (the signed-in harness settles every fake call on a macrotask) passes unchanged.

## Size

| File | Before | After |
|---|---|---|
| `src/context/FinanceContext.tsx` | 3,090 | 2,936 (−154) |
| `src/services/financeHydration.ts` | - | 212 |
| `src/services/financeBackup.ts` | - | 29 |

The two new files' net 87 lines are their dependency interface and doc comments.

## Tests

None added or changed. The move is covered by what already pins it: `authenticated-ledger` (every signed-in load; `syncError` after a failed read, a thrown load and a clean retry; the seed's outcomes; a load in flight at sign-out that must not land; F6's rollback after a load that read nothing), `ledger-guards`, `backup-restore` and `stale-errors`. `git diff main -- unit tests` is empty.

## Gate

- **Lint:** clean (Node globals, safe ids, both `tsc` runs).
- **Unit:** 1360/1360 in 61 files before the edits (70 s) and after (41 s); shuffled, seed `1791555857981`, 1360/1360 (63 s).
- **Playwright:** 486 passed, 6 skipped by design, none failed, of 492 (8.1 m, 4 workers), on the first run; no spec repeated. Ports 3000 and 3100 were free before it.
- **Schema:** no migration. `npm run schema:drift` replayed the 20 migrations from empty in PGlite and wrote the read-only live query (75 column, 28 constraint, 1 extension, 16 function, 64 function grant, 17 index, 7 policy, 5 publication, 8 table, 24 table grant, 2 trigger and 20 migration rows expected). **The live half was not run:** no `SUPABASE_DRIFT_DB_URL` here and no Supabase MCP. This phase changes no SQL, so live cannot have moved because of it.
- **Bundle** (`main` at `a84dfff` built in a worktree with `.env`, gzip level 9 on both sides): the entry `index-CnVTLmA-.js` 194,826 / 56,963 B to `index-B8wLrv24.js` 195,458 / 57,105 (+632 / +142 gzip); all app JS 881,394 / 268,083 to 882,026 / 268,262 (+632 / +179), 40 files on both sides. The growth is the `deps` object's property names, which minification keeps, and the second async function; it is the price of the split, accepted.
