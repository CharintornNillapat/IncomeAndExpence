# Spec T834: builder gate logs are UTF-8

Phase 163, branch `phase-163-loader-check` (cut from `main` at `4e3fc4c`). Batched with T835, a separate task.

## 1. Goal

Stage 02 (the builder) saves every gate log as UTF-8, never UTF-16, so `grep` works on it. The build stage file gives the exact command form for Windows PowerShell 5.1 and for Git Bash.

## 2. Target files

```
workflow/stages/02_build/CONTEXT.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T834-build.md`, `workflow/stages/02_build/output/logs/`.

No ADR (a doc-only workflow edit, which `AGENTS.md`'s Workflow section exempts). Not the phase's shipping task, so `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` are not targets (T835 owns `baseline-metrics.md`). T835's spec also leaves the Phase 163 refactor-log entry to "the phase-ending task", so the orchestrator must assign that entry before Release.

## 3. Context to read

None (docs-only task). Read `AGENTS.md` and the whole of `workflow/stages/02_build/CONTEXT.md`.

## 4. Current behaviour

- `workflow/stages/02_build/CONTEXT.md:26` says "Save each full-suite run to `workflow/stages/02_build/output/logs/<id>-<suite>.log`" and names no encoding or command form. Line 25 also sends the red run to `output/logs/<id>-red.log`.
- `AGENTS.md:93` ("Save full-suite output to a log file; under herdr, the builder saves to ... and the reviewer to ...") names no encoding either. It stays as it is: the reviewer and every session outside herdr run Claude Code in Git Bash, whose redirection and `tee` write the program's bytes unchanged (the reviewer's `workflow/stages/03_review/output/logs/T833-gates.log` starts `4f 4b`, plain text). Only the builder runs in PowerShell, and it reads the stage file.
- The builder (agy) runs commands in Windows PowerShell 5.1 (`workflow/orchestrator/runtimes.md:26`, Option B shell row; agy is the builder under both options, `runtimes.md:15`).
- Evidence: `workflow/stages/02_build/output/logs/T833-gates.log` starts with the bytes `ff fe 4f 00`, a UTF-16LE BOM. `grep` finds no ASCII word in it.
- Reproduced by the reviewer on this machine (PowerShell 5.1.26100.9711), running `node` that prints `MARK ok`, Thai text and a check mark to stdout and `ERRLINE` to stderr:

| Form in PowerShell 5.1 | First bytes | `grep -c MARK` | Notes |
|---|---|---|---|
| `node js.js > x.log 2>&1` | `ff fe` (UTF-16LE) | 0 | stderr wrapped in a `NativeCommandError` record |
| `node js.js 2>&1 \| Tee-Object -FilePath x.log` | `ff fe` (UTF-16LE) | 0 | same; 5.1's `Tee-Object` has no `-Encoding` |
| `node js.js 2>&1 \| Out-File -FilePath x.log -Encoding utf8` | `ef bb bf` (UTF-8 BOM) | 1 | Thai and the check mark garbled (decoded in the console code page); stderr wrapped in an error record |
| `cmd /c 'node js.js > x.log 2>&1'` | `4d 41` (plain UTF-8) | 1 | byte-exact, Thai intact; `$LASTEXITCODE` carries the exit code (3 from `process.exit(3)`) |
| Git Bash `node js.js 2>&1 \| tee x.log; echo exit=${PIPESTATUS[0]}` | `4d 41` (plain UTF-8) | 1 | byte-exact; `exit=3` from `process.exit(3)` |

- The same probe with `npx vitest run unit/date-format.test.ts`: `cmd /c` and Git Bash `tee` logs had 0 NUL bytes and 2 `passed` matches; the PowerShell `>` log had a UTF-16LE BOM, 237 NUL bytes and 0 `passed` matches.

## 5. Parity map

None.

## 6. Tests to add

None: the change is a doc edit to a stage file and cannot alter app behaviour. Stage 02 step 4 and stage 03 step 6 do not apply. Gate 2 below runs both documented command forms for real.

## 7. Edit

One edit to `workflow/stages/02_build/CONTEXT.md`: insert one new line directly after the step 5 line (Edit 1 Anchor), so the new line becomes step 5's first sub-bullet, above the existing "A gate that checks text landed" sub-bullet. Change nothing else in the file. Keep the file's CRLF line endings.

Edit 1 Anchor (the existing line, unchanged):

```text
5. Make the change, then run the spec's gates **once**, after all edits. Never edit `src/` while Playwright runs. Save each full-suite run to `workflow/stages/02_build/output/logs/<id>-<suite>.log`.
```

Edit 1 New text (the inserted line, three leading spaces):

