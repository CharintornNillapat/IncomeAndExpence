# CLAUDE.md

## Project Overview
FinLife Tracker is a full-stack personal finance and holistic lifestyle management Progressive Web App (PWA). It tracks Thai Baht wallets, income/expense/transfer transactions, and debt repayment goals, while correlating financial behavior with a daily wellness diary (mood, workout, food quality). The app functions offline via `localStorage` and syncs bi-directionally with Supabase when configured.

## Tech Stack
- **Language**: TypeScript ~5.8.2 (`ES2022`, `bundler` resolution, `allowImportingTsExtensions: true`)
- **Framework**: React 19.0.1, React DOM 19.0.1
- **Build & Bundler**: Vite ^6.2.3, `@vitejs/plugin-react` ^5.0.4, `vite-plugin-pwa` ^1.3.0
- **Styling**: Tailwind CSS ^4.1.14 (`@tailwindcss/vite` ^4.1.14, `@import "tailwindcss"`, Stone palette)
- **Database & Auth**: Supabase (`@supabase/supabase-js` ^2.112.4)
- **Testing**: Playwright ^1.50.1 (`@playwright/test`)
- **Key Libraries**: `framer-motion` ^13.1.1, `lucide-react` ^0.546.0, `mathjs` ^15.2.0 (`mathjs/number`), `zod` ^4.5.4, `papaparse` ^5.7.0, `react-swipeable` ^7.0.2

## Project Structure
```
├── .github/workflows/   # CI pipeline for Playwright E2E tests (playwright.yml)
├── api/                 # Vercel serverless functions (classify.ts: Jev proxy; own tsconfig)
├── public/              # PWA icons (192px, 512px, SVG) and robots.txt
├── supabase/migrations/ # SQL migrations (transfer_funds RPC + idempotency index)
├── src/
│   ├── components/      # Reusable UI components, modals, and navigation
│   │   ├── dashboard/   # Dashboard-specific summary and metric cards
│   │   ├── transaction/ # Transaction tokens/cells + CategorySuggestionChip
│   │   └── wallet/      # Shared wallet forms (AddWalletForm, WalletTransferForm)
│   ├── context/         # FinanceContext.tsx (monolithic app state, local fallback, Supabase sync)
│   ├── hooks/           # Domain hooks (useTransactions, useWallets, useDebts, useTheme)
│   ├── lib/             # Supabase client setup (supabase.ts)
│   ├── utils/           # Pure helpers: currency, date, mathEvaluator, smartMatcher,
│   │                    # jevClassifier, zodSchemas, csvExchange, walletIcons
│   ├── views/           # Route views lazy-loaded via React.lazy in App.tsx
│   ├── App.tsx          # Root shell with gesture handlers and tab navigation
│   ├── main.tsx         # Application entry point
│   ├── types.ts         # TypeScript domain interfaces, unions, and enums
│   └── index.css        # Tailwind v4 import and dark mode custom variant
├── tests/               # Playwright specs (*.spec.ts) plus shared helpers.ts
├── index.html           # Anti-FOUC theme bootstrap and PWA meta tags
├── playwright.config.ts # Playwright multi-browser test configuration
├── vite.config.ts       # Vite config (PWA manifest, Tailwind plugin, HMR switch)
└── tsconfig.json        # TypeScript configuration (strict unused-locals/params, no path aliases)
```

## Common Commands
From `package.json` (requires `npm install` prior to execution):
- `npm run dev` : `vite --port=3000 --host=0.0.0.0`
- `npm run build` : `vite build`
- `npm run preview` : `vite preview`
- `npm run clean` : `rm -rf dist server.js`
- `npm run lint` : `tsc --noEmit && tsc -p api/tsconfig.json` (app+tests, then the Vercel functions)
- `npm test` : `playwright test`

