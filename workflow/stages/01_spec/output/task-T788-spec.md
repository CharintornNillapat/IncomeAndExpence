# Spec T788: Fix CSV import money rounding to check rounded value with roundToCents and replace inline Math.round

## 1. Goal

Round CSV import row amounts with `roundToCents` before validating non-zero thresholds and replace all inline `Math.round(x * 100) / 100` rounding in `src/utils/csvExchange.ts`, ensuring sub-cent amounts that round to zero are rejected during preview validation rather than creating invalid `0.00` ledger rows that abort the entire `import_transactions` batch for a signed-in user.

## 2. Target files

```
src/utils/csvExchange.ts
unit/csv-exchange.test.ts
```

Note: Bookkeeping file `docs/audit/task-ledger.md` is always allowed and updated as described in section 7.

No ADR: this task closes a backlog finding by replacing inline rounding with the existing `roundToCents` primitive; no new rule or architecture decision. No `refactor-log.md` or `baseline-metrics.md` entry: this task does not ship the phase (closing docs follow in a subsequent task).

## 3. Context to read

`docs/contexts/client-state.md` (specifically "Money and dates", lines 47-53, and "CSV import", lines 105-113).

## 4. Current behaviour

1. `src/utils/csvExchange.ts:184-191`: Amount validation evaluates `const numAmount = parseFloat(rawAmount);` on the raw parsed float before cent rounding. For a sub-cent expense like `0.004`, `numAmount <= 0` evaluates to `false`, so no validation error is emitted and the row is marked `isValid: true`. For an adjustment of `0.004` (or `-0.004`), `numAmount === 0` evaluates to `false`, so it is also marked `isValid: true`.
2. `src/utils/csvExchange.ts:196`: `totalAmount += Math.round(numAmount * 100) / 100;` uses inlined `Math.round` rather than the canonical `roundToCents` helper.
3. `src/utils/csvExchange.ts:209`: Row amount assignment uses `amount: isNaN(numAmount) ? 0 : Math.round(numAmount * 100) / 100`. When `rawAmount` was `0.004`, this assigns `amount: 0`, producing a row with `isValid: true` and `amount: 0`.
4. `src/utils/csvExchange.ts:223`: Preview summary returns `totalAmount: Math.round(totalAmount * 100) / 100`, another inlined `Math.round` duplicate.
5. In PostgreSQL, `import_transactions` (`supabase/migrations/20260928_phase52_security_ledger.sql:404, 417-421`) rounds each row amount with `v_amount := round((v_row ->> 'amount')::numeric, 2);` and throws `22023` ('Row %: amount must be greater than zero') if `v_amount <= 0` (or `v_amount = 0` for `ADJUSTMENT`). When the CSV preview passes `amount: 0` as a valid row to `commitBulkImport`, signed-in import fails the entire batch at the database level.
6. `docs/audit/task-ledger.md:107`: Backlog item tracking this Opus review finding is currently marked `todo`.

## 5. Parity map

- **Row 1 (`addTransaction` / `setTransactionDeleted` arithmetic in `FinanceContext.tsx` vs `_ledger_apply_effect` and the ledger RPCs in `supabase/migrations/`):**
  PostgreSQL's batch RPC `import_transactions` (`supabase/migrations/20260928_phase52_security_ledger.sql:404, 417-421`) rounds row amounts with `round((v_row ->> 'amount')::numeric, 2)` and requires `v_amount > 0` for standard transactions and `v_amount <> 0` for adjustments. Client CSV validation in `parseAndValidateTransactionCsv` must match this behavior by evaluating validation thresholds on `roundToCents(rawParsedAmount)` so zero-cent amounts are caught in the preview and never dispatched to the ledger RPC.

## 6. Money invariants and tests to add

### Money invariants to maintain

