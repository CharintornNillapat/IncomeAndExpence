# Review: task T790

## Round 2

### Metadata

- Task: T790 (Phase 142, branch `phase-142-clean-up-id-conventions`)
- Date: 2026-10-22
- Round: 2 (recheck of fix round 1)
- Verdict: APPROVED
- Target files: unchanged from Round 1. The fix round touched `src/components/dashboard/DebtPayoffCard.tsx`, `src/components/wallet/AddWalletForm.tsx`, `docs/contexts/client-state.md` and `DESIGN.md` (all four authorised by Round 1), plus `docs/audit/test-selector-contract.md`.

### Summary

The fix round closed all five Round 1 blocking items. The four stale references are renamed (one id-only line each) and the selector contract is now pure CRLF. The spec leftover grep prints nothing; lint and the full unit suite are green.

### Invariants and parity

- Round 1 blocking items: (1) `DebtPayoffCard.tsx:27` now says `debt-open-repay-` and `debt-settle-`; (2) `AddWalletForm.tsx:23` now says `wallet-new-init-balance`; (3) `client-state.md:85` now says `#debt-repay-amount-math`; (4) `DESIGN.md:182` now says `debt-open-repay-` and `debt-settle-`; (5) `test-selector-contract.md` is `w/crlf`. I read the `git diff -U0` of the four edited files: each is a one-line, id-only change.
- The `debts` area addition is now recorded in the build report's Fix round 1 section.
- "Spec-asserted DOM ids" parity row: unchanged since Round 1 (this fix round touched only comments and docs), so the Round 1 full Playwright pass (531 passed, 6 skipped, 0 failed) still stands.
- Em dashes in added lines: 0; in `unit/dom-id-convention.test.ts`: 0.

### Gates run

| Gate | Result | Log |
|---|---|---|
| Leftover grep (spec section 7, step 2) | prints nothing (grep exit 1) | n/a |
| `git ls-files --eol` on the 7 edited docs and comment files | all `w/crlf` | n/a |
| `npm run lint` | exit 0 | `workflow/stages/03_review/output/logs/T790-r2-lint.log` |
| `npm run test:unit` | 64 files passed, 1465 tests passed, 0 failed | `workflow/stages/03_review/output/logs/T790-r2-unit.log` |
| `git status --porcelain` / `git diff --stat` | 64 modified files; untracked: the guard test and the T790 spec, build and review files. No unlisted file (the 4 extra files were authorised in Round 1). | n/a |

### Not verified

- Playwright was not rerun: this fix round changed only comments and docs, as Round 1 allowed.

### Blocking

None.

### Non-blocking

- The Round 1 non-blocking items (selector-list ordering, the TransactionForm testid scope note) stand and may be skipped.

### Rule candidates

- Round 1 candidates stand. The convention paragraph in `docs/contexts/ui-and-e2e.md` is now backed by compliant code and a clean leftover grep.

STATUS: T790 | APPROVED | workflow/stages/03_review/output/task-T790-review.md

---

## Round 1

### Metadata

