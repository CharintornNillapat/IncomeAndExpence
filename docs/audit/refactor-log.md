# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

---

## Phase 39 — Jev classification layered behind the keyword matcher: T79–T83 (2026-09-23, uncommitted)

**Changed**
- `docs/audit/decisions/0011-jev-classification-layering.md` (new) — written **before** T79 began, per `README.md:28`. Records the delete-vs-layer argument, the measured probe results, and the CORS finding that makes a proxy mandatory.
- `api/classify.ts` (new) — Vercel serverless proxy. Holds `TYPESAFE_API_KEY`, owns the Jev question wording, validates and rejects any client-supplied `instructions`/`criteria`/`model`/`state`/`questions`, caps `text` at 255 chars and `categories` at 60, 8s upstream timeout, returns **404** when unconfigured.
- `api/tsconfig.json` (new) — Node-typed island. `package.json`'s `lint` is now `tsc --noEmit && tsc -p api/tsconfig.json`.
- `src/types.ts` — `ClassifyCandidate`/`ClassifyRequest`/`ClassifyResponse`, imported `import type` by both the browser client and the function so the wire contract cannot drift.
- `src/utils/jevClassifier.ts` (new) — never-throw `fetch` client, insertion-ordered LRU (cap 50) keyed by normalized text + candidate shape, session availability latch, confidence gate and the category/type coherence rule.
- `src/hooks/useDescriptionClassifier.ts` (new) — 450ms debounce, abort of superseded requests, monotonic sequence guard, per-session dismissal set.
- `src/components/transaction/CategorySuggestionChip.tsx` (new) — the mid-confidence accept affordance.
- `src/components/TransactionForm.tsx` — `handleDescriptionChange` keeps its synchronous `matchSmartDescription` call verbatim and arms the classifier only on a miss; `userTouchedRef` stops a late answer overwriting a manual pick; preset apply and submit-success both reset it.
- `tests/jev-classify.spec.ts` (new) — 5 tests, the suite's first `page.route()` usage.
- `.env.example` — documents `TYPESAFE_API_KEY` and why it carries no `VITE_` prefix.

**Why**
`smartMatcher.ts` is a case-insensitive substring scan over four seeded English keywords with no score, no word boundaries and no semantic understanding, so any description the user had not written a rule for landed uncategorized, and transaction type was never inferred from the text at all. Jev classifies Thai and English short notes with calibrated confidence — measured 1.00 on `ข้าวมันไก่`, `Shell gas station`, `Netflix` and `เงินเดือนเดือนกันยา`, and a correctly-uncertain 0.33 on the genuinely ambiguous `โอนเงินคืนแม่`.

The matcher was deliberately **not** replaced. It is the offline story for an offline-first PWA, a rule hit is a network call not made, and a `KeywordRule` is the user's only way to overrule the model on their own ledger. See ADR `0011` for the full rejection of the delete option.

**Verification**
```
npm run lint                     # tsc --noEmit && tsc -p api/tsconfig.json: clean, 0 errors
npx playwright test --workers=4  # 144/144 passed, 0 retries, 3.5m
npm run clean && npm run build   # built in 17.75s; 0 chunk-size warnings
```

**Bundle verification, beyond the standard gate**

Measured against a rebuild of HEAD with the phase stashed, not against the figure in Phase 36's entry:

| Chunk | HEAD | Phase 39 | Delta |
|---|---|---|---|
| entry `index-*.js` | 161.53 kB / 45.37 kB gzip | **161.53 kB / 45.37 kB gzip** | **0** |
| `TransactionForm-*.js` (lazy) | 13.07 kB / 3.90 kB gzip | 17.65 kB / 5.53 kB gzip | +4.58 kB / +1.63 kB |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | unchanged | 0 |

No new vendor chunk; `vite.config.ts` untouched; `grep -rl 'typesafe-ai' dist/` returns nothing. All new weight is behind the `React.lazy` boundaries ADR `0010` established.

**Correctness notes**
- **The endpoint's absence is the default, and every existing test proves it.** Playwright's `webServer` is `npm run dev` — the Vite dev server does not serve `api/` — so `/api/classify` 404s, the client latches off after one request, and categorization falls back to keyword rules. This was verified as its own gate (T81) *before* any UI landed: 129/129 pre-existing runs green with the client wired and the endpoint missing. No existing spec needed an edit.
- **`classifyDescription` never throws.** `src/` still has no error boundary, so this is load-bearing, not stylistic: 404, 5xx, timeout, abort, malformed JSON and offline all resolve to `null`, which renders as no suggestion.
- **A rule hit short-circuits before the debounce, the cache and the network,** and `tests/jev-classify.spec.ts` asserts the request count is exactly 1 across a rule-covered note followed by an uncovered one.
- **The write path is untouched.** No Zod schema, no `addTransaction`, no `MutationResult`, no rollback and no idempotency behavior changed — Jev only pre-fills fields the user can still edit.
- **`lockType` forms never classify,** so `DebtsView`'s repay modal issues no network call at all; the existing early return already covered this.

**Surprises**
- **The TypeSafe API rejects browser origins outright.** An `OPTIONS` preflight with `Origin: http://localhost:3000` returns `400 — Disallowed CORS origin`. The proxy was planned for key secrecy; it turned out to be mandatory for transport. A direct-from-browser dev mode is not available at any price.
- **The documented entry-chunk baseline was stale.** `refactor-log.md` Phase 36 records 158.93 kB / 44.81 kB; HEAD actually builds at 161.53 kB / 45.37 kB after Phases 37–38 and the presets feature. Comparing against the doc would have manufactured a phantom +2.6 kB regression. Stashing and rebuilding is the only honest way to attribute a bundle delta.
- **The first baseline run's 3 `presets.spec.ts` failures were self-inflicted.** Files were written to `src/` while the run was in flight and Vite HMR perturbed the app under test; the spec passed 6/6 in isolation immediately after. This suite runs against a live dev server, so the filesystem must stay quiet for the duration of a run.
- **The Vercel function shipped broken and had to be hot-fixed in the commit immediately following.** `export default` returning a `Response` does not work: Vercel's Node runtime invokes a default export with the legacy `(req, res) => void` signature and discards the return value, so `res` is never written and the request hangs until the gateway times out - 60s, zero bytes, no error anywhere except the deployment's own runtime log ("default export returned a `Response` ... returns are ignored"). Fixed by exporting a named method (`export async function POST`), which opts into the Web fetch-style contract. **Nothing in the local gate could have caught this**: `tsc` type-checks the handler fine, the Playwright suite mocks `/api/classify` and never invokes it, and the throwaway probe called the exported function directly rather than through Vercel's dispatcher. Only a live request against a real deployment surfaces it - which is precisely the smoke test the original phase listed under "Deliberately not done". The lesson is narrow and worth keeping: a serverless handler's *invocation contract* is not covered by any test that calls the handler itself.
- **An auto-categorization removes the category `<select>` from the DOM.** Setting `autoMatchedCategory` flips `isCollapsed`, collapsing the manual block behind "Edit details" — long-standing behavior inherited from the rule matcher, but it invalidated the obvious spec assertions and forced them through the badge and the toggle instead.

**Deliberately not done**
- **`smartMatcher.ts`, `KeywordRule`, `keyword_rules`, the Smart Rules tab and `tests/keywords.spec.ts` were not touched.** Zero migrations. The case for deleting them is argued and rejected in ADR `0011`.
- **CSV bulk import was not wired to the classifier.** `commitBulkImport` still drops unmatched category names to uncategorized (`FinanceContext.tsx:1963-1965`) and never consults rules. It is the strongest fit for batched judgments and is explicitly a later phase, deferred by the user so thresholds can be tuned on real data first.
- **`@typesafe-ai/sdk` was not installed.** A single documented JSON contract does not justify a 209 kB Node dependency, and adding any dependency would have meant touching `manualChunks`.
- **No spec asserts on bundle composition or on real network traffic.** Same reasoning Phase 36 recorded: the Playwright config targets the dev server, which does not code-split like the production build, so a committed version of the bundle check would need its own `vite preview` infrastructure this phase did not build.
- **The proxy's own probe was not committed.** It runs the handler directly under `node --experimental-strip-types` and covers 14 cases including all five prompt-injection rejections, but it needs no fixture, duplicates no committed assertion, and the repo has no unit-test runner to host it. If Vitest is ever adopted (already logged in `constraints-to-promote.md`), this is the first thing that should move into it.
- **No live end-to-end call was made against a deployed function.** `TYPESAFE_API_KEY` is not set in Vercel yet and the Vercel CLI is not installed locally, so `vercel dev` was not run. The upstream request shape was instead verified byte-for-byte against `jev ask --dry-run`, and the live API behavior against the CLI probes recorded in ADR `0011`. **A real deployment smoke test is still outstanding.**

---

## Phase 38 — clear the deferred backlog + CI housekeeping: T18, T25 (2026-09-20, commit `9aa6732`)

**Changed**

- `src/context/FinanceContext.tsx` — `commitBulkImport`'s authenticated wallet-update loop (`for...of` with a per-iteration `await supabase.from('wallets').update(...)`) rewritten as `Object.entries(walletDeltas).map(async ...)` wrapped in `Promise.all`. The transactions insert and `refreshFromCloud()` calls on either side of the loop are unchanged — they were already single calls, not loops.
- `.github/workflows/playwright.yml` — `actions/checkout` v4→v5, `actions/setup-node` v4→v5 (`node-version` 20→22), `actions/upload-artifact` v4→v7 (v5 alone still targeted the deprecated Node 20 runtime internally, caught on the follow-up CI run and bumped further), `runs-on` `ubuntu-latest`→`ubuntu-24.04`.
- `docs/audit/task-ledger.md` — new Phase 38 table (T18 `done`, T25 `rejected / closed`); Deferred table replaced with a "none remaining" note; roadmap-status banner updated to reflect zero `todo`/deferred tasks.

**Why**

T18 and T25 were the only 2 rows left in the Deferred table since Phase 29, each explicitly blocked on a separate approval no prior session had received. This phase was explicitly asked to clear that backlog: T18 (parallelize the bulk-import wallet writes) is a straightforward, low-risk change with an existing CSV spec to gate it, so it shipped. T25 (unify the 4 transaction-row renderers) was re-evaluated against the same reasoning that put "consider dropping" on its row from the start — the 4 surfaces' DOM shapes are too different to share one component without a worse conditional-prop surface than the duplication it replaces — and is now closed formally rather than left open indefinitely. The CI annotations (Node 20 runtime deprecation, upcoming Ubuntu label migration) were fixed in the same phase since they were flagged directly against the run this phase's own predecessor pushed.

**Verification**

```
npx playwright test tests/csv.spec.ts --project=chromium   # 1/1 passed
npm run lint                                                # tsc --noEmit: clean
CI=true npx playwright test                                 # 102/102 passed, 0 retries
npm run build                                                # succeeded
```

**Correctness notes**

- **`Promise.all` does not change which balance value gets written.** Every entry in `walletDeltas` reads its base balance from the same `walletsRef.current` snapshot taken before any request starts (`targetW.balance`, looked up once per entry) — none of the concurrent writes depends on another's result, so running them concurrently instead of sequentially cannot produce a different final balance. `markLocalWrite(wId)` still fires once per wallet, before that wallet's own request, same as before.
- **T25's closure is a documentation-only change** — no `src/` files touched for that row. See ADR `0006`, "Options considered (a)", for the original rejection rationale, unchanged by this phase.

**Deliberately not done**

- No new ADR was written for T25's closure — ADR `0006` already covers the rejection rationale in full; formally closing the ledger row cites it rather than duplicating it.
- `refreshFromCloud()` and the batch `transactions.insert(...)` call were not touched — T18's ledger row scoped only the per-wallet update loop, and neither of those is a loop to parallelize.

---

## Phase 37 — closeout: ADRs, metrics, `CLAUDE.md` promotion + drift repair: T78 (2026-09-20, commit `24e9ee6`)

**Changed**

- `docs/audit/decisions/0009-animated-counter-dom-writes.md` / `0010-deferred-shell-modal-mounting.md` — re-read in full against the current tree; both already carried `Status: Accepted` with a complete Context/Options/Decision/Consequences/Revisit-if shape from the phase that wrote them, and needed no edits.
- `docs/audit/baseline-metrics.md` — new "Phase 37 closeout" full chunk breakdown, the roadmap's final column, plus a new row in the entry-chunk summary table.
- `docs/audit/task-ledger.md` — new Phase 37 table (T78), roadmap-status banner updated from "closed out at Phase 29; Phases 30–37 are a separately-requested second pass" to "closed out at Phase 37 — both audit passes are complete".
- `docs/audit/constraints-to-promote.md` — 2 of the 3 previously-unpromoted rows (batched `localStorage` writer, `roundToCents`-is-the-only-ledger-rounder) re-verified against the live tree and marked promoted; the 3rd (repo-wide interactive-element `id` convention) re-checked, still holds only for `AuthModal.tsx` specifically, left open with an updated note rather than promoted on an unverified repo-wide claim.
- `CLAUDE.md`:
  - 7 verified constraints promoted: the plan's 5 scheduled ones (the setState-updater/ref-mirror rule, the `MutationResult` rollback-and-compensation rule, the `generateIdempotencyKey()` rule, the `AnimatedCounter` `textContent`-ownership rule, the shell-modal `hasOpened`-latch rule) plus 2 resolved from `constraints-to-promote.md`'s own backlog (the batched-`localStorage`-writer rule, the `roundToCents`-is-the-only-ledger-rounder rule).
  - 2 stale claims repaired: `useWallets()`'s bullet no longer lists the long-deleted `walletsByType`; the "State: context + domain hooks" section's `FinanceActionsContext` example-members list no longer names `repayDebtAtomic` (deleted Phase 33/T64).
- 5 files changed, 0 `src/` files.

**Why**

Every prior closeout in this project (Phase 29 for the first audit pass) has followed the same shape: once every phase's code has shipped and gated clean, freeze the ADRs, capture one final metrics column, and promote only the constraints the code now actually demonstrates — never in advance of the code, per `constraints-to-promote.md`'s own standing rule that a rule the code doesn't satisfy is worse than no rule at all. Phase 37 closes the second pass (Phases 32–36, T61–T77) the same way, and additionally repairs 2 documentation claims that had drifted true-to-false during those phases without CLAUDE.md being updated to match — exactly the kind of gap a closeout phase exists to catch before it compounds further.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run clean && npm run build   # built in 6.22s; entry chunk 158.93 kB / 44.81 kB gzip (unchanged from Phase 36 — no src/ change this phase); 0 chunk-size warnings
CI=true npx playwright test      # 102/102 passed, 0 retries
```

**Correctness notes**

- **Both ADRs were verified against the running code before being declared final, not merely re-read.** ADR 0009's claims (`AnimatedCounter`'s ref-based `textContent` write, no React children on the value span) were checked against the current `AnimatedCounter.tsx`; ADR 0010's claims (the 3 latches, `Suspense fallback={null}`, `AuthModal`/`ReloadPrompt` staying eager) were checked against the current `App.tsx`. Neither needed a correction.
- **The `walletsByType` claim had been wrong for 30+ phases.** `grep -rn "walletsByType" src/` returns zero matches, and `useWallets.ts`'s actual return shape (`wallets`, `allWallets`, `totalNetWorth`) has had 3 members, not 4, since Phase 1/T5 deleted the dead export. This was caught by grep during this phase's drift-repair step, not carried over from the plan's own framing — the plan named it as a known stale claim to fix, but the actual current shape still had to be confirmed rather than assumed.
- **A second, previously unflagged instance of `repayDebtAtomic` drift was found and fixed in the same pass.** The plan named only the Transaction-entry section's dead-code paragraph (already fixed in Phase 33/T64 itself, confirmed unchanged and accurate here) — but the "State: context + domain hooks" section's own opening paragraph still listed `repayDebtAtomic` among `FinanceActionsContext`'s example members. `grep -rn "repayDebtAtomic" src/` returns zero matches; this sentence was stale and is now fixed. Finding this required reading the whole file for the promotion pass rather than only touching the lines the plan pointed at.
- **The `constraints-to-promote.md` resolution was a real re-check, not a rubber stamp.** Two rows were re-verified true against the live tree (`localStorage.setItem` call-site count, `roundToCents`'s single implementation) and promoted; the third (id-attribute convention) was re-checked and found to still only be true for the one file (`AuthModal.tsx`, 8 `id=` attributes) it was originally scoped to — auditing every interactive element across the other 12 views/components for compliance is unscoped work this phase was not asked to do, so it was left open rather than promoted on an unverified repo-wide claim, which would have repeated the exact kind of drift this phase exists to close.

**Deliberately not done**

- **No new `src/` code.** T78 is documentation, metrics, and `CLAUDE.md` alignment only, matching Phase 29's own precedent for a closeout phase.
- **No repo-wide audit of the interactive-element `id` convention.** See the correctness note above — this was a real finding (the rule doesn't hold as a repo-wide invariant yet), recorded rather than silently promoted or silently dropped.
- **`T25`/`T18` remain in `task-ledger.md`'s Deferred table, untouched.** Both stayed out of both audit passes by the same explicit, unchanged reasoning recorded when each was first deferred — this phase closes the roadmap that scoped around them, it doesn't reopen the scoping decision itself.

---

## Phase 36 — bundle: deferred shell modals, diary/papaparse split: T76-T77 (2026-09-20, commit `01fbdb8`)

**Changed**

- New `docs/audit/decisions/0010-deferred-shell-modal-mounting.md` - written before the code change, per `README.md`'s convention.
- `src/App.tsx`:
  - `QuickAddModal`, `TransferFundsModal`, `AddWalletModal` converted from static imports to `React.lazy(() => import(...))`, matching the pattern the 7 view components already use.
  - Three new latches (`hasOpenedQuickAdd`, `hasOpenedTransfer`, `hasOpenedAddWallet`), each set `true` inside the corresponding `handleOpen*` callback alongside the existing `isOpen` state.
  - Each modal now renders behind `{hasOpened* && <Suspense fallback={null}>...}` instead of unconditionally.
  - `AuthModal` and `ReloadPrompt` are unchanged - still eager, still unconditional.
- New `src/utils/diaryExport.ts` - `exportDiaryToJson`, moved out of `csvExchange.ts` verbatim.
- `src/utils/csvExchange.ts` - `exportDiaryToJson` and its now-unused `DiaryEntry` type import removed.
- `src/views/DiaryView.tsx` / `src/views/TransactionsView.tsx` - both updated to import `exportDiaryToJson` from the new module (`TransactionsView` also calls it, from its own "Export Diary (JSON)" button - see Correctness notes).
- `tests/diary.spec.ts` - new assertion: the export button's click triggers a `download` event, with the correct filename pattern and JSON content.
- 8 files changed (2 new).

**Why**

`perf-audit-report.md` (finding D12) identified that `mathjs/number` (`vendor-math`, 110.72 kB gzip, unchanged since Phase 3/T7) was reachable eagerly only through the three modals this phase defers, and only because those modals were unconditionally mounted at shell level for reachability reasons that ADR 0008 already solved with self-subscription - reachability never required them to be *eager*, only mounted once and shared across views. Deferring them until first open removes the single largest vendor chunk in the app from the initial critical path. T77 is a smaller, unrelated bundle fix from the same audit pass: `DiaryView` was pulling in `papaparse` for a JSON-export function that never used it.

**Verification**

```
npm run lint                                                                                              # tsc --noEmit: clean, 0 errors
npx playwright test tests/wallet-forms.spec.ts tests/diary.spec.ts tests/transaction.spec.ts --project=chromium --repeat-each=2   # 18/18 passed
npx playwright test tests/wallet-forms.spec.ts tests/theme.spec.ts --project=firefox --repeat-each=2      # 14/14 passed (Firefox is this suite's slow-chunk-fetch case)
CI=true npx playwright test                                                                                # 102/102 passed, 0 retries, 6.3m, 1 worker
npm run build                                                                                               # entry chunk 183.26 -> 158.93 kB raw / 50.89 -> 44.81 kB gzip; 0 chunks over 500 kB
```

**Bundle verification, beyond the standard gate**

The standard gate proves behavior is unchanged; it does not prove the bundle claim on its own, since a `grep` of the built entry file for `vendor-math`'s filename returns a match either way - Vite embeds every chunk's filename in a preload-dependency manifest string array used by its `__vitePreload` runtime helper, regardless of whether that chunk is eagerly executed or only fetched on a later dynamic import. Confirming *which* case applies here required checking what the reference sits inside (the manifest array, not an executed top-level `import` statement) and, to remove any doubt, a real network-level check: a throwaway Node script (never committed) booted the actual production build via `vite preview`, opened it in a real Chromium instance via `@playwright/test`'s `chromium.launch()`, and recorded every network request during initial load and again after clicking the Quick Add trigger.

```
[VERIFY] Requests containing "vendor-math" during initial load: 0
[VERIFY] Requests containing "vendor-math" after opening Quick Add: 1
  - http://localhost:4173/assets/vendor-math-D9WQvjt3.js
