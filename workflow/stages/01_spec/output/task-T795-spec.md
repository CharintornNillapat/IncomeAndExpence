# T795 spec: light-mode identity colours (ADR 0103 D7)

Branch `phase-143-paper-ledger-light-theme`, after `c5c2358` (T794). No Backlog row. The task-ledger row T795 already exists (status `todo`); the builder sets it to `done` with the commit left blank for the orchestrator, as T793 and T794 did.

## 1. Goal

In light mode a stored category or wallet colour paints as its Paper Ledger value, in dark mode it paints exactly as stored, and a colour outside the twelve paints as stored in both. It is done with twelve CSS variables `--identity-1..12` and `identityDisplayColor()`, called at every paint site; the stored hex, `IDENTITY_PALETTE`, the migration helper, SQL and dark mode do not change.

## 2. Target files

The builder may change only these (plus bookkeeping files). Write the ADR amendment first, before any code.

- `docs/audit/decisions/0103-paper-ledger-light-theme.md` (append `## Amendment (T795)`, see section 3)
- `src/utils/identityPalette.ts`
- `src/index.css`
- `src/components/ui/Chip.tsx`
- `src/components/ui/AllocationBar.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/components/dashboard/CategorySpendingCard.tsx`
- `src/components/dashboard/WalletsSection.tsx`
- `src/components/wallet/WalletList.tsx`
- `src/components/wallet/WalletDetail.tsx`
- `src/components/wallet/AddWalletForm.tsx`
- `src/components/wallet/WalletTransferForm.tsx`
- `src/components/category/CategoryList.tsx`
- `src/components/category/ColorGrid.tsx`
- `unit/identity-display.test.ts` (new)
- `unit/categories-page.test.tsx`
- `unit/tx-row.test.tsx`
- `unit/ui-display.test.tsx`
- `unit/wallets-page.test.tsx`
- `tests/dashboard.spec.ts`
- `docs/contexts/ui-and-e2e.md`
- `docs/audit/task-ledger.md` (the T795 row; bookkeeping)

Not targets, deliberately: `src/context/FinanceContext.tsx`, `supabase/`, `src/utils/identityColorMigration.ts`, `src/selectors/`, `src/components/dashboard/LeftOverCard.tsx` (it has no stored-colour paint site, see section 4), `src/components/transaction/TransactionRow.tsx`, `TransactionDrawer.tsx` and `src/components/category/SmartRulesPanel.tsx` (they pass the raw colour into `Chip`, which converts it). This task touches no file on the automatic-pause list.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (styling rules, the exemption at line 8 that this task narrows, Playwright rules). `DESIGN.md` is not needed; ADR 0103 D7 already amends it.
- `docs/audit/decisions/0103-paper-ledger-light-theme.md` D7 (the twelve values) and the Amendment (T794) as the format to follow.
- No `client-state.md`: nothing here is a money, date or selector rule.

The Amendment (T795) in ADR 0103 records: the paint-site list of section 4, the picker decision (D-a), the SVG decision (D-b) and the guard.

## 4. Current behaviour

`identityPalette.ts` holds `IDENTITY_PALETTE` (12 `{hex, name}`, lines 8-21), `IDENTITY_COLORS` (23), `identityColorName` (26), `isIdentityColor` (32). No `--identity-*` variable and no `identityDisplayColor` exist. `:root` (`src/index.css:170-225`) and `.dark` (`227-281`) end with `--wallet-fallback`.

Every site that paints a stored category or wallet colour today, from a repo-wide search of `backgroundColor`, `color-mix`, `stroke=`, `.color` and `color=` in `src/` (2026-10-23), written as raw value into `style` or an SVG attribute:

