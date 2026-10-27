# T816 spec: archive the Phase 136 to 147 rows from the task ledger

Phase 150 (`phase-150-audit-archive`, cut from `main` at `51e63f1`). Spec date 2026-10-27. No ADR: housekeeping that follows a rule already written (`docs/audit/README.md:40`, `docs/audit/task-ledger.md:206`), with no behaviour change. Docs only; no code, no test, no `baseline-metrics.md` section (owner decision).

## 1. Goal

Bring `docs/audit/task-ledger.md` back under its ~150-line limit (it is 206) by moving the finished Phase 136 to 147 sections, byte for byte, into a new archive file `docs/audit/archive/task-ledger-phases-136-147.md`, the way T771 moved Phases 125 to 135. Phases 148 and 149, the Backlog and the template stay live. Update the ledger's pointer line, its footer hint and `docs/audit/README.md`, and open the Phase 150 section (T816, T817).

## 2. Target files

```
docs/audit/archive/task-ledger-phases-136-147.md
docs/audit/README.md
```

The first path is a **new** file. Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

Not targets: `docs/audit/refactor-log.md` (T817 archives it and writes the phase's short entry), `docs/audit/baseline-metrics.md`, `AGENTS.md`, ADR `0101`.

## 3. Context to read

None (docs only). The builder must **not open** any existing file in `docs/audit/archive/`; the new archive file is written from the live ledger text, not from an old archive.

## 4. Current behaviour

All line numbers are `docs/audit/task-ledger.md` today (206 lines, CRLF in the working tree: `git ls-files --eol` shows `i/lf w/crlf`; Node count 206 `\r\n`, 0 bare `\n`).

- **Pointer paragraph, `:7`:** names the 001-124 and 125-135 archives and says "The live rows start at **T768**".
- **Phase 136 to 147 sections: `:9` to `:130`.** `:9` is `## Phase 136 - ...`; `:130` is the T806 row, the last row of Phase 147; `:131` is the blank line before `## Phase 148` at `:132`. They hold tasks T768 to T806. Each section is a `## Phase N - ...` heading, a branch paragraph and a table, with one blank line between sections. The T771 and T773 rows (`:25`, `:27`) mention archive paths in their text; they move unchanged.
- **Live after the move:** `## Phase 148` (`:132`, T807 and T808), `## Phase 149` (`:141`, T809 to T815), `## Backlog` (`:155`), `## Template for the next phase` (`:196`).
- **Footer, `:206`:** "move finished phases to a new `archive/task-ledger-phases-136-NNN.md`".
- **README, `docs/audit/README.md`:** `:15` says the ledger holds "Tasks from Phase 136 on"; `:26` lists the archives and ends "`task-ledger-phases-125-135.md` and `refactor-log-phases-125-135.md`: the ledger rows and the log entries for Phases 125 to 135." `:16` says the refactor log is "from Phase 136 on".
- **No other live doc, test or script points at the ledger by archived row or line.** The only hits are `docs/audit/audit-2026-10-16.md:11` (stale line numbers from before Phase 125, history, leave) and the ledger's own text.

## 5. Parity map

None.

## 6. Tests to add

`none`. Docs only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

### 7.1 New file `docs/audit/archive/task-ledger-phases-136-147.md`

CRLF line endings. Content, in order:

1. `# Task ledger, Phases 136 to 147 (archived)`
2. A blank line, then: `Moved verbatim from `docs/audit/task-ledger.md` in T816 (tasks T768 to T806). History: read it only when the user asks for historical research.`
3. A blank line, then the live ledger's `:9` to `:130` copied **unchanged** (Phases 136 to 147 with their branch paragraphs and tables, one blank line between sections). The file ends with the T806 row and one final `\r\n`; no trailing blank line.

Copy by script (read the ledger, slice lines 9 to 130, write), never by retyping; the rows are long. No Backlog rows and no template go in this file.

### 7.2 `docs/audit/task-ledger.md`

1. Delete `:9` to `:131` (the Phase 136 to 147 sections and the blank line after Phase 147), so `## Phase 148` follows the pointer paragraph after one blank line.
2. Replace `:7` with exactly:

   `**Phases 1 to 124 (tasks T1 to T741)** are in `archive/task-ledger-phases-001-124.md`, **Phases 125 to 135 (tasks T742 to T767)** in `archive/task-ledger-phases-125-135.md`, and **Phases 136 to 147 (tasks T768 to T806)** in `archive/task-ledger-phases-136-147.md`. Those files are history: read them only when the user asks for historical research. The live rows start at **T807**; a new task takes the next number after the highest id here.`
3. In the last line, change `archive/task-ledger-phases-136-NNN.md` to `archive/task-ledger-phases-148-NNN.md`.
4. Insert a new section after the Phase 149 table (after the T815 row), with one blank line before it and the existing blank line before `## Backlog` kept:

   ```
   ## Phase 150 - Archive the Phase 136 to 147 ledger rows and refactor-log entries (docs only, no ADR)

   Branch `phase-150-audit-archive`, cut from `main` at `51e63f1`. No migration.

   | # | Task | Files | Status | Commit | Gate result |
   |---|---|---|---|---|---|
   | T816 | Archive the Phase 136 to 147 ledger rows | `docs/audit/archive/task-ledger-phases-136-147.md`, `docs/audit/task-ledger.md`, `docs/audit/README.md` | done | | <gate result> |
   | T817 | Archive the Phase 136 to 147 refactor-log entries; Phase 150 refactor-log entry | `docs/audit/archive/refactor-log-phases-136-147.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md` | todo | | |
   ```

   The builder fills `<gate result>` when the task lands (style of the rows above) and leaves both `Commit` cells empty. The T817 row's Status stays `todo`; T817 is specced and built separately.

Touch no Backlog row and no Phase 148 or 149 text. The ledger ends at about 92 lines.

### 7.3 `docs/audit/README.md`

- `:15`: "Tasks from Phase 136 on" becomes "Tasks from Phase 148 on".
- `:26`: keep the bullet on one line and add the new file, so it reads: "`task-ledger-phases-001-124.md` and `refactor-log-phases-001-124.md`: the ledger and log before Phase 125. `task-ledger-phases-125-135.md` and `refactor-log-phases-125-135.md`: the ledger rows and the log entries for Phases 125 to 135. `task-ledger-phases-136-147.md`: the ledger rows for Phases 136 to 147."
- `:16` (refactor log "from Phase 136 on") stays; T817 changes it when it archives the log. T817 also adds `refactor-log-phases-136-147.md` to the `:26` bullet.

## 8. Gates

Docs only, so no code tier runs (`AGENTS.md`: "Docs only: nothing, unless a doc states a count or path: check it against the code"). The counts and paths this task states are checked here:

1. Ledger length: `node -e "const f=require('fs').readFileSync('docs/audit/task-ledger.md','utf8');console.log(f.split('\n').length)"` prints a number under 150 (expected about 93).
2. Archive byte match: `git show HEAD:docs/audit/task-ledger.md` lines 9 to 130 (LF text) equal the archive file after its first four lines (title, blank, note, blank), compared with CR removed. Check with a Node script that reads both and compares the strings.
3. Live ledger headings: it has no `## Phase 136` to `## Phase 147` heading and still has `## Phase 148`, `## Phase 149`, `## Phase 150`, `## Backlog` and `## Template for the next phase`. No table row starts with `| T768` to `| T806`: `grep -cE '^\| T(76[89]|7[7-9][0-9]|80[0-6]) ' docs/audit/task-ledger.md` prints 0 (those ids may still appear in Backlog Status cells and the pointer paragraph).
4. Backlog unchanged: `git diff -U0 docs/audit/task-ledger.md` shows no changed line between `## Backlog` and `## Template for the next phase`.
5. Pointers resolve: `node -e "const fs=require('fs');for(const f of ['task-ledger-phases-001-124','task-ledger-phases-125-135','task-ledger-phases-136-147','refactor-log-phases-001-124','refactor-log-phases-125-135'])console.log(f,fs.existsSync('docs/audit/archive/'+f+'.md'))"` prints `true` for all five. The ledger's `:7` and README `:15` and `:26` match section 7 exactly.
6. Stated ids: the first row in the archive is `| T768 |` and the last is `| T806 |`; the first live row is `| T807 |`.
7. Line endings: `git ls-files --eol docs/audit/task-ledger.md docs/audit/README.md` shows `w/crlf` for both. The new archive file is untracked, so count it with Node: `node -e "const s=require('fs').readFileSync('docs/audit/archive/task-ledger-phases-136-147.md','utf8');console.log(s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)"` prints a positive number, then `0`. The same Node check on the edited ledger prints a positive number, then `0`.
8. Em dashes: the added lines of `git diff -U0 HEAD` and the new archive file hold none. Added lines: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"` prints 0. New file: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/archive/task-ledger-phases-136-147.md` prints 0 (the archived text itself is moved verbatim; if the old rows held an em dash the count would already be nonzero in the ledger, so the builder reports it rather than editing).
9. Scope: `git status --porcelain` lists only `docs/audit/task-ledger.md`, `docs/audit/README.md`, the new archive file and `workflow/stages/02_build/output/*`.

## 9. Production touch points

None.

## 10. Out of scope

- Reading or editing any existing file in `docs/audit/archive/`.
- `docs/audit/refactor-log.md` and the refactor-log archive (T817), including `README.md:16`.
- `docs/audit/baseline-metrics.md` (no section, owner decision), `AGENTS.md`, `README.md` (repo root), ADR `0101` (`:54`, `:119` describe the earlier archives as they were), `docs/audit/audit-2026-10-16.md`.
- Rewording or reordering any Backlog row, or the Phase 148 and 149 sections.
- Any code, test or config file.
