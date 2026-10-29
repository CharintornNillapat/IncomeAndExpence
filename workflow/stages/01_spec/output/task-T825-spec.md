# T825 spec: rollup-plugin-visualizer as an opt-in bundle-size report

Phase 156, branch `phase-156-bundle-visualizer` (cut from `main` at `3315720`). T825 is the phase's only and last task: it ships the phase (the Phase 156 `refactor-log.md` entry and `baseline-metrics.md` section are its targets). Id T825 confirmed free: the ledger's highest is T824 and no `task-T825-spec.md` existed. The next free ADR is `0112` (the last in `docs/audit/decisions/` is `0111`).

This phase is meant to be the first live test of the auto-merge path (AGENTS.md ICM, Release bullet). No Target file below is on the pause list and Production touch points is `none` apart from the recorded dependency approval (section 8). `package-lock.json` is a code path to the PR classifier (`unit/workflow-hardening.test.ts:183`), so the PR runs the full required checks.

## 1. Goal

`npm run analyze` builds the app once with `rollup-plugin-visualizer` and writes a gzip-aware treemap of the bundle to a git-ignored file, so the owner can see what each chunk is made of. A normal `npm run build`, `npm run dev` and the production bundle stay byte-identical: the plugin is only added in the `analyze` mode.

## 2. Target files

```
docs/audit/decisions/0112-opt-in-bundle-visualizer.md
vite.config.ts
package.json
package-lock.json
README.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

- `docs/audit/task-ledger.md` is bookkeeping (always allowed), with the three edits in section 2.6.
- The builder writes the ADR first, before any code (section 2.1).
- `.gitignore` is **not** a target: `.cache/` is already ignored (`.gitignore:62`), and the report lands in `.cache/` (section 2.3). Verified here: `git check-ignore -v .cache/bundle-stats.html` prints `.gitignore:62:.cache/	.cache/bundle-stats.html`.
- `docs/contexts/ui-and-e2e.md` is not a target; the one-line mention goes in `README.md` only (section 2.5).
- No other file. Leave `AGENTS.md`, `vercel.json`, `index.html`, `.github/workflows/`, `src/`, `unit/` and `tests/` untouched.

### 2.1 ADR `docs/audit/decisions/0112-opt-in-bundle-visualizer.md` (written first)

Same shape as `0111-docs-only-prs-report-required-checks.md`: title `# 0112: opt-in bundle visualizer`, `**Status:** Accepted. To be implemented in Phase 156 (T825)`, a line `The owner approved adding the dev dependency rollup-plugin-visualizer on 2026-10-29.`, `**Date:** 2026-10-29`, then `## Context`, `## Decision`, `## Consequences`, `## Not done`, `## Release`. Match the line endings of `0111` (`git ls-files --eol`). Content:

- **Context:** bundle sizes are tracked only as hand-measured totals in `baseline-metrics.md` (entry chunk, all app JS); nothing shows what is inside a chunk. The Backlog row asked for `rollup-plugin-visualizer`. Adding a dependency is on AGENTS.md's Stop and ask first list; the owner approved this one dependency on 2026-10-29, and no other.
- **Decision:** (a) version pinned exactly, `7.1.1` (latest, published 2026-08-14, 76 days before 2026-10-29; peers `rollup` and `rolldown` both optional, `rollup 2.x || 3.x || 4.x` covers the `rollup 4.63.1` under Vite 6.4.3; engines `node >=22`, the repo is on 24.x). (b) Opt-in by Vite **mode**, not an env var: `vite build --mode analyze` needs no `cross-env` and no shell-specific syntax, so one script works in Git Bash, PowerShell and CI, and `vite.config.ts` already receives `mode` (it uses it for `pwa-dev`, ADR 0042). An env flag such as `ANALYZE=1` would need `cross-env` (a new dependency) or per-shell scripts. `src/` never reads `import.meta.env.MODE` (only `import.meta.env.DEV`, `src/lib/supabase.ts:18`, which is false in both a default and an analyze build), so the analyze bundle equals the default one. (c) The report is written to `.cache/bundle-stats.html`, outside `dist/`: the PWA plugin's `workbox.globPatterns` is `**/*.{js,css,html,ico,png,svg,json,woff2}` (`vite.config.ts:67`), which would precache a `dist/stats.html`; `.cache/` is already git-ignored. (d) `gzipSize: true`, because `baseline-metrics.md` records gzip bytes; no other option.
- **Consequences:** one dev dependency (the dry-run install adds 27 packages to the lockfile: `open`, `yargs`, `picomatch`, `source-map` and their trees); a static import in `vite.config.ts` that loads on every dev and build start (a few ms, and vitest does not load this file: `vitest.config.ts` is separate); Vercel and CI `npm ci` fetch the extra packages. `vite.config.ts` is not in `tsconfig.json`'s `include`, so `tsc` does not type-check it. The analyze build is a look-only build; it also writes `dist/`, so do not deploy from it (its `dist/` is in fact identical to a default build's, gate 7, but the habit is: `npm run build` for anything shipped).
- **Not done:** a size budget or CI gate on the report; uploading the report as a CI artifact; brotli size; `cross-env`; React Compiler (separate Backlog row).
- **Release:** one PR, no migration, no production touch; expected to take the auto-merge path (no pause-list path).

