# 0065: The proxies fetch their keys as they load; a test keeps their shared code identical; a hand-applied migration's history row is printed

**Status:** Accepted. Implemented on branch `phase-89-jwks-prefetch-and-parity` (commit `8a90f90`, docs `fb87276`), draft PR #39. Not merged yet.
- **Amends** ADR `0064`: when the key set is fetched.
- **Amends** ADR `0032`: the two proxies' copies of the caller check are now kept identical by a test, not only by a comment.
- **Amends** ADR `0063`: how a migration applied in the SQL editor gets its history row.

**Date:** 2026-10-05

## Context

**A new instance's first signed-in request waited for the whole key fetch.** Phase 88 (ADR `0064`) moved the token check into the proxies. After its release, tokens refused before any TypeSafe call timed the key set fetch on production:
- 456.0 ms on a new instance;
- 31.3 and 68.3 ms on warm ones;
- 0.2 to 0.6 ms for a check with the keys already held.

A new instance fetched the keys only when the first request with a token reached `checkCaller`, so that request waited for all of it, about what the old auth round trip cost.

**The two copies of the caller check were kept in step by a comment.** `api/classify.ts` and `api/insights.ts` each carry the caller check, the token check, the count and their helpers. A shared module would be the functions' first runtime import, which nothing local can prove Vercel resolves (ADR `0032`, `0064`). Before this phase, `json` and `isPlainObject`, which the token check calls, already differed between the files: a comment in one, a parameter name in the other. Harmless, but it showed the copies drifting with nothing to notice.

**Migrations applied by hand need their history row written by hand.** Phase 73's quota, Phase 64's cleanup and both Phase 88 files were run in the SQL editor. Each needed an insert into `supabase_migrations.schema_migrations`, or the drift check (ADR `0063`) reports the file as missing. Phase 87 wrote one backfill file for four rows, and the owner wrote the Phase 88 rows by hand.

## Decision

### 1. Each proxy starts fetching its key set when it loads

These are Vercel Node functions (`export async function POST`), not Edge functions. Vercel evaluates a function's module when it starts an instance, and every warm request reuses that module. So each proxy now calls `prefetchSigningKeys()` at the top level:
- **It starts and does not wait.** It calls `currentSigningKeys(issuer, false)`, the same path a request takes, so a fetched set is stored exactly as a request would store it. Nothing awaits it, and it cannot reject: `fetchSigningKeys` turns every failure into `null`, and a `.catch` covers the rest.
- **It runs only where tokens are checked:** both `VITE_SUPABASE_URL` and `TYPESAFE_API_KEY` must be set. A deployment without TypeSafe answers 404 before any check, so it fetches nothing.
- **A failure changes nothing.** No keys are held, and the first request fetches them itself, as before this phase.

**A request that arrives during the fetch waits for that same fetch** (`fetchSigningKeysOnce`, with `keysInFlight`), instead of starting its own. This also merges a burst of cold requests into one fetch, which before this phase each started their own. Its `auth` step keeps `desc="keys"`, because it waited on a key fetch; its duration is only what was left of it.

**A fetch under way for more than its own 3 s timeout is not waited for.** Vercel can freeze an instance between requests. A fetch caught by a freeze would make the next request wait out its timer, so a new fetch starts instead.

**What it can save is the gap between the module loading and the token check.** Usually a request is why an instance starts, so the gap is the runtime's start-up after the import plus reading the request. An instance started by a guest request, or by Vercel ahead of traffic, has its keys before a signed-in request reaches it. Nothing local can measure that gap. It is measured on production after release (see "Order of release").

### 2. A unit test keeps the two proxies' shared code identical

`unit/proxy-parity.test.ts` reads both files with the TypeScript compiler API and prints each top-level declaration back from its syntax tree without comments. A comment or a line break may differ; a token, a branch or a constant may not.
- **`SHARED`** lists every declaration the two files must hold as the same code: the response and parsing helpers, Server-Timing, the token check and the prefetch, the count, `POST` and the TypeSafe answer handling.
- **`OWN`** lists the two that differ on purpose: `handle` and `validate`, each proxy's own request and question.
- **Every name both files declare must be in one of the lists,** so a new shared helper is a decision someone makes, not a silent third difference.
- **The only top-level statement outside a declaration is `prefetchSigningKeys();`,** in both.

