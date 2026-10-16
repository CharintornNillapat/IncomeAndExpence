# T756 review

## Round 1

### 1. Metadata

- **Task:** T756, Phase 129 (`phase-129-wallet-label`, HEAD `0bdfbe6`, uncommitted working tree)
- **Date:** 2026-10-16
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `src/components/wallet/WalletTransferForm.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T756-build.md`)
- **Ignored targets:** none (`git check-ignore -v` on the three targets printed nothing, exit 1).

### 2. Summary

The transfer panel's From/To label in `TransferWalletPanel` (`WalletTransferForm.tsx:101`) moves from `text-[10px]` to `text-xs`, with every other token and its order kept. The phase paperwork adds a Phase 129 refactor-log entry, a baseline-metrics section, a ledger section with the T756 row (Commit empty), and flips the Backlog row to `done in Phase 129 (T756)`.

### 3. Invariants and parity

- **Parity map:** no row touched (a class string only; no id, so `test-selector-contract.md` is unaffected). Confirmed.
- **Full function read:** `TransferWalletPanel` (`:82` onward). Only line 101 changed; `label`, `aria-label={label}`, `data-testid`, the `<select>` and its `text-xs` are untouched.
- **iOS field rule:** `src/index.css` scopes `--text-xs: 1rem` to `:where(input, select, textarea)`; the label is a `<span>`, so it stays 12px on iOS. Unchanged by this task.
- **DESIGN.md:77** (12 to 13px / 600, uppercase, `tracking-wider`, `fg-muted`): line 101 now meets every part. `DESIGN.md:295`'s `WalletTransferForm.tsx:101` reference still holds (no line count change in `src/`).
- **No em dash in user-facing text:** label text unchanged.
- **Line endings:** `git ls-files --eol` shows `w/crlf` (not `w/mixed`) on all four changed files.
- **Ledger:** Commit cell empty, as the ledger header requires; Backlog row status matches the spec's wording.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| Port check 3000 and 3100 (`Get-NetTCPConnection`) | nothing listening | n/a |
| `npm run lint` | exit 0: node-globals 132 files clean, safe-ids 132 files clean, both `tsc` runs clean | `workflow/stages/03_review/output/logs/T756-lint.log` |
| `npm run test:unit` | 62 files, 1375 tests, 1375 passed, 0 failed, 86.6 s | `workflow/stages/03_review/output/logs/T756-unit.log` |
| `npx playwright test tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/ios-field-zoom.spec.ts --project=chromium` | 13 passed, 0 failed, 0 skipped, 1.2 m | `workflow/stages/03_review/output/logs/T756-e2e-chromium.log` |
| Same three specs, all projects | 39 passed (13 x Chromium, Firefox, WebKit), 0 failed, 0 flaky, 0 skipped, 1.0 m; no WebKit stable-wait flake | `workflow/stages/03_review/output/logs/T756-e2e.log` |
| `npm run clean`, `npm run build` | exit 0 | `workflow/stages/03_review/output/logs/T756-build.log` |
| Bundle (gzip level 9, Node `zlib`) | entry `index-BB5386eR.js` 191,674 / 55,802; all app JS 878,207 / 266,942, 40 files; CSS `index-CqllkKUj.css` 52,759 / 10,159. Identical to the build report and `baseline-metrics.md` | n/a |
| `git diff -U0 -- src/ \| grep -cE '^-[^-]'` / `'^\+[^+]'` | 1 / 1 | n/a |
| `grep -n "text-\[10px\]" src/components/wallet/WalletTransferForm.tsx` | nothing | n/a |
| `grep -n "text-xs font-semibold uppercase tracking-wider text-fg-muted" ...` | line 101 only | n/a |
| `git ls-files --eol` on the four files | all `w/crlf` | n/a |
| `grep -c $'\xe2\x80\x94'` on the four files and the build report | 0 each | n/a |
| Scope: `git diff --stat`, `git status --porcelain` | modified: the three targets and `task-ledger.md` (8+0, 11+0, 1+1, 9+1 lines); untracked: `task-T756-spec.md` (mine) and `task-T756-build.md`. Nothing unannounced | n/a |

Step 6 (fail-without-change) does not apply: the spec's tests are `none`.

### 5. Not verified

- Visual rendering on a real iOS device or a screenshot of the panel: no spec takes screenshots, and the change is a single size token. The 1 to 2 px panel height growth from `text-xs`'s 16px line height is accepted by the spec (section 4 item 5) and was not measured.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/task-ledger.md`, T756 row, Gate result cell: "bash checks 5/5". The spec has six check groups (diff counts, no `text-[10px]`, line 101 match, `--eol`, em dashes, scope), and the build report lists six. The numbers are right; the tally is off by one. Fix it in the deploy record if you touch the row, or leave it.

### 8. Rule candidates

- The `git ls-files --eol` check from the line-ending Backlog row (Phase 128, T755) was used in a spec here and worked on all four CRLF files. That row's own condition ("add to `workflow/stages/01_spec/CONTEXT.md` once a spec uses it") is now met, so it is ready for a docs task. Out of T756's scope.
