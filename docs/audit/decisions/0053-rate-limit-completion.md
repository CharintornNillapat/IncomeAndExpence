# 0053: Every 429 says how long to wait, or the client works it out

**Status:** Accepted and released. Commit `05d103c` (docs `c87020e`, hash backfill `9c49a8c`), merged into `main` as `07d51f1` (PR #27). Vercel `dpl_FetmkPeDZf6qNf3Aea6bH5cXQQWG` is READY in production (`icn1`): its `TransactionForm` chunk reads `X-Vercel-Mitigated` and its `TransactionsView` chunk has the `firewall` branch, and a guest `POST {}` still gets 400 from `sin1::icn1`. `main` CI on the merge passed, all four jobs (run `37178250544`).
- **Extends** ADR `0052`. That ADR waited out a 429's `Retry-After`; this one covers the two 429s that had none:
  - TypeSafe's own 429, whose wait the proxies dropped;
  - the guest firewall's.
- **Amends** ADR `0022`, where only the upstream status crossed the proxy.

**Date:** 2026-10-04

## Context

Three things can answer `/api/classify` or `/api/insights` with 429:

| Source | Who it limits | `Retry-After` before this ADR |
|---|---|---|
| The proxy's per-account count (ADR `0049`) | signed in, 120 a minute | yes, 1 to 60 s |
| TypeSafe itself, passed through (ADR `0022`) | everyone | dropped by the proxy |
| The Vercel firewall rule (ADR `0046`) | guests, 30 a minute per IP | none |

After ADR `0052`, only the first was waited out. A 429 from either of the others got the old per-row retry after 400 ms, inside the same exhausted window, so a guest import of more than 30 distinct notes left everything past the 30th blank.

### What the firewall's 429 looks like (measured on production, 2026-10-04)

The probe sent 31 guest `POST {}` requests to `/api/classify`. An empty body gets 400 before any TypeSafe call, so the probe cost nothing.
- **Requests 1 to 30** got 400. **Request 31** got 429 at 03:09:29 UTC, with these headers:

  ```
  HTTP/1.1 429 Too Many Requests
  Cache-Control: private, no-store, max-age=0
  Content-Type: application/json
  Server: Vercel
  X-Vercel-Id: sin1::pdpsm-1791083369896-39ff45fd70ae
  X-Vercel-Mitigated: deny
  ```

  The body was `{"error":{"code":"429","message":"Too Many Requests","id":"sin1::..."}}`.
- **What the 429 lacks:**
  - no `Retry-After`;
  - no `Server-Timing`;
  - its `X-Vercel-Id` names no function region (`sin1::` only, against `sin1::icn1::` on the 400s), so the request never reached a function.
- **When the window reopens.** Polled every 2 s after the refusal, the guest got 429 until 03:10:17 and 400 at 03:10:19. The first request had gone out at 03:09:17.
- **A second probe timed to the millisecond:**
  - the 30 requests took 8.8 s, and the 31st got 429;
  - a request sent 59.87 s after the first got 429, and one sent at 60.37 s got 400.

  So the window runs for 60 s from its own first request. It is not aligned to the clock's minute, and the refusals sent while it was closed (one every 2 s in the first probe) did not move it.

### TypeSafe's 429

TypeSafe's SDKs expose a server retry delay on their rate-limit error (`RateLimitError.retryAfterMs` in JavaScript, `retry_after_ms` in Python, "parsed from headers"). The docs do not name the header. It has not been seen live: seeing it would mean exhausting TypeSafe's own limit with paid requests.

## Decision

- **The proxies forward TypeSafe's wait.**
  - On an upstream 429, `upstreamRetryAfter` reads `retry-after-ms` first, then `Retry-After` (delay-seconds or an HTTP date). It sends the result as `Retry-After` in whole seconds, rounded up.
  - **A date is turned into seconds on the server,** whose clock is nearer TypeSafe's than a phone's is.
  - **Capped at a day,** so a huge value stays a plain integer. The client stops past a minute anyway (ADR `0052`).
  - **Nothing usable** (absent, a word, a negative, a date already past) sends the 429 without the header, as before.
  - **Only this header crosses over.** The upstream body and every other header stay behind (ADR `0022`), and no other status gets a `Retry-After`.
  - Duplicated in both files, like `checkCaller` and `checkQuota`.
- **`classifyOnce` names the firewall's 429.**
  - A 429 with no usable `Retry-After` and `X-Vercel-Mitigated: deny` (trimmed, any case) is `{ kind: 'rate-limited', firewall: true }`.
  - The request is same-origin, so the header is readable without CORS exposure.
  - **A `Retry-After` wins** when both are present.
  - **Another mitigation** (`challenge`) is not read as the guest limit.
- **`classifyBatch` waits out the guest window,** with the same shared pause and countdown as ADR `0052`.
  - **The estimate.** The run keeps its own estimate of the window: it starts with the first request the run sends, and a request sent 60 s or more after that starts the next window. A 429 marked `firewall` pauses every worker until 60 s + 1 s after that start.
    - The extra second is because the firewall starts its window when the request arrives, after the run sent it.
    - The probe's run would have resumed 52 s after its refusal instead of 60.
  - **When the estimate is already over** (within the 400 ms floor), the run's own requests were not the only ones counted: another tab, Quick Add, or the same network. That window began earlier and cannot be known, so the run waits a whole 60 s, which always clears it.
  - **Never more than 60 s,** so a firewall wait never trips ADR `0052`'s stop.
- **Unchanged:**
  - two attempts per row;
  - the 400 ms floor;
  - `Retry-After` from the per-account limit;
  - a 429 that is neither marked nor names a wait keeps the per-row 400 ms retry;
  - live typing (`classifyDescription`) and the insights card, which turn every 429 into "no suggestion" and the local summary.

**Rejected:**
- **Always waiting 60 s:** simpler, and always enough, but it adds back the time the run spent reaching the limit (8.8 s at the probe's pace) to every window. It is kept as the fallback.
- **Probing for the reopening with a request:** each probe is an attempt, and a refused retry gives its row up.
- **Reading the `Date` header:** the window is not aligned to the clock, so the server's time does not say when it ends.
- **A `Retry-After` from the firewall rule itself:** it could not be configured from here (the firewall API answers 404 for this project), and the dashboard was not checked for such an option.
- **Forwarding TypeSafe's body or other headers:** the body may echo request content (ADR `0022`).

## Verification

- **Unit** (+31; 739 -> 770):
  - **`proxy-contract.test.ts` +22,** 11 per endpoint through its `describe.each`:
    - a plain upstream 429 has no `Retry-After`;
    - forwarded as seconds: `7`; ` 12 `; `retry-after-ms: 2500` as `3`; `retry-after-ms` ahead of `Retry-After`; a huge value as `86400`; an HTTP date 20 s ahead as `20`;
    - dropped: a word, a negative, a past date, an empty value;
    - a 503 carrying `Retry-After` and `x-typesafe-request-id` forwards neither.
  - **`batch-classifier.test.ts` +9** (35 -> 44), on fake timers.
    - `classifyOnce`:
      - the firewall's 429 is marked, whatever the case of `deny`;
      - `Retry-After` wins when both are present;
      - `challenge` is not marked.
    - `classifyBatch`:
      - a refusal at 3 s resumes at exactly 61 s after the run's first request, reported as `resumesAt`, with every row answered;
      - a refused first request waits exactly 60 s;
      - an estimate already over waits a whole 60 s;
      - the first request after a pause starts a new window, so a second refusal resumes 61 s after it, not a minute after the refusal;
      - an unmarked 429 with no wait keeps the 400 ms retry.
- **Mutations** (each run against its test file): 20 of 20 caught.

  | Mutation | Tests failed |
  |---|---|
  | firewall branch removed | 4 |
  | no 1 s margin | 2 |
  | window never re-anchored | 1 |
  | no whole-window fallback | 1 |
  | no one-minute cap | 1 |
  | estimate from the refusal, not the window | 2 |
  | a per-row firewall wait, not shared | 2 |
  | the mark not read | 6 |
  | the mark read case-sensitively | 1 |
  | any mitigation read as the guest limit | 1 |
  | the mark preferred over `Retry-After` | 1 |
  | `classify`: wait not forwarded | 6 |
  | `insights`: wait not forwarded | 6 |
  | `classify`: `retry-after-ms` ignored | 2 |
  | `insights`: `retry-after-ms` ignored | 2 |
  | `classify`: no cap at a day | 1 |
  | `classify`: milliseconds rounded down | 1 |
  | `classify`: a past date forwarded | 2 |
  | `insights`: a past date forwarded | 2 |
  | `classify`: a wait forwarded on a 503 | 1 |

- **E2E** (`tests/csv-classify.spec.ts`, +1):
  - the firewall's 429, with production's headers, shows "Rate limit reached, continuing in 5x or 60 s", and Cancel ends the wait after one request;
  - **negative control:** with the mark ignored, it fails on chromium.
- **Gate:** lint clean; unit 770/770 in 29 files; Playwright 439/441 in 6.8 m; the 2 Firefox failures (a `page.goto` timeout in `account-and-mobile-nav.spec.ts`, a nav click never stable in `date-boundary.spec.ts`) passed 6/6 on re-run, three times each. **Bundle** (local builds with `.env`, gzip level 9): `TransactionsView` 33,955 -> 34,179 B (+224 B, +93 B gzip) and `TransactionForm` 25,742 -> 25,869 B (+127 B, +46 B gzip), the two lazy chunks that hold the classifier. The entry `index-*.js` is identical to `main`'s once its hashed chunk names are normalised.

## Consequences

- **A guest import larger than the firewall's limit finishes,** about 30 distinct notes a minute, with the countdown on screen, instead of leaving the rest blank.
- **A shared network or a second tab can make the estimate early.** The retry is then refused again, that one row stays blank, and the run pauses again.
- **TypeSafe's wait reaches the importer only if TypeSafe sends one.** Nothing changes if it does not.
- **Not seen on a real import yet,** for a guest or with TypeSafe's own 429; only the tests' mocked headers have shown it.
- **The window's behaviour was measured on one day,** from Thailand through `sin1`. If Vercel changes how the rule counts, the fallback still waits a whole minute whenever the estimate has run out.
