# T761 spec: Dashboard redesign DOC-1, the plan docs in the repo

Phase 133, branch `phase-133-dashboard-redesign-docs`. Order: task DOC-1 in `docs/design/dashboard-2026-10/spec.md:80` (the owner's redesign spec, "the owner spec" below). Docs only. This task ships the phase.

## 1. Goal

Put the owner's Dashboard redesign plan into the repo: commit the owner spec with its token and component names corrected to the code, and its mock unchanged; record decisions D1 to D5 in ADR 0102, rewrite DESIGN.md's Dashboard section to the owner spec's sections 2 to 4, and route dashboard redesign tasks to the owner spec in AGENTS.md, with the mock read only at the lines a task names.

## 2. Target files

```
docs/design/dashboard-2026-10/spec.md
docs/design/dashboard-2026-10/dashboard-2026-10.dc.html
docs/audit/decisions/0102-dashboard-redesign-2026-10.md
DESIGN.md
AGENTS.md
docs/audit/refactor-log.md
```

- **The two `docs/design/dashboard-2026-10/` files are the owner's** (owner note in the order). They are untracked today and both go into this task's commit. The build report lists both, so the orchestrator stages them with the task.
  - **`dashboard-2026-10.dc.html`** goes in **byte for byte unchanged**. The builder never edits, re-saves or re-encodes it; the build report lists it as "added by the owner, unchanged". Its SHA-256 is `d3d0e013775b93767cc3d44cf2a9c78a48f5069726466aa0c405d1010b79d319`.
  - **`spec.md`** goes in with exactly the four line edits of section 7.5 (owner order) and no other change: it keeps LF and its other 98 lines. The build report lists it as "added by the owner, four lines corrected to the code". Its SHA-256 is `631341e009b86bda5726296f65e170dc84dc7f82daf80bc74bddfe81aff2ad5b` before the edits and `09f30687bece1d4661e80db7947b14618463dafbcd1502b2994e02d889d90242` after (computed by applying section 7.5 to a copy).
- **The ADR is written first,** before the DESIGN.md and AGENTS.md edits. 0102 is the next free number (the last is `0101-hierarchical-icm-context-and-herdr-stages.md`).
- **`docs/audit/baseline-metrics.md` is not a target:** a docs-only phase adds no section when no bundle or test count changes (`AGENTS.md`, Workflow).
- Bookkeeping as usual (`docs/audit/task-ledger.md`, the build report).

## 3. Context to read

None from `docs/contexts/` (docs-only task). The builder reads the owner spec in full and the files in section 4. **The builder does not open `dashboard-2026-10.dc.html`:** no step here needs a mock line.

## 4. Current behaviour

- **The owner files:** `docs/design/dashboard-2026-10/` is untracked (`git status --porcelain`: `?? docs/design/dashboard-2026-10/`). `spec.md` is 102 lines and the HTML is 320 lines (23,347 B). Both are LF with zero em dashes. Neither is gitignored (`git check-ignore -v`: exit 1).
- **AGENTS.md:**
  - The routing table is `AGENTS.md:96-105`.
  - `AGENTS.md:107` says "**Never open `docs/design/*.html`** (a 2 MB bundled mockup)". That is `docs/design/FinLife Dashboard Redesign.html`, which stays closed.
  - `AGENTS.md:102` routes visual work to `docs/contexts/ui-and-e2e.md` and `DESIGN.md`.
- **DESIGN.md:**
  - `DESIGN.md:6` names `docs/design/finlife-redesign-spec.md` as the source of truth since Phase 55. It also says the file "keeps the rules the app enforces".
  - The Dashboard section is `DESIGN.md:161-175` (`### Dashboard (spec 6.1, ADR 0030)`): ten blocks, with widths, for the shipped page.
- **ADR 0030** (`docs/audit/decisions/0030-dashboard-redesign.md`) is the shipped Dashboard's ADR. It covers one period, every figure through a selector, and keeping ADR 0020's insights card.
- **Name slips in the owner spec, checked against the code.** The builder corrects them in `spec.md` (section 7.5), and DESIGN.md uses the real names:
  - **Text tokens:** the owner spec's `text-secondary` and `text-muted` (`spec.md:23`) do not exist. The tokens are `fg-secondary` and `fg-muted` (`--color-fg-secondary`, `--color-fg-muted` in `src/index.css`; `DESIGN.md:49`), so the classes are `text-fg-secondary` and `text-fg-muted`.
  - **Progress component:** `ProgressMeter` (`spec.md:30`) does not exist. The component is `ui/ProgressBar` (`src/components/ui/ProgressBar.tsx`; `DESIGN.md:144`).
  - **Transfer hue:** `spec.md:9` maps the mock's grey to `transfer`, and `spec.md:27` maps the mock's grey transfer rows to the `transfer` hue. In the app `transfer` is the blue hue (`DESIGN.md:25`); grey is `adjust`. The mapping stands; both lines are corrected to say the app's hue is blue.
- **Names in the owner spec that exist:**
  - **Tokens:** `canvas`, `surface-1`/`-2`/`-3`, `line`, `fg`, `brand`, `brand-soft`, `brand-tint`, `brand-line`, `income`, `expense`, `transfer`, and the radius `rounded-card`.
  - **Components:** `ui/SegmentedControl`, `ui/Button`, `ui/Money`, `ui/PageHeader`, `ui/AllocationBar`, `dashboard/DashboardLink`, `NavbarSyncBadge`, `TransferFundsModal`, `AddWalletModal`, and `onOpenTransfer` (in `DashboardView.tsx`, `App.tsx`).
  - **Selectors:** `spendingByCategory`, `groupByDay`, `cashFlow`, `isIncome` and `isSpending` (`ledger.ts`); `payoffPercent`, `debtPlan` and `requiredMonthly` (`debts.ts`); `netWorth` and `walletShares` (`wallets.ts`); `moodSpendingDays` and `daySpending` (`diary.ts`).
  - **Other:** `txTypeMetaFor`, `seedLedger` (`tests/helpers.ts`) and `scripts/wcag-tokens.mjs`.
- **No unit test, spec or script reads `AGENTS.md`, `DESIGN.md` or `docs/design/`** (grep of `unit/`, `tests/`, `scripts/`).

## 5. Parity map

None. No code changes. The "Spec-asserted DOM ids" row is near, because the new Dashboard section names the selector contract, but no id changes.

## 6. Tests to add

None: docs only, no behaviour can change. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

### 7.1 ADR `docs/audit/decisions/0102-dashboard-redesign-2026-10.md` (first)

Follow 0100's and 0101's shape: `# 0102: <title>`, a `**Status:**` paragraph with bullets, `**Date:** 2026-10-17`, then `## Context`, `## Decision`, `## Consequences`. Keep CRLF, like the other ADRs.

- **Title:** `0102: Dashboard redesign 2026-10: the existing tokens, the body only, the insights card kept, a like-for-like month comparison`
- **Status:** `Accepted.` Then these bullets:
  - **Amends** ADR `0030`: replaces its block layout (`DESIGN.md`'s Dashboard table). It keeps 0030's one period for the page, every figure through a selector, and ADR `0020`'s insights card.
  - **Implements nothing yet:** Phases 134 (selectors) and 135 (UI) build it, per the owner spec's section 6.
  - **Adds** the owner spec and its mock as the redesign's authority for the Dashboard only, in place of `docs/design/finlife-redesign-spec.md` section 6.1. For every other page that spec stays the source.
- **Context:** three short points.
  - The owner's mock `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` is a static, dark-only mock with sample data and raw hex colours.
  - The owner's `spec.md` in the same folder is the authority; the HTML shows layout and intent only (`spec.md:5`).
  - The shipped Dashboard is ADR 0030's.
- **Decision:** D1 to D5, one subsection each, with the owner spec's wording (`spec.md:9-13`) and one "Why" line each. Take each Why only from the source given here; do not invent another:
  - **D1, no new palette.** Why: the semantic tokens already pass `scripts/wcag-tokens.mjs` in both themes (`DESIGN.md:57`). A darker navy-and-gold brand theme is listed as "Later, only if wanted" (`spec.md:101`), as a token change checked by that script.
  - **D2, the Dashboard body only.** Why: the header and nav restyle touches every page (`spec.md:100`).
  - **D3, the AI insights card stays.** Why: it is not in the mock, and removing it is a separate owner decision (`spec.md:11`).
  - **D4, the month comparison compares like with like.** Why: the mock compares October 1 to 16 with all of September, which is 16 days against 30 (`spec.md:12`). N is today's day of the month, clamped to last month's length.
  - **D5, every figure computed once in `DashboardView`.** Why: ADR 0030's rule, kept (`spec.md:13`).
- **Consequences:**
  - DESIGN.md's Dashboard section now describes the target, with a status line saying so, until Phase 135 ships.
  - AGENTS.md routes dashboard redesign tasks to the owner spec. The mock is read only at the lines a task names, the one exception to the `docs/design` HTML rule.
  - Lines elsewhere in DESIGN.md that describe the shipped Dashboard are changed by the Phase 135 task that changes that code, not here: the Typography scale's "Hero number (net worth)" (`DESIGN.md:80`), "THB appears only beside the hero number" (`:108`), and the Dashboard rows of "Deviations from the spec" (`:302` to `:306`).
  - Phase 134 adds the three selectors of the owner spec's section 5, money path, each with tests first.

No em dash anywhere in the ADR. ADR 0030's own title has one; do not copy it.

### 7.2 DESIGN.md: replace the Dashboard section

Replace `DESIGN.md:161-175`, from `### Dashboard (spec 6.1, ADR 0030)` through the `| Spending insights | full | ADR 0020's card, titled with its own months. |` row, with exactly the text below. Change nothing else in DESIGN.md. Keep CRLF and the blank line before `### Transactions (spec 6.2, ADRs 0031 and 0033)`.

```markdown
### Dashboard (the 2026-10 redesign, ADRs 0030 and 0102)
**Status:** the target of the 2026-10 redesign, built in Phases 134 (selectors) and 135 (UI). Until Phase 135 ships, the shipped page still follows ADR 0030's layout. The authority is `docs/design/dashboard-2026-10/spec.md`. Its mock shows layout only: every colour, size and number in it is a mock value.

One period for the whole page, chosen in the `PageHeader`. Every figure comes from `src/selectors/`, computed once in `DashboardView`; cards only lay out. The app header, nav, sync badge and Quick Add are not part of this page.

**Colour (no new palette, both themes, no raw hex):**
- Page `canvas`. Cards `surface-1`, `rounded-card`, with the neutral `line` edge. Tracks and chips `surface-2` or `surface-3`. Dividers `line`.
- Text `fg`, `fg-secondary`, `fg-muted`.
- The Left over card is the page's one brand emphasis: a `brand-tint` ground, with `brand`, `brand-soft` and `brand-line` for its accents. Its figure follows section 1: `fg`, and `expense` when negative.
- Income `income`. Spending and debt still owed `expense`. A transfer row `transfer`, shown as not counted.
- The net worth figure is `fg`; it takes no colour of its own.
- Category and wallet hues are the record's own colour, tinted as the existing chips tint them. Debt progress is a `ProgressBar` (payoff is `income`).

**Type:** IBM Plex Sans Thai with `tabular-nums`, sizes from section 2's scale. The Left over figure takes the Hero number size. No `text-[Npx]`.

**Rules:**
- Every control has a 44px hit box: the period control is a `SegmentedControl`, Log today a `ui/Button`.
- Every amount goes through `formatCurrencyAmount` or `ui/Money`: two decimals, U+2212 before a negative. Never whole baht.
- Colour is never the only signal: income keeps its `+`, spending its minus, and a transfer says it is not counted, as `txTypeMetaFor` does.
- No sync state on the page; `NavbarSyncBadge` in the header shows it.
- One h1, in `PageHeader` (the greeting and the long date). Card titles are h2.
- Ids: keep every Dashboard id and test id in `docs/audit/test-selector-contract.md`. New ids start `dashboard-`, never another page's prefix (`tx-row-`, `debt-card-`, `open-repay-modal-`, `settle-debt-`, `wallet-entity-`).
- Charts: the sparkline and the donut are inline SVG with `role="img"` and an `aria-label` that states the figures. The category list beside the donut is the text equivalent. No chart library, no animation; nothing moves under reduced motion.
- Loading: each card shows one static outline, with no pulse. Empty: a new account shows `฿0.00` figures and short empty lines, never `NaN` or `Infinity`.
- Layout: fluid inside the `max-w-7xl` main. Rows wrap to one column at phone width, with one render path per breakpoint and no hidden duplicates.
- Links and actions use the existing tab routing:
  - Details and View all open Transactions.
  - All debts and Make a repayment open Debt payoff.
  - Manage opens Wallets.
  - Log today opens the Daily diary.
  - Transfer opens the shell `TransferFundsModal` through `onOpenTransfer()`, with no click event.
  - Add wallet opens `AddWalletModal`.

| Block, top to bottom | Rules |
|---|---|
| PageHeader | A greeting by the local hour, the long date, and the period `SegmentedControl`: Today, This week, Past 30 days, All time (DAY, WEEK, MONTH, ALL). |
| Row 1: Left over | The wide card. The period's left over, the share of income kept, "after debt due" (MONTH only), the daily spending sparkline (hidden for DAY and ALL), and the spent and kept bar. |
| Row 1: Income, Spending | Two small cards stacked beside it, with the totals from `cashFlow`. |
| Row 2: Spending by category | A donut and the top five (name, percent, amount) from `spendingByCategory` (L1). A subtitle says it excludes debt payments, transfers and adjustments. Under it, the month-to-date line, shown in every period: spending and left over for day 1 to N of this month against day 1 to N of last month (N clamped to last month's length). |
| Row 2: Debt payoff | The overall percent paid (`payoffPercent` on the totals), paid of total, and needed this month from `debtPlan` and `requiredMonthly`, with the existing surplus warning when it applies. Then each active debt: name, amount left, its `ProgressBar`, its payment-date end and its monthly. A Make a repayment button. |
| Row 3: Recent activity | The latest rows grouped by day, each day with its net, by the Transactions page's rule (`groupByDay`, L11; transfers shown but not counted), through the existing `TransactionRow` and `DayGroupHeader` and their behaviour. |
| Row 3: Net worth and wallets | `netWorth` (L3) with its "wallets minus debt" caption, the share bar and list from `walletShares` (active wallets only), then Transfer, Add wallet and Manage. |
| Row 3: Mood and spending | The week strip from `moodSpendingDays`, an empty line when there are no diary days, and Log today. |
| Spending insights | ADR 0020's card, unchanged, full width and last. |

The left over, sparkline and month-to-date figures come from selectors Phase 134 adds (the redesign spec's section 5).
```

### 7.3 AGENTS.md: one routing row and one clause

1. Insert this row into the routing table directly after the "Visual work" row (`AGENTS.md:102`), exactly:

   ```
   | Dashboard redesign tasks (the 2026-10 plan's DOC, SEL and UI tasks) | `docs/design/dashboard-2026-10/spec.md`, plus the rows above that the task's paths match. Open `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` only at the mock lines the task names: the one exception to the `docs/design` HTML rule below |
   ```

2. At `AGENTS.md:107`, insert one clause after `**Never open `docs/design/*.html`** (a 2 MB bundled mockup)` and before `, and read`. The line then reads, exactly:

   ```
   **Never read `docs/audit/archive/`** unless the user explicitly asks for historical research. It is superseded history, including the pre-split rule file. **Never open `docs/design/*.html`** (a 2 MB bundled mockup) or any other HTML under `docs/design/`, except the dashboard mock lines a task names (the routing row above), and read `docs/design/finlife-redesign-spec.md` only for a new redesign; `DESIGN.md` is the design authority.
   ```

   Why the extra words: the mock sits in a subfolder, so the old glob never covered it, and an exception to a rule that does not reach the file would mean nothing. The clause makes the rule cover every HTML file in `docs/design/`, with this one exception.

Change nothing else in AGENTS.md. Keep CRLF.

### 7.4 Bookkeeping and the phase entry

- **`docs/audit/task-ledger.md`:** add `## Phase 133 - Dashboard redesign docs: the owner spec, ADR 0102, DESIGN.md and routing (docs only)` above `## Backlog`. Use the template's shape. The branch line is `Branch phase-133-dashboard-redesign-docs, cut from main at 3aeca33. No migration.` Then the T761 row: Files are the six target paths, Status `done`, Commit empty.
- **`docs/audit/refactor-log.md`:** one Phase 133 entry at the top, in the Phase 132 entry's shape. The heading is `(2026-10-17, docs <sha>, merged <sha>)` and the body has `ADR 0102.`, `Changed`, `Verified`, `Surprises` and `Deliberately not done`. `Deliberately not done` names section 10's items (the out-of-scope list).

### 7.5 The owner spec: four lines corrected to the code (owner order)

Edit `docs/design/dashboard-2026-10/spec.md` in place, with these four line replacements and nothing else. Keep the file's LF endings; do not add CRLF, a BOM or a final-newline change. Each old line occurs once.

1. **Line 9 (D1, the transfer hue):**
   - Old: `- **D1. No new palette.** The redesign uses the existing semantic tokens in both themes (light and dark). The mock's gold accent maps to the `brand` hue, its green to `income`, its coral to `expense`, its grey to `transfer`. No raw hex anywhere.`
   - New: `- **D1. No new palette.** The redesign uses the existing semantic tokens in both themes (light and dark). The mock's gold accent maps to the `brand` hue, its green to `income`, its coral to `expense`, its grey transfer rows to the `transfer` hue (blue in the app, not grey). No raw hex anywhere.`
2. **Line 23 (text tokens):**
   - Old: ``| `#ECEEF4` / `#A3ABBE` / `#7A849B` text | text | `text-fg` / `text-secondary` / `text-muted` |``
   - New: ``| `#ECEEF4` / `#A3ABBE` / `#7A849B` text | text | `text-fg` / `text-fg-secondary` / `text-fg-muted` |``
3. **Line 27 (transfer rows):**
   - Old: ``| `#7A849B` transfer rows | transfer, not counted | `transfer` hue |``
   - New: ``| `#7A849B` transfer rows | transfer, not counted | `transfer` hue (blue in the app, not grey) |``
4. **Line 30 (the progress component):**
   - Old: ``| debt paid-off bar | progress | the existing `ProgressMeter` and its tokens |``
   - New: ``| debt paid-off bar | progress | the existing `ProgressBar` and its tokens |``

The line count stays 102, so every `spec.md:<line>` this spec cites still holds.

## 8. Gates

Docs-only tier: no lint or test run, but every count and path a changed doc states is checked against the code. Run each and put its output in the build report.

1. **The mock unchanged:** `sha256sum docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` prints exactly the HTML hash in section 2.
1a. **The owner spec, only the four lines:**
   - Before editing, copy the original to `workflow/stages/02_build/output/logs/T761-spec-original.md` (gitignored), then confirm it hashes to `631341e009b86bda5726296f65e170dc84dc7f82daf80bc74bddfe81aff2ad5b` (section 2).
   - After editing, `git diff --no-index --numstat workflow/stages/02_build/output/logs/T761-spec-original.md docs/design/dashboard-2026-10/spec.md` prints `4	4`. `git diff --no-index -U0` of the same pair shows only lines 9, 23, 27 and 30, each matching section 7.5's New text.
   - `sha256sum docs/design/dashboard-2026-10/spec.md` prints `09f30687bece1d4661e80db7947b14618463dafbcd1502b2994e02d889d90242`.
2. **Scope:** `git status --porcelain` shows only these:
   - `M` on `AGENTS.md`, `DESIGN.md`, `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md`;
   - `??` on `docs/design/dashboard-2026-10/`, `docs/audit/decisions/0102-dashboard-redesign-2026-10.md`, the T761 spec and the build report.
3. **DESIGN.md touched only in its Dashboard section:**
   - `git diff -U0 DESIGN.md` shows one hunk, starting at line 161.
   - `### Transactions (spec 6.2, ADRs 0031 and 0033)` still follows the new section after one blank line.
   - Every `###` heading other than Dashboard is unchanged: `git diff DESIGN.md | Select-String '^[-+]###'` prints only the old and new Dashboard headings.
4. **AGENTS.md:** `git diff --numstat AGENTS.md` prints `2	1` (the row added; line 107 replaced).
5. **Names exist.** Every token, component, selector and path named in the new DESIGN.md section, the ADR and the AGENTS row resolves:
   - **Tokens:** `canvas`, `surface-1`, `surface-2`, `surface-3`, `line`, `fg`, `fg-secondary`, `fg-muted`, `brand`, `brand-soft`, `brand-tint`, `brand-line`, `income`, `expense` and `transfer` each match `--color-<name>:` in `src/index.css`.
   - **Radius:** `--radius-card` is in `src/index.css`.
   - **Components:** `src/components/ui/{SegmentedControl,Button,Money,PageHeader,ProgressBar}.tsx` and `src/components/wallet/AddWalletModal.tsx` exist.
   - **Exports:** `TransferFundsModal`, `NavbarSyncBadge`, `onOpenTransfer` and `txTypeMetaFor` are each found by `grep -rl` in `src`.
   - **Selectors:** `cashFlow`, `spendingByCategory`, `groupByDay`, `payoffPercent`, `debtPlan`, `requiredMonthly`, `netWorth`, `walletShares` and `moodSpendingDays` are each an `export function` or `export const` in `src/selectors/`.
   - **Files:** `docs/audit/test-selector-contract.md` and `scripts/wcag-tokens.mjs` exist.
   - **Absent names:** `text-secondary`, `text-muted` and `ProgressMeter` appear 0 times in the corrected `spec.md`, the new DESIGN.md section and the ADR. Match them as whole names, so `text-fg-secondary` and `text-fg-muted` do not count (for example `grep -cE '(^|[^-])text-(secondary|muted)|ProgressMeter'`).
6. **Line numbers cited in the ADR:** check `DESIGN.md:57`, `:80`, `:108` and `:302` to `:306` against the file after the edit. Line 161's replacement changes the count, so recompute each one, and cite the line that holds the named text after the edit. Check `spec.md:5`, `:9-13`, `:100` and `:101` against the owner file.
7. **Line endings:**
   - `git ls-files --eol AGENTS.md DESIGN.md docs/audit/refactor-log.md docs/audit/task-ledger.md` still shows `w/crlf` on all four.
   - For the new ADR, a Node count of `\r\n` and of bare `\n` shows CRLF only.
   - The owner files keep their LF: gate 1 proves the HTML unchanged, and gate 1a's hash proves `spec.md` has only the four edits. A Node count on `spec.md` shows 0 `\r\n`.
8. **No em dash (U+2014):** none in `git diff -U0` added lines, none in the new ADR and none in the corrected `spec.md` (Node count 0 for each). The HTML already has none.
9. **Ledger:** the Phase 133 section sits above `## Backlog` and the T761 row's Commit cell is empty.

## 9. Production touch points

None. Docs only; nothing deploys until the owner merges, and a docs-only merge changes no served file.

## 10. Out of scope

- **Any edit to the HTML,** and any edit to `spec.md` beyond section 7.5's four lines: no rewording, no reflow and no fix to anything else in it, its plan or its line numbers included.
- **Opening `dashboard-2026-10.dc.html`,** or `docs/design/FinLife Dashboard Redesign.html`.
- **The rest of DESIGN.md:** the Overview's source line (`:6`), the Typography scale's "(net worth)" label, the Amounts THB line, and the Dashboard rows of "Deviations from the spec". They describe the shipped page and change with the Phase 135 code (ADR 0102's Consequences).
- **ADR 0030's text,** which is not edited; 0102 amends it by reference.
- **`docs/audit/test-selector-contract.md`, `docs/contexts/*.md` and `workflow/stages/*/CONTEXT.md`.** The stage files' own "never open `docs/design/*.html`" lines do not reach the subfolder; leave them.
- **`docs/audit/baseline-metrics.md`:** no section, as no count changed.
- **Any code, test or config,** and the Phase 134 and 135 tasks themselves.