1. **Single cent-rounding primitive (`src/utils/money.ts:22`):** `roundToCents` is the single cent-rounding helper across all ledger, selector, and import paths. No inlined `Math.round(x * 100) / 100` duplicates may exist in `csvExchange.ts`.
2. **Strictly non-zero stored and imported ledger records:** Non-adjustment transactions (`EXPENSE`, `INCOME`, `TRANSFER`, `DEBT_REPAYMENT`) must have `amount > 0` after rounding to whole cents; `ADJUSTMENT` entries must have `amount !== 0` after rounding to whole cents. Any CSV row whose amount rounds to `0.00` must be marked invalid (`isValid: false`) with the appropriate error message (`'Amount must be a positive number'` or `'An adjustment must not be zero'`).
3. **Database batch safety:** Invalid sub-cent rows are caught during dry-run validation so `commitBulkImport` will never pass a `0.00` row into PostgreSQL's `import_transactions`, preventing whole-batch transaction aborts.
4. **Exact preview total summation:** Preview `totalAmount` accumulates rounded cents using `roundToCents`, preventing floating-point summation drift across preview rows.
5. **Symmetrical handling of positive and negative adjustments:** Both `+0.004` and `-0.004` round to `0.00` cents and must be identified as zero adjustments, ensuring neither creates a zero-delta adjustment record.

### Tests to add

File: `unit/csv-exchange.test.ts`

Add three new tests inside the existing `describe('parseAndValidateTransactionCsv - amounts', ...)` suite:

```ts
  it('rejects an expense whose sub-cent amount rounds to zero (T788)', async () => {
    const preview = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,EXPENSE,0.004,Sub-cent zero expense'), WALLETS);
    expect(preview.rows[0].isValid).toBe(false);
    expect(preview.rows[0].errorMessage).toContain('Amount must be a positive number');
    expect(preview.validRowsCount).toBe(0);
    expect(preview.invalidRowsCount).toBe(1);
    expect(preview.totalAmount).toBe(0);
  });

  it('rejects an adjustment whose sub-cent amount rounds to zero (T788)', async () => {
    const pos = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,ADJUSTMENT,0.004,Sub-cent zero adjustment'), WALLETS);
    expect(pos.rows[0].isValid).toBe(false);
    expect(pos.rows[0].errorMessage).toContain('An adjustment must not be zero');
    expect(pos.validRowsCount).toBe(0);
    expect(pos.invalidRowsCount).toBe(1);

    const neg = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,ADJUSTMENT,-0.004,Sub-cent neg adjustment'), WALLETS);
    expect(neg.rows[0].isValid).toBe(false);
    expect(neg.rows[0].errorMessage).toContain('An adjustment must not be zero');
    expect(neg.validRowsCount).toBe(0);
    expect(neg.invalidRowsCount).toBe(1);
  });

  it('rounds valid sub-cent amounts to whole cents with roundToCents (T788)', async () => {
    const preview = await parseAndValidateTransactionCsv(
      csv(
        '2026-09-28,Cash,EXPENSE,10.004,Round down',
        '2026-09-28,Cash,INCOME,20.006,Round up'
      ),
      WALLETS
    );
    expect(preview.rows[0]).toMatchObject({ isValid: true, amount: 10 });
    expect(preview.rows[1]).toMatchObject({ isValid: true, amount: 20.01 });
    expect(preview.validRowsCount).toBe(2);
    expect(preview.invalidRowsCount).toBe(0);
    expect(preview.totalAmount).toBe(30.01);
  });
```

### Why these tests fail today (Red run expectations)

When run against the unfixed code:
1. `rejects an expense whose sub-cent amount rounds to zero (T788)`: Fails because line 189 tests `numAmount <= 0` against raw float `0.004`. Since `0.004 <= 0` is `false`, no error is pushed into `errors`, so `preview.rows[0].isValid` evaluates to `true` (and `validRowsCount` is `1`), causing `expect(preview.rows[0].isValid).toBe(false)` to fail.
2. `rejects an adjustment whose sub-cent amount rounds to zero (T788)`: Fails because line 188 tests `numAmount === 0` against raw float `0.004` (and `-0.004`). Since `0.004 === 0` is `false`, no error is pushed, so `pos.rows[0].isValid` evaluates to `true`, causing `expect(pos.rows[0].isValid).toBe(false)` to fail.
3. `rounds valid sub-cent amounts to whole cents with roundToCents (T788)`: Passes on amounts, but verifies end-to-end integration with the updated rounding logic.

