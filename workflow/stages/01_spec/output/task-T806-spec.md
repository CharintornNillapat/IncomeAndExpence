# Spec: T806

Phase 147, branch `phase-147-update-prompt`, cut from `main` at `e0de2f4`. Docs-only; this task ships the phase. T806 is free as a spec: the ledger's T806 row (`docs/audit/task-ledger.md:130`) is the `todo` placeholder T805 added for this task, and no `task-T806-*` stage file exists. No new ADR. Format model: the Phase 146 closing task T804 (`c250226`, `workflow/stages/01_spec/output/task-T804-spec.md`) and the Phase 145 one, T802 (`fb0b81d`), which also changed the unit counts.

## 1. Goal

Close Phase 147 on paper, in the T804 and T802 pattern: the `refactor-log.md` entry for T805-T806 (with Surprises and Deliberately not done), the `baseline-metrics.md` Phase 147 section against Phase 146, the ledger Commit cell for T805 (`d6261d4`) and the T806 row, and the unit counts in `AGENTS.md` and `README.md` (1510 tests in 69 files). Also correct ADR 0107's Verification line, which records `skipWaiting call false` where the built `dist/sw.js` gives `true`.

## 2. Target files

```
AGENTS.md
README.md
docs/audit/decisions/0107-ask-before-updating-the-offline-app.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T805 Commit cell and the T806 row; section 6a step 5).

- `docs/contexts/ui-and-e2e.md` is listed in the ledger's T806 placeholder row but is **not** a target: its only count, `:67` (`183 tests in 36 specs ... 549 runs, 543 pass, 6 skip`), is still right (section 4 item 5). Step 5 drops it from the row's Files cell.
- Pause rule: `AGENTS.md` is a target, so the orchestrator pauses for the owner before `build T806`.

## 3. Context to read

none (docs-only). The builder reads, as the shapes to copy: the template block and the Phase 146 entry at the top of `docs/audit/refactor-log.md` (`:7-30`), the Phase 146 section of `docs/audit/baseline-metrics.md` (`:26-34`, including its `Measured at` line, which the new section omits), and the Phase 146 and 147 sections of `docs/audit/task-ledger.md` (`:114-130`).

## 4. Current behaviour

1. **ADR:** ADR 0107 (`docs/audit/decisions/0107-ask-before-updating-the-offline-app.md`, 46 lines, new in T805; amends ADR 0041 and ADR 0042 in its `## Amends` section). Its Verification bullet at `:33` ends `(`SKIP_WAITING true`, `clientsClaim false`, `skipWaiting call false`)`. The T805 build (`workflow/stages/02_build/output/task-T805-build.md:64-71`), the T805 review (`workflow/stages/03_review/output/task-T805-review.md:25`, `:50`) and the spec author's own build (item 7) all print `skipWaiting call true`: the one `self.skipWaiting()` in `dist/sw.js` is inside `self.addEventListener("message",s=>{s.data&&"SKIP_WAITING"===s.data.type&&self.skipWaiting()})`, which the T805 spec's regex also matches. There is no install-time call, so the prose before the parenthetical ("immediate `self.skipWaiting()` invocations are absent") is right; only the parenthetical is wrong.
2. **Phase 147 commits** (`git log --oneline main..HEAD`, spec author): T805 `d6261d4` only, 2026-10-25. Merge base with `main` is `e0de2f4`. `d6261d4` changed `docs/audit/decisions/0107-...md`, `docs/audit/task-ledger.md`, `docs/contexts/ui-and-e2e.md`, `src/components/ReloadPrompt.tsx`, `unit/fixtures/virtualPwaRegisterReact.ts`, `unit/reload-prompt.test.tsx`, `vite.config.ts`, `vitest.config.ts` and the three T805 stage files.
3. **Working tree at spec time:** `git status --porcelain` lists `workflow/stages/01_spec/output/task-T805-spec.md`, `workflow/stages/02_build/CONTEXT.md` and `workflow/stages/02_build/output/task-T805-build.md` as modified, but `git diff --stat` is empty: line endings only (Git warns LF will become CRLF). They are not this task's files. The builder leaves them as they are and does not stage or touch them, `workflow/stages/02_build/CONTEXT.md` above all.
4. **Review:** T805 APPROVED in round 1. The reviewer's red check stashed `vite.config.ts` and ran `unit/reload-prompt.test.tsx`: 1 failed, 3 passed, the failure being `vite.config.ts asks before updating` (`expected ... to contain 'registerType: 'prompt''`). It reran `tests/toast-layering.spec.ts` on chromium (2 passed, 13.1 s) and on three browsers (6 passed, 24.0 s), the full unit suite (69 files, 1510 passed, 59.18 s) and the build. Non-blocking notes: the ADR 0107 line (item 1); the build report did not say whether `vi.mock` alone failed before the Vitest alias and stub were added; the `vite.config.ts:12` comment reads "until user confirms reload".
5. **Counts** (spec author, at `d6261d4`):
   - Unit: 69 test files (`ls unit | grep -cE "test\.tsx?$"` gives 69), 1510 tests (T805 build 1510 passed in 59.69 s, `workflow/stages/02_build/output/logs/T805-unit.log`; T805 review 1510 in 59.18 s). Phase 146: 68 / 1506, so +1 file, +4 tests, all from `unit/reload-prompt.test.tsx`.
   - Stale unit counts: `AGENTS.md:11` says `(1506 tests, 68 files, PGlite replays every migration)`; `README.md:157` says `# Vitest: 1506 tests in 68 files, including every migration replayed in PGlite`. `git grep` of `AGENTS.md`, `README.md` and `docs/contexts/` finds no other unit count.
   - Playwright: `npx playwright test --list` prints `Total: 549 tests in 36 files`; `--project=chromium` prints `Total: 183 tests in 36 files`. 0 delta. `AGENTS.md:11` (`183 tests, 36 specs, 549 runs`), `README.md:158` (`183 tests in 36 spec files ... (549 runs)`) and `docs/contexts/ui-and-e2e.md:67` already match: no edit. The only spec that runs on the `pwa-dev` server whose behaviour T805 changed is `tests/toast-layering.spec.ts` (`playwright.config.ts:141`); T805's build and review both ran it on three browsers. Last full run: T803 (543 passed, 6 skipped, 9.7 min), before T805.
