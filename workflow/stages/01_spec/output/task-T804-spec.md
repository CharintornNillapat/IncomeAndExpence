# Spec: T804

Phase 146, branch `phase-146-no-blink`, cut from `main` at `d0e8c69`. Docs-only; this task ships the phase. T804 is free: the ledger's highest id is T803 (`docs/audit/task-ledger.md:120`) and no `task-T804-*` stage file exists. Format model: the Phase 145 closing task T802 (`fb0b81d`, `workflow/stages/01_spec/output/task-T802-spec.md`).

## 1. Goal

Close Phase 146 on paper, in the T802 pattern: the `refactor-log.md` entry for T803-T804 (with Surprises and Deliberately not done), the `baseline-metrics.md` Phase 146 section against Phase 145, and the ledger Commit cell for T803 (`476b92c`) and the T804 row. Also settle ADR 0106's line endings (CRLF) and confirm the unit and Playwright counts in `AGENTS.md` and `README.md`.

## 2. Target files

```
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T803 Commit cell and the T804 row; section 6a step 3).

Conditional, only if gate 7 finds a bare LF in it: `docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md` (convert to CRLF, change no text). See section 4 item 6; the spec author found it already CRLF, so expect no edit.

- **`AGENTS.md` and `README.md` are NOT targets.** Their counts are still right (section 4 item 5): `AGENTS.md:11` says `1506 tests, 68 files` and `183 tests, 36 specs, 549 runs`; `README.md:157` says `1506 tests in 68 files`; `README.md:158` says `183 tests in 36 spec files ... (549 runs)`. Phase 146 added and removed no test. Leaving `AGENTS.md` out also means no owner pause before `build T804`.
- `docs/contexts/ui-and-e2e.md` is not a target (its `:24` motion sentence already carries `[0106]`; its `:66` says `183 tests in 36 specs ... 549 runs, 543 pass, 6 skip`, which T803's full run confirms).

## 3. Context to read

none (docs-only). The builder reads, as the shapes to copy: the template block and the Phase 145 entry at the top of `docs/audit/refactor-log.md` (`:7-32`), the Phase 145 section of `docs/audit/baseline-metrics.md` (`:26-35`, including its `Measured at` line, which the new section omits), and the Phase 145 and 146 sections of `docs/audit/task-ledger.md` (`:105-121`). It also reads ADR 0106 and `workflow/stages/03_review/output/task-T803-review.md` for the facts below.

## 4. Current behaviour

1. **ADR:** ADR 0106 (`docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md`, new in T803; amends ADR 0082 and the tab-slide part of ADR 0026). No new ADR for T804.
2. **Phase 146 commits** (`git log --oneline main..HEAD`, verified by the spec author): T803 `476b92c` only, 2026-10-24. Merge base with `main` is `d0e8c69`. `git status --porcelain` was empty when the spec was written.
3. **Review:** T803 APPROVED in round 1 (`workflow/stages/03_review/output/task-T803-review.md`). The reviewer's red check stashed `src/App.tsx`, `src/index.css`, `src/components/Modal.tsx` and ran `tests/reduced-motion.spec.ts --project=chromium`: 1 failed, 1 passed, the failure being `expect(names).not.toContain('motion-page-in')` with received `["motion-page-in","slide","motion-rise-in","motion-fade-in","motion-rise-out","motion-fade-out","slide","motion-page-out","motion-page-in"]`. The reviewer ran 8 specs on chromium (46 passed) and on three browsers (136 passed, 2 skipped); it did not repeat the full `npm test` and read the builder's log tail instead (`workflow/stages/02_build/output/logs/T803-playwright.log`: 543 passed, 6 skipped, 9.7 min). No visual check on Brave desktop.
4. **Ledger** (`docs/audit/task-ledger.md`, 173 lines): the Phase 146 heading is `:114`, the branch line `:116` (`Branch phase-146-no-blink, cut from main at d0e8c69.`), row T803 `:120` with an empty Commit cell and a filled Gate result. No T804 row. No Backlog row is touched.
5. **Counts** (spec author, at `476b92c`, a tree with no code change since T803):
   - Unit: 68 test files (`ls unit | grep -c "test\.tsx\?$"` gives 68; `ls unit` lists 71 entries including helpers), 1506 tests (T803 build: 68 files, 1506 passed, 54.14 s; the T803 review's own run also 1506). Phase 145 also 1506: 0 delta, 0 file delta. `git grep` of `AGENTS.md`, `README.md` and `docs/contexts/` finds 1506 / 68 / 183 / 36 / 549 everywhere and no stale count.
   - Playwright: `npx playwright test --list` printed `Total: 549 tests in 36 files`; `--project=chromium` printed `Total: 183 tests in 36 files`. 0 delta. T803 changed one existing test's body (`tests/reduced-motion.spec.ts`) and added none. Last full run: T803, 543 passed, 6 skipped, 0 failed (9.7 min), on the same code as `476b92c`.
6. **ADR 0106 line endings:** the T803 review noted ADR 0106 was LF on disk while ADR 0105 is CRLF (`git ls-files --eol` reports `i/lf w/crlf` for both now). At spec time a Node count gives ADR 0106 `crlf 43, bareLF 0`, so it is already CRLF; the committed blob is LF, normalised by `core.autocrlf=true` (no `.gitattributes` rule beyond `index.html`), the same as every sibling ADR. Nothing to change unless gate 7 disagrees.
7. **Bundle** (spec author, `rm -rf dist` then `npm run build` exit 0, `.env` present, gzip level 9 over `dist/assets`, at `476b92c`; `dist/` removed afterwards):
   - Entry `index-C3uifmw_.js` 194,386 B / 56,893 B gzip (Phase 145 `index-CDIxbGVL.js` 194,525 / 56,955: -139 / -62). T803 deleted the tab-slide state and `Presence` from `App.tsx`.
   - All app JS 886,091 B / 269,167 B gzip, 39 files (Phase 145 886,230 / 269,261: -139 / -94, 0 file delta).
   - CSS `index-CNaxMlAk.css` 53,359 B / 10,451 B gzip (Phase 145 `index-BNXJTUPd.css` 53,895 / 10,526: -536 / -75). T803 deleted the page and popup entrance keyframes and rules from `src/index.css`.
8. **Inputs for Surprises and Deliberately not done** (from T803's spec, build, review and ADR 0106):
   - The "blinking" on a tab switch was `Presence` holding the old page for 200 ms with `motion-page-out` fading it to 0 before the new view mounted, so the page area was blank for 200 ms on every tab change; popups entered with `motion-fade-in` and `motion-rise-in`. The slide also contradicted `DESIGN.md:11` (MOTION 1) and the "no entrance animations" rule in `docs/contexts/ui-and-e2e.md`.
   - The popup exit stays (`motion-fade-out`, `motion-rise-out`): a closing dialog reveals content already rendered beneath it, and it keeps ADR 0010's latching and focus restoration.
   - `tests/reduced-motion.spec.ts` now lists `['slide', 'motion-fade-out', 'motion-rise-out']` as the animations allowed and asserts none of `motion-page-in`, `motion-page-out`, `motion-fade-in`, `motion-rise-in` start.
   - The T803 build report claimed CRLF on all 7 files while ADR 0106 was LF; the review caught it (non-blocking).
   - Not done in T803: the dialog close tweens; chip tweens (`motion-chip`), `slidePill` and the period filter slide; `src/components/ui/motion.tsx` and `unit/motion.test.tsx` (`Presence` stays, used by `Modal` and the chips); no text edit of ADR 0082 or ADR 0026 (the amendment lives in ADR 0106 only); no Brave desktop visual check (the Playwright animation record is the evidence; the owner's look at the deployed app is the real check); the reviewer did not rerun the full `npm test`.
9. **File lengths:** `refactor-log.md` 128 lines, `baseline-metrics.md` 165, `task-ledger.md` 173. After this task: about 139, 174 and 174. The ledger and the metrics file are past the ~150-line threshold (`docs/audit/README.md:40`), as T800 and T802 already recorded. Archiving is not in this order; the refactor-log records it under Deliberately not done. All five files are `w/crlf`, `bareLF 0`.

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 4 of section 7 first (they measure the figures the edits record), then make the edits, then run gates 5 onward. Keep CRLF in every file. Placeholder: `<X>` is the seconds of gate 1's unit run (two decimals). Keep `docs <sha>` and `merged <sha>` literal.

1. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (`:24-25`), above `### Phase 145 - delta against Phase 144`. If gate 3 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block. Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 146 - delta against Phase 145

   - **Entry chunk** `index-C3uifmw_.js`: 194,386 B (-139 B), 56,893 B gzip (-62 B against Phase 145 `index-CDIxbGVL.js`, 194,525 / 56,955): T803 removes the tab direction state and the `Presence` wrapper from `App.tsx`.
   - **All app JS**: 886,091 B (-139 B), 269,167 B gzip (-94 B against Phase 145 886,230 / 269,261, 39 files, 0 file delta).
   - **CSS**: `index-CNaxMlAk.css`: 53,359 B (-536 B), 10,451 B gzip (-75 B against Phase 145 `index-BNXJTUPd.css`, 53,895 / 10,526): T803 deletes the page and popup entrance keyframes and rules.
   - **Vitest**: 68 files, 1506 tests (0 delta against Phase 145), 1506 passed in <X> s (`workflow/stages/02_build/output/logs/T804-unit.log`). Per-task run: T803 1506 passed in 54.14 s (`workflow/stages/02_build/output/logs/T803-unit.log`).
   - **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (0 delta). No full run by T804 (docs-only; the code is unchanged since T803). Full run by T803: 543 passed, 6 skipped, 0 failed across 3 projects (9.7 min, `workflow/stages/02_build/output/logs/T803-playwright.log`).

   ```

2. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (`:20`) and its blank line, above `## Phase 145 - ...` (`:22`), followed by a blank line, `---` and a blank line.

   ```markdown
   ## Phase 146 - Instant tabs and popups: T803-T804 (2026-10-24, code `476b92c`, docs `<sha>`, merged `<sha>`)

   ADR `0106`, amending ADR `0082` and the tab-slide part of ADR `0026`. A tab change and a dialog opening are instant: the page no longer fades out and slides before the next view appears, and a dialog opens with no scrim fade or sheet rise. A dialog still fades out on close.

   **Changed:** T803 (`476b92c`: ADR 0106; `src/App.tsx`: the `Presence` wrapper, the `motion-page` class, the `direction` state and the `--page-dir` property removed, `showTab` now has empty dependencies, `key={activeTab}` kept; `src/index.css`: the `motion-fade-in`, `motion-rise-in`, `motion-page-in` and `motion-page-out` keyframes and the `.motion-page`, `.motion-scrim` and `.motion-sheet` entrance rules removed, the exit rules and the reduced-motion block kept; `src/components/Modal.tsx`: two comments only; `tests/reduced-motion.spec.ts`: the allowed animations are `slide`, `motion-fade-out` and `motion-rise-out`, and the four removed ones must not start; `docs/contexts/ui-and-e2e.md`: the motion rule says a tab change and a dialog opening are instant [0106]; `docs/audit/task-ledger.md`: Phase 146 section). T804 (`docs/audit/baseline-metrics.md`: Phase 146 section; `docs/audit/task-ledger.md`: the T803 commit and the T804 row; this file).
   **Verified:** T803: Red gate verified (1 failed, 1 passed); npm run lint clean; related unit 2 files 37 passed (2.75s); full unit 68 files 1506 passed (54.14s); targeted e2e 8 specs on chr 46 passed (27.8s), 136 passed 2 skipped on 3 browsers (2.5m); full e2e 36 specs 543 passed 6 skipped on 3 browsers (9.7m); CRLF kept; 0 em dashes; scope clean. T804: full unit 68 files 1506 passed (<X>s); playwright list 183 tests in 36 files, 549 runs; clean production build index-C3uifmw_.js 194,386 B / 56,893 B gzip, all app JS 886,091 B / 269,167 B gzip, 39 files, CSS index-CNaxMlAk.css 53,359 B / 10,451 B gzip; CRLF kept across the touched files and ADR 0106; 0 em dashes in git diff. The T803 review approved in round 1; it reran the red check by stashing `src/App.tsx`, `src/index.css` and `src/components/Modal.tsx` (1 failed, 1 passed).
   **Surprises:** (a) The blink was `Presence` keeping the old page for 200 ms while `motion-page-out` faded it to 0, and only then mounting the new view, so the page area was blank for 200 ms on every tab change; the slide also broke `DESIGN.md:11` (MOTION 1) and the "no entrance animations" rule. (b) The red run listed what started on the old code: `motion-page-in`, `motion-rise-in`, `motion-fade-in`, `motion-page-out` and the two exits. (c) The T803 build report said CRLF on all 7 files while ADR 0106 was LF on disk; the review caught it, and T804's line-ending check covers it. (d) The entry chunk shrank 139 B raw and 62 B gzip, and the CSS 536 B raw and 75 B gzip, the first phase in a while where both fell.
   **Deliberately not done:** the dialog close tweens (`motion-fade-out`, `motion-rise-out`), kept because a closing dialog reveals content already rendered beneath it and ADR 0010's latching and focus restoration depend on the exit; the chip tweens (`motion-chip`), `slidePill` and the period filter slide; `src/components/ui/motion.tsx` and `unit/motion.test.tsx` (`Presence` stays, used by `Modal` and the chips); no text edit of ADR 0082 or ADR 0026, the amendment lives in ADR 0106 only; no visual check on Brave desktop (the Playwright animation record is the evidence, and the owner's look at the deployed app is the real check); the T803 review did not rerun the full `npm test`, it ran the 8 affected specs on three browsers and read the builder's log; no full Playwright run in T804 (docs-only, same code as `476b92c`); `AGENTS.md` and `README.md` left alone, their counts (1506 / 68 unit, 183 / 36 / 549 Playwright) still match; archiving `task-ledger.md` (174 lines) and `baseline-metrics.md` (174 lines), both past the ~150-line threshold in `docs/audit/README.md` for a third phase, left for a separate task.

   ---
   ```

   If gate 6 gives line counts other than 174 (ledger) and 174 (metrics), write the real numbers in the last Deliberately not done item.

