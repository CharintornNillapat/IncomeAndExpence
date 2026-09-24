# 0019 — The CSV importer gets the same two layers as the form

**Status:** Accepted. **Amends the mocking rule set in ADR `0011`** — see "A second spec may mock the classifier" below.
**Date:** 2026-09-24

## Context

ADR `0011` gave transaction entry two categorization layers in a fixed order: `smartMatcher` first, synchronously and for free; Jev second, only on a miss. Phase 45 added rule capture on top of that, so the first layer now grows from the user's own corrections.

**CSV import has neither layer, and it is the one path where categorization matters most.** `parseAndValidateTransactionCsv` reads a `Category` column as a raw string; `commitBulkImport` resolves that string by name or gives up. A bank export — precisely the file people import — has no category column at all. So the bulk path, which creates the most rows in one action, creates them all uncategorized, and the user then faces them one at a time in the ledger.

## Two premises in the brief were wrong, and the record should say so

**The named files do not exist.** There is no `CsvImportModal.tsx` and no `csvParser.ts`. The import modal is inline in `src/views/TransactionsView.tsx`, and parse/validate/export all live in `src/utils/csvExchange.ts`. Extracting the modal into its own component is deliberately **not** done here: it is a large diff unrelated to the feature, and the bundle requirement is already satisfied because `TransactionsView` is lazy.

**There are no duplicate-detection rules to preserve.** `commitBulkImport` writes `idempotency_key: import-${Date.now()}-${row.rowIndex}`. The timestamp means it never collides, so re-importing the same file creates duplicates — and `csv.spec.ts:50-52` **asserts that on purpose**, with a comment calling the re-imported row "a genuinely new transaction, not a merge".

So the invariant is the *absence* of dedupe, and this phase's obligation is not to introduce one by accident. Stated here because "preserve duplicate detection" would otherwise read, to a later auditor, as a claim that some existed.

## Decision

**The importer runs the same two layers, in the same order, and shows the result before anything commits.**

### Layer 2 reuses `classifyDescription` behind a concurrency pool

No new endpoint. The existing client already carries everything a batch wants:

- **A module-level LRU cache.** A statement with forty `7-ELEVEN` lines costs **one** request. This is the largest single win available and it comes for free.
- **The 404 availability latch.** Under the Vite dev server and in Playwright, `api/` is not served at all, so the first row latches off and rows 2..N make no request.
- A request timeout and response normalization.

Reusing it also leaves `api/classify.ts` untouched, so ADR `0011`'s property that **the server owns the Jev question wording** — the thing standing between this endpoint and an open relay billed to the project's TypeSafe key — is not re-opened. A batch endpoint would mean a new wire contract, a new validation surface for that same attack, and a deployment-ordering dependency, in exchange for saving round-trips the cache already saves.

**Rejected: a `/api/classify-batch` endpoint.** Recorded as a follow-up gated on a *measured* problem — a real file where the pool is demonstrably too slow — rather than on a guess about one.

### `classifyOnce`, and why the wrapper's contract is frozen

`classifyDescription` returns `ClassifyResponse | null`, which cannot distinguish "the model said *other*" from "we were rate-limited" from "the endpoint is gone". A batch needs that distinction: it should back off on one, stop entirely on another, and accept the third.

The body moves into `classifyOnce`, returning a discriminated result. `classifyDescription` stays as a thin wrapper that collapses it back to `ClassifyResponse | null`.

**Its three existing call sites see no change at all.** That is the point of keeping the wrapper rather than migrating them: `jev-classify.spec.ts` is the regression guard for the live-typing path, and it must pass unedited. A refactor that forced it to change would be indistinguishable, in the diff, from a behaviour change.

### The pool's guards

- **Concurrency capped at 4 in flight.** This is the actual rate-limit protection; retry is secondary to not flooding in the first place.
- `rate-limited` → exponential backoff, at most 2 attempts per row.
- `unavailable` → abort the whole run immediately rather than walking the remaining rows into a wall.
- Progress reported per completion, and cancellable by `AbortSignal` so closing the modal stops it.

### An explicit button, not automatic classification

The dry-run preview appears instantly with Layer 1 already applied. Layer 2 runs only when the user presses **Classify remaining with Jev**.

