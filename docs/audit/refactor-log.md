# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

**Phases 0 to 124** are in `archive/refactor-log-phases-001-124.md`. That file is history: read it only when the user asks for historical research. The last archived entry is Phase 124 (ADR `0100`, merged `46a7737`).

Every entry keeps these headings, even when one is "none":

```
## Phase NNN - <title>: T7xx-T7yy (<date>, code `<sha>`, docs `<sha>`, merged `<sha>`)

ADR `NNNN`. <the brief, one or two sentences>

**Changed:** <files and what changed>
**Verified:** <gate commands and their results>
**Surprises:** <or none>
**Deliberately not done:** <or none>
```

---

## Phase 137 - Small fixes: T769-T770 (2026-10-17, code `<sha>`, merged `<sha>`)

No ADR (ADR 0102 already fixes Hero size at 44px; cleanups of existing rules). Closes four low UI findings from the 2026-10-16 audit (UI-01, UI-06, UI-07, UI-08) and introduces the `--text-hero` token (2.75rem / 44px) to size the Left over figure per DESIGN.md instead of `text-4xl`. T770 brings the unit test count on `AGENTS.md` and `README.md` to 1438, and makes the T767 review's test 9 count its 4 rows.

**Changed:** `src/index.css` (added `--text-hero: 2.75rem` and `--text-hero--line-height: 1.1` in `@theme`); `src/components/dashboard/LeftOverCard.tsx` (`text-4xl` replaced with `text-hero`); `src/components/InlineMathInput.tsx` (`transition-all` replaced with `transition-control`); `src/components/ui/motion.tsx` (unexported `prefersReducedMotion`); `src/components/diary/RecentEntries.tsx` (unexported `RECENT_STEP`); `docs/audit/test-selector-contract.md` (added `transfer-balance-after-dest`, `transfer-balance-after-source` for `transfer-preview.spec.ts`); `DESIGN.md` (Hero row in scale table updated with `text-hero` token; Dashboard type line updated with `text-hero`); `unit/dashboard.test.tsx` (test for Left over Hero size); `unit/inline-math-seed.test.tsx` (test for InlineMathInput frame `transition-control`); `docs/audit/task-ledger.md` (Phase 137 section and T769 row added; 4 audit findings and Hero row marked done in Backlog); `docs/audit/baseline-metrics.md` (Phase 137 section added); this file. T770: `AGENTS.md` and `README.md` (unit test count 1438); `unit/dashboard.test.tsx` (`renderCard` takes optional `onOpenTransaction`, test 9 asserts 4 rows in region); `docs/audit/task-ledger.md` (T770 row).
**Verified:** Red gate verified (2 unit tests failed as expected on unfixed code); `npm run lint` clean (132 files checked, Node globals and safe ids verified, type-check passed); related unit tests passed (4/4 files, 106 passed); full unit test suite passed (62 files, 1438 passed in 50.99s, `workflow/stages/02_build/output/logs/T769-unit.log`); Playwright targeted Chromium passed (5 specs, 32 passed in 40.2s); Playwright targeted all 3 browsers passed (5 specs across Chromium, Firefox, WebKit, 96 passed in 2.2m); browser measurement in Chromium verified computed font-size 44px (line-height 48.4px) on `.text-hero` and no overflow / no horizontal scroll at 390px viewport with 6-figure amount (123456.78); clean production build succeeded (`index-DLzcvRPb.js`, 193,335 B / 56,359 B gzip; `index-CLc9BRYW.css`, 52,876 B / 10,214 B gzip; 39 JS files); extra checks clean (grep verified 0 unexported name importers outside their files, 0 `transition-all` in `InlineMathInput.tsx`, 0 `text-4xl` in `LeftOverCard.tsx`); line endings verified `w/crlf` across touched files; 0 em dashes added in git diff. T770: Red gate verified (test 9 length 0 failed when handler omitted); owner's extra check verified (test 9 failed when rows were missing with `items=[]`, passed when restored); `npm run lint` clean; `unit/dashboard.test.tsx` passed (49 tests); full unit test suite passed (62 files, 1438 passed in 52.65s, `workflow/stages/02_build/output/logs/T770-unit.log`); docs count check passed (1438 in `AGENTS.md` and `README.md`, 537 in Playwright list, 0 hits for 1432); line endings `w/crlf` across all touched files; 0 em dashes in git diff.
**Surprises:** The four low findings (UI-01, UI-06, UI-07, UI-08) were not in the Backlog (only high and medium were added in T759); `transition-control` drops the focus ring's fade in `InlineMathInput` because `transition-control` omits `box-shadow` (matching other controls); `docs/audit/task-ledger.md` reached 170 lines (exceeds 160 lines; not archived in this task per spec).
**Deliberately not done:** `ImportCsvModal.tsx:483`'s `transition-all` (a progress bar, not a control); the KPI and Hero tokens for the other card figures (`text-2xl` values); a responsive Hero size (`text-4xl sm:text-hero`).

---

## Phase 136 - Form labels: T768 (2026-10-17, code `df57e06`, merged `753e4f4`)

No ADR (fixes markup to standard HTML labelling and accessibility). Connects form `<label>`s to their form controls via `htmlFor` in `AuthModal`, `AddWalletForm`, `AccountModal` and the CSV import file picker, and provides an accessible name for the CSV import preview table's row category selector via `aria-label` (resolving audit 2026-10-16 findings UI-02, UI-03, UI-04, and UI-05).

