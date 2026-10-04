# CLAUDE.md

## Project Overview
FinLife Tracker is a full-stack personal finance and holistic lifestyle management Progressive Web App (PWA). It tracks Thai Baht wallets, income/expense/transfer transactions, and debt repayment goals, while correlating financial behavior with a daily wellness diary (mood, workout, food quality). The app functions offline via `localStorage` and syncs bi-directionally with Supabase when configured.

## Tech Stack
- **Language**: TypeScript ~5.8.2 (`ES2022`, `bundler` resolution, `allowImportingTsExtensions: true`)
- **Framework**: React 19.0.1, React DOM 19.0.1
- **Build & Bundler**: Vite ^6.2.3, `@vitejs/plugin-react` ^5.0.4, `vite-plugin-pwa` ^1.3.0
- **Styling**: Tailwind CSS ^4.1.14 (`@tailwindcss/vite` ^4.1.14, `@import "tailwindcss"`, semantic design tokens from `DESIGN.md`)
- **Database & Auth**: Supabase (`@supabase/supabase-js` ^2.112.4)
- **Testing**: Playwright ^1.50.1 (`@playwright/test`)
- **Key Libraries**: `framer-motion` ^13.1.1, `lucide-react` ^0.546.0, `mathjs` ^15.2.0 (`mathjs/number`), `zod` ^4.5.4, `papaparse` ^5.7.0, `react-swipeable` ^7.0.2

## Project Structure
```
├── .github/workflows/   # CI pipeline for Playwright E2E tests (playwright.yml)
├── api/                 # Vercel serverless functions (classify.ts: Jev proxy; own tsconfig)
├── public/              # PWA icons (192px, 512px, SVG) and robots.txt
├── supabase/migrations/ # SQL migrations (transfer_funds, the ADR 0023/0024 ledger + session RPCs, idempotency indexes)
├── supabase/tests/      # SQL probes: migration + assertions inside BEGIN ... ROLLBACK
├── src/
│   ├── components/      # Reusable UI components, modals, and navigation
│   │   ├── account/     # AccountModal (Account & Security) + GuestDataNotice (ADR 0024)
│   │   ├── dashboard/   # Dashboard cards (spec 6.1, ADR 0030): figures in, layout out
│   │   ├── transaction/ # Transaction tokens/cells + CategorySuggestionChip
│   │   ├── debt/        # The Debt payoff page's DebtCard, DebtSummaryCard, EditDebtModal (ADR 0035)
│   │   ├── category/    # The Categories page's list, form, colour grid and Smart rules tab (ADR 0037)
│   │   ├── diary/       # The Daily diary's form, calendar, recent entries, MoodMeter and labels (ADR 0036)
│   │   └── wallet/      # Shared wallet forms + the Wallets page's WalletList/WalletDetail (ADR 0034)
│   ├── context/         # FinanceContext.tsx (monolithic app state, local fallback, Supabase sync)
│   ├── hooks/           # Domain hooks (useTransactions, useWallets, useDebts, useTheme)
│   ├── lib/             # Supabase client setup (supabase.ts)
│   ├── selectors/       # Pure money rules (ADR 0028): ledger, timeRange, wallets, debts, display, adjustments, categories, pagination
│   ├── utils/           # Pure helpers: currency, date, mathEvaluator, smartMatcher,
│   │                    # expressInput, jevClassifier, zodSchemas, csvExchange, walletIcons, identityPalette, identityColorMigration
│   ├── views/           # Route views lazy-loaded via React.lazy in App.tsx
│   ├── App.tsx          # Root shell with gesture handlers and tab navigation
│   ├── main.tsx         # Application entry point
│   ├── types.ts         # TypeScript domain interfaces, unions, and enums
│   └── index.css        # Tailwind v4 import and dark mode custom variant
├── tests/               # Playwright specs (*.spec.ts) plus shared helpers.ts
├── index.html           # Anti-FOUC theme bootstrap and PWA meta tags
├── playwright.config.ts # Playwright multi-browser test configuration
├── vite.config.ts       # Vite config (PWA manifest, Tailwind plugin, HMR switch)
├── tsconfig.json        # TypeScript configuration (strict unused-locals/params, no path aliases)
└── vercel.json          # One key: the functions' region, icn1 (ADR 0051)
```

## Common Commands
From `package.json` (requires `npm install` prior to execution):
- `npm run dev` : `vite --port=3000 --host=0.0.0.0`
- `npm run build` : `vite build`
- `npm run preview` : `vite preview`
- `npm run clean` : `rm -rf dist server.js`
- `npm run lint` : `npm run check:node-globals && tsc --noEmit && tsc -p api/tsconfig.json` (Node globals in `src/`, then app+tests, then the Vercel functions)
- `npm run check:node-globals` : `node scripts/check-node-globals.mjs` (ADR `0045`; exits 1 on a Node global or built-in in `src/`)
- `npm test` : `playwright test`

## Coding Conventions
- **Component Pattern**: Functional components with TypeScript interfaces; named exports for views and helper components.
- **Naming**: PascalCase for components (`TransactionForm.tsx`), camelCase for hooks and utilities (`useTheme.ts`, `mathEvaluator.ts`), SCREAMING_SNAKE_CASE for enum/union values (`INCOME`, `EXPENSE`, `BANK_ACCOUNT`).
- **Imports**: Relative paths only — there is no `@/*` alias. Explicit `.tsx` extensions are supported and used in imports.
- **Styling**: Tailwind CSS v4 utility classes on the semantic tokens in `src/index.css` (ADR `0025`, values from the redesign spec since ADR `0027`).
  - Surfaces: `bg-canvas`/`bg-header`/`bg-surface-1..3`/`bg-control-active`.
  - Edges: `border-line`/`border-line-control` (buttons)/`border-line-strong`/`border-line-input` (inputs only).
  - Text: `text-fg`/`text-fg-secondary`/`text-fg-muted`/`text-fg-disabled`.
  - Focus and selection: `ring-focus`, `bg-brand-soft`/`text-brand-soft-text`, `bg-selected`/`text-on-selected`.
  - Chips and danger: `text-chip-text` (on `bg-adjust-tint`), `border-danger-line` (ADR `0029`).
  - Hues: `brand`/`income`/`expense`/`transfer`/`adjust`/`pending` as text and `-tint`, plus the static `-fill` and `-line` shades. `pending` is the spec's `--warning`.
  - Radii: `rounded-card`/`-inner`/`-control`/`-button`.

  Tokens flip with `.dark` on their own, so a token class never takes a `dark:` twin. **Do not write a raw palette class** (`stone-*`, `emerald-*`, `slate-*`, ...): pick the token by meaning, and after changing a token value run `node scripts/wcag-tokens.mjs`. Colours that come from data (a wallet's or category's own `color`) are exempt. `DESIGN.md` records the rules, and `docs/design/finlife-redesign-spec.md` is the direction. Dark mode uses `.dark` class, `data-theme="dark"`, and `colorScheme`.
