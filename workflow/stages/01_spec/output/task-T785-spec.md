# T785 spec: Insights validator checks category changePercent (AP-02)

Phase 140 (branch `phase-140-gemini-trial`). Source: `docs/audit/audit-2026-10-16.md` finding AP-02 (low, lines 137-149).

## 1. Goal

Validate each category's `changePercent` in `api/insights.ts` (`validate`, `lines 476-485`) so it must be `null` or a finite number (`changePercent === null || isFiniteNumber(changePercent)`), rejecting payloads with an omitted, non-numeric, or non-finite `changePercent` with `400` before `toState` can format `NaN% vs last month` into the upstream prompt.

## 2. Target files

- `api/insights.ts`
- `unit/proxy-contract.test.ts`
- `docs/audit/task-ledger.md` (bookkeeping)

No ADR: this closes a low audit finding by completing the existing `SpendingCategorySummary` validation in `api/insights.ts` (`docs/contexts/api-proxies.md:37`); no new rule or architecture decision. No `refactor-log.md` or `baseline-metrics.md` entry unless the owner closes Phase 140 in a later task.

## 3. Context to read

`docs/contexts/api-proxies.md`: covers `api/insights.ts` (`line 10`), the request check order (`lines 26-38`), the parity contract between `api/classify.ts` and `api/insights.ts` (`lines 48-52`), and the insights aggregate contract (`lines 54-57`). Nothing else.

## 4. Current behaviour

- `src/types.ts:296-307`: `SpendingCategorySummary` declares `changePercent: number | null` ("Signed percentage change; `null` when there is no prior month to compare").
- Client request-building trace (proving `changePercent` is never `undefined` in any legitimate client payload, so keeping `400` on missing `changePercent` cannot break the Insights card):
  - `src/components/dashboard/SpendingInsightsCard.tsx:52-55, 84`: the only caller of `fetchInsight` builds `summary` via `buildSpendingSummary(transactions, categories)` and passes it directly to `fetchInsight(summary, userId)`.
  - `src/utils/insightsClient.ts:88-115`: the only caller of `fetch('/api/insights', ...)` serializes `{ summary }` with `JSON.stringify({ summary })` at line 115 without mutating `summary.categories`. (And even if the server returned `400`, `insightsClient.ts:124` `if (!res.ok) return local;` falls back to `selectLocalPattern(summary)` without throwing or rendering an error state.)
  - `src/utils/spendingSummary.ts:122-136`: `buildSpendingSummary` is the sole constructor of `SpendingCategorySummary` objects in `src/`. At line 132 it sets `changePercent: !hasPreviousMonth || prior === 0 ? null : roundToCents(((curr - prior) / prior) * 100)`. When `!hasPreviousMonth` or `prior === 0`, `changePercent` is explicitly `null`. Otherwise `prior` is a non-zero finite cent total (`roundToCents(previousByCategory.get(name) ?? 0)` at line 124) and `curr` is a finite cent total (`roundToCents(entry.total)` at line 125), so `roundToCents(((curr - prior) / prior) * 100)` (`src/utils/money.ts:22-24`) always returns a finite `number`. No code path in `src/` can ever leave `changePercent` as `undefined` (or `NaN`/`Infinity`, which `JSON.stringify` would serialize as `null` anyway).
- `api/insights.ts:474-485`: inside `validate`, each item `raw` in `summary.categories` is checked for `isPlainObject(raw)`, `name`, duplicate `name`, and `if (!isFiniteNumber(current) || !isFiniteNumber(previous) || !isFiniteNumber(txCount)) { return 'Category totals must be finite numbers.'; }`. `raw.changePercent` is not destructured or checked.
- `api/insights.ts:503-509`: `toState` renders each category's `delta` as `c.changePercent === null ? 'no prior month' : `${c.changePercent >= 0 ? '+' : ''}${Math.round(c.changePercent)}% vs last month``. When a caller omits `changePercent` (`undefined`) or passes a non-numeric value (such as `'5%'`, `true`, or `{}`), `validate` accepts the body, `c.changePercent === null` is `false`, `Math.round(c.changePercent as number)` evaluates to `NaN`, and `toState` sends `NaN% vs last month` to TypeSafe.