```

The script and its output were not committed; `git status --short` was clean of it before staging this phase's changes.

**Correctness notes**

- **The `hasOpened` latch is load-bearing, not defensive over-engineering.** It was checked against `TransferFundsModal.tsx:54`'s actual delayed-close call (`flashTransferStatus('Transfer completed successfully!', 1000, onClose)`) before deciding it was necessary: gating the wrapper on the bare `isOpen` prop would unmount the whole subtree - including `Modal`'s own `<AnimatePresence>` - the instant that 1-second timer calls `onClose`, before the exit animation or even the success text could be seen. The 18/18 and 14/14 repeat-guard runs specifically exercise this path (`wallet-forms.spec.ts` asserts on the flash text).
- **T77's `TransactionsView` fix was necessary, not optional cleanup.** Its own "Export Diary (JSON)" button was undiscovered until `grep`ping every call site of `exportDiaryToJson` before editing - had it been missed, `TransactionsView.tsx`'s import of a now-deleted export from `csvExchange.ts` would have failed `npm run lint` and the build, not silently broken.
- **The `csvExchange-*.js` chunk vanishing entirely (not merely shrinking) is a Rollup consequence, verified against the full untruncated build output**, not assumed from the diff alone. With `DiaryView` no longer a consumer, `csvExchange.ts` has exactly one remaining importer (`TransactionsView`), so Rollup folds it directly into that view's own chunk instead of keeping it as a separately-fetched shared file - `TransactionsView-*.js` grew from 21.68 to 43.56 kB accordingly. Total bytes for a Transactions-only session are roughly unchanged (one file instead of two, minus a little shared-chunk overhead); a Diary-only session now fetches neither.

**Deliberately not done**

- **No idle-time or hover-triggered prefetch was added for the three deferred modals.** ADR 0010's Revisit-if section names this as a plausible follow-up (fetch the chunk on hover/focus of the trigger button rather than only on click), but bundling it into this phase would have made the entry-chunk measurement above attributable to two changes at once instead of one.
- **`AuthModal` was not deferred.** Its dependencies (`zod`, `@supabase/supabase-js`) are already eager via `FinanceContext.tsx`; deferring it would add complexity for no measurable bundle benefit. Recorded in ADR 0010's Context section, not silently skipped.
- **No new Playwright spec was added to assert on network requests or bundle composition.** The network-level verification above is a one-time confirmation of this phase's specific claim, following the same disposable-instrumentation precedent Phase 34's render-count re-measurement set - it is not meant to be a permanently-running check, and Playwright's own config always targets the dev server (`playwright.config.ts`'s `webServer` runs `npm run dev`), which does not code-split the same way the production build does, so a committed version of this check would need its own `vite preview`-based test infrastructure this phase did not build.

---

## Phase 35 — targeted render-cost fixes: T71-T75 (2026-09-20, commit `b9ed84f`)

**Changed**

- `src/hooks/useTransactions.ts` - `filteredTransactions` split into a Stage 1 memo (every non-search predicate, no `wallets`/`categories` dependency) and a Stage 2 memo (keyword search) that returns Stage 1 by reference when no search is active. `walletNameMap`/`categoryNameMap` are now `null` and unbuilt whenever no search is active, gated on a `hasSearchQuery` boolean rather than the raw query string so they don't rebuild every keystroke.
- `src/views/DashboardView.tsx` - `categoryMap` hoisted above `categoryBreakdown`, which now reuses it instead of building its own second `buildLookupMap(categories)`; `recentTransactions` replaced a full `.sort()` + `.slice(0, 5)` with a single-pass O(n) top-5 selection.
- `src/views/DebtsView.tsx` - `debtToDelete` state now stores an id (`debtToDeleteId`) instead of the full `Debt` object; the object is resolved from `debts` at render time. `handleDelete`'s `useCallback` deps go from `[debts]` to `[]`.
- `src/views/TransactionsView.tsx` - new module-level `CSV_PREVIEW_ROW_CAP = 100`; the dry-run preview's `<tbody>` renders at most that many rows, with a `<tfoot>` row reporting how many were omitted when the file exceeds it.
- `src/components/AuthModal.tsx` / `src/components/ReloadPrompt.tsx` - wrapped in `React.memo`, matching the existing convention (`TotalWealthHero.tsx` et al.) of an inline `React.memo(...)` plus a `.displayName` assignment.
- 6 files changed.

**Why**

`perf-audit-report.md` (§C) identified five render-cost findings below `AnimatedCounter`'s (Phase 34's) in severity but still worth fixing at low risk: a wallet-balance change silently invalidating the entire transaction-search machinery, a duplicated category lookup map, an unmemoized callback that was actually defeating a real `React.memo` (unlike four other "unmemoized prop" sites the report's cut list rejected), an unbounded CSV preview table, and two components re-rendering on every unrelated parent update. None of these individually rivaled `AnimatedCounter`'s per-frame `setState` cost, but each is a small, self-contained, easily-verified fix - the right shape of work for a Low-risk phase.

**Verification**

```
npm run lint                                                                          # tsc --noEmit: clean, 0 errors (checked after each of T71-T75)
npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/csv.spec.ts --project=chromium   # 6/6 passed
CI=true npx playwright test                                                           # 102/102 passed, 0 retries, 5.4m, 1 worker
npm run build                                                                          # built in 6.98s; entry chunk 183.18 -> 183.26 kB (+0.08 kB, negligible); 0 chunks over 500 kB
```

**Correctness notes**

- **T71's split preserves exact filtering semantics.** Stage 1 applies the identical six predicates the old single-pass filter did, in the same order; Stage 2 applies the identical five-field search-match logic (description, amount, raw input, category name, wallet name) to Stage 1's result instead of the raw ledger. The only behavioral difference is *when* the two lookup maps get built - not what they contain or how they're used.
- **T72's `recentTransactions` rewrite trades one specific guarantee (exact stable-sort tie order) for O(n) instead of O(n log n).** See the task-ledger's note on this - it's a cosmetic ordering nuance for same-day transactions in a 5-row preview, not a data-correctness issue, and `transaction.spec.ts`'s assertions about "recent transactions" check presence/content, not tie order.
- **T73 is the one place in this whole audit pass where an unmemoized callback actually mattered.** `perf-audit-report.md`'s cut list (finding D1) already established that four similar-looking "inline array/callback" sites feed components that aren't `React.memo`'d at all, so fixing them would have changed nothing observable. `DebtsView.handleDelete` was different because `DebtCardItem` genuinely is memoized - this task is the one member of that original finding group that survived verification.
- **T74's row cap does not affect which rows import.** `commitBulkImport`'s caller (`TransactionsView`'s confirm handler) still reads `importPreview.rows.filter(r => r.isValid)` over the complete, uncapped array - only the `<tbody>`'s `.map()` is capped. A 5,000-row CSV still imports all valid rows; only the preview table stops rendering after the first 100.
- **T75's `React.memo` calls are correctly unguarded by the CLAUDE.md rule against memoizing a context subscriber** - both `AuthModal.tsx` and `ReloadPrompt.tsx` were checked import-by-import (neither imports `useFinanceState`/`useFinanceActions` from `FinanceContext`, nor any hook that does) before wrapping, not memoized on the assumption that "it looks safe."

**Deliberately not done**

- **The other four "unmemoized prop" sites from the original audit pass were not touched in this phase either** - `perf-audit-report.md` already cut them (finding D1) before task planning began, on the grounds that their target components (`SegmentedControl`, `TransactionForm`) are not `React.memo`'d and therefore have nothing for an unstable prop to defeat. Revisiting this would require memoizing those components first, which is out of this phase's scope.
- **No `baseline-metrics.md` column was captured for this phase.** None of T71-T75's claims are bundle-size claims - the metric deltas are structural (fewer map rebuilds, O(n) vs O(n log n), fewer re-renders) and are argued from the code, matching how `perf-audit-report.md` itself scoped these findings as "not directly measurable" without a disposable Profiler branch, which this phase's low-risk, five-small-fixes shape didn't warrant standing up.
- **`SecurityView`'s four in-render `.filter()` calls and `WalletsView.tsx`'s per-card `Date` construction were not touched** - both were explicitly cut in `perf-audit-report.md` (findings D6/D7) as measurement noise at the N these views actually see (1-8 sessions, 2-10 wallets).

---

## Phase 34 — `AnimatedCounter` direct DOM write: T70 (2026-09-20, commit `155c882`)

**Changed**

- New `docs/audit/decisions/0009-animated-counter-dom-writes.md` - written before the code change, per `README.md`'s convention.
- `src/components/AnimatedCounter.tsx` - `useState<string>` replaced with `useRef<HTMLSpanElement>`; the `animate()` call's `onUpdate` now writes `valueRef.current.textContent = latest.toLocaleString(...)` directly instead of calling `setState`; a mount-only `useLayoutEffect` seeds the same `'0.00'` the old `useState` initializer produced, so there is no empty-span flash before the animation effect arms; the rendered `<span ref={valueRef} />` has no React children. `currencyPrefix`, `duration`, the `[0.16, 1, 0.3, 1]` ease curve, and the `count`/`animate`/cleanup mechanics are unchanged.
- 2 files changed (1 new).

**Why**

`perf-audit-report.md` (§C) identified `AnimatedCounter`'s per-animation-frame `setState` call as the single largest source of React render work in the app - `baseline-metrics.md`'s existing Phase-4 Profiler harness had already measured it at 590 renders on cold load and 636 on one write, an order of magnitude above every other component in that table, and it is mounted 6+ times simultaneously (every wallet card, 3 cashflow cards, the hero, the navbar). The animation's visual output was never wrong; only the mechanism producing it - a React state update ~60 times a second - was the problem. Writing the formatted string directly to the DOM node removes that mechanism without changing what the user sees.

**Verification**

```
npm run lint                                                                 # tsc --noEmit: clean, 0 errors
npx playwright test tests/date-boundary.spec.ts tests/theme.spec.ts --project=chromium   # 5/5 passed
CI=true npx playwright test                                                  # 102/102 passed, 0 retries, 5.1m, 1 worker
npm run build                                                                 # built in 6.92s; entry chunk 183.07 -> 183.18 kB (+0.11 kB, negligible); 0 chunks over 500 kB
```

**Render-count re-measurement (not part of the standard gate above, performed separately)**

The standard Playwright gate proves the refactor is behaviorally identical; it does not measure render counts. To verify the actual claim, a temporary `(window as any).__acFnCalls = ((window as any).__acFnCalls || 0) + 1;` line was added to the top of `AnimatedCounter`'s function body, and a throwaway `tests/_tmp-ac-probe.spec.ts` measured it across the same two scenarios `baseline-metrics.md`'s original harness used: S1 (cold load, settle ~1.5s, read the counter) and S2 (reset the counter, run one `addQuickTransaction`, settle ~1.5s, read the counter again).

| | S1 (cold load) | S2 (one write) |
|---|---|---|
| **Before this phase** (`baseline-metrics.md`, Phase 4) | 590 | 636 |
| **After T70** (this probe) | 16 | 16 |

Both the counter line and the probe spec were removed before committing - `grep -rn "__acFnCalls" src/ tests/` returns nothing on the committed tree, and `git status --short` was clean of both before staging. This mirrors `baseline-metrics.md`'s own "Post-T34 (`Navbar` de-subscription)" precedent for a targeted, disposable re-measurement of one specific claim rather than re-running the full multi-component Profiler branch.

**Correctness notes**

- **The remaining 16 function-body executions on both S1 and S2 are real renders, not a residual per-frame cost.** They come from each counter instance mounting (and StrictMode double-invoking that in dev) and from props (`value`) changing when a write settles - not from the animation's ~70-85 intermediate frames, which is the category of render this task set out to eliminate entirely. `baseline-metrics.md`'s own caveat about this component's counts being run-to-run noisy (236-596 across three runs for S1 alone) applied to the *old* frame-driven mechanism; it does not apply to the new count, which is driven by discrete mount/prop-change events like every other component in that table.
- **`useTransform`/`motion.span` was considered and rejected**, not merely unconsidered - see ADR 0009's Options section. Framer-motion has no built-in way to bind a `MotionValue<string>` to a DOM text node the way it binds numeric values to style/attribute props, so that route would still flow the formatted string through React's reconciler once per frame.
- **ADR 0004's currency-formatting exemption is unchanged.** `AnimatedCounter` still calls `toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS)` - the same shared constant `formatCurrencyAmount` uses - and still does not call `formatCurrencyAmount` itself, for the reason ADR 0004 already recorded (it formats a `MotionValue`'s in-flight ticks, not one settled amount). Only where the formatted string is written changed.

**Deliberately not done**

- **No call site was touched.** All 6 (`CashflowMetricsCards.tsx`, `TotalWealthHero.tsx`, `WalletAccountsGrid.tsx`, `NavbarLedgerStatus.tsx`, `WalletsView.tsx`) pass the same props as before; the component's public interface (`value`/`currencyPrefix`/`duration`) is unchanged.
- **`baseline-metrics.md` was not given a new dated column for this phase.** The re-measurement above is narrowly scoped to the one claim this task makes (matching the "Post-T34" precedent's own scope), not a full baseline refresh; a full Profiler re-run across all 5 scenarios is a larger, separate effort this phase did not need in order to verify its own change.
- **No accessibility live-region was added for the settled value.** ADR 0009's Revisit-if section names this as a plausible future need (e.g. announcing the settled balance to a screen reader) but nothing in this phase's scope asked for it, and adding one now would be speculative.

---

## Phase 33 — write-path hardening: prune, error checks, rollback parity: T64-T69 (2026-09-20, commit `1e0e4ad`)

**Changed**

- `src/context/FinanceContext.tsx`:
  - Deleted `repayDebtAtomic` end-to-end (interface member, implementation, `actionsValue` entry and dep).
  - Removed `updateWallet` from `FinanceActionsContextType`/`actionsValue`; it remains a provider-internal helper `deleteWallet` calls.
  - `setTransactionDeleted` (T63's fix, extended): snapshots `transactionsRef`/`walletsRef` before the optimistic write; remote writes reordered wallet-balances-first, `is_deleted`-flag-last; `try/catch` compensates any committed wallet write and restores the local snapshot on failure; returns `MutationResult`.
  - `updateWallet`, `settleDebt`, `deleteDebt`, `updateCategory`, `deleteCategory`, `deleteDiaryEntry`, `deleteKeywordRule`: each now snapshots before its optimistic write, checks the Supabase `{ error }` result instead of discarding it, rolls back on failure, and returns `MutationResult`. `deleteKeywordRule` stays a hard delete (no `isDeleted` field on `KeywordRule`) but its rollback re-inserts the removed row at its original array index.
  - New `cloudRevisionRef`, incremented once per successful `loadSupabaseData` commit; `addTransaction` snapshots it alongside its existing rollback state and, on failure, re-fetches from the cloud instead of restoring a stale local snapshot if a realtime reload landed mid-flight.
  - `generateIdempotencyKey` moved out to `src/utils/ids.ts`.
- New `src/utils/ids.ts` - the guarded idempotency-key generator, now the single implementation.
- `src/hooks/useIdempotencyKey.ts` - calls `generateIdempotencyKey()` instead of a bare `crypto.randomUUID()`.
- `src/hooks/useDebts.ts` - `repayDebt`/`settledDebts`/`unsettledDebts`(return entry)/`allWallets` removed; the `unsettledDebts` *memo* itself is kept (feeds `debtMetrics.activeCount`); `handleSettleDebt`/`handleDeleteDebt` now return their mutator's `MutationResult` instead of discarding it.
- `src/hooks/useTransactions.ts` - `handleDelete`/`handleRestore` now return `softDeleteTransaction`/`restoreTransaction`'s `MutationResult`.
- `src/components/ui/ConfirmDialog.tsx` - new optional `error?: string | null` prop, rendered as an `ERROR_BANNER_CLASS` banner below the description.
- `src/views/WalletsView.tsx` / `src/views/DebtsView.tsx` - delete-confirm flows now capture their mutator's `MutationResult`, keep the dialog open with the error shown on failure, and close only on success.
- `CLAUDE.md` - the `repayDebtAtomic`/`repayDebt` dead-code paragraph updated to record their removal.
- 9 files changed (1 new).

**Why**

Phase 32 fixed one money-affecting bug in `setTransactionDeleted`; this phase generalizes the fix. The second-pass audit (`perf-audit-report.md`) found 9 mutators across wallets, debts, categories, diary entries, and keyword rules that discarded their Supabase call's result entirely - no error check, no rollback - leaving local state permanently ahead of cloud state on any rejected write (offline, RLS failure, expired session), with nothing telling the user it happened. `addTransaction` was the only mutator in the file with a real rollback; this phase brings every other write-path mutator up to that same standard, following its established pattern, rather than leaving `addTransaction` as an island of correctness in an otherwise-unguarded file. Pruning the dead `repayDebtAtomic`/`repayDebt` path first meant the hardening work never touched code about to be deleted. The two smaller fixes (T68's insecure-origin crash guard, T69's realtime-reload race guard) came out of the same audit pass and share this phase because both touch the same write paths being hardened here.

**Verification**

```
npm run lint                                                                                              # tsc --noEmit: clean, 0 errors (checked after each of T64-T69)
npx playwright test tests/soft-delete.spec.ts tests/debts.spec.ts tests/categories.spec.ts --project=chromium   # 9/9 passed
CI=true npx playwright test                                                                                # 102/102 passed, 0 retries, 6.0m, 1 worker
npm run build                                                                                               # built in 8.21s; entry chunk 180.57 -> 183.07 kB (+2.5 kB raw / +0.36 kB gzip); 0 chunks over 500 kB
```

**Correctness notes**

- **`setTransactionDeleted`'s remote-write ordering is deliberate, not incidental.** Wallet balances are written before the `is_deleted` flag because the flag is what makes the row count as active/inactive again - a wallet-write failure must leave the cloud row in its pre-change state with only the already-committed balance writes to compensate, never a flipped flag pointing at balances that were never actually written. This is the same reasoning `addTransaction`'s existing compensation order already applies to its own three writes.
- **`updateWallet` remaining provider-internal (not deleted) is intentional.** T64 removed it from the public actions context because it had no external caller, but `deleteWallet` still needs a partial-update primitive with error handling and rollback - keeping that logic in one function that `deleteWallet` calls and forwards, rather than duplicating the try/catch/rollback shape directly inside `deleteWallet`, is the smaller diff and the one place to fix a bug in wallet-write handling later.
- **`deleteKeywordRule`'s rollback shape differs from every other mutator's in this phase on purpose.** Every other rollback restores a snapshot of the whole array; `deleteKeywordRule`'s local write removes the row from the array entirely (matching its hard-delete semantics) rather than flipping a flag, so its rollback re-inserts the captured row at its original index instead. A whole-array snapshot restore would also have worked, but the audit report's cut list already established `KeywordRule` has no `isDeleted` field to model a soft-delete flag on, and the array-splice approach makes the hard-delete/rollback shapes consistent with each other rather than mixing two different rollback strategies in one function.
- **`ConfirmDialog`'s new `error` prop is additive.** Every existing call site that does not pass it (there are others in the app beyond `WalletsView`/`DebtsView`) is unaffected - the prop defaults to `null` and renders nothing.

**Deliberately not done**

- **T68 (insecure-origin crash guard) and T69 (realtime-reload race guard) have no automated test coverage, and cannot with the current harness.** T68's fix only matters when `crypto.randomUUID` is undefined, which never happens on `localhost` or the dev server's own origin - both secure contexts Playwright always runs against. T69's guard only matters when a second authenticated client commits a realtime-visible change while a first client's `addTransaction` is mid-flight and then fails - this sandbox has no second live Supabase session to construct that race with. Both are verified by code review against their own in-code reasoning comments, not by a red-to-green test, matching the same gap Phase 32 already accepted for the cloud-balance desync itself.
- **`settleDebt`'s `MutationResult` is not surfaced in `DebtsView`'s UI.** It is a direct button action, not gated behind a `ConfirmDialog` - the plan's UI-wiring instruction named only the two delete-confirm sites (wallets, debts). Its rollback still applies on a rejected write; only the visible error message was scoped to the confirm dialogs this phase touches.
- **No RPC or migration was added for any of the 7 hardened mutators.** Each keeps its existing shape of one-or-two separate Supabase round-trips; only whether an error is checked and whether a failure rolls back changed. Making any of these atomic server-side (the way `transfer_funds` is) would be a separate, migration-bearing phase.
- **`deleteKeywordRule` was not converted to a soft delete.** `KeywordRule` has no `isDeleted` field and no migration adds one; adding both is out of proportion to this phase's scope, which is error-handling parity, not a schema change. The audit report's cut list already made this determination before the phase began.

---

## Phase 32 — audit report and soft-delete balance desync: T61-T63 (2026-09-20, commit `c0c1371`)

**Changed**

- New `docs/audit/perf-audit-report.md` — second-pass audit (correctness, render cost, dead code, bundle weight), frozen with corrections table (D1-D12) documenting what was cut and why after re-verifying every finding against the running code.
- `docs/audit/baseline-metrics.md` — new "Post-Phase-31" bundle-size column at commit `6c5d7df`, closing the gap left by Phases 30-31 shipping with no metrics capture.
- `tests/soft-delete.spec.ts` — new 4th test asserting the wallet balance invariant across a soft-delete/restore cycle, against `#wallet-entity-wal-cash`'s own balance text.
- `CLAUDE.md` — suite count 33 tests/99 runs → 34 tests/102 runs.
- `src/context/FinanceContext.tsx:1525-1585` (`setTransactionDeleted`) — resolves the source/destination wallet and computes both new balances from `walletsRef.current` before either `setState` call, instead of assigning them from inside the `setWallets` updater and reading them back synchronously afterward.
- `docs/audit/task-ledger.md` — new Phase 32 table (T61-T63) and roadmap-status line update.
- 5 files changed (2 new).

**Why**

A second full audit pass (requested after Phase 29's closeout and Phases 30-31's feature/polish work) turned up a money-affecting correctness bug that no existing test could catch: `setTransactionDeleted` silently stopped writing wallet balance updates to Supabase on every soft-delete and restore, once authenticated cloud sync was in use. The transaction's own `is_deleted` flag still flipped correctly — only the balance write was dropped — which is exactly why it shipped unnoticed through every prior phase. This phase fixes that one function under a test-first discipline; the surrounding write-path hardening (dead-mutator removal, rollback parity on 9 other mutators) is Phase 33, scoped separately so this phase stays small and independently revertible.

**Verification**

```
npm run lint                                                                                    # tsc --noEmit: clean, 0 errors
npx playwright test tests/soft-delete.spec.ts --project=chromium                                # 4/4 passed (run before T63, to confirm the local invariant already held)
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/storage-persistence.spec.ts --project=chromium   # 10/10 passed (run after T63)
CI=true npx playwright test                                                                      # 102/102 passed, 0 retries, 6.7m, 1 worker
npm run build                                                                                     # built in 16.36s; entry chunk unchanged at 180.57 kB / 50.46 kB gzip; 0 chunks over 500 kB
```

**Correctness notes**

- **The bug:** `sourceNewBal`/`destNewBal` were declared `let ... = null`, assigned inside the `setWallets` updater passed to `setTransactionDeleted`'s second `setState` call, and read back synchronously two lines later to decide whether to fire the two remote `wallets` UPDATE calls. The preceding `setTransactions` call had already scheduled a state update for this component, so the `setWallets` call that followed it no longer took the synchronous first-call fast path — the updater ran later, during React's own commit, not before the read. Both variables read back `null`, the `!== null` guards were always false, and the two remote wallet-balance writes never fired. The transaction's own `is_deleted` UPDATE fired regardless (it doesn't depend on those variables), so the row visibly flipped in the UI while the wallet's cloud balance silently diverged from the correct local value — compounding on every subsequent soft-delete or restore.
- **The fix mirrors `addTransaction`'s own pattern** (`FinanceContext.tsx:1256-1298`, unchanged by this phase): resolve every participating wallet from the ref mirror and compute both new balances *before* calling any `setState`, so every updater downstream is a pure mapping with a precomputed value, never an assignment. `addTransaction` already had to solve this exact race for its own two-`setState`-call sequence; `setTransactionDeleted` had drifted from that pattern rather than following it.
- **Verified against `noUnusedLocals`/`tsc --noEmit`: the bug is invisible to the type gate.** `sourceNewBal: number | null` type-checks identically whether the preceding updater ran in time or not — there is no type-level signal that an assignment inside a closure passed to `setState` races anything. This is a runtime-scheduling bug, not a type error, and no amount of stricter `tsconfig.json` settings would have caught it.
- **T62 was written and run against the pre-fix code first, per the plan's test-first requirement**, and passed 4/4 on chromium before `:1525-1585` was touched — confirming what the audit report's Testing section states: the *local* balance invariant was already correct (the bug lives entirely in the `if (isAuthenticated)` branch, which the unauthenticated Playwright harness never enters), so T62's role is to guard local behavior through the refactor, not to reproduce the bug itself.

**Deliberately not done**

- **The cloud-balance desync itself was not covered by an automated test, and cannot be with the current harness.** Every Playwright spec runs unauthenticated; `FinanceContext.tsx:1560-1574` (the branch containing both the bug and the fix) is unreachable without a signed-in Supabase session. Proving the fix required diff review against `addTransaction`'s established pattern plus reasoning through the exact React scheduling mechanism, not a passing red-to-green test. A future pass adding an authenticated-session test fixture (mocking or a real Supabase test project) would close this gap; out of scope here.
- **No RPC or migration was added.** The fix is a client-side reordering of existing logic, not a new database function — unlike `transfer_funds`, which needed a `security definer` RPC to make its multi-row update atomic. `setTransactionDeleted`'s two wallet writes remain two separate round-trips, same as before the fix; only whether they fire at all changed.
- **T64-T78 (dead-mutator removal, rollback parity on the other 9 mutators, `AnimatedCounter`, targeted render-cost fixes, deferred shell modals) are separate, later phases**, not folded into this one — each is independently gated and revertible per the approved plan.

---

## Phase 31 — dashboard hierarchy polish, math input UX, mobile ergonomics verification, Supabase dedupe migration: T57-T60 (2026-09-20, commit `f053fcf`)

**Changed**

- `src/components/dashboard/TotalWealthHero.tsx` / `CashflowMetricsCards.tsx` - `tabular-nums` added alongside every existing `font-mono` financial figure, so digits no longer shift column width mid-`AnimatedCounter` animation.
- `src/views/DashboardView.tsx` - the T22-era 4-way grid's `items-start` changed to `items-stretch`, letting the "Record a Transaction" CTA card's pre-existing (previously inert) `h-full` actually match the height of its sibling column's 2 stacked cards; added a 3-chip capability row (math input / smart category / debt repay) to the CTA card so the reclaimed space reads as intentional rather than empty.
- `src/components/InlineMathInput.tsx`:
  - Extracted `handleInputChange`'s evaluation body into a new `evaluateAndNotify(val)` function (byte-identical logic, pure extraction).
  - New `handleQuickAmount(amount)`, reusing `evaluateAndNotify` so a chip tap is evaluated exactly like typed input.
  - New quick-amount chip row (+100/+500/+1,000), rendered only below the `sm` breakpoint, chaining onto existing input text with `+` the same way the pre-existing quick-operator row does.
  - New `Info`-icon hint badge next to the field label (native `title`/`aria-label` tooltip: "Supports formulas: 120/2 + 50").
- New `supabase/migrations/20260920_dedupe_categories.sql` - one-time, idempotent, transaction-wrapped cleanup for `categories` rows already duplicated in a live project: re-points `transactions.category_id` and `keyword_rules.category_id` off every losing duplicate onto its winner, then hard-deletes the now-unreferenced losers.
- `docs/audit/task-ledger.md` - new Phase 31 table (T57-T60) and roadmap-status line update.
- 5 files changed (1 new).

**Why**

Phase 30 shipped the client-side symptom fix for duplicate categories (`dedupeCategoriesByName`) but explicitly deferred the server-side cleanup, since no database access existed in that session either. This phase closes that gap (T60) alongside three independently-requested polish items: dashboard visual hierarchy (T57), faster expense entry via `InlineMathInput` (T58), and a mobile-ergonomics check on `MobileBottomNav` (T59) that turned out to already be satisfied.

**Verification**

```
npm run lint                                                                              # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/theme.spec.ts tests/categories.spec.ts --project=chromium   # 11/11 passed
CI=true npx playwright test                                                              # 99/99 passed, 0 retries, 5.1m, 1 worker
npm run build                                                                             # built in 7.54s; 0 chunks over 500 kB
```

**Correctness notes**

- **T59 required no code change.** Read `MobileBottomNav.tsx` in full before touching anything: `pb-[env(safe-area-inset-bottom,0.5rem)]` (safe-area padding), `backdrop-blur-md` (backdrop blur), and `min-h-[48px]` per tab button (already >44px) were all already shipped, presumably from earlier phase work this session didn't need to re-derive. Editing already-correct code to superficially match a brief that predates its own prior fix would have been a no-op diff at best and a real visual regression at worst (the brief's literal `bg-stone-900/90` suggestion would break the light-theme nav, which is intentionally `bg-white/95`).
- **The T58 chip-evaluation refactor was necessary, not optional.** A first-draft version set `rawInput` directly from the chip handler without re-running evaluation — since `evaluateAndNotify` only ever ran from the `<input>`'s own `onChange`, a programmatic `setRawInput` call would silently leave `evaluatedAmount`/`onAmountEvaluated` stale, so the parent form would never see the chip-driven amount. Extracting `evaluateAndNotify` and calling it explicitly after every programmatic `rawInput` change (mirroring the existing `handleQuickAdd` operator-append pattern, but actually re-evaluating) is what makes the chips functionally complete rather than cosmetic.
- **T60's duplicate key intentionally matches `dedupeCategoriesByName`'s, including its omission of `category.type`.** Any divergence between the client healing pass and this one-time server cleanup would mean a row one of them calls a duplicate the other doesn't — see `task-ledger.md`'s Phase 31 notes for the full reasoning, including why this migration hard-deletes rather than soft-deletes (everything referencing a loser is re-pointed inside the same transaction before the delete runs, so nothing is left dangling).

**Deliberately not done**

