# Build report: T785

Phase 140, branch `phase-140-gemini-trial`. Source: `docs/audit/audit-2026-10-16.md` finding AP-02 (low, lines 137-149).

## Files changed (3)

1. `api/insights.ts` (target file: destructure `changePercent` in `validate` and check that `changePercent === null || isFiniteNumber(changePercent)`)
2. `unit/proxy-contract.test.ts` (target file: add AP-02 test suite asserting rejection of non-finite/omitted changePercent and acceptance of null/finite)
3. `docs/audit/task-ledger.md` (bookkeeping: mark T785 done under Phase 140, add AP-02 row marked done under Backlog)

## Tests added

In `unit/proxy-contract.test.ts`, added `describe('/api/insights category changePercent validation (AP-02)')` with:
1. `it.each([['omitted (undefined)', undefined], ['a numeric string', '5'], ['a boolean', true], ['an object', {}]])`:
   - Verifies each non-finite/non-null `changePercent` value is rejected with 400 and `error: 'Category totals must be finite numbers.'` without calling TypeSafe.
2. `it('rejects a JSON number that parses to Infinity with 400 without calling TypeSafe')`:
   - Verifies an unquoted `1e309` parsing to `Infinity` is rejected with 400 without calling TypeSafe.
3. `it('accepts changePercent when null or a finite number and formats both cleanly in state')`:
   - Verifies valid payload with `null` and `-12.4` passes validation with 200, sends formatted strings (`no prior month`, `-12% vs last month`), and contains no `NaN`.

## Fail-then-pass evidence

Red run: before editing `api/insights.ts`, ran `npx vitest run unit/proxy-contract.test.ts -t "AP-02"`.
Log saved to `workflow/stages/02_build/output/logs/T785-red.log`.

Failure log:
```
 FAIL  unit/proxy-contract.test.ts > /api/insights category changePercent validation (AP-02) > rejects a category with changePercent omitted (undefined) with 400 without calling TypeSafe
 FAIL  unit/proxy-contract.test.ts > /api/insights category changePercent validation (AP-02) > rejects a category with changePercent a numeric string with 400 without calling TypeSafe
 FAIL  unit/proxy-contract.test.ts > /api/insights category changePercent validation (AP-02) > rejects a category with changePercent a boolean with 400 without calling TypeSafe
 FAIL  unit/proxy-contract.test.ts > /api/insights category changePercent validation (AP-02) > rejects a category with changePercent an object with 400 without calling TypeSafe
AssertionError: expected 200 to be 400 // Object.is equality

- Expected
+ Received

- 400
+ 200

 ❯ unit/proxy-contract.test.ts:986:24

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  unit/proxy-contract.test.ts > /api/insights category changePercent validation (AP-02) > rejects a JSON number that parses to Infinity with 400 without calling TypeSafe
AssertionError: expected 200 to be 400 // Object.is equality

- Expected
+ Received

- 400
+ 200

 ❯ unit/proxy-contract.test.ts:1006:24

Test Files  1 failed (1)
     Tests  5 failed | 1 passed | 199 skipped (205)
```

After updating `validate` in `api/insights.ts`:
- `npx vitest run unit/proxy-contract.test.ts -t "AP-02"`: 6 passed in 403ms.
- `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`: 5 test files passed, 287 tests passed in 2.42s.

## Gate commands and results

1. `npm run lint`: clean
   - Node-globals: 132 files checked, no Node globals.
   - Safe-ids: 132 files checked, no id from time alone.
   - `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors.

2. `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`:
   - 5 test files passed, 287 tests passed in 2.42s.

3. `npm run test:unit`:
   - 63 test files passed, 1456 tests passed in 69.41s.
   - Full suite output saved to `workflow/stages/02_build/output/logs/T785-unit.log`.

4. Port check:
   - Port 3000 and 3100 clean (no stale dev servers).

5. `npx playwright test tests/insights.spec.ts --project=chromium`:
   - 2 passed in 17.1s.

6. `npx playwright test tests/insights.spec.ts`:
   - 6 passed across Chromium, Firefox, WebKit in 25.0s.

7. Formatting and scope checks:
   - `git ls-files --eol`: `w/crlf` on all three touched files (`api/insights.ts`, `unit/proxy-contract.test.ts`, `docs/audit/task-ledger.md`).
   - `git diff -U0 HEAD -- api/insights.ts`: lines 476-485 updated with `changePercent` validation.
   - Em dash check via Node: `0` em dashes added in git diff; `0` em dashes in spec; `0` em dashes in build report.
   - `git status --porcelain`: only target files, ledger, and workflow stage outputs.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- Did not touch `handle` or `toState` in `api/insights.ts`.
- Did not modify `api/classify.ts`, `api/csp-report.ts`, or client insights files.
