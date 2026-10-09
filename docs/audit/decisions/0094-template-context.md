# 0094: The quick templates have contexts of their own

**Status:** Accepted. Released: code `0c12345`, docs `37496f1`, hash backfill `3a2c5e7`, merged into `main` as `7414550` (PR #69); Vercel `dpl_7qc1sF8H7tGGqJNrLtChJT5XfwcB` READY in `icn1`. `main` CI on the merge failed on one unit test (Release, below). No migration; live drift run `37883520114`: no drift, 20 migrations.
- **The third slice of** the AGY audit's finding 3 (the monolithic `FinanceContext`), after ADR `0092`'s diary and ADR `0093`'s smart rules, and the candidate ADR `0093`'s matrix named.

**Date:** 2026-10-09

## Context

1. **ADR `0093`'s matrix:** a template add, edit or delete re-rendered all six views, and no view reads templates. Only the entry form and Quick Add do, inside their dialogs.
2. **Templates are local only:** no table, no cloud load. The owner's brief keeps them so (no table, no sync in this phase).
3. **Using a template records a transaction through the ledger,** so it should reach every view, as any expense does.

## Decision

1. **`src/context/TemplateContext.tsx`** holds:
   - `useTemplateStore(load)`: the state and its ref mirror;
   - `useTemplateMutations(...)`: `addPreset`, `updatePreset` and `deletePreset`, moved unchanged;
   - `TemplateProvider`, and `useTemplateState()` (`presets`) / `useTemplateActions()` for readers.
2. **It is composed as the diary and the rules are.** `FinanceProvider` calls the two hooks and renders the provider inside its own. It keeps:
   - the batched writer's `pf_presets`;
   - the sign-out reset (templates never sync, so they are gone for good, as the sign-out confirmation already says) and the backup restore, which keeps only templates whose wallet and category the backup holds;
   - **`applyPreset`**, a ledger write through `addTransaction`. It stays in `FinanceActionsContext` and reads the templates through the ref the hook returns, as `deleteCategory` reads the rules (ADR `0093`).
3. **`presets` left `FinanceStateContext`, and the three writes left `FinanceActionsContext`,** with no compatibility copy. The two readers moved: `QuickAddModal` and `TransactionForm`. `tsc` listed each, and the four unit tests that read them.
4. **No reorder action.** The brief listed one, but the app has none: templates are listed newest first and nothing moves them. None was added.

## Re-renders

`unit/rerender-matrix.test.tsx` (ADR `0093`), three runs, identical apart from the category rows' known timing drift (ADR `0093`):

| Write | Dashboard | Transactions | Wallets | Debts | Categories | Diary |
|---|---|---|---|---|---|---|
| Template add, before | 1 | 1 | 1 | 1 | 1 | 1 |
| Template add, edit or delete, after | **0** | **0** | **0** | **0** | **0** | **0** |
| Template apply (new row) | 1 | 1 | 1 | 1 | 1 | 1 |

Applying a template is an expense, so it reaches every view, as a transaction save does. Every other row is unchanged.

## Tests

- **`unit/template-context.test.tsx` (new, 6):** a new template is shown first and a name already used, in any case, is refused; an edit's five checks (not found, empty name, a used name, amount 0, empty description) and a valid edit; a delete, then a second delete is "Template not found"; the batched writer stores `pf_presets` and a new provider reads it back; `applyPreset` records the expense from the template's wallet and category, dated today; a template whose wallet and category are gone uses the first wallet and no category. **All six passed against the code before the move,** with the accessors reading the finance contexts, and pass after it on the new hooks.
- **`unit/rerender-matrix.test.tsx`:** template add, edit and delete reach no view; template apply reaches all six. It failed first against the code before the move, on the template rows.
- **`unit/authenticated-ledger.test.tsx`, `unit/backup-restore.test.tsx`:** their probes read the templates' context; the sign-out and restore tests are otherwise unchanged and pass.
- **Gate:** lint clean; unit 1320/1320 in 59 files (41 s); Playwright 485 passed, 6 skipped, 1 failed of 492 (12.2 m, 4 workers). The failure was the WebKit painting stall (ADR `0058`) on the Import CSV button in `csv-classify.spec.ts`, a spec this phase does not change: the trace's last frame came 301 ms into the click, with none after. Repeated per the owner's rule: 110 of 110 on WebKit. `presets.spec.ts` passed on all three browsers. No migration; live drift run `37883520114`: no drift, 20 migrations.

## After this slice

The matrix has no view-level noise left to remove. Everything still in `FinanceContext` (wallets, transactions, debts, categories) is read by every view, so splitting it would save no re-render. A further split there is for readable code, not re-renders, and needs its own reason.

## Release

- PR #69 merged into `main` as `7414550`, whose tree is identical to `3a2c5e7`; the pull request's CI (run `37884912254`) passed every job.
- Vercel `dpl_7qc1sF8H7tGGqJNrLtChJT5XfwcB` is READY in production, region `icn1`; production serves the entry `index-DYwCP4F9.js`, the same hash as a local build of `main`, with `TemplateContext` in it.
- **`main` CI on the merge (run `37885529942`) failed** in its `checks` job, so no browser job ran: 1319 of 1320 unit tests passed, and `template-context`'s "an edit is checked before it is applied" failed (a rename to a name another template uses was accepted). **Cause:** a guest template's id is `preset-${Date.now()}`; on CI's runner the test's two `addPreset` calls fell in one millisecond, so both templates got one id and the duplicate check (`p.id !== id`) skipped both. The pull request's run passed on timing. With `Date.now()` frozen the test fails every time locally. The id is older than this phase (moved unchanged), and six more guest ids are built the same way (wallets, categories, transactions, debts, rules, diary entries). Production is unaffected in practice: a person cannot create two of one kind in one millisecond.

## Bundle

`main` at `1dc83a1` built in a worktree with `.env`, gzip level 9 on both sides. The entry 193,818 / 56,787 to 194,599 / 56,884 B (+781 / +97 gzip: `TemplateContext` is in it); all app JS 880,341 / 267,904 to 881,167 / 268,064 (+826 / +160), 40 files; `QuickAddModal` +17 and `TransactionForm` +17 gzip; cold start still three scripts. `FinanceContext.tsx` 3,187 to 3,086 lines, `TemplateContext.tsx` 174.
