# T753 review: bring four uppercase labels onto DESIGN.md's section-label rule

## Round 1

### 1. Metadata

- **Task:** T753, Phase 127 (`phase-127-label-tracking`)
- **Date:** 2026-10-16
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `src/components/QuickAddModal.tsx`, `src/components/TransactionForm.tsx`, `src/components/ui/Card.tsx`, `DESIGN.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (plus bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/build-report.md`)

### 2. Summary

The four uppercase labels (`QuickAddModal.tsx:101`, `TransactionForm.tsx:709`, `:848`, `:871`) move from `text-[11px]` and `tracking-wide` to `text-xs` and `tracking-wider`. Every other token stays and keeps its order, matching spec section 7 line for line. `Card.tsx:23`'s comment now says `rounded-card`. `DESIGN.md:295`'s stale Backlog sentence is replaced. Both Backlog rows are closed, the `WalletTransferForm.tsx:101` row is added, and the Phase 127 refactor-log entry and baseline-metrics section are written.

### 3. Invariants and parity

- **Scope:** `git diff --stat` and `git status --porcelain` show 7 modified files plus `build-report.md`, and the untracked spec. All are spec targets or bookkeeping. No unannounced file.
- **Ignored targets:** `git check-ignore -v` on all seven target and ledger files printed nothing (exit 1), so none is ignored.
- **Changed code:** each hunk is one `className` string literal inside JSX. I read each enclosing JSX block (`QuickAddModal.tsx:99-104`, `TransactionForm.tsx:707-712`, `:846-851`, `:869-874`). No handler, condition, text, id or `data-testid` changed. `src/` has exactly 5 removed and 5 added lines.
- **Comments-only tier (`Card.tsx`):** the diff's only changed lines start with ` * `. The non-comment filter printed nothing.
- **Parity map:** no row applies. No id changed, so `docs/audit/test-selector-contract.md` is untouched.
- **DESIGN.md rule:** all four labels now read `text-xs font-semibold ... uppercase tracking-wider`, which is 12px / 600 / 0.05em, with colours `fg-muted` or `fg-secondary` (`DESIGN.md:77`).
- **Bundle:** `.tracking-wide{` no longer appears in the built CSS (0), and `.tracking-wider{` does (1). This confirms the class is unused in `src/`.
- **Docs figures:** the baseline-metrics bundle and test counts match my own runs. Durations differ run to run, as expected.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| Ports 3000 and 3100 | nothing listening | n/a |
| `npm run lint` | node-globals 132 files clean; safe-ids 132 files clean; `tsc --noEmit` and `tsc -p api/tsconfig.json` clean | n/a |
| `npm run test:unit` | 62 files, 1375 tests, 1375 passed, 0 failed, 0 skipped (69.6 s) | `workflow/stages/03_review/output/logs/T753-unit.log` |
| `npx playwright test tests/presets.spec.ts tests/debt-repayment.spec.ts --project=chromium` | 17 tests, 17 passed, 0 failed, 0 skipped (25.8 s) | `workflow/stages/03_review/output/logs/T753-e2e-chromium.log` |
| `npx playwright test tests/presets.spec.ts tests/debt-repayment.spec.ts` | 51 runs (17 x Chromium, Firefox, WebKit), 51 passed, 0 failed, 0 skipped (1.3 m); no WebKit flake | `workflow/stages/03_review/output/logs/T753-e2e.log` |
| `npm run clean; npm run build` (with `.env` present, not read) | build clean; entry `index-0LGxXWZU.js` 191,674 B / 55,796 B gzip; all app JS 40 files 878,211 B / 266,951 B gzip; CSS `index-CqllkKUj.css` 52,759 B / 10,159 B gzip (gzip level 9) | `workflow/stages/03_review/output/logs/T753-build.log` |
| `git diff -U0 -- src/ \| grep -cE '^-[^-]'` / `'^\+[^+]'` | 5 / 5 | n/a |
| `grep -rnE "tracking-wide[ \"'\`]" src` | nothing | n/a |
| `grep -nE "text-\[11px\].*uppercase" ...` | nothing | n/a |
| `grep -nE "text-xs font-semibold.*uppercase tracking-wider" ...` | 4 lines: `QuickAddModal.tsx:101`, `TransactionForm.tsx:709`, `:848`, `:871` | n/a |
| `grep -n "rounded-xl" src/components/ui/Card.tsx` | nothing | n/a |
| ``grep -n "rounded-card`, a 1px" src/components/ui/Card.tsx`` | line 23 | n/a |
| `grep -n "exceptions are a Backlog row" DESIGN.md` | nothing | n/a |
| Em dash count, 7 touched files plus `build-report.md` | 0 in each | n/a |

Step 6 (stash check) does not apply: the spec's tests are `none`.

### 5. Not verified

- **How the labels look:** no spec takes a screenshot, and I did not open the app (signing in from local dev is stop-and-ask, and these forms show as a guest only with seeded data). The 12px size and the about 1px line-height change are inferred from the classes, not seen.
- **Whole-function read:** `TransactionForm` is one component of about 1,100 lines. I read the enclosing JSX block of each hunk rather than the whole component. That is enough here because each change is a string literal with no data flow.

### 6. Blocking

None.

### 7. Non-blocking

- `baseline-metrics.md`: all app JS is -12 B raw. Four `text-[11px]` to `text-xs` swaps (-5 B each) and four `tracking-wide` to `tracking-wider` swaps (+1 B each) predict -16 B. The 4 B gap is likely minifier or chunk-reference noise and doesn't need chasing. The figures are measured, not derived, and match my build.
- The ledger's gate cell says "bash checks 5/5", which is vague. "5 lines removed, 5 added in src" would read better. Optional.

### 8. Rule candidates

- `docs/contexts/ui-and-e2e.md:26` could add "at `text-xs`, never an arbitrary pixel size", in line with `src/index.css:370`'s "use the scale". Hold it until `WalletTransferForm.tsx:101` (`text-[10px]`, now a Backlog row) complies, because a rule enters only once the code complies.
