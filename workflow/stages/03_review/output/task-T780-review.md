# Review: T780

## Round 1

1. **Metadata:**
   - **Task:** T780 - `updatePreset` validates with `PresetSchema.partial()` (CS-02)
   - **Date:** 2026-10-18
   - **Round:** 1
   - **Verdict:** APPROVED
   - **Target files:** `src/context/TemplateContext.tsx`, `unit/template-context.test.tsx`, `docs/audit/task-ledger.md`

2. **Summary:**
   `updatePreset` in `src/context/TemplateContext.tsx` now validates partial updates through `PresetSchema.partial().safeParse(updates)` instead of manual field checks, enforcing `MAX_AMOUNT`, length caps (`name <= 60`, `description <= 255`), and trimming on both `name` and `description` before checking for duplicate template names and applying `cleanedUpdates`. Unit tests in `unit/template-context.test.tsx` verify that `amount: MAX_AMOUNT + 1` fails with `MAX_AMOUNT_ERROR` and that untrimmed `description` updates are trimmed when stored.

3. **Invariants and parity:**
   - `git check-ignore -v`: exit 1 on `src/context/TemplateContext.tsx`, `unit/template-context.test.tsx`, and `docs/audit/task-ledger.md` (none ignored).
   - Scope (`git diff --stat` and `git status --porcelain`): 3 modified tracked files (`docs/audit/task-ledger.md`, `src/context/TemplateContext.tsx`, `unit/template-context.test.tsx`, +14/-17 lines) plus stage output files; no unannounced files.
   - Parity map (`AGENTS.md`): none touched (`pf_presets` is local-only per ADR 0094).
   - Every-write Zod validation invariant (`AGENTS.md` / `docs/contexts/client-state.md`): `updatePreset` validates with `PresetSchema.partial().safeParse(updates)` first and returns `{ success: false, error: formatZodIssues(validation.error) }` on failure.
   - Red-then-green stash check (step 6):
     - Step 6.1 `git status --porcelain`: `M docs/audit/task-ledger.md`, `M src/context/TemplateContext.tsx`, `M unit/template-context.test.tsx`, plus untracked spec/build files.
     - Step 6.2 `git stash push -- src/context/TemplateContext.tsx` (file is `w/crlf`).
     - Step 6.3 `npx vitest run unit/template-context.test.tsx`: 1 failed, 5 passed (`expected { success: true } to deeply equal { success: false, error: "Amount can't be over ฿999,999,999.99" }` at `unit/template-context.test.tsx:75:91`, 1.88s).
     - Step 6.4 `git stash pop --index`: `git status --porcelain` and `git ls-files --eol` (`w/crlf` on all 3 files) identical to step 6.1.
   - Text / em dashes: `0` em dashes in added lines and touched files; `w/crlf` preserved on all 3 touched files.

4. **Gates run:**
   - `npm run lint`: passed (132 files in `src` checked by `check:node-globals` and `check:safe-ids`, `tsc --noEmit` and `tsc -p api/tsconfig.json` clean, 0 errors).
   - `npx vitest run unit/template-context.test.tsx unit/entity-ids.test.tsx unit/rerender-matrix.test.tsx`: 3 files, 18 tests, 18 passed, 0 failed, 0 skipped (4.68s).
   - `npm run test:unit`: 63 files, 1444 tests, 1444 passed, 0 failed, 0 skipped (65.90s). Log: `workflow/stages/03_review/output/logs/T780-unit.log`.
   - `npx playwright test tests/presets.spec.ts --project=chromium`: 1 spec file, 6 tests, 6 passed, 0 failed, 0 skipped (17.9s). Log: `workflow/stages/03_review/output/logs/T780-playwright-chromium.log`.
   - `npx playwright test tests/presets.spec.ts`: 1 spec file across 3 browsers, 18 tests, 18 passed, 0 failed, 0 skipped (44.7s). Log: `workflow/stages/03_review/output/logs/T780-playwright-all.log`.

5. **Not verified:**
   - `docs/audit/task-ledger.md` was left out of the step 6.2 stash because no test depends on it.

6. **Blocking:**
   None.

7. **Non-blocking:**
   None.

8. **Rule candidates:**
   None (`docs/contexts/client-state.md` already mandates Zod validation and `MAX_AMOUNT` caps on every write).