- Task: T790 (Phase 142, branch `phase-142-clean-up-id-conventions`)
- Date: 2026-10-22
- Round: 1
- Verdict: CHANGES REQUESTED
- Target files: `unit/dom-id-convention.test.ts` (new), 22 `src/` files, 24 `tests/*.spec.ts`, 11 `unit/*.test.tsx`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/task-ledger.md`. `git check-ignore -v` on the guard test and a source target printed nothing, so no target is ignored and every change shows in the diff.

### Summary

The builder applied the whole rename table across `src/`, `tests/`, `unit/` and the docs, and added a guard test that reads `src/components` and `src/views`. All behaviour gates are green. Two spec gates are not met: the leftover grep still prints 4 hits, and the edited selector contract has 4 bare-LF lines in an otherwise CRLF file.

### Invariants and parity

- "Spec-asserted DOM ids" row: specs, unit tests and `test-selector-contract.md` all use the new names. The full Playwright suite passes, which is the guard for this row. OK.
- Rename table: I read the full `git diff -U0 -- src`. Every row is applied as specified: `CategoryForm` prefix, `ColorGrid` consumers, `DebtsView` `idPrefix="debt-repay"`, and the `AddWalletModal` and `TransferFundsModal` `ids` objects. No behaviour, styling or copy changed.
- `TransactionForm.tsx` goes beyond the spec's "only `submitBtnId` and the comment at `:38-39`". The line `submitBtnId` is now `` `${idPrefix}-confirm-btn` ``. Four `data-testid`s in the payoff block (`repay-payoff-preview`, `repay-remaining-after`, `repay-overpayment-note`, `repay-settle-note`) were `${idBase}-...` and are now literals. This is correct and necessary: with `idPrefix="debt-repay"` the template would have renamed the testids, which `debt-repayment.spec.ts` asserts and the spec forbids renaming. The build report mentions it. Only strings changed, not the payoff arithmetic.
- Side effect, benign: `${idBase}-overdraft-warning` and `-overdraft-announcer` testids for the repay modal become `debt-repay-overdraft-*`. No spec or unit test references `repay-overdraft-*`. The unit tests that use `idPrefix="t"` now see `t-confirm-btn` and were updated.
- The guard's `AREAS` has `debts`, which the spec list lacks. It is needed because the non-interactive ids `debts-paid-off-heading` and `debts-caption` exist in `DebtsView.tsx`, which the spec's survey missed. It is declared consistently in the guard, the contract doc and `ui-and-e2e.md`. The build report does not mention the addition (non-blocking, see below).
- Test edits: every changed `tests/` and `unit/` file has equal added and removed line counts, and the diffs are locator renames only. No assertion deleted or weakened.
- No other parity row touched (no ledger arithmetic, SQL, api or CSP change). Em dashes in added lines: 0. The em dash count in the new test file is also 0.

### Gates run

| Gate | Result | Log |
|---|---|---|
| Red run, reproduced: `git stash push -- src`, `npx vitest run unit/dom-id-convention.test.ts`, `git stash pop --index` | 1 failed, 1 passed (the offender test fails, the at-least-100 test passes). `git status --porcelain` hash was identical before and after the stash round trip. No src file was `w/lf`. | `workflow/stages/03_review/output/logs/T790-red.log` |
| Leftover grep (spec section 7, step 2) | FAIL: 4 hits, see Blocking | n/a |
| `npm run lint` | exit 0: node-globals guard, safe-ids guard (132 files), both `tsc` runs | `.../logs/T790-lint.log` |
| `npm run test:unit` | 64 files passed, 1465 tests passed, 0 failed (includes the guard) | `.../logs/T790-unit.log` |
| `npx playwright test <24 changed specs> --project=chromium` | 132 passed, 0 failed (2.0m) | `.../logs/T790-playwright-chromium.log` |
| `npx playwright test` (all, 3 browsers) | 531 passed, 6 skipped, 0 failed (10.9m) | `.../logs/T790-playwright.log` |
| `git ls-files --eol` on edited files | 59 `w/crlf`; `docs/audit/test-selector-contract.md` is `w/mixed` (see Blocking) | n/a |
| Em dash count in added lines | 0 | n/a |
| `git status --porcelain` and `git diff --stat` | 60 modified plus the new guard test and the spec and build bookkeeping files. Every changed file is a listed target or bookkeeping. `tests/auth.spec.ts` and `tests/date-boundary.spec.ts` were named as "known today" but needed no change (they use `time-filter-*` and other compliant ids). | n/a |

Ports 3000 and 3100 were clear before Playwright, and about 6 GB of RAM was free. No run failed from resource exhaustion; all failures-to-complete concerns are absent.

### Not verified

- The builder's per-file unit run (11 files) was not rerun separately; the full `npm run test:unit` covers it.
- The unit guard is not shown to flag a template id like `${prefix}-...` whose caller-supplied prefix is bad, beyond the `idPrefix="..."` literal check the spec asks for. This follows the spec.

### Blocking

- `src/components/dashboard/DebtPayoffCard.tsx:27` - the comment still names `open-repay-modal-` and `settle-debt-`, which no longer exist, so it now states false facts, and the spec's leftover grep must print nothing - rewrite to `debt-open-repay-` and `debt-settle-`.
- `src/components/wallet/AddWalletForm.tsx:23` - the comment names `new-wallet-init-balance`, now `wallet-new-init-balance`, and trips the leftover grep - rewrite the comment to the new name.
- `docs/contexts/client-state.md:85` - states payoff chips seed through `#repay-amount-math`, now `#debt-repay-amount-math`, and trips the grep - update the id.
- `DESIGN.md:182` - lists `open-repay-modal-` and `settle-debt-` as other-page prefixes - update to `debt-open-repay-` and `debt-settle-`. These four files are not in the spec's Target files, but the spec's gate 2 scans them and says to rewrite or report each hit. The builder reported them as "legitimate" but did not rewrite them, so the gate is not met. Touching these four files is authorised by this review; they are docs and comments only.
- `docs/audit/test-selector-contract.md:9-12` - 4 bare-LF lines (the "A spec edit..." bullet line break and the new `### Convention` heading and blank lines) in a CRLF file, so `git ls-files --eol` shows `w/mixed`, not `w/crlf` as spec gate 6 requires (the build report claims all `w/crlf`, which is incorrect for this file) - convert those lines to CRLF with a Node read, replace, write.

