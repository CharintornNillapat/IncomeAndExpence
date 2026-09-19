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
├── public/              # PWA icons (192px, 512px, SVG) and robots.txt
├── supabase/migrations/ # SQL migrations (transfer_funds RPC + idempotency index)
├── src/
│   ├── components/      # Reusable UI components, modals, and navigation
│   │   ├── dashboard/   # Dashboard-specific summary and metric cards
│   │   └── wallet/      # Shared wallet forms (AddWalletForm, WalletTransferForm)
│   ├── context/         # FinanceContext.tsx (monolithic app state, local fallback, Supabase sync)
│   ├── hooks/           # Domain hooks (useTransactions, useWallets, useDebts, useTheme)
│   ├── lib/             # Supabase client setup (supabase.ts)
│   ├── utils/           # Pure helpers: currency, date, mathEvaluator, smartMatcher,
│   │                    # zodSchemas, csvExchange, walletIcons
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
- `npm run lint` : `tsc --noEmit`
- `npm test` : `playwright test`

## Coding Conventions
- **Component Pattern**: Functional components with TypeScript interfaces; named exports for views and helper components.
- **Naming**: PascalCase for components (`TransactionForm.tsx`), camelCase for hooks and utilities (`useTheme.ts`, `mathEvaluator.ts`), SCREAMING_SNAKE_CASE for enum/union values (`INCOME`, `EXPENSE`, `BANK_ACCOUNT`).
- **Imports**: Relative paths only — there is no `@/*` alias. Explicit `.tsx` extensions are supported and used in imports.
- **Styling**: Tailwind CSS v4 utility classes. Warm neutral aesthetic based on `stone-*` palette. Dark mode uses `.dark` class, `data-theme="dark"`, and `colorScheme`.
- **Form styles**: Labels, text/number/select inputs, error banners, and primary/secondary buttons come from `src/utils/formStyles.ts` (`LABEL_CLASS`/`LABEL_TEXT_CLASS`, `inputClass(tone)`, `selectClass(tone)`, `OPTION_CLASS`, `ERROR_BANNER_CLASS`, `PRIMARY_BUTTON_CLASS`/`PRIMARY_BUTTON_COMPACT_CLASS`, `SECONDARY_BUTTON_CLASS`) instead of a re-typed Tailwind string — but only where a field's styling actually matches one of those shapes. A field with a genuinely different padding scale, font size, or color stays inline (e.g. `WalletPopupModal`'s compact inline editors, `TransactionsView`'s `min-h-[44px]` touch-target filter bar, `AuthModal`/`TransactionForm`'s larger `text-sm` inputs) — forcing it through the shared class would be a visual regression, not a cleanup. See `docs/audit/refactor-log.md` Phase 17 for the audited exceptions.
- **Lookup maps**: Build an id→entity `Map` with `buildLookupMap(items)` from `src/utils/mapUtils.ts` rather than writing `new Map(items.map(x => [x.id, x]))` inline. This covers only the id→full-item shape — a map keyed by something other than `id`, or valued by a single field instead of the whole item (e.g. id→name in `csvExchange.ts`, `useTransactions.ts`), is a different shape and stays as its own inline `new Map(...)`.
- **Modals**: Use the shared `src/components/Modal.tsx` primitive (`isOpen`/`onClose`, `title`/`subtitle` or a `header` override slot, optional `footer`) for any dialog or mobile bottom sheet — never hand-roll a backdrop + panel + `AnimatePresence` combination. It owns the overlay fade, spring panel animation, mobile bottom-sheet layout, Escape-to-close, and `role="dialog"`/`aria-modal`/`aria-labelledby`.
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
- Canonical state lives in `src/context/FinanceContext.tsx`, split into two contexts: `FinanceStateContext` (plain state only — wallets, transactions, debts, categories, diary entries, sessions) and `FinanceActionsContext` (every mutator, including `addTransaction`/`softDeleteTransaction`/`restoreTransaction`/`commitBulkImport`/`repayDebtAtomic`/`upsertDiaryEntry` — the ones that touch hot state read it via a ref mirror (`walletsRef`/`transactionsRef`/`debtsRef`/`categoriesRef`/`diaryEntriesRef`) instead of a closure over the state value, so the actions context stays genuinely stable). Consume them via `useFinanceState()` and `useFinanceActions()`. Optimistic updates with rollback snapshots on network failure.
- **There is no combined `useFinance()` shim** — it existed only during the state-context split and was deleted once every consumer migrated to `useFinanceState()`/`useFinanceActions()`. Do not reintroduce one; a merged `{ ...state, ...actions }` object hands every consumer a fresh identity on every render, which is the exact churn the split removes.
- **No component above view level subscribes to finance state.** `App.tsx`'s `MainApp` and the shell it renders (`Navbar`, the swipe wrapper, `MobileBottomNav`, `AuthModal`) call neither `useFinanceState()` nor `useFinanceActions()`. A piece that needs finance data (e.g. the quick-add modal) subscribes to it itself, so a financial write re-renders only the piece that actually needs the new data — never the whole app shell.
- **Views should consume the domain hooks in `src/hooks/` rather than `useFinanceState()`/`useFinanceActions()` directly** where one fits:
  - `useTransactions(options)` — filtering (wallet, category, type, date range, search across description / amount / rawInput / category name / wallet name), aggregate metrics, and the transaction write actions.
  - `useWallets()` — `wallets` (active only), `allWallets` (includes soft-deleted, for resolving historic names), `totalNetWorth`, `walletsByType`.
  - `useDebts()` — active/settled splits and `metrics` (totals, `progressPercent`, counts).
