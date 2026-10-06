# 0070: The Content Security Policy is enforced; the viewport covers the screen with safe-area insets; the package has its name and a licence

**Status:** Accepted. Implemented on branch `phase-94-enforce-csp-and-metadata` (commit `204f2cd`, docs `f0b121e`), draft PR #45. Not merged yet.
- **Amends** ADR `0068`: its report-only policy becomes the enforced one, and its viewport gains `viewport-fit=cover`.
- **Amends** ADR `0041` and ADR `0060`: the toast's desktop corner and `<main>`'s minimum height now account for the safe-area insets.

**Date:** 2026-10-06

## Context

1. **The CSP was report-only.** ADR `0068` shipped it that way because nothing local serves `vercel.json`'s headers, and a violation in production would break the app for everyone. Since then:
   - a guest walk on production in Chromium, Firefox and WebKit found no violation;
   - the policy has no report endpoint, so a violation only ever showed in the visitor's own console, and WebKit ignores a report-only policy without `report-to`, so WebKit had never evaluated it.

   Report-only protects nothing. The owner decided to enforce it in this phase.
2. **DOC-001.** The package was still called `react-example` (the template it started from), there was no `LICENSE` file although the README promised MIT, and the README described a much older app: the Phase 42 architecture (`WalletPopupModal`, `SecurityView`), 129 Playwright runs, the `stone` palette, a count-up `AnimatedCounter` that ADR `0026` removed, and a database setup of one migration.
3. **`viewport-fit=cover`.** `index.html` sets `apple-mobile-web-app-status-bar-style` to `black-translucent`, so an installed iOS app draws under the status bar. Without `viewport-fit=cover`, iOS reports every `env(safe-area-inset-*)` as 0, so nothing could move clear of it, and the bottom nav's `env(safe-area-inset-bottom, 0.5rem)` was always 0 on iPhone.

## Decision

### 1. One enforced `Content-Security-Policy`

- `vercel.json` had two CSP headers: an enforced `frame-ancestors 'none'` and the full report-only policy, which already ends in `frame-ancestors 'none'`.
- They are now one `Content-Security-Policy` header holding the full policy, unchanged:
  - `script-src 'self'` plus the theme bootstrap's SHA-256;
  - `connect-src 'self'` plus the Supabase project over `https` and `wss`;
  - no `unsafe-inline` and no `unsafe-eval`.
- Two enforced policies would both apply, and one header is easier to read.
- `X-Frame-Options: DENY` stays for browsers without `frame-ancestors`.

`unit/security-headers.test.ts` now reads the enforced header, and fails if there is a second CSP header or a report-only one, or if `frame-ancestors` is missing.

### 2. Package metadata

