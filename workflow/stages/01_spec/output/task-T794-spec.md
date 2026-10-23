# T794 spec: re-point components to Paper Ledger section 3 where dark stays unchanged; replace the `#a8a29e` fallback

Phase 143 (`phase-143-paper-ledger-light-theme`). Settles ADR 0103 D6. Size: 4 components plus `src/index.css`, under the 8-component limit, so no split.

## 1. Goal

Make four components match section 3 of `docs/design/finlife-light-theme.md` in light mode with the dark appearance byte-identical: the Left over card's border, the selected segment, the Mood and spending day tile and its empty bars. Replace the `#a8a29e` fallback in `WalletTransferForm.tsx` with a theme token. Each mismatch that cannot be fixed under D6 is settled here as "stays" so T796 can list it.

## 2. Target files

The builder may change only these (plus bookkeeping files, which need no listing). Files are CRLF on disk (`git ls-files --eol` shows `w/crlf`); keep CRLF.

```
docs/audit/decisions/0103-paper-ledger-light-theme.md
src/index.css
src/components/dashboard/LeftOverCard.tsx
src/components/dashboard/MoodSpendingCard.tsx
src/components/diary/MoodMeter.tsx
src/components/ui/SegmentedControl.tsx
src/components/wallet/WalletTransferForm.tsx
scripts/wcag-tokens.mjs
unit/theme-tokens.test.ts
DESIGN.md
docs/contexts/ui-and-e2e.md
docs/audit/task-ledger.md
```

No new ADR number: the decisions below are an amendment appended to ADR 0103 (the builder writes it first, before any code, as the T792 amendment did). `docs/audit/refactor-log.md` and `baseline-metrics.md` belong to T796. `AGENTS.md`'s test counts are T796's too.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (token rules, `ui/` primitives, Playwright rules; its line 7 is edited by this task).
- `DESIGN.md` sections "Tokens" (lines 34 to 54), "Light palette: Paper Ledger" (62 to 89) and the component table rows 183 and 187.
- `docs/audit/decisions/0103-paper-ledger-light-theme.md` D3b, D4, D6.
- No `client-state`, `supabase-ledger` or `api-proxies` context: no state, ledger or API change.

## 4. Current behaviour and the settlement of every mapping

Section 3 of the design file, row by row, against the code (2026-10-22). "OK" means the component already resolves to the file's token or an ADR 0103 D2/D4 equivalent in light.

