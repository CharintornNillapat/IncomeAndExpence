# T822 spec: docs-only PRs report the 7 required checks on `main`

Phase 154, branch `phase-154-docs-ci-checks`. One task, the phase's last: it ships the phase. Id T822 is the next free one (the ledger's highest is T821, Phase 153; the newest spec output is `task-T820-spec.md`; no file or ledger row names T822).

## 1. Goal

A docs-only pull request reports all 7 checks `main` requires (`Type-check and unit tests` and the six `E2E (<browser> <shard>/2)` jobs) as passing within a couple of minutes, without running the real tests, so it no longer needs the owner's admin bypass. A code pull request still runs everything exactly as now.

## 2. Target files

Write in this order (ADR first, before any test or workflow edit):

```
docs/audit/decisions/0111-docs-only-prs-report-required-checks.md
unit/workflow-hardening.test.ts
.github/workflows/playwright.yml
AGENTS.md
README.md
docs/contexts/ui-and-e2e.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
.gitignore
```

- `.gitignore` is **already applied** by MASTER at the owner's explicit request (an uncommitted working-tree change). The builder leaves it exactly as it is, never edits or reverts it, and lists it in the build report as pre-applied. Its whole diff must stay these three added lines after `workflow/stages/*/output/logs/`:
  ```
  
  # Hook telemetry written under workflow/ by sub-agent sessions (the repo-root .claude/ stays tracked)
  workflow/**/.claude/
  ```
- `docs/audit/task-ledger.md` is bookkeeping: add the `## Phase 154 - Docs-only pull requests report the required checks (ADR 0111)` section from the ledger template, above `## Backlog`, with the branch line (`Branch \`phase-154-docs-ci-checks\`, cut from \`main\` at \`da96700\`. No migration.`) and the T822 row.
- No other file. `schema-drift.yml` is not touched.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`, section `## CI: .github/workflows/playwright.yml` (line 77 to 79): it states the workflow hardening rules this edit must keep and holds the sentence this task updates.
- No other context file: no app code, selector, ledger, `api/` or `supabase/` path is touched.

## 4. Current behaviour

