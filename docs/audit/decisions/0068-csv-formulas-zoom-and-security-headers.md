# 0068: Exported CSV cells cannot run as formulas; the page can be zoomed; responses carry security headers and a report-only CSP

**Status:** Accepted. Implemented on branch `phase-92-sec-a11y-hardening`. Not merged yet.
- **Amends** ADR `0024`: the CSV export escapes text cells, and the importer reverses it.
- **Amends** ADR `0051`: `vercel.json` gains a `headers` key, measured on production before and after as that ADR requires.

**Date:** 2026-10-05

## Context

An outside review of the project (2026-10-05, not kept in the repository) listed four findings that no phase had tracked. Each was checked in the code before this phase:

1. **CSV formula injection (its SEC-001).** `transactionsToCsv` wrote every cell as stored. A spreadsheet runs a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return as a formula. A note such as `=HYPERLINK(...)` would therefore run when the export is opened in Excel or Sheets.
2. **Zoom disabled (its A11Y-001).** `index.html` set `maximum-scale=1.0, user-scalable=no`, which fails WCAG 1.4.4 (Resize text). It had also been hiding a second problem. iOS Safari zooms into a field whose text is under 16px when the field takes focus, and most fields here are 12px (`text-xs`) or 14px (`text-sm`). Allowing zoom brings that back.
3. **No security headers (its SEC-003).** `vercel.json` held `regions` only. Vercel already sends HSTS; nothing else was set.
4. **`npm audit` (its SEC-002).** 0 vulnerabilities in the production tree. 3 in development packages: `brace-expansion` (high), `fast-uri` (moderate) and `serialize-javascript` (low).

The diary export was checked too. It writes JSON (`exportDiaryToJson`), not CSV, so no spreadsheet reads a cell from it.

## Decision

### 1. Text cells that start like a formula are written as text, and read back unchanged

- **Escape:** a cell that matches `^'*[=+\-@\t\r]` gets one `'` in front. The leading `'` is what OWASP's CSV injection guidance recommends: a spreadsheet then reads the cell as text.
- **Columns:** Wallet, Destination Wallet, Category, Debt, Description and Raw Calculation. **Not Amount:** it is a number, and a negative ADJUSTMENT must stay `-50.00` (ADR `0024`). Date, Type and Idempotency Key are written by the app, not typed.
- **The importer takes exactly one `'` off a cell that matches `^'+[=+\-@\t\r]`, before it trims.** The escape also covers a cell already made of apostrophes before one of those characters. So the pair is exact: every string, a note typed as `'=x` included, comes back as stored. A CSV made elsewhere with a cell like `'=x` loses that one apostrophe on import.
- **What a person sees:** the exported cell shows a leading `'` in a spreadsheet. That is the cost of the defence, and re-importing the file removes it.

### 2. The page can be zoomed; on iOS, every field's text is at least 16px