- **Name:** `package.json` and the lockfile root become `finlife-tracker`, with `"license": "MIT"`. Only those lines of `package-lock.json` change. `npm install --package-lock-only` would also rewrite unrelated optional-dependency entries, so it was not used.
- **Licence:** a standard MIT `LICENSE`, copyright 2026 Charintorn Nillapat (the repository's owner and git author).
- **README:** rewritten from what the code does now. Features, architecture, security, local setup (every migration in order, `npm run schema:drift`, Node 22 as CI runs), test counts, and links to the ADRs, `CLAUDE.md` and `DESIGN.md`. It carries no performance figures: the old ones were from Phase 36 and no longer true.

### 3. `viewport-fit=cover`, and each edge clears its own inset

The viewport is `width=device-width, initial-scale=1.0, viewport-fit=cover`, still with no `maximum-scale` or `user-scalable` (ADR `0068`). Each element on an edge clears its inset:

| Edge | Element | Change |
|---|---|---|
| Top | `Navbar`'s `<header>` | `pt-[env(safe-area-inset-top)]`; its background fills the status-bar strip |
| Top | `<main>` | its minimum height subtracts the top inset too, so the footer stays below the fold (ADR `0060`) |
| Left, right | `body` | `padding-left`/`right: env(safe-area-inset-left/right)`, which moves the header, page and footer clear of the notch in landscape |
| Bottom | mobile nav | already `pb-[env(safe-area-inset-bottom,0.5rem)]`, which now works |
| Bottom | footer | `mb-[calc(4rem+env(safe-area-inset-bottom,0.5rem))]`, the nav's own expression, so the nav never covers it. This is now `md:mb-0`, not `sm:mb-0`: the nav shows below `md`, and between 640 and 767 px the footer sat under it |
| Bottom | `Modal`'s panel | `pb-[env(safe-area-inset-bottom)] sm:pb-0`, so a bottom sheet's last control sits above the home indicator |
| Bottom, right | `ReloadPrompt` from `md` | `bottom` and `right` are `calc(1.25rem + inset)` |

On every device without insets each `env()` is 0 and nothing moves.

**Left as they are:**
- **The mobile nav's sides:** every notched iPhone in landscape is at least 812 px wide, which is `md`, where the nav is hidden.
- **A centred dialog's sides:** it is centred with `sm:p-4` around it, so it never reaches an edge.

## Verification

- **The CSP, enforced, on the built app** (`dist/` served locally with `vercel.json`'s headers), in Chromium, Firefox and WebKit:
  - the walk: Quick Add with a formula, every tab, a CSV export, and a sign-in attempt;
  - 0 violations in each browser;
  - the service worker controlled the page;
  - the sign-in request reached Supabase and got its `400` for a wrong password, so `connect-src` lets the auth API through.

  **Negative control:** with the Supabase origins removed from `connect-src`, WebKit blocked the same request and the walk reported `enforce connect-src https://<project>.supabase.co/auth/v1/token`.
- **The bundle's origins:** the only absolute connection origin in the built JS, the service worker and Workbox is the Supabase project. The rest are SVG namespaces and library error-message links.
- **The inline script's hash in `dist/index.html`** equals the policy's.
- **`tests/safe-area.spec.ts`** runs in Chromium only, because only Chromium can emulate insets (DevTools `Emulation.setSafeAreaInsetsOverride`).
  - **Portrait** (390x844, top 47, bottom 34):
    - the header row starts at 47;
    - the nav pads 34;
    - at the end of the page the footer is not under the nav;
    - Quick Add's bottom sheet pads 34.
  - **Landscape** (844x390, left and right 47):
    - the header row, `<main>` and the footer sit inside 47 to 797;
    - no horizontal overflow.
  - **Negative control:** without the header's and the sheet's insets it fails with "Expected: >= 47, Received: 0".
  - The footer check allows 1 px: the nav's top border overlaps the footer by 1 px with or without insets (780 against 779 at 390x844 with none), because 4rem is 64 px and the nav is 65.
- **Gate:** in the refactor log.
- **On CI:** the pull request's run `37392537330` passed every job in 303 s, 456 passed and 6 skipped with no flaky test, unit 1031. The drift workflow on the branch (`37392536742`) found no drift with all 17 migrations, as `schema_drift_reader`.
- **On the Vercel preview** (`dpl_87w3VXTjnjhDxhtNn8Lkv8mT2YeL`): one enforced `Content-Security-Policy` as configured, no report-only header, and the new viewport.

## Consequences

- **A violation now blocks.**
  - A new external origin (an image host, an analytics script, another API) needs its own entry in `vercel.json`'s policy, or it fails in production while working locally, where no header is served.
  - A changed theme bootstrap needs its new hash: `unit/security-headers.test.ts` fails until it is updated.
- **Signed-in sync and realtime under the enforced policy were not walked**, because there is no session here. The bundle connects to no origin the policy leaves out, but the first signed-in load on production after the merge is the real check.
  - **Rollback:** rename the header back to `Content-Security-Policy-Report-Only` in `vercel.json`. That is one line, with no client change.
- **Vercel's preview toolbar is blocked on previews.** A preview injects `https://vercel.live/_next-live/feedback/feedback.js`, which `script-src` refuses; production injects nothing. Allowing it would put a third-party script in the production policy, so previews go without the toolbar.
- **A real iPhone has not been checked.** The insets were measured in Chromium's emulation. An installed iOS app with the notch is the remaining check.