```text
   - **Logs are UTF-8**, so `grep` can read them. This covers every file you write under `output/logs/`: full-suite runs, the red log and gate output. In Windows PowerShell 5.1, `>`, `>>` and `Tee-Object` write UTF-16 (the T833 gate log was UTF-16), so never use them for a log. Run the command through `cmd /c` instead, which saves the program's own UTF-8 bytes and leaves its exit code in `$LASTEXITCODE`: `cmd /c 'npm run test:unit > workflow\stages\02_build\output\logs\<id>-unit.log 2>&1'`. In Git Bash use `tee` and print the command's own exit code: `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/<id>-unit.log; echo exit=${PIPESTATUS[0]}`. Use `| Out-File -Encoding utf8 <log>` only for a PowerShell cmdlet's own output (for example `Get-FileHash`): PowerShell decodes piped npm, npx, node or git output in the console code page, which garbles Thai text and symbols, and with `2>&1` it wraps each stderr line in an error record.
```

Ledger (bookkeeping): add the section below `## Phase 162` and above `## Backlog`, from the ledger's template:

- Heading: `## Phase 163 - Loader check and UTF-8 build logs`
- Line under it: ``Branch `phase-163-loader-check`, cut from `main` at `4e3fc4c`. Tasks T834 and T835. No migration.``
- T834 row, Task cell: `Builder gate logs are UTF-8: the build stage file gives the cmd /c form for PowerShell 5.1 and the tee form for Git Bash, and bans >, >> and Tee-Object for logs`; Files cell: `` `workflow/stages/02_build/CONTEXT.md`, `docs/audit/task-ledger.md` ``; Commit empty.

## 8. Gates

The docs-only tier runs nothing by itself, but the new text states commands and paths, so Gate 2 runs them. Run from the repo root, in this order. `<logs>` is `workflow/stages/02_build/output/logs` for the builder and `workflow/stages/03_review/output/logs` for the reviewer (backslashes in the `cmd /c` form).

**Gate 1, save the gate script.** Save the "Gate script" block below, exactly, as `<logs>/T834-gates.cjs`. The reviewer extracts it from this spec with a script, not by retyping.

**Gate 2a, the PowerShell 5.1 form.** Builder, in PowerShell:

```
cmd /c 'npx vitest run unit/date-format.test.ts > workflow\stages\02_build\output\logs\T834-ps-form.log 2>&1'; 'exit=' + $LASTEXITCODE
```

Reviewer, from Git Bash:

```
powershell.exe -NoProfile -Command "cmd /c 'npx vitest run unit/date-format.test.ts > workflow\stages\03_review\output\logs\T834-ps-form.log 2>&1'; 'exit=' + \$LASTEXITCODE"
```

Expect `exit=0`.

**Gate 2b, the Git Bash form.** Builder, from PowerShell:

```
& 'C:\Program Files\Git\bin\bash.exe' -c 'npx vitest run unit/date-format.test.ts 2>&1 | tee workflow/stages/02_build/output/logs/T834-bash-form.log; echo exit=${PIPESTATUS[0]}'
```

Reviewer, in Git Bash:

```
npx vitest run unit/date-format.test.ts 2>&1 | tee workflow/stages/03_review/output/logs/T834-bash-form.log; echo exit=${PIPESTATUS[0]}
```

Expect `exit=0`.

**Gate 3, the checks.** `node <logs>/T834-gates.cjs <logs>`, saving its output as UTF-8 by the Gate 2a or 2b form (for example `cmd /c 'node workflow\stages\02_build\output\logs\T834-gates.cjs workflow/stages/02_build/output/logs > workflow\stages\02_build\output\logs\T834-gates.log 2>&1'`). Expect every line `OK` and the last line `bad 0`. It checks:

