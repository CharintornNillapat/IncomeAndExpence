# 0055: Every import run is heard when it ends, and local test runs use 4 workers

**Status:** Accepted. Implemented on branch `phase-79-a11y-outcome-and-test-stability`, draft PR. Not merged yet.
- **Amends** ADR `0054`, which announced a run's end only after a pause or a stop at the rate limit.
- **Amends** Phase 55's `workers` note in `playwright.config.ts` ("local runs use more without flakes"), which no longer held.

**Date:** 2026-10-04

## Part 1: every finished run is announced

### Context

ADR `0054` gave the import preview a polite live region (`csv-classify-announcer`), but a run that never met the rate limit finished silently. A screen reader user pressed "Classify remaining with Jev", heard nothing, and had to go looking for the note.

### Decision

- **Every finished run announces its note, word for word**, the same text shown on screen:
  - "Classified 3 of 5: 2 applied, 1 to confirm. 4 requests sent.";
  - "Classified 0 of 1: ..." when nothing matched, so an empty result is not silence;
  - "Jev is unavailable right now. Import still works, and categories stay blank." when the endpoint is missing.
- **ADR `0054`'s flag** for "this run announced a pause" is gone; it existed only to limit the end-of-run note.
- **Unchanged:**
  - the pause, resume and cancel sentences;
  - the countdown, which stays outside the region;
  - a cancelled run, which applies nothing and announces only the cancel;
  - emptying the region when a run starts.
- **No double speech:**
  - the region is the only live element that speaks the outcome; the visible note is not live;
  - `role="status"` and `aria-live="polite"` name the same politeness, so they do not add a second announcement;
  - a run that paused queues two short polite messages ("resumed", then the note), and never one per second.

### Verification

- **Unit** (`csv-import-announcer.test.tsx`, 11 -> 14). Two tests changed their expectation from silence to the note, and three were added:
  - a run never limited is heard once, as its exact note;
  - a missing endpoint from the start is heard as the unavailable note;
  - "nothing matched" is heard;
  - the same note at the end of a second run is read again.
- **Mutations:** 14 of 14 caught.
  - New here: no note at the end of a run (8 failed); the note only after a limit, ADR `0054`'s rule (7); no unavailable note (2).
  - The other eleven are ADR `0054`'s.
- **E2E:** two more existing `csv-classify.spec.ts` tests check the region: a normal run's exact note, and the unavailable note.

## Part 2: local test stability

### Context

The last phases' local gates each lost one or two Firefox tests to timeouts (`page.goto` at 30 s, or a click whose target was "never stable"), in specs those phases did not touch. They passed on re-run, and CI, with retries, stayed green. Phase 78 also had a unit test fail once under full-suite load (`categories-page.test.tsx`).

### What was measured

- **The dev servers were started by hand with their output logged.** Neither logged a dependency re-optimisation or a page reload during a run, so a Vite reload under a navigation is ruled out.
- **Every Firefox test three times (441 runs), on warm servers for the second run:**

  | | 6 workers (Playwright's default here: half of 12 logical CPUs) | 4 workers |
  |---|---|---|
  | Failed | 2, both `page.goto` timeouts | 0 |
  | Wall time | 10.4 m | 10.2 m |
  | Slowest test | 42.5 s | 12.1 s |
  | Tests over 20 s | 10 | 0 |

  - **At 6 workers the slow runs were spread through the run,** 9 of the 10 over 20 s were not their spec's first test, so they were not cold-compile cost. Tests that take 3 to 10 s alone took 20 to 42 s.
  - **The two failures were the first requests to the PWA server on port 3100** (`toast-layering.spec.ts`), a cold server under that load.
  - **Six workers bought no speed:** the same 441 runs took 10.4 m against 10.2 m.
- **The unit flake is a real race in the test.**
  - The test waited for "Last free" to appear in the list, then called `addCategory`. But the colour guard reads `categoriesRef`, which a passive effect updates after that render.
  - Under a loaded full run, the effect had not always run, so the guard still saw a free colour and refused the repeat.

### Decision

- **`workers: process.env.CI ? 2 : 4`.** Local runs use 4 workers; CI is unchanged at 2 per browser job, with its 2 retries. `--workers=N` still overrides it for one run.
- **The categories test flushes pending effects with `act` after the row appears,** as React does before it handles a person's next tap. It tests the guard, not the effect's timing, so `act` hides nothing it means to check.

**Rejected:**
- **A longer navigation timeout:** it would let a 42 s page load pass instead of removing the contention that made it 42 s.
- **Local retries:** a local gate should show a failure, not absorb it.
- **Vite `server.warmup`:** first-request compile caused 2 of the 12 slowest runs; the rest came from load throughout the run.
- **Fewer than 4 workers:** 4 already had no slow tail, and fewer would add wall time.

### Verification

- **Unit:** the full suite three times in a row, 784/784 each.
- **Playwright, the full suite at 4 workers, each run starting both dev servers cold:** 441/441 twice, first pass, no retries (7.3 m and 7.2 m; slowest test 10.3 s and 10.9 s).
- **Gate:** lint clean; unit 784/784 in 30 files, three times. **Bundle** (local builds with `.env`, gzip level 9): `TransactionsView` 34,870 -> 34,784 B (-86 B, -34 B gzip), from removing the pause flag. No other chunk changed, and the entry `index-*.js` is identical to `main`'s once its hashed chunk names are normalised.

## Consequences

- **A screen reader user hears the result of every classification run,** including one that found nothing or could not reach Jev.
- **Local gates should read first time.** The measurement is from one 12-thread machine, so a different machine may want a different number, measured the same way (`--repeat-each 3 --project=firefox --reporter=list`, compare the slowest tests).
- **CI is untouched.**
