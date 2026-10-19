# T783 spec: useDebts rounds summary targets to cents with roundToCents (CS-03)

Phase 140 (branch `phase-140-gemini-trial`). Source: `docs/audit/audit-2026-10-16.md` finding CS-03 (low, lines 63-74).

## 1. Goal

Wrap `totalTarget`, `remainingTarget`, and `paidTarget` in `roundToCents(...)` inside `useDebts` (`src/hooks/useDebts.ts:40-42`), so the summary metrics returned by `useDebts().metrics` never expose IEEE 754 floating-point drift across multiple debts or subtraction.

## 2. Target files

- `src/hooks/useDebts.ts`
- `unit/debts-page.test.tsx`
- `docs/audit/task-ledger.md` (bookkeeping)

No ADR: this closes a low audit finding by applying the existing `roundToCents` non-negotiable (`src/utils/money.ts:22`) to `useDebts().metrics`, while keeping the sums in `useDebts.ts` per ADR `0079` (`docs/audit/decisions/0079-one-payoff-percent-selector.md:32`). No `refactor-log.md` or `baseline-metrics.md` entry unless the owner closes Phase 140 in a later task.

## 3. Context to read

`docs/contexts/client-state.md`: covers `src/hooks/useDebts.ts` (`line 14`), the `roundToCents` rule under "Money and dates" (`line 49`), `payoffPercent` under "Money rules: `src/selectors/`" (`line 62`), and the unit test harness rules under "Unit tests for this layer" (`lines 123-133`). Nothing else.

## 4. Current behaviour

- `src/hooks/useDebts.ts:20-22`: `liveDebts` filters `debts` to non-deleted rows (`!d.isDeleted`).
- `src/hooks/useDebts.ts:39-54`: `debtMetrics` computes:
  - `line 40`: `const totalTarget = liveDebts.reduce((sum, d) => sum + d.totalAmount, 0);` without `roundToCents`. Summing cent figures such as `10.1 + 20.2` produces `30.299999999999997`.
  - `line 41`: `const remainingTarget = liveDebts.reduce((sum, d) => sum + (d.isSettled ? 0 : d.remainingAmount), 0);` without `roundToCents`. Summing `0.1 + 0.2` produces `0.30000000000000004`, whereas the equivalent selector `debtRemaining(debts)` in `src/selectors/wallets.ts:79-83` (whose doc comment at `:78` cites `useDebts().metrics.remainingTarget`) wraps its sum in `roundToCents(total)`.
  - `line 42`: `const paidTarget = Math.max(0, totalTarget - remainingTarget);` without `roundToCents`. Even when `totalTarget` (`0.3`) and `remainingTarget` (`0.1`) are already two-decimal numbers, `0.3 - 0.1` evaluates to `0.19999999999999998`.
  - `line 45`: `const progressPercent = payoffPercent(totalTarget, remainingTarget, liveDebts.length > 0 ? 100 : 0);` passes `totalTarget` and `remainingTarget` into `payoffPercent` (`src/selectors/debts.ts:63-65`).
- `src/views/DebtsView.tsx:30` and `src/views/DashboardView.tsx:66` are the two callers of `useDebts()`; they pass `metrics` (`totalTarget`, `remainingTarget`, `paidTarget`, `progressPercent`) to `DebtSummaryCard` (`src/components/debt/DebtSummaryCard.tsx:27`) and `DebtPayoffCard` (`src/components/dashboard/DebtPayoffCard.tsx:30`).

### Money invariants this change must keep

1. **Single cent-rounding primitive (`AGENTS.md` Non-negotiables, `src/utils/money.ts:22`):** Every money sum and difference exposed by `useDebts().metrics` (`totalTarget`, `remainingTarget`, `paidTarget`) is rounded through `roundToCents`. Proved by the new CS-03 test in `unit/debts-page.test.tsx`.
2. **Agreement between `useDebts().metrics.remainingTarget` and `debtRemaining(debts)` (`src/selectors/wallets.ts:78-83`):** Across any set of live debts, `useDebts().metrics.remainingTarget` equals `debtRemaining(debts)` to the cent. Proved by the new CS-03 test in `unit/debts-page.test.tsx`.
3. **Non-negative `paidTarget` floor and zero-borrowed `progressPercent` bounds (ADR `0079`, `0080`, `0081`, `0084`):** A debt owing more than it borrowed still floors `paidTarget` at `0` (`roundToCents(Math.max(0, ...)) === 0`), and `progressPercent` stays clamped to `0..100` (`100` when live debts exist with `totalTarget === 0`, `0` when no live debts exist). Proved by existing tests in `unit/debts-page.test.tsx:168-183`, `:213-217`, and `unit/selectors-debts.test.ts:174-207`.

## 5. Parity map

none.

## 6. Tests to add

In `unit/debts-page.test.tsx`:

1. Update line 3 to include `renderHook`:
   ```ts
   import { render, renderHook, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
   ```
2. Import `useDebts` from `'../src/hooks/useDebts'` and `debtRemaining` from `'../src/selectors/wallets'` at the top of `unit/debts-page.test.tsx` (after line 9):
   ```ts
   import { useDebts } from '../src/hooks/useDebts';
   import { debtRemaining } from '../src/selectors/wallets';
   ```
