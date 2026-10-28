# T823 spec: a text-landed gate reads its expected text from the spec with a script

Phase 155 (`phase-155-rule-candidates`, cut from `main` at `56f0dd3`). Docs only, no ADR. Source: Backlog row `docs/audit/task-ledger.md:104`.

## 1. Goal

Add a rule to the builder stage file: a gate that checks text landed reads the expected text from the spec's code blocks with a script, never retyped. Add the matching sentence to the spec stage file, so spec authors put each such text in a fenced block a script can read.

## 2. Target files

- `workflow/stages/02_build/CONTEXT.md`
- `workflow/stages/01_spec/CONTEXT.md`
- `docs/audit/task-ledger.md` (bookkeeping: the Phase 155 section, the T823 row, Backlog row 104)

No ADR. Phase 153 set the precedent: a docs-only rule change ships with no ADR (`docs/audit/task-ledger.md:58`), and T772, which added the stage-file rules this one sits beside, had none either. Not the phase's last task: T824 ships `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`, so T823 does not touch them.

## 3. Context to read

None. This is a docs-only task. The builder reads `AGENTS.md`, this spec, and the three files above in full.

## 4. Current behaviour

- **The failure (Phase 137, T772):** the T772 spec gave each edit's New text as a fenced block and its gate 3 said "a Node check that each New text ... occurs exactly once" (`workflow/stages/01_spec/output/task-T772-spec.md:178`). The builder's gate 3 reported "New text for edits 1 to 7 occurred exactly 1 time" (`workflow/stages/02_build/output/task-T772-build.md:46`). The file actually had a stray `"` at character 630 of 632 of edit 2. The reviewer's script, which read every block from the spec, found edit 2's New text 0 times (`workflow/stages/03_review/output/task-T772-review.md:73`, `:85`). The rule candidate is at `task-T772-review.md:108`. In the fix round the builder read the texts from the spec's code blocks with a script (`task-T772-build.md:99-100`), and that caught what the retyped check missed (`task-T772-review.md:53`).
- **Stage 02 today:** step 5 says "Make the change, then run the spec's gates **once**" (`workflow/stages/02_build/CONTEXT.md:26`). Nothing says where a gate's expected text comes from.
- **Stage 01 today:** its Rules have shell-safety rules for gates (line endings at `workflow/stages/01_spec/CONTEXT.md:50`, em dashes at `:51`). Nothing says how a spec presents exact text so that a script can read it.
- **Stage 03 today:** step 4 says "run the spec's gate commands yourself" (`workflow/stages/03_review/CONTEXT.md:10`). Once the spec writes the text-landed gate as a script that reads its blocks, the reviewer inherits that gate, so stage 03 needs no change.
- **Compliance (AGENTS.md: "A rule enters ... only once the code complies"):** this is a process rule, and no current file contradicts it. No stage file holds a text-landed gate of its own. Stage 03 step 4 already runs the spec's gate commands as written. T772's spec already gave its edit texts as fenced blocks, and the T772 fix round and both review rounds already used the scripted check. The rule applies to specs written from now on. Past spec, build and review files are records and are not edited.

## 5. Parity map

None.

## 6. Tests to add

None. The change is docs only and cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

All three files are CRLF (`git ls-files --eol`: `w/crlf`). Keep CRLF. Insert each text exactly as its block holds it. Insert by script, never by retyping. For example, read the block from this spec with Node and splice it in after the anchor line, joining with `\r\n`.

### Edit 1: `workflow/stages/02_build/CONTEXT.md`, a sub-bullet under step 5

Insert this line directly after line 26, the step that starts `5. Make the change`, and before `6. Keep the task's row`. It is indented three spaces, so it nests under step 5.

```
   - A gate that checks text landed (a line, phrase or block occurs in a file) reads the expected text from the spec file's fenced code blocks with a script, turning `\r\n` into `\n` in both texts before counting, and never from a copy typed into the command: in T772 a retyped check passed while the edit differed from the spec by one character.
```

### Edit 2: `workflow/stages/01_spec/CONTEXT.md`, a new Rules bullet

