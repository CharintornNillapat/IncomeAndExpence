# Review report: T788

## Round 1

### 1. Metadata
- Task: T788
- Date: 2026-10-19
- Round: 1
- Verdict: APPROVED
- Target files:
  - `src/utils/csvExchange.ts`
  - `unit/csv-exchange.test.ts`

### 2. Summary
Replaced inline `Math.round(x * 100) / 100` rounding in `src/utils/csvExchange.ts` with the canonical `roundToCents` helper from `src/utils/money.ts`. Amounts are now rounded to whole cents before validating positive thresholds and non-zero adjustment constraints (with JavaScript `-0` normalized to `0`), preventing sub-cent amounts from generating `0.00` ledger rows that would abort `import_transactions` database batches.

### 3. Invariants and parity
- **Parity map row 1 (`addTransaction` / `setTransactionDeleted` arithmetic vs `_ledger_apply_effect` and the ledger RPCs):** Verified. PostgreSQL RPC `import_transactions` (`supabase/migrations/20260928_phase52_security_ledger.sql:404, 417-421`) rounds row amounts with `round((v_row ->> 'amount')::numeric, 2)` and rejects `v_amount <= 0` (or `v_amount = 0` for `ADJUSTMENT`) with error code `22023`. Dry-run preview in `parseAndValidateTransactionCsv` now mirrors this behavior by evaluating validation thresholds against `roundToCents(rawParsedAmount)`.
- **Single cent-rounding primitive (`src/utils/money.ts:22`):** Verified. All three inline `Math.round(x * 100) / 100` expressions in `src/utils/csvExchange.ts` were eliminated; `git grep -n "Math.round" src/utils/csvExchange.ts` returned 0 matches.
- **Strictly non-zero stored and imported ledger records:** Verified. Sub-cent amounts rounding to `0.00` are flagged with `isValid: false` in the preview.
- **Preview total accumulation and precision:** `totalAmount = roundToCents(totalAmount + roundedAmount)` and `totalAmount: roundToCents(totalAmount)` prevent floating-point accumulation drift.
- **Strict mode money edge cases checked:**
  1. `0.004` EXPENSE -> rounded to `0.00`, rejected (`isValid: false`, `'Amount must be a positive number'`).
  2. `+0.004` ADJUSTMENT -> rounded to `0.00`, rejected (`isValid: false`, `'An adjustment must not be zero'`).
  3. `-0.004` ADJUSTMENT -> rounded to `-0.00`, normalized to `0`, rejected (`isValid: false`, `'An adjustment must not be zero'`).
  4. `10.004` EXPENSE -> rounded to `10.00`, accepted (`isValid: true`, `amount: 10`).
  5. `20.006` INCOME -> rounded to `20.01`, accepted (`isValid: true`, `amount: 20.01`).
  6. `-50` EXPENSE -> rounded to `-50`, rejected (`isValid: false`, `'Amount must be a positive number'`).
  7. `-1000` ADJUSTMENT -> rounded to `-1000`, accepted with sign intact (`isValid: true`, `amount: -1000`).
  8. `0` on any type -> rejected.
  9. Non-numeric / NaN amount -> rejected (`isValid: false`, `'Amount must be a positive number'`, `amount: 0`).
  10. Soft-deleted wallet/debt interactions -> existing checks in `csvExchange.ts` and `commitBulkImport` remain intact.

### 4. Gates run
1. Red run confirmation on unfixed code (via temporary stash of `src/utils/csvExchange.ts`):
   - Command: `npx vitest run unit/csv-exchange.test.ts -t "T788"`
   - Result: 1 failed file (19 tests: 2 failed, 1 passed, 16 skipped).
   - Failures matched spec expectations: expense sub-cent zero check and adjustment sub-cent zero check both received `isValid: true` instead of `false`.
   - Stash popped with `--index`; working tree restored identically.
2. Linter and type check:
   - Command: `npm run lint`
   - Result: clean (exit 0). 132 files checked for Node globals (0 found), 132 files checked for safe ids (0 found), TypeScript 0 errors across main and `api/`.
3. Targeted unit tests:
   - Command: `npx vitest run unit/csv-exchange.test.ts unit/csv-import-categories.test.tsx unit/csv-import-announcer.test.tsx`
   - Result: 3 passed files, 38 passed tests in 2.55s.
4. Full unit test suite:
   - Command: `npm run test:unit`
   - Result: 63 passed files, 1463 passed tests in 65.92s.
   - Log: `workflow/stages/03_review/output/logs/T788-unit.log`
5. Affected Playwright specs on Chromium:
   - Command: `npx playwright test tests/csv.spec.ts tests/csv-classify.spec.ts --project=chromium`
   - Result: 13 passed in 22.4s.
   - Log: `workflow/stages/03_review/output/logs/T788-e2e-chr.log`
6. Affected Playwright specs on all 3 browsers:
   - Command: `npx playwright test tests/csv.spec.ts tests/csv-classify.spec.ts`
   - Result: 39 passed in 1.0m (Chromium, Firefox, WebKit).
   - Log: `workflow/stages/03_review/output/logs/T788-e2e.log`
7. Line endings:
   - Command: `git ls-files --eol src/utils/csvExchange.ts unit/csv-exchange.test.ts docs/audit/task-ledger.md`
   - Result: all files `i/lf w/crlf`.
8. Em-dash check:
   - Result: 0 em dashes added across touched files.

### 5. Not verified
None. All gate tiers, parity mappings, and red-then-green tests were verified locally.

### 6. Blocking
None.

### 7. Non-blocking
None.

### 8. Rule candidates
None. Existing rule in `AGENTS.md` ("ledger rounding only through `roundToCents` (`src/utils/money.ts:22`)") already covers this requirement.
