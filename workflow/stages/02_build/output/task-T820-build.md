# Build Report - T820

## 1. Summary of Changes

Fixed Backlog row UI-03 (finding UI-03 from Audit 2026-10-16 / T759, Phase 136 follow-up): `AddWalletForm`'s `Currency` and `Color` `<label>` elements pointed at non-form controls (a read-only `div` and a swatch button group). Ships Phase 152 without an ADR (accessibility fix, matching Phase 136 precedent).

- **`src/components/wallet/AddWalletForm.tsx`:**
  - Converted the "Currency" `<label>` to `<span className={LABEL_CLASS}>Currency</span>` so that no `<label>` exists without a labelable control.
  - Converted the "Color" `<label>` to `<span id={colorLabelId} className={`${LABEL_CLASS} mb-1.5`}>Color</span>` using `const colorLabelId = useId();`.
  - Wrapped the color swatch buttons in `<div role="group" aria-labelledby={colorLabelId} className="flex flex-wrap items-center gap-1">` so the color picker group is programmatically associated with its "Color" accessible name.
- **`unit/wallets-page.test.tsx`:**
  - Extended existing test `it('names each field and the colour group, and has no label without a control')` in `describe('the Add Wallet form (audit 2026-10-16 UI-03)')`.
  - Asserted that exactly 3 `<label>` elements exist in the form and all 3 have non-null `.control` elements (`wallet-new-name`, `wallet-new-type`, `wallet-new-init-balance`).
  - Asserted `screen.getByRole('group', { name: 'Color' })` containing `IDENTITY_COLORS.length` buttons and 1 pressed button.
  - Asserted `document.getElementById('wallet-new-currency')?.textContent` is `'THB (฿)'`.
- **Phase 152 Closing Docs:**
  - `docs/audit/baseline-metrics.md`: Added Phase 152 delta section against Phase 151 with measured bundle sizes, Vitest (72 files, 1601 tests, +0), and Playwright (213 tests in 37 files, 639 runs unchanged).
  - `docs/audit/refactor-log.md`: Added Phase 152 entry (No ADR, accessibility fix as Phase 136).
  - `docs/audit/task-ledger.md`: Added Phase 152 section, marked T820 done with gate results, and marked Backlog row UI-03 done in Phase 152.

## 2. Files Changed (5 files)

1. `src/components/wallet/AddWalletForm.tsx` (modified)
2. `unit/wallets-page.test.tsx` (modified)
3. `docs/audit/baseline-metrics.md` (modified)
4. `docs/audit/refactor-log.md` (modified)
5. `docs/audit/task-ledger.md` (modified)

## 3. Tests Added and Fail-then-Pass Evidence

Strengthened test in `unit/wallets-page.test.tsx`:
- `it('names each field and the colour group, and has no label without a control')`

### Red Gate (before modifying `AddWalletForm.tsx`):
- Command: `npx vitest run unit/wallets-page.test.tsx`
- Log: `workflow/stages/02_build/output/logs/T820-red.log`
- Result: 1 failed file, 1 failed test, 19 passed tests (20 total) in 2.37s.
- Failure evidence:
  ```
  FAIL unit/wallets-page.test.tsx > the Add Wallet form (audit 2026-10-16 UI-03) > names each field and the colour group, and has no label without a control
  AssertionError: expected [ <label …(2)></label>, …(4) ] to have a length of 3 but got 5
   ❯ unit/wallets-page.test.tsx:403:20
       401| 
       402|     const labels = Array.from(document.querySelectorAll('form label'));
       403|     expect(labels).toHaveLength(3);
          |                    ^
       404|     for (const label of labels) expect((label as HTMLLabelElement).control).not.toBeNull();
  ```

### Green Gate (after modifying `AddWalletForm.tsx`):
- Command: `npx vitest run unit/wallets-page.test.tsx`
- Result: 1 passed file, 20 passed tests in 2.34s.

## 4. Verification Gates Run

### Gate 0: Red Run
- Verified expected failure before code fix (`expected 3 labels got 5`); log saved to `workflow/stages/02_build/output/logs/T820-red.log`.

### Gate 1: `npm run lint`
- Command: `npm run lint`
- Result: Exit 0.
  - `check:node-globals`: 139 files in `src/` checked, 0 errors.
  - `check:safe-ids`: 139 files in `src/` checked, 0 errors.
  - `tsc --noEmit`: 0 errors.
  - `tsc -p api/tsconfig.json`: 0 errors.

### Gate 2: Targeted Vitest Files
- Command: `npx vitest run unit/wallets-page.test.tsx unit/dom-id-convention.test.ts unit/dialog-names.test.tsx`
- Result: 3 passed files, 25 passed tests in 2.93s.

### Gate 3: Full Unit Suite
- Command: `npm run test:unit`
- Log: `workflow/stages/02_build/output/logs/T820-unit.log`
- Result: 72 passed files, 1601 passed tests (+0 tests against Phase 151) in 62.98s.

### Gate 4: E2E Playwright Specs
- Pre-check: Ports 3000 and 3100 confirmed free (no stale dev servers).
- Chromium run:
  - Command: `npx playwright test tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/soft-delete.spec.ts tests/account-and-mobile-nav.spec.ts tests/ios-field-zoom.spec.ts --project=chromium`
  - Result: 5 passed specs, 32 passed tests in 56.7s.
- 3-browser unfiltered run:
  - Command: `npx playwright test tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/soft-delete.spec.ts tests/account-and-mobile-nav.spec.ts tests/ios-field-zoom.spec.ts`
  - Log: `workflow/stages/02_build/output/logs/T820-e2e.log`
  - Result: 5 passed specs, 96 passed tests (32 per browser: chromium, firefox, webkit) in 2.4m.

### Gate 5: Production Build and Bundle Metrics
- Command: `npm run build`
- Output:
  - Entry chunk `index-CsN9mAj5.js`: 198,233 B raw, 57,965 B gzip (level 9). (Phase 151/149: 198,233 B / 57,974 B gzip; 0 B raw delta, -9 B gzip).
  - All app JS (39 files): 910,982 B raw, 275,886 B gzip. (+48 B raw, +34 B gzip against Phase 151/149 910,934 B / 275,852 B gzip).
  - `AddWalletModal-HUvfbRXN.js`: 3,006 B raw, 1,376 B gzip.
  - CSS `index-BNwLrid8.css`: 54,969 B raw, 10,720 B gzip (identical to Phase 149 and Phase 151).

### Gate 6: Docs and Scope Checks
- Em dash count in added lines (`git diff -U0 HEAD`): 0 em dashes (`\u2014`).
- Line endings check: `git ls-files --eol` confirms all 5 modified files are `w/crlf`.
- Working directory scope: `git status --porcelain` shows strictly the 5 allowlisted files and untracked stage output.

## 5. Deliberately Not Done

- A `<fieldset>` or `<legend>` element: `AddWalletForm` is an inline swatch picker, matching the existing `div` structure and avoiding extra margins or nesting complexity.
- A Playwright spec edit: covered by unit test and existing 5 e2e specs passing.
- Changes to `WalletDetail.tsx`: its Color already uses `fieldset` and `legend`.
- Filling the `<sha>` placeholders in the heading and the Commit cell in `task-ledger.md`, left to the owner-approved post-merge deploy record.
