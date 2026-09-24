# 0021 — A unit runner for what the browser cannot reach

**Status:** Accepted. **Reverses** the standing "Vitest is out of scope" decision recorded in `task-ledger.md`.
**Date:** 2026-09-24

## Context

Four phases in a row closed with a stated coverage hole, and each time for the same structural reason: the logic could not be reached by a browser driving the UI.

| Phase | Gap | Why Playwright cannot reach it |
|---|---|---|
| 44 | Repayment guard and the delete/restore reversal in `FinanceContext` | The form disables submit before an overpayment is ever sent, so the guard never runs. The guard's *position* — the idempotency-key leak, the replay ordering — has no UI symptom at all. |
| 46 | The `isSecureContext` branch in `useSpeechRecognition` | Playwright always runs on `localhost`, which **is** a secure context. Structurally unreachable, not merely untested. |
| 47 | Retry/backoff and concurrency in `batchClassifier` | Needs a 429 and then a controlled clock. The UI surfaces only a final count. |
| 48 | Pattern thresholds in `spendingSummary` | Boundary values — exactly +40%, exactly three transactions — cannot be seeded precisely through the transaction form. |

Three separate phases recorded this as a one-off. It is not one: it is the same gap four times, and the accumulating pattern is what makes it worth a phase of its own rather than a fifth apology.

## Reversing a standing decision

`docs/audit/task-ledger.md` has carried Vitest in its **"Not a task — explicitly out of scope this pass"** list since the original audit, alongside `strict` mode, ESLint and the React Compiler. That decision was right when it was made — the app had no logic that a Playwright spec could not reach, so a second runner would have been pure overhead.

Phases 44 through 48 changed the facts. Pure modules with numeric thresholds, a browser-capability branch, and a concurrency/retry loop are all things E2E automation is structurally bad at. The decision is reversed here, explicitly, and the ledger's exclusion list is amended in the same phase so the two documents cannot disagree.

**The rest of that list stands unchanged.** This is not a general reopening of the excluded set.

## Decision: a second runner, strictly bounded

Vitest, as a devDependency, running only files under a top-level **`unit/`** directory.

### Why the directory placement is load-bearing, not cosmetic

Two default globs collide, and both were confirmed by reading the installed packages rather than assumed.

**Vitest's default `include` collects all 22 Playwright specs.** It is `**/*.{test,spec}.?(c|m)[jt]s?(x)`. Left at the default, `npm run test:unit` would load `tests/wallets.spec.ts` under Node and fail in twenty-two unrelated ways.

**Playwright's default `testMatch` collects `*.test.ts` too.** At `node_modules/playwright/lib/common/index.js:597` it is `**/*.@(spec|test).?(c|m)[jt]s?(x)` — note the `@(spec|test)`. Unit tests placed under `tests/`, even in a `tests/unit/` subfolder, would be swept into the E2E run and break the 321-run contract.

So the boundary is drawn three times over:

- Unit tests live in `unit/`, which `testDir: './tests'` structurally cannot see.
- `vitest.config.ts` pins `include: ['unit/**/*.test.{ts,tsx}']`.
- `playwright.config.ts` pins `testMatch: '**/*.spec.ts'`.

That last pin is redundant today and deliberately so. It stops a future "let's tidy the unit tests under `tests/`" from silently detonating the E2E suite — a change that would look like housekeeping and read as green until someone counted the runs.

### Why `vitest.config.ts` is its own file

`vite build` never reads it. That makes **zero production bundle impact structural rather than a matter of discipline**: there is no path by which a test-only plugin, alias or transform can reach the production build, because the production build does not load the file that would declare them.

It also keeps `VitePWA` and the Tailwind plugin out of the test path, which neither suite needs.

### `environment: 'node'` by default, jsdom per file

The two pure-module suites run under Node and never touch jsdom's `AbortSignal`, `fetch` or timer surfaces — all of which are places jsdom and Node differ in ways that produce failures about the environment rather than about the code. The two DOM suites opt in with a `// @vitest-environment jsdom` docblock.

## Decision: the Phase 44 gap is closed by rendering the real provider

The ledger arithmetic sits inline in a 2,581-line React context. Two ways to reach it:

**Extract it into a pure `ledgerMath.ts` and test that.** Rejected. It refactors the single most load-bearing file in the repo, and it proves nothing about the three properties that actually matter here — all of which are properties of *ordering*, not of arithmetic:

