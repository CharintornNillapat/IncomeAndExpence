# Task T829 spec: faster gates (builder runs Playwright on chromium only, reviewer runs all three browsers once)

Phase 160, branch `phase-160-faster-gates`, cut from `main` at `dc9a065`. Order: Backlog row in `docs/audit/task-ledger.md:157` ("Builder runs the affected specs on chromium only; ..."). Phase 160 also holds T830 (a unit-test flake, its own spec); T829 does not ship the phase.

**Amended 2026-10-29 at the owner's order.** The owner approved the spec with one change: the Backlog row's log reuse is dropped entirely. No tree fingerprint, no logged lint and unit block, no reuse of the builder's lint or unit logs by the reviewer, no helper script for it. What is left: the builder runs the affected Playwright specs on chromium only, and the reviewer runs them once on all three browsers and runs its own lint and unit as today. The owner said no pause is needed after this amendment.

**On the pause list.** The Target files include `AGENTS.md` and three `workflow/stages/*/CONTEXT.md` files, so the phase's pull request is merged by the owner, never auto-merged (`AGENTS.md`, ICM section, Pause after the spec and Release).

## 1. Goal

The builder runs the affected Playwright specs on chromium only, and the reviewer runs them once on all three browsers. The reviewer still runs lint, unit and every other gate itself, as today, so no tier is removed.

## 2. Target files

```
AGENTS.md
workflow/stages/01_spec/CONTEXT.md
workflow/stages/02_build/CONTEXT.md
workflow/stages/03_review/CONTEXT.md
docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T829-build.md`, and helper files and logs under `workflow/stages/02_build/output/logs/` (gitignored).

No new ADR: like Phase 157 (T826), this changes workflow rules, not ADR 0101's decision, so it is an amendment appended to ADR 0101 (edit 7). Not `docs/audit/refactor-log.md` or `docs/audit/baseline-metrics.md`: T829 does not ship Phase 160.

**Why the two agent files are no longer targets.** `.claude/agents/fin-reviewer.md:8` and `.claude/agents/fin-reviewer-strict.md:8` say "Run the spec's gate commands yourself." Only the log reuse contradicted that, because a builder's run would have stood in for the reviewer's. Without it the reviewer runs every gate itself. When it skips a `--project=chromium` gate, its own run of the same specs without a project filter includes the chromium project, so it still runs those tests itself. Both files stay as they are.

## 3. Context to read

None: a docs-only task (workflow rules and an ADR amendment). Read every target file in full before the first edit, and the ledger's Backlog row at `docs/audit/task-ledger.md:157`.

## 4. Current behaviour

- `AGENTS.md:82`, `:85`, `:86`: three tier rows pair a chromium run with an all-browser run. Rows 82 and 86 say "with `--project=chromium`, then without a project filter"; row 85 says "on chromium, then on all three browsers".
- `AGENTS.md:76`: "An owner's task description may add gates but never remove a tier." This rule stays as it is.
- `AGENTS.md:93`: the before-done line (lint, unit, the affected specs) and the log folders of both stages; nothing says which stage runs which Playwright step.
- `workflow/stages/01_spec/CONTEXT.md:40`: the spec copies the tier rows as commands.
- `workflow/stages/02_build/CONTEXT.md:26`: the builder runs all of the spec's gates once, after all edits, so it runs both the chromium step and the all-browser step; `:29`: the build report lists each gate command, its counts and log path.
- `workflow/stages/03_review/CONTEXT.md:10`: the reviewer runs every spec gate itself ("Do not copy the builder's numbers"), so it runs chromium again and all three browsers again.
- `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md:76`: section 3 says the review "runs the gates itself"; the file ends at `:160` with the Phase 159 amendment.
- `.claude/agents/fin-reviewer.md:8` and `.claude/agents/fin-reviewer-strict.md:8`: "Run the spec's gate commands yourself." Unchanged by this task (section 2).
- Measured cost (Backlog row, `docs/audit/task-ledger.md:157`): in Phase 158 the builder spent 9.4 min on Playwright and the reviewer 7.0 min on the same 11 specs.

## 5. Parity map

