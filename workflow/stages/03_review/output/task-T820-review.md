## Round 1

### 1. Metadata

- Task: T820 (Phase 152, branch `phase-152-wallet-form-labels`)
- Date: 2026-10-28
- Round: 1
- Verdict: APPROVED
- Target files: `src/components/wallet/AddWalletForm.tsx`, `unit/wallets-page.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (plus bookkeeping `docs/audit/task-ledger.md`). `git check-ignore -v` on the four targets: none ignored.

### 2. Summary

Currency's `<label>` became a `<span>`. Color's `<label>` became `<span id={colorLabelId}>` (`useId`), and the swatch `<div>` gained `role="group" aria-labelledby={colorLabelId}`. The existing UI-03 unit test was extended (no new test, count stays 1601). The diff matches the spec's section 6 and 7 text exactly; ids, classes and layout are unchanged.

### 3. Invariants and parity

- Parity map: no row touched (spec section 5 says none). `WalletDetail.tsx` not edited.
- Ids: `ids.currency` div and `AddWalletFormIds` untouched; `dom-id-convention` passes.
- No visual change: `LABEL_CLASS` kept on both spans; the `mb-1.5` on Color kept.
- Scope: `git diff --stat` shows 5 files (4 targets + ledger); untracked files are only spec and build outputs. No unannounced change.
- Text: 0 U+2014 in added lines. `git ls-files --eol`: all five files `w/crlf`.
- Full text of changed function (`AddWalletForm`) read via the diff context; `useId` call is unconditional at the top level with the other hooks.

### 4. Gates run

- Red run (step 6): stashed only `AddWalletForm.tsx` (`w/crlf`), `npx vitest run unit/wallets-page.test.tsx`: 1 failed, 19 passed (20). Failure `expected [ <label>... ] to have a length of 3 but got 5` at `unit/wallets-page.test.tsx:403`, the expected one. `git stash pop --index`; `git status --porcelain` identical to the pre-stash record.
- `npm run lint`: exit 0 (139 files, node-globals and safe-ids clean, both `tsc` clean).
- `npx vitest run unit/wallets-page.test.tsx unit/dom-id-convention.test.ts unit/dialog-names.test.tsx`: 3 files, 25 passed, 0 failed.
- `npm run test:unit`: 72 files, 1601 passed, 0 failed, 0 skipped. Log: `workflow/stages/03_review/output/logs/T820-unit.log`.
- Ports 3000 and 3100 free before Playwright (netstat empty).
- Playwright, five specs, `--project=chromium`: 32 passed.
- Playwright, same five specs, three browsers: 96 passed. Log: `workflow/stages/03_review/output/logs/T820-e2e.log`.
- `npm run build`: entry `index-CsN9mAj5.js` 198.23 kB, `AddWalletModal-HUvfbRXN.js` 3.01 kB, CSS `index-BNwLrid8.css` 54.97 kB. Hashes match the builder's baseline-metrics figures. (`dist/` is regenerated output; git status unchanged.)

### 5. Not verified

- Exact gzip level-9 byte counts in `baseline-metrics.md` were not recomputed; only the chunk hashes and rounded sizes were compared (same hashes imply the same bytes).
- The group-role and Currency-text assertions were not shown red on their own: the first `toHaveLength` failure stops the test before them. The spec accepts this. Group role absence on the unfixed code is clear from the diff (`:154` had no role).

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/task-ledger.md` T820 Commit cell is empty; spec section 10 asked for a `<sha>` placeholder (the refactor-log heading has it). Fill in with the closing commit.
- The T820 ledger Gate result says "e2e 5 specs 32 passed on chr", fine, but the refactor-log "Deliberately not done" sentence on the `<sha>` placeholders says "left to the owner-approved post-merge deploy record"; Phase 151 closed them in the closing docs commit. Wording only.

### 8. Rule candidates

None.