## Coding Conventions
- **Component Pattern**: Functional components with TypeScript interfaces; named exports for views and helper components.
- **Naming**: PascalCase for components (`TransactionForm.tsx`), camelCase for hooks and utilities (`useTheme.ts`, `mathEvaluator.ts`), SCREAMING_SNAKE_CASE for enum/union values (`INCOME`, `EXPENSE`, `BANK_ACCOUNT`).
- **Imports**: Relative paths only — there is no `@/*` alias. Explicit `.tsx` extensions are supported and used in imports.
- **Styling**: Tailwind CSS v4 utility classes. Warm neutral aesthetic based on `stone-*` palette. Dark mode uses `.dark` class, `data-theme="dark"`, and `colorScheme`.
- **Form styles**: Labels, text/number/select inputs, error banners, and primary/secondary buttons come from `src/utils/formStyles.ts` (`LABEL_CLASS`/`LABEL_TEXT_CLASS`, `inputClass(tone)`, `selectClass(tone)`, `OPTION_CLASS`, `ERROR_BANNER_CLASS`, `PRIMARY_BUTTON_CLASS`/`PRIMARY_BUTTON_COMPACT_CLASS`, `SECONDARY_BUTTON_CLASS`) instead of a re-typed Tailwind string — but only where a field's styling actually matches one of those shapes. A field with a genuinely different padding scale, font size, or color stays inline (e.g. `WalletPopupModal`'s compact inline editors, `TransactionsView`'s `min-h-[44px]` touch-target filter bar, `AuthModal`/`TransactionForm`'s larger `text-sm` inputs) — forcing it through the shared class would be a visual regression, not a cleanup. See `docs/audit/refactor-log.md` Phase 17 for the audited exceptions.
- **Lookup maps**: Build an id→entity `Map` with `buildLookupMap(items)` from `src/utils/mapUtils.ts` rather than writing `new Map(items.map(x => [x.id, x]))` inline. This covers only the id→full-item shape — a map keyed by something other than `id`, or valued by a single field instead of the whole item (e.g. id→name in `csvExchange.ts`, `useTransactions.ts`), is a different shape and stays as its own inline `new Map(...)`.
- **Modals**: Use the shared `src/components/Modal.tsx` primitive (`isOpen`/`onClose`, `title`/`subtitle` or a `header` override slot, optional `footer`) for any dialog or mobile bottom sheet — never hand-roll a backdrop + panel + `AnimatePresence` combination. It owns the overlay fade, spring panel animation, mobile bottom-sheet layout, Escape-to-close, and `role="dialog"`/`aria-modal`/`aria-labelledby`.
- **UI primitives**: `src/components/ui/` holds generic, domain-agnostic pieces — `Modal`, `SectionHeader` (`title`/`subtitle`/`action`), `Card` (`padding: 'none'|'sm'|'md'|'lg'`), `ConfirmDialog`, `Badge`/`CategoryChip`/`categoryTint`, `ProgressMeter` (clamps to `[0,100]` internally), `EmptyState`, `SegmentedControl` (pill-in-tray switcher with a `layoutId`-animated active pill, namespaced per instance via `useId()`). `src/components/transaction/` holds the transaction domain's own tokens/cells — `txTypeMeta.ts`'s `TX_TYPE_META` (type → icon/label/tint/sign) and `TxCells.tsx`'s `TxTypeIcon`/`TxAmount`/`TxCategoryChip`/`TxSoftDeletedTag`. A new primitive goes in `ui/` unless its props are typed against a specific domain model (a `TransactionType`, a `Wallet`), in which case it goes beside that domain's other files, matching `wallet/`'s existing precedent for `AddWalletForm`/`WalletTransferForm`. Each of these primitives takes an escape-hatch prop (e.g. `CategoryChip.rounded`, `TxAmount.colorClassName`, `TxTypeIcon.tintOverride`) for the one field a specific call site had already diverged on before the primitive existed — check whether a call site's appearance is supposed to differ before assuming a mismatch is a bug. See `docs/audit/decisions/0006-ui-primitive-inventory.md`.
- **Data Integrity**: Soft deletion (`isDeleted: true`) on records to protect ledger and history integrity.
- **Unused symbols**: `tsconfig.json` sets `noUnusedLocals` and `noUnusedParameters`, so `npm run lint` fails on dead imports and locals. Prefix a deliberately unused parameter with `_` (see `_event` in `FinanceContext.tsx`).
- **Re-renders**: Never wrap a component in `React.memo` while it still subscribes to `useFinanceState()`/`useFinanceActions()` (or any other context) directly — a context value change re-renders every subscriber regardless of `React.memo`'s props comparison, so the memo would look like a fix while doing nothing. Cut the subscription first (read the data in a parent and pass it down as props, or extract a self-subscribing child), then memo the now-props-only component.

