# Review: T816

## Round 1

**Metadata:** task T816 (Phase 150, `phase-150-audit-archive`), date 2026-10-27, round 1, verdict **APPROVED**. Target files: `docs/audit/archive/task-ledger-phases-136-147.md` (new), `docs/audit/README.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on the targets printed nothing (exit 1): none is ignored.

**Summary:** The Phase 136 to 147 sections (T768 to T806) moved byte for byte from the ledger into a new archive file. The ledger pointer, footer and README lines were updated as specced, and a Phase 150 section (T816 done, T817 todo) was added. The ledger is now 93 lines (was 206).

**Invariants and parity:** The AGENTS.md parity map has no row for this change. Checked by hand:
- Archive body equals `git show HEAD:docs/audit/task-ledger.md` lines 9 to 130 with CR removed (Node script: `true`). The archive's first four lines are the title, a blank, the note, a blank, exactly as specced. It ends with one `\r\n` and no trailing blank line.
- Ledger `:7` is exactly the spec text. The footer reads `archive/task-ledger-phases-148-NNN.md`. README `:15` and `:26` match spec 7.3.
- `git diff -U0` on the ledger has three hunks only: `:7` to `:130`, the Phase 150 insert after the Phase 149 table, and the footer. The Backlog, Phase 148 and Phase 149 are untouched. `## Phase 148` follows the pointer paragraph after one blank line.
- Phase 150 section text matches spec 7.3 (ledger block). The Commit cells are empty. The T816 gate cell is filled.
- `README.md:16` is untouched, as specced (T817 changes it).

**Gates run** (docs-only tier, so no code suites; checks run by me with a Node script in the scratchpad plus git):
1. Ledger length: 93 (under 150).
2. Archive byte match: `true`.
3. Headings: 148, 149, 150, Backlog, Template, plus the template's literal `Phase NNN`. No Phase 136 to 147 heading. Rows starting `| T768` to `| T806`: 0.
4. Backlog unchanged: no hunk between `## Backlog` and `## Template`.
5. Pointers: all five archive files exist (`true` x5).
6. Ids: archive first `| T768 |`, last `| T806 |`; the live ledger's first row is `| T807 |`, then through T817.
7. Line endings: `git ls-files --eol` shows `w/crlf` for the ledger and the README. Node CRLF/bare-LF counts: archive `126 0`, ledger `92 0`.
8. Em dashes: archive 0, ledger 0, README 0.
9. Scope: `git status --porcelain` shows `M docs/audit/README.md`, `M docs/audit/task-ledger.md`, `?? docs/audit/archive/task-ledger-phases-136-147.md`, and the T816 spec and build files. `git diff --stat`: 2 files, 13 insertions, 127 deletions. Nothing unannounced.
Not run: step 6 stash (spec: tests `none`). No logs written (no full suites).

**Not verified:** Untouched archive files were not opened (rule). Whether the stale line numbers in `audit-2026-10-16.md` matter: out of scope per spec.

**Blocking:** none.

**Non-blocking:**
- The T816 gate cell says "Docs checks passed (...)" with a long list; fine, in the style of other rows.

**Rule candidates:** none.
