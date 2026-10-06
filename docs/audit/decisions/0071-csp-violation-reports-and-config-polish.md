# 0071: CSP violations are reported to /api/csp-report; the footer clears the nav exactly; Node 22 or later

**Status:** Accepted. Implemented on branch `phase-95-csp-telemetry-and-polish` (commit `57c7a06`, docs `c8c2934`), draft PR #46. Not merged yet.
- **Amends** ADR `0070`: the enforced policy gains `report-uri`, and the footer's margin loses the 1 px overlap ADR `0070` accepted.

**Date:** 2026-10-06

## Context

1. **A blocked request is invisible to us.** ADR `0070` enforced the Content Security Policy, and the policy had no report endpoint. A violation blocks something for the visitor and shows only in that visitor's console. The signed-in walk under the enforced policy (T571) is still to be done, so the first sign of a gap would be a user report, if any.
2. **The footer and the mobile nav overlapped by 1 px.** The footer's bottom margin was 4rem, and the nav is 65 px: a 52 px tab, 12 px of padding and a 1 px top border.
3. **No Node version was declared.** CI runs Node 22, and the functions run on Vercel's Node 24.x, but `package.json` said nothing.

## Decision

### 1. `api/csp-report.ts`

A Vercel function behind a named `POST` export, like the proxies. It calls no other service. Each violation becomes one line in the function's runtime log:

```json
{"event":"csp-violation","documentUrl":"https://<host>/","directive":"connect-src","blockedUrl":"https://<blocked origin>/<path>","disposition":"enforce","sourceFile":"https://<host>/assets/index-<hash>.js","line":2,"column":6513,"statusCode":200}
```

**Three report shapes**, all three seen from Playwright's browsers in this phase:
- an array of Reporting API objects, as `application/reports+json` (Firefox, when the policy has `report-to`);
- one Reporting API object, labelled `application/csp-report` (WebKit);
- the CSP2 `{ "csp-report": { ... } }` object, as `application/csp-report` (Chromium and Firefox through `report-uri`).

`application/json` is accepted too. Any other content type is 415. A body with no CSP violation is 400.

**Nobody signs a report, so the endpoint trusts nothing in it:**
- the body is at most 16 KB (413), and at most 10 violations are taken from one request;
- a URL is logged as its origin and path only, because a query or fragment can carry a token (a Supabase sign-in link puts one in the fragment);
- a keyword or scheme (`inline`, `data`) or an extension's origin keeps its text, and anything else is `[other]`;
- text fields keep only word characters and `.:'-`, and every string is cut to 200 characters;
- the caller's IP is used for counting and never logged.

**Rate limit:**
- **Limits:** 20 violations a minute per IP and 300 per instance, in a fixed window. Past either, the request gets 429 and nothing is logged.
- **Ceiling:** the count is in the instance's memory, so N warm instances accept N times as much. That bounds the log volume, which is the only cost a report has. ADR `0049` moved the AI quota into the database because a request there costs money; a report does not.
- **The firewall:** the Hobby plan's one rate-limit rule is already the AI proxies' (ADR `0046`).

### 2. `report-uri` only, no `report-to`

The policy ends `; report-uri /api/csp-report`. Phase 95's local walk served the built app with the real headers and the real handler, and caused one violation in each browser by dropping Supabase from `connect-src`:

| Policy | Chromium | Firefox | WebKit |
|---|---|---|---|
| `report-uri` + `report-to` with `Reporting-Endpoints` (relative URL) | nothing in 150 s | delivered (`reports+json`) | delivered |
| the same with an absolute endpoint URL | nothing in 150 s | not run | not run |
| `report-uri` alone | delivered at once | delivered | delivered |

A browser that supports `report-to` ignores `report-uri`, so adding `report-to` cost Chromium's reports entirely in this test. Chromium may queue Reporting API deliveries for longer, or only send them over HTTPS. Either way, `report-uri` is the form shown to work in all three browsers.

**When to add `report-to`:** only once a production check over HTTPS shows Chromium delivering through it.

`unit/security-headers.test.ts` pins `report-uri /api/csp-report` and the absence of `report-to` and `Reporting-Endpoints`.

### 3. The footer's margin is the nav's height

- `mb-[calc(4rem+1px+env(safe-area-inset-bottom,0.5rem))]`: the 52 px tab, 12 px of padding, the 1 px border, then the nav's own safe-area expression.
- `tests/safe-area.spec.ts` drops its 1 px allowance: the footer's bottom must be at or above the nav's top.

### 4. `"engines": { "node": ">=22.0.0" }`

- `package.json` declares it, and the lockfile root carries it, as npm writes it.
- **Vercel reads `engines.node` to pick the functions' runtime.** An open range resolves to the newest major, which is 24.x today, as before. The preview's build is where that is confirmed.

## Verification

- **`unit/csp-report.test.ts`** (new, 10 tests) covers:
  - the three shapes, with URLs cut to origin and path, so no fragment token or query reaches the log;
  - keywords, schemes and extension origins kept, free text hidden;
  - 200-character cuts and markup stripped;
  - 415, 413, 400 for bad JSON and 400 for no violation;
  - the 10-violation cap;
  - 20 per IP then 429 until the minute ends, with another IP counted apart;
  - 300 per instance;
  - the IP never logged.

  **Negative controls:**
  - logging the raw URL fails the two URL tests;
  - removing the limit check fails both rate-limit tests.
- **The walk with the committed policy:**
  - a violation produced one logged report in each of Chromium, Firefox and WebKit (204);
  - a walk without a violation sent none.
- **Gate:** in the refactor log.
- **On CI:** the pull request's run `37399307620` passed every job in 286 s, 456 passed and 6 skipped with no flaky test (WebKit's Jev test included), unit 1042; the drift workflow on the branch (`37399307758`) found no drift with all 17 migrations.
- **On the preview:** the Vercel preview (`dpl_8HwwiQMDTgcKP9GoJY9JohXCrras`) serves the policy with `report-uri /api/csp-report`, and its `/api/csp-report` answers a GET with 405 from `icn1`. Its build warns that `>=22.0.0` "will automatically upgrade when a new major Node.js Version is released": the functions follow Vercel's newest major, 24.x today, as before.

## Consequences

- **A violation on production now leaves a line** in the `csp-report` function's runtime log (`"event":"csp-violation"`), with the page and the blocked origin and path. Search the log for it before widening the policy.
- **Anybody can post a fake report.** The log is a hint, not evidence: a report names a directive and an origin, and the fix is checked by reproducing it.
- **The functions follow each new Node major.** An open `engines` range is what Vercel warns about: the next major reaches the functions without a commit. Pin a major (`"24.x"`) if a release ever needs holding back.
- **Browser extensions cause reports too.** An extension's own origin (`chrome-extension://...`) is logged as itself, so those are easy to tell apart and ignore.
