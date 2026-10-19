# Review: T785

## Round 1

1. **Metadata**
   - **Task:** T785 - Insights validator checks category changePercent (AP-02)
   - **Date:** 2026-10-19
   - **Round:** 1
   - **Verdict:** APPROVED
   - **Target files:** `api/insights.ts`, `unit/proxy-contract.test.ts`, `docs/audit/task-ledger.md` (`git check-ignore -v` returned no matches on all three target files; all three tracked files keep `i/lf w/crlf`).

2. **Summary**
   `validate` in `api/insights.ts` (`lines 476-489`) now destructures `changePercent` from each category in `summary.categories` and requires `changePercent === null || isFiniteNumber(changePercent)`, returning `'Category totals must be finite numbers.'` (HTTP `400`) before `toState` or `fetch(TYPESAFE_ENDPOINT)` runs when `changePercent` is omitted, non-numeric, or non-finite. `unit/proxy-contract.test.ts` adds the `AP-02` suite (`lines 960-1032`) covering `undefined`, `'5'`, `true`, `{}`, raw JSON `1e309` (`Infinity`), and valid `null` / finite `-12.4` inputs, and `docs/audit/task-ledger.md` records `T785` under Phase 140 and marks the `AP-02` Backlog row done.

3. **Invariants and parity**
   - **Cross-file parity map row 3 (`api/classify.ts` shared declarations vs `api/insights.ts`):** Checked. The edit is confined to `validate` in `api/insights.ts` (`lines 476-489`), which is in `OWN = ['handle', 'validate']` (`unit/proxy-parity.test.ts:70`). Verified by `unit/proxy-parity.test.ts` (41/41 passed).
   - **Invariant 1 (No raw ledger data or unrounded/NaN figures leave the device; `AGENTS.md` Non-negotiables, `docs/contexts/api-proxies.md:37, 57`):** Checked in `api/insights.ts:455-524` (`validate` and `toState`), `src/utils/spendingSummary.ts:71-148` (`buildSpendingSummary`), `src/utils/insightsClient.ts:88-143` (`fetchInsight`), and `src/components/dashboard/SpendingInsightsCard.tsx:47-90`. Every category's `current`, `previous`, `txCount`, and non-null `changePercent` is verified with `isFiniteNumber` (`typeof value === 'number' && Number.isFinite(value)` at `api/insights.ts:95-97`) before `toState` runs; `toState` formats currency figures with `.toFixed(2)` and finite `changePercent` values with `Math.round(c.changePercent)`, so `NaN% vs last month` can never be sent upstream.
   - **Invariant 2 (Closed `InsightPattern` set and own-property `focus` validation; `docs/contexts/api-proxies.md:56`):** Checked in `api/insights.ts:630-639` (`Object.hasOwn(PATTERN_CRITERIA, pattern.choice)` and `Object.hasOwn(focusCriteria, focus.choice)`). Unchanged and verified by `unit/proxy-contract.test.ts` (`AP-01` suite).
   - **Invariant 3 (Caller verification and per-account quota precede body read and upstream fetch; `docs/contexts/api-proxies.md:29-37`):** Checked in `api/insights.ts:535-563` (`handle` calls `checkCaller`, rejects guest `token === null` with `401`, calls `checkQuota(token)`, then `readBody(req)`, then `validate(read.body)`). Unchanged and verified by `unit/proxy-contract.test.ts`.
   - **Strict-mode money and proxy edge cases checked:**
     - **Omitted `changePercent` (`undefined`):** `changePercent !== null` is `true` and `isFiniteNumber(undefined)` is `false` -> rejected with `400` (`{ error: 'Category totals must be finite numbers.' }`), 0 TypeSafe calls.
     - **Non-numeric types (`'5'`, `true`, `{}`, `[]`, `NaN`):** `typeof value === 'number'` or `Number.isFinite(value)` is `false` -> rejected with `400`, 0 TypeSafe calls.
     - **JSON overflow number (`1e309` -> `Infinity` / `-1e309` -> `-Infinity`):** `typeof value === 'number'` is `true`, `Number.isFinite(Infinity)` is `false` -> rejected with `400`, 0 TypeSafe calls.
     - **Null `changePercent` (`null`, first month or zero prior spend):** `changePercent !== null` is `false` -> accepted by `validate`, rendered as `'no prior month'` by `toState` (`api/insights.ts:510-511`).
     - **Signed finite `changePercent` (`0`, `+15.6`, `-12.4`, `-0`):** `isFiniteNumber` is `true` -> accepted by `validate`; `toState` (`api/insights.ts:512`) prefixes `'+'` when `c.changePercent >= 0` and formats `Math.round(c.changePercent)` (`+0%`, `+16%`, `-12%`).
     - **Client caller trace & rounding/soft-delete/transfer guards (`src/utils/spendingSummary.ts:89-136`):** `buildSpendingSummary` skips soft-deleted rows (`if (tx.isDeleted) continue;` at line 90), excludes transfers, debt repayments, and balance adjustments via `isSpending` / `isIncome` (`lines 94-103`), rounds `prior` and `curr` via `roundToCents` (`lines 124-125`), and computes `changePercent: !hasPreviousMonth || prior === 0 ? null : roundToCents(((curr - prior) / prior) * 100)` (`line 132`), so legitimate client requests always send `null` or a finite cent-rounded number.
     - **Concurrency / race guard on client caller (`SpendingInsightsCard.tsx:79-89`):** `if (isGenerating) return;` prevents concurrent duplicate `fetchInsight` calls from UI clicks.