| Section 3 row | Code today | Verdict |
|---|---|---|
| Top nav `--surface` bg, `--border` bottom border | `Navbar.tsx:97` `bg-header border-b border-line` | OK |
| Active tab `accent-tint` bg + `accent` text | `Navbar.tsx:142` `bg-brand-soft text-brand-soft-text` | OK (weight stays `font-medium`: ADR 0103 D6, typography) |
| Inactive tabs `text-muted` | `Navbar.tsx:143` `text-fg-secondary` | **Stays.** `fg-secondary` is the step ADR D4 added between `text` and `text-muted`; dark `#A3AABB` vs `fg-muted` `#8A93A6` would change, and a new token would only re-state `fg-muted` for one control |
| Add entry `accent` bg, hover `accent-hover` | `Button.tsx:30` `bg-brand-fill hover:bg-brand-fill-hover text-white` | OK |
| Period switcher `--surface` container + `--border` | `SegmentedControl.tsx:77` `bg-surface-1 ... border-line` | OK |
| Period switcher selected segment `--surface-2` bg + `--text` | `SegmentedControl.tsx:105` `bg-control-active` (`#E6E0D5` light, `#262B3A` dark); label `text-fg font-bold` | **Change (new token `segment-active`)**: `surface-2` would turn dark `#262B3A` into `#0F131B` |
| Hero card `accent-tint` bg | `LeftOverCard.tsx:93` `bg-brand-tint` | OK |
| Hero card `accent-tint-border` border | `LeftOverCard.tsx:93` `border-line` (`#E0D8CB` light, `#1F2532` dark); comment at `:70` says the edge stays neutral | **Change (new token `hero-line`)**: `brand-line` is translucent violet in dark, which would change it; this is the one card-edge exception (DESIGN.md line 30, ADR D6) |
| Sparkline stroke `accent` | `LeftOverCard.tsx:58` `stroke-brand` | OK |
| Spent `expense`, Kept `accent` | `LeftOverCard.tsx:136-137` `bg-expense-fill`, `bg-brand-fill` | OK |
| Income / Spending cards `surface`, `income` / `expense` amounts | `CashFlowCard.tsx` `Card`, `text-income` / `text-expense` | OK |
| Donut hole `surface`; comparison box `surface-2` | `CategorySpendingCard.tsx:114,169` `Card` / `Inset` | OK |
| Debt payoff % and fill `income` | `DebtPayoffCard.tsx` `text-income`, `ProgressBar tone="income"` | OK |
| Debt payoff track `surface-2` | `ProgressBar.tsx:59` `bg-line` | **Stays.** `DebtPayoffCard.tsx:72-77` puts a `ProgressBar` inside an `Inset` (`surface-2`): a `surface-2` track would be the same colour as its ground (1.00:1) and vanish in light; and in dark `surface-2` `#0F131B` is darker than `line` `#1F2532`, a dark change. The file's own box for this is `surface-2`, so its literal rule cannot hold for those rows. The Spent/Kept gap track at `LeftOverCard.tsx:135` (`bg-line`) is not a progress track in the file and also stays |
| "Needed this month" `bg` or `surface-2`, amount `expense` | `DebtPayoffCard.tsx` `Inset` + `text-expense` | OK (`surface-2`, which the file allows) |
| Negative debt balance `expense` | `DebtPayoffCard.tsx` `text-expense` | OK |
| "Make a repayment" outline: transparent bg, `accent` border and text | `DebtPayoffCard.tsx:95` `Button variant="soft"` (`brand-soft` fill, `brand-soft-line` edge) | **Stays.** An outline needs a per-button variant and two more tokens (transparent fill; edge `brand-text` in light, `brand-soft-line` in dark), and `soft` is shared by Log today and other buttons. Goes in T796 "Deliberately not done" |
| Date header rows `surface-2` | `DayGroupHeader.tsx:25` `bg-surface-2` | OK |
| Expense / transfer icon tile at ~10% tint | `txTypeMeta.ts` `bg-expense-tint text-expense`, `bg-transfer-tint text-transfer` | OK (8% solid tint, ADR D4) |
| Category chips `surface-2` + dot | `Chip.tsx` `bg-adjust-tint` (`#EEE9E0` light) | OK |
| Debt figure `expense` | `WalletsSection.tsx:61` | OK |
| Mood day tiles `--bg` | `MoodSpendingCard.tsx:50` `bg-surface-2` | **Change (new token `mood-tile`)**: `canvas` `#0B0E14` would change dark `#0F131B` |
| Filled mood dots `accent` | `MoodMeter.tsx:12` `bg-brand` | OK |
| Empty mood dots `--border` | `MoodMeter.tsx:12` `bg-line-strong` (`#CFC5B4` light, `#2A3140` dark) | **Change (new token `mood-empty`)**: `line` is `#1F2532` in dark |
| Mood amounts `expense`, 0 in `text-muted` | `MoodSpendingCard.tsx:56` `text-expense` / `text-fg-muted` | OK |
| Links `accent`, hover `accent-hover` | `DashboardLink.tsx:15` `text-brand hover:underline` | **Stays.** The file wants a colour change on hover; the app shows an underline only. Adding a hover colour is new behaviour, not a re-point, and `brand-fill-hover` as text would be `#6D28D9` on dark `#131722`, under 4.5:1. T796 "Deliberately not done" |
| (ADR D6) `WalletTransferForm.tsx:108` | `style={{ backgroundColor: wallet?.color || '#a8a29e' }}` on a `text-white` icon tile | **Change (new token `wallet-fallback`)** |

## 5. Decisions

### 5.1 Five theme variables, no other change to `index.css`

Add the five to `:root` and `.dark` (after `transfer-line`, same layout as the existing lines) and map them in `@theme inline` as `--color-<name>: var(--<name>);`. Each dark value is today's resolved dark value of the class it replaces, so dark does not move; each light value is the design file's.

