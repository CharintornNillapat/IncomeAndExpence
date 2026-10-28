# T824 spec: a typography or spacing token change runs the layout specs

Phase 155, branch `phase-155-rule-candidates` (cut from `main` at `56f0dd3`). Docs only, on purpose. T824 is the phase's last task: it ships the phase (the Phase 155 `refactor-log.md` entry covers T823 and T824). Id T824 is free: no ledger row and no `workflow/stages/01_spec/output/task-T*-spec.md` names it. Source: Backlog row `docs/audit/task-ledger.md:105`.

## 1. Goal

When a task changes a type size, line height, font or spacing token in `src/index.css`, its gates also run `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts`, not only the specs that name the component. `AGENTS.md` carries the rule in its `src/index.css` tier row; `docs/contexts/ui-and-e2e.md` carries the detail (which tokens, what the two specs check, why).

## 2. Target files

```
AGENTS.md
docs/contexts/ui-and-e2e.md
docs/audit/refactor-log.md
```

- `docs/audit/task-ledger.md` is bookkeeping (always allowed), with three edits, section 2.4.
- `docs/audit/baseline-metrics.md` is **not** a target: this phase changes no bundle and no test count (section 4.6). Leave it byte-identical.
- No other file. Every changed path must be under `docs/` or end in `.md`, so the phase PR stays docs-only (section 8).

### 2.1 `AGENTS.md`: one line, the tier row at line 86

Replace this line (the whole line, exactly once):

```agents-old
| `src/components/`, `src/views/`, `src/index.css`, `App.tsx` | `npm run lint`; `npm run test:unit`; the affected spec(s) with `--project=chromium`, then without a project filter |
```

with this line:

```agents-row
| `src/components/`, `src/views/`, `src/index.css`, `App.tsx` | `npm run lint`; `npm run test:unit`; the affected spec(s) with `--project=chromium`, then without a project filter. A type size, line height, font or spacing token in `src/index.css` makes `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts` affected specs |
```

Why this wording: it adds no row and no new command. "Affected specs" already carries the chromium-then-all-browsers order in this row and the "Before calling a task done" paragraph at `AGENTS.md:93`, so the two layout specs inherit both. Nothing else in `AGENTS.md` changes; line 11's counts stay as they are.

### 2.2 `docs/contexts/ui-and-e2e.md`: one new bullet

Insert this bullet as a new line directly after line 10 (the bullet that starts `- **One face, IBM Plex Sans Thai,**`) and before line 11 (`- **Buttons are ...`), in the `## Styling and type` section:

```ui-bullet
- **A type size, line height, font or spacing token change runs the two layout specs,** `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts`, as well as the specs that name the component (`AGENTS.md`, the `src/index.css` tier row). The tokens: `@theme`'s `--text-*` sizes with their `--text-*--line-height` and `--font-*`, any `--leading-*` or `--spacing*` value added there, the iOS `--text-xs`/`--text-sm` override in `@layer base`, and the metric overrides of the `IBM Plex Sans Thai Fallback` faces. Both specs measure the whole page: `safe-area` scrolls a 390 by 844 page to its end and needs the footer clear of the mobile nav, and keeps the header, `main` and the footer inside the landscape side insets with no sideways scroll; `layout-stability` keeps the footer below the fold on short pages and the Dashboard's cold-load layout shift under 0.001. Their inset and layout-shift tests run on Chromium only. Why: T769's `--text-hero` line height of 1.1 (48.4 px) passed its targeted specs and failed `safe-area.spec.ts` in CI, because a fractional line box makes the page fractionally tall; T774 set it to a whole 48px.
```

