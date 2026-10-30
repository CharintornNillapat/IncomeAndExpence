# T835 spec: reconcile the Phase 161 `npm run lint` slowdown figure, and close Phase 163 in the refactor log

Phase 163, branch `phase-163-loader-check` (batched with T834, a separate task; this spec does not touch it or `workflow/stages/02_build/CONTEXT.md`). T835 is the phase's last task, so it also writes the phase's refactor-log entry (amendment: the owner's order, per `AGENTS.md`'s Workflow section for a docs-only phase).

## 1. Goal

`docs/audit/baseline-metrics.md` gives the Phase 161 `npm run lint` slowdown as +1,681 ms, but the T832 review measured +758 ms. Say once, in the metrics doc, which figure is recorded and why, and make sure the refactor log and the ledger agree. Then close the phase: one short Phase 163 entry in `docs/audit/refactor-log.md` covering T834 and T835.

## 2. Target files

```
docs/audit/baseline-metrics.md
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T835 row, see Edit 2) and `workflow/stages/02_build/output/task-T835-build.md`, logs under `workflow/stages/02_build/output/logs/` (gitignored).

No ADR (a figure correction and a closing log entry, not a decision). `docs/audit/refactor-log.md` gets one inserted entry and no other change: the Phase 161 and Phase 162 entries, including the T832 text, stay as they are. `docs/audit/baseline-metrics.md` gets only Edit 1's bullet change and no Phase 163 section, because no bundle or test count changes in this phase.

## 3. Context to read

None (docs only). The builder reads this spec, `docs/audit/baseline-metrics.md:30`, the T832 ledger row, and the Phase 162 entry at `docs/audit/refactor-log.md:20-31` (the format to follow).

## 4. Current behaviour and the decision

Where the two figures live:

- `docs/audit/baseline-metrics.md:30` (Phase 161 Lint bullet): "local median of 3 before (10,064 ms) and after (11,745 ms), delta +1,681 ms (+1.68 s)". No mention of +758 ms.
- `docs/audit/refactor-log.md:38` (Phase 161 Verified, T832 part): "Gate 2 lint runtime before 10064ms after 11745ms delta +1681ms, CI 8s (run 40906673300)". It is the same builder figure.
- `docs/audit/task-ledger.md:131` (T832 Gate result cell): the same text as the refactor-log line.
- `workflow/stages/03_review/output/task-T832-review.md:91` (Round 1, gate 2): "Delta +758 ms ... My machine was noisier than the builder's (+1,681 ms); both pass". This is the only place +758 ms appears in the repo (a grep of `docs/audit/` and `workflow/stages/**/*.md` finds no other).

So the three audit docs already agree with each other; the only disagreement is the review report against them. The evidence settles which figure to record, from the four time files (`workflow/stages/02_build/output/logs/T832-time-before.txt`, `T832-time-after.txt`; `workflow/stages/03_review/output/logs/T832-time-before.txt`, `T832-time-after.txt`):

| | before runs (ms) | after runs (ms) | median before | median after | delta |
|---|---|---|---|---|---|
| Builder | 9,935 / 10,110 / 10,064 | 12,642 / 11,745 / 11,644 | 10,064 (run 3) | 11,745 (run 2) | +1,681 |
| Reviewer | 11,803 / 13,737 / 13,626 | 10,827 / 18,718 / 14,384 | 13,626 (run 3) | 14,384 (run 3) | +758 |

Method is identical: the spec's gate 2 loop, `npm run lint` three times, wall time by `date +%s%N`, every run exit 0, median of three (`task-T832-spec.md:368-374`). The "before" is the pre-edit script on the builder's side and `package.json` stashed on the reviewer's side (review line 91). Cache state: the median "after" run is run 2 for the builder and run 3 for the reviewer, so neither median is the first run that could have created `.cache/eslint/`; the "before" script has no ESLint step, so it has no cache. The builder's runs are tight (spread 175 ms before, 998 ms after). The reviewer's are loose (spread 1,934 ms before, 7,891 ms after), and the same unchanged "before" code ran about 3.5 s slower than on the builder's machine, which is more than the delta being measured. The reviewer's +758 ms is therefore inside its own noise.

Decision: record **+1,681 ms** (the builder's median of 3) as the Phase 161 figure. State +758 ms once, in `baseline-metrics.md`, as the reviewer's noisier cross-check, with both under the 10,000 ms limit. Nothing else about the figure changes. The evidence settles it, so no re-measurement is needed.

The refactor-log entry: `docs/audit/refactor-log.md` is newest-first. Lines 1 to 19 are the title, the archive note and the format block (a fenced example whose own `## Phase NNN` line is not a real entry); the first real entry is the Phase 162 heading at line 20. The Phase 163 entry goes directly above it, followed by a `---` line, following the Phase 162 entry's shape (heading, blank, brief, blank, Changed, Verified, Surprises, Deliberately not done lines, then blank, `---`, blank). The heading keeps `<sha>` placeholders for the commits and the merge: the post-merge deploy procedure fills them (Phase 161's entry says the same under Deliberately not done). The entry has no Post-merge paragraph; the deploy record adds that.

