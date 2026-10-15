# AGENTS.md

The one rule file for every agent in this repo (Claude Code reads it through `CLAUDE.md`). It wins over any skill's or tool's defaults. Domain detail lives in `docs/contexts/`; read only the file your task needs.

## Project

FinLife Tracker is a single-user personal finance and daily-diary PWA in Thai Baht. It runs offline on `localStorage` as a guest and, signed in, syncs with Supabase, where every ledger write is one atomic Postgres function.

- **Stack:** React 19, TypeScript ~5.8 (strict), Vite 6, Tailwind CSS v4 (semantic tokens), `vite-plugin-pwa`, `@supabase/supabase-js` (lazy-loaded), zod 4, papaparse, lucide-react. Node 24.x, npm.
- **Server side:** Supabase (Postgres 17, RLS, `SECURITY DEFINER` RPCs, Auth, Realtime); Vercel hosting with three Node functions in `api/` (region `icn1`); TypeSafe's Jev model behind the proxies.
- **Tests:** Vitest in `unit/` (1375 tests, 62 files, PGlite replays every migration); Playwright in `tests/` (164 tests, 34 specs, 492 runs on three browsers).

| Path | What it is |
|---|---|
| `src/context/` | `FinanceContext.tsx` plus the Diary, KeywordRules and Template slices |
| `src/selectors/`, `src/utils/`, `src/services/` | Pure money rules, helpers, the cloud load and backup services |
| `src/components/`, `src/views/`, `src/hooks/` | UI (`ui/` primitives, domain folders), six lazy views, domain hooks |
| `api/` | `classify.ts`, `insights.ts`, `csp-report.ts` |
| `supabase/` | `migrations/`, `tests/` (probes), `replay/`, `ops/`, `catalog.sql` |
| `scripts/` | Lint guards, schema drift, migration history, CI summary |
| `docs/audit/` | Start at `docs/audit/README.md`: the live ledger, log, metrics and selector contract, ADRs in `decisions/` |

## Commands

- `npm run dev` (port 3000) / `npm run build`
- `npm run lint`: Node-globals guard, safe-id guard, `tsc --noEmit`, `tsc -p api/tsconfig.json`
- `npm run test:unit` / `npm run test:unit:shuffle` / `npx vitest run unit/<file>`
- `npx playwright test tests/<file>.spec.ts --project=chromium` / `npm test` (all)
- `npm run schema:drift` (offline replay; prints a read-only query)

## Stop and ask first

Do none of these without the owner's explicit go-ahead in this session:

- Any SQL against the live Supabase project: applying a migration, running a probe, the drift query, `supabase/ops/*.sql`, the history insert from `migration:print-history`.
- `npm run schema:drift -- --live`, or dispatching the `schema-drift` workflow.
- Any request to production `/api/*` (it spends TypeSafe credits and live quota), including the 31-request firewall check, and `vercel dev` with a real key.
- Any MCP or CLI write tool (Supabase, Vercel, GitHub, Turso): deploys, env vars, firewall, projects, branches, issues, PRs.
- `git commit`, `git push`, merging, or rewriting history.
- Signing in from a local dev server (`.env` points at the live project), or adding a spec that submits real credentials.
- Editing `vercel.json`, `.github/workflows/`, or the live dashboards (Auth settings, firewall rule).
- Deleting files you did not create, or adding a dependency.

## Non-negotiables

- **THB only;** every displayed amount through `formatCurrencyAmount`; ledger rounding only through `roundToCents` (`src/utils/money.ts:22`).
- **Dates are local calendar days;** use `src/utils/date.ts`, never `toISOString().slice(0, 10)`; compare ISO day strings, never parsed `Date`s.
- **Money figures come from `src/selectors/`,** never an inline filter.
- **Every write validates with Zod first and returns a `MutationResult`;** forms stay open on failure.
- **Soft delete** ledger records; ids from `generateEntityId`, keys from `generateIdempotencyKey`.
- **A signed-in ledger write is one database function or nothing;** never add a client-side fallback.
- **Relative imports only** (no `@/*` alias); explicit `.tsx` extensions are fine. `tsc` is strict with `noUnusedLocals`/`noUnusedParameters`; prefix a deliberately unused parameter with `_`. Never turn strict off.
- **No new state library or animation library;** no `React.memo` on a context subscriber.
- **Never edit `src/` while Playwright runs.**
- **No em dash in user-facing text.**

## Cross-file parity map

These pairs must change together; nothing in `tsc` links them.

| This | Must match | Guarded by |
|---|---|---|
| `addTransaction` / `setTransactionDeleted` arithmetic (`FinanceContext.tsx`) | `_ledger_apply_effect` and the ledger RPCs (`supabase/migrations/20260927_ledger_rpcs.sql` and later re-creations) | `unit/authenticated-ledger.test.tsx`, `ledger-guards.test.tsx`, `supabase/tests/*.probe.sql` |
| Transfer preview and debt payoff block | `addTransaction`'s TRANSFER and DEBT_REPAYMENT arithmetic, through `roundToCents` | Nothing checks the formula; review it by hand |
| `api/classify.ts` shared declarations | `api/insights.ts` (`checkCaller`, JWKS, `checkQuota`, `readBody`, timings) | `unit/proxy-parity.test.ts`, `proxy-contract.test.ts` |
| Client guest starter set (`FinanceContext.tsx`) | `seed_starter_account()` in SQL | Review by hand |
| `utils/identityColorMigration.ts` | `20261002_phase63_identity_colors.sql` | `unit/identity-color-migration.test.ts`, the Phase 63 probe |
| Spec-asserted DOM ids | `docs/audit/test-selector-contract.md` and the specs | The Playwright suite |
| `index.html` inline script | Its hash in `vercel.json`'s CSP | `unit/security-headers.test.ts` |
| A type's fields (`src/types.ts`) | `accountExport.ts` field lists and the `schemaOf<T>()` backup schemas | `tsc`, `unit/schema-parity.check.ts` |
| `@playwright/test` version | `matrix.playwright` in `playwright.yml` | The CI version check step |

