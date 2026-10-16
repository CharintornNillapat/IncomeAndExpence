# Vercel functions, proxies and response headers

Read this before touching `api/`, `vercel.json`, `index.html`'s inline script, or the client modules that call `/api/*` (`jevClassifier.ts`, `batchClassifier.ts`, `insightsClient.ts`). **Never call the production `/api/*` endpoints**: they spend TypeSafe credits and count against live quotas. The unit suite calls the handlers directly. Reasons live in the ADRs named in brackets.

## The three functions

| File | Purpose |
|---|---|
| `api/classify.ts` | Jev classification proxy for live typing and the CSV import [0011, 0019] |
| `api/insights.ts` | Monthly spending pattern proxy, accounts only [0020, 0088] |
| `api/csp-report.ts` | CSP violation sink, one log line per violation [0071] |

- **Named method exports only (`export async function POST`), never `export default`.** Vercel calls a default export as `(req, res)` and discards a returned `Response`, so the request hangs 60 s with no error. `tsc` and the mocked suites cannot see it.
- **`api/` has its own `api/tsconfig.json`;** `npm run lint` runs both configs. Never add `"types": ["node"]` to the root config.
- **`npm run dev` does not serve `api/`.** The AI features are inert under Vite and in Playwright; use `vercel dev` only with the owner's go-ahead.
- **Functions run in `icn1`** (`vercel.json` `regions`, [0051]), beside the database. Do not add a region or a key to `vercel.json` without measuring `Server-Timing` on production before and after; never delete the file.

## The TypeSafe key and the request shape

- **`TYPESAFE_API_KEY` has no `VITE_` prefix,** so it never reaches the bundle. A missing key answers **404**, so the client latches off exactly as for a missing endpoint.
- **The browser cannot call TypeSafe** (it returns 400 for browser origins), so the proxy is mandatory.
- **The proxy owns the question wording** and rejects any client-supplied `instructions`, `criteria`, `model`, `state` or `questions`; otherwise it is an open relay on the project's key.
- **Categories are rendered as `"<name>: <description>"`.** Keep shipped descriptions concrete and situational.
- **Do not install `@typesafe-ai/sdk`.** The client is plain `fetch` in the lazy `TransactionForm` chunk.

## Order of checks in every request

1. **Missing key:** 404.
2. **`checkCaller`** [0032, 0064, 0088]:
   - no `Authorization` header is a guest: allowed by `/api/classify`, refused by `/api/insights` with 401 "Sign in to use insights." before any key fetch, count or body read;
   - a malformed header or a token that fails verification: 401;
   - no key set reachable (auth server silent, or no `VITE_SUPABASE_URL` on the deployment): 503.
   - **The proxy verifies the JWT itself:** the signature against the project's JWKS (`/auth/v1/.well-known/jwks.json`), ES256 or RS256 only (never `none` or HS256); claims unexpired, `nbf` passed, `iss` the project's `/auth/v1`, `aud` and `role` `authenticated`, `sub` and `session_id` uuids.
   - The key set is cached per warm instance for ten minutes; an unseen `kid` refetches at most every 30 s; a failed refetch keeps the old set. `prefetchSigningKeys()` starts a fetch at module load [0065]. **The cold token check is closed** [0066]: no keep-warm traffic or extra load-time work.
3. **`checkQuota`** [0049, 0064]: `consume_ai_quota()` called with the caller's token, 120 AI requests a minute per account across both proxies, a fixed 60 s window, 429 with `Retry-After` past it. Every signed-in request is counted before its body is read. The function also refuses an ended session (`session_id` not live in `auth.sessions`): PostgREST 403, the proxy 401. No answer (timeout, 5xx, missing function, no count) is 503. **Never count in a proxy's memory, cache the count with the token, or let a request through without a count.**
4. **`readBody`** [0088]: 64 KB cap (`MAX_BODY_BYTES`); a declared `Content-Length` over it is 413 before reading; invalid JSON is 400. The largest valid body (Thai at three bytes a character) is under 60 KB; a new field or raised limit re-checks that in `unit/proxy-contract.test.ts`.
5. **`validate`, then TypeSafe.** TypeSafe is never called on a 401 or 503.

## Upstream status mapping [0022, 0053]

