# 0044: The browser jobs run in Playwright's container image, so CI installs no OS packages

**Status:** Accepted and released. Commit `3b8a180` (docs `147753d`), merged into `main` as `33eebde` (PR #18). PR run `37087564638` passed on four attempts, then `37089300857`, then push run `37091502761` on `main`. Vercel `dpl_GDc711VKqjfDjxXq2u8mgXahNaFQ` is READY in production and serves the same entry as before, `index-BFWd6EeO.js` at 188,651 B: no app file changed.
- **Amends** Phase 55's CI setup (T199 and T200, no ADR of its own): the browser cache keyed by the lockfile and the `install-deps` step on a cache hit are gone.
- **Keeps** the `checks` job, the one-job-per-browser matrix with `fail-fast: false`, 2 workers with retries, the 30 minute limit, `concurrency` and `paths-ignore` (T199, T201, T202).

**Date:** 2026-10-03

## Context

- **What CI did.** Each of the three E2E jobs (chromium, firefox, webkit) restored its browser from `actions/cache`, keyed by `package-lock.json`, then ran `npx playwright install-deps <browser>`. The browser binaries were cached; the OS packages they need (fonts, codecs, GTK and so on) were not, so every job ran `apt-get` against the Ubuntu mirror.
- **What that cost.** Over the 40 runs from 2026-09-28 to 2026-10-02 (117 E2E jobs):
  - `install-deps` took a median of 23 s;
  - three times in two days it took **5.6, 10.8 and 19.3 minutes** (runs `36881986291` firefox, `37027020930` webkit, `36876112983` webkit);
  - the worst job ran 22 of its 30 minutes.
- **The cause was the mirror.** The 19.3 minute log shows `azure.archive.ubuntu.com` serving font and codec packages with pauses of 28 to 175 s between downloads (`fonts-wqy-zenhei`, `libcodec2`, `libflite1`, `libavcodec60`). Nothing in Playwright or the workflow was slow.
- **Nothing had failed yet.** But the margin was 8 minutes, and a slower mirror day would fail a correct PR on time alone, the same kind of blocker as the diary test's time zone (PR #17).

## Decision

- **The `e2e` job runs in `mcr.microsoft.com/playwright:v1.63.0-noble`.** The image holds the three browsers for Playwright 1.63.0 under `/ms-playwright` and every OS package they need, so no job runs apt or downloads a browser.
- **`options: --user 1001`**, as Playwright's CI guide does. 1001 is the runner's own user:
  - the checkout, `node_modules` and the `dev-dist/` that the port 3100 server writes stay owned by the user that reads them;
  - `$HOME` (`/github/home`) belongs to the user running the browsers. Firefox refuses to start as root under a home owned by someone else; as 1001 the question does not arise, so no `HOME: /root` is needed.
- **The version is written once**, as a one-value matrix dimension, `playwright: [ '1.63.0' ]`, used for the image tag. A step before the tests compares it with the `@playwright/test` that `npm ci` installed and fails with `package-lock.json installs Playwright X, but the container is vY` when they differ. Without it, a lockfile bump would fail all 141 tests per browser with a missing executable.
- **Removed:** the `Cache Playwright browser` step and both install steps.
- **Unchanged:** Node 22 through `actions/setup-node` with its npm cache (the image's own Node is not used, so `checks` and `e2e` run the same Node), `npm ci`, the test command, `CI: true` and the report upload.

## Verification

- **PR run `37087564638`, four attempts, all green:** unit 615/615 and 141/141 on each of chromium, firefox and webkit every time, none flaky. That covers the second webServer (port 3100, `--mode pwa-dev`, its service worker and `dev-dist/`) as uid 1001.
- **After the merge:** Push run `37091502761` on `33eebde` passed: unit 615/615, and 141/141 on each of chromium, firefox and webkit in the container (jobs 199 / 234 / 248 s, setup 40 to 54 s, image pull 26 to 42 s, the whole run 303 s). Over all 18 container jobs (the four attempts, `37089300857` and the push run) setup took 40 to 54 s and the image pull 24 to 42 s.
- **The version check** run locally both ways: equal versions pass; `1.64.0` against the installed 1.63.0 exits 1 with the message.
- **Timing** (scratchpad `cijobs.py`: setup is job start to the test step; tests is the test step):

  | | jobs | setup median | setup max | tests median | job median | job max |
  |---|---|---|---|---|---|---|
  | Before, all 40 runs | 117 | 43 s | 1,171 s | 156 s | 204 s | 1,328 s |
  | Before, the same 141-test suite (3 runs) | 9 | 39 s | 663 s | 172 s | 219 s | 871 s |
  | After, the container (4 attempts) | 12 | 44 s | **52 s** | 176 s | 222 s | **265 s** |

  - **Setup:** 40 to 52 s in every job. Pulling the image ("Initialize containers") took 24 to 39 s; `npm ci` 6 to 13 s.
  - **Tests:** unchanged against the same suite (chromium 130 to 143 s against 127 to 145; firefox 166 to 191 against 172 to 193; webkit 155 to 214 against 169 to 205). The 40-run medians are lower only because the suite grew from 119 to 141 tests in that window.
  - **Whole runs** (first job start to last job end): 323, 308, 324 and 271 s, against 284 and 326 s for the 141-test baseline runs on a normal day and 924 s for PR #16's run, which hit the slow mirror.

## Consequences

- **A typical run is no faster.** The median setup is about 5 s longer (the image pull replaces a cache restore and a 23 s apt run). What changes is the tail: the worst setup in 12 jobs was 52 s, where 3 of the previous 117 took 5 to 19 minutes.
- **Updating Playwright is now two edits:** the lockfile, and `matrix.playwright` in the workflow. The check step names the second if it is forgotten. Local runs are unaffected: they use the browsers `npx playwright install` puts in `~/.cache/ms-playwright`.
- **The image pull is the new external dependency.** It comes from `mcr.microsoft.com` rather than the Ubuntu mirror, and 12 pulls took 24 to 39 s. Its tail is not known yet; if it ever runs long, the cost appears in the "Initialize containers" step.
- **Containers run only on Linux runners**, which the workflow already pins (`ubuntu-24.04`).