- G1 text landed: both `text` blocks of this spec found; the anchor once, the new text once, and the anchor followed directly by the new text once, in the target (CRLF normalised).
- G2 diff shape: `git diff --numstat HEAD` on the target reads 1 insertion, 0 deletions.
- G3 logs: `T834-ps-form.log` and `T834-bash-form.log` exist, start without `ff fe`, hold 0 NUL bytes, and contain a vitest `Tests  N passed` line.
- G4 em dashes: 0 in the added diff lines of the target and the ledger, and 0 in this spec and the build report (when present).
- G5 line endings: the target and the ledger are `w/crlf` in `git ls-files --eol` and hold 0 bare LF.
- G6 scope: `git status --porcelain -uall` lists only the target, `docs/audit/task-ledger.md`, and the T834 and T835 spec, build and review files (T835 is spec'd in parallel; any other T835 file, such as `docs/audit/baseline-metrics.md`, fails the gate). Logs are gitignored and do not show.

Gate script:

```js
const fs=require('fs'),cp=require('child_process');
const F='`'.repeat(3),NL=String.fromCharCode(10),CR=String.fromCharCode(13),TAB=String.fromCharCode(9),EM=String.fromCharCode(0x2014);
const LOGS=(process.argv[2]||'workflow/stages/02_build/output/logs').replace(/[/]+$/,'')+'/';
const SPEC='workflow/stages/01_spec/output/task-T834-spec.md',BUILD='workflow/stages/02_build/output/task-T834-build.md',REVIEW='workflow/stages/03_review/output/task-T834-review.md';
const TGT='workflow/stages/02_build/CONTEXT.md',LEDGER='docs/audit/task-ledger.md';
const norm=s=>s.split(CR+NL).join(NL);
const raw=f=>fs.readFileSync(f,'utf8');
const cnt=(h,x)=>h.split(x).length-1;
const sh=c=>cp.execSync(c,{encoding:'utf8',maxBuffer:1<<28});
let bad=0;
const out=(k,ok,v)=>{if(!ok)bad++;console.log((ok?'OK  ':'BAD ')+k+' '+v);};
const blocks=[...norm(raw(SPEC)).matchAll(new RegExp(F+'text'+NL+'([^]*?)'+NL+F,'g'))].map(m=>m[1]);
out('G1 blocks',blocks.length===2,blocks.length);
const t=norm(raw(TGT));
if(blocks.length===2){
  out('G1 anchor',cnt(t,blocks[0]+NL)===1,cnt(t,blocks[0]+NL));
  out('G1 new text',cnt(t,blocks[1])===1,cnt(t,blocks[1]));
  out('G1 adjacent',cnt(t,blocks[0]+NL+blocks[1]+NL)===1,cnt(t,blocks[0]+NL+blocks[1]+NL));
}
const ns=sh('git diff --numstat HEAD -- '+TGT).trim().split(TAB);
out('G2 numstat',ns[0]==='1'&&ns[1]==='0',ns.slice(0,2).join(' '));
for(const name of ['T834-ps-form.log','T834-bash-form.log']){
  const f=LOGS+name;
  if(!fs.existsSync(f)){out('G3 '+name,false,'missing');continue;}
  const b=fs.readFileSync(f);
  const utf16=b.length>1&&b[0]===0xff&&b[1]===0xfe;
  const nul=b.filter(x=>x===0).length;
  const passed=/Tests +[0-9]+ passed/.test(b.toString('utf8'));
  out('G3 '+name,!utf16&&nul===0&&passed,'utf16='+utf16+' nul='+nul+' passed='+passed);
}
const added=sh('git diff -U0 HEAD -- '+TGT+' '+LEDGER).split(NL).filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join(NL);
out('G4 em dash added lines',cnt(added,EM)===0,cnt(added,EM));
for(const f of [SPEC,BUILD]){if(fs.existsSync(f))out('G4 em dash '+f,cnt(raw(f),EM)===0,cnt(raw(f),EM));}
for(const f of [TGT,LEDGER]){
  const r=raw(f),eol=sh('git ls-files --eol -- '+f);
  const bare=cnt(r,NL)-cnt(r,CR+NL);
  out('G5 '+f,eol.includes('w/crlf')&&bare===0,'w/crlf='+eol.includes('w/crlf')+' bareLF='+bare);
}
const allowed=[TGT,LEDGER,SPEC,BUILD,REVIEW,SPEC.replace('T834','T835'),BUILD.replace('T834','T835'),REVIEW.replace('T834','T835')];
const extra=sh('git status --porcelain -uall').split(NL).filter(Boolean).map(l=>l.slice(3)).filter(p=>!allowed.includes(p));
out('G6 scope',extra.length===0,extra.length?extra.join(', '):'clean');
console.log('bad '+bad);
process.exit(bad?1:0);
```

## 9. Production touch points

None on `AGENTS.md`'s Stop and ask first list: no SQL, no `/api/*` request, no MCP or CLI write, no `vercel.json` or `.github/workflows/` edit. The pause-list consequences of the target `workflow/stages/02_build/CONTEXT.md` (a `workflow/stages/*/CONTEXT.md` file, on `AGENTS.md`'s ICM pause list):

- After this SPEC DONE, the orchestrator pauses for the owner's go-ahead before it sends `build T834`.
- At Release, the Phase 163 PR is not auto-merged (a Target file is on the pause list): the orchestrator reports the PR link and the owner merges it.

## 10. Out of scope

- `AGENTS.md` (its gate-log sentence at line 93 stays: see Current behaviour), `CLAUDE.md`, `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md` (the reviewer runs in Git Bash and its logs are already plain UTF-8), and `workflow/orchestrator/` (MASTER.md, runtimes.md, the loaders).
- Every other line of `workflow/stages/02_build/CONTEXT.md`, including the existing step 5 sub-bullets and the Never list.
- Converting or deleting the existing UTF-16 `T833-gates.log` (gitignored history).
- `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, the ledger's Backlog and the ledger's size note (see Target files).
- A lint guard or unit test for log encodings: the logs are gitignored and no tool reads them but agents.