**Changed:** `src/components/AuthModal.tsx` (`htmlFor` on Full Name, Email Address, Password labels); `src/components/wallet/AddWalletForm.tsx` (`htmlFor` on Wallet Name, Type, Starting Balance labels); `src/components/account/AccountModal.tsx` (`htmlFor` on Display Name, New Password, Confirm Password labels); `src/components/transaction/ImportCsvModal.tsx` (`htmlFor` on Select CSV File label and `aria-label` on row category select); `unit/auth-password.test.tsx`, `unit/authenticated-ledger.test.tsx`, `unit/wallets-page.test.tsx`, `unit/csv-import-categories.test.tsx` (one label association test each); `docs/audit/task-ledger.md` (Phase 136 section and T768 row added, UI-02 to UI-05 marked done, new Backlog row added); `docs/audit/baseline-metrics.md` (Phase 136 section added); this file.
**Verified:** Red gate verified (4 unit tests failed as expected on unfixed code); `npm run lint` clean (132 files, Node globals and safe ids verified, type-check passed); targeted unit tests passed (4/4 files, 152 passed); full unit test suite passed (62 files, 1436 passed in 48.79s, `workflow/stages/02_build/output/logs/T768-unit.log`); targeted Playwright on Chromium passed (8 specs, 51 passed in 43.5s); targeted Playwright on all 3 browsers passed (8 specs, 153 passed in 3.4m, `workflow/stages/02_build/output/logs/T768-e2e.log`); clean production build succeeded (`index-BcaenrL9.js`, 193,335 B / 56,360 B gzip; `index-z3bqoA9P.css`, 52,884 B / 10,209 B gzip; 39 JS files); git diff and status clean (target and bookkeeping files only); line endings verified `w/crlf` across all touched files; 0 em dashes added in git diff; `grep -rn "<label" src --include=*.tsx | grep -v htmlFor` verified (only Currency, Color, EditTransactionPanel, and TransactionForm:1091). T768 review: approved in round 1; the reviewer's own runs matched (red gate 4 failed, unit 1436 passed, 153 Playwright runs passed, same bundles). Release: PR #88 merged T768 into `main` as `753e4f4`, a merge commit; the `main` CI run on the merge (Playwright E2E Tests, run `39033190536`) passed in 6 min: type-check and unit tests, and all six E2E shards on Chromium, Firefox and WebKit. Vercel deployment `dpl_Wn4btLycbfABHbS7UpFqsj4EGjES` (GitHub deployment `7139652469`) is READY in `icn1`, built in 20 s, with the production aliases assigned, serving `index-BcaenrL9.js` and `index-z3bqoA9P.css`, the bundles `baseline-metrics.md` records. No migration, no request to `/api/*`.
**Surprises:** none.
**Deliberately not done:** `AddWalletForm.tsx`'s `Currency` and `Color` labels (name no labelable control; added to Backlog); `EditTransactionPanel.tsx` and `TransactionForm.tsx` labels (already named); any id, `data-testid`, label text, class or layout change, and `docs/audit/test-selector-contract.md`; wrapping inputs inside labels instead of `htmlFor`, or adding `aria-label` where a visible label exists; the test counts in `AGENTS.md:11` and `README.md:157` (left for a later docs task); any other audit 2026-10-16 finding (SL-01, UI-06).

---

## Phase 135 - Dashboard UI: T765-T767 (2026-10-17, code `3f7b3e8`, `662c528` and `7f7c82a`, merged `bdfc500`)

ADR `0102`. The Dashboard body rebuilt to the 2026-10 owner spec: the page header and row 1, Left over with its sparkline beside the Income and Spending cards (T765); row 2, spending by category with the donut and the month-to-date line, and debt payoff with the surplus warning inside (T766); row 3, recent activity, net worth merged into the wallets card, the mood strip (owner decision A), the insights card last, the T766 review notes and the phase paperwork (T767).