| Variable | Class | Dark (today's value) | Light | Replaces | Light value source |
|---|---|---|---|---|---|
| `hero-line` | `border-hero-line` | `#1F2532` (`line`) | `#D9D2F5` | `border-line` on the Left over card | `--accent-tint-border` |
| `segment-active` | `bg-segment-active` | `#262B3A` (`control-active`) | `#EEE9E0` | `bg-control-active` on the pill | `--surface-2` |
| `mood-tile` | `bg-mood-tile` | `#0F131B` (`surface-2`) | `#F5F2EC` | `bg-surface-2` on a day tile | `--bg` |
| `mood-empty` | `bg-mood-empty` | `#2A3140` (`line-strong`) | `#E0D8CB` | `bg-line-strong` on an empty bar | `--border` |
| `wallet-fallback` | `bg-wallet-fallback` | `#A8A29E` (the hex now in the JSX) | `#8A8172` (`line-input`'s light value) | the `'#a8a29e'` fallback | derived: white icon on it is 3.84:1 (3:1 needed for a non-text icon) |

`control-active` stays as the hover shade for `OverflowMenu` and `Button` (`secondary`). The selected pill and the hover shade are now two tokens that are equal in dark and one step apart in light (`#EEE9E0` against `#E6E0D5`), as the file has no hover shade.

### 5.2 Component edits (class strings only)

- `LeftOverCard.tsx:93`: `border-line` becomes `border-hero-line`. Rewrite the comment at `:70` ("the edge stays the neutral `line`") to say the edge is `hero-line`, the page's one card-edge exception, and that the Spent/Kept track stays `line`. Do not touch `:135`.
- `SegmentedControl.tsx:105`: `bg-control-active` becomes `bg-segment-active`. Fix the doc comment at `:51` (`control-active` to `segment-active`). The label classes stay.
- `MoodSpendingCard.tsx:50`: `bg-surface-2` becomes `bg-mood-tile` on the day `<li>` only. Leave the `Inset` hint at `:63` as it is.
- `MoodMeter.tsx:12`: `bg-line-strong` becomes `bg-mood-empty`.
- `WalletTransferForm.tsx:105-108`: the icon tile `<div>` gets `bg-wallet-fallback` in its `className`, and its `style` becomes `wallet?.color ? { backgroundColor: wallet.color } : undefined`. Behaviour is identical: an empty or missing colour fell back before, and an inline colour beats the class. Keep the `wallet.color` expression a plain `wallet.color` read so T795 can wrap it in `identityDisplayColor` with a one-line change. No other hex may remain in the file.

### 5.3 `scripts/wcag-tokens.mjs`

1. Replace the mood-meter pair at `:89-90` with `brand-text vs mood-empty (mood meter)` at 3:1 (light about 5.6, dark equals today's `line-strong` pair).
2. In the per-theme loop add `fg on segment-active` at 4.5 (light 14.31 as `surface-2`; dark as `control-active`).
3. Add `fg-muted on mood-tile` and `expense-text on mood-tile` at 4.5 (light on `#F5F2EC`: 5.63 and 5.38 from the ADR table; dark on `#0F131B`, today's `surface-2`).
4. Under `if (theme === 'light')` add `white on wallet-fallback` at 3 (3.84). Do not add it for dark: white on `#A8A29E` is 2.52:1, a pre-existing figure that D6 keeps; the builder records it in the ADR amendment as known and unchanged.
5. `income-text`, `pending-text` and `transfer-text` must not be added on any new token; none of the five hosts them.

### 5.4 Docs

- **ADR 0103:** append "Amendment (T794)" with the section 4 verdicts (the five "Change" rows and the "Stays" rows with their reasons), the five-token table, and the recorded 2.52:1 dark figure. Do not edit D1 to D8. Status stays Accepted.
- **DESIGN.md:** line 30 (add the Left over card as the one exception, `hero-line`); line 32 and line 183 (a segmented control uses `segment-active`); the Tokens table (add five rows, Dark and Light columns as in 5.1; change line 44's label to "Hover shade, menu item hover" if the builder keeps `control-active` there, else leave it); line 212 (the Left over card's edge is `hero-line`). Line 45 and line 187 (the `line` track) stay true, so do not edit them. Update the "Light palette" table's note if it lists the segment.
- **`docs/contexts/ui-and-e2e.md` line 7:** add the five classes to the token list (`border-hero-line`, `bg-segment-active`, `bg-mood-tile`, `bg-mood-empty`, `bg-wallet-fallback`) and nothing else.
- **`docs/audit/task-ledger.md`:** the builder keeps the T794 row: Files = the targets actually changed, Status `done`, Notes = gates run. This order names no Backlog row.

## 6. Parity map

None of the AGENTS.md parity rows apply (no type field, no id, no `vercel.json`, no SQL). The ADR 0103 D6 rule (dark byte-identical) is guarded by the new test below.

## 7. Tests to add

All in `unit/theme-tokens.test.ts` (node environment, reads `src/index.css` and component sources; no new file, no render). Source-text assertions are the right level because the whole change is a class string and a token value.

1. **`defines the five T794 tokens ...`**: for each of the five names, `:root` has the table's light value, `.dark` has the table's dark value, and `@theme inline` has `color-<name>` equal to `var(--<name>)`. Also assert the D6 invariant: `dark['hero-line'] === dark['line']`, `dark['segment-active'] === dark['control-active']`, `dark['mood-tile'] === dark['surface-2']`, `dark['mood-empty'] === dark['line-strong']`, and `dark['wallet-fallback'] === '#A8A29E'`. Fails today: the tokens are missing (`undefined`).
2. **`points the four components at the new tokens`**: read each source file and assert `LeftOverCard.tsx` contains `border-hero-line` and does not contain `bg-brand-tint border border-line `; `SegmentedControl.tsx` contains `bg-segment-active` and not `bg-control-active`; `MoodSpendingCard.tsx` contains `bg-mood-tile`; `MoodMeter.tsx` contains `bg-mood-empty` and not `bg-line-strong`. Fails today on `LeftOverCard.tsx:93`, `SegmentedControl.tsx:105`, `MoodSpendingCard.tsx:50`, `MoodMeter.tsx:12`.
3. **`has no hard-coded fallback hex in WalletTransferForm`**: the source has `bg-wallet-fallback`, and matches no `#[0-9a-fA-F]{3,8}\b`. Fails today on `WalletTransferForm.tsx:108`.

Red gate (money path rule does not apply; this is UI, but the project rule is test-first for behaviour changes): add the three tests first, run `npx vitest run unit/theme-tokens.test.ts`, save the failure to `workflow/stages/02_build/output/logs/T794-red.log` (expect the three new tests red, the four existing green), then make the changes. The reviewer repeats it with `git stash push -- src/index.css src/components scripts/wcag-tokens.mjs` (keeping the new tests) and sees the same three fail.

Existing unit tests assert none of the changed classes (checked: no hit for `control-active`, `line-strong`, `border-line` on these components in `unit/` or `tests/`), so none should need editing. If one does, report it.

## 8. Gates

Changed paths: `src/components/`, `src/index.css`, `scripts/`, `unit/`, `docs`. Run, and save the full unit and Playwright output under `workflow/stages/02_build/output/logs/`:

```
npx vitest run unit/theme-tokens.test.ts
node scripts/wcag-tokens.mjs
npm run lint
npm run test:unit
npx playwright test tests/theme.spec.ts tests/dashboard.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/layout-stability.spec.ts --project=chromium
npx playwright test
```

`npx playwright test` is the unfiltered run on all three browsers; it is required (not just the named specs) because `SegmentedControl` is used by the period filter, the transaction type toggle, the auth tabs and the categories forms. Before Playwright check ports 3000 and 3100 for stale dev servers, and do not edit `src/` while it runs. `unit/security-headers.test.ts` is not needed (`index.html` and `vercel.json` untouched).

Extra checks:

```
git diff --stat HEAD
git ls-files --eol DESIGN.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0103-paper-ledger-light-theme.md src/index.css scripts/wcag-tokens.mjs unit/theme-tokens.test.ts src/components/dashboard/LeftOverCard.tsx src/components/dashboard/MoodSpendingCard.tsx src/components/diary/MoodMeter.tsx src/components/ui/SegmentedControl.tsx src/components/wallet/WalletTransferForm.tsx
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
```

Expected: the diff names only the section 2 files (plus the T794 test and log paths); every listed file stays `w/crlf`; 0 em dashes in added lines. Also confirm by hand that every `.dark` value in `src/index.css` above the new five is unchanged (`git diff HEAD -- src/index.css` shows additions only in `.dark`, no changed line).

## 9. Production touch points

None. No SQL, no `/api/*`, no deploy, no dependency, no `vercel.json`, no workflow file. The Playwright run uses the hermetic dev server.

## 10. Out of scope

- Identity and category display colours, `identityDisplayColor()`, `--identity-N`, the `wallet.color` wrapping (T795; leave `wallet.color` as a plain read).
- The closing docs: `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, AGENTS.md and README test counts (T796). T796 lists these under "Deliberately not done": the progress track and Spent/Kept track staying `line`, the inactive-tab colour staying `fg-secondary`, the repayment outline, the link hover colour, the active-tab weight.
- Any change to a `.dark` value, `Button`, `ProgressBar`, `Navbar`, `DashboardLink`, `DebtPayoffCard`, `OverflowMenu`, `index.html` `theme-color`, or the manifest colours.
- Any `dark:` twin on a token, any new hex in a component, a `[data-theme]` selector, a layout, spacing, radius or typography change.
- Placing `income-text`, `pending-text` or `transfer-text` on `surface-3`, `control-active` or any new token.
