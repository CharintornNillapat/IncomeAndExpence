# 0061: CI time follows the runner; each browser runs as two shards

**Status:** Accepted. Implemented on branch `phase-85-ci-timing-profiling` (runner step `87c4a42`, shards `f0dbd3d` and `7dcb1ca`, docs `0ecf79f`, hash backfill `9921810`), merged into `main` as `be78622` (PR #35). Vercel `dpl_2e5mqEA9WeM667yihCxp2AeFcz3r` is READY in production (`icn1`), serving the same entry as before: this phase changed no app code.
- **Amends** Phase 55's CI layout (one E2E job per browser): two jobs per browser now, still 2 workers each.

**Date:** 2026-10-05

## Context

After ADR `0060`, CI's WebKit job took 3.2 m on some runs and 4.2 to 4.3 m on others with the same code and settings. Three explanations were open:
1. the runner (host contention or a cold machine);
2. the Vite dev server compiling on first request, landing on particular tests;
3. a group of specs waiting on WebKit's actionability or rendering.

## Investigation

**Data:** the 20 most recent CI runs (2026-10-04 04:52 to 2026-10-05 02:00 UTC), 60 E2E jobs:
- each job's step timings from the Actions API;
- its log, which names the runner's Azure region;
- its HTML report, whose embedded data gives every test result's duration, start, worker and retry (8,922 results).

`npm ci` runs the same work in every job, so its time stood in for the machine's speed until the jobs printed their CPU (below).

### 1. The runner explains it

| | r(`npm ci` time, test step) | Test step, `npm ci` <= 8 s | Test step, `npm ci` >= 9 s | Ratio |
|---|---|---|---|---|
| WebKit | +0.76 | 182 s mean (5 jobs) | 237 s mean (15 jobs) | 1.30 |
| Firefox | +0.83 | 173 s (7) | 211 s (13) | 1.22 |
| chromium | +0.49 | 145 s (8) | 164 s (12) | 1.13 |

- **The slowdown is even across tests.** Comparing each test's median on slow against fast runners (untraced runs), WebKit tests took 1.33 times as long (interquartile range 1.25 to 1.41, 147 tests), Firefox 1.20, chromium 1.06. No test or file stands out.
- **The 3.2 m runs were fast machines** (`npm ci` 7 s); the 4.2 to 4.3 m runs slow ones (10 to 11 s).
- **The region does not decide it.** Nine regions appear; `centralus` alone ranged 180 to 268 s in WebKit.
- **The CPU does, mostly.** With the new "Describe the runner" step, the jobs ran on four CPU models, every one with 4 CPUs and 15.6 GiB. WebKit seconds per test at 2 workers:

| CPU | WebKit s per test |
|---|---|
| AMD EPYC 9V45 | 2.30 to 2.42 |
| Intel Xeon Platinum 8573C | 2.89 to 3.08 |
| AMD EPYC 7763 | 3.21 to 3.46 |
| AMD EPYC 9V74 | 3.29 |

EPYC 9V74 jobs ran `npm ci` in anything from 7 to 10 s across regions, so a busy host counts as well as the CPU.

### 2. Not the dev server

- **Startup is short:** from the test step's start to Playwright's first test (both dev servers booting, then global setup warming port 3100), median 6.4 s on fast runners and 8.8 s on slow ones (42 of the 60 logs; the rest did not match the pattern used).
- **The warm-up itself** took a median 3.5 and 4.3 s.
- **No cold-compile penalty:** each worker's first test took 1 to 5 s.

### 3. Not a group of specs

- Wall time is the summed test time over 2 workers plus that startup: no straggler.
- The slowest tests took 5 to 7 s, the same ledger tests in every run, against a 60 s test timeout. Targeted timeouts would change nothing.
- No lean-trace run retried a test.
- **Tracing is a fixed tax:** ADR `0060`'s trace made each WebKit test a median 1.17 times as long on slow runners and 1.13 on fast ones (Firefox 1.06 and 1.12, chromium 1.22 and 1.12), evenly.

## Options measured on CI

Three runs each, the runner recorded:

| Setup | End to end (first job start to last job end) | Slowest E2E job | E2E runner time | Result |
|---|---|---|---|---|
| 2 workers, one job per browser (before) | 320, 336, 362 s | 261 to 307 s | 11.5 to 13.7 min | all green |
| 3 workers, one job per browser | 322, 339, 344 s | 276 to 285 s | 11.6 to 12.4 min | all green |
| 2 workers, two shards per browser | 233, 237, 242 s | 184 to 195 s | 16.3 to 16.6 min | all 18 jobs green |

- **3 workers:** on the same EPYC 7763 machines each browser's test step was only 7 to 13% shorter (WebKit 236 and 240 s against 258), and the summed test time rose by a third (WebKit 660 and 674 s against 488): four CPUs shared by three browsers. That spends the timeout headroom a slow machine needs.
- **Two shards:** each shard runs half of a browser's tests on its own runner, at the same per-test speed. The slowest job lost about 100 s; a job's fixed cost (about 45 to 60 s of container, checkout and `npm ci`) is paid twice.

## Decision

- **Two shards per browser** (`shard: [ 1, 2 ]`, `--shard=N/2`), **2 workers per runner**, unchanged. Halving each job also halves the machine's swing: on a slow runner a shard's test step is about 120 to 140 s, against 250 to 260 s for the whole browser.
- **Each E2E job prints its runner** ("Describe the runner": CPUs, model and memory) in its log and step summary, so a slow run is read against its machine first.
- **No timeout change, no test reordering, no pre-bundling:** nothing in the suite is slow on its own.

**Rejected:**
- **3 workers:** above.
- **Larger runners:** a paid plan feature; the variance is between machine generations, not their size.
- **A merged HTML report** (Playwright's blob reporter and a merge job): one more job on every run, for convenience only. Each shard uploads its own report.

## Verification

- **Lint** clean; **unit** 829/829 in 32 files.
- **Full suite locally** (4 workers, no shards): 445 passed and 2 skipped (by design) of 447, in 7.7 m, first pass.
- **CI:** the three sharded attempts of run `37260900256` passed all 18 jobs with no flaky test; each browser's two shards covered 149 tests (75 + 74; Firefox and WebKit skip the Chromium-only load test).
- On the kept configuration, CI run `37262774619` (`7dcb1ca`) passed in 247 s end to end and run `37263171161` (`0ecf79f`) in 286 s, of which 37 s was one WebKit shard waiting for a runner (the `checks` job 51 s, the slowest job 196 s); both green with no flaky test.
- `main` CI on the merge (run `37264903718`) passed every job with no flaky test in 237 s end to end (`checks` 47 s, the slowest job 185 s), with both WebKit shards on AMD EPYC 7763 runners, the slowest CPU measured: chromium 75 + 74 passed, Firefox and WebKit 75 + 73 passed and 1 skipped each. The PR's last run, on the hash backfill `9921810` (run `37263626581`), passed in 280 s.

## Consequences

- **Six E2E jobs per run.** A failure appears in its shard's artifact, `playwright-report-<browser>-<shard>`.
- **Six jobs need six runners at once.** When one has to wait, the run waits: 37 s on run `37263171161`.
- **About 4 more runner-minutes per run** (16.3 to 16.6 against 11.5 to 13.7). The repository is public, so they cost nothing; if it ever turns private, weigh them against the plan's minutes.
- **A run's time still depends on the machines it draws;** compare a job's time with its "Runner:" line before blaming a change.
- **Still open:** WebKit on Windows stops painting now and then (ADR `0058`), locally only.