No other line of this file changes (line 67's counts stay).

### 2.3 `docs/audit/refactor-log.md`: the Phase 155 entry

Insert after line 20 (the `---` under the template block) and before the Phase 154 heading at line 22: a blank line, the entry below, a blank line, `---`, a blank line, so the file keeps its `---` separators. Write it in this shape (CRLF, no em dash); fill the angle-bracket parts:

```
## Phase 155 - Rule candidates from Phase 137: T823-T824 (<build date, YYYY-MM-DD>, docs `<sha>`, merged `<sha>`)

No ADR (two rule candidates from Phase 137 enter the rule files; docs only). <one sentence for T823, from its ledger row>. A type size, line height, font or spacing token change in `src/index.css` now runs `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts` too (T824). The PR is docs-only on purpose: its required checks are the first live run of ADR 0111's docs-only path.

**Changed:** T823 (<files and what changed, from T823's ledger row and `git show --stat` of its commit on this branch>). T824 (`AGENTS.md`: the `src/index.css` tier row makes the two layout specs affected specs for a type size, line height, font or spacing token; `docs/contexts/ui-and-e2e.md`: a Styling and type bullet naming the tokens, what the two specs check, and the T774 reason; `docs/audit/task-ledger.md`: the T824 row and Backlog row set done; this file).
**Verified:** T823: <its ledger Gate result>. T824: <your gate results, section 7>.
**Surprises:** the rule was already practised once before it was written: ADR 0103 (T793) ran both layout specs on a token move with no size change (`docs/audit/decisions/0103-paper-ledger-light-theme.md:103`). <add T823's, or nothing more>
**Deliberately not done:** <T823's items, from its build report>; for T824: a separate tier row (the existing row's affected specs carry it); radius, shadow and colour tokens (they change no line box; colour has `node scripts/wcag-tokens.mjs`); any edit of the two specs, `src/index.css`, `DESIGN.md` or ADR 0103; a Playwright or unit run (no code, test or config file changed); a `baseline-metrics.md` section (unit 1606 tests in 72 files, Playwright 213 tests in 37 specs and 639 runs, and the bundle are unchanged); the `<sha>` placeholders in this heading and the `Commit` cells, left to the post-merge deploy record.
```

- The builder takes T823's parts from T823's ledger row, its commit, and `workflow/stages/02_build/output/task-T823-build.md` (read only; never list a `workflow/stages/*/output/` file under Changed). If T823's ledger row is absent when T824 is built, stop with `BLOCKED`: the entry cannot cover it.
- Leave every `<sha>` as the literal text `<sha>`, as Phase 154 did before its deploy record. No `**Release:**` paragraph: the deploy record adds it after the merge.

### 2.4 `docs/audit/task-ledger.md` (bookkeeping)

1. The section `## Phase 155 - Rule candidates from Phase 137 (docs only, no ADR)` above `## Backlog` is T823's. If it is absent, create it from the template at the end of the file, with this branch line under the heading: ``Branch `phase-155-rule-candidates`, cut from `main` at `56f0dd3`. Docs only, no migration.``
2. Append the T824 row after T823's row in that section (Status `in-progress`, then `done` with the gate result; `Commit` empty). Task cell: `Rule: a type size, line height, font or spacing token in src/index.css makes tests/safe-area.spec.ts and tests/layout-stability.spec.ts affected specs (AGENTS.md tier row, ui-and-e2e.md bullet); Phase 155 closing docs`. Files cell: `` `AGENTS.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` ``.
3. Backlog row 105: change only its Status cell, from `todo` to `done in Phase 155 (T824)`. The row before:

```backlog-old
| Any change to a typography or spacing token (`src/index.css` `@theme` sizes, line heights, spacing) runs the layout specs (`tests/safe-area.spec.ts`, `tests/layout-stability.spec.ts`), not only the specs that name the component; rule candidate for `AGENTS.md`'s tier row for `src/index.css`, and for `docs/contexts/ui-and-e2e.md` | Phase 137, T774: T769's `--text-hero` line height of 1.1 (48.4px) passed its gates and failed `safe-area.spec.ts` in CI | todo |
```

and after:

```backlog-row
| Any change to a typography or spacing token (`src/index.css` `@theme` sizes, line heights, spacing) runs the layout specs (`tests/safe-area.spec.ts`, `tests/layout-stability.spec.ts`), not only the specs that name the component; rule candidate for `AGENTS.md`'s tier row for `src/index.css`, and for `docs/contexts/ui-and-e2e.md` | Phase 137, T774: T769's `--text-hero` line height of 1.1 (48.4px) passed its gates and failed `safe-area.spec.ts` in CI | done in Phase 155 (T824) |
```

Do not touch Backlog row 104 (T823's) or any other row.

All four files are CRLF in the working tree (`git ls-files --eol`: `w/crlf`); keep CRLF and add no bare LF.

## 3. Context to read

None. Docs-only task; every fact the new text states is cited in section 4, and the builder must not open `docs/audit/archive/`.

## 4. Current behaviour

1. **The tier row.** `AGENTS.md:86` gives `src/index.css` the same gates as a component: lint, unit, and "the affected spec(s)". Nothing says a token's affected specs reach past the components that use it. `AGENTS.md:93` repeats "the affected spec(s)" for any code tier.
2. **The tokens.** `src/index.css:381-401` is plain `@theme`: radii (`:383-386`), shadows (`:389-390`), `--font-sans` (`:396`), `--text-hero: 2.75rem` (`:399`) and `--text-hero--line-height: 48px` (`:400`), with a comment at `:398` naming `tests/safe-area.spec.ts` as the reason for whole pixels. No `--leading-*`, `--tracking-*` or `--spacing` token exists today. The iOS override sets `--text-xs` and `--text-sm` to `1rem` inside `@layer base` at `:449-454`. The fallback faces `IBM Plex Sans Thai Fallback` carry `size-adjust` and `ascent-override` at `:107-142`.
3. **`tests/safe-area.spec.ts`** (2 tests, the whole describe skipped off Chromium at `:19-21`): portrait at 390 by 844 with insets 47/34 checks the header's top (`:29`), the mobile nav's 34px bottom padding (`:30`), that after scrolling to the end the footer's bottom is at or above the nav's top (`:34-39`), and a bottom sheet's padding (`:42-43`); landscape at 844 by 390 checks the header, `main` and footer stay within the 47px side insets (`:52-59`) and no horizontal scroll (`:60`).
4. **`tests/layout-stability.spec.ts`** (2 tests): the footer starts at or below the viewport on Transactions, Wallets and Debt payoff at 1280 by 720 and on Wallets at 390 by 844 (`:23-41`, all browsers); a cold Dashboard load at 1280 by 800 resolves all four fallback weights (`:82-94`) and totals a layout shift under 0.001 (`:96-103`), Chromium only (`:44`).
5. **The failure.** In Phase 137 T769 added `--text-hero` with a line height of 1.1 (44px x 1.1 = 48.4px); its targeted specs passed, the PR's CI failed `safe-area.spec.ts` (portrait) on Chromium, and T774 set the line height to 48px with a unit assertion. Source: the T774 ledger row and the Phase 137 refactor-log entry, now in `docs/audit/archive/` (read by the reviewer under this order; the builder does not need them). The live comment at `src/index.css:398` states the same cause.
6. **The code complies** (`AGENTS.md`: a rule enters once the code complies). Both spec files exist and pass: `main`'s push run for Phase 154 passed every E2E job (`docs/audit/task-ledger.md:68`). The one existing line-height token is whole pixels. ADR 0103 already ran both specs for a token move (`docs/audit/decisions/0103-paper-ledger-light-theme.md:103`). Nothing in `AGENTS.md`, `docs/contexts/ui-and-e2e.md` or the stage files says otherwise. Stated counts the phase must leave alone: `AGENTS.md:11` (1606 tests, 72 files; 213 tests, 37 specs, 639 runs), `README.md:157-158` (same), `docs/contexts/ui-and-e2e.md:67` (213, 37, 639, 633 pass, 6 skip; the 6 skips are `safe-area`'s 2 tests and `layout-stability`'s second test on Firefox and WebKit). `ls unit/*.test.*` counts 72.

## 5. Parity map

None.

## 6. Tests to add

None. The change is to rule text in two docs and to bookkeeping; it cannot alter app behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. Gates

Docs-only tier: nothing to run, but the new text states paths, token names and counts, so check them against the code. Run from the repo root in Git Bash; save the output to `workflow/stages/02_build/output/logs/T824-gates.log`.

1. **Text landed, read from this spec's code blocks** (exit 0, prints `agents-row AGENTS.md 1`, `agents-old AGENTS.md 0`, `ui-bullet docs/contexts/ui-and-e2e.md 1`, `backlog-row docs/audit/task-ledger.md 1`, `backlog-old docs/audit/task-ledger.md 0`):
   ```
   node -e 'const fs=require("fs");const s=fs.readFileSync("workflow/stages/01_spec/output/task-T824-spec.md","utf8").replace(/\r/g,"");const map={"agents-row":["AGENTS.md",1],"agents-old":["AGENTS.md",0],"ui-bullet":["docs/contexts/ui-and-e2e.md",1],"backlog-row":["docs/audit/task-ledger.md",1],"backlog-old":["docs/audit/task-ledger.md",0]};const p=s.split("\x60\x60\x60");let bad=0;for(let i=1;i<p.length;i+=2){const nl=p[i].indexOf("\n");const tag=p[i].slice(0,nl).trim();if(!map[tag])continue;const want=p[i].slice(nl+1).replace(/\n$/,"");const [f,exp]=map[tag];const n=fs.readFileSync(f,"utf8").replace(/\r/g,"").split(want).length-1;console.log(tag,f,n);if(n!==exp)bad++}process.exit(bad)'
   ```
2. **Diff shape:** `git diff --numstat -- AGENTS.md docs/contexts/ui-and-e2e.md` prints `1 1 AGENTS.md` and `1 0 docs/contexts/ui-and-e2e.md`; `git diff --quiet -- docs/audit/baseline-metrics.md README.md src tests unit api supabase .github vercel.json` exits 0.
3. **Docs-only PR:** every path in `git diff --name-only main` and in `git status --porcelain` (untracked included) is under `docs/` or `anti-slop/` or ends in `.md`: `{ git diff --name-only main; git status --porcelain | cut -c4-; } | sort -u | grep -Ev '^(docs/|anti-slop/)|\.md$'` prints nothing (exit 1). Paths under `workflow/stages/*/output/logs/` are gitignored and do not show.
4. **Named paths and tokens exist:** `ls tests/safe-area.spec.ts tests/layout-stability.spec.ts` lists both; `grep -c -e '--text-hero--line-height: 48px' -e '--font-sans:' -e "font-family: 'IBM Plex Sans Thai Fallback'" src/index.css` prints 6 (1 + 1 + 4); `grep -n -e '--text-xs: 1rem' -e '--text-sm: 1rem' src/index.css` shows lines 451 and 452; `grep -c "browserName !== 'chromium'" tests/safe-area.spec.ts tests/layout-stability.spec.ts` prints 1 for each.
5. **Stated counts unchanged:** `grep -n '1606 tests, 72 files' AGENTS.md`, `grep -n '213 tests, 37 specs, 639 runs' AGENTS.md`, `grep -n '213 tests in 37 specs' docs/contexts/ui-and-e2e.md` each print one line; `ls unit/*.test.* | wc -l` prints 72.
6. **Ledger:** `grep -c '^| T824 |' docs/audit/task-ledger.md` prints 1; `node -e "console.log(require('fs').readFileSync('docs/audit/task-ledger.md','utf8').split(/\r?\n/).filter(l=>l==='## Phase 155 - Rule candidates from Phase 137 (docs only, no ADR)').length)"` prints 1 (Node, since the file is CRLF); the file stays under about 150 lines.
7. **Refactor log:** the Phase 155 heading appears once, above the Phase 154 heading, and the entry has the four labels `**Changed:**`, `**Verified:**`, `**Surprises:**`, `**Deliberately not done:**`.
8. **Line endings:** `git ls-files --eol AGENTS.md docs/contexts/ui-and-e2e.md docs/audit/refactor-log.md docs/audit/task-ledger.md` shows `w/crlf` for all four, and `node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,s.split('\r\n').length-1,s.replace(/\r\n/g,'').split('\n').length-1)}" AGENTS.md docs/contexts/ui-and-e2e.md docs/audit/refactor-log.md docs/audit/task-ledger.md` prints 0 bare LF for each.
9. **Em dashes:** `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"` prints 0 (the command as in `workflow/stages/01_spec/CONTEXT.md:51`).

No `npm run lint`, unit or Playwright run: no code, test or config file changes.

## 8. Production touch points

None. No live SQL, no `/api/*` request, no deploy, no dashboard.

For the orchestrator and the owner:
- **Pause:** `AGENTS.md` is a Target file, so the orchestrator pauses after this spec. The owner approves the T823 and T824 specs together before either build.
- **Release:** the phase PR is docs-only on purpose (every changed path under `docs/` or `*.md`), so by `AGENTS.md`'s Release bullet it is **never auto-merged**; it also touches `AGENTS.md`. The owner merges.
- **First live proof of ADR 0111:** the PR's checks are the first real run of the Phase 154 docs-only path. The owner observes `gh pr checks <n> --required` (all seven required checks should report and pass, with steps skipped) and the `changes` job's `Classify the changed files` step log, which should say `code=false`. If any required check stays pending or the log says `code=true`, that is an ADR 0111 finding to record, not a reason to edit this task.
- **Shas:** the heading's `<sha>` placeholders and the T823 and T824 `Commit` cells are filled by the post-merge deploy record on `main`, as in Phase 154.

## 9. Out of scope

- `src/index.css`, `DESIGN.md`, `tests/safe-area.spec.ts`, `tests/layout-stability.spec.ts`, any `unit/` file, `.github/workflows/`, `README.md`, `docs/audit/baseline-metrics.md`, ADR 0103 or any ADR, `docs/audit/README.md`.
- A new tier row, or a rule for radius, shadow or colour tokens.
- `AGENTS.md:11`, `:93` and every other `AGENTS.md` line; every other line of `docs/contexts/ui-and-e2e.md`.
- T823's work: its target files (`workflow/stages/02_build/CONTEXT.md` or whatever its spec names), its ledger row and Backlog row 104. T824 only reads T823's row, commit and build report for the refactor-log entry.
- `docs/audit/archive/`: do not open it.
- Archiving ledger or log sections.
