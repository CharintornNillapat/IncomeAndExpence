# Build report: T818

Phase 150: Archive the Phase 125 to 147 baseline-metrics sections; amend the Phase 150 refactor-log entry (no ADR).

## Files changed (4 target files + task-ledger.md)

1. `docs/audit/archive/baseline-metrics-phases-125-147.md`:
   - Created new archive file containing title, note, and the verbatim Phase 125 to 147 sections (tasks T742 to T806) copied from `docs/audit/baseline-metrics.md`.
   - File ends with Phase 125 Vitest bullet and one final `\r\n` (no trailing blank line).
   - Line endings verified CRLF (`156 0`).

2. `docs/audit/baseline-metrics.md`:
   - Updated line 3 pointer paragraph to cite `archive/baseline-metrics-phases-125-147.md`.
   - Deleted lines 46 to 198 (seventeen sections and separator blank line), retaining Phase 149, Phase 148, and the closing Phase 124 summary section.
   - File length reduced from 205 lines to 52 lines.

3. `docs/audit/README.md`:
   - Updated line 27: Added `and baseline-metrics-phases-125-147.md` to the archive bullet, covering per-phase figures for Phases 125 to 147.

4. `docs/audit/refactor-log.md`:
   - Amended Phase 150 entry in place across lines 22, 24, 26, 27, 28, and 29 to cover T818 without altering file length (remains 51 lines).
   - Updated heading to T816-T818, updated brief to mention the metrics archive, updated Changed with T817 sha `dae45c8` and T818 details, appended T818 gate result to Verified, added surprise (c) on Phase 124 text, and updated Deliberately not done clauses.

5. `docs/audit/task-ledger.md` (bookkeeping):
   - Added T818 row under Phase 150 with Status `done`, Gate result filled, and `Commit` cell left empty.
   - No other lines modified.

## Tests

- Tests to add: `none` per spec section 6 (docs only; stage 02 step 4 and stage 03 step 6 do not apply).

## Gate commands and results

1. Gate 1 (Lengths):
   - `docs/audit/baseline-metrics.md`: `52` lines.
   - `docs/audit/archive/baseline-metrics-phases-125-147.md`: `156` lines.
   - `docs/audit/refactor-log.md`: `51` lines.
   - `git show HEAD:docs/audit/baseline-metrics.md | wc -l`: `205` lines (matching "205 to 52" in the entry).

2. Gate 2 (Archive byte match):
   - (a) HEAD lines 46 to 197 joined equal the archive file after its first 4 header lines: `true`.
   - (b) Live file equals HEAD lines 1 to 2, new line 3, HEAD lines 4 to 45, and HEAD lines 199 to 205 joined: `true`.

3. Gate 3 (Live headings):
   - Live phase headings in `baseline-metrics.md`: `### Phase 149 - delta against Phase 148`, `### Phase 148 - delta against Phase 147`, `### Phase 124 (latest code change)` in that order. 0 headings matching Phases 125 to 147.
   - Archive holds seventeen `### Phase` headings, from Phase 147 down to Phase 125.
   - Last live line: `- **Playwright** (local, 4 workers): 34 files, 164 tests, 492 runs, 486 passed, 6 skipped, 0 failed, in 8.2 min, first run.`, ending in one `\r\n`.

4. Gate 4 (Hunks):
   - `git diff -U0 HEAD docs/audit/baseline-metrics.md`: exactly two hunks (`@@ -3 +3 @@`, `@@ -46,153 +45,0 @@`).
   - `git diff -U0 HEAD docs/audit/README.md`: exactly one hunk (`@@ -27 +27 @@`).
   - `git diff -U0 HEAD docs/audit/refactor-log.md`: exactly three hunks (`@@ -22 +22 @@`, `@@ -24 +24 @@`, `@@ -26,4 +26,4 @@`), 6 lines removed and 6 added, no changes outside lines 22 to 29.

5. Gate 5 (Pointers resolve):
   - All 8 archive files exist: `task-ledger-phases-001-124`, `task-ledger-phases-125-135`, `task-ledger-phases-136-147`, `refactor-log-phases-001-124`, `refactor-log-phases-125-135`, `refactor-log-phases-136-147`, `baseline-metrics-phases-000-124`, `baseline-metrics-phases-125-147`.
   - `baseline-metrics.md:3` and README `:27` match section 7 exactly.

6. Gate 6 (Stated facts in entry):
   - `git cat-file -t dae45c8`: printed `commit`.
   - `git show --stat dae45c8`: lists T817 files.
   - Heading T816-T818 matches ledger rows.

7. Gate 7 (Ledger):
   - `git diff -U0 HEAD docs/audit/task-ledger.md` shows exactly one hunk, a single added row for T818 after the T817 row, with Status `done`, filled Gate result, and empty Commit cell.

8. Gate 8 (No placeholders):
   - Evaluated `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` for `/<the builder|<add|<the Gate/`: printed `false` twice.

9. Gate 9 (Line endings):
   - Tracked files: `git ls-files --eol` verified `w/crlf` across all four files.
   - Untracked archive: `156 0` (156 CRLFs, 0 bare LFs).
   - Metrics file: `52 0`.
   - Log file: `51 0`.
   - Ledger file: `93 0`.
   - README file: `50 0`.

10. Gate 10 (Em dashes):
    - Added diff lines in `git diff -U0 HEAD`: 0 em dashes (`String.fromCharCode(8212)`).
    - New archive file: 0 em dashes.
    - Build report: 0 em dashes.

11. Gate 11 (Scope):
    - `git status --porcelain`: lists only `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md`, `docs/audit/archive/baseline-metrics-phases-125-147.md`, the T818 spec and build report.

## Deliberately not done

- Did not open or read any existing file in `docs/audit/archive/`.
- No edits inside archived sections.
- No new figures section added to `baseline-metrics.md`, and no edits to Phase 149, Phase 148, or "How to measure".
- Live Phase 124 closing section left intact without rewording.
- Phase 150 title in `task-ledger.md` left untouched.
- `Commit` cells and `merged` sha left for post-merge deploy record.
- No code, test, or config files touched.
