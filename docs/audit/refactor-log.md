# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

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
