# T818 spec: archive the Phase 125 to 147 sections of baseline-metrics.md; amend the Phase 150 entry

Phase 150 (`phase-150-audit-archive`). Spec date 2026-10-27. T816 (`c28b5ac`) archived the ledger rows and T817 (`dae45c8`) the refactor-log entries; both are approved and committed. This task does the same for `baseline-metrics.md`, the one live file T817 left past the ~150-line threshold, and amends the Phase 150 entry that T817 wrote. No ADR: housekeeping under a rule already written (`docs/audit/README.md:40`), no behaviour change. Docs only: no code, no test, and no new figures section (`AGENTS.md:118`: a docs-only phase adds no `baseline-metrics.md` section; test counts and bundle are unchanged since Phase 149).

## 1. Goal

Move the Phase 125 to 147 sections out of `docs/audit/baseline-metrics.md`, byte for byte, into a new archive file `docs/audit/archive/baseline-metrics-phases-125-147.md`, keeping the Phase 149 and 148 sections, the closing Phase 124 section, "How to measure" and the intro rule live. Fix the pointer line in `baseline-metrics.md` and the README archive bullet, amend the Phase 150 entry in `docs/audit/refactor-log.md` to cover T818, and add a done T818 row to the ledger.

## 2. Target files

```
docs/audit/archive/baseline-metrics-phases-125-147.md
docs/audit/baseline-metrics.md
docs/audit/refactor-log.md
docs/audit/README.md
```

The first path is a **new** file. Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

Not targets: `AGENTS.md`, ADR `0101`, `docs/audit/audit-2026-10-16.md`, any file already in `docs/audit/archive/`.

## 3. Context to read

None (docs only). The builder must **not open** any existing file in `docs/audit/archive/`; the new archive file is written from the live `baseline-metrics.md` text.

## 4. Current behaviour

Line numbers are `docs/audit/baseline-metrics.md` at HEAD `dae45c8` (205 lines; `git ls-files --eol`: `i/lf w/crlf`; Node: 205 `\r\n`, 0 bare `\n`; ends with one `\r\n`; 0 U+2014).

- **Title and pointer, `:1` to `:3`:** `:3` says "Phases 0 to 124 are in `archive/baseline-metrics-phases-000-124.md`, read only when asked to prove or disprove an improvement over an older phase. **Never rewrite an archived column.** Each phase that ships adds its section at the top of "Figures" with deltas against the one below; past about 150 lines, move the older sections to the archive."
- **How to measure, `:5` to `:22`;** `## Figures` at `:24`, blank `:25`.
- **Live sections to keep:** Phase 149 at `:26` to `:34`, blank `:35`; Phase 148 at `:36` to `:44`, blank `:45`.
- **Sections to move: `:46` to `:197`.** Seventeen sections, each a `### Phase NNN` heading, a blank line, and bullets, separated by one blank line: Phases 147, 146, 145, 144, 143, 142, 141, 140, 139, 137, 136, 135, 134, 132, 129, 127 and 125 (Phase 125 is the "(docs only)" section, `:192` to `:197`). `:46` is the Phase 147 heading; `:197` is the Phase 125 `**Vitest:**` bullet. `:198` is the blank line after it.
- **Closing section, `:199` to `:205`:** `### Phase 124 (latest code change)` and four bullets plus the heading's blank line. It is a short summary. The archive `baseline-metrics-phases-000-124.md` has only one Phase 124 heading, `## Phase 124 (dead code, the tab swipe) - delta against Phase 123` (archive `:1101`), so this live section is text found nowhere in the archive. Its label "latest code change" has been stale since Phase 125. The moved Phase 125 and 127 deltas are measured against it.
- **README, `docs/audit/README.md`:** `:17` (the live-files row for `baseline-metrics.md`: "How to measure, and the latest bundle and test figures") needs no change. `:27` reads: "- `baseline-metrics-phases-000-124.md`: every measured column before Phase 125."
- **Phase 150 entry, `docs/audit/refactor-log.md:22` to `:29`** (the log is 51 lines, `i/lf w/crlf`): heading `:22`, brief `:24`, Changed `:26`, Verified `:27`, Surprises `:28`, Deliberately not done `:29`. `:29` opens with the clause "`baseline-metrics.md` (205 lines by `wc -l`), ..." that this task makes untrue.
- **Ledger, `docs/audit/task-ledger.md`:** the Phase 150 section is `:32` to `:39`, with T816 at `:38` and T817 at `:39`; both Commit cells are empty. `:40` is blank and `:41` is `## Backlog`. The section title at `:32` names only the ledger and the log; leave it.
- **Other live references:** `AGENTS.md:114`, `:115` and `:118` name the file without a phase. ADR `0101:15` and `:55` describe the 168 KB file and the first archive as they were. Nothing else needs a change.

