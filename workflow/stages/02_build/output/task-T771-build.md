# Build report: T771

Phase 137: Archive Phases 125 to 135 from the task ledger, rewrite four Backlog rows, drop a trailing blank line (no ADR).

## Files changed (4 target files + task-ledger.md)

1. `docs/audit/archive/task-ledger-phases-125-135.md`:
   - Created new archive file containing title, note, and the verbatim Phase 125 to 135 sections (tasks T742 to T767) moved from `docs/audit/task-ledger.md`.

2. `docs/audit/task-ledger.md` (bookkeeping):
   - Deleted lines 9 to 111 (Phase 125 to Phase 135 sections and the blank line before Phase 136).
   - Replaced pointer paragraph at line 7 to cite both `archive/task-ledger-phases-001-124.md` and `archive/task-ledger-phases-125-135.md`, with live rows starting at T768.
   - Added T771 row under Phase 137 section with empty Commit cell and gate results.
   - Rewrote four Backlog rows (UI-01, UI-06, UI-07, UI-08) with code styling and full paths.
   - Updated template note at the end to `archive/task-ledger-phases-136-NNN.md`.
   - File length reduced from 171 lines to 69 lines.

3. `docs/audit/README.md`:
   - Updated line 15: "Tasks from Phase 125 on" became "Tasks from Phase 136 on".
   - Updated line 26: Added `task-ledger-phases-125-135.md: the ledger rows for Phases 125 to 135` to the archive bullet.

4. `docs/audit/refactor-log.md`:
   - Updated Phase 137 header from `Small fixes: T769-T770` to `Small fixes: T769-T771`.
   - Appended T771 files to **Changed** and gate results to **Verified**.
   - Appended to **Deliberately not done**: `refactor-log.md (211 lines) and baseline-metrics.md are not archived here; their size is a separate decision.`

5. `unit/inline-math-seed.test.tsx`:
   - Removed one extra trailing blank line at the end so the file terminates with `});\r\n` (1 deletion, 0 insertions).

## Tests

- Tests to add: `none` per spec section 6 (whitespace removal in test file, docs only for remainder).

## Gate commands and results

1. Lint:
   - `npm run lint`: exit 0 (132 files in src, check:node-globals clean, check:safe-ids clean, tsc --noEmit clean, tsc -p api/tsconfig.json clean).

2. Targeted unit test:
   - `npx vitest run unit/inline-math-seed.test.tsx`: 32 tests passed in 1.22s.

3. Full unit suite:
   - `npm run test:unit`: 62 test files passed, 1438 passed in 86.30s.
   - Log path: `workflow/stages/02_build/output/logs/T771-unit.log`.

4. Doc and text checks:
   - Check 1 (Ledger line count): `node -e "const f=require('fs').readFileSync('docs/audit/task-ledger.md','utf8');console.log(f.split('\n').length)"` printed `69` (well under 150 limit).
   - Check 2 (Byte-for-byte archive match): Verified `git show HEAD:docs/audit/task-ledger.md` lines 9 to 110 (as LF text) equal the archive file after its first four header lines (CR removed). Match: true, length delta: 0.
   - Check 3 (Ledger phases and old task rows): Verified live ledger has no Phase 125-135 headings; contains `## Phase 136`, `## Phase 137`, `## Backlog`, and the template; 0 table rows matching `| T742` through `| T767`.
   - Check 4 (Backlog rows): Verified all four rows (UI-01, UI-06, UI-07, UI-08) match spec section 7.2 item 3; git diff verified no other Backlog row was modified.
   - Check 5 (Line endings): `git ls-files --eol` verified `w/crlf` for `docs/audit/task-ledger.md`, `docs/audit/README.md`, `docs/audit/refactor-log.md`, `unit/inline-math-seed.test.tsx`. Node CRLF check on untracked `docs/audit/archive/task-ledger-phases-125-135.md` returned `106 0` (106 CRLFs, 0 lone LFs).
   - Check 6 (Inline math seed test file ending): `node -e "const s=require('fs').readFileSync('unit/inline-math-seed.test.tsx','utf8');console.log(JSON.stringify(s.slice(-8)))"` printed `";\r\n});\r\n"`. `git diff --stat unit/inline-math-seed.test.tsx` confirmed 1 deletion, 0 insertions.
   - Check 7 (Em dashes): Evaluated added diff lines and archive file for U+2014; both returned 0.
   - Check 8 (Scope): `git status --porcelain` clean, showing only the 4 target files, `docs/audit/task-ledger.md`, and stage outputs.

## Deliberately not done

- Did not read or touch any existing file in `docs/audit/archive/`.
- `refactor-log.md` (211 lines) and `baseline-metrics.md` were not archived (their size is a separate decision).
- Did not touch any other Backlog row (including row 135).
- Did not edit ADR 0101, `AGENTS.md`, or any stage file.
- No changes made to the logic or assertions of `unit/inline-math-seed.test.tsx`.
