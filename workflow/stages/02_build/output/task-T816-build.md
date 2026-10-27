# Build report: T816

Phase 150: Archive the Phase 136 to 147 rows from the task ledger (no ADR).

## Files changed (2 target files + task-ledger.md)

1. `docs/audit/archive/task-ledger-phases-136-147.md`:
   - Created new archive file containing title, note, and the verbatim Phase 136 to 147 sections (tasks T768 to T806) copied from `docs/audit/task-ledger.md`.
   - File ends with T806 row and one final `\r\n` (no trailing blank line).
   - Line endings verified CRLF (`126 0`).

2. `docs/audit/README.md`:
   - Updated line 15: "Tasks from Phase 136 on" became "Tasks from Phase 148 on".
   - Updated line 26: Added `task-ledger-phases-136-147.md: the ledger rows for Phases 136 to 147.` to the archive bullet.

3. `docs/audit/task-ledger.md` (bookkeeping):
   - Deleted lines 9 to 131 (Phase 136 to 147 sections and the blank line after Phase 147).
   - Replaced pointer paragraph at line 7 to cite `archive/task-ledger-phases-136-147.md`, with live rows starting at T807.
   - Inserted `## Phase 150` section after the Phase 149 table with rows for T816 (status `done`, gate result filled, empty `Commit` cell) and T817 (status `todo`, empty `Commit` cell).
   - Updated footer note to `archive/task-ledger-phases-148-NNN.md`.
   - File length reduced from 206 lines to 92 lines (93 when split on newline).

## Tests

- Tests to add: `none` per spec section 6 (docs only; stage 02 step 4 and stage 03 step 6 do not apply).

## Gate commands and results

1. Gate 1 (Ledger length):
   - Command: `node -e "const f=require('fs').readFileSync('docs/audit/task-ledger.md','utf8');console.log(f.split('\n').length)"`
   - Output: `93` (< 150 limit).

2. Gate 2 (Archive byte match):
   - Command: Compared `git show HEAD:docs/audit/task-ledger.md` lines 9 to 130 (LF) with `docs/audit/archive/task-ledger-phases-136-147.md` after its first 4 header lines (with CR removed).
   - Output: `true`.

3. Gate 3 (Live ledger headings and table rows):
   - Headings check: contains `## Phase 148`, `## Phase 149`, `## Phase 150`, `## Backlog`, and `## Template for the next phase`. 0 headings matching `## Phase 136` through `## Phase 147`.
   - Old rows check: `& 'C:\Program Files\Git\usr\bin\grep.exe' -cE '^\| T(76[89]|7[7-9][0-9]|80[0-6]) ' docs/audit/task-ledger.md` printed `0`.

4. Gate 4 (Backlog unchanged):
   - Command: `git diff -U0 docs/audit/task-ledger.md` checked for lines between `## Backlog` and `## Template for the next phase`.
   - Output: 0 lines changed in Backlog.

5. Gate 5 (Pointers resolve):
   - Command: `node -e "const fs=require('fs');for(const f of ['task-ledger-phases-001-124','task-ledger-phases-125-135','task-ledger-phases-136-147','refactor-log-phases-001-124','refactor-log-phases-125-135'])console.log(f,fs.existsSync('docs/audit/archive/'+f+'.md'))"`
   - Output: `true` for all five files.
   - Pointer matching: Ledger line 7, README line 15, and README line 26 match spec section 7 exactly.

6. Gate 6 (Stated ids):
   - First row in archive: `| T768 |`
   - Last row in archive: `| T806 |`
   - First live row in ledger: `| T807 |`

7. Gate 7 (Line endings):
   - `git ls-files --eol docs/audit/task-ledger.md docs/audit/README.md` shows `w/crlf` for both.
   - Untracked archive file: `node -e "const s=require('fs').readFileSync('docs/audit/archive/task-ledger-phases-136-147.md','utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)"` printed `126 0` (126 CRLFs, 0 bare LFs).
   - Edited ledger file: printed `92 0` (92 CRLFs, 0 bare LFs).
   - Edited README file: printed `50 0` (50 CRLFs, 0 bare LFs).

8. Gate 8 (Em dashes):
   - Added diff lines in `git diff -U0 HEAD`: 0 em dashes (`String.fromCharCode(8212)`).
   - New archive file: 0 em dashes.
   - Build report: 0 em dashes.

9. Gate 9 (Scope):
   - `git status --porcelain`: lists only `docs/audit/README.md`, `docs/audit/task-ledger.md`, `docs/audit/archive/task-ledger-phases-136-147.md`, and workflow stage files.

## Deliberately not done

- Did not open or read any existing file in `docs/audit/archive/`.
- `docs/audit/refactor-log.md` and `baseline-metrics.md` were not touched (T817 handles refactor log archiving and entry; no metrics section per owner decision).
- Backlog rows, Phase 148, and Phase 149 rows were untouched.
- No code, test, or config files were touched.