None.

## 6. Tests to add

None. The change edits workflow rules and an ADR; it cannot alter app behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. Edits

Make each edit exactly as given; each New text is its own block below, read by gate 1. Keep each file's line endings: `AGENTS.md`, the three `CONTEXT.md` files and ADR 0101 are CRLF in the working tree; `docs/audit/task-ledger.md` is LF. Edits with an Old text replace it; the others insert where stated.

### Edit 1 (`AGENTS.md:85`): one wording for the Playwright pair

Edit 1, old text:

```
| `src/context/`, `src/hooks/`, `src/lib/` | The row above, plus the affected spec(s) on chromium, then on all three browsers |
```

Edit 1, new text:

```
| `src/context/`, `src/hooks/`, `src/lib/` | The row above, plus the affected spec(s) with `--project=chromium`, then without a project filter |
```

### Edit 2 (`AGENTS.md`): new paragraph after line 93

Insert after the paragraph that ends `Check ports 3000 and 3100 for stale dev servers before Playwright.` (line 93), with one blank line before it and one blank line between it and `## Domain context routing`.

Edit 2, new text:

```
**Under herdr, the Playwright pair splits by stage** (ADR 0101, Phase 160 amendment). The builder runs each Playwright gate with `--project=chromium` and leaves each one without a project filter to the reviewer, who runs it once, on all three browsers. The reviewer still runs every other gate itself, `npm run lint` and `npm run test:unit` included. The split removes no tier: every tier command still runs in the task. Outside herdr, one session runs both Playwright steps, chromium first.
```

### Edit 3 (`workflow/stages/01_spec/CONTEXT.md:40`): the spec copies the pair

Edit 3, old text:

```
7. **Gates:** the union of `AGENTS.md`'s tier rows for every changed path, copied as commands, not tier names. An owner's task description may add gates but never remove a tier.
```

Edit 3, new text:

```
7. **Gates:** the union of `AGENTS.md`'s tier rows for every changed path, copied as commands, not tier names. An owner's task description may add gates but never remove a tier. Copy a tier row's Playwright pair as its two commands, `--project=chromium` and then without a project filter: stage 02 runs the first and stage 03 the second.
```

### Edit 4 (`workflow/stages/02_build/CONTEXT.md`): one bullet under step 5

Insert directly after line 27 (the bullet that ends `while the edit differed from the spec by one character.`) and before `6. Keep the task's row`, with no blank lines.

Edit 4, new text:

```
   - **Playwright runs on chromium only.** Run each Playwright gate that has `--project=chromium`. A Playwright gate without a `--project` filter (`npx playwright test <files>` or `npm test`) is the reviewer's: do not run it, and list it in the build report under `Left to the reviewer`. When the spec lists such a gate with no `--project=chromium` partner for the same spec files, run the partner instead: the same command with `--project=chromium` added (`npm test -- --project=chromium` for `npm test`). A gate that names another project runs as written.
```

### Edit 5 (`workflow/stages/02_build/CONTEXT.md:29`): the build report

Edit 5, old text:

```
7. Write `workflow/stages/02_build/output/task-<id>-build.md`: task id, files changed (with the count), tests added and their fail-then-pass evidence, each gate command with its exact counts and log path, and anything not done.
```

Edit 5, new text:

```
7. Write `workflow/stages/02_build/output/task-<id>-build.md`: task id, files changed (with the count), tests added and their fail-then-pass evidence, each gate command with its exact counts and log path, the Playwright gates `Left to the reviewer`, and anything not done.
```

### Edit 6 (`workflow/stages/03_review/CONTEXT.md`): one bullet under step 4

Insert directly after line 10 (step 4, which ends `confirm from the diff that only comment lines changed.`) and before `5. **Parity:**`, with no blank lines. Step 4's own text does not change.

Edit 6, new text:

```
   - **Playwright:** run each Playwright gate without a `--project` filter once; it runs all three browsers, chromium included. Skip a `--project=chromium` gate when a gate without a filter covers the same spec files (`npm test` covers every spec): the builder ran it, and your run covers it. Run any other Playwright gate as written.
```