- **Type**: one self-hosted face, IBM Plex Sans Thai (400 to 700, thai and latin subsets, precached), which also carries `฿`. **Numbers are not monospace**: `body` sets `tabular-nums`, so do not add `font-mono` to an amount (ADR `0027`). The one `font-mono` left is a `<code>` sample.
- **UI limits from `DESIGN.md`** (ADR `0026`); each was an audit finding before it was a rule:
  - **44 px minimum hit box** on every interactive element. For a small visual (a swatch, a pill, a checkbox), wrap it in a 44 px box rather than growing it, and use a negative margin where the taller box would push a row apart (`NavbarSyncBadge`, the insights buttons).
    - **The entry form is held to it too** (Phase 65, ADR `0041`), in Quick Add, the Transactions Add modal and the repay modal:
      - the note, date and template-name fields are `min-h-[44px]`, and the amount input fills its 46px frame, so a tap on the frame lands on the input;
      - the "Save as a quick template" label is the checkbox's 44px box;
      - the template and debt payoff chips (`TransactionForm`'s `QuickChip`), the "✓ Use result" apply button and the chips' Save rule / Apply are 44px boxes around their unchanged pill, with the focus outline moved onto the pill, as on the sync badge;
      - the chips' dismiss crosses are `IconButton`s, and Quick Add's own template list has 44px buttons.
    - **Exempt, by name:** the operator keys and the +100 / +500 / +1,000 chips (calculator keys), the note's microphone and the shortcut row's text links. Anything new in the form meets 44px.
  - **Blur only on the mobile bottom nav and a sticky table header.** Modal scrims are a solid `bg-scrim`, and panels are opaque.
  - **One layer order** (ADR `0042`), bottom to top: page content (an open `OverflowMenu` is `z-30`); the sticky header and the mobile bottom nav, `z-40`; the PWA toast (`ReloadPrompt`), `z-45`; every `Modal`, `z-50` (the More sheet, `AuthModal`, view dialogs, the shell modals, `ConfirmDialog`). `Modal` is not portalled, so two equal layers paint in DOM order: a view's dialog renders inside `<main>`, before the toast. Give a new fixed element a layer from this list by meaning, never a tie with `Modal`.
  - **One glow:** `shadow-quick-add` on the mobile centre Quick Add.
  - **Motion is 150 to 200 ms, on hover, focus or a state change.**
    - No framer `whileHover` / `whileTap`, no `scale-*` for a selected state, no springs, no entrance animations.
    - A tween is `{ duration: 0.2, ease: 'easeOut' }`.
    - Continuous motion (`animate-spin`, `animate-pulse`) only while real work runs.
  - **Loading is a static outline** (`ViewLoadingFallback`, the insights skeleton), never a pulse or a stacked spinner.
  - **Uppercase with `tracking-wider` is for compact metric labels, column headers and tickers only**, not form labels.
  - **Focus is one global rule** (ADR `0029`): `:focus-visible` in `index.css` draws the spec's 2px violet outline, offset 2px, on every control. Do not give a control its own focus style. Fields keep their `focus:ring-2 ring-focus`, and a control whose 44px box is invisible (`NavbarSyncBadge`) moves the outline onto what it draws.
  - **A control transitions with `transition-control`, never `transition-colors`** (ADR `0030`, audit 004 finding 2). Tailwind's `transition-colors` includes `outline-color`, so the outline faded in from the text colour for 150ms. `transition-control` (an `@utility` in `index.css`) lists the same colour properties without it and keeps the `duration-*` hook.
  - **A removed focus outline needs a replacement:** `focus:outline-none` goes with `focus-visible:ring-2 focus-visible:ring-focus` (or `focus:ring-*`).
  - **No em dash in user-facing text.**
- **Buttons are `ui/Button` and `ui/IconButton`** (ADR `0029`), never a re-typed class string.
  - `Button` variants: `primary` (one main action per area), `secondary`, `soft`, `danger`. Sizes: `md`, `lg` (a form submit), `header`. Add `block` for full width.
  - It is `type="button"` unless you pass `type="submit"`, which the specs find submits by.
  - `IconButton` requires `label` (it becomes `aria-label` and `title`).
  - `buttonClass()` gives the look to a non-button element.
  - Deliberate exceptions: the in-chip dismiss crosses, the note field's microphone, the calculator keys, the pickers, text links, the mobile centre Quick Add and the transfer swap button (`DESIGN.md` section 4).
- **Form styles**: Labels, text/number/select inputs and error banners come from `src/utils/formStyles.ts` (`LABEL_CLASS`/`LABEL_TEXT_CLASS`, `inputClass(tone)`, `selectClass(tone)`, `OPTION_CLASS`, `ERROR_BANNER_CLASS`) instead of a re-typed Tailwind string — but only where a field's styling actually matches one of those shapes. A field with a genuinely different padding scale, font size, or color stays inline (e.g. `WalletDetail`'s Adjust balance input, `TransactionsView`'s `min-h-[44px]` touch-target filter bar, `AuthModal`/`TransactionForm`'s larger `text-sm` inputs) — forcing it through the shared class would be a visual regression, not a cleanup. See `docs/audit/refactor-log.md` Phase 17 for the audited exceptions.
- **Lookup maps**: Build an id→entity `Map` with `buildLookupMap(items)` from `src/utils/mapUtils.ts` rather than writing `new Map(items.map(x => [x.id, x]))` inline. This covers only the id→full-item shape — a map keyed by something other than `id`, or valued by a single field instead of the whole item (e.g. id→name in `csvExchange.ts`, `useTransactions.ts`), is a different shape and stays as its own inline `new Map(...)`.
- **Modals**: Use the shared `src/components/Modal.tsx` primitive (`isOpen`/`onClose`, `title`/`subtitle` or a `header` override slot, optional `footer`) for any dialog or mobile bottom sheet — never hand-roll a backdrop + panel + `AnimatePresence` combination. It owns the overlay fade, spring panel animation, mobile bottom-sheet layout, Escape-to-close, returning focus to the element that opened it (audit 008), and `role="dialog"`/`aria-modal`/`aria-labelledby`.
  - **Focus is the primitive's** (ADR `0043`, spec section 10 item 12). On open it focuses the first reachable control in the panel, which is the header's close button in every dialog today, unless focus is already inside (an `autoFocus` field keeps it); with no control the panel itself (`tabIndex={-1}`, its outline off since it is a container) takes it. While open, Tab and Shift+Tab wrap at the two ends and focus that leaves the panel is brought back. "Reachable" is computed at key-press time from markup and computed style, never layout: no negative `tabindex`, nothing `:disabled` or under `[inert]`, no `hidden`/`display: none` up to the panel, no `visibility: hidden`.
  - **Only the top dialog answers Tab and Escape.** A module-level stack records open dialogs in opening order; a `ConfirmDialog` over the Wallets or Categories sheet (a sibling) or inside `AccountModal` (a child) traps alone, and Escape closes it alone, returning focus inside the sheet. A control belongs to its nearest `[role="dialog"]`, so a closing child dialog's buttons are not the parent's stops.
  - The Tab listener is on `document` in the **capture** phase (it reads focus before OverflowMenu's Tab handler unmounts the item); Escape stays a bubble listener, so OverflowMenu's `stopPropagation` keeps its Escape to itself.
  - Released in `d2f735e` (PR #16, Vercel `dpl_9uk8JX9RkeU4fgUF9HT5as6PA54T`); on production spec section 10 passes 13 of 13 (`docs/audit/spec-acceptance-2026-10-02.md`), which closes spec sections 9 and 10.
  - **The page behind the top dialog is `inert`** (Phase 71, ADR `0047`), so a screen reader's virtual cursor stays in the dialog. `Modal` is not portalled, so **never mark `#root`**: inert covers the whole subtree, and the dialog is inside it. Instead every element beside the path from the top dialog's overlay up to `<body>` is marked, and the marks are recomputed whenever the stack changes:
    - a confirmation beside a sheet makes the sheet inert and gives it back on close; one inside a dialog marks the parent's other controls;
    - only marks `Modal` made are removed, so an element that was already inert stays inert;
    - something mounted beside the path while a dialog is open is marked too (one `MutationObserver` on `<body>`, live only while a dialog is open);
    - **the return-focus cleanup releases the background before it focuses the opener**, because React runs it before the stack cleanup and `focus()` on an inert element does nothing.
    - jsdom stores `inert` but does not enforce it, so `modal-focus.test.tsx` patches `focus()` to refuse an inert element; Playwright's role queries ignore `inert`, so the E2E check reads focus, not roles.
    - Released in `3b9abec` (PR #21, Vercel `dpl_5VQ4CZchLxdFrkPFpfM4cgmDjSRU`); on production Chromium's accessibility tree hides the page behind an open Quick Add and restores it on close.
- **UI primitives**: `src/components/ui/` holds generic, domain-agnostic pieces (spec section 4, ADR `0029`):
  - `Modal`, `ConfirmDialog`, `EmptyState`;
  - `Button`, `IconButton`;
  - `SectionHeader` (carded, being replaced by `PageHeader`);
  - `Card` (`padding: 'none'|'sm'|'md'|'lg'`, 16px radius) and `Inset` (a box inside a card);
  - `Badge` (the neutral day tag only), `Chip` (neutral pill, item colour on a 7px dot only);
  - `ProgressBar` (clamps to `[0,100]`, prints no number, `role="progressbar"`), `AllocationBar` (optional `emptyCaption`: a `text-xs text-fg-muted` line under the bar when nothing is positive; the Dashboard's Wallets card and the Wallets page's list pass "No money in your wallets yet", like the Cash flow card's empty-bar caption, ADR `0042`);
  - `SegmentedControl` (pill-in-tray with a `layoutId` pill namespaced by `useId()`; `aria-pressed`, or `mode="tabs"` for `role="tab"`), `OverflowMenu`;
  - `WarningBanner`;
  - `Money` (a static balance in tabular figures, `−` before a negative; ADR `0026`).

  `src/components/transaction/` holds the transaction domain's own tokens and cells:
  - `txTypeMeta.ts`'s `TX_TYPE_META` (type → icon/label/tint/sign/text colour). Always read it through `txTypeMetaFor(type, amount, direction?)`, where `direction` from `transferDirection(tx, walletId)` signs a transfer inside one wallet's own view only.
  - `TxCells.tsx`'s `TxTypeIcon` (sizes `md`/`lg`, a `<span>` so it can sit inside a row button; one icon set since Phase 59 retired the popup's compact one), `TxAmount` and `TxSoftDeletedTag`.
  - `ActivityFeed` (Phase 59, ADR `0034`): the day-grouped feed with the L8 fold, shared by the Dashboard's Recent activity (`idPrefix="dashboard"`) and a wallet's own activity (`idPrefix="wallet"`, with `walletId` signing transfers).
  - `TransactionRow` and `DayGroupHeader`.

  `PageHeader`, `TransactionRow`, `DayGroupHeader`, `AllocationBar` and `WarningBanner` are on the Dashboard since Phase 57 (ADR `0030`); the other pages adopt them in their own phases. The Transactions page (Phase 58a, ADR `0031`) uses `PageHeader`, `TransactionRow`, `DayGroupHeader` and `OverflowMenu`, whose `triggerLabel`/`triggerId` draw a text trigger ("Import / export"). The Wallets page (Phase 59, ADR `0034`) uses `PageHeader`, `AllocationBar`, `OverflowMenu`, `TransactionRow` and `DayGroupHeader` through `ActivityFeed`. The Debt payoff page (Phase 60, ADR `0035`) uses `PageHeader`, `ProgressBar`, `Badge` and `OverflowMenu` (Edit and Delete on each card). The Daily diary (Phase 61, ADR `0036`) uses `PageHeader`, `OverflowMenu` (Edit and Delete on each entry), `ConfirmDialog` and the shared `diary/MoodMeter`, which the Dashboard's Mood & spending card uses too. The Categories page (Phase 62, ADR `0037`) uses `PageHeader`, `SegmentedControl` in both modes, `Badge`, `Modal` (the edit sheet below `lg`) and `ConfirmDialog`, and `SectionHeader` is no longer used by any page. `OverflowMenu`'s items exist only while it is open, so a spec asserting an action is absent must open it first. It stops its own Escape, so it can sit inside a `Modal` (the Wallets sheet) without closing it (audit 008).
  - `transaction/` also holds the Transactions page's `ImportCsvModal` (the CSV import) and `TransactionDrawer`'s `TransactionDetails` (the selected row's panel). For a live row that panel is `EditTransactionPanel` (Phase 58b, ADR `0033`), which offers Save changes and Delete; a deleted row gets read-only details with Restore.
  - Since Phase 58b the Dashboard's Recent activity rows are buttons (`dashboard-tx-{id}`) that open their row on the Transactions page, through `App.tsx`'s `initialSelectedTxId` hand-off, which is shaped like the wallet filter's.
  - **The Transactions page's empty list says why it is empty** (Phase 65, ADR `0041`).
    - With no live transaction in the ledger it is a first run: "No transactions yet" and "Add your first one with Add transaction above, or import a CSV from Import / export." under the Transactions icon. This wins over every filter, and a ledger of deleted rows only counts as empty.
    - Otherwise an empty list keeps "No transactions match your current filters." under the search icon. `transaction.spec.ts` asserts both.
    - The empty state repeats no button: a second "Add transaction" would give strict locators two matches.
  - `TransactionRow`'s `dateText` renders the row's ISO date as `sr-only` text, for a list that shows dates only in day headers; `presets.spec.ts` filters rows by it. A new primitive goes in `ui/` unless its props are typed against a specific domain model (a `TransactionType`, a `Wallet`), in which case it goes beside that domain's other files, matching `wallet/`'s existing precedent for `AddWalletForm`/`WalletTransferForm`. Each of these primitives takes an escape-hatch prop (e.g. `TxAmount.colorClassName`) for the one field a specific call site had already diverged on before the primitive existed — check whether a call site's appearance is supposed to differ before assuming a mismatch is a bug. See `docs/audit/decisions/0006-ui-primitive-inventory.md`.
- **Data Integrity**: Soft deletion (`isDeleted: true`) on records to protect ledger and history integrity.
- **Unused symbols**: `tsconfig.json` sets `noUnusedLocals` and `noUnusedParameters`, so `npm run lint` fails on dead imports and locals. Prefix a deliberately unused parameter with `_` (see `_event` in `FinanceContext.tsx`).
- **Re-renders**: Never wrap a component in `React.memo` while it still subscribes to `useFinanceState()`/`useFinanceActions()` (or any other context) directly — a context value change re-renders every subscriber regardless of `React.memo`'s props comparison, so the memo would look like a fix while doing nothing. Cut the subscription first (read the data in a parent and pass it down as props, or extract a self-subscribing child), then memo the now-props-only component.

## Currency: THB only
The app is single-currency (Thai Baht) and must stay that way unless the ledger gains real conversion.
- `CurrencyCode` in `src/types.ts` is the one-member union `'THB'`, so any second currency becomes a compile error at every write site.
- Use `APP_CURRENCY` and `APP_CURRENCY_SYMBOL` from `src/utils/currency.ts` instead of literals.
- **Format every displayed amount with `formatCurrencyAmount(value)`** from the same module. It renders `฿1,234.50` — exactly two decimals with thousands separators — and a negative as `−฿1,234.50` (U+2212 before the symbol; ADR `0027`). Do not hand-roll `฿` + `toFixed(2)` or `toLocaleString(...)`: past drift produced dollar signs on debt cards and three-decimal amounts wherever `maximumFractionDigits` was omitted.
- The transfer path moves balances 1:1 in nominal units, which is only correct while every wallet shares one currency.
- Exceptions that must **not** use the helper: CSV export values (`csvExchange.ts` writes machine-readable numbers — a thousands separator would corrupt the columns) and `mathEvaluator`'s `formattedValue` (raw input-field text). A standalone balance renders through `ui/Money`, which calls the helper itself; there is no count-up animation (ADR `0026` superseded `AnimatedCounter`).

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
- **No component above view level subscribes to finance state.** `App.tsx`'s `MainApp` and the shell it renders (`Navbar`, the swipe wrapper, `MobileBottomNav`, `AuthModal`) call neither `useFinanceState()` nor `useFinanceActions()`. `AuthModal`'s `GuestDataNotice` and `AccountModal`'s body subscribe for themselves, and only while their modal is open (`Modal` unmounts its body when closed). A piece that needs finance data (e.g. the quick-add modal) subscribes to it itself, so a financial write re-renders only the piece that actually needs the new data — never the whole app shell.
- **Views should consume the domain hooks in `src/hooks/` rather than `useFinanceState()`/`useFinanceActions()` directly** where one fits:
  - `useTransactions(options)` — filtering (wallet, category, type, date range, search across description / amount / rawInput / category name / wallet name), aggregate metrics, and the transaction write actions.
  - `useWallets()` — `wallets` (active only), `allWallets` (includes soft-deleted, for resolving historic names), `totalNetWorth`.
  - `useDebts()` — `debts` (not deleted), `activeDebts`/`settledDebts` sorted by `sortByDueDate`, `metrics` (totals, `progressPercent`, counts) and `editDebt`.
- `useFinanceState()`/`useFinanceActions()` are still correct for state no hook covers (categories, diary entries, sessions).
- Do not add another state library (Redux, Zustand).
- **State persists through one batched `localStorage` writer; add a new persisted slice by registering it there, not by adding another effect.** `FinanceContext.tsx` debounces every dirty slice through one `pendingWritesRef` map and a single `flushPendingWrites`, flushed on a 250ms timer and on `pagehide`/`visibilitychange` — it is the only place `localStorage.setItem` is called.
- **Never read a value assigned inside a `setState` updater after the call that scheduled it.** A prior `setState` call in the same function can already have dirtied the fiber, so a later `setWallets(prev => { x = ...; return ...})` updater is not guaranteed to run before the next line reads `x` — React only takes the synchronous eager-eval path for the *first* state update in a batch. Compute the value first, from the ref mirror (`walletsRef.current`, etc.), and pass it into the updater as a precomputed value instead. This bit `setTransactionDeleted` (Phase 32, T63) — the wallet-balance write silently stopped firing on every soft-delete/restore for authenticated users, and `tsc` cannot catch it because the race is a runtime scheduling issue, not a type error.
- **The same rule holds across an `await`: never build a remote write from a ref read after the optimistic `setState` it mirrors.** By the time an `await` resumes, the ref-mirror effect has already moved `debtsRef.current` (etc.) to the optimistic value. `addTransaction` re-read the debt there and subtracted a repayment twice — ฿1,000 off ฿4,500 wrote ฿2,500 to Supabase while the screen showed ฿3,500 (Phase 50, F1, ADR `0022`). Compute once, before any `setState`, and reuse that one value for both the optimistic update and the remote write. ADR `0016`'s `Math.max(0, …)` floor hid it whenever a payment settled the debt, so test a *partial* repayment.
- **A failed cloud load is never silent** (ADR `0026`). `loadSupabaseData` sets `syncError` (on `FinanceStateContext`) when any read fails or the load throws, and clears it on a clean load and in `resetToGuestState`. The throw path checks `authEpochRef` first. `NavbarSyncBadge` shows it as "Sync failed" and retries through `refreshFromCloud`. Its five states, in order: Local (guest), Offline (`navigator.onLine`), Syncing, Sync failed, Synced. Covered in `authenticated-ledger.test.tsx`, since no spec signs in.
- **Reconnection reconciliation lives in the realtime effect, not beside it** (ADR `0023`). `online`, `visibilitychange`→visible (only when the last *clean* load, `lastCloudLoadAtRef`, is older than 30 s), and the channel reporting `SUBSCRIBED` after `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` all go through the same debounced `scheduleReload`, and none runs signed out. The first `SUBSCRIBED` does not reload. They only re-read — there is no offline write queue. The same effect also runs `verifySession` on those triggers, plus window `focus`, its own mount, a 60 s tick while visible and any Data API 401 (ADR `0024`, amended) - see "Accounts, sessions" below.

## Money rules: compute through `src/selectors/` (ADR `0028`)
The redesign spec's logic rules (section 5, L1 to L13) live in pure functions in `src/selectors/`. **A screen that shows a spending, income, net, net-worth or debt-plan figure computes it there, never with its own inline filter.** Before Phase 55b four screens had four definitions of "spending" and showed three different figures for one period.
- **L1 - spending is `isSpending`, income is `isIncome`.**
  - A live EXPENSE / INCOME, except one filed under a category whose type is DEBT_REPAYMENT or ADJUSTMENT.
  - A transfer, a debt repayment and an adjustment are neither.
  - `spendingByCategory` groups by category **id** and adds up to exactly `sumSpending`.
- **Every selector takes `today` as an ISO string**; none reads the clock. Callers pass `todayIsoDate()`.
- **L2 - `TimeRange` keeps the dashboard's boundaries.** DAY is today, WEEK is from `today − 7`, MONTH is from `today − 30`, and WEEK, MONTH and ALL have an open end. `date-boundary.spec.ts` depends on WEEK.
- **L3 - `walletTotal` / `activeWallets`** (not deleted, not archived) back `totalNetWorth` and `useWallets().wallets`. `netWorth(wallets, debts)` subtracts active debts' remainders. Since Phase 57 the Dashboard's Net worth card shows it, with the wallet total and the debt remaining beside it.
- **L4 / L5 - `monthsLeft` is `max(1, month difference − 1)`.**
  - `requiredMonthly` rounds to cents and is `null` without a due date.
  - `debtPlan` sums the rounded figures and warns when the total exceeds `monthlySurplus`, which is income minus spending over MONTH.
  - The spec's worked example is the unit test: 2026-09-28, ฿4,391.23 and ฿522.41.
- **L6 to L13** (`display`, `adjustments`, `categories`, `pagination`) are built and tested. The Dashboard uses L6, L7, L10 and L13 through `TransactionRow`, and L8 and L11 in its Recent activity (Phase 57). The Transactions page uses L11 and L12 (Phase 58a): it sorts newest first, pages with `visibleRows` **before** grouping with `groupByDay`, and takes each day's net from all of that day's filtered rows. The Wallets page uses L8 and L11 in a wallet's activity (Phase 59), through `walletActivity` and the shared `byNewest` in `selectors/wallets.ts`. The Categories page uses L9 and L10 (Phase 62): `usedColors`, `nextColor`, `paletteExhausted`, `categoryGroups` and `categoryUsage` in `selectors/categories.ts`.
- **A transfer's own note follows its wallets** in `secondaryLine` ("Main → Cash · Funds transfer"); the defaults "Transaction" and "Transfer between wallets" add nothing (ADR `0031`).
- **The Dashboard computes every figure once, in `DashboardView`, and its cards only lay figures out** (ADR `0030`). Phase 57 added three selectors for it:
  - `cashFlow` (`ledger.ts`) is built on `sumIncome`/`sumSpending`, so the Cash flow card's Spending equals the category card's total;
  - `walletShares` (`wallets.ts`) shares positive balances only, like `AllocationBar`;
  - `moodSpendingDays` (`diary.ts`) lists the diary days in the period with each day's `sumSpending`.

  The L5 surplus is always the past 30 days, whatever period the page shows. `DebtsView` computes the same `debtPlan(debts, today, monthlySurplus(...))` once (ADR `0035`), so the Debt payoff page and the Dashboard agree.
- A system category is matched by **type**, never by id (signed-in rows carry uuids).

## Transaction entry: one configurable engine
`src/components/TransactionForm.tsx` is the single entry engine for every flow that needs its full shape (EXPENSE/INCOME type toggle, category, wallet, note, math-expression amount). It takes optional `idPrefix`/`presetType`/`lockType`/`presetDebtId`/`presetWalletId`/`onRequestTransfer`/`onRequestRepayDebt` props; passing none reproduces plain default behavior.
- **Editing is not an entry flow and does not go through this form** (ADR `0033`). `EditTransactionPanel` edits an existing row: it needs TRANSFER, must not re-parse a saved note into the amount, and offers no rule chip or template. ADR `0013` governs `TransactionForm` only.
- **3 consumers, each a distinct entry point, not a duplicate**: `QuickAddModal` (default, no preset — reached from `Navbar`'s quick-add button and `DashboardView`'s CTA, one shared instance owned by `App.tsx`), `TransactionsView`'s Add Transaction modal (default), `DebtsView`'s repay modal (`lockType`/`presetDebtId` set).
- **New transaction-creating UI should default to reusing `TransactionForm`** via its existing props before writing a new form.
- **The form has no heading of its own** (ADR `0042`, audit 013 finding 7). Every caller renders it inside a titled `Modal` ("Quick Record Transaction", "Record New Transaction", the repay modal), so the dialog's title is the only one; the EXPENSE/INCOME toggle opens the form, hidden by `lockType`. A caller outside a titled `Modal` must supply its own heading.
- **`InlineMathInput` says each thing once.** The formula's result is the "Calculated: ฿x" badge (specs read it); the apply button says "Use result". Formula help is the placeholder only: no "Supports inline arithmetic" line, no hover-only (i). The transfer form shares it.
- **The type toggle is EXPENSE/INCOME only (ADR `0013`).** TRANSFER was removed from the form *entirely* — the toggle option, `destinationWalletId`, the "To Wallet" select, and the submit-payload field. `TransferFundsModal`/`WalletTransferForm` is now the app's single transfer surface. Do not re-add a TRANSFER type here.
  - **`DEBT_REPAYMENT` is different and stays.** Only its toggle option went. `presetType="DEBT_REPAYMENT"` is a live configuration with a live caller (`DebtsView`'s repay modal) and full coverage in `debts.spec.ts`; TRANSFER had neither.
  - The `onRequestTransfer`/`onRequestRepayDebt` shortcut row below the submit button is what keeps both flows one tap away. Each link renders **only** when its handler prop is supplied, so a form that cannot reach a destination never shows a dead link.
- **One deliberate, permanent exception** — do not "fix" it by routing it through `TransactionForm`: `WalletDetail`'s inline Adjust balance editor (moved from the retired `WalletPopupModal` in Phase 59) creates an `ADJUSTMENT` transaction via a bespoke one-field form. It writes the **signed** difference (ADR `0024`) - it used to write `Math.abs(diff)`, so lowering a balance raised it. Forcing it through `TransactionForm` would surface a type toggle and category field the user has no reason to touch for a balance reconciliation.
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
  - **`tsc` does not keep Node out of `src/`; `scripts/check-node-globals.mjs` does** (Phase 69, ADR `0045`). `@types/papaparse` carries `/// <reference types="node" />` and `csvExchange.ts` imports papaparse, so Node globals are in the root program (a triple-slash reference is not filtered by the `types` array), and a `process` in `src/` type-checks and then fails in the browser. The script runs first in `npm run lint`: it blanks comments, strings, template text and regular expressions, then reports `process` (with `process.env` pointed at `import.meta.env`), `Buffer`, `__dirname`/`__filename`, `global.`, `require` and imports of a Node built-in, as `file:line:column  message`.
    - **An exception takes a reason:** `// node-guard-ignore: <why>` on the line or alone above it. An ignore without a reason, or one that suppresses nothing, is itself an error.
    - **A forbidden word in JSX text is reported too** (it does not parse JSX); reword it or ignore it with a reason. `unit/`, `tests/`, `api/` and `scripts/` run in Node and are not checked.
- **Both proxies pass an upstream 429 through as 429** (ADR `0022`, amending `0011`); 401 maps to 502 and every other upstream failure to 503. 429 is the only status `batchClassifier` backs off on, so mapping it away makes the backoff unreachable in production. The upstream body is never forwarded.
  - **The 429 carries TypeSafe's own wait** (ADR `0053`): `upstreamRetryAfter` reads `retry-after-ms`, then `Retry-After` (seconds or an HTTP date), and sends `Retry-After` in whole seconds, rounded up, capped at a day. Nothing usable sends no header. No other upstream header crosses, and no other status gets a `Retry-After`. TypeSafe's SDKs read a retry wait from its 429, but the header has not been seen live.
  - `unit/proxy-contract.test.ts` pins the mapping, the forbidden keys and the 404-on-missing-key by calling the exported `POST` handlers directly.
- **Both proxies check their caller before the body** (`checkCaller`, ADR `0032`), right after the missing-key 404:
  - no `Authorization` header is a guest, allowed;
  - a malformed header, or a token that `/auth/v1/user` refuses, is 401;
  - no answer from the auth server (or no `VITE_SUPABASE_*` settings on the deployment) is 503.

  TypeSafe is never called on a 401 or 503. An accepted token is cached for 60 s per warm instance. **The check is duplicated in both files on purpose**: a shared `api/_auth.ts` would be the first runtime import between the functions, which nothing local can prove resolves on Vercel. Change both copies together.
- **A signed-in caller is then counted** (`checkQuota`, ADR `0049`): 120 AI requests a minute per account, shared by both proxies, a fixed 60 s window, **429 with `Retry-After`** past it.
  - **The count is in Supabase** (`consume_ai_quota()`, called with the caller's own token, which reads the account from `auth.uid()`), never in the function's memory: each warm instance has its own, so a count there would allow 120 per instance.
  - **Every signed-in request is counted, before its body is read,** even while `checkCaller` remembers the token. So an empty-body burst checks the limit for free: 400 up to 120, 429 at 121.
  - A token the database refuses is 401; no answer (a timeout, a 5xx, the function missing, a reply without a count) is 503. TypeSafe is never called on either.
  - A guest is never counted here; the firewall rule below does that. `AI_REQUESTS_PER_MINUTE` and `checkQuota` are duplicated in both files, like `checkCaller`.
- **Every proxy response carries `Server-Timing`** (ADR `0050`): `auth` (the `/auth/v1/user` check, or `dur=0.0;desc="cached"`), `quota`, `ai` (TypeSafe until its headers) and `total`, in milliseconds, in the order they finished. A step that did not run is absent, never zero. `POST` is a wrapper that times `handle()` and sets the header on whatever it returns, so a new `return` needs nothing; a new step needs a name in both files' `Timings` type and a test. The edge's firewall 429 carries none.
  - Released in `e69425f` (PR #24, Vercel `dpl_2J9Asnb3kofhqt3RyPRYMRRvCWS9`). **The functions run in `iad1` (Washington, D.C.) and the database in Seoul,** so on production the count is most of a signed-in request: `quota;dur=614.5` of `total;dur=750.2`, against `ai;dur=134.3`.
  - **Since Phase 75 the functions run in `icn1` (Seoul)**, beside the database: `vercel.json`'s only key is `regions: ["icn1"]`, the default for every function (ADR `0051`). Measured on production and kept: a signed-in classification with a cached token went from about 810 to about 238 ms in the function (`quota` about 640 to 36 ms, `ai` about 140 to 196 ms), and an uncached one from 1616.3 to 626.3 ms. Released in `65d49f4` (PR #25, Vercel `dpl_BnxC9uqZHQBTPhzxskVM9a8bpZQq`). To revert, delete `vercel.json` or set `iad1`. Nothing local can see a region: previews have no Supabase settings and sit behind Vercel's login, so measure on production.
- **Guests are limited by the Vercel firewall, not by code** (ADR `0032`, amended by `0046`): one rule, "AI proxy: guests 30/min per IP", on `/api/classify` and `/api/insights` when there is no `Authorization` header, a fixed 60 s window, 429 past 30. The two paths share the count. The token check alone protects nothing against a caller who sends no header, so this rule is the guest protection.
  - **There is no all-callers firewall rule.** ADR `0032`'s 120 a minute for everyone was not created: the Hobby plan allows one rate-limit rule. Signed-in callers are limited per account in code instead (ADR `0049`, above).
  - **The rule lives in the Vercel dashboard, not the repo,** and the API cannot read it (`404 Seawall Config not found`, by slug and by team id). To check it, send 31 guest `POST {}` to `/api/classify` within a minute: `{}` gets 400 before any TypeSafe call, so it costs nothing, and request 31 must get 429 (`X-Vercel-Mitigated: deny`).
  - **Its 429 names no wait** (measured on production 2026-10-04, ADR `0053`): `X-Vercel-Mitigated: deny`, no `Retry-After`, no `Server-Timing`, and an `X-Vercel-Id` with no function region. **The window runs 60 s from its own first request**, not from the clock's minute, and refusals do not move it.
- **The client sends the token through `authorizationHeader()`** (`src/lib/supabase.ts`), which is `{}` for a guest and never throws. A guest must send no `Authorization` header at all. A 401 is `unavailable` for that call (a batch stops) and never latches; only a 404 latches for the session.
- **A category's `description` is what Jev actually sees.** `api/classify.ts` renders each option as `"<name>: <description>"`, falling back to the bare name. Sending bare names is what made `Netflix subscription` classify as the `other` escape option at 0.93 — a correct answer to a badly posed question. Keep the shipped `DEFAULT_SYSTEM_CATEGORIES` descriptions concrete and situational (what belongs here), never instructional ("always pick this").
- **`description: undefined` and `description: ''` are different values.** `undefined` means never set, and `withDefaultDescriptions` (`src/utils/categoryUtils.ts`) backfills the shipped default on every load, matched by **name** — not id, because authenticated rows carry uuids. `''` means the user cleared it and is never refilled. Seeding deliberately does not write descriptions to Supabase, so the column holds only what a user typed and an improved default still reaches existing accounts.
- See `docs/audit/decisions/0011-jev-classification-layering.md` and `0012-category-descriptions-as-criteria.md`.

## Wallet surface ownership (ADR `0034`, amending `0008`)
The Wallets page is the **one** place a wallet is inspected, edited, adjusted, archived or deleted. `WalletPopupModal` is gone.
- **Master-detail** (spec 6.3): `WalletsView` owns the selection and renders `WalletList` and `WalletDetail`. From `lg` a wallet is always selected (the first active one, or the one handed off), at 5/7 up to `xl` and 4/8 from it. Below `lg` the list stands alone and a tapped wallet opens in a `Modal` sheet - one render path through `useMediaQuery`, never two copies.
- **A Dashboard wallet row hands off** through `App.tsx`'s `walletsSelectedWallet`, shaped like `initialSelectedTxId`; "Manage wallets" opens the page. Do not reintroduce a wallet popup on the Dashboard.
- **Transfer and Add-Wallet are owned by 2 shell-level, self-subscribing modals** — `src/components/wallet/TransferFundsModal.tsx` and `AddWalletModal.tsx` — each mounted once in `App.tsx`, following the same pattern `QuickAddModal` established (the modal subscribes to finance state/actions itself; `App.tsx` owns only the `isOpen` boolean and, for transfer, an optional preselected wallet id). Reached from `DashboardView` (the Wallets section's links) and `WalletsView` (header buttons, and the detail's "Transfer out", which passes the wallet id) — `WalletsView` mounts neither modal itself.
- **`AddWalletForm`/`WalletTransferForm`'s only 2 call sites are `AddWalletModal`/`TransferFundsModal`.**
- **`editWallet` writes name, type and colour only; `setWalletArchived` writes `is_archived` only.** Both go through the private `updateWallet`, which sends only the columns it is given - never `balance`, which moves only through the ledger. A wallet with a negative balance can only be a credit card (`WalletEditSchema`).
- **An archived wallet** leaves net worth (`isActiveWallet`) and every new-entry picker (Quick Add, the Transactions Add form, the repay modal, transfers), and sits under "Archived (N)" with Unarchive. The ledger guards, `EditTransactionPanel`, the CSV name lookup and the Transactions filter still resolve it, so history stays editable and searchable.
- **Delete is a soft delete of the wallet only.** Its rows stay and still count toward spending and income, and the confirmation says so with the count.
- See `docs/audit/decisions/0008-wallet-surface-ownership.md` and `0034-wallets-page.md`.

## Transfers: the preview must mirror the ledger
`WalletTransferForm` renders a live source → destination balance preview (ADR `0014`).
- **It shares `roundToCents` with the ledger.** That helper lives in `src/utils/money.ts` and is imported by both `FinanceContext.tsx` and the transfer form, so what the user is shown before consenting is computed by the same function that commits. Do not give the UI its own rounding, and do not merge it with `mathEvaluator`'s `roundToTwoDecimals`.
- **The preview mirrors `addTransaction`'s TRANSFER arithmetic.** If the transfer path ever stops going through `addTransaction`, the preview drifts silently — there is no test that would catch a divergence in the formula itself.
- **The two wallet `<select>`s must stay real, visible form controls.** `tests/wallet-forms.spec.ts` asserts visibility and reads `.inputValue()`; replacing them with cards is not a locator move and the spec-edit policy forbids it. That spec is the transfer flow's regression guard — it passed unedited through the Phase 42 redesign.
- **Overdraft warns, never blocks.** A `CREDIT_CARD` wallet legitimately carries a negative balance, so `canSubmit` deliberately ignores the projection. Pinned by `tests/transfer-preview.spec.ts`.
- **The projected balance is static text.** It re-renders on every keystroke, so anything that tweened between values would lag the input (ADR `0026` removed the app's only count-up).

## Debt repayment: the payoff block mirrors the ledger
`TransactionForm` renders a payoff block under the amount input whenever the type is `DEBT_REPAYMENT` and a target debt resolves (ADR `0015`). It holds the quick-payoff chips, the projected remaining balance, and a `ProgressBar`.
- **It shares `roundToCents` with the ledger**, exactly as the transfer preview does. `Math.max(0, roundToCents(remaining - amount))` is `addTransaction`'s own DEBT_REPAYMENT arithmetic; the percentage mirrors `DebtCard`'s with its `isSettled ? 0 : remaining` branch collapsed. Do not give the UI its own rounding.
- **`ProgressBar` clamps its own bar; the printed percentage does not get that for free.** The Add Debt form permits `remaining > total`, so the displayed number carries its own `Math.min(100, Math.max(0, …))`.
- **A repayment cannot exceed what is owed, at either layer (ADR `0016`, amending `0015`).** `addTransaction` rejects it with a `MutationResult` error before any mutation, and the form disables submit and names the maximum. The guard's position in `addTransaction` is load-bearing: **after** the `existingTx` replay check (or retrying a payment that settled its debt gets rejected) and **before** `inFlightIdempotencyKeys.add` (or the key leaks and, since `useIdempotencyKey` reuses it on retry, the form is bricked). The `Math.max(0, …)` floors stay as defence against a stale-`debtsRef` race, not as dead code.
- **`isOverpaying` must test `repayTargetDebt !== null`.** On a non-debt form `remainingDebt` falls back to 0, so `overpayment` equals the whole amount — feeding that into the submit gate without the null check disables **every** EXPENSE and INCOME submission in the app. Covered by its own regression test.
- **Soft-delete and restore move the debt with the wallet.** `setTransactionDeleted` reverses the decrement on delete and reapplies it on restore, recomputing `isSettled` both ways. Before ADR `0016` it did neither, so deleting a repayment refunded the wallet and kept the debt reduction — free money, repeatable. The reversal is deliberately **uncapped**, so a legacy overpaid row can push `remainingAmount` above `totalAmount`; both progress clamps absorb it.
- **`settleDebt` is deliberately exempt** — it zeroes a debt with no wallet debit and no ledger row, as a "written off / paid outside the app" affordance. Documented in ADR `0016` so a later audit finds a decision, not an oversight. Since ADR `0035` the Debt payoff page's "Mark as paid off" confirms first, saying it records no payment and moves no money, and keeps a failure in the dialog.
- **The chips seed through `#repay-amount-math`, never replace it.** That id, `#repay-wallet-select` and `#confirm-repay-btn` are the entire surface of `tests/debts.spec.ts`, the repayment flow's regression guard — it passed unedited through this phase and should stay that way.
- **A chip latches the amount field.** `InlineMathInput`'s `seed` effect deliberately never fires `onUserEdit`, so `seedPayoffAmount` sets `userTouchedRef.current.amount` itself. A chip is an explicit choice of amount and outranks the note parser from that point on — the same rule as typing in the field by hand (ADR `0013`).
- **The block stays mounted with no amount typed**, deliberately unlike the transfer preview. `presetDebtId` suppresses the Debt Target select, so this is the only place the debt's remaining balance appears in the repay modal at all.

## Debt payoff page: an edit never touches what is owed (ADR `0035`)
- **`editDebt` writes `name`, `total_amount`, `interest_rate`, `minimum_payment` and `due_date` only, never `remaining_amount` or `is_settled`.** What is still owed moves only through repayments (`record_transaction`) and `settleDebt`, so an edit cannot overwrite a repayment that landed after this device loaded. A signed-in test pins the absence of both keys.
- **`DebtEditSchema` refuses a borrowed total below what is still owed.** The remainder is read from `debtsRef` before any `setState` (ADR `0022`); the message formats it with `formatCurrencyAmount`. A blank optional field clears it (`0`, `0`, `null` on the wire, which `mapDebtRow` reads back as absent).
- **The page lists `activeDebts` nearest due date first, then an open "Paid off (N)".** A paid-off card keeps "100% Fully Settled!" and "✓ Debt Fully Settled", which `debts.spec.ts` and `soft-delete.spec.ts` read, and `#settle-debt-{id}` stays a visible button on an owed card so `debts.spec.ts`'s count-0 check means something.
- **Edit and Delete live in the card's ⋯ menu** (`#debt-menu-btn-{id}`, `#edit-debt-{id}`, `#delete-debt-{id}`); a spec opens the menu first. Make repayment and Mark as paid off stay on the card.
- **When a dialog's own opener is gone after it closes** (a write-off, a repayment of the whole remainder, a delete), `DebtsView` moves focus to the debt's ⋯ menu or to `#open-add-debt-btn`.

## Daily diary: the form starts from the day's own entry (ADR `0036`)
- **`DiaryEntryForm` is mounted with `key={date + entry id}` and initialises its state from the day's saved entry.** Do not reintroduce defaults that ignore it: before Phase 61 the page opened on mood 5, a workout and a pre-typed note, so "Edit today's entry" showed made-up values and one Save overwrote today.
- **A day with no entry has no mood picked, and Save stays disabled until one is** (owner's decision). Nothing is pre-typed.
- **No future day can be logged:** › is disabled on today, the picker has `max` = today and ignores a later value, and a future calendar day is disabled.
- **Mood, Activity and Meals share one selected style** (`bg-selected text-on-selected border-focus`, `aria-pressed`). No emoji and no colour by meaning, anywhere on the page.
- **A day's spending is `daySpending` (L1)**, never an inline filter; the Dashboard's `moodSpendingDays` uses it too.
- **Delete confirms first and checks `deleteDiaryEntry`'s result.** Edit and Delete live in each entry's ⋯ menu.
- **"N transactions" hands off a day** through `App.tsx`'s `transactionsDayFilter` to `TransactionsView`'s `initialDayFilter`, shown as `#tx-day-filter`. It overrides the range, and the range select reads "One day" meanwhile; `TimeRange` and L2 are untouched.
- **`diary.spec.ts` depends on** `#mood-btn-5`, `#diary-notes-textarea`, `#save-diary-entry-btn`, the text "Diary entry logged", `data-testid="diary-entry-notes"` and `#export-diary-btn`. Keep them.

## Categories page: one colour each, a locked System group (ADR `0037`)
- **The list is three groups by type** (`categoryGroups`): Expense, Income and System, where System is `isMovementCategory`, matched by type. A row is `li#category-row-{id}` holding one `button#edit-category-{id}`; a System row is not a button and names itself with `systemCategoryLabel`.
- **L9 is enforced twice:** the colour grid disables a colour another live category uses, with a strike and the name ("Rose, used by Pets"), and `addCategory`/`updateCategory` refuse it from `categoriesRef`. `updateCategory` checks only when the colour changes, so a category already sharing a colour from before L9 can still be renamed.
- **Past twelve, colours repeat** (audit 012 finding 1). Once every identity colour is in use (`paletteExhausted`), the grid enables every swatch ("Rose, also used by Food & Dining", no strike), the form says the category will share one, and both guards accept a repeat. A new category starts on `nextColor`: the first free colour, else the least-shared, earliest on a tie. Never block Add on colour.
- **A stored colour outside the twelve is shown as a "Custom color" swatch** and kept on Save; without it a Save would force a recolour. Since Phase 63 only a custom category picked before Phase 62 is in that state.
- **Spec 5.1's colour migration (Phase 63, ADR `0038`) runs in two places that must move together:** `utils/identityColorMigration.ts` on what a device stores (the `pf_categories` and `pf_wallets` hydration, never the Supabase load) and `supabase/migrations/20261002_phase63_identity_colors.sql` in the cloud. A row moves only while it is live and still on its shipped colour, matched by name and old colour; a target another category holds becomes the first free identity colour (L9). The seeds start on the new colours.
- **Delete only an unused custom category** (owner's decision). Delete sits in the edit form, disabled with "Used by N transactions and M rules"; a default has none. `categories.spec.ts` opens the row's form before any Delete assertion, so a count-0 check is never vacuous.
- **One render path:** from `lg` the form switches between New and Edit in place; below it an edit opens in a `Modal` sheet (`useMediaQuery`, as on the Wallets page).
- **The Smart rules tab is `SmartRulesPanel`**, unchanged in behaviour: `keywords.spec.ts` and `smart-rules.spec.ts` depend on `#category-subtab-rules`, `#new-keyword-input`, `#keyword-category-select`, `#save-keyword-rule-btn`, `#test-parser-input`, the `metric-*` testids and `rule-row-*`. Types read as words ("Groceries (Expense)").
- **The header tabs show their label from `xl` (1280px) and their icon below it** (audit 007 finding 1): six labels overflow the bar at 1024.

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
- **Concurrency is capped at 4**, which is the real rate-limit protection; a `rate-limited` row is retried once, and `unavailable` aborts the whole run rather than walking the rest into a dead endpoint.
- **A 429 that names its wait pauses the whole run** (ADR `0052`). `classifyOnce` reads `Retry-After` (seconds or an HTTP date) into `retryAfterMs`; `classifyBatch` then holds **every** worker until `resumesAt`, because the per-account limit (ADR `0049`) is shared by all of them, and retries the refused row after it.
  - The wait is never under 400 ms. Over a minute (`MAX_RETRY_AFTER_MS`, the limit's own window) the run stops instead: `rateLimited: true`, answers so far kept, the note says so.
  - **The guest firewall's 429** (`X-Vercel-Mitigated: deny`, no `Retry-After`) is `{ kind: 'rate-limited', firewall: true }` (ADR `0053`). The run estimates the window itself: it starts with the run's first request, and a request 60 s or more later starts the next one. The pause lasts until that start + 61 s; when that is already past, a whole 60 s. Never over 60 s.
  - Released in `07d51f1` (PR #27, Vercel `dpl_FetmkPeDZf6qNf3Aea6bH5cXQQWG`), with the proxies' forwarded wait. Neither yet seen on a real import, only against mocked headers.
  - A 429 that neither names a wait nor carries the firewall's mark keeps the old per-row 400 ms retry.
  - `ImportCsvModal` shows the pause as "Rate limit reached, continuing in N s" (`csv-classify-wait`), counting down; Cancel ends it at once.
  - **A screen reader hears it through one polite live region** (`csv-classify-announcer`, `role="status"`, `aria-atomic`, `sr-only`, ADR `0054`), mounted empty with the preview. It changes only when a pause starts ("Rate limit reached. Classification paused for about N seconds, then it continues on its own."), when it ends with the run going ("Rate limit cleared. Classification resumed."), on Cancel ("Classification cancelled. No categories were filled in."), when the run stops at a wait over a minute, and when any run finishes (its note, word for word, so "nothing matched" and "Jev is unavailable" are heard too; ADR `0055`). Pause and resume are set in the progress callback (`reportProgress`), in event order, never from an effect: a late effect's "resumed" once replaced the note on WebKit CI. Nothing is announced after Cancel. The countdown is never in it. It is emptied when a run starts. Released in `45eb2d4` (PR #28, Vercel `dpl_JARpUTJzSYio4svwtyA4RBNpv2mo`); every run's note and the event-order fix in `e21c071` (PR #29, Vercel `dpl_3u7u9dGSJfBUeMirCY4GDYF2LMBS`). Not yet tried with a screen reader.
  - Released in `23d73ed` (PR #26, Vercel `dpl_AWVqP3WTkaKHoBbojS4gKhyPR2GK`). Not yet seen on a real signed-in import, only against the tests' simulated 429.
- **`commitBulkImport` returns a `MutationResult` and moves no money on a failed commit.** Signed in, it is one `import_transactions` RPC (ADR `0023`): every row plus one relative update per wallet in a single database transaction, or nothing. Only its fallback for an unmigrated project inserts first and compensates (ADR `0022`: insert error checked before any balance write, sequential balance writes, written wallets restored and inserted rows **soft**-deleted). `TransactionsView` keeps the preview open on failure (`#import-commit-error`) and disables `#commit-import-btn` while a commit is in flight, with a ref latch for a double-tap that beats the state update. That latch is an in-flight guard, **not** dedupe.
- **One import key per preview.** `TransactionsView` arms `importKeyRef` with `generateIdempotencyKey()` when a file is parsed and passes it to `commitBulkImport(rows, importKey)`. A retry of the same preview after a lost response replays; a new file gets a new key. Never reuse a key across previews — the second import would silently replay the first.
- **A too-short CSV note skips its row, never the run.** `isClassifierWorthTrying` is false both for run-wide conditions and for one note under `MIN_CLASSIFIABLE_LENGTH`; `batchClassifier` checks the length first, so a single one-character description cannot report the endpoint unavailable.
- **There is no import deduplication, deliberately.** Keys are per preview (signed in) or embed `Date.now()` (guest), so a second import never collides with the first, and `csv.spec.ts` asserts a re-imported row appears twice. Do NOT add dedupe without deciding first what "the same transaction" means across two files — and without updating that spec.

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

### Phase 52 (ADR `0024`)
`supabase/migrations/20260928_phase52_security_ledger.sql` (applied to the live project on 2026-09-27) hardens `handle_new_user` (`search_path` pinned; EXECUTE revoked from PUBLIC/anon/authenticated and **granted explicitly to `supabase_auth_admin`**, which only ever had it through PUBLIC), adds a nullable `wallets.idempotency_key` with a partial unique index, creates `create_wallet` and `list_my_sessions`, and re-creates `record_transaction`/`import_transactions` from the deployed Phase 51 bodies. **Re-creating a deployed function starts from the deployed body, md5-checked against its migration file, and ends with the previous phase's probe re-run** - that is what proves nothing already shipped was lost. Probe: `supabase/tests/20260928_phase52.probe.sql`.

### Phase 58b (ADR `0033`)
`supabase/migrations/20260930_phase58b_update_transaction.sql` (applied to the live project on 2026-09-30) creates `update_transaction`, executable by `authenticated` only. Probe: `supabase/tests/20260930_phase58b.probe.sql`.
- **`updateTransaction` has no legacy fallback.** A missing function rolls back and says the database needs its update. Writing an edit as absolute balances could not be atomic, which is the whole of ADR `0023`.
- **Send the `updated_at` the client edited**, read before the optimistic write replaces it.

### Phase 58s (ADR `0032`)
`supabase/migrations/20260930_phase58s_profiles_hardening.sql` (applied to the live project on 2026-09-30) removes every client write to `public.profiles`. Before it, the update policy checked only the row's id and `authenticated` could update every column, `role` included. `authenticated` keeps SELECT on its own row; `anon` has nothing.
- `handle_user_updated` (on `auth.users` updates of `email` or the metadata `name`, with a WHEN clause so a sign-in never fires it) copies them into `profiles`. It is hardened like `handle_new_user`.
- **Nothing in the app reads or writes `profiles`, and nothing should start writing it from the client.** `role` is changeable only by the service role now, which is what would let a future policy trust it.
- Probe: `supabase/tests/20260930_phase58s.probe.sql`.

### Phase 63 (ADR `0038`)
`supabase/migrations/20261002_phase63_identity_colors.sql` is a **data-only**, idempotent migration: spec 5.1's colour moves for every live row still on its shipped colour, with the L9 collision rule. It is applied **after** the code that seeds the new colours is deployed, so no older seed lands after it; running it again catches a cached older client's seed. Probe: `supabase/tests/20261002_phase63.probe.sql`. Applied to the live project on 2026-10-02 (version `20261002013725`): 47 category rows and 6 wallets moved.

### Phase 64 (ADR `0039`)
`supabase/migrations/20261002_phase64_seed_starter_account.sql` creates `seed_starter_account()`, executable by `authenticated` only. **Apply it before deploying the client that calls it**: the client has no fallback, so without it a new sign-up gets no starter set and sees "Could not read wallets". `20261002_phase64_dedupe_categories.sql` is data only and idempotent: it re-points transactions and keyword rules to the earliest live category of each name and soft-deletes the rest. Probe: `supabase/tests/20261002_phase64.probe.sql`. The seed function was applied to the live project on 2026-10-02 (`20261002041331`). The dedupe was run in the SQL editor the same day (not in the migration history) and left each name one live row; the 27 copies were removed rather than soft-deleted (ADR `0039`).
- **The server decides whether an account is new.** Row-level security answers a read made without a valid session with zero rows and no error, so an empty wallet read is not evidence of a new account; seeding on it seeded one account five extra times. The function refuses a call with no session, seeds only an account that has never had a wallet or category row (deleted ones included), and serialises concurrent calls with a per-account advisory lock.
- **On a failed seed the load stops without applying the empty read** and sets `syncError`; `not-new` carries on loading. The starter set exists twice, in that function and in `FinanceContext.tsx`'s guest defaults; change both together. Since Phase 54 both are three wallets at ฿0.00 and no debt, under their own names ("Main Checking" on the client, "Checking Account" on the server, on purpose).

### Phase 54 (ADR `0040`)
`supabase/migrations/20261003_phase54_zero_starter_seed.sql` re-creates `seed_starter_account()` from the Phase 64 body (md5-checked against the deployed one) with its three wallet balances at `0.00`, and states the grants again. Probe: `supabase/tests/20261003_phase54.probe.sql`. Applied to the live project on 2026-10-02 (version `20261002061331`) after its probe and the Phase 64 probe's seed and grant sections passed on the new body; the deployed body's md5 matches the file (`90c93706...`). The client does not depend on it. Released in `0882695` (PR #13), Vercel `dpl_GSmZYYCtL4NU7UUsvDCojGEXRCWK`; production serves the local build byte for byte, and a signed-out smoke test there shows ฿0.00 across 3 wallets and no debts.
- **New accounts only.** Accounts already seeded and stored guest ledgers keep their balances: real rows may sit on them. A seeded account never reaches the inserts again, so the new body changes no existing row.
- **The filename sorts after `20261002_phase64_*`** on purpose, so a fresh replay ends on the ฿0.00 body.

### Phase 73 (ADR `0049`)
`supabase/migrations/20261003_phase73_ai_request_quota.sql` creates `public.ai_request_counts` (row-level security on, no policy, no client grant) and `consume_ai_quota()`, executable by `authenticated` only. Probe: `supabase/tests/20261003_phase73.probe.sql`.
- **Apply it before deploying the proxies that call it.** Without it every signed-in AI request is 503 (the client falls back to keyword rules and the local summary); guests are unaffected.
- **The function only counts;** the limit is in the proxies. It holds one row per active account: each call deletes that account's earlier minutes.
- Applied to the live project on 2026-10-03 by the owner in the SQL editor (not in the migration history), after its probe and negative control; the deployed body's md5 matches the file. Released in `ec9cabb` (PR #23), Vercel `dpl_5sd1QkZZ4Qx4tBhQCTPzUZQhG3WT`.

### Atomic ledger writes (ADR `0023`)
`supabase/migrations/20260927_ledger_rpcs.sql` (applied to the live project on 2026-09-27) moves every other signed-in ledger write into RPCs that lock the rows they touch, apply **relative** updates, and replay on the idempotency key:
- `record_transaction` — `addTransaction` for every type **except TRANSFER** (it rejects TRANSFER; `transfer_funds` stays the one transfer implementation).
- `set_transaction_deleted` — soft-delete/restore; idempotent by state (`changed: false`), so no key.
- `update_transaction` (Phase 58b, ADR `0033`) — an edit. It takes the full desired row, locks the row and every wallet on either side, and applies `_ledger_apply_effect(old, −1)` then `(new, +1)`.
  - It is idempotent by state, and **its replay check runs before its stale guard** (`p_expected_updated_at`, which raises `TRANSACTION_CHANGED`), or a retry after a lost response would be refused by its own first attempt.
  - A repayment or an adjustment keeps its money; only its note and date change.
- `import_transactions` — one CSV preview, all rows or none; row keys are `importKey:rowIndex`.
- `_ledger_apply_effect` / `_ledger_source_sign` / `_ledger_row_state` / `_ledger_import_state` — private helpers revoked from every client role. `_ledger_apply_effect` is the **one SQL implementation** of the ledger arithmetic and must mirror `addTransaction`/`setTransactionDeleted` term for term.

Rules that are load-bearing:
- **The user comes from `auth.uid()` only** — no user-id parameter. The RPCs are `security definer`, so every lookup filters by owner explicitly.
- **Replay runs before the ADR `0016` overpayment guard**, mirroring the client's `existingTx` → guard order, so a retried settling payment replays instead of being rejected. **Replay matches any row with the key, live or soft-deleted** — a retry must not resurrect a deleted intent.
- **No overdraft check in SQL** (ADR `0014`). The dropped `create_ledger_transaction` had one; do not reintroduce it.
- **The server's overpayment error is `DEBT_OVERPAYMENT` with the remainder in `detail`.** The client matches that exact message and formats its own text with `formatCurrencyAmount` — money is never formatted in SQL.
- **On success the client adopts the returned balances and debt remainder** (`adoptLedgerState`), replacing its optimistic values. **An error with no SQLSTATE is an unknown outcome** (`isUnknownOutcomeError` — the request may have committed): roll back, then `refreshFromCloud()`. So is a success payload with no row.
- **The legacy absolute-write paths remain only as the missing-function fallback**, and Phase 50's F1/F2/F6 harness tests are their regression guard. Any other RPC error must roll back, never fall through — the RPC may already have written.
- **Verify SQL with `supabase/tests/20260927_ledger_rpcs.probe.sql`**: migration + assertions inside `BEGIN … ROLLBACK`, run against the real schema before applying (keep the `\ir` line) and after (remove it). A runner without psql pastes the migration in place of `\ir`.
- **Schema drift recorded in ADR `0023`**: the live DB also has an untracked non-partial `transactions_user_idempotency_uidx`, so a key on a soft-deleted row blocks reuse there. Neither idempotency index is touched by the migration.

## Accounts, sessions, sign-out and the ledger's edges (ADR `0024`)
- **Sessions are real or absent.** `listMySessions` reads `auth.sessions` through `list_my_sessions` and returns `sessions: null` when unavailable - never an empty list, which would read as "no other devices". Revocation is only `signOutOtherDevices` (`scope: 'others'`) and `signOut({ everywhere: true })` (`'global'`). **No per-device revoke**: it would mean writing to the `auth` schema. Never reintroduce a browser-built session list.
- **A revoked device evicts itself within a minute** (ADR `0024`, amended). Revocation reaches refresh tokens only; the access token is a JWT that PostgREST and Realtime accept until it expires (an hour here), and supabase-js notices only at its next refresh. `verifySession` calls `auth.getUser()` - the one call that checks the session server-side - on every reconnection trigger, on `focus`, when the signed-in effect mounts, every 60 s while visible, and after a Data API 401. A rejection (`isSessionRejectedError`) signs this device out locally; **no answer - offline, 5xx, 429 - keeps the session**. On `session_not_found` supabase-js has already emitted `SIGNED_OUT`, so the F5 reset has run and the epoch check stops a second sign-out.
  - **A 401 is a reason to check, never a sign-out by itself** - a token can expire in transit. The signal is `onDataApiUnauthorized` in `src/lib/supabase.ts`, a wrapper on the client's `fetch` that reports `/rest/v1/` 401s only (the auth endpoints handle their own), so no call site checks for it.
- **`signOut()` passes `scope: 'local'` explicitly.** supabase-js defaults to `'global'`, so a bare `supabase.auth.signOut()` ends every other session too.
- **Sign-out clears the device (F5).** `resetToGuestState` runs on an explicit sign-out and on an `onAuthStateChange` **`SIGNED_OUT`** event (a device revoked remotely) - never on any other event: a guest's `INITIAL_SESSION` also has no session, and resetting on it would wipe a guest ledger on every load. It drops the batched writer's queue, removes every `LEDGER_STORAGE_KEYS` entry (templates included - they never sync, so they are gone for good, and the confirmation says so) and resets every slice to the guest defaults. What actually keeps the account out of storage is that last step's writes overwriting the same keys; the queue drop is defence in depth (a control that removed it failed no test). `authEpochRef` makes a cloud load that was in flight stop after each read instead of landing the account's rows in guest state - keep that check after every `await` in `loadSupabaseData`.
- **Sign-in replaces, never merges.** `GuestDataNotice` says how many guest transactions will be replaced and offers a CSV export, loaded on click so papaparse stays out of the eager `AuthModal`'s chunk.
- **A signed ADJUSTMENT.** An ADJUSTMENT's `amount` is the signed correction (negative lowers the balance, zero is rejected); **every other type stays strictly positive** - in `TransactionSchema`, both ledger RPCs and the CSV validator. Render a transaction's sign with `txTypeMetaFor(type, amount)` and format `Math.abs(amount)`: `TX_TYPE_META.ADJUSTMENT` alone shows every upward correction as a debit, and formatting the signed amount would print the minus twice with the row's own sign. The three rows the old editor wrote in production were repaired on 2026-10-03 by intent, not by ADR `0024`'s script (ADR `0048`): one was the owner re-correcting the other by hand, so flipping both would have taken ฿920.00 too much. Before running a repair query on live rows, rebuild each affected wallet's balance from its ledger rows first.
- **Opening balances are ledger rows (F7).** Every user-created wallet with a non-zero opening gets an ADJUSTMENT "Opening balance" of the signed amount - `create_wallet` signed in (replayable on the per-form key `AddWalletForm` arms), a local row as a guest. A credit card may open negative; nothing else may. **The starter wallets open at ฿0.00** (ADR `0040`), so they write no opening row and need no exemption, and a fresh context still has no transactions.
- **A CSV repayment names its debt (F8).** The export writes a `Debt` column; the importer resolves it against live debts and marks a repayment with no, an unknown or an ambiguous debt invalid; `commitBulkImport` applies ADR `0016`'s guard **in aggregate** (two rows that each fit can overpay together) before anything moves, and the server re-checks under its lock. `import_transactions` still accepts a debtless repayment, for cached older clients only.
- **The Security tab is gone.** `AccountModal` is the fourth shell-level lazy modal (ADR `0010`'s latch); `#navbar-account-btn` and the mobile More sheet open it. `ActiveTab` has six members.
- **The PWA toast (`ReloadPrompt`) sits above the mobile nav** (ADR `0041`, audit 013 finding 1). Below `md` it is `bottom-[calc(5rem+env(safe-area-inset-bottom,0.5rem))]`: the nav is 65px plus the inset, the centre Quick Add's top is 66px up, so it clears both by 14px. From `md` it keeps `bottom-5`. Released in `517aee8` (PR #14).
  - **It is `z-45`: above the header and the nav, under every sheet and dialog** (ADR `0042`). At `z-50` it tied with `Modal` and won on DOM order, covering the More sheet's Debt payoff, Daily diary and Categories rows at 390 and the Transactions page's Add dialog at every width. `tests/toast-layering.spec.ts` checks it with `elementFromPoint` against the real toast. Released in `7e2daa9` (PR #15, Vercel `dpl_8vuPfAZLQkzY3dpuuXUSbXarHomX`), and confirmed on production with the same probe.
  - Its icon does not spin while it waits, and it has no entrance animation.
  - Its copy is plain: "Ready to use offline" and "A new version is ready", with a Reload button.
  - Any other fixed element added below `md` must clear the nav the same way.
- **Mobile nav is five slots**: Home, Transactions, centre Quick Add, Wallets, More. The More sheet renders as a **sibling** of `<nav>`, never a child - the nav's `backdrop-filter` makes it the containing block for fixed descendants and would clip the overlay.
- **The swipe guard is unit-tested only.** `isInsideHorizontalScroller` (computed `overflow-x` + real overflow, walked up to `<main>`) stops a swipe that starts in a wide table from changing tabs. A Chromium swipe synthesised through the DevTools protocol never completes inside a scroller - with the guard or without - so an E2E test of it passes vacuously; do not add one. Its effect on real touch hardware is unverified.

## Testing
Two suites, with a hard boundary between them — see "Unit tests" below for why the boundary is pinned from both sides.
- **Framework**: Playwright with Chromium, Firefox, and WebKit projects.
- **Suite size**: 147 tests across 29 spec files, run on all three browsers = **441 test runs**. All must pass.
- **Location**: `tests/*.spec.ts` (`transaction`, `wallets`, `diary`, `theme`, `wallet-forms`, `debts`, `soft-delete`, `keywords`, `categories`, `csv`, `auth`, `date-boundary`, `storage-persistence`, `presets`, `jev-classify`, `express-input`, `transfer-preview`, `debt-repayment`, `smart-rules`, `voice-input`, `csv-classify`, `insights`, `account-and-mobile-nav`, `transaction-edit`, `wallets-page`, `debts-page`, `diary-page`, `categories-page`, `toast-layering`), with shared helpers in `tests/helpers.ts`.
- **Never edit files while a run is in flight.** `playwright.config.ts`'s `webServer` is `npm run dev` — a live Vite dev server — so writing to `src/` mid-run HMRs the app under test and produces failures that do not reproduce in isolation. This cost a wasted baseline in Phase 39.
- **A second webServer, port 3100** (ADR `0042`): `vite --mode pwa-dev`, where `vite.config.ts` turns on vite-plugin-pwa's `devOptions`, so a development service worker registers and the real PWA toast appears. Only `toast-layering.spec.ts` uses it, through its own `baseURL`; every other spec stays on 3000, where no toast can cover a control. The mode writes `dev-dist/` (gitignored). Check 3100 for a stale server before a local run, as for 3000. Do not turn `devOptions` on for `npm run dev`.
- **Network mocking**: the rule is a **principle, not a file count** — every spec that intercepts a request must fulfil every response locally, so the suite spends no TypeSafe credits and needs no API key, on CI or on a laptop that happens to have one exported. Three specs currently rely on it: `tests/jev-classify.spec.ts` (live typing), `tests/csv-classify.spec.ts` (bulk import) and `tests/insights.spec.ts` (the monthly wrap-up). Adding a fourth is fine if it meets the principle; ADR `0020` generalised this after `0019` had amended it from one spec to two. `tests/voice-input.spec.ts`'s `addInitScript` Speech API stub is a different mechanism and intercepts nothing; neither does `tests/toast-layering.spec.ts`, which uses a real service worker.
- **Use the helpers**: `gotoTab(page, tabId)` waits for the tab to become active *and* for the `React.lazy` view chunk to resolve (`#view-loading-fallback` detaching). `addQuickTransaction(page, description)` seeds a transaction — a fresh context has three ฿0.00 wallets, **no debts and no transactions** (ADR `0040`), so any assertion about filtering is vacuous without it. `seedLedger(page, { wallets?, debts? })` seeds `SAMPLE_WALLETS` (฿7,650 across the same three ids) and/or `SAMPLE_STUDENT_LOAN` (`debt-starter-01`, ฿4,500 of ฿10,000) for a test that needs money or a debt. **Call it before `page.goto`**: it is an init script, and it writes once (behind `pf_seeded`) so a `page.reload()` keeps what the test saved. The unit suites' equivalent is `unit/fixtures/guestLedger.ts`'s `seedGuestLedger`, called before the provider mounts.
- **No fixed waits**: never use `page.waitForTimeout()` for debounces or async writes; assert on the resulting UI state so Playwright retries. Never guard a step with `if (await locator.isVisible())` — it does not retry and silently skips the assertion.
- **Timeouts**: `playwright.config.ts` sets generous expect/action timeouts for Firefox, which is slowest to paint a lazy view chunk under the Vite dev server. These bound failures only and do not slow passing runs. `colorScheme` is pinned to `light` so the `system` theme resolves deterministically.
- **Execution**: `npm test`, or `npx playwright test tests/<file>.spec.ts --project=chromium`.
- **Local runs use 4 workers** (`workers: process.env.CI ? 2 : 4`, ADR `0055`). Playwright's default, half the logical CPUs, was 6 on the 12-thread machine these phases run on. Measured over 441 Firefox runs, 6 workers took 10.4 m with 2 `page.goto` timeouts and a slowest test of 42.5 s; 4 workers took 10.2 m with none and 12.1 s. On another machine, measure the same way before changing it: `--project=firefox --repeat-each 3 --reporter=list`, then compare the slowest tests. CI keeps 2 workers per browser job and its retries.
- **CI Mode** (Phase 55-CI): a `checks` job (lint, unit) gates one E2E job per browser (`--project=<browser>`, matrix, `fail-fast: false`), each with 2 workers and retries. Pushes and PRs that touch only `docs/`, `anti-slop/` or Markdown skip the workflow, and a newer push cancels an older run on the same ref.
  - **The browser jobs run in Playwright's container image** (Phase 68, ADR `0044`), `mcr.microsoft.com/playwright:v<version>-noble`, as `--user 1001`. The image carries the browsers and their OS packages, so no job runs apt: `install-deps` took a median 23 s but up to 19 min on a slow Ubuntu mirror.
  - **Updating Playwright is two edits:** `package-lock.json` and `matrix.playwright` in `.github/workflows/playwright.yml`. A step before the tests fails with both versions named when they differ; the image has the browsers for its own release only.
  - `--user 1001` is the runner's user: the checkout stays writable and Firefox gets a `$HOME` it owns. Do not switch to root without setting `HOME: /root`.

## Unit tests: what the browser cannot reach
`npm run test:unit` runs Vitest over **`unit/`**: 785 tests in 30 files, ~39 s (ADR `0021`, extended by `0022`, `0023`, `0024`, `0026`, `0027`, `0028`, `0029`, `0030`, `0031`, `0032`, `0033`, `0034`, `0035`, `0036`, `0037`, `0038`, `0039`, `0040`, `0041`, `0042`, `0043`, `0045`, `0047`, `0049`, `0050`, `0052`, `0053`, `0054` and `0055`; the reconnect tests' debounce windows and the sign-out tests' 400 ms writer waits are most of the growth from ~3 s). It exists because four phases in a row closed with a coverage hole for the same structural reason, not because E2E coverage was thin.
- **The directory is `unit/`, not `tests/unit/`, and that is load-bearing.** Two default globs collide. Vitest's default `include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)`, which collects all 22 Playwright specs. Playwright's default `testMatch` is `**/*.@(spec|test).?(c|m)[jt]s?(x)` — note `@(spec|test)` — which collects `*.test.ts` as readily as `*.spec.ts`. So the boundary is pinned three times: a directory `testDir: './tests'` cannot see, an explicit `include` in `vitest.config.ts`, and an explicit `testMatch: '**/*.spec.ts'` in `playwright.config.ts`. The last is redundant today **on purpose** — it makes a future move of the unit tests under `tests/` read as the breaking change it is.
- **`vitest.config.ts` is its own file, never a `test` key on `vite.config.ts`.** `vite build` does not read it, which makes zero production bundle impact structural rather than a matter of discipline.
- **`environment: 'node'` is the default; the two DOM suites opt in per file** with a `// @vitest-environment jsdom` docblock. The pure-module suites never touch jsdom's `AbortSignal`, `fetch` or timer surfaces, which differ from Node's in ways that fail about the environment rather than the code.
- **The six suites cover exactly what Playwright structurally cannot**: `ledger-guards` (the repayment guard's *ordering* — key leak, replay precedence — which has no UI symptom at all), `speech-support` (the `isSecureContext` branch; Playwright always runs on localhost), `batch-classifier` (a fabricated 429 and a controllable clock), `spending-summary` (threshold boundaries the transaction form cannot seed precisely), `authenticated-ledger` (the signed-in branch of every write — no spec signs in), `proxy-contract` (the `api/` handlers themselves — every spec mocks `/api/*` at the network layer). ADR `0024` added five small ones for the same reason: `csv-exchange` (row-level CSV validation), `tx-cells` (the signed-ADJUSTMENT display), `user-agent`, `date-format` (a `TZ`-pinned local-calendar check) and `swipe-guard` (layout stubbed in jsdom). Its amendment added `supabase-client` (the real client's 401 signal over a stubbed `fetch` - the signed-in harness mocks that module out). ADR `0032` added `proxy-auth-client`: the clients' `Authorization` header and 401 handling. It stubs the `VITE_SUPABASE_*` environment and re-imports the modules for each test, because `isSupabaseConfigured` is read at load time and a local `.env` sets it while CI has none.
- **`ledger-guards.test.tsx` mounts the real `FinanceProvider`** and calls the real actions. The provider is inert under test: its auth effect returns early on `!isSupabaseConfigured` and its realtime channel on `!isAuthenticated`, so there is no network call and no WebSocket. Do NOT extract the ledger arithmetic into a pure module to make it "more testable" — extraction cannot test ordering, which is the part that broke.
- **`authenticated-ledger.test.tsx` is the signed-in harness, and it differs from `ledger-guards` on purpose** (ADR `0022`). It replaces `src/lib/supabase` with `vi.mock` (`isSupabaseConfigured: true`, a recording chainable fake with per-table/op error injection and gates), so no `src/` export exists for it. Two properties are load-bearing: every fake call settles on a **macrotask** (`setTimeout(0)`), and actions run **without `act()`** (`IS_REACT_ACT_ENVIRONMENT = false`, state read via `waitFor`). `act()` flushes React before the awaited code resumes, which made F1's double write come out correct — under `act()` the test passed against the bug. Its `beforeEach` waits for `isSyncing === false`, not just for rows to appear; waiting on rows alone raced.
  - **Its `rpc()` is a router** (ADR `0023`): an RPC with no handler answers `PGRST202`, so a test that installs nothing runs the legacy fallback. `installLedgerRpcs()` adds a JS stand-in for the three ledger RPCs over the in-memory tables; `lostResponses` makes the next call commit and then report a transport error. The stand-in proves the client's contract only — the SQL probe proves the SQL.
  - **Use `landed(txId)` before a second action on a row the first one created.** It waits for the row and one macrotask, so the ref-mirror effects have run, as they have by a user's next tap. Without it a delete fired in the add's own tick finds nothing in `transactionsRef`.
  - **Proving an absence needs a bounded wait** (`quietPeriod`, 600 ms > the 400 ms reload debounce). Use it only for "no reload happened", never to wait for something to happen.
- **Nothing in `src/` was widened to be testable.** `detectSupport`/`toSpeechError` stay module-private and are driven through the hook's public `isSupported`/`error`. Keep it that way: an export added only for a test is a claim the module does not otherwise make.
- **CI runs it in the `checks` job that every browser job `needs`**, so a unit failure aborts in seconds without downloading a browser.
- **A file that pins `TZ` sets it at the top, when it loads, never in `beforeAll`.** A module-level `const TODAY = todayIsoDate()` runs before any hook, so `unit/diary-page.test.tsx` computed it in the runner's UTC and failed 4 tests on CI every night between 17:00 and 23:59 UTC (PR #17). Check a date test with `TZ=UTC` as well as `TZ=Asia/Bangkok`.
- **Two behaviours are pinned as-is with the discrepancy recorded, not "fixed"**: `batchClassifier`'s backoff for a 429 **without** `Retry-After` or the firewall's mark is `BASE_BACKOFF_MS * attempt`: **linear**, and with `MAX_ATTEMPTS` at 2 there is exactly one 400 ms wait, so linear-vs-exponential is unobservable from outside. And `useSpeechRecognition`'s `start()` checks only for a constructor, never `isSupported`, so on an insecure origin it arms a session that cannot run, unreachable only because `TransactionForm` renders the mic behind `{isVoiceSupported && ...}`.

## Environment / Config
Refer to `.env.example`:
- `VITE_SUPABASE_URL`: Supabase project URL (falls back to local storage if absent).
- `VITE_SUPABASE_ANON_KEY`: Supabase public anon key.
  - Both are also read at runtime by the `api/` functions (`checkCaller`, ADR `0032`) to verify a signed-in caller's token. On a deployment without them, a request carrying a token gets 503, and a guest request still works.
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
- **Balances do not animate.** `AnimatedCounter` and ADR `0009`'s direct-DOM-write mechanism are gone (ADR `0026`): a figure still counting up can be read as the wrong amount. Render a balance with `ui/Money`, and do not reintroduce a count-up, which would also bring back a per-frame render cost.
- **`QuickAddModal`/`TransferFundsModal`/`AddWalletModal`/`AccountModal` mount on first open, behind `React.lazy` and a `hasOpened` latch that never resets** (Phase 36, T76; see `docs/audit/decisions/0010-deferred-shell-modal-mounting.md`) — this is what keeps `mathjs`/`vendor-math` (110.72 kB gzip) off the initial critical path. A bare `{isOpen && <Modal/>}` gate does not work as a substitute: it unmounts the wrapper the instant `isOpen` flips false, killing `Modal`'s `AnimatePresence` exit animation and racing `TransferFundsModal`'s delayed-close success flash out of existence before it can render. `AuthModal`/`ReloadPrompt` stay eager on purpose — deferring either buys no bundle weight (`AuthModal`) or delays PWA service-worker registration (`ReloadPrompt`).
- **Dynamic Calculation Inputs**: Amount inputs accept inline arithmetic expressions (e.g., `120/4 + 15*2`) sanitized by regex before evaluation.
- **Two rounding helpers, deliberately different**: `roundToCents` in `FinanceContext.tsx` is plain cent rounding for the ledger; `roundToTwoDecimals` in `mathEvaluator.ts` carries a magnitude-scaled epsilon nudge for half-cent inputs. Do not merge them. `roundToCents` is the only cent-rounding in the ledger — an inlined `Math.round(x*100)/100` at a ledger write site is forbidden; `csvExchange.ts`/`diaryExport.ts`'s own `Math.round(x*100)/100` uses are CSV/diary aggregate math, not ledger rounding, and are not the same rule.
- **Do not check a `useMediaQuery` page with a full-page screenshot.** Chromium resizes the viewport to 1px wide for the capture, which flips the query, opens the narrow layout's sheet, and can leave its exit animation stuck, so the page looks doubled. A real resize gives one copy each way (Phase 59). Use viewport screenshots.
- **Wallet forms are shared, but not with the views you'd expect**: `AddWalletForm` and `WalletTransferForm` in `src/components/wallet/` are consumed only by the shell-level `AddWalletModal`/`TransferFundsModal` (see "Wallet surface ownership" above) — not by `WalletsView`, which only triggers those modals via callback props. The forms own their draft state; containers pass element ids, field tone, and success callbacks. Edit the shared form component, not one caller.

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
- Do NOT give each CSV worker its own wait on a 429 that names one, or wait longer than a minute; the pause is shared and capped (ADR `0052`).
- Do NOT put the import's countdown, or anything that changes every second, in a live region; the pause is announced once, through `csv-classify-announcer`, and every finished run announces its note (ADR `0054`, `0055`).
- Do NOT read a 429 as the guest firewall's without `X-Vercel-Mitigated: deny`, and do NOT forward any TypeSafe header but its wait, as `Retry-After` in seconds (ADR `0053`).
- Do NOT let the CSV importer classify automatically on upload, and do NOT rely on the classifier cache to collapse repeated rows — de-duplicate before dispatch. See ADR `0019`.
- Do NOT widen `classifyDescription`'s contract; extend `classifyOnce` instead.
- Do NOT add CSV import deduplication without a decision on what "the same transaction" means; `csv.spec.ts` currently asserts its absence.
- Do NOT let a model emit a currency figure; it picks the pattern, `renderInsight` states the numbers — see ADR `0020`.
- Do NOT send raw ledger content to `/api/insights`, and do NOT give the insights card an error branch; the offline path is the same renderer.
- Do NOT delete or bypass `smartMatcher.ts` / `keyword_rules` in favour of Jev — it is the offline layer and the user's override channel. See ADR `0011`.
- Do NOT let `classifyDescription()` throw, and do NOT give the classifier a code path that can reject.
- Do NOT accept Jev question wording (`instructions`/`criteria`/`model`/`state`/`questions`) from the client in `api/classify.ts`.
- Do NOT add a `VITE_`-prefixed TypeSafe key, or call `api.typesafe.ai` from browser code — it is CORS-blocked regardless.
- Do NOT bump `@playwright/test` without changing `matrix.playwright` in the workflow to the same version, and do NOT bring back `install-deps` or a browser cache in CI; the container carries both (ADR `0044`).
- Do NOT raise local Playwright workers, or add local retries, without measuring the slow tail first; a local gate should show a failure, and 6 workers here made 3 to 10 s tests take up to 42 s (ADR `0055`).
- Do NOT set a live region's text from a passive effect when another handler sets it too; the effect can run after the later update and replace it. Set each announcement where its event happens (ADR `0055`).
- Do NOT wait only for a row on screen before calling an action whose guard reads a ref mirror; the mirror is a passive effect that can lag the render, so flush effects (`act`, or one macrotask) first, as a person's next tap would (ADR `0055`).
- Do NOT put unit tests under `tests/`, and do NOT remove either collection pin (`include` in `vitest.config.ts`, `testMatch` in `playwright.config.ts`) — each runner's default glob collects the other's files. See ADR `0021`.
- Do NOT move Vitest config onto `vite.config.ts`; a separate `vitest.config.ts` is what keeps the test toolchain structurally unable to reach the production build.
- Do NOT use `process`, `Buffer`, `__dirname`, `global` or `require` in `src/`, or import a Node built-in there; read settings from `import.meta.env`. `npm run lint` refuses them (ADR `0045`), and a `node-guard-ignore` needs its reason.
- Do NOT export a symbol from `src/` solely to make it unit-testable — drive it through the public surface, as `speech-support.test.tsx` does with `detectSupport`.
- Do NOT add a fifth request-intercepting Playwright spec for something a unit test can reach; `unit/` is where a fabricated network condition or a controlled clock belongs.
- Do NOT test a ref-mirror, ordering or post-`await` property under `act()` — `act()` hides exactly that bug class. Put it in `authenticated-ledger.test.tsx`, which runs without it, and run it against the unfixed code first.
- Do NOT build a remote write from a ref read after an `await` that follows the optimistic `setState`; compute the value once, up front, and reuse it — see ADR `0022`.
- Do NOT apply balance changes after a failed insert in `commitBulkImport` or any other write, and do NOT map an upstream 429 to anything but 429 in `api/`.
- Do NOT send a signed-in ledger write as an absolute balance when its ADR `0023` RPC exists; the legacy table writes are only the missing-function fallback.
- Do NOT add an overdraft check to the ledger RPCs, and do NOT move their replay check after the overpayment guard.
- Do NOT treat an RPC error without a SQLSTATE as a clean failure; the write may have committed, so re-read after rolling back.
- Do NOT apply a migration to the live project without first running its probe inside `BEGIN … ROLLBACK`, and do NOT let a probe commit.
- Do NOT call `supabase.auth.signOut()` without an explicit scope; its default is `'global'`.
- Do NOT reset to guest state on any auth event but `SIGNED_OUT`, and do NOT drop `authEpochRef`'s check after an `await` in `loadSupabaseData`.
- Do NOT reintroduce a browser-built session list or a per-device revoke that writes to the `auth` schema.
- Do NOT rely on token refresh alone to notice a revoked session; its access token keeps working for up to an hour.
- Do NOT sign a device out because `getUser()` could not answer (offline, 5xx, 429), and do NOT sign out on a Data API 401 without asking the auth server first.
- Do NOT allow a negative amount on any type but ADJUSTMENT, and do NOT render a signed amount without `txTypeMetaFor` + `Math.abs`.
- Do NOT give the starter wallets or a new account a non-zero balance or a starter debt; the app shows no money nobody entered (ADR `0040`). A test that needs sample money seeds it (`seedLedger`, `seedGuestLedger`).
- Do NOT migrate an existing account's or a stored guest ledger's starter balances; Phase 54 is new accounts only, because real rows may sit on them.
- Do NOT render the mobile More sheet inside `<nav>`.
- Do NOT animate a balance, scale a control on tap or hover, or add a blur, glow or entrance animation beyond `DESIGN.md`'s list - see ADR `0026`.
- Do NOT put a decorative sparkle (or star, magic wand, lightning) icon on a badge, chip or note. Use an icon that says what happened (`Calculator` for a worked formula, `Tags` for a category filled in or suggested, `CheckCircle2` for a settled debt), or none (ADR `0041`; ADR `0033` did the same for the CSV import).
- Do NOT place a fixed element below `md` where it covers the mobile nav or the centre Quick Add; clear the nav's 65px plus `env(safe-area-inset-bottom)`, as `ReloadPrompt` does (ADR `0041`).
- Do NOT spin or pulse an icon while the app waits for the user; continuous motion is for real work only.
- Do NOT give a toast or banner `z-50` or above, or a dialog anything but `Modal`'s `z-50`; a tie with `Modal` is settled by DOM order, which is how the toast covered the More sheet (ADR `0042`). Use the layer order under "UI limits".
- Do NOT give `TransactionForm` a heading back, or show a formula's result or its help a second time in `InlineMathInput` (ADR `0042`).
- Do NOT hand-roll focus management in a `Modal` consumer (an open-time `focus()`, a Tab handler, a second Escape listener); `Modal` moves focus in, traps Tab, closes the top dialog on Escape and returns focus (ADR `0043`). A field that should start focused uses `autoFocus`.
- Do NOT put `inert` or `aria-hidden` on `#root` or any ancestor of a dialog; `Modal` renders inside `#root`, and either attribute would disable the open dialog. `Modal` marks the dialog's siblings itself (ADR `0047`).
- Do NOT make `Modal`'s "reachable" check depend on layout (`offsetParent`, a box size); jsdom has none, so the unit suite and the browser would disagree (ADR `0043`).
- Do NOT let a cloud load fail without setting `syncError`, and do NOT set it after a sign-out has moved `authEpochRef`.
- Do NOT colour an ADJUSTMENT as a transfer, income or expense; it is grey (`adjust`) and only its sign comes from its direction, through `txTypeMetaFor` (ADR `0027`).
- Do NOT sign a transfer outside one wallet's own view; pass `direction` only there.
- Do NOT compute spending, income, a net figure, net worth or a debt's monthly figure inline in a component; use `src/selectors/` (ADR `0028`), and do NOT let a selector read the clock.
- Do NOT count a debt repayment, an adjustment or a transfer as spending or income anywhere.
- Do NOT put the total balance back in the header, or split the header into two rows (ADR `0027`).
- Do NOT hand-type a button's classes or give a control its own focus style; use `Button`/`IconButton` and the global `:focus-visible` rule (ADR `0029`).
- Do NOT name an icon button with `sr-only` text; `IconButton`'s `label` sets `aria-label` and `title`, and hidden text would duplicate `getByText` matches.
- Do NOT colour a chip's background or text with its category colour; the colour is the 7px dot's (spec 4.7).
- Do NOT move a spec-asserted action into `OverflowMenu` without adding the menu-open step to its spec, and never let a "count 0" assertion pass only because the menu is closed.
- Do NOT use `transition-colors` (or `transition-all`) on a focusable control; use `transition-control`, which leaves the focus outline out (ADR `0030`).
- Do NOT give a Dashboard element an id with another page's prefix (`tx-row-`, `debt-card-`, `open-repay-modal-`, `settle-debt-`, `wallet-entity-`), and do NOT render any Dashboard text twice for a breakpoint. Specs match those page-wide right after a tab switch, and `getByText` is strict.
- Do NOT pass a click handler's event into `onOpenTransfer(walletId?)`; call it with no argument, or the event is read as a wallet id.
- Do NOT render a component twice for two breakpoints and hide one with CSS; pick one render path with `useMediaQuery` (the Transactions panel, ADR `0031`). The specs count hidden elements.
- Do NOT put a delete or restore button back on a transaction row; the row is a `<button>`, and they live in the selected row's panel (ADR `0031`).
- Do NOT give `updateTransaction` a legacy fallback of absolute writes, and do NOT let an edit change a repayment's or an adjustment's money (ADR `0033`).
- Do NOT move `update_transaction`'s replay check after its stale guard, and do NOT send an `updated_at` read after the optimistic write.
- Do NOT route editing through `TransactionForm`; `EditTransactionPanel` is the edit surface.
- Do NOT let an `/api/*` proxy call TypeSafe before `checkCaller` has passed, or treat an unanswered token check as accepted; it is 503 (ADR `0032`).
- Do NOT send an `Authorization` header from a guest, and do NOT latch the classifier or insights off on a 401; only a 404 latches.
- Do NOT add a key to `vercel.json`, a second region or a per-function region without measuring `Server-Timing` on production before and after (ADR `0051`); the functions' two Supabase calls are why they sit in `icn1`.
- Do NOT put an id, a token, an account or request content in a `Server-Timing` description; the header reaches every caller (ADR `0050`).
- Do NOT count AI requests in a proxy's memory, cache the count with the token, or let a request through when the count could not be had; it is `consume_ai_quota()` on every signed-in request, and no answer is 503 (ADR `0049`).
- Do NOT send a wallet's `balance` through `updateWallet`/`editWallet`; a balance moves only through a ledger row (ADR `0034`).
- Do NOT bring back a wallet popup or a second wallet-detail surface; the Wallets page owns a wallet's details, and the Dashboard hands off to it.
- Do NOT offer an archived wallet in a new-entry picker; use `isActiveWallet`/`useWallets().wallets`.
- Do NOT add a red, green, blue, cyan or amber swatch to `IDENTITY_PALETTE` (`WALLET_COLOR_PALETTE` is an alias of it); it is spec section 1's twelve identity colours (audit 008).
- Do NOT give `anon` or `authenticated` a write grant or policy on `public.profiles`, and do NOT read `role` from the client as if it meant something before a server-side decision says so.
- Do NOT send `remaining_amount` or `is_settled` through `editDebt`, and do NOT let Borrowed go below what is still owed (ADR `0035`).
- Do NOT write a debt off without the Mark as paid off confirmation, and do NOT discard `settleDebt`'s result.
- Do NOT start the diary form from defaults when the day has an entry, pre-type a diary field, or let a future day be logged (ADR `0036`).
- Do NOT colour a diary option by how good it is, or put an emoji on the diary page.
- Do NOT measure a bundle delta against a worktree build without the repo's `.env` copied in; `VITE_` values are inlined into the entry.
- Do NOT let two live categories take the same colour (L9) while any of the twelve is free, and do NOT let a System category (Debt repayment, Balance adjustment) be edited or deleted; `addCategory`/`updateCategory` refuse both (ADR `0037`).
- Do NOT make a System category row a button or print a category's raw type on the Categories page; use `systemCategoryLabel` and the group it sits in.
- Do NOT seed from the client. A new account's starter wallets and categories come only from `seed_starter_account()`; an empty read is not evidence of a new account, and there is no fallback to client inserts (ADR `0039`).
- Do NOT remap colours on the Supabase load, and do NOT change one copy of spec 5.1's migration (`identityColorMigration.ts`, the Phase 63 SQL) without the other; a colour someone picked never moves (ADR `0038`).

<!-- antislop:start -->
## antislop
For UI, copy, people, or mobile layout work, load the `antislop` skill (core) and then the skill for the task. They are installed as user-level skills in `~/.claude/skills/`, not in this repo:
- UI / visual: `antislop-ui`
- Copy & text: `antislop-copywriting`
- People: `antislop-human`
- Mobile / responsive: `antislop-layoutmobile`
Before starting, ask the user when antislop applies: during the work, or after it is done.
To update antislop later: run `npx antislop-ai --update`.
<!-- antislop:end -->