3. Inside `describe('the summary', ...)` (`unit/debts-page.test.tsx:209-261`), after the first test (`'totals what is still owed and paid off'`, lines 213-217), add:
   ```ts
   it('rounds totalTarget, remainingTarget and paidTarget to cents in useDebts().metrics (CS-03)', () => {
     const seeded = [
       debtRow({ id: 'd1', name: 'One', totalAmount: 10.1, remainingAmount: 0.1 }),
       debtRow({ id: 'd2', name: 'Two', totalAmount: 20.2, remainingAmount: 0.2 }),
     ];
     localStorage.setItem('pf_debts', JSON.stringify(seeded));
     const { result } = renderHook(() => useDebts(), {
       wrapper: ({ children }) => <FinanceProvider>{children}</FinanceProvider>,
     });
     expect(result.current.metrics.totalTarget).toBe(30.3);
     expect(result.current.metrics.remainingTarget).toBe(0.3);
     expect(result.current.metrics.remainingTarget).toBe(debtRemaining(seeded));
     expect(result.current.metrics.paidTarget).toBe(30);

     cleanup();
     localStorage.setItem(
       'pf_debts',
       JSON.stringify([debtRow({ id: 'd3', name: 'Three', totalAmount: 0.3, remainingAmount: 0.1 })])
     );
     const { result: single } = renderHook(() => useDebts(), {
       wrapper: ({ children }) => <FinanceProvider>{children}</FinanceProvider>,
     });
     expect(single.current.metrics.totalTarget).toBe(0.3);
     expect(single.current.metrics.remainingTarget).toBe(0.1);
     expect(single.current.metrics.paidTarget).toBe(0.2);
   });
   ```

**Why it fails today (red run):**
Before editing `src/hooks/useDebts.ts`, run `npx vitest run unit/debts-page.test.tsx -t "CS-03"` and save the output to `workflow/stages/02_build/output/logs/T783-red.log`. It must fail on `expect(result.current.metrics.totalTarget).toBe(30.3)` because `10.1 + 20.2` evaluates to `30.299999999999997`.

**Source change after the red run (`src/hooks/useDebts.ts`):**
1. Add the import at line 6 of `src/hooks/useDebts.ts`:
   ```ts
   import { roundToCents } from '../utils/money';
   ```
2. Replace lines 40-42 of `src/hooks/useDebts.ts` (`totalTarget`, `remainingTarget`, `paidTarget`) with:
   ```ts
    const totalTarget = roundToCents(liveDebts.reduce((sum, d) => sum + d.totalAmount, 0));
    const remainingTarget = roundToCents(liveDebts.reduce((sum, d) => sum + (d.isSettled ? 0 : d.remainingAmount), 0));
    const paidTarget = roundToCents(Math.max(0, totalTarget - remainingTarget));
   ```

**Ledger (`docs/audit/task-ledger.md`):**
- Add row `T783` under `## Phase 140 - Gemini trial (no ADR)` with Task `useDebts rounds totalTarget, remainingTarget and paidTarget with roundToCents (CS-03)`, Files `` `src/hooks/useDebts.ts`, `unit/debts-page.test.tsx` ``, Status `done`, empty Commit, and Gate result.
- Add a Backlog row at the end of `## Backlog` (and mark it `done in Phase 140 (T783)` per `workflow/stages/01_spec/CONTEXT.md:13`):
  `| useDebts.ts summary targets do not round reduction totals to cents | Audit 2026-10-16 (T759), finding CS-03, low; \`src/hooks/useDebts.ts:40-42\` | done in Phase 140 (T783) |`

## 7. Gates

Changed paths: `src/hooks/useDebts.ts`, `unit/debts-page.test.tsx`, `docs/audit/task-ledger.md`. Union of tiers (`src/hooks/` tier + `unit/` tier):

```
npm run lint
npx vitest run unit/debts-page.test.tsx unit/selectors-debts.test.ts unit/dashboard.test.tsx
npm run test:unit
npx playwright test tests/debts.spec.ts tests/debts-page.spec.ts --project=chromium
npx playwright test tests/debts.spec.ts tests/debts-page.spec.ts
```

Check ports 3000 and 3100 for stale dev servers before Playwright. Save full-suite output to `workflow/stages/02_build/output/logs/`. Also check line endings and em dashes:

```
git ls-files --eol src/hooks/useDebts.ts unit/debts-page.test.tsx docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T783-spec.md
```

Expect `w/crlf` on all three tracked files and `0` em dashes.

## 8. Production touch points

none.

## 9. Out of scope

- Moving `totalTarget`, `remainingTarget`, or `paidTarget` into `src/selectors/` (explicitly left in `useDebts.ts` by ADR `0079`, `docs/audit/decisions/0079-one-payoff-percent-selector.md:32`).
- Any other code in `src/hooks/useDebts.ts` (`liveDebts`, `activeWallets`, `unsettledDebts`, `settledDebts`, `progressPercent`, action callbacks, or return shape).
- `src/components/debt/DebtCard.tsx`, `src/components/debt/DebtSummaryCard.tsx`, `src/components/dashboard/DebtPayoffCard.tsx`, `src/selectors/debts.ts`, and `src/selectors/wallets.ts`.
- Any other audit finding or Backlog item (`SL-01`, `AP-01`, `AP-02`, or the T782 Backlog rows).