**Changed:**
- T765: `DESIGN.md`, `docs/audit/task-ledger.md`, `docs/audit/test-selector-contract.md`, `src/components/dashboard/CashFlowCard.tsx`, `src/components/dashboard/LeftOverCard.tsx`, `src/views/DashboardView.tsx`, `tests/dashboard.spec.ts`, `unit/dashboard.test.tsx`.
- T766: `DESIGN.md`, `docs/audit/task-ledger.md`, `docs/audit/test-selector-contract.md`, `src/components/dashboard/CategorySpendingCard.tsx`, `src/components/dashboard/DebtPayoffCard.tsx`, `src/views/DashboardView.tsx`, `tests/dashboard.spec.ts`, `unit/dashboard.test.tsx`.
- T767: `AGENTS.md`, `DESIGN.md`, `README.md`, `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md` (this file), `docs/audit/task-ledger.md`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `docs/design/dashboard-2026-10/spec.md`, `src/components/ViewLoadingFallback.tsx`, `src/components/dashboard/CategorySpendingCard.tsx`, `src/components/dashboard/MoodSpendingCard.tsx`, `src/components/dashboard/NetWorthCard.tsx` (deleted), `src/components/dashboard/RecentActivityCard.tsx`, `src/components/dashboard/WalletsSection.tsx`, `src/components/ui/AllocationBar.tsx`, `src/views/DashboardView.tsx`, `tests/dashboard.spec.ts`, `unit/dashboard.test.tsx`.
**Verified:**
- T765: Red gate verified; npm run lint clean; related unit 4/4 files 75 passed; unit 62/62 files 1415 passed; e2e 20/20 chr, 58 passed 2 skipped on 3 browsers; wcag-tokens clean; CRLF kept; 0 em dashes.
- T766: Red gate verified; npm run lint clean; related unit 4/4 files 86 passed; unit 62/62 files 1426 passed; e2e 21/21 chr, 61 passed 2 skipped on 3 browsers; wcag-tokens clean; CRLF kept; 0 em dashes.
- T767: Red gate verified (unit 8 failed, Playwright Chromium 4 failed); npm run lint clean (132 files); related unit tests passed (5 files, 116 passed); full unit suite 62 files, 1432 passed in 44.88s (workflow/stages/02_build/output/logs/T767-unit.log); Vitest shuffle 62 files, 1432 passed (seed 1792225420210); Playwright 12 specs on Chromium (71 passed in 40.3s) and on all 3 browsers (207 passed, 6 skipped in 3.7m); full Playwright E2E suite 35 specs on all 3 browsers (531 passed, 6 skipped by design, 0 failed in 9.9m, workflow/stages/02_build/output/logs/T767-e2e-full.log); production clean build passed (index-wgYjfCND.js 193,252 B / 56,336 B gzip; index-z3bqoA9P.css 52,884 B / 10,209 B gzip; 39 JS files); scripts/wcag-tokens.mjs passed all token pairs; line endings verified (ViewLoadingFallback.tsx w/lf, others w/crlf); 0 em dashes in git diff; 0 raw hex or text px in redesigned cards; 0 NetWorthCard references in src, unit, tests, DESIGN.md, AGENTS.md and docs/contexts.
- T767 review: round 1 asked for this entry to be rebuilt from the commits and the ledger; approved in round 2. The reviewer's own full run had 530 passed, 6 skipped and 1 WebKit stall in `csv-classify.spec.ts`, which passed 11/11 on rerun.
- Release: PR #87 merged T765 to T767 into `main` as `bdfc500`, a merge commit; the `main` CI run on the merge (Playwright E2E Tests, run `39019949585`) passed in 5 min: type-check and unit tests, and all six E2E shards on Chromium, Firefox and WebKit. Vercel deployment `dpl_HJdruUSS5pX3qTgu8QfHKPnPPXD4` (GitHub deployment `7137425280`) is READY in `icn1`, built in 21 s, with the production aliases assigned, serving `index-wgYjfCND.js` and `index-z3bqoA9P.css`, the bundles `baseline-metrics.md` records. No migration, no request to `/api/*`. The owner's visual check by eye is still open.
**Surprises:** T765's em-dash gate counted the whole file, including a test that asserts no em dash, so that test's literal became an escape (T765 review note 1; later specs count added lines only); T766's spec placed DESIGN.md's rest-row clause before the data source (fixed in T767); the full-suite WebKit run can stall a click on Windows for 15 s (csv-classify, ADR 0058), which passed on rerun in T767's review.
**Deliberately not done:**
- the mock's seven-day strip with empty days (owner decision A: strip displays only days returned by `moodSpendingDays` up to 5, oldest on left);
- the header and nav restyle and the darker brand theme (owner spec 6, "Later");
- the hero token (Backlog);
- the visual check by eye in both themes at 1280 px and phone width, which is the owner's, after merge.

---

## Phase 134 - Dashboard selectors: T762-T764 (2026-10-17, code `e6fb160`, `30da09d` and `3187e10`, merged `35c7967`)

ADR `0102`. Pure selectors for the redesigned Dashboard cards: left over with debt due for the Left over card, daily spending series for its sparkline, and month-to-date comparison against last month. All tests first; nothing rendered on screen until Phase 135.

**Changed:** `src/selectors/ledger.ts` (`leftOverFor` T762, `monthToDate` T764); `src/selectors/diary.ts` (`dailySpendingSeries` T763); `unit/selectors-dashboard.test.ts` (tests for `leftOverFor`, `dailySpendingSeries`, `monthToDate`, plus tightened future-dated test assertion); `docs/design/dashboard-2026-10/spec.md:69` (T763: WEEK 8 points, owner decision); `docs/contexts/client-state.md:63` (updated selector list); `docs/audit/task-ledger.md` (Phase 134 rows T762-T764); this entry and `docs/audit/baseline-metrics.md`.
**Verified:** T762: Red gate verified (8 failed, 15 passed); `npm run lint` clean; unit 62/62 files 1386 passed (50.6s); related unit 3/3 files 65 passed; CRLF kept; 0 em dashes. T763: Red gate verified (9 failed, 23 passed); `npm run lint` clean; unit 62/62 files 1395 passed (50.6s); related unit 4/4 files 91 passed; spec.md 1 line updated; CRLF kept; 0 em dashes. T764: Red gate verified (9 failed, 32 passed); `npm run lint` clean; unit 62/62 files 1404 passed in 49.85s (`workflow/stages/02_build/output/logs/T764-unit.log`); related unit 4/4 files 100 passed; production build clean (0 bundle delta, exports tree-shaken); CRLF kept; 0 em dashes. The owner accepted T764's two readings at the pause (one N for both months; left over's change over the size of last month's figure), recorded in `3187e10`'s message. Release: PR #86 merged T762 to T764 into `main` as `35c7967`, a merge commit; the `main` CI run on the merge (Playwright E2E Tests, run `39007225463`) passed in 5 min: type-check and unit tests, and all six E2E shards on Chromium, Firefox and WebKit. Vercel deployment `dpl_DNQ4qe4GR1cSLZKmFT9SA2kfuKtx` (GitHub deployment `7135434717`) is READY in `icn1`, built in 18 s, with the production aliases assigned, still serving `index-C7LsbYem.js` and `index-CqllkKUj.css`, unchanged from Phase 132 as the metrics predicted. No migration, no request to `/api/*`.
**Surprises:** The owner spec's WEEK series said 7 points while the WEEK range is 8 days (owner chose 8, T763); a mid-file `process.env.TZ` switch takes effect only in Vitest's `forks` pool, not in a worker thread, so the zone blocks assert the offset first (T762 and T763 reviews); the future-dated row counts in the card but has no sparkline point (owner kept the series ending at today, T763).
**Deliberately not done:** Wiring any of the three into `DashboardView` (Phase 135); moving `debts.ts`'s `daysInMonth` (not needed); the offset guard in T762's zone block; `AGENTS.md`'s stale test count (1375) and `DESIGN.md`.

