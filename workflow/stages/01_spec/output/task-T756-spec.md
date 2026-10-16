# T756 spec: bring the transfer panel's From/To label onto DESIGN.md's section-label size

Phase 129 (`phase-129-wallet-label`, at `0bdfbe6`, the same commit as `main`). T756 is the phase's only task, so it ships the phase. One class token in one component, plus the phase paperwork.

## 1. Goal

Close the Backlog row "`WalletTransferForm.tsx:101`'s uppercase label is `text-[10px]`, below `DESIGN.md`'s 12 to 13px". Move that label from `text-[10px]` to `text-xs` (12px on the type scale), the size every other section label uses. Visual change only: no logic, text, id or structure change.

## 2. Target files

```
src/components/wallet/WalletTransferForm.tsx
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (see section 9a) and `workflow/stages/02_build/output/*` (your report is `task-T756-build.md`; never write to `build-report.md`).

No ADR. The task makes no new decision: it applies `DESIGN.md:77` as written. `refactor-log.md` and `baseline-metrics.md` are listed because T756 ships Phase 129 and changes `src/` (`AGENTS.md` Workflow).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (74 lines): this is visual work on a component, so the routing table names this file and `DESIGN.md`. Line 26 restates the uppercase rule, line 29 says to size from the type scale, never `text-[Npx]`, and lines 62 to 69 cover the three-browser run and the WebKit flake you must repeat rather than hide.
- `DESIGN.md` lines 70 to 87 (the type scale and the Case rule). Do not open `docs/design/*.html`.

## 4. Current behaviour

Each claim below was checked on `0bdfbe6`.

1. `DESIGN.md:77`: "Section label | 12 to 13px / 600, uppercase, `tracking-wider` (0.05em), `fg-secondary` or `fg-muted`".
2. `src/components/wallet/WalletTransferForm.tsx:101`, inside the file-local `TransferWalletPanel` (`:82`): `<span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">`, rendering `{label}` (`:102`). The panel is used twice, with `label="From"` (`:319`) and `label="To"` (`:344`). So the label is 10px; weight, case, tracking and colour already match the rule.
3. A compliant label, `src/components/dashboard/CashFlowCard.tsx:35`: `className="text-xs font-semibold uppercase tracking-wider text-fg-secondary"`. `text-xs` is 12px (`src/index.css:365`).
4. The iOS field rule in `src/index.css:372` to `:377` raises `--text-xs` to 1rem only inside `:where(input, select, textarea)`. The label is a `<span>`, so it stays 12px on iOS too. The panel's `<select>` (`:117`, already `text-xs`) is not touched.
5. Side effect to expect: in Tailwind v4, `text-xs` also sets a line height of 1rem (16px), where `text-[10px]` set only the font size. The panel is `flex flex-col gap-2.5` (`:99`), so each panel may grow by a pixel or two in height. That is accepted; do not add a `leading-*` class.
6. `DESIGN.md:295` already lists `WalletTransferForm.tsx:101` as a `tracking-wider` label. This task changes no line count, so that reference stays correct and `DESIGN.md` is not edited.
7. `docs/audit/task-ledger.md:59` is the Backlog row, Status `todo: code change, needs a UI phase`.
8. Coverage: `tests/wallet-forms.spec.ts` (lines 16 and 41) and `tests/transfer-preview.spec.ts` (lines 25 to 90, including `transfer-panel-source` at line 67) open the transfer form and drive both panels. `tests/ios-field-zoom.spec.ts:119` opens the transfer dialog and measures its fields. No spec or unit test asserts the label's classes, and none takes a screenshot.
9. Line endings: `git ls-files --eol` reports `w/crlf` for `WalletTransferForm.tsx`, `task-ledger.md`, `refactor-log.md` and `baseline-metrics.md`. Keep CRLF in all four.

## 5. Parity map

None. No row of `AGENTS.md`'s parity map covers a class string. No id changes, so `test-selector-contract.md` is not touched.

## 6. Tests to add

None. Only one `className` token changes: no handler, state, text, id, role or DOM structure moves, so no behaviour can change, and no existing test asserts the class. The grep gates in section 8 pin the result in place of a test. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

### Edit 1: `src/components/wallet/WalletTransferForm.tsx:101`

Replace the `old` line with the `new` line exactly, keeping its indentation (6 spaces). Change only `text-[10px]` to `text-xs`; keep every other token and their order. Change no other line.

old:
```
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
```
new:
```
      <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
```

### Edit 2: `docs/audit/refactor-log.md`, a new Phase 129 entry

Insert it above the Phase 128 entry (directly after the `---` that follows the template block), followed by its own `---`, using the file's template:

- Heading: `## Phase 129 - Wallet transfer label size: T756 (<today's date>, code \`<sha>\`, merged \`<sha>\`)`. Leave the `<sha>` placeholders for the deploy record.
- Brief: `No ADR (applies \`DESIGN.md\` line 77 as written). The owner's brief: move the transfer panel's uppercase From/To label in \`WalletTransferForm.tsx\` from \`text-[10px]\` to the section-label size, \`text-xs\`.`
- **Changed:** `src/components/wallet/WalletTransferForm.tsx` (the panel label, `text-[10px]` to `text-xs`); one Backlog row closed.
- **Verified:** every gate from section 8, with the real counts and log paths.
- **Surprises:** whatever the build finds, or `none`.
- **Deliberately not done:** `No other \`text-[10px]\` class was moved to the scale: \`AccountModal.tsx\`, \`NavbarLedgerStatus.tsx\`, \`ImportCsvModal.tsx\`, \`TxCells.tsx\`, \`ui/Badge.tsx\` and \`ui/Chip.tsx\` use it for pills, badges and inline links, not section labels. No \`leading-*\` class was added for \`text-xs\`'s 16px line height. \`DESIGN.md\` is unchanged: its line 295 reference to \`WalletTransferForm.tsx:101\` still holds.`

(The backslashes above only escape backticks in this spec; do not type them.)

### Edit 3: `docs/audit/baseline-metrics.md`, a new top section under "Figures"

Heading `### Phase 129 - delta against Phase 127`, placed above the Phase 127 section, measured per the file's "How to measure" block:

- **Entry chunk:** name, raw and gzip bytes, with the delta against Phase 127 (`index-0LGxXWZU.js`, 191,674 / 55,796).
- **All app JS:** raw and gzip bytes and file count, with the delta against Phase 127 (878,211 / 266,951, 40 files).
- **CSS:** the `dist/assets/*.css` name, raw and gzip bytes, with the delta against Phase 127 (`index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest** and **Playwright:** files, tests, runs and results from the section 8 runs, with log paths.

Build with the repo's `.env` in place, as the file says. Do not open or print `.env`.

## 8. Gates

The union of the components row (`WalletTransferForm.tsx`) and the docs row (`refactor-log.md`, `baseline-metrics.md`, the ledger: counts checked below). Run them once, after all edits. Before Playwright, check that nothing is listening on ports 3000 and 3100, and stop any stale dev server you find there. Never edit `src/` while Playwright runs.

```
npm run lint
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T756-unit.log
npx playwright test tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/ios-field-zoom.spec.ts --project=chromium
npx playwright test tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/ios-field-zoom.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T756-e2e.log
npm run clean
npm run build
```

Bash checks, from the repo root.

The only changed line in `src/` is Edit 1. Each must print `1` (1 line removed, 1 added):

```
git diff -U0 -- src/ | grep -cE '^-[^-]'
git diff -U0 -- src/ | grep -cE '^\+[^+]'
```

The label is on the scale. The first must print nothing; the second, line 101 only:

```
grep -n "text-\[10px\]" src/components/wallet/WalletTransferForm.tsx
grep -n "text-xs font-semibold uppercase tracking-wider text-fg-muted" src/components/wallet/WalletTransferForm.tsx
```

CRLF is kept. Each of the four lines must show `w/crlf`:

```
git ls-files --eol src/components/wallet/WalletTransferForm.tsx docs/audit/task-ledger.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md
```

Zero em dashes in every touched file (`$'\xe2\x80\x94'` is the em dash's UTF-8 bytes). Every count must be 0:

```
grep -c $'\xe2\x80\x94' src/components/wallet/WalletTransferForm.tsx docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
```

Scope: `git status --porcelain` lists only the three target files, `docs/audit/task-ledger.md` and (if not ignored) your build report.

Report every count and pass/fail figure in `workflow/stages/02_build/output/task-T756-build.md`. A WebKit "waiting for stable" timeout is a known Windows flake (`docs/contexts/ui-and-e2e.md:69`): rerun that spec on WebKit and report both runs. Never mask it.

## 9. Production touch points

None. No SQL, no `/api/*`, no deploy, no dashboard, no `vercel.json` or workflow edit. Do not sign in on the dev server. The orchestrator commits the task on the phase branch after an `APPROVED` review; pushing waits for the owner.

### 9a. Ledger bookkeeping (allowed, not a target)

- Add a Phase 129 section above `## Backlog`, from the template:
  - Heading: `## Phase 129 - Wallet transfer label size (one UI class, no ADR)`.
  - Under it: `` Branch `phase-129-wallet-label`, cut from `main` at `0bdfbe6`. No migration. ``
  - Row: `| T756 | Move the transfer panel's uppercase From/To label from \`text-[10px]\` to \`text-xs\` (DESIGN.md's section-label size) | \`src/components/wallet/WalletTransferForm.tsx\`, \`docs/audit/refactor-log.md\`, \`docs/audit/baseline-metrics.md\` | done | | <gate results> |`. Leave `Commit` empty.
- Backlog row "`WalletTransferForm.tsx:101`'s uppercase label is `text-[10px]`..." (line 59): set its Status cell to `done in Phase 129 (T756)`.
- As in Edit 2, the backslashes in this section only escape backticks; do not type them.

## 10. Out of scope

- Every other `text-[10px]` and `text-[11px]` in `src/`, including `AccountModal.tsx:300`, `NavbarLedgerStatus.tsx:36`, `ImportCsvModal.tsx:575` and `:586`, `TxCells.tsx:80`, `ui/Badge.tsx:13` and `ui/Chip.tsx:15`.
- Any other token on line 101 (`font-semibold`, `uppercase`, `tracking-wider`, `text-fg-muted`): do not reorder them and do not add `leading-*`.
- The rest of `WalletTransferForm.tsx`: the `<select>` and its classes, the panel's `rounded-xl` container, the doc comment at `:70` to `:81`, ids, `data-testid`s and the label text.
- `DESIGN.md`, `src/index.css`, any theme token, `docs/contexts/ui-and-e2e.md`, `docs/audit/test-selector-contract.md`, any spec or unit test, any ADR.
- The Backlog row on checking line endings with `git ls-files --eol` (it asks for a `workflow/stages/01_spec/CONTEXT.md` edit, not this task's), and every other Backlog row.
- `docs/audit/archive/` (do not open it) and `docs/design/*.html` (do not open it).
