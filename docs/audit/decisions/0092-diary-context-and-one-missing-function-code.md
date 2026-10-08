# 0092: The diary has contexts of its own, composed under FinanceProvider; one code for a missing function

**Status:** Accepted. Released: code `1e2f13f`, docs `2673f32`, hash backfill `e5858ac`, merged into `main` as `aa02a30` (PR #67); Vercel `dpl_CFUe5UcNpT2bEujEVbYiA71aZPy5` READY in `icn1`. No migration; live drift run `37760655280`: no drift, 20 migrations.
- **The first slice of** the AGY audit's finding 3 (the monolithic `FinanceContext`).
- **Amends** ADR `0091`: `updateTransaction`, `deleteAccount` and the account seed report a missing function the same way.

**Date:** 2026-10-08

## Context

1. **Every diary write re-rendered every finance subscriber,** and every ledger write re-rendered every diary subscriber, because `diaryEntries` sat in `FinanceStateContext` with the ledger. The Transactions page has nothing to do with the diary and re-rendered on each save of it. `FinanceContext.tsx` was 3,408 lines.
2. **The diary is the safest first slice:** no money arithmetic, two writes, three readers (the Dashboard's mood card and "logged today", the Daily diary, `AccountModal`'s export).
3. **A missing function was reported three ways:** ADR `0091`'s five ledger writes return `code: 'DATABASE_UPDATE_NEEDED'`; `updateTransaction` and `deleteAccount` returned their own text with no code; a missing `seed_starter_account` showed "Could not read wallets", which is untrue: the read worked.

## Decision

1. **`src/context/DiaryContext.tsx`** holds the slice:
   - `useDiaryEntriesState(load)`: the state and its ref mirror;
   - `useDiaryMutations(...)`: `upsertDiaryEntry` and `deleteDiaryEntry`, moved unchanged (a signed-in save still reloads from the cloud);
   - `mapDiaryRow`: a `diary_entries` row as the app holds it;
   - `DiaryProvider`, and `useDiaryState()` / `useDiaryActions()` for readers.
2. **It is composed under `FinanceProvider`, not beside it.** `FinanceProvider` calls the two hooks and renders `DiaryProvider` inside its own two providers. Three things stay in `FinanceProvider` on purpose, and set the diary through the setter the hook returns:
   - **the one batched `localStorage` writer**, which registers `pf_diary` (CLAUDE.md: one writer, every slice registered there; its write effects must run before `didMountRef` is set);
   - **the one cloud load**, which reads `diary_entries` with the other tables, so "every read succeeded" (ADR `0022`) and the sign-out epoch checks still cover them all;
   - **the sign-out reset and the backup restore**, which replace every slice at once.
   A separate provider beside it would need those three through a second channel.
3. **`diaryEntries` left `FinanceStateContext`, and the two writes left `FinanceActionsContext`.** Leaving them there "for compatibility" would have kept the re-renders this phase removes. The three readers and one unit test moved to the new hooks; `tsc` listed every one.
4. **One code for a missing function.** `databaseUpdateNeeded(error?)` takes a message:
   - `updateTransaction` and `deleteAccount` return `code: 'DATABASE_UPDATE_NEEDED'` with their own text ("Editing needs ...", "Account deletion needs ... Nothing was deleted.").
   - The seed's outcome gains `'update-needed'`, and the load sets `syncError` to "Setting up this account needs the latest database update", with no trailing period, because the sync badge appends ". Tap to try again." Any other seed failure is still "Could not read wallets".

## Re-renders

React's `Profiler` around the real Dashboard, Daily diary and Transactions views under one `FinanceProvider` (jsdom, a guest), counting commits per view for one diary save and then one expense. The same harness before and after, three runs each, identical every time:

| Write | Dashboard | Daily diary | Transactions |
|---|---|---|---|
| A diary save, before | 1 | 1 | 1 |
| A diary save, after | 1 | 1 | **0** |
| An expense, before | 1 | 1 | 2 |
| An expense, after | 1 | 1 | 2 |

The Dashboard and the diary still re-render on a diary save (they show it), and the diary still re-renders on an expense (it shows each day's spending).

## Tests

- **`unit/diary-context.test.tsx` (new, 2):** the re-render table's claim (a diary save does not re-render the Transactions page; an expense still reaches all three), which failed against the code before the move with Transactions at 2; and a guest entry written to `pf_diary` by the batched writer and read back by a new provider.
- **`unit/authenticated-ledger.test.tsx`:**
  - **"the diary, signed in" (new, 5):** the load maps the rows; a new day is one insert under the account; a logged day is one update of its row; a refused delete rolls back with the reason; sign-out empties it. **All five pass against the code before the move too** (run in a worktree of `main` at `44f1a9f`, the probe reading the old contexts): the slice sends and shows what it did.
  - **Three tightened to the code, each failing first:** the edit and the account deletion with a missing function return `code: 'DATABASE_UPDATE_NEEDED'` and their text exactly; a missing seed function sets the new `syncError`.
- **`unit/backup-restore.test.tsx`:** its probe reads the diary's context too.
- **Gate:** lint clean; unit, first run 1287 passed and 1 failed with one suite's setup timing out (93 s; the session list's 1 s lookup in `authenticated-ledger` and `migration-history`'s PGlite hook, each passing alone, the session test three times), second run 1306/1306 in 57 files (71 s); Playwright 484 passed, 6 skipped, 2 failed of 492 (19.4 m, traces on): both the WebKit painting stall on `gotoTab`'s tab click, and those two specs passed 140 of 140 on WebKit; no migration.
- **WebKit:** both failures were `gotoTab`'s tab click waiting 15 s on "stable", traced with frames stopping within 0.6 s of it, in `csv-classify` and `debts-page`, which this phase does not change. Both clicks came after `settle` (ADR `0091`) had found nothing animating, so the stall happens with no tween running too. Per the owner's decision (ADR `0091`) they were repeated, not fixed: 140 of 140 on WebKit.

## Release

- PR #67 merged into `main` as `aa02a30`, whose tree is identical to `e5858ac`; the pull request's CI (run `37760829569`) passed every job.
- Vercel `dpl_CFUe5UcNpT2bEujEVbYiA71aZPy5` is READY in production, region `icn1`; production serves the entry `index-B8gRtQN0.js`, the same hash as a local build of `main`, with `DiaryContext` in it.
- `main` CI on the merge (run `37770513796`) passed every job on its first attempt in 308 s end to end, the merge job included: unit 1306; 486 passed, 6 skipped, no flaky test. The local WebKit painting stall (ADR `0058`) did not show on CI's Linux WebKit.

## Bundle

The entry 191,919 / 56,213 to 192,987 / 56,621 B (+1,068 / +408 gzip: `DiaryContext` and its two contexts are in it); all app JS 878,287 / 267,227 to 879,417 / 267,658 (+1,130 / +431), 40 files, the views that import the new hooks a few bytes each; cold start still three scripts. `FinanceContext.tsx` 3,408 to 3,288 lines, `DiaryContext.tsx` 228. The slice costs bytes, not the re-renders: the gain is in what re-renders, measured above.
