# T827 spec: ESLint with react-hooks/exhaustive-deps as an opt-in script, and the two non-money warnings fixed

Phase 158, branch `phase-158-eslint-hooks` (cut from `main` at `5d993de`). T827 is the phase's only and last task: it ships the phase (the Phase 158 `refactor-log.md` entry and `baseline-metrics.md` section are its targets). Id T827 confirmed free: the ledger's highest is T826 and no `task-T827-spec.md` existed. The next free ADR is `0113` (the last in `docs/audit/decisions/` is `0112`).

The owner approved this design on 2026-10-29 and wants the phase auto-merged. No Target file below is on the pause list (AGENTS.md ICM section) and Production touch points is `none` apart from the recorded dependency approval (section 8). `package.json`, `package-lock.json`, `eslint.config.js` and `src/components/*` are code paths to the PR classifier (`unit/workflow-hardening.test.ts:183`), so the PR runs the full required checks.

## 1. Goal

`npm run lint:hooks` runs ESLint with only the two React hooks rules over `src/` and `api/` and prints what it finds; it is opt-in, not part of `npm run lint` or CI. The two non-money warnings it finds today (`Modal.tsx`, `OverflowMenu.tsx`) are fixed with no change in behaviour. The five warnings in `src/context/FinanceContext.tsx` (a money path) stay, untouched, as a later owner-merged phase.

## 2. Target files

