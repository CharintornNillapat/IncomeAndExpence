# Spec T837: one shared skeleton for the three ICM stage files

Phase 164, branch `phase-164-icm-neutral-stages` (cut from `main` at `3ae3327`). Item 2 of three: T836 (role-only wording) builds first, T838 (MASTER.md fixes) last. All three specs are written before any build, so this spec is written against the stage files as T836 leaves them (section 4 says how that text is pinned).

## 1. Goal

The three stage files (`workflow/stages/01_spec/CONTEXT.md`, `02_build/CONTEXT.md`, `03_review/CONTEXT.md`) share one section skeleton: Role and orders, Inputs, Process, Outputs, Verify, Never, Shell notes, STATUS line. Each shell note carries a `[generic]` or `[local]` tag, defined where the tags are first used (`[generic]`: helps any project on the same platform, Windows, PowerShell 5.1, Git Bash; `[local]`: depends on FinLife's own files, tools or layout), and stage 03 asks the reviewer for one such tag per rule candidate, with the same two definitions. It is a pure restructure: a sentence-level before/after script proves every old sentence is still there word for word, and that the only new text is the skeleton headings, the tags, the definition sentence (stages 01 and 02), the stage 03 sentence about tagging rule candidates and the line `None.` under stage 03's Shell notes.

Amended at the owner's go-ahead (owner amendment of 2026-10-30): the tag definitions, the re-tag of every shell note (section 7, "Tag table"), `None.` in stage 03, and the build report's tag list (section 7, "Build report: Shell note tags").

## 2. Target files

```
workflow/stages/01_spec/CONTEXT.md
workflow/stages/02_build/CONTEXT.md
workflow/stages/03_review/CONTEXT.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T837-build.md`, `workflow/stages/02_build/output/logs/`.

No ADR: a doc-only workflow edit, which `AGENTS.md`'s Workflow section exempts ("Skip the process for typos, copy tweaks and doc-only edits"); no rule changes, only where each rule sits. Not the phase's shipping task (T838 is last), so `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` are not targets.

The proof script is not a repo file. It lives in this spec (section 8, the one `js` block) and is extracted to the gitignored logs folder, the same pattern as T836's gate script. Nothing needs it after this task: no guard reads the stage files' text (section 4), and a CI guard that freezes the skeleton was not asked for. The committed spec keeps the script, so the proof can be rerun later against the T837 commit's parent (section 8, Gate 1).

## 3. Context to read

None (docs-only task). Read the three stage files and this spec in full. Read `workflow/stages/01_spec/output/task-T836-spec.md` section 7 only if Gate 1's `R1` line fails.

## 4. Current behaviour

Line numbers are those of `HEAD` before T836. T836 replaces whole lines only (`01_spec/CONTEXT.md:3`, `02_build/CONTEXT.md:5`, `03_review/CONTEXT.md:3`) and adds or removes none, so every number below also holds for the post-T836 text.

- **The "before" text is pinned.** The orchestrator commits T836 on this branch before it sends `build T837`, and commits T837 only after an APPROVED review, so at build and at review time `git show HEAD:<path>` is the post-T836 text of each stage file. The script hashes that text (LF line endings, as git stores it) and compares it with three sha256 values computed from T836's spec applied to `3ae3327`: `b0b340ae6ccb...` (01), `f573ce29e426...` (02), `25612cabda88...` (03); the full values are `PIN` in the script. A mismatch means T836 landed differently from its spec: stop with `BLOCKED` and name the file; do not adapt the blocks below. After T837 is committed, the same proof reruns with the T837 commit's parent as the ref (Gate 1).
- **Today's sections.** `01_spec`: an `**Agent:**` paragraph (`:3`), then `## Task id and phase` (`:5`), `## Short orders` (`:10`), `## Read` (`:16`, with the archive ban as a paragraph at `:23`), `## Write` (`:25`), `## Spec sections, in this order` (`:29`), `## Rules` (`:44`, eight bullets `:46-53`), `## STATUS line` (`:55`). `02_build`: the read-AGENTS.md paragraph (`:3`) and `**Agent:**` paragraph (`:5`), `## Inputs` (`:7`), `## Allowed writes` (`:13`), `## How to build` (`:20`, steps 1 to 7 at `:22-31`, two paragraphs at `:33` and `:35`), ``## On `fix <id>` `` (`:37`), `## Never` (`:43`), `## STATUS line` (`:51`). `03_review`: `**Agent:**` (`:3`), `## Steps` (`:5`, steps 1 to 9 at `:7-21`), `## Verdicts` (`:23`), `## Write` (`:27`), `## STATUS line` (`:41`). No two files share a layout, and none has a Verify, Never (01, 03) or Shell notes section.
- **Shell notes today.** Three passages exist because of a shell the agents run today (T836's out-of-scope list names them): `01_spec/CONTEXT.md:50` (`grep -c $'\r'` reads 0 on CRLF files "in the agents' Git Bash"), `:51` (`grep -P '\x{2014}'` fails "in the agents' Git Bash", then the two Node counters), and `02_build/CONTEXT.md:27` from its third sentence on (Windows PowerShell 5.1 writes UTF-16 with `>`, `>>` and `Tee-Object`; the `cmd /c`, Git Bash `tee` and `Out-File` forms). `03_review` has none. `03_review/CONTEXT.md:15` ("under `core.autocrlf` the pop rewrites it to CRLF") is a step of the stash procedure that the next sentence depends on ("Say in Not verified which files were left out"), so it stays in step 6.2.
- **Step numbers other text relies on.** `01_spec/CONTEXT.md:39` cites "stage 02 step 4 and stage 03 step 6"; `:52` cites "as stage 02 step 5 says" for the text-landed rule (`02_build/CONTEXT.md:28`); `03_review/CONTEXT.md:3` cites "step 6's stash", `:13` "Steps 6.1 to 6.4", `:17` "step 6.1". Rewording is out, so these numbers must keep pointing at the same text: stage 02's steps 1 to 7 stay one list in order, with step 5's text-landed sub-bullet under it; stage 03's steps 1 to 6 keep their numbers and step 6 keeps sub-steps 1 to 4. Nothing outside the stage files cites a stage step number or a stage section name: `grep -rniE 'stage 0[123]|step [0-9]'` over `AGENTS.md`, `.claude/agents/`, `workflow/orchestrator/` finds only stage numbers and the loaders' own steps; `.claude/agents/fin-reviewer.md:8` and `fin-reviewer-strict.md:8` say only "the temporary stash check or temporary test edit your stage file describes"; `workflow/orchestrator/MASTER.md:44` names the stage 02 path only.
- **Guards.** No test or script reads a stage file's text. `unit/workflow-hardening.test.ts:177` and `:189` list the paths `workflow/stages/01_spec/CONTEXT.md` and a stage 02 log only to check how the CI docs-only filter classifies them; `grep -rn 'workflow/stages\|CONTEXT\.md' unit scripts .github` finds nothing else. That test must still pass (Gate 2). T836's done-when grep (no `Claude Code|agy|Gemini|Sonnet|Opus` in the stage files) must stay empty (script check `R4`).
- **The log rule (for T838).** T838 will add a note to stage 02's log rule. After this task its sentences sit, word for word, in four places: step 5's sub-bullet that starts `**Logs are UTF-8**` (its first two sentences), then three notes in stage 02's Shell notes, in this order: `[generic]` "In Windows PowerShell 5.1, ..." (one sentence), `[local]` "Run the command through `cmd /c` instead, ..." (the `cmd /c` and Git Bash `tee` sentences), and `[generic]` "Use `| Out-File -Encoding utf8 <log>` only for a PowerShell cmdlet's own output ..." (one sentence, the last line of Shell notes, ending "and with `2>&1` it wraps each stderr line in an error record.").
- All three targets and the ledger are `i/lf w/crlf` in `git ls-files --eol`. The three targets hold no fenced code block, so each fits whole in one `text` block below.

## 5. Parity map

None.

## 6. Tests to add

None: the edit moves doc sentences and cannot alter app or test behaviour. Stage 02 step 4 and stage 03 step 6 do not apply. The proof script carries its own red check instead (Gate 3, `selftest`): eleven mutations of the new stage 02 and stage 03 text, each of which the proof must catch.

## 7. Edits

### Definitions the script implements

- **Sentence.** Read the text with `\r\n` turned into `\n`. Skip blank lines. A line that starts with `#` marks and a space is a heading: it is kept apart and is not a sentence. Every other line loses its leading spaces, then one list marker (`- ` or digits followed by `. `), then, in the new text only, one leading tag (`[generic] ` or `[local] `). What is left splits into sentences at a `.`, `!` or `?` that is outside a backtick code span and followed by a space, except after `e.g.` or `i.e.`. Each sentence is trimmed. Bold marks, quotes, links and code spans stay as written, so a reworded code span is a reworded sentence. A list item's number is not part of its sentence, so a step that moves keeps its sentences even if its number changed (none of the cross-referenced numbers changes; check `R3`).
- **Pure restructure, per file** (checks `P1` to `P7`): the `#` title is unchanged; the `##` headings are exactly the eight skeleton names in order (`Role and orders`, `Inputs`, `Process`, `Outputs`, `Verify`, `Never`, `Shell notes`, `STATUS line`); every `###` heading is an old `##` heading that is not a skeleton name, and there is no deeper heading; the multiset of sentences equals the old one, counts included, except for the new sentences, which appear exactly once each and in this order: the definition (01, 02), the Instruction then `None.` (03), all three taken from the New sentences block; in Shell notes every `- ` bullet is a note and carries one tag, the only line that is not a bullet is the definition (01, 02) or `None.` (03), no tag appears anywhere else, and the tag counts are `[generic]` 2 (01), `[generic]` 2 and `[local]` 1 (02), none (03); every line has an even number of backticks.
- **The tags (the owner's definitions, word for word).** `[generic]`: the note helps any project on the same platform (Windows, PowerShell 5.1, Git Bash). `[local]`: the note depends on FinLife's own files, tools or layout. The rule applied, one note at a time: a note that names a FinLife path, an npm script of this repo or a FinLife-specific tool is `[local]`, unless the platform advice stands in sentences that name none of them; such a mixed note is split only at a sentence boundary, so the proof still holds, and otherwise stays whole and `[local]`. No sentence is reworded to make it `[generic]`. A FinLife task id cited as evidence (T833's log) is not a path, script or tool, and the advice holds without it, so it does not make a sentence `[local]`.
- **Where the definitions sit.** Stages 01 and 02 use the tags first in Shell notes, so the definition sentence is the first line under that heading, a plain line before the tagged bullets. Stage 03 uses the tags first in Outputs item 8 (Rule candidates), so the Instruction there carries the same two definitions in the same words; its Shell notes section is the one line `None.`. Check `R1` proves the definition sentence and the Instruction both hold the two definitions word for word.

### Tag table (every shell note, one at a time)

| File | Note, first words | Was | Now | Why |
|---|---|---|---|---|
| `01_spec` (old `:50`) | A gate that checks line endings | `[local]` | `[generic]` | Names `git ls-files --eol`, Node, `grep` and Git Bash only: no FinLife path, npm script or FinLife tool. Any project checking CRLF on this platform can use it. |
| `01_spec` (old `:51`) | A gate that counts em dashes | `[local]` and `[generic]` (split) | `[generic]` (one note, no split) | Node, `grep -P`, Git Bash, and two `node -e` counters over `git diff` and any file. "The spec itself" is an example of a file to count in, not a path. Both sentences are `[generic]`, so the old split is dropped and old line `:51` stays one note, as it was. |
| `02_build` (old `:27`, sentence 3) | In Windows PowerShell 5.1, `>`, `>>` | `[local]` (one note) | `[generic]` (split off) | A PowerShell 5.1 encoding fact. "(the T833 gate log was UTF-16)" cites a FinLife log as evidence; the sentence names no path, npm script or tool and its advice holds without the citation. |
| `02_build` (old `:27`, sentences 4 and 5) | Run the command through `cmd /c` | `[local]` (one note) | `[local]` (split off) | Both sentences' only commands are `npm run test:unit` (this repo's npm script) writing to `workflow\stages\02_build\output\logs\` (FinLife's layout). The `cmd /c` and `tee` advice cannot be stated without them unless reworded, so the two stay together and `[local]`. |
| `02_build` (old `:27`, sentence 6) | Use `\| Out-File -Encoding utf8 <log>` (the table escapes the pipe) | `[local]` (one note) | `[generic]` (split off) | Names PowerShell, `Out-File`, `Get-FileHash` and the general tools npm, npx, node and git, no npm script or path; Thai text is one case of non-ASCII output. Holds for any project on this platform. |

Old `:27` splits at its two sentence boundaries before "Run the command" and before "Use `| Out-File`": each part reads on its own in the same order, and the proof still holds (`P4`, `P5`), so the split is allowed. `03_review` has no shell note (section 4: `:15` stays in step 6.2, untagged). Totals: 4 `[generic]`, 1 `[local]`.

### Layout decisions (all already inside the blocks below; listed so the reviewer can check them)

- Old headings kept as `###`: `Task id and phase` and `Short orders` (01, under Role and orders), `Spec sections, in this order` (01, under Outputs, so its numbered list keeps its meaning), ``On `fix <id>` `` (02, under Process), `Allowed writes` (02, under Outputs), `Verdicts` (03, under Outputs). Old headings dropped, because a skeleton heading now says the same: `Read` (Inputs), `Write` (Outputs), `Rules` (its bullets spread over Process, Verify, Never and Shell notes), `How to build` (Process), `Steps` (03).
- `01_spec`: `:3` to Role and orders; `:7-8` and `:12-14` under their `###` headings; `:18-21` to Inputs; `:46`, `:47`, `:52`, `:53` to Process; `:27` and the Spec sections list `:31-42` to Outputs; `:49` to Verify; `:23` (now a `- ` bullet) and `:48` to Never; Shell notes gets the definition sentence, then `:50` and `:51`, each whole and `[generic]` (tag table).
- `02_build`: `:3` stays the file's first paragraph, under Role and orders, so the file still begins by telling the builder to read `AGENTS.md` (ADR 0101); `:5` follows. `:9-11` stay Inputs. Steps 1 to 7 (`:22-31`) stay one numbered list in Process, with step 5 keeping its `Logs are UTF-8` sub-bullet (first two sentences) and its text-landed sub-bullet `:28`; the On fix bullets `:39-41` follow under their `###`. `:33`, `:35` and the Allowed writes list `:15-18` go to Outputs. Step 5's Playwright sub-bullet `:29` moves out, unindented, as Verify's one bullet (no text cites it by step number). Never `:45-49` is unchanged. Shell notes gets the definition sentence, then `:27`'s last four sentences as three notes in their old order: `[generic]` (sentence 3), `[local]` (sentences 4 and 5), `[generic]` (sentence 6) (tag table).
- `03_review`: `:3` to Role and orders; steps 1 and 2 (`:7-8`) to Inputs; steps 3 to 6 (`:9-18`, the numbered list restarting at 3) to Process; the Write paragraph `:29`, the round list `:31-39` and `### Verdicts` with `:25` to Outputs, with the Instruction sentence appended to item 8 (Rule candidates) after one space; step 7 (`:19`) to Verify and steps 8 and 9 (`:20-21`) to Never, each as a `- ` bullet (nothing cites 7, 8 or 9). Shell notes holds the one line `None.` (owner amendment): there is no shell note to move.

### How to make the edit

Do not type the new text. After Gate 0, run `node <logs>/T837-restructure.cjs apply` from the repo root. It checks the `R1` pins first and writes nothing if one fails; otherwise it writes each target from its block below with CRLF line endings and one final line break. Then add the ledger row. The four `text` blocks, in this order, are the only `text` blocks in this spec; the script finds them by position.

Stage 01 new text (`workflow/stages/01_spec/CONTEXT.md`):

```text
# Stage 01: spec

## Role and orders

**Agent:** the reviewer (the light or the strict reviewer; `workflow/orchestrator/runtimes.md` names the agent and model behind each role). It writes specs and reviews only; it never edits app code, tests or config. **Order:** `spec <id>: <description> (stage file: workflow/stages/01_spec/CONTEXT.md)`, sent by the orchestrator (herdr). The spec's Goal comes from the description. The other orders are `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (builder, stage 02) and `review <id> (stage file: <path>)` (reviewer, stage 03).

### Task id and phase

- Use the id in the order; never compute your own. Ids continue the T-numbers in `docs/audit/task-ledger.md`, written with their `T`, e.g. `T751`. If the id is already used in the ledger or by any `workflow/stages/01_spec/output/task-T*-spec.md`, stop with `BLOCKED` and say so.
- The phase number is the `NNN` in the current branch name, `phase-NNN-<slug>`.

### Short orders

- A one-line goal, or a reference to a row of the Backlog in `docs/audit/task-ledger.md`, is a complete order. Expand it into a full spec from that row, the code it names and the current tests.
- When the order names a Backlog row, the spec tells the builder to set that row's Status to `done in Phase NNN (<id>)`.
- Stop with `BLOCKED` only when the intent is unclear: the goal or the row reads two ways that change the target files or the behaviour, or the named row cannot be found.

## Inputs

1. `AGENTS.md` in full.
2. `docs/audit/task-ledger.md`.
3. Only the `docs/contexts/*.md` files the task touches, chosen from `AGENTS.md`'s routing table. A comments-only or docs-only task needs none.
4. The current code and tests the task touches, enough to cite `file:line`.

## Process

- A spec is specific enough that the builder needs no other judgment call. If the owner's intent is unclear, stop with `BLOCKED` and the question.
- Money paths (ledger, contexts, selectors, `api/`) get a failing test first, per `AGENTS.md`.
- When a spec gives the exact text an edit adds or replaces, or a text a gate checks landed, each such text is its own fenced code block that holds exactly that text, with no prose, ellipsis or placeholder inside. The text-landed gate names its blocks (for example "edit 2's New text") and reads them from the spec with a script, as stage 02 step 5 says, never retyped.
- Stop after writing the spec. The orchestrator then pauses for the owner or goes on, by the pause rule in `AGENTS.md`'s ICM section, which reads the spec's Target files and Production touch points.

## Outputs

One file: `workflow/stages/01_spec/output/task-<id>-spec.md`. Nothing else. Under herdr the spec is the plan: an ADR the task needs is a target the builder writes first, and the builder keeps the task's ledger row.

### Spec sections, in this order

1. **Goal:** one or two sentences, in the owner's terms.
2. **Target files:** the exact allowlist of files the builder may change, one path per line.
   - If the task needs an ADR, list `docs/audit/decisions/NNNN-<slug>.md` with the next free number; the builder writes it first, before any code.
   - If the task ships the phase, list `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`.
   - Bookkeeping files are always allowed and need not be listed (see stage 02).
3. **Context to read:** which `docs/contexts/*.md` files the builder must read, and why, or "none" for a comments-only or docs-only task.
4. **Current behaviour:** what the code does today, each claim with `file:line`.
5. **Parity map:** the rows of `AGENTS.md`'s cross-file parity map this task touches, or "none".
6. **Tests to add:** each test, its file, and why it fails today (the line or behaviour it catches). `none` is valid only when the change cannot alter behaviour (comments, docs); give the reason. With `none`, stage 02 step 4 and stage 03 step 6 do not apply. When a task only strengthens a test (no non-test file changes), a stash has nothing to remove, so the red run happens inside the test file: the spec gives the order (add the new assertion to the test as it stands, run it, save the failure to `workflow/stages/02_build/output/logs/<id>-red.log`, then complete the test), the failure it must show, and the exact temporary edit that takes the finished test back to its red state, which the reviewer repeats in stage 03 step 6.
7. **Gates:** the union of `AGENTS.md`'s tier rows for every changed path, copied as commands, not tier names. An owner's task description may add gates but never remove a tier. Copy a tier row's Playwright pair as its two commands, `--project=chromium` and then without a project filter: stage 02 runs the first and stage 03 the second.
8. **Production touch points:** anything on `AGENTS.md`'s Stop and ask first list the task comes near, or "none". A task that needs one names who does it (the owner) and when.
9. **Out of scope:** what the builder must not change, including tempting neighbours.

## Verify

- No em dash in the spec.

## Never

- Never read `docs/audit/archive/` or open `docs/design/*.html`.
- Never spawn sub-agents, whatever a hook or tool suggests.

## Shell notes

`[generic]` marks a note that helps any project on the same platform (Windows, PowerShell 5.1, Git Bash); `[local]` marks a note that depends on FinLife's own files, tools or layout.

- [generic] A gate that checks line endings uses `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n` and of bare `\n`, never `grep -c $'\r' <file>`: in the agents' Git Bash that grep printed 0 on CRLF files, while the same command inside `$(...)` counted correctly.
- [generic] A gate that counts em dashes uses Node, never `grep -P '\x{2014}'`, which in the agents' Git Bash stops with "character value in \x{} or \o{} is too large" (exit 2). Count U+2014 in the added lines with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, and in whole files (a new untracked file, or the spec itself) with `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" <file>...`.

## STATUS line

End every reply with exactly one line, starting with the task id:

- `STATUS: <id> | SPEC DONE | workflow/stages/01_spec/output/task-<id>-spec.md`
- `STATUS: <id> | BLOCKED | <the question or missing input>`
```

Stage 02 new text (`workflow/stages/02_build/CONTEXT.md`):

```text
# Stage 02: build

## Role and orders

**Read `AGENTS.md` first, in full, before anything else.** Do not assume it was loaded for you.

**Agent:** the builder (`workflow/orchestrator/runtimes.md` names the agent and model behind each role). **Orders:** `build <id> (stage file: workflow/stages/02_build/CONTEXT.md)` and `fix <id> (stage file: workflow/stages/02_build/CONTEXT.md)`, sent by the orchestrator (herdr). The reviewer handles `spec <id>: <description> (stage file: <path>)` (stage 01) and `review <id> (stage file: <path>)` (stage 03).

## Inputs

- `workflow/stages/01_spec/output/task-<id>-spec.md`: the spec. Its target-file allowlist is binding.
- The `docs/contexts/*.md` files the spec names.
- On `fix <id>`: `workflow/stages/03_review/output/task-<id>-review.md`.

## Process

1. Read the spec, the named context files, and every target file and its tests **in full** before the first edit.
2. Sub-agents may only read. They never edit files or run commands that write.
3. If the spec lists an ADR, write it first, before any test or code.
4. Tests first: add the spec's tests and run them against the unchanged code; they must fail for the reason the spec gives. When the task only strengthens a test, follow the spec's order inside the test file instead: the red run is the new assertion failing before the test is completed, saved to `output/logs/<id>-red.log` and quoted (the command and its failure lines) in the build report's fail-then-pass evidence. Skip this step when the spec's tests are `none`.
5. Make the change, then run the spec's gates **once**, after all edits. Never edit `src/` while Playwright runs. Save each full-suite run to `workflow/stages/02_build/output/logs/<id>-<suite>.log`.
   - **Logs are UTF-8**, so `grep` can read them. This covers every file you write under `output/logs/`: full-suite runs, the red log and gate output.
   - A gate that checks text landed (a line, phrase or block occurs in a file) reads the expected text from the spec file's fenced code blocks with a script, turning `\r\n` into `\n` in both texts before counting, and never from a copy typed into the command: in T772 a retyped check passed while the edit differed from the spec by one character.
6. Keep the task's row in `docs/audit/task-ledger.md`. The phase is the `NNN` in the branch name `phase-NNN-<slug>`. Put the row under that phase's section, creating the section from the ledger's template if it is missing. Status `in-progress`, then `done` with the gate result. Leave `Commit` empty: the owner-approved deploy record fills every task's `Commit` cell once per phase, after the merge.
7. Write `workflow/stages/02_build/output/task-<id>-build.md`: task id, files changed (with the count), tests added and their fail-then-pass evidence, each gate command with its exact counts and log path, the Playwright gates `Left to the reviewer`, and anything not done.

### On `fix <id>`

- Fix only the blocking items in the latest round of `task-<id>-review.md`.
- Rerun the spec's gates.
- Recheck every blocking item from all earlier rounds still holds as fixed, and say so in the fix-round section.

## Outputs

Each task has its own build report, `task-<id>-build.md`: a `build <id>` creates it, and each `fix <id>` appends a `## Fix round N` section to the same file. Never edit another task's report. `build-report.md` is the last shared report (T753, Phase 127), kept as it is: never write to it again.

When the spec lists `docs/audit/refactor-log.md`, build the phase's entry, or this task's part of it, from the commits and the ledger, never from memory. **Changed:** each committed task's `git show --stat <sha>` and this task's `git status --porcelain`, leaving out `workflow/stages/*/output/` files; name no file they do not list. **Verified:** each task's Gate result cell in `docs/audit/task-ledger.md`, copied word for word. **Surprises:** only items a review or build report names. The header keeps its `<sha>` placeholders; the owner's deploy record fills them.

### Allowed writes

- The spec's target files.
- **Bookkeeping files**, always allowed and never a scope violation: `docs/audit/task-ledger.md` and `workflow/stages/02_build/output/*`, which holds the task's build report `task-<id>-build.md` (full-suite logs go in `output/logs/`, which git ignores).
- `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` only when the spec lists them, which it does for the task that ships the phase.
- Nothing else. A change the spec did not foresee means `BLOCKED`, not a wider edit.

## Verify

- **Playwright runs on chromium only.** Run each Playwright gate that has `--project=chromium`. A Playwright gate without a `--project` filter (`npx playwright test <files>` or `npm test`) is the reviewer's: do not run it, and list it in the build report under `Left to the reviewer`. When the spec lists such a gate with no `--project=chromium` partner for the same spec files, run the partner instead: the same command with `--project=chromium` added (`npm test -- --project=chromium` for `npm test`). A gate that names another project runs as written.

## Never

- Read `docs/audit/archive/` or open `docs/design/*.html`.
- Use MCP write tools (Supabase, Vercel, GitHub) or sign in on the dev server.
- Run anything on `AGENTS.md`'s Stop and ask first list, including `git commit`, `git push` and any merge. Only the orchestrator commits (each APPROVED task, on the phase branch) and pushes (on the owner's push order).
- Create `GEMINI.md`, or edit `AGENTS.md` or `CLAUDE.md`, unless the spec lists them as targets.
- Write an em dash in any file you touch.

## Shell notes

`[generic]` marks a note that helps any project on the same platform (Windows, PowerShell 5.1, Git Bash); `[local]` marks a note that depends on FinLife's own files, tools or layout.

- [generic] In Windows PowerShell 5.1, `>`, `>>` and `Tee-Object` write UTF-16 (the T833 gate log was UTF-16), so never use them for a log.
- [local] Run the command through `cmd /c` instead, which saves the program's own UTF-8 bytes and leaves its exit code in `$LASTEXITCODE`: `cmd /c 'npm run test:unit > workflow\stages\02_build\output\logs\<id>-unit.log 2>&1'`. In Git Bash use `tee` and print the command's own exit code: `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/<id>-unit.log; echo exit=${PIPESTATUS[0]}`.
- [generic] Use `| Out-File -Encoding utf8 <log>` only for a PowerShell cmdlet's own output (for example `Get-FileHash`): PowerShell decodes piped npm, npx, node or git output in the console code page, which garbles Thai text and symbols, and with `2>&1` it wraps each stderr line in an error record.

## STATUS line

End every reply with exactly one line, starting with the task id:

- `STATUS: <id> | BUILT | <n> files changed`
- `STATUS: <id> | FIXED | <n> files changed`
- `STATUS: <id> | BLOCKED | <reason>`
```

Stage 03 new text (`workflow/stages/03_review/CONTEXT.md`):

```text
# Stage 03: review

## Role and orders

**Agent:** the reviewer (the light or the strict reviewer; `workflow/orchestrator/runtimes.md` names the agent and model behind each role). It writes specs and reviews only; it never edits app code, tests or config (step 6's stash, or its temporary test edit for a test-only task, is the one allowed exception). **Order:** `review <id> (stage file: workflow/stages/03_review/CONTEXT.md)`, sent by the orchestrator (herdr). The builder handles `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (stage 02); the reviewer also handles `spec <id>: <description> (stage file: <path>)` (stage 01).

## Inputs

1. Run `git check-ignore -v` on every target file in the spec. An ignored target never shows in a diff, so say so in the review.
2. Read the spec, `workflow/stages/02_build/output/task-<id>-build.md` (on a fix round, including its latest `## Fix round N` section), the diff of every file the builder listed, and the **full text of every changed function**, not just the hunks.

## Process

3. **Scope:** run `git diff --stat` and `git status --porcelain`. A changed or new file the spec does not list and the build report does not announce is **blocking**, unless it is a bookkeeping file (`docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`, which holds `task-<id>-build.md`).
4. **Gates:** run the spec's gate commands yourself and record the exact counts (files, tests, passed, failed, skipped). Do not copy the builder's numbers. Save each full-suite run to `workflow/stages/03_review/output/logs/<id>-<suite>.log`. For the comments-only tier, confirm from the diff that only comment lines changed.
   - **Playwright:** run each Playwright gate without a `--project` filter once; it runs all three browsers, chromium included. Skip a `--project=chromium` gate when a gate without a filter covers the same spec files (`npm test` covers every spec): the builder ran it, and your run covers it. Run any other Playwright gate as written.
5. **Parity:** check every row of `AGENTS.md`'s parity map the change touches.
6. **Tests:** for each new test, confirm it fails without the change. Skip this step when the spec's tests are `none`. When the task changes no non-test file, there is nothing to stash, and the builder's red log alone is not enough: reproduce the red run yourself. Record `git status --porcelain` and `git diff -- <test file>`; make the temporary edit the spec names in the test file; run the test alone and record the failure the spec gives; undo that edit by hand (never `git checkout` or `git restore`, which would drop the task's changes); then show both outputs are identical to the recorded ones, so `git diff` holds only the task's changes. Steps 6.1 to 6.4 then do not apply.
   1. Record `git status --porcelain`.
   2. Stash only the non-test changes: `git stash push -- <files>`. Never while Playwright runs. A staged deletion matches no path, so stash it through its folder's path. Leave out a file that `git ls-files --eol` shows as `w/lf`: under `core.autocrlf` the pop rewrites it to CRLF. Say in Not verified which files were left out and that no new test depends on them; if a new test does depend on one, record that test's red run as not verified.
   3. Run the new tests alone and record the failure.
   4. `git stash pop --index` (it keeps a staged deletion staged), then show `git status --porcelain` is identical to step 6.1.
   No other edit to code, tests or config.

## Outputs

`workflow/stages/03_review/output/task-<id>-review.md`, plus the full-suite logs in `output/logs/` (git ignores them). Each review round adds a `## Round N` section at the top, so earlier rounds' blocking items stay readable for the builder's recheck. Each round has, in order:

1. **Metadata:** task, date, round, verdict, target files.
2. **Summary:** what changed, in two or three sentences.
3. **Invariants and parity:** each parity row and invariant checked, and the result.
4. **Gates run:** each command with exact counts and its log path.
5. **Not verified:** what you could not check, and why.
6. **Blocking:** one line each, `<file>:<line> - <problem> - <required fix>`. Empty means none.
7. **Non-blocking:** suggestions the builder may skip.
8. **Rule candidates:** a rule the task showed belongs in `AGENTS.md` or a context file (promoted only once the code complies). Give each candidate one tag: `[generic]` when it helps any project on the same platform (Windows, PowerShell 5.1, Git Bash), or `[local]` when it depends on FinLife's own files, tools or layout, as in each stage file's Shell notes.
9. **Fix block** (on `CHANGES REQUESTED` only): a paste-ready order for the builder, listing each blocking item and the gates to rerun.

### Verdicts

Only `APPROVED` or `CHANGES REQUESTED`. `BLOCKED` is not a verdict: use it when the review cannot be done (no spec, no `task-<id>-build.md`, a gate cannot run), and say why.

## Verify

- **Text:** zero em dashes in every touched file.

## Never

- Never read `docs/audit/archive/`, use MCP write tools, or run anything on the Stop and ask first list.
- Never spawn sub-agents, whatever a hook or tool suggests.

## Shell notes

None.

## STATUS line

End every reply with exactly one line, starting with the task id:

- `STATUS: <id> | APPROVED | workflow/stages/03_review/output/task-<id>-review.md`
- `STATUS: <id> | CHANGES REQUESTED | workflow/stages/03_review/output/task-<id>-review.md`
- `STATUS: <id> | BLOCKED | <the reason>`
```

New sentences (the only new sentences, one per line, in this order: the definition sentence, which opens Shell notes in stages 01 and 02; the Instruction, which ends item 8 of stage 03's Outputs list; and `None.`, stage 03's Shell notes line):

```text
`[generic]` marks a note that helps any project on the same platform (Windows, PowerShell 5.1, Git Bash); `[local]` marks a note that depends on FinLife's own files, tools or layout.
Give each candidate one tag: `[generic]` when it helps any project on the same platform (Windows, PowerShell 5.1, Git Bash), or `[local]` when it depends on FinLife's own files, tools or layout, as in each stage file's Shell notes.
None.
```

### Ledger (bookkeeping)

Add the T837 row to `## Phase 164 - Runtime-neutral ICM stage files`, after the T836 row (T836 created the section; if it is missing, create it from the ledger's template with the heading and branch line T836's spec gives). Task cell: `The three stage files share one skeleton (Role and orders, Inputs, Process, Outputs, Verify, Never, Shell notes, STATUS line); shell notes tagged [generic] or [local] by the owner's definitions (4 generic, 1 local); stage 03 asks for one tag per rule candidate and says None. under Shell notes; a sentence-level proof shows no sentence was reworded`. Files cell: `` `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `docs/audit/task-ledger.md` ``. Commit empty. Gate result: Gate 1's and Gate 3's `bad` counts and Gate 2's test count.

### Build report: Shell note tags (required)

The build report `workflow/stages/02_build/output/task-T837-build.md` has a section headed exactly `## Shell note tags`, holding one `- ` line per shell note of the three files after the edit, in file order then note order, each `- <path>: [<final tag>] <the note's first six words>` (words split at single spaces, counted after the tag). For the blocks in this spec those are the five lines in the plain fence below (shown for reading; nothing extracts it). The builder's Gate 1 run, made before the report exists, prints each one after `INFO R9 expects `, and the report copies those lines from the log, not a retyped list. Check `R9` compares the section with the files themselves, so a wrong tag, a missing note or a changed order fails the reviewer's run. The section may also hold the tag table's reasons as prose or a table; `R9` reads only its lines that start with `- `, so it holds no other `- ` line.

```
- workflow/stages/01_spec/CONTEXT.md: [generic] A gate that checks line endings
- workflow/stages/01_spec/CONTEXT.md: [generic] A gate that counts em dashes
- workflow/stages/02_build/CONTEXT.md: [generic] In Windows PowerShell 5.1, `>`, `>>`
- workflow/stages/02_build/CONTEXT.md: [local] Run the command through `cmd /c`
- workflow/stages/02_build/CONTEXT.md: [generic] Use `| Out-File -Encoding utf8 <log>`
```

## 8. Gates

The docs-only tier runs nothing by itself; the owner adds the proof, and the guard test is cheap. Run from the repo root, in this order, after the edit. `<logs>` is `workflow/stages/02_build/output/logs` for the builder and `workflow/stages/03_review/output/logs` for the reviewer. Save each gate's output as UTF-8 by stage 02's forms (`cmd /c '... > <log> 2>&1'` in PowerShell, `2>&1 | tee <log>` in Git Bash).

**Gate 0, save the script.** Extract the one `js` block below from this spec with a script, never by retyping, and save it as `<logs>/T837-restructure.cjs`. For example: `node -e "const s=require('fs').readFileSync('workflow/stages/01_spec/output/task-T837-spec.md','utf8').split('\r\n').join('\n');const F='\x60'.repeat(3);const m=s.match(new RegExp(F+'js\n([^]*?)\n'+F));require('fs').writeFileSync(process.argv[1],m[1]+'\n')" <logs>/T837-restructure.cjs`.

**Gate 1, the proof.** `node <logs>/T837-restructure.cjs check`, saved to `<logs>/T837-check.log`. Expect every line `OK` and the last line `bad 0`; the builder's run, made before the build report exists, also prints the five `INFO R9 expects` lines, and the reviewer's run prints two `R9` lines instead, both `OK` (dry run in a scratch repo: 40 `OK` lines for the builder, 43 for the reviewer, whose run also counts the build report's em dashes). It checks:

- R1: the `HEAD` text of each stage file matches its pin (T836 landed as specced); the New sentences block holds three lines, each one sentence, the third exactly `None.`; the definition sentence and the Instruction each hold `[generic]` with "helps any project on the same platform (Windows, PowerShell 5.1, Git Bash)" and `[local]` with "depends on FinLife's own files, tools or layout", word for word.
- R2: each target equals its block (CRLF normalised).
- P1 to P7 per file: the pure-restructure rules in section 7. On a `P4` or `P5` failure the line quotes the first 70 characters of each missing or extra sentence.
- R3: stage 02's steps 4 and 5 are consecutive, with step 5's `Logs are UTF-8` and text-landed sub-bullets after it and before step 6; stage 03's step 6 is followed by sub-steps 1 to 4.
- R4: T836's done-when, no `Claude Code|agy|Gemini|Sonnet|Opus` on any line of the three files.
- R5: 0 em dashes in the added diff lines of the targets and the ledger, and in this spec and the build report (when present).
- R6: every target and the ledger is `w/crlf` in `git ls-files --eol` and holds 0 bare LF.
- R7: the ledger has exactly one `| T837 |` row.
- R8: `git status --porcelain -uall` lists only the three targets, `docs/audit/task-ledger.md`, the T837 spec, build and review files and the T838 spec file (spec'd in parallel). Logs are gitignored and do not show.
- R9: the build report's `## Shell note tags` section (section 7) lists every shell note with its final tag and first six words, in order. While the build report does not exist (the builder's run), `R9` prints one `INFO R9 expects <line>` per note and counts nothing; the reviewer's run checks it.

To rerun the proof after T837 is committed, pass the parent as the ref: `node <logs>/T837-restructure.cjs check <T837-sha>~1`; then `R2` to `R9` are not meaningful (the files may have moved on) and only `R1` and `P1` to `P7` count.

**Gate 2, the guard test.** `npx vitest run unit/workflow-hardening.test.ts`, saved to `<logs>/T837-workflow-hardening.log`. Expect 0 failed.

**Gate 3, the proof catches a reword.** `node <logs>/T837-restructure.cjs selftest`, saved to `<logs>/T837-selftest.log`. Expect `bad 0`: two `S0` lines (the unchanged stage 02 and stage 03 blocks pass the proof) and, for each of eleven mutations, one `changed` line and one `caught` line, each `OK` (24 `OK` lines). The mutations: of the stage 02 block, a reworded sentence, a dropped sentence, an added sentence, a tag outside Shell notes, a renamed skeleton heading, a new `###` heading, the `[local]` note retagged `[generic]`, a reworded definition sentence, and `None.` added under its Shell notes; of the stage 03 block, `None.` dropped and `None.` reworded.

Proof script:

```js
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const NL=String.fromCharCode(10),CR=String.fromCharCode(13),BT='`',F=BT.repeat(3),EM=String.fromCharCode(0x2014);
const SPEC='workflow/stages/01_spec/output/task-T837-spec.md',BUILD='workflow/stages/02_build/output/task-T837-build.md',REVIEW='workflow/stages/03_review/output/task-T837-review.md',LEDGER='docs/audit/task-ledger.md';
const FILES=['workflow/stages/01_spec/CONTEXT.md','workflow/stages/02_build/CONTEXT.md','workflow/stages/03_review/CONTEXT.md'];
const PIN=['b0b340ae6ccb072f74eaf98656647c8b823357a360a7eef1754fc82eff3b8f44','f573ce29e42648947fa83ed6bbd3fd5a0dce330780ded3fb0ae1939dd8c0fd19','25612cabda883c9d1372a0c7c3210c0e53c714fd48eee2028e15cc35bd995e41'];
const TAGS=['local 0 generic 2','local 1 generic 2','local 0 generic 0'];
const SKEL=['Role and orders','Inputs','Process','Outputs','Verify','Never','Shell notes','STATUS line'];
// The owner's two definitions, word for word; the definition sentence and the Instruction must both hold them.
const GEN='helps any project on the same platform (Windows, PowerShell 5.1, Git Bash)',LOC="depends on FinLife's own files, tools or layout";
const mode=process.argv[2]||'check',ref=process.argv[3]||'HEAD';
const norm=s=>s.split(CR+NL).join(NL);
const raw=f=>fs.readFileSync(f,'utf8');
const sh=c=>cp.execSync(c,{encoding:'utf8',maxBuffer:1<<28});
const cnt=(h,x)=>h.split(x).length-1;
let bad=0;
const out=(k,ok,v)=>{if(!ok)bad++;console.log((ok?'OK  ':'BAD ')+k+' '+v);};
const blocks=[...norm(raw(SPEC)).matchAll(new RegExp(F+'text'+NL+'([^]*?)'+NL+F,'g'))].map(m=>m[1]);
if(blocks.length!==4){console.log('BAD spec holds '+blocks.length+' text blocks, expected 4');process.exit(1);}
// The fourth block holds the new sentences, one per line: the definition, the Instruction, and None.
const NEWS=blocks[3].split(NL),[DEF,INSTR,NONE]=NEWS;
const WANT=[[DEF],[DEF],[INSTR,NONE]],PLAIN=[[DEF],[DEF],[NONE]];
const before=FILES.map(f=>norm(sh('git show '+ref+':'+f)));
// A sentence ends at . ! or ? outside a code span when a space follows, except after e.g. and i.e.
const split=t=>{const s=[];let cur='',code=false;for(let i=0;i<t.length;i++){const c=t[i];cur+=c;if(c===BT)code=!code;else if(!code&&'.!?'.includes(c)&&t[i+1]===' '&&!/(^|[^A-Za-z])(e\.g|i\.e)\.$/.test(cur)){s.push(cur.trim());cur='';}}if(cur.trim())s.push(cur.trim());return s;};
// Headings are kept apart; every other non-blank line loses its indent, one list marker and, in the new text, one leading tag.
// In Shell notes, a bullet is a note (it must carry a tag) and a line that is not a bullet is plain text (the definition or None.).
const parse=text=>{const r={h1:[],h2:[],h3:[],deep:0,sents:[],tags:[],untagged:0,plain:[],notes:[],odd:0};let sec='';for(const line of norm(text).split(NL)){if(!line.trim())continue;const h=/^(#+) (.*)$/.exec(line);if(h){const n=h[1].length;if(n===1)r.h1.push(h[2]);else if(n===2){r.h2.push(h[2]);sec=h[2];}else if(n===3)r.h3.push(h[2]);else r.deep++;continue;}if(cnt(line,BT)%2)r.odd++;const bul=/^ *- /.test(line);let t=line.replace(/^ +/,'').replace(/^(-|\d+\.) /,'');const g=/^\[(generic|local)\] /.exec(t);if(g){r.tags.push(g[1]+'@'+sec);t=t.slice(g[0].length);}if(sec==='Shell notes'){if(!bul)r.plain.push(t);else if(g)r.notes.push([g[1],t]);else r.untagged++;}r.sents.push(...split(t));}return r;};
const unmatched=(a,b)=>{const m=new Map();for(const x of b)m.set(x,(m.get(x)||0)+1);const r=[];for(const x of a){const n=m.get(x)||0;if(n)m.set(x,n-1);else r.push(x);}return r;};
const short=a=>a.map(x=>JSON.stringify(x.slice(0,70))).join(' | ');
// The proof: same sentences with the same counts, plus WANT[i] in order; skeleton headings; old headings only as ###; tags only on Shell notes bullets.
const prove=(i,oldText,newText,say)=>{const o=parse(oldText),n=parse(newText),k=FILES[i];
  say('P1 h1 '+k,o.h1.join()===n.h1.join()&&n.h1.length===1,n.h1.join());
  say('P2 skeleton '+k,n.h2.join('|')===SKEL.join('|'),n.h2.join('|'));
  const h3=n.h3.filter(x=>!o.h2.includes(x)||SKEL.includes(x));say('P3 subheadings '+k,h3.length===0&&n.deep===0,n.h3.join('|')+(h3.length?' not old: '+h3.join('|'):''));
  const miss=unmatched(o.sents,n.sents),extra=unmatched(n.sents,o.sents);
  say('P4 old sentences kept '+k,miss.length===0,o.sents.length+' old, missing '+miss.length+(miss.length?': '+short(miss):''));
  say('P5 new sentences '+k,extra.join(NL)===WANT[i].join(NL),extra.length+' new'+(extra.length?': '+short(extra):''));
  const tc='local '+n.tags.filter(x=>x.startsWith('local@')).length+' generic '+n.tags.filter(x=>x.startsWith('generic@')).length;
  const stray=n.tags.filter(x=>!x.endsWith('@Shell notes'));
  say('P6 tags '+k,tc===TAGS[i]&&stray.length===0&&n.untagged===0&&o.tags.length===0&&n.plain.join(NL)===PLAIN[i].join(NL),tc+' outside '+stray.length+' untagged '+n.untagged+' plain '+n.plain.length);
  say('P7 code spans '+k,n.odd===0&&o.odd===0,'odd lines '+n.odd);};
if(mode==='selftest'){
  // Each mutation of the spec's stage 02 or stage 03 text must fail the proof.
  const N2=blocks[1]+NL,N3=blocks[2]+NL,SN='## Shell notes'+NL+NL;
  const M=[['reword',1,N2.replace("- Rerun the spec's gates.","- Rerun the gates.")],['drop',1,N2.replace('- Write an em dash in any file you touch.'+NL,'')],['add',1,N2.replace("- Rerun the spec's gates.","- Rerun the spec's gates. Then rest.")],['tag outside',1,N2.replace("- Rerun the spec's gates.","- [generic] Rerun the spec's gates.")],['heading',1,N2.replace('## Verify','## Checks')],['new subheading',1,N2.replace('### On `fix <id>`','### Fixing')],
    ['retag',1,N2.replace('- [local] Run the command','- [generic] Run the command')],['reworded definition',1,N2.replace(LOC+'.',"depends on FinLife's own files.")],['None. in stage 02',1,N2.replace(SN,SN+NONE+NL+NL)],['drop None.',2,N3.replace(SN+NONE+NL+NL,SN)],['reword None.',2,N3.replace(SN+NONE+NL,SN+'None yet.'+NL)]];
  for(const [i,txt] of [[1,N2],[2,N3]])out('S0 unmutated passes '+FILES[i],(()=>{let f=0;prove(i,before[i],txt,(k,ok)=>{if(!ok)f++;});return f===0;})(),'');
  for(const [name,i,txt] of M){const base=i===1?N2:N3;let f=0;prove(i,before[i],txt,(k,ok)=>{if(!ok)f++;});out('S '+name+' changed',txt!==base,txt!==base);out('S '+name+' caught',f>0,f+' checks failed');}
  console.log('bad '+bad);process.exit(bad?1:0);}
FILES.forEach((f,i)=>{const h=crypto.createHash('sha256').update(before[i]).digest('hex');out('R1 before '+ref+':'+f,h===PIN[i],h.slice(0,12));});
out('R1 new sentences block',NEWS.length===3&&NEWS.every(x=>split(x).length===1)&&NONE==='None.',NEWS.map(x=>split(x).length).join(','));
out('R1 definition and Instruction use the owner\'s wording',[DEF,INSTR].every(x=>x.includes('`[generic]`')&&x.includes(GEN)&&x.includes('`[local]`')&&x.includes(LOC)),'');
if(mode==='apply'){if(bad){console.log('bad '+bad+', nothing written');process.exit(1);}FILES.forEach((f,i)=>fs.writeFileSync(f,(blocks[i]+NL).split(NL).join(CR+NL)));console.log('wrote '+FILES.length+' files');process.exit(0);}
FILES.forEach((f,i)=>{const t=norm(raw(f));out('R2 text landed '+f,t===blocks[i]+NL,t===blocks[i]+NL);prove(i,before[i],t,out);});
const L=FILES.map(f=>norm(raw(f)).split(NL));
{const a=L[1],s4=a.findIndex(x=>x.startsWith('4. Tests first: ')),s5=a.findIndex(x=>x.startsWith('5. Make the change, then run ')),s6=a.findIndex(x=>x.startsWith('6. Keep the task')),tl=a.findIndex(x=>x.startsWith('   - A gate that checks text landed ')),lg=a.findIndex(x=>x.startsWith('   - **Logs are UTF-8**, so '));out('R3 stage 02 steps 4 and 5 keep their numbers and sub-bullets',s4>=0&&s5===s4+1&&s5<lg&&lg<tl&&tl<s6,[s4,s5,lg,tl,s6].join(','));}
{const a=L[2],s6=a.findIndex(x=>x.startsWith('6. **Tests:** '));const subs=[1,2,3,4].every(n=>(a[s6+n]||'').startsWith('   '+n+'. '));out('R3 stage 03 step 6 and 6.1 to 6.4 keep their numbers',s6>=0&&subs,s6);}
{const RX=/Claude Code|agy|Gemini|Sonnet|Opus/;const h=FILES.filter(f=>norm(raw(f)).split(NL).some(l=>RX.test(l)));out('R4 runtime names (T836 done-when)',h.length===0,h.join(',')||'none');}
const T=[...FILES,LEDGER];
const added=sh('git diff -U0 HEAD -- '+T.join(' ')).split(NL).filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join(NL);
out('R5 em dash added lines',cnt(added,EM)===0,cnt(added,EM));
for(const f of [SPEC,BUILD])if(fs.existsSync(f))out('R5 em dash '+f,cnt(raw(f),EM)===0,cnt(raw(f),EM));
for(const f of T){const r=raw(f),eol=sh('git ls-files --eol -- '+f),b=cnt(r,NL)-cnt(r,CR+NL);out('R6 '+f,eol.includes('w/crlf')&&b===0,'w/crlf='+eol.includes('w/crlf')+' bareLF='+b);}
{const n=norm(raw(LEDGER)).split(NL).filter(l=>l.startsWith('| T837 |')).length;out('R7 ledger T837 row',n===1,n);}
const allowed=[...T,SPEC,BUILD,REVIEW,SPEC.replace('T837','T838')];
const extra=sh('git status --porcelain -uall').split(NL).filter(Boolean).map(l=>l.slice(3)).filter(p=>!allowed.includes(p));
out('R8 scope',extra.length===0,extra.length?extra.join(', '):'clean');
// R9: the build report's Shell note tags section lists every note of every file, in order: path, final tag, first six words.
{const want=FILES.flatMap((f,i)=>parse(raw(f)).notes.map(([g,t])=>'- '+f+': ['+g+'] '+t.split(' ').slice(0,6).join(' ')));
  if(!fs.existsSync(BUILD))want.forEach(w=>console.log('INFO R9 expects '+w));
  else{const b=norm(raw(BUILD)).split(NL),h=b.indexOf('## Shell note tags'),sec=h<0?[]:b.slice(h+1,(i=>i<0?b.length:h+1+i)(b.slice(h+1).findIndex(l=>l.startsWith('## ')))).filter(l=>l.startsWith('- '));
    out('R9 build report has one Shell note tags section',b.filter(l=>l==='## Shell note tags').length===1,h);
    out('R9 build report lists every shell note and its final tag',sec.join(NL)===want.join(NL),sec.length+' listed, '+want.length+' notes');}}
console.log('bad '+bad);
process.exit(bad?1:0);
```

## 9. Production touch points

None on `AGENTS.md`'s Stop and ask first list: no SQL, no `/api/*` request, no MCP or CLI write, no `vercel.json` or `.github/workflows/` edit. The pause-list consequences of the targets (three `workflow/stages/*/CONTEXT.md` files, on `AGENTS.md`'s ICM pause list):

- The owner gave the go-ahead with the amendment this spec now carries (tag definitions, the re-tag, `None.`, the build report's tag list); no second pause is needed for it. Points for the owner: of the five shell notes, four are `[generic]` and one is `[local]` (the `cmd /c` and `tee` note, whose only commands are this repo's `npm run test:unit` and its logs path; section 7, tag table).
- The strict reviewer reviews T837.
- At Release, the Phase 164 PR is not auto-merged: the orchestrator reports the PR link and the owner merges it.

## 10. Out of scope

- Rewording, merging or splitting any sentence, and splitting any line except old `02_build:27` at its three sentence boundaries above (into step 5's sub-bullet and three Shell notes). That includes the stale-looking but still correct cross-references (`stage 02 step 5`, `step 6's stash`) and the Never fragments of stage 02 (`Read ...`, `Use ...`), which read correctly only under a Never heading.
- Any new sentence besides the three in the New sentences block: no section intros, no definition in stage 03's Shell notes (its Instruction carries the definitions), no note under `None.`.
- Renumbering stage 02's steps or stage 03's steps 1 to 6, or moving step 5's text-landed sub-bullet.
- T838's note on the log rule, and `workflow/orchestrator/MASTER.md`, `workflow/orchestrator/loaders/*`, `workflow/orchestrator/runtimes.md`, `.claude/agents/*`, `AGENTS.md`, `CLAUDE.md`.
- Keeping the proof script in `scripts/` or adding a unit test or CI guard that freezes the skeleton: not asked for, and nothing else reads it.
- `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (T838 ships the phase), the ledger's Backlog and its size note.
