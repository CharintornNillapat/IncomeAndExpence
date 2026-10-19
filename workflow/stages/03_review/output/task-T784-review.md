# T784 Review

## Round 1

### 1. Metadata
- **Task:** T784 - Insights choice validation uses `Object.hasOwn` instead of `in` (AP-01)
- **Date:** 2026-10-19
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `api/insights.ts`, `unit/proxy-contract.test.ts`, `docs/audit/task-ledger.md` (`git check-ignore -v` returned no matches on any of the three target files)

### 2. Summary
`api/insights.ts` (`lines 626` and `631` inside `handle`) replaces `pattern.choice in PATTERN_CRITERIA` and `focus.choice in focusCriteria` with `Object.hasOwn(PATTERN_CRITERIA, pattern.choice)` and `Object.hasOwn(focusCriteria, focus.choice)`, so `Object.prototype` property names returned by upstream degrade to `'STEADY'` and `null` instead of bypassing choice validation. `unit/proxy-contract.test.ts` adds the `describe('/api/insights choice validation (AP-01)')` block covering `'toString'`, `'valueOf'`, and `'constructor'`, plus own choices and the `'none'` sentinel, and `docs/audit/task-ledger.md` records `T784` under Phase 140 and closes the `AP-01` Backlog entry.

### 3. Invariants and parity
- **Parity row 3 (`api/classify.ts` shared declarations vs `api/insights.ts`, guarded by `unit/proxy-parity.test.ts` and `unit/proxy-contract.test.ts`):** Verified. `handle` is listed in `OWN = ['handle', 'validate']` (`unit/proxy-parity.test.ts:70`), and all 41 parity tests in `unit/proxy-parity.test.ts` pass unchanged.
- **Invariant 1 (No raw ledger data or unrounded currency figures leave the device; no ledger writes):** Verified in `api/insights.ts` (`toState` at lines 502-519 formats `current`, `previous`, `expense`, `previousExpense`, `income`, and `net` with `.toFixed(2)`), `src/utils/insightsClient.ts` (`fetchInsight` at lines 88-143 sends only `{ summary }`), `unit/proxy-contract.test.ts`, and `tests/insights.spec.ts`.
- **Invariant 2 (Closed `InsightPattern` set and own-property `focus` validation):** Verified in `api/insights.ts:625-633`. `Object.hasOwn(PATTERN_CRITERIA, pattern.choice)` accepts only the four own keys of `PATTERN_CRITERIA` (`'CATEGORY_SPIKE'`, `'IMPROVED_SAVING'`, `'NEW_RECURRING'`, `'STEADY'`) and degrades everything else to `'STEADY'`. `Object.hasOwn(focusCriteria, focus.choice)` combined with `focus.choice !== noneKey` accepts only own category names from `summary.categories` and degrades `noneKey` and inherited keys to `null`.
- **Invariant 3 (Caller verification and per-account quota precede body read and upstream fetch):** Verified in `api/insights.ts:539-559` (`checkCaller`, guest `token === null` 401 guard, `checkQuota`, `readBody`, `validate`), untouched by this diff.
- **Strict-mode caller and edge-case check:**
  - Read `api/insights.ts` in full (`lines 1-643`, including `handle` at `530-642` and its caller `POST` at `521-528`) and client caller `src/utils/insightsClient.ts` in full (`lines 1-144`, `fetchInsight` at `88-143`).
  - Edge cases checked:
    1. Inherited `Object.prototype` keys (`'toString'`, `'valueOf'`, `'constructor'`) in `pattern.choice` and `focus.choice`: `typeof choice === 'string'` is true, `Object.hasOwn(...)` is false, degrading `pattern` to `'STEADY'` and `focus` to `null`.
    2. Category literally named `'toString'` or `'constructor'` in `summary.categories`: `focusCriteria[category.name]` defines an own property on `focusCriteria`, so `Object.hasOwn(focusCriteria, focus.choice)` is true and preserves the legitimate category name, whereas `PATTERN_CRITERIA` still has only its four fixed own keys.
    3. Category literally named `'none'`: `noneKey` switches to `'__none__'` (`api/insights.ts:563`), `'none'` is an own key of `focusCriteria` and not equal to `noneKey`, while `'__none__'` is rejected by `focus.choice !== noneKey` before `Object.hasOwn`.
    4. Non-string or missing `choice` (`null`, `undefined`, number, object): short-circuits on `typeof *.choice === 'string'` before calling `Object.hasOwn`.
    5. Non-finite `pattern.confidence` (`NaN`, `Infinity`, `null`, `"0.8"`): `isFiniteNumber(pattern.confidence)` (`api/insights.ts:638`) falls back to `0`.
    6. Node/TS compatibility: `api/tsconfig.json` uses `"lib": ["ES2023"]` (`Object.hasOwn` is standard ES2022+) and `tsc -p api/tsconfig.json` passes with 0 errors.
