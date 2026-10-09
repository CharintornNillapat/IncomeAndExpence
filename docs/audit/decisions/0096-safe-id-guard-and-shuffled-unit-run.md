# 0096: Lint refuses an id from the time alone; CI runs the unit suite a second time, shuffled

**Status:** Accepted. Branch `phase-120-ci-resilience-and-lint-guards`; not merged. No migration.
- **Enforces** ADR `0095`'s rule (a new local record's id is `generateEntityId(prefix)`), until now written only in `CLAUDE.md`.
- **Amends** ADR `0083`: a `findBy*` or `waitFor` waits up to 3 s by default, not Testing Library's 1 s.

**Date:** 2026-10-09

## Context

1. **ADR `0095`'s rule was prose.** Every guest record's id had been `<prefix>-${Date.now()}`, and two records made in one millisecond shared one. `generateEntityId` fixed the eight sites, and `CLAUDE.md` says never to build an id the old way. Nothing stopped a new site from doing it.
2. **Phase 118's bug passed its pull request on timing.** `template-context`'s edit test made two templates in one millisecond only on `main`'s runner (run `37885529942`). The unit suite always ran its files and tests in source order, so a test that leaned on order or on load passed until the day it did not.
3. **The owner's brief:** a static guard in `npm run lint`, a shuffled unit run in CI, and all of the suite passing shuffled.

## Decision

1. **`scripts/check-safe-ids.mjs`, a step of `npm run lint`** (`npm run check:safe-ids`, after the Node globals guard). It reads every source file under `src/`, blanks comments and strings with the Node globals guard's `maskSource` (ADR `0045`), and reports the time turned into text, which is how every such id was built:
   - `${Date.now()}`, or `${Date.now().toString(36)}`, as a whole template expression;
   - a string literal joined to `Date.now()` with `+`, on either side.

   Arithmetic on the time (`resumesAt - Date.now()`, `Date.now() + 1000`) is not reported, nor is the time inside a larger expression. The message names `generateEntityId` and ADR `0095`, with the file, line and column.
2. **An exception carries a reason:** `// safe-id-ignore: <why>` on the line or alone above it. An ignore without a reason, or one that suppresses nothing, is an error. There are three:
   - the helper itself, whose 48 random bits follow the time;
   - `generateIdempotencyKey`'s fallback, whose two random parts follow it;
   - `csvExchange`'s `previewId`, which names one transient preview and is never stored (ADR `0095`, decision 4).
3. **Known limits, accepted:** a string held in a variable and then joined (`p + Date.now()` where `p` is `'w-'`), and `String(Date.now())`, are not seen. Neither form is in `src/`; the guard catches the form the code actually used.
4. **CI's `checks` job runs the unit suite twice:** `npm run test:unit`, then `npm run test:unit:shuffle` (`vitest run --sequence.shuffle`). Vitest shuffles the files, and the describe blocks and tests in each, from a seed it prints first (`Running tests with seed "..."`). `npx vitest run --sequence.shuffle --sequence.seed=<seed>` replays that order. Each run draws a new seed, so CI tries a new order on every push. The second run adds about 50 s to a job that every browser job waits for.
5. **What the shuffle found, and the fixes.** Ten shuffled runs on `main`'s tests failed eight times, in five tests:
   - **`migration-history`:** the four `historyInsert` tests shared one table, each reading the rows the one before it wrote. Each now starts from an empty table and records the file itself when it needs it.
   - **`modal-history`:** the first test's base was `history.length`, which still counted the forward entries an earlier test's Back left; the dialog's push dropped them, so the count came out one short. `start()` now pushes the test's entry instead of replacing it, which drops them first.
   - **`migration-replay`:** the history backfill and the drift query are one scenario on the one replayed database (the replay takes up to a minute): the backfill creates the history the drift query reads. They stay a sequence, as one `describe(..., { shuffle: false }, ...)` block. **It is the suite's only block that opts out**, and its comment says why.
   - **`categories-page`:** the new category's form resets after the add resolves, in a later update than the list's; the reset is now inside the `waitFor`.
   - **`authenticated-ledger`'s sessions test:** the faked session list took longer than `findByText`'s 1 s default under the full suite's load. A wait's bound is a failure bound, not a speed claim (ADR `0083`), so **`unit/setup.ts` sets Testing Library's `asyncUtilTimeout` to 3 s for every file** (`setupFiles` in `vitest.config.ts`). That is under Vitest's 5 s test limit, so a real failure still names its wait. No test waits for a timeout, so a passing run is no slower.

   **The first three are order bugs:** run alone under the seeds that failed, the old files failed (5 of 24 tests in `migration-history` and `modal-history`; `migration-replay`'s drift block or its backfill test) and the new ones pass. **The last two are load:** alone under their seeds they passed 3 of 3, and failed only in the full suite.
6. **Not done:** a pre-commit hook. The repository has none and no hook tool, and CI's `checks` job, which every browser job needs, already runs `npm run lint` on every push and pull request.

## Tests

- **`unit/safe-ids-guard.test.ts` (new, 29):** nine forms it flags (every pre-ADR `0095` shape, base 36, a line break in the braces, a join on either side), its line and column, one report per site; ten it leaves alone (the helper, the time as a number, arithmetic in a template, elapsed time, comments, strings, template text, an ISO timestamp); `src/` clean today; the ignore comment (its line, the next line, one line only, a reason, an unused one); the command's exit codes and output. **With the rules emptied, 17 of the 29 fail.**
- **An intentional violation:** a file in `src/utils/` with `` `w-${Date.now()}` `` and `'kr-' + Date.now()` made `npm run lint` exit 1 with both sites named; removed, it exits 0.

## Gate

- **Lint:** clean.
- **Unit:** 1360/1360 in 61 files (44 s); then **10 shuffled runs, 1360/1360 each** (44 to 76 s), seeds `1791540043982` to `1791540574440`.
- **Playwright:** Playwright 484 passed, 6 skipped, 2 failed of 492 (12.6 m, 4 workers): the WebKit painting stall (ADR `0058`) on `csv-classify`'s Import CSV menu click and `diary`'s Save click, no assertion reached (the trace's last frame 107 and 80 ms into each click, none after), in specs this phase does not change; repeated per the owner's rule: both specs 120 of 120 on WebKit (`--repeat-each 10`).
- **Schema:** no migration; drift DRIFT.
- **Bundle:** unchanged. The `src/` edits are comments, and a build of the branch has the entry `index-CnVTLmA-.js`, the one production serves.
