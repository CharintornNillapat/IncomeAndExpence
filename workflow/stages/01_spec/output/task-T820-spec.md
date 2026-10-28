# T820 spec: name the Add Wallet form's Currency and Color labels honestly

Phase 152 (branch `phase-152-wallet-form-labels`, cut from `main` at `2e18134`). Backlog row: "AddWalletForm's `Currency` and `Color` `<label>`s name no labelable control ..." (`docs/audit/task-ledger.md:78`, source Phase 136, T768's spec). This task ships the phase.

## 1. Goal

In the Add Wallet form, "Currency" and "Color" stop being `<label>` elements that point at nothing. A screen reader announces the swatch row as a group named "Color" (so each swatch button is heard inside it), and "Currency" is plain text beside the read-only "THB (฿)" box. No visible change, no id change.

## 2. Target files

```
src/components/wallet/AddWalletForm.tsx
unit/wallets-page.test.tsx
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

No ADR. Reason: `AGENTS.md` asks for an ADR with a new feature or phase that sets a rule or decision; this is markup brought to standard HTML labelling and sets no rule. Precedent: Phase 136 (T768), the same family of fix, shipped as "accessibility, no ADR"; the newest ADR is `0110` and none covers labelling. Bookkeeping (`docs/audit/task-ledger.md`, the build report) is allowed as usual. `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md` are not edited: the test count stays 1601 (section 6 extends an existing test), the Playwright count stays 213 / 37 / 639, and no rule changes.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: the selector contract (ids stay), the 44 px hit-box and token-class rules the swatches already follow, and the Playwright rules.
- Per that file, load the `antislop` core skill and `antislop-ui` during the work (accessibility).
- `DESIGN.md` is not needed: no visual change.

## 4. Current behaviour

- `src/components/wallet/AddWalletForm.tsx:125-133`: `<label className={LABEL_CLASS}>Currency</label>` has no `htmlFor` and wraps nothing; the box it sits above is a `<div id={ids.currency}>` (`:127-132`), not a form control. The only caller, `AddWalletModal.tsx:28`, passes `wallet-new-currency`.
- `AddWalletForm.tsx:151-172`: `<label className={`${LABEL_CLASS} mb-1.5`}>Color</label>` (`:152`) sits above a plain `<div className="flex flex-wrap items-center gap-1">` (`:154`) holding twelve `<button aria-label={identityColorName(c)} aria-pressed>` swatches (`:155-171`). The label names no control; the group has no name.
- Both labels came out of T768 (Phase 136), which added `htmlFor` to the Name, Type and Starting Balance labels only. Those three are already guarded by `unit/wallets-page.test.tsx:391-402` (`getByLabelText`), which does not look at Currency or Color.
- Sibling precedent: `src/components/category/ColorGrid.tsx:40` uses `<div role="group" aria-labelledby={labelId}>` for the same swatch pattern; `src/components/wallet/WalletDetail.tsx:211-212` uses `<fieldset><legend>Color</legend>`.

## 5. Parity map

None. (`WalletDetail.tsx:215` has a comment saying its swatches are "as in `AddWalletForm`"; its markup already names the group and is not touched.)

## 6. The fix (chosen)

Currency: `<label>` becomes `<span className={LABEL_CLASS}>Currency</span>`. `LABEL_CLASS` (`src/utils/formStyles.ts:34`) includes `block mb-1`, so the layout is identical. The `<div id={ids.currency}>` is unchanged (the id stays).

Color: use `role="group"` with `aria-labelledby`, not a `<fieldset>` (which would need its border, padding and min-width reset, and the Backlog row names this form). Add `const colorLabelId = useId();` (import `useId` from `react`, which is already imported as `React, { useState }`), change the label to `<span id={colorLabelId} className={`${LABEL_CLASS} mb-1.5`}>Color</span>`, and put `role="group" aria-labelledby={colorLabelId}` on the existing swatch `<div>` at `:154`. `useId` keeps the id out of `AddWalletFormIds`, the modal's props, `unit/dom-id-convention.test.ts` and the selector contract. Keep the existing comment at `:153`.

Why this one: the span alone would fix the Currency row but leave the twelve buttons unnamed as a set; the group gives them a name at no layout cost, and it is the pattern `ColorGrid` already uses.

What a screen reader announces after the fix:
- Currency: the text "Currency" then "THB (฿)" as it reads down the form. It is a read-only display, not a field, so it is not in the Tab order and is not announced as an edit box or a named control.
- Color: on entering the swatch row, "Color, group", then each swatch as "Rose, toggle button, pressed" or "not pressed" (names from `identityColorName`, unchanged). Today it hears twelve buttons with no group.
- Clicking the word "Color" or "Currency" no longer looks clickable or does anything, which is correct; before, it did nothing too.

## 7. Tests to add

One file: `unit/wallets-page.test.tsx`. Extend the existing `it('names each field from its label')` in `describe('the Add Wallet form (audit 2026-10-16 UI-03)')` (`:391-402`) rather than adding a test, so the Vitest count stays 1601. Retitle it `'names each field and the colour group, and has no label without a control'`. Add `IDENTITY_COLORS` to the existing import from `../src/utils/identityPalette` (`:11`) and `within` is already imported (`:3`). After the three existing `getByLabelText` lines, add:

1. Every label in the form has a control: `const labels = Array.from(document.querySelectorAll('form label')); expect(labels).toHaveLength(3); for (const label of labels) expect((label as HTMLLabelElement).control).not.toBeNull();`. Today the form has five labels and `control` is `null` for Currency (`AddWalletForm.tsx:126`) and Color (`:152`), so `toHaveLength(3)` fails (5 vs 3). After the fix only Wallet Name, Type and Starting Balance remain.
2. The swatches sit in a named group: `const group = screen.getByRole('group', { name: 'Color' }); expect(within(group).getAllByRole('button')).toHaveLength(IDENTITY_COLORS.length);` and `expect(within(group).getAllByRole('button', { pressed: true })).toHaveLength(1);` (the default colour). Today `getByRole('group', { name: 'Color' })` throws "Unable to find an accessible element with the role group" (`:154` has no role).
3. Currency is still shown and keeps its id: `expect(document.getElementById('wallet-new-currency')?.textContent).toBe('THB (฿)');` (passes today and after; guards the id the spec sets out to keep). Use `APP_CURRENCY` and `APP_CURRENCY_SYMBOL` from `../src/utils/currency` if the literal glyph is awkward in the file.

Red run (stage 02 step 4): the source change and the test are separate files. Write the test first, run `npx vitest run unit/wallets-page.test.tsx` against the unfixed `AddWalletForm.tsx`, save the output to `workflow/stages/02_build/output/logs/T820-red.log`, and confirm the failure is the expected one (the `toHaveLength` 5 vs 3 on the labels, and, if that line is moved after the group lookup, the missing group role), not a syntax or import error. Then apply the fix. The reviewer repeats this by stashing `src/components/wallet/AddWalletForm.tsx` only.

No Playwright spec is added: the repo's pattern for T768's label association is a `getByLabelText` unit test, and there is nothing a browser run catches that jsdom does not here.

## 8. Gates

Changed paths are `src/components/` and `unit/`, plus docs. Run, in order:

1. `npm run lint`
2. `npx vitest run unit/wallets-page.test.tsx unit/dom-id-convention.test.ts unit/dialog-names.test.tsx`
3. `npm run test:unit` (save the full output to `workflow/stages/02_build/output/logs/T820-unit.log`; expect 72 files, 1601 tests)
4. Check ports 3000 and 3100 for stale dev servers, then the specs that open this form: `npx playwright test tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/soft-delete.spec.ts tests/account-and-mobile-nav.spec.ts tests/ios-field-zoom.spec.ts --project=chromium`, then the same five files without `--project`. Do not edit `src/` while it runs. Save the unfiltered run to `workflow/stages/02_build/output/logs/T820-e2e.log`.
5. Bundle figures for `baseline-metrics.md`: with the repo's `.env` present, `npm run clean`, `npm run build`, then record the entry chunk, all app JS and CSS raw and gzip sizes as the "How to measure" block describes. `AddWalletForm` loads with the lazy `AddWalletModal`, so the entry chunk is expected to be unchanged.
6. Docs checks: count U+2014 in the added lines with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('—').length-1)"` (expect 0); line endings kept with `git ls-files --eol src/components/wallet/AddWalletForm.tsx unit/wallets-page.test.tsx docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md` (each `w/crlf` as before the edit); `git status --porcelain` shows only the target files, the ledger and `workflow/stages/*/output/` files.

## 9. Production touch points

None. No SQL, no `/api/*` request, no workflow or `vercel.json` change, no dependency.

## 10. Bookkeeping the builder writes

- `docs/audit/task-ledger.md`: add `## Phase 152 - Add Wallet form labels name real controls (accessibility, no ADR)` above `## Backlog`, with `Branch \`phase-152-wallet-form-labels\`, cut from \`main\` at \`2e18134\`. No migration.` and the T820 row (Files: the four target files plus the ledger; Status `done`; Commit cell `<sha>` placeholder; Gate result as in the house style). Set the Backlog row at `:78` Status to `done in Phase 152 (T820)`.
- `docs/audit/refactor-log.md`: one Phase 152 entry above Phase 151, in the template's headings. Replace the `ADR` line's number with "No ADR (accessibility fix, as Phase 136)". `Surprises` and `Deliberately not done` both present. Deliberately not done: a `<fieldset>`; a Playwright spec; changes to `WalletDetail.tsx`; filling the `<sha>` placeholders (done in the closing docs commit, as Phase 151 did).
- `docs/audit/baseline-metrics.md`: a `### Phase 152 - delta against Phase 151` section at the top of Figures, with the bundle figures from gate 5, Vitest 72 files, 1601 tests (+0), and Playwright unchanged at 213 tests in 37 files, 639 runs (the five specs above were run, not the full suite).

## 11. Out of scope

- `src/components/wallet/WalletDetail.tsx` (its Color already uses `fieldset`/`legend`; do not unify the two patterns), `src/components/category/ColorGrid.tsx`, `AddWalletModal.tsx`, `walletFormStyles.ts`.
- `AddWalletFormIds`, any element id, and `docs/audit/test-selector-contract.md`.
- Making Currency a real control (a disabled `<select>` or `readOnly` input) or adding a new currency: THB only.
- Any other label in the repo; any visual or spacing change.
- Any Playwright spec edit.
