# Constraints staged for promotion into CLAUDE.md

Promotion rule: **nothing moves into `CLAUDE.md` until the code already complies.** A rule the code does not satisfy is worse than no rule — see the `@/*` alias `CLAUDE.md:53` documents today with zero actual usages. Drain this table during Phase 9, one row at a time, only after its `After` task has shipped and its gate has passed.

| Rule (imperative, present tense) | Evidence (`path:line`) | Holds in code? | Target `CLAUDE.md` section | After task | Promoted (sha) |
|---|---|---|---|---|---|
| Field styling comes from `src/utils/formStyles.ts` for any input/label/button/error banner that matches its shared shape; a genuinely distinct style (different padding scale, font size, or color, documented in refactor-log.md Phase 17) may stay inline | `formStyles.ts` now used by 12 files (was 2) | Yes — promoted with the "matches its shared shape" qualifier, verified against `grep`-confirmed exceptions (`WalletPopupModal`, `TransactionsView`'s touch-target filter bar, `AuthModal`'s larger inputs) | Coding Conventions → Styling | T24 | 3c441e8 |
| Build id→entity lookup maps through a shared helper (`buildLookupMap`); a map keyed or valued by something other than the whole item stays inline | 9 sites migrated (`mapUtils.ts`, refactor-log.md Phase 16) | Yes — promoted with the id→item-only qualifier | Coding Conventions | T26 | 3c441e8 |
| No component above a view subscribes to finance state | `App.tsx` has zero `useFinanceState`/`useFinanceActions` calls (re-verified by grep) | Yes | State: context + domain hooks | T1 | 3c441e8 |
| Views read state via `useFinanceState()` / domain hooks and actions via `useFinanceActions()`; `useFinance()` no longer exists | `grep -r "useFinance\(\)" src/` returns zero matches | Yes | State: context + domain hooks | T14 | 3c441e8 |
| Never wrap a context subscriber in `React.memo` without cutting the subscription first | `MobileBottomNav.tsx` is `React.memo`'d but no longer calls `useFinanceState`/`useFinanceActions` (T2 removed its only subscription) | Yes | Coding Conventions | T2 | 3c441e8 |
| State persists through one batched writer; add a slice by registering it there, not by adding another effect | `FinanceContext.tsx` — `localStorage.setItem` down to 2 call sites (the writer + its flush) | No | State | T16 | |
| One `<Modal>` primitive; no hand-rolled overlay/drag-indicator/close-X | `grep -r 'role="dialog"' src/` matches only `Modal.tsx` | Yes | Coding Conventions | T22 | 3c441e8 |
| Every interactive element added to a view carries an `id` following `<view>-<thing>-<kind>` | `AuthModal.tsx` has 0 `id=` attributes | No — fixed for `AuthModal.tsx` only; not re-verified as a repo-wide invariant | Testing | T12 | |
| The `@/*` alias either does not exist, or resolves to `src` and has real usages | `CLAUDE.md`'s Imports bullet already states "there is no `@/*` alias"; `tsconfig.json` has no `paths` entry | Yes (already reflected pre-audit — not stamped with a sha in this trail) | Coding Conventions → Imports | T28 | |
| Date comparisons compare ISO strings; never construct a `Date` from a bare `YYYY-MM-DD` to compare against a local instant | `DashboardView.tsx`'s week/month filter and `WalletsView.tsx`'s "Created" label, both fixed (T21) | Yes | Dates | T21 | 3c441e8 |
| `roundToCents` is the only cent-rounding in the ledger; an inlined `Math.round(x*100)/100` is forbidden (still a distinct helper from `roundToTwoDecimals`, never merge) | `FinanceContext.tsx` — `roundToCents` has exactly one `Math.round(x*100)/100` implementation, no duplicate inline copies | No — holds in code but not part of this task's promotion list | Known Constraints or Gotchas | T19 | |

## Follow-on proposals (separate projects, not part of this refactor — logged so they aren't lost)

- ESLint with `react-hooks/exhaustive-deps` would have caught most of audit-report §A/§B mechanically.
- Vitest would make `smartMatcher.ts`, `mathEvaluator.ts`, and `csvExchange.ts` cheaply unit-testable without a browser.
- `tsconfig.json` `strict`/`strictNullChecks` — a separate, larger project; `mapTransactionRow(row: any)` (`FinanceContext.tsx:135`) and the Supabase mapping layer are untyped boundaries that would all light up at once.
- React Compiler would auto-memoize most of what Phases 3-4 do by hand, but needs a Babel plugin + runtime and its own evaluation.
- `rollup-plugin-visualizer` for ongoing bundle-size visibility, once T7's manual chunking has landed.