Line endings today (`git ls-files --eol`): `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` are all `i/lf w/crlf` (the working files are CRLF; `refactor-log.md` has 189 `\r\n` and 0 bare `\n`, and no BOM). A line carries a trailing `\r`. Both Edit 1 texts exclude that `\r`, so a plain substring replace keeps CRLF. Edit 3's script converts the inserted lines to the file's own `\r\n`.

## 5. Parity map

None.

## 6. Tests to add

None. Docs only: the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply. Gate 1 checks the text landed.

## 7. Edits and gates

### Edit 1: `docs/audit/baseline-metrics.md`, the Phase 161 Lint bullet (line 30)

Do it with a Node script, not the Edit tool: read the file as a UTF-8 string, check the Old text occurs exactly once, replace that substring (no `\r` in it), write back. Do not touch any other line. Save the script's output to `workflow/stages/02_build/output/logs/T835-edit.log`.

**Edit 1 Old text**

```
- **Lint**: `npm run lint` local median of 3 before (10,064 ms) and after (11,745 ms), delta +1,681 ms (+1.68 s), with `npm run lint:hooks` now its last step; hooks lint warnings reduced from 5 to 0 (T831), 0 errors. CI's lint step was 8 s on run 40906673300; the Phase 161 PR run's figure is the deploy record's.
```

**Edit 1 New text**

```
- **Lint**: `npm run lint` local median of 3 before (10,064 ms) and after (11,745 ms), delta +1,681 ms (+1.68 s), with `npm run lint:hooks` now its last step; hooks lint warnings reduced from 5 to 0 (T831), 0 errors. The +1,681 ms is the builder's figure and the one recorded: same loop as the reviewer's, but its runs were tight (before 9,935 to 10,110 ms, after 11,644 to 12,642 ms) and the median "after" run was not the first, so the ESLint cache was warm. The T832 reviewer's run on a noisier machine (before, with `package.json` stashed, 11,803 to 13,737 ms; after 10,827 to 18,718 ms) gave +758 ms, which sits inside its own 7,891 ms spread, so it is a cross-check, not the figure; both are under the 10,000 ms limit. CI's lint step was 8 s on run 40906673300; the Phase 161 PR run's figure is the deploy record's.
```

### Edit 2: `docs/audit/task-ledger.md`, T835 row (bookkeeping)

Add one row for T835 to the Phase 163 table: `Task` = "Reconcile the Phase 161 `npm run lint` slowdown: record the builder's +1,681 ms in baseline-metrics.md, cite the T832 reviewer's +758 ms once as a noisy cross-check; Phase 163 closing refactor-log entry", `Files` = `` `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` ``, `Status` = `done`, `Commit` empty, `Gate result` = the real gate results. If T834 has already added the `## Phase 163 - ...` heading and table, append the row after its row. If no Phase 163 heading exists yet, add one in the shape of the Phase 162 heading (`docs/audit/task-ledger.md:133-139`), placed after Phase 162 and before `## Backlog`, with the title `Phase 163 - Loader check and UTF-8 build logs`, the line "Branch `phase-163-loader-check`, cut from `main` at `4e3fc4c`. Tasks T834 and T835. No migration." and the table header and separator rows copied from Phase 162's. Write the Task cell without the string "delta +1681ms" (gate 3 counts it). Keep the file's existing line endings (check with `git ls-files --eol`, and count `\r\n` and bare `\n` before and after; the counts change only by the lines added). No Backlog row names this task, so no Backlog Status edit.