- Branch protection on `main` (read with `gh api repos/{owner}/{repo}/branches/main/protection`, read-only, 2026-10-28) requires 7 contexts, all from app 15368 (GitHub Actions), `strict: false`: `E2E (webkit 1/2)`, `E2E (webkit 2/2)`, `E2E (chromium 1/2)`, `E2E (chromium 2/2)`, `E2E (firefox 1/2)`, `E2E (firefox 2/2)`, `Type-check and unit tests`. `gh api repos/{owner}/{repo}/rulesets` and `.../rules/branches/main` return `[]`: no ruleset and so no merge queue, so `merge_group` is not relevant.
- Only `.github/workflows/playwright.yml` produces those checks. `.github/workflows/schema-drift.yml:14-19` runs on `schedule` and `workflow_dispatch` only; its job `Compare live with the migrations` is not required.
- `playwright.yml:3-12`: both `push` and `pull_request` carry `paths-ignore: [ 'docs/**', 'anti-slop/**', '**/*.md' ]`, so a PR whose files all match starts no run and the 7 contexts stay "Expected, waiting". Evidence: `gh pr checks 105` (Phase 153, docs only) lists only `Vercel` and `Vercel Preview Comments`; `gh pr checks 104` (code) lists all 7 plus `Merge the E2E reports`. The comment at `playwright.yml:6-8` predicted this.
- `playwright.yml:27-28` job `checks`, name `Type-check and unit tests`, 6 steps (`:35-67`). `playwright.yml:69-71` job `e2e`, name `E2E (${{ matrix.project }} ${{ matrix.shard }}/2)`, `needs: checks`, matrix `project: [ chromium, firefox, webkit ]` (`:82`) and `shard: [ 1, 2 ]` (`:90`), container image pulled before any step (`:101-103`), 7 steps (`:106-160`; the upload step has `if: ${{ !cancelled() }}` at `:156`). `playwright.yml:167-170` job `merge-reports`, `needs: e2e`, `if: ${{ !cancelled() && needs.e2e.result != 'skipped' }}`.
- A matrix job skipped by a job-level `if:` reports one unexpanded check name, not the six, so the skip must be per step. A job whose steps are all skipped concludes `success`. A dependent of a skipped job is skipped, so `checks` must not be skipped at job level either (`e2e` needs it).
- `unit/workflow-hardening.test.ts:40-42` pins the workflow list to `['playwright.yml', 'schema-drift.yml']`; `:48-51` every `uses:` pinned to a 40-char sha with `# vX.Y.Z`; `:53-56` one top-level `permissions: {}`; `:58-72` every job's `permissions:` is exactly `      contents: read` (so a job that read the PR file list through the API, which needs `pull-requests: read`, would fail it); `:74-78` one `          persist-credentials: false` per checkout; `:80-82` no `pull_request_target`; `:85-89` secrets only in `schema-drift.yml`.
- `AGENTS.md:133` Release auto-merge needs "at least one changed file is outside `docs/`, `anti-slop/` and `*.md`", the same set as the filter. `AGENTS.md:134` ends "A docs-only PR is never auto-merged: the CI paths filter means a required check never reports on it." That reason is false once this task lands.
- `AGENTS.md:11` and `README.md:157` state the unit count, 1601 tests in 72 files. `docs/contexts/ui-and-e2e.md:79` says "Docs-only pushes skip it."
- No unit test, spec, script or `src/` file reads a `.md` file as input (only comments name `CLAUDE.md`/`DESIGN.md`), and no tracked `.md` outside `docs/`, `workflow/`, `anti-slop/` is consumed by a build: `.claude/agents/*.md`, `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, `README.md`. So a docs-only change cannot change a test result, which is the premise the existing `paths-ignore` already rests on.

## 5. Parity map

- No row's arithmetic or contract changes. The `@playwright/test` version / `matrix.playwright` row: the version-check step stays, unchanged except for its new step `if:` (it is skipped only on a docs-only PR, which cannot change `package-lock.json`).
- New lock, not a parity-map row: the docs-only set is written three times (the push `paths-ignore`, the `changes` classifier, `AGENTS.md:133`); the new test asserts all three agree.

## 6. Tests to add

All in `unit/workflow-hardening.test.ts`, appended after the closing `});` of the existing `describe('.github/workflows', ...)` (line 90). It reuses the file's `read`, `jobs` and `readFileSync`; no new import. Paste exactly:

```ts

/**
 * Phase 154 (ADR 0111): the seven checks `main` requires, read from its branch
 * protection on 2026-10-28 (`gh api repos/{owner}/{repo}/branches/main/protection`).
 * A pull request that starts no run never reports them, so a docs-only one
 * waited for the owner's bypass. Renaming a job or changing the matrix changes
 * these names, and the branch protection must change with them.
 */
const REQUIRED = [
  'E2E (chromium 1/2)',
  'E2E (chromium 2/2)',
  'E2E (firefox 1/2)',
  'E2E (firefox 2/2)',
  'E2E (webkit 1/2)',
  'E2E (webkit 2/2)',
  'Type-check and unit tests',
];

/** The condition on every step of `checks` and `e2e`: `changes` found code. */
const WHEN_CODE = "needs.changes.outputs.code == 'true'";

/** A job's steps, each its lines from one `      - ` to the next. */
function steps(lines: string[]): string[][] {
  const result: string[][] = [];
  for (const line of lines) {
    if (/^ {6}- /.test(line)) result.push([line]);
    else result.at(-1)?.push(line);
  }
  return result;
}

