# Build report: T784

Phase 140, branch `phase-140-gemini-trial`. Source: `docs/audit/audit-2026-10-16.md` finding AP-01 (low, lines 123-135).

## Files changed (3)

1. `api/insights.ts` (target file: use `Object.hasOwn` instead of `in` on `PATTERN_CRITERIA` and `focusCriteria`)
2. `unit/proxy-contract.test.ts` (target file: add AP-01 test suite asserting prototype degradation and own choices)
3. `docs/audit/task-ledger.md` (bookkeeping: mark T784 done under Phase 140, add AP-01 row marked done under Backlog)

## Tests added

In `unit/proxy-contract.test.ts`, added `describe('/api/insights choice validation (AP-01)')` with:
1. `it.each(['toString', 'valueOf', 'constructor'])`:
   - Verifies that prototype keys returned by upstream in `pattern.choice` degrade to `'STEADY'` and in `focus.choice` degrade to `null`.
2. `it('keeps own pattern and category choices and maps the none sentinel to null')`:
   - Verifies own pattern choice (`'IMPROVED_SAVING'`) and own category choice (`'Food & Dining'`) are preserved.
   - Verifies `'none'` category sentinel maps to `null`.

## Fail-then-pass evidence

Red run: before editing `api/insights.ts`, ran `npx vitest run unit/proxy-contract.test.ts -t "AP-01"`.
Log saved to `workflow/stages/02_build/output/logs/T784-red.log`.

Failure log:
```
 FAIL  unit/proxy-contract.test.ts > /api/insights choice validation (AP-01) > degrades Object.prototype key "toString" in pattern.choice to STEADY and in focus.choice to null
AssertionError: expected { pattern: 'toString', …(2) } to deeply equal { Object (pattern, focus, ...) }

- Expected
+ Received

  {
    "confidence": 0.85,
-   "focus": null,
-   "pattern": "STEADY",
+   "focus": "toString",
+   "pattern": "toString",
  }

 ❯ unit/proxy-contract.test.ts:921:32

Test Files  1 failed (1)
     Tests  3 failed | 1 passed | 195 skipped (199)
```

After replacing `in` with `Object.hasOwn(PATTERN_CRITERIA, pattern.choice)` and `Object.hasOwn(focusCriteria, focus.choice)` in `api/insights.ts:625-633`:
- `npx vitest run unit/proxy-contract.test.ts -t "AP-01"`: 4 passed in 462ms.
- `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`: 5 test files passed, 281 tests passed in 5.65s.

## Gate commands and results

1. `npm run lint`: clean
   - Node-globals: 132 files checked, no Node globals.
   - Safe-ids: 132 files checked, no id from time alone.
   - `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors.

2. `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`:
   - 5 test files passed, 281 tests passed in 5.65s.

3. `npm run test:unit`:
   - 63 test files passed, 1450 tests passed in 88.93s.
   - Full suite output saved to `workflow/stages/02_build/output/logs/T784-unit.log`.

4. Port check:
   - Port 3000 and 3100 clean (no stale dev servers).

5. `npx playwright test tests/insights.spec.ts --project=chromium`:
   - 2 passed in 25.3s.

6. `npx playwright test tests/insights.spec.ts`:
   - 6 passed across Chromium, Firefox, WebKit in 39.2s.

7. Formatting and scope checks:
   - `git ls-files --eol`: `w/crlf` on all three touched files (`api/insights.ts`, `unit/proxy-contract.test.ts`, `docs/audit/task-ledger.md`).
   - `git diff -U0 HEAD -- api/insights.ts`: lines 625-633 replaced with `Object.hasOwn` checks.
   - Em dash check via Node: `0` em dashes added in git diff; `0` em dashes in spec; `0` em dashes in build report.
   - `git status --porcelain`: only target files, ledger, and workflow stage outputs.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- Did not touch `validate` in `api/insights.ts` (AP-02 finding, out of scope).
- Did not modify `api/classify.ts`, `api/csp-report.ts`, or client insights files.
