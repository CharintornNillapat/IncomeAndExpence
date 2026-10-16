# Build report: T753

Phase 127: Bring four uppercase labels onto DESIGN.md's section-label rule (`text-xs`, `tracking-wider`), fix Card.tsx's stale `rounded-xl` comment, and update documentation.

## Files changed (7 files)

1. `src/components/QuickAddModal.tsx`: updated "Quick templates" section label from `text-[11px] font-semibold text-fg-muted uppercase tracking-wide` to `text-xs font-semibold text-fg-muted uppercase tracking-wider`.
2. `src/components/TransactionForm.tsx`:
   - Line 709: updated "Templates" label from `text-[11px] font-semibold text-fg-muted uppercase tracking-wide mr-0.5` to `text-xs font-semibold text-fg-muted uppercase tracking-wider mr-0.5`.
   - Line 848: updated "Quick payoff" label from `text-[11px] font-semibold text-fg-muted uppercase tracking-wide mr-0.5` to `text-xs font-semibold text-fg-muted uppercase tracking-wider mr-0.5`.
   - Line 871: updated "Remaining after payment" label from `text-[11px] font-semibold uppercase tracking-wide text-fg-secondary` to `text-xs font-semibold uppercase tracking-wider text-fg-secondary`.
3. `src/components/ui/Card.tsx`: updated doc comment on line 23 to cite `rounded-card` instead of stale `rounded-xl`.
4. `DESIGN.md`: updated deviation table row 295 (section label letter-spacing) to state Phase 127 (T753) moved the last four `tracking-wide` labels onto `tracking-wider`.
5. `docs/audit/refactor-log.md`: added Phase 127 entry above Phase 126.
6. `docs/audit/baseline-metrics.md`: added Phase 127 delta figures against Phase 124 under Figures.
7. `docs/audit/task-ledger.md`: added Phase 127 section with T753 row marked `done`, updated Backlog rows for `QuickAddModal.tsx` and `Card.tsx` to `done in Phase 127 (T753)`, and added new Backlog row for `WalletTransferForm.tsx:101`.

## Tests added

- None (per spec section 6: visual change only; no behavior, logic, text, or selector changed; pinned by grep and diff gate checks).

## Gate commands and results

1. `npm run lint`:
   - node-globals: 132 files checked, 0 errors
   - safe-ids: 132 files checked, 0 errors
   - tsc --noEmit: clean
   - tsc -p api/tsconfig.json: clean

2. `npm run test:unit`:
   - 62 test files passed (62)
   - 1375 tests passed (1375)
   - Duration: 75.32s
   - Log path: `workflow/stages/02_build/output/logs/T753-unit.log`

3. `npx playwright test tests/presets.spec.ts tests/debt-repayment.spec.ts --project=chromium`:
   - 17 passed in 59.4s

4. `npx playwright test tests/presets.spec.ts tests/debt-repayment.spec.ts`:
   - 51 passed across 3 browsers (Chromium: 17, Firefox: 17, WebKit: 17)
   - Duration: 1.5m
   - Log path: `workflow/stages/02_build/output/logs/T753-e2e.log`

5. Production build (`npm run clean; npm run build`):
   - Entry chunk: `index-0LGxXWZU.js` (191,674 B raw, 55,796 B gzip; delta against Phase 124: 0 B raw, +3 B gzip)
   - All app JS: 40 files, 878,211 B raw, 266,951 B gzip (delta against Phase 124: -12 B raw, +43 B gzip, 0 files)
   - CSS: `index-CqllkKUj.css` (52,759 B raw, 10,159 B gzip)

6. Bash gate checks:
   - `git diff -U0 -- src/ | grep -cE '^-[^-]'`: 5
   - `git diff -U0 -- src/ | grep -cE '^\+[^+]'`: 5
   - `grep -rnE "tracking-wide[ \"'\`]" src`: 0 matches
   - `grep -nE "text-\[11px\].*uppercase" src/components/QuickAddModal.tsx src/components/TransactionForm.tsx`: 0 matches
   - `grep -nE "text-xs font-semibold.*uppercase tracking-wider" src/components/QuickAddModal.tsx src/components/TransactionForm.tsx`: 4 matches (`QuickAddModal.tsx:101`, `TransactionForm.tsx:709`, `:848`, `:871`)
   - `grep -n "rounded-xl" src/components/ui/Card.tsx`: 0 matches
   - `grep -n "rounded-card\`, a 1px" src/components/ui/Card.tsx`: matches line 23
   - `grep -n "exceptions are a Backlog row" DESIGN.md`: 0 matches
   - Em dash check (`grep -c $'\xe2\x80\x94'` across all 7 modified files): all counts 0

## Not done

- None. Everything in the spec was completed.