- **`index.html`:** `width=device-width, initial-scale=1.0`. No `maximum-scale`, no `user-scalable`.
- **`index.css`:** under `@supports (-webkit-touch-callout: none)`, which only iOS and iPadOS Safari match, `:where(input, select, textarea)` sets `--text-xs` and `--text-sm` to `1rem`. Tailwind's `text-xs` and `text-sm` read those variables on the element itself, so a field's text becomes 16px. These keep their own size: a larger size (the edit panel's 24px amount), a field's label, and every element that is not a field. Desktop browsers and Android render as before.
- **The one field with an arbitrary size,** the CSV preview's per-row category select (`text-[11px]`), is now `text-xs` (12px on desktop), so the rule reaches it. A field sized with an arbitrary value would escape the rule.
- **A swipe while zoomed in no longer changes the tab.** A person zoomed in moves around the page with the same one-finger sideways drag that `App.tsx` reads as a tab swipe. `isZoomedIn()` (`utils/swipeGuard.ts`) reads `visualViewport.scale` and the swipe handler ignores a swipe above 1.01. Without `visualViewport` the swipe works as before.
- **Left as it was:** `viewport-fit=cover`. Adding it would make `env(safe-area-inset-bottom)` non-zero on notched phones and move the bottom nav and the PWA toast. That is a separate change.

### 3. Every response carries security headers; the CSP is report-only first

One header set for every path (`"source": "/(.*)"`):

| Header | Value | Why |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | A browser may not guess a script out of a file served as something else. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Another site sees only the origin, never a path. This is also the browsers' default; stating it keeps it if a default changes. |
| `X-Frame-Options` | `DENY` | No site may frame the app. Older browsers ignore `frame-ancestors`. |
| `Content-Security-Policy` | `frame-ancestors 'none'` | Enforced now: the app is never framed, so nothing can break. A report-only policy cannot do this, because browsers ignore `frame-ancestors` in report-only mode. |
| `Content-Security-Policy-Report-Only` | below | Watched before it is enforced. |

The report-only policy:
- `default-src 'self'`.
- `script-src 'self'` plus the SHA-256 of the one inline script, `index.html`'s theme bootstrap. No `'unsafe-inline'` and no `'unsafe-eval'`.
- `style-src 'self'`. React and framer-motion set styles through the DOM, which a CSP does not govern.
- `img-src 'self' data: blob:`, `font-src 'self'` (the self-hosted Plex files), `worker-src 'self'` (the service worker), `manifest-src 'self'`.
- `connect-src 'self'` plus the Supabase project over `https` and `wss`. `/api/*` is the same origin.
- `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.

**zod is set to `jitless`.** zod v4 tests once whether it may compile schemas with `new Function`, and a CSP without `'unsafe-eval'` reports that test as a violation on every load, even though zod catches the error and falls back. `z.config({ jitless: true })` in `zodSchemas.ts` skips the test and the compiling. The schemas are a few fields each.

**Why report-only first:** a CSP that blocks something the app needs breaks the app for everyone at once. This one was walked locally without a violation (Verification), but signed-in sync and realtime can only be seen on production.

**There is no report endpoint.** A violation shows only in the visitor's console. WebKit does not evaluate a report-only policy that has no `report-to` at all, and says so in the console. Enforcing the policy, or collecting reports first, is a later phase.

**`index.html` is LF in the repository** (`.gitattributes`). Vercel builds from the repository, and a CRLF checkout would hash the inline script differently.

### 4. `npm audit fix` for the development packages

It changes `package-lock.json` only:
- `brace-expansion`: 5.0.9 to 5.0.12, and under `filelist` 2.1.4 to 2.1.7;
- `fast-uri`: 3.1.7 to 3.1.8;
- `serialize-javascript`: 7.1.1 to 7.1.2.

`npm audit` now reports 0 vulnerabilities. `package.json` and the production tree (`npm ls --omit=dev --all`, 31 packages) are unchanged.

## Verification

- **CSV (`unit/csv-exchange.test.ts`, +6):**
  - every escaped column, including a leading tab and carriage return;
  - Amount left alone;
  - text with a formula character later in it left alone;
  - a round trip of every text column, including notes that already start with apostrophes.
  - **Negative controls:** without the escape, the 2 escape tests fail. Without the unescape, the 2 round-trip tests fail. With an escape that ignores leading apostrophes, the round trip fails on `'=already quoted`.
- **CSV in the browser (`tests/csv.spec.ts`, +1):** a Quick Add note `=HYPERLINK("...")` is exported quoted with its `'`, re-imported, and shown twice exactly as typed, never with the apostrophe.
- **iOS field size (`tests/ios-field-zoom.spec.ts`, new, 2 tests):** no test browser matches the `@supports` condition (checked in all three), so the spec reads the rule's own text from the page's stylesheets and applies it. It then opens Quick Add, the Transactions filters, the Add dialog, a row's edit panel, the CSV import preview, Add wallet, Transfer, Add debt, the diary, the category form, Smart rules and Sign in. In each it measures every visible field, and fails when a view has none to measure. The edit panel's amount must stay 24px. A second test checks that without the rule the desktop search field is still 12px.
  - **Negative control:** without the `--text-xs` line, the spec fails on the four 12px filter fields.
- **Zoom and swipe (`unit/swipe-guard.test.ts`, +4):** `isZoomedIn` at scale 1, 1.5, 1.005 and without `visualViewport`.
- **Headers (`unit/security-headers.test.ts`, new, 7):**
  - `regions` is still `icn1`, with one header set for every path;
  - each header's value;
  - the script hash matches `index.html`'s one inline script;
  - no `'unsafe-inline'` or `'unsafe-eval'`;
  - one Supabase host over `https` and `wss`;
  - the viewport;
  - zod's `jitless`.
  - **Negative control:** with the old viewport and without `jitless`, those two fail.
- **The CSP, walked locally:** `dist/` was served with `vercel.json`'s headers, and Chromium, Firefox and WebKit each walked the app, recording every `securitypolicyviolation`. The walk covered the load, a Quick Add with a formula amount, every tab, a CSV export and Sign in, with the service worker controlling the page.
  - Before `jitless`: 2 `script-src eval` reports in Chromium and in Firefox (zod's test).
  - After: 0 in all three.
- **`Server-Timing` before (ADR `0051`):** production, 2026-10-05 13:57 UTC, 10 guest `POST {}` to `/api/classify` from Thailand. All 10 answered `400` from `sin1::icn1`, with `total` 0.5 to 4.5 ms (median 0.75) and 0.21 to 1.05 s at the client. Production sent HSTS only.
- **Gate:** in the refactor log.

## Consequences

- **An exported note cannot run in a spreadsheet,** and a round trip through the importer changes nothing.
- **A person can zoom,** and on iOS a field takes focus without the page zooming in. Fields on iPhone and iPad show 16px text where desktop shows 12 or 14px.
- **The app cannot be framed,** and the browser will not guess content types.
- **The CSP watches but blocks nothing yet.** Enforcing it is a later phase, after production shows no violation for signed-in use.
- **A new inline script, or a change to the theme bootstrap, needs a new hash in `vercel.json`;** `unit/security-headers.test.ts` fails until it has one. A new external origin (an analytics script, a second Supabase project) needs a `connect-src` or `script-src` entry.
- **Order of release:** no migration. The headers take effect when the merge deploys. After it: measure `Server-Timing` with the same 10 requests (ADR `0051`), read the headers on production, and walk production in the three browsers as above.
