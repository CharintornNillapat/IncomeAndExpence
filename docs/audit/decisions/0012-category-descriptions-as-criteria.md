# 0012 — A category's criteria text is a user-editable field, not a server-side hint table

**Status:** Accepted
**Date:** 2026-09-23

## Context

ADR `0011` shipped Jev classification and, in its first "Revisit if" clause, named its own weakest point:

> The most likely fix is a per-category `description` field feeding richer `criteria` — a schema change deliberately excluded here, since the probes that scored 1.00 used descriptive option text while this implementation sends bare category names.

That prediction was confirmed against the live deployment within hours of it going up. `api/classify.ts:151-155` builds the `category` question's `criteria` as `{ [category.id]: category.name }`, so the model's entire knowledge of an option is its label:

| Note | Result against the shipped default set |
|---|---|
| `Netflix subscription` | **`other`, confidence 0.93** — the escape option, chosen confidently |
| `ข้าวมันไก่` | `cat-food`, 0.92 — correct |
| `เงินเดือน` | `cat-salary`, 1.00 INCOME — correct |

The Netflix row is not a model failure. It is a correct answer to a badly posed question: the seven default EXPENSE/INCOME categories are `Food & Dining`, `Groceries`, `Transport & Fuel`, `Shopping & Apparel`, `Housing & Utilities`, `Primary Salary`, `Freelance & Side Gig`, and none of those names contains anything a reasonable reader would map a streaming subscription onto. Jev did the right thing and took the `other` escape. The same shape breaks `Spotify`, `ค่าเน็ตบ้าน` (home internet), insurance premiums and every other service or recurring charge.

The TypeSafe guidance is explicit that a `choice` option's criteria should describe the concrete situation it covers and stand on its own; a bare noun phrase does neither. The ADR `0011` probes that returned 1.00 used *described* options. Production does not, and that gap is the entire finding.

## Options considered

**(a) Rename the default categories to be self-describing.** Rejected. `Housing, Utilities & Subscriptions` would fix Netflix and nothing else, it truncates badly in the category chips and `<select>`s that render these names, and it puts prompt engineering into a user-facing label. It also cannot help any category the user created themselves, which is where a personal ledger's taxonomy actually lives.

**(b) A static hint map keyed by category name inside `api/classify.ts`.** Rejected, and it is the option with the strongest surface case: no migration, no UI, no sync, no schema change, and it ships in one file. It fails on ownership. The map can only cover names the repo ships; a user whose categories are `ค่ากิน`, `ผ่อนรถ` and `ร้านป้าแดง` gets nothing from it, and the person who most needs a hint — someone with an idiosyncratic taxonomy — is exactly the person it cannot reach. It also relocates a per-user fact into server code, so tuning a single user's classification would mean a deploy. ADR `0011`'s third counter-argument against deleting the matcher was that a `KeywordRule` is the user's only override channel; a server-owned hint map reintroduces precisely the asymmetry that argument rejected.

**(c) Add an optional `description` to `Category`, editable in the Categories hub, sent as part of each option's criteria.** Chosen. The same field serves the model and the human, the user owns it for their own categories, and the shipped defaults can carry sensible starting text.

## Decision

**(c).** `Category` gains `description?: string` (≤ 120 chars), surfaced as an optional field in both the Add and Edit forms of `CategoriesView`, and `api/classify.ts` formats each option as `` `${name}: ${description}` `` when one is present, falling back to the bare name when it is not.

The nine `DEFAULT_SYSTEM_CATEGORIES` ship with descriptions. The load-bearing one names the failing case outright: `cat-housing` → *"Rent, electricity, water, internet and phone bills, and recurring subscription services like Netflix or Spotify."*

**`undefined` and `''` are different values, deliberately.** `undefined` means "never set", and a new pure helper `withDefaultDescriptions` (`src/utils/categoryUtils.ts`) fills it from the shipped defaults, matched by trimmed lower-cased **name** — not id, because authenticated rows carry uuids while local rows are `cat-*`. `''` means "the user cleared it" and is never refilled. Without this, `safeGetLocalStorage('pf_categories', ...)` returns the array a user already has, so nobody with an existing ledger — including the person who reported the Netflix miss — would ever see the new defaults. The backfill is applied at the same two seams `dedupeCategoriesByName` already occupies (`FinanceContext.tsx:429` hydration, `:740` Supabase load), is in-memory only, and writes nothing to the database.

**The proxy bounds the field but does not rewrite it.** The client caps at 120 chars; `api/classify.ts` rejects above 200. The headroom exists so a legitimate client can never trip the reject and silently lose classification, while the bound still closes the "pad the criteria to burn credits" vector. A blank description is omitted from the wire entirely rather than sent as an empty string. Nothing else about the request changes: `FORBIDDEN_KEYS` still rejects client-supplied `instructions`/`criteria`/`model`/`state`/`questions`, so the *question* remains server-owned even though an *option's* text is now user-supplied data.

**This requires the phase's one schema change.** `supabase/migrations/20260923_add_category_description.sql` is a single additive nullable column. It must be applied **before** the client build ships, because PostgREST rejects an unknown column outright (`PGRST204`) rather than ignoring it — an authenticated user would be unable to create or edit any category at all in the window between deploy and migration.

## Consequences

- **The classifier's accuracy is now partly a user-authored artifact.** A user who writes a good description gets better suggestions; one who writes a misleading one gets worse. This is the intended trade and it mirrors how `KeywordRule` already works, but it means a future accuracy complaint has a new first question: what does that category's description say?
- **Every ADR `0011` invariant survives untouched.** Rules still run first and short-circuit; `classifyDescription()` still never throws; the confidence gates, the coherence rule and the 404-latch are unchanged. This phase changes what an option *says*, not when or whether it is asked.
- **The cache key had to change.** `jevClassifier.ts`'s `cacheKey` now includes each candidate's description, because editing a description is a genuinely different question and a stale cached answer would hide the improvement the user just made.
- **The entry chunk grows slightly.** `FinanceContext.tsx` is eager, so nine default description strings land on the critical path — a small, measured cost recorded in `baseline-metrics.md` rather than waved away. Everything else is in already-lazy chunks.
- **Token cost per call rises by roughly 15 input tokens per described category** (~+105 on the default set against ~530 today), which at $0.042 per million input tokens is not a number worth optimizing.
- **A first-class user-facing field now exists whose primary consumer is a model.** The label and helper text in `CategoriesView` say so plainly ("Helps auto-categorization recognise what belongs here") rather than presenting it as generic metadata, because a field whose purpose is invisible gets filled in badly or not at all.

## Revisit if

- Descriptions measurably fail to move `other` rates on service and subscription notes. The next lever is a dedicated `Subscriptions & Entertainment` default category — deliberately not added here, because changing `DEFAULT_SYSTEM_CATEGORIES`' membership touches seeding, `20260920_dedupe_categories.sql` and the category-count assertions in `tests/categories.spec.ts`, which is a materially larger change than adding a column.
- Users leave descriptions empty in practice. That would make the shipped defaults the only ones that matter and would re-open option (b) as the cheaper equivalent — though only for the repo's own category names.
- Descriptions start being written as prompt instructions rather than as descriptions ("always pick this one"). The field is user-supplied text inside a server-owned question, which bounds the damage to option wording, but it would be a signal that the affordance is being read as a control surface and needs different framing.
- `commitBulkImport` gains classification (still deferred, per ADR `0011`). Descriptions would matter more there, not less, since bulk import has no user watching an individual suggestion.
