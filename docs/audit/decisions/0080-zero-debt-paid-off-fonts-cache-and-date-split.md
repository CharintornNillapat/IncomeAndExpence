# 0080: A debt with nothing borrowed reads 100% everywhere; the Google Fonts cache goes; the date helpers stay in one module

**Status:** Accepted. Released: code `1f53d5d`, docs `4d06ae8`, hash backfill `3c91084`, merged into `main` as `53d3c98` (PR #55); Vercel `dpl_9B3t1Y8CGnN5F5R3ERx5PBxNNxh7` READY in `icn1`. No migration.
- **Amends** ADR `0079`: the Dashboard's row passes 100 for nothing borrowed, as the Debt payoff page's card and the repayment form do. `useDebts`' total keeps 0.
- **Closes** findings 10 and 11 of `AGY_AUDIT300926.md` (the 2026-09-30 architecture audit): 10 by removing the configuration, 11 by measuring it and declining the split.

**Date:** 2026-10-06

## Context

1. **One debt, two figures.** Since ADR `0079` a debt whose borrowed total is ฿0 read 100% paid on the Debt payoff page (`DebtCard`) and in the repayment form, and 0% on the Dashboard (`DebtPayoffCard`). No database check stops a zero total, and a restored backup (ADR `0075`) can carry one. The owner decided (2026-10-06): such a debt is paid off, so it reads 100% wherever it is shown.
2. **Finding 10.** `vite.config.ts` gave Workbox two `runtimeCaching` routes, `CacheFirst` for `fonts.googleapis.com` and `fonts.gstatic.com`. The app self-hosts IBM Plex Sans Thai (ADR `0027`), nothing in `index.html`, `src/`, `public/` or `vercel.json` names either host, and the enforced CSP (ADR `0070`) allows fonts and connections to `'self'` and Supabase only, so neither route could ever match a request.
3. **Finding 11.** The audit read `src/utils/date.ts`'s display helpers (`formatLongDate`, `formatShortDate`, `greetingFor`, the diary's month grid, ...) in the entry chunk, because `FinanceContext` imports the module for `todayIsoDate`, and proposed a second module for them. Checked on the Phase 103 build: they are in `index-*.js` ("Good morning", the `toLocaleDateString` options). No formatter is built at load; each function formats when called, so the cost is bytes, not start-up work. `formatDayInfo` and `DayInfo` have no caller, and Rollup already leaves them out.

## Decision

1. **`DebtPayoffCard` passes 100** to `payoffPercent`. `DebtCard` and `TransactionForm` already did.
   - **`useDebts().metrics.progressPercent` keeps 0.** It is a share of everything borrowed across debts, and with nothing borrowed at all (no debts, or only ฿0 ones) both summaries read 0%, as before ("No debts tracked reads as 0% paid off"). A ledger whose only debt is ฿0 shows 100% on the card and 0% in the summary; `unit/debts-page.test.tsx` pins both. Changing the summary is a separate decision.
2. **Both `runtimeCaching` routes are removed;** `globPatterns` (the precache) is unchanged. Installs that already have the two named caches keep them, empty, as nothing ever matched them. Workbox does not delete a runtime cache it no longer names, and two empty caches cost nothing, so there is no cleanup code.
3. **The date helpers stay in `date.ts`;** the split is declined on its measurement. Built both ways (gzip -9):

   | | Entry `index` | The Dashboard's first load |
   |---|---|---|
   | One module (today) | 191,656 / 55,078 B | entry + `DashboardView` |
   | `date.ts` + `dateDisplay.ts` | 189,839 / 54,537 B (−1,817 / −541) | entry + `DashboardView` (+17) + a new `dateDisplay` chunk (1,830 / 754) |

   The Dashboard is the first view of every session and uses `formatLongDate` and `greetingFor`, so the shared chunk loads on every cold start: about 230 B more over the wire and one more request, to save parsing 1.8 KB. The split was built, measured and reverted; nothing of it ships.
4. **`formatDayInfo` and `DayInfo` are deleted:** no caller in `src/`, `unit/` or `tests/`. The bundle does not change.

## Verification

- **Red first:** `unit/dashboard.test.tsx`'s pin, changed to read 100% (by `aria-valuenow` and the row's "100.0% · no due date") for a ฿0 debt with ฿0 and with ฿250 still recorded as owed, failed on the unchanged card (`expected '0' to be '100'`), then passed.
- **Unit:** 1086/1086, the same count: one pin changed, none added.
- **Service worker** (built, Phase 103 against this): `sw.js` 4,761 / 1,765 to 4,289 / 1,613 B with no Google host left; the Workbox runtime 21,863 / 7,462 to 15,112 / 5,228 B, as `ExpirationPlugin` and `CacheableResponsePlugin` go with the routes. The app's JS is unchanged apart from hashed names (entry 191,656 B raw either way).
- **Gate, schema drift:** in the refactor log.
