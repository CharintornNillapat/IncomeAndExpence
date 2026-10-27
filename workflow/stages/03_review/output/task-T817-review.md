## Round 1

1. **Metadata:** task T817, date 2026-10-27, round 1, verdict APPROVED. Targets: `docs/audit/archive/refactor-log-phases-136-147.md` (new), `docs/audit/refactor-log.md`, `docs/audit/README.md`; bookkeeping `docs/audit/task-ledger.md`.

2. **Summary:** Phase 136 to 147 entries (old `:44` to `:172`) moved byte for byte into a new archive file; the log keeps Phases 148 and 149 plus a new Phase 150 entry, and its `:5` pointer is updated. README `:16` and `:26` and the ledger T817 row are updated as specced. `git check-ignore -v` on the three targets printed nothing, so none is ignored.

3. **Invariants and parity:** parity map: none touched. Docs-only, no count/path claim left unchecked (see gates). Reviewer ran its own Node script (not the builder's numbers):
   - Archive header is the 4 specced lines (title, blank, note, blank); after it, the text equals HEAD `refactor-log.md` lines 44 to 172 (CR removed): `true`. Archive ends with the Phase 136 `**Deliberately not done:**` line plus one `\r\n`, no trailing `---`.
   - Log headings in order: template (`:10`), Phase 150 (`:22`), 149 (`:33`), 148 (`:44`); none of 136 to 147. Last line is the Phase 148 Deliberately-not-done line, one final `\r\n`.
   - `git diff -U0 HEAD docs/audit/refactor-log.md` has exactly three hunks: `-5 +5`, `-21,0 +22,11`, `-41,132 +51,0`. Phase 148/149 text untouched.
   - Log `:5` matches the spec text exactly. README `:16` and `:26` match section 7.3 (bullet still one line).
   - Phase 150 entry matches the spec block; `<N>` = 51, T816 gate cell copied exactly from ledger `:38`; no placeholders remain. Surprises end after (b), which the spec allows since the review found nothing off-spec.
   - Ledger diff: one hunk, the T817 row, `todo` to `done`, Gate result filled, both `Commit` cells empty.
   - Facts: `git cat-file -t c28b5ac` = commit; `git show --stat c28b5ac` shows the archive, ledger, README... (stat tail shows the ledger, the archive and the T816 stage files); `wc -l baseline-metrics.md` = 205; `c28b5ac^` ledger = 206 lines, current = 92.

4. **Gates run (docs only, no log files needed):**
   - G1 log 51 lines, archive 133: ok.
   - G2 byte match `true`.
   - G3 headings and ending: ok.
   - G4 three hunks: ok.
   - G5 six archive files exist (`true` x6): ok.
   - G6 stated facts: ok.
   - G7 ledger: ok.
   - G8 placeholder regex `false`: ok.
   - G9 eol: `git ls-files --eol` `w/crlf` for log, README, ledger; CRLF/bare-LF counts: log 51/0, archive 133/0, ledger 92/0, README 50/0: ok.
   - G10 em dashes: added diff lines 0; archive file 0: ok.
   - G11 scope: `git status --porcelain` lists only the three modified docs, the new archive file, the T817 spec and build report. Repo-wide `git diff --stat`: 3 files, +15/-136. Clean.

5. **Not verified:** the contents inside the archived entries beyond byte equality with HEAD (by design). I did not open any file in `docs/audit/archive/` other than programmatically reading the new T817 archive file for the comparison.

6. **Blocking:** none.

7. **Non-blocking:** the build report says `git show c28b5ac~1`; equivalent to `^`, fine. The "Verified" line in the entry says "ledger lines 93" for T816 (copied cell) while Surprise (a) explains 92 vs 93; consistent with the spec.

8. **Rule candidates:** none.

STATUS: T817 | APPROVED | workflow/stages/03_review/output/task-T817-review.md