### Edit 3: `docs/audit/refactor-log.md`, the Phase 163 entry (inserted above the Phase 162 entry)

Insert the New text below, then a blank line, a `---` line and a blank line, directly above the Anchor line (the Phase 162 heading), with the file's `\r\n` endings. The script adds the blank, `---` and blank lines; the New text block holds only the entry. Do not use the Edit tool: save the script below as `workflow/stages/02_build/output/logs/T835-edit3.cjs`, run `node workflow/stages/02_build/output/logs/T835-edit3.cjs` from the repo root, and save its output to `workflow/stages/02_build/output/logs/T835-edit3.log`. It reads both blocks from this spec (never retyped), requires the anchor exactly once and the new heading absent, then inserts. Expect `inserted 11 lines, crlf true`.

**Edit 3 Anchor**

```
## Phase 162 - Orchestrator prompts in the repo: T833 (2026-10-30, code `7da5b6b`, merged `0703f08`)
```

**Edit 3 New text**

```
## Phase 163 - Loader check and UTF-8 build logs: T834-T835 (2026-10-30, code `<sha>` and `<sha>`, merged `<sha>`)

No ADR (two docs-only edits, which AGENTS.md's Workflow section exempts). T834 makes the builder's gate logs UTF-8, so `grep` can read them; T835 settles which `npm run lint` slowdown figure the Phase 161 metrics record.

**Changed:** T834 (`workflow/stages/02_build/CONTEXT.md`: one new step 5 sub-bullet, "Logs are UTF-8", giving the `cmd /c` form for PowerShell 5.1 and the `tee` form for Git Bash; `docs/audit/task-ledger.md`: Phase 163 section and T834 row); T835 (`docs/audit/baseline-metrics.md`: the Phase 161 Lint bullet names +1,681 ms as the recorded figure and +758 ms as a cross-check; `docs/audit/task-ledger.md`: T835 row; this file).
**Verified:** T834 (Gate 2a `cmd /c` form and Gate 2b Git Bash `tee` form both exit 0, their logs start without `ff fe`, hold 0 NUL bytes and contain a vitest `passed` line; Gate 3 checks bad 0); T835 (G1 text landed, new 1 old 0; G2 every figure matches the T832 time files; G3 the T832 text in the refactor log and the ledger is unchanged; G4 0 em dashes, line endings kept; G5 this entry landed once, above Phase 162; G6 scope clean). No lint, unit or Playwright run: docs-only tier.
**Surprises:** 1. The T833 builder gate log `T833-gates.log` was UTF-16LE (it starts with the bytes `ff fe`), so `grep` found no word in it. In PowerShell 5.1, `>` and `Tee-Object` write UTF-16, and `Out-File -Encoding utf8` adds a BOM and garbles Thai text; `cmd /c` redirection and Git Bash `tee` write the program's own UTF-8 bytes, and the stage 02 `CONTEXT.md` now requires those two forms. The reviewer's logs were never affected: it runs in Git Bash. 2. The Phase 161 slowdown has two measurements: the builder's median of 3 gave +1,681 ms (10,064 to 11,745 ms) and the T832 reviewer's gave +758 ms on a noisier machine, inside its own 7,891 ms spread. `baseline-metrics.md` now records +1,681 ms, with +758 ms as a cross-check; both pass the 10,000 ms limit. The refactor log and the ledger already cited only +1,681 ms, so only the metrics doc changed.
**Deliberately not done:** the gate-log sentence in AGENTS.md (only the builder runs in PowerShell, and it reads the stage file); a lint guard or unit test for log encodings (the logs are gitignored and only agents read them); converting the existing UTF-16 `T833-gates.log`; re-measuring `npm run lint`; editing the Phase 161 refactor-log entry, the T832 ledger cell or the T832 review report (history, already consistent); a Phase 163 section in `baseline-metrics.md` (no bundle or test count changes); filling the `<sha>` placeholders in this heading and the Commit cells in `task-ledger.md`, left to the owner-approved post-merge deploy record.
```