---

## Phase 133 - Dashboard redesign docs: T761 (2026-10-17, docs `41a1bfb`, merged `5fe4ffe`)

ADR `0102`. Put the owner's Dashboard redesign plan into the repo: record its decisions in ADR 0102, rewrite `DESIGN.md`'s Dashboard section to match, update `AGENTS.md` routing, and add the owner's spec and mock to `docs/design/dashboard-2026-10/`, with four lines in `spec.md` corrected to the code per owner order.

**Changed:** `docs/audit/decisions/0102-dashboard-redesign-2026-10.md` (ADR 0102 recording decisions D1 to D5, amending ADR 0030); `DESIGN.md` (Dashboard section lines 161-175 replaced with 2026-10 redesign target description and layout table); `AGENTS.md` (added Dashboard redesign routing row and clarified `docs/design` HTML restriction clause); `docs/design/dashboard-2026-10/spec.md` (corrected 4 lines to match code: D1 transfer hue, text-fg-* tokens, transfer hue row, ProgressBar); `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` (owner mock added, verified byte-for-byte unchanged); `docs/audit/task-ledger.md` (Phase 133 section and T761 row added).
**Verified:** Docs-only gates passed: mock HTML hash verified unchanged (`d3d0e013...`); owner spec diff exactly 4 lines replaced (`4 4`), sha256 matched target (`09f30687...`); git scope clean; `DESIGN.md` diff only Dashboard section with 0 other heading changes; `AGENTS.md` diff `2 1`; name existence checks verified (all tokens, radii, components, exports, selectors, files resolve, and obsolete names appear 0 times); line citations in ADR 0102 verified against post-edit line numbers; CRLF line endings preserved on repo markdown and LF preserved on owner files (0 CRLF on spec.md); 0 em dashes in git diff and new files. Release: PR #85 merged T761 into `main` as `5fe4ffe`, a merge commit; the committed blobs of both owner files (`git show <rev>:<path> | sha256sum`) match the spec's hashes. No `main` CI run on the merge, as every changed path is under `docs/` or ends in `.md`, which the Playwright workflow's `paths-ignore` skips. Vercel deployment `dpl_HvUdS4TMLFi9rY4aEBk3cLdgF7zJ` (GitHub deployment `7134290779`) is READY in `icn1`, built in 18 s, with the production aliases assigned, still serving `index-C7LsbYem.js` and `index-CqllkKUj.css`, unchanged from Phase 132. No migration, no request to `/api/*`.
**Surprises:** none.
**Deliberately not done:** Any edit to the HTML, and any edit to `spec.md` beyond section 7.5's four lines; opening `dashboard-2026-10.dc.html` or `FinLife Dashboard Redesign.html`; the rest of `DESIGN.md` (Overview source line :6, Typography scale "(net worth)" label, Amounts THB line, Deviations from the spec rows); ADR 0030's text; `docs/audit/test-selector-contract.md`, `docs/contexts/*.md` and `workflow/stages/*/CONTEXT.md`; `docs/audit/baseline-metrics.md` (no count changed); any code, test or config, and the Phase 134 and 135 tasks themselves.

---

## Phase 132 - Transfer unknown outcome re-reads the cloud: T760 (2026-10-17, code `1530008`, merged `4fb77dd`)

