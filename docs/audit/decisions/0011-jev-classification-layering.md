# 0011 — Jev classification layers behind the keyword matcher; it does not replace it

**Status:** Accepted
**Date:** 2026-09-23

## Context

Transaction entry guesses a category through `src/utils/smartMatcher.ts` (69 lines, pure, synchronous). Its category match is a case-insensitive **substring scan** over the user's `KeywordRule[]`, first match wins in array order (`smartMatcher.ts:48-58`). There is no score, no confidence field on `SmartMatchResult` (`:4-10`), no word-boundary check (`"gas"` matches "Las Vegas"), and no fuzzy or semantic matching. Rule precedence is insertion order — newest first in local mode (`FinanceContext.tsx:1277`, `:1295`), and non-deterministic in cloud mode, since the hydrate query has no `.order(...)` (`:744-746`). Transaction type is not inferred from the text at all: `matchedType = cat.type` (`smartMatcher.ts:53`) simply inherits the matched category's own type. The seed corpus is four hardcoded English keywords (`FinanceContext.tsx:398-403`).

The practical consequence is that a description the user has not personally written a rule for gets no category, and Thai free text works only when a Thai keyword happens to be a byte-for-byte substring.

TypeSafe's Jev (System One) returns typed, calibrated judgments rather than generated text. Measured against this app's category shape before this ADR was written:

| Note | Category | Confidence | Type |
|---|---|---|---|
| `ข้าวมันไก่` | `food_dining` | **1.00** | EXPENSE 0.99 |
| `Shell gas station` | `transport` | **1.00** | EXPENSE 0.99 |
| `Netflix` | `bills` | **1.00** | EXPENSE 0.99 |
| `เงินเดือนเดือนกันยา` | `salary` | **1.00** | INCOME 1.00 |
| `โอนเงินคืนแม่` ("transfer money back to mom") | `other_income` | **0.33** | EXPENSE 0.84 |

Latency 1.1–1.3 s via the `jev` CLI (includes Node startup). Cost ~530 input tokens per call at $0.042 per million input tokens, output free — about **$0.00002 per call**. Both questions return from a single request. Rate limits are 1,200 req/min and 250k tokens/sec, which this app cannot approach.

The last row is the reason a confidence gate is viable rather than cosmetic: on a genuinely ambiguous note the model spread probability across three options (0.41 / 0.36 / 0.23) instead of confidently guessing, and reported 0.33.

**One hard constraint was discovered, not assumed.** `OPTIONS https://api.typesafe.ai/v1/systemone` with `Origin: http://localhost:3000` returns `HTTP 400 — Disallowed CORS origin`. The browser cannot call the API directly at all. A server-side proxy is therefore mandatory on transport grounds, before any argument about key secrecy is made.

## Options considered

**(a) Delete `smartMatcher.ts` and `keyword_rules`; Jev becomes the only classifier.** Rejected — but it is the option with the strongest surface case, so the rejection is argued rather than asserted.

Judged purely as a classifier, the matcher is obsolete. Jev beats a substring scan on Thai, on typos, on merchants with no rule, and it returns a confidence the matcher structurally cannot produce (`SmartMatchResult` has no score field). Keeping two systems is real duplication.

It loses on four counts. **First, it is the offline story.** This is an offline-first PWA whose entire non-Supabase path works with no network (`src/lib/supabase.ts:16`'s `isSupabaseConfigured` gate). Jev needs a round-trip. Deleting the matcher leaves the app with *zero* categorization offline — a capability regression, not a cleanup. **Second, a rule hit is a network call not made**, so the matcher is also the cost- and latency-control mechanism on the habitual descriptions that make up most entries. **Third, it is the user's only override channel** — a `KeywordRule` is where a user pins "ร้านป้าแดง is always Groceries" against the model's opinion; a model offers no equivalent. **Fourth, deletion is not free**: it kills both tests in `tests/keywords.spec.ts`, forces locator rewrites in 2 of the 7 tests in `tests/categories.spec.ts` (`#keyword-category-select`), changes the `deleteCategory` guard message asserted at `categories.spec.ts:139`, and needs a migration for existing `keyword_rules` rows. `implementation-roadmap.md:18` forbids deleting or weakening an assertion to make a refactor pass; this would do exactly that. Against all of this, the maintenance debt being removed is 69 lines of settled pure code with no bugs filed against it.

**(b) Jev first, `smartMatcher` as the offline fallback.** Rejected. More accurate on average, but it inverts the cost and latency profile — every pause in typing becomes a round-trip even for descriptions a rule already covers — and it makes a user's hand-written rule lose to the model, which is the wrong default for a ledger the user owns.

**(c) Rules first, synchronously; Jev consulted only on a rule miss.** Chosen. The instant, free, offline, user-controlled layer stays authoritative and unmodified. Jev fills only the gap rules cannot reach.

## Decision

**(c).** `handleDescriptionChange` (`TransactionForm.tsx:151-169`) keeps its existing synchronous `matchSmartDescription` call verbatim. Only on `!match.categoryId` does it arm a debounced classifier.

```
handleDescriptionChange(text)
  ├─ matchSmartDescription()      sync · 0 ms · offline · free   ← UNCHANGED
  │     └─ hit? apply, DONE — no network call ever made
  └─ miss → useDescriptionClassifier
        ├─ guards: lockType · offline · <2 chars · session-unavailable latch
        ├─ cache hit? apply immediately
        ├─ debounce 450 ms, abort in-flight
        └─ POST /api/classify  →  api.typesafe.ai/v1/systemone
```

**Not changing:** `smartMatcher.ts`, `KeywordRule`, the `keyword_rules` table, the Smart Rules tab, the seeded rules, `addKeywordRule`/`deleteKeywordRule`, `tests/keywords.spec.ts`. Zero migrations.

**The proxy owns the question wording.** `api/classify.ts` (Vercel zero-config Node function; the project is `framework: "vite"`, `nodeVersion: "24.x"`, so a root `api/` directory needs no `vercel.json`) accepts only `{ text, categories: [{id, name}] }` and rejects any body carrying `instructions`, `criteria`, `model` or `state`. Without that rule the endpoint is an open relay for arbitrary Jev prompts billed to the project's key. `text` is capped at 255 chars (matching `TransactionSchema`'s description bound) and `categories` at 60 entries. A missing `TYPESAFE_API_KEY` returns **404**, so the client latches off identically to a missing endpoint.