## Currency: THB only
The app is single-currency (Thai Baht) and must stay that way unless the ledger gains real conversion.
- `CurrencyCode` in `src/types.ts` is the one-member union `'THB'`, so any second currency becomes a compile error at every write site.
- Use `APP_CURRENCY` and `APP_CURRENCY_SYMBOL` from `src/utils/currency.ts` instead of literals.
- **Format every displayed amount with `formatCurrencyAmount(value)`** from the same module. It renders `฿1,234.50` — exactly two decimals with thousands separators. Do not hand-roll `฿` + `toFixed(2)` or `toLocaleString(...)`: past drift produced dollar signs on debt cards and three-decimal amounts wherever `maximumFractionDigits` was omitted.
- The transfer path moves balances 1:1 in nominal units, which is only correct while every wallet shares one currency.
- Exceptions that must **not** use the helper: CSV export values (`csvExchange.ts` writes machine-readable numbers — a thousands separator would corrupt the columns), `mathEvaluator`'s `formattedValue` (raw input-field text), and `AnimatedCounter` (animation primitive with its own `decimals` prop and a separately styled prefix).

## Dates: local calendar days (Thailand, UTC+7)
Transaction dates, diary dates, and "today"/"yesterday" labels are **local** calendar days.
- Use `todayIsoDate()`, `toIsoDate(date)`, and `daysAgoIsoDate(n)` from `src/utils/date.ts`.
- **Never use `new Date().toISOString().slice(0, 10)`** for a date field. `toISOString()` formats in UTC, so at UTC+7 every moment between 00:00 and 06:59 local resolves to the *previous* day — filing transactions and diary entries under the wrong date.
- `daysAgoIsoDate` uses `setDate` rather than millisecond subtraction so it steps exactly one calendar day across DST boundaries.
- Full ISO timestamps (`new Date().toISOString()`) remain correct for `createdAt` / `updatedAt`, which are instants, not calendar days.
- **Compare calendar days as ISO strings, never as parsed `Date` objects.** Two `YYYY-MM-DD` strings of the same format compare correctly with plain `<`/`>`/`===`. Constructing a `Date` from one (`new Date('2026-09-19')`) parses it as UTC midnight, which sits 7 hours behind local time at UTC+7 — comparing that against `new Date()` (a local instant) silently shifts the cutoff. This bit both a `DashboardView` week/month filter (wrong side of the cutoff once local time passed 07:00) and a `WalletsView` "Created" label (UTC-sliced instead of local-formatted); both are fixed, but the failure mode recurs anywhere a bare date string meets a `Date` instance.