### The cut

Phases 125 to 147 move (the same upper bound as the ledger and the log archives, so all three live files now start at Phase 148). Phases 149 and 148 stay, as the order requires. The Phase 124 section stays live (not moved): it is not in the 000-124 archive, so moving it into a file named `125-147` would misname the file, and rewriting it is forbidden. Phase 148's text says "against Phase 147", which now points into the archive: history, leave it. Live file after the cut: 52 lines.

## 5. Parity map

None.

## 6. Tests to add

`none`. Docs only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

All new text: CRLF line endings, no em dash, one trailing `\r\n` per file as stated. Do every move by script (read, slice, write), never by retyping; the sections are long.

### 7.1 New file `docs/audit/archive/baseline-metrics-phases-125-147.md`

1. `# Baseline metrics, Phases 125 to 147 (archived)`
2. A blank line, then: `Moved verbatim from `docs/audit/baseline-metrics.md` in T818 (Phases 125 to 147, tasks T742 to T806). History: read it only when the user asks for historical research.`
3. A blank line, then `docs/audit/baseline-metrics.md` lines `:46` to `:197` copied **unchanged** (HEAD text, CRs kept). The file ends with the Phase 125 `**Vitest:**` bullet and one final `\r\n`; no trailing blank line.

The header follows the T816 and T817 archives (title, note, blank), not the 000-124 archive's longer one.

Expected: 156 lines, 156 `\r\n`, 0 bare `\n`; 17 `### Phase` headings, the first `### Phase 147 - delta against Phase 146`, the last `### Phase 125 (docs only) - delta against Phase 124`.

### 7.2 `docs/audit/baseline-metrics.md`

1. Delete `:46` to `:198` (the seventeen sections and the blank line after the last), so `:45` (blank) is followed directly by the `### Phase 124 (latest code change)` heading (old `:199`). The file ends with the old `:205` line and one `\r\n`. Expected: 52 lines.
2. Replace `:3` with exactly:

   `The figures a phase is measured against. Phases 0 to 124 are in `archive/baseline-metrics-phases-000-124.md` and **Phases 125 to 147** in `archive/baseline-metrics-phases-125-147.md`; read them only when asked to prove or disprove an improvement over an older phase. The Phase 124 section at the bottom stays as the floor the archived Phase 125 and 127 deltas start from. **Never rewrite an archived column.** Each phase that ships adds its section at the top of "Figures" with deltas against the one below; past about 150 lines, move the older sections to the archive.`

3. Touch nothing else (Phase 149, Phase 148, "How to measure", the Phase 124 section stay byte for byte).

### 7.3 `docs/audit/README.md`

- `:27`: becomes "- `baseline-metrics-phases-000-124.md` and `baseline-metrics-phases-125-147.md`: every measured column before Phase 125, and the per-phase figures for Phases 125 to 147." Keep the bullet on one line. Touch nothing else.

### 7.4 `docs/audit/refactor-log.md`: amend the Phase 150 entry in place

Edit lines `:22`, `:24`, `:26`, `:27`, `:28`, `:29` in place. **Add no line**: the log stays 51 lines. Touch nothing else.

