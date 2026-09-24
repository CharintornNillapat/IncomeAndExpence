# 0020 — Ask the model about the month; render the sentences here

**Status:** Accepted. **Generalises the mocking rule** last amended by ADR `0019`.
**Date:** 2026-09-24

## Context

Jev has only ever been asked one question: *which category is this one note?* ADR `0011` established it, `0019` extended it to bulk import. Every answer concerns a single transaction.

The question a user actually has — *how was this month?* — has never been put to it. The Dashboard already computes the material: cashflow totals, a category breakdown, debt progress, recent activity. It presents numbers and says nothing about them.

## The brief named a view that does not exist

There is no `src/views/AnalyticsView.tsx` and no Analytics tab. The app has seven tabs — Dashboard, Transactions, Wallets, Debt Payoff, Holistic Diary, Categories, Security.

`DashboardView` *is* the analytics surface: `CashflowMetricsCards`, `CategoryExpenseDistribution`, `DebtPayoffOverview` and `RecentTransactionsTable` all sit under its "Periodic Cashflow & Outflow Analysis" section. The card goes there, beside the category distribution.

**No eighth nav tab is created.** One card does not justify a view, a desktop tab, a mobile tab, a lazy route and navigation tests — and `DashboardView` is already lazy, which is what the bundle constraint actually requires. Revisit if a second analytical surface ever appears.

## Decision: the model chooses; the app writes

`/api/classify` uses Jev `type: 'choice'` questions, because Jev is a classification API. So the wrap-up is **not** generated text.

The model answers two choice questions over the aggregated summary:

- **`pattern`** — `CATEGORY_SPIKE` / `IMPROVED_SAVING` / `NEW_RECURRING` / `STEADY`
- **`focus`** — which category is the story, keyed by category name

**The app renders the sentences from that verdict plus its own numbers.** Three properties follow, and they are why this would still be the right shape even if free text were available:

1. **Every currency figure is computed by `formatCurrencyAmount`, never emitted by a model.** A hallucinated ฿ figure sitting directly above `CategoryExpenseDistribution`'s real one would be worse than showing nothing. The model is trusted to judge *which pattern*, never to state *how much*.
2. **The output is assertable.** A test pins exact sentences against a mocked verdict. Free text can only be asserted loosely, which means the card's most user-visible behaviour would be its least tested.
3. **The offline fallback costs almost nothing.** It is the *same renderer*, driven by a local rule that picks the same pattern from the same summary. One renderer, two selectors.

That third point is what makes "the card never displays an error state" true by construction rather than by careful error handling: there is no path where rendering fails, only paths where the pattern was chosen locally. Those are marked with a quiet "Offline summary" note, not an error.

**Rejected: free-text generation.** It depends on a vendor question type this project has never used, it lets the model produce numbers that can contradict the ledger on screen, and it makes the output untestable in any strict sense. Recorded here so a later phase does not re-litigate it blind.

## Privacy: exactly what leaves the device

`src/utils/spendingSummary.ts` aggregates to:

```ts
{
  month: '2026-09',
  categories: [{ name, current, previous, changePercent, txCount }],
  totals: { income, expense, net, previousExpense }
}
```

**Never sent:** transaction descriptions or `rawInput`, any id (transaction, category, wallet, user), wallet names, individual amounts, individual dates, the user's email, session data.

**Sent, and named honestly rather than glossed:** category *names*, and per-category totals.

The names carry the entire semantic signal. An id means nothing to a model; `Food & Dining` is what makes an answer possible at all. The consequence is real and should not be described as zero exposure: **a user who creates a category with a sensitive name has that name leave the device.** The shipped defaults are generic, and a custom name is user-authored and already visible throughout the UI, but the residual exists and is recorded here rather than discovered later.

**This is an executable guarantee, not a claim.** A test captures the outgoing request body and asserts it contains none of the seeded transaction descriptions and no id-shaped strings. If a future change starts sending raw rows, that test fails.

## `/api/insights` is a sibling, not an action on `/api/classify`

`api/classify.ts`'s validator is shaped tightly around `text` + `categories`, with per-field bounds and a hard reject on wording keys. Forking it to carry a second, differently-shaped question would weaken precisely the thing it exists to protect.

The new function mirrors the same posture exactly:

- **`export async function POST`, never `export default`.** Vercel's Node runtime invokes a default export with the legacy `(req, res) => void` signature and **discards the returned `Response`**, so the request hangs until the gateway times out — 60 s, zero bytes, visible only in a deployment's runtime log. This already shipped once and had to be hot-fixed. It is invisible to `tsc`, to the Playwright suite (which mocks), and to any probe that calls the handler directly.
- **Rejects client-supplied `instructions`/`criteria`/`model`/`state`/`questions`.** Without it the endpoint is an open relay for arbitrary Jev prompts billed to this project's key.
- **Missing key returns 404, not 500**, so an unconfigured deployment looks exactly like a missing endpoint and the client trips the same availability latch — the same reasoning ADR `0011` gives.
- Bounded input: category count and name length.

## Caching in `localStorage`, and what that costs

Keyed `pf_insights::<userId>::<YYYY-MM>`. One billing cycle costs one call **per device**. A Refresh action bypasses and overwrites.

**Rejected: a Supabase table.** It would make the cache cross-device, and it needs a new table, RLS policies and a migration applied *before* the code deploys. `CLAUDE.md` is explicit that PostgREST rejects an unknown column outright (`PGRST204`) rather than ignoring it, so deploying first breaks the feature for every authenticated user until the migration lands. That operational risk is not worth removing one regeneration per device.

The per-device trade-off is the accepted cost: opening the app on a phone after generating on a laptop regenerates once.

## A third spec may mock, and the rule is now a principle

ADR `0019` amended the mocking rule from one spec to two and wrote: *"A third would need the same justification."* This is that justification, so the rule is **generalised rather than extended by reflex**.

The requirement was never a file count. It is: **every spec that intercepts a request must fulfil it locally, so the suite spends no TypeSafe credits and needs no API key, on CI or on a laptop that happens to have one exported.** `CLAUDE.md` now states that principle and lists the three specs that currently rely on it.

Phase 46's `addInitScript` Speech API stub remains a different mechanism — it intercepts nothing and is not covered by this rule.

## Consequences

- **`DashboardView` gains a network-capable child.** It was previously pure presentation over context state. The card owns its own fetching, so the view itself stays unaware, but "the Dashboard makes no requests" is no longer true.
- **A second serverless function exists.** `npm run lint`'s `api/tsconfig.json` pass already covers it, but the deployment surface — and the default-export trap — now applies in two places.
- **The pattern set is a fixed vocabulary.** Adding a fifth pattern means changing the server's criteria, the client's type, and the renderer together. That coupling is deliberate: it is what keeps the model from inventing a verdict the renderer cannot express.

## Deliberately not done

- **No new Analytics view or nav tab**, per above.
- **No cross-device cache**, per above.
- **No free-text generation**, per above.
- **No insight history.** Only the current month is cached; comparing insights across months is a different feature with its own storage question.
- **No insight for a month with no prior month.** A first-month ledger has nothing to compare against, so the card renders a `STEADY` summary from current totals alone rather than inventing a trend.

## Revisit if

- A second analytical surface appears. The card would then have a view to move into, and the nav-tab decision changes.
- The vendor gains a free-text question type *and* a way to constrain numeric output to supplied values. The first alone is not enough.
- Insights need to be shared between devices or referenced historically. Both point at the Supabase table this ADR declined, and both would justify the migration.
