## Round 1

### 1. Metadata

- Task: T771 (Phase 137, branch `phase-137-small-fixes`)
- Date: 2026-10-17
- Round: 1
- Verdict: APPROVED
- Target files: `docs/audit/archive/task-ledger-phases-125-135.md` (new), `docs/audit/README.md`, `docs/audit/refactor-log.md`, `unit/inline-math-seed.test.tsx`; bookkeeping `docs/audit/task-ledger.md`

### 2. Summary

Phases 125 to 135 (T742 to T767) moved out of the ledger into a new archive file, which takes the ledger from 170 to 69 lines. The pointer paragraph, template note, README ledger row and archive list, and the Phase 137 log entry follow. The four T769 Backlog rows are rewritten with code names, and the extra trailing blank line in `unit/inline-math-seed.test.tsx` is gone.

### 3. Invariants and parity

- Parity map: no row touched. Money paths and `src/` untouched.
- `git check-ignore -v` on all five targets: none ignored (rc 1).
- Scope: `git status --porcelain` shows only the four targets, the ledger, and the stage outputs (spec, build report) plus this review. No unannounced change.
- Archive content: the archive file after its first four lines equals old ledger lines 9 to 110 byte for byte (CR removed), checked by script against `git show HEAD:docs/audit/task-ledger.md`. Archive is 106 CRLF, 0 lone LF. Its header is as specced.
- Live ledger: against the old file minus lines 9 to 111, the only differences are the pointer paragraph (`:7`), the T771 row, the four Backlog first cells (Source and Status cells unchanged), and the template note. Net +1 line, which is the T771 row. No `| T742` to `| T767` row remains. Row `:135` (Hero) untouched.
- Pointer text, README `:15` and `:26`, the template note, and the four Backlog cells match spec section 7 exactly. README `:16` correctly unchanged.
- Refactor log: heading `T769-T771`; T771 added to Changed and Verified; the Deliberately not done clause is present. The rest of the entry is unchanged.
- `unit/inline-math-seed.test.tsx`: the diff is 1 deletion, 0 insertions; the file now ends `});\r\n`.
- Line endings: `git ls-files --eol` shows `w/crlf` for the four tracked targets.
- Em dashes: 0 in the added diff lines and 0 in the archive file (checked with Node; the spec's `grep -cP '\x{2014}'` errors in this Git Bash locale, see Non-blocking).
- Existing archive files: not read.

### 4. Gates run

- `npm run lint`: exit 0 (132 files in src, node-globals clean, safe-ids clean, both `tsc` passes clean). Log: `workflow/stages/03_review/output/logs/T771-lint.log`
- `npx vitest run unit/inline-math-seed.test.tsx`: 1 file, 32 passed, 0 failed.
- `npm run test:unit`: 62 files passed (62), 1438 tests passed (1438), 0 failed, 0 skipped. Log: `workflow/stages/03_review/output/logs/T771-unit.log`
- Doc checks 1 to 8 from the spec re-run by script: ledger 69 lines (under 150); archive match true; no Phase 125 to 135 heading, Phases 136 and 137, Backlog and template present; the four rows match; CRLF kept; 0 em dashes; scope clean.
- Step 6 (new tests): not applicable, the spec's tests are `none`.

### 5. Not verified

- Playwright: not required by the changed paths (docs plus one blank line in a unit file).
- The old archive files and the 001-124 ledger: not opened, per the rule.

### 6. Blocking

None.

### 7. Non-blocking

- The archive note reads "Moved verbatim from docs/audit/task-ledger.md" without the backticks the spec showed; harmless.
- The build report says the ledger went from "171 lines"; the file had 170 by the spec's count (a split-on-newline count gives 171). No effect.
- The spec's em-dash gate (`grep -cP '\x{2014}'`) fails with "character value too large" in this shell; use a Node count instead.
- `docs/audit/refactor-log.md` (211 lines) is still over the ~150 limit. This is recorded in the log's Deliberately not done line; the owner may want a Backlog row or a later task.

### 8. Rule candidates

- When a ledger archive is made, its pointer should say where live rows start (done here at `task-ledger.md:7`). Nothing to promote.

STATUS: T771 | APPROVED | workflow/stages/03_review/output/task-T771-review.md
