# 0093: The re-render matrix across six views; the smart rules have contexts of their own; the helpers' animation wait stays

**Status:** Accepted. Released: code `bbac429`, docs `28b5bd2`, hash backfill `777c756`, merged into `main` as `fe7b319` (PR #68); Vercel `dpl_DRQAQ44H9TT8SwBF6PCR91mxCwiL` READY in `icn1`. No migration; live drift run `37798213404`: no drift, 20 migrations.
- **The second slice of** the AGY audit's finding 3 (the monolithic `FinanceContext`), after ADR `0092`'s diary.
- **Confirms** ADR `0091`'s `settle`, with an A/B the brief's removal was measured against.

**Date:** 2026-10-08

## Context

1. **Phase 116 measured three views and one write.** Choosing the next slice needs every view against every kind of write: what re-renders, and whether it reads what changed.
2. **The brief named two candidates, the smart rules and the categories,** and asked for the one with the most re-renders a view does not need and the least risk to the ledger.
3. **The brief removed `settle` (ADR `0091`)**, since both of Phase 116's WebKit stalls came after it had found nothing animating (ADR `0092`). It polls before and after every tab change and every Quick Add.

## The matrix

`unit/rerender-matrix.test.tsx`: React's `Profiler` around each of the six real views, all under one guest `FinanceProvider` (jsdom), counting commits per view for each write, in this order: an expense, a category added and renamed, a rule added and deleted, a template added, edited and deleted, and a diary save. Three runs on each side.

**Before** (identical in all three runs):

| Write | Dashboard | Transactions | Wallets | Debts | Categories | Diary | Views that read it |
|---|---|---|---|---|---|---|---|
| Transaction save | 1 | 1 | 1 | 1 | 1 | 1 | all six |
| Category add | 1 | 2 | 1 | 1 | 1 | 1 | all six |
| Category edit | 1 | 1 | 1 | 1 | 1 | 1 | all six |
| Rule add | 1 | 1 | 1 | 1 | 1 | 1 | Categories |
| Rule delete | 1 | 1 | 1 | 1 | 1 | 1 | Categories |
| Template add, edit or delete | 1 | 1 | 1 | 1 | 1 | 1 | none |
| Diary save | 1 | 0 | 0 | 0 | 0 | 1 | Dashboard, Diary |

**What it says:**
- **Every view reads `transactions` and `categories`** (rows, names, the Dashboard's cards, each day's spending), so a transaction or category write is needed everywhere. Splitting the categories out would remove no re-render, and `categoriesRef` is read by the ledger's own guards (`addTransaction`'s type check, the CSV import).
- **A rule write re-renders five views that do not read the rules.** Only the Categories page does (its usage counts). The rules move no money.
- **A template write re-renders all six, and none reads templates**: only the entry form and Quick Add do, inside their dialogs. Templates are outside the brief's two candidates; they are the next one (below).

## Decision

1. **The smart rules are the second slice.** `src/context/KeywordRulesContext.tsx` holds:
   - `useKeywordRuleStore(load)`: the state and its ref mirror;
   - `useKeywordRuleMutations(...)`: `addKeywordRule` and `deleteKeywordRule`, moved unchanged (the signed-in insert now maps its row through `mapKeywordRuleRow`, field for field what it built inline);
   - `DEFAULT_KEYWORD_RULES` and `mapKeywordRuleRow`;
   - `KeywordRulesProvider`, and `useKeywordRulesState()` / `useKeywordRulesActions()` for readers.
