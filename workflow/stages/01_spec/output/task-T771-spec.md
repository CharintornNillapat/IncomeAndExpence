# T771 spec: archive Phases 125 to 135 from the task ledger, rewrite four Backlog rows, drop a trailing blank line

Phase 137 (`phase-137-small-fixes`). Spec date 2026-10-17. No ADR: housekeeping that follows a rule already written (`docs/audit/README.md:40`, `docs/audit/task-ledger.md:170`), with no behaviour change.

## 1. Goal

Bring `docs/audit/task-ledger.md` back under its ~150-line limit (it is 170) by moving the finished Phase 125 to 135 sections into a new archive file, the way Phases 1 to 124 were moved. Rewrite the four Backlog rows T769 added (UI-01, UI-06, UI-07, UI-08) in the style of the older rows, with file names and identifiers in code. Remove the extra blank line at the end of `unit/inline-math-seed.test.tsx`.

## 2. Target files

```
docs/audit/archive/task-ledger-phases-125-135.md
docs/audit/README.md
docs/audit/refactor-log.md
unit/inline-math-seed.test.tsx
```

The first path is a **new** file. Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

`docs/audit/baseline-metrics.md` is not a target: no test is added and no bundle changes.

## 3. Context to read

None (docs-only, plus one whitespace line in a test). The builder must **not open** any existing file in `docs/audit/archive/`; the new archive file is written from the live ledger text, not from the old archive.

## 4. Current behaviour

**Ledger length.** `docs/audit/task-ledger.md` has 170 lines. Its own last line (`:170`) says to keep it under about 150 and, past that, to "move finished phases to a new `archive/task-ledger-phases-125-NNN.md`". `docs/audit/README.md:40` says the same.

**Finished sections.** Phases 125 to 135 are `:9` to `:110` (each is a `## Phase N - ...` heading, a branch paragraph and a table; `:111` is the blank line before `## Phase 136` at `:112`). They hold tasks T742 to T767. Phases 136 (T768) and 137 (T769, T770) stay live.

**Pointer paragraph.** `:7` reads: "**Phases 1 to 124 (tasks T1 to T741)** are in `archive/task-ledger-phases-001-124.md`. That file is history: read it only when the user asks for historical research. Task ids continue from **T742**."

**README.** `docs/audit/README.md:15` says the ledger holds "Tasks from Phase 125 on". `:26` lists the archived ledger and log as "before Phase 125" and names only the 001-124 files.

**Backlog rows to rewrite** (T769 added them; all four are `done in Phase 137 (T769)`). Their first cells today (`docs/audit/task-ledger.md`):
- `:136` "InlineMathInput.tsx:136 frame uses transition-all"
- `:137` "Selector contract omits the two transfer balance test ids"
- `:138` "Dead export prefersReducedMotion"
- `:139` "Dead export RECENT_STEP"

The older rows put paths and identifiers in code and read as a sentence (for example `:143`, `:144`, `:157`). These four do not. The Source and Status cells are already right and stay as they are. Row `:135` (the Hero number, T765) is not one of the four.

**Trailing blank line.** `unit/inline-math-seed.test.tsx` ends with `});\r\n\r\n` (bytes confirmed with `od -c`; the file is `w/crlf`, index `i/lf`). T769 added that last empty line (`git show 9ca857f:unit/inline-math-seed.test.tsx` ends `});\n\n`).

## 5. Parity map

None.

## 6. Tests to add

`none`. The test file changes by one empty line and cannot alter behaviour; the other files are docs. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

### 7.1 New archive file `docs/audit/archive/task-ledger-phases-125-135.md`

CRLF line endings (like every file in `docs/audit/`). Content, in order:

1. `# Task ledger, Phases 125 to 135 (archived)`
2. A blank line, then one paragraph: "Moved verbatim from `docs/audit/task-ledger.md` in T771 (tasks T742 to T767). History: read it only when the user asks for historical research."
3. A blank line, then the text of the live ledger's `:9` to `:110` copied **unchanged**: the Phase 125 to 135 sections with their branch paragraphs and tables, a blank line between sections, no trailing blank line after the last table row except the file's final newline.

Copy by script or by selecting those lines, not by retyping; the rows are long. No Backlog rows and no template go in this file.

### 7.2 `docs/audit/task-ledger.md`

1. Delete `:9` to `:111` (the Phase 125 to 135 sections and the blank line after Phase 135), so `## Phase 136` follows the pointer paragraph after one blank line.
2. Replace `:7` with exactly:

   `**Phases 1 to 124 (tasks T1 to T741)** are in `archive/task-ledger-phases-001-124.md`, and **Phases 125 to 135 (tasks T742 to T767)** in `archive/task-ledger-phases-125-135.md`. Those files are history: read them only when the user asks for historical research. The live rows start at **T768**; a new task takes the next number after the highest id here.`

3. Rewrite the four Backlog first cells to exactly these (Source and Status cells unchanged):

   | Old first cell | New first cell |
   |---|---|
   | InlineMathInput.tsx:136 frame uses transition-all | `InlineMathInput.tsx:136`'s frame uses `transition-all` |
   | Selector contract omits the two transfer balance test ids | `docs/audit/test-selector-contract.md` omits the two transfer balance test ids |
   | Dead export prefersReducedMotion | `motion.tsx:14`'s `prefersReducedMotion` is a dead export |
   | Dead export RECENT_STEP | `RecentEntries.tsx:9`'s `RECENT_STEP` is a dead export |