## Tiered verification gates

Run every tier that matches a changed path, then report the commands and results.

| Changed | Run |
|---|---|
| Docs only | Nothing, unless a doc states a count or path: check it against the code |
| `src/utils/`, `src/selectors/`, `src/services/` | `npm run lint`; `npx vitest run unit/<related>`; then `npm run test:unit` |
| `src/context/`, `src/hooks/`, `src/lib/` | The row above, plus the affected spec(s) on chromium, then on all three browsers |
| `src/components/`, `src/views/`, `src/index.css`, `App.tsx` | `npm run lint`; `npm run test:unit`; the affected spec(s) with `--project=chromium`, then without a project filter |
| `api/` | `npm run lint`; `npx vitest run unit/proxy-contract.test.ts unit/proxy-parity.test.ts unit/proxy-prefetch.test.ts unit/proxy-auth-client.test.ts unit/csp-report.test.ts`; then `npm run test:unit` |
| `supabase/` | `npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts`; `npm run schema:drift`; then `npm run test:unit`. Live probes are stop-and-ask |
| `vercel.json`, `index.html` | `npx vitest run unit/security-headers.test.ts` |
| `.github/workflows/` | `npx vitest run unit/workflow-hardening.test.ts` |
| Any money path (ledger, context, selectors, `api/`) | Write the failing test first and run it against the unfixed code |

Before calling a task done: `npm run lint`, `npm run test:unit`, and the affected spec(s). Save full-suite output to a log file. Check ports 3000 and 3100 for stale dev servers before Playwright.

## Domain context routing

| Your task touches | Read |
|---|---|
| State, hooks, selectors, money and date rules, the entry form, express input, categorization, CSV import, insights client, export and restore, unit test harnesses | `docs/contexts/client-state.md` |
| Migrations, RLS, ledger RPCs, probes, drift, the Supabase client, auth, sessions, account deletion | `docs/contexts/supabase-ledger.md` |
| `api/`, the TypeSafe key, JWT and quota checks, rate limits, `vercel.json` headers and CSP | `docs/contexts/api-proxies.md` |
| Components, views, accessibility, modals, page contracts, Playwright, CI, when the change is logic only | `docs/contexts/ui-and-e2e.md` alone |
| Visual work: a new or restyled screen, tokens, layout, motion | `docs/contexts/ui-and-e2e.md` and `DESIGN.md` |
| Renaming or moving an id a spec uses | `docs/audit/test-selector-contract.md` |
| Why a rule exists | The ADR it names, `docs/audit/decisions/NNNN-*.md` |

**Never read `docs/audit/archive/`** unless the user explicitly asks for historical research. It is superseded history, including the pre-split rule file. **Never open `docs/design/*.html`** (a 2 MB bundled mockup), and read `docs/design/finlife-redesign-spec.md` only for a new redesign; `DESIGN.md` is the design authority.

## Workflow

- A vague request: ask before writing code. A new feature or phase: write the spec and plan, then the next ADR in `docs/audit/decisions/` and rows in `docs/audit/task-ledger.md`.
- A shipped phase adds one `docs/audit/refactor-log.md` entry (with `Surprises` and `Deliberately not done`) and its figures at the top of `docs/audit/baseline-metrics.md`.
- Removing a signature, column or code path: plan its deprecation and migration first.
- Skip the process for typos, copy tweaks and doc-only edits.
- A rule enters this file or `docs/contexts/` only once the code complies.

## ICM workflow (herdr) [ADR 0101]

- **Phase work happens on a branch** `phase-NNN-<slug>` cut from `main`, never on `main`: pushing or merging `main` deploys to production, and only the owner merges.
- An orchestrator routes four orders. Read the stage file for the order you received:
  - `spec <id>`: `workflow/stages/01_spec/CONTEXT.md`, reviewer (Claude Code)
  - `build <id>` and `fix <id>`: `workflow/stages/02_build/CONTEXT.md`, builder (agy)
  - `review <id>`: `workflow/stages/03_review/CONTEXT.md`, reviewer (Claude Code)
- Task ids continue the ledger's T-numbers. Each stage writes to its own `output/`, and every reply ends with the one STATUS line its stage file defines.

## Environment (`.env.example`)

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (both or neither; also read by `api/`), `TYPESAFE_API_KEY` (server only, no `VITE_` prefix; unset means `/api/classify` 404s), `SUPABASE_DRIFT_DB_URL`/`_CA` (drift reader, CI secret), `DISABLE_HMR` (never change its handling in `vite.config.ts`). `GEMINI_API_KEY` and `APP_URL` are AI Studio leftovers. Never read or print `.env`.
