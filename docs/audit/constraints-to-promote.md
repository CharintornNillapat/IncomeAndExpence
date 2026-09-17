# Constraints staged for promotion into CLAUDE.md

Promotion rule: **nothing moves into `CLAUDE.md` until the code already complies.** A rule the code does not satisfy is worse than no rule — see the `@/*` alias `CLAUDE.md:53` documents today with zero actual usages. Drain this table during Phase 9, one row at a time, only after its `After` task has shipped and its gate has passed.

| Rule (imperative, present tense) | Evidence (`path:line`) | Holds in code? | Target `CLAUDE.md` section | After task | Promoted (sha) |
|---|---|---|---|---|---|
| Field styling comes from `walletFormStyles.ts`; never re-type Tailwind class strings for inputs/labels/buttons/error banners | `walletFormStyles.ts` used by only 2 of ~12 eligible files | No | Coding Conventions → Styling | T24 | |
| Build id→entity lookup maps through a shared helper; never write `new Map(x.map(...))` in a component body | 7 independent copies, audit-report §E | No | Coding Conventions | T26 | |
| No component above a view subscribes to finance state | `App.tsx:61` | No | State: context + domain hooks | T1 | |
| Views read state via `useFinanceState()` / domain hooks and actions via `useFinanceActions()`; `useFinance()` no longer exists | `FinanceContext.tsx:1498-1572` today has one combined value | No | State: context + domain hooks | T14 | |
| Never wrap a context subscriber in `React.memo` | `MobileBottomNav.tsx:27` + `:31` | No (currently violated) | Coding Conventions | T2 | |
| State persists through one batched writer; add a slice by registering it there, not by adding another effect | `FinanceContext.tsx:390-413` — 8 separate effects | No | State | T16 | |
| One `<Modal>` primitive; no hand-rolled overlay/drag-indicator/close-X | 9 sites, audit-report §E | No | Coding Conventions | T22 | |
| Every interactive element added to a view carries an `id` following `<view>-<thing>-<kind>` | `AuthModal.tsx` has 0 `id=` attributes | No | Testing | T12 | |
| The `@/*` alias either does not exist, or resolves to `src` and has real usages | `CLAUDE.md:53`, `vite.config.ts:79-83`, `tsconfig.json:18-22` — currently resolves to repo root with zero usages | No | Coding Conventions → Imports | T28 | |
| Date comparisons compare ISO strings; never construct a `Date` from a bare `YYYY-MM-DD` to compare against a local instant | `DashboardView.tsx:87-95` | No | Dates | T21 | |
| `roundToCents` is the only cent-rounding in the ledger; an inlined `Math.round(x*100)/100` is forbidden (still a distinct helper from `roundToTwoDecimals`, never merge) | `FinanceContext.tsx:944,1071,1309,1318` | No (until T19 ships) | Known Constraints or Gotchas | T19 | |

## Follow-on proposals (separate projects, not part of this refactor — logged so they aren't lost)

- ESLint with `react-hooks/exhaustive-deps` would have caught most of audit-report §A/§B mechanically.
- Vitest would make `smartMatcher.ts`, `mathEvaluator.ts`, and `csvExchange.ts` cheaply unit-testable without a browser.
- `tsconfig.json` `strict`/`strictNullChecks` — a separate, larger project; `mapTransactionRow(row: any)` (`FinanceContext.tsx:135`) and the Supabase mapping layer are untyped boundaries that would all light up at once.
- React Compiler would auto-memoize most of what Phases 3-4 do by hand, but needs a Babel plugin + runtime and its own evaluation.
- `rollup-plugin-visualizer` for ongoing bundle-size visibility, once T7's manual chunking has landed.
