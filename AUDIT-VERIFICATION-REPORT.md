# FinLife Tracker — Audit Verification & Pre-flight Report

This report documents the verification of the current codebase against `FinLife-OPTIMIZE-EN.md`, provides the SQL queries for database Row Level Security (RLS) inspection, and outlines tasks that require external execution.

---

## 1. File Verification & Comparison Report

| File | Document Baseline | Current Working Tree | Status & Line Shifts |
|---|---|---|---|
| `src/context/FinanceContext.tsx` | 1,365 lines | 1,366 lines | **Shifted (+1 line)** due to starter fallback constants (`DEFAULT_STARTER_WALLETS`, `DEFAULT_KEYWORD_RULES`, `DEFAULT_STARTER_DEBTS`) added at lines 185–252. The core logic blocks cited in P0-1, P0-2, P1-2, P1-3, P1-4, P1-5, and P3-2 remain present and shifted by ~1–2 lines. |
| `src/views/TransactionsView.tsx` | 572 lines | 573 lines | **Shifted (+1 line)**. Lines 58–90 still contain the P2-1 short-circuit filter bug and P2-2 un-debounced search. |
| `src/utils/mathEvaluator.ts` | Cited line 1 | 61 lines | **Matches exactly**. Line 1 still imports full `mathjs`. |
| `src/lib/supabase.ts` | Cited lines 3–8 | 17 lines | **Matches exactly**. Hardcoded Supabase URL and anon key are still present. |
| `package.json` | 44 lines | 44 lines | **Matches exactly**. All 8 unused dependencies from P2-3 are present; `@playwright/test` is missing from devDependencies (P1-7); `vite` is declared twice. |
| `.github/workflows/playwright.yml` | Cited line 25 (`npm ci`) | 43 lines | **Matches**. Line 26 runs `npm ci` without a committed `package-lock.json` (P1-6). |

### Implementation Progress Tracker
- [x] **P1-6 & P1-7**: Standardized on `npm`, removed bun artifacts, added `@playwright/test` script and test definitions.
- [x] **P0-4**: Runtime Zod validation for `addTransaction` in `FinanceContext.tsx`.
- [x] **P0-3**: Error handling and user-facing feedback for transactions and transfers in `TransactionForm.tsx`, `WalletPopupModal.tsx`, `WalletsView.tsx`, and callers.
- [x] **P2-1**: Fixed filter short-circuit bug when "Show Soft Deleted" is toggled in `TransactionsView.tsx`.
- [x] **P2-2**: Added 250ms debounced search filtering and instant clear button in `TransactionsView.tsx`.
- [ ] **P0-1 & P0-2**: Atomic transfer transaction / Balance recalculation (Client-side & DB RPC).
- [ ] **P0-5**: Client-side idempotency guard in `FinanceContext.tsx`.
- [ ] **P1-1**: Tree-shake `mathjs` in `src/utils/mathEvaluator.ts`.
- [ ] **P2-3**: Prune unused dependencies in `package.json`.
- [ ] **P3-1**: Supabase environment variables & rotation.

---

## 2. SQL to Verify RLS and Existing Policies

Run the following SQL queries in your **Supabase SQL Editor** to inspect whether Row Level Security is active and view all security policies attached to the six target tables:

```sql
-- 1. Check Row Level Security (RLS) status on all six tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'wallets',
    'categories',
    'keyword_rules',
    'transactions',
    'debts',
    'diary_entries'
  )
ORDER BY tablename;

-- 2. Inspect all existing security policies on these tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'wallets',
    'categories',
    'keyword_rules',
    'transactions',
    'debts',
    'diary_entries'
  )
ORDER BY tablename, policyname;
```

---

## 3. Tasks Requiring External Execution (Outside AI Studio)

1. **P3-1 (Database RLS & Credential Rotation)**:
   - Enabling RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and creating `auth.uid() = user_id` policies must be executed directly in the Supabase SQL Editor.
   - Rotating the leaked anon key / JWT secret must be performed in the Supabase Dashboard (**Project Settings > API**).
2. **P0-1 (Database Stored Procedure / Ledger View)**:
   - Creating the `create_transaction` atomic RPC or creating a ledger view (`CREATE FUNCTION` / `CREATE VIEW`) must be executed directly in the Supabase SQL Editor.
3. **P0-5 (Unique Constraint for Idempotency)**:
   - Adding `ALTER TABLE transactions ADD CONSTRAINT uq_transactions_idempotency_key UNIQUE (idempotency_key);` must be executed directly in the Supabase SQL Editor.
4. **P1-6 & P1-7 (CI Runner Execution)**:
   - Executing GitHub Actions workflows occurs on GitHub's infrastructure. Committing and pushing `package-lock.json` to satisfy `npm ci` must be pushed to GitHub to verify the CI run.
5. **P3-2 (Real Multi-Factor Authentication)**:
   - If opting for real Supabase MFA, configuring MFA settings and policies must be enabled in the Supabase Auth Dashboard.