- `useFinanceState()`/`useFinanceActions()` are still correct for state no hook covers (categories, diary entries, sessions).
- Do not add another state library (Redux, Zustand).

## Validation & the MutationResult pattern
All write paths validate with Zod (`src/utils/zodSchemas.ts`) **before** mutating state or hitting the network:

| Schema | Guards |
|---|---|
| `TransactionSchema` | `addTransaction` |
| `WalletSchema` | `addWallet` |
| `DebtSchema` | `addDebt` |
| `DiarySchema` | `upsertDiaryEntry` |
| `KeywordMappingSchema` | `addKeywordRule` (also supplies the trimmed / lower-cased keyword) |
| `AuthLoginSchema` | `AuthModal` sign-in and sign-up |

Conventions:
- Mutating context methods return `MutationResult` (`{ success: boolean; error?: string }`) rather than throwing or failing silently. `addTransaction` extends it with `txId`.
- Format failures with `formatZodIssues(error)` so every call site reports the same way.
- Surface Supabase errors too — do not swallow them behind `if (!error && data)`.
- Callers must keep the form open and populated on failure, and only reset or close on success.

## Supabase: required migration for atomic transfers
`supabase/migrations/20260909_transfer_funds.sql` must be applied to any project used for cloud sync. It creates:
- a partial unique index `transactions_user_idempotency_key_uniq` on `(user_id, idempotency_key)` for live rows, and
- `public.transfer_funds(...)`, a `security definer` RPC that locks both wallets, applies **relative** balance updates, and inserts the ledger row in one database transaction, returning `{ reused, transaction, source_balance, dest_balance }`.

Without it, `FinanceContext` falls back to the legacy non-atomic path (three separate round-trips), where a mid-sequence failure can debit the source without crediting the destination. `isMissingRpcError()` deliberately matches **only** a missing-function error (`42883` / `PGRST202`); any other database error must surface and roll back rather than silently taking the fallback.

## Testing
- **Framework**: Playwright with Chromium, Firefox, and WebKit projects.
- **Suite size**: 29 tests across 12 spec files, run on all three browsers = **87 test runs**. All must pass.
- **Location**: `tests/*.spec.ts` (`transaction`, `wallets`, `diary`, `theme`, `wallet-forms`, `debts`, `soft-delete`, `keywords`, `csv`, `auth`, `date-boundary`, `storage-persistence`), with shared helpers in `tests/helpers.ts`.
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
- `APP_URL`: Base application URL for redirects and links.
- `DISABLE_HMR`: If `'true'`, disables Vite HMR and file watching to conserve resources in sandboxes.

## Known Constraints or Gotchas
- **Uninstalled Dependencies**: `node_modules` is not committed or pre-installed; run `npm install` or `npm ci` first.
- **Fallback Credentials in `src/lib/supabase.ts`**: Contains hardcoded demo Supabase credentials as fallback; do not commit production secrets here.
- **Tree-Shaken MathJS**: Always import `{ evaluate }` from `mathjs/number`, never full `mathjs`.
- **Client Idempotency**: `FinanceContext.tsx` tracks in-flight transaction keys in a `Set` to prevent double submissions. Transfer forms arm one key per form, reuse it on retry after a failure, and rotate it only on success.
- **Dynamic Calculation Inputs**: Amount inputs accept inline arithmetic expressions (e.g., `120/4 + 15*2`) sanitized by regex before evaluation.
- **Two rounding helpers, deliberately different**: `roundToCents` in `FinanceContext.tsx` is plain cent rounding for the ledger; `roundToTwoDecimals` in `mathEvaluator.ts` carries a magnitude-scaled epsilon nudge for half-cent inputs. Do not merge them.
- **`WalletPopupModal` never unmounts**: its parent renders it unconditionally and it returns `null` while closed, so `useState` initialisers run once. Anything derived from its props must be re-synced in the `isOpen` effect.
- **Wallet forms are shared**: `AddWalletForm` and `WalletTransferForm` in `src/components/wallet/` are used by both `WalletsView` and `WalletPopupModal`. They own their draft state; containers pass element ids, field tone, and success callbacks. Edit the shared component, not one caller.

## Do NOT
- Do NOT import the root `mathjs` package; only import from `mathjs/number`.
- Do NOT bypass the Zod schemas in `src/utils/zodSchemas.ts` on any write path.
- Do NOT perform hard deletions on financial records; update `isDeleted: true` instead.
- Do NOT hardcode production API credentials in `src/lib/supabase.ts` or commit them to version control.
- Do NOT modify the `DISABLE_HMR` handling in `vite.config.ts`.
- Do NOT add redundant state management libraries (Redux, Zustand); use `FinanceContext` and the domain hooks.
- Do NOT introduce a second currency without adding real conversion to the ledger first.
- Do NOT format money or dates inline; use `formatCurrencyAmount` and the `src/utils/date.ts` helpers.
