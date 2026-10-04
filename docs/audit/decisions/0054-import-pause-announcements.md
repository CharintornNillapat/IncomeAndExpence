# 0054: A screen reader hears the import's rate-limit pause once, and how the run ended

**Status:** Accepted and released. Commit `77aa908` (docs `40f331d`, hash backfill `69ccea5`), merged into `main` as `45eb2d4` (PR #28). Vercel `dpl_JARpUTJzSYio4svwtyA4RBNpv2mo` is READY in production (`icn1`), and its `TransactionsView` chunk carries `csv-classify-announcer` and the paused, resumed and cancelled sentences. `main` CI on the merge passed, all four jobs (run `37188885802`).
- **Extends** ADRs `0052` and `0053`, whose consequences both said "the countdown is visual only; the progress line is not a live region".

**Date:** 2026-10-04

## Context

- **What a sighted user sees.** While the CSV importer waits out a 429 (ADR `0052`, `0053`), the progress line reads "Classifying 40 of 150 with Jev. Rate limit reached, continuing in 23 s." It counts down once a second.
- **What a screen reader user got: nothing.** None of it was in a live region. A pause of up to a minute looked like a frozen dialog, and a run cancelled or stopped by the limit ended silently.
- **Making the progress line live is the wrong fix.** Its countdown changes every second, so a polite region over it would queue an announcement per second for up to a minute.

## Decision

- **One live region in `ImportCsvModal`:** `<p data-testid="csv-classify-announcer" role="status" aria-live="polite" aria-atomic="true" class="sr-only">`.
  - **Mounted empty with the preview,** before any run, so its first change is already to a live region; some screen readers miss a region that appears with its text.
  - **Visually hidden,** because everything it says is also on screen, as the countdown or the note.
  - **The countdown stays outside it.**
- **It changes only on these events:**

  | Event | What it says |
  |---|---|
  | A pause starts | "Rate limit reached. Classification paused for about N seconds, then it continues on its own." (N once, at the start; "1 second" singular) |
  | The pause ends with the run still going | "Rate limit cleared. Classification resumed." |
  | Cancel | "Classification cancelled. No categories were filled in." (true: a cancelled run applies nothing) |
  | The run stops at a wait over a minute | the note, word for word: "Classified 0 of 1: ... Stopped early: the rate limit asked for a wait of over a minute, so the rest stay blank." |
  | A run that paused finishes | its note, word for word (the counts, or "Jev is unavailable right now...") |

  - **A pause that grows** (a second 429 moves the resume time later) is not announced again.
  - **A run that never paused** stays silent at its end, as before.
- **Why a run that paused also announces its end.** WebKit, with a mocked reply, rendered the end of the pause and the end of the run as one update. So "resumed" was never set, and "paused" was the last thing heard. A fast network or a quick last row can do the same. The closing note makes sure what the pause opened is closed, whichever render the resume lands in.
- **The region is emptied when a run starts,** so the same sentence in a later run (two cancels) is a change and is read again. The flag for "this run announced a pause" resets at the same time.

**Rejected:**
- **`aria-live` on the progress line:** an announcement per countdown tick.
- **`role="alert"` (assertive):** a pause is not an error, and it would interrupt whatever the user is reading.
- **Announcing every run's result:** it would make the region talk for runs that never touched the rate limit, which is outside this ADR's question. It is recorded as open.
- **Announcing the remaining time again partway through:** a minute-long pause is said once; the visible countdown is there to read on demand.

## Verification

- **Unit:** `unit/csv-import-announcer.test.tsx`, new, 11 tests. The real modal runs in the real guest `FinanceProvider`, with `fetch` stubbed and fake timers from the moment Classify is pressed. A `MutationObserver` records every value the region takes.
  - **The region itself:** polite, atomic, `sr-only`, and mounted empty with the preview.
  - **Pause and resume:**
    - a 3 s pause is heard once while the visible countdown moves twice, then "resumed", then the note;
    - "about 1 second," is singular;
    - a pause that grows from 2 s to 5 s is heard once.
  - **How a run ends:**
    - a resume and a finish in one render still end on the note;
    - the endpoint going away after a pause ends on the unavailable note;
    - a cancel during a 30 s pause is heard, and no resume follows, even 30 s later;
    - a 120 s wait gives the note with its counts and no pause.
  - **Between runs:**
    - two cancelled runs are heard as `[cancelled, '', cancelled]`;
    - a clean run after a cancelled paused one says nothing;
    - a run never limited says nothing.
- **Mutations** (`ImportCsvModal.tsx`): 16 of 16 caught.

  | Mutation | Tests failed |
  |---|---|
  | the countdown inside the region | 4 |
  | no resume announcement | 2 |
  | a resume after a cancel or finish | 4 |
  | a pause announced on every change | 1 |
  | no cancel announcement | 3 |
  | no stop announcement | 1 |
  | not emptied when a run starts | 2 |
  | no plural handling | 1 |
  | not a live region | 1 |
  | not atomic | 1 |
  | visible, not `sr-only` | 1 |
  | no closing note after a pause | 3 |
  | no unavailable note after a pause | 1 |
  | the pause flag not reset per run | 1 |
  | the pause flag never set | 4 |
  | mounted only while classifying | all |

  The first run found two survivors, a growing pause and a repeated sentence; both got a test.
- **E2E** (`tests/csv-classify.spec.ts`, three existing tests, new assertions, no new test):
  - the `Retry-After: 2` run is heard as paused, then ends on its note;
  - the 120 s stop is heard;
  - the firewall's Cancel is heard.

  27/27 over three runs on all three browsers. **Negative control:** with no cancel announcement, the firewall test fails on chromium.
- **Gate:** lint clean; unit 781/781 in 30 files; Playwright 439/441 in 8.2 m; the 2 Firefox failures (a `page.goto` timeout in `account-and-mobile-nav.spec.ts`, a Quick Add click never stable in `smart-rules.spec.ts`, both with Firefox's own compositor errors in the log) passed 6/6 on re-run, three times each. **Bundle** (local builds with `.env`, gzip level 9): `TransactionsView` 34,179 -> 34,870 B (+691 B, +255 B gzip), the lazy chunk that holds the import preview. No other chunk changed, and the entry `index-*.js` is identical to `main`'s once its hashed chunk names are normalised.

## Consequences

- **A screen reader user hears that the import is waiting, roughly for how long, that it continued, and how it ended,** without a sentence a second.
- **A run that never meets the rate limit is still silent when it finishes.** Announcing every run's result is a separate, small change.
- **The announcements are tested in jsdom and through the DOM in three browser engines, not with a screen reader.** How each reader queues two polite updates a moment apart ("resumed", then the note) is not verified.
