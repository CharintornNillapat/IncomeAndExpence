# Build Report - T824

## 1. Summary of Changes

Implemented Backlog row 105 (rule candidate from Phase 137, T774):
- Updated `AGENTS.md` tier row at line 86 (`src/components/`, `src/views/`, `src/index.css`, `App.tsx`) to specify that any change to a type size, line height, font or spacing token in `src/index.css` makes `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts` affected specs.
- Added a new bullet in `docs/contexts/ui-and-e2e.md` under `## Styling and type` naming the specific tokens (`@theme` sizes, line heights, font, leading/spacing additions, iOS `@layer base` overrides, fallback font metric overrides), explaining what both layout specs verify (safe area footer clearance and side insets; below-the-fold footer and <0.001 layout shift), and citing the T774 / T769 root cause.
- Added the Phase 155 entry in `docs/audit/refactor-log.md` covering both Phase 155 tasks (T823 and T824), keeping `<sha>` placeholders for the post-merge deploy record.
- Updated `docs/audit/task-ledger.md`: appended the T824 row under `## Phase 155`, marked it `done` with gate results, and flipped Backlog row 105 from `todo` to `done in Phase 155 (T824)`.

## 2. Files Changed (4 files)

1. `AGENTS.md` (modified)
2. `docs/contexts/ui-and-e2e.md` (modified)
3. `docs/audit/refactor-log.md` (modified)
4. `docs/audit/task-ledger.md` (modified bookkeeping)

## 3. Tests Added and Fail-then-Pass Evidence

This task is docs only and alters no runtime behavior or tests (`tests to add: none` per spec section 6).

### Fail-then-Pass Evidence (Gate 1 Script)

Gate 1 script parsed tagged fenced code blocks from `workflow/stages/01_spec/output/task-T824-spec.md`.

#### Pre-build Run (Red State):
- Command: `node workflow/stages/02_build/output/logs/gate1.cjs`
- Result: Exit 1.
- Output:
  ```
  agents-old AGENTS.md 1
  agents-row AGENTS.md 0
  ui-bullet docs/contexts/ui-and-e2e.md 0
  backlog-old docs/audit/task-ledger.md 1
  backlog-row docs/audit/task-ledger.md 0
  ```

#### Post-build Run (Green State):
- Command: `node workflow/stages/02_build/output/logs/gate1.cjs`
- Result: Exit 0.
- Output:
  ```
  agents-old AGENTS.md 0 (expected 0)
  agents-row AGENTS.md 1 (expected 1)
  ui-bullet docs/contexts/ui-and-e2e.md 1 (expected 1)
  backlog-old docs/audit/task-ledger.md 0 (expected 0)
  backlog-row docs/audit/task-ledger.md 1 (expected 1)
  ```

## 4. Verification Gates Run

Saved full execution log to `workflow/stages/02_build/output/logs/T824-gates.log`.

### Gate 1: Text Landed Scripted Verification
- Result: Exit 0. All 5 spec-tagged blocks match exact expected counts.

### Gate 2: Diff Shape
- `git diff --numstat -- AGENTS.md docs/contexts/ui-and-e2e.md`:
  - `AGENTS.md`: `1 1`
  - `docs/contexts/ui-and-e2e.md`: `1 0`
- `git diff --quiet -- docs/audit/baseline-metrics.md README.md src tests unit api supabase .github vercel.json`:
  - Exit 0 (byte-identical, no changes outside target scope).

### Gate 3: Docs-only PR
- Checked all changed and untracked files across branch against main (`git diff --name-only main` and `git status --porcelain`):
  - Every file is under `docs/` or ends in `.md` (plus gitignored logs).
  - Non-docs paths: none.

### Gate 4: Named Paths and Tokens Exist
- `tests/safe-area.spec.ts` exists: true
- `tests/layout-stability.spec.ts` exists: true
- `src/index.css` token occurrences count: 6 (1 for `--text-hero--line-height: 48px`, 1 for `--font-sans:`, 4 for `IBM Plex Sans Thai Fallback`)
- `src/index.css` lines 451-452: `--text-xs: 1rem;` and `--text-sm: 1rem;`
- `browserName !== 'chromium'` checks: exactly 1 in each spec.

### Gate 5: Stated Counts Unchanged
- `AGENTS.md`: `1606 tests, 72 files` and `213 tests, 37 specs, 639 runs` unchanged.
- `docs/contexts/ui-and-e2e.md`: `213 tests in 37 specs` unchanged.
- `unit/` test files count: 72 unchanged.

### Gate 6: Ledger Checks
- `T824` row count: 1.
- `## Phase 155 - Rule candidates from Phase 137 (docs only, no ADR)` heading count: 1.
- `docs/audit/task-ledger.md` total line count: 133 (under 150 limit).

### Gate 7: Refactor Log Checks
- `## Phase 155` heading appears once at line 22, above `## Phase 154` at line 33.
- Bounded by `---` separators before and after.
- All four required labels present: `**Changed:**`, `**Verified:**`, `**Surprises:**`, `**Deliberately not done:**`.

### Gate 8: Line Endings
- `git ls-files --eol`: `w/crlf` on all four target files (`AGENTS.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`).
- Bare LF count: 0 across all four files.

### Gate 9: Em Dashes
- Added lines diff check: 0 em dashes (`\u2014`).
- Whole-file checks on all touched files: 0 em dashes (`\u2014`).

## 5. Deliberately Not Done

- No separate tier row in `AGENTS.md`: the existing row's "affected specs" wording carries the chromium-then-all-browsers rule.
- No rule for radius, shadow, or colour tokens: they alter no line box dimensions (colour changes are guarded by `node scripts/wcag-tokens.mjs`).
- No modifications to `tests/safe-area.spec.ts`, `tests/layout-stability.spec.ts`, `src/index.css`, `DESIGN.md`, or ADR 0103.
- No unit or Playwright test run: no code, test, or config files were changed.
- No `docs/audit/baseline-metrics.md` entry: unit tests (1606 tests, 72 files), Playwright (213 tests, 37 specs, 639 runs), and production bundle remain unchanged.
- Placeholders `<sha>` in `docs/audit/refactor-log.md` and empty Commit cells in `docs/audit/task-ledger.md`: left for the post-merge deploy record.
