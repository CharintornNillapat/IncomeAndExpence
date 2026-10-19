# Build report: T780

Phase 140, branch `phase-140-gemini-trial`. Source: `docs/audit/audit-2026-10-16.md` finding CS-02 (low).

## Files changed (3)

1. `src/context/TemplateContext.tsx` (target file: validate `updatePreset` updates through `PresetSchema.partial()`)
2. `unit/template-context.test.tsx` (target file: test `updatePreset` with `amount: MAX_AMOUNT + 1` and untrimmed `description`)
3. `docs/audit/task-ledger.md` (bookkeeping: T780 row under Phase 140, Backlog row for CS-02 marked done)

## Tests added

In `unit/template-context.test.tsx`:
1. Imported `MAX_AMOUNT` and `MAX_AMOUNT_ERROR` from `'../src/utils/money'`.
2. In `'an edit is checked before it is applied'`:
   - Added assertion checking `updatePreset(id, { amount: MAX_AMOUNT + 1 })` returns `{ success: false, error: MAX_AMOUNT_ERROR }`.
   - Updated the valid update call to include untrimmed `description: '  Oat flat white  '` and verified both `name` and `description` are trimmed in the preset.

## Fail-then-pass evidence

Red run: before changing `src/context/TemplateContext.tsx`, ran `npx vitest run unit/template-context.test.tsx`. Saved output to `workflow/stages/02_build/output/logs/T780-red.log`.

Command and failure:
```
 FAIL  unit/template-context.test.tsx > the quick templates > an edit is checked before it is applied
AssertionError: expected { success: true } to deeply equal { success: false, …(1) }

- Expected
+ Received

  {
-   "error": "Amount can't be over ฿999,999,999.99",
-   "success": false,
+   "success": true,
  }

 ❯ unit/template-context.test.tsx:75:91
```

After updating `src/context/TemplateContext.tsx`:
- `npx vitest run unit/template-context.test.tsx`: 6 passed (0 failed).

## Gate commands and results

1. `npm run lint`: clean
   - Node-globals check: 132 files checked, 0 errors.
   - Safe-ids check: 132 files checked, 0 errors.
   - `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors.

2. `npx vitest run unit/template-context.test.tsx unit/entity-ids.test.tsx unit/rerender-matrix.test.tsx`:
   - 3 test files passed, 18 tests passed (5.27s).

3. `npm run test:unit`:
   - 63 test files passed, 1444 tests passed (68.65s).
   - Saved log to `workflow/stages/02_build/output/logs/T780-unit.log`.

4. Port check:
   - Port 3000 and 3100 clean (no stale dev servers).

5. `npx playwright test tests/presets.spec.ts --project=chromium`:
   - 6 passed (51.7s).

6. `npx playwright test tests/presets.spec.ts`:
   - 18 passed across Chromium, Firefox, WebKit (47.4s).

7. Formatting and scope checks:
   - `git ls-files --eol`: `w/crlf` on `src/context/TemplateContext.tsx`, `unit/template-context.test.tsx`, and `docs/audit/task-ledger.md`.
   - Em-dash check via Node: `0` em dashes added.
   - `git status --porcelain`: clean scope (only target files, ledger, and workflow output).

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- No changes to `addPreset`, `deletePreset`, or `PresetSchema`.