### Edit 7 (`docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`): amendment appended

Append at the end of the file, after the Phase 159 amendment's last line (it ends `GitHub MCP ask rules stay.`), with one blank line before it. The file keeps one final line ending.

Edit 7, new text:

```
**Phase 160 (T829, 2026-10-29), branch `phase-160-faster-gates`.** This changes which stage runs which Playwright gate, not the decision, so no new ADR. It amends section 3, where the review runs the gates itself.

1. **The builder runs Playwright on chromium only, and the reviewer runs all three browsers once.** In Phase 158 the builder spent 9.4 min on Playwright and the reviewer 7.0 min on the same 11 specs; the Backlog row puts the saving at about 8 min per task (owner decision 2026-10-29). Each tier row's `--project=chromium` step is now the builder's and its step without a project filter the reviewer's, so no tier command is dropped. The reviewer still runs lint, unit and every other gate itself; the Backlog row's reuse of the builder's lint and unit logs was dropped by the owner. So `.claude/agents/fin-reviewer.md` and `fin-reviewer-strict.md` keep "Run the spec's gate commands yourself.": the reviewer's run without a project filter includes chromium. `AGENTS.md`'s tier section and the three stage files say so.
```

### Ledger (bookkeeping)

- Set the Backlog row at `docs/audit/task-ledger.md:157` to Status `done in Phase 160 (T829)`. Leave its Task text as it is (it records the request).
- If no `## Phase 160` section exists, create `## Phase 160 - Faster gates (amends ADR 0101)` from the ledger's template, after the Phase 159 section and before `## Backlog`. Add the T829 row there, Status `in-progress`, then `done` with the gate result. Leave `Commit` empty. Its Files cell: the five Target files and `docs/audit/task-ledger.md`. Its Task cell, exactly:

```
Builder runs the affected Playwright specs on chromium only; the reviewer runs them once on all three browsers and still runs lint, unit and every other gate itself (the Backlog row's log reuse dropped by the owner, 2026-10-29); amends ADR 0101
```

## 8. Gates

Docs-only tier (`AGENTS.md`): nothing, except that the new text's counts and paths must match the code; the owner's order adds the checks below. No gate is removed by this amendment that a tier requires: the docs-only tier runs no command. Run from the repo root in Git Bash. `D` is the log folder: `workflow/stages/02_build/output/logs/` for the builder, `workflow/stages/03_review/output/logs/` for the reviewer (helper files there are gitignored).

**Save the helper** (both stages, before any other gate; the reviewer sets `D` to its own folder), extracted from this spec by script, never retyped:

```
D=workflow/stages/02_build/output/logs/; H=${D}T829-gates.cjs
node -e 'const fs=require("fs");const s=fs.readFileSync("workflow/stages/01_spec/output/task-T829-spec.md","utf8").replace(/\r\n/g,"\n");const m=/^Gate helper:\n\n```js\n([\s\S]*?)\n```$/m.exec(s);fs.writeFileSync(process.argv[1],m[1]+"\n")' $H
```

Gate helper:

```js
// T829 gate helper: text landed. Run from the repo root after the edits.
const fs = require('fs');
const rd = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const count = (s, t) => s.split(t).length - 1;
const spec = rd('workflow/stages/01_spec/output/task-T829-spec.md');
const re = /^Edit (\d+), (old|new) text:\n\n(`{3,})[^\n]*\n([\s\S]*?)\n\3$/gm;
const blocks = {};
let m;
while ((m = re.exec(spec))) (blocks[m[1]] ??= {})[m[2]] = m[4];
const s02 = 'workflow/stages/02_build/CONTEXT.md';
const files = {
  1: ['AGENTS.md'],
  2: ['AGENTS.md'],
  3: ['workflow/stages/01_spec/CONTEXT.md'],
  4: [s02],
  5: [s02],
  6: ['workflow/stages/03_review/CONTEXT.md'],
  7: ['docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md'],
};
const place = {
  2: (s, t) => s.includes('before Playwright.\n\n' + t + '\n\n## Domain context routing'),
  4: (s, t) => s.includes('by one character.\n' + t + '\n6. Keep'),
  6: (s, t) => s.includes('only comment lines changed.\n' + t + '\n5. **Parity:**'),
  7: (s, t) => s.endsWith('stay.\n\n' + t + '\n'),
};
let bad = 0;
let checks = 0;
for (const [id, list] of Object.entries(files)) {
  const b = blocks[id];
  if (!b || !b.new) { console.log('edit', id, 'has no new-text block in the spec'); bad++; continue; }
  for (const f of list) {
    const s = rd(f);
    checks++;
    const n = count(s, b.new);
    if (n !== 1) { console.log('edit', id, f, 'new text count', n); bad++; }
    if (b.old && !b.new.includes(b.old) && count(s, b.old) !== 0) { console.log('edit', id, f, 'old text still present'); bad++; }
    if (place[id] && !place[id](s, b.new)) { console.log('edit', id, f, 'not in its place'); bad++; }
  }
}
for (const f of ['.claude/agents/fin-reviewer.md', '.claude/agents/fin-reviewer-strict.md']) {
  checks++;
  if (count(rd(f), "Run the spec's gate commands yourself.") !== 1) { console.log(f, 'agent prompt changed'); bad++; }
}
console.log('blocks', Object.keys(blocks).length, 'checks', checks, 'bad', bad);
process.exit(bad ? 1 : 0);
```

**Gate 1: text landed.** `node $H` prints `blocks 7 checks 9 bad 0` and exits 0 (each New text once in its file and in its place, each replaced Old text gone, both agent prompts still hold their sentence). Before the edits it fails, as a control.

**Gate 2: no em dash.** Both print 0 for every count:

```
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md workflow/stages/01_spec/output/task-T829-spec.md workflow/stages/02_build/output/task-T829-build.md
```

**Gate 3: line endings kept.**

```
git ls-files --eol AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');const crlf=s.split('\r\n').length-1;console.log(f,'crlf',crlf,'bareLF',s.split('\n').length-1-crlf)}" AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md
```

Pass: the five Target files `w/crlf` with `bareLF 0`; `docs/audit/task-ledger.md` `w/lf` with `crlf 0`.

**Gate 4: scope.** `git status --porcelain` lists only the five Target files and `docs/audit/task-ledger.md` as modified, and `workflow/stages/01_spec/output/task-T829-spec.md` and `workflow/stages/02_build/output/task-T829-build.md` as untracked (plus T830's own files if T830 is already in the tree). `.claude/agents/` shows no change.

**Gate 5 (reviewer, by reading): counts and paths.** The numbers in edit 7 (9.4 min, 7.0 min, 11 specs, about 8 min) match the Backlog row; every path the new text names exists (`git ls-files` lists it).

## 9. Production touch points

None. No live database, no `/api/*` request, no MCP or CLI write, no dashboard. The pause comes from the Target files (`AGENTS.md`, the stage `CONTEXT.md` files), not from a production touch point.

## 10. Out of scope

- The log reuse the Backlog row named, dropped by the owner: no tree fingerprint, no logged lint and unit block, no reuse of any builder log by the reviewer, and no helper script or stage-file section for any of it.
- `.claude/agents/fin-reviewer.md` and `.claude/agents/fin-reviewer-strict.md` (section 2 says why they need no edit).
- `unit/migration-history.test.ts` and anything else of T830.
- Every other row of `AGENTS.md`'s tier table, its line 76 rule (an owner's task description may add gates but never remove a tier), its line 11 counts, the parity map, the Stop and ask first list, the ICM section and the pause list.
- Step 4's own sentence in `workflow/stages/03_review/CONTEXT.md` (it keeps "Do not copy the builder's numbers."), and any other step of the three stage files.
- `docs/contexts/ui-and-e2e.md` (it states no stage split), `playwright.config.ts`, `package.json`, `.github/workflows/`, `.claude/settings.json`, `~/.claude/commands/finlife.md` (the orchestrator prompt outside the repo; its builder prompt already says "run the spec's gate commands once").
- Any other section of ADR 0101 (no edit to section 3 itself or to the Status line; the amendment carries the change).
- `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`: the phase's last task writes them.
