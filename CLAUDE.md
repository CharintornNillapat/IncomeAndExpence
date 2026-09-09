# CLAUDE.md

## Project Overview
FinLife Tracker is a full-stack personal finance and holistic lifestyle management Progressive Web App (PWA). It tracks multi-currency wallets, income/expense/transfer transactions, and debt payoff plans (Snowball/Avalanche), while correlating financial behavior with a daily wellness diary (mood, workout, food quality). The app functions offline via `localStorage` and syncs bi-directionally with Supabase when configured.

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
├── src/
│   ├── components/      # Reusable UI components, modals, and navigation
│   │   └── dashboard/   # Dashboard-specific summary and metric cards
│   ├── context/         # FinanceContext.tsx (monolithic app state, local fallback, Supabase sync)
│   ├── hooks/           # Domain hooks (useWallets, useTransactions, useDebts, useTheme)
│   ├── lib/             # Supabase client setup (supabase.ts)
│   ├── utils/           # Pure helpers: mathEvaluator, smartMatcher, zodSchemas, csvExchange, currency
│   ├── views/           # Route views lazy-loaded via React.lazy in App.tsx
│   ├── App.tsx          # Root shell with gesture handlers and tab navigation
│   ├── main.tsx         # Application entry point
│   ├── types.ts         # TypeScript domain interfaces, unions, and enums
│   └── index.css        # Tailwind v4 import and dark mode custom variant
├── tests/               # Playwright test specs (*.spec.ts)
├── index.html           # Anti-FOUC theme bootstrap and PWA meta tags
├── playwright.config.ts # Playwright multi-browser test configuration
├── vite.config.ts       # Vite config (PWA manifest, Tailwind plugin, path aliases, HMR switch)
└── tsconfig.json        # TypeScript configuration with @/* alias to ./*
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
- **Imports**: Alias `@/*` resolves to `./*`. Explicit `.tsx` extensions are supported and used in imports.
- **State Management**: Monolithic state in `src/context/FinanceContext.tsx`. Read/write exposed via domain hooks in `src/hooks/`. Optimistic updates with rollback snapshots on network failure.
- **Styling**: Tailwind CSS v4 utility classes. Warm neutral aesthetic based on `stone-*` palette. Dark mode uses `.dark` class, `data-theme="dark"`, and `colorScheme`.
- **Validation**: Strict runtime validation using Zod schemas (`src/utils/zodSchemas.ts`) before processing transactions, wallets, debts, or diary entries.
- **Data Integrity**: Soft deletion (`isDeleted: true`) on records to protect ledger and history integrity.

## Testing
- **Framework**: Playwright with Chromium, Firefox, WebKit suites in `playwright.config.ts`.
- **Location**: Spec files stored in `tests/` (`transaction.spec.ts`, `wallets.spec.ts`, `diary.spec.ts`, `theme.spec.ts`).
- **Dev Server**: Playwright launches local server via `npm run dev` at `http://localhost:3000` with 120s timeout.
- **CI Mode**: Parallel workers set to 1 when `CI=true`; retries enabled on CI.
- **Execution**: Run all tests via `npm test` or specific file via `npx playwright test tests/<filename>.spec.ts`.

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
- **Client Idempotency**: `FinanceContext.tsx` tracks in-flight transaction keys in a `Set` to prevent double submissions.
- **Dynamic Calculation Inputs**: Amount inputs accept inline arithmetic expressions (e.g., `120/4 + 15*2`) sanitized by regex before evaluation.

## Do NOT
- Do NOT import the root `mathjs` package; only import from `mathjs/number`.
- Do NOT bypass `TransactionSchema` or other Zod validations in `src/utils/zodSchemas.ts`.
- Do NOT perform hard deletions on financial records; update `isDeleted: true` instead.
- Do NOT hardcode production API credentials in `src/lib/supabase.ts` or commit them to version control.
- Do NOT modify the `DISABLE_HMR` handling in `vite.config.ts`.
- Do NOT add redundant state management libraries (Redux, Zustand); use `FinanceContext`.
