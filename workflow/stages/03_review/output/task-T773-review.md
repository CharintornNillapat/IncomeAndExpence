# T773 review: archive the Phase 125 to 135 refactor-log entries, Backlog row for the text-landed gate rule

## Round 2

### 1. Metadata

- **Task:** T773, Phase 137 (`phase-137-small-fixes`)
- **Date:** 2026-10-17
- **Round:** 2 (fix round 1)
- **Verdict:** APPROVED
- **Target files:** as round 1. `git check-ignore -v`: none ignored (round 1).

### 2. Summary

Both blocking items are fixed. The live log now ends `UI-06).\r\n` with no blank line, and the T773 Gate result cell and the Verified line both say `log lines 40` and `ledger lines 71`, which match the files.

### 3. Invariants and parity

- **Parity map:** no row touched.
- **Blocking 1:** fixed. Last bytes of `docs/audit/refactor-log.md` are `I-06).\r\n`; 40 lines; 0 bare LF.
- **Blocking 2:** fixed. The ledger cell and the Verified line's T773 part are equal (the Verified part is the cell plus a final full stop, checked by script). `wc -l` of the ledger is 71.
- **Nothing else moved:** numstat is 2/2 (README), 6/177 (log), 2/0 (ledger). The log's deletions went up by one, the removed blank line. Archive byte match against `HEAD` lines 44 to 211 still `true`; Phase 136 entry and template equal HEAD; the new Backlog row is still the last Backlog row and occurs once.

### 4. Gates run

| # | Command | Result |
|---|---|---|
| 1 | Log length (Node, `\n` count) and last bytes | `40`; ends `).\r\n` |
| 2 | Byte match of the archive against HEAD lines 44 to 211 | `true`; archive `172 0` (CRLF, bare LF) |
| 3 | `grep -cE '^## Phase (12[5-9]\|13[0-5]) '` / `grep -cE '^## Phase (136\|137) '` / `grep -c "211 lines"` | `0` / `2` / `0` |
| 4 | `wc -l docs/audit/task-ledger.md`; Backlog row | `71`; last Backlog row, once |
| 5 | `git ls-files --eol` on the three tracked files | `w/crlf` for all three |
| 6 | Em dash count in the three tracked files, the archive, the build report, and the added lines of `git diff -U0 HEAD` | 0 everywhere |
| 7 | `git status --porcelain` | The three target files, the new archive, and the T773 spec, build report and review only |

### 5. Not verified

- Step 6 (red run) does not apply: tests are `none`. The archive text was not read, per the rule; it is checked by script against HEAD.

### 6. Blocking

None.

### 7. Non-blocking

None new. Round 1's note on the unquoted paths in the **Changed** line stands (optional).

### 8. Rule candidates

Round 1's candidate stands: a spec that removes the tail of a file finds the new last line with a script, not by hand.

## Round 1

### 1. Metadata

- **Task:** T773, Phase 137 (`phase-137-small-fixes`)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** CHANGES REQUESTED
- **Target files:** `docs/audit/archive/refactor-log-phases-125-135.md` (new), `docs/audit/refactor-log.md`, `docs/audit/README.md`; bookkeeping `docs/audit/task-ledger.md`.
- `git check-ignore -v` on the four: none ignored (exit 1).

### 2. Summary

The archive file is a byte-exact copy of the old Phases 135 to 125 entries, the live log is down to Phase 137, Phase 136 and the template, the README lists the new archive, and the Backlog row is in and matches the spec. Two things are off, both traced to a spec slip: the live log now ends with a blank line, and the log line counts in the T773 Gate result (41, and ledger 72) are wrong.

### 3. Invariants and parity

- **Parity map:** no row touched.
- **Archive file:** a Node script compared the old log's lines 44 to 211 (`git show HEAD:`, CR removed) with the archive after its first four lines: identical (`true`). The first four lines are the title, a blank line, the provenance note and a blank line, as specified. All line breaks are CRLF (no bare LF) and the file ends with one `\r\n`. The script printed no archive text beyond those four lines.
- **Live log:** Phase 136 entry (lines 33 to 41) and the entry template (lines 8 to 21) equal HEAD. No `## Phase 125` to `## Phase 135` heading remains; `## Phase 136` and `## Phase 137` are both present. No `211 lines` text remains. Phase 137 heading reads `T769-T773`; the brief, Changed and Deliberately not done lines match spec 7.2 item 3. The pointer paragraph is the spec text. (It is at line 5, not line 6 as the spec said; the spec was off by one and the edit is correct.)
- **Verified line:** the T773 part equals the ledger's T773 Gate result cell, plus a final full stop.
- **README:** lines 16 and 26 match spec 7.3.
- **Ledger:** the T773 row has `done`, an empty Commit, the specified Files cell. The new Backlog row is the last row and equals spec 7.4 item 2. No other Backlog line changed (numstat 2/0).
- **Trailing blank line (blocking 1):** `docs/audit/refactor-log.md` ends `... UI-06).\r\n\r\n`. HEAD ended with the Phase 125 line and no blank. The spec said deleting `:42` to `:211` leaves the file ending with Phase 136's last line `:41`, but `:41` is the blank before the `---`, so the cut leaves a trailing blank line. T771 removed this kind of line from a test file; the file should not gain one.

