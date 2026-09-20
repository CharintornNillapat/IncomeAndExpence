# FinLife Tracker

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-129%20E2E%20tests-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

<br />

**A Personal Finance & Holistic Lifestyle Tracker**

*Track spending across Thai Baht wallets, work down debt goals, and correlate your finances with a daily wellbeing diary.*

</div>

---

## 🌟 Overview

**FinLife Tracker** connects quantitative financial tracking with qualitative wellbeing. Built with React, TypeScript, and Supabase, it is a mobile-first PWA designed to show not only *where* your money goes, but *how* your mood, workouts, and eating habits line up with your spending.

It runs fully offline against `localStorage`, and syncs bi-directionally with Supabase when credentials are configured.

---

## 🚀 Features

### 💰 Transactions & Wallets
- **Thai Baht wallets** across cash, bank accounts, credit cards, savings, investments, and e-wallets.
- **Atomic transfers** between wallets, executed in a single database transaction with idempotency protection against double submission.
- **Inline math** in every amount field — type `120/4 + 15*2` and see the result evaluated live before you commit it.
- **Smart entry**: keyword rules map recurring merchants to categories automatically, with a live sandbox to test rules against sample input.
- **CSV import/export** with a dry-run validation preview that reports invalid rows before anything is written.
- **Soft deletion** everywhere — financial records are never hard-deleted, and soft-deleted transactions can be viewed and restored.

### 📊 Dashboard & Debts
- Net-worth hero, wallet grid, and cashflow metrics filterable by day / week / month / all-time.
- Category expense distribution and recent-activity table.
- **Debt goals** with principal, remaining balance, interest rate, minimum payment, and target payoff date, plus wallet-funded repayments that update the ledger and the goal together.

### 🧘 Holistic Diary
- Log daily **mood (1–5), workout, workout note, and food quality**, with free-form reflections.
- Each day's entry sits alongside that day's inflow and outflow, so lifestyle and spending can be read together.
- JSON export including average mood and workout-rate summaries.

### 📱 Progressive Web App
- Installable on iOS and Android with standalone display.
- Offline-first: `localStorage` persistence keeps the app usable with no network.
- Swipe gesture navigation (`react-swipeable`) plus an adaptive desktop navbar and mobile bottom bar.

### 🌗 System-Aware Dark Mode
- Light / Dark / System cycling on the Tailwind v4 `stone` palette.
- Anti-FOUC: a synchronous `<head>` script reads `localStorage` and `prefers-color-scheme` before first paint.

---

## 🏗️ Architecture

```
src/
├── components/
│   ├── ui/              # Generic primitives: Modal, SectionHeader, Card, Badge,
│   │                    # CategoryChip, ProgressMeter, EmptyState, SegmentedControl,
│   │                    # ConfirmDialog
│   ├── transaction/     # TxTypeIcon, TxAmount, TxCategoryChip, TxSoftDeletedTag
│   ├── dashboard/       # Hero, metric cards, wallet grid, recent transactions
│   ├── wallet/          # AddWalletForm + WalletTransferForm (shared by view & modal)
│   ├── AuthModal.tsx    # Supabase email/password auth
│   ├── InlineMathInput.tsx
│   ├── TransactionForm.tsx
│   └── WalletPopupModal.tsx
├── context/
│   └── FinanceContext.tsx   # Canonical state, local fallback, Supabase sync
├── hooks/
│   ├── useTransactions.ts   # Filtering, metrics, transaction actions
│   ├── useWallets.ts        # Active wallets, net worth, grouping
│   ├── useDebts.ts          # Debt splits and aggregate metrics
│   └── useTheme.ts
├── utils/
│   ├── currency.ts      # THB constants + formatCurrencyAmount
│   ├── date.ts          # Local-calendar date helpers (UTC+7 safe)
│   ├── zodSchemas.ts    # Runtime validation for every write path
│   ├── mathEvaluator.ts # Sandboxed inline arithmetic
│   ├── smartMatcher.ts  # Keyword-rule matching
│   ├── csvExchange.ts   # CSV/JSON import & export
│   └── walletIcons.ts
├── views/               # Lazy-loaded via React.lazy
│   ├── DashboardView.tsx    ├── DebtsView.tsx
│   ├── TransactionsView.tsx ├── DiaryView.tsx
│   ├── WalletsView.tsx      ├── CategoriesView.tsx  # "Categories & Smart Rules" hub
│   └── SecurityView.tsx
└── types.ts
```

**Design notes**