## State: context + domain hooks
- Canonical state lives in `src/context/FinanceContext.tsx`, split into two contexts: `FinanceStateContext` (plain state only — wallets, transactions, debts, categories, diary entries, sessions) and `FinanceActionsContext` (every mutator, including `addTransaction`/`softDeleteTransaction`/`restoreTransaction`/`commitBulkImport`/`upsertDiaryEntry` — the ones that touch hot state read it via a ref mirror (`walletsRef`/`transactionsRef`/`debtsRef`/`categoriesRef`/`diaryEntriesRef`) instead of a closure over the state value, so the actions context stays genuinely stable). Consume them via `useFinanceState()` and `useFinanceActions()`. Optimistic updates with rollback snapshots on network failure.
- **There is no combined `useFinance()` shim** — it existed only during the state-context split and was deleted once every consumer migrated to `useFinanceState()`/`useFinanceActions()`. Do not reintroduce one; a merged `{ ...state, ...actions }` object hands every consumer a fresh identity on every render, which is the exact churn the split removes.
- **No component above view level subscribes to finance state.** `App.tsx`'s `MainApp` and the shell it renders (`Navbar`, the swipe wrapper, `MobileBottomNav`, `AuthModal`) call neither `useFinanceState()` nor `useFinanceActions()`. A piece that needs finance data (e.g. the quick-add modal) subscribes to it itself, so a financial write re-renders only the piece that actually needs the new data — never the whole app shell.
- **Views should consume the domain hooks in `src/hooks/` rather than `useFinanceState()`/`useFinanceActions()` directly** where one fits:
  - `useTransactions(options)` — filtering (wallet, category, type, date range, search across description / amount / rawInput / category name / wallet name), aggregate metrics, and the transaction write actions.
  - `useWallets()` — `wallets` (active only), `allWallets` (includes soft-deleted, for resolving historic names), `totalNetWorth`.
  - `useDebts()` — active/settled splits and `metrics` (totals, `progressPercent`, counts).
- `useFinanceState()`/`useFinanceActions()` are still correct for state no hook covers (categories, diary entries, sessions).
- Do not add another state library (Redux, Zustand).
- **State persists through one batched `localStorage` writer; add a new persisted slice by registering it there, not by adding another effect.** `FinanceContext.tsx` debounces every dirty slice through one `pendingWritesRef` map and a single `flushPendingWrites`, flushed on a 250ms timer and on `pagehide`/`visibilitychange` — it is the only place `localStorage.setItem` is called.
- **Never read a value assigned inside a `setState` updater after the call that scheduled it.** A prior `setState` call in the same function can already have dirtied the fiber, so a later `setWallets(prev => { x = ...; return ...})` updater is not guaranteed to run before the next line reads `x` — React only takes the synchronous eager-eval path for the *first* state update in a batch. Compute the value first, from the ref mirror (`walletsRef.current`, etc.), and pass it into the updater as a precomputed value instead. This bit `setTransactionDeleted` (Phase 32, T63) — the wallet-balance write silently stopped firing on every soft-delete/restore for authenticated users, and `tsc` cannot catch it because the race is a runtime scheduling issue, not a type error.

