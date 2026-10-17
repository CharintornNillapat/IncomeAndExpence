# T773 spec: archive Phases 125 to 135 from the refactor log, and add a Backlog row for the text-landed gate rule

Phase 137 (`phase-137-small-fixes`). Spec date 2026-10-17. No ADR: housekeeping that follows a rule already written (`docs/audit/README.md:40`), with no behaviour change. The Backlog row is a rule candidate, and a rule enters a rule file only once the code complies (`AGENTS.md`, Workflow), so it waits as a row.

## 1. Goal

Bring `docs/audit/refactor-log.md` back under its ~150-line limit (it is 211) by moving the finished Phase 125 to 135 entries into a new archive file, the way T771 moved the ledger rows, and list the new archive in `docs/audit/README.md`. Add one Backlog row for the rule the T772 reviewer suggested: a gate that checks text landed reads the expected text from the spec with a script, never retyped.

## 2. Target files

```
docs/audit/archive/refactor-log-phases-125-135.md
docs/audit/refactor-log.md
docs/audit/README.md
```

The first path is a **new** file. Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

`docs/audit/baseline-metrics.md` (95 lines) is not a target: no test is added and no bundle changes.

## 3. Context to read

None (docs-only). The builder must **not open** any existing file in `docs/audit/archive/`; the new archive file is written from the live log text, not from the old archive.

## 4. Current behaviour

**Log length.** `docs/audit/refactor-log.md` has 211 lines (`wc -l`). `docs/audit/README.md:40` says to move finished phases into a new file in `archive/` past about 150 lines. `docs/audit/task-ledger.md:69` names the same rule for the ledger.

**Entries.** The file is: title and intro (`:1` to `:8`), the entry template (`:10` to `:18`), then one entry per phase, newest first, each followed by a `---` line and a blank line. In order: Phase 137 (`:22`, still live: heading says `<sha>` placeholders), Phase 136 (`:33`, live), Phase 135 (`:44`), 134 (`:67`), 133 (`:78`), 132 (`:89`), 131 (`:100`), 130 (`:111`), 129 (`:122`), 128 (`:133`), 127 (`:144`), 126 (`:155`), 125 (`:166`, the last entry; it runs to `:211` and has no `---` after it). Phase 136's entry ends at `:41`; `:42` is the `---` between Phases 136 and 135; `:43` is blank.

**Pointer paragraph.** `docs/audit/refactor-log.md:6` reads: "**Phases 0 to 124** are in `archive/refactor-log-phases-001-124.md`. That file is history: read it only when the user asks for historical research. The last archived entry is Phase 124 (ADR `0100`, merged `46a7737`)."

**README.** `docs/audit/README.md:16` says the log holds "One entry per shipped phase from Phase 125 on". `:26` lists the archived ledger and log as "before Phase 125", with the ledger archive `task-ledger-phases-125-135.md` (added by T771) in the same bullet.

**Phase 137 entry** (`docs/audit/refactor-log.md:22` to `:29`). Its `Deliberately not done:` line (`:29`) ends with a sentence that `refactor-log.md` (211 lines) and `baseline-metrics.md` are not archived there. T773 archives the log, so that sentence is stale once this lands.

**Backlog.** The Backlog table in `docs/audit/task-ledger.md` (`:32` to `:57`) ends with the row for `setTransactionDeleted` at `:57`. The rule candidate is in `workflow/stages/03_review/output/task-T772-review.md`, section 8: "a text-landed gate reads the expected text from the spec file's code blocks with a script. It never retypes the text. Gate 3 passed on the builder's side while edit 2 differed by one character, so the expected string was not the spec's."

## 5. Parity map

None.

## 6. Tests to add

`none`. Docs only; nothing can alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

### 7.1 New archive file `docs/audit/archive/refactor-log-phases-125-135.md`

CRLF line endings (like every file in `docs/audit/`). Content, in order:

1. `# Refactor log, Phases 125 to 135 (archived)`
2. A blank line, then one paragraph: "Moved verbatim from `docs/audit/refactor-log.md` in T773 (Phases 125 to 135, tasks T742 to T767). History: read it only when the user asks for historical research."
3. A blank line, then the text of the live log's `:44` to `:211` copied **unchanged**: the Phase 135 entry down to the end of the Phase 125 entry, with the `---` separators between entries, and no trailing `---` or blank line after the last line except the file's final newline.

Copy by script (read the lines from `git show HEAD:docs/audit/refactor-log.md`), not by retyping; the lines are very long.

### 7.2 `docs/audit/refactor-log.md`

1. Delete `:42` to `:211` (the `---` after Phase 136, its blank line, and the Phase 135 to 125 entries). The file then ends with Phase 136's last line (`:41`), with its final newline and no trailing `---`.
2. Replace `:6` with exactly:

   `**Phases 0 to 124** are in `archive/refactor-log-phases-001-124.md`, and **Phases 125 to 135** in `archive/refactor-log-phases-125-135.md`. Those files are history: read them only when the user asks for historical research. The last archived entry is Phase 135 (merged `bdfc500`).`

