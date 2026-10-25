# Spec: T808

Phase 148, branch `phase-148-add-entry-close`, cut from `main` at `45b6c24` (`git merge-base main HEAD`). Docs-only; this task ships the phase. T808 is free as a spec: the ledger's T808 row (`docs/audit/task-ledger.md:139`) is the `todo` placeholder T807 added for this task, and no `task-T808-*` stage file existed. No new ADR. Format model: the Phase 147 closing task T806 (`53e1062`, `workflow/stages/01_spec/output/task-T806-spec.md`), which also corrected its phase's ADR, and T804 (`c250226`).

## 1. Goal

Close Phase 148 on paper, in the T806 and T804 pattern: the `refactor-log.md` entry for T807-T808 (with Surprises and Deliberately not done, including the production check the owner still owes after deploy), the `baseline-metrics.md` Phase 148 section against Phase 147, the ledger Commit cell for T807 (`29ce4ba`) and the T808 row, and the Playwright counts in `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md` (187 tests, 36 specs, 561 runs, 555 pass, 6 skip). Fold in the T807 review's two non-blocking notes on ADR 0108 ("sole cause" becomes "only close path found"; the Verification line gets the counts), and correct ADR 0108's claim that the entry chunk does not change (it grows 33 B).

## 2. Target files

```
AGENTS.md
README.md
docs/contexts/ui-and-e2e.md
docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T807 Commit cell and the T808 row; section 6a step 7).

- ADR 0108 is a target (it is not in the ledger placeholder's Files cell); step 7 adds it to the row.
- Pause rule: `AGENTS.md` is a target, so the orchestrator pauses for the owner before `build T808`.
- **Not part of this task, leave alone:** the working tree has two untracked paths that are the owner's Phase 149 design docs, written in another tool: `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` and `docs/design/transactions-2026-10/`. Do not open, edit, move, delete, format or stage them, and do not mention them in any file except where section 6a step 6 says. They must show as `??` in `git status --porcelain` before and after the build, unchanged.

## 3. Context to read

none (docs-only). The builder reads, as the shapes to copy: the template block and the Phase 147 entry at the top of `docs/audit/refactor-log.md` (`:7-30`), the Phase 147 section of `docs/audit/baseline-metrics.md` (`:26-34`; its `Measured at` line was added by the post-merge deploy record, so the new section leaves it out), and the Phase 147 and 148 sections of `docs/audit/task-ledger.md` (`:123-139`).

## 4. Current behaviour

1. **Phase 148 commits** (`git log --oneline main..HEAD`, spec author): T807 `29ce4ba` only, 2026-10-25. It changed ADR 0108 (new, 47 lines), `docs/audit/task-ledger.md` (+9, the Phase 148 section), `docs/audit/test-selector-contract.md` (1 line), `docs/contexts/ui-and-e2e.md` (1 line, the Shell modals bullet `:43`), `src/App.tsx` (+24 / -9: the idle callback from ADR 0104 also flips the four `hasOpened*` latches, plus two comments), `tests/tab-preload.spec.ts` (+41: four tests) and the three T807 stage files.
2. **T807 results.** Build (`workflow/stages/02_build/output/task-T807-build.md:29-66`): red 4 failed, 2 passed (17.4 s); lint clean; unit 69 files 1510 passed (84.61 s, `workflow/stages/02_build/output/logs/T807-unit.log`); tab-preload 6 passed on chromium (22.7 s), 18 on three browsers (1.1 min); `npm test` 36 specs, 561 runs, 555 passed, 6 skipped (10.2 min, `workflow/stages/02_build/output/logs/T807-e2e.log`). Review (`workflow/stages/03_review/output/task-T807-review.md`): APPROVED in round 1; red rerun by stashing `src/App.tsx` (4 failed, 2 passed, each at `tests/tab-preload.spec.ts:113`); unit 1510 passed (108.19 s); `npm test` 561 runs, 555 passed, 6 skipped, 0 failed, 0 flaky (10.4 min). Non-blocking notes at `:59-60`: soften "sole cause" in ADR 0108 Context item 5, and add counts to its Verification line.
3. **ADR 0108** (`docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md`, 47 lines, CRLF):
   - `:14`, Context item 5, ends `The sole cause is the repeat tap landing on the scrim due to Suspense boundary reveal latency.` The spec and the review treat it as the only close path found, pending the owner's production check (T807 spec section 8).
   - `:33` reads `- **Gates:** Full unit test suite (\`npm run test:unit\`) and Playwright test suite (\`npm test\`) passing with clean lint checks.` No counts.
   - `:38` reads `- Initial critical-path bundle size is unaffected; the entry chunk does not change.` Wrong: the spec author's build (item 6) gives an entry chunk 33 B raw and 18 B gzip larger than Phase 147's, the four latch calls in `App.tsx`, which is in the entry chunk.
4. **Counts** (spec author, at `29ce4ba`):
   - Playwright: `npx playwright test --list` prints `Total: 561 tests in 36 files`; `--project=chromium` prints `Total: 187 tests in 36 files`. Phase 147: 183 / 36 / 549, so +4 tests, +12 runs, all in `tests/tab-preload.spec.ts`.
   - Stale Playwright counts (`git grep` of `AGENTS.md`, `README.md`, `docs/contexts/`, nothing else found): `AGENTS.md:11` `(183 tests, 36 specs, 549 runs on three browsers)`; `README.md:158` `# Playwright: 183 tests in 36 spec files on Chromium, Firefox and WebKit (549 runs)`; `docs/contexts/ui-and-e2e.md:67` `**183 tests in 36 specs on Chromium, Firefox and WebKit: 549 runs, 543 pass, 6 skip by design**`.
   - Unit: 69 test files (`ls unit | grep -cE "test\.tsx?$"` gives 69), 1510 tests (T807 build and review). `AGENTS.md:11` and `README.md:157` already say 1510 / 69: no edit.
5. **Ledger** (`docs/audit/task-ledger.md`, 192 lines): Phase 148 heading `:132`, branch line `:134`, row T807 `:138` (`done`, empty Commit cell, filled Gate result), row T808 `:139` (`todo`, Files cell without ADR 0108, empty Commit and Gate result). No Backlog row is touched.
6. **Bundle** (spec author, `rm -rf dist` then `npm run build` exit 0, `.env` present, gzip level 9 over `dist/assets`, at `29ce4ba`; `dist/` removed afterwards):
   - Entry `index-D4N64t3V.js` 194,626 B / 56,981 B gzip (Phase 147 `index-B-nRqlko.js` 194,593 / 56,963: +33 / +18).
   - All app JS 886,331 B / 269,276 B gzip, 39 files (Phase 147 886,298 / 269,230: +33 / +46, 0 file delta).
   - CSS `index-CNaxMlAk.css` 53,359 B / 10,451 B gzip: the same file as Phase 147, 0 delta.
   - Modal chunks, unchanged and matching ADR 0108's Consequences: `QuickAddModal` 2,497 B, `TransferFundsModal` 6,986 B, `AddWalletModal` 2,955 B, `AccountModal` 16,577 B.
7. **File lengths and line endings** (Node count): `AGENTS.md` 134, `README.md` 179, `ui-and-e2e.md` 79, ADR 0108 47, `refactor-log.md` 150, `baseline-metrics.md` 185, `task-ledger.md` 192. All `w/crlf`, `bareLF 0`. After this task: 134, 179, 79, 47, about 160, about 194, 192. The ledger and the metrics file are past the ~150-line threshold (`docs/audit/README.md:40`) for a fifth phase; archiving is not in this order.
8. **Working tree at spec time:** `git status --porcelain` lists only `?? docs/audit/decisions/0109-transactions-table-and-calendar-views.md` and `?? docs/design/transactions-2026-10/` (section 2, not this task's).

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 4 of section 7 first (they measure the figures the edits record), then make the edits, then run gates 5 onward. Keep CRLF in every file. Placeholder: `<X>` is the seconds of gate 1's unit run (two decimals). Keep `docs <sha>` and `merged <sha>` literal. No em dash anywhere.

1. **`AGENTS.md:11`**: change `(183 tests, 36 specs, 549 runs on three browsers)` to `(187 tests, 36 specs, 561 runs on three browsers)`. Change nothing else in the file.

2. **`README.md:158`**: change `183 tests in 36 spec files` to `187 tests in 36 spec files` and `(549 runs)` to `(561 runs)`. Keep the column alignment. Change nothing else.

3. **`docs/contexts/ui-and-e2e.md:67`**: change `**183 tests in 36 specs on Chromium, Firefox and WebKit: 549 runs, 543 pass, 6 skip by design**` to `**187 tests in 36 specs on Chromium, Firefox and WebKit: 561 runs, 555 pass, 6 skip by design**`. Keep the rest of the line. Change nothing else.

4. **ADR 0108**, three edits, no other text:
   - `:14`: replace the last sentence `The sole cause is the repeat tap landing on the scrim due to Suspense boundary reveal latency.` with `The only close path found is a repeat tap landing on the scrim during the Suspense reveal latency; the owner's signed-in check on production after the deploy is the proof.`
   - `:33`: replace the whole bullet with `- **Gates:** \`npm run lint\` clean; \`npm run test:unit\` 69 files, 1510 passed; \`npm test\` 187 tests in 36 specs, 561 runs on three browsers: 555 passed, 6 skipped, 0 failed (T807 build 10.2 min, T807 review 10.4 min).`
   - `:38`: replace the whole bullet with `- The entry chunk grows 33 B raw and 18 B gzip (\`index-D4N64t3V.js\` 194,626 B against Phase 147's \`index-B-nRqlko.js\` 194,593 B), the four latch calls in the idle callback; no modal code moves into it.` If gate 3 prints other figures, write those.

5. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (`:24-25`), above `### Phase 147 - delta against Phase 146`. If gate 3 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block. Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 148 - delta against Phase 147

   - **Entry chunk** `index-D4N64t3V.js`: 194,626 B (+33 B), 56,981 B gzip (+18 B against Phase 147 `index-B-nRqlko.js`, 194,593 / 56,963): T807's idle callback in `App.tsx` also flips the four shell-dialog latches.
   - **All app JS**: 886,331 B (+33 B), 269,276 B gzip (+46 B against Phase 147 886,298 / 269,230, 39 files, 0 file delta).
   - **CSS**: `index-CNaxMlAk.css`: 53,359 B (0 delta), 10,451 B gzip (0 delta; the same file as Phase 147).
   - **Vitest**: 69 files, 1510 tests (0 delta against Phase 147), 1510 passed in <X> s (`workflow/stages/02_build/output/logs/T808-unit.log`). Per-task run: T807 1510 passed in 84.61 s (`workflow/stages/02_build/output/logs/T807-unit.log`).
   - **Playwright**: `npx playwright test --list` reports 187 tests in 36 files, 561 runs across 3 projects (+4 tests, +12 runs against Phase 147, all in `tests/tab-preload.spec.ts`, new in T807). Full run by T807: 555 passed, 6 skipped, 0 failed across 3 projects (10.2 min, `workflow/stages/02_build/output/logs/T807-e2e.log`); the T807 review's run gave the same (10.4 min). No full run by T808 (docs-only; the code is unchanged since T807).

   ```

6. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (`:20`) and its blank line, above `## Phase 147 - ...` (`:22`), followed by a blank line, `---` and a blank line.

   ```markdown
   ## Phase 148 - Add entry stays open on first open: T807-T808 (2026-10-25, code `29ce4ba`, docs `<sha>`, merged `<sha>`)

   ADR `0108`, amending ADR `0010` and ADR `0104`. The four shell popups (Add entry, Transfer Funds, Add Wallet, Account) now mount closed at idle, so their first open after a page load appears in the click's own update instead of about 330 ms later, and a second tap in that gap can no longer land on the backdrop and close the popup.

   **Changed:** T807 (`29ce4ba`: ADR 0108; `src/App.tsx`: the `runWhenIdle` callback that preloads the tab views also calls `setHasOpenedQuickAdd`, `setHasOpenedTransfer`, `setHasOpenedAddWallet` and `setHasOpenedAccount`, plus two comments; the open handlers keep setting their latch for a click before idle; `tests/tab-preload.spec.ts`: 4 tests, one per shell dialog, the dialog must be on the page one macrotask after a DOM click on its trigger; `docs/contexts/ui-and-e2e.md`: the Shell modals bullet [0108]; `docs/audit/test-selector-contract.md`: the `tab-preload.spec.ts` ids; `docs/audit/task-ledger.md`: Phase 148 section). T808 (`AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`: Playwright 187 tests in 36 specs, 561 runs, 555 pass, 6 skip; ADR 0108: "sole cause" now "only close path found", counts on the Verification line, the entry-chunk Consequence now records +33 B; `docs/audit/baseline-metrics.md`: Phase 148 section; `docs/audit/task-ledger.md`: the T807 commit and the T808 row; this file).
   **Verified:** T807: Red gate verified (4 failed, 2 passed); npm run lint clean; unit 69 files 1510 passed (84.61s); tab-preload 6 passed on chr (22.7s), 18 passed on 3 browsers (1.1m); full e2e 36 specs 555 passed 6 skipped on 3 browsers (10.2m); CRLF kept, ADR 0108 CRLF; 0 em dashes; scope clean. T808: full unit 69 files 1510 passed (<X>s); playwright list 187 tests in 36 files, 561 runs; clean production build index-D4N64t3V.js 194,626 B / 56,981 B gzip, all app JS 886,331 B / 269,276 B gzip, 39 files, CSS index-CNaxMlAk.css 53,359 B / 10,451 B gzip; CRLF kept across the touched files; 0 em dashes in git diff. The T807 review approved in round 1; it reran the red check by stashing `src/App.tsx` (4 failed, 2 passed, each at `tests/tab-preload.spec.ts:113`) and reran `npm test` (561 runs, 555 passed, 6 skipped, 0 failed, 0 flaky, 10.4m).
   **Surprises:** (a) The popup did not close by itself: in every measured setting (three browsers, desktop and 390 px touch, 1x and 6x CPU, a fake signed-in session with slow cloud reads, an expired token, a stored template, both update toasts) a single click never closed it. The close came from React 19's 300 ms Suspense reveal throttle: the click mounted the lazy dialog's boundary, the `null` fallback committed, the dialog arrived about 330 ms later (650 to 1,400 ms at 6x CPU), and a second tap on "Add entry" in that gap landed on the full-page scrim and closed it. (b) The ADR 0104 idle preload already had the chunks cached, but `React.lazy` suspends on its first render even with the module cached, so fetching early did not help; mounting early is what removes the gap. (c) Before ADR 0107 (Phase 147) the `autoUpdate` worker reloaded the page around the same moment after a deploy, which may have hidden this. (d) ADR 0108 as built called the scrim tap "the sole cause" and said the entry chunk does not change; T808 softens the first to "the only close path found", since only production can confirm it, and records the measured +33 B raw, +18 B gzip.
   **Deliberately not done:** the production check, still owed by the owner after the deploy: signed in, reload, press "Add entry" once, and the popup must stay open; if it still closes after one press with no second tap, the cause is another one, and a follow-up task needs the browser, the device and whether the update notice was showing; a click before the idle callback runs still takes the slow path (ADR 0108 Not done, idle came about 240 ms after navigation, capped at 3 s), and no test exercises it; no time guard on the scrim click, no loading state on the trigger buttons (ADR 0108 Not done); no text edit of ADR 0010 or ADR 0104, the amendment lives in ADR 0108 only; no full Playwright run in T808 (docs-only, same code as `29ce4ba`; T807's build and review each ran `npm test`); the owner's Phase 149 design docs (`docs/audit/decisions/0109-transactions-table-and-calendar-views.md` and `docs/design/transactions-2026-10/`), untracked in the working tree, left out of this phase; archiving `task-ledger.md` (192 lines) and `baseline-metrics.md` (194 lines), both past the ~150-line threshold in `docs/audit/README.md` for a fifth phase, left for a separate task.

   ---
   ```

   If gate 7 gives line counts other than 192 (ledger) and 194 (metrics), write the real numbers in the last Deliberately not done item.

7. **`docs/audit/task-ledger.md`** (Phase 148 table only):
   - Commit cell: T807 (`:138`) `29ce4ba`. Change no other cell of that row.
   - Row T808 (`:139`), rewrite these cells:
     - Task: `Phase 148 closing docs: refactor-log entry, baseline-metrics section, T807 Commit cell, Playwright 187 / 36 / 561 in AGENTS.md, README.md and ui-and-e2e.md, ADR 0108 wording and Verification line`
     - Files: `` `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done` (flip to `in-progress` when starting)
     - Commit: empty
     - Gate result: `unit 69 files 1510 passed (<X>s); playwright list 187/36/561; clean prod build (index-D4N64t3V.js 194,626 B, all app JS 886,331 B 39 files, CSS 53,359 B); CRLF kept; 0 em dashes`
   - Do not edit the heading `:132`, the branch line `:134`, any earlier phase, the Backlog or the template.

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha. The unit run and the build supply the recorded figures. Commands (PowerShell, from the repo root):

```powershell
# 1-4: before any edit
npm run test:unit 2>&1 | Tee-Object workflow/stages/02_build/output/logs/T808-unit.log   # expect 69 files, 1510 passed; record seconds as <X>
npx playwright test --list | Select-Object -Last 1                         # expect "Total: 561 tests in 36 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build    # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"

# 5 onward: after the edits
git log --format=%h -1 --grep="(T807)"                                     # gate 5
git grep -n -E "183 tests|549 runs|\(549|543 pass|sole cause|does not change" -- AGENTS.md README.md docs/contexts/ docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md   # gate 6: expect nothing (exit 1)
(Get-Content docs/audit/task-ledger.md).Count; (Get-Content docs/audit/refactor-log.md).Count; (Get-Content docs/audit/baseline-metrics.md).Count   # gate 7
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
git ls-files --eol AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T808-spec.md workflow/stages/02_build/output/task-T808-build.md
git diff --stat
git status --porcelain
Remove-Item -Recurse -Force dist                                            # dist/ is gitignored; tidy up
```

Expect:
- Unit: 69 files, 1510 passed, 0 failed.
- Playwright list: `Total: 561 tests in 36 files`.
- Bundle: `index-D4N64t3V.js 194626 56981`, `index-CNaxMlAk.css 53359 10451`, `allJS 886331 269276 39`. Any difference: report it, do not write the metrics block (6a step 5).
- Sha: `29ce4ba`.
- Gate 6: no output.
- All seven files: `bareLF 0`, `w/crlf`.
- Em dash count: `0` in every check.
- Line counts: 192 (ledger), about 160 (refactor-log), 194 (metrics); the two counts named in the refactor-log's last Deliberately not done item match.
- `git diff --stat`: `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md` 1 line each, ADR 0108 3 lines, plus the three audit files.
- `git status --porcelain`: only the six target files, `docs/audit/task-ledger.md`, `workflow/stages/*/output/` files, and the two untracked Phase 149 paths of section 2 (`?? docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, `?? docs/design/transactions-2026-10/`), unchanged. No code, test or config file.
- No Playwright run is part of this task (docs-only, no `src/` or `tests/` change).

## 8. Production touch points

none for the task. No SQL, no `/api/*` request, no MCP write, no deploy, no sign-in. The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T808 Commit cell, the branch line `:134`, and the `Measured at` line in `baseline-metrics.md`. After the deploy, the owner checks on production, signed in: reload, press "Add entry" once, the popup must stay open (recorded under Deliberately not done; not a task step).

## 9. Out of scope

- The untracked Phase 149 files: `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` and everything under `docs/design/transactions-2026-10/`. Do not touch, stage or delete them.
- Any code, test, config, script or SQL file, including `src/App.tsx` and `tests/tab-preload.spec.ts`. `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- `docs/contexts/*.md` beyond `ui-and-e2e.md:67`; `DESIGN.md`; `docs/audit/test-selector-contract.md`.
- Any text of ADR 0108 except the three edits of 6a step 4; ADRs 0010 and 0104; no new ADR.
- `AGENTS.md` and `README.md` beyond the Playwright count each; their unit counts (already 1510 / 69).
- The T807 row's Task, Files, Status and Gate result cells; the Phase 148 heading and branch line; earlier phases; every Backlog row; the template.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file; a full Playwright run; any request to production `/api/*`; any live Supabase SQL.
