# Task T830 spec: give migration-history's PGlite setup the 60 s budget its sibling files have; ship Phase 160

Phase 160, branch `phase-160-faster-gates`, cut from `main` at `dc9a065`. Order: the owner's description (no Backlog row). T830 is the LAST task of the phase, after T829 (`workflow/stages/01_spec/output/task-T829-spec.md`, not edited here), so it also writes the phase's closing docs.

**Pause list.** T830's own Target files hit nothing on it (a unit file, the refactor log, the ledger), so the orchestrator goes on to `build T830` without asking. The phase's pull request still holds T829's `AGENTS.md`, stage `CONTEXT.md` and ADR 0101 edits, so the owner merges it; it is never auto-merged (`AGENTS.md`, ICM section, Release).

## 1. Goal

`unit/migration-history.test.ts` stops failing its `beforeAll` with "Hook timed out in 10000ms" when the full unit run is loaded: it gets the same 60 s setup budget as the two other files that create a PGlite. The finding and its evidence are in section 4; the phase's entry in `docs/audit/refactor-log.md` and its ledger section are written, covering T829 and T830.

## 2. Target files

```
unit/migration-history.test.ts
docs/audit/refactor-log.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T830-build.md`, and logs and helper files under `workflow/stages/02_build/output/logs/` (gitignored).

**`docs/audit/baseline-metrics.md` is deliberately not a Target file.** `CONTEXT.md` asks a phase-shipping spec to list it; this phase adds no section because no figure it records changes: no build input is touched (T829 and T830 change only workflow docs, a unit test and the logs), so the bundle stands, and the unit counts stay 73 files and 1624 tests (no test is added or removed). Gate 6 proves the counts; if it shows other counts, stop and report to the reviewer rather than editing `AGENTS.md:11`, `README.md:160` or the metrics file.