6. **Ledger** (`docs/audit/task-ledger.md`, 183 lines): Phase 147 heading `:123`, branch line `:125` (`Branch phase-147-update-prompt, cut from main at e0de2f4.`), row T805 `:129` with an empty Commit cell and a filled Gate result, row T806 `:130` (`todo`, Files cell lists `docs/contexts/ui-and-e2e.md`, empty Commit and Gate result). No Backlog row is touched.
7. **Bundle** (spec author, `rm -rf dist` then `npm run build` exit 0, `.env` present, gzip level 9 over `dist/assets`, at `d6261d4`; `dist/` removed afterwards):
   - Entry `index-B-nRqlko.js` 194,593 B / 56,963 B gzip (Phase 146 `index-C3uifmw_.js` 194,386 / 56,893: +207 / +70). The only change that reaches the bundle is `registerType` (`ReloadPrompt.tsx` gained a comment only; `vitest.config.ts` is never read by `vite build`), so the growth is the plugin's generated register code for `prompt` mode.
   - All app JS 886,298 B / 269,230 B gzip, 39 files (Phase 146 886,091 / 269,167: +207 / +63, 0 file delta).
   - CSS `index-CNaxMlAk.css` 53,359 B / 10,451 B gzip: the same file as Phase 146, 0 delta.
   - `dist/sw.js`: `SKIP_WAITING true`, `clientsClaim false`, one `self.skipWaiting()` call, inside the message listener.
8. **File lengths and line endings** (Node count): `AGENTS.md` 134, `README.md` 179, `refactor-log.md` 139, `baseline-metrics.md` 175, `task-ledger.md` 183, ADR 0107 46. All are `w/crlf`, `bareLF 0`. After this task: about 134, 179, 150, 183, 183 and 46. The ledger and the metrics file are past the ~150-line threshold (`docs/audit/README.md:40`) for a fourth phase; archiving is not in this order.

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 5 of section 7 first (they measure the figures the edits record), then make the edits, then run gates 6 onward. Keep CRLF in every file. Placeholder: `<X>` is the seconds of gate 1's unit run (two decimals). Keep `docs <sha>` and `merged <sha>` literal. No em dash anywhere.

