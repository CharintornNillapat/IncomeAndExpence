# 0017 — The form offers a smart rule where the user corrects the category

**Status:** Accepted.
**Date:** 2026-09-24

## Context

ADR `0011` made `smartMatcher.ts` the first and authoritative categorization layer: synchronous, free, offline, and the user's only channel for overruling Jev on their own ledger. A rule hit short-circuits before the debounce, the cache and the network.

The layer that is architecturally first is practically last, because of how a rule gets created. The only writer is `CategoriesView`'s Smart Rules sub-tab: navigate to Categories, switch the sub-tab, type the keyword from memory, pick the category, save. Four steps, none of them at the moment the user actually knows what the rule should say — which is the moment they are looking at a wrong or missing category in the entry form and fixing it by hand.

So the app ships four seeded rules (`coffee`, `groceries`, `fuel`, `salary`) and, for most ledgers, nothing after that. Every correction the user makes is discarded. The next identical note is classified identically wrongly, or costs another Jev call for an answer the user already gave.

## Why the affordance is inline, not post-submit

The brief asked for "a subtle post-submit prompt **or** inline chip". Post-submit inside `TransactionForm` is not available, and the reason is worth recording because it is invisible from the form itself:

| Consumer | On a successful write |
|---|---|
| `QuickAddModal.tsx:48-50` | `onClose()` |
| `TransactionsView.tsx:431-433` | `setIsAddModalOpen(false)` |
| `DebtsView.tsx:116-118` | `setRepayDebtTarget(null)` |

All three close their modal. `useSubmitHandler` calls `onSuccess` — and therefore `flashSubmitted(true)` — *after* `onSubmitTransaction` has already resolved, by which point the modal is unmounting. **`TransactionForm.tsx:858-860`'s `✓ Transaction successfully logged!` is effectively dead code**: it only ever paints during `Modal`'s exit animation. Anything rendered post-submit in this component inherits that fate.

**Options considered.**

**(a) A shell-level post-submit toast.** Genuinely post-submit and survives the close. Rejected: it needs new state above view level, a component outside the lazy `TransactionForm` chunk, and either a context change or prop-drilling through both consumers — pressure on the rule that no component above view level subscribes to finance state, for an affordance that belongs beside the field it is about.

