# 0027 — Redesign foundation: spec tokens, one Thai-capable face, meaning-coloured amounts, a one-row header

**Status:** Accepted.
- **Amends** ADR `0025`: token values, and the names and roles added below.
- **Supersedes parts of** ADR `0026`:
  - the mono identity motif and the self-hosted JetBrains Mono;
  - "an adjustment takes the colour of its direction".
- **Implements** `docs/design/finlife-redesign-spec.md` section 9, step 1 (Foundation), for Phase 55a.

**Date:** 2026-09-28

## Context

The owner wrote a redesign spec (`docs/design/finlife-redesign-spec.md`, sections 0 to 11, with a mockup). Its section 9 orders the work in six steps. This ADR covers the first:
- the spec's tokens;
- the font and tabular figures;
- one Amount rule;
- the header, which used to read as two stacked headers.

Four decisions were settled with the owner before any code (2026-09-28):
1. **The light theme stays.** The spec's values become the dark set, and light values are derived per role.
2. **IBM Plex Sans Thai is self-hosted** and every `font-mono` goes. The one class-based spec locator moves to a testid.
3. **An adjustment follows the spec: grey with `+` or `−`.** This reverses Phase 53b's rule of green up and red down.
4. **The logic selectors (L1 to L13) are a separate phase**, 55b and ADR `0028`.

## Decision

### Tokens: the spec's values under the app's names

Components and CLAUDE.md already use semantic names (`canvas`, `surface-1..3`, `line`, `fg`...). Renaming every class to the spec's `--bg-*` / `--text-*` names would have touched every file for no visual change. So the app keeps its names and takes the spec's values:
- `--bg-page` is `canvas`;
- `--bg-card` is `surface-1`;
- `--bg-inset` is `surface-2`;
- `--bg-raised` is `surface-3`;
- `--border` is `line`;
- `--text-1/2/3` are `fg` / `fg-secondary` / `fg-muted`.

**New tokens:** `header`, `control-active`, `line-control`, `line-strong`, `fg-disabled`, `adjust` (text and tint), `brand-soft` (bg, line, text), `selected` / `on-selected`, `pending-line` and `pending-body`.

**Semantic tints are now solid per-theme tokens**, the spec's `-bg` colours, instead of a 12% overlay of the fill. The transfer hue moves from cyan `#06B6D4` to sky `#38BDF8`.

**`pending` was not renamed to `warning`.** The plan proposed it, but about 40 call sites would have changed for a word, not a colour. `pending` is the spec's `--warning`, and the mapping is written in `src/index.css`.

**One spec value is not used for inputs.** The spec's `--border-control` `#252B38` measures 1.26:1 on a dark card. That is under WCAG 1.4.11's 3:1 for the edge of an input, whose edge is the only thing marking it. It becomes `line-control`, for secondary buttons, whose label identifies them. Inputs keep `line-input` `#5E7092` (3.59:1 on a card), the value Phase 53 chose for the same reason.

`scripts/wcag-tokens.mjs` checks the new pairs:
- every text token on `header`;
- `fg` and `fg-secondary` on `control-active`;
- each hue on its own `-bg`;
- `pending-body` on `pending-bg`;
- `brand-soft-text` on `brand-soft-bg`;
- `on-selected` on `selected`.

All pairs pass in both themes.

### One face: IBM Plex Sans Thai, with tabular figures

The spec drops the monospace face for numbers. `body` sets `font-variant-numeric: tabular-nums`, so every digit has the same width and columns still align.

The face is IBM Plex Sans Thai, self-hosted through `@fontsource/ibm-plex-sans-thai`:
- weights 400, 500, 600 and 700, in the `thai` and `latin` subsets;
- eight `@font-face` rules, each with the package's own `unicode-range`;
- 118 kB in total, precached through the existing `woff2` glob.

The `thai` subset's range `U+0E01-0E5B` holds the baht sign U+0E3F. So `฿` now comes from the app's own font rather than a system fallback, and ADR `0025`'s fallback note no longer applies. The `latin` subset holds U+2212, the minus.

The spec asks for Google Fonts. Self-hosting keeps the PWA's font offline and makes no third-party request.