1. **`AGENTS.md:11`**: change `(1506 tests, 68 files, PGlite replays every migration)` to `(1510 tests, 69 files, PGlite replays every migration)`. Change nothing else in the file.

2. **`README.md:157`**: change `# Vitest: 1506 tests in 68 files, including` to `# Vitest: 1510 tests in 69 files, including`. Keep the column alignment of the line. Change nothing else.

3. **ADR 0107 `:33`**: replace the parenthetical `(`SKIP_WAITING true`, `clientsClaim false`, `skipWaiting call false`)` with `(`SKIP_WAITING true`, `clientsClaim false`, `skipWaiting call true`: the one `self.skipWaiting()` call is inside the `SKIP_WAITING` message listener)`. Change no other text in the ADR.

4. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (`:24-25`), above `### Phase 146 - delta against Phase 145`. If gate 3 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block. Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 147 - delta against Phase 146

   - **Entry chunk** `index-B-nRqlko.js`: 194,593 B (+207 B), 56,963 B gzip (+70 B against Phase 146 `index-C3uifmw_.js`, 194,386 / 56,893): T805's `registerType: 'prompt'` makes `vite-plugin-pwa` generate its prompt-mode register code.
   - **All app JS**: 886,298 B (+207 B), 269,230 B gzip (+63 B against Phase 146 886,091 / 269,167, 39 files, 0 file delta).
   - **CSS**: `index-CNaxMlAk.css`: 53,359 B (0 delta), 10,451 B gzip (0 delta; the same file as Phase 146).
   - **Vitest**: 69 files, 1510 tests (+4 tests, +1 file against Phase 146: `unit/reload-prompt.test.tsx`, new in T805), 1510 passed in <X> s (`workflow/stages/02_build/output/logs/T806-unit.log`). Per-task run: T805 1510 passed in 59.69 s (`workflow/stages/02_build/output/logs/T805-unit.log`).
   - **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (0 delta). No full run in Phase 147: T805 ran `tests/toast-layering.spec.ts`, the one spec on the `pwa-dev` server, on 3 projects (6 passed), and T806 changed docs only. Last full run: T803, 543 passed, 6 skipped, 0 failed (9.7 min).

   ```

5. **`docs/audit/task-ledger.md`** (Phase 147 table only):
   - Commit cell: T805 (`:129`) `d6261d4`. Change no other cell of that row.
   - Row T806 (`:130`), rewrite these cells:
     - Task: `Phase 147 closing docs: refactor-log entry, baseline-metrics section, T805 Commit cell, unit 1510 / 69 files in AGENTS.md and README.md, ADR 0107 Verification line`
     - Files: `` `AGENTS.md`, `README.md`, `docs/audit/decisions/0107-ask-before-updating-the-offline-app.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done` (flip to `in-progress` when starting)
     - Commit: empty
     - Gate result: `unit 69 files 1510 passed (<X>s); playwright list 183/36/549; clean prod build (index-B-nRqlko.js 194,593 B, all app JS 886,298 B 39 files, CSS 53,359 B); sw.js one skipWaiting call, in the message listener; CRLF kept; 0 em dashes`
   - Do not edit the heading `:123`, the branch line `:125`, any earlier phase, the Backlog or the template.

6. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (`:20`) and its blank line, above `## Phase 146 - ...` (`:22`), followed by a blank line, `---` and a blank line.

   ```markdown
   ## Phase 147 - Ask before updating the offline app: T805-T806 (2026-10-25, code `d6261d4`, docs `<sha>`, merged `<sha>`)

   ADR `0107`, adding the update policy to ADR `0041` and ADR `0042`. When a new version is deployed, the open or installed app shows the "A new version is ready" notice and waits for Reload; it no longer reloads the page by itself.

   **Changed:** T805 (`d6261d4`: ADR 0107; `vite.config.ts`: `registerType` from `'autoUpdate'` to `'prompt'`, plus a one-line comment; `src/components/ReloadPrompt.tsx`: one comment line citing ADR 0107; `unit/reload-prompt.test.tsx`: new, 4 tests (the config asks before updating; the notice shows and Reload calls `updateServiceWorker(true)`, Dismiss clears both flags; nothing renders with both flags false; the offline-ready variant has no Reload button); `vitest.config.ts` and `unit/fixtures/virtualPwaRegisterReact.ts`: a test-only alias and stub for `virtual:pwa-register/react`; `docs/contexts/ui-and-e2e.md`: the "An app update waits for the user" rule [0107]; `docs/audit/task-ledger.md`: Phase 147 section). T806 (`AGENTS.md` and `README.md`: unit 1510 tests in 69 files; ADR 0107: the Verification line now records `skipWaiting call true`, inside the message listener; `docs/audit/baseline-metrics.md`: Phase 147 section; `docs/audit/task-ledger.md`: the T805 commit and the T806 row; this file).
   **Verified:** T805: Red gate verified (1 failed, 3 passed); npm run lint clean; unit/reload-prompt.test.tsx 4 passed (1.35s); full unit 69 files 1510 passed (59.69s); toast-layering 2 passed on chr (41.8s), 6 passed on 3 browsers (24.7s); clean prod build (15.23s); Gate 5 sw.js verified (SKIP_WAITING true, clientsClaim false, skipWaiting in message listener); CRLF kept; 0 em dashes; scope clean. T806: full unit 69 files 1510 passed (<X>s); playwright list 183 tests in 36 files, 549 runs; clean production build index-B-nRqlko.js 194,593 B / 56,963 B gzip, all app JS 886,298 B / 269,230 B gzip, 39 files, CSS index-CNaxMlAk.css 53,359 B / 10,451 B gzip; sw.js one skipWaiting call, in the message listener; CRLF kept across the touched files; 0 em dashes in git diff. The T805 review approved in round 1; it reran the red check by stashing `vite.config.ts` (1 failed, 3 passed) and reran toast-layering on three browsers (6 passed).
   **Surprises:** (a) The "A new version is ready" notice and its Reload button had never shown an update: under `autoUpdate` the plugin sets `skipWaiting` and `clientsClaim` and its register code reloads on `activated`, so `onNeedRefresh` was never called and only the "Ready to use offline" variant could render. (b) The T805 spec expected `skipWaiting call false` from its `dist/sw.js` check, but the regex also matches Workbox's `SKIP_WAITING` message listener, which in prompt mode holds the one `self.skipWaiting()` call; the build and review printed `true`, and T806 corrects ADR 0107's Verification line, which had copied the expected value. (c) The builder added the Vitest alias and stub for the virtual module (a conditional target) without saying whether a `vi.mock` factory alone had failed first. (d) The entry chunk grew 207 B raw and 70 B gzip from the one-word config change, the plugin's prompt-mode register code being larger than the auto one.
   **Deliberately not done:** a "reload when idle" timer, a countdown or a changelog in the notice (ADR 0107 Not done); a Playwright update test, which needs two builds and a real deploy; a real-browser update check (the owner's post-merge check: the first deploy after the merge still reloads open clients once under the old `autoUpdate` worker, and the next deploy should show the notice); removing the Vitest alias and stub, kept because it is harmless (`vite build` never reads `vitest.config.ts`) and finding out whether `vi.mock` alone resolves needs a config experiment, a separate task; the `vite.config.ts:12` comment wording ("until user confirms reload"), a code file outside this docs task; no full Playwright run in Phase 147 (T805 ran the one `pwa-dev` spec on three browsers; CI runs the full suite on the PR); `docs/contexts/ui-and-e2e.md` left alone, its Playwright count (183 / 36 / 549) still matches; archiving `task-ledger.md` (183 lines) and `baseline-metrics.md` (183 lines), both past the ~150-line threshold in `docs/audit/README.md` for a fourth phase, left for a separate task.

   ---
   ```

   If gate 8 gives line counts other than 183 (ledger) and 183 (metrics), write the real numbers in the last Deliberately not done item.

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha. The unit run and the build supply the recorded figures. Commands (PowerShell, from the repo root):