4. In the last line (template note), change `archive/task-ledger-phases-125-NNN.md` to `archive/task-ledger-phases-136-NNN.md`.
5. Add the task's row at the end of the Phase 137 table, `done`, `Commit` empty, with the Gate result filled when the task lands:

   `| T771 | Archive the Phase 125 to 135 ledger rows; rewrite the four T769 Backlog rows with code names; drop a trailing blank line | `docs/audit/archive/task-ledger-phases-125-135.md`, `docs/audit/task-ledger.md`, `docs/audit/README.md`, `docs/audit/refactor-log.md`, `unit/inline-math-seed.test.tsx` | done | | <gate result> |`

   Do not touch any other Backlog row, including `:135`.

The ledger ends up about 70 lines.

### 7.3 `docs/audit/README.md`

- `:15`: "Tasks from Phase 125 on" becomes "Tasks from Phase 136 on".
- `:26`: add `task-ledger-phases-125-135.md` to that bullet, so it reads: "`task-ledger-phases-001-124.md` and `refactor-log-phases-001-124.md`: the ledger and log before Phase 125. `task-ledger-phases-125-135.md`: the ledger rows for Phases 125 to 135." (Keep the bullet on one line.)
- `:16` (refactor log "from Phase 125 on") stays: the log is not archived here.

### 7.4 `docs/audit/refactor-log.md`

In the Phase 137 entry (`:22`):
- Heading: `T769-T770` becomes `T769-T771`.
- Add T771 to the `Changed:` and `Verified:` lines in the style that entry already uses (the files above; the gate results from the build report).
- `Deliberately not done:` add: `refactor-log.md` (211 lines) and `baseline-metrics.md` are not archived here; their size is a separate decision.

Keep the entry's existing text otherwise.

### 7.5 `unit/inline-math-seed.test.tsx`

Remove one empty line at the end so the file ends `});\r\n` (a single final newline). Change nothing else.

## 8. Gates

Docs checks first, then the `unit/` tier (the test file is a changed path):

```
npm run lint
npx vitest run unit/inline-math-seed.test.tsx
npm run test:unit
```

Save the full unit run to `workflow/stages/02_build/output/logs/T771-unit.log`.

Doc and text checks (the builder reports each result):

1. `node -e "const f=require('fs').readFileSync('docs/audit/task-ledger.md','utf8');console.log(f.split('\n').length)"` prints a number under 150.
2. The archive file exists, and its Phase sections match the old ledger text byte for byte: `git show HEAD:docs/audit/task-ledger.md` lines 9 to 110 (as LF text) equal the archive file after its first four lines (title, blank, note, blank), compared with CR removed.
3. The live ledger has no `## Phase 125` to `## Phase 135` heading and still has `## Phase 136`, `## Phase 137`, `## Backlog` and the template; no table row starts with `| T742` to `| T767`: `grep -cE '^\| T(74[2-9]|75[0-9]|76[0-7]) ' docs/audit/task-ledger.md` prints 0 (those ids may still appear in Backlog Status cells and the pointer paragraph).
4. The four Backlog rows match section 7.2 item 3; the other Backlog rows are unchanged (`git diff docs/audit/task-ledger.md` shows no other Backlog line changed).
5. Line endings: `git ls-files --eol docs/audit/task-ledger.md docs/audit/README.md docs/audit/refactor-log.md unit/inline-math-seed.test.tsx` shows `w/crlf` for all four. The new archive file is untracked, so count it with Node: `node -e "const s=require('fs').readFileSync('docs/audit/archive/task-ledger-phases-125-135.md','utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)"` prints a positive number, then `0`.
6. `unit/inline-math-seed.test.tsx` ends with exactly one `\r\n` after `});`: `node -e "const s=require('fs').readFileSync('unit/inline-math-seed.test.tsx','utf8');console.log(JSON.stringify(s.slice(-8)))"` prints a string that ends `});\r\n` and does not end `\r\n\r\n`. `git diff --stat` for that file shows 1 deletion, 0 insertions.
7. Zero em dashes in the added lines: `git diff -U0 | grep '^+' | grep -cP '\x{2014}'` prints 0, and the new archive file has none.
8. Scope: `git status --porcelain` lists only the target files, the ledger and the build output.

## 9. Production touch points

None.

## 10. Out of scope

- Reading or editing any existing file in `docs/audit/archive/` (the old 001-124 ledger and the rest).
- Archiving `docs/audit/refactor-log.md` (211 lines) or `docs/audit/baseline-metrics.md`; the order names the ledger only. Raise it as a Backlog row if the builder thinks it matters.
- Rewriting any other Backlog row, including `:135`, which has `DESIGN.md` and `text-4xl` partly outside code.
- Editing ADR `0101` (`:14`, `:54`, `:119` describe the Phase 125 archive as it was), `AGENTS.md`, or any stage file.
- Any change to the test beyond the one empty line.