- `:22` heading, exactly:

  `## Phase 150 - Archive the Phase 136 to 147 ledger rows and log entries and the Phase 125 to 147 figures: T816-T818 (2026-10-27, docs `c28b5ac` to the T818 commit, merged `pending`)`

- `:24` brief: replace the second sentence so the line reads exactly:

  `No ADR (housekeeping under the "keep each live file short" rule in `docs/audit/README.md`; docs only). The finished Phase 136 to 147 sections of `task-ledger.md` and entries of this log, and the Phase 125 to 147 sections of `baseline-metrics.md`, moved byte for byte into `archive/`, as Phases 125 to 135 did in Phase 137, and the three live files are short again.`

- `:26` Changed: in the T817 parenthesis, put the sha first: "T817 (`dae45c8`: `docs/audit/archive/refactor-log-phases-136-147.md`: new, ..." (the rest of the T817 text unchanged). Then append after its closing ")." a space and:

  `T818 (`docs/audit/archive/baseline-metrics-phases-125-147.md`: new, the Phase 125 to 147 sections moved verbatim; `docs/audit/baseline-metrics.md`: 205 to 52 lines, pointer paragraph; `docs/audit/README.md`: the archive bullet; this file: the heading, brief and these three lines; `docs/audit/task-ledger.md`: the T818 row).`

- `:27` Verified: append after the existing final sentence a space and `T818: <the builder's gate results, in the style of the T817 text: counts, byte match, headings, pointers, CRLF kept, 0 em dashes, scope clean>.`
- `:28` Surprises: append a space and:

  `(c) Phase 124 has two texts: the 000-124 archive's only Phase 124 heading is "dead code, the tab swipe", while the live file's closing "Phase 124 (latest code change)" section is a short summary found nowhere in the archive, and the archived Phase 125 and 127 deltas are measured against it; T818 left it live, as the floor, rather than misname the new archive's range. Its "latest code change" label has been stale since Phase 125. <add (d) only if the T818 build or review found something that did not go as specced; otherwise end after (c)>`

- `:29` Deliberately not done: (i) delete the leading clause "`baseline-metrics.md` (205 lines by `wc -l`), still past the ~150-line threshold in `docs/audit/README.md`; the order named only the ledger and the log, and moving its per-phase sections needs its own decision (the README says never rewrite an archived column); "; (ii) "the `Commit` cells of T816 and T817" becomes "the `Commit` cells of T816, T817 and T818"; (iii) "ADR `0101:54` and `docs/audit/audit-2026-10-16.md:11`" becomes "ADR `0101:15`, `:54` and `:55` and `docs/audit/audit-2026-10-16.md:11`"; (iv) append, before the final clause "a `baseline-metrics.md` section (counts and bundle are unchanged since Phase 149)", the clause "the Phase 150 section title in `task-ledger.md`, which still names only the ledger and the log archives; the rewording of the live Phase 124 section; ". The final clause stays last, ending with its period.

Fill every `<...>` from the real runs. Both markers are instructions: none may remain in the file.

### 7.5 `docs/audit/task-ledger.md`

Insert one row directly after the T817 row (`:39`), before the blank line `:40`:

`| T818 | Archive the Phase 125 to 147 baseline-metrics sections; amend the Phase 150 refactor-log entry | `docs/audit/archive/baseline-metrics-phases-125-147.md`, `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md` | done | | <the Gate result, in the style of the T817 row (`:39`): the counts and checks of section 8, as run> |`

The Commit cell is empty, as in T816 and T817. Touch nothing else; leave the T816 and T817 rows, the section title and the Backlog as they are.

## 8. Gates

Docs only, so no code tier runs (`AGENTS.md`: "Docs only: nothing, unless a doc states a count or path: check it against the code"). The counts and paths stated here are checked:

1. Lengths: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\r\n').length-1)" docs/audit/baseline-metrics.md docs/audit/archive/baseline-metrics-phases-125-147.md docs/audit/refactor-log.md` prints 52, 156 and 51 (the log is unchanged in length). `git show HEAD:docs/audit/baseline-metrics.md | wc -l` prints 205, matching the "205 to 52" in the entry.
2. Archive byte match: a Node script reads `git show HEAD:docs/audit/baseline-metrics.md`, splits on `\r\n`, and prints `true` for both: (a) HEAD lines 46 to 197 joined equal the archive file after its first four lines (title, blank, note, blank); (b) the live file equals HEAD lines 1 to 2, the new line 3, HEAD lines 4 to 45 and HEAD lines 199 to 205, joined.
3. Live headings: `### Phase` lines in `baseline-metrics.md` are exactly `149`, `148` and `124`, in that order; none of 125 to 147. The archive holds seventeen `### Phase` headings, 147 down to 125 in the order of section 4. The live file's last line is the Phase 124 `**Playwright**` bullet, ending in one `\r\n`.
4. Hunks: `git diff -U0 HEAD docs/audit/baseline-metrics.md` has exactly two hunks: `:3` and the deletion of the old `:46` to `:198`. `git diff -U0 HEAD docs/audit/README.md` has exactly one hunk, at `:27`. `git diff -U0 HEAD docs/audit/refactor-log.md` has exactly three hunks (`:22`, `:24`, and `:26` to `:29`), 6 lines removed and 6 added, and no hunk outside `:22` to `:29`.
5. Pointers resolve: `node -e "const fs=require('fs');for(const f of ['task-ledger-phases-001-124','task-ledger-phases-125-135','task-ledger-phases-136-147','refactor-log-phases-001-124','refactor-log-phases-125-135','refactor-log-phases-136-147','baseline-metrics-phases-000-124','baseline-metrics-phases-125-147'])console.log(f,fs.existsSync('docs/audit/archive/'+f+'.md'))"` prints `true` for all eight. The `baseline-metrics.md:3` and README `:27` text match section 7 exactly.
6. Stated facts in the entry: `git cat-file -t dae45c8` prints `commit`; `git show --stat dae45c8` lists the T817 files (the archive, the log, the README, the ledger); the entry's figures 205 and 52 match gate 1; the heading's "T816-T818" matches the three ledger rows.
7. Ledger: `git diff -U0 HEAD docs/audit/task-ledger.md` shows exactly one hunk, a single added row for T818 after the T817 row, with Status `done`, a filled Gate result and an empty Commit cell; the T816 and T817 Commit cells are still empty.
8. No placeholders: `node -e "const fs=require('fs');for(const f of ['docs/audit/refactor-log.md','docs/audit/task-ledger.md'])console.log(f,/<the builder|<add|<the Gate/.test(fs.readFileSync(f,'utf8')))"` prints `false` twice.
9. Line endings: `git ls-files --eol docs/audit/baseline-metrics.md docs/audit/refactor-log.md docs/audit/README.md docs/audit/task-ledger.md` shows `w/crlf` for all four. For those four and the new archive file, `node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)" <file>` prints a positive number, then `0`.
10. Em dashes: the added lines of `git diff -U0 HEAD` hold none: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"` prints 0. The new archive file: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/archive/baseline-metrics-phases-125-147.md` prints 0 (the source has none; a nonzero count means the move altered the text).
11. Scope: `git status --porcelain` lists only `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md`, the new archive file, the T818 spec and `workflow/stages/02_build/output/*`.

## 9. Production touch points

None.

## 10. Out of scope

- Reading or editing any existing file in `docs/audit/archive/`, and any edit inside the moved sections.
- A new figures section in `baseline-metrics.md`, and any edit to the Phase 149, Phase 148 and Phase 124 sections or "How to measure".
- `AGENTS.md`, root `README.md`, ADR `0101`, `docs/audit/audit-2026-10-16.md`.
- The rest of the log (the entry template, Phases 149 and 148) and every Backlog row; the ledger's Phase 150 section title and the T816 and T817 rows.
- Filling any `Commit` cell or the `merged` sha (the deploy record does that after the merge).
- Any code, test or config file.