No ADR (brings `addTransaction`'s transfer branch into line with ADR 0023). When a signed-in transfer's `transfer_funds` call fails with an unknown outcome (no SQLSTATE or empty transaction payload), `addTransaction` now flags `rpcOutcomeUnknown = true` and re-reads from the cloud after local rollback, matching `record_transaction`.

**Changed:** `src/context/FinanceContext.tsx` (`transfer_funds` error and empty payload handling flags unknown outcome); `unit/authenticated-ledger.test.tsx` (tests for lost response, empty payload, and SQLSTATE rejection); `docs/audit/task-ledger.md` (Phase 132 row, SL-02 closed, and new backlog row for `setTransactionDeleted` `cloudRevisionAtStart`); `docs/audit/baseline-metrics.md` (Phase 132 section).
**Verified:** Red-first test run verified Tests A and B fail on unchanged code while Test C and existing transfer test pass (`workflow/stages/02_build/output/logs/T760-red.log`); `npm run lint` clean; targeted vitest `unit/authenticated-ledger.test.tsx` and `unit/ledger-guards.test.tsx` passed (171/171); `npm run test:unit` clean (62 files, 1378 passed in 49.8 s, `workflow/stages/02_build/output/logs/T760-unit.log`); Playwright `tests/transfer-preview.spec.ts` and `tests/wallet-forms.spec.ts` passed (Chromium: 11/11 passed in 46.4 s; all 3 browsers: 33/33 passed in 56.8 s, `workflow/stages/02_build/output/logs/T760-e2e.log`); clean production build succeeded (`index-C7LsbYem.js`, 191,696 B / 55,810 B gzip; `index-CqllkKUj.css`, 52,759 B / 10,159 B gzip); git checks confirmed only target and bookkeeping files changed, lines 1848-1853 region changed in `FinanceContext.tsx` with 4 `rpcOutcomeUnknown = true` in `addTransaction` and 6 in file, CRLF preserved across touched files, and 0 em dashes in git diff. Release: PR #84 merged T760 into `main` as `4fb77dd`, a merge commit; the `main` CI run on the merge (Playwright E2E Tests, run `38995252671`) passed in 6 min: type-check and unit tests, and all six E2E shards on Chromium, Firefox and WebKit. Vercel deployment `dpl_G1zRm1CrRrCpHui6uvHxZ7g3gtGs` (GitHub deployment `7133657929`) is READY in `icn1`, built in 17 s, with the production aliases assigned, serving `index-C7LsbYem.js` and `index-CqllkKUj.css`, the Phase 132 build's figures. No migration, no request to `/api/*`.
**Surprises:** none.
**Deliberately not done:** The SL-01 row (`transfer_funds` replay on soft-deleted rows, SQL) is left for a future `supabase/` migration; SL-03 (guest `amount` rounding at `:1937`) remains dropped per T759 review; `markLocalWrite` order in the TRANSFER branch (`:1877-1879`) was not moved; `setTransactionDeleted` lacking a `cloudRevisionAtStart` check (`:2190-2197`) was added to the Backlog; the test harness fake client, other `describe` blocks, Playwright specs, and non-transfer branches of `addTransaction` were not modified.

---

## Phase 131 - Whole-app audit: T759 (2026-10-16, docs `c568376`, merged `0792b88`)

No ADR (docs-only task, whole-app read-only audit). The owner's brief: audit the whole app as it is today, without changing any code, with four read-only domain sub-agents, and write the findings to one report, adding high and medium findings to the ledger's Backlog.

**Changed:** `docs/audit/audit-2026-10-16.md` (the whole-app audit report: 16 findings in total, 1 high, 5 medium, 10 low across the four domains); `docs/audit/README.md` (added report row to Live files table); `docs/audit/task-ledger.md` (Phase 131 section and 6 new Backlog rows for all high and medium findings).
**Verified:** G1 scope clean (only target and bookkeeping files touched); G2 citations, structure and Backlog rows valid (T759-check.mjs passed: 0 bad citations, 0 duplicate IDs, all required fields present, 6 Backlog rows matching high and medium findings); G3 counts match Summary table (CS: 0/0/3, SL: 1/1/1, AP: 0/0/2, UI: 0/4/4; total 1 high, 5 medium, 10 low); G4 skip list verified (no open/done Backlog rows or accepted advisors repeated); G5 zero em dashes across all 5 touched files; G6 line endings clean (CRLF preserved across modified files, uniform in new report); G7 no code changed (diff against main in code directories empty). Release: PR #83 merged T759 into `main` as `0792b88`, a merge commit; no `main` CI run on the merge, as every changed path is under `docs/` or ends in `.md`, which the Playwright workflow's `paths-ignore` skips. Vercel deployment `dpl_7hpvpFcRnS7JuGauGxTXeEEEPM5e` (GitHub deployment `7121480731`) is READY in `icn1`, built in 30 s, with the production aliases assigned, still serving `index-BB5386eR.js` and `index-CqllkKUj.css`, unchanged from Phase 129. No migration, no request to `/api/*`.
**Surprises:** The review changed five findings' severity or Impact (see the report's Changed in review).
**Deliberately not done:** No code fixed: all 16 findings are recorded for future phases; no live check run: live database/dashboard checks left for the owner; low findings (10 in total) not added to the Backlog per spec; no `baseline-metrics.md` section (no bundle or test count changed); no ADR (docs-only task).

---

## Phase 130 - Line-ending rule and commit prompts: T757-T758 (2026-10-16, docs `f2045f0` and `f4926c4`, merged `5e34257`)

ADR `0101` (amended by T758, no new ADR). T757 closes the Backlog row from T754's review: specs check line endings with `git ls-files --eol` or a Node count, never `grep -c`. T758, the owner's brief: drop the bare `git commit` ask rules, which made the orchestrator's automatic commit ask the owner every time.

