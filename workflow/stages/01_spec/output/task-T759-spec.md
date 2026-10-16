# T759 spec: whole-app read-only audit (Phase 131)

Branch `phase-131-project-audit`, cut from `main` at `cb9e109`. This task ships Phase 131 (it is the phase's only task).

## 1. Goal

Audit the whole app as it is today, without changing any code, and write the findings to one report, `docs/audit/audit-2026-10-16.md`. Every finding has a severity, `file:line` evidence, the rule it breaks (if any) and a suggested fix. The high and medium findings become Backlog rows in the ledger, and the reviewer drops any high or medium finding it cannot confirm in the code.

## 2. Target files

```
docs/audit/audit-2026-10-16.md
docs/audit/README.md
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T759 row, the Phase 131 section and the new Backlog rows) and `workflow/stages/02_build/output/*` (the build report, plus the check script and logs under `output/logs/`).

No ADR: this is a docs-only task (`AGENTS.md`, Workflow: "Skip the process for ... doc-only edits"). No `docs/audit/baseline-metrics.md` section: no bundle or test count changes.

## 3. Context to read

The builder itself reads `AGENTS.md` in full and this spec. Each read-only sub-agent reads `AGENTS.md` and its own domain's context file (section 4.2), because a finding of the type "the code breaks a rule" needs the rule text, and a behaviour the context file describes as intended is not a finding. The builder does not edit any context file.

## 4. Current behaviour and the method

### 4.1 Where things stand

- There has been no whole-app audit since the rule split of Phase 125. The earlier audits are in `docs/audit/archive/`, which no agent reads (`AGENTS.md`, Domain context routing; `docs/audit/README.md`).
- The ledger's Backlog (`docs/audit/task-ledger.md:68-84`) has four open rows. **Do not report these again**:
  - `docs/audit/task-ledger.md:74`: the `<view>-<thing>-<kind>` id convention, unverified repo-wide.
  - `docs/audit/task-ledger.md:79`: ESLint with `react-hooks/exhaustive-deps`.
  - `docs/audit/task-ledger.md:82`: React Compiler.
  - `docs/audit/task-ledger.md:83`: `rollup-plugin-visualizer`.
  The Backlog's `done` rows are fixed; do not report them either.
- Also not findings (accepted or intended, per the context files):
  - The Supabase advisors listed as accepted in `docs/contexts/supabase-ledger.md:66-68` (the ten `SECURITY DEFINER` functions, `ai_request_counts` with RLS and no policy, the five unindexed foreign keys, the three unused indexes, leaked password protection).
  - No per-device session revoke (`docs/contexts/supabase-ledger.md:58`), no all-callers firewall rule (`docs/contexts/api-proxies.md:61`).
  - Anything else a context file states as the intended design. If the sub-agent thinks an intended design is wrong, it is at most a low finding that names the context line and the ADR.

### 4.2 Four read-only sub-agents, one per domain

The builder runs four read-only sub-agents in parallel (stage 02, How to build, step 2: sub-agents may only read). Each gets the prompt in 4.3 with its domain filled in:

| Prefix | Domain | Context file | Covers |
|---|---|---|---|
| `CS` | Client state | `docs/contexts/client-state.md` | `src/context/`, `src/selectors/`, `src/utils/`, `src/services/`, `src/hooks/`, `src/types.ts`, the entry engine logic in `src/components/TransactionForm.tsx`, the unit harnesses in `unit/`. Parity rows: transfer preview and debt payoff block vs `addTransaction`; `accountExport.ts` and backup schemas vs `src/types.ts`. |
| `SL` | Supabase and the ledger | `docs/contexts/supabase-ledger.md` | `supabase/migrations/`, `supabase/tests/`, `supabase/replay/`, `supabase/catalog.sql`, `supabase/ops/` (read only, never run), `src/lib/supabase.ts`, the auth, session and load code in `src/context/FinanceContext.tsx` and `src/services/`, the drift and history scripts in `scripts/`. Parity rows: `addTransaction` / `setTransactionDeleted` vs `_ledger_apply_effect` and the ledger RPCs (latest re-creation of each function wins); guest starter set vs `seed_starter_account()`; `identityColorMigration.ts` vs `20261002_phase63_identity_colors.sql`. |
| `AP` | The API proxies | `docs/contexts/api-proxies.md` | `api/classify.ts`, `api/insights.ts`, `api/csp-report.ts`, `api/tsconfig.json`, `vercel.json`, `index.html`, the client callers `src/utils/insightsClient.ts`, `src/utils/jevClassifier.ts`, `src/utils/batchClassifier.ts`. Parity rows: `classify.ts` vs `insights.ts` shared declarations; `index.html` inline script vs its CSP hash. |
| `UI` | UI and e2e | `docs/contexts/ui-and-e2e.md` (plus `DESIGN.md` only to confirm a visual finding) | `src/components/`, `src/views/`, `App.tsx`, `src/index.css`, `tests/*.spec.ts`, `playwright.config.ts`, `.github/workflows/playwright.yml` (read only). Parity row: spec-asserted DOM ids vs `docs/audit/test-selector-contract.md`. |

A file in two domains (`FinanceContext.tsx`, `TransactionForm.tsx`) is read by both; the builder merges duplicate findings (4.4).

### 4.3 The sub-agent prompt

> You are a read-only auditor for the **<Domain>** domain of this repo. Read `AGENTS.md` in full, then `<context file>`, then the code under your Covers list. Never edit, create or delete a file; never run a command that writes. Never read `.env`, `docs/audit/archive/` or `docs/design/*.html`. Never run anything on `AGENTS.md`'s Stop and ask first list (no live Supabase SQL, no `schema:drift -- --live`, no request to production `/api/*`, no MCP or CLI write tool, no sign-in, no dev server with `.env`). Allowed: reading files, `git log`, `git show`, `git grep`, `rg`, and `npx tsc --noEmit`.
>
> Look for: (1) correctness bugs, above all on money paths (rounding outside `roundToCents`, inline money filters outside `src/selectors/`, date handling that breaks the local-calendar-day rule, client and SQL arithmetic that disagree); (2) security and data exposure (RLS gaps, a function that trusts a caller-supplied user id, secrets or tokens reaching the client or logs, missing input validation at a trust boundary, CSP gaps); (3) code that breaks a rule in `AGENTS.md` or `<context file>`; (4) dead code (exports nothing imports, unreachable branches, unused files; confirm with `git grep` that nothing imports it); (5) accessibility (missing labels or names, focus loss, keyboard traps, contrast against `DESIGN.md` tokens, missing live regions); (6) performance (work repeated per render, an eager import that should be lazy, unbounded lists, effects without cleanup).
>
> Skip: the four open Backlog rows and the `done` rows in `docs/audit/task-ledger.md:68-84`; the accepted advisors in `docs/contexts/supabase-ledger.md:66-68`; anything a context file describes as intended.
>
> Report each finding in exactly this form, nothing else:
> ```
> ### <PREFIX>-NN [high|medium|low] <title, one line>
> - **Evidence:** `path:line` (or `path:start-end`, repo-relative), followed by the code on that line, quoted. More than one citation is fine.
> - **Rule:** the `AGENTS.md` section name, or `docs/contexts/<file>.md:<line>`, or `none`.
> - **Impact:** a concrete failure: the inputs or state, and the wrong output, crash or exposure.
> - **Fix:** the suggested fix, and the `AGENTS.md` gate tier it would need.
> ```
> Severity: **high** = a wrong money figure, lost or corrupted ledger data, one user's data reachable by another, a secret exposed, an auth bypass, or a crash on a main path. **medium** = a broken `AGENTS.md` or context rule, a user-visible correctness bug off the money paths, an accessibility blocker on a main flow (a control with no accessible name, a keyboard trap, lost focus after a modal), or a performance cost you can point to in the code. **low** = dead code, drift, a minor accessibility or performance issue, a nit. When unsure between two, pick the lower. Report only what you saw in the code at the cited line; a suspicion that only the live project can prove goes in a separate list headed `Needs a live check`, as one line each, not as a finding. Last, list the areas you checked and found clean, one bullet each, under `Checked, no finding`.

### 4.4 Merging and writing the report

1. Record the audited commit: `git rev-parse --short HEAD` before the sub-agents start.
2. Merge the four replies. Where two domains report the same defect, keep one finding under the domain that owns the fix (the domain whose Covers list holds the file to change), with every citation from both.
3. Before writing, open each high and medium finding's cited lines yourself and confirm the quoted code is there. Drop any that does not match; say so in the build report.
4. Number findings per prefix from `01`, ordered high, then medium, then low.

The report, `docs/audit/audit-2026-10-16.md`, in this order:

```
# Whole-app audit, 2026-10-16

T759, Phase 131. Read-only audit of commit `<sha>` by four read-only sub-agents, one per domain in `AGENTS.md`'s routing table. No code was changed.

## Scope and what was skipped
<the domains and their Covers lists, one line each; the skipped Backlog rows and accepted items from section 4.1>

## Summary
| Domain | High | Medium | Low |
|---|---|---|---|
| Client state (CS) | n | n | n |
| Supabase and the ledger (SL) | n | n | n |
| API proxies (AP) | n | n | n |
| UI and e2e (UI) | n | n | n |
| Total | n | n | n |

## Findings
### Client state
<CS findings, in the 4.3 form>
### Supabase and the ledger
### API proxies
### UI and e2e
(a domain with no findings says "None.")

## Needs a live check (owner)
<one line each, with the domain prefix; or "None.">

## Checked, no finding
<per domain, the bullets from the sub-agents>

## Dropped in review
None.
```

Only finding headings use `### <PREFIX>-NN [`; no other line in the report starts that way. Every citation is in backticks, `path:line` or `path:start-end`, with a repo-relative path.

### 4.5 The ledger and the index

- **Backlog rows:** appended to the end of the Backlog table (after `docs/audit/task-ledger.md:84`), in report order (CS, SL, AP, UI; high before medium within each). Count the high and medium findings in the report after step 3 of 4.4, then use one of two forms:
  - **10 or fewer in total:** one row per high and medium finding:
    `| <finding title> | Audit 2026-10-16 (T759), finding <ID>, <severity>; <first citation> | todo |`
  - **More than 10 in total:** one row per domain that has at least one high or medium finding (no row for a domain with none), so the ledger stays under about 150 lines. Each row lists that domain's high and medium finding ids, in report order, in the Source cell only:
    `| <Domain> findings from the 2026-10-16 audit: <h> high, <m> medium | Audit 2026-10-16 (T759), findings <ID>, <ID>, ...; see docs/audit/audit-2026-10-16.md | todo |`
    `<Domain>` is the domain name from the report's Summary table (for example `Client state`).
  The string `Audit 2026-10-16` appears in these rows only, nowhere else in the ledger. No finding id appears anywhere else in a row. Low findings get no Backlog row and are never listed in a grouped row.
- **T759 row:** a new Phase 131 section before `## Backlog`, from the ledger's template, exactly:
  ```
  ## Phase 131 - Whole-app audit (docs only, no ADR)

  Branch `phase-131-project-audit`, cut from `main` at `cb9e109`. No migration.

  | # | Task | Files | Status | Commit | Gate result |
  |---|---|---|---|---|---|
  | T759 | Read-only whole-app audit by four domain sub-agents; high and medium findings to the Backlog | `docs/audit/audit-2026-10-16.md`, `docs/audit/README.md`, `docs/audit/refactor-log.md` | done | | <gate result> |
  ```
- If the ledger passes 150 lines (`docs/audit/task-ledger.md:96`), do not archive anything; note the line count under Surprises.
- **`docs/audit/README.md`:** one row in the Live files table, after the `test-selector-contract.md` row (`docs/audit/README.md:18`), exactly:
  ```
  | `audit-2026-10-16.md` | The whole-app audit of 2026-10-16 (T759): findings by domain and severity | Picking up a Backlog row it raised |
  ```
- **`docs/audit/refactor-log.md`:** a new entry above the Phase 130 entry, in the file's template: heading `## Phase 131 - Whole-app audit: T759 (2026-10-16)` (the owner's deploy record adds the shas), no ADR, **Changed** (the three files and the ledger, with the finding counts), **Verified** (the gate results), **Surprises**, **Deliberately not done** (at least: no code fixed; no live check run; low findings not added to the Backlog).

### 4.6 Fix rounds

If the review drops a finding, the fix round removes its block from Findings, adds one line `- <ID> [<severity>] <title>: <the reviewer's reason>` under `Dropped in review`, removes it from the Backlog (in the per-finding form, its row; in the grouped form, its id from its domain's row and that row's high or medium count, and the whole row when no id is left), and updates the Summary counts and the refactor-log counts. Finding ids are never renumbered. The Backlog form chosen at build stays in fix rounds: dropping findings never regroups or ungroups the rows (G2 checks the form against the count, so a fix round that brings the total from above 10 to 10 or fewer reruns G2 with `--grouped`).

## 5. Parity map

None changed. The audit reads every row of `AGENTS.md`'s cross-file parity map (each is assigned to a domain in 4.2) and reports any pair that has drifted, but edits neither side.

## 6. Tests to add

None. The task changes only docs and cannot alter behaviour; stage 02 step 4 and stage 03 step 6 do not apply.

## 7. Gates

Docs-only tier: "nothing, unless a doc states a count or path: check it against the code". The report states hundreds of paths and counts, so these gates check them. Run from the repo root in Git Bash.

**G1 scope.** Only the target files and bookkeeping changed:
```
git status --porcelain
git diff --stat main
```
Pass: the only paths are `docs/audit/audit-2026-10-16.md` (new), `docs/audit/README.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, and files under `workflow/stages/01_spec/output/`, `workflow/stages/02_build/output/`, `workflow/stages/03_review/output/`.

**G2 citations, structure and Backlog rows.** Save this script as `workflow/stages/02_build/output/logs/T759-check.mjs` with the Write tool (not a heredoc; it holds regex backslashes), then run `node workflow/stages/02_build/output/logs/T759-check.mjs docs/audit/audit-2026-10-16.md docs/audit/task-ledger.md`. Pass: exit 0, `bad: 0`, empty `dup`, `noField`, `noCite`, `missingRows`, `extraRows: 0` and `badShape: false`. `grouped` is `true` exactly when there are more than 10 high and medium findings; `badShape` checks the Backlog form (one row per finding with one id each, or one row per domain with only that domain's ids). Pass `--grouped` after the two paths only in a fix round whose drops took a grouped total to 10 or fewer (4.6); never at build.
```js
import fs from 'node:fs';
const [report, ledger] = process.argv.slice(2);
const text = fs.readFileSync(report, 'utf8');
let bad = 0, cites = 0;
for (const m of text.matchAll(/`([A-Za-z0-9_.\/-]+\.[A-Za-z]+):(\d+)(?:-(\d+))?`/g)) {
  cites++;
  const [, file, a, b] = m;
  if (!fs.existsSync(file)) { console.log('MISSING', file); bad++; continue; }
  const n = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
  const end = Number(b ?? a);
  if (Number(a) < 1 || end > n || end < Number(a)) { console.log('RANGE', m[0], 'file lines', n); bad++; }
}
const heads = [...text.matchAll(/^### ((?:CS|SL|AP|UI)-\d{2}) \[(high|medium|low)\] /gm)];
const ids = heads.map(h => h[1]);
const hm = heads.filter(h => h[2] !== 'low').map(h => h[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
const blocks = text.split(/^### /m).slice(1).filter(b => /^(CS|SL|AP|UI)-\d{2} \[/.test(b));
const noField = blocks.filter(b => !['**Evidence:**', '**Rule:**', '**Impact:**', '**Fix:**'].every(f => b.includes(f))).map(b => b.slice(0, 5));
const noCite = blocks.filter(b => !/`[A-Za-z0-9_.\/-]+\.[A-Za-z]+:\d+/.test(b)).map(b => b.slice(0, 5));
const rows = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter(l => l.includes('Audit 2026-10-16'));
const rowIds = rows.map(r => r.match(/\b(?:CS|SL|AP|UI)-\d{2}\b/g) || []);
const listed = rowIds.flat();
const missingRows = hm.filter(id => !listed.includes(id));
const extraRows = listed.filter((id, i) => !hm.includes(id) || listed.indexOf(id) !== i).length;
const grouped = hm.length > 10 || process.argv.includes('--grouped');
const domains = new Set(hm.map(id => id.slice(0, 2)));
const badShape = grouped
  ? rows.length !== domains.size || rowIds.some(r => r.length === 0 || new Set(r.map(id => id.slice(0, 2))).size !== 1)
  : rows.length !== hm.length || rowIds.some(r => r.length !== 1);
const count = sev => heads.filter(h => h[2] === sev).length;
console.log({ cites, bad, findings: ids.length, high: count('high'), medium: count('medium'), low: count('low'), grouped, ledgerRows: rows.length, dup, noField, noCite, missingRows, extraRows, badShape });
process.exit(bad || dup.length || noField.length || noCite.length || missingRows.length || extraRows || badShape ? 1 : 0);
```

**G3 counts.** The Summary table's per-domain and total counts equal the per-prefix counts G2's heading regex gives, and the refactor-log entry's counts equal the same numbers. Check by hand against G2's output; record both.

**G4 skip list.** No finding repeats one of the four open Backlog rows, a `done` Backlog row, or an accepted item from 4.1. Check by reading the finding titles.

**G5 em dashes.** Zero in every touched file:
```
node -e 'for (const f of process.argv.slice(1)) console.log(f, (require("fs").readFileSync(f, "utf8").split(String.fromCharCode(8212)).length - 1))' docs/audit/audit-2026-10-16.md docs/audit/README.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T759-build.md
```
Pass: every count is 0.

**G6 line endings.** The edited existing files stay CRLF in the work tree: `git ls-files --eol docs/audit/README.md docs/audit/refactor-log.md docs/audit/task-ledger.md` shows `w/crlf` for each. The new report has one ending style throughout:
```
node -e 'const t = require("fs").readFileSync(process.argv[1], "utf8"); const crlf = (t.match(/\r\n/g) || []).length; const lf = (t.match(/\n/g) || []).length - crlf; console.log({ crlf, bareLf: lf })' docs/audit/audit-2026-10-16.md
```
Pass: `crlf` or `bareLf` is 0.

**G7 no code changed.** `git diff --stat main -- src unit tests api supabase scripts index.html vercel.json package.json package-lock.json .github` prints nothing.

No lint, unit or Playwright run is required: no code tier applies. The builder must not run Playwright, a dev server or `npm run build` for this task.

### Reviewer's verification (owner's addition)

At review the reviewer opens the cited lines of **every** high and medium finding, confirms the defect is real as described, and requests the drop (4.6) of any it cannot confirm. Low findings are spot-checked, not all verified.

## 8. Production touch points

None. The audit is static: no live SQL or probe, no `schema:drift -- --live`, no request to production `/api/*`, no MCP or CLI write tool, no sign-in, no dashboard read that needs a write tool. A suspicion that only the live project can settle goes under `Needs a live check (owner)` for the owner to run later, with the owner's go-ahead.

## 9. Out of scope

- Fixing any finding, however small: no edit under `src/`, `unit/`, `tests/`, `api/`, `supabase/`, `scripts/`, `.github/`, or to `index.html`, `vercel.json`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `DESIGN.md` or any `docs/contexts/` file. A finding that a rule file is wrong is reported, not fixed.
- Backlog rows for low findings.
- Editing or reordering existing Backlog rows, or archiving ledger phases.
- `docs/audit/baseline-metrics.md` (no measured figure changes) and any new ADR.
- Reading `.env`, `docs/audit/archive/` or `docs/design/*.html`, in the builder or any sub-agent.
- Adding a dependency or running a tool through `npx` that downloads one (for example `knip` or `depcheck`); dead code is found with `git grep`.