```powershell
# 1-5: before any edit
npm run test:unit *> workflow/stages/02_build/output/logs/T806-unit.log    # expect 69 files, 1510 passed; record seconds as <X>
npx playwright test --list | Select-Object -Last 1                         # expect "Total: 549 tests in 36 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build    # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"
node -e "const s=require('fs').readFileSync('dist/sw.js','utf8');console.log('SKIP_WAITING',s.includes('SKIP_WAITING'));console.log('clientsClaim',/clientsClaim|\.clients\.claim\(\)/.test(s));console.log('skipWaiting calls',(s.match(/self\.skipWaiting\(\)/g)||[]).length);console.log('in listener',/addEventListener\(\"message\"[^}]*self\.skipWaiting\(\)/.test(s))"

# 6 onward: after the edits
git log --format=%h -1 --grep="(T805)"                                     # gate 6
git grep -n -E "1506 tests|68 files" -- AGENTS.md README.md docs/contexts/  # gate 7: expect nothing (exit 1)
(Get-Content docs/audit/task-ledger.md).Count; (Get-Content docs/audit/refactor-log.md).Count; (Get-Content docs/audit/baseline-metrics.md).Count   # gate 8
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" AGENTS.md README.md docs/audit/decisions/0107-ask-before-updating-the-offline-app.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
git ls-files --eol AGENTS.md README.md docs/audit/decisions/0107-ask-before-updating-the-offline-app.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T806-spec.md
git diff --stat
git status --porcelain
Remove-Item -Recurse -Force dist                                            # dist/ is gitignored; tidy up
```