Insert this line directly after line 51, the bullet that starts `- A gate that counts em dashes`, and before `- Stop after writing the spec.`:

```
- When a spec gives the exact text an edit adds or replaces, or a text a gate checks landed, each such text is its own fenced code block that holds exactly that text, with no prose, ellipsis or placeholder inside. The text-landed gate names its blocks (for example "edit 2's New text") and reads them from the spec with a script, as stage 02 step 5 says, never retyped.
```

### Edit 3: `docs/audit/task-ledger.md`

If the Phase 155 section is missing, create it directly above `## Backlog` (line 74), from the template at the end of the ledger. Its heading is this block:

```
## Phase 155 - Rule candidates from Phase 137 (docs only, no ADR)
```

T824 is specced in parallel and adds its own row to the same section. If the section already exists, append the T823 row under its table and leave the heading and any T824 row alone. Add no prose line under the heading: the deploy record writes it.

The T823 row: `| T823 | Rule: a text-landed gate reads its expected text from the spec's fenced code blocks with a script, never retyped (02_build step 5 sub-bullet; matching spec-writing bullet in 01_spec Rules) | \`workflow/stages/02_build/CONTEXT.md\`, \`workflow/stages/01_spec/CONTEXT.md\`, \`docs/audit/task-ledger.md\` | done | | <gate result> |`. Use `in-progress` while building. The Gate result cell holds the section 8 results and their counts. Leave `Commit` empty.

Backlog row 104 (it starts `| A gate that checks text landed`): set its Status cell from `todo` to this block's text. Change nothing else on the row.

```
done in Phase 155 (T823)
```

