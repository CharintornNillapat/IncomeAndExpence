# 0050: The AI proxies time their steps in a Server-Timing header

**Status:** Accepted. Implemented on branch `phase-74-server-timing`, draft PR. Not merged yet.
- **Answers** ADR `0049`'s open measurement: the time `consume_ai_quota()` adds to a signed-in request.
- **Changes no behaviour:** every status, body and existing header is as before.

**Date:** 2026-10-03

## Context

- **ADR `0049` could not measure its own cost.** After the release, a signed-in classification took 697 ms and 886 ms in the owner's DevTools against 0.41 s for a guest's empty body. The two are not comparable: the signed-in figures include TypeSafe's answer, the guest's stop at 400 before any TypeSafe call. The gap mixed the sign-in check, the count's round trip to Seoul and the model in proportions nothing could separate.
- **Vercel's runtime logs returned nothing** for this project over the 24 hours checked, so the functions' own durations were not available there either.
- **`Server-Timing`** is a standard response header that browsers show in DevTools beside each request's timing. A response can carry it without any client change.

## Decision

- **Every response either proxy writes carries `Server-Timing`,** naming the steps that ran, in the order they finished, each with its duration in milliseconds to one decimal:

  | Step | What it times | Present when |
  |---|---|---|
  | `auth` | the `/auth/v1/user` check (ADR `0032`) | the request had a well-formed token |
  | `quota` | the `consume_ai_quota()` round trip (ADR `0049`) | the token was accepted |
  | `ai` | TypeSafe, from the request until its response headers arrive | the body was valid |
  | `total` | the whole handler | always |

  For example: `Server-Timing: auth;dur=212.4, quota;dur=187.9, ai;dur=301.2, total;dur=704.6`.
- **A remembered token is `auth;dur=0.0;desc="cached"`.** `checkCaller` skips the auth server for a token it verified in the last minute on the same instance; the header says so instead of leaving `auth` out, which would make a cached request look like a guest's.
- **A step that did not run is absent**, never zero: a guest has no `auth` or `quota`, a request refused before TypeSafe has no `ai`, a 404 for a missing key has only `total`.
- **A step that throws is still timed** (`timed()` records in a `finally`), so an auth server that cannot be reached shows how long it was waited for.
- **`ai` ends at TypeSafe's response headers;** reading its JSON body is left out. The body is small and follows at once.
- **How it is built:** `POST` is now a thin wrapper. It times the handler as `total` and sets the header on whatever response comes back, so no `return` inside the handler needs to remember it. `timed()` and `serverTimingHeader()` are duplicated in both proxies, like `checkCaller` and `checkQuota` (ADR `0032`).
- **Nothing in the app reads it.** It is for DevTools and for a measurement taken from outside, like the bursts in ADR `0046`.

**What the header exposes, and why that is acceptable:**
- Only step names, durations and the one fixed description `cached`. No id, token, account, request content or upstream body.
- **Whether a token was cached on that instance:** only for the token the caller itself sent, which it already holds.
- **TypeSafe's and Supabase's response times:** they are not secrets, and the caller could measure the total already.
- **A firewall 429 carries no header:** the edge answers it, and the function never runs.

**Rejected:**
- **Logging the durations with `console.log`** (they would land in the runtime logs): those returned nothing for this project, and a log line per request is noise the proxies have avoided so far.
- **Timing in the client:** the browser sees only the total, which is the problem.

## Verification

- **Unit** (`unit/proxy-contract.test.ts`, +18; 97 -> 115, so 707 -> 725). The stub delays auth 20 ms, the count 30 ms and TypeSafe 40 ms, so each duration is checked against its own step. For each proxy:
  - a signed-in 200 names `auth`, `quota`, `ai` and `total` in that order, each at least its step's delay (less 5 ms of timer slack), and `total` at least their sum;
  - a remembered token is `auth;dur=0.0;desc="cached"`, with `quota` still timed;
  - a guest's 200 has `ai` and `total` only;
  - a quota 429 has `auth`, `quota` and `total`, and keeps its `Retry-After`;
  - a refused token has `auth` and `total`; an auth server that cannot be reached is still timed (503);
  - a TypeSafe failure keeps `ai`;
  - a body refused before TypeSafe has no `ai` (signed in and as a guest);
  - a malformed header and a missing key have `total` only.
  - Every header matches one pattern: `name;dur=N.N`, with `;desc="cached"` the only description.
  - The file passed five runs in a row.
- **Mutations** (`api/classify.ts`, of 115):

  | Mutation | Tests failed |
  |---|---|
  | the header not set | 9 |
  | `ai` not timed | 3 |
  | a cached token not recorded | 1 |
  | `quota` timed for guests too | 2 |
  | a step that throws not recorded (no `finally`) | 1 |
  | `total` started after the handler | 1 |
  | the count timed as `auth` | 5 |

- **E2E:** no change. Every spec answers `/api/*` itself, so the proxies never run in Playwright; the suite is the regression check that nothing else moved.
- **Gate:** lint clean; unit 725/725 in 29 files; Playwright 431/432 in 7.4 m; the one failure was Firefox timing out loading the dev server's page (`page.goto`, 30 s) in `jev-classify.spec.ts:209`'s setup, before the test body ran and in a spec that never reaches the proxies; that spec then passed 27/27 on Firefox (`--repeat-each=3`).

## Consequences

- **The quota's cost can be read on any signed-in request** in DevTools, and the platform's share is the request's total less the header's `total`.
- **A new step in a proxy** gets a name here and in the `Timings` type of both files, and its own test.
- **The header is public:** anything later added to a `desc` reaches every caller. Keep descriptions to fixed words.