2. **It is composed as the diary is** (ADR `0092`): `FinanceProvider` calls the two hooks and renders the provider inside its own. It keeps the batched writer's `pf_keywords`, the one cloud load (`keyword_rules` with the other tables), the sign-out reset and the backup restore, and **`deleteCategory`'s check that no rule uses the category**, which reads the ref the hook returns.
3. **`keywordRules` left `FinanceStateContext`, and the two writes left `FinanceActionsContext`,** with no compatibility copy. The five readers moved: `CategoriesView`, `SmartRulesPanel`, `TransactionForm` (the rule chip), `ImportCsvModal` and `AccountModal`'s export; `tsc` listed each.
4. **`settle` stays, by the owner's decision on the measurement below.** The removal was built and measured first:
   - **Full suite without it:** 485 passed, 6 skipped, 1 failed of 492 (12.5 m): a WebKit stall on the restore click in `soft-delete.spec.ts`, traced with the last frame 70 ms into the click and none after.
   - **The A/B, `soft-delete.spec.ts` on WebKit, 240 runs a side:** without `settle` 5 stalls (59, 59, 58 and 59 of 60 per batch of ten repeats); with `main`'s `settle` 0 (60 of 60 four times). All five on one side has about a 3% chance if the wait made no difference. Five of the six stalled clicks (the full run's included) came just after a tween began: three Quick Add submits as the dialog rose, Add debt right after a tab's slide, and the restore button.
   - **So it does not prevent the stall (ADR `0092`) but makes it rarer locally.** CI's Linux WebKit passes either way. The owner chose to keep it; `tests/helpers.ts` is `main`'s, with the A/B noted on `settle`.
5. **Next slice: templates.** Each template write re-renders all six views and no view reads templates; they are local only (no table, no cloud load), so the move is smaller than this one.

## After

| Write | Dashboard | Transactions | Wallets | Debts | Categories | Diary |
|---|---|---|---|---|---|---|
| Rule add | **0** | 1 | **0** | **0** | 1 | **0** |
| Rule delete | **0** | 1 | **0** | **0** | 1 | **0** |

Every other row is unchanged, but for one Transactions commit after a category write that lands in the add's or the edit's window by timing (the two rows total three in every run, before and after). **The one Transactions commit on a rule write is the CSV import dialog**, mounted while closed on purpose (ADR `0031`) and reading the rules its preview applies; with that one read stubbed out for a check (not kept), Transactions was 0. The Transactions page itself does not render.

## Tests

- **`unit/rerender-matrix.test.tsx` (new, 1):** the matrix. It asserts that a transaction or category write reaches all six, that a rule write reaches only the Categories page and the import dialog, and Phase 116's diary row. It failed first against the code before the move, on the rule rows.
- **`unit/authenticated-ledger.test.tsx`, "the smart rules, signed in" (new, 7):** the load maps the rows; a new rule is one insert under the account, trimmed and lower-cased, shown first; a refused insert shows nothing and says why; a delete is one delete of that row; a refused delete puts the rule back at its index with the reason; a category a rule uses cannot be deleted; sign-out puts back the guest defaults. **All seven passed against the code before the move,** with the accessors reading the finance contexts, and pass after it on the new hooks.
- **`unit/backup-restore.test.tsx`:** its probe reads the rules' context too.
- **Gate:** lint clean; unit 1314/1314 in 58 files (54 s); Playwright on the tree that ships (with `settle`): 486 passed, 6 skipped, 0 failed of 492 (14.4 m, 4 workers). No migration; live drift run `37798213404`: no drift, 20 migrations.

## Release

- PR #68 merged into `main` as `fe7b319`, whose tree is identical to `777c756`; the pull request's CI (run `37800529963`) passed every job.
- Vercel `dpl_DRQAQ44H9TT8SwBF6PCR91mxCwiL` is READY in production, region `icn1`; production serves the entry `index-CBflWzNQ.js`, the same hash as a local build of `main`, with `KeywordRulesContext` in it.
- `main` CI on the merge (run `37882441943`) passed every job on its first attempt in 253 s end to end, the merge job included: unit 1314; 486 passed, 6 skipped, no flaky test. The local WebKit painting stall (ADR `0058`) did not show on CI's Linux WebKit.

## Bundle

`main` at `f55432d` built in a worktree with `.env`, gzip level 9 on both sides. The entry 192,987 / 56,621 to 193,818 / 56,787 B (+831 / +166 gzip: `KeywordRulesContext` is in it); all app JS 879,417 / 267,658 to 880,341 / 267,904 (+924 / +246), 40 files; the five readers' chunks a few bytes each; cold start still three scripts. `FinanceContext.tsx` 3,288 to 3,187 lines, `KeywordRulesContext.tsx` 192.