4. **Gates run**
   - **Red test verification (Step 6 stash check):**
     - Recorded `git status --porcelain` (`M api/insights.ts`, `M docs/audit/task-ledger.md`, `M unit/proxy-contract.test.ts`, plus untracked spec/build files).
     - Ran `git stash push -- api/insights.ts docs/audit/task-ledger.md`.
     - Ran `npx vitest run unit/proxy-contract.test.ts -t "AP-02"`: 1 file failed, 5 failed | 1 passed | 199 skipped (205 total) in 413ms (`expected 200 to be 400` on all 4 `it.each` cases and the `1e309` `Infinity` case).
     - Ran `git stash pop --index` and confirmed `git status --porcelain` was identical to Step 6.1.
   - `npm run lint`: passed (`check:node-globals`: 132 files in `src`, no Node globals; `check:safe-ids`: 132 files in `src`, no id from time alone; `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors).
   - `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`: 5 passed (5 files), 287 passed (287 tests), 0 failed, 0 skipped (2.44s).
   - `npm run test:unit`: 63 passed (63 files), 1456 passed (1456 tests), 0 failed, 0 skipped (65.94s). Log: `workflow/stages/03_review/output/logs/T785-unit.log`.
   - `npx playwright test tests/insights.spec.ts --project=chromium` (ports 3000 and 3100 verified free beforehand): 1 spec file, 2 passed, 0 failed, 0 skipped (16.1s). Log: `workflow/stages/03_review/output/logs/T785-e2e-chromium.log`.
   - `npx playwright test tests/insights.spec.ts`: 1 spec file across 3 browsers (Chromium, Firefox, WebKit), 6 passed, 0 failed, 0 skipped (23.8s). Log: `workflow/stages/03_review/output/logs/T785-e2e.log`.
   - **Scope, line-ending, and em-dash checks:**
     - `git diff --stat`: 3 files changed (`api/insights.ts` 9+/2-, `docs/audit/task-ledger.md` 2+, `unit/proxy-contract.test.ts` 75+).
     - `git ls-files --eol api/insights.ts unit/proxy-contract.test.ts docs/audit/task-ledger.md`: all `w/crlf`.
     - Em-dash count across diff and all touched/stage files: `0`.

5. **Not verified**
   - Live `/api/insights` Vercel endpoint: prohibited by `AGENTS.md` ("Stop and ask first: Any request to production `/api/*`"). Verified offline by calling the exported `POST` handler directly in `unit/proxy-contract.test.ts`.

6. **Blocking**
   None.

7. **Non-blocking**
   None.

8. **Rule candidates**
   None (`docs/contexts/api-proxies.md:37` already specifies `validate, then TypeSafe`).