### Non-blocking

- Report the `debts` area addition in the build report. The spec's AREAS list lacked it. An alternative is renaming `debts-caption` and `debts-paid-off-heading`, but those are non-interactive ids the spec said not to touch, so adding the area is the right call.
- "Selectors by spec" was edited by substitution and is no longer in alphabetical order inside entries (for example `#category-edit-*` after `#category-row-*`). The spec asked to regenerate it; the content is correct, so this is cosmetic.
- `TransactionForm.tsx` scope: the spec's Target note said "only `submitBtnId` and the comment"; the testid literals are an extra, justified change. The spec's Production touch points text should be read as including them.

### Rule candidates

- "New interactive ids use an area prefix from the contract list and end `-btn`/`-link`; guard `unit/dom-id-convention.test.ts`." Already added to `docs/contexts/ui-and-e2e.md` by the builder. It can be promoted only once the leftover stale references are fixed.
- A shared form that derives `data-testid` from a caller prefix needs its testids pinned when the prefix is renamed. Candidate for `docs/contexts/ui-and-e2e.md`.

### Fix block

```
fix T790 (stage file: workflow/stages/02_build/CONTEXT.md)
Blocking items from workflow/stages/03_review/output/task-T790-review.md Round 1:
1. src/components/dashboard/DebtPayoffCard.tsx:27 comment: open-repay-modal- -> debt-open-repay-, settle-debt- -> debt-settle-.
2. src/components/wallet/AddWalletForm.tsx:23 comment: new-wallet-init-balance -> wallet-new-init-balance.
3. docs/contexts/client-state.md:85: #repay-amount-math -> #debt-repay-amount-math.
4. DESIGN.md:182: open-repay-modal- -> debt-open-repay-, settle-debt- -> debt-settle-.
5. docs/audit/test-selector-contract.md lines 9-12: make the 4 bare-LF lines CRLF (Node read/replace/write), so git ls-files --eol shows w/crlf.
Also add one line to the build report noting AREAS gained `debts` (ids debts-caption, debts-paid-off-heading).
These four extra files are authorised for this fix round (comments and docs only).
Rerun: the spec section 7 leftover grep (must print nothing); git ls-files --eol on the five files; npm run lint (comment edits in src). No Playwright rerun is needed (comments and docs only).
```

STATUS: T790 | CHANGES REQUESTED | workflow/stages/03_review/output/task-T790-review.md