- that a rejected overpayment does **not** leak the idempotency key (`CLAUDE.md` records that a leak bricks the form for the rest of its life, because `useIdempotencyKey` reuses the key on retry);
- that the guard sits **after** the `existingTx` replay check, so retrying a payment that already settled its debt is not rejected for exceeding a remainder its own success drove to zero;
- that the wallet writes fire at all — the T63 `setState`-race class of bug, which is invisible to `tsc` because it is a scheduling issue, not a type error.

A pure function extracted from the middle of that sequence can be perfectly correct while the sequence around it is broken.

**Mount `FinanceProvider` in jsdom and call the actions directly.** Accepted. This is literally what "without UI gates" means: the form's disabled submit is bypassed because there is no form. It changes **no production code**, which for this file is the strongest argument available.

The provider is completely inert under test: the auth effect returns early on `!isSupabaseConfigured` and the realtime channel on `!isAuthenticated`, so with no `VITE_SUPABASE_*` variables there is no network call and no WebSocket. The seeded `debt-starter-01` (฿4,500 remaining) and the starter wallets are the fixture.

## This phase changes no file under `src/` or `api/`

Every symbol the tests need is already exported: `FinanceProvider`/`useFinanceState`/`useFinanceActions`, `classifyBatch`, `__resetClassifierState` (already annotated "exported for tests only"), `buildSpendingSummary`/`selectLocalPattern`/`renderInsight`, and `useSpeechRecognition` itself — whose `isSupported` and `error` are the public reads of the private `detectSupport` and `toSpeechError`.

Nothing was widened to make it testable. The consequence is that the bundle expectation is not "small" but **byte-identical on every row**, which is a falsifiable claim rather than a reassurance, and any non-zero delta is a defect to explain before pushing.

## The backoff is linear, not exponential

The brief for this phase described `batchClassifier`'s retry as exponential backoff. It is not. The shipped code is `BASE_BACKOFF_MS * attempt` with `MAX_ATTEMPTS = 2`, which means **exactly one 400 ms wait** and no second retry to grow.

The tests pin what ships. Changing the constant would be a behaviour change to the rate-limit path, and it belongs to a phase that decides it deliberately with a reason — not to a phase whose entire purpose is to describe existing behaviour accurately. Recorded here so the discrepancy is a known decision rather than a later surprise.

Note also that `MAX_CONCURRENCY = 4`, not the retry, is the real rate-limit protection. The module's own header says so, and the concurrency test is therefore the more load-bearing of the two.

## The boundary rule between the suites

**A unit test is not a licence to add a fifth intercepting Playwright spec.** The mocking rule ADR `0020` generalised — every intercepting spec fulfils every response locally, so the suite spends no TypeSafe credits — still holds, and this phase adds a reason to lean on it less rather than more: logic that needs a fabricated network condition to exercise should now be reached in `unit/`, where `fetch` is a stub and the clock is controllable, instead of through a browser.

Conversely, a unit test does not replace an E2E assertion about what the user sees. The 321 existing runs stay exactly as they are; none was migrated, deleted or weakened.

## Consequences

- **A second runner to keep green.** Mitigated by placement: `npm run test:unit` runs in CI *before* `npx playwright install --with-deps`, so a unit failure aborts in seconds without downloading three browsers.
- **Four new devDependencies** — `vitest`, `jsdom`, `@testing-library/react` and its `@testing-library/dom` peer. All dev-only; none reachable from `src/`.
- **`"vite": "^6.2.3"` is tightened to `"^6.4.0"`.** Vitest 5 peers on `^6.4.0`; `6.4.3` is already installed and locked, so this is a no-op against the lockfile that makes a latent floor explicit instead of leaving it for the next `npm update` to discover.
- **Negative controls invert their usual shape.** With no production change to disable, each control is a temporary break *to* production code, confirmed and reverted. Phases 46, 47 and 48 each had a control that moved for the wrong reason, so each one here records which assertion failed and why — not merely that the suite went red.
- **No coverage thresholds.** A percentage target invites tests written for the number. The four gaps are named and closed on their merits; a fifth is added when a fifth is identified, not when a ratio dips.
- **No pre-commit hook.** The repo has never had one, and adding husky is a new dev-workflow dependency this phase does not need to justify itself.
