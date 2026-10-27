# Build report: T817

Phase 150: Archive the Phase 136 to 147 refactor-log entries; Phase 150 entry (no ADR).

## Files changed (3 target files + task-ledger.md)

1. `docs/audit/archive/refactor-log-phases-136-147.md`:
   - Created new archive file containing title, note, and the verbatim Phase 136 to 147 entries (tasks T768 to T806) copied from `docs/audit/refactor-log.md`.
   - File ends with Phase 136 Deliberately not done line and one final `\r\n` (no trailing blank line, no trailing `---`).
   - Line endings verified CRLF (`133 0`).

2. `docs/audit/refactor-log.md`:
   - Updated line 5 pointer paragraph to cite `archive/refactor-log-phases-136-147.md`, with last archived entry Phase 147 (merged `2c00a6d`).
   - Inserted Phase 150 entry directly after line 21, recording T816 and T817.
   - Deleted lines 41 to 172 (the archived entries and separator), so the file ends with the Phase 148 Deliberately not done line and one `\r\n`.
   - File length reduced from 172 lines to 51 lines.

3. `docs/audit/README.md`:
   - Updated line 16: "from Phase 136 on" became "from Phase 148 on".
   - Updated line 26: Added `and refactor-log-phases-136-147.md` to the archive bullet, covering the ledger rows and log entries for Phases 136 to 147.

4. `docs/audit/task-ledger.md` (bookkeeping):
   - Set T817 row status to `done`, filled Gate result cell, and left `Commit` cell empty.
   - No other lines modified.

## Tests

- Tests to add: `none` per spec section 6 (docs only; stage 02 step 4 and stage 03 step 6 do not apply).

## Gate commands and results

1. Gate 1 (Log length):
   - `node -e "const f=require('fs').readFileSync('docs/audit/refactor-log.md','utf8');console.log(f.split('\r\n').length-1)"`: printed `51` (matches `<N> = 51`).
   - Archive file count: `133`.

2. Gate 2 (Archive byte match):
   - Compared `git show HEAD:docs/audit/refactor-log.md` lines 44 to 172 (CR removed) with `docs/audit/archive/refactor-log-phases-136-147.md` after its first 4 header lines (CR removed).
   - Output: `true`.

3. Gate 3 (Live headings):
   - Live phase headings: `## Phase NNN` (template), `## Phase 150`, `## Phase 149`, `## Phase 148` in order.
   - 0 headings matching `## Phase 136` through `## Phase 147`.
   - Last non-empty line: Phase 148 `**Deliberately not done:**` line; not `---`.

4. Gate 4 (Phase 148 and 149 untouched):
   - `git diff -U0 HEAD docs/audit/refactor-log.md` has exactly three hunks (`@@ -5 +5 @@`, `@@ -21,0 +22,11 @@`, `@@ -41,132 +51,0 @@`).
   - 0 hunks touch Phase 148 and Phase 149 text.

5. Gate 5 (Pointers resolve):
   - Node check for all six archive files printed `true`: `task-ledger-phases-001-124`, `task-ledger-phases-125-135`, `task-ledger-phases-136-147`, `refactor-log-phases-001-124`, `refactor-log-phases-125-135`, `refactor-log-phases-136-147`.
   - Log line 5, README line 16, and README line 26 match spec section 7 exactly.

6. Gate 6 (Stated facts in entry):
   - `git cat-file -t c28b5ac`: printed `commit`.
   - `git show --stat c28b5ac`: confirmed 3 T816 target files plus ledger.
   - `baseline-metrics.md` lines: `205` lines.
   - `git show c28b5ac~1:docs/audit/task-ledger.md`: `206` lines; `docs/audit/task-ledger.md`: `92` lines.

7. Gate 7 (Ledger):
   - T817 row is `done` with filled Gate result; both Commit cells are empty.
   - `git diff -U0 HEAD docs/audit/task-ledger.md` shows only the T817 row changed.

8. Gate 8 (No placeholders):
   - `node -e "const s=require('fs').readFileSync('docs/audit/refactor-log.md','utf8');console.log(/<N>|<copy|<the builder|<add/.test(s))"` printed `false`.

9. Gate 9 (Line endings):
   - `git ls-files --eol docs/audit/refactor-log.md docs/audit/README.md docs/audit/task-ledger.md`: all show `w/crlf`.
   - Untracked archive: `133 0` (133 CRLF, 0 bare LF).
   - Edited log: `51 0` (51 CRLF, 0 bare LF).
   - Edited ledger: `92 0` (92 CRLF, 0 bare LF).
   - Edited README: `50 0` (50 CRLF, 0 bare LF).

10. Gate 10 (Em dashes):
    - Added diff lines in `git diff -U0 HEAD`: 0 em dashes (`String.fromCharCode(8212)`).
    - New archive file: 0 em dashes.
    - Build report: 0 em dashes.

11. Gate 11 (Scope):
    - `git status --porcelain`: lists only `docs/audit/README.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/archive/refactor-log-phases-136-147.md`, the T817 spec and build report.

## Deliberately not done

- Did not open or read any existing file in `docs/audit/archive/`.
- No edits inside archived entries.
- `baseline-metrics.md` (205 lines) left unarchived and no new section added (counts and bundle unchanged, per owner decision).
- `Commit` cells and `merged` sha left for post-merge deploy record.
- No code, test, or config files touched.