### Money and proxy invariants this change must keep

1. **No raw ledger data or unrounded/NaN figures leave the device (`AGENTS.md` Non-negotiables, `docs/contexts/api-proxies.md:37, 57`):** `/api/insights` accepts only valid `SpendingSummary` aggregates, rejects any category whose `current`, `previous`, `txCount`, or non-null `changePercent` is not a finite number with `400` before calling TypeSafe, and formats currency totals in `toState` with `.toFixed(2)` (`api/insights.ts:508-515`) and finite `changePercent` values with `Math.round(c.changePercent)`. Proved by the new AP-02 tests in `unit/proxy-contract.test.ts` and `tests/insights.spec.ts`.
2. **Closed `InsightPattern` set and own-property `focus` validation (`docs/contexts/api-proxies.md:56`):** `InsightsResponse.pattern` is always one of the four own keys of `PATTERN_CRITERIA`, and `InsightsResponse.focus` is always an own category name from `summary.categories` or `null`. Proved by `unit/proxy-contract.test.ts` (`AP-01` suite).
3. **Caller verification and per-account quota precede body read and upstream fetch (`docs/contexts/api-proxies.md:29-37`):** Guests receive `401` and signed-in callers are checked against JWKS and counted via `consume_ai_quota()` before `readBody`, `validate`, or TypeSafe `fetch`. Proved by `unit/proxy-contract.test.ts` (`caller check` and `per-account limit` suites).

## 5. Parity map

Row 3 (`api/classify.ts` shared declarations vs `api/insights.ts` (`checkCaller`, JWKS, `checkQuota`, `readBody`, timings), guarded by `unit/proxy-parity.test.ts` and `unit/proxy-contract.test.ts`): the edit is inside `validate` in `api/insights.ts`, which is listed in `OWN = ['handle', 'validate']` in `unit/proxy-parity.test.ts:70` because each proxy validates its own request shape. `unit/proxy-parity.test.ts` must continue to pass without changes to `SHARED` or `OWN`.

## 6. Tests to add

In `unit/proxy-contract.test.ts`, append one `describe` block at the end of the file (after line 958):

