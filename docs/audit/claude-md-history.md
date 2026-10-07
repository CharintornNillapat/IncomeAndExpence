# CLAUDE.md history

Release records, measurements and bug narratives moved out of `CLAUDE.md` so it holds rules only. Each entry is the original text, verbatim, under the `CLAUDE.md` section it came from and the rule it sat beside. The rule itself stays in `CLAUDE.md`; the ADR named in each heading has the full decision.

Nothing here is an instruction. When a figure here disagrees with a rule in `CLAUDE.md`, the rule wins.

## Coding Conventions

- **Type: the Plex fallback faces (ADR `0060`):** so the swap moves next to nothing: 0.00001 on Windows, 0.00035 on CI's Linux, where a row of labels comes out about 1.5% wider in the fallback.
- **UI limits: nothing moves while the app loads (ADR `0060`):** As `flex-1` alone it sat on screen until the Dashboard pushed it off: 0.0137 of the desktop load's 0.0139 layout shift.
- **UI limits: nothing moves while the app loads (ADR `0060`):** Released in `7d38ce2` (PR #34, Vercel `dpl_EKczqeGczCt2k2JhXGUXA8SeAAiE`); on production a cold load at 1280x800 shifts 0.00001 to 0.00007, against 0.0139 before.
- **Modals: focus is the primitive's (ADR `0043`):** Released in `d2f735e` (PR #16, Vercel `dpl_9uk8JX9RkeU4fgUF9HT5as6PA54T`); on production spec section 10 passes 13 of 13 (`docs/audit/spec-acceptance-2026-10-02.md`), which closes spec sections 9 and 10.
- **Modals: inert in the commit that shows the dialog (ADR `0058`):** , and the inert spec was flaky on WebKit CI in 4 of 12 runs. Released in `bef52be` (PR #32, Vercel `dpl_9gzWuPDm3Hs3BtSHMjg6BngFs1HJ`).
- **Modals: an open dialog keeps its focus when React re-runs its effects (ADR `0059`):** Playwright's `fill` focuses, then types a round trip later into whatever has focus, so Quick Add over a confirmation once lost its amount on WebKit CI.
- **Modals: an open dialog keeps its focus when React re-runs its effects (ADR `0059`):** Released in `9c8851a` (PR #33, Vercel `dpl_8wVCLUe7cfxLPDHGEdAaaz2d49W7`); on production, in all three browsers, Quick Add over the confirmation keeps focus in the amount field, and Chromium's accessibility tree exposes Quick Add alone.
- **Modals: the page behind the top dialog is inert (ADR `0047`):** Released in `3b9abec` (PR #21, Vercel `dpl_5VQ4CZchLxdFrkPFpfM4cgmDjSRU`); on production Chromium's accessibility tree hides the page behind an open Quick Add and restores it on close.

## Dates: local calendar days (Thailand, UTC+7)

- **Compare calendar days as ISO strings:** This bit both a `DashboardView` week/month filter (wrong side of the cutoff once local time passed 07:00) and a `WalletsView` "Created" label (UTC-sliced instead of local-formatted); both are fixed, but the failure mode recurs anywhere a bare date string meets a `Date` instance.

## State: context + domain hooks

- **Feedback follows the event that produced it (ADR `0056`):** Released in `ac6a7c5` (PR #30, Vercel `dpl_Dx3Qt9A1b2H8AdGgx4Sm9TQnaM7w`).
- **Never read a value assigned inside a `setState` updater:** This bit `setTransactionDeleted` (Phase 32, T63) — the wallet-balance write silently stopped firing on every soft-delete/restore for authenticated users, and `tsc` cannot catch it
- **The same rule holds across an `await` (ADR `0022`):** subtracted a repayment twice — ฿1,000 off ฿4,500 wrote ฿2,500 to Supabase while the screen showed ฿3,500 (Phase 50, F1, ADR `0022`).

## Express note entry: the note drives the form

- **A seed is applied during render (ADR `0057`):** Released in `f1606bc` (PR #31, Vercel `dpl_Bzm9xE7SzNwfyomR92NSj2WG9hvv`).

## Categorization: rules first, Jev second

- **A Vercel function that returns a `Response` must use a named method export:** This shipped once and had to be hot-fixed; it is invisible to `tsc`
- **The proxy checks the token itself (ADR `0064`):** About 0.05 ms a check, against a roughly 390 ms auth round trip before. On production the fetch took 456 ms on a new instance and 31 to 68 ms on a warm one, and a check without it 0.2 to 0.6 ms (forged tokens, 2026-10-05).
- **Each proxy starts fetching the key set when it loads (ADR `0065`, `0066`):** Released in `2a9dfd9` (PR #39, Vercel `dpl_3Vkst7wxvWmk6CKg9gvHQMrebh7V`). **On production it does not measurably shorten the first cold request:** five new instances' first requests waited 319 to 483 ms in `auth` (median 341, all `desc="keys"`) against Phase 88's one sample of 456 ms. That wait is the first connection to Supabase from a new host; a second function started on the same host a second later waited 29 to 65 ms. No change
- **Every proxy response carries `Server-Timing` (ADR `0050`):** Released in `e69425f` (PR #24, Vercel `dpl_2J9Asnb3kofhqt3RyPRYMRRvCWS9`). **The functions run in `iad1` (Washington, D.C.) and the database in Seoul,** so on production the count is most of a signed-in request: `quota;dur=614.5` of `total;dur=750.2`, against `ai;dur=134.3`.
- **The functions run in `icn1` (ADR `0051`):** Measured on production and kept: a signed-in classification with a cached token went from about 810 to about 238 ms in the function (`quota` about 640 to 36 ms, `ai` about 140 to 196 ms), and an uncached one from 1616.3 to 626.3 ms. Released in `65d49f4` (PR #25, Vercel `dpl_BnxC9uqZHQBTPhzxskVM9a8bpZQq`).
- **The guest firewall's 429 (ADR `0053`):** **Its 429 names no wait** (measured on production 2026-10-04, ADR `0053`)

## CSV import: the same two layers, before anything commits

- **The guest firewall's 429 in the import (ADR `0053`):** Released in `07d51f1` (PR #27, Vercel `dpl_FetmkPeDZf6qNf3Aea6bH5cXQQWG`), with the proxies' forwarded wait. Neither yet seen on a real import, only against mocked headers.
- **The import's live region (ADR `0054`, `0055`):** Released in `45eb2d4` (PR #28, Vercel `dpl_JARpUTJzSYio4svwtyA4RBNpv2mo`); every run's note and the event-order fix in `e21c071` (PR #29, Vercel `dpl_3u7u9dGSJfBUeMirCY4GDYF2LMBS`). Not yet tried with a screen reader.
- **A 429 that names its wait pauses the whole run (ADR `0052`):** Released in `23d73ed` (PR #26, Vercel `dpl_AWVqP3WTkaKHoBbojS4gKhyPR2GK`). Not yet seen on a real signed-in import, only against the tests' simulated 429.

## Supabase: required migrations

- **The migrations rebuild the live schema: the drift check (ADR `0063`):** and returns only what differs. On 2026-10-05 every kind of object matched live; the history lacked four names.
- **The migrations rebuild the live schema: the Phase 87 history backfill (ADR `0063`):** **Applied on 2026-10-05** on the owner's word: the history has 13 rows for 13 files and the drift check returns **0 unaccounted rows**. Released in `67a5bba` (PR #37, Vercel `dpl_2vwnW6ph7E2ZG5nJFiwnjbfoaWLZ`).
- **The weekly drift check (ADR `0066`, `0067`):** Released in `d988aa8` (PR #40, Vercel `dpl_EVF8YtC64W86cxydr2k6uY5zk5L3`). **Live since 2026-10-05:** the owner's third run by hand (`37314271932`) found no drift, as `schema_drift_reader`; the first two were "not checked" (a wrong password, then the role without `USAGE` on `supabase_migrations`), as designed (ADR `0067`).
- **Phase 52 (ADR `0024`):** `supabase/migrations/20260928_phase52_security_ledger.sql` (applied to the live project on 2026-09-27) hardens
- **Phase 58b (ADR `0033`):** `supabase/migrations/20260930_phase58b_update_transaction.sql` (applied to the live project on 2026-09-30) creates
- **Phase 58s (ADR `0032`):** `supabase/migrations/20260930_phase58s_profiles_hardening.sql` (applied to the live project on 2026-09-30) removes
- **Phase 63 (ADR `0038`):** Applied to the live project on 2026-10-02 (version `20261002013725`): 47 category rows and 6 wallets moved.
- **Phase 64 (ADR `0039`):** The seed function was applied to the live project on 2026-10-02 (`20261002041331`). The dedupe was run in the SQL editor the same day (not in the migration history) and left each name one live row; the 27 copies were removed rather than soft-deleted (ADR `0039`).
- **Phase 54 (ADR `0040`):** Applied to the live project on 2026-10-02 (version `20261002061331`) after its probe and the Phase 64 probe's seed and grant sections passed on the new body; the deployed body's md5 matches the file (`90c93706...`). The client does not depend on it. Released in `0882695` (PR #13), Vercel `dpl_GSmZYYCtL4NU7UUsvDCojGEXRCWK`; production serves the local build byte for byte, and a signed-out smoke test there shows ฿0.00 across 3 wallets and no debts.
- **Supabase's advisors: done in Phase 93 (ADR `0069`):** (no row has `user_id is null`, read on live 2026-10-06)
- **Supabase's advisors: done in Phase 93 (ADR `0069`):** Both applied to live by the owner before the merge, with their history rows (`20261005224522`, `20261005224812`); the drift workflow on `main` (`37385367893`) then found no drift with 17 migrations. Released in `4744845` (PR #43, Vercel `dpl_DvgAksLjtYP9hEQnPN3ZprPsPWcS`).
- **Phase 88 (ADR `0064`):** **Both were applied to the live project on 2026-10-05, before the merge, by the owner in the Supabase SQL editor, with their history rows (`phase88_quota_checks_session` at `20261005085236`, `wallet_default_thb` at `20261005085237`, `created_by` "owner, SQL editor")**; the drift check then returned **0 unaccounted rows**, with 15 history rows for 15 files. Released in `97d7abb` (PR #38, Vercel `dpl_CgKKNVmoSCdrGTaK5bGHxcUov9Qm`).
- **Phase 73 (ADR `0049`):** Applied to the live project on 2026-10-03 by the owner in the SQL editor (not in the migration history), after its probe and negative control; the deployed body's md5 matches the file. Released in `ec9cabb` (PR #23), Vercel `dpl_5sd1QkZZ4Qx4tBhQCTPzUZQhG3WT`.
- **Atomic ledger writes (ADR `0023`):** `supabase/migrations/20260927_ledger_rpcs.sql` (applied to the live project on 2026-09-27) moves

## Accounts, sessions, sign-out and the ledger's edges (ADR `0024`)

- **A signed ADJUSTMENT (ADR `0048`):** The three rows the old editor wrote in production were repaired on 2026-10-03 by intent, not by ADR `0024`'s script (ADR `0048`): one was the owner re-correcting the other by hand, so flipping both would have taken ฿920.00 too much. Before running a repair query on live rows, rebuild each affected wallet's balance from its ledger rows first.
- **The PWA toast sits above the mobile nav (ADR `0041`):** Released in `517aee8` (PR #14).
- **The toast is `z-45` (ADR `0042`):** Released in `7e2daa9` (PR #15, Vercel `dpl_8vuPfAZLQkzY3dpuuXUSbXarHomX`), and confirmed on production with the same probe.

## Response headers: frames refused, the CSP enforced (ADR `0068`, `0070`)

- **The hash test:** Nothing local serves these headers; a walk of `dist/` served with them, in all three browsers, found no violation.
- **Release:** Released in `d05ff4d` (PR #42, Vercel `dpl_BrRs1ym5isR91twq4JDxBhDwuwFi`). On production every header is served; a guest walk in all three browsers found 0 violations; `Server-Timing` is unchanged (`total` 0.4 to 4.5 ms against 0.5 to 4.5 ms, ADR `0051`). Signed-in sync is not yet walked.
- **Release (Phase 94, ADR `0070`):** The enforced policy released in `35f5fe4` (PR #45, Vercel `dpl_BnXVbW4UWcPdsAuFCFGn5WBqv3vX`). On production one enforced CSP is served on the page and on `/api/classify`, with no report-only header; a guest walk in all three browsers found 0 violations and its sign-in request reached Supabase; the service worker controlled 9 of 9 loads. Signed-in sync is not yet walked under it.
- **Release (Phase 95, ADR `0071`):** Violation reports to `api/csp-report.ts` through `report-uri` released in `a632c3e` (PR #46, Vercel `dpl_H4V1GtieKNdkKqZumgsoKByAh4oT`). On production a canary report answered `204` and logged one `csp-violation` line with origin and path only; a search of the runtime logs for its query, its fragment token and `access_token` finds nothing.
- **Release (Phase 96, ADR `0072`):** Account deletion (`delete_user_account`, the one hard delete) released in `73878b4` (PR #47, Vercel `dpl_7hebLp296RsBVmXpQSuG8tmGdSBm`), after the owner applied its migration with history row `20261006035741`; the drift workflow found no drift with 18 migrations. On production the `AccountModal` chunk carries the Delete account section; no account has been deleted there yet.
- **Release (Phase 97, ADR `0073`):** The whole-account JSON export and Node `24.x` released in `73d705f` (PR #48, Vercel `dpl_TYesMrgBErqA1F3cM4BmaBPz1bq2`), with no migration. On production the `AccountModal` chunk carries the export, the project's Node version reads `24.x`, and the build no longer warns about the open range; `main` CI ran on Node 24.21.
- **Release (Phase 98, ADR `0074`):** The install-script allow-list (`allowScripts`, esbuild denied), the advisors' count of eleven `SECURITY DEFINER` signatures and the Do NOT list cut from 133 rules to 37 released in `83161ad` (PR #49, Vercel `dpl_8q6Kn4Atybvfvw1DDKBiUQvWeWLB`). The production build log no longer carries the install-script warning; CLAUDE.md was 798 lines / 161,676 B before and 705 / 147,454 B after.
- **Release (Phase 99, ADR `0075`):** Import backup (JSON), a guest-only restore of the Phase 97 export after a strict Zod check and a confirmation, released in `59e2807` (PR #50, Vercel `dpl_8ikvp4XEBhbHjprSD1mYj63um3b5`), with no migration. Signed in, the restore is refused with a note to sign out first. CLAUDE.md now gives three request-intercepting specs in the Testing section and no longer says "fifth" in the Do NOT list.
- **Release (Phase 100, ADR `0076`):** `schemaOf`, which holds each backup schema to exactly its type in `tsc`, and `tsconfig.parity.json`'s strict pass in `npm run lint`, released in `c3af6f7` (PR #51, Vercel `dpl_CHtSQ9Fa3eJUwQrEpwmtovmwjzCa`), with no migration and no change to what the app does. Six controls on the real code failed lint, and a seventh, the check made to always pass, left the six `@ts-expect-error` lines unused. The same PR fixed a Phase 74 rounding bug in `proxy-contract.test.ts` that failed its first CI run.
- **Release (Phase 101, ADR `0077`):** `"strict": true` in `tsconfig.json` and `api/tsconfig.json`, with `tsconfig.parity.json` deleted and `npm run lint` back to two `tsc` runs, released in `313bbde` (PR #52, Vercel `dpl_BXMY81b5uGNQTuVWdQQWRkKDbNvk`). Seven errors were fixed to get there (1 in `src/`, 6 in `unit/`, plus the two `categoryLabels` ones `strictNullChecks` alone shows); production serves the same files as before, byte for byte.
- **Release (Phase 102, ADR `0078`):** The 20260909 `transfer_funds(p_user_id, ...)` signature refuses every call (`OUTDATED_CLIENT: Please reload the app to continue.`, P0001) as `SECURITY INVOKER`, released in `ae90bba` (PR #53, Vercel `dpl_9CjMVjNukPXkm1AEN3XX7ZZKbM6V`, no client change). The owner applied the migration with history row `20261006134830`; the drift check found no drift with 19 migrations, and the advisor lists 10 `SECURITY DEFINER` functions, from 11 signatures.
- **Release (Phase 103, ADR `0079`):** `payoffPercent(total, remaining, ifNothingBorrowed)` in `selectors/debts.ts`, replacing the payoff percentage re-typed in `DebtCard`, `DebtPayoffCard`, `TransactionForm` and `useDebts`, released in `ed5ee04` (PR #54, Vercel `dpl_CFvLc5AdZPxKoX268CZU1GomageF`), with no figure changed and no migration. A debt with nothing borrowed still reads 100% on the Debt payoff page and 0% on the Dashboard, pinned until the owner picks one.
- **Release (Phase 104, ADR `0080`):** A debt with nothing borrowed reads 100% on the Dashboard's row too, as on the Debt payoff page and in the repayment form (the summaries keep 0%); the dead Google Fonts runtime cache is gone from `vite.config.ts`; the date helpers stay in one module, the split measured and declined, and the uncalled `formatDayInfo` deleted. Released in `53d3c98` (PR #55, Vercel `dpl_9B3t1Y8CGnN5F5R3ERx5PBxNNxh7`), with no migration.
- **Release (Phase 105, ADR `0081`):** `evaluateArithmetic` in `mathEvaluator.ts` replaces `mathjs` (`+ - * /`, signs, brackets, decimals; `%`, `^`, `(2)3` and `6/2(3)` refused), removing `vendor-math` and 109,559 B gzip of app JS, and the debt summaries read 100% when there are debts and none borrowed anything. Released in `47f3949` (PR #56, Vercel `dpl_EU8geC3hBk9HQUgxD8hoYBEfieVD`), with no migration. Against mathjs on 1,000,000 random strings the parser gave no differing figure. The "Tree-Shaken MathJS" gotcha was removed with the dependency.
- **Release (Phase 106, ADR `0082`):** framer-motion removed: `Presence` and `slidePill` (`ui/motion.tsx`) and the `motion-*` keyframes in `index.css` run the same tweens, nothing moves under `prefers-reduced-motion` (framer-motion had ignored it), and `Modal`'s Tab and Escape listeners became layout effects after WebKit lost an Escape pressed as focus landed. Cold start −41,761 B gzip of JS (−18.9%). Released in `a9bcc90` (PR #57, Vercel `dpl_BNrUCWehafnBRR8xUKfrzYzEDAbU`), with no migration. The motion rules, `Modal`, `SegmentedControl`, the deferred-modal note and the suite sizes (480 Playwright runs, 1179 unit tests) were updated.
- **Release (Phase 107, ADR `0083`):** supabase-js loads on demand: `src/lib/supabase.ts` imports it only in `loadSupabase()`, at boot only when `sessionMayExist()` (a stored session under the library's own key, an auth redirect, or unreadable storage), otherwise on Sign In or another tab's sign-in; a guest's cold start is 58,119 B gzip of JS lighter (−32.4%). The Server-Timing test checks the absent key-set fetch instead of a 15 ms ceiling, and `animate-spin`/`animate-pulse` stop under reduced motion. Released in `2fb855c` (PR #58, Vercel `dpl_FCGb2hWJtCajfdPySSL8kGt5aADQ`), with no migration; `CLAUDE.md` gained the lazy-client rules under Accounts and a no-ceiling rule for timing tests.
- **Phase 108 (ADR `0084`):** the entry form's Category select lists the entry type's categories and starts on the first (a signed-in account's name order had made Balance Adjustment the default for an expense); `DebtSchema` refuses remaining > total; `payoffPercent` clamps to 0 to 100. `CLAUDE.md`'s "the category `<select>` is unfiltered" and "the Add Debt form permits `remaining > total`" lines were rewritten; the unit suite is 1204 tests in 47 files. Code `738d667`, docs `d79f5e2`, draft PR #59; no migration.

## Testing

- **Global setup warms port 3100 (ADR `0057`):** inside its timeouts (28.5 s and 29.4 s in Phase 80's full run, 34 s on a first run of the day).
- **Global setup warms port 3100 (ADR `0057`):** (120 s limit, about 4 s)
- **Global setup warms port 3100 (ADR `0057`):** Released in `f1606bc` (PR #31); on CI it completes in each browser job (3.8 to 4.7 s).
- **Local runs use 4 workers (ADR `0055`):** Measured over 441 Firefox runs, 6 workers took 10.4 m with 2 `page.goto` timeouts and a slowest test of 42.5 s; 4 workers took 10.2 m with none and 12.1 s.
- **The browser jobs run in Playwright's container image (ADR `0044`):** `install-deps` took a median 23 s but up to 19 min on a slow Ubuntu mirror.
- **Every action is pinned to a commit (ADR `0067`):** Released in `184cc1a` (PR #41, Vercel `dpl_DT7ECQM8v1z92jPMwdz4QPtJSwLx`).
- **CI's trace has no screencast (ADR `0060`):** The screencast was most of the cost: a local WebKit run took 4.1 to 4.7 m with it, 3.3 to 3.4 m without, 3.1 to 3.3 m untraced.
- **A CI job's time follows the machine it draws (ADR `0061`):** Over 20 runs, WebKit tests took 1.33 times as long on the slower runners, evenly across every test; AMD EPYC 7763 runners take about 1.4 times as long per test as EPYC 9V45 ones.
- **A CI job's time follows the machine it draws (ADR `0061`):** Not the dev server (6 to 9 s from the step's start to the first test, warm-up included) and not a group of specs (slowest 5 to 7 s).
- **Each browser runs as two shards (ADR `0061`):** (ADR `0061`): end to end 233 to 242 s over three runs, against 320 to 362 s as one job per browser, for about 4 more runner-minutes a run (free while the repository is public). 3 workers
- **Each browser runs as two shards (ADR `0061`):** Released in `be78622` (PR #35, Vercel `dpl_2e5mqEA9WeM667yihCxp2AeFcz3r`); `main` CI on the merge took 237 s end to end, with both WebKit shards on EPYC 7763 runners.
- **One report for all six shards (ADR `0062`):** The job adds 17 to 25 s after the slowest shard (five runs) and only reports;
- **One report for all six shards (ADR `0062`):** Released in `a7cb77f` (PR #36, Vercel `dpl_BTyVRinCKM9gSB9GZr6vhndfkQSN`); `main` CI on the merge took 286 s end to end, 21 s of it the merge job.

## Unit tests: what the browser cannot reach

- **Suite size and duration:** ; the reconnect tests' debounce windows and the sign-out tests' 400 ms writer waits are most of the growth from ~3 s)
- **A file that pins `TZ` sets it at the top:** and failed 4 tests on CI every night between 17:00 and 23:59 UTC (PR #17).
