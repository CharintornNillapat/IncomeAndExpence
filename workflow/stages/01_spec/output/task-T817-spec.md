# T817 spec: archive the Phase 136 to 147 refactor-log entries; Phase 150 entry

Phase 150 (`phase-150-audit-archive`). Spec date 2026-10-27. T816 (approved, commit `c28b5ac`) archived the ledger rows; this task does the same for the refactor log and ships the phase. No ADR: housekeeping under a rule already written (`docs/audit/README.md:40`), no behaviour change. Docs only; no code, no test, no `baseline-metrics.md` section (owner decision: counts and bundle are unchanged).

## 1. Goal

Move the Phase 136 to 147 entries out of `docs/audit/refactor-log.md`, byte for byte, into a new archive file `docs/audit/archive/refactor-log-phases-136-147.md` (as T773 did for Phases 125 to 135), keeping the Phase 148 and 149 entries live. Fix the log's pointer paragraph and the two README lines T816 left for this task, add the Phase 150 entry (with `Surprises` and `Deliberately not done`) covering T816 and T817, and mark T817 done in the ledger.

## 2. Target files

```
docs/audit/archive/refactor-log-phases-136-147.md
docs/audit/refactor-log.md
docs/audit/README.md
```

The first path is a **new** file. Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

Not targets: `docs/audit/baseline-metrics.md`, `AGENTS.md`, ADR `0101`, `docs/audit/audit-2026-10-16.md`, any file already in `docs/audit/archive/`.

## 3. Context to read

None (docs only). The builder must **not open** any existing file in `docs/audit/archive/`, including `task-ledger-phases-136-147.md`; the new archive file is written from the live log text.

## 4. Current behaviour

Line numbers are `docs/audit/refactor-log.md` at HEAD `c28b5ac` (172 lines, `git ls-files --eol`: `i/lf w/crlf`; Node: 172 `\r\n`, 0 bare `\n`; the file ends with one `\r\n`).

- **Pointer paragraph, `:5`:** names the 001-124 and 125-135 archives and ends "The last archived entry is Phase 135 (merged `bdfc500`)."
- **Entry template, `:7` to `:18`;** the `---` at `:20`, then a blank line at `:21`.
- **Live entries to keep:** Phase 149 at `:22` to `:29` (heading `:22`; ends with its `**Deliberately not done:**` line at `:29`), `:30` blank, `:31` `---`, `:32` blank; Phase 148 at `:33` to `:40`.
- **Entries to move: `:44` to `:172`.** `:41` is blank and `:42` is `---` (the separator between Phase 148 and Phase 147), `:43` is blank, `:44` is `## Phase 147 - ...` (merged `2c00a6d`). The last line `:172` is the Phase 136 `**Deliberately not done:**` line; it has no `---` after it. Entries inside the block are separated by `---` with a blank line each side (for example `:52` to `:54`); those move unchanged. Phases 147 to 136 are fourteen entries (T768 to T806).
- **README, `docs/audit/README.md`:** `:16` says "One entry per shipped phase from Phase 136 on". `:26` ends "`task-ledger-phases-136-147.md`: the ledger rows for Phases 136 to 147." (T816 added that sentence).
- **Ledger, `docs/audit/task-ledger.md`:** the Phase 150 section is `:32` to `:39`; the T817 row is `:39` with Status `todo` and an empty Gate result and Commit. The T816 row (`:38`) has Commit empty and its gate result filled.
- **Other live pointers:** the only other live file that names the log is `AGENTS.md:115` and `:118` (the file name only, no phase). ADR `0014:30` cites `refactor-log.md:1942` and ADR `0101:14` cites an old line count: history, leave. Nothing else needs a change.
- **Line counts the entry may state:** `docs/audit/baseline-metrics.md` is 205 lines by `wc -l`; the ledger is 92 lines by `wc -l` (93 by a Node `split('\n')`).

## 5. Parity map

None.

## 6. Tests to add

`none`. Docs only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

All new text: CRLF line endings, no em dash, one trailing `\r\n` per file as stated. Do every move by script (read, slice, write), never by retyping; the entries are long.

### 7.1 New file `docs/audit/archive/refactor-log-phases-136-147.md`

