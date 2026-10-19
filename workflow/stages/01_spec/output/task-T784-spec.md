# T784 spec: Insights choice validation uses Object.hasOwn instead of in (AP-01)

Phase 140 (branch `phase-140-gemini-trial`). Source: `docs/audit/audit-2026-10-16.md` finding AP-01 (low, lines 123-135).

## 1. Goal

Replace the `in` operator checks on `PATTERN_CRITERIA` and `focusCriteria` in `api/insights.ts` (`lines 626` and `631`) with `Object.hasOwn(...)`, so inherited `Object.prototype` property names (such as `"toString"`, `"valueOf"`, or `"constructor"`) returned by upstream degrade to `'STEADY'` for `pattern` and `null` for `focus` instead of bypassing validation.

## 2. Target files

- `api/insights.ts`
- `unit/proxy-contract.test.ts`
- `docs/audit/task-ledger.md` (bookkeeping)

No ADR: this closes a low audit finding by enforcing the existing closed `InsightPattern` and category-focus contract (`docs/contexts/api-proxies.md:56`); no new rule or architecture decision. No `refactor-log.md` or `baseline-metrics.md` entry unless the owner closes Phase 140 in a later task.

## 3. Context to read

`docs/contexts/api-proxies.md`: covers `api/insights.ts` (`line 10`), the parity contract between `api/classify.ts` and `api/insights.ts` (`lines 48-52`), and the insights choice contract (`lines 54-57`). Nothing else.

## 4. Current behaviour

- `api/insights.ts:49-58`: `PATTERN_CRITERIA` is a plain object literal (`Record<string, string>`) with four own keys: `'CATEGORY_SPIKE'`, `'IMPROVED_SAVING'`, `'NEW_RECURRING'`, and `'STEADY'`.
- `api/insights.ts:563-569`: `focusCriteria` is a plain object literal (`Record<string, string>`) populated with each category's `name` from `summary.categories` plus `noneKey` (`'none'`, or `'__none__'` when a category is literally named `'none'`).
- `api/insights.ts:625-628`: `chosenPattern` checks `typeof pattern.choice === 'string' && pattern.choice in PATTERN_CRITERIA`. Because `PATTERN_CRITERIA` inherits from `Object.prototype`, `pattern.choice in PATTERN_CRITERIA` evaluates to `true` for inherited property names such as `'toString'`, `'valueOf'`, or `'constructor'`, returning an invalid `InsightPattern` string instead of falling back to `'STEADY'`.
- `api/insights.ts:630-633`: `chosenFocus` checks `typeof focus.choice === 'string' && focus.choice !== noneKey && focus.choice in focusCriteria`. Because `focusCriteria` also inherits from `Object.prototype`, `focus.choice in focusCriteria` evaluates to `true` for `'toString'`, `'valueOf'`, or `'constructor'`, returning a non-existent category name instead of `null`.
- `api/classify.ts:684-685`: does not use the `in` operator on model choices (`detectedType` compares `txtype.choice === 'INCOME' ? 'INCOME' : 'EXPENSE'`, and `chosen` compares `chosen === otherKey ? null : chosen`).

### Money and proxy invariants this change must keep

1. **No raw ledger data or unrounded currency figures leave the device (`AGENTS.md` Non-negotiables, `docs/contexts/api-proxies.md:57`):** `/api/insights` accepts only `SpendingSummary` aggregates, formats all currency totals in `toState` with `.toFixed(2)` (`api/insights.ts:508-515`), and performs no ledger writes or balance mutations. Proved by `unit/proxy-contract.test.ts` and `tests/insights.spec.ts`.
2. **Closed `InsightPattern` set and own-property `focus` validation (`docs/contexts/api-proxies.md:56`):** `InsightsResponse.pattern` is always one of the four own keys of `PATTERN_CRITERIA` (`'CATEGORY_SPIKE'`, `'IMPROVED_SAVING'`, `'NEW_RECURRING'`, `'STEADY'`), degrading any unrecognized or `Object.prototype` string to `'STEADY'`; `InsightsResponse.focus` is always either an own category name from `summary.categories` or `null`, degrading `noneKey` and any unrecognized or `Object.prototype` string to `null`. Proved by the new AP-01 tests in `unit/proxy-contract.test.ts`.
3. **Caller verification and per-account quota precede body read and upstream fetch (`docs/contexts/api-proxies.md:29-37`):** Guests receive `401` and signed-in callers are checked against JWKS and counted via `consume_ai_quota()` before `readBody`, `validate`, or TypeSafe `fetch`. Proved by `unit/proxy-contract.test.ts` (`caller check` and `per-account limit` suites).

## 5. Parity map

Row 3 (`api/classify.ts` shared declarations vs `api/insights.ts` (`checkCaller`, JWKS, `checkQuota`, `readBody`, timings), guarded by `unit/proxy-parity.test.ts` and `unit/proxy-contract.test.ts`): the edit is inside `handle` in `api/insights.ts`, which is listed in `OWN = ['handle', 'validate']` in `unit/proxy-parity.test.ts:70` because each proxy has its own request shape and upstream answer parsing. `unit/proxy-parity.test.ts` must continue to pass without changes to `SHARED` or `OWN`.

## 6. Tests to add

In `unit/proxy-contract.test.ts`, append one `describe` block at the end of the file (after line 905):

