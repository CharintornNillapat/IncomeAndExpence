# Build report: T773

Phase 137: Archive the Phase 125 to 135 refactor-log entries; Backlog row for the text-landed gate rule (no ADR).

## Files changed (3 target files + task-ledger.md)

1. `docs/audit/archive/refactor-log-phases-125-135.md`:
   - New archive file containing title, blank line, verbatim provenance note citing T773 and Phases 125 to 135 (T742 to T767), blank line, and lines 44 to 211 of `docs/audit/refactor-log.md` copied verbatim from `git show HEAD:docs/audit/refactor-log.md`.
   - Line endings verified CRLF (`172 0`).

2. `docs/audit/refactor-log.md`:
   - Truncated lines 42 to 211, removing the Phase 135 to 125 entries and separator, bringing live log down from 212 lines to 41 lines.
   - Line 5: Updated pointer paragraph to cite `archive/refactor-log-phases-125-135.md` with last archived entry Phase 135 (merged `bdfc500`).
   - Line 22: Updated Phase 137 heading from `T769-T772` to `T769-T773`.
   - Line 24: Appended brief sentence for T773.
   - Line 26: Appended T773 files to **Changed**.
   - Line 27: Appended T773 gate results to **Verified**.
   - Line 29: Replaced stale sentence "`refactor-log.md` (211 lines) and `baseline-metrics.md` are not archived here; their size is a separate decision." with "`baseline-metrics.md` (95 lines) is not archived; it is under the limit."

3. `docs/audit/README.md`:
   - Line 16: Updated `refactor-log.md` description to "from Phase 136 on".
   - Line 26: Added `refactor-log-phases-125-135.md` to the archive bullet.

4. `docs/audit/task-ledger.md` (bookkeeping):
   - Phase 137 table: Added T773 row with `done`, empty `Commit` cell, and verified gate result string.
   - Backlog table: Added new row at the end for text-landed gate rule candidate from T772 review.

## Tests

- Tests to add: `none` per spec section 6 (docs-only task; stage 02 step 4 and stage 03 step 6 do not apply).

## Gate commands and results

1. Gate 1 (Log length):
   - Command: `node -e "console.log(require('fs').readFileSync('docs/audit/refactor-log.md','utf8').split('\n').length-1)"`
   - Output: `41` (under 150 lines).

2. Gate 2 (Byte match):
   - Command: Node script comparing lines 44 to 211 of `git show HEAD:docs/audit/refactor-log.md` (LF) with `docs/audit/archive/refactor-log-phases-125-135.md` after its first 4 lines (LF).
   - Output: `true`.

3. Gate 3 (Headings):
   - Command: `& 'C:\Program Files\Git\usr\bin\grep.exe' -cE '^## Phase (12[5-9]|13[0-5]) ' docs/audit/refactor-log.md`
   - Output: `0`.
   - Command: `& 'C:\Program Files\Git\usr\bin\grep.exe' -cE '^## Phase (136|137) ' docs/audit/refactor-log.md`
   - Output: `2`.
   - Template check: `## Phase NNN` present in file (`1` hit).
   - Last non-empty line: line 40 (`**Deliberately not done:** ...`), not `---`.

4. Gate 4 (Phase 137 entry):
   - Heading: `## Phase 137 - Small fixes: T769-T773` present.
   - Stale sentence check: `& 'C:\Program Files\Git\usr\bin\grep.exe' -c "211 lines" docs/audit/refactor-log.md` printed `0`.
   - Changed and Verified lines: T773 text verified present.
   - Deliberately not done line: all other items unchanged.
   - Phase 136 and template: `git diff docs/audit/refactor-log.md` shows 0 changes to Phase 136 entry and template.

5. Gate 5 (Pointers resolve):
   - Old archive: `git ls-files --error-unmatch docs/audit/archive/refactor-log-phases-001-124.md` printed `docs/audit/archive/refactor-log-phases-001-124.md` (exit 0).
   - New archive: `ls docs/audit/archive/refactor-log-phases-125-135.md` resolved file (33,088 bytes).

6. Gate 6 (Backlog row):
   - Match: Verified `lastBacklogRow === unquotedSpecRow` printed `true`.
   - Ledger line count: `72` lines (under 150 lines).
   - Diff: `git diff docs/audit/task-ledger.md` shows 2 added rows (1 Phase 137 row, 1 Backlog row) and 0 deleted rows.