### 2.2 `package.json`: one script and one devDependency (and the lockfile)

Run, from the repo root, `npm install --save-dev --save-exact rollup-plugin-visualizer@7.1.1`. It must change `package.json` by exactly the devDependency line below, and `package-lock.json` by additions only (the `rollup-plugin-visualizer` entry and its dependency tree, plus at most the `esbuild` entry's flags that the dry-run reports as `change esbuild 0.25.12 => 0.25.12`; no version change to any existing package). Then add the script by hand.

**Landed in package.json, the analyze script (insert on the line after `"build": "vite build",`):**

```text
    "analyze": "vite build --mode analyze",
```

**Landed in package.json, the devDependency (sits between `"pg": "^8.23.1",` and `"tailwindcss": "^4.1.14",`):**

```text
    "rollup-plugin-visualizer": "7.1.1",
```

Do not touch `"allowScripts"`. The dry-run shows no install-script package among the additions; if `npm install` reports a blocked script for a new package, stop and report it.

### 2.3 `vite.config.ts`: one import and one conditional plugin

Edit only these two places. Do not touch the `server` block (`DISABLE_HMR`, lines 102 to 108, including the mis-encoded characters in the comment at line 104) or the `registerType: 'prompt'` line, which `unit/reload-prompt.test.tsx:35` reads.

**Landed in vite.config.ts, the import (insert on the line after `import react from '@vitejs/plugin-react';`):**

```text
import { visualizer } from 'rollup-plugin-visualizer';
```

**Landed in vite.config.ts, the conditional plugin (insert after the `VitePWA({ ... }),` call's closing `      }),` at line 69 and before the `    ],` at line 70, so it is the last entry of `plugins`):**

```text
      // ADR 0112: `npm run analyze` (`vite build --mode analyze`) writes a gzip
      // treemap to `.cache/bundle-stats.html`. Outside `dist/` on purpose: the
      // PWA glob above matches `**/*.html` and would precache it. No other mode
      // adds the plugin, so `npm run dev` and `npm run build` are unchanged.
      ...(mode === 'analyze'
        ? [visualizer({ filename: '.cache/bundle-stats.html', gzipSize: true })]
        : []),
```

If the plugin does not create `.cache/` on its own, the analyze build fails with ENOENT: then stop and report; do not add a `mkdir` script (gate 7 will show it).

### 2.4 Why mode, in two lines

Smallest correct option: `vite build --mode analyze` plus `mode === 'analyze'` in a config that already branches on `mode`, so no env var, no `cross-env`, no per-shell script syntax, and the existing scripts (all plain commands, none sets an env var) stay the same shape. An `ANALYZE=1` flag would need a new dependency or two script variants for PowerShell and Git Bash.

### 2.5 `README.md`: one line

Add it as its own paragraph directly after the paragraph that ends `so AI classification is off locally.` (the `### 5. Run` section, `README.md` around line 149), with a blank line before it.

**Landed in README.md, the analyze mention:**

```text
To see what is in the bundle, run `npm run analyze`: it builds with the visualizer and writes a treemap to `.cache/bundle-stats.html` (git-ignored). It is for looking only, never for deploy.
```

### 2.6 `docs/audit/task-ledger.md` (bookkeeping, builder-kept)

1. Add a section `## Phase 156 - Opt-in bundle visualizer (ADR 0112)` after the Phase 155 table and before `## Backlog`, using the file's table header and one row: `| T825 | rollup-plugin-visualizer as an opt-in devDependency: ADR 0112, analyze mode and script, README line, Phase 156 closing docs | <the paths the build changed> | in-progress then done | | <gate result> |` (Commit empty, per the ledger header). The Branch line is:

**Landed in docs/audit/task-ledger.md, the Branch line:**

```text
Branch `phase-156-bundle-visualizer`, cut from `main` at `3315720`. One task, T825. Dev dependency `rollup-plugin-visualizer` 7.1.1 added with the owner's approval of 2026-10-29. No migration.
```

2. Flip Backlog row 103. Replace its last cell so the whole row reads:

**Landed in docs/audit/task-ledger.md, the Backlog row:**

```text
| `rollup-plugin-visualizer` for bundle-size visibility | same | done in Phase 156 (T825) |
```

3. The ledger is 134 lines; the new section adds about 6. Stay under about 150; do not archive anything.

### 2.7 Closing docs (this task ships the phase)

- `docs/audit/refactor-log.md`: one entry at the top, newest first, headed `## Phase 156 - Opt-in bundle visualizer: T825 (2026-10-29, code <sha or "pending the deploy record">, merged <same>)`, in the file's required shape (the ADR line, then `**Changed:**`, `**Verified:**`, `**Surprises:**`, `**Deliberately not done:**`). Surprises: record anything real, for example the plugin's default `filename` writes to the project root and not to `dist/`, so an unset filename would have left an untracked `stats.html`; or "none" if nothing surprised. Deliberately not done: the ADR's Not done list, plus a size budget, `cross-env`, and the `.gitignore` edit (not needed).
- `docs/audit/baseline-metrics.md`: a section `### Phase 156 - delta against Phase 154` at the top of "Figures" (above Phase 154), following Phase 154's wording. Figures: the default build's entry chunk, all app JS (bytes, gzip, file count) and CSS from gate 5, stated as equal to the pre-change build (and to Phase 152's `index-CsN9mAj5.js` 198,233 B, all app JS 910,982 B in 39 files, `index-BNwLrid8.css` 54,969 B if the local `.env` reproduces those hashes; if it does not, say so and give the before/after pair from gates 1 and 5, which is the binding comparison); **Dev dependencies 17 to 18** (count the `devDependencies` keys before and after); runtime dependencies unchanged at 7; lockfile delta from `git diff --stat package-lock.json` and the packages added from `npm install`'s own output (the dry-run reported 27 added); the size in bytes of `.cache/bundle-stats.html`; Vitest 72 files, 1606 tests (0 delta, no test added) with the full-run time; Playwright unchanged, not rerun beyond gate 11. Do not write a count the gates did not produce.

## 3. Context to read

None of `docs/contexts/*.md` is needed: the task touches build configuration, `package.json` and docs, no state, ledger, API or UI. Read `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md` for the ADR shape and `docs/audit/baseline-metrics.md`'s Phase 154 section for the figures wording. ADR 0042 is the precedent for a mode-gated `vite.config.ts` branch.

## 4. Current behaviour

- `vite.config.ts:6` takes `({ mode })`; `mode` is used once, `devOptions: { enabled: mode === 'pwa-dev' }` (line 20). `plugins` is `react()`, `tailwindcss()`, `VitePWA({...})` (lines 8 to 70). No analyzer exists.
- The PWA precache glob is `**/*.{js,css,html,ico,png,svg,json,woff2}` (`vite.config.ts:67`); anything `.html` written into `dist/` before the plugin's `closeBundle` globbing would be precached.
- `package.json:10-23` has plain command scripts, none sets an environment variable; there is no `cross-env`. `devDependencies` has 17 entries; `dependencies` has 7. `"allowScripts": { "esbuild": false }` (lines 52 to 54).
- `.gitignore` already ignores `dist/` (line 7) and `.cache/` (line 62). `vite.config.ts` is not in `tsconfig.json`'s `include` (`["src", "tests", "unit"]`), and `vitest.config.ts` exists separately, so neither `tsc` nor vitest loads `vite.config.ts`.
- Tests that read the config or manifest: `unit/reload-prompt.test.tsx:35-40` reads `vite.config.ts` and asserts it contains `registerType: 'prompt'` and not `registerType: 'autoUpdate'`; `unit/workflow-hardening.test.ts:183` lists `package-lock.json` as a path the PR classifier counts as code. Neither is affected by this change. No test reads `package.json`'s scripts or devDependencies.
- `src/` has one `import.meta.env` use that depends on the mode, `import.meta.env.DEV` at `src/lib/supabase.ts:18`; `MODE` is never read. A `--mode analyze` build still sets `NODE_ENV=production` (only `--mode development` is special-cased by Vite for the env), so the bundle is the production one. Gate 7 proves it.
- Plugin facts (read-only `npm view`, 2026-10-29): `rollup-plugin-visualizer` latest `7.1.1`, published 2026-08-14; previous line `6.0.11` (2026-03-04); peer `rollup 2.x || 3.x || 4.x` and `rolldown 1.x`, both optional; `engines.node >=22`; dependencies `open ^11`, `yargs ^18.1`, `picomatch ^4.0.5`, `source-map ^0.8`. It is a Rollup plugin, accepted by Vite's `plugins` array. The default `open` is false and the default `filename` is `stats.html` in the working directory, which is why the filename is set.
- A dry-run `npm install --save-dev --save-exact rollup-plugin-visualizer@7.1.1 --dry-run` reports `added 27 packages, and changed 1 package` (the changed one is `esbuild`, same version).

## 5. Parity map

None. No row of AGENTS.md's cross-file parity map covers `vite.config.ts` or `package.json`.

## 6. Tests to add

None, deliberately. The change alters only an opt-in build mode, not application behaviour, and the proof is a build comparison rather than a unit assertion (gates 5 to 8 check that the default build is byte-identical, that the plugin is absent from the `serve`, `build` and `pwa-dev` configs and present only in `analyze`, and that the report lands in an ignored path). A unit test would either re-read the config text (weak, like `unit/reload-prompt.test.tsx`'s) or call `resolveConfig` (slow, and it would add a test file, moving the test counts that AGENTS.md and README.md state, and AGENTS.md is on the pause list, which would defeat the auto-merge test). Stage 02 step 4 and stage 03 step 6 (red run) do not apply; the reviewer repeats gates 1 to 11 instead.

## 7. Gates

Work in order. Save logs under `workflow/stages/02_build/output/logs/` (gitignored). Check ports 3000 and 3100 for stale dev servers before gate 11. Do not edit `src/` while Playwright runs (nothing here edits `src/`).

1. **Baseline build, before any edit** (clean tree except the ADR if already written; do this before touching `vite.config.ts`, `package.json` or `package-lock.json`):

   ```
   npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T825-build-before.log
   node -e "const fs=require('fs'),p=require('path');const w=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?w(p.join(d,e.name)):[p.join(d,e.name)]);console.log(w('dist').map(f=>f.split(p.sep).join('/')+' '+fs.statSync(f).size).sort().join('\n'))" > workflow/stages/02_build/output/logs/T825-dist-before.txt
   ```

   Expect exit 0 and a file list. Record the entry chunk, all app JS and CSS figures as Phase 154's section does (gzip each `dist/assets` file at level 9).

2. **Text landed**, reading the expected text from this spec's fenced blocks (never retyped). Run after the edits; the five blocks under a `**Landed in <file>, ...:**` label (package.json x2, vite.config.ts x2, README.md x1) plus the two ledger blocks (7 in all) must each be found exactly once in their file, line endings normalised:

   ```
   node -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8').split(String.fromCharCode(96).repeat(3));let bad=0,n=0;for(let i=1;i<t.length;i+=2){const l=t[i-1].trim().split('\n').pop();if(!l.startsWith('**Landed in '))continue;const f=l.slice(12).split(',')[0];const b=t[i].split('\n').slice(1,-1).join('\n');const c=fs.readFileSync(f,'utf8').split('\r\n').join('\n');const k=c.split(b).length-1;n++;console.log(f,k);if(k!==1)bad++}console.log('blocks',n,'bad',bad);process.exit(bad||n!==7?1:0)" workflow/stages/01_spec/output/task-T825-spec.md
   ```

   Expect `blocks 7 bad 0` and exit 0. Before the edits it must exit 1 (run it once as a control). Run it from the repo root.

3. **Diff shape.** `git diff --stat` and `git status --porcelain` list only: the seven Target files, `docs/audit/task-ledger.md`, and the task's three stage-output files (`task-T825-spec.md`, `-build.md`, `-review.md`); no untracked file other than the ADR and those outputs. `git diff -U0 vite.config.ts` has exactly 2 hunks (the import, the plugin block) and 0 deleted lines; `git diff -U0 package.json` has exactly 2 hunks and 0 deleted lines; `git diff --numstat package-lock.json` shows deletions of 0 or a handful (flag-only lines for `esbuild`), no removed version line. Report the lockfile's added line count and the number of packages added.

4. **Install consistency** (offline-safe, writes nothing): `npm ci --dry-run` exits 0 with no "out of sync" error; `npm ls rollup-plugin-visualizer` prints `rollup-plugin-visualizer@7.1.1`; `npm ls --omit=dev rollup-plugin-visualizer` prints `(empty)` (it is a dev dependency only; a non-zero exit with `(empty)` is the expected result). The devDependencies key count is 18.

5. **Default build after the change:**

   ```
   npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T825-build-after.log
   node -e "<the same snapshot one-liner as gate 1>" > workflow/stages/02_build/output/logs/T825-dist-after.txt
   diff workflow/stages/02_build/output/logs/T825-dist-before.txt workflow/stages/02_build/output/logs/T825-dist-after.txt
   ```

   Expect exit 0 and an empty `diff` (identical file names with their hashes, and identical sizes, `sw.js`, `workbox-*.js` and `manifest.webmanifest` included). Then `ls .cache/bundle-stats.html dist/stats.html` must report both missing.

6. **Plugin presence per mode** (the config is loaded, nothing is built or served):

   ```
   node --input-type=module -e "import {resolveConfig} from 'vite';for(const [c,m] of [['serve','development'],['build','production'],['serve','pwa-dev'],['build','analyze']]){const r=await resolveConfig({},c,m);console.log(c,m,r.plugins.some(p=>p.name==='visualizer'))}"
   ```

   (`--input-type=module` is needed: under plain `node -e`, `vite-plugin-pwa` fails to load with `ERR_INVALID_ARG_VALUE ... Received '.'`.) Before the edits, the three non-analyze lines print `false` and the analyze line prints `false` too (no plugin yet); after the edits expect exactly four lines: `serve development false`, `build production false`, `serve pwa-dev false`, `build analyze true`. If the analyze line is `false`, the plugin's `name` differs: print `r.plugins.map(p=>p.name)` for the analyze mode, use the real name for all four, and report it.

7. **Analyze build and the clean-tree check:**

   ```
   git status --porcelain > workflow/stages/02_build/output/logs/T825-status-before-analyze.txt
   npm run analyze 2>&1 | tee workflow/stages/02_build/output/logs/T825-analyze.log
   git status --porcelain > workflow/stages/02_build/output/logs/T825-status-after-analyze.txt
   diff workflow/stages/02_build/output/logs/T825-status-before-analyze.txt workflow/stages/02_build/output/logs/T825-status-after-analyze.txt
   git check-ignore -v .cache/bundle-stats.html
   node -e "const s=require('fs').statSync('.cache/bundle-stats.html');console.log('report bytes',s.size);process.exit(s.size>0?0:1)"
   node -e "<the snapshot one-liner>" > workflow/stages/02_build/output/logs/T825-dist-analyze.txt
   diff workflow/stages/02_build/output/logs/T825-dist-before.txt workflow/stages/02_build/output/logs/T825-dist-analyze.txt
   node -e "const d=require('fs').readFileSync('dist/sw.js','utf8');console.log('sw mentions bundle-stats',d.includes('bundle-stats'))"
   ```

   Expect: `npm run analyze` exit 0; the two status files identical (the analyze build leaves the working tree exactly as it was: no untracked `stats.html`, no `.cache/` entry); `git check-ignore -v` prints `.gitignore:62:.cache/	.cache/bundle-stats.html`; report bytes greater than 0 (record the number); the analyze `dist` listing identical to the baseline (the mode does not alter the bundle); `sw mentions bundle-stats false`. The tree is not empty at this point (the task's own edits are pending), so "clean" means the before and after status files are identical and neither mentions `.cache` or `stats`.

8. **No stray output:** `ls stats.html` at the repo root reports missing (the default filename was overridden).

9. `npm run lint` exits 0 (`tsc` does not see `vite.config.ts`; the lint run proves nothing else broke). Save to `T825-lint.log`.

10. **Unit:** `npx vitest run unit/reload-prompt.test.tsx unit/workflow-hardening.test.ts` passes (the two files that read `vite.config.ts` and `package-lock.json`); then `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T825-unit.log`: 72 files, 1606 tests passed (0 delta; no test is added).

11. **Playwright smoke** (judged: the default build output is byte-identical, so no full run; but the dev and `pwa-dev` servers do load the edited `vite.config.ts`, so prove they still start and serve): after checking ports 3000 and 3100 are free, `npx playwright test tests/toast-layering.spec.ts --project=chromium` (it starts the `--mode pwa-dev` server on 3100 and the dev server on 3000) passes. A failure here is a blocker; do not retry around it.

12. **Docs and housekeeping:**
    - The Phase 156 baseline-metrics figures equal what gates 1, 5, 7 and 10 printed (the reviewer recomputes them).
    - `git ls-files --eol` on every changed tracked file shows `w/crlf` unchanged from its `i/` side (new files: match the neighbours); the ADR matches `0111`'s ending.
    - Em dashes: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/decisions/0112-opt-in-bundle-visualizer.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md vite.config.ts` and the added-lines count from the CONTEXT.md one-liner: 0 new in all (pre-existing ones, if any, are unchanged).
    - Every path and number the ADR and the closing docs state (the 27 packages, `.gitignore:62`, `vite.config.ts:67`, the 2026-08-14 release date, the ledger line count) is re-checked against the code or `npm view` before it is written.

## 8. Production touch points

- **Dependency approval (recorded):** the owner explicitly approved adding the single devDependency `rollup-plugin-visualizer` (pinned `7.1.1`) in this session, 2026-10-29, which AGENTS.md lists under Stop and ask first ("adding a dependency"). That approval covers this one package and its transitive tree only; no other dependency may be added.
- Nothing else: no SQL, no migration, no `/api/*` request, no deploy or env change, no MCP or CLI write, no `vercel.json`, `.github/workflows/` or `index.html` edit, no commit or push by the builder. The orchestrator commits and opens the PR by the Release bullet. This section lists nothing on the pause list, and neither do the Target files, so the phase is eligible for `gh pr merge <n> --auto --merge` (MASTER confirms `allow_auto_merge` is true; `package-lock.json` and `vite.config.ts` are outside `docs/`, `anti-slop/` and `*.md`, so the PR is a code PR and runs the seven required checks).

## 9. Out of scope

- Any change to the default build, `manualChunks`, `workbox`, the manifest, or `server` (`DISABLE_HMR` handling stays byte-for-byte).
- `.gitignore` (already ignores `.cache/`), `AGENTS.md`, `docs/contexts/*.md`, `vercel.json`, CI workflows, `src/`, `unit/`, `tests/`.
- A size budget, a CI step or artifact for the report, brotli, `open: true`, a second template, `cross-env`, or any other dependency.
- The React Compiler Backlog row and the ESLint row.
- Archiving ledger or metrics rows (not needed: the ledger stays under about 150 lines).
- Fixing the mis-encoded characters in the comment at `vite.config.ts:104`; leave the line untouched.
