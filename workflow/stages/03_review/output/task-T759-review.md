# T759 review

## Round 2

### Metadata

- **Task:** T759, whole-app read-only audit (Phase 131, branch `phase-131-project-audit`)
- **Date:** 2026-10-16
- **Round:** 2 (after the builder's Fix round 1)
- **Verdict:** APPROVED
- **Target files:** `docs/audit/audit-2026-10-16.md` (new), `docs/audit/README.md`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T759-build.md`
- **`git check-ignore -v`** on the three target files: none ignored (exit 1).

### Summary

The fix round applied all 11 Round 1 blocking items as written. The report now has 16 findings (1 high, 5 medium, 10 low), with five severity or Impact changes recorded under a new `Changed in review` section, and the Backlog holds 6 rows (SL-02, SL-01, UI-02 to UI-05). Nothing else changed: the report grew by exactly the 9 lines of that section (288 to 297).

### Invariants and parity

- **Round 1 blocking items, rechecked one by one:**
  1. CS-01 is `[low]`, Rule `none`, the new Impact word for word (`docs/audit/audit-2026-10-16.md:29-35`). Fixed.
  2. SL-01 is `[medium]` with the new Impact (`:78-100`). Fixed.
  3. SL-02 stays `[high]`; the last two Impact sentences are replaced (`:111`). Fixed.
  4. SL-03 is `[low]`, Rule `none`, the Impact sentence appended (`:114-119`). Fixed.
  5. UI-01 is `[low]` with the new Impact (`:153-158`). Fixed.
  6. UI-02 to UI-05 have Rule `none` (`:164`, `:172`, `:180`, `:192`). Fixed.
  7. The Summary is CS 0/0/3, SL 1/1/1, AP 0/0/2, UI 0/4/4, Total 1/5/10 (`:17-23`). Fixed.
  8. `## Dropped in review` stays `None.`; `## Changed in review` follows with the six lines. Fixed.
  9. The Backlog has 6 rows, in the order SL-02 (high), SL-01 (medium), UI-02, UI-03, UI-04, UI-05; the CS-01, SL-03 and UI-01 rows are gone. Fixed.
  10. The refactor-log counts are 1/5/10, 6 rows and the G3 counts; low 10; the Surprises line is added (`docs/audit/refactor-log.md:26-29`). Fixed.
  11. `## Fix round 1` is appended to the build report. Fixed.
- **No code changed:** G7 prints nothing. Parity map: no row touched (docs only).
- **The verified high and medium set** now matches Round 1's table: SL-02 high; SL-01, UI-02, UI-03, UI-04, UI-05 medium.

### Gates run

All in `workflow/stages/03_review/output/logs/T759-gates-round2.log`, using the G2 script extracted from the spec.

- **G1 scope:** `M` README, refactor-log, task-ledger; `??` the report and the T759 spec, build and review files. `git diff --stat main`: 3 files, 26 insertions. Pass.
- **G2:** `{ cites: 69, bad: 0, findings: 16, high: 1, medium: 5, low: 10, grouped: false, ledgerRows: 6, dup: [], noField: [], noCite: [], missingRows: [], extraRows: 0, badShape: false }`, exit 0. Pass.
- **G3 counts:** the Summary, the headings and the refactor-log all say 1/5/10, per domain CS 0/0/3, SL 1/1/1, AP 0/0/2, UI 0/4/4. Pass.
- **G4 skip list:** unchanged set of titles; pass.
- **G5 em dashes:** 0 in all 5 files. Pass.
- **G6 line endings:** README, refactor-log, task-ledger `w/crlf`; report `{ crlf: 0, bareLf: 297 }`. Pass.
- **G7 no code changed:** 0 lines. Pass.
- Ledger length: 110 lines.

### Not verified

As in Round 1: no live check; low findings CS-02 and AP-01 not opened; the "Checked, no finding" claims not re-derived; no unit or Playwright run (no code tier).

### Blocking

None.

### Non-blocking

Round 1's non-blocking points still stand (CS-03's Rule could name the selectors rule; two `Needs a live check` items are redundant or operational; UI-02's placeholder wording; Backlog citations without backticks; paraphrased template literals). None is required.

### Rule candidates

None.

## Round 1

### Metadata

- **Task:** T759, whole-app read-only audit (Phase 131, branch `phase-131-project-audit`)
- **Date:** 2026-10-16
- **Round:** 1
- **Verdict:** CHANGES REQUESTED
- **Target files:** `docs/audit/audit-2026-10-16.md` (new), `docs/audit/README.md`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T759-build.md`, `workflow/stages/02_build/output/logs/T759-check.mjs`
- **`git check-ignore -v`** on the three target files: none ignored (exit 1).

### Summary

The builder wrote a 288-line report with 16 findings (2 high, 7 medium, 7 low), a README index row, a Phase 131 refactor-log entry, the T759 ledger row and 9 Backlog rows. Scope is clean and every mechanical gate passes. I checked all 9 high and medium findings against the code: all 9 point at real code, but 5 have the wrong severity or an inaccurate Impact or Rule, so the report and the Backlog need correcting before approval. No finding is dropped outright.

### Invariants and parity

- **No code changed:** G7 prints nothing; `git diff --stat main` lists only the three docs files plus the ledger.
- **Parity map:** no row is touched by the change (docs only). The audit's own parity claims were not all re-derived; see Not verified.
- **Skip list (G4):** no finding repeats an open or `done` Backlog row or an accepted advisor.
- **Verification of every high and medium finding (owner's addition):**

| ID | Claimed | Code check | Result |
|---|---|---|---|
| CS-01 | medium | `src/hooks/useTransactions.ts:67-68` is as quoted. The only caller, `src/views/TransactionsView.tsx:147-154`, never passes `includeDeleted`, so the override never fires; no user-visible effect today. The cited rule `docs/contexts/client-state.md:14` says nothing about `includeDeleted`. | Confirmed as latent: **downgrade to low**, Rule `none` |
| SL-01 | high | `supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:80-86` and `:175-185` filter `is_deleted = false`, unlike `record_transaction` (`20260928_phase52_security_ledger.sql:244-249`, `:326-331`), and break `docs/contexts/supabase-ledger.md:20`. The index is non-partial on `is_deleted` (`20260901_baseline_schema.sql:138-153`). But the `exception` block rolls back the balance updates before `raise`, so money never moves twice, and a 23505 has a SQLSTATE, so the client's rollback to the pre-call snapshot is correct. The impact is a refused retry (an error instead of the replayed row), not corrupted state. | Confirmed, **downgrade to medium**, Impact corrected |
| SL-02 | high | `src/context/FinanceContext.tsx:1848-1853`: the transfer branch never sets `rpcOutcomeUnknown` (compare `:1909`, `:1914-1917`), so an unknown outcome rolls back to `previousWallets` with no `refreshFromCloud()` (`:1965-1978`), breaking `docs/contexts/supabase-ledger.md:18`. Confirmed. The report's "until a manual page reload" is overstated: the next cloud reload (realtime echo, which is not suppressed because `markLocalWrite` runs only on success; `online`; visibility) corrects it. The real harm: the user is told the transfer failed while it committed, and re-entering it in a new form (a new key from `src/hooks/useIdempotencyKey.ts:10-11`) moves the money twice. | Confirmed, **stays high**, Impact corrected |
| SL-03 | medium | `src/context/FinanceContext.tsx:1937` is as quoted, but every UI caller's amount comes through `evaluateAmountInput`, which rounds to two decimals (`src/utils/mathEvaluator.ts:88-91`, `:120`). No current caller can produce the sub-cent mismatch. The Non-negotiables rule (round only through `roundToCents`) is not broken: nothing rounds another way here. | Confirmed as latent: **downgrade to low**, Rule `none` |
| UI-01 | medium | `src/components/InlineMathInput.tsx:136` is as quoted, but the element is a non-focusable `div` frame; `docs/contexts/ui-and-e2e.md:28` names focusable controls. Spirit drift, not a broken rule; the "layout, dimension" animation in the Impact is not shown by the classes. | **Downgrade to low** |
| UI-02 | medium | `src/components/AuthModal.tsx:182`, `:199`, `:217`: no `htmlFor`, no wrapping, no `aria-label` on the inputs. Confirmed. The Rule `AGENTS.md` (Non-negotiables) holds no label rule. | Confirmed medium; Rule `none` |
| UI-03 | medium | `src/components/wallet/AddWalletForm.tsx:95`, `:109`, `:136`: same pattern. Confirmed. | Confirmed medium; Rule `none` |
| UI-04 | medium | `src/components/account/AccountModal.tsx:611`, `:671`, `:682`: same pattern. Confirmed. | Confirmed medium; Rule `none` |
| UI-05 | medium | `src/components/transaction/ImportCsvModal.tsx:547-552`: the `<select>` has no label, `aria-label` or `aria-labelledby`; a `<th>` does not name a form control. Confirmed. | Confirmed medium; Rule `none` |

- **Low findings, spot-checked:** CS-03 (`src/hooks/useDebts.ts:40-42` as quoted), AP-02 (`api/insights.ts:482-485`: no `changePercent` check), UI-06 (`transfer-balance-after-*` absent from `docs/audit/test-selector-contract.md`), UI-07 and UI-08 (`git grep` finds no importer of `prefersReducedMotion` or `RECENT_STEP`). All hold.

### Gates run

All in `workflow/stages/03_review/output/logs/T759-gates.log`. The G2 script was extracted from the spec myself; it is identical to the builder's `T759-check.mjs`, apart from line endings.

- **G1 scope:** `git status --porcelain` shows `M` README, refactor-log, task-ledger; `??` the report, the spec, the build report. `git diff --stat main`: 3 files, 29 insertions. Pass.
- **G2:** `{ cites: 67, bad: 0, findings: 16, high: 2, medium: 7, low: 7, grouped: false, ledgerRows: 9, dup: [], noField: [], noCite: [], missingRows: [], extraRows: 0, badShape: false }`, exit 0. Pass.
- **G3 counts:** Summary CS 0/1/2, SL 2/1/0, AP 0/0/2, UI 0/5/3, total 2/7/7, equal to the headings; the refactor-log says 16, 2 high, 7 medium, 7 low. Pass (for the build as it stands).
- **G4 skip list:** pass.
- **G5 em dashes:** 0 in all 5 files. Pass.
- **G6 line endings:** README, refactor-log, task-ledger `w/crlf`; report `{ crlf: 0, bareLf: 288 }`. Pass.
- **G7 no code changed:** 0 lines. Pass.
- Ledger length: 113 lines (under 150).

### Not verified

- No live check (Stop and ask first): the `Needs a live check` items are unverified.
- The low findings CS-02 and AP-01 were not opened; the "Checked, no finding" bullets (for example the RLS, seed-parity and identity-colour claims) were not re-derived.
- No unit or Playwright run: no code tier applies, and the spec forbids the builder from running Playwright.

### Blocking

1. `docs/audit/audit-2026-10-16.md:29-35` - CS-01 is latent (the only caller, `src/views/TransactionsView.tsx:147`, never passes `includeDeleted`) and cites a rule line that does not cover it - change the heading to `[low]`, set **Rule:** to `none`, and replace **Impact:** with: "Latent: no caller passes `includeDeleted` today (the only caller is `src/views/TransactionsView.tsx:147`), so the option is never overridden. A future caller passing `includeDeleted: true` while `showSoftDeleted` is `false` would get no soft-deleted rows."
2. `docs/audit/audit-2026-10-16.md:78-100` - SL-01's Impact claims a second balance move and corrupted client state; the `exception` block rolls the balance updates back and the client's rollback is correct - change the heading to `[medium]` and replace **Impact:** with: "A retry carrying the key of a soft-deleted transfer skips the replay (the filter `is_deleted = false` breaks the replay rule), so the function tries the transfer again; the insert hits the non-partial `transactions_user_idempotency_uidx` (`supabase/migrations/20260901_baseline_schema.sql:151-153`), the handler's lookup with the same filter finds nothing, and `raise` returns a 23505 error. The block's balance updates roll back with it, so no money moves twice, but the caller gets an error instead of the replayed row that `record_transaction` would return."
3. `docs/audit/audit-2026-10-16.md:111` - SL-02's Impact says the stale balances last "until a manual page reload" and leaves out the double-spend risk - keep `[high]`; replace the last two sentences of **Impact:** (from "In the `catch` block") with: "In the `catch` block (`src/context/FinanceContext.tsx:1965-1978`), the client rolls back to `previousWallets` and does not call `refreshFromCloud()`, so the user is told the transfer failed while it committed, and the balances stay at their pre-transfer values until the next cloud reload. A user who re-enters the transfer in a new form (a new idempotency key) moves the money twice."
4. `docs/audit/audit-2026-10-16.md:114-119` - SL-03 is latent (every UI amount is already rounded by `src/utils/mathEvaluator.ts:120`) and no rule is broken - change the heading to `[low]`, set **Rule:** to `none`, and append to **Impact:**: "Latent: every UI caller's amount comes through `evaluateAmountInput`, which already rounds to two decimals (`src/utils/mathEvaluator.ts:120`), so no current path stores a sub-cent amount."
5. `docs/audit/audit-2026-10-16.md:153-158` - UI-01's element is a non-focusable `div`, so `docs/contexts/ui-and-e2e.md:28` (focusable controls) is not literally broken - change the heading to `[low]` and replace **Impact:** with: "The frame is a non-focusable `div` that draws the input's focus and error rings, so the rule for focusable controls does not strictly apply; `transition-all` still animates every property where `transition-control` would limit it to the control properties."
6. `docs/audit/audit-2026-10-16.md:164`, `:172`, `:180`, `:192` - UI-02, UI-03, UI-04 and UI-05 cite `AGENTS.md` (Non-negotiables), which has no label or accessible-name rule - set each **Rule:** to `none`.
7. `docs/audit/audit-2026-10-16.md:17-23` - the Summary counts must follow items 1 to 5 - set CS 0/0/3, SL 1/1/1, AP 0/0/2, UI 0/4/4, Total 1/5/10.
8. `docs/audit/audit-2026-10-16.md:286-288` - the review's changes are not recorded - keep `## Dropped in review` as `None.` and add after it a `## Changed in review` section with one line each: `- CS-01 medium to low: latent, no caller passes includeDeleted.`, `- SL-01 high to medium: the exception block rolls the balances back; the defect is a refused retry.`, `- SL-02 stays high: Impact corrected (stale until the next reload; a re-entry in a new form moves the money twice).`, `- SL-03 medium to low: latent, every UI amount is already rounded.`, `- UI-01 medium to low: the element is not focusable.`, `- UI-02 to UI-05: Rule set to none.`
9. `docs/audit/task-ledger.md:93-101` - the Backlog rows must follow items 1 to 5 - remove the CS-01, SL-03 and UI-01 rows; change the SL-01 row's severity to `medium`; order the remaining six as SL-02 (high), SL-01 (medium), UI-02, UI-03, UI-04, UI-05 (report order, high before medium within a domain). 6 is not above 10, so the per-finding form stays.
10. `docs/audit/refactor-log.md:26-29` - the counts must follow - set "16 findings in total, 1 high, 5 medium, 10 low", "6 new Backlog rows", the G3 counts (CS 0/0/3, SL 1/1/1, AP 0/0/2, UI 0/4/4) and "low findings (10 in total)"; add to **Surprises:** "The review changed five findings' severity or Impact (see the report's Changed in review)."
11. `workflow/stages/02_build/output/task-T759-build.md` - append a `## Fix round 1` section with the new G2 output and gate results (stage 02, On `fix <id>`).

### Non-blocking

- CS-03's inline debt sums in `src/hooks/useDebts.ts:40-42` also touch the non-negotiable "Money figures come from `src/selectors/`"; its Rule could name that instead of the rounding rule.
- `Needs a live check`: the first SL item is already recorded as known, deliberate drift in `docs/contexts/supabase-ledger.md:24`, and the AP TypeSafe key-and-quota item is an operations check, not an audit suspicion. Either may be removed.
- UI-02's Impact says the inputs have no accessible names; browsers fall back to the placeholder, so "named only by their placeholder" is more exact.
- The Backlog rows' first citation is not in backticks, unlike every citation in the report.
- UI-01 and UI-05 quote template literals rewritten as string concatenation (backticks would break the Markdown); acceptable, but "paraphrased" would be honest.

### Rule candidates

None.

### Fix block

```
fix T759 (stage file: workflow/stages/02_build/CONTEXT.md)

Apply the 11 blocking items in workflow/stages/03_review/output/task-T759-review.md, Round 1, using the replacement texts given there word for word:
1. CS-01 -> [low], Rule none, new Impact.
2. SL-01 -> [medium], new Impact.
3. SL-02 stays [high], last two Impact sentences replaced.
4. SL-03 -> [low], Rule none, Impact sentence appended.
5. UI-01 -> [low], new Impact.
6. UI-02, UI-03, UI-04, UI-05: Rule none.
7. Summary: CS 0/0/3, SL 1/1/1, AP 0/0/2, UI 0/4/4, Total 1/5/10.
8. Add "## Changed in review" after "## Dropped in review" (which stays "None."), with the six lines given.
9. Backlog: remove the CS-01, SL-03 and UI-01 rows; SL-01 row severity medium; order SL-02, SL-01, UI-02, UI-03, UI-04, UI-05.
10. refactor-log Phase 131 entry: 1 high, 5 medium, 10 low; 6 Backlog rows; G3 counts; low 10; Surprises line.
11. Append "## Fix round 1" to task-T759-build.md.
Do not renumber any finding id. Rerun G1 to G7 from the spec; G2 must print high: 1, medium: 5, low: 10, ledgerRows: 6, grouped: false, exit 0.
```