describe('playwright.yml reports the required checks on every pull request (ADR 0111)', () => {
  const text = read('playwright.yml');
  const all = jobs(text);
  const job = (id: string) => all.get(id) ?? [];
  /** A job's own key at four spaces, e.g. `    needs: changes`. */
  const key = (id: string, name: string) => job(id).find((line) => line.startsWith(`    ${name}: `));

  it('has no paths filter on pull_request, so every pull request starts a run', () => {
    const lines = text.split('\n');
    const at = lines.indexOf('  pull_request:');
    expect(at).toBeGreaterThan(0);
    const block: string[] = [];
    for (const line of lines.slice(at + 1)) {
      if (!/^ {4}/.test(line)) break;
      block.push(line);
    }
    expect(block.filter((line) => /^\s+paths(-ignore)?:/.test(line))).toEqual([]);
  });

  it('names its jobs so the matrix expands to exactly the required checks', () => {
    const matrix = (name: string) =>
      /\[ (.+) \]/.exec(job('e2e').find((line) => line.startsWith(`        ${name}: [`)) ?? '')?.[1].split(', ') ?? [];
    const e2e = key('e2e', 'name')?.slice('    name: '.length) ?? '';
    const names = matrix('project').flatMap((project) =>
      matrix('shard').map((shard) => e2e.replace('${{ matrix.project }}', project).replace('${{ matrix.shard }}', shard)));
    expect([key('checks', 'name')?.slice('    name: '.length), ...names].sort()).toEqual(REQUIRED);
  });

  it('skips the steps of checks and e2e, never the jobs, on a docs-only pull request', () => {
    for (const id of ['checks', 'e2e']) {
      expect(job(id).filter((line) => line.startsWith('    if:')), `${id} has no job-level if`).toEqual([]);
      expect(key(id, 'needs'), `${id} needs changes`).toMatch(/\bchanges\b/);
      const each = steps(job(id));
      expect(each.length, `${id} has steps`).toBeGreaterThan(0);
      for (const step of each) {
        expect(step.find((line) => line.startsWith('        if: ')) ?? '', `${id}: ${step[0].trim()}`).toContain(WHEN_CODE);
      }
    }
    expect(key('merge-reports', 'if')).toContain(WHEN_CODE);
  });

  it('counts a pull request as docs-only only when every changed file is under docs/ or anti-slop/ or ends in .md', () => {
    const changes = job('changes').join('\n');
    expect(changes).toMatch(/^ {10}fetch-depth: 2$/m);
    expect(changes).toContain('git diff --name-only --no-renames HEAD^1 HEAD');
    const pattern = /grep -Ev '([^']+)'/.exec(changes)?.[1];
    expect(pattern).toBeDefined();
    const docsOnly = new RegExp(pattern ?? '');
    const docs = [
      'docs/audit/task-ledger.md',
      'docs/design/tokens.json',
      'anti-slop/rules.txt',
      'README.md',
      'AGENTS.md',
      '.claude/agents/fin-reviewer.md',
      'workflow/stages/01_spec/CONTEXT.md',
    ];
    const code = [
      'src/App.tsx',
      'unit/workflow-hardening.test.ts',
      '.github/workflows/playwright.yml',
      'package-lock.json',
      '.gitignore',
      'docs.ts',
      'src/docs/notes.ts',
      'notes.mdx',
      'README.md.bak',
      'workflow/stages/02_build/output/logs/T822-unit.log',
    ];
    expect(docs.filter((file) => !docsOnly.test(file))).toEqual([]);
    expect(code.filter((file) => docsOnly.test(file))).toEqual([]);
  });

  it('uses the docs-only set of the push filter and of the Release rule in AGENTS.md', () => {
    expect(text.match(/^ {4}paths-ignore: .*$/gm)).toEqual(["    paths-ignore: [ 'docs/**', 'anti-slop/**', '**/*.md' ]"]);
    const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
    expect(agents).toContain('outside `docs/`, `anti-slop/` and `*.md`');
  });
});
```

Why it fails today (the reviewer ran this exact block against the unchanged `playwright.yml` in a scratch copy: 4 failed, 13 passed, 17 total; against the target workflow below: 17 passed; `tsc --noEmit` clean):

- `has no paths filter on pull_request`: `playwright.yml:12` is a `paths-ignore` under `pull_request` (`expected [ Array(1) ] to deeply equal []`).
- `skips the steps of checks and e2e`: `checks` has no `needs` line, so `toMatch` gets `undefined`.
- `counts a pull request as docs-only`: there is no `changes` job (`expected '' to match /^ {10}fetch-depth: 2$/m`).
- `uses the docs-only set`: two `paths-ignore` lines today, one expected (`expected [ …(2) ] to deeply equal [ Array(1) ]`).
- `names its jobs so the matrix expands` passes today and after: it is a lock on the required names.

Red run (stage 02 step 4): add the block, run `npx vitest run unit/workflow-hardening.test.ts` before touching `playwright.yml`, save to `workflow/stages/02_build/output/logs/T822-red.log`; it must show exactly the 4 failures above. Reviewer's stash check (stage 03 step 6): `git stash push -- .github/workflows/playwright.yml`, rerun the file (same 4 failures), `git stash pop`. Stash only that path: `.gitignore` must stay in the working tree.

## 7. The workflow change (`.github/workflows/playwright.yml`)

Keep CRLF in the working tree (the file is `i/lf w/crlf`). Change nothing not listed here. Every other line, including all existing step bodies, `concurrency`, `permissions: {}`, the container, the matrix and every pin, stays byte for byte.

**Edit 1.** Replace lines 6 to 12 (from `    # A docs-only push` through the second `paths-ignore`) with:

```yaml
    # A docs-only push (an ADR, the audit logs, a sha backfill) cannot change
    # what the suites test, and branch protection requires no check on a
    # push, so it starts no run.
    paths-ignore: [ 'docs/**', 'anti-slop/**', '**/*.md' ]
  # No paths filter here (Phase 154, ADR 0111): `main` requires the seven
  # checks below, and a pull request that starts no run never reports them.
  # A docs-only one runs them with every step skipped; see `changes`.
  pull_request:
    branches: [ main, master ]
```

**Edit 2.** Insert this job between `jobs:` (line 26) and `  checks:` (line 27), followed by one blank line:

```yaml
  # Phase 154 (ADR 0111): is this pull request docs-only? It is when every
  # file the merge would change is under docs/ or anti-slop/ or ends in .md,
  # the push filter's set above and the Release rule's in AGENTS.md. Then
  # `checks` and `e2e` still run, so the seven required checks report, but
  # every step in them is skipped. Skip steps, never a job: a matrix job
  # skipped by a job-level `if:` reports one unexpanded name, not six. Any
  # other file, .github/ included, is code, and so is every push, which the
  # filter above already chose.
  changes:
    name: Classify the changed files
    timeout-minutes: 5
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    outputs:
      code: ${{ steps.classify.outputs.code }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          # Nothing here pushes, so the job's token is not left in .git/config.
          persist-credentials: false
          # The merge commit and both its parents: HEAD^1 is the base branch,
          # so HEAD^1..HEAD is exactly what the merge would land.
          fetch-depth: 2

      # --no-renames lists a moved file under its old path too, so moving
      # code into docs/ is still code. An empty list is code. A failed diff
      # fails this job, and the required checks then never pass.
      - name: Classify the changed files
        id: classify
        env:
          EVENT_NAME: ${{ github.event_name }}
        run: |
          code=true
          if [ "$EVENT_NAME" = pull_request ]; then
            files=$(git diff --name-only --no-renames HEAD^1 HEAD)
            printf '%s\n' "$files"
            if [ -n "$files" ] && ! printf '%s\n' "$files" | grep -Ev '^(docs/|anti-slop/)|\.md$' > /dev/null; then
              code=false
            fi
          fi
          echo "code=$code"
          echo "code=$code" >> "$GITHUB_OUTPUT"

```

**Edit 3 (`checks`).** Add `    needs: changes` as the line right after `    name: Type-check and unit tests`. In each of its 6 steps add `        if: needs.changes.outputs.code == 'true'` as the line right after the step's `      - name: ...` line.