**Changed:** T757: `workflow/stages/01_spec/CONTEXT.md` (one Rules bullet on checking line endings); one Backlog row closed. T758: `.claude/settings.json` (the `Bash(git commit:*)` and `PowerShell(git commit:*)` ask rules removed); ADR `0101` (Status line and a Phase 130 amendment).
**Verified:** T757: G1 named paths exist (6 paths); G2 diff size per file matches (1/0, 11/0, 9/1); G3 line endings stay CRLF (git w/crlf; Node CRLF 58/122/95, bareLF 0); G4 rule landed whole at line 50; G5 ledger rows in place with T757 done and Backlog row closed; G6 zero em dashes across all 4 touched files; G7 scope clean. T758: G1 named paths exist (7 paths); G2 settings diff exactly 2 removed lines (0 2); G3 deny 91 ask 11 OK; G4 schema validation valid (workflow/stages/02_build/output/logs/T758-settings-schema.log); G5 line endings stay CRLF (git w/crlf; Node CRLF 111/135/122/96, bareLF 0); G6 markdown diff sizes (5/1, 6/6, 2/1) and placement verified; G7 zero em dashes across all 5 touched files; G8 scope clean. Release: PR #82 merged both commits into `main` as `5e34257`, a merge commit; `main` CI on the merge (run `38902603332`, 6 m 7 s; it ran because `.claude/settings.json` changed) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792154722540`); E2E 486 passed, 6 skipped, none failed or flaky. Vercel deployment `dpl_7QL7TeTVwUufEDQ4bZ4xmHTCwQtm` (GitHub deployment `7119254079`) is READY in `icn1`, built in 22 s, with the production aliases assigned, still serving `index-BB5386eR.js` and `index-CqllkKUj.css`, unchanged from Phase 129. No migration, no request to `/api/*`.
**Surprises:** T757: none. T758: none.
**Deliberately not done:** No `AGENTS.md` change: its Stop and ask first list still names `git commit`. `workflow/stages/03_review/CONTEXT.md` is unchanged: the reviewer runs the spec's gates, so T757's rule reaches it through the spec. `.claude/settings.json` keeps every other rule, including the push, merge, rebase and `gh pr create` ask rules and `Bash(ALLOW_GIT_WRITE=1 git push:*)`; no allow rule was added. The untracked `.git/hooks/` guards are unchanged. No `baseline-metrics.md` section (no bundle or test count changed).

---

## Phase 129 - Wallet transfer label size: T756 (2026-10-16, code `613b26c`, merged `0348602`)

No ADR (applies `DESIGN.md` line 77 as written). The owner's brief: move the transfer panel's uppercase From/To label in `WalletTransferForm.tsx` from `text-[10px]` to the section-label size, `text-xs`.

**Changed:** `src/components/wallet/WalletTransferForm.tsx` (the panel label, `text-[10px]` to `text-xs`); one Backlog row closed.
**Verified:** `npm run lint` clean (node-globals and safe-ids 132 files in src, tsc clean); `npm run test:unit` clean (62 files, 1375 passed in 69.9s, `workflow/stages/02_build/output/logs/T756-unit.log`); Playwright `tests/wallet-forms.spec.ts`, `tests/transfer-preview.spec.ts`, `tests/ios-field-zoom.spec.ts` passed (Chromium: 13/13 passed in 28.6s; all 3 browsers: 39/39 passed in 1.2m, `workflow/stages/02_build/output/logs/T756-e2e.log`); clean production build succeeded (`index-BB5386eR.js`, 191,674 B / 55,802 B gzip; `index-CqllkKUj.css`, 52,759 B / 10,159 B gzip); bash checks confirmed 1 line removed and 1 added in `src/`, 0 occurrences of `text-[10px]` in `WalletTransferForm.tsx`, line 101 matches `text-xs font-semibold uppercase tracking-wider text-fg-muted`, CRLF preserved across 4 files, and 0 em dashes across all touched files. Release: PR #81 merged into `main` as `0348602`, a merge commit; `main` CI on the merge (run `38894071034`, 6 m 0 s) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792150220522`); E2E 486 passed, 6 skipped, none failed or flaky. Vercel deployment `dpl_3RK5QmtVzREzMGrisXMPzW5jmUjo` (GitHub deployment `7117827129`) is READY in `icn1`, built in 17 s, with the production aliases assigned at release; production serves `index-BB5386eR.js` and `index-CqllkKUj.css` as measured above (checked after Phase 130's deploy, which changed no code). No migration, no request to `/api/*`.
**Surprises:** none.
**Deliberately not done:** No other `text-[10px]` class was moved to the scale: `AccountModal.tsx`, `NavbarLedgerStatus.tsx`, `ImportCsvModal.tsx`, `TxCells.tsx`, `ui/Badge.tsx` and `ui/Chip.tsx` use it for pills, badges and inline links, not section labels. No `leading-*` class was added for `text-xs`'s 16px line height. `DESIGN.md` is unchanged: its line 295 reference to `WalletTransferForm.tsx:101` still holds.

---

## Phase 128 - Workflow automation: T754-T755 (2026-10-16, docs `a757938` and `694f0cc`, merged `9c62173` and `967b049`)

ADR `0101` (amended, no new ADR). The owner's brief: cut the owner's round trips per task, with a build report per task, short spec orders, a pause after the spec only for risky tasks, and an automatic commit of each approved task on the phase branch.