Expect:
- Unit: 69 files, 1510 passed, 0 failed.
- Playwright list: `Total: 549 tests in 36 files`.
- Bundle: `index-B-nRqlko.js 194593 56963`, `index-CNaxMlAk.css 53359 10451`, `allJS 886298 269230 39`. Any difference: report it, do not write the metrics block (6a step 4).
- `sw.js`: `SKIP_WAITING true`, `clientsClaim false`, `skipWaiting calls 1`, `in listener true`. Any other result: stop and report; do not edit ADR 0107.
- Sha: `d6261d4`.
- Gate 7: no output.
- All six files: `bareLF 0`, `w/crlf`.
- Em dash count: `0` in both checks.
- Line counts: 183 (ledger), 150 (refactor-log, give or take a line), 183 (metrics); the two counts named in the refactor-log's last Deliberately not done item match.
- `git diff --stat`: `AGENTS.md` and `README.md` 1 line each, ADR 0107 1 line, plus the three audit files. The three line-ending-only files from section 4 item 3 add no lines.
- `git status --porcelain`: only the five target files, `docs/audit/task-ledger.md`, the three pre-existing line-ending-only files of section 4 item 3, and `workflow/stages/*/output/` files. `docs/contexts/ui-and-e2e.md` and any code, test or config file must not appear.
- No Playwright run is part of this task (docs-only, no `src/` or `tests/` change).

## 8. Production touch points

none. No SQL, no `/api/*` request, no MCP write, no deploy. The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T806 Commit cell, the branch line `:125`, and the `Measured at` line in `baseline-metrics.md`. The owner's own check of the deployed app (the second deploy after the merge shows the notice instead of reloading) is not a task step.

## 9. Out of scope

- Any code, test, config, script or SQL file, including `vite.config.ts` (the comment wording nit) and `vitest.config.ts` with `unit/fixtures/virtualPwaRegisterReact.ts` (the review's question whether the alias was needed: dropping it needs a config experiment and is a separate task the owner can order; recorded under Deliberately not done). `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files, including the line-ending-only change already in `workflow/stages/02_build/CONTEXT.md`.
- `docs/contexts/*.md` and `DESIGN.md` (counts verified, no edit).
- Any text of ADR 0107 except the `:33` parenthetical; ADRs 0041 and 0042; no new ADR.
- `AGENTS.md` and `README.md` beyond the one unit count each; their Playwright counts.
- The T805 row's Task, Files, Status and Gate result cells; the Phase 147 heading and branch line; earlier phases; every Backlog row; the template.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file; a full Playwright run; any request to production `/api/*`; any live Supabase SQL.