**Edit 4 (`e2e`).** Change `    needs: checks` to `    needs: [ changes, checks ]`. In each of its first 6 steps (Checkout through Run Playwright E2E tests) add `        if: needs.changes.outputs.code == 'true'` right after the `      - name: ...` line. In the 7th, `Upload the blob report`, change `        if: ${{ !cancelled() }}` (in place, after its `uses:`) to `        if: ${{ !cancelled() && needs.changes.outputs.code == 'true' }}`. Do not touch `name:`, the matrix, `container:` or `strategy:`.

**Edit 5 (`merge-reports`).** Change `    needs: e2e` to `    needs: [ changes, e2e ]` and its `if:` to `    if: ${{ !cancelled() && needs.e2e.result != 'skipped' && needs.changes.outputs.code == 'true' }}`. In its comment, replace `# run a newer push cancelled, and not when \`checks\` failed and no shard ran.` with the two lines:

```yaml
  # run a newer push cancelled, not when `checks` failed and no shard ran, and
  # not on a docs-only pull request, whose shards wrote no blob.
```

Effect: a code PR or any push runs every step as today; the only addition is the `changes` job (about 10 to 20 s) ahead of `checks`. A docs-only PR runs `changes`, then `checks` (all steps skipped, success), then the six `e2e` jobs (container pulled, all steps skipped, success); `merge-reports` is skipped (not required).

## 8. Docs edits

- **ADR** `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md`, the 0110 layout (`# 0111: ...`, `**Status:**` Accepted, to be implemented in Phase 154 (T822), `**Date:** 2026-10-28`, then `## Context`, `## Decision`, `## Consequences`, `## Not done`, `## Release` with `<sha>` placeholders). Context: the 7 required contexts and where they were read, PR #105's missing checks and the admin bypass, the unexpanded-name trap. Decision: D1 no paths filter on `pull_request`, push keeps it; D2 the `changes` job and its rule (the `HEAD^1..HEAD` merge diff, `--no-renames`, empty list and push count as code, a failed diff fails closed); D3 step-level `if:` on every step of `checks` and `e2e`, never a job-level one, and `merge-reports` skipped on docs-only; D4 the docs-only set stays the same three patterns in the push filter, the classifier and the Release rule, locked by the new test; D5 the Release rule still never auto-merges a docs-only PR (owner's policy unchanged), with the new reason. Consequences: about 10 to 20 s added to every code run; a docs-only PR still pulls the Playwright image six times. Not done: `merge_group` (no merge queue: rulesets are empty); skipping the container pull on docs-only PRs (a `container:` expression that is empty on docs-only, the upgrade path if the wait matters); a classifier based on the PR files API (needs `pull-requests: read`, which the hardening test forbids); any change to branch protection. Add the line "The owner approved editing `.github/workflows/` for this task on 2026-10-28."
- **`AGENTS.md:134`**: replace `A docs-only PR is never auto-merged: the CI paths filter means a required check never reports on it.` with `A docs-only PR is never auto-merged: its required checks pass with every step skipped (ADR 0111), so they prove nothing about it.` Nothing else on that line changes.
- **`AGENTS.md:11`** and **`README.md:157`**: the unit test and file counts measured by the final `npm run test:unit` run (expected 1606 tests, 72 files; write what the log shows).
- **`docs/contexts/ui-and-e2e.md:79`**: replace `Docs-only pushes skip it.` with `Docs-only pushes skip it. On a pull request the \`changes\` job checks the files the merge would change against the same set (\`docs/\`, \`anti-slop/\`, \`*.md\`), and a docs-only one runs \`checks\` and \`e2e\` with every step skipped, so the seven required checks still report (ADR 0111). Skip steps, never a matrix job: a matrix job skipped at job level reports one unexpanded name.`
- **`docs/audit/refactor-log.md`**: a `## Phase 154 - Docs-only pull requests report the required checks: T822 (2026-10-28, code \`<sha>\`, merged \`<sha>\`)` entry at the top with all four headings, built per stage 02 (Changed from `git status --porcelain`; Verified from the Gate result cell). `Deliberately not done` lists the ADR's Not done items and that `.gitignore`'s change was pre-applied by MASTER.
- **`docs/audit/baseline-metrics.md`**: a `### Phase 154 - delta against Phase 152` section above Phase 152's: unit files, tests and time, in order and shuffled (with the seed); bundle not rebuilt, because no file the build reads changed (name the changed files).