**No new ADR.** `AGENTS.md` Workflow asks for an ADR before code for "a new feature or phase". T829 amends ADR 0101 (as Phase 157's T826 did) and T830 decides nothing new: it aligns one hook's timeout with two siblings, a test-hygiene fix the log entry records. A comments-and-timeout edit to a unit file is in the "skip the process" class. The refactor-log entry names ADR 0101 and says T830 needs none.

## 3. Context to read

`docs/contexts/client-state.md` only for its unit test harness notes, if the builder wants them; the change needs no domain rule. Read in full before editing: `unit/migration-history.test.ts:1-40`, `unit/migration-replay.test.ts:30-42`, `unit/drift-runner.test.ts:35-60`, `scripts/lib/migrationReplay.mjs:37-42`, the top 25 lines of `docs/audit/refactor-log.md`, and `docs/audit/task-ledger.md:107-115` (the Phase 159 section, the model for Phase 160's).

## 4. Current behaviour and finding

**The failure.** `workflow/stages/03_review/output/task-T828-review.md:57` and `workflow/stages/03_review/output/logs/T828-unit.log:8-24`: run 1 of `npm run test:unit` ended `Test Files 1 failed | 72 passed (73)`, `Tests 1606 passed | 18 skipped (1624)`; `unit/migration-history.test.ts (18 tests | 18 skipped) 10542ms`, `Error: Hook timed out in 10000ms ... unit/migration-history.test.ts:15:1`. The 18 skips are that file's tests, skipped because their `beforeAll` failed. Alone the file passed in 2.03 s, and run 2 passed all 73 files (`T828-unit-run2.log`, 78.86 s).

**The hook.** `unit/migration-history.test.ts:15-24` is `beforeAll(async () => { db = await PGlite.create(); await db.exec(...create schema supabase_migrations...); });` with no timeout argument. `vitest.config.ts:25-53` sets no `hookTimeout`, `testTimeout`, `pool`, `maxWorkers` or `fileParallelism`, so Vitest 5.0.1's defaults apply: a 10 s hook budget, forked workers in parallel, one per file.

**The siblings.** The two other files that create a PGlite give their setup 60 s: `unit/migration-replay.test.ts:37-41` (`}, 60_000);`, via `createDatabase()` at `scripts/lib/migrationReplay.mjs:38-42`, then every migration) and `unit/drift-runner.test.ts:43-58` (`}, 60_000);`). `migration-history.test.ts` is the only PGlite hook on the default. Those three are the only files in `unit/` that reach PGlite (`grep PGlite unit/` lists them). `migration-history.test.ts` was written in Phase 89 (commit `8a90f90`) when its hook was an empty `PGlite.create()` plus one `create table`, and was never given the budget the files that replay 23 migrations got.

**Measured by the spec writer on `dc9a065`, 12 logical cores, Node 24.19.0, `@electric-sql/pglite` 0.4.6 (`pglite.wasm` 9.5 MB, `pglite.data` 6.0 MB):**

| Measurement | Result |
|---|---|
| `npx vitest run unit/migration-history.test.ts`, three runs | 18 passed, 1.80 s to 2.01 s each |
| One bare `PGlite.create()` in a fresh Node process, twice | 1549 ms and 1814 ms |
| The same, 3 processes started at once | 3146 to 3220 ms |
| The same, 12 processes at once | 12138 to 13090 ms |
| The same, 24 processes at once | 20889 to 25698 ms |
| Two full `npm run test:unit` runs with the JSON reporter | 73 files, 0 failed both times (65.8 s and 75.5 s) |

So `PGlite.create()` is CPU bound (WebAssembly compile of a 9.5 MB module plus initdb), about 1.6 s when the machine is idle, and its time grows with the number of other CPU-heavy processes: with 12 at once it passes the 10 s hook limit.

**Ranked hypotheses.**

1. **Cold `PGlite.create()` under full-suite CPU load, against a 10 s budget the file never sized (most likely, supported by the table above and by the T828 log: `environment 27%` of the 75.89 s run).** In a full run, 11 or 12 forked workers start at once; three of them create a PGlite (migration-replay, drift-runner, migration-history) while the rest compile TSX and boot jsdom, and Phase 159's new `unit/pre-push-guard.test.ts` (31 s of `spawnSync git`) adds more CPU in the same window. Two of the three files carry 60 s and survive; the third carries 10 s and, once, did not. The 10,542 ms in the log is the 10,000 ms limit plus teardown.
2. **A defect in the test body or a state leak between files (rejected).** The failing step is the first line of the first hook, before any test runs; the file passes alone every time, and `isolate: true` (`vitest.config.ts:49`) gives it a fresh module graph.
3. **A Vitest pool or worker setting (rejected).** `vitest.config.ts` sets none; the defaults ran in all of the runs above.
4. **Something in the T828 diff (rejected).** T828 added only `unit/pre-push-guard.test.ts`, `scripts/git-hooks/pre-push`, `.gitattributes` and docs; none is imported by `migration-history.test.ts`. T828's file adds load (hypothesis 1), not a dependency.

**What this cannot show.** The single timeout did not reproduce: 0 failures in my 2 full runs and 5 targeted runs; starting extra PGlite processes beside a targeted Vitest run did not slow it either (a 24 and a 40-process attempt both passed in 2.3 s to 2.8 s, and the 40-process attempt crashed some of the helper processes with a V8 out-of-memory), so no gate can force the red state. The finding is therefore an inference from the 10 s versus 60 s mismatch and the scaling table, stated as such. The 60 s budget is 2.3 times the worst measured create time (25.7 s, 24 at once on 12 cores), which is why it is a sized budget rather than a bigger guess.

**Why not the alternatives.**

- **A global `hookTimeout` in `vitest.config.ts`:** hides a hung hook in the other 72 files and widens the change to config. Rejected; per-hook budgets are the repo's convention (two files).
- **Running the three PGlite files one at a time or in a separate Vitest project:** `migration-replay.test.ts` alone takes about 60 s, so serialising adds up to that to every run, and it needs config. Rejected.
- **Shrinking `PGlite.create()`'s cost** (a pre-initdb'd data directory shared through a `globalSetup`): a real saving, but new harness code and a risk to the replay suite. Not for a flake fix; named in the log as not done.
- **A guard test that every PGlite file sets a long hook budget:** it would add a test and move the counts in `AGENTS.md:11` and `README.md:160`. Not done; add one if a fourth PGlite file appears.

## 5. Parity map

None. (The test counts at `AGENTS.md:11` and `README.md:160` stay true because no test is added.)

## 6. Tests to add

None. The change gives an existing hook a longer timeout and a comment; it alters no app behaviour and touches no money path. A red run is impossible: the failure is a load-dependent timeout that did not reproduce in seven runs and cannot be forced (section 4). Stage 02 step 4 and stage 03 step 6 do not apply. Gate 3 is the check that stands in for them: the three PGlite files run together, twice, with no "Hook timed out".

## 7. Edits

Make each edit exactly as given. Keep each file's line endings: `unit/migration-history.test.ts` is CRLF in the working tree; `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` are LF. The blocks below are read by gate 1.

### Edit 1 (`unit/migration-history.test.ts:22-24`): the hook budget

Edit 1, old text:

```
      created_by text, idempotency_key text, rollback text[]);
  `);
});
```

Edit 1, new text:

```
      created_by text, idempotency_key text, rollback text[]);
  `);
  // Phase 160 (T830): PGlite.create() compiles a 9.5 MB WebAssembly module and is CPU bound, 1.6 s on an idle
  // machine and about 12 s when 12 start at once, so the 10 s default timed out once in a loaded full run (T828
  // review). The same 60 s as migration-replay.test.ts and drift-runner.test.ts, the other two files that create one.
}, 60_000);
```

