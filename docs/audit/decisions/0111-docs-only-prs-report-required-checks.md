# 0111: docs-only pull requests report required checks

**Status:** Accepted. To be implemented in Phase 154 (T822): code `<sha>`, merged `<sha>`.
The owner approved editing `.github/workflows/` for this task on 2026-10-28.

**Date:** 2026-10-28

## Context

Branch protection on `main` (read with `gh api repos/{owner}/{repo}/branches/main/protection` on 2026-10-28) requires seven checks: `Type-check and unit tests` and the six `E2E (<browser> <shard>/2)` matrix jobs (`chromium 1/2`, `chromium 2/2`, `firefox 1/2`, `firefox 2/2`, `webkit 1/2`, `webkit 2/2`). Only `.github/workflows/playwright.yml` produces those checks.

Previously, both `push` and `pull_request` triggers carried `paths-ignore: [ 'docs/**', 'anti-slop/**', '**/*.md' ]`. A pull request whose modified files all matched that pattern started no workflow run, leaving the seven required contexts in an "Expected, waiting" state forever (as seen on PR #105). Consequently, merging docs-only pull requests required the repository owner to apply an administrative bypass.

In GitHub Actions, if a matrix job is skipped using a job-level `if:` condition, it reports only one unexpanded job name (e.g., `E2E (${{ matrix.project }} ${{ matrix.shard }}/2)`), rather than reporting each of the six concrete shard names required by branch protection. Furthermore, downstream jobs depending on a skipped job are themselves skipped. Therefore, skipping must happen at the step level within each required job rather than at the job level.

## Decision

- **D1:** Remove the `paths-ignore` filter from the `pull_request` trigger in `.github/workflows/playwright.yml` so every pull request starts a workflow run. The `push` trigger keeps its `paths-ignore` filter, as pushes do not gate branch protection.
- **D2:** Add a `changes` classification job ahead of `checks` and `e2e`. The job checks out with `fetch-depth: 2` and inspects `git diff --name-only --no-renames HEAD^1 HEAD`. A pull request is classified as docs-only (`code=false`) only when every changed file matches `^(docs/|anti-slop/)|\.md$`. An empty diff or a non-pull-request event counts as code (`code=true`); a failed diff fails the `changes` job, so the required checks never pass (fails closed).
- **D3:** Gate every step within `checks` and `e2e` with `if: needs.changes.outputs.code == 'true'`. Never apply a job-level `if:` to either job. When all steps in a job are skipped, the job concludes with success, satisfying the branch protection contexts. `merge-reports` is gated by `needs.changes.outputs.code == 'true'` as docs-only runs upload no blob artifacts.
- **D4:** Maintain strict consistency across the three definitions of the docs-only set: the `push` `paths-ignore` filter, the shell pattern in `changes`, and the Release rule in `AGENTS.md`. A new unit test in `unit/workflow-hardening.test.ts` locks all three together.
- **D5:** The Release rule in `AGENTS.md` continues to forbid auto-merging docs-only pull requests. The stated reason is updated: required checks pass with every step skipped, so they prove nothing about the pull request.

## Consequences

- Docs-only pull requests report all seven required checks as passing within approximately two to three minutes without running the real test suites, allowing clean merges without administrative bypass.
- About 10 to 20 seconds of wall-clock time is added to code pull request runs for the initial `changes` classification job.
- Docs-only pull request runs still download and initialize the Playwright runner container image across the six matrix jobs before skipping steps.
- If the `changes` job fails, `checks` is skipped, but branch protection remains blocked because the matrix job `e2e` reports an unexpanded name, ensuring the six `E2E (...)` checks never report (fails closed).

## Not done

- `merge_group` trigger support (no merge queue is configured; branch rulesets are empty).
- Making `container:` conditional on docs-only status (deferred optimization if container startup latency becomes an issue).
- Classifying files via GitHub's pull request REST API (would require `pull-requests: read` permission, violating the workflow hardening requirement that permissions be restricted to `contents: read`).
- Any modification to branch protection settings or rulesets.

## Release

To be merged into `main` via pull request without auto-merge, observed by the owner. Post-merge deploy record will fill `<sha>` placeholders on `main`.