3. In the Phase 137 entry:
   - Heading: `T769-T772` becomes `T769-T773`.
   - Brief paragraph (`:24`): add one sentence at its end: "T773 archives the Phase 125 to 135 entries of this log and adds a Backlog row for the text-landed gate rule."
   - `**Changed:**` line: append `; docs/audit/archive/refactor-log-phases-125-135.md (new, Phases 125 to 135 moved verbatim); docs/audit/refactor-log.md (pointer paragraph, entries removed); docs/audit/README.md (archive listed, live-log start moved to Phase 136); docs/audit/task-ledger.md (one Backlog row)` in the style the line already uses (keep its existing text, add before the final full stop if there is one).
   - `**Verified:**` line: append the T773 gate results from the build report (the ledger Gate result cell, word for word).
   - `**Deliberately not done:**` line: replace the sentence "`refactor-log.md` (211 lines) and `baseline-metrics.md` are not archived here; their size is a separate decision." with "`baseline-metrics.md` (95 lines) is not archived; it is under the limit." Keep every other item on that line.

### 7.3 `docs/audit/README.md`

- `:16`: "from Phase 125 on" becomes "from Phase 136 on".
- `:26`: add `refactor-log-phases-125-135.md` to the bullet, so it reads on one line: "`task-ledger-phases-001-124.md` and `refactor-log-phases-001-124.md`: the ledger and log before Phase 125. `task-ledger-phases-125-135.md` and `refactor-log-phases-125-135.md`: the ledger rows and the log entries for Phases 125 to 135."

### 7.4 `docs/audit/task-ledger.md` (bookkeeping)

1. Add the task's row at the end of the Phase 137 table (after the T772 row), `done`, `Commit` empty, with the Gate result filled when the task lands:

   `| T773 | Archive the Phase 125 to 135 refactor-log entries; Backlog row for the text-landed gate rule | `docs/audit/archive/refactor-log-phases-125-135.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md` | done | | <gate result> |``

2. Add this row at the end of the Backlog table (after the `setTransactionDeleted` row), exactly:

   `| A gate that checks text landed reads the expected text from the spec's code blocks with a script, never retyped; rule candidate for `workflow/stages/02_build/CONTEXT.md` | Phase 137, T772's review (section 8): gate 3 passed on the builder's side while edit 2 differed by one character, so the expected string was not the spec's | todo |`

   Do not touch any other Backlog row.

## 8. Gates

Docs only, so `AGENTS.md`'s docs-only row runs nothing, unless a doc states a count or path. These docs state paths and line counts, so run the checks below and report each result. Read every expected text from this spec or from `git show HEAD:` with a script; never retype it.

1. Log length: `node -e "console.log(require('fs').readFileSync('docs/audit/refactor-log.md','utf8').split('\n').length-1)"` prints a number under 150 (expected about 41).
2. Byte match: lines 44 to 211 of `git show HEAD:docs/audit/refactor-log.md` (LF text) equal the archive file after its first four lines (title, blank, note, blank), with CR removed. Compare with a Node script and print `true`.
3. The live log has no `## Phase 135` down to `## Phase 125` heading and still has `## Phase NNN` (the template), `## Phase 137` and `## Phase 136`: `grep -cE '^## Phase (12[5-9]|13[0-5]) ' docs/audit/refactor-log.md` prints 0; `grep -cE '^## Phase (136|137) ' docs/audit/refactor-log.md` prints 2. The live log's last non-empty line is not `---`.
4. The Phase 137 entry matches section 7.2 item 3: heading `T769-T773`, the stale 211-line sentence gone (`grep -c "211 lines" docs/audit/refactor-log.md` prints 0), the T773 words in Changed and Verified, every other item of the Deliberately not done line unchanged (`git diff docs/audit/refactor-log.md` shows no change in the Phase 136 entry or the template).
5. Pointers resolve: both archive files named in `docs/audit/refactor-log.md:6` and `docs/audit/README.md:26` exist (`git ls-files` for the old one, `ls` for the new one).
6. The new Backlog row is the last Backlog row, matches section 7.4 item 2 exactly, and `git diff docs/audit/task-ledger.md` shows no other Backlog line changed. The ledger stays under 150 lines.
7. Line endings: `git ls-files --eol docs/audit/refactor-log.md docs/audit/README.md docs/audit/task-ledger.md` shows `w/crlf` for all three. The new archive file is untracked, so count it with Node: `node -e "const s=require('fs').readFileSync('docs/audit/archive/refactor-log-phases-125-135.md','utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)"` prints a positive number, then `0`.
8. Em dashes: the added-lines one-liner and the whole-file one-liner in `workflow/stages/01_spec/CONTEXT.md:51` (extract them by script, do not retype) print 0 for the diff and for the new archive file, and the build report has none.
9. Scope: `git status --porcelain` lists only the target files, the ledger and the build output.

## 9. Production touch points

None.

## 10. Out of scope

- Reading or editing any existing file in `docs/audit/archive/`.
- Archiving `docs/audit/baseline-metrics.md` (95 lines, under the limit).
- Editing the Phase 136 entry, the Phase 137 entry beyond section 7.2 item 3, or the entry template.
- Editing ADR `0101` (it describes the Phase 125 archive as it was), `AGENTS.md`, or any stage file. The new rule is a Backlog row only; do not add it to `workflow/stages/02_build/CONTEXT.md`.
- Any change to code, tests or config.