3. **`docs/audit/task-ledger.md`** (Phase 146 table only):
   - Commit cell: T803 (`:120`) `476b92c`. Change no other cell of that row.
   - Add the T804 row after `:120`:
     - `#`: `T804`
     - Task: `Phase 146 closing docs: refactor-log entry, baseline-metrics section, T803 Commit cell, ADR 0106 line endings, unit and Playwright counts checked`
     - Files: `` `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done` (flip to `in-progress` when starting)
     - Commit: empty
     - Gate result: `unit 68 files 1506 passed (<X>s); playwright list 183/36/549; AGENTS.md and README.md counts verified, no edit; clean prod build (index-C3uifmw_.js 194,386 B, all app JS 886,091 B 39 files, CSS 53,359 B); CRLF kept, ADR 0106 CRLF; 0 em dashes`
   - Do not edit the heading `:114`, the branch line `:116`, any earlier phase, the Backlog or the template.

4. **ADR 0106**: only if gate 7 shows `bareLF` above 0, convert its line endings to CRLF with no text change (e.g. a Node read, replace `\r?\n` with `\r\n`, write), then rerun gate 7. Otherwise do not touch it and state in the build report that it was already CRLF.

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha. The unit run and the build supply the recorded figures. Commands (PowerShell, from the repo root):

