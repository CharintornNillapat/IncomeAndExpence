# T753 spec: bring four uppercase labels onto DESIGN.md's section-label rule

Phase 127 (`phase-127-label-tracking`, at `0e9c94c`, the same commit as `main`). T753 is the phase's only task, so it ships the phase. UI classes in two components, plus one comment fix.

## 1. Goal

`DESIGN.md` says a section label is 12 to 13px, weight 600, uppercase, with `tracking-wider`. Four labels in the entry forms drift from that rule. Bring them onto it with the same classes the compliant labels use. Fix the stale `rounded-xl` comment in `Card.tsx`, and close both matching Backlog rows. Visual change only: no logic, text, id or structure change.

## 2. Target files

```
src/components/QuickAddModal.tsx
src/components/TransactionForm.tsx
src/components/ui/Card.tsx
DESIGN.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (see section 9a) and `workflow/stages/02_build/output/*`.

`DESIGN.md` is listed because its line 295 says "The `tracking-wide` exceptions are a Backlog row in `docs/audit/task-ledger.md`". That sentence is false once this task lands (Edit 6).

No ADR. This task makes no new decision: it applies `DESIGN.md:77` and `:85` as they stand. `refactor-log.md` and `baseline-metrics.md` are listed because T753 ships Phase 127 and changes `src/` (`AGENTS.md` Workflow).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (74 lines): this is visual work on components, so the routing table names this file and `DESIGN.md`. Line 26 restates the uppercase rule, and lines 62 to 69 cover the three-browser Playwright run and the WebKit flake you must repeat rather than hide.
- `DESIGN.md` lines 70 to 95 (the type table and the radius tokens) and line 295. Do not open `docs/design/*.html`.

## 4. Current behaviour

Each claim below was checked on `0e9c94c`.

1. `DESIGN.md:77`: "Section label | 12 to 13px / 600, uppercase, `tracking-wider` (0.05em), `fg-secondary` or `fg-muted`". `DESIGN.md:85`: "Uppercase, with `tracking-wider`, is only for compact section labels, column headers and tickers."
2. A compliant label, `src/components/dashboard/CashFlowCard.tsx:35`: `className="text-xs font-semibold uppercase tracking-wider text-fg-secondary"`. `text-xs` is 12px on the type scale (`src/index.css:365` calls it 12px).
3. `src/components/QuickAddModal.tsx:101`: `<span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide">` ("Quick templates").
4. `src/components/TransactionForm.tsx:709`: `<span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mr-0.5">` ("Templates").
5. `src/components/TransactionForm.tsx:848`: `<span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mr-0.5">` ("Quick payoff").
6. `src/components/TransactionForm.tsx:871`: `<span className="text-[11px] font-semibold uppercase tracking-wide text-fg-secondary">` ("Remaining after payment").
7. Items 3 to 6 are 11px and `tracking-wide` (0.025em). The order says `:709`, `:848` and `:871` drift on tracking. All three are also `text-[11px]`, and the order says to use the type scale, not a pixel size, so all four move to `text-xs`.
8. A repo-wide search of `src/` for `tracking-wide` followed by a space, quote or backtick finds only these four lines. After this task `tracking-wide` is unused in `src/`.
9. `src/components/ui/Card.tsx:23` (comment): "`rounded-xl`, a 1px `border-line`, and the Surface 1 background". The code at `Card.tsx:36` is `'bg-surface-1 rounded-card border border-line'`. `DESIGN.md:93` says `rounded-card` is 16px.
10. `docs/audit/task-ledger.md:41` and `:43` are the two Backlog rows for items 3 to 6 and item 9, both `todo`.
11. Side effect to expect: in Tailwind v4, `text-xs` also sets a line height of 1rem (16px), where `text-[11px]` set only the font size. The rows are `flex` with `items-center` or `items-baseline`, so a label may grow by about 1px in height. That is accepted; do not add a `leading-*` class.
12. Coverage: `tests/presets.spec.ts` opens Quick Add (`QuickAddModal`) and the form's template chip row (lines 8 to 11). `tests/debt-repayment.spec.ts` opens the repay modal with the payoff chips and `repay-payoff-preview` (lines 5, 6 and 52). No spec or unit test asserts these classes, and none takes a screenshot.

## 5. Parity map

None. No row of `AGENTS.md`'s parity map covers a class string or a comment. No id changes, so `test-selector-contract.md` is not touched.

## 6. Tests to add

None. The order calls this a visual change only. Only `className` tokens change: no handler, state, text, id, role or DOM structure moves, so no behaviour can change, and no existing test asserts these classes. The grep gates in section 8 pin the result in place of a test. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

Replace each `old` line with its `new` line exactly, keeping indentation. Change only the two tokens shown (`text-[11px]` becomes `text-xs`, and `tracking-wide` becomes `tracking-wider`). Keep each label's colour and `mr-0.5`, and keep the token order. Change no other line.

### Edit 1: `src/components/QuickAddModal.tsx:101`

old:
```
          <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide">
```
new:
```
          <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
```

### Edit 2: `src/components/TransactionForm.tsx:709`

old:
```
          <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mr-0.5">
```
new:
```
          <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider mr-0.5">
```

### Edit 3: `src/components/TransactionForm.tsx:848`

old:
```
            <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mr-0.5">
```
new:
```
            <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider mr-0.5">
```

### Edit 4: `src/components/TransactionForm.tsx:871`

old:
```
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-secondary">
```
new:
```
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
```

### Edit 5: `src/components/ui/Card.tsx:23` (comment)

old:
```
 * `rounded-xl`, a 1px `border-line`, and the Surface 1 background (DESIGN.md: no card shadows).
```
new:
```
 * `rounded-card`, a 1px `border-line`, and the Surface 1 background (DESIGN.md: no card shadows).
```

### Edit 6: `DESIGN.md:295`, the "Section label letter-spacing 0.4px" row

In the Why cell, replace the last sentence only.

old:
```
The `tracking-wide` exceptions are a Backlog row in `docs/audit/task-ledger.md`.
```
new:
```
Phase 127 (T753) moved the last four `tracking-wide` labels, in `QuickAddModal.tsx` and `TransactionForm.tsx`, onto it.
```

### Edit 7: `docs/audit/refactor-log.md`, a new Phase 127 entry

Insert it above the Phase 126 entry (after the `---` on line 20), followed by its own `---`, using the file's template:

- Heading: `## Phase 127 - Section label tracking: T753 (<today's date>, code \`<sha>\`, merged \`<sha>\`)`. Leave the `<sha>` placeholders for the deploy record.
- Brief: `No ADR (applies \`DESIGN.md\` lines 77 and 85 as written). The owner's brief: bring the four uppercase labels that used \`text-[11px]\` and \`tracking-wide\` onto the section-label rule, and fix \`Card.tsx\`'s stale \`rounded-xl\` comment.`
- **Changed:** the four labels in `src/components/QuickAddModal.tsx` and `src/components/TransactionForm.tsx` (`text-xs`, `tracking-wider`); the `src/components/ui/Card.tsx` comment; `DESIGN.md`'s deviation row; two Backlog rows closed.
- **Verified:** every gate from section 8, with the real counts and log paths.
- **Surprises:** whatever the build finds, or `none`.
- **Deliberately not done:** `No other \`text-[11px]\` or \`text-[10px]\` class was moved to the scale: they are not uppercase section labels, apart from \`WalletTransferForm.tsx:101\` (\`text-[10px]\`, now a Backlog row). No \`leading-*\` class was added for \`text-xs\`'s 16px line height.`

(The backslashes above only escape backticks in this spec; do not type them.)

### Edit 8: `docs/audit/baseline-metrics.md`, a new top section under "Figures"

Heading `### Phase 127 - delta against Phase 124`, measured per the file's "How to measure" block:

- **Entry chunk:** name, raw and gzip bytes, with the delta against Phase 124 (`index-BLSMm3p4.js`, 191,674 / 55,793).
- **All app JS:** raw and gzip bytes and file count, with the delta against Phase 124 (878,223 / 266,908, 40 files).
- **CSS:** the `dist/assets/*.css` file name, raw and gzip bytes. Phase 124 recorded none, so give no delta.
- **Vitest** and **Playwright:** files, tests, runs and results from the section 8 runs, with log paths.

Build with the repo's `.env` in place, as the file says. Do not open or print `.env`.

## 8. Gates

These are the union of the components row (`QuickAddModal.tsx`, `TransactionForm.tsx`), the comments-only row (`Card.tsx`) and the docs row (`DESIGN.md`, `refactor-log.md`, `baseline-metrics.md`, the ledger). Run them once, after all edits. Before Playwright, check that nothing is listening on ports 3000 and 3100, and stop any stale dev server you find there. Never edit `src/` while Playwright runs.

```
npm run lint
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T753-unit.log
npx playwright test tests/presets.spec.ts tests/debt-repayment.spec.ts --project=chromium
npx playwright test tests/presets.spec.ts tests/debt-repayment.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T753-e2e.log
npm run clean
npm run build
```

Bash checks, from the repo root:

The only changed lines in `src/` are the five edits. This must print `5` twice (5 lines removed, 5 added):

```
git diff -U0 -- src/ | grep -cE '^-[^-]'
git diff -U0 -- src/ | grep -cE '^\+[^+]'
```

No `tracking-wide` (as opposed to `tracking-wider`) is left in `src/`, and the four labels are off `text-[11px]`. Both must print nothing:

```
grep -rnE "tracking-wide[ \"'\`]" src
grep -nE "text-\[11px\].*uppercase" src/components/QuickAddModal.tsx src/components/TransactionForm.tsx
```

The four labels now carry the rule. This must print four lines, `QuickAddModal.tsx:101`, `TransactionForm.tsx:709`, `:848` and `:871`:

```
grep -nE "text-xs font-semibold.*uppercase tracking-wider" src/components/QuickAddModal.tsx src/components/TransactionForm.tsx
```

The `Card.tsx` comment matches the code. The first must print nothing; the second, line 23:

```
grep -n "rounded-xl" src/components/ui/Card.tsx
grep -n "rounded-card\`, a 1px" src/components/ui/Card.tsx
```

The stale `DESIGN.md` sentence is gone. This must print nothing:

```
grep -n "exceptions are a Backlog row" DESIGN.md
```

Zero em dashes in every touched file (`$'\xe2\x80\x94'` is the em dash's UTF-8 bytes). Every count must be 0:

```
grep -c $'\xe2\x80\x94' src/components/QuickAddModal.tsx src/components/TransactionForm.tsx src/components/ui/Card.tsx DESIGN.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
```

Report every count and pass/fail figure in `build-report.md`. A WebKit "waiting for stable" timeout is a known Windows flake (`docs/contexts/ui-and-e2e.md:69`): rerun that spec on WebKit and report both runs. Never mask it.

## 9. Production touch points

None. No SQL, no `/api/*`, no deploy, no dashboard, no `vercel.json` or workflow edit. Do not sign in on the dev server. Commits are the orchestrator's, on the owner's `commit T753` order.

### 9a. Ledger bookkeeping (allowed, not a target)

- Add a Phase 127 section above `## Backlog`, from the template:
  - Heading: `## Phase 127 - Section label tracking (UI classes and one comment, no ADR)`.
  - Under it: `` Branch `phase-127-label-tracking`, cut from `main` at `0e9c94c`. No migration. ``
  - Row: `| T753 | Bring four uppercase labels onto DESIGN.md's section-label rule (\`text-xs\`, \`tracking-wider\`); fix Card.tsx's stale \`rounded-xl\` comment | \`src/components/QuickAddModal.tsx\`, \`src/components/TransactionForm.tsx\`, \`src/components/ui/Card.tsx\`, \`DESIGN.md\`, \`docs/audit/refactor-log.md\`, \`docs/audit/baseline-metrics.md\` | done | | <gate results> |`. Leave `Commit` empty.
- Backlog row "`QuickAddModal.tsx:101` labels its template list..." (line 41): set its Status cell to `done in Phase 127 (T753)`.
- Backlog row "`src/components/ui/Card.tsx:23`'s doc comment says..." (line 43): set its Status cell to `done in Phase 127 (T753)`.
- Add one Backlog row under the line 41 row: `| \`WalletTransferForm.tsx:101\`'s uppercase label is \`text-[10px]\`, below \`DESIGN.md\`'s 12 to 13px (its tracking is already \`tracking-wider\`) | Phase 127, T753's spec | todo: code change, needs a UI phase |`.
- As in Edit 7, the backslashes in this section only escape backticks; do not type them.

## 10. Out of scope

- Every other `text-[10px]` and `text-[11px]` in `src/`, including:
  - `WalletTransferForm.tsx:101`, which gets a Backlog row only;
  - `QuickAddModal.tsx:135`, and `TransactionForm.tsx:731`, `:785`, `:794`, `:904`, `:920`, `:931`, `:995`, `:1061` and `:1118`;
  - `ui/Badge.tsx` and `ui/Chip.tsx`.
- Any other token on the four lines: the colours, `font-semibold` and `mr-0.5` stay. Do not reorder the tokens and do not add `leading-*`.
- The label text, ids, `data-testid`s, structure and the comments around the four labels.
- Every other line of the `Card.tsx` comment, including line 22's "T44" and line 27's "non-white background" wording.
- Any other `DESIGN.md` line, including the list of compliant files in the same row.
- `src/index.css`, any `tailwind`/theme token, `docs/contexts/ui-and-e2e.md`, `docs/audit/test-selector-contract.md`, any spec or unit test, any ADR.
- `docs/audit/archive/` (do not open it) and `docs/design/*.html` (do not open it).