| # | Site | What it paints | Fix |
|---|---|---|---|
| 1 | `components/ui/Chip.tsx:37` | the 7 px dot, `backgroundColor: color` | wrap in `Chip`; covers `TransactionRow.tsx:60,91`, `TransactionDrawer.tsx:113`, `SmartRulesPanel.tsx:177-179` unchanged |
| 2 | `components/ui/AllocationBar.tsx:48` | each segment, `backgroundColor: s.color` | wrap in `AllocationBar`; covers `WalletList.tsx:53-60` and `WalletsSection.tsx:94-101` unchanged |
| 3 | `components/ui/ProgressBar.tsx:63` | the fill when `color` is given (no caller passes it today) | wrap, so the guard needs no exception |
| 4 | `components/dashboard/CategorySpendingCard.tsx:61` | donut ring, SVG attribute `stroke={s.color}` | see D-b |
| 5 | `components/dashboard/CategorySpendingCard.tsx:141` | row dot | wrap |
| 6 | `components/dashboard/WalletsSection.tsx:120` | wallet tile, `color-mix(... ${wallet.color} 18% ...)` and `color: wallet.color` | wrap both uses |
| 7 | `components/wallet/WalletList.tsx:87` | same tile pair | wrap both uses |
| 8 | `components/wallet/WalletDetail.tsx:146` | same tile pair | wrap both uses |
| 9 | `components/wallet/WalletDetail.tsx:227` | picker swatch | D-a |
| 10 | `components/wallet/AddWalletForm.tsx:167` | picker swatch | D-a |
| 11 | `components/wallet/WalletTransferForm.tsx:108` | the From and To tile, `backgroundColor: wallet.color` (T794 left it a plain read; its fallback is already `bg-wallet-fallback`) | wrap |
| 12 | `components/category/CategoryList.tsx:64` | row dot | wrap |
| 13 | `components/category/ColorGrid.tsx:62` | picker swatch of a used (blocked) colour at 0.25 opacity | D-a |
| 14 | `components/category/ColorGrid.tsx:66` | picker swatch | D-a |
| 15 | `components/category/ColorGrid.tsx:86` | the "Custom color" swatch (`currentColor`, never one of the twelve) | wrap for uniformity; returns the value unchanged |

Two more lines paint `SYSTEM_CATEGORY_COLOR` (`#6B7385`, not one of the twelve, so it renders as stored in both themes): `CategorySpendingCard.tsx:157` and `CategoryList.tsx:89`. Leave them as they are; the guard allows a line that names `SYSTEM_CATEGORY_COLOR`.