### 4. Gates run

| # | Command | Result |
|---|---|---|
| 1 | Log length (Node, `\n` count) | `41`, under 150. After blocking 1 is fixed it will be `40`. |
| 2 | Byte match, Node script, HEAD lines 44 to 211 against the archive | `true` |
| 3 | `grep -cE '^## Phase (12[5-9]\|13[0-5]) '` / `grep -cE '^## Phase (136\|137) '` | `0` / `2`. Last live line is an empty line, not `---` (but see blocking 1). |
| 4 | Phase 137 entry checks, `grep -c "211 lines"`, Phase 136 and template compared with HEAD | Heading `T769-T773`; `0`; Phase 136 and template unchanged |
| 5 | Both archive files exist (`ls`) | Both found |
| 6 | Backlog row equals spec text; numstat of the ledger | Equal; 2/0. `wc -l docs/audit/task-ledger.md` prints `71`, not `72` as the build report and ledger cell say (blocking 2) |
| 7 | `git ls-files --eol` on the three tracked files; Node CRLF count on the archive | `w/crlf` for all three; archive `172 0` |
| 8 | Em dash count (U+2014 from its char code) in the three tracked files, the archive, the build report, and the added lines of `git diff -U0 HEAD` | 0 everywhere |
| 9 | `git status --porcelain`; `git diff --stat` | Three modified target files, the new archive, the T773 spec and build report only. `docs/audit/refactor-log.md` 6/176, README 2/2, ledger 2/0 |

### 5. Not verified

- Step 6 (red run) does not apply: the spec's tests are `none`.
- The archive text itself was not read, per the rule against reading `docs/audit/archive/`; the check is a script comparison with HEAD.
- No lint or unit run: the docs-only tier runs nothing, and no changed file states a count that a test checks.

### 6. Blocking

1. `docs/audit/refactor-log.md:41` - the file ends with a blank line after Phase 136's `Deliberately not done` line (spec slip: it called `:41` the last line) - delete that one blank line so the file ends `UI-06).\r\n`, with a single final newline, and no other change.
2. `docs/audit/task-ledger.md` (T773 Gate result cell) and `docs/audit/refactor-log.md:27` (the T773 part of Verified) - both say `log lines 41` and `ledger lines 72`; after blocking 1 the log is 40 lines, and the ledger is 71 by `wc -l` - rewrite both figures from a rerun (`log lines 40`, `ledger lines 71`), and keep the two texts word for word equal.

### 7. Non-blocking

1. The new paths in the Phase 137 **Changed** line are not in backticks, unlike the earlier items on that line. Optional.
2. Spec slip, no action: the pointer paragraph is `docs/audit/refactor-log.md:5`, not `:6`.

### 8. Rule candidates

1. When a spec removes the tail of a file, it names the new last line by counting from the first line it keeps in the output of a script (for example `node -e` printing the last two lines as JSON), not by hand. A hand count here took a blank line for the last content line.

### 9. Fix block

```
fix T773 (stage file: workflow/stages/02_build/CONTEXT.md)

Blocking 1: in docs/audit/refactor-log.md, remove the one empty line at the end of the file, so the file ends with the Phase 136 "Deliberately not done" line followed by a single \r\n (the file's last bytes must be `UI-06).\r\n`, not `UI-06).\r\n\r\n`). Use a Node script that checks the file ends with exactly `\r\n\r\n` and trims one `\r\n`. Change nothing else.

Blocking 2: after blocking 1 the log has 40 lines (Node `\n` count) and the ledger has 71 (wc -l). Update the figures in the T773 Gate result cell of docs/audit/task-ledger.md (`log lines 41` to `log lines 40`, `ledger lines 72` to `ledger lines 71`), and copy the cell word for word into the T773 part of the Verified line of the Phase 137 entry in docs/audit/refactor-log.md (that part ends with a full stop; keep it). Use a Node script and check the two texts are equal.

Append a "## Fix round 1" section to task-T773-build.md.

Gates to rerun: spec gates 1, 3, 4, 6, 7, 8 and 9. For gate 1 the expected result is 40. Add a check that the last 4 bytes of docs/audit/refactor-log.md are `).\r\n`. Read expected texts from the spec or from git show HEAD: with a script; never retype.
```

STATUS: T773 | CHANGES REQUESTED | workflow/stages/03_review/output/task-T773-review.md