Every `font-mono` class in `src/` is gone, across 21 files, except one: the `<code>` sample in `InlineMathInput`'s help line, which is code rather than an amount and keeps Tailwind's default mono stack. `--font-mono` and `@fontsource-variable/jetbrains-mono` are removed.

**The one class-based spec locator moved.** `soft-delete.spec.ts:108` found the wallet balance by `div.text-2xl.font-bold.font-mono`. It now uses `getByTestId('wallet-balance-wal-cash')`, a testid added to `WalletsView`. The assertions are unchanged.

### Amounts: sign and colour from meaning (spec sections 3 and 4.8)

**`formatCurrencyAmount` renders a negative as `−฿1,000.00`**, U+2212 before the symbol. It used to render `฿-1,000.00`, and every signed display worked around it by formatting `Math.abs`. That also fixes the transfer preview's negative projection, recorded as a follow-up in ADR `0026`. CSV export never used the helper, so its machine-readable `-` is untouched.

`TX_TYPE_META` gives each type its meaning:

| Type | Sign | Colour | Icon |
|---|---|---|---|
| Income | `+` | `income` | ↙ `ArrowDownLeft` |
| Expense | `−` | `expense` | ↗ `ArrowUpRight` |
| Transfer | none | `transfer` | ⇄ `ArrowLeftRight` (was `RefreshCw`) |
| Adjustment, up / down | `+` / `−` | `adjust` | `Plus` / `Minus` |
| Debt repayment | `−` | `adjust` | `Landmark` |

- **A transfer used to print `−`.** It moves money between the user's own wallets, so it is signed only inside one wallet's own view.
  - `txTypeMetaFor(type, amount, direction?)` and `TxAmount`'s new `direction` prop take `IN` or `OUT`.
  - `transferDirection(tx, walletId)` computes it.
  - `WalletPopupModal`'s activity list passes it.
- **A debt repayment is grey, not amber.** The spec keeps amber for real problems, and L1 counts a repayment as neither income nor spending. The spec does not name its colour, so this is a decision, recorded here.
- **An adjustment is grey in both directions.** This reverses ADR `0026`'s "an adjustment takes the colour of its direction". The owner's decision follows the spec: an adjustment corrects a balance and is neither income nor spending. The sign still comes from the signed amount (ADR `0024`).

### Header: one row (spec section 4.1)

`Navbar` was one sticky `<header>` holding two rows, the brand and balance row and then the tab row, about 120 px, which read as two stacked headers. It is now one row, 64 px (56 px under `md`):
- the logo, then the h1 from `xl`;
- the six `#nav-tab-*` tabs, left-aligned;
- on the right: the sync status, the theme button, the account controls and "Add entry".

**Tabs.** They are text only from `lg`. Between `md` and `lg` they show an icon, with the label kept as `sr-only` (`lg:not-sr-only`) and as the `title`. The active tab uses `brand-soft` and keeps `aria-current="page"`, which `gotoTab` waits for.

**Bottom nav.** It now covers everything under `md` (768 px, spec section 8), not only under `sm`. `App.tsx`'s bottom padding follows it.

**The total balance left the header.** `NavbarBalanceAndAuth` is now `NavbarAuth` and no longer subscribes to `totalNetWorth`.

**The Synced state is a green dot and the word**, with no pill.

**Deviations, each recorded in `DESIGN.md`:**
- the h1 stays "FinLife Tracker", because `theme.spec.ts` finds the heading by that name;
- header buttons stay 44 px, not the spec's 40 px;
- the theme button keeps a label that names what it does, rather than "Display settings" (spec section 11).

## Consequences

- **`DESIGN.md` is rewritten** to the spec's direction. It lists the deviations and why each exists.
- **The unit suite goes from 251 to 257.** `tx-cells.test.tsx`'s colour tests change with the rule, and new tests cover the transfer direction, `transferDirection`, `formatCurrencyAmount`'s minus and `Money`.
- **One spec line changed:** the locator move above.
- **Not done here, and left to later steps of the spec:**
  - `TransactionTableRow`'s repayment badge is still amber (`Badge tone="amber"`);
  - `RecentTransactionsTable`'s Type column draws its own icons;
  - both belong to the TransactionRow component in the shared-components step.
  - The radius tokens exist but are used only by the header; cards move to `rounded-card` with the Card component.
  - Wallet and category identity colours are migrated in step 5.
