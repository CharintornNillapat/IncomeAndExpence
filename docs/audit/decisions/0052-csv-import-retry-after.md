# 0052: The CSV importer waits out a 429's Retry-After, once for the whole run

**Status:** Accepted and released. Commit `4d861f6` (docs `658f28d`, hash backfill `40e25f2`), merged into `main` as `23d73ed` (PR #26). Vercel `dpl_AWVqP3WTkaKHoBbojS4gKhyPR2GK` is READY in production (`icn1`), and its `TransactionsView` chunk carries "Rate limit reached, continuing in" and "Stopped early: the rate limit". `main` CI on the merge passed (run `37170048902`).
- **Amends** ADR `0019`'s rate-limit handling and ADR `0021`'s note on it: a 429 that names its wait is waited out; one that does not keeps the original 400 ms retry.
- **Uses** ADR `0049`'s `Retry-After`, which the client ignored until now.
- **Extended by** ADR `0053`: the proxies now forward TypeSafe's own wait, and the guest firewall's 429, which names none, is waited out too. The "Reading `Retry-After` from TypeSafe's own 429s" and guest notes below describe the state before it.

**Date:** 2026-10-04

## Context

- **What the importer did with a 429** (ADR `0019`): `classifyOnce` reported `rate-limited`, and `classifyBatch` retried that row once after 400 ms, then left it blank. Four requests run at a time, and each did this on its own.
- **What a 429 means now.** Since ADR `0049` a signed-in caller is limited to 120 classifications a minute per account. The proxy's 429 carries `Retry-After`: the seconds until that minute turns over, 1 to 60. A guest's 429 comes from the firewall (ADR `0046`), whose recorded headers have no `Retry-After`.
- **The result: an import of more than 120 distinct notes in a minute lost the rest.** After the 120th, every row's request and its retry fell inside the same exhausted minute, and the remaining rows came back blank. Their keyword-rule categories stayed, but no AI suggestion was even tried.

## Decision

- **`classifyOnce` reads `Retry-After`.** The `rate-limited` outcome gains `retryAfterMs` when the header holds delay-seconds or an HTTP date in the future. A missing, unreadable or past value leaves it out.
  - `classifyDescription`, the live-typing path, is unchanged. It still turns every outcome but `ok` into `null` (ADR `0019` froze it).
- **One pause for the whole run.** The limit is per account, so a 429 on one row means the next request from any worker would get one too.
  - A 429 with `retryAfterMs` sets a shared `resumesAt`. Every worker waits until then before its next request, and the refused row is retried after it.
  - The wait is never shorter than the old 400 ms, so `Retry-After: 0` cannot turn the retry into an immediate second hit.
- **A ceiling of one minute** (`MAX_RETRY_AFTER_MS`, the per-account window). A longer `Retry-After` comes from some other limit.
  - The run stops there instead of holding the preview open: `rateLimited: true`.
  - Answers that arrived before the stop are kept and applied as usual, and the rest stay blank.
- **Unchanged:**
  - **A 429 without `Retry-After`** (the guest firewall) keeps the per-row 400 ms retry.
  - **Two attempts per row, counting the first** (`MAX_ATTEMPTS`). A retry refused again gives that row up without stopping the run.
  - **Four requests at a time.**
- **What the user sees** (`ImportCsvModal`):
  - while paused, the progress line reads "Classifying 40 of 150 with Jev. Rate limit reached, continuing in 23 s." It counts down once a second, and the clock runs only during the pause;
  - Cancel stays available and ends the wait at once;
  - a run stopped at the ceiling ends with its usual note plus "Stopped early: the rate limit asked for a wait of over a minute, so the rest stay blank.";
  - the import commits either way.

**Rejected:**
- **A per-row wait** (each worker sleeps on its own 429): three other workers would keep sending into the same exhausted minute. A mutation shows the difference (2 tests fail).
- **More attempts per row:** with the shared pause, one retry lands in a fresh window, so a third adds nothing for the per-account limit.
- **Waiting any length:** an hour's `Retry-After` from an unknown limit would hold the dialog open with a countdown nobody wants.
- **Reading `Retry-After` from TypeSafe's own 429s:** the proxy passes the status through but not the header (ADR `0022`); not changed here.

## Verification

- **Unit** (`unit/batch-classifier.test.ts`, +14; 21 -> 35, so 725 -> 739). `fetch` is stubbed, and the timings run on fake timers.
  - **`classifyOnce`:**
    - reads `Retry-After: 30` as 30 000 ms, and an HTTP date 5 s ahead as 5 000 ms;
    - leaves the wait out with no header, a word, a negative number or a past date.
  - **`classifyBatch`:**
    - waits `Retry-After: 5` (not 400 ms) before the retry, and takes the answer;
    - never retries sooner than 400 ms, even on `Retry-After: 0`;
    - with eight rows, one 429 of 3 s holds all four workers: no request between 10 ms and 2 999 ms, then the run finishes all eight with nine requests;
    - reports `resumesAt` when the pause starts, a progress without it when the pause ends, then the row;
    - stops at `Retry-After: 120`: `rateLimited`, the three requests already in flight finish and keep their answers, and nothing new goes out;
    - accepts exactly 60 s;
    - gives a row up when its retry is refused too, without stopping the run;
    - ends at once when cancelled during the wait, with no further request.
  - One existing test compared the whole result object and now includes `rateLimited: false`.
- **Mutations** (each run against the file):

  | Mutation | Tests failed |
  |---|---|
  | `Retry-After` ignored | 5 |
  | no pause before a request | 5 |
  | a pause per row, not shared | 2 |
  | no one-minute ceiling | 1 |
  | the ceiling at `>=` | 1 |
  | no 400 ms floor | 1 |
  | the resume time not reported | 1 |
  | seconds read as milliseconds | 6 |
  | a past date accepted | 2 |
  | workers keep taking rows after the stop | 0 |

  The last one survives because `runOne` checks `rateLimited` itself before any request, so the worker loop's check changes no request and no result. It only stops skipped rows from counting as done in the progress line before the run ends. Kept for symmetry with `unavailable`.
- **E2E** (`tests/csv-classify.spec.ts`, +2; 144 -> 146 tests, 432 -> 438 runs):
  - a 429 with `Retry-After: 2` shows "Rate limit reached, continuing in" with Cancel offered, then the row gets its category and the wait line goes; two requests;
  - `Retry-After: 120` ends with "Stopped early: ...", one request, and the import still commits.
  - **Negative control:** with `Retry-After` ignored, both fail on chromium.
- **Gate:** lint clean; unit 739/739 in 29 files; Playwright 438/438 in 6.5 m. **Bundle** (local builds with `.env`, gzip level 9): `TransactionsView` 33,033 -> 33,955 B (+922 B, +370 B gzip) and `TransactionForm` 25,486 -> 25,742 B (+256 B, +122 B gzip), the two lazy chunks that hold the classifier and the import preview. The entry `index-*.js` stays 189,481 B and is identical to `main`'s once its 55 hashed chunk names are normalised (gzip +2 B from those names).

## Consequences

- **A signed-in import larger than the limit finishes,** one minute's worth of rows at a time, instead of leaving everything past the 120th blank. The preview stays open while it waits.
- **A guest's import is as before:** the firewall's 429 carried no `Retry-After` when ADR `0046` recorded its headers, so rows past 30 a minute still come back blank after one 400 ms retry. Whether the rule can be made to send one was not checked.
- **The countdown is visual only;** the progress line is not a live region, as before.
- **Not seen on production yet.** The pause needs a signed-in import of more than 120 distinct notes in a minute; only the tests' simulated 429 has shown it.