`insights.ts`'s `isPlainObject` took `classify.ts`'s parameter name (`v`), which made the two identical. Nothing else changed to pass.

### 3. `npm run migration:print-history -- <file>` prints the history row

It prints one statement to paste into the SQL editor right after the migration:

```sql
insert into supabase_migrations.schema_migrations (version, name, created_by)
select '<UTC now, YYYYMMDDHHMMSS>', '<file name without its date>', 'owner, SQL editor'
 where not exists (... where name = ...)
   and not exists (... where version = ...)
returning version, name, created_by;
```

- **The shape is the one the live history already holds**, as the Phase 88 rows the owner wrote. The version is the UTC time the row was printed; `--version=` gives another. The name is the one the drift check matches by (`migrationName`). `created_by` is `owner, SQL editor` unless `--by=` names someone else. `statements` stays null.
- **Idempotent:** a name or a version already recorded inserts nothing, and `returning` shows a row only when it inserted one.
- **It reads no database and writes nothing.** The owner runs the output, so the write stays in the owner's hands.
- **The argument must name a file in `supabase/migrations/`,** given as a path or a bare file name. A bad version or an empty `--by` is refused.

The drift query test in `unit/migration-replay.test.ts` now records the post-Phase 87 files with this statement and then finds no drift. That is what proves the printed rows are the ones the drift check expects.

**Rejected:**
- **A shared `api/_auth.ts`:** still the first runtime import between the functions (ADR `0032`).
- **Keeping instances warm with a scheduled request:** it costs invocations, and it only shortens the wait on instances the schedule happens to reach.
- **Comparing the two files' sections as text:** comments differ on purpose (each file's section header says where the other copy is).
- **A helper that inserts the row itself:** it would need a database credential on the machine running it, for a statement the owner is already pasting.

## Order of release

1. Merge; Vercel deploys. No migration, no database change.
2. Measure on production, with tokens refused before any TypeSafe call. A new instance's first such request should show an `auth` step well under the 456 ms of Phase 88, or none with `desc="keys"`. Then measure a real signed-in request's `Server-Timing` (ADR `0064`, step 5).

## Verification

- **Unit, 970 in 36 files** (895 before):
  - `unit/proxy-prefetch.test.ts` (18): it loads a fresh copy of each proxy with `fetch` and the settings stubbed. It checks:
    - the key fetch starts at load;
    - a later request fetches nothing (no `desc="keys"`);
    - two requests during the fetch share it (one fetch, both `desc="keys"`);
    - a failed prefetch, a 503 or no connection, leaves the first request to fetch;
    - with no keys at all, the answer is 503 and TypeSafe is never called;
    - a prefetch older than 3 s is not waited for;
    - nothing is fetched at load without either setting.
  - `unit/proxy-parity.test.ts` (39): the checks above.
  - `unit/migration-history.test.ts` (18): the UTC version; the file resolved from a path, a Windows path or a bare name; unknown files and probes refused; the statement run twice on a PGlite copy of the live table (one row, then none); an existing name or version left alone; a quote in `created_by` kept; bad input refused.
  - `unit/proxy-contract.test.ts` stubs `fetch` before the proxies load, so their prefetch can never leave the machine, whatever the shell exports.
- **Negative controls,** each failing only its own tests:
  - no prefetch call in `classify.ts` (7: its prefetch tests and two parity tests);
  - a fetch under way not shared (2);
  - a frozen fetch waited for (2, by timing out);
  - the prefetch without the TypeSafe key (2);
  - one constant changed in `insights.ts` (3: two parity tests, and that proxy's rotation test);
  - the helper ignoring a recorded name (2);
  - the helper recording the dated file name (4, including both drift query tests).
- **Lint** clean. **Playwright:** in the refactor log. Every spec mocks `/api/*`.
- **Drift:** `npm run schema:drift` against live returns no rows; this phase has no migration.

## Consequences

- **A new instance's key fetch no longer waits for its first request.** How much a cold signed-in request gains is measured on production after release.
- **A burst of cold requests makes one key fetch, not one each.**
- **A change to one proxy's shared code fails the unit suite until the other matches.** A new declaration in both files must be added to `SHARED` or `OWN`.
- **Every hand-applied migration gets its history row from one command,** in the shape the drift check expects.
