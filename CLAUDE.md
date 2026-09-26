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
│   │                    # expressInput, jevClassifier, zodSchemas, csvExchange, walletIcons
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
- **The same rule holds across an `await`: never build a remote write from a ref read after the optimistic `setState` it mirrors.** By the time an `await` resumes, the ref-mirror effect has already moved `debtsRef.current` (etc.) to the optimistic value. `addTransaction` re-read the debt there and subtracted a repayment twice — ฿1,000 off ฿4,500 wrote ฿2,500 to Supabase while the screen showed ฿3,500 (Phase 50, F1, ADR `0022`). Compute once, before any `setState`, and reuse that one value for both the optimistic update and the remote write. ADR `0016`'s `Math.max(0, …)` floor hid it whenever a payment settled the debt, so test a *partial* repayment.

## Transaction entry: one configurable engine
`src/components/TransactionForm.tsx` is the single entry engine for every flow that needs its full shape (EXPENSE/INCOME type toggle, category, wallet, note, math-expression amount). It takes optional `idPrefix`/`presetType`/`lockType`/`presetDebtId`/`presetWalletId`/`onRequestTransfer`/`onRequestRepayDebt` props; passing none reproduces plain default behavior.
- **3 consumers, each a distinct entry point, not a duplicate**: `QuickAddModal` (default, no preset — reached from `Navbar`'s quick-add button and `DashboardView`'s CTA, one shared instance owned by `App.tsx`), `TransactionsView`'s Add Transaction modal (default), `DebtsView`'s repay modal (`lockType`/`presetDebtId` set).
- **New transaction-creating UI should default to reusing `TransactionForm`** via its existing props before writing a new form.
- **The type toggle is EXPENSE/INCOME only (ADR `0013`).** TRANSFER was removed from the form *entirely* — the toggle option, `destinationWalletId`, the "To Wallet" select, and the submit-payload field. `TransferFundsModal`/`WalletTransferForm` is now the app's single transfer surface. Do not re-add a TRANSFER type here.
  - **`DEBT_REPAYMENT` is different and stays.** Only its toggle option went. `presetType="DEBT_REPAYMENT"` is a live configuration with a live caller (`DebtsView`'s repay modal) and full coverage in `debts.spec.ts`; TRANSFER had neither.
  - The `onRequestTransfer`/`onRequestRepayDebt` shortcut row below the submit button is what keeps both flows one tap away. Each link renders **only** when its handler prop is supplied, so a form that cannot reach a destination never shows a dead link.
- **One deliberate, permanent exception** — do not "fix" it by routing it through `TransactionForm`: `WalletPopupModal`'s inline Adjust Balance editor creates an `ADJUSTMENT` transaction via a bespoke one-field form. Forcing it through `TransactionForm` would surface a type toggle and category field the user has no reason to touch for a balance reconciliation.
- `useDebts().repayDebt`/`FinanceContext.tsx`'s `repayDebtAtomic` were removed entirely (Phase 33, T64) after confirming zero call sites outside their own definitions — `DebtsView`'s repay modal calls `addTransaction` directly through `TransactionForm`, since the debt decrement/auto-settle logic lives inside `addTransaction` itself, not in a separate repayment code path. Do not reintroduce a second repayment code path.
- See `docs/audit/decisions/0007-transaction-entry-consolidation.md` and `0013-express-transaction-entry.md`.

## Express note entry: the note drives the form
The note field is the **first** field and seeds the amount below it (ADR `0013`). `parseExpressInput` (`src/utils/expressInput.ts`) pulls a trailing (`ข้าวมันไก่ 60`), leading (`1200 ค่าไฟ`) or whole-text (`120/4`) amount out of the note.
- **A manual edit to the amount field permanently disables extraction for that entry.** `InlineMathInput`'s `onUserEdit` fires on typing, the quick-amount chips, the operator buttons and apply-result — never on a programmatic `seed` push — and sets `userTouchedRef.current.amount`. **This is load-bearing, not a preference**: `csv.spec.ts`, `soft-delete.spec.ts` and `presets.spec.ts` all fill the amount by hand and *then* type a note ending in six digits (`E2E CSV RoundTrip 123456`), asserting on amounts and wallet balances. Weaken this rule and three spec files fail on values at once.
- **The ledger stores the note exactly as typed; only the classifier sees the stripped text.** `ข้าวมันไก่ 60` is saved whole and classified as `ข้าวมันไก่`. Stripping at the write path is lossy and would let a mis-parse corrupt the note too.
- **Re-seed the amount via `InlineMathInput`'s `seed: {key, value}` prop, never a remounting `key`.** `defaultValue` is only honoured while the field is empty, and remounting on every keystroke discards focus and error state.
- **Requiring a whitespace boundary before a trailing number is what makes extraction safe** — it is what stops `7-11`, `Tx-123` and `iphone15` from being harvested. The known false positive is `lunch for 4` → ฿4, visible and one keystroke to fix.
- **`matchSmartDescription` is deliberately untouched by this.** The new parser is a separate util: `KeywordRulesView` surfaces the matcher's own `extractedAmount`/`cleanDescription` through the `metric-*` testids and `tests/keywords.spec.ts` asserts on exactly that leading-only behavior.
- **There is no "Edit details" collapse.** The wallet and category selects are always mounted, and the `Auto-categorized: <name>` badge sits on the **Category** label — the field it wrote — so overriding a guess is one click. Do not reintroduce a collapse that unmounts either select.

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
- `api/` is type-checked by its own `api/tsconfig.json`; `npm run lint` runs both configs. Do not add `"types": ["node"]` to the root config.
  - **That guard is not currently in force, so do not rely on `tsc` to catch `process`/`Buffer` in `src/`** (found in Phase 50). `@types/papaparse` carries `/// <reference types="node" />` and `csvExchange.ts` imports papaparse, so Node globals are already in the root program — a triple-slash reference is not filtered by the `types` array. A `process` reference in `src/` type-checks and then fails in the browser. Closing it (a lint rule, or a `src/`-only config) is open work.
- **Both proxies pass an upstream 429 through as 429** (ADR `0022`, amending `0011`); 401 maps to 502 and every other upstream failure to 503. 429 is the only status `batchClassifier` backs off on, so mapping it away makes the backoff unreachable in production. The upstream body is never forwarded. `unit/proxy-contract.test.ts` pins the mapping, the forbidden keys and the 404-on-missing-key by calling the exported `POST` handlers directly.
- **A category's `description` is what Jev actually sees.** `api/classify.ts` renders each option as `"<name>: <description>"`, falling back to the bare name. Sending bare names is what made `Netflix subscription` classify as the `other` escape option at 0.93 — a correct answer to a badly posed question. Keep the shipped `DEFAULT_SYSTEM_CATEGORIES` descriptions concrete and situational (what belongs here), never instructional ("always pick this").
- **`description: undefined` and `description: ''` are different values.** `undefined` means never set, and `withDefaultDescriptions` (`src/utils/categoryUtils.ts`) backfills the shipped default on every load, matched by **name** — not id, because authenticated rows carry uuids. `''` means the user cleared it and is never refilled. Seeding deliberately does not write descriptions to Supabase, so the column holds only what a user typed and an improved default still reaches existing accounts.
- See `docs/audit/decisions/0011-jev-classification-layering.md` and `0012-category-descriptions-as-criteria.md`.

## Wallet modal ownership
`WalletPopupModal` (opened only from a wallet card) has exactly 2 tabs — `OVERVIEW` and `TRANSACTIONS` (a 5-row preview with a "View all" handoff to `TransactionsView`, pre-filtered by wallet). It has no TRANSFER or ADD_WALLET tab, and never has had a separate ADJUST tab — the per-wallet balance editor lives inline inside OVERVIEW's wallet card.
- **Transfer and Add-Wallet are owned by 2 shell-level, self-subscribing modals** — `src/components/wallet/TransferFundsModal.tsx` and `AddWalletModal.tsx` — each mounted once in `App.tsx`, following the same pattern `QuickAddModal` established (the modal subscribes to finance state/actions itself; `App.tsx` owns only the `isOpen` boolean and, for transfer, an optional preselected wallet id). Reached identically from `DashboardView` (hero button, wallet-card shortcuts) and `WalletsView` (header button) — `WalletsView` mounts neither modal itself, only calls `onOpenTransfer`/`onOpenAddWallet` props.
- **`AddWalletForm`/`WalletTransferForm`'s only 2 call sites are `AddWalletModal`/`TransferFundsModal`** — not `WalletsView` or `WalletPopupModal` directly.
- **`WalletPopupModal` itself is deliberately *not* promoted to shell level** — unlike Transfer/Add-Wallet, it has no reachability problem to fix: it's only ever triggered by a wallet card, which already lives inside whichever view is mounted. Do not hoist it to `App.tsx` for consistency with `QuickAddModal`/`TransferFundsModal`/`AddWalletModal` without a concrete new reachability requirement.
- See `docs/audit/decisions/0008-wallet-surface-ownership.md`.

## Transfers: the preview must mirror the ledger
`WalletTransferForm` renders a live source → destination balance preview (ADR `0014`).
- **It shares `roundToCents` with the ledger.** That helper lives in `src/utils/money.ts` and is imported by both `FinanceContext.tsx` and the transfer form, so what the user is shown before consenting is computed by the same function that commits. Do not give the UI its own rounding, and do not merge it with `mathEvaluator`'s `roundToTwoDecimals`.
- **The preview mirrors `addTransaction`'s TRANSFER arithmetic.** If the transfer path ever stops going through `addTransaction`, the preview drifts silently — there is no test that would catch a divergence in the formula itself.
- **The two wallet `<select>`s must stay real, visible form controls.** `tests/wallet-forms.spec.ts` asserts visibility and reads `.inputValue()`; replacing them with cards is not a locator move and the spec-edit policy forbids it. That spec is the transfer flow's regression guard — it passed unedited through the Phase 42 redesign.
- **Overdraft warns, never blocks.** A `CREDIT_CARD` wallet legitimately carries a negative balance, so `canSubmit` deliberately ignores the projection. Pinned by `tests/transfer-preview.spec.ts`.
- **Do not use `AnimatedCounter` for the projected balance.** It animates from 0 on mount and re-tweens on every keystroke, and ADR `0009` forbids giving its span React children.

## Debt repayment: the payoff block mirrors the ledger
`TransactionForm` renders a payoff block under the amount input whenever the type is `DEBT_REPAYMENT` and a target debt resolves (ADR `0015`). It holds the quick-payoff chips, the projected remaining balance, and a `ProgressMeter`.
- **It shares `roundToCents` with the ledger**, exactly as the transfer preview does. `Math.max(0, roundToCents(remaining - amount))` is `addTransaction`'s own DEBT_REPAYMENT arithmetic; the percentage mirrors `DebtCardItem`'s with its `isSettled ? 0 : remaining` branch collapsed. Do not give the UI its own rounding.
- **`ProgressMeter` clamps its own bar; the printed percentage does not get that for free.** The Add Debt form permits `remaining > total`, so the displayed number carries its own `Math.min(100, Math.max(0, …))`.
- **A repayment cannot exceed what is owed, at either layer (ADR `0016`, amending `0015`).** `addTransaction` rejects it with a `MutationResult` error before any mutation, and the form disables submit and names the maximum. The guard's position in `addTransaction` is load-bearing: **after** the `existingTx` replay check (or retrying a payment that settled its debt gets rejected) and **before** `inFlightIdempotencyKeys.add` (or the key leaks and, since `useIdempotencyKey` reuses it on retry, the form is bricked). The `Math.max(0, …)` floors stay as defence against a stale-`debtsRef` race, not as dead code.
- **`isOverpaying` must test `repayTargetDebt !== null`.** On a non-debt form `remainingDebt` falls back to 0, so `overpayment` equals the whole amount — feeding that into the submit gate without the null check disables **every** EXPENSE and INCOME submission in the app. Covered by its own regression test.
- **Soft-delete and restore move the debt with the wallet.** `setTransactionDeleted` reverses the decrement on delete and reapplies it on restore, recomputing `isSettled` both ways. Before ADR `0016` it did neither, so deleting a repayment refunded the wallet and kept the debt reduction — free money, repeatable. The reversal is deliberately **uncapped**, so a legacy overpaid row can push `remainingAmount` above `totalAmount`; both progress clamps absorb it.
- **`settleDebt` is deliberately exempt** — it zeroes a debt with no wallet debit and no ledger row, as a "written off / paid outside the app" affordance. Documented in ADR `0016` so a later audit finds a decision, not an oversight.
- **The chips seed through `#repay-amount-math`, never replace it.** That id, `#repay-wallet-select` and `#confirm-repay-btn` are the entire surface of `tests/debts.spec.ts`, the repayment flow's regression guard — it passed unedited through this phase and should stay that way.
- **A chip latches the amount field.** `InlineMathInput`'s `seed` effect deliberately never fires `onUserEdit`, so `seedPayoffAmount` sets `userTouchedRef.current.amount` itself. A chip is an explicit choice of amount and outranks the note parser from that point on — the same rule as typing in the field by hand (ADR `0013`).
- **The block stays mounted with no amount typed**, deliberately unlike the transfer preview. `presetDebtId` suppresses the Debt Target select, so this is the only place the debt's remaining balance appears in the repay modal at all.
- **Do not use `AnimatedCounter` for the projection** — same reasons as the transfer preview.

## Smart rules: the form offers one, it never writes one unasked
`TransactionForm` renders a `SaveRuleChip` under the Category select offering to remember a categorization the user just made by hand (ADR `0017`). It is the second writer of `keyword_rules`, after `CategoriesView`'s own form.
- **Five conditions gate the offer, all derived on render** — the same no-effect, no-debounce shape as the debt payoff block. In order, cheapest first: `!lockType`; the selected category resolves *and its `type` matches the form's*; `userTouchedRef.current.category` is set; no existing rule matches the text; the keyword is 3–32 characters.
- **The category `<select>` is unfiltered**, so an EXPENSE can be filed under an INCOME category. A rule built from that would flip the type on every future match, which is why a type mismatch suppresses the offer rather than being ignored.
- **"No existing rule matches" is an invariant, not a politeness.** `addKeywordRule` does **not** dedupe. Relax that condition and this surface writes a second rule with the same keyword, which wins by prepend while the older one lingers in the Categories list with nothing marking it dead. The same reasoning is why the Save button is disabled in flight — a double-tap on an authenticated round-trip writes two identical rules.
- **The 3-character floor is load-bearing.** `matchSmartDescription` matches with `lower.includes(kw)`, so a one- or two-character rule captures nearly every future note and nothing on screen connects the symptom to the cause. Outside the 3–32 band the chip does not render; it **never truncates to fit**.
- **The keyword is `parseExpressInput(...).cleanDescription`, verbatim.** `7-eleven snacks 45` saves `7-eleven snacks`. This mirrors ADR `0013`'s existing split — the ledger stores the note as typed, only the classifier layers see the stripped text, and a rule is a classifier artifact.
- **The saved confirmation is transient-flash state, not derived.** A successful save lands in `keywordRules`, which makes condition 4 false on the very next render, so a derived confirmation would be erased by its own success. It renders *instead of* the offer, never gated by it.
- **`applySuggestion` latches `userTouchedRef.current.category` when `force` is set.** Tapping Apply on the mid-confidence chip is a manual pick and outranks a later classification, which is what this file already claimed and the code did not do until ADR `0017`.
- **Nothing in the submit path reads or waits on any of it.** The chip is a sibling of the category field, not a step in the write — saving, dismissing or ignoring it cannot affect whether or when a transaction is recorded. Do not make the rule write a precondition of the transaction write.
- **A post-submit prompt is not available here.** All three consumers close their modal on a successful write, which is also why `TransactionForm`'s `✓ Transaction successfully logged!` line is effectively dead. Do not add post-submit UI to this form without changing that first.

## Voice input: the transcript is typing
`TransactionForm` renders a mic button inside the note field; its transcript goes through `handleDescriptionChange` — the same function `onChange` calls (ADR `0018`).
- **Voice has no pipeline of its own, and must not get one.** Amount extraction, the keyword matcher, Jev's arming, the auto-categorized badge and ADR `0017`'s rule chip all work because none of them can tell a spoken note from a typed one. A voice-specific path would re-implement ADR `0011`'s ordering and ADR `0013`'s latch in a second place, where they would drift.
- **That includes the manual-amount latch.** A transcript ending in digits cannot overwrite an amount the user typed by hand, because `userTouchedRef.current.amount` is checked inside that same function. Pinned by its own test with its own negative control.
- **Support detection is two conditions**: a constructor **and** `window.isSecureContext`. `npm run dev --host=0.0.0.0` invites the app onto a phone at `http://192.168.x.x:3000`, where the constructor exists but recognition cannot run — a constructor-only check renders a button that fails on tap, on exactly the device this is for. Playwright cannot catch it; it always runs on localhost.
- **Dictation appends to whatever was in the note, never replaces it.** This form has no undo and the mic sits inside the field it would wipe.
- **The transcript handler is deliberately not memoized.** `handleDescriptionChange` closes over `keywordRules`, which the rule chip mutates mid-session, so a `useCallback([])` would match transcripts against a stale rule set. The hook mirrors the callback into a ref, so a fresh identity each render is free.
- **A blocked microphone disables the button with a reason; it does not hide it.** A button that vanishes the instant it is tapped is worse than one that explains itself. `network` errors deliberately do **not** latch — same reasoning as `jevClassifier`'s.
- **The three test browsers disagree**: chromium ships the API, firefox and webkit do not. Every voice test installs or removes it via `addInitScript` before `goto` and relies on native support for nothing. That is an init script, not `page.route`, so `jev-classify.spec.ts` remains the only spec intercepting requests.

## CSV import: the same two layers, before anything commits
The importer runs `smartMatcher` then Jev, in that order, and shows the result in the dry-run preview before a single row is written (ADR `0019`).
- **Layer 1 runs as the preview is built** — synchronous, free, zero network. **Layer 2 runs only when the user presses `#csv-classify-btn`.** No CSV upload spends TypeSafe credits before the user asks for it, and that button not being pressed *is* the "skip when offline" affordance.
- **De-duplicate before dispatch, never via the cache alone.** The classifier's LRU cache fills on response, so concurrent workers on identical descriptions all miss it and all dispatch — a stampede that turned 40 identical merchant rows into 40 requests. `batchClassifier` groups by `normalizeText` (exported from `jevClassifier` for exactly this, so grouping and the cache key cannot drift) and fans one answer out to the group.
- **`classifyDescription`'s signature and behaviour are frozen.** It is a thin wrapper over `classifyOnce`, kept so the live-typing path's three call sites and `jev-classify.spec.ts` need no edit. A caller wanting to know *why* a call failed uses `classifyOnce`, which reports `ok` / `no-answer` / `rate-limited` / `unavailable` / `failed`.
- **AI never writes a row's `type`**, because `type` drives the wallet debit direction in `commitBulkImport`. A category whose type disagrees with the row's is demoted to a suggestion, never applied.
- **Only `categoryId` reaches the ledger.** `ImportRowValidation` is the commit payload; confidence and applied/suggested state are preview-only and live in a view-level map. `commitBulkImport` prefers `categoryId` and falls back to the name lookup for a plain CSV.
- **Concurrency is capped at 4**, which is the real rate-limit protection; `rate-limited` backs off twice, `unavailable` aborts the whole run rather than walking the rest into a dead endpoint.
- **`commitBulkImport` returns a `MutationResult` and moves no money on a failed insert** (ADR `0022`). The insert's error is checked before any balance write; balance writes run sequentially so a failure knows which landed; a half-applied import restores the written wallets and **soft**-deletes the inserted rows. `TransactionsView` keeps the preview open on failure (`#import-commit-error`) and disables `#commit-import-btn` while a commit is in flight, with a ref latch for a double-tap that beats the state update. That latch is an in-flight guard, **not** dedupe.
- **A too-short CSV note skips its row, never the run.** `isClassifierWorthTrying` is false both for run-wide conditions and for one note under `MIN_CLASSIFIABLE_LENGTH`; `batchClassifier` checks the length first, so a single one-character description cannot report the endpoint unavailable.
- **There is no import deduplication, deliberately.** The idempotency key embeds `Date.now()` so it never collides, and `csv.spec.ts` asserts a re-imported row appears twice. Do NOT add dedupe without deciding first what "the same transaction" means across two files — and without updating that spec.

## Monthly insights: the model judges, the app states the numbers
`SpendingInsightsCard` on the Dashboard turns a month of spending into two or three sentences (ADR `0020`). There is no Analytics view and none was created.
- **Jev answers `choice` questions, so the wrap-up is not generated text.** The model picks a `pattern` (`CATEGORY_SPIKE`/`IMPROVED_SAVING`/`NEW_RECURRING`/`STEADY`) and a `focus` category; `renderInsight` writes the sentences from that verdict plus the app's own figures. **Every ฿ amount comes from `formatCurrencyAmount` over ledger data** — a model-emitted number could contradict `CategoryExpenseDistribution` sitting beside it.
- **Only aggregates leave the device.** No transaction description, no `rawInput`, no id of any kind, no wallet name, no individual amount or date. Category *names* and per-category totals do go, because an id means nothing to a model — the residual is recorded in ADR `0020`, and `tests/insights.spec.ts` asserts the request body carries no ledger text.
- **The card has no error state, by construction.** `fetchInsight` never throws and never rejects; every failure resolves to `selectLocalPattern`'s verdict through the *same* renderer, marked quietly as an offline summary. Do not add an error branch — there is no failure path to render.
- **One cache reader.** The card seeds itself synchronously from `readCachedVerdict` in its `useState` initializer; `fetchInsight` deliberately does **not** read the cache. A second reader there was unreachable duplication, which a negative control exposed.
- **`api/insights.ts` uses a named `POST` export**, rejects `instructions`/`criteria`/`model`/`state`/`questions`, and returns **404 on a missing key** so an unconfigured deployment trips the same availability latch as a missing endpoint. A default export would hang for 60 s, invisibly to `tsc` and to the suite.
- **The pattern vocabulary is fixed and coupled.** Adding a fifth means changing the server's criteria, `InsightPattern` and the renderer together — that coupling is what stops the model returning a verdict the renderer cannot express.

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
- Callers must keep the form open and populated on failure, and only reset or close on success. `commitBulkImport` follows this too: it returns `MutationResult & { insertedCount; totalAmount; skippedCount }`, and `insertedCount` is the number of rows the insert actually returned.
- **`loadSupabaseData` bumps `cloudRevisionRef` only when every read succeeded.** That counter is how an in-flight write detects a reload underneath it (T69). A reload that read nothing is not new server truth, and bumping for it disarmed the write's rollback, leaving an optimistic debit on screen for money that never moved (Phase 50, F6). Failed reads are logged by table; a slice that did load still applies.
- **Every optimistic write followed by a Supabase call must check the returned `error`, roll back the local state, and compensate any already-committed remote write, before returning its `MutationResult`.** `addTransaction` established this pattern first; Phase 33 (T65–T67) brought `setTransactionDeleted`, `updateWallet`/`deleteWallet`, `settleDebt`/`deleteDebt`, `updateCategory`/`deleteCategory`, `deleteDiaryEntry`, and `deleteKeywordRule` up to the same standard — discarding the Supabase result (no error check, no rollback) leaves local state permanently ahead of cloud state on any rejected write, with nothing telling the user it happened.

## Supabase: required migrations
**`supabase/migrations/20260923_add_category_description.sql` must be applied before any build that writes `Category.description` is deployed.** It adds one nullable `description text` column to `public.categories`. PostgREST rejects an unknown column outright (`PGRST204`) rather than ignoring it, so deploying first makes `addCategory`/`updateCategory` fail for every authenticated user until the column exists. Local-storage mode is unaffected. Apply a schema migration *before* pushing the code that depends on it, never after.

### Atomic transfers
`supabase/migrations/20260909_transfer_funds.sql` must be applied to any project used for cloud sync. It creates:
- a partial unique index `transactions_user_idempotency_key_uniq` on `(user_id, idempotency_key)` for live rows, and
- `public.transfer_funds(...)`, a `security definer` RPC that locks both wallets, applies **relative** balance updates, and inserts the ledger row in one database transaction, returning `{ reused, transaction, source_balance, dest_balance }`.

Without it, `FinanceContext` falls back to the legacy non-atomic path (three separate round-trips), where a mid-sequence failure can debit the source without crediting the destination. `isMissingRpcError()` deliberately matches **only** a missing-function error (`42883` / `PGRST202`); any other database error must surface and roll back rather than silently taking the fallback.

## Testing
Two suites, with a hard boundary between them — see "Unit tests" below for why the boundary is pinned from both sides.
- **Framework**: Playwright with Chromium, Firefox, and WebKit projects.
- **Suite size**: 107 tests across 22 spec files, run on all three browsers = **321 test runs**. All must pass.
- **Location**: `tests/*.spec.ts` (`transaction`, `wallets`, `diary`, `theme`, `wallet-forms`, `debts`, `soft-delete`, `keywords`, `categories`, `csv`, `auth`, `date-boundary`, `storage-persistence`, `presets`, `jev-classify`, `express-input`, `transfer-preview`, `debt-repayment`, `smart-rules`, `voice-input`, `csv-classify`, `insights`), with shared helpers in `tests/helpers.ts`.
- **Never edit files while a run is in flight.** `playwright.config.ts`'s `webServer` is `npm run dev` — a live Vite dev server — so writing to `src/` mid-run HMRs the app under test and produces failures that do not reproduce in isolation. This cost a wasted baseline in Phase 39.
- **Network mocking**: the rule is a **principle, not a file count** — every spec that intercepts a request must fulfil every response locally, so the suite spends no TypeSafe credits and needs no API key, on CI or on a laptop that happens to have one exported. Three specs currently rely on it: `tests/jev-classify.spec.ts` (live typing), `tests/csv-classify.spec.ts` (bulk import) and `tests/insights.spec.ts` (the monthly wrap-up). Adding a fourth is fine if it meets the principle; ADR `0020` generalised this after `0019` had amended it from one spec to two. `tests/voice-input.spec.ts`'s `addInitScript` Speech API stub is a different mechanism and intercepts nothing.
- **Use the helpers**: `gotoTab(page, tabId)` waits for the tab to become active *and* for the `React.lazy` view chunk to resolve (`#view-loading-fallback` detaching). `addQuickTransaction(page, description)` seeds a transaction — a fresh context has wallets and debts but **no transactions**, so any assertion about filtering is vacuous without it.
- **No fixed waits**: never use `page.waitForTimeout()` for debounces or async writes; assert on the resulting UI state so Playwright retries. Never guard a step with `if (await locator.isVisible())` — it does not retry and silently skips the assertion.
- **Timeouts**: `playwright.config.ts` sets generous expect/action timeouts for Firefox, which is slowest to paint a lazy view chunk under the Vite dev server. These bound failures only and do not slow passing runs. `colorScheme` is pinned to `light` so the `system` theme resolves deterministically.
- **Execution**: `npm test`, or `npx playwright test tests/<file>.spec.ts --project=chromium`.
- **CI Mode**: workers set to 1 when `CI=true`; retries enabled on CI.

## Unit tests: what the browser cannot reach
`npm run test:unit` runs Vitest over **`unit/`** — 134 tests in 6 files, ~3 s (ADR `0021`, extended by `0022`). It exists because four phases in a row closed with a coverage hole for the same structural reason, not because E2E coverage was thin.
- **The directory is `unit/`, not `tests/unit/`, and that is load-bearing.** Two default globs collide. Vitest's default `include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)`, which collects all 22 Playwright specs. Playwright's default `testMatch` is `**/*.@(spec|test).?(c|m)[jt]s?(x)` — note `@(spec|test)` — which collects `*.test.ts` as readily as `*.spec.ts`. So the boundary is pinned three times: a directory `testDir: './tests'` cannot see, an explicit `include` in `vitest.config.ts`, and an explicit `testMatch: '**/*.spec.ts'` in `playwright.config.ts`. The last is redundant today **on purpose** — it makes a future move of the unit tests under `tests/` read as the breaking change it is.
- **`vitest.config.ts` is its own file, never a `test` key on `vite.config.ts`.** `vite build` does not read it, which makes zero production bundle impact structural rather than a matter of discipline.
- **`environment: 'node'` is the default; the two DOM suites opt in per file** with a `// @vitest-environment jsdom` docblock. The pure-module suites never touch jsdom's `AbortSignal`, `fetch` or timer surfaces, which differ from Node's in ways that fail about the environment rather than the code.
- **The six suites cover exactly what Playwright structurally cannot**: `ledger-guards` (the repayment guard's *ordering* — key leak, replay precedence — which has no UI symptom at all), `speech-support` (the `isSecureContext` branch; Playwright always runs on localhost), `batch-classifier` (a fabricated 429 and a controllable clock), `spending-summary` (threshold boundaries the transaction form cannot seed precisely), `authenticated-ledger` (the signed-in branch of every write — no spec signs in), `proxy-contract` (the `api/` handlers themselves — every spec mocks `/api/*` at the network layer).
- **`ledger-guards.test.tsx` mounts the real `FinanceProvider`** and calls the real actions. The provider is inert under test: its auth effect returns early on `!isSupabaseConfigured` and its realtime channel on `!isAuthenticated`, so there is no network call and no WebSocket. Do NOT extract the ledger arithmetic into a pure module to make it "more testable" — extraction cannot test ordering, which is the part that broke.
- **`authenticated-ledger.test.tsx` is the signed-in harness, and it differs from `ledger-guards` on purpose** (ADR `0022`). It replaces `src/lib/supabase` with `vi.mock` (`isSupabaseConfigured: true`, a recording chainable fake with per-table/op error injection and gates), so no `src/` export exists for it. Two properties are load-bearing: every fake call settles on a **macrotask** (`setTimeout(0)`), and actions run **without `act()`** (`IS_REACT_ACT_ENVIRONMENT = false`, state read via `waitFor`). `act()` flushes React before the awaited code resumes, which made F1's double write come out correct — under `act()` the test passed against the bug. Its `beforeEach` waits for `isSyncing === false`, not just for rows to appear; waiting on rows alone raced.
- **Nothing in `src/` was widened to be testable.** `detectSupport`/`toSpeechError` stay module-private and are driven through the hook's public `isSupported`/`error`. Keep it that way: an export added only for a test is a claim the module does not otherwise make.
- **CI runs it before `npx playwright install`**, so a unit failure aborts in seconds without downloading three browsers.
- **Two behaviours are pinned as-is with the discrepancy recorded, not "fixed"**: `batchClassifier`'s backoff is `BASE_BACKOFF_MS * attempt` — **linear**, and with `MAX_ATTEMPTS` at 2 there is exactly one 400 ms wait, so linear-vs-exponential is unobservable from outside. And `useSpeechRecognition`'s `start()` checks only for a constructor, never `isSupported`, so on an insecure origin it arms a session that cannot run — unreachable only because `TransactionForm` renders the mic behind `{isVoiceSupported && ...}`.

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
- Do NOT re-add a TRANSFER option to `TransactionForm`'s type toggle, or reintroduce an "Edit details" collapse that unmounts the category/wallet selects — see ADR `0013`.
- Do NOT let the note parser overwrite an amount the user typed by hand; `userTouchedRef.current.amount` is what three spec files depend on.
- Do NOT give the debt payoff preview its own rounding, and do NOT let a debt repayment exceed the remaining balance at any layer — see ADR `0016`.
- Do NOT let the smart-rule chip write a rule without an explicit tap, and do NOT relax its "no existing rule matches" condition while `addKeywordRule` has no dedupe — see ADR `0017`.
- Do NOT make a rule write a precondition of a transaction write; the chip is a sibling of the submit path, not a step in it.
- Do NOT give voice input a pipeline of its own; a transcript goes through `handleDescriptionChange` so every layer treats it as typing — see ADR `0018`.
- Do NOT feature-detect `SpeechRecognition` without also checking `window.isSecureContext`, and do NOT let dictation replace text already in the note.
- Do NOT let the CSV importer classify automatically on upload, and do NOT rely on the classifier cache to collapse repeated rows — de-duplicate before dispatch. See ADR `0019`.
- Do NOT widen `classifyDescription`'s contract; extend `classifyOnce` instead.
- Do NOT add CSV import deduplication without a decision on what "the same transaction" means; `csv.spec.ts` currently asserts its absence.
- Do NOT let a model emit a currency figure; it picks the pattern, `renderInsight` states the numbers — see ADR `0020`.
- Do NOT send raw ledger content to `/api/insights`, and do NOT give the insights card an error branch; the offline path is the same renderer.
- Do NOT delete or bypass `smartMatcher.ts` / `keyword_rules` in favour of Jev — it is the offline layer and the user's override channel. See ADR `0011`.
- Do NOT let `classifyDescription()` throw, and do NOT give the classifier a code path that can reject.
- Do NOT accept Jev question wording (`instructions`/`criteria`/`model`/`state`/`questions`) from the client in `api/classify.ts`.
- Do NOT add a `VITE_`-prefixed TypeSafe key, or call `api.typesafe.ai` from browser code — it is CORS-blocked regardless.
- Do NOT put unit tests under `tests/`, and do NOT remove either collection pin (`include` in `vitest.config.ts`, `testMatch` in `playwright.config.ts`) — each runner's default glob collects the other's files. See ADR `0021`.
- Do NOT move Vitest config onto `vite.config.ts`; a separate `vitest.config.ts` is what keeps the test toolchain structurally unable to reach the production build.
- Do NOT export a symbol from `src/` solely to make it unit-testable — drive it through the public surface, as `speech-support.test.tsx` does with `detectSupport`.
- Do NOT add a fifth request-intercepting Playwright spec for something a unit test can reach; `unit/` is where a fabricated network condition or a controlled clock belongs.
- Do NOT test a ref-mirror, ordering or post-`await` property under `act()` — `act()` hides exactly that bug class. Put it in `authenticated-ledger.test.tsx`, which runs without it, and run it against the unfixed code first.
- Do NOT build a remote write from a ref read after an `await` that follows the optimistic `setState`; compute the value once, up front, and reuse it — see ADR `0022`.
- Do NOT apply balance changes after a failed insert in `commitBulkImport` or any other write, and do NOT map an upstream 429 to anything but 429 in `api/`.