## 7. Implementation details for the builder

In `src/utils/csvExchange.ts`:
1. Import `roundToCents` from `./money`:
   ```ts
   import { roundToCents } from './money';
   ```
2. In `parseAndValidateTransactionCsv`, replace the amount validation block (lines 184-191):
   Parse the raw string to float, then compute the rounded cent value:
   ```ts
   const rawParsedAmount = parseFloat(rawAmount);
   let roundedAmount = 0;
   if (isNaN(rawParsedAmount)) {
     errors.push('Amount must be a positive number');
   } else {
     const rounded = roundToCents(rawParsedAmount);
     // In JavaScript, roundToCents(-0.004) produces -0; normalize to 0.
     roundedAmount = rounded === 0 ? 0 : rounded;
     if (parsedType === 'ADJUSTMENT') {
       if (roundedAmount === 0) errors.push('An adjustment must not be zero');
     } else if (roundedAmount <= 0) {
       errors.push('Amount must be a positive number');
     }
   }
   ```
3. Update `totalAmount` accumulation (line 196):
   Replace `totalAmount += Math.round(numAmount * 100) / 100;` with:
   ```ts
   totalAmount = roundToCents(totalAmount + roundedAmount);
   ```
4. Update `validationRows` amount assignment (line 209):
   Replace `amount: isNaN(numAmount) ? 0 : Math.round(numAmount * 100) / 100,` with:
   ```ts
   amount: roundedAmount,
   ```
5. Update preview summary `totalAmount` in `resolve` (line 223):
   Replace `totalAmount: Math.round(totalAmount * 100) / 100,` with:
   ```ts
   totalAmount: roundToCents(totalAmount),
   ```
6. In `docs/audit/task-ledger.md`:
   - Update Backlog item on line 107 from `todo` to `done in Phase 141 (T788)`.
   - Add the task row for T788 under Phase 141.

## 8. Gates

The union of `AGENTS.md` verification tiers for `src/utils/csvExchange.ts` and `unit/csv-exchange.test.ts`:

1. Failing test run on unfixed code (save log to `workflow/stages/02_build/output/logs/T788-red.log`):
   ```powershell
   npx vitest run unit/csv-exchange.test.ts -t "T788"
   ```
2. Linter and type check:
   ```powershell
   npm run lint
   ```
3. Targeted unit tests:
   ```powershell
   npx vitest run unit/csv-exchange.test.ts unit/csv-import-categories.test.tsx unit/csv-import-announcer.test.tsx
   ```
4. Full unit test suite (save log to `workflow/stages/02_build/output/logs/T788-unit.log`):
   ```powershell
   npm run test:unit
   ```
5. Affected Playwright specs on Chromium (save log to `workflow/stages/02_build/output/logs/T788-e2e-chr.log`):
   ```powershell
   npx playwright test tests/csv.spec.ts tests/csv-classify.spec.ts --project=chromium
   ```
6. Affected Playwright specs on all 3 browsers (save log to `workflow/stages/02_build/output/logs/T788-e2e.log`):
   ```powershell
   npx playwright test tests/csv.spec.ts tests/csv-classify.spec.ts
   ```
7. Line endings verification (CRLF check):
   ```powershell
   git ls-files --eol src/utils/csvExchange.ts unit/csv-exchange.test.ts docs/audit/task-ledger.md
   ```
8. Em-dash check (must be 0):
   ```powershell
   node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
   ```

## 9. Production touch points

none.

## 10. Out of scope

- Do not modify `src/context/FinanceContext.tsx` (`commitBulkImport` already delegates validation to `parseAndValidateTransactionCsv` and rounds `totalAmt` with `roundToCents`).
- Do not modify `src/utils/money.ts` or alter the implementation of `roundToCents`.
- Do not modify `src/utils/mathEvaluator.ts` (`roundToTwoDecimals` is distinct from ledger cent rounding).
- Do not modify `src/utils/diaryExport.ts` (diary averages and workout rates are not currency ledger rounding).
- Do not edit any files under `supabase/`.
- Do not edit `src/components/transaction/ImportCsvModal.tsx`.