This is also the brief's "option to skip if offline or in a hurry", achieved by not adding a control: you skip by not pressing. Automatic classification would fire network calls and spend TypeSafe credits on every CSV upload, before the user has expressed any interest in them — and the first thing many people do with an importer is upload a file to see whether it parses.

### Confidence mirrors the form exactly

Apply at ≥0.85, show unapplied at 0.50–0.85, silent below. The same `CONFIDENCE` object, so one number means one thing in both surfaces.

Applying everything ≥0.50 was tempting — every row here is visible and overridable before commit, unlike the live form — and rejected: it would make the same score mean two different things depending on where you were standing, and a distracted user would commit 0.55-confidence guesses in bulk.

## Two safety rules on what may be written

**AI never changes a row's `type`.** The CSV declares it, and `type` is what drives the wallet debit/credit direction in `commitBulkImport`. Letting a probabilistic answer flip a row from EXPENSE to INCOME would move money in the wrong direction in bulk, silently. Only `categoryId` is ever written.

**A category whose `type` disagrees with the row's `type` is demoted to a suggestion**, never applied — the same rule Phase 45 uses for the rule chip, and consistent with `toSuggestion`'s existing coherence check.

**Eligible rows** are valid rows whose `categoryName` does not resolve to a live category. That covers both "no column" and "names a category you do not have"; in both cases the row was going to commit uncategorized, so filling it can only improve on the status quo.

## The ledger change is two lines, on purpose

`ImportRowValidation` gains `categoryId?: string`, and `commitBulkImport` prefers it over the existing name lookup.

Wallet deltas, the skip rules, the transfer guard and the idempotency key are **not edited**, which is how balances and the no-dedupe behaviour are preserved — by not touching the code that implements them.

**Classification metadata stays out of that type.** Confidence and applied/suggested state live in a view-level map keyed by row index, because `ImportRowValidation` is the commit payload and should not accrete UI state. ADR `0016` already noted this type's shape decides what the importer can target; keeping it minimal keeps that reasoning legible.

## A second spec may mock the classifier

`CLAUDE.md` has said that `jev-classify.spec.ts` is **the only** spec that intercepts requests. `csv-classify.spec.ts` must intercept `/api/classify` too, so that line is amended, in the same commit as the spec.

The rule's **purpose** — the suite spends no TypeSafe credits and needs no API key, on CI or on a laptop that happens to have one exported — is *upheld* by a second spec that fulfils every response locally. What the rule was protecting against is an unmocked call escaping to the vendor, not the number of files containing a `page.route`.

Folding CSV cases into `jev-classify.spec.ts` to preserve the letter of it would make that file about two features, and it is currently the clearest single-purpose spec in the suite. The amendment names both files explicitly so the next person adding a third has to make the same decision deliberately.

Note that Phase 46's `addInitScript` stub is a different thing again and is not covered by this rule; it intercepts no requests.

## Consequences

- **`jevClassifier` gains a second lazy importer.** It is currently reached only through `TransactionForm`; `TransactionsView` now reaches it too. Phase 43 showed this exact shape can make Rollup re-partition a shared chunk, so the chunk count is a thing to check rather than assume.
- **The cache is now load-bearing for cost, not just latency.** A large import's request count depends on how many *distinct* descriptions it holds. A change to `CACHE_CAPACITY` (currently 50) is now a change to what a bulk import costs.
- **`classifyDescription` has an internal seam.** Future work should extend `classifyOnce`'s result kinds rather than widening the wrapper, which exists to keep three call sites and one spec frozen.

## Deliberately not done

- **No CSV deduplication.** Out of scope, and actively pinned against by `csv.spec.ts`. Changing it needs its own decision about what "the same transaction" means across two files.
- **No extraction of the import modal** into its own component.
- **No batch endpoint**, per above.
- **No AI-driven `type` correction**, per above.
- **No classification of *invalid* rows.** They cannot commit, so spending a request on one buys nothing.

## Revisit if

- A measured import is slow enough that round-trips, rather than model latency, are the bottleneck. That is the trigger for the batch endpoint, and it should come with the measurement.
- `CACHE_CAPACITY` is changed, or the cache is given a TTL. Both now affect bulk import cost.
- A third spec needs to mock the classifier. The amendment above should be re-read rather than extended by reflex.