**Changed:** `AGENTS.md` (the per-task outputs, the pause rule, the automatic commit, the Stop and ask first line on commits); `workflow/stages/02_build/CONTEXT.md` (`task-<id>-build.md`, `build-report.md` kept as the last shared report, who commits); `workflow/stages/03_review/CONTEXT.md` (reads `task-<id>-build.md`); `workflow/stages/01_spec/CONTEXT.md` (short orders, the pause pointer); ADR `0101`'s Amendments; `.claude/settings.json` (the `ALLOW_GIT_WRITE=1 git commit` ask rule removed).
**Verified:** G1 named paths exist; G2 `build-report.md` untouched; G3 `.claude/settings.json` diff exactly one removed line (`Bash(ALLOW_GIT_WRITE=1 git commit:*)`), 113 lines, CRLF preserved; G4 schema validation valid against Claude Code schema (`workflow/stages/02_build/output/logs/T754-settings-schema.log`); G5 stale reference checks clean (`build-report` 3 hits, `commit <id>` 3 hits, `owner's order` 0 hits); G6 zero em dashes across all touched files; G7 scope clean. T755 (`docs/audit/task-ledger.md`, a Backlog row: check line endings with `git ls-files --eol` or Node, not `grep -c`): G1-G6 passed, 2 added lines, CRLF kept, zero em dashes, scope clean. Release: PR #79 merged T754 into `main` as `9c62173` and PR #80 merged T755 as `967b049`, both merge commits; `main` CI on `9c62173` (run `38877032765`, 5 m 47 s) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792141047314`); E2E 486 passed, 6 skipped, none failed or flaky. `967b049` changed only Markdown, so no CI run started. Vercel deployment `dpl_4XQysgq3cpSg3kqfBT4LAD5LFkrU` (GitHub deployment `7115531911`, built from `967b049`) is READY in `icn1`, built in 20 s, with the production aliases assigned, serving `index-0LGxXWZU.js` and `index-CqllkKUj.css`, unchanged from Phase 127. No migration, no request to `/api/*`.
**Surprises:** T755 was committed on the phase branch after PR #79 had already merged, so it landed through a second PR (#80) instead of riding the first merge.
**Deliberately not done:** no `baseline-metrics.md` section (no bundle or test count changed). `build-report.md` keeps T753's report; it is not moved or deleted. No allow rule was added to `.claude/settings.json`, and the bare `git commit` ask rules for Bash and PowerShell stay. The herdr orchestrator's own configuration lives outside the repo and is the owner's to change.

---

## Phase 127 - Section label tracking: T753 (2026-10-16, code `cc32233`, merged `9323826`)

No ADR (applies `DESIGN.md` lines 77 and 85 as written). The owner's brief: bring the four uppercase labels that used `text-[11px]` and `tracking-wide` onto the section-label rule, and fix `Card.tsx`'s stale `rounded-xl` comment.

**Changed:** the four labels in `src/components/QuickAddModal.tsx` and `src/components/TransactionForm.tsx` (`text-xs`, `tracking-wider`); the `src/components/ui/Card.tsx` comment; `DESIGN.md`'s deviation row; two Backlog rows closed.
**Verified:** `npm run lint` clean (node-globals and safe-ids 132 files in src, tsc clean); `npm run test:unit` clean (62 files, 1375 passed, `workflow/stages/02_build/output/logs/T753-unit.log`); Playwright `tests/presets.spec.ts` and `tests/debt-repayment.spec.ts` passed (Chromium: 17/17 passed in 59.4s; all 3 browsers: 51/51 passed in 1.5m, `workflow/stages/02_build/output/logs/T753-e2e.log`); clean production build succeeded (`index-0LGxXWZU.js`, 191,674 B / 55,796 B gzip); bash checks confirmed 5 lines removed and 5 added in `src/`, 0 occurrences of `tracking-wide` or `text-[11px]` uppercase in `src/`, 4 compliant lines in `QuickAddModal.tsx` and `TransactionForm.tsx`, `Card.tsx` comment updated, `DESIGN.md` deviation row updated, and 0 em dashes across all touched files. Release: PR #78 merged into `main` as `9323826`, a merge commit; `main` CI on the merge (run `38854947693`, 5 m 53 s) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792127894854`); E2E 486 passed, 6 skipped, none failed or flaky. Vercel deployment `dpl_6XZMUwxqZ6RZegWFuPoq5DSA6ADs` (GitHub deployment `7111551076`) is READY in `icn1`, built in 20 s, with the production aliases assigned, serving `index-0LGxXWZU.js` and `index-CqllkKUj.css` as measured above. No migration, no request to `/api/*`.
**Surprises:** none.
**Deliberately not done:** No other `text-[11px]` or `text-[10px]` class was moved to the scale: they are not uppercase section labels, apart from `WalletTransferForm.tsx:101` (`text-[10px]`, now a Backlog row). No `leading-*` class was added for `text-xs`'s 16px line height.

---

## Phase 126 - ICM tune-up: settle the readiness-2 gaps: T751-T752 (2026-10-16, docs `86d0849`, comments `5bc45f5`, merged `3f301ab`)

ADR `0101` (amended, no new ADR). The owner's brief: one docs commit that settles the gaps the second ICM readiness check found (`../finlife-icm-readiness-2.md`, outside the repo). T752, the phase's last task, rewords five code comments that pointed into `docs/audit/archive/` so each cites a live doc (ADR `0006`, `0039`, `docs/contexts/ui-and-e2e.md`) and drops the framer-motion mention ADR `0082` made stale.