```powershell
# 1-4: before any edit
npm run test:unit *> workflow/stages/02_build/output/logs/T804-unit.log    # expect 68 files, 1506 passed; record seconds as <X>
npx playwright test --list | Select-Object -Last 1                         # expect "Total: 549 tests in 36 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build    # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"

# 5 onward: after the edits
git log --format=%h -1 --grep="(T803)"
git grep -n "1500 tests" -- AGENTS.md README.md docs/contexts/                # expect nothing (exit 1)
(Get-Content docs/audit/task-ledger.md).Count; (Get-Content docs/audit/refactor-log.md).Count; (Get-Content docs/audit/baseline-metrics.md).Count   # gate 6
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md   # gate 7
git ls-files --eol docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T804-spec.md
git status --porcelain
Remove-Item -Recurse -Force dist                                            # dist/ is gitignored; tidy up
```

Expect:
- Unit: 68 files, 1506 passed, 0 failed.
- Playwright list: `Total: 549 tests in 36 files`.
- Bundle: `index-C3uifmw_.js 194386 56893`, `index-CNaxMlAk.css 53359 10451`, `allJS 886091 269167 39`. Any difference: report it, do not write the metrics block (6a step 1).
- Sha: `476b92c`.
- The `git grep` check: no output.
- ADR 0106: `bareLF 0`. The three audit files: `bareLF 0`, `w/crlf`.
- Em dash count: `0` in both checks.
- Line counts: 174 (ledger), 139 (refactor-log, give or take a line), 174 (metrics); the two counts named in the refactor-log's last Deliberately not done item match.
- `git status --porcelain`: only `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` and `workflow/stages/*/output/` files (plus the ADR only if gate 7 forced a conversion). `AGENTS.md` and `README.md` must not appear.
- No Playwright run is part of this task (docs-only, no `src/` or `tests/` change); T803's full run (543 passed, 6 skipped) stands for the same code.

## 8. Production touch points

none. No SQL, no `/api/*` request, no MCP write, no deploy. The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T804 Commit cell, the branch line `:116`, and the `Measured at` line in `baseline-metrics.md`. The owner's own look at the deployed app on Brave desktop (tab switches and dialog opens feel instant, a dialog still fades out) is not a task step.

## 9. Out of scope

- Any code, test, config, script or SQL file; `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- `AGENTS.md`, `README.md`, `docs/contexts/*.md`, `DESIGN.md` (counts verified, no edit).
- ADR 0106's text (line endings only, and only if gate 7 requires it); ADRs 0082 and 0026 (no amendment note added); no new ADR.
- The T803 row's Task, Files, Status and Gate result cells; the Phase 146 heading and branch line; earlier phases; every Backlog row; the template.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file (recorded as not done; a separate task the owner can order); a full Playwright run; any request to production `/api/*`; any live Supabase SQL.