```
docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md
package.json
package-lock.json
eslint.config.js
src/components/Modal.tsx
src/components/ui/OverflowMenu.tsx
README.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

- `docs/audit/task-ledger.md` is bookkeeping (always allowed), with the edits in section 2.8.
- The builder writes the ADR first, before any code (section 2.1).
- `eslint.config.js` is a new file at the repo root. It is not on the pause list and not in any `tsconfig` `include` (the root config includes `src`, `tests`, `unit`; `api/tsconfig.json` includes `api/**/*.ts` only), so `npm run lint` does not see it.
- **Not targets, must stay byte-identical:** `src/context/FinanceContext.tsx` (money path; not even a disable comment), `AGENTS.md`, `.github/workflows/`, `vercel.json`, `.claude/`, `index.html`, `vite.config.ts`, `docs/contexts/*.md`, `docs/audit/test-selector-contract.md`, `unit/`, `tests/`.

### 2.1 ADR `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md` (written first)

Same shape as `0112-opt-in-bundle-visualizer.md`: title `# 0113: opt-in ESLint for the React hooks rules`, `**Status:** Accepted. To be implemented in Phase 158 (T827)`, a line `The owner approved adding the dev dependencies eslint, eslint-plugin-react-hooks and typescript-eslint on 2026-10-29.`, `**Date:** 2026-10-29`, then `## Context`, `## Decision`, `## Consequences`, `## Not done`, `## Release`. Match the line endings of `0112` (`git ls-files --eol`: `w/crlf`). Content:

- **Context:** the repo has no linter beyond `tsc` and two small guards. The Backlog row "ESLint with `react-hooks/exhaustive-deps`" asked for it. A measured run (scratchpad install, 2026-10-29) over `src/` and `api/` gives 0 `rules-of-hooks` errors and 7 `exhaustive-deps` warnings in 3 files: `Modal.tsx:212`, `OverflowMenu.tsx:67`, and five in `FinanceContext.tsx` (`:881`, `:967`, `:1320`, `:1710`, `:2094`). Three more sites are already silenced by a bare `// eslint-disable-next-line` (`src/views/DiaryView.tsx:48`, `src/views/TransactionsView.tsx:152`, `src/views/WalletsView.tsx:78`); they were not audited and stay. Adding a dependency is on AGENTS.md's Stop and ask first list; the owner approved these three dev dependencies on 2026-10-29, and no other.
- **Decision:** (D1) exact pins `eslint` 9.39.5, `eslint-plugin-react-hooks` 7.1.1, `typescript-eslint` 8.72.1 (the versions the owner measured; `eslint` 9.39.5 is npm's `maintenance` tag and `10.13.0` is `latest`, not evaluated; `typescript-eslint` 8.72.1 peers `typescript >=4.8.4 <6.1.0`, the repo is `~5.8.2`; `eslint-plugin-react-hooks` 7.1.1 peers `eslint` up to `^10`; all three engines accept Node 24). (D2) A separate script, `"lint:hooks": "eslint src api"`, run by hand. It is not added to `npm run lint`, not added to CI, and `AGENTS.md`, `.github/workflows/`, `vercel.json` and `.claude/` are not edited. Exit codes, ESLint's own: 0 when there are only warnings or nothing, 1 when any error is reported (a `rules-of-hooks` error or a parse error), 2 on a configuration failure. No `--max-warnings`, so warnings never fail the script. (D3) Flat config `eslint.config.js`: `typescript-eslint`'s parser only (no type-aware rules, no `typescript-eslint` rule set), the `react-hooks` plugin registered by hand with exactly two rules, `exhaustive-deps` at `warn` and `rules-of-hooks` at `error`. The plugin's recommended preset and its React Compiler rules are not enabled: they would report on code that compiles and runs today. `reportUnusedDisableDirectives` is `off` so the three bare disables above raise nothing. (D4) `lint:hooks` is read-only: no `--fix`, no `--cache` (ESLint writes no file without them; `.gitignore:64` already lists `.eslintcache`). (D5) The two fixes, each behaviour-neutral: `Modal.tsx` reads `panelRef.current` once at effect setup instead of in the cleanup (the panel is one element for a whole open session, because `Presence` keeps one keyed child and mounts it in the first commit, `motion.tsx:30-40`; layout effects run after child refs attach, as the effect at `Modal.tsx:239` already relies on); `OverflowMenu.tsx` focuses `itemRefs.current[0]` directly instead of calling `focusItem(0)`, which `focusItem` does when there is at least one item and does nothing otherwise (with no item rendered every `itemRefs` slot is null, because React calls each old ref callback with null), so the effect depends on `isOpen` alone and cannot re-run on every render (adding `focusItem` to the deps would re-run it, and move focus, on every render while the menu is open). (D6) `FinanceContext.tsx` is a money path: its five warnings are left, and a new Backlog row schedules fixing them and wiring ESLint into `npm run lint` and CI (AGENTS.md Commands line and tier rows) as a later phase the owner merges.
- **Consequences:** three dev dependencies; the dry-run install adds 99 packages to the lockfile (`eslint`'s tree, `typescript-eslint`'s `@typescript-eslint/*` and `eslint-plugin-react-hooks`'s `@babel/*`); Vercel and CI `npm ci` fetch them though nothing there runs ESLint; `lint:hooks` ends with 5 warnings, all in `FinanceContext.tsx`, until the later phase; the default build does not contain ESLint (it is not imported by `src/` or `vite.config.ts`), though two small chunks change because `Modal.tsx` and `OverflowMenu.tsx` change.
- **Not done:** the five `FinanceContext.tsx` warnings; wiring into `npm run lint` or CI; `AGENTS.md` Commands and tier-row edits; the React Compiler rules or recommended preset; type-aware rules; `eslint` 10; the three bare disables; `--max-warnings`; an ESLint cache; any rule beyond the two.
- **Release:** one PR, no migration, no production touch; expected to take the auto-merge path (no pause-list path).

### 2.2 `package.json` and the lockfile

Run, from the repo root, `npm install --save-dev --save-exact eslint@9.39.5 eslint-plugin-react-hooks@7.1.1 typescript-eslint@8.72.1`. A dry-run of that command on 2026-10-29 reported `added 99 packages, and changed 1 package` (the changed one is `esbuild`, `0.25.12 => 0.25.12`, flags only). It must change `package.json` by exactly the three devDependency lines below and `package-lock.json` by additions only (plus at most the `esbuild` flag lines); no version change to any existing package. Then add the script by hand.

**Landed in package.json, the eslint devDependencies (sit between `"@vitejs/plugin-react": "^5.0.4",` and `"jsdom": "^30.1.1",`):**

```text
    "eslint": "9.39.5",
    "eslint-plugin-react-hooks": "7.1.1",
```

**Landed in package.json, the typescript-eslint devDependency (sits between `"typescript": "~5.8.2",` and `"vite": "^6.4.0",`):**

```text
    "typescript-eslint": "8.72.1",
```

**Landed in package.json, the lint:hooks script (insert on the line after the `"lint": ...` line):**

```text
    "lint:hooks": "eslint src api",
```

Do not touch `"allowScripts"`. The dry-run shows no install-script package among the additions; if `npm install` reports a blocked script for a new package, stop and report it.

### 2.3 `eslint.config.js` (new)

ESM (`package.json` has `"type": "module"`). Same line endings as `vite.config.ts` (`w/crlf`). This content was run in a scratchpad install against `src` and `api` on 2026-10-29 (as `eslint.config.mjs`, identical body) and produced the 7 warnings above, exit 0.

**Landed in eslint.config.js, the whole file:**

```text
// ADR 0113: `npm run lint:hooks` runs only the two React hooks rules over src/
// and api/. Opt-in: not part of `npm run lint` or CI. Warnings do not fail it.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    // Three older sites carry a bare `// eslint-disable-next-line`; leave them be.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
```

### 2.4 `src/components/Modal.tsx`: read the panel once, at setup

Edit only the first `useLayoutEffect` (the focus-return effect, `Modal.tsx:203-220`). Two edits.

**Old text in src/components/Modal.tsx, edit 1:**

```text
    const token = stackToken.current;
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
```

**Landed in src/components/Modal.tsx, edit 1 (New text):**

```text
    const token = stackToken.current;
    // ADR 0113: the panel this open session mounted. Presence keeps one panel
    // for the whole session, so it is the element the cleanup would read.
    const panel = panelRef.current;
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
```

**Old text in src/components/Modal.tsx, edit 2:**

```text
      focusInside.current = active instanceof HTMLElement && panelRef.current?.contains(active) ? active : null;
```

**Landed in src/components/Modal.tsx, edit 2 (New text):**

```text
      focusInside.current = active instanceof HTMLElement && panel?.contains(active) ? active : null;
```

Nothing else in the file changes: not the dependency arrays, not the other six `useLayoutEffect`s (their `panelRef.current` reads at `:243` and `:268` are in effect bodies, which the rule accepts), not the comments above.

### 2.5 `src/components/ui/OverflowMenu.tsx`: focus the first item without `focusItem`

**Old text in src/components/ui/OverflowMenu.tsx:**

```text
  // Focus the first item once the menu is in the DOM.
  useEffect(() => {
    if (isOpen) focusItem(0);
  }, [isOpen]);
```

**Landed in src/components/ui/OverflowMenu.tsx, New text:**

```text
  // Focus the first item once the menu is in the DOM. Reads the ref directly,
  // not focusItem, so the effect depends on isOpen alone and runs once per open.
  useEffect(() => {
    if (isOpen) itemRefs.current[0]?.focus();
  }, [isOpen]);
```

Do not change `focusItem`, the arrow-key handlers, or the dependency array. Do not add `focusItem` to the array and do not wrap it in `useCallback`: either re-runs or reshapes the effect.

### 2.6 `README.md`: one line

Insert it in the `## Testing` code block, on the line directly after the `npm run lint ` line (keep the comment column).

**Landed in README.md, the lint:hooks mention:**

```text
npm run lint:hooks   # opt-in ESLint: react-hooks rules on src/ and api/; warnings do not fail it; not part of lint or CI
```

### 2.7 Closing docs (this task ships the phase)

- `docs/audit/refactor-log.md`: one entry at the top, newest first (above Phase 157), headed `## Phase 158 - Opt-in ESLint for the React hooks rules: T827 (2026-10-29, code <sha or "pending the deploy record">, merged <same>)`, in the file's required shape (`ADR \`0113\`.` line, then `**Changed:**`, `**Verified:**`, `**Surprises:**`, `**Deliberately not done:**`). Surprises: record anything real (for example the three bare `eslint-disable-next-line` sites that hide warnings, `eslint` 10 being `latest` while 9.39.5 is the `maintenance` tag, or the ledger passing 150 lines); "none" only if nothing surprised. Deliberately not done: the ADR's Not done list.
- `docs/audit/baseline-metrics.md`: a section `### Phase 158 - delta against Phase 156` at the top of "Figures" (above Phase 156), following Phase 156's wording. Figures, each from a gate: the default build before any change and after install and config (gate 3: identical), and after the two fixes (gate 6: file count, which files changed, entry chunk and all-app-JS raw and gzip bytes before and after, CSS unchanged); **Dev dependencies 18 to 21**; runtime dependencies unchanged at 7; lockfile added lines (`git diff --numstat package-lock.json`) and 99 packages added from `npm install`'s own output; `lint:hooks` warnings 7 to 5, errors 0 to 0; Vitest 72 files, 1606 tests (0 delta) with the full-run time; Playwright unchanged at 213 tests / 37 files / 639 runs, with the runs and time of gate 11's selected specs. Do not write a count the gates did not produce.

### 2.8 `docs/audit/task-ledger.md` (bookkeeping, builder-kept)

1. Add a section `## Phase 158 - Opt-in ESLint for the React hooks rules (ADR 0113)` after the Phase 157 table and before `## Backlog`, in the file's table shape, with one row `| T827 | ESLint as an opt-in devDependency: ADR 0113, eslint.config.js and lint:hooks, Modal and OverflowMenu warnings fixed, README line, Phase 158 closing docs | <the paths the build changed> | in-progress then done | | <gate result> |` (Commit empty, per the ledger header). The Branch line is:

**Landed in docs/audit/task-ledger.md, the Branch line:**

```text
Branch `phase-158-eslint-hooks`, cut from `main` at `5d993de`. One task, T827. Dev dependencies `eslint` 9.39.5, `eslint-plugin-react-hooks` 7.1.1 and `typescript-eslint` 8.72.1 added with the owner's approval of 2026-10-29. No migration.
```

2. The existing Backlog row "ESLint with `react-hooks/exhaustive-deps`" becomes:

**Landed in docs/audit/task-ledger.md, the partly-done Backlog row:**

```text
| ESLint with `react-hooks/exhaustive-deps` | `archive/constraints-to-promote.md` follow-on proposals | partly done in Phase 158 (T827): `npm run lint:hooks` is opt-in and the `Modal.tsx` and `OverflowMenu.tsx` warnings are fixed; the rest is the next row |
```

3. Add this new Backlog row directly after it:

**Landed in docs/audit/task-ledger.md, the new Backlog row:**

```text
| Fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094) and wire ESLint into `npm run lint` and CI, including AGENTS.md's Commands line and the tier rows; a money-path phase, merged by the owner | Phase 158, T827's spec | todo |
```

4. Backlog rows keep the ledger's table format. The ledger is 150 lines today and the new section plus row add about 8; do not archive anything (out of scope). Report the final line count in the build report and note it in Surprises.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` alone (components, accessibility, modals, Playwright): the change touches `Modal.tsx` and `OverflowMenu.tsx`. Not needed: `client-state.md` (the diff touches no state, selector or money rule).
- `docs/audit/decisions/0112-opt-in-bundle-visualizer.md` for the ADR shape and `docs/audit/baseline-metrics.md`'s Phase 156 section for the figures wording. The Modal effects are explained in ADRs 0043, 0047, 0058, 0059 and 0089 (cited in the file's comments); read them only if a gate fails.

## 4. Current behaviour

- No ESLint: `package.json:10-26` scripts are `tsc` plus two guard scripts; `devDependencies` has 18 entries, `dependencies` 7; no `eslint.config.*` exists.
- `npm run lint` (`package.json:14`) is `check:node-globals && check:safe-ids && tsc --noEmit && tsc -p api/tsconfig.json`. Nothing here changes it.
- Measured, scratchpad install of the three pinned packages with the config in 2.3, run over `src api`: 0 errors, 7 warnings, exit 0:
  - `src/components/Modal.tsx:212:71`: the ref value `panelRef.current` read in the first layout effect's cleanup (`Modal.tsx:210-219`).
  - `src/components/ui/OverflowMenu.tsx:67:6`: `useEffect(() => { if (isOpen) focusItem(0); }, [isOpen])` misses `focusItem` (`OverflowMenu.tsx:53-57`, a new function every render).
  - `src/context/FinanceContext.tsx`: `:881`, `:967`, `:1320` (`useCallback` missing `setDiaryEntries`, `setKeywordRules`, `setPresets` or a subset), `:1710` (`keywordRulesRef`), `:2094` (`presetsRef`).
- Behaviour the fixes must keep. `Modal.tsx`: while open, the effect at `:203` records the opener at setup and in cleanup stores the control that held focus inside the panel (`focusInside`), releases the stack and returns focus to the opener. `Presence` (`motion.tsx:27-60`) mounts the child in the same commit that `isOpen` turns true and keeps the same keyed element until the 200 ms exit ends, so the panel element is the same at setup and at cleanup (closing, unmounting, StrictMode's simulated unmount/remount: in each, the Modal's own layout cleanup runs before React detaches the child's ref). `OverflowMenu.tsx`: opening focuses the first item; `focusItem(0)` is `itemRefs.current[0]?.focus()` for a non-empty list.
- Existing coverage: `unit/modal-focus.test.tsx`, `unit/modal-history.test.tsx`, `unit/ui-controls.test.tsx`, `unit/dialog-names.test.tsx` (unit, run in `npm run test:unit`); Playwright below.
- Menu users (`OverflowMenu`): `DebtCard.tsx:69`, `DiaryEntryRow.tsx:43`, `TransactionsTable.tsx:271`, `WalletDetail.tsx:171`, `TransactionsView.tsx:654` (`#tx-import-export-btn`). Contract ids: `#debt-menu-btn-*`, `#diary-menu-btn-*`, `#tx-menu-btn-*`, `#wallet-detail-menu-btn`, `#tx-import-export-btn` (`docs/audit/test-selector-contract.md:35,37,51,58,62,96`).
- Three bare `// eslint-disable-next-line` comments exist (`src/views/DiaryView.tsx:48`, `src/views/TransactionsView.tsx:152`, `src/views/WalletsView.tsx:78`). Out of scope.
- `.gitignore:64` lists `.eslintcache`. `dist/` currently contains no occurrence of "eslint".
- The ledger is 150 lines; `docs/audit/README.md:40` says to archive "past about 150".

## 5. Parity map

None. No row of AGENTS.md's cross-file parity map covers these files.

## 6. Tests to add

None, deliberately. Both fixes are behaviour-neutral refactors of two effects, so the proof is the existing suite plus the specs in gate 11, not a new assertion that would also pass today. The red-to-green evidence for the change itself is the `lint:hooks` count (gate 4: 7 warnings before the fixes, 5 after, with the exact list). A unit test that shells out to ESLint would add a test file and move the test counts AGENTS.md and README.md state (AGENTS.md is on the pause list, which would defeat the auto-merge). Stage 02 step 4 and stage 03 step 6 (red run) do not apply; the reviewer repeats gates 1 to 13 instead. This is not a money path (no ledger, context, selector or `api/` file changes).

## 7. Gates

Work in order. Save logs under `workflow/stages/02_build/output/logs/` (gitignored). Check ports 3000 and 3100 for stale dev servers before gate 11; do not edit `src/` while Playwright runs.

1. **Text landed**, reading the expected text from this spec's fenced blocks (never retyped). The 11 blocks under a `**Landed in <file>, ...:**` label (package.json x3, eslint.config.js x1, Modal.tsx x2, OverflowMenu.tsx x1, README.md x1, task-ledger.md x3) must each be found exactly once in their file, line endings normalised. Run it from the repo root after all edits; run it once before the edits as a control (expect exit 1):

   ```
   node -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8').split(String.fromCharCode(96).repeat(3));let bad=0,n=0;for(let i=1;i<t.length;i+=2){const l=t[i-1].trim().split('\n').pop();if(!l.startsWith('**Landed in '))continue;const f=l.slice(12).split(',')[0];const b=t[i].split('\n').slice(1,-1).join('\n');if(!fs.existsSync(f)){n++;bad++;console.log(f,'missing');continue}const c=fs.readFileSync(f,'utf8').split('\r\n').join('\n');const k=c.split(b).length-1;n++;console.log(f,k);if(k!==1)bad++}console.log('blocks',n,'bad',bad);process.exit(bad||n!==11?1:0)" workflow/stages/01_spec/output/task-T827-spec.md
   ```

   Expect `blocks 11 bad 0`, exit 0. Also confirm the three `Old text` replacements are gone: `git diff -U0 src/components/Modal.tsx src/components/ui/OverflowMenu.tsx` shows exactly 2 hunks in `Modal.tsx` (4 added lines, 1 changed line: 3 added by edit 1 and the edit 2 line replaced; so `+4 -1` in total) and 1 hunk in `OverflowMenu.tsx` (`+3 -2` in total: the comment line replaced by two, the `focusItem(0)` line replaced). Report the actual `--numstat`.

2. **Baseline build, before any edit** (clean tree except the ADR if already written; before touching `package.json`, the lockfile, `eslint.config.js` or `src/`):

   ```
   npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T827-build-before.log
   node -e "const fs=require('fs'),p=require('path');const w=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?w(p.join(d,e.name)):[p.join(d,e.name)]);console.log(w('dist').map(f=>f.split(p.sep).join('/')+' '+fs.statSync(f).size).sort().join('\n'))" > workflow/stages/02_build/output/logs/T827-dist-before.txt
   ```

   Expect exit 0 and a file list. Record the entry chunk, all app JS (raw and gzip level 9) and CSS figures as Phase 156's section does (the local `.env` should reproduce `index-CsN9mAj5.js` 198,233 B, all app JS 910,982 B in 39 files, `index-BNwLrid8.css` 54,969 B; if not, say so, and the before/after pair is the binding comparison).

3. **Dependencies and config do not reach the bundle** (after the install in 2.2, the script, `eslint.config.js` and the ADR are in, and `src/` is still untouched):

   ```
   npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T827-build-config.log
   node -e "<the same snapshot one-liner as gate 2>" > workflow/stages/02_build/output/logs/T827-dist-config.txt
   diff workflow/stages/02_build/output/logs/T827-dist-before.txt workflow/stages/02_build/output/logs/T827-dist-config.txt
   ```

   Expect exit 0 and an empty `diff` (names with hashes and sizes identical, `sw.js` included).

4. **`lint:hooks` count and list.** Run `npm run lint:hooks -- -f json -o <log>.json` with `<log>` = `workflow/stages/02_build/output/logs/T827-hooks-before.json` after the config exists and **before** the two fixes, and `T827-hooks-after.json` after them. Check each with:

   ```
   node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const m=r.flatMap(f=>f.messages.map(x=>require('path').basename(f.filePath)+':'+x.line+':'+x.ruleId+':'+x.severity)).sort();const want=process.argv[2].split(',').sort();console.log(m.join(' '));console.log('warnings',r.reduce((a,f)=>a+f.warningCount,0),'errors',r.reduce((a,f)=>a+f.errorCount,0));const ok=JSON.stringify(m)===JSON.stringify(want);console.log('match',ok);process.exit(ok?0:1)" <log>.json "<expected list>"
   ```

   - Before the fixes, expected list `Modal.tsx:212:react-hooks/exhaustive-deps:1,OverflowMenu.tsx:67:react-hooks/exhaustive-deps:1,FinanceContext.tsx:881:react-hooks/exhaustive-deps:1,FinanceContext.tsx:967:react-hooks/exhaustive-deps:1,FinanceContext.tsx:1320:react-hooks/exhaustive-deps:1,FinanceContext.tsx:1710:react-hooks/exhaustive-deps:1,FinanceContext.tsx:2094:react-hooks/exhaustive-deps:1`: `warnings 7 errors 0`, `match true`. The `npm run lint:hooks` command's exit code is 0 (run it once without `-f json -o` and note the exit code; warnings never fail it).
   - After the fixes, expected list `FinanceContext.tsx:881:react-hooks/exhaustive-deps:1,FinanceContext.tsx:967:react-hooks/exhaustive-deps:1,FinanceContext.tsx:1320:react-hooks/exhaustive-deps:1,FinanceContext.tsx:1710:react-hooks/exhaustive-deps:1,FinanceContext.tsx:2094:react-hooks/exhaustive-deps:1`: `warnings 5 errors 0`, `match true`, exit code of `npm run lint:hooks` 0. The line numbers are valid only because `FinanceContext.tsx` is untouched (gate 5).

5. **Money path untouched and no pause-list path.**

   ```
   git diff --quiet HEAD -- src/context/FinanceContext.tsx; echo "FinanceContext diff exit $?"
   git diff --name-only HEAD | grep -E '^(src/context/FinanceContext\.tsx|src/selectors/|supabase/|api/|\.claude/|\.github/|AGENTS\.md|vercel\.json|workflow/stages/[^/]+/CONTEXT\.md)' ; echo "pause-list grep exit $?"
   git status --porcelain | grep -E ' (src/context/FinanceContext\.tsx|src/selectors/|supabase/|api/|\.claude/|\.github/|AGENTS\.md|vercel\.json|workflow/stages/[^/]+/CONTEXT\.md)'; echo "pause-list status grep exit $?"
   ```

   Expect `FinanceContext diff exit 0`, and both greps print nothing with exit 1. Also `grep -c "eslint-disable" src/context/FinanceContext.tsx` prints 0.

6. **Default build after the fixes:**

   ```
   npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T827-build-after.log
   node -e "<the same snapshot one-liner as gate 2>" > workflow/stages/02_build/output/logs/T827-dist-after.txt
   diff workflow/stages/02_build/output/logs/T827-dist-before.txt workflow/stages/02_build/output/logs/T827-dist-after.txt
   grep -rli "eslint" dist; echo "dist eslint grep exit $?"
   ```

   Expect exit 0; the file count equals gate 2's (same number of lines in both snapshots); `grep -rli eslint dist` prints nothing, exit 1 (the production bundle does not gain eslint); the `diff` is limited to the chunk(s) that contain `Modal` or `OverflowMenu` and the chunks, `index.html`, `sw.js` and manifest lines that name them by hash (all other lines identical); the CSS line is identical. Report the changed lines and the entry chunk and all-app-JS byte deltas (expected: a few bytes). A new or removed file, or a changed `.css`, is a blocker.

7. **Install consistency** (offline-safe, writes nothing):

   ```
   npm ci --dry-run
   npm ls eslint eslint-plugin-react-hooks typescript-eslint
   npm ls --omit=dev eslint
   npm ls --all 2>&1 | grep -iE "invalid|missing|ERR"
   node -e "const p=require('./package.json');console.log('dev',Object.keys(p.devDependencies).length,'runtime',Object.keys(p.dependencies).length)"
   ```

   Expect: `npm ci --dry-run` exit 0 with no "out of sync" error; `npm ls` prints `eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, `typescript-eslint@8.72.1`; `npm ls --omit=dev eslint` prints `(empty)` (a non-zero exit with `(empty)` is the expected result); the `grep` prints nothing; `dev 21 runtime 7`. Also `git diff --numstat package-lock.json`: deletions 0 or a handful of flag-only lines for `esbuild`, no removed version line. Report the lockfile's added line count and the number of packages added (99 expected).

8. **`lint:hooks` changes no file.** `git status --porcelain > <before>`; `npm run lint:hooks`; `git status --porcelain > <after>`; the two files are identical, and `ls .eslintcache` reports missing. No `--fix`, no `--cache` appears in the `lint:hooks` script.

9. **Lint:** `npm run lint` exits 0, output saved to `workflow/stages/02_build/output/logs/T827-lint.log`. It does not run ESLint (grep the script: `package.json`'s `lint` line does not contain `eslint` or `lint:hooks`).

10. **Unit:** `npx vitest run unit/modal-focus.test.tsx unit/modal-history.test.tsx unit/ui-controls.test.tsx unit/dialog-names.test.tsx` passes; then `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T827-unit.log`: 72 files, 1606 tests passed (0 delta; no test is added).

11. **Playwright** (`src/components` tier row). Check ports 3000 and 3100 are free first. The affected specs: the `Modal` users (Escape, Tab trap, inert, Back closes, focus return) and the `OverflowMenu` users. These are `tests/account-and-mobile-nav.spec.ts`, `tests/categories-page.spec.ts`, `tests/debts-page.spec.ts`, `tests/diary-page.spec.ts`, `tests/ios-field-zoom.spec.ts`, `tests/reduced-motion.spec.ts`, `tests/routing.spec.ts`, `tests/soft-delete.spec.ts`, `tests/tab-preload.spec.ts`, `tests/transactions-views.spec.ts`, `tests/wallets-page.spec.ts`:

    ```
    npx playwright test tests/account-and-mobile-nav.spec.ts tests/categories-page.spec.ts tests/debts-page.spec.ts tests/diary-page.spec.ts tests/ios-field-zoom.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/soft-delete.spec.ts tests/tab-preload.spec.ts tests/transactions-views.spec.ts tests/wallets-page.spec.ts --project=chromium 2>&1 | tee workflow/stages/02_build/output/logs/T827-pw-chromium.log
    npx playwright test tests/account-and-mobile-nav.spec.ts tests/categories-page.spec.ts tests/debts-page.spec.ts tests/diary-page.spec.ts tests/ios-field-zoom.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/soft-delete.spec.ts tests/tab-preload.spec.ts tests/transactions-views.spec.ts tests/wallets-page.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T827-pw-all.log
    ```

    Both must pass with no failure. Report the passed counts and times. A failure is a blocker: do not retry around it, and do not widen the fix; report. The full 213-test suite is not rerun (the diff changes two effects, covered by these 11 specs); CI runs the full suite on the PR.

12. **Docs and housekeeping:**
    - The Phase 158 baseline-metrics figures equal what gates 2, 3, 4, 6, 7 and 10 printed (the reviewer recomputes them).
    - `git ls-files --eol` on every changed tracked file shows `w/crlf` unchanged from its `i/` side; the new files (`eslint.config.js`, the ADR) show `w/crlf`, matching their neighbours.
    - Em dashes: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md eslint.config.js README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md src/components/Modal.tsx src/components/ui/OverflowMenu.tsx` and the added-lines count from `workflow/stages/01_spec/CONTEXT.md`'s one-liner: 0 new in all (pre-existing ones, if any, are unchanged).
    - Every path and number the ADR and the closing docs state (99 packages, `.gitignore:64`, the three bare-disable lines, `motion.tsx:30-40`, the version peers, the ledger line count) is re-checked against the code or `npm view` before it is written.

13. **Diff shape and scope.** `git status --porcelain` and `git diff --stat` list only: the nine Target files, `docs/audit/task-ledger.md`, and the task's three stage-output files (`task-T827-spec.md`, `-build.md`, `-review.md`); no untracked file other than the ADR, `eslint.config.js` and those outputs. `git diff -U0 package.json` has exactly 3 hunks (the two devDependency groups and the script) and 0 deleted lines.

## 8. Production touch points

- **Dependency approval (recorded):** the owner explicitly approved adding the three devDependencies `eslint` (pinned `9.39.5`), `eslint-plugin-react-hooks` (`7.1.1`) and `typescript-eslint` (`8.72.1`) in this session, 2026-10-29, which AGENTS.md lists under Stop and ask first ("adding a dependency"). That approval covers these three packages and their transitive tree only; no other dependency may be added.
- `npm install` reads the public npm registry. Nothing else: no SQL, no migration, no `/api/*` request, no deploy or env change, no MCP or CLI write, no `vercel.json`, `.github/workflows/`, `.claude/` or `AGENTS.md` edit, no commit or push by the builder. The orchestrator commits and opens the PR by the Release bullet. This section lists nothing on the pause list, and neither do the Target files, so the phase is eligible for `gh pr merge <n> --auto --merge`; `package-lock.json`, `eslint.config.js` and `src/components/*` are outside `docs/`, `anti-slop/` and `*.md`, so the PR is a code PR and runs the seven required checks.

## 9. Out of scope

- `src/context/FinanceContext.tsx`: the five warnings stay, with no edit and no disable comment; they are the new Backlog row.
- Wiring ESLint into `npm run lint`, CI, `AGENTS.md` (Commands line, tier rows), `.github/workflows/`, `vercel.json`, `.claude/`.
- The three bare `eslint-disable-next-line` comments, and any other rule, preset, type-aware config or the React Compiler rules.
- `eslint` 10, `--max-warnings`, `--fix`, `--cache`, a `lint:hooks` unit test, any other dependency.
- Any change to `Modal.tsx` or `OverflowMenu.tsx` beyond the three edits above (no dependency-array change, no `useCallback`, no new `ref`, no comment rewrite).
- `unit/`, `tests/`, `docs/contexts/*.md`, `docs/audit/test-selector-contract.md` (no id changes), archiving ledger or metrics rows.