Not paint sites, checked: `LeftOverCard.tsx` (the order named it; it contains no `color` at all, T794's tokens are all it uses), `MoodSpendingCard.tsx`, `DebtPayoffCard.tsx`, `CategoryForm.tsx` (holds a colour in state, paints through `ColorGrid`), `CategoriesView.tsx`, `selectors/categories.ts:15,39` (map keys), `selectors/ledger.ts:193`, `FinanceContext.tsx`. No `.tsx` exists outside `src/` and `unit/`.

Existing tests that assert the stored hex as an inline value, which this task changes (jsdom keeps `var(--identity-4)` verbatim in `style.backgroundColor`, `style.color` and an SVG attribute, checked 2026-10-23):

- `unit/categories-page.test.tsx:201` (custom `#0ea5e9`: unchanged), `:259` (Tan), `:384-388`, `:389` (`#6B7385`: unchanged), `:400-402`, `:409`.
- `unit/tx-row.test.tsx:124`.
- `unit/ui-display.test.tsx:26, 63, 80`.
- `unit/wallets-page.test.tsx:303, 311, 368-370, 385-389`.

## 5. Parity map

- `utils/identityColorMigration.ts` against `20261002_phase63_identity_colors.sql`: touched only through `IDENTITY_PALETTE`, whose values do not change. Guarded by `unit/identity-color-migration.test.ts`, which must stay green and unedited.
- Spec-asserted DOM ids against `docs/audit/test-selector-contract.md`: the swatch ids (`{idPrefix}-color-{hex without #}`) keep deriving from the stored hex. No id changes.
- Nothing else on the map is touched. `FinanceContext.tsx`'s guest starter set and `seed_starter_account()` are not touched (stored hexes unchanged).

## 6. Design decisions (the builder makes none)

**D-a. Picker swatches show the display colour.** `ColorGrid.tsx:62,66`, `WalletDetail.tsx:227` and `AddWalletForm.tsx:167` paint `identityDisplayColor(hex)`. Why: a swatch is a preview of what the item will look like; in light mode a picker that shows pastel Peach `#F59E6B` while the saved wallet then paints `#D97706` would show a colour the user never gets. The value the picker saves is untouched: `onChange(hex)`, `setDraft({ color })`, `setWalletColor(c)`, the `aria-pressed` comparisons, `key`, the id suffix and `identityColorName` all keep the stored hex. The ring-offset selected style is unchanged.

**D-b. The donut ring uses `style`, not the SVG attribute.** Replace `stroke={s.color}` (`CategorySpendingCard.tsx:61`) with `style={{ stroke: identityDisplayColor(s.color) }}`. ADR 0103 D7 said to check `stroke` as an attribute in a browser and fall back to `style` if it did not take `var()`. A `style` property is the form every engine resolves; choosing it now saves the gamble and the Playwright test in section 7 still proves it on three browsers. Keep `strokeDasharray` and `strokeDashoffset` as attributes (`unit/dashboard.test.tsx:804` reads `stroke-dasharray`).

**D-c. Conversion lives in the shared primitives where one exists** (`Chip`, `AllocationBar`, `ProgressBar`), so their callers do not change. `identityDisplayColor` is idempotent (`var(--identity-N)` is not a palette hex, so it comes back unchanged), so a caller that already converted is harmless.

**D-d. Sign, not colour.** No change to income and expense: they stay told apart by `+` and the `−` U+2212 and by their tokens. Identity colours only name a category or wallet next to its text.

## 7. Implementation

**`src/utils/identityPalette.ts`**: add, after `isIdentityColor`:

```ts
/**
 * The colour to paint for a stored category or wallet colour (ADR 0103 D7). A
 * palette hex becomes `var(--identity-N)`, N its 1-based place in `IDENTITY_PALETTE`:
 * the variable holds the stored hex in dark and the Paper Ledger value in light.
 * Anything else (`#6B7385`, a legacy hex, `'stone'`) comes back unchanged.
 * Compared case-insensitively. Never store the result.
 */
export function identityDisplayColor(color: string): string {
  const i = IDENTITY_COLORS.findIndex((hex) => hex.toLowerCase() === color.toLowerCase());
  return i === -1 ? color : `var(--identity-${i + 1})`;
}
```

Update the file's header comment: it says none of the twelve is blue, cyan or amber; add one sentence that in light mode they paint as the ADR 0103 D7 values (the stored values stay as listed).

**`src/index.css`**: append to the end of `:root` (after `--wallet-fallback`) the twelve light values, and to the end of `.dark` the twelve stored hexes. Use the ADR 0103 D7 table, with the casing below. Put one short comment above each group with no `{`, `}` or `;` and no `--name:` text in it (`unit/theme-tokens.test.ts` and `scripts/wcag-tokens.mjs` read these blocks with regexes).

| Variable | Name | `:root` (light) | `.dark` (stored) |
|---|---|---|---|
| `--identity-1` | Tan | `#A16207` | `#D9A066` |
| `--identity-2` | Blue | `#1E40AF` | `#6C8EEF` |
| `--identity-3` | Teal | `#0E7490` | `#4FB7A8` |
| `--identity-4` | Peach | `#D97706` | `#F59E6B` |
| `--identity-5` | Rose | `#DB2777` | `#E879A6` |
| `--identity-6` | Periwinkle | `#2563EB` | `#7DA2F0` |
| `--identity-7` | Lavender | `#7C3AED` | `#B69CF5` |
| `--identity-8` | Aqua | `#0891B2` | `#5CC8B8` |
| `--identity-9` | Khaki | `#8A6D46` | `#C7B38A` |
| `--identity-10` | Steel | `#5B7A9D` | `#8FA8C8` |
| `--identity-11` | Orchid | `#A21CAF` | `#D98FD0` |
| `--identity-12` | Iris | `#6B5FBF` | `#9C8CD9` |

Do not add them to `@theme inline` (no utility class uses them; they are read only through `var()`). Do not touch any existing variable.

**Components**: as the table in section 4, importing `identityDisplayColor` from `../../utils/identityPalette` (every component file is two folders under `src/`). For the tile pair write the call inline on the same line, for example `` `color-mix(in srgb, ${identityDisplayColor(wallet.color)} 18%, transparent)` `` and `color: identityDisplayColor(wallet.color)`, so the guard in section 8 can see it.

**`docs/contexts/ui-and-e2e.md`**: line 8 says data colours are exempt from the token rule. Narrow it: a wallet's or category's own `color` still stays outside the token classes, but it is painted only through `identityDisplayColor(color)` from `utils/identityPalette.ts` (a CSS variable in light, the stored hex in dark and for any colour outside the twelve), never raw, and `unit/identity-display.test.ts` guards it. T796 then only checks this line (it must not add a second copy). Do not touch the Playwright counts on lines 64 and elsewhere; T796 updates counts.

## 8. Tests to add

Run order (money-path style, applied here because the task changes every colour paint): create `unit/identity-display.test.ts` first, run `npx vitest run unit/identity-display.test.ts` against the unfixed code, save the failure to `workflow/stages/02_build/output/logs/T795-red.log`, then implement.

**`unit/identity-display.test.ts`** (new; Node environment is enough, no jsdom). Fails today because `identityDisplayColor` is not exported (every call is `undefined`/a TypeError) and the CSS has no `--identity-*`:

1. `identityDisplayColor` maps each of the twelve `IDENTITY_PALETTE` hexes to `var(--identity-N)` for N = index + 1; matches an upper-case and a lower-case spelling; returns `#6B7385`, `#0ea5e9`, `#16a34a`, `'stone'` and `''` unchanged; and returns `var(--identity-4)` unchanged (idempotent).
2. CSS parity, reading `src/index.css` with the `extractBlock` approach of `unit/theme-tokens.test.ts:5-14` (copy the small helper; do not edit that file): for N 1..12, `.dark` `--identity-N` equals `IDENTITY_PALETTE[N-1].hex` (so dark is pixel-identical to the stored colour), and `:root` `--identity-N` equals the light column of section 7 (hard-code the twelve, with the colour names in the test title or a comment).
3. The guard: walk every `.tsx` under `src/components` and `src/views`; for each line matching `/backgroundColor\s*:|color-mix\(|\b(stroke|fill)=\{|\bstyle=\{\{[^}]*\b(stroke|fill|color)\s*:/`, the line must contain `identityDisplayColor(` or `SYSTEM_CATEGORY_COLOR`. Report the offending `file:line` list in the assertion message. Also assert the scan matched at least 12 lines, so a broken pattern cannot pass vacuously. Today it reports the fifteen lines of section 4 (rows 1 to 15, with row 4 caught by the `stroke=` branch and `ColorGrid.tsx:62` and `:66` each counted).

**`tests/dashboard.spec.ts`** (add one `test.describe('Dashboard identity colours (ADR 0103 D7)')` with two tests, one per theme, reusing the file's `seedTestTransactions(page)`, `timezoneId: 'Asia/Bangkok'` and the fixed clock `2026-10-16T15:00:00+07:00` that the first describe uses). Each test sets the theme before load with `page.addInitScript(() => localStorage.setItem('finlife_theme_preference', '<light|dark>'))`, calls `page.goto('/')`, then asserts with `toHaveCSS` (a real browser resolves the variable, which jsdom cannot):

- the Main Checking tile: `#dashboard-wallet-card-wal-main-checking > span[aria-hidden="true"]`, property `color`: light `rgb(30, 64, 175)`, dark `rgb(108, 142, 239)`;
- the donut: `page.getByRole('img', { name: /^Spending by category/ }).locator('circle[stroke-dasharray]')`, `nth(0)` (Food & Dining, 2,500) and `nth(1)` (Groceries, 500), property `stroke`: light `rgb(219, 39, 119)` and `rgb(217, 119, 6)`, dark `rgb(232, 121, 166)` and `rgb(245, 158, 107)`.

If the seeded window puts a different pair first, the builder reads the donut's accessible name and orders the two assertions by it; the expected values per category stay as above. These tests are new, so they cannot be red against unfixed code in the stash sense; they fail there anyway (the circle has no `style`, the attribute stays the raw hex).

**Existing unit assertions rewritten** (same commit as the code; an assertion is kept and only its expected value changes, per the spec-edit policy; none is deleted or weakened). Mapping: Tan 1, Blue 2, Teal 3, Peach 4, Rose 5, Periwinkle 6, Lavender 7, Aqua 8, Khaki 9, Steel 10, Orchid 11, Iris 12.

- `unit/categories-page.test.tsx`: `:259` expects `var(--identity-1)`; `:384` `var(--identity-5)`, `:385` `var(--identity-4)`, `:386` `var(--identity-8)`, `:387` `var(--identity-10)`, `:388` `var(--identity-11)`; `:400` `var(--identity-1)`, `:401` `var(--identity-5)`; `:409` builds `identity` from `IDENTITY_PALETTE.map(({ hex }) => identityDisplayColor(hex))` (import it). `:201`, `:389` and `:402` stay on `rgb(...)`: custom and system colours render as stored. Keep the `rgb` helper (still used).
- `unit/tx-row.test.tsx:124`: `var(--identity-5)`.
- `unit/ui-display.test.tsx`: `:26` `var(--identity-5)`; `:63` `var(--identity-3)` and add, in the same test, a second render with `color="#0ea5e9"` expecting `rgb(14, 165, 233)`; `:80` `var(--identity-1)`.
- `unit/wallets-page.test.tsx`: `:303` compares to `IDENTITY.map(identityDisplayColor)` (import it; remove the `rgb` helper in that describe if it becomes unused, `noUnusedLocals` is on and `tsc` covers `unit/`); `:311` `var(--identity-5)`; `:368-370` `var(--identity-2)`, `var(--identity-1)`, `var(--identity-3)`; `:385` `var(--identity-2)`, `:386` `var(--identity-1)`, `:387` `var(--identity-3)`, `:388` `var(--identity-5)`; `:389` stays `rgb('#16a34a')`.

## 9. Gates

Run in this order and report each command with its result. Save full-suite output with `tee` to `workflow/stages/02_build/output/logs/` (gitignored). Before Playwright, check ports 3000 and 3100 for stale servers, and edit no `src/` file while it runs.

```
npm run lint
npx vitest run unit/identity-display.test.ts unit/theme-tokens.test.ts unit/identity-color-migration.test.ts unit/ui-display.test.tsx unit/tx-row.test.tsx unit/categories-page.test.tsx unit/wallets-page.test.tsx unit/dashboard.test.tsx
npm run test:unit
node scripts/wcag-tokens.mjs
npx playwright test tests/dashboard.spec.ts tests/theme.spec.ts tests/wallets-page.spec.ts tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/categories-page.spec.ts tests/categories.spec.ts tests/transaction.spec.ts tests/layout-stability.spec.ts tests/safe-area.spec.ts --project=chromium
npx playwright test tests/dashboard.spec.ts tests/theme.spec.ts tests/wallets-page.spec.ts tests/wallets.spec.ts tests/wallet-forms.spec.ts tests/categories-page.spec.ts tests/categories.spec.ts tests/transaction.spec.ts tests/layout-stability.spec.ts tests/safe-area.spec.ts
```

Additional checks:

- `git diff --stat` shows `src/utils/identityColorMigration.ts`, `src/context/`, `src/selectors/` and `supabase/` untouched.
- `git ls-files --eol` on every changed file shows `w/crlf` for the files that had it (the working tree is CRLF; the Edit tool must not turn a file to LF).
- Em dash count in the added lines is 0 (the Node one-liner in the stage file).
- `node scripts/wcag-tokens.mjs` still passes; no contrast pair is added (ADR 0103 D7 records the twelve ratios, including Peach 3.19 on white and 2.63 on `surface-2`, which stay as recorded).
- Open the dashboard once in light and dark in a real browser (screenshot not required) and confirm the wallet tiles, the donut and a Chip dot differ between themes. The Playwright tests above are the evidence the report cites.

The Playwright and unit counts in `AGENTS.md`, `README.md` and `ui-and-e2e.md` change with this task (unit +1 file and the new tests, Playwright +2 tests in an existing spec); the builder reports the new counts, T796 writes them.

## 10. Production touch points

None. No SQL, no live request, no workflow or `vercel.json` edit, no dependency. No push or commit by the builder.

## 11. Out of scope

- Rewriting any stored colour; touching `IDENTITY_PALETTE` values, `identityColorMigration.ts`, `FinanceContext.tsx`, the guest starter set, `supabase/`, or `selectors/`.
- Changing any dark-mode value or any token other than adding the twelve `--identity-N` pairs.
- Changing which colour `nextColor`, `usedColors` or `paletteExhausted` pick (they compare stored hexes).
- `SYSTEM_CATEGORY_COLOR` sites (`CategorySpendingCard.tsx:157`, `CategoryList.tsx:89`), `theme-color` and manifest colours, new `--cat-*` tokens, a `[data-theme]` selector.
- Wiring `identityDisplayColor` into CSV export, backup export or any non-visual output.
- Adding `LeftOverCard.tsx` or any other file not listed; if the builder finds a paint site the search missed, add it to the ADR amendment and the report, change it, and name it in the build report rather than waiting.
- `README.md`, `AGENTS.md` and `docs/audit/baseline-metrics.md` counts (T796).