1. `# Refactor log, Phases 136 to 147 (archived)`
2. A blank line, then: `Moved verbatim from `docs/audit/refactor-log.md` in T817 (Phases 136 to 147, tasks T768 to T806). History: read it only when the user asks for historical research.`
3. A blank line, then `docs/audit/refactor-log.md` lines `:44` to `:172` copied **unchanged** (HEAD text, CRs kept). The file ends with the Phase 136 `**Deliberately not done:**` line and one final `\r\n`; no trailing blank line and no trailing `---`.

Expected: 133 lines, 133 `\r\n`, 0 bare `\n`.

### 7.2 `docs/audit/refactor-log.md`

1. Delete `:41` to `:172` (the blank line, the `---` and all fourteen archived entries), so the file ends with the Phase 148 `**Deliberately not done:**` line (`:40`) and one `\r\n`; no trailing blank line and no trailing `---`.
2. Replace `:5` with exactly:

   `**Phases 0 to 124** are in `archive/refactor-log-phases-001-124.md`, **Phases 125 to 135** in `archive/refactor-log-phases-125-135.md`, and **Phases 136 to 147** in `archive/refactor-log-phases-136-147.md`. Those files are history: read them only when the user asks for historical research. The last archived entry is Phase 147 (merged `2c00a6d`).`
3. Insert the Phase 150 entry directly after `:21` (the blank line after the first `---`), so it is the newest entry. The block is the entry's lines, then a blank line, then `---`, then a blank line, then the existing `## Phase 149` heading (11 lines inserted in all):

   ```
   ## Phase 150 - Archive the Phase 136 to 147 ledger rows and log entries: T816-T817 (2026-10-27, docs `c28b5ac` to the T817 commit, merged `pending`)

   No ADR (housekeeping under the "keep each live file short" rule in `docs/audit/README.md`; docs only). The finished Phase 136 to 147 sections of `task-ledger.md` and entries of this log moved byte for byte into `archive/`, as Phases 125 to 135 did in Phase 137, and both live files are short again.

   **Changed:** T816 (`c28b5ac`: `docs/audit/archive/task-ledger-phases-136-147.md`: new, T768 to T806 moved verbatim; `docs/audit/task-ledger.md`: 206 to 92 lines, pointer paragraph, footer and the Phase 150 section; `docs/audit/README.md`: the ledger "from Phase 148 on" and the archive bullet). T817 (`docs/audit/archive/refactor-log-phases-136-147.md`: new, Phases 136 to 147 moved verbatim; this file: 172 lines down to <N>, pointer paragraph, this entry; `docs/audit/README.md`: the log "from Phase 148 on" and the archive bullet; `docs/audit/task-ledger.md`: the T817 row).
   **Verified:** T816: <copy the ledger's T816 gate-result cell>. The T816 review approved in round 1. T817: <the builder's gate results, in the style of the rows above: counts, byte match, headings, pointers, CRLF kept, 0 em dashes, scope clean>.
   **Surprises:** (a) T816's spec expected the ledger to end at "about 92 lines" and its gate printed 93: `wc -l` counts 92 line ends and a Node `split('\n')` counts 93 pieces, so no file differed. (b) T816 left the README's log line ("from Phase 136 on") and the log half of its archive bullet for this task, so between the two commits the README described a log that still held Phases 136 to 147. <add (c) only if the T817 build or review found something that did not go as specced; otherwise end after (b)>
   **Deliberately not done:** `baseline-metrics.md` (205 lines by `wc -l`), still past the ~150-line threshold in `docs/audit/README.md`; the order named only the ledger and the log, and moving its per-phase sections needs its own decision (the README says never rewrite an archived column); the filling of the `Commit` cells of T816 and T817 and of `merged` in this heading, left to the owner-approved deploy record after the merge; any edit inside the archived entries (shas, pointers and counts in them are as they were); ADR `0101:54` and `docs/audit/audit-2026-10-16.md:11`, which describe the earlier archives and line numbers as they were; the four code comments that point into `docs/audit/archive/` (an existing Backlog row); a `baseline-metrics.md` section (counts and bundle are unchanged since Phase 149).

   ---

   ```

   Fill `<N>` with the final line count of this file (`wc -l`; expected 51) and every `<...>` from the real runs. The two `<...>` markers are instructions: none may remain in the file. The heading's `merged `pending`` is literal text for the deploy record to replace.

### 7.3 `docs/audit/README.md`