**Changed:** `AGENTS.md` (before-done scope, who cuts the phase branch, doc-only phase paperwork, the order forms), the three `workflow/stages/*/CONTEXT.md` files (order forms, the id from the order, the builder's BLOCKED reason, the empty `Commit` cell, no reviewer sub-agents), `docs/audit/README.md` and the ledger header (who fills `Commit`), ADR `0101`'s Amendments section; T752: comments in `src/components/transaction/txTypeMeta.ts`, `src/components/ui/Card.tsx`, `src/components/ui/OverflowMenu.tsx` and `tests/categories.spec.ts`.
**Verified:** `npm run lint` clean; zero em dashes in the touched files; T752: `npm run lint` clean (node-globals and safe-ids 132 files in src, tsc clean); comments-only diff confirmed (0 code lines changed); grep confirmed 0 archived pointers in target files; all 4 named paths and symbols resolved; zero em dashes in touched files. `main` CI on merge `3f301ab` (run `38845131793`) passed all 8 jobs: unit 1375/1375 in 62 files, in order and shuffled; E2E 486 passed, 6 skipped. Production READY in `icn1`, entry unchanged (`index-BLSMm3p4.js`).
**Surprises:** the ledger header still named a `Metric delta` column the live ledger dropped in Phase 125; removed with the C3 fix.
**Deliberately not done:** no `baseline-metrics.md` section (no bundle or test count changed). The herdr agents' workspace, agy's `always-proceed` mode and the jev-router hook live outside the repo and are the owner's to change. T752 left ADR `0006`'s own pointers to archived refactor-log notes, and `Card.tsx`'s stale `rounded-xl` (the code uses `rounded-card`, now a Backlog row), as they are.

---

## Phase 125 - ICM bootstrap: hierarchical context, the archive, herdr stages: T742-T750 (2026-10-15 to 2026-10-16, renames `7bed3d7`, docs `ca1440f`, backfill `7dfe6c2`, readiness gaps `53794ca`, merged `3124756`)

ADR `0101`. The owner's brief: prepare the repo for ICM under herdr (reviewer Claude Code, builder agy), first removing the context bloat, doc drift and dirty tree a read-only discovery pass found.

**Changed:**
- **Rules:**
  - `CLAUDE.md` (757 lines) became a 6-line import of the new `AGENTS.md` (about 125 lines): stop-and-ask list, parity map, tiered gates, routing table, ICM workflow.
  - The domain rules moved into `docs/contexts/` (`client-state.md`, `supabase-ledger.md`, `api-proxies.md`, `ui-and-e2e.md`).
  - The monolith is kept verbatim as `archive/claude-monolith-v124.md`.
- **Archive** (`git mv`, unchanged): the ledger and log for Phases 1 to 124, `baseline-metrics.md`, `test-selector-contract.md` (as the selector log), `audit-report.md`, `perf-audit-report.md`, `ui-ux-audit-report.md`, `implementation-roadmap.md`, `spec-acceptance-2026-10-02.md`, `constraints-to-promote.md` and `claude-md-history.md`. `AGY_AUDIT300926.md` and `SUGGESTS.md` moved there from the root.
- **New live files:**
  - a short `baseline-metrics.md` (how to measure, the latest figures);
  - a current `test-selector-contract.md` (ids and test ids grepped per spec, the hazards still true);
  - a compact `task-ledger.md` with a Backlog;
  - this log;
  - a rewritten `docs/audit/README.md`.
- **Moved rules:**
  - the spec-edit policy now lives in `ui-and-e2e.md`;
  - `constraints-to-promote.md`'s open row and proposals are Backlog rows;
  - `DESIGN.md`'s section-label tracking is `tracking-wider`, as in the code, with the spec's 0.4px under Deviations.
- **Doc drift:** `README.md` (Node 24, removed libraries, counts, the atomic ledger, the tree and the Documentation links) and the count comments in `vitest.config.ts` and `playwright.config.ts`.
- **Routing:** `DESIGN.md` is read for visual work only; never open `docs/design/*.html`; the redesign spec only for a new redesign.
- **Workflow:** `workflow/stages/{01_spec,02_build,03_review}/CONTEXT.md` with `output/` folders, and the phase-branch rule.
- **Root:** `.antigravity/` is ignored, and the stale local `HANDOFF.md` was deleted.
- **Readiness gaps (T750):** a read-only readiness check (`../finlife-icm-readiness.md`, 2026-10-16) dry-ran one task through the three stages and found 11 guesses and 8 conflicts. This commit fixed them in `AGENTS.md`, the stage files, ADR `0101` and `docs/audit/README.md`: STATUS lines start with the task id; who writes what; only the orchestrator commits, on the owner's order, with the owner's deploy record the one exception on `main`; the phase comes from the branch; tier rows for `tests/`, `unit/`, `workflow/`, `docs/contexts/` and comments-only changes; tests may be `none` when behaviour cannot change; the reviewer's stash check; logs in gitignored `output/logs/`. A tracked `.claude/settings.json` denies Claude Code's production write tools and asks before git writes and PRs.

**Verified:**
- `npm run lint` is clean.
- `npx playwright test --list`: 492 tests in 34 files.
- `npx vitest list` collects all 62 files.
- `npm run test:unit`: 1375/1375 in 62 files (71.5 s, during the context audit).
- Every path and symbol named in `AGENTS.md` and `docs/contexts/` resolves (scripted).
- Zero em dashes in every file created or rewritten.
- All 11 archive moves are 100% renames, committed alone.

**Surprises:**
- `npx vitest list` reports 976 tests where the run passes 1375. The run is the figure.
- The old selector contract's L176 and L177 called `#diary-workout-checkbox` and `#close-wallet-modal-btn` "Unchanged id"; later rows (L338, L296) retired both, and neither is in `src/`.
- Uppercase labels used `tracking-wider` seven times and `tracking-wide` four times (`QuickAddModal.tsx:101`, `TransactionForm.tsx:709`, `:848`, `:871`), against `DESIGN.md`'s 0.4px.
- A `git mv` followed by a new file at the old path, in one commit, would have recorded an edit and an add, not a rename. So the renames went in their own commit first.

**Deliberately not done:**
- No code, test, config or schema change. The four code comments that point into the archive, and the `tracking-wide` labels, are Backlog rows.
- No `GEMINI.md`: agy is told by its stage file to read `AGENTS.md`, so there is one rule file.
- `anti-slop/` stays in place (the antislop skill writes there).
- No local E2E run this phase, since no code changed. The PR's CI did not run either: every branch commit carried `[skip ci]`, so `main` CI on the merge is the only suite run.
