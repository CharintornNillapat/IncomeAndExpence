# 0062: One Playwright report for all six CI shards

**Status:** Accepted. Implemented on branch `phase-86-consolidated-ci-reports` (commit `002f8b3`; negative control `a927893`, reverted in `4259587`; docs `9fdf119`, hash backfill `0ad7545`), merged into `main` as `a7cb77f` (PR #36). Vercel `dpl_BTyVRinCKM9gSB9GZr6vhndfkQSN` is READY in production (`icn1`), serving the same entry as before: this phase changed no app code.
- **Amends** ADR `0061`, which rejected a merged report and left each shard to upload its own.

**Date:** 2026-10-05

## Context

Since ADR `0061`, each browser's tests run as two shards, so a CI run has six E2E jobs and uploaded six HTML reports (`playwright-report-<browser>-<shard>`). To read a failure you first had to find which shard ran the test, then download that shard's report. To see a whole run you downloaded all six. Phase 85's own analysis had to read the six reports one by one, from the data embedded in each HTML page.

ADR `0061` rejected a merged report as "one more job on every run, for convenience only". That was a guess, not a measurement. This phase builds the merged report and measures what it costs.

## Decision

- **Each shard writes a blob report** on CI (`reporter: [['blob'], ['list']]` when `CI` is set; the HTML report locally). A blob holds every result and attachment, traces included, in a form Playwright can merge. `list` writes each test and its time to the job log.
- **Each blob has its own name:** `PLAYWRIGHT_BLOB_OUTPUT_NAME: report-<browser>-<shard>.zip`. Playwright's default name includes the shard number and a hash. Naming the file explicitly means the six can never collide in one folder, whatever goes into that hash.
- **Each shard uploads `blob-report-<browser>-<shard>`, kept 7 days.** These are inputs for the merge job, not reports to read. If the merge fails, `npx playwright merge-reports --reporter html <folder>` rebuilds the report by hand within the week.
- **A `merge-reports` job** needs `e2e` and runs on `!cancelled() && needs.e2e.result != 'skipped'`. It runs after a failure, because that is when the report is wanted. It doesn't run on a run a newer push cancelled (`always()` would) or when `checks` failed and no shard ran. It:
  1. installs the lockfile's packages (`npm ci`), because `merge-reports` must be the Playwright version that wrote the blobs; no browser is needed;
  2. downloads `blob-report-*` into one folder (`download-artifact@v8`, `merge-multiple`);
  3. runs `npx playwright merge-reports --reporter html,json`, writing the JSON into the report folder (`playwright-report/results.json`);
  4. writes a table to the step summary, one row per browser (tests, passed, flaky, failed, skipped), followed by each failed or flaky test by name (`scripts/ci-report-summary.mjs`). If a shard never uploaded, its browser shows too few tests;
  5. uploads **`playwright-report-unified`** (the HTML report, its traces and `results.json`), kept 30 days.
- **The job only reports.** A failed test already fails its own E2E job and the run.
- **The per-shard HTML reports are gone.** The unified report has every shard's tests and every kept trace.

**Rejected:**
- **`if: always()`:** it also runs on a run that a newer push cancelled (`cancel-in-progress`), merging partial results nobody will read.
- **Keeping the per-shard HTML reports as well:** each would be a second copy of results and traces the merged report already holds. Six blobs plus the merged report upload 1.08 MB a run, against 1.67 MB for the six HTML reports before.
- **Skipping `npm ci` in the merge job** (`npx playwright@<version>`): it saves about 10 s at the risk of a version that differs from the one that wrote the blobs.
- **Failing the merge job on a short count:** a missing shard is already a failed or cancelled E2E job. The summary table shows the count without hard-coding 149.

## Verification

- **Lint** clean; **unit** 829/829 in 32 files. No `src/` or spec change.
- **Locally**, three CI-style blob runs (chromium shards 1 and 2 of `theme.spec.ts` plus a probe spec, Firefox shard 1) merged into one report: 5 chromium and 2 Firefox tests, the probe's failure and flaky test named, and both first-attempt traces linked from their attempts and present in `data/`.
  - The blob reporter empties `blob-report/` when a run starts, so one checkout can't hold two shards' blobs. On CI every job starts from a fresh checkout.
- **CI run `37266494042` (`002f8b3`):** all seven E2E-side jobs green, then the merge job in 21 s. The unified report holds **447 runs, 149 per browser**: chromium 149 passed; Firefox and WebKit 148 passed and 1 skipped each (the Chromium-only load test). That is the same total as the full local suite. End to end 268 s, of which chromium 2/2 waited 36 s for a runner.
- **Negative control, run `37266863298` (`a927893`):** a temporary spec with a test that always fails and one that fails only on its first attempt.
  - Three shards failed (chromium 2/2, Firefox 2/2, WebKit 2/2), and the merge job still ran and published.
  - The summary showed 151 tests per browser with 1 flaky and 1 failed in each, naming all six.
  - The report links each of the six first-attempt traces to its test, from three different shards, and every trace file is in `data/`. The WebKit trace holds the action trace, network log, call stacks and test source, with no screenshots (ADR `0060`).
  - Reverted in `4259587`.
- **CI run `37267237910` (`4259587`, after the revert):** green with no flaky test, 149 per browser again (445 passed, 2 skipped), 247 s end to end.
- **The merge job's cost:** Over five runs (the PR's four and `main`'s) the merge job took 17 to 25 s (21, 21, 17, 25 and 21 s), starting within seconds of the last shard. `npm ci` is 9 to 11 s of that, and the merge itself 1 to 2 s.
- `main` CI on the merge (run `37268674557`) passed every job with no flaky test in 286 s end to end; its merge job took 21 s, and the unified report holds 149 tests per browser (445 passed, 2 skipped).

## Consequences

- **A run's results are one artifact:** `playwright-report-unified`. Open its `index.html` with `npx playwright show-report <folder>` to use the trace viewer. The step summary of "Merge the E2E reports" gives the per-browser count without downloading anything.
- **`results.json` makes a run machine-readable,** which Phase 85's analysis had to dig out of six HTML pages.
- **A run takes about 20 to 25 s longer end to end,** because the merge starts after the slowest shard. That is less than the 37 s one shard waited for a runner in Phase 85.
- **The merged report's data lists each project name twice** (`projectNames`), once per shard. Every test still carries its one browser name.
- **The CI job logs now list every test** (`list`), not only the totals.
- **Locally nothing changes:** the HTML reporter, `on-first-retry` traces and 4 workers.