```ts
describe('/api/insights category changePercent validation (AP-02)', () => {
  it.each([
    ['omitted (undefined)', undefined],
    ['a numeric string', '5'],
    ['a boolean', true],
    ['an object', {}],
  ])('rejects a category with changePercent %s with 400 without calling TypeSafe', async (_label, badChangePercent) => {
    upstreamReplies(200, { answers: ENDPOINTS[1].answers });
    const category: Record<string, unknown> = {
      name: 'Food & Dining',
      current: 4200,
      previous: 4000,
      txCount: 30,
    };
    if (badChangePercent !== undefined) {
      category.changePercent = badChangePercent;
    }
    const body = {
      summary: {
        ...INSIGHTS_BODY.summary,
        categories: [category],
      },
    };

    const res = await insights(postAs('/api/insights', body, `Bearer ${await freshToken()}`));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Category totals must be finite numbers.' });
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('rejects a JSON number that parses to Infinity with 400 without calling TypeSafe', async () => {
    upstreamReplies(200, { answers: ENDPOINTS[1].answers });
    const rawJson =
      '{"summary":{"month":"2026-09","categories":[{"name":"Food & Dining","current":4200,"previous":4000,"changePercent":1e309,"txCount":30}],"totals":{"income":30000,"expense":7700,"net":22300,"previousExpense":4800}}}';
    const req = new Request('https://finlife.test/api/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await freshToken()}`,
      },
      body: rawJson,
    });

    const res = await insights(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Category totals must be finite numbers.' });
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('accepts changePercent when null or a finite number and formats both cleanly in state', async () => {
    upstreamReplies(200, { answers: ENDPOINTS[1].answers });
    const body = {
      summary: {
        ...INSIGHTS_BODY.summary,
        categories: [
          { name: 'Food & Dining', current: 4200, previous: 0, changePercent: null, txCount: 30 },
          { name: 'Transportation', current: 3500, previous: 4000, changePercent: -12.4, txCount: 12 },
        ],
      },
    };

    const res = await insights(postAs('/api/insights', body, `Bearer ${await freshToken()}`));

    expect(res.status).toBe(200);
    expect(typesafeCalls()).toHaveLength(1);
    const sent = JSON.parse(typesafeCalls()[0][1].body as string);
    expect(sent.state).toContain('- Food & Dining: 4200.00 this month (0.00 last month, no prior month), 30 transactions');
    expect(sent.state).toContain('- Transportation: 3500.00 this month (4000.00 last month, -12% vs last month), 12 transactions');
    expect(sent.state).not.toContain('NaN');
  });
});
```

**Why it fails today (red run):**
Before editing `api/insights.ts`, run `npx vitest run unit/proxy-contract.test.ts -t "AP-02"` and save the output to `workflow/stages/02_build/output/logs/T785-red.log`. All four `it.each` cases and the `1e309` (`Infinity`) case must fail because `validate` does not check `raw.changePercent`, returning `200` and calling TypeSafe (`expected 200 to be 400`).

**Source change after the red run (`api/insights.ts:476-485`):**
Replace lines 476-485 of `api/insights.ts`:

```ts
    const { name, current, previous, txCount } = raw;
    if (typeof name !== 'string' || name.trim().length === 0) return 'Each category needs a name.';
    if (name.length > MAX_CATEGORY_NAME_LENGTH) return 'A category name is too long.';
    // A duplicate name would silently collapse two options into one criteria key.
    if (seen.has(name)) return 'Category names must be unique.';
    seen.add(name);
    if (!isFiniteNumber(current) || !isFiniteNumber(previous) || !isFiniteNumber(txCount)) {
      return 'Category totals must be finite numbers.';
    }
```

with:

```ts
    const { name, current, previous, changePercent, txCount } = raw;
    if (typeof name !== 'string' || name.trim().length === 0) return 'Each category needs a name.';
    if (name.length > MAX_CATEGORY_NAME_LENGTH) return 'A category name is too long.';
    // A duplicate name would silently collapse two options into one criteria key.
    if (seen.has(name)) return 'Category names must be unique.';
    seen.add(name);
    if (
      !isFiniteNumber(current) ||
      !isFiniteNumber(previous) ||
      !isFiniteNumber(txCount) ||
      (changePercent !== null && !isFiniteNumber(changePercent))
    ) {
      return 'Category totals must be finite numbers.';
    }
```

Change nothing else in `api/insights.ts`.

**Ledger (`docs/audit/task-ledger.md`):**
- Add row `T785` under `## Phase 140 - Gemini trial (no ADR)` with Task `Insights validator checks category changePercent (AP-02)`, Files `` `api/insights.ts`, `unit/proxy-contract.test.ts` ``, Status `done`, empty Commit, and Gate result.
- Add a Backlog row at the end of `## Backlog` (and mark it `done in Phase 140 (T785)` per `workflow/stages/01_spec/CONTEXT.md:13`):
  `| Insights validator omits category changePercent check, allowing NaN in model prompt | Audit 2026-10-16 (T759), finding AP-02, low; \`api/insights.ts:482-485\` | done in Phase 140 (T785) |`

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
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T785-spec.md
```

Expect `w/crlf` on all three tracked files and `0` em dashes.

## 8. Production touch points

none (never send any request to production `/api/*`; all tests call the exported `POST` handler directly or mock the route locally).

## 9. Out of scope

- `handle` or `toState` in `api/insights.ts`.
- `api/classify.ts` and `api/csp-report.ts`.
- `src/utils/insightsClient.ts` and `src/utils/spendingSummary.ts`.
- Any other audit finding or Backlog item (`SL-01` or the T782 Backlog rows).