## Transaction entry: one configurable engine
`src/components/TransactionForm.tsx` is the single entry engine for every flow that needs its full shape (EXPENSE/INCOME/TRANSFER/DEBT_REPAYMENT type toggle, category, wallet, description, math-expression amount). It takes optional `idPrefix`/`presetType`/`lockType`/`presetDebtId`/`presetWalletId` props; passing none reproduces plain default behavior.
- **3 consumers, each a distinct entry point, not a duplicate**: `QuickAddModal` (default, no preset — reached from `Navbar`'s quick-add button and `DashboardView`'s CTA, one shared instance owned by `App.tsx`), `TransactionsView`'s Add Transaction modal (default), `DebtsView`'s repay modal (`lockType`/`presetDebtId`/`presetWalletId` set).
- **New transaction-creating UI should default to reusing `TransactionForm`** via its existing props before writing a new form.
- **Two deliberate, permanent exceptions** — do not "fix" these by routing them through `TransactionForm`:
  - `WalletPopupModal`'s inline Adjust Balance editor creates an `ADJUSTMENT` transaction via a bespoke one-field form. Forcing it through `TransactionForm` would surface a type toggle/category/destination-wallet field the user has no reason to touch for a balance reconciliation.
  - The wallet-to-wallet **Transfer** action (hero button, wallet-card shortcuts, `WalletsView`'s header button) goes through a separate, purpose-built `WalletTransferForm` via the shell-level `src/components/wallet/TransferFundsModal.tsx` — not `TransactionForm`'s own TRANSFER type option. Both transfer paths coexist on purpose: `TransactionForm`'s TRANSFER option is for a generic "log a transaction" flow that happens to be a transfer; the dedicated form is for the wallet-first "Transfer" action and has no type toggle to skip past.
- `useDebts().repayDebt`/`FinanceContext.tsx`'s `repayDebtAtomic` were removed entirely (Phase 33, T64) after confirming zero call sites outside their own definitions — `DebtsView`'s repay modal calls `addTransaction` directly through `TransactionForm`, since the debt decrement/auto-settle logic lives inside `addTransaction` itself, not in a separate repayment code path. Do not reintroduce a second repayment code path.
- See `docs/audit/decisions/0007-transaction-entry-consolidation.md`.

## Categorization: rules first, Jev second
Two layers, in a fixed order. Do not reverse them and do not collapse them into one.
- **`src/utils/smartMatcher.ts` is the first and authoritative layer.** It runs synchronously on every keystroke inside `TransactionForm.handleDescriptionChange`, is free, works offline, and is the user's only way to overrule the model on their own ledger via a `KeywordRule`. **A rule hit short-circuits completely — no debounce, no cache lookup, no network call.** `tests/jev-classify.spec.ts` asserts this with a request counter; if you change the ordering, that test fails, which is the point.
- **Jev (`src/utils/jevClassifier.ts`) is consulted only on a rule miss**, behind a 450 ms debounce, an abort of any superseded request, and a monotonic sequence guard so a slow answer for an older description cannot overwrite a newer one.
- **`classifyDescription()` must never throw or reject.** Every failure — 404, 5xx, timeout, abort, malformed JSON, offline — resolves to `null`, which renders as "no suggestion". There is still no error boundary anywhere in `src/`, so a thrown fetch white-screens the app. This contract is load-bearing, not stylistic.
- **Confidence gates the UI**, via the one exported `CONFIDENCE` object: `≥ 0.85` auto-fills exactly as the rule matcher does, `0.50–0.85` renders `CategorySuggestionChip` (which writes nothing until tapped), below `0.50` is silent. A disagreement between the chosen category's `.type` and Jev's own `detectedType` demotes to a chip regardless of confidence.
- **A late answer never overwrites a manual edit** — `TransactionForm`'s `userTouchedRef` records manual category/type picks and applying a preset sets both.
- **The browser cannot call TypeSafe directly.** The API returns `400 — Disallowed CORS origin` for browser origins, so `api/classify.ts` (a Vercel zero-config Node function) is mandatory, not optional hardening. It owns the Jev question wording and **rejects any client-supplied `instructions`/`criteria`/`model`/`state`/`questions`** — without that, the endpoint is an open relay billed to the project's TypeSafe key.
- **`TYPESAFE_API_KEY` has no `VITE_` prefix** so Vite cannot inline it, and a missing key returns **404** so the client latches off identically to a missing endpoint. `npm run dev` does not serve `api/` at all, which is why the whole feature is inert under the Vite dev server and in Playwright.
- **Do not install `@typesafe-ai/sdk`.** The client is plain `fetch`; adding a dependency would mean touching `manualChunks` and risking ADR `0010`'s `vendor-math` deferral. All new client code lives in the lazy `TransactionForm` chunk — the entry chunk is unchanged.
- **A Vercel function that returns a `Response` must use a named method export (`export async function POST`), never `export default`.** Vercel's Node runtime invokes a *default* export with the legacy `(req, res) => void` signature and **discards the return value**, so a default export returning a `Response` never writes to `res` and the request hangs until the gateway times out — 60s, zero bytes, no error surfaced anywhere but the deployment's runtime log. This shipped once and had to be hot-fixed; it is invisible to `tsc`, to the Playwright suite (which mocks `/api/classify`), and to any probe that calls the handler function directly.
- `api/` is type-checked by its own `api/tsconfig.json`; `npm run lint` runs both configs. Do not add `"types": ["node"]` to the root config — it would let `process`/`Buffer` type-check inside `src/`, where they fail at runtime.
- See `docs/audit/decisions/0011-jev-classification-layering.md`.

## Wallet modal ownership
`WalletPopupModal` (opened only from a wallet card) has exactly 2 tabs — `OVERVIEW` and `TRANSACTIONS` (a 5-row preview with a "View all" handoff to `TransactionsView`, pre-filtered by wallet). It has no TRANSFER or ADD_WALLET tab, and never has had a separate ADJUST tab — the per-wallet balance editor lives inline inside OVERVIEW's wallet card.
- **Transfer and Add-Wallet are owned by 2 shell-level, self-subscribing modals** — `src/components/wallet/TransferFundsModal.tsx` and `AddWalletModal.tsx` — each mounted once in `App.tsx`, following the same pattern `QuickAddModal` established (the modal subscribes to finance state/actions itself; `App.tsx` owns only the `isOpen` boolean and, for transfer, an optional preselected wallet id). Reached identically from `DashboardView` (hero button, wallet-card shortcuts) and `WalletsView` (header button) — `WalletsView` mounts neither modal itself, only calls `onOpenTransfer`/`onOpenAddWallet` props.
- **`AddWalletForm`/`WalletTransferForm`'s only 2 call sites are `AddWalletModal`/`TransferFundsModal`** — not `WalletsView` or `WalletPopupModal` directly.
- **`WalletPopupModal` itself is deliberately *not* promoted to shell level** — unlike Transfer/Add-Wallet, it has no reachability problem to fix: it's only ever triggered by a wallet card, which already lives inside whichever view is mounted. Do not hoist it to `App.tsx` for consistency with `QuickAddModal`/`TransferFundsModal`/`AddWalletModal` without a concrete new reachability requirement.
- See `docs/audit/decisions/0008-wallet-surface-ownership.md`.

## Validation & the MutationResult pattern
All write paths validate with Zod (`src/utils/zodSchemas.ts`) **before** mutating state or hitting the network:

| Schema | Guards |
|---|---|
| `TransactionSchema` | `addTransaction` |
| `WalletSchema` | `addWallet` |
| `DebtSchema` | `addDebt` |
| `DiarySchema` | `upsertDiaryEntry` |
| `CategorySchema` | `addCategory` |
| `KeywordMappingSchema` | `addKeywordRule` (also supplies the trimmed / lower-cased keyword) |
| `AuthLoginSchema` | `AuthModal` sign-in and sign-up |

Conventions:
- Mutating context methods return `MutationResult` (`{ success: boolean; error?: string }`) rather than throwing or failing silently. `addTransaction` extends it with `txId`.
- Format failures with `formatZodIssues(error)` so every call site reports the same way.
- Surface Supabase errors too — do not swallow them behind `if (!error && data)`.
- Callers must keep the form open and populated on failure, and only reset or close on success.
- **Every optimistic write followed by a Supabase call must check the returned `error`, roll back the local state, and compensate any already-committed remote write, before returning its `MutationResult`.** `addTransaction` established this pattern first; Phase 33 (T65–T67) brought `setTransactionDeleted`, `updateWallet`/`deleteWallet`, `settleDebt`/`deleteDebt`, `updateCategory`/`deleteCategory`, `deleteDiaryEntry`, and `deleteKeywordRule` up to the same standard — discarding the Supabase result (no error check, no rollback) leaves local state permanently ahead of cloud state on any rejected write, with nothing telling the user it happened.

## Supabase: required migration for atomic transfers
`supabase/migrations/20260909_transfer_funds.sql` must be applied to any project used for cloud sync. It creates:
- a partial unique index `transactions_user_idempotency_key_uniq` on `(user_id, idempotency_key)` for live rows, and
- `public.transfer_funds(...)`, a `security definer` RPC that locks both wallets, applies **relative** balance updates, and inserts the ledger row in one database transaction, returning `{ reused, transaction, source_balance, dest_balance }`.

Without it, `FinanceContext` falls back to the legacy non-atomic path (three separate round-trips), where a mid-sequence failure can debit the source without crediting the destination. `isMissingRpcError()` deliberately matches **only** a missing-function error (`42883` / `PGRST202`); any other database error must surface and roll back rather than silently taking the fallback.

## Testing
- **Framework**: Playwright with Chromium, Firefox, and WebKit projects.
- **Suite size**: 48 tests across 15 spec files, run on all three browsers = **144 test runs**. All must pass.
- **Location**: `tests/*.spec.ts` (`transaction`, `wallets`, `diary`, `theme`, `wallet-forms`, `debts`, `soft-delete`, `keywords`, `categories`, `csv`, `auth`, `date-boundary`, `storage-persistence`, `presets`, `jev-classify`), with shared helpers in `tests/helpers.ts`.
- **Never edit files while a run is in flight.** `playwright.config.ts`'s `webServer` is `npm run dev` — a live Vite dev server — so writing to `src/` mid-run HMRs the app under test and produces failures that do not reproduce in isolation. This cost a wasted baseline in Phase 39.
- **Network mocking**: `tests/jev-classify.spec.ts` is the only spec that intercepts requests (`page.route('**/api/classify')`). Every response is fulfilled locally, so the suite spends no TypeSafe credits and needs no API key, on CI or locally.
- **Use the helpers**: `gotoTab(page, tabId)` waits for the tab to become active *and* for the `React.lazy` view chunk to resolve (`#view-loading-fallback` detaching). `addQuickTransaction(page, description)` seeds a transaction — a fresh context has wallets and debts but **no transactions**, so any assertion about filtering is vacuous without it.
- **No fixed waits**: never use `page.waitForTimeout()` for debounces or async writes; assert on the resulting UI state so Playwright retries. Never guard a step with `if (await locator.isVisible())` — it does not retry and silently skips the assertion.
- **Timeouts**: `playwright.config.ts` sets generous expect/action timeouts for Firefox, which is slowest to paint a lazy view chunk under the Vite dev server. These bound failures only and do not slow passing runs. `colorScheme` is pinned to `light` so the `system` theme resolves deterministically.
- **Execution**: `npm test`, or `npx playwright test tests/<file>.spec.ts --project=chromium`.
- **CI Mode**: workers set to 1 when `CI=true`; retries enabled on CI.

## Environment / Config
Refer to `.env.example`:
- `VITE_SUPABASE_URL`: Supabase project URL (falls back to local storage if absent).
- `VITE_SUPABASE_ANON_KEY`: Supabase public anon key.
- `GEMINI_API_KEY`: Server-side Gemini API key (for AI Studio host environments).
- `TYPESAFE_API_KEY`: TypeSafe/Jev key, read ONLY by `api/classify.ts`. No `VITE_` prefix, so it never reaches the bundle. Unset = /api/classify 404s and categorization falls back to keyword rules.
- `APP_URL`: Base application URL for redirects and links.
- `DISABLE_HMR`: If `'true'`, disables Vite HMR and file watching to conserve resources in sandboxes.

## Known Constraints or Gotchas
- **Uninstalled Dependencies**: `node_modules` is not committed or pre-installed; run `npm install` or `npm ci` first.
- **Fallback Credentials in `src/lib/supabase.ts`**: Contains hardcoded demo Supabase credentials as fallback; do not commit production secrets here.
- **Tree-Shaken MathJS**: Always import `{ evaluate }` from `mathjs/number`, never full `mathjs`.
- **Client Idempotency**: `FinanceContext.tsx` tracks in-flight transaction keys in a `Set` to prevent double submissions. Transfer forms arm one key per form, reuse it on retry after a failure, and rotate it only on success.
- **Use `generateIdempotencyKey()` from `src/utils/ids.ts`; never call bare `crypto.randomUUID()` directly.** It is `undefined` on an insecure origin — exactly what `npm run dev --host=0.0.0.0` invites from a phone at `http://192.168.x.x:3000`, with no error boundary to catch the resulting white screen. Playwright cannot catch a regression here; it always runs on `localhost`, a secure context.
- **`AnimatedCounter` owns its value span's `textContent` directly; never give that span React children.** It writes `latest.toLocaleString(...)` straight to a ref'd `<span>` inside `animate()`'s `onUpdate`, bypassing `setState` entirely, because a per-animation-frame `setState` was previously the single largest source of React render work in the app (Phase 34, T70; see `docs/audit/decisions/0009-animated-counter-dom-writes.md`). An element with no React children is never touched by reconciliation, which is what lets the direct DOM writes survive between frames and across unrelated parent re-renders — giving it a child would reintroduce the exact cost this decision removed.
- **`QuickAddModal`/`TransferFundsModal`/`AddWalletModal` mount on first open, behind `React.lazy` and a `hasOpened` latch that never resets** (Phase 36, T76; see `docs/audit/decisions/0010-deferred-shell-modal-mounting.md`) — this is what keeps `mathjs`/`vendor-math` (110.72 kB gzip) off the initial critical path. A bare `{isOpen && <Modal/>}` gate does not work as a substitute: it unmounts the wrapper the instant `isOpen` flips false, killing `Modal`'s `AnimatePresence` exit animation and racing `TransferFundsModal`'s delayed-close success flash out of existence before it can render. `AuthModal`/`ReloadPrompt` stay eager on purpose — deferring either buys no bundle weight (`AuthModal`) or delays PWA service-worker registration (`ReloadPrompt`).
- **Dynamic Calculation Inputs**: Amount inputs accept inline arithmetic expressions (e.g., `120/4 + 15*2`) sanitized by regex before evaluation.
- **Two rounding helpers, deliberately different**: `roundToCents` in `FinanceContext.tsx` is plain cent rounding for the ledger; `roundToTwoDecimals` in `mathEvaluator.ts` carries a magnitude-scaled epsilon nudge for half-cent inputs. Do not merge them. `roundToCents` is the only cent-rounding in the ledger — an inlined `Math.round(x*100)/100` at a ledger write site is forbidden; `csvExchange.ts`/`diaryExport.ts`'s own `Math.round(x*100)/100` uses are CSV/diary aggregate math, not ledger rounding, and are not the same rule.
- **`WalletPopupModal` never unmounts**: its parent renders it unconditionally and it returns `null` while closed, so `useState` initialisers run once. Anything derived from its props must be re-synced in the `isOpen` effect. It has exactly 2 tabs (`OVERVIEW`, `TRANSACTIONS`) — see "Wallet modal ownership" above for where Transfer/Add-Wallet actually live.
- **Wallet forms are shared, but not with the views you'd expect**: `AddWalletForm` and `WalletTransferForm` in `src/components/wallet/` are consumed only by the shell-level `AddWalletModal`/`TransferFundsModal` (see "Wallet modal ownership" above) — not by `WalletsView` or `WalletPopupModal` directly, both of which only trigger those modals via callback props. The forms own their draft state; containers pass element ids, field tone, and success callbacks. Edit the shared form component, not one caller.

## Do NOT
- Do NOT import the root `mathjs` package; only import from `mathjs/number`.
- Do NOT bypass the Zod schemas in `src/utils/zodSchemas.ts` on any write path.
- Do NOT perform hard deletions on financial records; update `isDeleted: true` instead.
- Do NOT hardcode production API credentials in `src/lib/supabase.ts` or commit them to version control.
- Do NOT modify the `DISABLE_HMR` handling in `vite.config.ts`.
- Do NOT add redundant state management libraries (Redux, Zustand); use `FinanceContext` and the domain hooks.
- Do NOT introduce a second currency without adding real conversion to the ledger first.
- Do NOT format money or dates inline; use `formatCurrencyAmount` and the `src/utils/date.ts` helpers.
- Do NOT delete or bypass `smartMatcher.ts` / `keyword_rules` in favour of Jev — it is the offline layer and the user's override channel. See ADR `0011`.
- Do NOT let `classifyDescription()` throw, and do NOT give the classifier a code path that can reject.
- Do NOT accept Jev question wording (`instructions`/`criteria`/`model`/`state`/`questions`) from the client in `api/classify.ts`.
- Do NOT add a `VITE_`-prefixed TypeSafe key, or call `api.typesafe.ai` from browser code — it is CORS-blocked regardless.