- An upstream 429 passes through as **429**, with TypeSafe's wait (`retry-after-ms`, else `Retry-After` seconds or date) sent as `Retry-After` in whole seconds, rounded up, capped at a day. No usable wait sends no header. 429 is the only status `batchClassifier` backs off on.
- Upstream 401 maps to **502**; every other failure to **503**. The upstream body and other headers are never forwarded.

## `Server-Timing` [0050]

Every response carries `auth` (`desc="keys"` when it fetched the key set), `quota`, `ai` and `total`, in milliseconds, in finishing order; a step that did not run is absent. `POST` wraps `handle()` and sets the header on whatever it returns. A new step needs its name in both files' `Timings` type and a test. **Never put an id, token, account or request content in a description.**

## Parity contract: `classify.ts` and `insights.ts`

- `checkCaller`, the JWKS code, `checkQuota`, `AI_REQUESTS_PER_MINUTE`, `readBody` and the timing wrapper are **duplicated on purpose**: a shared `api/_auth.ts` would be the first runtime import between functions, which nothing local can prove resolves on Vercel.
- **Change both copies together.** `unit/proxy-parity.test.ts` compares every top-level declaration both files hold (comments aside); a new one goes in its `SHARED` list, or in `OWN` if it differs on purpose (only `handle` and `validate` do).
- `unit/proxy-contract.test.ts` pins the status mapping, the forbidden keys, the 404 on a missing key and the body cap by calling the exported `POST` handlers. `unit/proxy-prefetch.test.ts` loads a fresh copy of each proxy per test. `unit/proxy-auth-client.test.ts` covers the client's header and 401 handling.

## Insights specifics [0020, 0088]

- Jev answers `choice` questions: a `pattern` (`CATEGORY_SPIKE`, `IMPROVED_SAVING`, `NEW_RECURRING`, `STEADY`) and a `focus`. A fifth pattern means changing the server criteria, `InsightPattern` and the renderer together.
- **Only aggregates leave the device:** category names and per-category totals; never a description, `rawInput`, id, wallet name, single amount or date. `tests/insights.spec.ts` checks the request body.

## Guest rate limit: the Vercel firewall [0032, 0046, 0053]

- One dashboard rule, "AI proxy: guests 30/min per IP", on both paths when there is no `Authorization` header; fixed 60 s window from its own first request. It lives only in the dashboard; the API cannot read it (404). Its 429 has `X-Vercel-Mitigated: deny` and no `Retry-After`. There is no all-callers rule (the Hobby plan allows one).
- Checking it means sending 31 guest requests to production: **stop and ask first.**

## `api/csp-report.ts` [0071]

- Receives `report-uri /api/csp-report` (never `report-to`, which disables `report-uri` and delivered nothing in Chromium).
- **Nothing in a report is trusted:** URLs logged as origin and path only, text stripped and cut to 200 characters, the caller's IP counted but never logged, and the function calls no other service.
- Limits: 16 KB and 10 violations a request; 20 a minute per IP and 300 per instance, in memory, then 429.

## Response headers: `vercel.json` [0068, 0070, 0086]

- **Every path:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), geolocation=(), microphone=(self)`, and one enforced `Content-Security-Policy`. Vercel adds HSTS.
- **The CSP:** `default-src 'self'`; `script-src 'self'` plus the SHA-256 of `index.html`'s one inline script (the theme bootstrap); `style-src 'self'`; `img-src 'self' data: blob:`; `font-src`, `worker-src`, `manifest-src 'self'`; `connect-src 'self'` plus the Supabase project over `https` and `wss`; `object-src 'none'`; `base-uri` and `form-action 'self'`; `frame-ancestors 'none'`.
- **A new external origin, browser feature or inline script needs its policy entry first;** nothing local serves these headers, so a gap shows only in production. Never add `'unsafe-inline'` or `'unsafe-eval'`. A changed theme bootstrap gets a new hash. zod stays `jitless` (`z.config` in `zodSchemas.ts`).
- `unit/security-headers.test.ts` hashes the inline script and fails when `vercel.json` disagrees, or on a second or report-only CSP header. `index.html` is LF (`.gitattributes`).
- Roll back by renaming the header to `Content-Security-Policy-Report-Only`.
