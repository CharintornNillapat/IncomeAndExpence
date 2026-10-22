# Review: T794

## Round 1

**Metadata:** task T794, date 2026-10-22, round 1, verdict **APPROVED**. Branch `phase-143-paper-ledger-light-theme`, base `c702aef`. Targets: the 12 files in spec section 2 (ADR 0103, `src/index.css`, four components, `WalletTransferForm.tsx`, `scripts/wcag-tokens.mjs`, `unit/theme-tokens.test.ts`, `DESIGN.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/task-ledger.md`). `git check-ignore -v` on the targets printed nothing: none is ignored.

**Summary:** Five theme variables (`hero-line`, `segment-active`, `mood-tile`, `mood-empty`, `wallet-fallback`) are added to `:root`, `.dark` and `@theme inline`. Four components and `WalletTransferForm` swap one class each; the wallet tile's `#a8a29e` becomes `bg-wallet-fallback`, with the inline colour applied only when `wallet.color` is set. The WCAG script, ADR amendment, DESIGN.md, context doc, ledger row and three tests follow the spec.

**Invariants and parity:**
- Parity map: no row touched (no type field, id, SQL, `vercel.json`, `index.html`, workflow file).
- D6 dark byte-identical: `git diff HEAD -- src/index.css` has 0 removed lines; the five `.dark` values equal the resolved values of the classes they replace (`#1F2532`, `#262B3A`, `#0F131B`, `#2A3140`, `#A8A29E`); the new test asserts it.
- Component edits are class-string only. Full text of the changed `WalletTransferForm` tile read: an inline `backgroundColor` beats the class, an empty or missing colour gives `style={undefined}`, so behaviour is unchanged; `wallet.color` stays a plain read for T795. The diff does not touch `LeftOverCard.tsx:135` or the `Inset` hint in `MoodSpendingCard.tsx`.
- `control-active` is still used elsewhere (OverflowMenu, Button secondary); the DESIGN.md Tokens table relabels it "Hover shade, menu item hover".
- `wcag-tokens.mjs`: `income-text`, `pending-text`, `transfer-text` not added on any new token; `white on wallet-fallback` is light-only; the dark 2.52:1 is recorded in the ADR amendment.
- ADR amendment: D1 to D8 unedited (the diff is a pure append), status unchanged.
- CRLF: `git ls-files --eol` shows `w/crlf` for every changed file, before and after the stash pop.
- Em dashes: 0 in added lines of `git diff -U0 HEAD`; 0 in the build report.
- Scope: `git status --porcelain` lists only the 12 spec files plus the T794 spec and build reports (bookkeeping). No unannounced change.

**Gates run (logs in `workflow/stages/03_review/output/logs/`):**
- Red check: `git stash push -- src/index.css src/components scripts/wcag-tokens.mjs`, then `npx vitest run unit/theme-tokens.test.ts`: 1 file failed, 3 failed, 4 passed (7). The failures are the three new tests (`--hero-line` undefined; `border-hero-line` missing; `bg-wallet-fallback` missing). `git stash pop --index` restored; `git status --porcelain` identical before and after. Log: `T794-red.log`.
- `npx vitest run unit/theme-tokens.test.ts`: 1 file, 7 passed, 0 failed.
- `node scripts/wcag-tokens.mjs`: exit 0, "All token pairs pass."
- `npm run lint`: exit 0.
- `npm run test:unit`: 65 files, 1472 passed, 0 failed, 0 skipped. Log: `T794-unit.log`.
- Playwright chromium on theme, dashboard, diary-page, diary, wallet-forms, transfer-preview, layout-stability: 35 passed. Log: `T794-pw-chromium.log`.
- `npx playwright test` (all, three browsers, 35 specs): 531 passed, 6 skipped, 0 failed (8.0m). Log: `T794-pw-all.log`. Ports 3000 and 3100 were free beforehand.

**Not verified:** Light-mode appearance by eye (no screenshot compare; only token values, contrast script and e2e). No file was left out of the stash (all `w/crlf`, and stash pop kept CRLF).

**Blocking:** none.

**Non-blocking:**
- `LeftOverCard.tsx` doc comment line (about 190 characters) is long; fine to leave.
- The test `not.toContain('bg-brand-tint border border-line ')` depends on the exact class order; harmless, and `border-hero-line` is asserted too.

**Rule candidates:** none.