**Edit 3 script**

```js
const fs=require('fs');
const F=String.fromCharCode(96).repeat(3),NL=String.fromCharCode(10),CR=String.fromCharCode(13),CRLF=CR+NL;
const sp=fs.readFileSync('workflow/stages/01_spec/output/task-T835-spec.md','utf8').split(CRLF).join(NL).split(NL);
const blk=m=>{
  const i=sp.findIndex(l=>l.trim()===m);
  if(i<0)throw new Error('no label '+m);
  const a=sp.findIndex((l,k)=>k>i&&l.startsWith(F));
  const b=sp.findIndex((l,k)=>k>a&&l.startsWith(F));
  return sp.slice(a+1,b).join(NL);
};
const anchor=blk('**Edit 3 Anchor**'),ins=blk('**Edit 3 New text**');
const P='docs/audit/refactor-log.md';
const s=fs.readFileSync(P,'utf8');
const n=s.split(anchor).length-1;
if(n!==1)throw new Error('anchor count '+n);
const head=ins.split(NL)[0];
if(s.includes(head))throw new Error('entry already present');
const crlf=s.includes(CRLF);
const eol=crlf?CRLF:NL;
const lines=ins.split(NL);
const out=lines.concat(['','---','']);
fs.writeFileSync(P,s.replace(anchor,()=>out.join(eol)+eol+anchor));
console.log('inserted '+out.length+' lines, crlf '+crlf);
```

### Gates

Docs only, and the docs state figures and paths, so check each against its source. Run in Git Bash from the repo root; save output to `workflow/stages/02_build/output/logs/T835-gates.log` with `tee` (reviewer: `workflow/stages/03_review/output/logs/`). No `npm run lint`, no unit or Playwright run (docs-only tier).

G1. Text landed (Edit 1): the Old line is gone and the New line is present exactly once, both read from this spec by script. Expect `new 1 old 0`.

```
node -e "const fs=require('fs');const sp=fs.readFileSync('workflow/stages/01_spec/output/task-T835-spec.md','utf8').split('\n');const f='\x60\x60\x60';const blk=m=>{const i=sp.findIndex(l=>l.trim()===m);const a=sp.findIndex((l,k)=>k>i&&l.startsWith(f));const b=sp.findIndex((l,k)=>k>a&&l.startsWith(f));return sp.slice(a+1,b).join('\n')};const o=blk('**Edit 1 Old text**'),n=blk('**Edit 1 New text**');const d=fs.readFileSync('docs/audit/baseline-metrics.md','utf8').split('\n').map(l=>l.trimEnd());const c=x=>d.filter(l=>l===x).length;console.log('new',c(n),'old',c(o));process.exit(c(n)===1&&c(o)===0?0:1)"
```

G2. The figures in the Edit 1 New text match their source files. Every number below must appear in the named file: `9,935`, `10,110`, `11,644`, `12,642` in `workflow/stages/02_build/output/logs/T832-time-before.txt` and `T832-time-after.txt` (as `9935`, `10110`, `11644`, `12642`); `11,803`, `13,737`, `10,827`, `18,718` in the reviewer's `workflow/stages/03_review/output/logs/T832-time-before.txt` and `T832-time-after.txt` (as `11803`, `13737`, `10827`, `18718`); `7,891` equals 18718 minus 10827; +758 equals 14384 minus 13626; +1,681 equals 11745 minus 10064. The Edit 3 entry repeats +1,681, +758, 7,891, 10,064 and 11,745, so one run covers both. Run:

```
cd workflow/stages && grep -c "ms=9935\|ms=10110\|ms=12642\|ms=11644" 02_build/output/logs/T832-time-before.txt 02_build/output/logs/T832-time-after.txt; grep -c "ms=11803\|ms=13737\|ms=10827\|ms=18718" 03_review/output/logs/T832-time-before.txt 03_review/output/logs/T832-time-after.txt; echo $((18718-10827)) $((14384-13626)) $((11745-10064))
```