## 9. Gates

The union of the tier rows for `.github/workflows/` and `unit/`, the docs checks, and the extra checks below. Save full-suite output under `workflow/stages/02_build/output/logs/` (the reviewer under `workflow/stages/03_review/output/logs/`).

1. `npx vitest run unit/workflow-hardening.test.ts` (both tiers): 17 passed.
2. `npm run lint`: clean.
3. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T822-unit.log`: all pass; record files and tests. Then `npm run test:unit:shuffle 2>&1 | tee workflow/stages/02_build/output/logs/T822-unit-shuffle.log` (the CI step the workflow keeps; record the seed).
4. **Classifier harness** (proves the shell rule without CI; the reviewer ran it against the target workflow: the results below). Save this exact script as `workflow/stages/02_build/output/logs/T822-harness.sh` and run `bash workflow/stages/02_build/output/logs/T822-harness.sh .github/workflows/playwright.yml 2>&1 | grep -v '^warning' | tee workflow/stages/02_build/output/logs/T822-harness.log`:
   ```bash
   #!/usr/bin/env bash
   # Usage: bash T822-harness.sh <path to playwright.yml>
   YML=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
   S=$(mktemp -d)
   node -e "const l=require('fs').readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n').split('\n');const i=l.indexOf('        id: classify');const j=l.indexOf('        run: |',i);if(i<0||j<0){console.error('no classify step');process.exit(1)}const o=[];for(const x of l.slice(j+1)){if(x!==''&&!x.startsWith('          '))break;o.push(x.slice(10));}process.stdout.write(o.join('\n')+'\n')" "$YML" > "$S/classify.sh" || exit 1
   echo "--- extracted run block"; cat "$S/classify.sh"; echo "---"
   cd "$S" && mkdir r && cd r && git init -q -b main && git config user.email t@t && git config user.name t && git config core.autocrlf false
   mkdir -p src docs && echo a > src/a.ts && echo d > docs/x.md && git add -A && git commit -qm base
   run() {
     git checkout -q main; git checkout -q -b "$1"; eval "$2"; git add -A; git commit -q --allow-empty -m c
     git checkout -q main; git checkout -q -b "m-$1"; git merge -q --no-ff "$1" -m m
     out=$(mktemp); EVENT_NAME=$3 GITHUB_OUTPUT=$out bash -e "$S/classify.sh" > /dev/null
     echo "$1 $3 -> $(cat "$out")"
   }
   run docs 'echo e >> docs/x.md; echo r > README.md; mkdir -p anti-slop; echo z > anti-slop/n.txt' pull_request
   run code 'echo b >> src/a.ts' pull_request
   run move 'git mv src/a.ts docs/a.ts' pull_request
   run mdx 'echo q > docs.mdx' pull_request
   run push 'echo e2 >> docs/x.md' push
   run empty ':' pull_request
   git checkout -q --orphan solo
   out=$(mktemp); EVENT_NAME=pull_request GITHUB_OUTPUT=$out bash -e "$S/classify.sh" > /dev/null 2>&1
   echo "no-parent pull_request -> exit $? output '$(cat "$out")'"
   ```
   Expected, exactly: `docs pull_request -> code=false`, `code pull_request -> code=true`, `move pull_request -> code=true`, `mdx pull_request -> code=true`, `push push -> code=true`, `empty pull_request -> code=true`, `no-parent pull_request -> exit 128 output ''`.
5. Workflow diff shape: `git diff --stat -- .github/workflows/` names only `playwright.yml`; `git diff -U0 -- .github/workflows/playwright.yml` shows no removed line other than the old comment lines 7 to 8, the `pull_request` `paths-ignore`, the three `needs:` lines, the two old `if:` lines and the one `merge-reports` comment line; `git ls-files --eol .github/workflows/playwright.yml` still shows `w/crlf`.
6. Docs: `git ls-files --eol AGENTS.md README.md docs/contexts/ui-and-e2e.md unit/workflow-hardening.test.ts` still `w/crlf`; the unit count in `AGENTS.md:11` and `README.md:157` equals the gate 3 log; em dashes in added lines are 0 with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, and 0 in the new ADR with `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" docs/audit/decisions/0111-docs-only-prs-report-required-checks.md`.
7. `.gitignore` (pre-applied; reviewer verifies): `git diff .gitignore` is exactly the three added lines in section 2; `git check-ignore -v workflow/stages/02_build/.claude/x.json` prints the `workflow/**/.claude/` rule; `git check-ignore -q .claude/settings.json; echo $?` prints `1` (the root `.claude/` stays tracked).
8. `git status --porcelain` lists only the Target files, `docs/audit/task-ledger.md` and the new ADR (untracked); no Playwright run (no `src/`, `tests/` or app file changes; the real E2E proof is the PR's own CI below).

## 10. Production touch points

- **`.github/workflows/playwright.yml` edit:** on `AGENTS.md`'s Stop and ask first list. The owner approved editing `.github/workflows/` for this task (2026-10-28, through MASTER). The pause rule applies (`.github/workflows/` and `AGENTS.md` in Target files): the orchestrator shows the owner this spec before `build T822`.
- **No auto-merge.** The PR must not get `gh pr merge --auto`; it also fails the Release bullet's eligibility (it touches `AGENTS.md` and a production touch point). The orchestrator pushes the branch and runs `gh pr create` per the Release bullet, reports the link, and the owner merges by hand after seeing the checks.
- **Verification on GitHub, observed by the owner (read-only for agents: `gh pr checks`, `gh run view --json jobs`):**
  1. This PR changes a workflow, so it is code: `Classify the changed files` logs the file list and `code=true`, the 7 required checks and `Merge the E2E reports` run for real (each E2E job takes minutes, not seconds), and all pass. A "workflow file issue" run instead means the YAML does not parse: fix on the branch.
  2. After the merge, the `main` push run is code too and runs everything.
  3. The proof of the fix is the first docs-only PR after the merge (the next docs-only phase's PR, or a one-line docs PR the owner opens): `gh pr checks <n> --required` shows all 7 passing within about 3 minutes, the `Classify the changed files` log shows `code=false`, `gh run view <run> --json jobs` shows every step of `checks` and the six `e2e` jobs as `skipped`, and `Merge the E2E reports` as skipped. It merges without the admin bypass. The deploy record cannot prove it: it is a `[skip ci]` commit on `main`, not a PR.
- No branch protection, ruleset, Vercel, Supabase or `/api/*` change or request. No secret is added; `secrets.` stays only in `schema-drift.yml`.

## 11. Out of scope

- `schema-drift.yml`; branch protection or rulesets (the owner's dashboard); adding a `merge_group` trigger.
- The `push` trigger's `paths-ignore`: kept as is.
- Making `container:` conditional, or any change to the matrix, job names, step bodies, timeouts, `concurrency` or pins.
- Changing the auto-merge policy for docs-only PRs (only the stated reason changes); `~/.claude/commands/finlife.md` (outside the repo; its Release step already uses the same three patterns).
- A new workflow file (the hardening test pins the list to two), a YAML parser or any dependency, a `scripts/` classifier.
- Editing or reverting `.gitignore` (pre-applied).
- Rewording the Phase 153 history in `refactor-log.md` or ADR 0101.