- `:16`: "from Phase 136 on" becomes "from Phase 148 on", so the cell reads "One entry per shipped phase from Phase 148 on".
- `:26`: the last sentence "`task-ledger-phases-136-147.md`: the ledger rows for Phases 136 to 147." becomes "`task-ledger-phases-136-147.md` and `refactor-log-phases-136-147.md`: the ledger rows and the log entries for Phases 136 to 147." Keep the bullet on one line.
- `:15` already says "Tasks from Phase 148 on"; leave it.

### 7.4 `docs/audit/task-ledger.md`

Set the T817 row (`:39`) Status to `done` and fill its Gate result in the style of the T816 row (`:38`): the counts and checks of section 8, as run. Leave both `Commit` cells empty. Touch nothing else (the Files cell of T817 already lists the four paths).

## 8. Gates

Docs only, so no code tier runs (`AGENTS.md`: "Docs only: nothing, unless a doc states a count or path: check it against the code"). The counts and paths stated here are checked:

1. Log length: `node -e "const f=require('fs').readFileSync('docs/audit/refactor-log.md','utf8');console.log(f.split('\r\n').length-1)"` prints the number written into the entry as `<N>` (expected 51). The archive file's count prints 133.
2. Archive byte match: `git show HEAD:docs/audit/refactor-log.md` lines 44 to 172 (CR removed) equal the archive file after its first four lines (title, blank, note, blank), CR removed. Use a Node script that reads both and compares the strings; it prints `true`.
3. Live headings: the log has `## Phase 150`, `## Phase 149`, `## Phase 148`, in that order, and no `## Phase 136` to `## Phase 147` heading. Its `## Phase NNN - <title>` template line (inside the fenced block) is the only other `## Phase` line. The file's last line is the Phase 148 `**Deliberately not done:**` line, ending in one `\r\n`; the last non-empty line is not `---`.
4. Phase 148 and 149 untouched: `git diff -U0 HEAD docs/audit/refactor-log.md` has exactly three hunks: `:5`, the 11-line insertion after `:21`, and the deletion of the old `:41` to `:172`. No hunk touches the old `:22` to `:40` text.
5. Pointers resolve: `node -e "const fs=require('fs');for(const f of ['task-ledger-phases-001-124','task-ledger-phases-125-135','task-ledger-phases-136-147','refactor-log-phases-001-124','refactor-log-phases-125-135','refactor-log-phases-136-147'])console.log(f,fs.existsSync('docs/audit/archive/'+f+'.md'))"` prints `true` for all six. The log's `:5` and README `:16` and `:26` match section 7 exactly.
6. Stated facts in the entry: `git cat-file -t c28b5ac` prints `commit`; `git show --stat c28b5ac` shows the three T816 target files plus the ledger; `wc -l docs/audit/baseline-metrics.md` prints 205 (if it differs, correct the entry's figure); the ledger line figures 206 and 92 match `git show c28b5ac^:docs/audit/task-ledger.md | wc -l` and `wc -l docs/audit/task-ledger.md`.
7. Ledger: the T817 row is `done` with a filled Gate result; both `Commit` cells are empty; `git diff -U0 HEAD docs/audit/task-ledger.md` shows only the T817 row changed.
8. No placeholders: `node -e "const s=require('fs').readFileSync('docs/audit/refactor-log.md','utf8');console.log(/<N>|<copy|<the builder|<add/.test(s))"` prints `false`.
9. Line endings: `git ls-files --eol docs/audit/refactor-log.md docs/audit/README.md docs/audit/task-ledger.md` shows `w/crlf` for all three. For the log, the new archive file and the ledger, `node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)" <file>` prints a positive number, then `0`.
10. Em dashes: the added lines of `git diff -U0 HEAD` hold none: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"` prints 0. The new archive file: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/archive/refactor-log-phases-136-147.md` prints 0 (the archived text is verbatim; a nonzero count means the old entries already held one, so report it and do not edit it).
11. Scope: `git status --porcelain` lists only `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md`, the new archive file, the T817 spec and `workflow/stages/02_build/output/*`.

## 9. Production touch points

None.

## 10. Out of scope

- Reading or editing any existing file in `docs/audit/archive/`, and any edit inside the moved entries.
- `docs/audit/baseline-metrics.md` (no section; not archived here), `AGENTS.md`, root `README.md`, ADR `0101`, `docs/audit/audit-2026-10-16.md`.
- The Phase 148 and 149 entries, the entry template at `:7` to `:18`, and every Backlog row.
- The ledger's other rows, and filling any `Commit` cell or the `merged` sha (the deploy record does that after the merge).
- Any code, test or config file.