Do not touch Backlog row 105 (T824's).

## 8. Gates

Docs-only tier: nothing runs, except checking each count or path the new text states. Run from the repo root, in Git Bash.

1. **Text landed, read from this spec by script.** The script takes the five fenced blocks of this spec in order: edit 1, edit 2, the Phase 155 heading, the Backlog status, and this script itself. It checks that each of the first four occurs exactly once in its file and sits at its anchor: under step 5, under the em dash bullet, above `## Backlog`, and on row 104. A negative control then changes one character of the landed text in memory and counts again, which must give 0. Before the build it prints 0 for every count and exits 1, as seen while writing this spec. After the build every `n` must be 1, every `anchor` true, every `control` 0, with exit 0. Run the script from this spec too, never retyped: write the fifth block to a scratch file with Node (`node -e 'const s=require("fs").readFileSync("workflow/stages/01_spec/output/task-T823-spec.md","utf8").replace(/\r\n/g,"\n");require("fs").writeFileSync(process.argv[1],[...s.matchAll(/^`{3}[^\n]*\n([\s\S]*?)\n`{3}$/gm)][4][1])' <scratch>/gate1.sh`), then run `bash <scratch>/gate1.sh` from the repo root. While writing this spec, the script also ran on a scratch copy of the three files with the four blocks spliced in by script, and gave n 1, anchor true and control 0 for all four, exit 0. With one character dropped from edit 1 in that copy, it gave n 0 for block 0, exit 1.

```
node -e '
const fs=require("fs"),rd=f=>fs.readFileSync(f,"utf8").replace(/\r\n/g,"\n");
const b=[...rd("workflow/stages/01_spec/output/task-T823-spec.md").matchAll(/^`{3}[^\n]*\n([\s\S]*?)\n`{3}$/gm)].map(m=>m[1]);
if(b.length!==5){console.log("blocks",b.length);process.exit(1)}
const B="workflow/stages/02_build/CONTEXT.md",S="workflow/stages/01_spec/CONTEXT.md",L="docs/audit/task-ledger.md";
const c=[[B,0,(p)=>p.startsWith("5. Make the change")],[S,1,(p)=>p.startsWith("- A gate that counts em dashes")],[L,2,(p,s,at)=>at<s.indexOf("\n## Backlog")],[L,3,(p)=>p.startsWith("| A gate that checks text landed")]];
let ok=true;
for(const [f,i,a] of c){const s=rd(f),t=b[i],n=s.split(t).length-1,at=s.indexOf(t);
const pre=s.slice(0,Math.max(at,0)).split("\n"),p=pre[pre.length-1]||pre[pre.length-2]||"";
const anchor=at>=0&&a(p,s,at),k=at+5,s2=at<0?s:s.slice(0,k)+(s[k]==="#"?"$":"#")+s.slice(k+1),control=s2.split(t).length-1;
console.log(f,"block",i,"n",n,"anchor",anchor,"control",control);if(n!==1||!anchor||control!==0)ok=false}
process.exit(ok?0:1)'
```

2. **Diff shape:** `git diff --numstat -- workflow/stages/02_build/CONTEXT.md workflow/stages/01_spec/CONTEXT.md` gives `1 0` for each. The ledger diff touches only the Phase 155 section and row 104 (`git diff -U0 -- docs/audit/task-ledger.md`).
3. **Stated references:** the new 01_spec bullet says "stage 02 step 5". Check that `workflow/stages/02_build/CONTEXT.md` step 5 is still the step that runs the gates and that edit 1 sits under it (gate 1's anchor covers this). Edit 1 names T772: `workflow/stages/03_review/output/task-T772-review.md` exists and its Round 1 section 8 holds this candidate.
4. **Line endings:** `git ls-files --eol workflow/stages/02_build/CONTEXT.md workflow/stages/01_spec/CONTEXT.md docs/audit/task-ledger.md` shows `w/crlf` for all three. A Node count of bare `\n` gives 0 for each: `node -e 'for(const f of process.argv.slice(1)){const s=require("fs").readFileSync(f,"utf8");console.log(f,s.split("\n").length-1-(s.split("\r\n").length-1))}' workflow/stages/02_build/CONTEXT.md workflow/stages/01_spec/CONTEXT.md docs/audit/task-ledger.md`.
5. **Em dashes:** 0 in the added lines and in the touched files, counted with the character built from its code: `node -e 'const D=String.fromCharCode(8212),o=require("child_process").execSync("git diff -U0 HEAD",{encoding:"utf8",maxBuffer:1<<28});console.log(o.split("\n").filter(l=>l.startsWith("+")&&!l.startsWith("+++")).join("\n").split(D).length-1)'` and `node -e 'const D=String.fromCharCode(8212);for(const f of process.argv.slice(1))console.log(f,require("fs").readFileSync(f,"utf8").split(D).length-1)' workflow/stages/02_build/CONTEXT.md workflow/stages/01_spec/CONTEXT.md docs/audit/task-ledger.md workflow/stages/01_spec/output/task-T823-spec.md workflow/stages/02_build/output/task-T823-build.md`.
6. **Scope:** `git status --porcelain` lists only the three target files and the T823 spec, build report and review. If T824's build has already run, its own files may show too. Name them and leave them alone.

## 9. Production touch points

None. Nothing on the Stop and ask first list is run or edited. `workflow/stages/02_build/CONTEXT.md` and `workflow/stages/01_spec/CONTEXT.md` are stage `CONTEXT.md` files, which are on the pause list, so the orchestrator pauses for the owner's go-ahead before `build T823`. The owner approves the T823 and T824 specs together. The PR stays docs only: every changed file is `*.md` (the reviewer's classifier counts `workflow/stages/**/CONTEXT.md` as `.md`). Under the Release bullet, a stage `CONTEXT.md` and a docs-only PR both rule out auto-merge, so the owner merges.

## 10. Out of scope

- `workflow/stages/03_review/CONTEXT.md`: step 4 already runs the spec's gate commands, and edit 2 makes those gates read the blocks by script. Adding a third sentence would only repeat it.
- `AGENTS.md`, `docs/contexts/*`, and anything T824 owns: Backlog row 105, its ledger row, `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`. T824 is the phase's last task and writes the closing entries.
- Any other line of the stage files. In particular, do not renumber the steps (stage 01 line 39 cites "stage 02 step 4" and "stage 03 step 6"), and do not reword the line-ending or em dash rules.
- Past spec, build and review files under `workflow/stages/*/output/`.
- Any code, test, config or workflow file: the phase PR must stay docs only.
