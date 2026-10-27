# Review: T818

## Round 1

**Metadata:** task T818, 2026-10-27, round 1, verdict **APPROVED**. Target files: `docs/audit/archive/baseline-metrics-phases-125-147.md` (new), `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on the four targets printed nothing (none ignored).

**Summary:** The Phase 125 to 147 sections (17 headings, old `:46` to `:197`) moved byte for byte into a new archive file with the T816/T817-style header. The live `baseline-metrics.md` is 52 lines (Phases 149, 148, 124), with the new `:3` pointer text. The README archive bullet, the Phase 150 refactor-log entry (6 lines edited in place, length unchanged) and one done T818 ledger row match the spec text.

**Invariants and parity:** The parity map has no row for these files. Byte match, checked by my own script (not the builder's):
- HEAD lines 46 to 197 (152 lines) equal the archive after its 4 header lines, with the final `\r\n`: `true`.
- The live file equals HEAD lines 1 to 2, the spec's new line 3, HEAD lines 4 to 45 and HEAD lines 199 to 205: `true`.
- Live `:3` equals the spec text exactly. README `:27` equals the spec text exactly.
- Archive header line 1 and note line 3 match spec 7.1. Live `### Phase` headings: 149, 148, 124 in order. Archive headings: 147, 146, 145, 144, 143, 142, 141, 140, 139, 137, 136, 135, 134, 132, 129, 127, 125. Live file's last line is the Phase 124 `**Playwright**` bullet.
- Refactor-log hunks: `-22`, `-24` and `-26,4`, so three hunks, 6 lines removed and 6 added, none outside `:22` to `:29`. The text of the heading, brief, Changed (T817 sha first, T818 appended), Verified (T818 appended), Surprises (c appended, no (d), consistent with a clean build) and Deliberately not done (i to iv) matches spec 7.4. `git cat-file -t dae45c8` prints `commit`; `git show --stat dae45c8` lists the T817 archive, log, README and ledger.
- Ledger: one hunk, one added row after T817, Status `done`, Commit cell empty, Gate result filled; the T816 and T817 Commit cells are still empty.
- Note: HEAD's blob is LF (`i/lf`), so spec gate 2's `git show ... split('\r\n')` cannot work literally. I split HEAD on `/\r?\n/` and compared against the CRLF working files. This is a spec wording flaw, not a build defect.

**Gates run:**
- Lengths (Node `\r\n` count): `baseline-metrics.md` 52, archive 156, `refactor-log.md` 51, `README.md` 50, `task-ledger.md` 93. `git show HEAD:docs/audit/baseline-metrics.md | wc -l` prints 205.
- Pointers: all 8 archive files exist (`true` x8).
- Placeholders: `/<the builder|<add|<the Gate/` on log and ledger prints `false` twice.
- Line endings: `git ls-files --eol` shows `w/crlf` for all four tracked files; CRLF count / bare-LF count is 52/0, 156/0, 51/0, 50/0, 93/0.
- Em dashes: 0 in added diff lines and 0 in each of the five files.
- Scope: `git status --porcelain` shows only the four targets, `task-ledger.md`, the new archive file, the T818 spec and the T818 build report. `git diff --stat`: 4 files, 9 insertions, 161 deletions.
- Code tiers: none (docs only). No full-suite logs, so none written to `output/logs/`.

**Not verified:** I did not open any existing file in `docs/audit/archive/` (per the order). The "T742 to T806" range in the archive note comes from the spec; I did not recheck it against the ledger archive.

**Blocking:** none.

**Non-blocking:**
- The build report's gate 2 says it compared against `git show HEAD`, which is LF. It evidently normalised line endings; no effect on the result, but the report could say so.
- Spec gate 2 should say to split HEAD on `/\r?\n/` (HEAD is LF, the working tree CRLF).

**Rule candidates:** none.