- **T60 was not applied to a live database.** This sandbox has no connected Supabase project, matching Phase 30's own note that no database access existed in that session either. The migration file is written and follows `20260909_transfer_funds.sql`'s existing conventions (assumed-schema comment block, transaction-wrapped, explicit idempotency argument) but is unexecuted — applying it to a real project is the user's call, not this session's to make unilaterally.
- **`MobileBottomNav.tsx` was read but not modified** - see the T59 correctness note above.
- **No new domain hook, state library, or abstraction was introduced** for any of the four tasks - each change lands at the same layer (component styling, one component's local input logic, one new migration file) its own task specifies.

---

## Phase 30 — Categories & Smart Rules hub, category CRUD, duplicate-category fix: T51-T56 (2026-09-19, commit `8f7e4cd`)

**Changed**

- `src/context/FinanceContext.tsx`:
  - New `isSeedingRef` mutex around `seedInitialUserAccount` - closes the race that let a brand-new account's starter categories/wallets be inserted 2+ times.
  - New `keywordRulesRef` (mirrors the existing `walletsRef`/`transactionsRef`/`debtsRef`/`categoriesRef`/`diaryEntriesRef` pattern exactly), needed by `deleteCategory`'s in-use check.
  - `categories` `useState` initializer and `loadSupabaseData`'s categories branch both now run through the new `dedupeCategoriesByName` before committing to state.
  - 3 new mutators: `addCategory`, `updateCategory` (name/color only), `deleteCategory` (guarded - system defaults and anything referenced by an active transaction or keyword rule are rejected), added to `FinanceActionsContextType` and both halves of `actionsValue`.
- New `src/utils/categoryUtils.ts` - `dedupeCategoriesByName(categories)`, collapsing active same-name duplicates down to one by marking the losers `isDeleted: true` (never dropping an id).
- `src/utils/zodSchemas.ts` - new `CategorySchema` (`name`/`type`/`color`/optional `icon`), guarding `addCategory`.
- New `src/views/CategoriesView.tsx`, replacing deleted `src/views/KeywordRulesView.tsx` - a `SectionHeader` + `SegmentedControl` hub with two sub-tabs: "Categories" (new - add/edit/delete-guarded management list, built from `Card`/`EmptyState`/`Modal`/`ConfirmDialog`) and "Smart Rules" (the retired view's sandbox + rules table, ported verbatim - every element id and `data-testid` unchanged).
- `src/components/Navbar.tsx` / `src/components/MobileBottomNav.tsx` / `src/App.tsx` - `ActiveTab`'s `'keywords'` member renamed to `'categories'`; `NAV_ITEMS` label "Smart Rules" → "Categories" (icon `Sparkles` → `Tags`); `TABS_ORDER`, the lazy import, and the view switch case updated to match.
- `src/views/TransactionsView.tsx` - the CSV import modal's subtitle had a literal, unrendered `$\rightarrow$` LaTeX fragment and a factually wrong "MySQL" mention; fixed to a real arrow character and accurate wording.
- `tests/keywords.spec.ts` - navigates to the renamed `categories` tab and clicks into the new "Smart Rules" sub-tab; every other assertion (ids, `data-testid`s) is unchanged.
- New `tests/categories.spec.ts` (4 tests) - default-category uniqueness, delete-guard-hides-control, zero-duplicate dropdown options, create-appears-everywhere-immediately.
- `CLAUDE.md` - test count (29/12/87 → 33/13/99, plus the new file in the suite list), `CategorySchema` added to the validation table.
- 12 files changed (2 new, 1 deleted).

**Why**

Two independent problems, requested together: (1) a real correctness bug - every default category (and, by the same mechanism, the starter wallets) could be inserted 2-3 times into a real Supabase-backed account on first sign-up, because the auth-state effect can call `loadSupabaseData` more than once for the same brand-new account before the first seed attempt's insert lands, and nothing guarded the insert itself against a second racer; and (2) a feature request - categories had no management UI at all (no `addCategory`/`updateCategory`/`deleteCategory` existed anywhere in the codebase before this phase), and the standalone "Smart Rules" view was a natural place to fold that in, since every category picker already lived downstream of the same state this phase was already touching to fix the bug.

**Verification**

```
npm run lint                                                                  # tsc --noEmit: clean, 0 errors
npx playwright test tests/keywords.spec.ts tests/categories.spec.ts tests/transaction.spec.ts --project=chromium   # 10/10 passed
CI=true npx playwright test                                                  # 99/99 passed, 0 retries
npm run build                                                                 # built in 5.31s; new CategoriesView-*.js chunk, 13.07 kB / 3.43 kB gzip
```

**Correctness notes**

- **The bug's actual mechanism, read from the source rather than guessed at:** `FinanceContext.tsx`'s auth-state `useEffect` calls `loadSupabaseData(session.user.id)` directly after an explicit `getSession()`, then immediately subscribes `supabase.auth.onAuthStateChange(...)`, which fires its own initial event for that same session per Supabase-js v2's documented behavior - two calls to `loadSupabaseData` for one real sign-in, before either has necessarily finished. `main.tsx`'s `<StrictMode>` can double-invoke the whole effect in dev on top of that. `loadSupabaseData` seeds only when it observes zero wallets (`mappedWallets.length === 0`), which is true for every one of these racing calls on a brand-new account, and the pre-fix `seedInitialUserAccount` had no guard at all against running more than once concurrently - each racer independently ran its own `INSERT` of the full starter wallet/category set.
- **This exact bug could not be reproduced in this sandbox** (no `.env`, so the app runs in offline Local Storage Mode, where `seedInitialUserAccount` is unreachable code). The fix is a from-the-source root-cause close (an `isSeedingRef` mutex making the insert step itself safe against any number of concurrent callers), not a fix verified against a live reproduction - flagged explicitly rather than claimed as tested against the real symptom.
- **The healing dedup pass is provably safe against orphaning a historical reference**, because of *when* duplicates can form: only at first-ever seeding of a brand-new account, before any transaction exists yet to reference one of the about-to-be-duplicated ids. `dedupeCategoriesByName` marks every losing duplicate `isDeleted: true` rather than removing it from the array, so even outside that safe window, any id that turned out to be referenced would still resolve via `buildLookupMap`/`categoryMap.get()` for historical chip rendering - it just stops appearing in any of the app's existing `!isDeleted`-filtered pickers.
- **Every existing category `<select>` inherited the fix automatically, with zero additional edits at its own call site.** `QuickAddModal`, `TransactionsView`'s Add Transaction modal, and `DebtsView`'s repay modal all already did `categories.filter((c) => !c.isDeleted)` before handing the array to `TransactionForm` - once the underlying `categories` state itself is deduped-and-flagged, those pre-existing filters simply stop seeing the losing duplicates. Confirmed by reading all 3 call sites before writing the fix, not assumed.
- **`deleteCategory` is guarded in two independent places, matching this codebase's existing double-enforcement pattern** (Zod validation lives in the action, not just the form): the action itself rejects a system category or one referenced by an active transaction/keyword rule (server-authoritative, returns a `MutationResult`), and `CategoriesView` separately precomputes which categories are eligible to hide the delete control entirely for ineligible rows (better UX - no dead-end confirm-then-fail).
- **The one real `$` sweep finding was not a currency bug.** Every transaction/wallet/debt submit button and label already routes through `formatCurrencyAmount`/`APP_CURRENCY_SYMBOL` (closed in Phases 4 and 21) - confirmed by grepping the literal character across every `.tsx` file, which turned up exactly one hit: `TransactionsView.tsx`'s CSV import subtitle, an unrendered LaTeX `$\rightarrow$` fragment (plus an unrelated, factually wrong "MySQL" mention - this app has no MySQL anywhere in its stack). Fixed as a real, if minor, rendering bug; not the currency-symbol issue the phase brief anticipated finding.

**Deliberately not done**

- **No migration or admin tool to find and physically remove already-duplicated rows in a real Supabase project.** This phase heals the *symptom* everywhere the app reads `categories` and prevents *new* duplicates; it cannot and does not touch a live project's already-corrupted data - no database access exists in this sandbox, and doing so blind would be exactly the kind of destructive action this session's operating guardrails call for pausing on rather than guessing at.
- **`ActiveTab` was not relocated to `types.ts`.** The phase brief assumed it lived there; it has always lived in and been exported from `Navbar.tsx`. Renamed in place rather than moving it to match an incorrect premise - see `task-ledger.md`'s note on this same point.
- **No `useCategories` domain hook was introduced** - `CategoriesView` reads `useFinanceState()`/`useFinanceActions()` directly, consistent with `CLAUDE.md`'s existing carve-out for state no hook covers (categories, diary entries, sessions).
- **Category type is fixed after creation, and only EXPENSE/INCOME are creatable at all** - both deliberate scope boundaries; see `task-ledger.md`'s notes for the reasoning (historical-record consistency, and the fixed one-category-per-type system taxonomy for TRANSFER/ADJUSTMENT/DEBT_REPAYMENT).
- **No icon picker was built for `Category.icon`** - the field is stored and round-tripped but rendered nowhere in the app today; confirmed by grep before deciding not to build UI for it.

---

## Phase 29 — roadmap closeout & documentation alignment: T50 (2026-09-19, commit `5132ef6`)

**Changed**

- New `docs/audit/decisions/0006-ui-primitive-inventory.md` — catalogs all 9 shared UI primitives + 1 design-token module extracted across Phases 15/21/24–28, and records the recurring pattern behind all of them: a shared component plus a narrow override prop for whichever field a specific call site had already diverged on, rather than forcing every site onto one fixed appearance or forking the component per site.
- New `docs/audit/decisions/0007-transaction-entry-consolidation.md` — records `TransactionForm` as the one configurable entry engine (`idPrefix`/`presetType`/`lockType`/`presetDebtId`/`presetWalletId`) behind 3 of the app's transaction-creating surfaces, why `WalletPopupModal`'s Adjust Balance editor deliberately stays off it, and why the wallet-to-wallet Transfer flow is a *separate*, deliberately-not-merged path (`WalletTransferForm`/`TransferFundsModal`, not `TransactionForm`'s own TRANSFER option) — correcting the roadmap brief's looser framing that transfer itself was "unified" onto this engine.
- New `docs/audit/decisions/0008-wallet-surface-ownership.md` — records `WalletPopupModal`'s collapse from 4 tabs to 2 (OVERVIEW + TRANSACTIONS), why the modal itself was *not* promoted above view level (no reachability problem existed for it), and why Transfer/Add-Wallet *were* lifted to 2 new shell-level, self-subscribing modals in `App.tsx` instead (a concrete reachability constraint `wallet-forms.spec.ts` enforces, that a per-view local instance can't satisfy).
- `docs/audit/baseline-metrics.md` — final "Phase 29 closeout" column appended to every metric table (bundle/chunk breakdown, type-check time, Playwright wall-clock, source LOC), captured at commit `91687df` with the file's own documented reproduction commands.
- `docs/audit/task-ledger.md` — added a roadmap-status banner ("all 29 phases done, `T25`/`T18` remain explicitly deferred"), the Phase 29/T50 row itself.
- `CLAUDE.md` — new UI-primitives-inventory section (paths, import convention, the override-prop pattern); new transaction-entry-engine convention section; corrected the stale "`AddWalletForm`/`WalletTransferForm` used by both `WalletsView` and `WalletPopupModal`" line (T41 moved both forms' only call sites to the shell-level `AddWalletModal`/`TransferFundsModal`); `WalletPopupModal`'s gotcha entry updated to name its current 2 tabs.
- 0 `src/` files changed - this phase is documentation-only, per its own stated scope.

**Why**

Phases 19-28 (T31-T49) shipped 11 architectural decisions and 9 shared primitives without a single ADR recording *why* - each phase's own `task-ledger.md`/`refactor-log.md` notes captured the reasoning at the time, but nothing formalized the durable decisions (where does a new primitive go, why does Adjust Balance stay off `TransactionForm`, why is `WalletPopupModal` itself not shell-level while Transfer/Add-Wallet are) in the ADR format the rest of the project already uses for exactly this purpose (`0001`-`0005`). Left undocumented, each of those 3 decisions is exactly the kind of thing a future change could quietly re-open without realizing it was already deliberately settled.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
CI=true npx playwright test      # 87/87 passed, 0 retries (5.5m, CI=true forces 1 worker)
npm run build                    # built in 7.60s; entry chunk 176.93 kB / 49.69 kB gzip
```

**Correctness notes**

- **The `CLAUDE.md` wallet-forms line was corrected, not just left stale with a note.** Reading `WalletsView.tsx`, `WalletPopupModal.tsx`, and `TransferFundsModal.tsx`/`AddWalletModal.tsx` before writing ADR 0008 confirmed neither view mounts `AddWalletForm`/`WalletTransferForm` directly anymore (`WalletsView` only calls `onOpenTransfer`/`onOpenAddWallet` props; `WalletPopupModal`'s TRANSFER/ADD_WALLET tabs were retired in T39) - this promotion pass fixes the line to name the actual 2 current call sites instead of repeating what was true before Phase 23.
- **ADR 0007 does not repeat this phase's own brief verbatim where the brief overstated reality.** The brief's framing ("unifying standard/transfer/repay on `TransactionForm`") is accurate for standard-entry and repay, but the wallet-to-wallet transfer flow was consolidated separately in Phase 23 onto `WalletTransferForm`/`TransferFundsModal`, not onto `TransactionForm`. The ADR states the actual split (`TransactionForm`'s own TRANSFER option exists for its 3 generic-entry consumers; the dedicated wallet-first Transfer button/shortcut uses the separate form) and cross-references ADR 0008, rather than asserting a single-form unification for transfer that didn't happen.
- **Every promoted `CLAUDE.md` constraint was checked against the live tree before being written**, per this task's own "only promote constraints that hold true right now" instruction - not copied from the ledger's historical notes. `WalletPopupModal`'s tab count, `TransactionForm`'s consumer list, and the primitive inventory's file paths were each grepped/read fresh in this pass.

**Deliberately not done**

- **`T25`/`T18` were not started or re-scoped.** Both remain in `task-ledger.md`'s Deferred table, each still blocked on a separate approval this phase was not asked to obtain.
- **No re-render scenario replay.** Nothing in Phases 19-28 changed a subscription pattern this closeout's own scope (ADRs + metrics + `CLAUDE.md`) asked to re-measure; the existing Post-Phase-4/Post-T34 snapshots in `baseline-metrics.md` stand unchanged.
- **`RecentTransactionsTable`'s Type-column icon/label scheme and the still-unmerged `repayDebt`/`repayDebtAtomic` dead code were not touched** - both already flagged as their own future candidates in Phases 21/22's notes; this phase records the roadmap's decisions, it doesn't open new implementation work.

---

## Phase 28 — transaction row cells: T49 (2026-09-19, commit `91687df`)

**Changed**

- New `src/components/transaction/TxCells.tsx` — 4 atomic cells, not a unified row component:
  - `TxTypeIcon({type, variant: 'full'|'compact', size: 'sm'|'md', tintOverride?, className?})` — icon-in-a-tinted-box, `variant`/`size` selecting between `TX_TYPE_META`'s two icon sets and the two existing box-size shapes; `tintOverride` lets a divergent site (`WalletPopupModal`) keep its own exact colors.
  - `TxAmount({amount, type, colorScheme: 'standard'|'incomeOnly', colorClassName?, className?})` — `formatCurrencyAmount` plus the canonical `TX_TYPE_META[type].sign` glyph; `colorScheme` covers the two 3-way/2-way presets already in use verbatim, `colorClassName` overrides for a site with its own scheme entirely.
  - `TxCategoryChip({category, size?, rounded?, showDot?, className?})` — thin pass-through over `CategoryChip` (Phase 26), `null` when no category; callers keep their own "no category" fallback branch.
  - `TxSoftDeletedTag` — the `[Soft Deleted]` tag, no props.
- `TransactionTableRow.tsx` — icon box, both category-chip branches, the soft-deleted tag, and the amount span all now the shared cells; `meta`/`TypeIcon`/`isIncome` locals removed as dead once their only use sites were replaced.
- `RecentTransactionsTable.tsx` — both category-chip branches and the amount span now the shared cells (amount via a new local `AMOUNT_COLOR_BY_TYPE` map passed as `colorClassName`, preserving this file's own 4-way emerald/rose/amber/indigo scheme); the Type column (a 3rd, different icon set) untouched.
- `WalletPopupModal.tsx` — the activity-list icon box now `<TxTypeIcon variant="compact" size="sm" tintOverride={...}>` (tint computed inline, unchanged), the amount span now `<TxAmount colorScheme="incomeOnly">`; the `TX_TYPE_META` import (previously used only for `.compactIcon`/`.sign`) removed as dead.
- `DiaryEntryCard.tsx` — the outflow-row amount now `<TxAmount colorClassName="text-rose-600 dark:text-rose-400">` in place of a hardcoded `-{formatCurrencyAmount(...)}`; the per-item colored-dot category display and the day-level `Day Outflow` summary (not a transaction-row cell) both left untouched.
- 5 files changed (1 new).

**Why**

`implementation-roadmap.md` Phase 28 / `docs/audit/ui-ux-audit-report.md` finding D: the type-icon-in-a-box, the signed formatted amount, the category chip, and the soft-deleted tag were each duplicated (with drift) across the app's 4 transaction renderers, but the renderers themselves are structurally too different (`<tr>` vs `<div>`, different columns, no table at all in 2 of the 4) to collapse into one row component without a large conditional prop surface - the same conclusion the Deferred table's T25 entry already reached ("consider dropping"). Sharing only the atomic pieces gets the deduplication without that risk.

**Verification**

```
npm run lint                                                                                   # tsc --noEmit: clean, 0 errors
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/date-boundary.spec.ts --project=chromium   # 9/9 passed
CI=true npx playwright test                                                                    # 87/87 passed, 0 retries
npm run build                                                                                   # built in 20.15s; new TxCells-*.js chunk, 1.99 kB / 0.90 kB gzip
```

**Correctness notes**

- **`RecentTransactionsTable`'s amount previously rendered no sign glyph at all for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT** (`tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? MINUS : ''` - the empty-string branch). `TxAmount` always renders `TX_TYPE_META[type].sign`, so those 3 types now show the canonical `MINUS` (U+2212) glyph, matching every other renderer. This is a deliberate fix surfaced by centralizing the format logic, not a preserved behavior - no spec asserts on the literal sign character for those types.
- **`DiaryEntryCard`'s outflow amounts gained the same canonical `MINUS` glyph** in place of a hardcoded ASCII hyphen (`'-'`), for the same reason. Its color (always rose regardless of whether the transaction is EXPENSE or DEBT_REPAYMENT) is unchanged, passed through `colorClassName`.
- **Every other tint/color/icon divergence was preserved exactly via an override prop, not unified.** `WalletPopupModal`'s activity-list tint (`bg-*-50`/`dark:*-950/60`, income/expense/else 3-way) and amount color (income-emerald-else-stone, 2-way) both differ from `TransactionTableRow`'s canonical `TX_TYPE_META` scheme (`bg-*-100`/`dark:*-950/50`, income/debt/else 3-way); `RecentTransactionsTable`'s amount color is a 4th scheme (emerald/rose/amber/indigo) matching none of the others. `txTypeMeta.ts`'s own T35 doc comment already flagged these as intentional divergences not to force-unify - `tintOverride`/`colorClassName` exist specifically so this phase's adoption doesn't silently pick a winner among them.
- **`RecentTransactionsTable`'s `lg:table-cell`-only Type column (icon + label, e.g. `ArrowLeftRight` + "Transfer") was not migrated.** It uses a 3rd icon set (`ArrowLeftRight`/`TrendingDown` for TRANSFER/DEBT_REPAYMENT, not `TX_TYPE_META`'s `RefreshCw`/`Landmark`) and its own label strings (`Repayment`, not `Debt Repayment`) - adopting `TxTypeIcon` there would show the wrong icon, not just a different color.

**Deliberately not done**

- **No single `<TxRow>`/`<TransactionRow>` wrapper component.** Explicitly out of scope per this task's own guardrail and the existing T25 Deferred-table note; see Why.
- **`RecentTransactionsTable`'s Type column's icon set and label strings were not unified onto `TX_TYPE_META`** - a genuine icon/label mismatch, not a stylistic one; left as a separate, unstarted concern.
- **No pixel-level visual regression testing.** Every preserved tint/color scheme and the one deliberate glyph fix were verified by reading the diff against each file's pre-change source, not a screenshot comparison.

---

## Phase 27 — SegmentedControl: T48 (2026-09-19, commit `07b6394`)

**Changed**

- New `src/components/ui/SegmentedControl.tsx` — generic `SegmentedControl<T extends string>` over `options: Array<{value: T; label: string; id?: string}>`, `value`, `onChange`, `size: 'sm'|'md'`, `fill?: boolean` (equal-width buttons), `className` (tray-level display/layout classes only). The active option's pill background is a `motion.span` with `layoutId={`${useId()}-pill`}` and a spring `transition`, so switching options animates the pill across rather than swapping a background class instantly.
- `DashboardView.tsx` — the period filter (`DAY`/`WEEK`/`MONTH`/`ALL`) now `<SegmentedControl<TimeFilter> size="sm" .../>`; ids `time-filter-day`/`-week`/`-month`/`-all` and label text (`Today`/`This Week`/`Past 30 Days`/`All Time`) passed through unchanged.
- `TransactionForm.tsx` — the transaction-type toggle (`EXPENSE`/`INCOME`/`TRANSFER`/`DEBT_REPAYMENT`) now `<SegmentedControl<TransactionType> size="md" .../>` inside its existing `grid grid-cols-4 sm:flex` mobile touch-target layout, passed via `className`; ids `${formId}-type-*` and label text (`Expense`/`Income`/`Transfer`/`Debt`) unchanged.
- `AuthModal.tsx` — the Sign In / Create Account mode tabs now `<SegmentedControl<'signin'|'signup'> size="sm" fill .../>`; ids `auth-tab-signin`/`auth-tab-signup` and label text (`Sign In`/`Create Account`) unchanged.
- 4 files changed (1 new), net +90/-70 lines (component new file offsets the ~104 lines of duplicated hand-rolled markup removed from the 3 call sites).

**Why**

`implementation-roadmap.md` Phase 27: three call sites (dashboard period filter, transaction-type toggle, auth mode tabs) independently hand-rolled the same "tray of buttons, active one gets a white/dark-panel pill background" pattern, each with its own copy of the tray/pill/label class strings and no shared animation. Unifying them into one primitive with a `layoutId`-animated pill both removes the duplication and gives all three the spring transition none of them had individually.

**Verification**

```
npm run lint                                                                # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/auth.spec.ts --project=chromium   # 9/9 passed
CI=true npx playwright test                                                 # 87/87 passed, 0 retries
npm run build                                                                # built in 7.28s
```

**Correctness notes**

- **`layoutId` is namespaced per component instance via `useId()`, not a fixed string.** `TransactionForm` can mount twice concurrently (its own `formTestId` prop documents this — the Dashboard's inline form alongside the Quick Add modal), and `DashboardView` renders its period-filter control in the same tree as that inline form's type-toggle control. A shared `layoutId="pill"` across multiple mounted instances would make framer-motion treat unrelated pills in different controls as the same animating element.
- **Container display mode (`flex` vs `grid grid-cols-4 sm:flex`) stays a `className` the caller supplies, not something the primitive hardcodes.** `TransactionForm`'s mobile 4-column touch-target grid and `DashboardView`'s content-sized `flex` tray are genuinely different layouts; folding either into the primitive's own default would visually break the other.
- **`fill` (equal-width `flex-1` buttons) was added beyond the phase brief's minimum `value`/`onChange`/`size`/`className` prop list.** `AuthModal`'s two tabs were `flex-1` pre-migration with no way to express that through the other props.
- **The phase brief's own prose named the auth tabs "Sign In / Sign Up"; the actual source text is "Sign In" / "Create Account".** Preserved the real source text verbatim per the "preserve exact label texts" guardrail, not the brief's paraphrase. `auth.spec.ts:36,40` asserts on the ids only, so this had no test-visible effect either way.
- **`TransactionForm`'s type toggle has 4 options (`EXPENSE`/`INCOME`/`TRANSFER`/`DEBT_REPAYMENT`), not the 3 (`Expense`/`Income`/`Transfer`) the phase brief's file excerpt implied.** All 4 were carried over unchanged — dropping `DEBT_REPAYMENT` would have deleted a working feature, not adopted a primitive.

**Deliberately not done**

- **The Diary mood/food grids were not adopted onto `SegmentedControl`**, per this phase's own explicit exemption — they're a different interaction shape (multi-cell icon grid, not a 2-4 option text tab tray), not a pill-in-tray switcher.
- **No visual regression testing beyond Playwright's text/id assertions.** The spring-pill animation itself has no automated visual check; confirmed manually only in the sense that the existing DOM structure (button + label) still resolves to the same accessible name and id at every site.

---

## Phase 26 — Badge, ProgressMeter, EmptyState: T45, T46, T47 (2026-09-19, commit `ab1068c`)

**Changed**

- New `src/components/ui/Badge.tsx` — exports `Badge` (`tone: 'neutral'|'amber'`, `size: 'sm'|'md'`, `icon`, `className`) and `CategoryChip` (`name`, `color`, `size`, `rounded: 'sm'|'md'|'full'`, `showDot`, `className`) plus a standalone `categoryTint(color)` helper.
- `TransactionTableRow.tsx` — mobile debt-payoff badge and desktop debt-repayment badge both now `<Badge tone="amber" .../>`; mobile and desktop category chips both now `<CategoryChip .../>`.
- `RecentTransactionsTable.tsx` — mobile and desktop category badges now `<CategoryChip .../>`; its own empty state (the model T47 is based on) now renders through the new `EmptyState`.
- `DiaryEntryCard.tsx`, `DiaryView.tsx` — the "Today"/"Yesterday" day-badge (identical markup at both sites) now `<Badge>{...}</Badge>`.
- `KeywordRulesView.tsx` — its configured-rules table's category cell now `<CategoryChip .../>`; a new empty state (`Tag` icon) added for zero configured rules.
- New `src/components/ui/ProgressMeter.tsx` — `percent` (clamped `[0, 100]` internally via `Math.min(100, Math.max(0, percent))`), `color` (raw hex, for per-instance colors) or `barClassName` (a static Tailwind class), `heightClassName`. Adopted in `DebtCardItem.tsx`, `DebtPayoffOverview.tsx` (both `barClassName="bg-emerald-500"`, `h-3`), `CategoryExpenseDistribution.tsx` (`color={item.color}`, `h-2` default - the fix, see Correctness notes), `WalletAccountsGrid.tsx` (`color={wallet.color}`, `h-1.5`).
- New `src/components/ui/EmptyState.tsx` — `icon`, `title`, `subtitle?`, `action?`, modeled on `RecentTransactionsTable`'s pre-existing shape. Adopted in `TransactionsView.tsx` (its filtered-table empty state, text unchanged), `KeywordRulesView.tsx`, `DebtsView.tsx`, `WalletsView.tsx`, `WalletAccountsGrid.tsx` (the last three each wrapped in `Card`, since none had an existing container shell).
- 15 files changed (3 new), net +292/-106 lines.

**Why**

`docs/audit/ui-ux-audit-report.md` and this phase's brief: `${color}15`/`20`/`25` tint-alpha drift and an invalid `py-0.2` class (silently zero vertical padding) were both duplicated-with-drift across the transaction-row renderers; four separate progress-bar implementations existed with inconsistent (and, in one case, absent) clamping; and five surfaces rendered nothing when their underlying list was empty, leaving a blank page rather than any orientation for a new user.

**Verification**

```
npm run lint                                                                                       # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/keywords.spec.ts tests/debts.spec.ts --project=chromium   # 7/7 passed
npx playwright test tests/soft-delete.spec.ts tests/diary.spec.ts tests/wallets.spec.ts --project=chromium    # 5/5 passed (regression re-check)
npm run build                                                                                       # built in 9.28s
CI=true npx playwright test                                                                         # 87/87 passed, 0 retries
```

**Correctness notes**

- **`CategoryExpenseDistribution.tsx` previously rendered its fill bar's width as `${percent}%` with no clamp of any kind** - the only one of the four progress-bar sites with none at all (`DebtCardItem`/`DebtPayoffOverview` both had `Math.min(100, ...)`; `WalletAccountsGrid` already had the full `Math.min(100, Math.max(0, ...))`). Routing it through `ProgressMeter` closes that gap the same way as the other three, rather than patching it in place and leaving the duplication.
- **`Badge`'s two tones were chosen by reading every `py-0.2` site before writing the component, not assumed.** Only two distinct visual treatments exist across the five bug sites: a plain, `font-bold`, borderless neutral pill (the day-badge, identical at two sites) and a bordered, `font-medium` amber pill (the debt-repayment badge, at two sizes). No other tone was fabricated speculatively.
- **`CategoryChip`'s `rounded` prop preserves three genuinely different existing values** (`rounded` 0.25rem, `rounded-md` 0.375rem, `rounded-full`) rather than collapsing them - confirmed by reading each of the five adopting call sites' exact class list before extracting the shared component, the same discipline Phase 21's token adoption and Phase 25's `Card` adoption both used.
- **The `20%` tint alpha was chosen as the value that minimizes total visual delta**: of the three values found (15%, 20%, 25%), 20% already matched `RecentTransactionsTable` exactly (zero-delta there) and is equidistant from the other two.
- **Three of the five new `EmptyState` adoptions (`DebtsView`, `WalletsView`, `WalletAccountsGrid`) are wrapped in `Card`.** `EmptyState` itself is deliberately chrome-less (a plain centered icon/title/subtitle stack) so it can drop into an existing table cell (`RecentTransactionsTable`, `KeywordRulesView`) without adding a redundant nested border. Those three views render their grid as a bare `<div className="grid ...">` with no existing container, so without `Card` the empty state would float as unstyled text directly on the page background.

**Deliberately not done**

- **`DiaryEntryCard`'s workout and food-quality badges were not migrated onto `Badge`.** Both already use valid CSS (not part of the named `py-0.2` list) and each carries its own multi-way conditional tone (workout: blue-vs-neutral; food: emerald/amber/rose) beyond the two tones this task's actually-duplicated sites justified adding.
- **No further `${color}NN` tint-alpha sites were searched for beyond the three the phase brief named** (`KeywordRulesView`, `TransactionTableRow`, `RecentTransactionsTable`). Any others (e.g. in components not touched by this phase) remain as-is.
- **No `SegmentedControl` primitive was introduced.** Out of scope - Phase 27.

---

## Phase 25 — SectionHeader + Card: T43, T44 (2026-09-19, commit `5b38141`)

**Changed**

- New `src/components/ui/Card.tsx` — a shell primitive (`children`, `className`, `padding: 'none'|'sm'|'md'|'lg'` → `''`/`p-3.5 sm:p-4`/`p-5`/`p-6`, `interactive`) standardizing on `rounded-2xl`, a subtle border, the white/`stone-900` background, and `shadow-xs`.
- New `src/components/ui/SectionHeader.tsx` — `title`/`subtitle`/`action`/`className`, built on `Card`. Renders the title/subtitle block on the left and `action` verbatim on the right (no extra wrapping div, since every caller already supplies its own single-root action markup).
- `SectionHeader` adopted for the top banner in all 7 views (`DashboardView.tsx`'s "Periodic Cashflow" section, `DiaryView.tsx`, `DebtsView.tsx`, `WalletsView.tsx`, `TransactionsView.tsx`, `SecurityView.tsx`, `KeywordRulesView.tsx`) — 8 near-identical hand-rolled `flex justify-between` banners collapsed onto 1 component.
- `Card` adopted at 6 shell sites that already matched its shape losslessly: `KeywordRulesView.tsx`'s Add Rule form, Sandbox panel, and Configured Rules table (all `padding="lg"`); `DiaryView.tsx`'s Daily Logger and Recent Entries columns (both `padding="lg"`); `TransactionsView.tsx`'s transaction table container (`padding="none"`, since it pads internally via its own table cells).
- 9 files changed (2 new), net +264/-202 lines.

**Why**

`docs/audit/ui-ux-audit-report.md` and `implementation-roadmap.md`'s Phase 25 entry: the `flex justify-between` + `h2` + `p` header banner was near-identical across all 7 views, and ~25 card-shaped shells across the app had each been hand-typed rather than sharing one implementation. Establishing consistent spacing, typography, and border treatment behind two small primitives removes the duplication at its most repeated points without touching heading semantics or breaking any `getByRole('heading', {name})` assertion.

**Verification**

```
npm run lint                                                                                                     # tsc --noEmit: clean, 0 errors
npx playwright test tests/keywords.spec.ts tests/wallets.spec.ts tests/debts.spec.ts tests/diary.spec.ts tests/theme.spec.ts --project=chromium   # 8/8 passed
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts --project=chromium                        # 7/7 passed (regression re-check)
npm run build                                                                                                     # built in 9.93s
CI=true npx playwright test                                                                                       # 87/87 passed, 0 retries
```

**Correctness notes**

- **Two intentional, minor spacing/visibility unifications - both what this phase's "establishing consistent spacing" goal explicitly asked for, not silent regressions.** Every adopting banner now uses `Card`'s flat `p-5` and `shadow-xs` (previously `shadow-2xs` everywhere; `TransactionsView` and Dashboard's "Periodic Cashflow" section additionally used stepped `p-4 sm:p-5`/`gap-3 sm:gap-4`). `TransactionsView`'s subtitle, previously `hidden sm:block` to save room in its crowded 4-button mobile toolbar, is now always visible like every other view's subtitle. Verified neither string is asserted on by any spec before making the change.
- **`Card` adoption is scoped to shells that already matched its static, four-value padding shape - not the full ~25-site surface the roadmap describes for the entire Phase 25 concept.** Read every candidate shell before touching any of them (same discipline as Phase 21's token adoption) and found four genuinely different shapes that `Card` as specified (a plain `<div>`, static classes, a fixed `none`/`sm`/`md`/`lg` padding enum) cannot express losslessly: framer-motion `motion.div` cards with `whileHover`/`whileTap` (`WalletsView`, `WalletAccountsGrid` wallet cards - converting would drop the tap/hover animation entirely); a conditional per-state className swap (`DebtCardItem`'s settled/unsettled background and border - appending an override via `Card`'s `className` prop risks losing to `Card`'s own base classes, since Tailwind's cascade order follows source-file order, not the order classes appear in a rendered `className` string); stepped responsive padding with no matching scale value (`SecurityView`'s `p-5 sm:p-6` session/profile/password cards, its `p-4 sm:p-5` RLS info card, `TransactionsView`'s `p-3.5 sm:p-4` filter bar); and a non-white background paired with stepped padding (`SecurityView`'s RLS info card is `bg-stone-50`, not `Card`'s white/`stone-900`). All were left local rather than forced.
- **`KeywordRulesView`'s `SectionHeader` call omits `action` entirely** - its only header-adjacent button ("Add Rule") already lives inside its own left-column card, not the page banner, so this is the one adopting view with no header action at all. Confirms `action` behaves correctly as a genuinely optional prop, not one every caller happens to fill.

**Deliberately not done**

- **`SecurityView`'s five card-shaped shells, `TransactionsView`'s filter/search bar, and Dashboard's "Record a Transaction" CTA card (`p-8`, matching none of `Card`'s four padding values) were not converted** - see Correctness notes.
- **`WalletsView`/`WalletAccountsGrid`'s wallet cards and `DebtCardItem`'s debt cards were not converted** - framer-motion animation and conditional per-state styling respectively; see Correctness notes.
- **No `Badge`/`ProgressMeter`/`EmptyState`/`SegmentedControl` primitives were introduced.** Out of scope - Phases 26-27.

---

## Phase 24 — ConfirmDialog: T42 (2026-09-19, commit `c06e444`)

**Changed**

- New `src/components/ui/ConfirmDialog.tsx` — wraps `Modal.tsx`. Props: `isOpen`, `title`, `description`, `confirmText` (default `"Delete"`), `cancelText` (default `"Cancel"`), `onConfirm`, `onClose`, `isDestructive` (default `true`), `isLoading`. Renders a warning-icon body and a footer with `#cancel-confirm-btn` and `#confirm-destructive-btn`; both disable while `isLoading`, and the confirm button's label swaps to "Working…".
- `src/views/WalletsView.tsx` — the delete-wallet button's `onClick` changed from an immediate `deleteWallet(wallet.id)` call (no confirmation at all - a real bug) to `setWalletToDelete(wallet)`; a new `<ConfirmDialog>` at the bottom calls `deleteWallet` on confirm.
- `src/components/WalletPopupModal.tsx` — the per-card delete button's `window.confirm(...)` replaced by the same `walletToDelete`/`ConfirmDialog` pattern.
- `src/views/DebtsView.tsx` — `handleDelete` changed from calling `deleteDebt(id)` directly to looking up the `Debt` object and calling `setDebtToDelete`; a new `<ConfirmDialog>` calls `deleteDebt` on confirm. `DebtCardItem.tsx` itself is untouched - it already only calls an `onDelete(id)` prop, so the confirmation gate lives entirely in the container.
- `tests/soft-delete.spec.ts` — both the wallet-delete and debt-delete sub-tests gained one `await page.locator('#confirm-destructive-btn').click();` immediately after the existing delete-button click; every existing assertion (grid disappearance, reload persistence) is unchanged.
- 5 files changed (1 new), net +185/-8 lines.

**Why**

`docs/audit/ui-ux-audit-report.md` and this phase's own brief: wallet deletion in `WalletsView` had zero confirmation of any kind (click Trash2, wallet is gone), `WalletPopupModal` used a native, unstyled `window.confirm`, and debt deletion in `DebtsView` was likewise unconfirmed. All three are irreversible-looking, one-click actions on user data. `ConfirmDialog` gives all three one accessible, consistently-styled gate, built on the same `Modal.tsx` primitive every other dialog in the app already uses.

**Verification**

```
npm run lint                                                                                  # tsc --noEmit: clean, 0 errors
npx playwright test tests/wallets.spec.ts tests/soft-delete.spec.ts tests/debts.spec.ts --project=chromium   # 5/5 passed
npm run build                                                                                 # built in 8.86s
CI=true npx playwright test                                                                   # 87/87 passed, 0 retries
```

**Correctness notes**

- **The phase brief pointed the spec edit at `tests/wallets.spec.ts`; the actual delete-wallet and delete-debt assertions live in `tests/soft-delete.spec.ts`.** `wallets.spec.ts` has exactly one test (wallet creation) and never clicks a delete button; `grep -rn "delete-wallet-\|delete-debt-" tests/` resolves only inside `soft-delete.spec.ts`. Edited the file that actually contains the assertions rather than the one named, and still ran `wallets.spec.ts` per the verification step (it passes unmodified, as expected - nothing about it changed).
- **`ConfirmDialog`'s footer buttons deliberately don't reuse `PRIMARY_BUTTON_CLASS`/`SECONDARY_BUTTON_CLASS`.** Both are `w-full`, sized for one button filling a form's own width; a side-by-side Cancel/Confirm pair is a different layout shape, so forcing them through the shared classes would either wrap badly or require fighting `w-full` with overrides. Local classes instead - the same exception `WalletPopupModal`'s pre-existing inline Save/Cancel balance-editor buttons already established, per `CLAUDE.md`'s Form styles convention (only reuse a shared class where the shape actually matches).
- **`WalletPopupModal` now stacks two `fixed inset-0` modals when deleting a wallet from inside it** - its own popup `Modal` plus `ConfirmDialog`'s. This is intentional, not an oversight: `Modal.tsx` doesn't vary z-index per instance, so the confirm dialog's later DOM position naturally paints (and backdrop-dims) on top, giving a standard modal-on-modal stack with no extra styling needed.
- **Both `WalletsView` and `WalletPopupModal` store the pending delete target as the full `Wallet` object, not an id**, so `ConfirmDialog`'s description can name the wallet directly from the click that opened it, with no second lookup.

**Deliberately not done**

- **No confirmation on transaction soft-delete.** It's reversible via `restoreTransaction`; per this phase's explicit guardrail and `implementation-roadmap.md`'s "Deliberately not changed" #6, a confirm there would be friction, not safety.
- **No error-recovery UI for a failed delete.** `deleteWallet`/`deleteDebt` both return `Promise<void>` today (no `MutationResult`, no surfaced error) - there is no existing error-handling path to plug an error banner into, and building one is outside this task's stated scope of adding a confirmation dialog.
- **No `SectionHeader`/`Card`/`Badge`/`ProgressMeter`/`EmptyState`/`SegmentedControl` primitives were introduced.** Out of scope - Phases 25-27.

---

## Phase 23 — wallet surface ownership: T39, T40, T41 (2026-09-19, commit `1f91b97`)

**Changed**

- `src/components/WalletPopupModal.tsx` — `WalletModalTab` narrowed from `'OVERVIEW' | 'TRANSFER' | 'ADD_WALLET' | 'TRANSACTIONS'` to `'OVERVIEW' | 'TRANSACTIONS'`; the TRANSFER and ADD_WALLET tab bodies (`WalletTransferForm`/`AddWalletForm` mounts, `transferSourceId`/`transferStatus` state, `useTransientFlash` import) deleted outright. The 4 hardcoded tab header `<button>`s collapsed into one `TAB_DEFS.map(...)`. The per-wallet-card "Transfer" link and the selected-wallet summary banner's "Transfer" button now call a new required `onOpenTransfer(walletId)` prop instead of `setActiveTab('TRANSFER')`. The TRANSACTIONS tab's `walletTransactions` memo changed from `.slice(0, 15)` to `.slice(0, 5)`, and gained a `#wallet-modal-view-all-tx-btn` calling a new optional `onViewAllTransactions(walletId)` prop.
- New `src/components/wallet/TransferFundsModal.tsx` and `src/components/wallet/AddWalletModal.tsx` — self-subscribing shell-level modals (the same pattern `QuickAddModal` already established: they call `useWallets()`/`useFinanceActions()` themselves, so nothing above view level gains a finance-context subscription). `TransferFundsModal` wraps `WalletTransferForm` with the canonical ids `WalletsView` already used (`#transfer-source-wallet`, `#transfer-dest-wallet`, `#transfer-amount-math`, `#transfer-note`, `#execute-transfer-btn`) and reproduces the retired TRANSFER tab's `useTransientFlash`-driven "Transfer completed successfully!" banner before closing. `AddWalletModal` wraps `AddWalletForm` with `WalletsView`'s canonical ids (`#new-wallet-name`, `#new-wallet-type`, `#new-wallet-currency`, `#new-wallet-init-balance`, `#save-new-wallet-btn`).
- `src/App.tsx` — new state (`isTransferModalOpen`, `transferSourceWalletId`, `isAddWalletModalOpen`, `transactionsWalletFilter`) and handlers (`handleOpenTransfer`, `handleCloseTransfer`, `handleOpenAddWallet`, `handleCloseAddWallet`, `handleOpenWalletTransactions`, `handleConsumeTransactionsWalletFilter`), mirroring the existing `isQuickAddOpen`/`handleOpenQuickAdd` pattern. `<TransferFundsModal>`/`<AddWalletModal>` mounted once alongside `<QuickAddModal>`. `onOpenTransfer`/`onOpenAddWallet`/`onOpenWalletTransactions` threaded to both `<DashboardView>` mounts; `onOpenTransfer`/`onOpenAddWallet` threaded to `<WalletsView>`; `initialWalletFilter`/`onConsumeInitialWalletFilter` threaded to `<TransactionsView>`.
- `src/views/WalletsView.tsx` — `isAddWalletOpen`/`isTransferOpen` local state and both inline `<Modal>` blocks deleted entirely; the `#wallet-transfer-modal-btn`/`#wallet-add-modal-btn` header buttons now call new `onOpenTransfer`/`onOpenAddWallet` props. `AddWalletForm`/`WalletTransferForm`/`Modal` imports removed (no longer rendered locally).
- `src/views/DashboardView.tsx` — `handleOpenTransfer`/`handleOpenAddWallet` (which used to call `openWalletModal('TRANSFER'|'ADD_WALLET')`) replaced by `handleHeroOpenTransfer`/`handleHeroOpenAddWallet`, which call the new `onOpenTransfer`/`onOpenAddWallet` props instead. New `handleWalletCardOpen`/`handleGridOpenTransfer`/`handlePopupOpenTransfer`/`handlePopupViewAllTransactions` wire `WalletAccountsGrid`'s two callbacks and `WalletPopupModal`'s new `onOpenTransfer`/`onViewAllTransactions` props, closing the popup first so two full-screen modals never stack.
- `src/components/dashboard/WalletAccountsGrid.tsx` — `onOpenWalletModal: (tab, walletId?) => void` (a 3-way tab union) split into two single-purpose props: `onOpenWallet(walletId)` (card click → popup Overview) and `onOpenTransfer(walletId)` (per-card "Transfer" quick action → the shared modal).
- `src/views/TransactionsView.tsx` — new optional `initialWalletFilter`/`onConsumeInitialWalletFilter` props; `selectedWalletId`'s `useState` initializer seeds from `initialWalletFilter` when given, and a mount-only `useEffect` calls `onConsumeInitialWalletFilter` once to clear the caller's copy.
- `tests/wallet-forms.spec.ts` — the two `#hero-*` modal tests' locators moved from the retired popup ids (`#modal-transfer-source`, `#modal-transfer-dest`, `#modal-transfer-amount-input`, `#modal-submit-transfer-btn`, `#modal-new-wallet-name`, `#modal-new-wallet-balance`, `#modal-create-wallet-submit`) to the canonical `WalletsView` ids the shared modal now always renders (`#transfer-source-wallet`, `#transfer-dest-wallet`, `#transfer-amount-math`, `#execute-transfer-btn`, `#new-wallet-name`, `#new-wallet-init-balance`, `#save-new-wallet-btn`); every outcome assertion (`/Transfer completed successfully/i`, `/Wallet name is required/i`, the seeded-wallets regression guard) is unchanged.
- 9 files changed (2 new), net +377/-225 lines.

**Why**

`docs/audit/ui-ux-audit-report.md` finding A (duplicate entry points) and the Phase 23 entry in `implementation-roadmap.md`: `WalletPopupModal` re-implemented three surfaces `WalletsView` already owned (Transfer, Add Wallet, and a degraded copy of `TransactionsView`'s activity list), and the dashboard hero/wallet-card triggers and `WalletsView`'s own header buttons opened two independent instances of the same two forms. Collapsing the popup's tabs and giving both entry points one shared modal removes the duplication without losing dashboard reachability - the constraint `implementation-roadmap.md` already flagged as the reason `WalletPopupModal` itself couldn't simply be promoted to shell level.

**Verification**

```
npm run lint                                                                                          # tsc --noEmit: clean, 0 errors
npx playwright test tests/wallet-forms.spec.ts tests/wallets.spec.ts tests/date-boundary.spec.ts --project=chromium   # 7/7 passed
npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/soft-delete.spec.ts --project=chromium        # 8/8 passed (regression re-check)
npm run build                                                                                         # built in 24.62s
CI=true npx playwright test                                                                           # 87/87 passed, 0 retries
```

**Correctness notes**

- **The phase brief's "keep OVERVIEW + ADJUST only" does not describe a tab that ever existed.** Balance adjustment has always been an inline per-card editor inside OVERVIEW (`isAdjustingBalance` state, no tab of its own); it was left exactly as-is. Taken fully literally the phrase would also drop TRANSACTIONS, but the brief's own next task (T40) immediately modifies "the TRANSACTIONS tab" - so the only internally-consistent reading keeps it. Only TRANSFER and ADD_WALLET were actually retired.
- **T41's shell-level singleton (rather than a `WalletPopupModal`-style per-view duplicate) was a deliberate design choice, verified against a concrete constraint rather than assumed.** `implementation-roadmap.md` rejects promoting `WalletPopupModal` above view level specifically because it is only reachable via a wallet card, and cards already live inside whichever view renders them - "both views mount their own instance." Transfer/Add-Wallet triggers have that same shape, but `wallet-forms.spec.ts`'s existing test clicks `#hero-transfer-funds-btn` once and immediately expects the transfer fields visible, with no intervening navigation - which only a modal that already exists and is reachable the instant the Dashboard button is clicked can satisfy. A per-view duplicate (mirroring `WalletPopupModal`'s approach) cannot: only one view is mounted at a time. `TransferFundsModal`/`AddWalletModal` instead follow `QuickAddModal`'s existing precedent exactly - a small, self-subscribing component mounted once in `App.tsx`, with `App.tsx` itself owning only UI state (`isOpen`, an optional preselected wallet id), never finance data.
- **The "Transfer completed successfully!" flash was not part of the original `TransferFundsModal` design and was added only after the targeted spec run caught its absence.** The first version called `onTransferred={onClose}` directly, matching `WalletsView`'s own retired local modal (which never showed that text). `wallet-forms.spec.ts:59` failed because the text was always the *popup's* TRANSFER-tab behavior (a `useTransientFlash`-driven banner), never `WalletsView`'s - and per this phase's own instructions, that outcome assertion had to survive unchanged. Fixed by porting the popup's exact `useTransientFlash`+`errorPlacement="top"`+1000ms-delayed-close pattern into `TransferFundsModal`, which makes it `WalletsView`'s behavior too now (previously instant-close) - an accepted, intentional side effect of unifying onto one shared instance.
- **`tests/date-boundary.spec.ts` required no edits**, though the roadmap listed it as an expected break. Both its tests assert on `#wallet-entity-wal-main-checking` and `#time-filter-week` - ids Phase 19 had already hardened onto `WalletsView`/`DashboardView` themselves, not anything `WalletPopupModal` ever rendered. Confirmed via a clean run rather than assumed from the roadmap's line references, which predate that earlier hardening pass.
- **T40's handoff uses a plain `useState` initializer plus a one-time consume effect, not `WalletPopupModal`'s "never unmounts" resync pattern**, because the two components have different lifecycles: `App.tsx` keys the active view by `activeTab` inside `AnimatePresence`, so `TransactionsView` fully unmounts and remounts on every tab switch, while `WalletPopupModal`'s parent renders it unconditionally (documented `CLAUDE.md` gotcha) and needs an `isOpen`-effect resync instead. The simpler pattern is correct specifically because `TransactionsView` never has to handle being re-opened without remounting.

**Deliberately not done**

- **No `ConfirmDialog` for wallet or debt delete** (`WalletPopupModal`'s `window.confirm`, `WalletsView`'s unconfirmed delete button) - Phase 24's explicit scope (T42), not this one's.
- **`WalletsView`'s wallet cards still don't open `WalletPopupModal`.** They never did before this phase (display-only, with an inline delete button); T39-T41 didn't ask for that and it wasn't added.
- **The TRANSACTIONS preview shows no "showing 5 of N" count.** Not specified by T40; the "View all" button already communicates that more may exist.
- **No `SectionHeader`/`Card`/`Badge`/`ProgressMeter` primitives were introduced.** Out of scope - Phases 25-26.

---

## Phase 22 — one transaction entry engine: T36, T37, T38 (2026-09-19, commit `6885930`)

**Changed**

- `src/components/TransactionForm.tsx` — new optional props `idPrefix`, `presetType`, `lockType`, `presetDebtId`, `presetWalletId`. When `lockType` is true, the header row and type-segmented-toggle are hidden entirely, and the smart-description matcher (`handleDescriptionChange`) returns early instead of auto-switching `type`/`categoryId`. When `presetDebtId` is set, the "Debt Target" selector is hidden (the grid collapses to a single column) and `debtId` state initializes to it. `idPrefix`, when provided, overrides exactly 3 field ids - `${idPrefix}-amount-math`, `${idPrefix}-wallet-select`, `confirm-${idPrefix}-btn` - matching `DebtsView`'s pre-existing hand-rolled ids; every other field keeps its default `useId()`-derived id regardless of `idPrefix`.
- `src/views/DashboardView.tsx` — the always-visible inline `TransactionForm` (and its `handleTransactionSubmit`/`addTransaction` plumbing) removed; replaced with a `#dash-open-add-modal-btn` button in a compact CTA card, calling a new `onOpenQuickAdd` prop.
- `src/App.tsx` — `onOpenQuickAdd={handleOpenQuickAdd}` threaded to both `<DashboardView>` mounts (the `dashboard` case and the `default` fallback in `renderActiveView`), alongside the existing `onNavigate`.
- `src/views/DebtsView.tsx` — the hand-rolled repay `<form>` (wallet select, `InlineMathInput`, note field, submit button, ~75 lines) replaced by `<TransactionForm idPrefix="repay" presetType="DEBT_REPAYMENT" lockType presetDebtId={repayDebtTarget.id} categories={categories.filter(c => !c.isDeleted)} onSubmitTransaction={handleRepaySubmit} />`, where `handleRepaySubmit` calls `addTransaction` directly. `useDebts().repayDebt` no longer imported; `categories` now read via a direct `useFinanceState()` call (the view already indirectly subscribed to finance state through `useDebts()`). Dropped `InlineMathInput`/`ArrowRight`/`ShieldAlert`/`selectClass`/`formatCurrencyAmount` imports that only served the removed form.
- `tests/transaction.spec.ts` — the two Dashboard-form tests' locators changed from `page.locator('[data-testid="tx-form-dashboard"]')` to a `#dash-open-add-modal-btn` click followed by `getByRole('dialog', {name: /Quick Record Transaction/i})`; every assertion inside (`^Income$` toggle, amount fill, description fill, submit, `Calculated:` badge) is unchanged, only the locator that reaches it moved.
- 5 files changed, net -19 lines (a net removal despite `TransactionForm` growing, since two hand-rolled forms - Dashboard's and DebtsView's repay - shrank to a button and a 9-prop component call respectively).

**Why**

`docs/audit/ui-ux-audit-report.md` finding A catalogued 5 independent add-transaction surfaces, with the roadmap's Phase 22 (`implementation-roadmap.md`) targeting two for retirement: the Dashboard's always-visible inline form (a permanent duplicate of the Quick Add modal already reachable from the navbar) and DebtsView's hand-rolled repay form (which already re-implemented `TransactionForm`'s existing `DEBT_REPAYMENT` type support field-for-field). Both retirements needed `TransactionForm` to support a caller that wants one fixed type with no user-facing toggle - the prerequisite T36 ships first.

**Verification**

```
npm run lint                                                                              # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts --project=chromium                          # 4/4 passed
npx playwright test tests/debts.spec.ts --project=chromium                                # 1/1 passed
npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/soft-delete.spec.ts --project=chromium   # 8/8 passed
npm run build                                                                             # built in 7.51s
CI=true npx playwright test                                                               # 87/87 passed, 0 retries
```

**Correctness notes**

- **T38's routing decision rests on reading `FinanceContext.tsx:1597-1618` (`repayDebtAtomic`) in full before writing any DebtsView code.** `repayDebtAtomic(debtId, walletId, amount, note)` does nothing more than resolve the debt-repayment category and call `addTransaction({..., type: 'DEBT_REPAYMENT', debtId, categoryId})`. The debt's `remainingAmount` decrement and auto-settle-at-zero logic live inside `addTransaction` itself (`:1137-1148` local path, `:1271-1274` Supabase path), gated only on `data.type === 'DEBT_REPAYMENT' && data.debtId` - **not** on which function called it. `TransactionForm`'s existing `handleSubmit` already supplies an equivalent `debtId` and category match (`:197,207`), so routing DebtsView's repay through a direct `addTransaction` call carries zero functional loss versus the old `useDebts().repayDebt` → `repayDebtAtomic` path. `debts.spec.ts`'s full partial-repayment-then-auto-settle lifecycle passing unmodified is the empirical confirmation.
- **The `idPrefix` id scheme could not be one uniform template.** `#confirm-repay-btn` puts "confirm" before the prefix; `#repay-amount-math`/`#repay-wallet-select` put it after, with suffixes (`amount-math`, `wallet-select`) that don't match `TransactionForm`'s own default suffixes (`math-input`, `wallet`) either. Each of the three ids is computed with its own ternary rather than forcing a "clean" but incorrect shared helper.
- **`repayDebt`/`repayDebtAtomic` have no remaining callers** (`grep -rn "repayDebt" src/` after this change resolves only to their own definitions in `useDebts.ts`/`FinanceContext.tsx`) but were deliberately not deleted - see Deliberately not done.

**Deliberately not done**

- **`repayDebt` (in `useDebts.ts`) and `repayDebtAtomic` (in `FinanceContext.tsx`) were not deleted**, despite becoming unused by this change. Removing them is dead-code cleanup outside this task's stated scope and would touch `FinanceContext.tsx`, whose blast radius this already-high-risk phase deliberately avoided expanding further. Candidate for a future dead-code task.
- **No `presetAmount` prop was added to `TransactionForm`.** The old hand-rolled repay form pre-filled the amount with the debt's minimum payment (`handleOpenRepay` seeded `repayRaw` from `debt.minimumPayment`); the new one starts empty. This is a real, user-visible regression, accepted because restoring it wasn't in T36's listed prop set - `debts.spec.ts` fills the amount explicitly either way, so no test depends on the old default.
- **`WalletPopupModal`'s "Adjust Balance" editor, the Navbar quick-add modal, and the TransactionsView add-modal were left untouched** - they are the surfaces the roadmap's Phase 22 entry explicitly keeps (Adjust Balance is a one-field wallet reconciliation, not a duplicate; the other two are this consolidation's two *surviving* entry points, not targets for removal).

---

## Phase 21 — transaction type tokens: T35 (2026-09-19, commit `b958750`)

**Changed**

- New `src/components/transaction/txTypeMeta.ts` — `TX_TYPE_META: Record<TransactionType, TxTypeMeta>` with `label`, `icon` (full badge icon, `TransactionTableRow`'s existing 4-way vocabulary), `compactIcon` (`TrendingUp`/`TrendingDown`, `WalletPopupModal`'s existing binary vocabulary), `tint` (badge bg+text classes, light+dark), and `sign` (`+` for INCOME, the new `MINUS` constant for everything else). `ADJUSTMENT` mirrors `EXPENSE`'s values, matching its existing fallback appearance everywhere it isn't explicitly branched on today.
- `src/utils/currency.ts` — new `MINUS` constant (U+2212) and `CURRENCY_DISPLAY_OPTIONS` (the `toLocaleString` options object `formatCurrencyAmount` and `AnimatedCounter` both need); `formatCurrencyAmount` itself refactored to use the new constant (identical output).
- `src/components/AnimatedCounter.tsx` — imports `CURRENCY_DISPLAY_OPTIONS` instead of re-typing the same options object inline (closes the "soft drift" finding J flagged: a future precision change could previously desync the hero counters from `formatCurrencyAmount`).
- `src/components/TransactionTableRow.tsx` — full adoption: the 4-way icon ternary and 4-way badge-tint ternary both replaced by `TX_TYPE_META[tx.type]`; amount sign (`isIncome ? '+' : '-'`) replaced by `meta.sign`; the desktop "Debt Repayment" category-cell label replaced by `TX_TYPE_META.DEBT_REPAYMENT.label` (identical string).
- `src/components/WalletPopupModal.tsx` — activity-tab icon ternary (`TrendingUp`/`TrendingDown`) replaced by `TX_TYPE_META[tx.type].compactIcon`; amount sign replaced by `TX_TYPE_META[tx.type].sign`. Badge background classes left as local logic (see Correctness notes).
- `src/components/dashboard/RecentTransactionsTable.tsx` — the EXPENSE amount sign's hardcoded `'−'` literal replaced by the imported `MINUS` constant (already U+2212, so this is a pure single-sourcing, zero visual change). Its Type-column icon/label vocabulary and its sign-suppression for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT are untouched (see Correctness notes).
- 6 files changed (1 new), net +70/-43 lines.

**Why**

`docs/audit/ui-ux-audit-report.md` finding D: four independent transaction-row renderers each re-implement the type→icon/color mapping, the single most duplicated fragment the audit found. Finding J additionally flagged `AnimatedCounter`'s currency-format options as a silent duplicate of `formatCurrencyAmount`'s, and the minus glyph as inconsistent (U+2212 in some renderers, ASCII `-` in others). Centralizing the mapping - and, per this task's explicit second goal, standardizing the glyph - is the prerequisite Phase 22 (transaction entry consolidation) and Phase 28 (shared row cells) both build on, per `implementation-roadmap.md`.

**Verification**

```
npm run lint                                                                          # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts --project=chromium   # 7/7 passed
npm run build                                                                         # built in 6.99s
CI=true npx playwright test                                                           # 87/87 passed, 0 retries
```

**Correctness notes**

- **Adoption is deliberately non-uniform across the three named files, discovered by reading all three before editing any of them.** Their type→icon/color schemes have already diverged, not just duplicated: `RecentTransactionsTable`'s Type column uses `ArrowLeftRight`/`TrendingDown` for TRANSFER/DEBT_REPAYMENT (the canonical/`TransactionTableRow` vocabulary is `RefreshCw`/`Landmark`), labels `DEBT_REPAYMENT` as "Repayment" rather than "Debt Repayment", and shows no sign at all for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT where the other two renderers show `-`. `WalletPopupModal`'s activity-tab badge background collapses TRANSFER/DEBT_REPAYMENT/ADJUSTMENT into one indigo color, unlike the canonical 4-way `tint`. Forcing full adoption into either file would have changed on-screen output, contradicting this task's explicit "without altering DOM layout or behaviour" goal - so adoption was scoped per-field to only what already matched exactly, and the remaining divergence was left local and is documented here rather than silently smoothed over.
- **The MINUS glyph swap in `TransactionTableRow`/`WalletPopupModal` is an intentional, requested visual change** (this task's own step 2: "standardizing... across display surfaces"), not an inadvertent one. Verified no spec asserts on a sign glyph before making the change.
- **`ADJUSTMENT` got a token entry despite the task naming only 4 of `TransactionType`'s 5 members**, so `Record<TransactionType, TxTypeMeta>` type-checks with a compile-time guarantee of full coverage rather than a runtime `undefined` risk; its values mirror `EXPENSE`, its existing fallback appearance everywhere.

**Deliberately not done**

- **`RecentTransactionsTable`'s Type-column icon/label and `WalletPopupModal`'s badge background were not migrated onto the canonical tokens** - see Correctness notes. Matches the roadmap's Phase 28 stance that each of the app's transaction renderers keeps its own layout; shared *cells*, not a forced shared *scheme*, is the later plan.
- **`CashflowMetricsCards.tsx` and `DiaryEntryCard.tsx`'s own sign-glyph inconsistency (also in finding J) were left untouched** - outside this task's named file list. `MINUS` is exported and ready for whichever future task picks them up.
- **No shared row/cell component was extracted.** That is Phase 28's (T49) explicit scope, which consumes these tokens once Phases 22-27 have run.

---

## Phase 20 — Navbar de-subscription: T34 (2026-09-19, commit `e3fe540`)

**Changed**

- New `src/components/navbar/NavbarLedgerStatus.tsx` — exports `NavbarSyncBadge` (the condensed cloud-sync/local-only badge, reading `isAuthenticated`/`isSyncing`) and `NavbarBalanceAndAuth` (the live net-worth `AnimatedCounter` block plus the signed-in/sign-in-button cluster, reading `totalNetWorth`/`isAuthenticated`/`currentUser` and the `signOut` action). Both are the only finance-context subscribers left in the Navbar area.
- `src/components/Navbar.tsx` — deleted its `useFinanceState()`/`useFinanceActions()` calls and the `Cloud`/`CloudOff`/`UserCheck`/`LogIn`/`LogOut`/`AnimatedCounter`/`APP_CURRENCY`/`APP_CURRENCY_SYMBOL` imports those reads needed; renders `<NavbarSyncBadge onOpenAuth={onOpenAuth} />` and `<NavbarBalanceAndAuth onOpenAuth={onOpenAuth} />` in the exact DOM positions the inline JSX previously occupied. Wrapped the whole component in `React.memo` with a `displayName`, matching the pattern already used by `MobileBottomNav`.
- `CLAUDE.md`'s **State: context + domain hooks** section — corrected the description of `FinanceStateContext`/`FinanceActionsContext` to reflect the post-T15 architecture: the 6 mutators that touch hot state (`addTransaction`, `softDeleteTransaction`, `restoreTransaction`, `commitBulkImport`, `repayDebtAtomic`, `upsertDiaryEntry`) live in `FinanceActionsContext`, reading that state through a ref mirror rather than a closure, not in `FinanceStateContext` as the previous text said.
- `docs/audit/baseline-metrics.md` — new "Post-T34" subsection under "Re-render counts."
- 3 `src/` files changed (1 new), net +50/-89 lines (the extraction removed more inline JSX-adjacent logic than it added, since the two new components share `Navbar`'s existing imports for `motion`/icons instead of duplicating them).

**Why**

`docs/audit/ui-ux-audit-report.md` finding K, carried over from a live discrepancy first surfaced while writing this audit: `Navbar.tsx:52-53` called both finance-context hooks despite being app-shell chrome `App.tsx` renders unconditionally, directly contradicting `CLAUDE.md:81`'s claim that the shell "call[s] neither." Every financial write re-rendered the navbar as a result — the exact churn `useFinance()`'s deletion (T1/T14) and the state/actions split (T13) were meant to prevent everywhere above view level, with this one component left out. Fixing it as its own phase, ahead of the visual-unification phases 21-28, keeps the re-render-elimination claim measurable on its own rather than blended into a later pixel diff.

**Verification**

```
npm run lint                                                                    # tsc --noEmit: clean, 0 errors
npx playwright test tests/auth.spec.ts tests/theme.spec.ts --project=chromium   # 8/8 passed
npm run build                                                                   # built in 4.93s
CI=true npx playwright test                                                     # 87/87 passed, 0 retries
```

**Correctness notes**

- **The re-render claim was measured, not just argued from the code.** A temporary `window.__navbarFnCalls` counter, incremented once per actual execution of `Navbar`'s function body (so a `React.memo` bail-out correctly reads as zero, since the function is never called), was added to the committed tree (0 during a scripted Quick-Add write), then to the pre-T34 file restored via `git stash push -- src/components/Navbar.tsx` (6 during the same scripted write), then removed from both before committing. `grep -rn "__navbarFnCalls" src/ tests/` against the final tree returns nothing.
- **The pre-T34 figure (6) matches the original Phase-4 `Profiler`-based baseline's `Navbar`/S2 row exactly** (see `baseline-metrics.md`'s S1-S5 table) — a useful cross-check that this lighter, single-component probe measures the same underlying quantity the original multi-component harness did, despite using a different mechanism (a raw call counter vs. React's `Profiler` API) and running long after that harness's throwaway branch was deleted.
- **An earlier full-suite run was discarded as unreliable, not reported as a passing gate.** It was launched in the background before the probe work began; while it was still executing, the `git stash`/`stash pop` sequence swapped `Navbar.tsx` twice, and a process occupying port 3000 was killed to unblock a later run attempt — that process was this same run's own dev server, terminated mid-test. It still finished green only through Playwright's CI retry budget (84 passed, 3 flaky, exit 0), which is not trustworthy given the concurrent interference. The verification above cites only the second, clean run (launched after all stash/probe work and cleanup were finished), which passed 87/87 with 0 retries on the first attempt.

**Deliberately not done**

- **No full S1-S5 × per-component `Profiler` replay.** T34's claim is scoped to one component; reconstructing the original throwaway-branch harness to re-run all five scenarios across a dozen components would answer questions this task didn't ask. A future phase touching multiple components at once (e.g. Phase 28's shared cells) is a better point to justify that cost again.
- **`MobileBottomNav` untouched** — it has no finance-context subscription today (fixed in an earlier phase; `audit-report.md` correction C3) and was never part of this task's scope.
- **The theme toggle and quick-add button stayed in `Navbar.tsx`** rather than moving into `NavbarLedgerStatus.tsx` — neither reads finance state, so moving them would be indirection without a re-render benefit.

---

## Phase 19 — selector hardening + UI unification audit: T31, T32, T33 (2026-09-19, commits `371d938` / `789a310`)

**Changed**

- `src/components/Navbar.tsx` — desktop nav-tab buttons gained `data-testid="nav-tab-${id}"` and `aria-current={isActive ? 'page' : undefined}`, alongside their existing `id` and Tailwind classes.
- `src/components/MobileBottomNav.tsx` — same two attributes added to the mobile nav-tab buttons, for consistency (not currently exercised by the desktop-viewport-only suite, but real a11y value at zero risk).
- `src/components/dashboard/CashflowMetricsCards.tsx` — the three metric cards gained `data-testid="metric-card-income"|"metric-card-expense"|"metric-card-net"`.
- `src/views/KeywordRulesView.tsx` — the four sandbox result rows gained `data-testid="metric-extracted-amount"|"metric-matched-category"|"metric-inferred-type"|"metric-cleaned-description"`.
- `src/components/DiaryEntryCard.tsx` — the notes paragraph gained `data-testid="diary-entry-notes"`.
- `src/components/TransactionForm.tsx` — new optional `formTestId?: string` prop rendered as `data-testid` on the `<form>` element, so a caller can identify its own mount when more than one `TransactionForm` instance can exist in the DOM at once.
- `src/views/DashboardView.tsx`, `src/components/QuickAddModal.tsx`, `src/views/TransactionsView.tsx` — pass `formTestId="tx-form-dashboard"` / `"tx-form-quickadd"` / `"tx-form-page"` respectively to their `TransactionForm` mount.
- `tests/helpers.ts` — `gotoTab`'s active-tab assertion switched from `toHaveClass(/bg-stone-900/)` to `toHaveAttribute('aria-current', 'page')`.
- `tests/date-boundary.spec.ts` — the Total Expense card lookup switched from an xpath ancestor keyed on `rounded-2xl` to `[data-testid="metric-card-expense"]`.
- `tests/keywords.spec.ts` — all 6 sandbox-row lookups switched from `div.flex.justify-between` + label-text filters to their `data-testid`s.
- `tests/diary.spec.ts` — the saved-note assertion switched from a bare `page.locator('p')` to `[data-testid="diary-entry-notes"]`.
- `tests/transaction.spec.ts` — the two Dashboard-form lookups switched from `.first()` on a text-filtered `form` locator to `[data-testid="tx-form-dashboard"]`.
- New `docs/audit/ui-ux-audit-report.md` — findings A-L on duplicate entry points (5 add-transaction paths, 7 transfer triggers), `WalletPopupModal`'s 3-surface duplication of `WalletsView`/`TransactionsView`, 4 fragmented transaction-row renderers, 6 fragmented segmented controls, badge/progress-bar/empty-state/card-shell fragmentation, and 2 spots where `CLAUDE.md` has drifted from the shipped code.
- New `docs/audit/implementation-roadmap.md` — Phases 20-29 (T34-T50) resolving those findings.
- New `docs/audit/test-selector-contract.md` — the freeze-list of ids/testids this and future phases must preserve or deliberately migrate.
- 12 files changed (3 new), net +285/-23 lines across the two commits.

**Why**

The user, acting as design-system lead, asked for a focused audit of redundant user-facing features and a phased streamlining plan, explicitly in plan-mode with no source changes until the plan was approved. Before any restyle or consolidation phase could safely proceed, the Playwright suite's own fragility had to be fixed first: `tests/helpers.ts:26`'s `toHaveClass(/bg-stone-900/)` gates every one of the 87 test runs through `gotoTab`, so a palette or active-state restyle in a later phase (25-27) would fail all of them at once, for a reason unrelated to correctness. Four more specs depended on an xpath keyed to a Tailwind radius class, class-structural row lookups, a bare tag-name locator, and a `.first()` text filter that stays safe only by accident (only one `TransactionForm` is ever mounted today because `Modal.tsx`'s `AnimatePresence` fully unmounts a closed modal) - an accident Phase 22's consolidation would end.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 6.06s
CI=true npx playwright test      # 87/87 passed - once after the additive-only commit (371d938),
                                  # once again after the spec-migration commit (789a310)
```

Also run directly: `npx playwright test tests/date-boundary.spec.ts tests/keywords.spec.ts tests/diary.spec.ts tests/transaction.spec.ts --project=chromium` (9/9 passed) immediately after the spec migration, before spending the ~5 minutes on the full 87.

**Correctness notes**

- **The additive commit was verified in isolation before any spec was touched**, specifically to prove the new attributes/prop introduce zero behavior change on their own - 87/87 passed with the old `bg-stone-900` assertion and the old xpath/class/tag lookups still in place, running entirely against hooks nothing yet read.
- **The `.first()` ambiguity in `transaction.spec.ts` is not a live bug today.** `Modal.tsx:77-78` wraps its content in `{isOpen && (...)}` inside `AnimatePresence`, so a closed `QuickAddModal` contributes zero DOM nodes - only the Dashboard's inline `TransactionForm` ever matches `locator('form').filter({hasText:/Record Transaction/i})` while the suite's Dashboard-form tests run. It was migrated anyway because Phase 22 (T36-T38) is designed to make multiple mounts routine, and the fix was a same-file, assertion-preserving locator swap.
- **`CashflowMetricsCards.tsx` gained `data-testid`s for all three cards, though only `metric-card-expense` is referenced by a spec today** - added for symmetry since the component was already being edited, at zero marginal risk.

**Deliberately not done**

- **No `contexts/` directory was created**, despite the user's original phrasing asking for deliverables "under `/contexts/`". Confirmed with the user via `AskUserQuestion`: `docs/audit/` already owns this append-only trail across 18 prior phases and `CLAUDE.md` points there; a second root directory would fork the trail that `docs/audit/README.md`'s own "What this is, and is not" section protects against. The two new report files instead extend the existing convention.
- **Phases 20-29 (T34-T50) were not started in this phase** — this phase ships only the test-hardening prerequisite (T31-T32) and the audit/roadmap documents (T33), per the plan's phase-19-first ordering: nothing in Phases 20+ should touch a component's visual output before the suite stops depending on that output's implementation details.
- **`MobileBottomNav`'s new attributes are not yet exercised by any spec** — `playwright.config.ts` pins all three projects to desktop viewports (`devices['Desktop Chrome'|'Desktop Firefox'|'Desktop Safari']`), so `gotoTab`'s `#nav-tab-${tabId}` always resolves to `Navbar.tsx`'s desktop nav, never `MobileBottomNav.tsx`'s. Added for consistency and future mobile-viewport test coverage, not because a current test needed it.

---

## Phase 18 — promote verified constraints into CLAUDE.md: T30 (2026-09-19, commit `3c441e8`)

**Changed**

- `CLAUDE.md` — Coding Conventions gained three new bullets: **Form styles** (`src/utils/formStyles.ts`, with the "only where it actually matches that shape" qualifier), **Lookup maps** (`buildLookupMap` from `src/utils/mapUtils.ts`, with the id→item-only qualifier), and **Modals** (the shared `src/components/Modal.tsx` primitive, never a hand-rolled backdrop). A fourth new bullet, **Re-renders**, states the `React.memo`-on-a-context-subscriber trap directly.
- `CLAUDE.md`'s **Dates** section gained a bullet stating the ISO-string-comparison rule explicitly (previously the section only documented the date-construction helpers, not the comparison hazard T21 fixed).
- `CLAUDE.md`'s **State: context + domain hooks** section rewritten: describes the `FinanceStateContext`/`FinanceActionsContext` split and `useFinanceState()`/`useFinanceActions()` (the old text still referenced a single `useFinance()`, which was deleted in Phase 9/T14 and no longer exists in the codebase), states plainly that no component above view level subscribes to finance state (T1), and warns against reintroducing a merged `useFinance()` shim.
- `CLAUDE.md`'s **Testing** section corrected: suite size `13 tests / 5 spec files / 39 runs` -> `29 tests / 12 spec files / 87 runs`; the spec-file list extended from 5 named files to all 12 that exist today.
- `docs/audit/constraints-to-promote.md` — the 7 rows corresponding to T24, T26, T1, T14, T2, T22, and T21 got `Holds in code?` flipped to `Yes` and `Promoted (sha)` filled with this phase's commit.

**Why**

`constraints-to-promote.md`'s own header: "nothing moves into `CLAUDE.md` until the code already complies." T1, T2, T14, T21, T22, T24, and T26 all shipped and passed their gates in earlier phases, so their rules had been sitting in the staging table, true in the codebase but not yet documented where a future session would actually read them. `CLAUDE.md`'s own **Dates** and **State** sections had also drifted out of sync with the shipped code (still describing a `useFinance()` hook that no longer exists), which this pass corrects at the same time as promoting the new rules.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.29s
CI=true npx playwright test      # 87/87 passed (5.2m), 1 worker, 0 retries
```

All three gates are docs-only sanity checks here - no `src/` file changed in this phase - but were run in full per this task's explicit instruction, and because `CLAUDE.md`'s own corrected Testing section is a claim about the suite that's worth re-verifying at the moment it's written, not just trusted from memory.

**Correctness notes**

- **Every promoted claim was re-verified against the current code before being written down, not copied from the ledger.** `grep -r "useFinance\(\)" src/` returned zero matches (the shim is gone); `grep "useFinanceState\|useFinanceActions" App.tsx` returned zero matches (no shell-level subscription survives); `grep -r 'role="dialog"' src/` matched only `Modal.tsx` (no hand-rolled modal survives); `tsconfig.json` has no `paths` entry; and `test(` declarations were counted across all 12 `tests/*.spec.ts` files (29, times 3 browsers = 87) rather than trusting the "87/87" figure from the task's own framing.
- **T24 and T26's promoted rules carry a qualifier the original `constraints-to-promote.md` phrasing lacked.** Both tasks' own refactor-log entries (Phase 16, Phase 17) documented deliberate exceptions - a map keyed by something other than `id`, or valued by a single field instead of the whole item; a field styling that genuinely differs in padding/font/color. A blanket "never re-type" or "never write `new Map(...)`" promoted verbatim would itself have been a rule the code doesn't satisfy - `constraints-to-promote.md`'s own header calls that worse than no rule at all. The promoted `CLAUDE.md` bullets state the rule and its exception category together.
- **T1 and T14 were promoted as one combined rewrite of the State section**, not two separate bullets, since they describe the same underlying architecture (the context split from T13/T14 is what makes "no component above view subscribes" from T1 sustainable - the two facts don't stand independently).

**Deliberately not done**

- **T18, T19, T25 remain deferred** - not part of this task's explicit promotion list, and T18/T25 are themselves still unshipped (`todo` in the task ledger), so promoting their constraints would violate the "code must already comply" rule regardless.
- **T12's "every interactive element carries an `id`" row left unpromoted.** Its evidence (`AuthModal.tsx` had 0 `id=` attributes) was fixed for that one file, but the rule as written is a repo-wide claim this pass did not re-verify against every view - promoting it without that verification would risk exactly the "rule the code doesn't satisfy" failure mode the promotion process exists to prevent.
- **T28's `@/*` alias row left unmarked** (not flipped to `Yes`/stamped with a sha here) even though `CLAUDE.md`'s existing Imports bullet already states it correctly - that bullet predates this audit trail's tracking, so there's no commit in this trail's history to attribute the promotion to, and this task's instructions didn't ask for it.

---

## Phase 17 — shared form styles: T24 (2026-09-19, commit `7f9ef66`)

**Changed**

- New `src/utils/formStyles.ts`, promoted from `wallet/walletFormStyles.ts`: `FieldTone`, `LABEL_TEXT_CLASS` (bare label text), `LABEL_CLASS` (`= LABEL_TEXT_CLASS + ' block mb-1'`), `inputClass(tone)`, `selectClass(tone)`, `OPTION_CLASS`, `ERROR_BANNER_CLASS`, `PRIMARY_BUTTON_CLASS`, `PRIMARY_BUTTON_COMPACT_CLASS` (new - see below), `SECONDARY_BUTTON_CLASS` (new, unadopted).
- `src/components/wallet/walletFormStyles.ts` trimmed to wallet-only domain data (`WALLET_COLOR_PALETTE`, `WALLET_TYPE_OPTIONS`) plus a `FieldTone` re-export; its style primitives now live in `formStyles.ts`.
- `AddWalletForm.tsx`, `WalletTransferForm.tsx`: import path updated to the promoted module (no behavior change - the two files that already used the old module's classes).
- `TransactionForm.tsx`: 5 labels -> `LABEL_TEXT_CLASS`, 4 `<option>` elements -> `OPTION_CLASS`, 1 error banner -> `` `${ERROR_BANNER_CLASS} flex items-center gap-2 mt-2` ``.
- `AuthModal.tsx`: 3 labels -> `LABEL_TEXT_CLASS`.
- `InlineMathInput.tsx`: 1 label -> `LABEL_TEXT_CLASS`.
- `DiaryView.tsx`: 1 label (the `mb-1` one - see Correctness notes) -> `LABEL_CLASS`; save button -> `` `${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2` ``.
- `KeywordRulesView.tsx`: 2 labels -> `LABEL_CLASS`, keyword input -> `inputClass('plain')`, error banner -> `ERROR_BANNER_CLASS`, submit button -> `PRIMARY_BUTTON_COMPACT_CLASS`.
- `DebtsView.tsx`: 8 labels -> `LABEL_CLASS`; 6 inputs -> `inputClass('subtle')` (4 with a `font-mono` suffix); repay-wallet `<select>` -> `selectClass('subtle')` + `OPTION_CLASS`; error banner -> `ERROR_BANNER_CLASS`; Add Debt submit -> `PRIMARY_BUTTON_CLASS`.
- `SecurityView.tsx`: 4 labels -> `LABEL_CLASS`; 3 inputs (profile name, new password, confirm password) -> `inputClass('plain')`; 2 submit buttons -> `` `${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2 disabled:opacity-50` ``.
- `TransactionsView.tsx`: wallet-filter `<option>` elements -> `OPTION_CLASS`.
- `DebtCardItem.tsx`: repay button -> `` `${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2` ``.

12 files changed (1 new): `formStyles.ts` (new) plus the 11 files above - net -24 lines across the 12 modified files despite each gaining an import.

**Why**

`audit-report.md`'s finding: `walletFormStyles.ts` centralized label/input/select/option/error/button classes, but only its own two consumers (`AddWalletForm`, `WalletTransferForm`) used it - the identical Tailwind strings were independently re-typed across `DebtsView`, `KeywordRulesView`, `DiaryView`, `SecurityView`, `TransactionsView`, `TransactionForm`, `AuthModal`, `DebtCardItem`, and `InlineMathInput`. Any future styling change (a new focus-ring color, a border-radius tweak) would have meant hand-editing every one of those call sites and hoping none were missed - the same duplication-risk shape as T26/T27, applied to CSS classes instead of Map construction or submit handlers.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 4.98s; PWA precache 1491.34 -> 1484.29 KiB
CI=true npx playwright test      # 87/87 passed (4.4m), 1 worker, 0 retries
```

**Correctness notes**

- **Every migration was gated on an exact (order-insensitive) token match**, per this task's explicit "do not alter visual styling unexpectedly" guardrail - see `task-ledger.md`'s Phase 17 entry for the full list of near-miss strings that were deliberately left alone (`WalletPopupModal`'s compact inline editors, `TransactionsView`'s `min-h-[44px]` touch-target filter bar, `TransactionForm`/`AuthModal`'s intentionally-larger `text-sm` inputs, `AuthModal`'s differently-colored banners, `KeywordRulesView`'s wider-padded category select, `DiaryView`'s `mb-2` section labels and compact textarea/date-picker, `SecurityView`'s muted disabled-email input and smaller `p-2.5` banners). Where a real per-property difference existed (padding scale, font size, color shade, a present/missing responsive modifier), the element was left untouched rather than forced through the shared constant.
- **Two label shapes, not one - `LABEL_TEXT_CLASS` vs `LABEL_CLASS`.** The original `walletFormStyles.ts` had only the `block mb-1` variant, correct for labels in a bare wrapper `<div>` with no `gap`/`space-y`. `TransactionForm`, `AuthModal`, and `InlineMathInput` instead wrap label+input in a `flex flex-col gap-1.5` / `space-y-1.5` container, where the label itself carries no margin - the wrapper's gap owns the spacing. Promoting only the `block mb-1` variant and applying it everywhere would have added a spurious ~4px under 3 files' label/input gaps. Verified by inspecting each label's parent wrapper before choosing which constant to apply, not by visual diffing.
- **A second real duplicate was found during this pass that the original audit finding didn't name: a "compact" primary button missing `sm:py-3`.** `DebtCardItem`, `DiaryView`, `SecurityView` (x2), and `KeywordRulesView` all independently retyped a string identical to `PRIMARY_BUTTON_CLASS` except for that one responsive token. Promoted as `PRIMARY_BUTTON_COMPACT_CLASS` rather than silently forcing all 5 onto `PRIMARY_BUTTON_CLASS` (which would have added padding growth at the `sm:` breakpoint none of the 5 previously had).
- **`SECONDARY_BUTTON_CLASS` was defined but has zero adopters.** No in-scope file has a genuine full-width secondary/cancel form action - the visually similar `bg-stone-100` buttons elsewhere in the app are compact toolbar/icon buttons, a different UI role entirely. Exported anyway per the task's explicit "Primary & Secondary" ask, same precedent as `Modal.tsx`'s unused `footer` slot from T22 (Phase 15).
- **DiaryView had 3 labels sharing the same base text, only 1 of which was an exact `LABEL_CLASS` match.** Its two `1. Daily Mood Rating` / `3. Physical Activity` section labels use `block mb-2` (larger spacing, since they precede a button grid rather than a single input) - a real, different value from `LABEL_CLASS`'s `mb-1`, not a duplicate of it. Only the "4. Daily Reflection Notes" label (genuinely `mb-1`) was migrated.

**Deliberately not done**

- **`WalletPopupModal.tsx` audited and left untouched** - its inline balance-adjustment editor and activity-tab wallet select use a distinct, more compact style family (`text-[10px]` micro-labels, `rounded-lg`, different padding) with no exact matches to the shared module.
- **T25 (unify the 4 transaction-row renderers) remains deferred**, exactly as recorded in `task-ledger.md` before this phase.
- **Commit hash (`7f9ef66`) filled in by this follow-up commit**, per this repo's established two-commit pattern (see Phase 14-16's git history).

---

## Phase 16 — shared map/form hooks: T26, T27 (2026-09-19, commit `b72b8e9`)

**Changed**

- New `src/utils/mapUtils.ts`: `buildLookupMap<T extends { id: string }>(items: T[]): Map<string, T>` — a one-line generic replacing `new Map(items.map(x => [x.id, x]))`. Adopted at 9 call sites across 5 files: `DashboardView.tsx` (`catMap`, `walletMap`, `categoryMap`), `DiaryView.tsx` (`categoryMap`, `walletMap`), `smartMatcher.ts` (`categoryMap`), `KeywordRulesView.tsx` (`categoryMap`), `TransactionsView.tsx` (`walletMap`, `categoryMap`).
- New `src/hooks/useSubmitHandler.ts`: owns `isSubmitting`/`error` state and one `handleSubmit(e, submit)` that calls `e.preventDefault()`, guards re-entrant submits, clears the error, awaits `submit()`, surfaces a `{success:false}` `MutationResult`'s `error` (or `defaultErrorMessage`) or a thrown error's `.message`, and calls `onSuccess()` otherwise. Adopted by 9 handlers across 7 files: `AddWalletForm.handleCreateWallet`, `WalletTransferForm.handleExecuteTransfer`, `TransactionForm.handleSubmit`, `DiaryView.handleSaveEntry`, `KeywordRulesView.handleAddRule`, `DebtsView.handleCreateDebt` + `handleExecuteRepay`, `SecurityView.handleUpdateProfile` + `handleUpdatePassword`.
- New `src/hooks/useIdempotencyKey.ts`: `{ idempotencyKey, rotateIdempotencyKey }`, one `crypto.randomUUID()` armed per form. Adopted by `WalletTransferForm` (`transferKey`) and `TransactionForm` (`submitKey`), both wired so `rotateIdempotencyKey()` is called only from a `useSubmitHandler` `onSuccess` callback - a failed submit leaves the key untouched, matching the pre-refactor reuse-on-failure/rotate-on-success behavior exactly.
- New `src/hooks/useTransientFlash.ts`: `{ value, flash, clear }` - a value that self-clears after `durationMs`, with `flash`'s optional third argument running a callback when the timer fires (for the two callers that pair the clear with a side effect). Adopted at 7 sites across 5 files: `DiaryView` (`saveSuccess`), `SecurityView` (`syncFeedback`, `profileSuccess`, `passwordSuccess`), `TransactionForm` (`isSubmitted`), `TransactionsView` (`importSuccessMsg`, paired with closing the import modal), `WalletPopupModal` (`transferStatus`, paired with switching back to the `OVERVIEW` tab).

11 files changed (4 new): `mapUtils.ts`, `useSubmitHandler.ts`, `useIdempotencyKey.ts`, `useTransientFlash.ts` (all new) plus `TransactionForm.tsx`, `WalletPopupModal.tsx`, `AddWalletForm.tsx`, `WalletTransferForm.tsx`, `smartMatcher.ts`, `DashboardView.tsx`, `DebtsView.tsx`, `DiaryView.tsx`, `KeywordRulesView.tsx`, `SecurityView.tsx`, `TransactionsView.tsx` — net -46 lines across the 11 modified files despite each gaining 1-3 new imports.

**Why**

`audit-report.md`'s duplication findings behind the deferred T26/T27 rows: the same `new Map(items.map(x => [x.id, x]))` shape independently written 9 times, the same submit -> validate -> mutate -> error-or-reset shape independently written 9 times (2 of them additionally hand-rolling the idempotency-key arm/reuse/rotate lifecycle CLAUDE.md requires), and the same `setX(value); setTimeout(() => setX(cleared), N)` transient-banner shape independently written 7 times. None of these were behavior bugs - `audit-report.md` flagged them as duplication risk: any future change to, say, the idempotency-key rotation rule would have meant remembering to edit both `WalletTransferForm` and `TransactionForm` by hand, with no shared seam to change once.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.23s; PWA precache unchanged in entry count
CI=true npx playwright test      # 87/87 passed (4.4m), 1 worker, 0 retries
```

Ran once as a full suite after all 11 files were migrated, rather than per-file batches - unlike T22 (Phase 15), these changes are behavior-preserving refactors of already-isolated per-form state (no shared component tree being restructured), and `wallet-forms.spec.ts`, `transaction.spec.ts`, `debts.spec.ts`, `keywords.spec.ts`, `diary.spec.ts`, and `csv.spec.ts` between them exercise every migrated submit handler and every migrated flash banner at least once.

**Correctness notes**

- **Idempotency-key rotation was the highest-risk piece and was verified explicitly, not just by inspection.** Both `useIdempotencyKey` adoptions (`WalletTransferForm`, `TransactionForm`) call `rotateIdempotencyKey()` exclusively from inside a `useSubmitHandler` `onSuccess` callback, which only runs after `submit()` resolves without a `{success:false}` result or a thrown error - so a rejected transfer or transaction keeps its armed key for the retry, exactly matching CLAUDE.md's "reuse on failure, rotate only on success" rule. `wallet-forms.spec.ts`'s transfer tests and `transaction.spec.ts`'s submit tests both exercise the success path end-to-end; no existing spec forces a failed-then-retried submit for either form, so the failure-path key-reuse itself is verified by code inspection of the callback wiring (the key literally cannot be read by `rotateIdempotencyKey` unless `onSuccess` runs), not by a dedicated retry test - consistent with the pre-existing test coverage for this behavior, which was the same before this refactor.
- **`buildLookupMap` is a pure structural substitution.** `new Map(items.map(x => [x.id, x]))` and `buildLookupMap(items)` produce an identical `Map` for the same input array - same key type, same value type, same insertion order - so every consumer of the 9 replaced maps (`.get(id)` lookups in JSX, `useMemo` dependents) needed no further change.
- **Two `useTransientFlash` adoptions needed the hook's `onClear` callback, not just `flash`/`clear`.** `TransactionsView.handleCommitImport` and `WalletPopupModal`'s transfer-success handler each pair the message's self-clear with an unrelated side effect (closing the CSV import modal; switching the popup's active tab). Both now pass that side effect as `flash`'s third argument rather than duplicating a `setTimeout` alongside the hook.

**Deliberately not done**

- **No `disabled={isSubmitting}` wiring added to buttons that didn't already have it.** `AddWalletForm`, `DiaryView`'s save button, and `KeywordRulesView`'s add-rule button gained the hook's re-entrancy guard (submits are ignored while one is in flight) but their buttons were not additionally given a `disabled` prop or loading label - out of scope for a boilerplate-elimination pass, and changing visible button state on 3 more forms wasn't asked for.
- **T24 (`walletFormStyles.ts` promotion) and T25 (transaction-row renderer unification) remain deferred**, exactly as recorded in `task-ledger.md` before this phase - this pass touched only the T26/T27 scope.
- **Commit hash (`b72b8e9`) filled in by this follow-up commit**, per this repo's established two-commit pattern for phase completion (see Phase 14/15's git history).

---

## Phase 15 — unified `<Modal>` primitive: T22 (2026-09-19, commit `52f4f8a`)

**Changed**

- New `src/components/Modal.tsx`: the shared modal shell. Props: `isOpen`/`onClose` (required); `title`/`subtitle` for the standard header (title text + optional subtitle + close button); `header` as a full override slot for custom chrome (skips the standard header entirely when given); `footer` as a thin optional trailing slot; `maxWidthClassName`, `panelClassName`, `bodyClassName` for per-caller layout; `panelId`/`titleId`/`closeButtonId` so existing test-targeted DOM ids pass straight through; `showCloseButton`/`showMobileHandle`/`closeOnBackdropClick` as opt-outs, all defaulting to the behavior every existing modal already had. Internally: one `AnimatePresence` + backdrop `motion.div` (opacity fade, click-outside-to-close) wrapping one panel `motion.div` (`flex flex-col`, spring y/scale/opacity transition, `role="dialog"` `aria-modal="true"` `aria-labelledby`), a mobile drag-handle bar, the header slot, a `flex-1 overflow-y-auto` body wrapping `children`, and the optional footer. A `document`-level `keydown` listener closes on Escape while `isOpen`.
- `src/components/QuickAddModal.tsx`: its hand-rolled backdrop/panel (~55 lines) replaced by `<Modal title="Quick Record Transaction" subtitle="..." titleId="quick-record-modal-title" closeButtonId="close-quick-record-modal-btn" maxWidthClassName="max-w-xl">`.
- `src/components/AuthModal.tsx`: backdrop/panel replaced by `<Modal header={...} titleId="auth-modal-title" bodyClassName="space-y-5">`, where `header` is the icon-badge + title/subtitle + close-button row extracted verbatim from the old markup. Mode tabs, alerts, form, and footer note all became `children` (previously part of one scrolling panel; now sit in the body below a sticky header — the form's content is short enough that this is imperceptible in practice).
- `src/views/WalletsView.tsx`: both modals (Add Wallet, Transfer Funds) replaced by `<Modal title="..." bodyClassName="space-y-4 sm:space-y-5">` wrapping their existing `AddWalletForm`/`WalletTransferForm` calls unchanged.
- `src/views/DebtsView.tsx`: both modals (Add Debt, Repay) replaced the same way; `title` is a template string (`` `Repay: ${repayDebtTarget.name}` ``) and `isOpen={!!repayDebtTarget}` since this modal's visibility is driven by a nullable target object, not a boolean.
- `src/views/TransactionsView.tsx`: the Add Transaction modal replaced with `<Modal title="Record New Transaction" subtitle="..." titleId="add-transaction-modal-title" closeButtonId="close-add-transaction-modal-btn" maxWidthClassName="max-w-xl">`; the two-step CSV Import modal replaced with `<Modal title="Two-Step CSV Transaction Import" subtitle="..." maxWidthClassName="max-w-3xl" bodyClassName="space-y-6">`.
- `src/components/WalletPopupModal.tsx`: backdrop/panel replaced by `<Modal header={...} titleId="wallet-popup-modal-title" panelId="wallet-popup-modal" maxWidthClassName="max-w-3xl" bodyClassName="space-y-5 sm:space-y-6">`, where `header` is a fragment containing both the icon+badge+subtitle row *and* the 4-button tab navigation bar (both were already non-scrolling siblings above the body in the pre-migration markup). The redundant inner `flex-1 overflow-y-auto p-4 sm:p-6 ...` body wrapper was removed since `Modal`'s own body div now provides it. The component's `if (!isOpen) return null;` guard (line 90, predating this change) was kept exactly as-is, ahead of the `<Modal>` call.

7 files changed (1 new): `Modal.tsx` (+148 new), `AuthModal.tsx`, `QuickAddModal.tsx`, `WalletPopupModal.tsx`, `DebtsView.tsx`, `TransactionsView.tsx`, `WalletsView.tsx` — net -237 lines across the 6 modified files despite every one of them gaining an import.

**Why**

`audit-report.md` finding E: 9 modals across 6 files each hand-rolled the same ~20-30 lines of backdrop/panel/animation/responsiveness boilerplate, with no Escape-key handling anywhere and inconsistent accessibility attributes (only 2 of 9 had `role="dialog"`). Any future change to how modals look or behave — a new animation curve, a dark-mode backdrop tweak, adding focus-trapping — previously meant editing 9 near-identical call sites and hoping none were missed.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors (checked after each of the 3 migration batches)
npm run build                    # built in 5.09-5.1s; PWA precache 26 entries (1490.77 KiB, down from 1499.10 KiB)
CI=true npx playwright test      # 87/87 passed (4.4m), 1 worker, 0 retries consumed
```

Batch verification (per the task's own "2-3 modals per step" instruction), each run before moving to the next batch:
- Batch 1 (`QuickAddModal`, `AuthModal`): `auth.spec.ts` + `transaction.spec.ts` — 27/27.
- Batch 2 (`WalletsView`, `DebtsView`): `debts.spec.ts` + `wallet-forms.spec.ts` + `wallets.spec.ts` — 18/18.
- Batch 3 (`TransactionsView`, `WalletPopupModal`): `transaction.spec.ts` + `csv.spec.ts` + `soft-delete.spec.ts` + `keywords.spec.ts` — 30/30, then `wallet-forms.spec.ts` + `wallets.spec.ts` + `theme.spec.ts` again (24/24) specifically to re-exercise `WalletPopupModal`'s dashboard-shortcut open-sync behavior, since that file was the highest-risk migration.

`git status --short` / `git diff --stat` confirmed exactly the 6 files named in the task's scope changed, plus the new `Modal.tsx`.

**Correctness notes**

- **`WalletPopupModal`'s never-unmounts lifecycle is unaffected.** Its `if (!isOpen) return null;` guard sits *before* the `return <Modal ...>` call, unchanged from pre-migration. `Modal`'s own `isOpen` prop is therefore always `true` at the point this component ever renders it — `Modal`'s internal `AnimatePresence` never sees this particular modal's closing transition, and the component function itself is still called every render regardless of `isOpen` (React never unmounts it), so every `useState`/`useEffect` above the guard — including the `useEffect(() => { setActiveTab(initialTab); ... }, [isOpen, initialTab, initialWalletId])` re-sync this file's own comment and `CLAUDE.md` call out — behaves identically to before. This was verified both by inspection and by re-running `wallet-forms.spec.ts`'s two modal-shortcut tests, which specifically assert the dashboard's "Transfer"/"Add Wallet" shortcuts land on the correct tab and wallet each time the modal reopens.
- **Panel layout moved from calc(vh − fixed px) to flexbox**, which is a robustness improvement bundled into the migration: `Modal`'s panel is `flex flex-col ... overflow-hidden` and its body is `flex-1 overflow-y-auto`, so "sticky header, scrollable body, bounded overall height" falls out of the box model instead of each modal hand-computing a pixel offset to subtract from `92vh`/`90vh` (the pre-migration `QuickAddModal` and Add Transaction modal used two *different* guessed offsets, `calc(92vh-70px)` and the same value, that happened to work only because their headers were near-identical height).
- **Two accessibility gaps closed, not preserved:** Escape-to-close (grepped the pre-migration tree for `Escape`/`keydown`/`onKeyDown` — zero matches anywhere) and `role="dialog"`/`aria-modal`/`aria-labelledby` (previously present on only `QuickAddModal` and the Add Transaction modal; now uniform across all 9). Neither is a preserved behavior being ported — both are new, low-risk additions bundled into the consolidation because the shared primitive is the natural place to fix a gap that existed identically at every call site.
- **Two modals gained real (not just structural) visual changes:** `DebtsView`'s Add Debt/Repay modals and `TransactionsView`'s CSV Import modal previously had no framer-motion animation (`animate-in` Tailwind classes on two of them, nothing at all on CSV Import, which also lacked the mobile bottom-sheet `items-end sm:items-center` responsive layout every other modal had). All three now animate and lay out identically to the rest of the app. This is the point of the task, not an incidental side effect — flagged here so it isn't mistaken for scope creep if noticed in a visual QA pass.

**Deliberately not done**

- **No focus-trapping added.** None of the 9 pre-migration modals trapped focus inside the dialog (Tab could still reach the page behind the backdrop), and adding it was not in this task's stated scope (`isOpen`, `onClose`, `title`, `children`, footer slot, `role="dialog"`/`aria-modal`). Noted as a reasonable follow-on for a future accessibility pass, not silently added here.
- **`footer` slot is unused by all 9 current call sites.** Included because the task explicitly asked for an "optional footer/action slot," but every existing modal's primary action button lives inside its own form body, not a separate footer bar. Left as a cheap, already-wired capability for the next modal that needs one, not retrofitted onto existing forms that don't.
- **The ~2vh difference between `WalletPopupModal`'s old `max-h-[88vh]` (small breakpoint) and `Modal`'s default `max-h-[90vh]` was not specially preserved.** Judged not worth a one-off override for a barely-perceptible difference, consistent with this phase's goal of visual convergence across all 9 modals.

---

## Phase 14 — `useDebts` wallet-filtering fix: T29 (2026-09-19, commit `7a7e5a4`)

**Changed**

- `src/hooks/useDebts.ts`: added an `activeWallets` memo (`wallets.filter((w) => !w.isDeleted)`, deps `[wallets]`), and changed the returned shape from `{ wallets }` to `{ wallets: activeWallets, allWallets: wallets }` — an exact match for `useWallets()`'s own `{ wallets: activeWallets, allWallets: wallets, totalNetWorth }` shape.
- `src/views/DebtsView.tsx`: removed the inline `.filter((w) => !w.isDeleted)` that previously ran on `wallets` immediately before mapping it to the repay-wallet `<select>`'s `<option>`s — now redundant, since the array the view receives from `useDebts()` is already filtered.

2 files changed: `useDebts.ts` (+8/-1), `DebtsView.tsx` (+5/-7, net smaller).

**Why**

`useWallets()` established the convention that a hook's `wallets` member is active-only, with a separate `allWallets` for callers that need to resolve a soft-deleted wallet's historical identity. `useDebts()` never followed that convention — it returned `useFinanceState()`'s raw `wallets` untouched. `DebtsView.tsx` compensated for this at its single point of consumption (the repay-wallet `<select>`'s options), but missed the modal's initial `selectedWalletId` state (`useState<string>(wallets[0]?.id || '')`, line 29), which read the same unfiltered array. If a soft-deleted wallet ever sorted first — wallets are ordered by `created_at` ascending, so any wallet created early and deleted later is a candidate — the repay modal would default to selecting an id that had no corresponding `<option>` in the (correctly filtered) dropdown: a controlled `<select>` whose `value` matches nothing renders with no option visibly selected, silently breaking the "the form's default value is always a valid choice" invariant every other form in this app relies on.

**Verification**

```
npm run lint                                       # tsc --noEmit: clean, 0 errors
CI=true npx playwright test tests/debts.spec.ts     # 3/3 passed (16.9s)
CI=true npx playwright test                         # 87/87 passed (4.3m), 1 worker, 0 retries consumed
npm run build                                        # built in 8.95s; PWA precache 26 entries (1499.10 KiB)
```

`git status --short` / `git diff --stat` confirmed only the two intended files changed.

**Correctness notes**

- **Fixed at the hook, not the view.** Filtering happens once inside `useDebts()` rather than at each call site, so any future consumer of `useDebts()`'s `wallets` inherits the correct active-only behavior automatically instead of needing to remember `DebtsView`'s old local `.filter()`.
- **Both existing `useDebts()` consumers checked.** `DebtsView.tsx` is the only one reading `wallets`; `DashboardView.tsx`'s call site destructures only `metrics`. Neither needed further changes beyond the hook fix and the one redundant-filter removal.
- **`tests/debts.spec.ts` needed no changes.** Its own header comment already named this exact task ("pin that behavior before... T29's wallet-filtering fix touches this view") — the spec drives the repay flow through the default first wallet, and every wallet in a fresh seeded context is active, so the fix is behavior-neutral for it. The bug this phase fixes has no automated regression coverage (it would require seeding a soft-deleted wallet that sorts before an active one, then asserting on the `<select>`'s initial `value` matching a real `<option>` — a plausible follow-on spec, not added here since it was not requested).

**Deliberately not done**

- **No new Playwright spec added** to reproduce the soft-deleted-wallet-sorts-first scenario directly. The fix itself is a straightforward one-line filter matching an established convention elsewhere in the codebase (`useWallets`), and the existing `debts.spec.ts` plus the full 87-run suite passing confirms no regression to the happy path.
- **`allWallets` is exposed but not yet consumed anywhere.** Added for shape-parity with `useWallets` and because a future debt-history feature resolving a repayment's source wallet name (including a since-deleted one) is the same class of need `useWallets`'s own `allWallets` exists for — not because any current call site needs it today.

---

## Phase 13 — Supabase realtime sync hardening: T17 (2026-09-19, commit `0f67edc`)

**Changed**

- `src/context/FinanceContext.tsx`:
  - Added `recentLocalWriteIds` (`Set<string>`) and `markLocalWrite(id)`, declared beside the existing `inFlightIdempotencyKeys` idempotency guard. Each id added expires on its own 5s timer (`LOCAL_ECHO_SUPPRESS_MS`).
  - Rewrote the realtime subscription effect (previously: one unfiltered `postgres_changes` listener per `SYNCED_TABLES` entry, calling `loadSupabaseData` unconditionally on every event):
    - Every table's listener now carries `filter: user_id=eq.<currentUser.id>`.
    - The callback reads `payload.new?.id ?? payload.old?.id`; if that id is in `recentLocalWriteIds`, it is consumed (removed from the set) and the event is dropped. Otherwise a shared, per-effect debounce (`REALTIME_RELOAD_DEBOUNCE_MS = 400`) schedules `loadSupabaseDataRef.current?.(currentUser.id)`.
    - `loadSupabaseData` is read through the pre-existing `loadSupabaseDataRef` instead of being closed over, dropping it from the effect's own dependency array (now `[isAuthenticated, currentUser.id]`, was `[isAuthenticated, currentUser.id, loadSupabaseData]`).
  - Threaded `markLocalWrite(id)` through every mutator that writes to one of the 5 `SYNCED_TABLES` and learns the affected row's id: `addWallet`, `updateWallet` (covers `deleteWallet`, which delegates to it), `addTransaction` (both the `transfer_funds` RPC path and the legacy 3-write fallback, including its failure-path compensation writes), `setTransactionDeleted` (covers `softDeleteTransaction`/`restoreTransaction`), `commitBulkImport` (wallet-balance updates only — see Deliberately not done), `addDebt`, `settleDebt`, `deleteDebt`, `upsertDiaryEntry` (both branches — see below), `deleteDiaryEntry`.
  - `upsertDiaryEntry`'s insert branch gained `.select().single()` (previously fire-and-forget) so its newly created row's id could be captured for `markLocalWrite`; the update branch already had `.select().single()` added for the same reason.

1 file changed (`FinanceContext.tsx`, +119/-24).

**Why**

ADR 0003 (T17 half): the realtime subscription had three independent problems, all present since it was first written. No `user_id` filter meant every client received every other user's change events on all 5 tables (the query inside `loadSupabaseData` is still scoped correctly by RLS, so no cross-tenant *data* ever leaked into state, but every client's socket was needlessly processing every other tenant's write traffic). No debounce meant a burst of N row changes — a transfer's transaction insert plus two wallet updates, or a 20-row CSV import — triggered N separate full 6-table refetches. No self-echo suppression meant a client's own write, once it round-tripped through Postgres's replication stream back to the same client's socket, triggered a redundant refetch of data that client had just optimistically applied to its own state.

**Structural before/after of `loadSupabaseData` invocation patterns**

This is derived from reading the code paths, not from a live measurement (see the manual checklist below for that):

| Scenario | Before | After |
|---|---|---|
| Client A adds one non-transfer transaction (1 tx insert + 1 wallet update, 2 row-change events) | Client A's own socket receives both events (no filter) and calls `loadSupabaseData` twice, ~immediately, redundant with the optimistic state already applied | Both row ids are in `recentLocalWriteIds` (marked right after each write's response); both events are consumed and dropped. Client A's `loadSupabaseData` call count from this write: **0** |
| Client A adds one TRANSFER (RPC path: 1 tx insert + 2 wallet updates, 3 events) | 3 calls | All 3 ids marked (`mapped.id`, `sourceWallet.id`, `destWallet.id`); **0** calls |
| Client B (a second device, same account) receives Client A's single-transaction write | 2 calls (once per event, no debounce) | The 2 events arrive within the same ~400ms window and share one debounce timer; **1** call |
| Client A imports a 20-row CSV (20 tx inserts with no `.select()`, plus up to 20 wallet-delta updates) | Up to ~40 calls (1 per row-change event) on whichever client(s) are subscribed, plus 1 more from `commitBulkImport`'s own explicit `refreshFromCloud()` | Wallet-update ids are marked and suppressed; the 20 transaction-insert events (ids unknown, undocumented gap) share the same debounce window and collapse to at most **1** additional call, on top of the function's own 1 explicit `refreshFromCloud()` call — **~2 total** instead of ~41 |
| Client A and Client B are different Supabase users (different accounts) | Both received all of each other's events (no filter) — extra socket/CPU work discarded only because `loadSupabaseData`'s own query is scoped by the caller's session | Client A's channel is never sent Client B's events at all (`filter: user_id=eq.<A's id>` excludes them server-side) — **0** events received, not just 0 acted on |

**Manual 2-device verification checklist**

Per ADR 0003, this half of T17 has no automated regression path — every Playwright spec in this repo runs against the unauthenticated localStorage fallback (`tests/auth.spec.ts`'s own finding notes this environment's `.env` has live demo-project Supabase credentials, but CI never sets them, so neither environment's automated run ever reaches a signed-in realtime channel). **This checklist has not been executed in this session** — it requires two live sessions signed into the same Supabase account, which this environment does not have. It is recorded here for whoever runs it next.

Setup:
1. Confirm `.env` has real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` pointing at a project with `supabase/migrations/20260909_transfer_funds.sql` applied.
2. Open two separate authenticated sessions on the same account — e.g. a desktop browser (Device A) and either a phone or a second browser profile/private window (Device B). Sign in on both via `AuthModal`.
3. Open DevTools console on both devices. Temporarily add `console.count('loadSupabaseData')` as the first line inside `loadSupabaseData`'s body for the duration of this checklist only — revert it afterward, it is not shipped instrumentation.

Steps:
1. **Self-echo suppression (single device, no concurrent writer).** On Device A only, add one transaction via Quick Add. Expected: Device A's `loadSupabaseData` count does **not** increment within ~1s of the write (both the transaction-insert and wallet-update echoes are suppressed). If it increments once or twice, self-echo suppression has regressed.
2. **Concurrent writes (2 devices).** With both devices idle, add a transaction on Device B. Expected on Device A: exactly **one** count increment, ~400ms after Device B's write, with the UI updating to show the new transaction/balance without a double-flash. Then, within the same ~400ms window, add a second unrelated transaction on Device B. Expected: Device A's count increments by **one more** (not two) — the two bursts coalesce.
3. **Burst / bulk import coalescing.** On Device A, import a 15-20 row CSV. Expected on Device B: the count increases by a small number — ideally 1, at most 2-3 depending on network timing — not by ~20-40. This is the ADR's original target metric ("count collapses from N events to close to 1").
4. **Reconnection.** On Device A, use DevTools' Network throttling (or airplane mode on a real device) to go offline for ~15-20s. While Device A is offline, add a transaction on Device B. Restore Device A's connectivity. Expected: Supabase's client reconnects the channel automatically, and Device A's count increments once shortly after reconnection, picking up the transaction written while it was offline — no repeated reconnect/refetch loop visible in the console.
5. **Cross-tenant isolation.** Sign Device A and Device B into two *different* accounts. Write a transaction on Device B. Expected on Device A: **zero** count increments — the `user_id` filter means Device A's channel is never even sent the event, not merely that it chooses to ignore it.

Revert the temporary `console.count` line after finishing.

**Verification (automated gates)**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.05-5.1s; PWA precache 26 entries (1499.07 KiB)
CI=true npx playwright test      # 87/87 passed (4.1m), 1 worker, 0 retries consumed
```

`git status --short` / `git diff --stat` confirmed only `FinanceContext.tsx` changed (119 insertions, 24 deletions).

**Correctness notes**

- **Every change is inside an `if (isAuthenticated)` branch.** The unauthenticated/local-storage fallback path — what all 87 Playwright runs actually exercise — is byte-identical before and after this phase. This is also why the automated suite passing is meaningful evidence for "did not break offline-first or optimistic rollback," despite being unable to exercise the realtime code at all.
- **`markLocalWrite` never suppresses a legitimate concurrent edit to the same row.** The 5s expiry is a safety margin against realtime propagation delay, not a lock: if a genuine second write to the same id (from this client or another) lands after the first id has already been consumed by its own echo (or has expired), it is treated normally. The only failure mode is a false negative (an id expires 5s before its own echo arrives, so that one echo is not suppressed and causes one harmless extra reload) — never a false positive that could hide a real remote change.
- **The debounce and self-echo suppression compose correctly.** A suppressed event returns immediately without calling `scheduleReload()`, so a burst that is *entirely* self-authored (every row id known and marked) never starts the debounce timer at all — not even one reload fires, which is the ideal case the checklist's step 1 is designed to catch a regression in.

**Deliberately not done**

- **`commitBulkImport`'s inserted transaction ids remain unsuppressed.** Its batch `insert(dbPayloads)` call has no `.select()`, so the ids Postgres generates are never returned to the client. Adding one would require either N individual inserts (defeating the point of a batch call) or a follow-up `.select()` query keyed on the batch's shared idempotency-key prefix — judged out of scope for this task, and documented inline at the call site rather than silently accepted. The debounce still bounds the damage to roughly one extra reload for the whole import, not one per row.
- **No change to `keyword_rules`.** It is not in `SYNCED_TABLES` — no realtime channel subscribes to it at all, so there was nothing to filter, debounce, or suppress.
- **The manual 2-device checklist above was not executed in this session** — see its own header note. This is the one piece of this task's own verification requirements that remains outstanding, consistent with ADR 0003 flagging T17 as "the highest-risk, least-verifiable item in the whole plan."
- **T18 (`Promise.all` the bulk-import wallet updates)** — a related but separate optimization (parallelizing `commitBulkImport`'s sequential per-wallet `await`s) remains untouched, still `todo` in the deferred backlog.

---

## Phase 12 — batched localStorage writer: T16 (2026-09-19, commit `97ac7b4`)

**Changed**

- `src/context/FinanceContext.tsx`:
  - Replaced 8 independent `useEffect`s (each calling `localStorage.setItem` synchronously on one state slice — `wallets`, `categories`, `keywordRules`, `transactions`, `debts`, `diaryEntries`, `currentUser`, `sessions`) with a single batched writer: a `pendingWritesRef` (`Map<string, unknown>`) collects dirty keys, and one debounced (250ms) `writeTimerRef` flushes all of them together via `flushPendingWrites`.
  - Added a `didMountRef` mount-skip guard so the 8 write-trigger effects do nothing on their initial mount pass — each slice's value at that point is exactly what `safeGetLocalStorage` just read from storage, so writing it back would be pure waste (and, for `sessions`, would re-serialize `initializeSessionList`'s already-persisted transform redundantly). The guard relies on React running a commit's passive effects in declaration order: the effect that sets `didMountRef.current = true` is declared immediately after all 8 write effects, so it cannot run before them on the same commit.
  - Added a `visibilitychange`/`pagehide` lifecycle effect that calls `flushPendingWrites()` synchronously — `visibilitychange` on `document.visibilityState === 'hidden'`, `pagehide` unconditionally — plus the same flush in that effect's own cleanup function.
- New `tests/storage-persistence.spec.ts` (2 tests): one proves the `visibilitychange` handler flushes synchronously (checked inside the same `page.evaluate` call that dispatches the event, so it cannot pass merely because the debounce timer raced ahead of it), the other proves state survives a real `page.reload()`.

1 file changed in `src/` (`FinanceContext.tsx`, +79/-17), 1 new spec file.

**Why**

ADR 0003 (T16 half): `FinanceContext.tsx:390-413` ran 8 separate full `JSON.stringify` + `localStorage.setItem` calls per relevant state change — a single `addTransaction` triggered 2-3 of them, a failed write's rollback 3 more, a cloud refresh up to 6. Separately, none of the 8 had any flush guarantee: a PWA tab backgrounded mid-write (the common mobile case — swipe away, lock the screen, switch apps) could lose whatever hadn't yet reached `localStorage`, since nothing forced a synchronous write before the tab was suspended.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.14s (5.1-5.8s across runs); PWA precache 26 entries (1498.37 KiB)
CI=true npx playwright test      # 87/87 passed (4.2m), 1 worker, 0 retries consumed -
                                  # 81 pre-existing + 6 new (2 specs x 3 browsers)
```

`git status --short` / `git diff --stat` confirmed only `FinanceContext.tsx` (modified) and `storage-persistence.spec.ts` (new) changed.

**Correctness notes**

- **The debounce and the mount-skip guard cannot desync per-key state.** `pendingWritesRef` is a `Map` keyed by storage key, not an array or queue — a second write to the same key before the timer fires overwrites the pending value in place rather than queuing a stale write behind it, so `flushPendingWrites` always serializes the latest value for each dirty key, never an intermediate one.
- **`flushPendingWrites` is idempotent and side-effect-free when there is nothing pending.** Both lifecycle listeners can fire for the same real event (a navigation away triggers both `visibilitychange`→hidden and `pagehide`) without double-writing anything incorrect — the second call simply iterates an already-empty map.
- **No behavior change to *what* gets persisted, only *when*.** Every key, every serialized shape, and the `safeGetLocalStorage` read path are untouched; this phase only changes the write path from "8 independent immediate writers" to "1 coordinated debounced writer with mandatory flush points."

**Verification spec design note**

ADR 0003 flagged T16 as having "no automated regression test... verification is manual," specifically because proving a debounce-driven flush works is inherently racy against the debounce window itself. `tests/storage-persistence.spec.ts` avoids that race rather than tuning a timeout against it: the `visibilitychange` test overrides `document.visibilityState` and calls `document.dispatchEvent` and then reads `localStorage` back inside the *same* `page.evaluate` invocation — since `dispatchEvent` runs its listeners synchronously before returning, there is no `await`, poll, or timeout anywhere between the dispatch and the read for the 250ms debounce timer to race against. A regression that removed the `visibilitychange` listener entirely would fail this test deterministically, not flakily.

**Deliberately not done**

- **T17 (realtime debounce/`user_id` filter/self-echo suppression)** — ADR 0003's other half, `FinanceContext.tsx:132,658-677`. Explicitly out of scope for this task; still `todo` in the deferred backlog, gated on the manual two-device checklist ADR 0003 specifies.
- **No re-render or write-count instrumentation captured.** ADR 0003's own "Consequences" section anticipates this — the collapse from up to 8 synchronous writes to 1 debounced batch is a structural guarantee of the `Map`-based writer, not something this phase additionally measured with `console.count` or similar.

---

## Phase 11 — local-calendar date comparisons: T21 (2026-09-18, commit `e8d5236`)

**Changed**

- `src/views/DashboardView.tsx`:
  - `filteredTransactions`: the `WEEK`/`MONTH` branches parsed `tx.transactionDate` (a bare `YYYY-MM-DD` local-calendar string) via `new Date(...)`, which JavaScript parses as UTC midnight, and compared it against a threshold built from `now.getTime() - N * 86400000` (a real elapsed-time epoch subtraction). Those two clocks only agree when the current local time-of-day is before the UTC offset (before 07:00 in Thailand); once local time drifts past that, the oldest day a bucket is meant to include falls on the wrong side of the cutoff and is silently dropped. Replaced with `daysAgoIsoDate(7)`/`daysAgoIsoDate(30)` compared directly against `tx.transactionDate` as plain strings - same-format ISO dates sort lexicographically exactly as they sort chronologically, so no `Date` parsing is involved at all.
  - The `DAY` branch called `todayIsoDate()` once per transaction inside the filter predicate; moved to compute it once before filtering.
  - `recentTransactions`'s sort comparator used `new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()`; replaced with a direct string comparison (`b.transactionDate > a.transactionDate ? 1 : ...`), for the same reason - no Date parsing needed to sort same-format ISO date strings.
- `src/views/WalletsView.tsx`: the wallet card's "Created" label read `wallet.createdAt.slice(0, 10)` - `createdAt` is a full ISO *instant* (correctly built with `new Date().toISOString()`), but slicing its first 10 characters reads the **UTC** calendar date, which at UTC+7 is one day behind the local calendar date for anything created between 00:00 and 06:59 local. Replaced with `toIsoDate(new Date(wallet.createdAt))`, which reads the `Date` object's local calendar components (`getFullYear`/`getMonth`/`getDate`) instead of slicing the serialized string.
- `src/views/SecurityView.tsx`: audited, no change. Its one date-related line (`new Date(sess.lastActiveAt).toLocaleTimeString(...)`) parses a full ISO instant and displays local time-of-day - exactly the sanctioned pattern CLAUDE.md carves out ("Full ISO timestamps... remain correct for `createdAt`/`updatedAt`, which are instants, not calendar days"). There is no calendar-day comparison anywhere in the file; `!s.revokedAt` is a presence check, not a date comparison. The `SecurityView.tsx:282` cited in the ledger and ADR no longer points at anything suspicious - see "Corrections" below.
- `tests/date-boundary.spec.ts` (new): two specs, both pinning `test.use({ timezoneId: 'Asia/Bangkok' })` and freezing the clock with `page.clock.setFixedTime(...)` before navigation, so the app's own `new Date()` calls - including the ones that run at module-eval time building `DEFAULT_STARTER_WALLETS` - see the pinned instant regardless of the host machine's real timezone.

**Why**

CLAUDE.md's "Dates: local calendar days" section exists specifically because this class of bug has recurred in this codebase; T21 is the pass that swept the three files the audit flagged for it. Both fixes in `DashboardView.tsx` and the one in `WalletsView.tsx` are the same underlying mistake in two different shapes - mixing a UTC-anchored `Date` (either parsed from a bare date string, or sliced from a full ISO string) into a comparison or display that is supposed to be local-calendar-day-based - and both are fixed the same way: never construct a `Date` from ambiguous input for this purpose, only from a `Date` object's own local getters, or by comparing same-format ISO strings directly.

**Verification (falsification-checked)**

Both new specs were run against the pre-fix source (`git stash` of the two view files) before being accepted, to confirm they actually reproduce the bugs they claim to guard:
- Wallet-creation spec: pre-fix showed `Created: 2026-09-17` for a wallet created at `2026-09-18T02:15:00+07:00` (one day behind). Post-fix shows `Created: 2026-09-18`.
- Week-filter spec: pre-fix showed a `Total Expense` of `฿0.00` when "This Week" should have included a ฿1,000 transaction dated exactly 7 local days before the pinned "now" (`2026-09-18T15:00:00+07:00`, a normal afternoon - deliberately *not* inside the midnight-to-dawn window, since the WEEK/MONTH bug's failure condition is "local time-of-day past 07:00", which covers most of the day, not just the dawn hours). Post-fix shows `฿1,000.00`.

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.76s; PWA precache 26 entries (1497.75 KiB)
CI=true npx playwright test      # 81/81 passed (4.2m), 1 worker, 0 retries consumed - 75 pre-existing + 6 new (2 specs x 3 browsers)
```

**Corrections to the recorded plan**

- **`SecurityView.tsx:282` was not a bug.** ADR-adjacent ledger notes cited it alongside the two real `DashboardView`/`WalletsView` bugs; on inspection its only date-related line displays a full-instant timestamp's local time-of-day, which is the correct, sanctioned use of `new Date(...)` per CLAUDE.md's own carve-out for instants. Audited and left unchanged rather than "fixed" for the sake of matching the line count in the brief.
- **The `DashboardView.tsx` line numbers had drifted** (T14/T15 touched this file's imports and hook destructuring) - the bugs were still present, just at `:87-98` and `:150` in the pre-T21 file rather than the `:82,87-95,150` cited.
- **The `WEEK`/`MONTH` bug's failure window is not actually the midnight-to-dawn hours.** It manifests whenever the local time-of-day is *past* 07:00 (most of the day) - the opposite of when the analogous `WalletsView`/CLAUDE.md canonical bug manifests (00:00-06:59). Both are documented explicitly in the new spec's comments so a future reader does not assume one boundary time covers both.

---

## Phase 10 — ref-mirror volatile mutators: T15 (2026-09-18, commit `c1740d6`)

**Changed**

- `src/context/FinanceContext.tsx`:
  - Added five ref mirrors (`walletsRef`, `transactionsRef`, `debtsRef`, `categoriesRef`, `diaryEntriesRef`), each kept current by its own `useEffect(() => { xRef.current = x }, [x])`, following the file's existing `loadSupabaseDataRef` pattern (`:627`). Never assigned inside a `setState` updater, per the ADR guardrail - `StrictMode` double-invokes those and would desync the mirror from committed state.
  - Rewrote the six volatile mutators to read hot state through the matching ref instead of the closured state variable: `setTransactionDeleted` (backs `softDeleteTransaction`/`restoreTransaction`), `commitBulkImport`, `upsertDiaryEntry`, `addTransaction` (including its 3-slice optimistic-rollback snapshot), and `repayDebtAtomic`, migrated in that order per the ADR's sequencing (`repayDebtAtomic` last, since it depends on `addTransaction` and stays doubly volatile until `addTransaction` itself stabilises).
  - Each rewritten `useCallback`'s deps array dropped the state member(s) it no longer closes over. `addTransaction`: `[wallets, transactions, debts, categories, currentUser.id, isAuthenticated]` -> `[currentUser.id, isAuthenticated]`. `repayDebtAtomic`: `[debts, wallets, categories, addTransaction]` -> `[addTransaction]`. All six now have session-stable identities.
  - Moved all six from `FinanceStateContextType` to `FinanceActionsContextType`, and their entries from `stateValue`'s `useMemo` to `actionsValue`'s. `stateValue` is now plain state with no mutators at all; `actionsValue` carries every mutating action in the app.
- Seven consumer files updated to read the six mutators from `useFinanceActions()` instead of `useFinanceState()`: `QuickAddModal.tsx`, `WalletPopupModal.tsx`, `WalletTransferForm.tsx`, `useDebts.ts`, `useTransactions.ts`, `DashboardView.tsx`, `DiaryView.tsx`.

**Why**

T14 migrated consumers off the `useFinance()` shim, but six of them still subscribed to `FinanceStateContext` for one of these six mutators alongside genuine state, and one (`WalletTransferForm`) subscribed to state for `addTransaction` alone - so none of them were actually insulated from ledger writes yet. This is the commit where that insulation lands: `WalletTransferForm` now reads only `useFinanceActions()` and re-renders on nothing but a rare stable-callback change, joining `AddWalletForm` as fully insulated. `QuickAddModal`, `DashboardView`, `WalletPopupModal`, `useDebts`, `useTransactions`, and `DiaryView` keep a state subscription for their remaining state reads, but that subscription no longer also re-created their mutator's identity on every write - `React.memo`'d subtrees below them that only receive the mutator as a prop stop re-rendering on writes they don't otherwise observe.

**Correctness notes**

- **Ref reads happen only in event-handler-invoked callbacks, never during render.** Every one of the six mutators is called from a form submit handler or an imperative action, always after the component tree has committed and the mirroring `useEffect`s have run. There is no code path that calls a mutator synchronously from within a render, so `xRef.current` is always the value from the most recent commit by the time any mutator reads it.
- **`addTransaction`'s rollback snapshot is exactly as reliable as before.** `previousWallets`/`previousDebts`/`previousTransactions` are still captured once, synchronously, at the top of the function body - only the source changed, from the closured state variable to `xRef.current`. Both name the same committed array at the moment the function starts running.
- **StrictMode-safe by construction.** No ref is written inside a `setState` updater anywhere in this diff; every write is `useEffect(() => { ref.current = value }, [value])`, which StrictMode's dev-mode double-invocation of effects (mount, cleanup, re-mount) handles correctly - the second invocation just reassigns the same value.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.68s; PWA precache 26 entries (1497.83 KiB)
CI=true npx playwright test      # 75/75 passed (3.9m), 1 worker, 0 retries consumed
npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/diary.spec.ts tests/soft-delete.spec.ts
                                  # 27/27 passed (54.6s), all three browsers - the four specs
                                  # exercising every migrated mutator (addTransaction,
                                  # softDeleteTransaction/restoreTransaction, upsertDiaryEntry,
                                  # repayDebtAtomic) run clean
```

**Metric delta**

| | Before | After |
|---|---|---|
| Volatile mutators in `FinanceStateContextType` | 6 | 0 |
| `useCallback`s with hot-state deps (`wallets`/`transactions`/`debts`/`categories`/`diaryEntries`) | 6 | 0 |
| `stateValue` members | 19 (13 state + 6 mutators) | 13 (state only) |
| `actionsValue` members | 14 | 20 |
| Consumers fully insulated from ledger writes | 1 (`AddWalletForm`) | 2 (`AddWalletForm`, `WalletTransferForm`) |
| Consumers with a mutator no longer re-creating on writes | 0 | 6 (`QuickAddModal`, `WalletPopupModal`, `useDebts`, `useTransactions`, `DashboardView`, `DiaryView`) |

**Not done here**

`SecurityView` and the remaining state reads in the six mixed consumers above still re-render on writes to the state members they read (e.g. `DashboardView` still reads `transactions`). That is inherent to what those components display, not something T15's scope changes - T15 only removed the *mutator*-driven half of that churn.

---

## Phase 9 — consumer migration and shim retirement: T14 (2026-09-18, commit `36c4d7e`)

**Changed**

- All 15 `useFinance()` call sites migrated to `useFinanceState()`, `useFinanceActions()`, or both, one destructure per context:
  - **Actions only (no longer re-renders on a ledger write):** `components/wallet/AddWalletForm.tsx:53`.
  - **State only:** `components/QuickAddModal.tsx:22`, `components/TransactionForm.tsx:35`, `components/wallet/WalletTransferForm.tsx:66`, `hooks/useWallets.ts:5`, `views/DashboardView.tsx:48`, `views/TransactionsView.tsx:22`.
  - **Both halves:** `components/Navbar.tsx:52`, `components/WalletPopupModal.tsx:37`, `hooks/useDebts.ts:6`, `hooks/useTransactions.ts:16`, `views/DiaryView.tsx:37`, `views/KeywordRulesView.tsx:8`, `views/SecurityView.tsx:25`, `views/WalletsView.tsx:17`.
- `src/context/FinanceContext.tsx` - deleted `useFinance()` and the `FinanceContextType` union that existed only to type it (-19 lines). `useFinanceState()` and `useFinanceActions()` are now the entire public consumer surface.
- Two stale comments naming the deleted hook were reworded to refer to the finance context generally: `App.tsx:61` and `QuickAddModal.tsx:14-15`. No behavioural change.

**Why**

T13 split the value but left every consumer on the merging shim, so nothing actually benefited: the shim subscribes to both contexts, which means a component needing only `addWallet` still re-rendered on every transaction. This commit is where the split starts paying. `AddWalletForm` now reads nothing volatile at all and is fully insulated from ledger writes; the eight mixed consumers keep their volatile subscription but no longer pull in the stable half's identity churn on the rare occasions it does change.

**Corrections to the recorded plan**

- **There were 15 call sites, not 16.** ADR `0001`, the Phase 8 log entry, and the T14 ledger row all say 16. Verified against the T13 commit: `git grep -c "= useFinance()" 8c3ad78 -- src/` returns 15 across 15 files. The extra one was almost certainly `App.tsx:61`, which mentions `useFinance()` in a comment explaining that `MainApp` deliberately does *not* call it.
- **`WalletTransferForm` and `SecurityView` are not actions-only.** The task brief grouped both with `AddWalletForm` as instant wins. `WalletTransferForm` needs `addTransaction`, one of the six volatile mutators, which still lives in the *state* context until T15 ref-mirrors it - so it is state-only and still re-renders on writes. `SecurityView` is genuinely mixed: `currentUser`, `isAuthenticated`, `isSyncing`, `sessions`, and `currentSession` are state; `refreshFromCloud`, `revokeSession`, `revokeAllOtherSessions`, and `signOut` are actions. `AddWalletForm` is the only consumer in the codebase that reads actions and nothing else.
- **`DebtsView`, `AuthModal`, and `WalletAccountsGrid` were listed as consumers but never called the shim.** They take their data via props or via the domain hooks. `TransactionForm.tsx` and `WalletsView.tsx` were consumers and were missing from the brief's list; both are migrated.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 6.42s; PWA precache 26 entries (1497.42 KiB)
CI=true npx playwright test      # 75/75 passed (3.6m), 1 worker, 0 retries consumed
```

Parallel local runs (`npx playwright test`, 6 workers) produced one Firefox failure per run, but a *different* test each time - `csv.spec.ts:18` twice, then `auth.spec.ts:44`. Each failed identically: `locator.click` timing out after the call log had already reported "element is visible, enabled and stable ... performing click action", i.e. the click hung in the driver rather than the app leaving the element unclickable. Both specs pass in isolation on this branch (`--repeat-each=3`, 3/3), and the single-worker CI-mode run is clean at 75/75. Treated as Firefox-under-parallel-load flake on this machine, not a regression - but the same command on the unmodified parent commit passed 75/75 at 6 workers, so this is recorded rather than dismissed. If it recurs on CI, that assumption is wrong and this is the entry to revisit.

**Metric delta**

| | Before | After |
|---|---|---|
| `useFinance()` call sites | 15 | 0 (hook deleted) |
| Consumers subscribing to both context halves | 15 | 8 |
| Consumers insulated from ledger writes | 0 | 1 (`AddWalletForm`) |
| Exported consumer hooks | 3 | 2 |

**Not done here**

The six volatile mutators (`addTransaction`, `softDeleteTransaction`, `restoreTransaction`, `commitBulkImport`, `repayDebtAtomic`, `upsertDiaryEntry`) remain in the state context, so any consumer needing one of them still re-renders on every write. That is T15's scope, and it is what moves `WalletTransferForm`, `QuickAddModal`, and `DashboardView` into the insulated column.

---

## Phase 8 — FinanceContext value split: T13 (2026-09-18, commit `8c3ad78`)

**Changed**

- `src/context/FinanceContext.tsx` — the only file touched (+133/-52).
  - The single 33-member `FinanceContextType` was replaced by two interfaces: `FinanceStateContextType` (`:46`, 19 members — 13 state values plus the 6 volatile mutators) and `FinanceActionsContextType` (`:98`, 14 members — the stable session callbacks plus `setShowSoftDeleted`).
  - `FinanceContextType` (`:132`) is retained as `extends FinanceStateContextType, FinanceActionsContextType`, so the exported type is structurally unchanged.
  - `const FinanceContext = createContext(...)` became two contexts (`:134-135`), and the single `contextValue` memo became `stateValue` (`:1535`) and `actionsValue` (`:1584`).
  - `FinanceProvider` now nests both providers — actions outer, state inner (`:1622-1626`).
  - `useFinanceState()` (`:1636`) and `useFinanceActions()` (`:1645`) exported; `useFinance()` (`:1659`) survives as a merging shim over both.

Zero consumer files modified. All 16 `useFinance()` call sites are byte-identical to before.

**Why**

ADR `0001` option (b), staged after the App-shell fixes that already shipped in Phase 2. Correction C1 established that only 7 of the context's 22 `useCallback`s are volatile; the other 15 are stable for the whole session but were trapped in a value object that changes identity on every ledger write, so a component needing nothing but `signOut` or `addWallet` re-rendered on every transaction. This commit makes the two halves invalidate independently. It deliberately does not yet *use* that — migrating consumers is T14 — because doing the split and the migration together would mean a 17-file diff where a behavioral regression has 17 candidate causes instead of one.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors, src/ and tests/
npm run build                    # built in 19.54s; PWA precache 26 entries (1497.37 KiB)
npx playwright test --reporter=line   # 75/75 passed (1.7m)
```

`git diff --stat` confirmed a single changed file.

**Metric delta**

| | Before | After |
|---|---|---|
| React contexts in `FinanceContext.tsx` | 1 | 2 |
| Largest context value | 33 members | 19 members (state) / 14 (actions) |
| `Object.is` comparisons per provider commit | 33 (one memo) | 19 + 13 = 32, across two independently-invalidating memos |
| Consumers subscribed to the volatile value | 16 | 16 (unchanged — the shim still reads both; T14 reduces this) |
| Files changed | — | 1 |
| Full suite | 75 runs | 75 runs, no spec edited |

No re-render metric is claimed for this phase, and none should be: with every consumer still on the shim, the split cannot yet reduce a single re-render. The S1-S5 counts are the measurement for T14, not this commit.

**Surprises**

- **A naive shim would have been a regression, not a no-op.** The obvious `return { ...useFinanceState(), ...useFinanceActions() }` allocates a fresh object on every render of every consumer. Pre-split, `useFinance()` returned one memoized object whose identity was stable between writes — so the "zero breaking changes" shim would have silently broken identity stability for all 16 consumers (and anything downstream keying a `useMemo`/`useEffect` on the context object). The shim memoizes the merge on `[state, actions]` (`:1659`) to preserve the original guarantee exactly.
- **Two Firefox tests failed on the first full-suite run** (`auth.spec.ts:33`, `csv.spec.ts:18`) and passed on an immediate clean re-run, plus in isolation against the same working tree. Load-related flake under full parallelism in the engine `playwright.config.ts` already documents as the slowest to paint a lazy chunk — not a regression from this change, which touches neither auth nor CSV code paths. Recorded rather than quietly dropped, because it is the second phase in a row where the T12-era specs have been the ones to wobble; if it recurs, those two specs need a look independent of whatever task is in flight.

**Deliberately not done**

- **No consumer migrated.** That is T14, one file per commit, and it is what actually banks the re-render win. The shim exists precisely so this commit can be reverted alone.
- **No ref-mirroring.** The 6 volatile mutators (`addTransaction`, `softDeleteTransaction`, `restoreTransaction`, `commitBulkImport`, `repayDebtAtomic`, `upsertDiaryEntry`) stay in the state context and stay volatile. Moving them is T15, gated on T12 and sequenced one mutator per commit with `repayDebtAtomic` last.
- **`setTransactionDeleted` was not exposed.** It stays a private implementation detail behind `softDeleteTransaction`/`restoreTransaction`; the split neither widened nor narrowed the public surface.
- **No dependency-array cleanup.** Several deps are wider than strictly needed (e.g. `upsertDiaryEntry` depends on the whole `diaryEntries` array where a functional `setState` would drop it). Narrowing them changes which callbacks are volatile and therefore which context they belong in — that is a decision for T15, and folding it in here would have made this commit non-mechanical.
- **No re-render instrumentation run.** `baseline-metrics.md`'s S1-S5 still have no captured "before" numbers (deferred since Phase 0). This phase cannot move them by construction, so capturing them now would burn the instrumentation branch on a commit with nothing to show; they belong immediately before T14.

---

## Phase 7 — Characterization tests for the untested half: T12 (2026-09-17, commit `7f0c5b1`)

**Changed**

- New `tests/debts.spec.ts` — one test covering create → partial repayment → progress update → full repayment → auto-settle.
- New `tests/soft-delete.spec.ts` — three tests: transaction (delete → toggle reveal → restore), wallet (delete → reload persistence), debt (delete → reload persistence).
- New `tests/keywords.spec.ts` — two tests: sandbox matcher against a default seeded rule, and adding a new rule that the sandbox immediately picks up.
- New `tests/csv.spec.ts` — one test: export a seeded transaction, re-import the exact downloaded file, confirm it commits as a new valid row.
- New `tests/auth.spec.ts` — five tests covering modal open/close, signin/signup/forgot mode switching, and native HTML5 email/password validation.
- `src/components/AuthModal.tsx` — added 8 `id` attributes (`auth-email-input`, `auth-password-input`, `auth-name-input`, `auth-submit-btn`, `auth-tab-signin`, `auth-tab-signup`, `auth-forgot-password-link`, `auth-back-to-signin-link`, `auth-close-btn`) purely for test targeting; no markup, styling, or behavior changed.

6 files changed: 1 modified (`AuthModal.tsx`, +13/-4), 5 new spec files.

**Why**

T13-T15 (context value split, then migrating consumers, then ref-mirroring the volatile mutators) and T22/T29 (modal consolidation, `useDebts` wallet-filtering fix) all touch code with zero existing automated coverage: debt repayment/settlement, soft-delete across three entities, keyword matching, CSV import/export, and the auth modal. Refactoring any of that blind means the only signal on a regression is manual inspection. This phase establishes the safety net those tasks were gated on.

**Verification**

```
npx tsc --noEmit                                     # clean, 0 errors, src/ and tests/
npx playwright test tests/debts.spec.ts tests/soft-delete.spec.ts \
  tests/keywords.spec.ts tests/csv.spec.ts tests/auth.spec.ts --project=chromium
                                                        # 12/12 passed (10.9s)
npx playwright test tests/debts.spec.ts tests/soft-delete.spec.ts \
  tests/keywords.spec.ts tests/csv.spec.ts tests/auth.spec.ts --project=firefox --project=webkit
                                                        # 24/24 passed (1.0m) - the CSV download
                                                        # mechanic specifically verified in both,
                                                        # including WebKit's Blob-URL handling
npx playwright test --reporter=list                    # 75/75 passed (1.7m) - full suite,
                                                        # 39 pre-existing + 12 new x 3 browsers
npm run build                                          # succeeded in 9.7s; vendor chunk split
                                                        # from T7 unaffected
```

`git status --short` / `git diff --stat` confirmed the only modified `src/` file was `AuthModal.tsx` (id attributes only), plus the 5 new spec files - no other files touched.

**Metric delta**

| Domain | Before | After |
|---|---|---|
| Debt repayment/settlement | 0 automated tests | 1 test, 3 assertions on the payoff lifecycle |
| Soft-delete (tx/wallet/debt) | 0 automated tests | 3 tests |
| Keyword auto-matcher | 0 automated tests | 2 tests |
| CSV export/import | 0 automated tests | 1 round-trip test |
| Auth modal | 0 automated tests, 0 `id` attributes | 5 tests, 8 `id` attributes added |
| Full suite size | 39 runs (13 tests x 3 browsers) | 75 runs (25 tests x 3 browsers) |

**Surprises**

- **`AuthModal`'s `isSupabaseConfigured` branch fires differently between this environment and CI.** This local checkout has a real `.env` with live (demo-project) Supabase credentials, so `handleAuth` would make an actual network call before ever reaching its own Zod validation; `playwright.yml` never sets those secrets, so CI takes the "Cloud sync is not configured" short-circuit instead. Neither branch is safe to assert on in a spec that has to pass in both places. Caught this before writing any assertion that depended on it (rather than after a flaky CI run), and scoped `auth.spec.ts` to only the parts of the form that resolve before `handleAuth` runs at all: modal open/close, mode switching, and native HTML5 `validity.valid` checks. This is a real, non-obvious characterization finding in its own right, not just a test-design workaround - anyone adding a signed-in-flow test here later needs to know which branch they're actually exercising.
- Everything else passed on the first attempt in all three browsers, including the CSV Blob-URL download/re-upload round trip, which was the one mechanism in this batch with a real chance of browser-specific behavior.

**Deliberately not done**

- **Mobile Playwright project not added**, despite being named in the task's own file list ("new `tests/*.spec.ts`, mobile project"). Adding a mobile viewport project to `playwright.config.ts` would require re-verifying all 25 existing test files against it, not just the 5 new ones added here - a materially larger and separately-scoped change. Left as a follow-on.
- No characterization test written for realtime/cloud-sync behavior, `WalletPopupModal`'s in-modal "Activity" tab, the CSV `Diary Export (JSON)` button, or `SecurityView` - out of the 5 domains this task explicitly named.
- The `KeywordRulesView` sandbox test relies on the app's default seeded keyword rule (`coffee` -> Food & Dining) rather than seeding its own - if that default data ever changes, this test's first case breaks along with it. Judged acceptable since the default seed data is itself effectively a fixture other specs already depend on implicitly (e.g. `wallets[0]` defaults used throughout).
- Did not attempt to also address the T29 finding (`useDebts` returning unfiltered `wallets`) that this phase was partly gating - `debts.spec.ts` exercises the repay-wallet select as-is, without asserting on whether a soft-deleted wallet could appear there.

---

## Phase 6 — Nav hoisting and Suspense boundary restructure: T10, T11 (2026-09-17, commit `1c4c7e7`)

**Changed**

- `Navbar.tsx` — hoisted the static `navItems` array (7 objects: id/label/icon per tab) to a module-level `NAV_ITEMS: NavItemConfig[]` constant, with a new `NavItemConfig` interface. Was previously reallocated (the array plus all 7 object literals) on every `Navbar` render, including every financial write (since `Navbar` subscribes to `useFinance()` for `totalNetWorth`/`isAuthenticated`/`isSyncing`/`currentUser`).
- `MobileBottomNav.tsx` — same hoist, reusing the file's existing module-level `NavItemConfig` interface.
- `App.tsx` — moved `<Suspense fallback={<ViewLoadingFallback />}>` to wrap `<AnimatePresence mode="wait" custom={direction}>`, out from its previous position nested inside the keyed `<motion.div>` (where it wrapped only `{renderActiveView()}`). One `Suspense` boundary now persists across `activeTab` changes instead of a new one being constructed every time the `motion.div`'s `key` changes.

3 files changed: `src/App.tsx` (15 insertions, 15 deletions), `src/components/MobileBottomNav.tsx` (11 insertions, 11 deletions), `src/components/Navbar.tsx` (17 insertions, 11 deletions).

**Why**

`navItems` in both nav components was a purely static configuration array with zero dependency on props or component state, yet was declared inside the function body, so it was rebuilt from scratch on every render — for `Navbar` specifically, that's every financial write in the app, not just tab changes. Hoisting removes that allocation entirely from the render path.

The `Suspense` placement was flagged in the original audit plan as a candidate fix for "tearing or fallback churn on route transitions" — nesting the boundary inside the per-tab keyed `motion.div` means a brand-new `Suspense` fiber is constructed and torn down on every tab switch, rather than one boundary persisting across the whole navigation lifecycle. The plan itself flagged this specific change as carrying the highest test risk in the deferred backlog, since `tests/helpers.ts:gotoTab`'s `#view-loading-fallback` assertion is the one piece of test coverage that would catch a regression here.

**Verification**

```
npx tsc --noEmit                                            # clean, 0 errors
npx playwright test --reporter=list                         # 39/39 (55.2s), all three browsers
npx playwright test --project=firefox tests/theme.spec.ts tests/diary.spec.ts
                                                              # re-run in isolation, 4/4 passed
npx playwright test --project=firefox tests/theme.spec.ts:47 --repeat-each=3
                                                              # the 7-tab cycling test specifically,
                                                              # repeated 3x — 3/3 passed, ~8-10s each,
                                                              # no flakes, no timing regression
npm run build                                                # succeeded in 5.6s; vendor chunk split
                                                              # from T7 unaffected
```

`git status --short` / `git diff --stat` confirmed only the three target files changed.

**Metric delta**

| Metric | Before | After |
|---|---|---|
| `navItems` allocation (`Navbar`) | array + 7 objects rebuilt every render, incl. every financial write | built once at module load |
| `navItems` allocation (`MobileBottomNav`) | array + 7 objects rebuilt every render | built once at module load |
| `Suspense` boundary lifetime | new fiber per `activeTab` key change (nested inside the keyed `motion.div`) | one persistent boundary spanning all tab transitions |
| `Navbar` `React.memo` | not applied (unchanged this phase) | still not applied — see Deliberately not done |

**Surprises**

- None functionally — both changes were mechanical. The main open question going in was whether moving `Suspense` outside `AnimatePresence` would visibly disrupt the exit/enter slide animation on a tab switch to an unloaded chunk (a real risk given React's Suspense-fallback-replaces-whole-subtree behavior on non-`startTransition` updates). It did not surface as a test failure or a timing regression in any of the three browsers across the standard run plus the two additional targeted re-runs, but this was verified only via the automated suite's DOM-state assertions, not a visual/manual check of the animation itself — see Deliberately not done.

**Deliberately not done**

- **`Navbar` was not wrapped in `React.memo`.** It still calls `useFinance()`/`useTheme()` directly, so per audit correction C3 and the plan's guardrail #9, `React.memo` cannot stop it from re-rendering on financial writes (context-value changes force a re-render of every consumer regardless of props memoization) — it would only skip renders triggered by an unrelated parent (`MainApp`) re-render with unchanged props, a narrow and easily-overstated win. The task ledger's own original phrasing for this task was "memo `Navbar` after subscription cut" — that subscription cut (extracting the net-worth/sync-badge/auth sections into self-subscribing pieces, as T1 did for the quick-add modal) hasn't happened, so memoizing now was judged not worth doing; it's a precondition for a future task, not a partial step taken here.
- No manual/visual verification of the tab-switch slide animation was performed — only the automated Playwright DOM assertions (class changes, fallback element count) were checked. If a subtle animation-timing regression exists that no current test asserts on, it would not have been caught by this verification pass.
- `App.tsx`'s other structure (the `AnimatePresence`/`motion.div`/`pageVariants` themselves) was left untouched beyond relocating `Suspense` — no attempt was made to also address `renderActiveView()`'s `switch` statement or the lazy-import declarations, which are out of this task's scope.

---

## Phase 5 — Inline filter/computation memoization: T9 (2026-09-17, commit `58e460d`)

**Changed**

- `TransactionForm.tsx:37` — `activeDebts` wrapped in `React.useMemo([debts])`.
- `TransactionForm.tsx:306-307` — the destination-wallet `<select>`'s inline `wallets.filter((w) => w.id !== walletId)` hoisted to a `destinationWalletOptions` `React.useMemo([wallets, walletId])` above the `return`, JSX now maps over the memoized array.
- `WalletsView.tsx:22` — `activeWallets` wrapped in `useMemo([wallets])`; this one memo also covers the `wallets={activeWallets}` prop passed to `WalletTransferForm` further down the same component.
- `KeywordRulesView.tsx:17` — `matchResult` (`matchSmartDescription(...)`) wrapped in `useMemo([testInput, keywordRules, categories])`.
- `KeywordRulesView.tsx:34` — `categoryMap` wrapped in `useMemo([categories])`.
- `TransactionsView.tsx:400-401` — the Add Transaction modal's two inline `wallets.filter(!isDeleted)` / `categories.filter(!isDeleted)` calls hoisted to `activeWalletsForForm`/`activeCategoriesForForm` `useMemo`s, placed beside the file's existing `walletMap`/`categoryMap` memos.

4 files changed: `src/components/TransactionForm.tsx` (+13/-6), `src/views/KeywordRulesView.tsx` (+9/-3), `src/views/TransactionsView.tsx` (+6/-2), `src/views/WalletsView.tsx` (+2/-2).

**Why**

Each of these was a computation (filter, `.map()`-built lookup, or matcher call) re-run from scratch on every render of its parent component, regardless of whether its actual inputs had changed — the same class of waste T8 fixed inside `DiaryView`, here spread across the four views/forms the task ledger's original audit had flagged. `TransactionForm` and `KeywordRulesView` in particular re-run these on every keystroke into unrelated local state (description text, math input, sandbox test string), since none of the memoized values depend on that state.

**Verification**

```
npx tsc --noEmit          # clean, 0 errors
npx playwright test --reporter=list   # 39/39 (1m6s-ish), all three browsers
npm run build              # succeeded in 20.4s; vendor chunk split from T7 unaffected
```

`git status --short` / `git diff --stat` confirmed only the four target files changed, matching the task's file list exactly.

**Metric delta**

| Site | Before | After |
|---|---|---|
| `TransactionForm` `activeDebts` | recomputed every render (incl. every description/amount keystroke) | recomputed only when `debts` changes |
| `TransactionForm` destination-wallet options | rebuilt every render inside JSX | recomputed only when `wallets`/`walletId` changes |
| `WalletsView` `activeWallets` | recomputed every render | recomputed only when `wallets` changes |
| `KeywordRulesView` `matchResult` | re-run `matchSmartDescription` every render (incl. every sandbox-input keystroke) | recomputed only when `testInput`/`keywordRules`/`categories` changes |
| `KeywordRulesView` `categoryMap` | rebuilt every render | recomputed only when `categories` changes |
| `TransactionsView` active wallets/categories for the Add Transaction modal | rebuilt every render (incl. every search/filter keystroke on the table above) | recomputed only when `wallets`/`categories` changes |

No S1-S5 re-render-count replay was run for this phase; the existing `baseline-metrics.md` snapshot (recorded post-Phase-4, commit `e20c49e`) predates this change and was not re-captured, consistent with that file's own "current-state snapshot, not a before/after delta" caveat.

**Surprises**

- None. The task's own line references (`TransactionForm.tsx:37,306-307`, `WalletsView.tsx:22,218`, `KeywordRulesView.tsx:17,34`, `TransactionsView.tsx:400-401`) matched the current file contents closely enough that no re-scoping was needed — line 218 in `WalletsView.tsx` (the `wallets={activeWallets}` prop) needed no separate edit since it already consumes the memoized value once line 22 was fixed.

**Deliberately not done**

- No `React.memo` added to `TransactionForm`, `WalletsView`, or `KeywordRulesView` themselves — out of scope per the task's file/line list, which targets the inline computations passed as or feeding into props, not the receiving components. `TransactionForm` in particular is not currently `React.memo`'d; wrapping it is a separate, unrequested decision (its call sites already pass memoized `wallets`/`categories` arrays after this phase and T1/T8, but its `onSubmitTransaction` callbacks are inline in two of its three call sites — `TransactionsView.tsx`'s Add Transaction modal and the original `DashboardView.tsx` usage already uses a stable `handleTransactionSubmit`).
- `TransactionsView.tsx`'s inline `onSubmitTransaction={async (data) => {...}}` passed to `TransactionForm` (adjacent to the memoized wallets/categories props) was left as-is — not in the task's specified line list, and stabilizing it only matters once `TransactionForm` itself is memoized, which is also not in scope here.
- The ledger's prior note that the `KeywordRulesView` slice was "blocked by T12" (characterization tests) was re-assessed and treated as not applicable: every change in this phase is a pure memoization of an existing computation with no behavior change, verified by the full suite passing with zero test edits.

---

## Phase 4 — DiaryView memoization: T8 (2026-09-17, commit `c9d4f26`)

**Changed**

- Hoisted `formatDayInfo` from `DiaryView.tsx` into `src/utils/date.ts`, extending its signature with optional `todayStr`/`yesterdayStr` parameters (defaulting to fresh `todayIsoDate()`/`daysAgoIsoDate(1)` calls) so a caller formatting many dates in a loop computes "today" once instead of once per date. Date math unchanged: still `new Date(year, month-1, day)` for local midnight, never `new Date(dateStr)` — no UTC-shift risk introduced.
- Hoisted `moodLabels` (fully static, no component-state dependency) to a module-level `MOOD_LABELS` constant.
- Added a module-level `EMPTY_DAY_DATA` constant replacing two inline fallback-object literals, so a day with zero transactions gets the same object reference every access.
- Memoized `activeEntries` (`useMemo`, deps `[diaryEntries]`), `selectedDayInfo`, `selectedDateOutflowCount`, and — the main fix — a new `enrichedEntries` `useMemo` (deps `[activeEntries, dailyTransactionsMap, todayIso, yesterdayIso]`) that precomputes each diary entry's `dayInfo`/`dayData`/`outflowTxs`/`moodInfo` once per actual data change instead of once per render.
- Extracted the per-entry card markup into a new `src/components/DiaryEntryCard.tsx`, wrapped in `React.memo`, receiving the precomputed values plus two new stable `useCallback`s from the parent (`handleToggleExpand`, `handleDeleteEntry`) that take the entry id as an argument — replacing per-row inline closures that would have defeated the memo regardless of prop stability elsewhere.

3 files changed: `src/utils/date.ts` (+37 lines), `src/views/DiaryView.tsx` (132 insertions, 181 deletions — net smaller despite the added memoization, since the ~180-line inline card JSX moved out), new `src/components/DiaryEntryCard.tsx` (196 lines).

**Why**

`audit-report.md` finding B: `DiaryView.tsx:135-137` (filter+sort), `:203` (inline filter), and `:367` (per-entry filter inside the render map) all recomputed on every render, including every keystroke into the form's 7 local state fields (mood, workout, workoutNote, foodQuality, notes, saveSuccess, saveError) — none of which have anything to do with the entries list being displayed. `:68-84`'s `formatDayInfo` additionally recomputed "today"/"yesterday" reference dates once per diary entry per render.

**Verification**

```
npx tsc --noEmit                          # clean, 0 errors
npx playwright test tests/diary.spec.ts   # 3/3 (all 3 browsers), 9.5s total -
                                           # Firefox at normal speed, no timing regression
npx playwright test --reporter=line       # 39/39 (1m15.0s)
npm run clean && npm run build            # succeeded in 6.88s; DiaryView chunk
                                           # 16.46 kB -> 16.71 kB (DiaryEntryCard
                                           # bundles into the same lazy chunk, not
                                           # a new split point); vendor chunks
                                           # from T7 unaffected
```

`git status --short` confirmed only `date.ts`, `DiaryView.tsx`, and the new `DiaryEntryCard.tsx` changed.

**Metric delta**

| Metric | Phase 3 | Phase 4 |
|---|---|---|
| `formatDayInfo` calls per DiaryView render (N entries) | N + 1 (once for selected date, once per entry, each also recomputing today/yesterday internally) | N + 1 calls, but 0 of them on a keystroke unrelated to the entries list — `enrichedEntries`/`selectedDayInfo` only recompute when their actual deps change |
| `activeEntries` filter+sort | every render | only when `diaryEntries` changes |
| Per-entry outflow filter (`:367`) | every render, inline in JSX | precomputed once in `enrichedEntries`, plus the row itself is `React.memo`'d so unaffected rows skip re-rendering entirely |
| `DiaryView.tsx` line count | 499 (pre-T8) | ~350 (card markup extracted to its own file) |

Re-render counts (S4, the diary-keystroke scenario from `baseline-metrics.md`) remain uncaptured — same instrumentation gap noted in the Phase 2 entry. This phase's fix is the direct target of S4 and would be the clearest place to finally stand up that measurement.

**Surprises**

- None. `tsc`, the diary spec (specifically watched for Firefox timing per the task's guardrail), and the full suite all passed clean on the first attempt.

**Deliberately not done**

- `DashboardView.tsx:87,92,95,150`, `WalletsView.tsx:117`, and `SecurityView.tsx:282` (the other UTC-shift-risk date sites the audit flagged) were not touched — that's task `T21`, out of scope here. `daysAgoIsoDate` still isn't adopted at any of those sites.
- No change to `dailyTransactionsMap` (already correctly `useMemo`'d before this phase) or to the diary form's own local state shape.
- Re-render scenario counts (S1-S5) still not captured — see Metric delta above.

---

## Phase 3 — Bundle optimization: T7 (2026-09-17, commit `da46314`)

**Changed**

- **T7** — Added `build.rollupOptions.output.manualChunks` to `vite.config.ts` as a function (not the object-shorthand form, which cannot match `mathjs/number`'s subpath import or `lucide-react`'s deep per-icon module paths). Matches on `node_modules/<pkg>/` substrings and groups: `vendor-react` (`react`, `react-dom`, `scheduler`), `vendor-motion` (`framer-motion`, `motion-dom`, `motion-utils`, `tslib`), `vendor-supabase` (`@supabase/*`, which covers all 5 of `@supabase/supabase-js`'s sub-packages via the scope prefix), `vendor-math` (`mathjs/number`), `vendor-icons` (`lucide-react`). Everything else (`zod`, `papaparse`, `react-swipeable`, app code) is left to Rollup's default chunking.

1 file changed (`vite.config.ts`): +38 lines (new `build` block only). No other file touched.

**Why**

`audit-report.md` finding H: the entry chunk was 1,116.67 kB with no `manualChunks` configured — Vite's own build output warned about it directly ("Some chunks are larger than 500 kB... Use build.rollupOptions.output.manualChunks"). Per-view code splitting via `React.lazy` already worked; the entry chunk was the one thing nothing split.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors
npm run clean && npm run build      # succeeded in 6.91s; entry chunk 165.39 kB / 45.72 kB gzip
                                     # (was 1,116.36 kB / 326.11 kB gzip); 0 chunks over 500 kB (was 1)
npx playwright test --reporter=line # 39/39 on a clean re-run (see Surprises for the one flake)
```

Additionally, since `manualChunks` only takes effect under `vite build` (never under the `vite dev` server Playwright's `webServer` runs against), I booted `vite preview` against the actual production build to confirm the split works at runtime, not just at build time: `curl` returned HTTP 200 for `/`, and grepping the served entry chunk's contents for `vendor-*.js` filenames found all 5 vendor chunks referenced.

`git status --short` confirmed only `vite.config.ts` changed.

**Metric delta**

| Metric | Phase 2 | Phase 3 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.36 kB / 326.11 kB | 165.39 kB / 45.72 kB (−85% raw) |
| Chunks over Vite's 500 kB warning threshold | 1 (the entry chunk) | 0 |
| Total JS bytes across all chunks (raw, summed) | ≈1,300.96 kB | ≈1,296.81 kB (essentially unchanged — see Surprises) |
| Build time | 8.51s | 6.91s |

Full per-chunk table recorded in `baseline-metrics.md` under "After T7".

**Surprises**

- **Total bytes shipped did not shrink.** Summing every `.js` chunk before and after T7 gives ≈1,301 kB and ≈1,297 kB respectively — essentially identical (the small drop is from consolidating 7 previously-separate lucide-react micro-chunks into one `vendor-icons` chunk, removing per-chunk overhead). This task was never going to reduce total payload — it redistributes the same code across chunks that can be fetched in parallel and cached independently across deploys. Worth stating plainly so this isn't mistaken for a "faster page" claim without qualification: what improved is time-to-first-paint-relevant parse/eval work (entry chunk −85%) and cache stability for returning visitors, not total bytes for a cold empty-cache visit.
- One Firefox run of `diary.spec.ts` failed on the first full-suite pass (`#view-loading-fallback` didn't detach within 10s), then passed both in isolation and on a full clean re-run immediately after. Confirmed this cannot be caused by `manualChunks`, since that Rollup option only applies to `vite build` output and the Playwright suite runs against `vite dev` (`playwright.config.ts`'s `webServer.command: 'npm run dev'`), which never executes `build.rollupOptions` at all. This matches the pre-existing, documented Firefox/dev-server flakiness `tests/helpers.ts` and `playwright.config.ts` already account for with generous Firefox timeouts.
- The pre-T7 build already had informal, Rollup-default splitting of individual `lucide-react` icons into tiny standalone chunks (`plus-*.js`, `arrow-up-right-*.js`, etc., 0.33-0.92 kB each) — an artifact of icons being shared across 2+ lazy-loaded view chunks. These disappeared post-T7, consolidated into the single `vendor-icons` chunk by the broader `node_modules/lucide-react/` match, which is the intended and better outcome (one cacheable chunk instead of many tiny ones).

**Deliberately not done**

- No bundle-analysis plugin (e.g. `rollup-plugin-visualizer`) was added — explicitly out of scope per the plan's non-goals; logged in `constraints-to-promote.md`'s follow-on proposals.
- No change to `chunkSizeWarningLimit` — the warning is now moot since every chunk is under the default 500 kB threshold, so there was nothing to adjust.
- `@/*` alias was not re-added or touched — confirmed the `vite.config.ts` diff contains only the new `build` block, nothing near the (already-deleted, per T28) `resolve.alias` section.
- `server.hmr`/`server.watch` (`DISABLE_HMR` handling) untouched, per the explicit guardrail.

---

## Phase 2 — High-impact UI decoupling: T1 & T3 (2026-09-17, commit `41c6a4c`)

**Changed**

- **T1** — Extracted the quick-add modal (`App.tsx:176-242` in its pre-Phase-2 form) into `src/components/QuickAddModal.tsx`, a near-verbatim move that preserves every id, `role`/`aria-*` attribute, and class name the Playwright suite depends on. The new component calls `useFinance()` itself for `wallets`/`categories`/`addTransaction`, and wraps its wallet/category filters in `useMemo`. Deleted `MainApp`'s `useFinance()` call (`App.tsx:61` in its pre-Phase-2 form) entirely — it now holds only its 4 local `useState` UI flags (`activeTab`, `direction`, `isQuickAddOpen`, `isAuthModalOpen`).
- **T3** — Wrapped `handleTabChange`, `handleNextTab`, `handlePrevTab` in `useCallback` (dep: `[activeTab]` — stable except when the tab itself changes). Added a single stable `handleNavigate` callback replacing the two inline `onNavigate={(tab) => handleTabChange(tab as ActiveTab)}` closures passed to `DashboardView`. Also added `useCallback` for the four modal-toggle handlers (`handleOpenQuickAdd`, `handleCloseQuickAdd`, `handleOpenAuth`, `handleCloseAuth`), which are now fully stable (`[]` deps) since they're pure `setState(true/false)` wrappers.

1 file changed (`App.tsx`): 48 insertions, 91 deletions. 1 file added (`QuickAddModal.tsx`, 100 lines).

**Why**

`audit-report.md` finding A: `App.tsx:61`'s `useFinance()` subscription was the single highest-leverage fix in the whole audit — `MainApp` renders the entire app shell inline, so that one subscription is why `React.memo` looked defeated at eight unrelated components (`MobileBottomNav`, `RecentTransactionsTable`, `CategoryExpenseDistribution`, `CashflowMetricsCards`, `DebtPayoffOverview`, `TotalWealthHero`, `TransactionTableRow`, `DebtCardItem`). ADR `0001` recommended doing this before any `FinanceContext` split work, since it requires zero context surgery and removes most of the measured re-render cost on its own.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors
npx playwright test --reporter=line # 39 passed (1m5.0s) - no timeouts,
                                     # helpers.ts:gotoTab's #view-loading-fallback
                                     # assertion held throughout
npm run clean && npm run build      # succeeded in 8.51s; entry chunk
                                     # 1,116.36 kB / 326.11 kB gzip
```

`git status --short` confirmed only `App.tsx` (modified) and `QuickAddModal.tsx` (new) changed — nothing in `FinanceContext.tsx`, Supabase sync, or ledger mutation code was touched, per the guardrail.

**Metric delta**

| Metric | Phase 1 | Phase 2 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.08 kB / 326.05 kB | 1,116.36 kB / 326.11 kB |
| Playwright wall-clock | 1m2.8s (cold server) | 1m5.0s (cold server) — within normal run-to-run variance, no timeouts |
| `MainApp`'s `useFinance()` subscriptions | 1 (only via the modal it rendered inline) | 0 |

The entry chunk grew by ~280 bytes raw — expected: `QuickAddModal.tsx` is a new eagerly-imported module (not lazy), so its code moved rather than shrank. `manualChunks` (T7) is still the lever for the entry chunk's actual size; that's unaffected by this phase.

Re-render counts (S1-S5) remain uncaptured. This was the natural point to capture them (T1 is the "before" this whole plan was measuring toward), but doing so requires the throwaway `Profiler`/`console.count` instrumentation branch described in `baseline-metrics.md`, which this session did not stand up. Recorded as a gap to close before Phase 3 continues (T8, T7, T9, etc.).

**Surprises**

- The `handleTabChange`/`handleNextTab`/`handlePrevTab` handlers were initially written using React's functional-updater form (`setActiveTab(current => ...)`) specifically so their `useCallback` dependency arrays could be `[]` — fully stable for the session, not just stable-between-tab-changes. This was reverted before shipping: the updater bodies called `setDirection(...)` as a side effect, and React may invoke a `setState` updater function more than once (StrictMode double-invocation, concurrent rendering) — updaters must stay pure. Shipped with the simpler closure-based form and an explicit `[activeTab]` dependency instead, which is behaviorally identical to the pre-Phase-2 code and avoids the impure-updater trap.
- T10 ("hoist `navItems`; memo `Navbar` after subscription cut") was previously blocked on "T1, T2" in the ledger. Both are now shipped (T2 in Phase 1, T1 here), so T10 is unblocked — noted in `task-ledger.md`.

**Deliberately not done**

- Re-render scenario counts (S1-S5) were not captured before or after this phase — see Metric delta above. This is the clearest gap in this phase's verification: the plan's headline claim (removing `App.tsx:61` fixes "every consumer re-renders on every write") is currently supported by structural reasoning and the passing test suite, not by a measured before/after render count. Should be captured before Phase 3 continues.
- `renderActiveView` was not wrapped in `useCallback` or otherwise memoized. It's a local render-helper function, called directly during render and never passed as a prop to any component — memoizing it would add an equality check for no benefit.
- No `FinanceContext.tsx` changes. Per the guardrail, this phase touched only `App.tsx` and the new `QuickAddModal.tsx`.
- T7 (`manualChunks`), T8 (`DiaryView` memoization), T9 (remaining inline-filter memoization elsewhere), and the rest of the deferred task list remain untouched, awaiting separate approval per the ledger.

---

## Phase 1 — Zero-risk cleanup (2026-09-17, commit `74114f6`)

**Changed**

- **T4** — Added `npm run lint` (`tsc --noEmit`) as a CI step in `.github/workflows/playwright.yml`, before the Playwright step. Added `tests` to `tsconfig.json`'s `include` (removing it from `exclude` alone was not sufficient — `include` was `["src"]` only, so `tests/` was never type-checked regardless of the exclude list; fixed by adding it to `include` too).
- **T2** — Deleted `otpPending` end-to-end: the state (`FinanceContext.tsx`), its two context-value sites, and both badge renders (`Navbar.tsx`, `MobileBottomNav.tsx`). `MobileBottomNav` lost its only `useFinance()` call and its now-dead `useFinance` import.
- **T5** — Removed dead hook exports: `useTransactions.ts`'s `metrics` memo and its dep on `isSyncing`, un-exported `UseTransactionsFilterOptions`; `useWallets.ts`'s `walletsByType` and the `addWallet`/`updateWallet`/`deleteWallet`/`isSyncing` pass-throughs (file went from 74 to 16 lines); `useDebts.ts`'s `allDebts`/`isSyncing` from the return object and `metrics.totalMinimumMonthly`/`metrics.settledCount`.
- **T6** — Removed unused props: `AnimatedCounter`'s `currencySuffix`/`decimals`/`className` (hardcoded `decimals`'s only value, 2, into the `toLocaleString` call); `InlineMathInput`'s `name`/`autoFocus`/`className` (hardcoded `name`'s only value, `"amount_expression"`, onto the `<input>`); `currency.ts`'s `formatCurrencyAmount` second parameter (`{showCode, showSymbol}`) entirely. **Did not** delete `WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab union member — see Surprises.
- **T19** — Replaced 4 inlined `Math.round(x*100)/100` copies in `FinanceContext.tsx` with `roundToCents` calls. `csvExchange.ts`'s money-rounding copies left untouched (deferred — see Deliberately not done).
- **T20** — Replaced 5 hard-coded `฿` literals (`DebtsView.tsx` ×4, `WalletPopupModal.tsx` ×1) with `APP_CURRENCY_SYMBOL`. Dropped `CashflowMetricsCards`'s `primarySymbol` prop-thread in favor of importing the constant directly; removed the now-dead `APP_CURRENCY_SYMBOL` import this left behind in `DashboardView.tsx`.
- **T28** — Deleted the `@/*` alias from `vite.config.ts` (`resolve.alias` block + the now-dead `path` import) and `tsconfig.json` (`paths`). Corrected `CLAUDE.md:53` and the Project Structure tree entry for `tsconfig.json` to stop documenting the alias.

17 files changed: 37 insertions(+), 181 deletions(-).

**Why**

These seven tasks were ranked zero-risk in `task-ledger.md` because every change is either compiler-proven (`tsc --noEmit` catches a bad deletion immediately) or sits directly on a path the existing 39 Playwright runs already exercise. See `audit-report.md` findings D, F, and H for the evidence behind each task.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors (including tests/, now in scope via T4)
npx playwright test --reporter=line # 39 passed (1m2.8s)
npm run clean && npm run build      # succeeded in 7.25s; entry chunk 1,116.08 kB / 326.05 kB gzip
                                     # (baseline: 1,116.67 kB / 326.33 kB — smaller, as expected
                                     # from dead-code removal; manualChunks still deferred to T7)
grep -rn "฿" src/ --include=*.tsx   # only currency.ts:12 and the two documented exemptions
```

`git status --short` confirmed only the 17 intended `src/`/config files plus the new `docs/` tree changed — nothing else touched.

**Metric delta**

| Metric | Phase 0 baseline | Phase 1 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.67 kB / 326.33 kB | 1,116.08 kB / 326.05 kB |
| `tsc --noEmit` (warm) | 2.40s, 373 files | not re-measured (no reason to expect a change; `tests/` now included) |
| Playwright wall-clock | 1m16.2s (cold server) | 1m2.8s (cold server) |
| Source LOC (src+tests) | 9,529 | 9,529 − 144 net = 9,385 |

Re-render counts (S1-S5) remain uncaptured — still deferred to immediately before Phase 3, per the Phase 0 entry.

**Surprises**

- T4's instruction ("remove `tests` from `tsconfig.json` exclude list") was not by itself sufficient to make `tsc` check `tests/` — `include` was `["src"]` only, so the exclude entry was already a no-op. Fixed by adding `tests` to `include` as well. `tests/` type-checked clean with zero pre-existing errors, so no cascading fixes were needed.
- T2's `otpPending` removal had a free side effect: `MobileBottomNav` lost its only context subscription, so its pre-existing (but previously inert, per audit correction C3) `React.memo` now actually does something.
- **T6's `WalletPopupModal.tsx:22` instruction was based on an incorrect audit finding.** The `'TRANSACTIONS'` tab union member is not dead code — it's a live "Activity" tab with two working in-modal trigger buttons (`id="tab-btn-txs"` and a second button in the wallet-detail view) and real rendered content. The original finding only established it can never arrive as `WalletPopupModal`'s *initial* tab from `DashboardView`'s `openWalletModal` (correctly narrowed by `WalletAccountsGrid.tsx:12`), not that the whole feature was unreachable. Deleting it would have broken a real feature and caused 4+ compile errors. Skipped; `audit-report.md` finding D corrected in place rather than marked resolved.

**Deliberately not done**

- `csvExchange.ts`'s 3 money-rounding copies (`:152,163,176`) were left un-migrated to `roundToCents`, per T19's explicit scope limit — that helper is module-private to `FinanceContext.tsx`, and exporting it is more churn than Phase 1's zero-risk scope justifies. Left for a later phase.
- `WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab member was not deleted (see Surprises) — this is a correction to the audit, not deferred work.
- No `src/` file was touched beyond the 7 tasks' explicit scope. In particular, `DashboardView.tsx:104-124`'s hand-rolled income/expense/debt-repayment aggregation (which duplicates the `metrics` memo T5 just deleted from `useTransactions.ts`) was left as-is — deduplicating it is task `T26`, out of scope here.

---

## Phase 0 — Documentation and baselines (2026-09-17, commit `74114f6` — shipped together with Phase 1)

**Changed**

- Created `docs/audit/` with `README.md`, `audit-report.md`, `baseline-metrics.md`, `task-ledger.md`, `refactor-log.md` (this file), `constraints-to-promote.md`, and 5 ADRs under `decisions/`.
- Zero edits to `src/`, `tests/`, or any build config.

**Why**

The audit surfaced ~30 findings across re-renders, duplication, dead code, constraint drift, and test coverage gaps, with no existing place to record them. Without a written baseline, every future session re-derives the same findings from scratch, and there is no way to prove a later change actually improved anything.

**Verification**

Baselines captured on a clean working tree at commit `1a02a4a`:

```
npm run clean && npm run build     # entry chunk 1,116.67 kB / 326.33 kB gzip; build 22.61s
npx tsc --noEmit --extendedDiagnostics   # median warm: 2.40s (373 files, 9,164 TS lines)
npx playwright test --reporter=line      # 39 passed (1m16.2s wall-clock, cold dev-server boot)
```

`git status --short` clean before and after — no unintended changes leaked (`dist/` is gitignored and was not committed).

**Metric delta**

N/A — this is the baseline column itself. See `baseline-metrics.md`.

**Surprises**

- The CI workflow (`.github/workflows/playwright.yml`) never runs `npm run lint`, and `tsconfig.json:30` excludes `tests/` from type-checking — the gate the whole plan depends on is not enforced today (finding C4). Recorded as task T4, first in Phase 1.
- Two harmless Rollup build warnings from `node_modules/zod`'s `@__PURE__` comment placement — third-party, not actionable, noted so it isn't mistaken for a regression later.

**Deliberately not done**

- Re-render scenario counts (S1-S5) were **not captured** in this phase. Doing so requires a throwaway instrumentation branch (`Profiler` + `console.count`), and this phase was scoped to zero `src/` edits, including on a disposable branch. Deferred to immediately before Phase 3 (the `App.tsx:61` fix), where the "before" number is most load-bearing. The exact method and fixed scenarios are already written into `baseline-metrics.md` so this doesn't need to be re-derived.
- No source code was touched — Phase 1 (dead code + constraint-drift fixes) is documented in `task-ledger.md` but not yet executed.