Expect one `file:count` line per file, each `:2`, in this order: builder before (9935, 10110), builder after (12642, 11644), reviewer before (11803, 13737), reviewer after (10827, 18718); then the line `7891 758 1681`.

G3. The T832 text in the refactor log and the ledger is unchanged, and the new entry is the refactor log's only mention of 758: `grep -c "758" docs/audit/refactor-log.md` prints `2` (the new entry's Changed and Surprises lines); `grep -o "delta +1681ms" docs/audit/refactor-log.md docs/audit/task-ledger.md` prints one hit per file. Neither file's T832 text changes.

G4. Em dashes and line endings. Added-lines count, expect `0`:

```
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
```

Whole files, expect `0` each, for `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` and the build report:

```
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/baseline-metrics.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T835-build.md
```

Line endings: `git ls-files --eol docs/audit/baseline-metrics.md docs/audit/refactor-log.md docs/audit/task-ledger.md` still shows `w/crlf` for all three, and a Node count of bare `\n` (a `\n` not preceded by `\r`) in each file is the same as before the edits (record the three counts before Edit 1; `refactor-log.md` starts at 0).

G5. The Phase 163 entry (Edit 3) landed once, above Phase 162, as the first real entry. Reads both blocks from this spec and the refactor log with CRLF normalised. Expect `true true true true` and exit 0 (new text once; anchor once; new text, blank line, `---`, blank line, anchor in that order; new text starting at the first real entry heading):

```
node -e "const fs=require('fs');const sp=fs.readFileSync('workflow/stages/01_spec/output/task-T835-spec.md','utf8').split('\n');const f='\x60\x60\x60';const blk=m=>{const i=sp.findIndex(l=>l.trim()===m);const a=sp.findIndex((l,k)=>k>i&&l.startsWith(f));const b=sp.findIndex((l,k)=>k>a&&l.startsWith(f));return sp.slice(a+1,b).join('\n')};const a=blk('**Edit 3 Anchor**'),n=blk('**Edit 3 New text**');const d=fs.readFileSync('docs/audit/refactor-log.md','utf8').split('\r\n').join('\n');const c=x=>d.split(x).length-1;const first=d.search(/\n## Phase \d{3} /)+1;const r=[c(n)===1,c(a)===1,c(n+'\n\n---\n\n'+a)===1,d.indexOf(n)===first];console.log(r.join(' '));process.exit(r.every(Boolean)?0:1)"
```

G6. Scope: `git diff --numstat HEAD -- docs/audit/baseline-metrics.md docs/audit/refactor-log.md` prints `1	1	docs/audit/baseline-metrics.md` and `11	0	docs/audit/refactor-log.md` (the entry is 8 lines, plus a blank line, `---` and a blank line; nothing deleted). `git diff --stat` also lists `docs/audit/task-ledger.md`, plus T834's files if that task is already in the tree; `git status --porcelain` adds only the untracked T835 spec and build report. `workflow/stages/02_build/CONTEXT.md` is not modified by this task.

## 8. Production touch points

None. No live SQL, no `/api/*` request, no workflow or `vercel.json` edit, no dependency. No `AGENTS.md`, `src/`, `supabase/`, `api/` or stage `CONTEXT.md` file is a target, so the orchestrator does not pause after this spec. Phase 163 as a whole does pause, because of T834's target (see T834's spec, section 9).

## 9. Out of scope

- Re-measuring `npm run lint`. The four time files settle the figure. (If the owner ever wants a third measurement, the one command is the spec's gate 2 loop at `task-T832-spec.md:370`; this task does not run it.)
- Editing any existing text in `docs/audit/refactor-log.md` (the Phase 161 and 162 entries included), the T832 ledger Gate result cell, or the T832 review report. They are history and already consistent.
- A Phase 163 section in `docs/audit/baseline-metrics.md` (no bundle or test count changes), T834, `workflow/stages/02_build/CONTEXT.md`, and any other Phase 161 figure (bundle, Vitest, Playwright).
- Filling the `<sha>` placeholders or the ledger Commit cells: the post-merge deploy procedure does.