7. Gate 7 (Line endings):
   - Tracked files: `git ls-files --eol docs/audit/refactor-log.md docs/audit/README.md docs/audit/task-ledger.md` showed `w/crlf` for all three.
   - Untracked archive: `node -e "const s=require('fs').readFileSync('docs/audit/archive/refactor-log-phases-125-135.md','utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)"` printed `172 0`.

8. Gate 8 (Em dashes):
   - Extracted one-liners from `workflow/stages/01_spec/CONTEXT.md:51`:
     - Added-lines one-liner: printed `0`.
     - Whole-file one-liner on new archive file: printed `docs/audit/archive/refactor-log-phases-125-135.md 0`.
     - Whole-file check on this build report: printed `0`.

9. Gate 9 (Scope):
   - `git status --porcelain` showed only target files, `docs/audit/task-ledger.md`, and stage output files (`task-T773-spec.md`, `task-T773-build.md`).

## Deliberately not done

- Did not read or edit any existing file in `docs/audit/archive/`.
- Did not archive `docs/audit/baseline-metrics.md` (95 lines, under the limit).
- Did not edit Phase 136 entry, the Phase 137 entry beyond section 7.2 item 3, or the entry template.
- Did not edit ADR 0101, `AGENTS.md`, or any stage file.
- Did not change any code, tests, or configuration.

## Fix round 1

Addressed the two blocking items from `workflow/stages/03_review/output/task-T773-review.md`:

### 1. Blocking fixes

1. **Blocking 1 (`docs/audit/refactor-log.md:41`)**:
   - Removed the trailing empty line after Phase 136's `Deliberately not done` line.
   - Verified that the file ends with Phase 136's `UI-06).\r\n`, with a single final newline and no extra blank line.
   - Verified that the last 4 bytes of `docs/audit/refactor-log.md` are exactly `).\r\n`.

2. **Blocking 2 (`docs/audit/task-ledger.md` and `docs/audit/refactor-log.md:27`)**:
   - Updated line count figures in the T773 Gate result cell of `docs/audit/task-ledger.md` (`log lines 40`, `ledger lines 71`).
   - Copied the Gate result cell word for word into the T773 part of the Phase 137 `Verified:` line in `docs/audit/refactor-log.md`.
   - Verified that the gate result text in `docs/audit/refactor-log.md` (before its trailing full stop) matches the ledger cell exactly (`true`).
   - Verified line counts: `docs/audit/refactor-log.md` is 40 lines (Node `\n` count and `wc -l`), and `docs/audit/task-ledger.md` is 71 lines (Node `\n` count and `wc -l`).

### 2. Gates rerun (spec gates 1, 3, 4, 6, 7, 8, 9)

1. **Gate 1 (Log length & final bytes)**:
   - Line count (`\n` count): `40` (under 150).
   - Extra check: last 4 bytes are `).\r\n` (`true`).
2. **Gate 3 (Headings & separator)**:
   - `grep -cE '^## Phase (12[5-9]|13[0-5]) '` printed `0`.
   - `grep -cE '^## Phase (136|137) '` printed `2`.
   - Template heading `## Phase NNN` present (`1` hit).
   - Last non-empty line is not `---` (`true`).
3. **Gate 4 (Phase 137 entry)**:
   - Heading `## Phase 137 - Small fixes: T769-T773` present.
   - `grep -c "211 lines"` printed `0`.
   - T773 words in Changed and Verified present.
   - Deliberately not done line items unchanged.
   - Phase 136 entry and template unchanged compared with HEAD.
4. **Gate 6 (Backlog row & ledger lines)**:
   - Last Backlog row matches spec section 7.4 item 2 exactly (`true`).
   - Ledger line count: `71` (`wc -l` and Node newline count).
   - Diff on `docs/audit/task-ledger.md`: exactly 2 added lines (1 Phase 137 row, 1 Backlog row), 0 deleted lines.
5. **Gate 7 (Line endings)**:
   - Tracked files `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md` showed `w/crlf` via `git ls-files --eol`.
   - Untracked archive `docs/audit/archive/refactor-log-phases-125-135.md` printed `172 0`.
6. **Gate 8 (Em dashes)**:
   - Added-lines one-liner from `workflow/stages/01_spec/CONTEXT.md:51`: printed `0`.
   - Whole-file one-liner on archive: `docs/audit/archive/refactor-log-phases-125-135.md 0`.
   - Whole-file check on `task-T773-build.md`: `0`.
7. **Gate 9 (Scope)**:
   - `git status --porcelain` lists only target files, `docs/audit/task-ledger.md`, and stage output files (`task-T773-spec.md`, `task-T773-build.md`, `task-T773-review.md`).