- **Single currency by construction.** `CurrencyCode` is the one-member union `'THB'`, so introducing another currency is a compile error at every write site rather than a silent bug. All display formatting goes through `formatCurrencyAmount()`.
- **Local calendar dates.** Date fields use `src/utils/date.ts` rather than `toISOString().slice(0, 10)`, which formats in UTC and would file anything entered between 00:00 and 06:59 Thailand time under the previous day.
- **Validation at the boundary.** Every mutating context method validates with Zod first and returns `MutationResult` (`{ success, error? }`) instead of throwing or failing quietly, so views can surface the reason and keep the user's input.
- **Route-level code splitting.** Views load on demand via `React.lazy()` behind a `Suspense` fallback.
- **Optimistic writes with rollback.** Balances update immediately and are restored from a snapshot if the remote write fails, with compensating updates for any partial commit.
- **Row-Level Security.** Supabase RLS scopes every row to its owner.
- **Shared UI primitives.** `src/components/ui/` holds generic, domain-agnostic building blocks used across views: `Modal`, `SectionHeader`, `Card`, `Badge`/`CategoryChip`, `ProgressMeter`, `EmptyState`, `SegmentedControl`, `ConfirmDialog`.

---

## ⚡ Performance Highlights

- **Initial entry bundle cut from ~1,116 kB to ~158.9 kB raw (‑85.8%), ~326.3 kB to ~44.8 kB gzip (‑86.3%)** across a two-phase audit of `src/`.
- **`vendor-math` (110.72 kB gzip) deferred off the critical path** — the Quick Add, Transfer, and Add Wallet shell modals mount behind `React.lazy` on first open, so `mathjs` only loads when one of them is actually used.
- **`AnimatedCounter` eliminated its per-frame `setState`**, writing animated values straight to a ref'd DOM node instead — removing what had been the single largest source of React render work in the app.

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Framework & UI** | React 19, TypeScript 5.8, Tailwind CSS v4, Lucide React, Framer Motion |
| **Build & Tooling** | Vite 6, `vite-plugin-pwa`, TypeScript compiler |
| **Data & Auth** | Supabase (PostgreSQL, Realtime, GoTrue Auth) |
| **Validation & Parsing** | Zod, mathjs (`mathjs/number`), PapaParse |
| **Testing** | Playwright (Chromium, Firefox, WebKit) |
| **Mobile** | PWA service worker, Web App Manifest, React Swipeable |

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js** v18 or higher
- **npm**
- A **Supabase** project (optional — the app falls back to local storage without one)

### 2. Clone and install
```bash
git clone https://github.com/CharintornNillapat/IncomeAndExpence.git
cd IncomeAndExpence
npm install
```

### 3. Configure environment variables
Create a `.env` file in the project root (see `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> Without these, FinLife Tracker runs in **Local Storage Mode** — fully usable and offline-persistent, but with no cross-device sync.

### 4. Database setup (required for cloud sync)

Apply the migration in [`supabase/migrations/`](supabase/migrations/) to your Supabase project. It provides:

- `transactions_user_idempotency_key_uniq` — a partial unique index on `(user_id, idempotency_key)` for live rows, so a retried write cannot create a duplicate ledger entry.
- `public.transfer_funds(...)` — an RPC that locks both wallets, applies **relative** balance updates, and inserts the ledger row inside one transaction, returning `{ reused, transaction, source_balance, dest_balance }`.

Apply it either with the Supabase CLI:

```bash
supabase db push
```

…or by pasting `supabase/migrations/20260909_transfer_funds.sql` into the SQL Editor in the Supabase dashboard.

> **Why it matters:** without this migration the app falls back to a legacy non-atomic transfer path that issues three separate round-trips. A failure part-way through can debit the source wallet without crediting the destination. The fallback exists only so an un-migrated project still runs — apply the migration for any real use.

### 5. Run the development server
```bash
npm run dev
```
Then open `http://localhost:3000`.

---

## 🧪 Testing & Quality

```bash
# Type-check the whole project.
# tsconfig enables noUnusedLocals + noUnusedParameters, so dead imports fail the build.
npm run lint

# Run the Playwright E2E suite: 43 tests across 14 spec files,
# executed on Chromium, Firefox and WebKit (129 test runs).
# Playwright starts the dev server automatically.
npm test

# Narrow to one spec or browser while iterating
npx playwright test tests/wallets.spec.ts --project=chromium

# First run only: download the browser engines
npx playwright install
```

Specs live in [`tests/`](tests/) across 14 files — transactions, wallets, wallet forms, diary, theme, debts, soft-delete, keywords, categories, CSV, auth, date-boundary, storage-persistence, and presets. Shared helpers in `tests/helpers.ts` handle tab navigation (including waiting for lazy view chunks) and seeding a transaction.

```bash
# Production build
npm run build

# Preview the production bundle
npm run preview
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