**(b) Keep the modal open on success.** Rejected outright. It regresses the primary one-tap flow and changes behaviour several specs assert on (`helpers.ts:64-65` treats the modal closing as the app's own confirmation that the write succeeded).

**(c) An inline chip under the Category select.** Chosen. It is zero-coupled to the submit path rather than merely fast — the requirement "must not block or delay the primary transaction submission flow" is satisfied structurally, because nothing in the submit path reads or waits on it. It mirrors `CategorySuggestionChip` one field above, which established the non-blocking-chip contract in this exact form. And it stays inside the lazy chunk.

The cost, accepted: the rule can be saved before the transaction is recorded, and survives abandoning it. A keyword rule is categorization config, not a financial record — creating one is harmless, reversible from Categories, and was an explicit tap.

## Decision

**A `SaveRuleChip` renders under the Category select when, and only when, five conditions hold.** Every one of them is derived on render — no effect, no debounce, no context change, exactly like ADR `0015`'s payoff block. This is safe for the same reason `TransactionForm.tsx:150` already gives for `userTouchedRef` being a ref rather than state: every path that can flip one of these already triggers its own render.

### 1. `!lockType`

A locked form is the repay modal, which returns from `handleDescriptionChange` before the matcher runs (`:244`). There is nothing to learn from a transaction whose category is fixed by its type.

### 2. The selected category resolves, and its `type` matches the form's `type`

The category `<select>` is **unfiltered** — `:764` maps all `categories`, not the ones matching the current type. So an EXPENSE entry can legitimately be filed under `Primary Salary`. Turning that into a rule would silently flip every future matching entry to INCOME, because `matchSmartDescription` returns the matched category's own type alongside it.

Suppressing is the honest answer. Saving a rule that changes more than the user asked for is worse than not offering one.

### 3. `userTouchedRef.current.category === true`

The human chose this category. One signal, both of the brief's triggers: a manual override, and a low-confidence match the user then resolved.

It is equally important for what it excludes. Without it the chip fires on any note submitted under the untouched default category, so `asdf 50` prompts to file `asdf` under Food & Dining forever. The rule the user never made is the one they will least expect later.

### 4. No existing keyword rule already matches the text

`matchSmartDescription(cleanDescription, keywordRules, categories).categoryId` must be falsy.

This reads like a politeness — don't offer what already exists — and is actually **an invariant**. `addKeywordRule` (`FinanceContext.tsx:1298`) has **no dedupe**: it validates, inserts, and prepends. Two rules with the same keyword and different categories both persist, and `matchSmartDescription` `break`s on the first hit in array order, so the newer one wins while the stale one lingers in the Categories list with no indication it is dead.

Condition 4 is what makes this surface structurally incapable of producing that state. It is not a UX nicety and must not be relaxed without fixing the dedupe first.

### 5. The keyword is plausible: `3 ≤ length ≤ 32`

The lower bound is a safety guard, not padding. `smartMatcher` matches with `lower.includes(kw)`, so a one- or two-character rule captures nearly every future note the user writes — a single accidental save would poison the whole ledger's categorization, and the user would have no obvious way to connect the symptom to the cause.

The upper bound stops a sentence-long note becoming a rule that can never match anything again.

Outside the band the chip does not render. It **never truncates** to fit: saving a keyword the user did not type is the same sin as ADR `0015` rejected when it refused to clamp a typed amount down to the remainder.

## The keyword is `cleanDescription`, verbatim and read-only

`parseExpressInput(description).cleanDescription` — `7-eleven snacks 45` yields `7-eleven snacks`, with `KeywordMappingSchema` trimming and lower-casing it on the way in. The chip prints the exact string it will save, in quotes, so one click carries no surprise.

**Not the raw note**, which would bake the amount into the rule and never match again. **Not a first-token guess** (`7-eleven`), which produces broader rules automatically but discards what the user typed and guesses wrong on `ค่าไฟ` or `lunch team`. **Not an editable field**, which is no longer one click and adds focus management inside a form that already owns a latch, a seed and a debounce.

This mirrors ADR `0013`'s existing split: the ledger stores the note exactly as typed, and only the classifier layers see the stripped text. A rule is a classifier artifact, so it is built from the stripped text.

## Two implementation details that are not obvious

### The confirmation cannot be derived state

A successful save pushes into `keywordRules`, which makes **condition 4 false on the very next render**. A chip that derived its "saved!" confirmation from the same conditions as its offer would erase itself in the same frame it succeeded, and the user would see a flicker rather than a confirmation.

So the confirmation is its own state (`useTransientFlash`, ~4s), rendered *instead of* the derived offer rather than gated by it. The feature's own success is what would otherwise hide it.

### The in-flight guard is about the missing dedupe, not about politeness

`isSavingRule` disables the button while the write is in flight. On a local-storage ledger the write is effectively synchronous and this looks decorative; on an authenticated one it is a Supabase round-trip, and a double-tap writes **two identical rules** for the reason in condition 4. The guard is load-bearing exactly where it is hardest to observe.

## The one behaviour change outside the new feature

`applySuggestion` (`:193-204`) sets `categoryId`, `type` and `autoMatchedCategory`, and clears the suggestion — but **never sets `userTouchedRef.current.category`**, even when `force` is true, which is the path taken when the user taps **Apply** on the mid-confidence chip.

`CLAUDE.md` already asserts the opposite: *"A late answer never overwrites a manual edit — `TransactionForm`'s `userTouchedRef` records manual category/type picks."* Tapping Apply is a manual pick. The code was lagging its own documented contract; nothing had exercised the gap because it takes a second classification landing after an applied one to observe.

One line, gated so the auto-fill path is untouched:

```ts
if (force) userTouchedRef.current.category = true;
```

Without it, condition 3 never fires for the tap-Apply path and the brief's "low confidence" trigger is dead on arrival. It ships as its own commit with its own regression test, because it changes behaviour this feature does not own.

## Consequences

- **`smartMatcher` gets a growth path it has never had.** Rules will now accumulate from real corrections rather than from a settings page nobody visits. `matchSmartDescription` is a linear scan with an `includes` per rule per keystroke; it is fine at tens of rules and worth re-measuring at hundreds.
- **Condition 4 is load-bearing and must be cited if anyone relaxes it.** It is the only thing standing between this surface and duplicate keyword rules.
- **`TransactionForm` gains a fourth non-blocking affordance** (template chips, suggestion chip, payoff block, rule chip). It is at the point where a fifth should prompt extraction rather than another branch — the same note ADR `0015` left about its `DEBT_REPAYMENT` branches.
- **All of it rides the lazy chunk.** `addKeywordRule` is already in the entry chunk via `FinanceContext`; no eager module gains an import.

## Deliberately not done

- **`addKeywordRule` gains no dedupe.** Condition 4 makes *this* surface safe; `CategoriesView`'s own form can still write a duplicate, exactly as it could before this ADR. Fixing it properly is a `FinanceContext` change plus a decision about existing duplicates in live ledgers, which does not belong in a UX phase.
- **No editing or replacing a wrong existing rule from the form.** Condition 4 suppresses the offer precisely when a rule already matched, so correcting one still means visiting Categories. Adding it here costs the no-duplicates guarantee and needs the dedupe work first.
- **The dead `✓ Transaction successfully logged!` line stays.** It is live in principle for any future consumer that keeps its modal open. Removing it is unrelated to this phase and would be a change nobody asked for in a commit about something else.

## Revisit if

- `addKeywordRule` gains real dedupe. Conditions 4 becomes a UX choice rather than an invariant, and offering a rule on an override of an existing one becomes available.
- A consumer mounts `TransactionForm` and keeps its modal open on success. The post-submit option reopens, and `:858-860`'s success line stops being dead.
- Rule counts reach the hundreds. `matchSmartDescription`'s linear scan runs on every keystroke, and this ADR is what made growth likely.