- **Red-run verification (Step 6):**
  - `6.1`: `git status --porcelain` showed `M api/insights.ts`, `M docs/audit/task-ledger.md`, `M unit/proxy-contract.test.ts`, plus untracked spec and build files.
  - `6.2`: Stashed `api/insights.ts` via `git stash push -- api/insights.ts`.
  - `6.3`: Ran `npx vitest run unit/proxy-contract.test.ts -t "AP-01"` (log: `workflow/stages/03_review/output/logs/T784-red.log`): 1 file failed, 3 failed (`toString`, `valueOf`, `constructor` returned `{ pattern: protoKey, focus: protoKey, confidence: 0.85 }` instead of `{ pattern: 'STEADY', focus: null, confidence: 0.85 }`), 1 passed, 195 skipped (199 total).
  - `6.4`: Restored with `git stash pop --index` and confirmed `git status --porcelain` was identical to `6.1`.
- **Scope, EOL, and em-dash checks:**
  - `git diff --stat`: 3 files changed (`api/insights.ts` `2+/2-`, `docs/audit/task-ledger.md` `2+`, `unit/proxy-contract.test.ts` `53+`).
  - `git ls-files --eol api/insights.ts unit/proxy-contract.test.ts docs/audit/task-ledger.md`: all three are `w/crlf`.
  - Em dashes: `0` in added diff lines and `0` in `api/insights.ts`, `unit/proxy-contract.test.ts`, `docs/audit/task-ledger.md`, `task-T784-spec.md`, `task-T784-build.md`, and `task-T784-review.md`.

### 4. Gates run
- `npx vitest run unit/proxy-contract.test.ts -t "AP-01"` (red run with `api/insights.ts` stashed): 1 file failed, 3 failed, 1 passed, 195 skipped (199 total, 456ms). Log: `workflow/stages/03_review/output/logs/T784-red.log`.
- `npm run lint`: passed (`check:node-globals` 132 files, `check:safe-ids` 132 files, `tsc --noEmit` 0 errors, `tsc -p api/tsconfig.json` 0 errors). Log: `workflow/stages/03_review/output/logs/T784-lint.log`.
- `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`: 5 files passed, 281 passed, 0 failed, 0 skipped (2.52s). Log: `workflow/stages/03_review/output/logs/T784-proxy-unit.log`.
- `npm run test:unit`: 63 files passed, 1450 passed, 0 failed, 0 skipped (70.84s). Log: `workflow/stages/03_review/output/logs/T784-unit.log`.
- `npx playwright test tests/insights.spec.ts --project=chromium`: 1 spec file, 2 passed, 0 failed, 0 skipped (17.1s). Log: `workflow/stages/03_review/output/logs/T784-playwright-chr.log`.
- `npx playwright test tests/insights.spec.ts`: 1 spec file across 3 browsers (chromium, firefox, webkit), 6 passed, 0 failed, 0 skipped (25.9s). Log: `workflow/stages/03_review/output/logs/T784-playwright.log`.

### 5. Not verified
- Live `/api/insights` production endpoint: never called per `AGENTS.md` Stop and ask first (spends TypeSafe credits and live quota).

### 6. Blocking
None.

### 7. Non-blocking
None.

### 8. Rule candidates
None.