Two `choice` questions go in one request, per the TypeSafe guidance that independent questions over the same state are asked together: `category`, whose `criteria` is `{ [category.id]: category.name }` over active EXPENSE and INCOME categories plus a mandatory `other` escape; and `txtype` over `EXPENSE`/`INCOME`. ADJUSTMENT and DEBT_REPAYMENT categories are excluded — the model has no business proposing a balance reconciliation. Category ids are used as option keys so the answer round-trips with no lookup table.

**Coherence rule.** The two answers are independent and can disagree. `other` yields no suggestion; otherwise the type is derived from the chosen category's `.type`, exactly as the matcher already does (`smartMatcher.ts:53`), and if that disagrees with the `txtype` answer the result is demoted to a suggestion chip regardless of confidence — disagreement is itself evidence of ambiguity. Otherwise the gate is `min(category.confidence, txtype.confidence)`: **≥ 0.85** auto-fills, **0.50–0.85** renders a chip that writes nothing until tapped, **< 0.50** is silent.

**`classifyDescription()` never throws and never rejects.** Every failure — 404, 5xx, timeout, abort, malformed JSON, offline — collapses to `null`, which renders as "no suggestion", which is today's behavior. `src/` has no error boundary (zero `componentDidCatch`), so a thrown fetch would white-screen the app. This contract is the mitigation.

## Consequences

- **There is no state in which this feature makes the app worse than it is today.** Proxy missing, rate-limited, offline, or key unset all degrade to the exact rule-matcher behavior currently shipped.
- **The existing 129 test runs need no edits, and this is a property of the design rather than a hope.** Playwright's `webServer` is `npm run dev` — the Vite dev server, which does not serve `api/`. `/api/classify` 404s, the session latch trips after one request, and every existing spec sees today's behavior. The phase gate verifies this before any UI lands; a spec that moves is a signal the guard is wrong, not that the spec needs updating.
- **No new npm dependency, so no bundle regression is possible.** The client uses plain `fetch`; `@typesafe-ai/sdk` (209 kB unpacked, `node >= 20`) is deliberately not installed. `vite.config.ts`'s `manualChunks` is untouched and `vendor-math` (110.72 kB gzip) stays off the critical path, preserving ADR `0010`.
- **The write path is untouched.** Jev only pre-fills form fields the user can still edit. `TransactionSchema`, `addTransaction`, `MutationResult`, rollback and idempotency are unchanged — no Zod bypass, no second ledger path.
- **A rule hit costs nothing.** It is the common case on habitual descriptions, and it short-circuits before the cache, the debounce and the network.
- **This introduces the repo's first `page.route()` usage and its first `navigator.onLine` read.** The former is documented in the new spec the way `helpers.ts` documents `gotoTab`. The latter is an optimization (skip a call known to fail), never the safety mechanism — the `null` contract is.
- **Cost is negligible but not zero, and it is bounded by the layering rather than by a quota.** At ~$0.00002 per call with rules absorbing the repeat traffic, a heavy month of manual entry is cents.

## Revisit if

- Measured accuracy on the user's real category set is materially worse than the probe results above. The most likely fix is a per-category `description` field feeding richer `criteria` — a schema change deliberately excluded here, since the probes that scored 1.00 used descriptive option text while this implementation sends bare category names.
- Offline classification becomes viable (a small on-device model, or Jev exposed through a cacheable edge endpoint). That would reopen option (a), because the offline argument is the load-bearing one in this ADR — remove it and the case for keeping two classifiers weakens considerably.
- `commitBulkImport` gains classification. CSV import currently drops unmatched category names to uncategorized (`FinanceContext.tsx:1963-1965`) and never consults rules at all; it is latency-insensitive and high-volume, which is the best fit for batched judgments, and it is explicitly a later phase.
- TypeSafe begins allowing browser origins. The proxy would still be correct for key secrecy, but the transport argument in Context would no longer be load-bearing and a direct dev-mode path could simplify local development.
