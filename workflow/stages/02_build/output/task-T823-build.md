# Build Report - T823

## 1. Summary of Changes

Implemented Backlog row 104 (rule candidate from Phase 137, T772):
- Added a rule to `workflow/stages/02_build/CONTEXT.md` under step 5 stating that a gate that checks text landed reads the expected text from the spec file's fenced code blocks with a script, converting `\r\n` to `\n` in both texts before counting, and never from a copy typed into the command.
- Added a matching rule to `workflow/stages/01_spec/CONTEXT.md` in Rules specifying that when a spec gives the exact text an edit adds or replaces, or a text a gate checks landed, each such text is its own fenced code block that holds exactly that text without prose, ellipsis, or placeholder, and the text-landed gate names its blocks and reads them by script.
- Added the Phase 155 section to `docs/audit/task-ledger.md`, added the T823 row, and marked Backlog row 104 as `done in Phase 155 (T823)`.

## 2. Files Changed (3 files)

1. `workflow/stages/02_build/CONTEXT.md` (modified)
2. `workflow/stages/01_spec/CONTEXT.md` (modified)
3. `docs/audit/task-ledger.md` (modified bookkeeping)

## 3. Tests Added and Fail-then-Pass Evidence

This task is docs only and adds no behavioral tests (`tests to add: none` per spec section 6).

### Fail-then-Pass Evidence (Gate 1 Script)

Gate 1 script extracted directly from block 4 of `workflow/stages/01_spec/output/task-T823-spec.md` to `workflow/stages/02_build/output/logs/gate1.sh`.

#### Pre-build Run (Red State):
- Command: `bash workflow/stages/02_build/output/logs/gate1.sh`
- Result: Exit 1.
- Output:
  ```
  workflow/stages/02_build/CONTEXT.md block 0 n 0 anchor false control 0
  workflow/stages/01_spec/CONTEXT.md block 1 n 0 anchor false control 0
  docs/audit/task-ledger.md block 2 n 0 anchor false control 0
  docs/audit/task-ledger.md block 3 n 0 anchor false control 0
  ```

#### Post-build Run (Green State):
- Command: `bash workflow/stages/02_build/output/logs/gate1.sh`
- Result: Exit 0.
- Output:
  ```
  workflow/stages/02_build/CONTEXT.md block 0 n 1 anchor true control 0
  workflow/stages/01_spec/CONTEXT.md block 1 n 1 anchor true control 0
  docs/audit/task-ledger.md block 2 n 1 anchor true control 0
  docs/audit/task-ledger.md block 3 n 1 anchor true control 0
  ```

## 4. Verification Gates Run

### Gate 1: Text Landed Scripted Verification
- Script: `workflow/stages/02_build/output/logs/gate1.sh` (extracted verbatim from spec block 4).
- Result: Exit 0. All 4 text blocks occur exactly once (`n 1`), sit at their designated anchors (`anchor true`), and fail under single-character mutation negative control (`control 0`).

### Gate 2: Diff Shape
- `git diff --numstat -- workflow/stages/02_build/CONTEXT.md workflow/stages/01_spec/CONTEXT.md`:
  - `workflow/stages/01_spec/CONTEXT.md`: `1 0`
  - `workflow/stages/02_build/CONTEXT.md`: `1 0`
- `git diff -U0 -- docs/audit/task-ledger.md`: confirms diff touches only Phase 155 section and Backlog row 104.

### Gate 3: Stated References
- `workflow/stages/02_build/CONTEXT.md`: step 5 confirmed as the gate-running step and edit 1 nests directly beneath it.
- `workflow/stages/03_review/output/task-T772-review.md`: exists and Round 1 section 8 holds the text-landed rule candidate.

### Gate 4: Line Endings
- `git ls-files --eol`: `w/crlf` on `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/01_spec/CONTEXT.md`, and `docs/audit/task-ledger.md`.
- Bare LF count: 0 on all 3 touched files.

### Gate 5: Em Dashes
- Added lines diff check: 0 em dashes (`\u2014`).
- Whole-file checks on touched files, spec, and build report: 0 em dashes (`\u2014`).

### Gate 6: Working Tree Scope
- `git status --porcelain`: lists only the 3 target files, the T823 spec and build report, and the parallel untracked T824 spec.

## 5. Deliberately Not Done

- No ADR: docs-only rule change following Phase 153 and T772 precedents.
- `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`: T824 is the final task of Phase 155 and writes them.
- Backlog row 105: left for T824.
- No prose line under Phase 155 heading in `docs/audit/task-ledger.md`: deploy record writes it.
- Commit cell in `docs/audit/task-ledger.md`: left empty for deploy record.