```ts
describe('/api/insights choice validation (AP-01)', () => {
  it.each(['toString', 'valueOf', 'constructor'])(
    'degrades Object.prototype key "%s" in pattern.choice to STEADY and in focus.choice to null',
    async (protoKey) => {
      upstreamReplies(200, {
        answers: {
          pattern: { choice: protoKey, confidence: 0.85 },
          focus: { choice: protoKey, confidence: 0.75 },
        },
      });

      const res = await insights(postAs('/api/insights', INSIGHTS_BODY, `Bearer ${await freshToken()}`));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        pattern: 'STEADY',
        focus: null,
        confidence: 0.85,
      });
    },
  );

  it('keeps own pattern and category choices and maps the none sentinel to null', async () => {
    upstreamReplies(200, {
      answers: {
        pattern: { choice: 'IMPROVED_SAVING', confidence: 0.91 },
        focus: { choice: 'Food & Dining', confidence: 0.88 },
      },
    });
    const ownRes = await insights(postAs('/api/insights', INSIGHTS_BODY, `Bearer ${await freshToken()}`));
    expect(ownRes.status).toBe(200);
    expect(await ownRes.json()).toEqual({
      pattern: 'IMPROVED_SAVING',
      focus: 'Food & Dining',
      confidence: 0.91,
    });

    upstreamReplies(200, {
      answers: {
        pattern: { choice: 'STEADY', confidence: 0.8 },
        focus: { choice: 'none', confidence: 0.9 },
      },
    });
    const noneRes = await insights(postAs('/api/insights', INSIGHTS_BODY, `Bearer ${await freshToken()}`));
    expect(noneRes.status).toBe(200);
    expect(await noneRes.json()).toEqual({
      pattern: 'STEADY',
      focus: null,
      confidence: 0.8,
    });
  });
});
```

**Why it fails today (red run):**
Before editing `api/insights.ts`, run `npx vitest run unit/proxy-contract.test.ts -t "AP-01"` and save the output to `workflow/stages/02_build/output/logs/T784-red.log`. The three `it.each(['toString', 'valueOf', 'constructor'])` cases must fail because `protoKey in PATTERN_CRITERIA` and `protoKey in focusCriteria` evaluate to `true` on `Object.prototype`, returning `{ pattern: protoKey, focus: protoKey, confidence: 0.85 }` instead of `{ pattern: 'STEADY', focus: null, confidence: 0.85 }`.

**Source change after the red run (`api/insights.ts:625-633`):**
Replace lines 625-633 of `api/insights.ts`:

```ts
  const chosenPattern =
    typeof pattern.choice === 'string' && pattern.choice in PATTERN_CRITERIA
      ? (pattern.choice as InsightsResponse['pattern'])
      : 'STEADY';

  const chosenFocus =
    typeof focus.choice === 'string' && focus.choice !== noneKey && focus.choice in focusCriteria
      ? focus.choice
      : null;
```

with:

```ts
  const chosenPattern =
    typeof pattern.choice === 'string' && Object.hasOwn(PATTERN_CRITERIA, pattern.choice)
      ? (pattern.choice as InsightsResponse['pattern'])
      : 'STEADY';

  const chosenFocus =
    typeof focus.choice === 'string' && focus.choice !== noneKey && Object.hasOwn(focusCriteria, focus.choice)
      ? focus.choice
      : null;
```

Change nothing else in `api/insights.ts`.

**Ledger (`docs/audit/task-ledger.md`):**
- Add row `T784` under `## Phase 140 - Gemini trial (no ADR)` with Task `Insights choice validation uses Object.hasOwn instead of in (AP-01)`, Files `` `api/insights.ts`, `unit/proxy-contract.test.ts` ``, Status `done`, empty Commit, and Gate result.
- Add a Backlog row at the end of `## Backlog` (and mark it `done in Phase 140 (T784)` per `workflow/stages/01_spec/CONTEXT.md:13`):
  `| Insights choice validation uses in operator instead of own-property check | Audit 2026-10-16 (T759), finding AP-01, low; \`api/insights.ts:625-634\` | done in Phase 140 (T784) |`

## 7. Gates

Changed paths: `api/insights.ts`, `unit/proxy-contract.test.ts`, `docs/audit/task-ledger.md`. Union of tiers (`api/` tier + `unit/` tier + affected Playwright spec + money-path red-first rule):

```
npm run lint
npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts
npm run test:unit
npx playwright test tests/insights.spec.ts --project=chromium
npx playwright test tests/insights.spec.ts
```

Check ports 3000 and 3100 for stale dev servers before Playwright. Save full-suite output to `workflow/stages/02_build/output/logs/`. Also check line endings and em dashes:

```
git ls-files --eol api/insights.ts unit/proxy-contract.test.ts docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T784-spec.md
```

Expect `w/crlf` on all three tracked files and `0` em dashes.

## 8. Production touch points

none (never send any request to production `/api/*`; all tests call the exported `POST` handler directly or mock the route locally).

## 9. Out of scope

- `validate` in `api/insights.ts` (including `AP-02` at `api/insights.ts:482-485`, which is a separate finding).
- `api/classify.ts` and `api/csp-report.ts`.
- `src/utils/insightsClient.ts` and `src/utils/spendingSummary.ts`.
- Any other audit finding or Backlog item (`AP-02`, `SL-01`, or the T782 Backlog rows).
