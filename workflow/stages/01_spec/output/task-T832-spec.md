# T832 spec: wire ESLint's React hooks rules into npm run lint

Phase 161, branch `phase-161-finance-hooks-lint`, slug `finance-hooks-lint`. Second and last task of the phase: it ships the phase (`docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`). Reviewer tier: strict (`fin-reviewer-strict`) for every review round. `AGENTS.md` is a target, so the orchestrator pauses after this spec (the owner approves the T831 and T832 specs together), and the Phase 161 PR is merged by the owner (pause list and T831's money path), never auto-merged.

**Dependency order.** T831 (`workflow/stages/01_spec/output/task-T831-spec.md`) must be APPROVED and committed on the phase branch before `build T832` starts. T832 needs three things T831 leaves: `npm run lint:hooks` at 0 warnings and 0 errors (otherwise the new `npm run lint` fails on the five `FinanceContext.tsx` warnings), `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md` (T832 appends an amendment to it), and the 1625-test unit suite (T832 writes that count into `AGENTS.md` and `README.md`). Gate 0 checks all three and stops the build with `BLOCKED` if any is missing. The two specs share no target file except the bookkeeping `docs/audit/task-ledger.md` (T831 adds the Phase 161 section, its row and the Backlog row's "partly done"; T832 adds its row and closes the two Backlog rows) and ADR 0115 (T831 creates it; T832 only appends).

## 1. Goal

Make `npm run lint` run ESLint's two React hooks rules over `src` and `api` and fail on any warning, so CI, which already runs `npm run lint` (`.github/workflows/playwright.yml:104`), fails on a hooks warning; prove it with a deliberately injected warning on a scratch copy outside the repo; and update the docs that say what `npm run lint` runs, with the phase's closing docs.

## 2. Target files

```
docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md
package.json
eslint.config.js
AGENTS.md
README.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

- No new ADR. ADR 0115 (written by T831's builder) already holds the decision as D3 ("T832's spec fixes the exact script and flags and whether any workflow file changes"); T832 appends one `## Amendments` section recording D3 as built (Edit 6). Write it first, before `package.json`.
- ADR 0113 gets no T832 edit: T831's Edit 9 already adds "D6's follow-on is ADR 0115 (Phase 161), which supersedes D2 once T832 wires ESLint into `npm run lint`" to its Status line, which is true once this task lands. Its D2 and Not done lines are history and stay.
- Bookkeeping, always allowed: `docs/audit/task-ledger.md` (Edits 7 and 8 and the T832 row) and `workflow/stages/02_build/output/*`.

## 3. Context to read

None. The task touches no domain code: no `src/`, `unit/`, `tests/`, `api/` or `supabase/` file. The one context statement about CI, `docs/contexts/ui-and-e2e.md:80` ("`checks` (lint, unit in order and shuffled)"), stays true; the spec checked it, and the other two context statements that name `npm run lint` (`docs/contexts/api-proxies.md:14`, "runs both configs"; `docs/contexts/client-state.md:34`, "enforces it (`check-safe-ids.mjs`)") stay true too.

## 4. Current behaviour

Measured on `883a6a6`, before T831's build.

- **`npm run lint`** is `npm run check:node-globals && npm run check:safe-ids && tsc --noEmit && tsc -p api/tsconfig.json` (`package.json:16`). It does not run ESLint. One warm run took 13.7 s locally.
- **`npm run lint:hooks`** is `eslint src api` (`package.json:17`), opt-in by ADR 0113 D2 (`docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md:19`): ESLint's default exit codes, so warnings exit 0. It prints `✖ 5 problems (0 errors, 5 warnings)` (the five `FinanceContext.tsx` warnings T831 removes) and exits 0, in 3.9 s.
- **`npx eslint --max-warnings 0 src api`** on the same tree prints the same five warnings, then `ESLint found too many warnings (maximum: 0).`, and exits 1 (4.3 s).
- **`eslint.config.js`** sets `react-hooks/exhaustive-deps` to `warn` and `react-hooks/rules-of-hooks` to `error` (`eslint.config.js:17-18`); its header comment says "Opt-in: not part of `npm run lint` or CI. Warnings do not fail it." (`:1-2`), which this task makes false, so the comment changes.
- **CI**: the `checks` job (`playwright.yml:75-122`) runs `npm ci` (`:100`, no `NODE_ENV` or `--omit`, so dev dependencies, ESLint included, are installed today) and then `npm run lint` (`:104`) in a step named `Type-check (tsc --noEmit)` (`:102`). On Phase 160's `main` push run 40906673300 that step took 8 s (15:57:25 to 15:57:33). The required check is the job name `Type-check and unit tests` (`unit/workflow-hardening.test.ts:106`), not the step name. **No workflow edit is needed**: CI picks up the new `lint` script as it is. The stale step name is flagged for the owner in section 8, not planned.
- **Shell**: `npm config get script-shell` prints `null`, so on Windows npm runs scripts through `cmd.exe`; CI runs them through `sh`.
- **Docs that state what lint runs**: `AGENTS.md:26` (Commands), `README.md:158-159`, `eslint.config.js:1-2`. The tier rows (`AGENTS.md:81-87`) and the closing rule (`AGENTS.md:93`) name `npm run lint` without listing its steps, so they need no change: every row that names it now runs ESLint too. No `workflow/stages/*/CONTEXT.md` file mentions lint, ESLint or `tsc` (searched), so no stage file changes. `scripts/check-node-globals.mjs:16` ("`npm run lint` runs it first") and `scripts/check-safe-ids.mjs:18` stay true.
- **Stated counts**: `AGENTS.md:11` and `README.md:160` say 1624 unit tests in 73 files; after T831 the suite is 1625 in 73 (T831 gate 5). `npx playwright test --list` prints `Total: 639 tests in 37 files`, and with `--project=chromium` `Total: 213 tests in 37 files`, matching `AGENTS.md:11` and `README.md:161`; T832 adds no spec.
- **Bundle**: no build input changed between Phase 158's merge `160c4b7` and `883a6a6` (`git diff --stat 160c4b7 HEAD -- src index.html public vite.config.ts package.json package-lock.json tsconfig.json` is empty), and the current `dist/` reproduces Phase 158's figures (`index-CAxfG7Qp.js` 198,228 B / 57,957 B gzip, all app JS 911,014 B / 275,891 B in 39 files, `index-BNwLrid8.css` 54,969 B / 10,720 B, 57 files). T831's five dependency arrays are the phase's only build input change.

**Decision: `--max-warnings 0` on the `lint:hooks` script, not `error` severity in `eslint.config.js`.** It keeps `exhaustive-deps` at `warn` as ADR 0113 D3 set it (an editor still shows it as an advisory warning), and fails the script on any warning from any rule, now or later, where `error` severity would cover only the one rule named. It is one flag in one file, it is the exact form T831's gate 2 already proved at 0, and `npm run lint`, CI and a hand run all go through it.

**Decision: keep `lint:hooks`, appended as the last step of `lint`.** `"lint:hooks": "eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api"` and `lint` becomes its old four steps, in order, plus `&& npm run lint:hooks`. This mirrors the `check:*` steps, keeps a 4 s hooks-only command, and keeps every existing reference to `npm run lint:hooks` (ADR 0113, ADR 0115, T831's spec, `README.md`) valid. With `&&`, a failed step stops the chain and `npm run lint` exits non-zero; ESLint runs only after both `tsc` runs pass.

**Decision (owner's amendment, after approval): `--cache --cache-location .cache/eslint/`.** ESLint keeps its per-file results in one file, `.cache/eslint/.cache_<hash>`, which it creates with the folder on the first run. Checked for this spec:

- **Gitignored already.** `.gitignore:62` is `.cache/` (under `# Caches & Temporary Files`, `:61`), and `git check-ignore -v .cache/eslint/x` prints `.gitignore:62:.cache/`. `.cache/` exists today and holds only the untracked `bundle-stats.html` (`vite.config.ts:76`); `git ls-files .cache` is empty.
- **No guard, `tsc` or test runner reads it.** `check-node-globals.mjs:271` and `check-safe-ids.mjs:105` walk `src/` only; `tsconfig.json` includes `src`, `tests` and `unit`; `api/tsconfig.json`'s `**/*.ts` is relative to `api/`; ESLint lints only its `src api` arguments, and the cache file is not `.ts`; Vitest includes `unit/**/*.test.{ts,tsx}` (`vitest.config.ts:35`) and Playwright `./tests` (`playwright.config.ts:7`). Gate 4's `git ls-files -co --exclude-standard` copy skips ignored files, so a scratch copy starts with no cache.
- **A cached run hides no warning.** ESLint stores each file's messages with its result and prints them again on a cached run, and it re-lints a file whose size or modification time changed (the default `metadata` strategy). Measured for this spec on `883a6a6` (five warnings still present) with the cache pointed outside the repo: four runs of `npx eslint --max-warnings 0 --cache --cache-location <scratch>/ src api` all exited 1, the first cold (26.7 s), the next three warm (3.6 s, 3.4 s, 2.8 s); the same command without the cache took 4.2 s. Gate 4 proves it on the new scripts.
- **Shell.** `.cache/eslint/` holds only `.`, `/` and letters, so `cmd.exe` and `sh` pass it as the same word; the helper's shell-neutral check still holds.

## 5. Parity map

None. No row of `AGENTS.md`'s parity map changes: no `src/`, `api/`, `supabase/`, `index.html`, `vercel.json` or workflow file is touched. `package-lock.json` does not change (scripts are not in the lockfile).

## 6. Tests to add

None in the repo. The changed behaviour is the `npm run lint` script, which no unit test reads (`unit/` has no reference to `package.json`), and the owner's order asks for a gate, not a committed test. The red-then-green proof is gate 4, on a scratch copy outside the repo with the ESLint cache warmed by a clean run: with an injected `exhaustive-deps` warning the new `npm run lint` exits 1, and a second, cached run exits 1 too; the same copy with `HEAD`'s old `package.json` exits 0 (the gap this task closes); the copy without the injection exits 0.

**Stage 02 step 4 and stage 03 step 6 under this spec.** Both are replaced by gate 4, which the builder runs and the reviewer runs again itself, in its own log folder. Gate 4 edits nothing in the repo tree, so the reviewer needs no stash for it.

Probe file:

```tsx
// T832 gate probe, scratch copy only: `count` is missing from the deps.
import { useEffect, useState } from 'react';

export function LintProbe() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    document.title = String(count);
  }, []);
  return <button type="button" onClick={() => setCount(count + 1)}>{count}</button>;
}
```

It passes both guards and `tsc --noEmit` and raises exactly one warning, `8:6 warning React Hook useEffect has a missing dependency: 'count'` (`react-hooks/exhaustive-deps`), checked for this spec on a scratch copy.

## 7. Edits

Order: gate 0, then gate 2's "before" timing, then Edit 6 (ADR), then Edits 1 to 5, then Edits 7 and 8 and the T832 row, then the closing docs (Edits 9 and 10), then the gates. Keep each file's line endings (`git ls-files --eol`): `package.json`, `eslint.config.js`, `AGENTS.md`, `README.md`, `docs/audit/baseline-metrics.md` and ADR 0115 are CRLF in the working tree; `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` are LF. No line in any edit changes beyond the text below.

### Edit 1 (`package.json:16-17`): the scripts

Edit 1, old text:

```
    "lint": "npm run check:node-globals && npm run check:safe-ids && tsc --noEmit && tsc -p api/tsconfig.json",
    "lint:hooks": "eslint src api",
```

Edit 1, new text:

```
    "lint": "npm run check:node-globals && npm run check:safe-ids && tsc --noEmit && tsc -p api/tsconfig.json && npm run lint:hooks",
    "lint:hooks": "eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api",
```

### Edit 2 (`eslint.config.js:1-2`): the header comment

Comments only; the rules at `:17-18` stay `warn` and `error`.

Edit 2, old text:

```
// ADR 0113: `npm run lint:hooks` runs only the two React hooks rules over src/
// and api/. Opt-in: not part of `npm run lint` or CI. Warnings do not fail it.
```

Edit 2, new text:

```
// ADR 0113 and ADR 0115: `npm run lint:hooks` runs only the two React hooks
// rules over src/ and api/ with `--max-warnings 0`, so a warning fails it, and
// `npm run lint` runs it last, so CI fails on one too.
```

### Edit 3 (`AGENTS.md:11`): the unit count

Edit 3, old text:

```
- **Tests:** Vitest in `unit/` (1624 tests, 73 files, PGlite replays every migration); Playwright in `tests/` (213 tests, 37 specs, 639 runs on three browsers).
```

Edit 3, new text:

```
- **Tests:** Vitest in `unit/` (1625 tests, 73 files, PGlite replays every migration); Playwright in `tests/` (213 tests, 37 specs, 639 runs on three browsers).
```

### Edit 4 (`AGENTS.md:26`): the Commands line

Edit 4, old text:

```
- `npm run lint`: Node-globals guard, safe-id guard, `tsc --noEmit`, `tsc -p api/tsconfig.json`
```

Edit 4, new text:

```
- `npm run lint`: Node-globals guard, safe-id guard, `tsc --noEmit`, `tsc -p api/tsconfig.json`, then `npm run lint:hooks` (ESLint's two React hooks rules on `src` and `api` with `--max-warnings 0`, so a hooks warning fails lint and CI; ADR 0115)
```

The tier rows and `AGENTS.md:93` do not change (section 4).

### Edit 5 (`README.md:158-160`): the Testing block

The comments stay aligned at the column they start at today.

Edit 5, old text:

```
npm run lint         # TypeScript for the app, the tests and the functions, plus checks for Node globals and time-only ids in src/
npm run lint:hooks   # opt-in ESLint: react-hooks rules on src/ and api/; warnings do not fail it; not part of lint or CI
npm run test:unit    # Vitest: 1624 tests in 73 files, including every migration replayed in PGlite
```

Edit 5, new text:

```
npm run lint         # TypeScript for the app, the tests and the functions, checks for Node globals and time-only ids in src/, then lint:hooks
npm run lint:hooks   # ESLint: react-hooks rules on src/ and api/; any warning fails it; the last step of lint, so CI runs it too
npm run test:unit    # Vitest: 1625 tests in 73 files, including every migration replayed in PGlite
```

### Edit 6 (ADR 0115, appended): D3 as built

Append after the file's last line (T831's Edit 8 text, which ends with the `## Release` paragraph), with one blank line between. Nothing above it changes, including the Status line (the deploy record fills it).

Edit 6, new text:

```
## Amendments

### Phase 161, T832: D3 as built

- **The scripts.** `"lint:hooks": "eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api"`, and `npm run lint` keeps its four steps in their order and appends `&& npm run lint:hooks`. A failed step stops the chain, so ESLint runs last, only after both `tsc` runs pass. `npm run lint:hooks` stays as the hooks-only command for a hand run.
- **Why `--max-warnings 0`, not `error` severity.** `react-hooks/exhaustive-deps` stays at `warn` in `eslint.config.js`, as ADR 0113 D3 set it, so an editor still shows it as a warning, while the flag fails the script on any warning from any rule, now or later. One flag in `package.json` serves `npm run lint`, CI and a hand run alike. ESLint then prints `ESLint found too many warnings (maximum: 0).` and exits 1.
- **CI.** The `checks` job already runs `npm run lint` after `npm ci`, which installs the dev dependencies, so no workflow file changes. Its step is still named `Type-check (tsc --noEmit)`; renaming it is a `.github/workflows/` edit left to the owner, and it renames no required check, since those are job names.
- **Cache.** `--cache --cache-location .cache/eslint/` keeps ESLint's per-file results in `.cache/eslint/`, which `.gitignore`'s `.cache/` line already ignores and which no guard, `tsc` config or test runner reads. A cached run prints a cached file's warnings again, and ESLint re-lints a file whose size or modification time changed, so the cache hides no warning.
- **Shell.** Both scripts hold only `&&`, bare words and two flag values: no quote, `$`, glob, `;`, pipe, redirection or variable assignment, so they mean the same in `cmd.exe`, which npm uses on Windows, and in `sh` on CI.
- **AGENTS.md.** The Commands line names the ESLint step. The tier rows need no change: each row that names `npm run lint`, and the rule that every code-tier task runs it, now include ESLint.
- **Proof.** On a scratch copy of the working tree outside the repo, with the cache warmed by a clean `npm run lint`, an injected `exhaustive-deps` warning makes `npm run lint` exit 1, a second, cached run exits 1 too, the same copy with the old scripts exits 0, and the copy without the injection exits 0.
```

### Edit 7 (`docs/audit/task-ledger.md:140`): the first ESLint Backlog row

Edit 7, old text:

```
| ESLint with `react-hooks/exhaustive-deps` | `archive/constraints-to-promote.md` follow-on proposals | partly done in Phase 158 (T827): `npm run lint:hooks` is opt-in and the `Modal.tsx` and `OverflowMenu.tsx` warnings are fixed; the rest is the next row |
```

Edit 7, new text:

```
| ESLint with `react-hooks/exhaustive-deps` | `archive/constraints-to-promote.md` follow-on proposals | done in Phase 158 (T827) and Phase 161 (T831, T832) |
```

### Edit 8 (`docs/audit/task-ledger.md:141`): the FinanceContext Backlog row

The old text is T831's Edit 11 new text.

Edit 8, old text:

```
| Fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094) and wire ESLint into `npm run lint` and CI, including AGENTS.md's Commands line and the tier rows; a money-path phase, merged by the owner | Phase 158, T827's spec | partly done in Phase 161 (T831): the five warnings are fixed; T832 wires ESLint into `npm run lint` and CI |
```

Edit 8, new text:

```
| Fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094) and wire ESLint into `npm run lint` and CI, including AGENTS.md's Commands line and the tier rows; a money-path phase, merged by the owner | Phase 158, T827's spec | done in Phase 161 (T831, T832) |
```

**The T832 row** (stage 02 step 6): directly under the T831 row in the Phase 161 table. `#` `T832`; Task `Wire ESLint's React hooks rules into npm run lint (lint:hooks with --max-warnings 0 and a cache in .cache/eslint/, appended last); injected-warning proof on a scratch copy, warm cache included; AGENTS.md Commands line and unit count, README, eslint.config.js header comment, ADR 0115 amendment; Phase 161 closing docs`; Files: section 2's seven paths plus `docs/audit/task-ledger.md`, each in backticks, comma separated, in section 2's order; Status `in-progress`, then `done`; Commit empty; Gate result in the compact "Gate N ..." style of the T831 row. Leave the Phase 161 intro line as T831 wrote it.

### Edit 9 (`docs/audit/refactor-log.md`): the Phase 161 entry

One entry at the top, above `## Phase 160 - `, separated from it by a `---` line with a blank line on each side, as the Phase 160 and 159 entries are. Built per stage 02's closing-docs rule (Changed from `git show --stat <T831 sha>` and this task's `git status --porcelain`; Verified copied word for word from both ledger Gate result cells; Surprises only from a build or review report). Its parts, in this order:

1. Heading: ``## Phase 161 - FinanceContext hooks lint: T831-T832 (<date>, code `<sha>` and `<sha>`, merged `<sha>`)``, with the build date and the three `<sha>` placeholders left for the deploy record.
2. A brief starting ``ADR `0115` `` (T831 writes it, T832 amends it): T831 lists the slice setters and refs the hooks rule asked for in five `FinanceContext.tsx` dependency arrays, with no behaviour change and an identity characterization test; T832 makes `npm run lint` run `lint:hooks` with `--max-warnings 0`, so a hooks warning fails lint and CI.
3. `**Changed:**`, `**Verified:**`, `**Surprises:**` (or `none`), `**Deliberately not done:**`. Deliberately not done names at least: renaming the CI step `Type-check (tsc --noEmit)` (a workflow edit, the owner's); `error` severity in `eslint.config.js` (section 4); a unit test that pins the two scripts (gate 4 is the proof; add one if the scripts are ever weakened); the three bare `// eslint-disable-next-line` sites; the React Compiler rules, recommended preset, type-aware rules and `eslint` 10 (ADR 0113); archiving `docs/audit/task-ledger.md`, past its 150-line limit; any further ADR 0113 edit; the `<sha>` placeholders and Commit cells (the deploy record's).

### Edit 10 (`docs/audit/baseline-metrics.md`): the Phase 161 section

A section `### Phase 161 - delta against Phase 159` at the top of "Figures", above `### Phase 159 - delta against Phase 158` (Phase 160 added none), in Phase 159's wording. Every figure comes from a gate; write none the gates did not produce:

- **Bundle** (gate 7): entry chunk name, raw and gzip; all app JS raw and gzip and file count; CSS name, raw and gzip; `dist` file count; each with its delta against Phase 158's figures (section 4), and the note that T831's five dependency arrays are the only build input changed since Phase 158.
- **Dependencies**: unchanged (dev 21, runtime 7), `package-lock.json` unchanged (gate 8).
- **Lint**: `npm run lint` local median of 3 before and after and the delta (gate 2), with `npm run lint:hooks` now its last step; hooks lint 5 warnings to 0 (T831), 0 errors. CI's lint step was 8 s on run 40906673300 (gate 2); the Phase 161 PR run's figure is the deploy record's.
- **Vitest** (gate 5): 73 files, 1625 tests (+1 against Phase 159: T831's identity test in `unit/rerender-matrix.test.tsx`), the pass count and time, and the log path.
- **Playwright** (gate 6): unchanged, 213 tests in 37 files, 639 runs; T831's affected-spec runs are in its ledger row.

## 8. Gates

Tier rows (`AGENTS.md`, Tiered verification gates) for the changed paths: `eslint.config.js` is comments only (`npm run lint`; the reviewer confirms from the diff that only comment lines changed, gate 8); `package.json` has no tier row of its own and is treated as code, so `npm run lint` and `npm run test:unit` run (gates 3 and 5); `AGENTS.md`, `README.md`, ADR 0115, the refactor log, the baseline metrics and the ledger are docs whose counts and paths are checked (gates 1, 6 and 9). No changed path's row includes Playwright, and no file Playwright loads changes (`src/`, `tests/`, `index.html`, `vite.config.ts`, `playwright.config.ts`), so there is no Playwright gate in either stage; this removes no tier. No money path changes. Never edit `src/` while Playwright runs: this task edits no `src/` file, and gate 4's copy of `src/` lives outside the repo.

Run every gate from the repo root in Git Bash. `D` is the log folder: `workflow/stages/02_build/output/logs/` for the builder, `workflow/stages/03_review/output/logs/` for the reviewer. Every command that saves a log redirects to a file and reads `$?` right after, never through a pipe.

**Save the helper** (both stages), extracted from this spec by script, never retyped:

```
D=workflow/stages/02_build/output/logs/; H=${D}T832-gates.cjs
node -e 'const fs=require("fs");const s=fs.readFileSync("workflow/stages/01_spec/output/task-T832-spec.md","utf8").replace(/\r\n/g,"\n");const m=/^Gate helper:\n\n```js\n([\s\S]*?)\n```$/m.exec(s);fs.writeFileSync(process.argv[1],m[1]+"\n")' $H
```

Gate helper:

```js
// T832 gate helper. From the repo root: `node <this> text`, `node <this> probe <file>`, `node <this> bundle`.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '');
const cnt = (s, t) => s.split(t).length - 1;
const blocks = (s) => {
  const re = /^Edit (\d+), (old|new) text:\n\n(`{3,})[^\n]*\n([\s\S]*?)\n\3$/gm;
  const b = {};
  let m;
  while ((m = re.exec(s))) (b[m[1]] ??= {})[m[2]] = m[4];
  return b;
};
const spec = rd('workflow/stages/01_spec/output/task-T832-spec.md');
const mode = process.argv[2];
if (mode === 'probe') {
  const m = /^Probe file:\n\n```tsx\n([\s\S]*?)\n```$/m.exec(spec);
  fs.writeFileSync(process.argv[3], m[1] + '\n');
  console.log('probe written', process.argv[3]);
  process.exit(0);
}
if (mode === 'bundle') {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const size = (f) => { const x = fs.readFileSync(f); return [x.length, zlib.gzipSync(x, { level: 9 }).length]; };
  const assets = fs.readdirSync('dist/assets');
  let raw = 0;
  let gz = 0;
  let n = 0;
  for (const a of assets.filter((x) => x.endsWith('.js'))) {
    const [r, g] = size(path.join('dist/assets', a));
    raw += r;
    gz += g;
    n++;
  }
  for (const a of assets.filter((x) => /^index-.*\.(js|css)$/.test(x))) console.log(a, ...size(path.join('dist/assets', a)));
  console.log('all app js', raw, gz, 'files', n);
  console.log('dist files', walk('dist').length);
  process.exit(0);
}
if (mode !== 'text') { console.log('mode must be text, probe or bundle'); process.exit(2); }
const b = blocks(spec);
const b831 = blocks(rd('workflow/stages/01_spec/output/task-T831-spec.md'));
const P = rd('package.json');
const E = rd('eslint.config.js');
const AG = rd('AGENTS.md');
const RM = rd('README.md');
const A15 = rd('docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md');
const RL = rd('docs/audit/refactor-log.md');
const BM = rd('docs/audit/baseline-metrics.md');
const L = rd('docs/audit/task-ledger.md');
let bad = 0;
const chk = (name, ok) => { console.log(name, ok ? 'OK' : 'BAD'); if (!ok) bad++; };
const files = { 1: P, 2: E, 3: AG, 4: AG, 5: RM, 7: L, 8: L };
for (const [n, f] of Object.entries(files)) {
  chk(`edit${n} new once`, cnt(f, b[n].new + '\n') === 1);
  chk(`edit${n} old gone`, cnt(f, b[n].old + '\n') === 0);
}
let pj = null;
try { pj = JSON.parse(fs.readFileSync('package.json', 'utf8')); } catch { pj = null; }
chk('package.json parses', pj !== null);
const old = JSON.parse(execSync('git show HEAD:package.json', { encoding: 'utf8' }));
const s = pj ? pj.scripts : {};
chk('lint keeps its steps and order, appends lint:hooks', s.lint === old.scripts.lint + ' && npm run lint:hooks');
chk('lint:hooks has --max-warnings 0 and the cache', s['lint:hooks'] === 'eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api');
for (const k of ['lint', 'lint:hooks']) chk(`${k} shell-neutral`, typeof s[k] === 'string' && !/["'$*;|<>%^`=\\]/.test(s[k]));
chk('other scripts unchanged', JSON.stringify({ ...s, lint: 0, 'lint:hooks': 0 }) === JSON.stringify({ ...old.scripts, lint: 0, 'lint:hooks': 0 }));
chk('dependencies unchanged', JSON.stringify([pj && pj.dependencies, pj && pj.devDependencies]) === JSON.stringify([old.dependencies, old.devDependencies]));
chk('exhaustive-deps still warn', cnt(E, "'react-hooks/exhaustive-deps': 'warn',") === 1);
chk('rules-of-hooks still error', cnt(E, "'react-hooks/rules-of-hooks': 'error',") === 1);
chk('adr0115 is T831 text plus the amendment', !!b831[8] && A15 === b831[8].new + '\n\n' + b[6].new + '\n');
chk('no 1624 left in AGENTS or README', !AG.includes('1624') && !RM.includes('1624'));
const i161 = RL.indexOf('## Phase 161 - FinanceContext hooks lint: T831-T832 (');
const i160 = RL.indexOf('## Phase 160 - ');
chk('refactor-log entry once, above Phase 160', cnt(RL, '## Phase 161 - ') === 1 && i161 >= 0 && i161 < i160);
const entry = i161 >= 0 && i160 > i161 ? RL.slice(i161, i160) : '';
chk('refactor-log brief starts ADR 0115', entry.includes('\n\nADR `0115`'));
for (const h of ['**Changed:**', '**Verified:**', '**Surprises:**', '**Deliberately not done:**']) chk(`refactor-log has ${h}`, cnt(entry, h) === 1);
chk('refactor-log entry ends with ---', entry.endsWith('\n\n---\n\n'));
const j161 = BM.indexOf('### Phase 161 - delta against Phase 159\n');
const j159 = BM.indexOf('### Phase 159 - delta against Phase 158');
chk('baseline section once, above Phase 159', cnt(BM, '### Phase 161 - ') === 1 && j161 >= 0 && j161 < j159);
const sec = j161 >= 0 && j159 > j161 ? BM.slice(j161, j159) : '';
for (const w of ['1625', '73 files', '213 tests in 37 files', '639 runs', 'npm run lint', '40906673300']) chk(`baseline names ${w}`, sec.includes(w));
chk('ledger T832 row once', L.split('\n').filter((l) => l.startsWith('| T832 |')).length === 1);
const iA = L.indexOf('## Phase 161 - ');
const iB = L.indexOf('| T831 |');
const iC = L.indexOf('| T832 |');
const iD = L.indexOf('## Backlog');
chk('ledger order', iA >= 0 && iA < iB && iB < iC && iC < iD);
console.log('bad', bad);
process.exit(bad ? 1 : 0);
```

**Gate 0: T831 has landed (builder, before any edit; the reviewer re-checks).**

```
git branch --show-current
git log --oneline -3
git log --oneline -1 -- src/context/FinanceContext.tsx unit/rerender-matrix.test.tsx docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md
grep -c '^| T831 |.*| done |' docs/audit/task-ledger.md
npx eslint --max-warnings 0 src api > ${D}T832-pre-hooks.log 2>&1; echo "pre-hooks exit=$?"
git status --porcelain
npm config get script-shell
```

Pass: the branch is `phase-161-finance-hooks-lint`; the third command names a T831 commit on the branch above `883a6a6`; the grep prints `1`; `pre-hooks exit=0` with no `problem` line in the log; the status lists nothing, or only untracked `workflow/stages/*/output/task-T832-*.md` files; `script-shell` prints `null` (record it). If any fails, stop with `BLOCKED: T831 has not landed` and edit nothing. The reviewer runs the first four commands and `script-shell` only (at review time the status holds T832's own changes, and `lint:hooks` is covered by gates 3 and 4).

**Gate 1: text landed.** `node $H text` prints `bad 0` and exits 0. Run it once before any edit as a control: it prints BAD lines (at least every `new once`).

**Gate 2: lint runtime, before and after.** Builder, after gate 0 and before Edit 1:

```
for i in 1 2 3; do s=$(date +%s%N); npm run lint > ${D}T832-time-before-$i.log 2>&1; e=$?; echo "before $i exit=$e ms=$(( ($(date +%s%N)-s)/1000000 ))"; done > ${D}T832-time-before.txt; cat ${D}T832-time-before.txt
```

After all edits, the same loop with `after` in place of `before` (three occurrences, file names included). Reviewer: the "after" loop, then `git stash push -- package.json` (it is `w/crlf`, so stashing is safe; never while Playwright runs), the "before" loop, `git stash pop --index`, and `git status --porcelain` identical to before the stash. Pass: every run `exit=0`; the median "after" minus the median "before" is at most 10,000 ms (expected about 3,000 to 6,000: a warm cached `eslint` took 2.8 to 3.6 s, section 4). The builder's first "after" run may be the cold one that creates `.cache/eslint/` (26.7 s cold in section 4's measurement); the median of three is then a warm run. Record all three "after" times, not only the median. Record both medians and the delta. CI baseline (read-only): `gh run view 40906673300 --json jobs --jq '.jobs[]|select(.name=="Type-check and unit tests")|.steps[]|select(.name=="Type-check (tsc --noEmit)")|[.startedAt,.completedAt]'` prints `2026-10-29T15:57:25Z` and `2026-10-29T15:57:33Z` (8 s); record it.

**Gate 3: `npm run lint`.** `npm run lint > ${D}T832-lint.log 2>&1; echo "lint exit=$?"` prints `lint exit=0`; the log contains `> eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api` and no line with `problem` or `react-hooks/`. This run is npm's `cmd.exe` shell; the PR's `checks` job is the `sh` run.

**Gate 4: an injected warning fails `npm run lint` (scratch copy, outside the repo).** After all edits, from the repo root, as one block. It copies the tracked and untracked, not ignored, files (so never `.env`, `dist/` or the logs) into a fresh temp dir, links `node_modules` with a directory junction, warms the ESLint cache with a clean run, writes the probe, and runs five cases. The copy skips ignored files, so it starts with no `.cache/`; the warm run creates `$S/.cache/eslint/`, inside the scratch dir, never the repo's. Never delete the scratch dir while the junction is in it: the `rmdir` removes the link only, and `rm -rf` runs only once the link is gone. If `mklink` fails, stop and report it; never copy or move `node_modules`.

```
R="$PWD"; S=$(mktemp -d); echo "S=$S"
git status --porcelain > ${D}T832-status-before.txt
git ls-files -z -co --exclude-standard | tar --null -T - -cf - | tar -xf - -C "$S"
test ! -e "$S/.cache" && echo cache-cold
MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$S/node_modules")" "$(cygpath -w "$R/node_modules")"
test -x "$S/node_modules/.bin/eslint" && echo junction-ok
(cd "$S" && npm run lint) > ${D}T832-probe-warm.log 2>&1; echo "warm exit=$?"
ls -A "$S/.cache/eslint/" > ${D}T832-probe-cache-files.txt; grep -q '^\.cache_' ${D}T832-probe-cache-files.txt && echo cache-warm
node $H probe "$S/src/t832-lint-probe.tsx"
(cd "$S" && npm run lint) > ${D}T832-probe-red.log 2>&1; echo "red exit=$?"
(cd "$S" && npm run lint) > ${D}T832-probe-red-cached.log 2>&1; echo "red cached exit=$?"
cp "$S/package.json" "$S/package.json.t832"
git show HEAD:package.json > "$S/package.json"
(cd "$S" && npm run lint) > ${D}T832-probe-old-lint.log 2>&1; echo "old lint exit=$?"
(cd "$S" && npm run lint:hooks) > ${D}T832-probe-old-hooks.log 2>&1; echo "old hooks exit=$?"
mv "$S/package.json.t832" "$S/package.json"
rm "$S/src/t832-lint-probe.tsx"
(cd "$S" && npm run lint) > ${D}T832-probe-green.log 2>&1; echo "green exit=$?"
MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$S/node_modules")"
test ! -e "$S/node_modules" && rm -rf "$S" && echo scratch-removed
test -x "$R/node_modules/.bin/eslint" && echo repo-node_modules-ok
git status --porcelain > ${D}T832-status-after.txt; cmp ${D}T832-status-before.txt ${D}T832-status-after.txt && echo status-unchanged
```

Pass, every line:

- `cache-cold`, `junction-ok`, `cache-warm`, `probe written ...`, `scratch-removed`, `repo-node_modules-ok` and `status-unchanged` print.
- `warm exit=0`, and `T832-probe-warm.log` contains `> eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api` and no line with `problem` or `react-hooks/`; `T832-probe-cache-files.txt` names one `.cache_` file (the warm cache every later case runs with).
- `red exit=1`, and `T832-probe-red.log` contains `t832-lint-probe.tsx`, `react-hooks/exhaustive-deps`, `1 problem (0 errors, 1 warning)` and `ESLint found too many warnings (maximum: 0).` ESLint is the last step, so reaching it shows both guards and both `tsc` runs passed with the probe in place, and the non-zero exit is ESLint's. The cache was warm, so a cache does not skip a new file.
- `red cached exit=1`, and `T832-probe-red-cached.log` contains the same four strings. The red run cached the probe's result, so this run reads it from the cache and still reports the warning: a cached run does not hide a warning that is in a file.
- `old lint exit=0`, and `T832-probe-old-lint.log` has no line with `eslint` or `react-hooks/` (the old `lint` never runs ESLint: the gap).
- `old hooks exit=0`, and `T832-probe-old-hooks.log` contains `1 problem (0 errors, 1 warning)` (the old `lint:hooks` reports the warning and still passes).
- `green exit=0`, and `T832-probe-green.log` contains `> eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api` and no line with `problem` or `react-hooks/` (still with the warm cache, the probe file gone).

Quote the six exit lines and the last four lines of the red and red-cached logs in the build report.

**Gate 5: full unit run.** `npm run test:unit > ${D}T832-unit.log 2>&1; echo "unit exit=$?"`: exit 0, `Test Files  73 passed (73)`, `Tests  1625 passed (1625)`. Any other count: stop with `BLOCKED` (Edits 3 and 5 and ADR 0115 state 1625).

**Gate 6: stated Playwright counts.** `npx playwright test --list > ${D}T832-list.log 2>&1; tail -1 ${D}T832-list.log` prints `Total: 639 tests in 37 files`; the same with `--project=chromium` (log `T832-list-chromium.log`) prints `Total: 213 tests in 37 files`. These match `AGENTS.md:11` and `README.md:161`.

**Gate 7: bundle figures.** `npm run clean > ${D}T832-build.log 2>&1 && npm run build >> ${D}T832-build.log 2>&1; echo "build exit=$?"`, then `node $H bundle > ${D}T832-bundle.txt; cat ${D}T832-bundle.txt`. Exit 0; record every figure for Edit 10. The repo's `.env` must be present for a comparable build (Vite reads it); never open, print or copy it. Builder only; the reviewer checks Edit 10's figures against the builder's `T832-bundle.txt` and may rebuild.

**Gate 8: diff shape.**

```
git diff --numstat HEAD -- package.json eslint.config.js AGENTS.md README.md docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md
git diff -U0 HEAD -- eslint.config.js
git diff --quiet HEAD -- package-lock.json && echo lock-unchanged
npm ls eslint eslint-plugin-react-hooks typescript-eslint --depth=0
```

Pass: `2 2 package.json`, `3 2 eslint.config.js`, `2 2 AGENTS.md`, `3 3 README.md`; ADR 0115, the refactor log and the baseline metrics with 0 deletions; every `+` and `-` content line of the `eslint.config.js` diff starts with `//` (comments only); `lock-unchanged`; `npm ls` shows `eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, `typescript-eslint@8.72.1`. No dependency changes, so no `npm ci` check is needed.

**Gate 9: no workflow, source or stage-file change; stated paths exist.**

```
git diff --stat HEAD -- .github/ vercel.json .claude/ src/ api/ unit/ tests/ supabase/ docs/contexts/ workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md
grep -n 'run: npm run lint$' .github/workflows/playwright.yml
git ls-files eslint.config.js package.json .github/workflows/playwright.yml unit/workflow-hardening.test.ts docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md
```

Pass: the first prints nothing; the grep prints `104:        run: npm run lint`; `git ls-files` lists all six paths (ADR 0115 is tracked once T831 is committed).

**Gate 10: no em dash, line endings kept.**

```
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" package.json eslint.config.js AGENTS.md README.md docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md workflow/stages/01_spec/output/task-T832-spec.md workflow/stages/02_build/output/task-T832-build.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');const crlf=s.split('\r\n').length-1;console.log(f,'crlf',crlf,'bareLF',s.split('\n').length-1-crlf)}" package.json eslint.config.js AGENTS.md README.md docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md docs/audit/baseline-metrics.md docs/audit/refactor-log.md docs/audit/task-ledger.md
```

Pass: `0` added em dashes; every listed file `0`; the first six files `bareLF 0`; `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` `crlf 0`.

**Gate 11: scope.** `git status --porcelain` lists as modified exactly `package.json`, `eslint.config.js`, `AGENTS.md`, `README.md`, `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` and `docs/audit/task-ledger.md`, and as untracked only `workflow/stages/01_spec/output/task-T832-spec.md`, `workflow/stages/02_build/output/task-T832-build.md` (and, for the reviewer, `workflow/stages/03_review/output/task-T832-review.md`). Logs, `dist/`, `.cache/` and the helper are gitignored.

**Gate 12: the ESLint cache stays out of git.** After gate 3 (which ran `npm run lint` in the repo):

```
test -d .cache/eslint && echo repo-cache-present
git check-ignore -v .cache/eslint/
git status --porcelain --ignored=no > ${D}T832-status-cache.txt; echo "cache entries=$(grep -c '\.cache' ${D}T832-status-cache.txt)"
git ls-files .cache
```

Pass: `repo-cache-present`; the check-ignore line names `.gitignore:62:.cache/`; `cache entries=0`; `git ls-files .cache` prints nothing. The builder deletes nothing it did not create: the `.cache/eslint/` that `npm run lint` creates is gitignored and may stay, and `.cache/bundle-stats.html` is never touched.

## 9. Production touch points

None. No migration, no live SQL, no `/api/*` request, no dependency, no `vercel.json` edit and no `.github/workflows/` edit: CI already runs `npm run lint` (`playwright.yml:104`) after an `npm ci` that installs ESLint, so the new script takes effect there with no workflow change. Gate 2's `gh run view` is a read. The pause after this spec comes from `AGENTS.md` being a target.

**For the owner, not planned:** the `checks` job's step at `.github/workflows/playwright.yml:102` stays named `Type-check (tsc --noEmit)` though it now also runs ESLint. Renaming it is a `.github/workflows/` edit (stop-and-ask and on the pause list) that changes no behaviour and no required check (those are job names, `unit/workflow-hardening.test.ts:106`). If the owner wants it, it is its own task with the `.github/workflows/` tier gate.

## 10. Out of scope

- Any `src/`, `api/`, `unit/`, `tests/` or `supabase/` file. In particular `FinanceContext.tsx` and the T831 test: T832 must not touch `src/`.
- `eslint.config.js`'s rules, severities, `files`, parser and `linterOptions`, and its line 14 comment: only Edit 2's header comment changes. No `error` severity, no new rule, no `--fix`, no cache flag beyond Edit 1's two (no `--cache-strategy`).
- `package.json` beyond the two script lines; `package-lock.json`.
- `.github/workflows/` (the step name included), `vercel.json`, `.claude/`, the stage `CONTEXT.md` files, `docs/contexts/*.md`, and `AGENTS.md`'s tier rows and every line but Edits 3 and 4.
- ADR 0113, and every line of ADR 0115 above the appended amendment, its Status line included.
- The three bare `// eslint-disable-next-line` sites (`DiaryView.tsx:48`, `TransactionsView.tsx:152`, `WalletsView.tsx:78`).
- A unit test that pins the scripts, and a pre-commit hook.
- Archiving finished phases out of `docs/audit/task-ledger.md` (178 lines, past its 150-line note); the Phase 161 intro line and the Commit cells (the deploy record's).