### Edit 2 (`docs/audit/refactor-log.md`): the Phase 160 entry, heading and brief

Insert immediately before the line that starts `## Phase 159 - Unattended pushes`, as the first entry (newest first), followed by Changed and Verified (the builder writes both, see below), Edit 3, then a line `---` between blank lines, then `## Phase 159`.

Edit 2, new text:

```
## Phase 160 - Faster gates: T829-T830 (2026-10-29, code `<sha>` and `<sha>`, merged `<sha>`)

ADR `0101` (Phase 160 amendment, T829); T830 needs none. The builder runs the affected Playwright specs on chromium only and the reviewer runs them once on all three browsers, still running lint, unit and every other gate itself; the change is in the `AGENTS.md` tier rows, the stage `CONTEXT.md` files 01, 02 and 03 and an ADR 0101 amendment, with no agent prompt edits (T829). `unit/migration-history.test.ts` gets the 60 s setup budget of the other two PGlite files after one 10 s setup timeout in the T828 review (T830).
```

After that block the builder writes the two lines below, in this order, each starting with its bold label and ending in one line (the file's style):

- `**Changed:**` T829's five Target files (`AGENTS.md`, the three `workflow/stages/*/CONTEXT.md` files for stages 01, 02 and 03, and `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`; read from `task-T829-build.md`) and what changed in each, `unit/migration-history.test.ts` (the hook's `60_000` budget and its comment), `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`.
- `**Verified:**` T829's gate results from `task-T829-build.md` and its review (if `task-T829-review.md` exists), then T830's gates 1 to 8 with the counts the build report shows.

### Edit 3 (`docs/audit/refactor-log.md`): Surprises and Deliberately not done

Edit 3, new text:

```
**Surprises:** `unit/migration-history.test.ts` was the only one of the three PGlite files left on Vitest's 10 s default hook budget (`migration-replay.test.ts` and `drift-runner.test.ts` set 60 s); a bare `PGlite.create()` took 1.6 s alone, about 3 s with 3 started at once, about 12 s with 12 and about 25 s with 24, so the one timeout of the T828 review (10,542 ms) is load, not a defect in the test, and it did not reproduce in 7 later runs, so the cause is inferred, not proven; starting 40 extra PGlite processes beside a targeted run did not slow it and crashed some of them with a V8 out-of-memory, so no gate can force the failure; the T828 log shows the 18 tests of a failed `beforeAll` as skipped, which is why the count read `1606 passed | 18 skipped`.
**Deliberately not done:** a global `hookTimeout` in `vitest.config.ts` (it would hide a hung hook in every other file); a guard test that every PGlite file sets a long hook budget (add one if a fourth appears); serialising the PGlite files or any `pool` change; making `PGlite.create()` cheaper with a shared pre-initialised data directory; a new ADR (T829 amends ADR 0101, T830 decides nothing new); the Backlog row's reuse of the builder's lint and unit logs and its tree fingerprint (dropped by the owner from T829); a `baseline-metrics.md` section (no bundle input changed, the unit counts stay 73 files and 1624 tests); filling the `<sha>` placeholders and the Commit cells, left to the post-merge deploy record.
```

### Edit 4 (`docs/audit/task-ledger.md`): the Phase 160 section's heading and intro

If `## Phase 160 - Faster gates (amends ADR 0101)` exists (T829 created it), replace its intro line (the first line after the heading) with the one below; if not, create the section after the Phase 159 section and before `## Backlog`, from the file's template, with the table header row and separator as in Phase 159.

Edit 4, new text:

