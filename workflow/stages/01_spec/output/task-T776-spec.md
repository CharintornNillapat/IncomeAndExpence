# T776 spec: useTransactions honours an explicit includeDeleted: true

Phase 139 (branch `phase-139-subagent-trial`), first task. Source: `docs/audit/audit-2026-10-16.md` finding CS-01 (low).

## 1. Goal

`useTransactions({ includeDeleted: true })` must return soft-deleted rows even while the shared `showSoftDeleted` toggle is off. Today a second filter line overrides the explicit option. Remove that line and pin the behaviour with one small unit test.

## 2. Target files

- `src/hooks/useTransactions.ts`
- `unit/use-transactions.test.tsx` (new)
- `docs/audit/task-ledger.md` (bookkeeping, see Tests to add, last paragraph)

No ADR (a one-line latent-bug fix, no new rule). No `refactor-log.md` or `baseline-metrics.md` entry: this task does not ship the phase.

## 3. Context to read

`docs/contexts/client-state.md` (it covers `src/hooks/` and the unit harnesses that mount `FinanceProvider`, "Unit tests for this layer"). Nothing else.

## 4. Current behaviour

- `src/hooks/useTransactions.ts:31-32`: `includeDeleted` is destructured from `options` and defaults to the context's `showSoftDeleted`, so an unspecified option already follows the toggle.
- `src/hooks/useTransactions.ts:67`: `if (!includeDeleted && tx.isDeleted) return false;` already drops deleted rows when `includeDeleted` is false.
- `src/hooks/useTransactions.ts:68`: `if (includeDeleted && !showSoftDeleted && tx.isDeleted) return false;` drops deleted rows again whenever the toggle is off, even if the caller passed `includeDeleted: true`. With the default, `includeDeleted === showSoftDeleted`, so line 68 can never fire for a defaulted value (`includeDeleted` true implies `showSoftDeleted` true). It only ever overrides an explicit option.
- `showSoftDeleted` starts `false` (`src/context/FinanceContext.tsx:562`).
- The only caller, `src/views/TransactionsView.tsx:147-154`, passes no `includeDeleted`, so removing line 68 changes nothing in the app today. Verified by grep: `useTransactions` appears only in `src/hooks/useTransactions.ts` and `src/views/TransactionsView.tsx`.
- `src/hooks/useTransactions.ts:95`: the memo dependency array lists `showSoftDeleted`. Once line 68 is gone the memo body no longer reads it (the default is applied at line 32, outside the memo, and `includeDeleted` already carries it), so remove it from that array. `showSoftDeleted` is still destructured (line 20) and returned (line 162), so there is no unused-variable error.

## 5. Parity map

none.

## 6. Tests to add

New file `unit/use-transactions.test.tsx`, first line `// @vitest-environment jsdom`, modelled on `unit/ledger-guards.test.tsx` (mount the real `FinanceProvider`, inert under test) and `unit/transactions-page.test.tsx:55` (rows seeded through `localStorage.setItem('pf_transactions', JSON.stringify(rows))` after `localStorage.clear()`, before mounting). Use `renderHook` from `@testing-library/react` with a wrapper component `({ children }) => <FinanceProvider>{children}</FinanceProvider>`, and `cleanup()` in `afterEach`. Relative imports only.

Seed two `Transaction` rows (full shape per `src/types.ts:101-118`, `type: 'EXPENSE'`, `transactionDate: '2026-09-15'`, `walletId: 'wal-main-checking'`): one `isDeleted: false` (id `tx-live`), one `isDeleted: true` (id `tx-gone`). Seeding wallets is not needed.

Two tests:

1. `includeDeleted: true returns soft-deleted rows while showSoftDeleted is off`. `renderHook(() => useTransactions({ includeDeleted: true }), { wrapper })`. Assert `result.current.showSoftDeleted === false` and the ids of `result.current.transactions` contain both `tx-live` and `tx-gone`. **Fails today:** line 68 drops `tx-gone`, leaving only `tx-live`. Passes after line 68 is removed.
2. `with no option the toggle decides`. `renderHook(() => useTransactions(), { wrapper })`. Assert only `tx-live` is returned; then `act(() => result.current.setShowSoftDeleted(true))` and assert both ids are returned. Passes before and after (regression guard for the default at line 32).

Red run (money-adjacent hook, failing test first): after writing the test and before editing `src/hooks/useTransactions.ts`, run `npx vitest run unit/use-transactions.test.tsx` and save the output to `workflow/stages/02_build/output/logs/T776-red.log`. Test 1 must fail on the missing `tx-gone`; test 2 must pass. Then make the source edit and re-run green.

Ledger: the builder adds a `## Phase 139 - ...` section to `docs/audit/task-ledger.md` above `## Backlog`, in the same table format as Phase 138, with a T776 row (Task, Files, Status `done`, empty Commit, Gate result), and adds one Backlog row for CS-01 in the shape of the UI-01 row: source `Audit 2026-10-16 (T759), finding CS-01, low; src/hooks/useTransactions.ts:68`, Status `done in Phase 139 (T776)`. Keep the file's CRLF line endings.

## 7. Gates

Changed paths: `src/hooks/`, `unit/`, `docs/audit/task-ledger.md`. Union of tiers (hooks tier plus the unit tier):

```
npm run lint
npx vitest run unit/use-transactions.test.tsx unit/transactions-page.test.tsx
npm run test:unit
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts --project=chromium
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts
```

Check ports 3000 and 3100 for stale dev servers before Playwright. Save the full `npm run test:unit` output to `workflow/stages/02_build/output/logs/`. Also:

```
git ls-files --eol src/hooks/useTransactions.ts unit/use-transactions.test.tsx docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" unit/use-transactions.test.tsx
```

Expect `w/crlf` for all three files (the new test file written with CRLF to match the repo; `src/hooks/useTransactions.ts` and the ledger stay CRLF) and 0 em dashes in both counts. `git diff HEAD -- src/hooks/useTransactions.ts` must show line 68 removed and `showSoftDeleted` removed from the dependency array, nothing else.

## 8. Production touch points

none.

## 9. Out of scope

- Any other change in `src/hooks/useTransactions.ts` (search stages, handlers, return shape).
- `src/views/TransactionsView.tsx` and the `showSoftDeleted` toggle itself; do not make a caller pass `includeDeleted`.
- The other audit findings (CS-02 and later), `FinanceContext.tsx`, selectors.
- Changing the `includeDeleted` option's type or default.
