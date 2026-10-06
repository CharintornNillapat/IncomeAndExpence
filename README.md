# FinLife Tracker

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-154%20E2E%20tests-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A personal finance tracker with a daily diary beside it.**

Track Thai Baht wallets, income, spending and debts, and read them next to how each day went.

</div>

---

## Overview

FinLife Tracker is a progressive web app for one person's money. It keeps wallets, transactions and debt payoff goals, and a daily diary of mood, workouts and meals, so a day's spending can be read next to the day itself.

It works offline against `localStorage` with no account. Signed in, it syncs with Supabase in both directions, and every ledger write runs as one database transaction.

---

## Features

### Transactions and wallets
- Wallets in Thai Baht: cash, bank accounts, credit cards, savings, investments and e-wallets. A credit card may carry a negative balance.
- Transfers between wallets, with a live preview of both balances before you confirm.
- Amount fields accept arithmetic: type `120/4 + 15*2` and the result is shown before you save it.
- The note comes first and fills the amount: `ข้าวมันไก่ 60` records ฿60.00 with the note kept as typed. Voice input feeds the same field.
- Categories come from your own keyword rules first. When no rule matches, an AI classifier suggests one through a server-side proxy; a confident answer fills the field, a less confident one is offered as a chip you can tap.
- CSV import shows a dry run with every invalid row before anything is written, and can classify the rows on request. CSV export escapes cells that a spreadsheet would run as a formula.
- Records are never hard-deleted: a deleted transaction can be viewed and restored, and an edit moves the balances it touches.

### Dashboard, debts and insights
- Net worth (wallets minus what is still owed), cash flow, spending by category and recent activity, for today, the week, the month or all time.
- Debt goals with the monthly payment each one needs to meet its due date, checked against your monthly surplus.
- A monthly summary of what changed in your spending. The model only picks the pattern; every amount in the sentence comes from your own ledger.

### Daily diary
- Mood, workout, meals and a note for each day, shown with that day's spending.
- JSON export with average mood and workout rate.

### App
- Installable on iOS and Android, and usable offline.
- Light, dark and system themes, set before the first paint so the page never flashes.
- Signed in: see the devices signed in to your account, and sign out every other one.

---

## Architecture

```
api/                     Vercel functions: the classifier and insights proxies
src/
├── components/          Shared UI, modals and navigation
│   ├── ui/              Domain-free primitives: Modal, Button, Card, SegmentedControl, ...
│   ├── transaction/     Transaction rows, the activity feed, CSV import, the edit panel
│   ├── dashboard/       Dashboard cards: figures in, layout out
│   ├── wallet/, debt/, diary/, category/, account/
│   └── TransactionForm.tsx   The one entry form for every add flow
├── context/
│   └── FinanceContext.tsx    State, local fallback, Supabase sync
├── hooks/               useTransactions, useWallets, useDebts, useTheme, ...
├── selectors/           Pure money rules: spending, income, net worth, debt plans
├── utils/               currency, dates, math evaluation, keyword matching, CSV, Zod schemas
├── views/               One lazy-loaded view per page
└── types.ts
supabase/
├── migrations/          The whole schema, replayable from an empty database
├── tests/               SQL probes that run inside BEGIN ... ROLLBACK
└── catalog.sql          What the drift check compares with the live project
tests/                   Playwright specs
unit/                    Vitest suites for what a browser test cannot reach
docs/audit/              Decision records (ADRs), the task ledger and the refactor log
```

**Design notes**

- **One currency.** `CurrencyCode` is the single-member union `'THB'`, so a second currency is a compile error at every write site. Every displayed amount goes through `formatCurrencyAmount()`.
- **Local calendar days.** Dates come from `src/utils/date.ts`, never `toISOString().slice(0, 10)`, which would file anything entered between 00:00 and 06:59 Thailand time under the previous day.
- **Validation first.** Every write validates with Zod and returns `{ success, error? }` instead of throwing, so a form can keep your input and show why.
- **Atomic writes.** Signed in, each ledger change is one Postgres function that locks the rows it touches, applies relative balance changes and replays a retried request by its idempotency key. The client shows the change at once and rolls it back if the server refuses.
- **One set of money rules.** Spending, income, net worth and debt plans are computed in `src/selectors/`, so every page shows the same figure for the same period.

**Security**

- Row-level security limits every table to its owner, and every database function takes the user from the session, never from an argument.
- The AI proxies verify the caller's Supabase token themselves, count requests per account in the database (120 a minute) and never expose the API key to the browser.
- Responses carry an enforced Content Security Policy (no inline script but the theme bootstrap, by hash; no `eval`), `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy.

---

## Tech stack

| Area | Technology |
| :--- | :--- |
| UI | React 19, TypeScript 5.8, Tailwind CSS v4, Framer Motion, Lucide |
| Build | Vite 6, `vite-plugin-pwa` |
| Data and auth | Supabase (PostgreSQL, Realtime, Auth) |
| Validation and parsing | Zod, mathjs (`mathjs/number`), PapaParse |
| Hosting | Vercel (functions in Seoul, `icn1`, beside the database) |
| Testing | Playwright (Chromium, Firefox, WebKit), Vitest, PGlite for migration replay |

---

## Local development

### 1. Prerequisites
- Node.js 22 (the version CI runs) and npm.
- A Supabase project, optional: without one the app runs on `localStorage`.

### 2. Install
```bash
git clone https://github.com/CharintornNillapat/IncomeAndExpence.git
cd IncomeAndExpence
npm install
```

### 3. Environment
Copy `.env.example` to `.env` and fill in what you use:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without them the app runs in local storage mode: fully usable offline, with no sync between devices. `TYPESAFE_API_KEY` (no `VITE_` prefix, read only by the server functions) turns on AI classification; without it the app uses your keyword rules alone.

### 4. Database (for cloud sync)
Apply every file in [`supabase/migrations/`](supabase/migrations/) in file-name order, starting with `20260901_baseline_schema.sql`. Each one runs safely on an empty project. Without the ledger functions the app falls back to separate table writes, where a failure part-way through can debit one wallet without crediting the other, so apply them before real use.

To compare a project with the migrations, run `npm run schema:drift` and paste the query it prints into the SQL editor. It is read-only and returns only what differs.

### 5. Run
```bash
npm run dev
```
Then open `http://localhost:3000`. The `api/` functions do not run under the Vite dev server, so AI classification is off locally.

---

## Testing

```bash
npm run lint         # TypeScript for the app, the tests and the functions, plus a check for Node globals in src/
npm run test:unit    # Vitest: 1031 tests in 39 files, including every migration replayed in PGlite
npm test             # Playwright: 154 tests in 32 spec files on Chromium, Firefox and WebKit
npx playwright test tests/wallets.spec.ts --project=chromium   # one spec, one browser
npx playwright install                                          # first run only: the browser engines
```

Playwright starts the dev server itself. CI runs lint and the unit tests first, then each browser in two shards, and merges every shard into one report.

---

## Documentation

- [`docs/audit/decisions/`](docs/audit/decisions/): one decision record per change, numbered.
- [`CLAUDE.md`](CLAUDE.md): the rules a contributor (human or agent) is expected to follow.
- [`DESIGN.md`](DESIGN.md): the design tokens and UI limits.

---

## License

[MIT](LICENSE)