```
## Phase 160 - Faster gates (amends ADR 0101)

Branch `phase-160-faster-gates`, cut from `main` at `dc9a065`. Two tasks, T829 and T830. No migration.
```

Then the T830 row, after T829's, with Status `in-progress` first and `done` once the gates pass, and the Commit cell empty (the deploy record fills commits; this is the convention of Phases 158 and 159: `<sha>` placeholders in the refactor-log heading, an empty Commit cell, the intro line without merge facts):

- `#`: `T830`
- Task: `unit/migration-history.test.ts setup gets the 60 s PGlite budget its sibling files have (one 10 s timeout in the T828 review, cause: PGlite.create() under full-suite CPU load); Phase 160 closing docs`
- Files: `` `unit/migration-history.test.ts`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` ``
- Gate result: the compact "Gate N ..." list, in the style of the Phase 159 row.

No Backlog row changes for T830 (the flake has none). T829's Backlog row is T829's.

## 8. Gates

`unit/` tier plus the docs rows (`AGENTS.md`, Tiered verification gates): `npm run lint`; `npx vitest run unit/<changed file>`; then `npm run test:unit`. No `src/`, `api/`, `supabase/`, `vercel.json`, `.github/workflows/` or `tests/` file changes, so no Playwright, build or schema gate. The refactor-log and ledger take the docs-only row: check that stated counts and paths match the code (gate 6). Run from the repo root in Git Bash. `D` is the log folder: `workflow/stages/02_build/output/logs/` for the builder, `workflow/stages/03_review/output/logs/` for the reviewer.

**Order.** Gate 1 helper first; then the edits; then gates 1 to 8.

**Save the helper** (both stages), extracted from this spec by script, never retyped:

```
D=workflow/stages/02_build/output/logs/; H=${D}T830-gates.cjs
node -e 'const fs=require("fs");const s=fs.readFileSync("workflow/stages/01_spec/output/task-T830-spec.md","utf8").replace(/\r\n/g,"\n");const m=/^Gate helper:\n\n```js\n([\s\S]*?)\n```$/m.exec(s);fs.writeFileSync(process.argv[1],m[1]+"\n")' $H
```

Gate helper:

```js
// T830 gate helper: text landed. Run from the repo root after the edits.
const fs = require('fs');
const rd = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const cnt = (s, t) => s.split(t).length - 1;
const spec = rd('workflow/stages/01_spec/output/task-T830-spec.md');
const re = /^Edit (\d+), (old|new) text:\n\n(`{3,})[^\n]*\n([\s\S]*?)\n\3$/gm;
const b = {};
let m;
while ((m = re.exec(spec))) (b[m[1]] ??= {})[m[2]] = m[4];
const U = rd('unit/migration-history.test.ts');
const R = rd('docs/audit/refactor-log.md');
const L = rd('docs/audit/task-ledger.md');
let bad = 0;
const chk = (name, ok) => { console.log(name, ok ? 'OK' : 'BAD'); if (!ok) bad++; };
chk('edit1 new once', cnt(U, b[1].new) === 1);
chk('edit1 old gone', cnt(U, b[1].old) === 0);
chk('edit2 once', cnt(R, b[2].new) === 1);
chk('edit3 once', cnt(R, b[3].new) === 1);
const i2 = R.indexOf(b[2].new);
const i3 = R.indexOf(b[3].new);
const i159 = R.indexOf('## Phase 159 - ');
chk('entry order', i2 >= 0 && i2 < i3 && i3 < i159);
chk('entry closed by rule', R.includes('\n\n---\n\n## Phase 159 - '));
chk('changed and verified between', /\*\*Changed:\*\*[^\n]+\n\*\*Verified:\*\*[^\n]+\n/.test(R.slice(i2, i3)));
chk('edit4 once', cnt(L, b[4].new) === 1);
chk('ledger T830 row once', L.split('\n').filter((l) => l.startsWith('| T830 |')).length === 1);
chk('ledger heading once', cnt(L, '## Phase 160 - ') === 1);
console.log('bad', bad);
process.exit(bad ? 1 : 0);
```

**Gate 1: text landed.** `node $H` prints `bad 0` and exits 0 (every line `OK`). Before the edits it prints `edit1 old gone BAD` at least, as a control.

**Gate 2: `npm run lint` and the changed file.** Run lint directly and save its log. The file alone:

```
npx vitest run unit/migration-history.test.ts
```

Pass: lint exits 0; `Test Files  1 passed (1)`, `Tests  18 passed (18)`.

**Gate 3: the three PGlite files together, twice (stands in for the red run).**

```
D=workflow/stages/02_build/output/logs/
for i in 1 2; do npx vitest run unit/migration-history.test.ts unit/migration-replay.test.ts unit/drift-runner.test.ts > ${D}T830-pglite3-$i.log 2>&1; echo "run $i exit $?"; done
grep -c "Hook timed out" ${D}T830-pglite3-1.log ${D}T830-pglite3-2.log
```

Pass: both runs `exit 0` with `Test Files  3 passed (3)` in each log; both `grep -c` print `0`. Report each log's Test Files, Tests and Duration lines.

**Gate 4: full unit run.** `npm run test:unit`, saved to a log, counts read from it: pass is `Test Files  73 passed (73)` and `Tests  1624 passed (1624)`, no `Hook timed out`. If `AGENTS.md:11` has changed since `dc9a065` (T829 does not change the counts), expect the counts it states.

**Gate 5: no em dash, line endings kept.**

```
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" unit/migration-history.test.ts docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/01_spec/output/task-T830-spec.md workflow/stages/02_build/output/task-T830-build.md
git ls-files --eol unit/migration-history.test.ts docs/audit/refactor-log.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');const crlf=s.split('\r\n').length-1;console.log(f,'crlf',crlf,'bareLF',s.split('\n').length-1-crlf)}" unit/migration-history.test.ts docs/audit/refactor-log.md docs/audit/task-ledger.md
```

Pass: every em dash count `0` (the first count covers T829's files too if they are in the working tree uncommitted; it must still be `0`); `unit/migration-history.test.ts` is `w/crlf` with `bareLF 0`; `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` are `w/lf` with `crlf 0`.

**Gate 6: stated counts and paths match.** The Phase 160 entry and ledger name only things that exist: `dc9a065` resolves (`git cat-file -t dc9a065` prints `commit`); the branch is `phase-160-faster-gates` (`git branch --show-current`); the entry's numbers (1.6 s, about 3 s, about 12 s, about 25 s, 10,542 ms, 7 later runs, `1606 passed | 18 skipped`, 73 files, 1624 tests) match section 4 and `workflow/stages/03_review/output/logs/T828-unit.log:8,27-28`; `docs/audit/baseline-metrics.md` and `AGENTS.md` and `README.md` have no diff from this task (`git diff --stat HEAD -- docs/audit/baseline-metrics.md README.md` is empty; `AGENTS.md` may show only T829's edits).

**Gate 7: the edit is only the hook.** `git diff -U0 -- unit/migration-history.test.ts` shows exactly the Edit 1 change: 1 hunk, added lines are the three comment lines and `}, 60_000);`, removed line is `});` (4 insertions, 1 deletion; CRLF noise aside).

**Gate 8: scope.** `git status --porcelain` lists as modified only `unit/migration-history.test.ts`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` (plus T829's files if T829 is in the tree uncommitted), and as untracked only `workflow/stages/01_spec/output/task-T830-spec.md` and `workflow/stages/02_build/output/task-T830-build.md` (plus T829's untracked files). `vitest.config.ts`, `package.json`, `scripts/` and `docs/audit/baseline-metrics.md` are untouched.

**Reviewer.** Repeat gates 1 to 8 yourself, running every command and saving your own logs.

## 9. Production touch points

None. No live database, no `/api/*` request, no MCP or CLI write, no dashboard. The Release (push and `gh pr create`) is the orchestrator's standing go-ahead; the merge is the owner's because the PR carries T829's pause-list files.

## 10. Out of scope

- `vitest.config.ts` (no global `hookTimeout`, `pool`, `maxWorkers` or `fileParallelism`), `scripts/lib/migrationReplay.mjs`, `unit/migration-replay.test.ts`, `unit/drift-runner.test.ts`: their 60 s budgets are correct and stay as they are.
- The per-test timeout of `migration-history.test.ts` (its 18 tests take about 1.5 s together) and any other line of that file.
- A guard test for PGlite hook budgets; a cheaper `PGlite.create()`; any change to the order or concurrency of unit files.
- `docs/audit/baseline-metrics.md`, `AGENTS.md`, `README.md` (counts unchanged), any ADR, and every T829 Target file.
- `docs/audit/task-ledger.md` Backlog rows.
