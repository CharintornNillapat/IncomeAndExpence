# Build report: T774

Phase 137: Whole-pixel line height for the Hero token (CI safe-area failure from T769); Backlog row for running the layout specs on token changes (no ADR).

## Files changed (4 target files + task-ledger.md)

1. `src/index.css`:
   - Updated `--text-hero--line-height` from `1.1` to `48px`.
   - Extended comment at line 325 explaining that whole pixels are required to prevent fractional line boxes from making the page fractionally tall and causing safe-area footer clearance failures in `tests/safe-area.spec.ts`.

2. `unit/dashboard.test.tsx`:
   - Added `import { readFileSync } from 'node:fs';` after vitest import.
   - Added assertion in test "sets the figure at the Hero size" verifying `src/index.css` matches `/--text-hero--line-height:\s*\d+px;/`.

3. `DESIGN.md`:
   - Updated Hero row in scale table (line 80) to specify `48px line height` alongside 44px size and -1px tracking.

4. `docs/audit/refactor-log.md`:
   - Heading updated to `T769-T774`.
   - Appended brief explanation for T774 at the end of the brief paragraph.
   - Appended T774 changes to **Changed**.
   - Appended T774 gate results to **Verified**.
   - Appended layout specs note to **Surprises**.
   - Appended AGENTS.md rule deferral and fractional line height audit note to **Deliberately not done**.

5. `docs/audit/task-ledger.md` (bookkeeping):
   - Added T774 row under Phase 137 with `done`, empty `Commit` cell, and verified gate result.
   - Added new Backlog row at the end of the Backlog table for running layout specs on typography or spacing token changes.

Temporary edit (reverted clean):
- `src/components/dashboard/LeftOverCard.tsx:113` was temporarily changed to `text-4xl` for Step 1b, then restored with `git checkout --` and verified empty diff.

## Tests and fail-then-pass evidence

1. Step 1 (Cause confirmation):
   - Step 1a (at HEAD with token line-height 1.1):
     - Command: `npx playwright test tests/safe-area.spec.ts --project=chromium`
     - Result: Failed as predicted on portrait:
       ```
       Error: expect(received).toBeLessThanOrEqual(expected)
       Expected: <= 745
       Received:    745.390625
       ```
     - Log saved to `workflow/stages/02_build/output/logs/T774-safe-area-with-token.log`.
   - Step 1b (temporary `text-4xl` in `LeftOverCard.tsx`):
     - Command: `npx playwright test tests/safe-area.spec.ts --project=chromium`
     - Result: Both safe-area tests passed (2 passed in 14.5s).
     - Log saved to `workflow/stages/02_build/output/logs/T774-safe-area-without-token.log`.
   - Restored `LeftOverCard.tsx` clean (`git diff --stat` empty).
   - Step 1c verdict: Confirmed that the fractional line height 1.1 (48.4px) is the definitive cause of the CI safe-area failure.

2. Step 2 (Unit test red run):
   - Command: `npx vitest run unit/dashboard.test.tsx`
   - Result: 1 failed, 48 passed in 2.23s. Failed on "sets the figure at the Hero size" matching `/--text-hero--line-height:\s*\d+px;/` against `--text-hero--line-height: 1.1;` (match returned null).
   - Log saved to `workflow/stages/02_build/output/logs/T774-red.log`.

3. Post-fix pass:
   - Command: `npx vitest run unit/dashboard.test.tsx`
   - Result: All 49 tests passed in 629ms.

## Gate commands and results

1. Gate 1 (Lint):
   - Command: `npm run lint`
   - Result: Clean. Node globals checked (132 files), safe ids checked (132 files), `tsc --noEmit` and `tsc -p api/tsconfig.json` both passed.

2. Gate 2 (Dashboard unit test):
   - Command: `npx vitest run unit/dashboard.test.tsx`
   - Result: 49 passed in 2.20s.

3. Gate 3 (Full unit test suite):
   - Command: `npm run test:unit`
   - Result: 62 files passed, 1438 tests passed in 47.89s.
   - Log saved to `workflow/stages/02_build/output/logs/T774-unit.log`.

4. Gate 4 (Playwright Chromium):
   - Command: `npx playwright test tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/dashboard.spec.ts --project=chromium`
   - Result: 19 passed in 16.1s.
   - Log saved to `workflow/stages/02_build/output/logs/T774-e2e-chromium.log`.

5. Gate 5 (Playwright 3 browsers):
   - Command: `npx playwright test tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/dashboard.spec.ts`
   - Result: 51 passed, 6 skipped by design (safe-area skips on Firefox and WebKit; layout-stability layout-shift test skips on Firefox and WebKit) in 59.5s.
   - Log saved to `workflow/stages/02_build/output/logs/T774-e2e-all.log`.

6. Gate 6 (Docs test counts):
   - Command: `grep -n "1438" AGENTS.md README.md`
   - Result: Matched 1438 in both `AGENTS.md:11` and `README.md:157`.

7. Gate 7 (Line-height value landed):
   - Command: `node -e "const s=require('fs').readFileSync('src/index.css','utf8');console.log(/--text-hero--line-height:\s*48px;/.test(s))"` printed `true`.
   - Command: `grep -n "1\.1;" src/index.css` produced exit code 1 (0 matches).

8. Gate 8 (Line endings):
   - Command: `git ls-files --eol src/index.css unit/dashboard.test.tsx DESIGN.md docs/audit/refactor-log.md docs/audit/task-ledger.md`
   - Result: `w/crlf` on all five files.

9. Gate 9 (Em dashes):
   - Extracted one-liner from `workflow/stages/01_spec/CONTEXT.md:51`:
     - Added lines in diff: `0`.
     - Whole file check on this build report: `0`.

10. Gate 10 (Scope):
    - `git status --porcelain` showed only target files, `docs/audit/task-ledger.md`, and stage output files.
    - `git diff --stat src/components/dashboard/LeftOverCard.tsx tests/safe-area.spec.ts` was empty.

## Deliberately not done

- Did not loosen, skip, or edit `tests/safe-area.spec.ts` (or any spec).
- Did not change `--text-hero: 2.75rem`, font weight, tracking, or `LeftOverCard.tsx`.
- Did not audit or change other line heights in the `@theme` scale or Tailwind defaults.
- Did not edit `AGENTS.md`, `docs/contexts/ui-and-e2e.md`, or any stage file (added as Backlog row).
- Did not commit or push.
