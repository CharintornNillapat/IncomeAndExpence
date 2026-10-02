# 0041: The update toast clears the phone nav, the entry form's targets reach 44px, and the Transactions page knows a first run

**Status:** Accepted and released. Audit 013 is `2474185`, the phase is `d2d1e70`, merged into `main` as `517aee8` (PR #14); Vercel `dpl_9LooVHCjGCdG5tjVPRgpC4CkrT2k` is READY in production. The release check found the toast still covering the mobile More sheet's rows; that is recorded as open in the refactor log.
- **Closes** audit 013 findings 1 and 2 (R-03), 3 (R-04, audit 005 finding 1), 4 (R-27), 5 (R-19) and 8 (copy, the dead `animate-in` class).
- **Leaves open** audit 013 findings 6 (the ฿0 allocation track has no caption) and 7 (Quick Add repeats its title, the formula result and the formula help), by the owner's decision.
- **Amends** ADR `0011`'s and `0013`'s badges and chips: only their icon changes, never when they show.

**Date:** 2026-10-02

## Context

Audit 013 (`anti-slop/audit-013-2026-10-02.md`) confirmed that Phase 54 closed R-17, R-38 and C-5, and found eight things. The owner chose 1, 2, 3, 4, 5 and 8, with antislop applied during the work.

- **1 (HIGH, R-03).** `ReloadPrompt` is `fixed bottom-5 right-5 z-50`. The phone nav is `fixed bottom-0 z-40`, 65px tall at 390 plus the safe-area inset. The toast's box runs from y 680 to 824 and the nav starts at 779, so all five nav buttons sit under the toast until someone dismisses it. "App Ready for Offline Use" appears on a first visit; "New Update Available" would appear after a deploy.
- **2 (HIGH, R-03).** Five controls in the shared entry form are under 44px: the "Save as a quick template" row (16px), the amount input (24px, inside a 46px frame that is a plain `div`), the "✓ ฿30.00" apply button (74×26), and the note and date fields (42px). This phase's own probe, which seeds a template and a debt, found more in the same three modals: the template chips (26px), Quick Add's own template list (16px rows, a 16×16 delete cross), the debt payoff chips (26px), the save-rule chip's two buttons (24px and 22px) and the template-name input (42px).
- **3 (MEDIUM, R-04).** Four `Sparkles`: the "Calculated" badge, the "Auto-categorized" badge, "This payment settles the debt in full." and the Jev suggestion chip. A sparkle says that something clever happened. It does not say what. ADR `0033` already replaced the CSV import's sparkles with `Tags`.
- **4 (MEDIUM, R-27).** With no transactions at all, the Transactions page says "No transactions match your current filters." The user set no filter. Since Phase 54 this is every new account's first view of the page.
- **5 (MEDIUM, R-19).** The toast spins its refresh icon on a 3-second loop while it waits for a tap. Nothing is running, and MOTION 1 allows continuous motion only during real work.
- **8 (LOW).** The toast's copy is Title Case, "New Update" says the same thing twice, and the offline line uses our word "assets". `animate-in fade-in slide-in-from-bottom-5` comes from a Tailwind plugin the app does not load. It does nothing now, and if that plugin were ever added it would become an entrance animation, which DESIGN.md forbids.

## Decision

### The toast sits above the phone nav (finding 1)
- **Below `md`:** `bottom: calc(5rem + env(safe-area-inset-bottom, 0.5rem))`. The nav measured 65px at 390, 360 and 767 wide in Chromium. Its height is the 52px slot, the 6px row padding on each side and a 1px top border, plus `pb-[env(safe-area-inset-bottom,0.5rem)]`. The centre Quick Add's top sits 66px above the bottom, because its `-mt-5` sticks up 1px above the bar. So 80px leaves a 14px gap over Quick Add.
  - The calc uses the nav's own inset expression with the same fallback. On a notched phone the toast rises with the bar, and a browser without `env()` gets 0.5rem on both.
- **From `md`:** `bottom-5 right-5`, unchanged. The bottom nav is `md:hidden` there.
- **Unchanged:** the eager mount, `useRegisterSW`, the hourly update check, and `z-50` (the toast still sits above everything except a modal's own stacking).

### The toast stops spinning and speaks plainly (findings 5 and 8)
- **The refresh icon is static.** The waiting state is not work. `RefreshCw` stays, because it names the action the primary button takes.
- **The dead `animate-in fade-in slide-in-from-bottom-5 duration-200` is removed.** The toast appears without an entrance animation, as it already does in practice.
- **Copy**, sentence case:

  | State | Before | After |
  |---|---|---|
  | Offline ready, title | App Ready for Offline Use | Ready to use offline |
  | Offline ready, body | All assets and cached data are saved for fast offline access. | FinLife is saved on this device, so it opens without a connection. |
  | Update, title | New Update Available | A new version is ready |
  | Update, body | A newer version of FinLife is available. Reload to update. | Reload to start using it. |
  | Update, button | Update Now | Reload |

  "Opens without a connection" is the service worker's precache, which audit 013 checked on production. It makes no claim about cloud sync.
- **The buttons were already 44px.** They are `ui/Button` (`min-h-[44px]`) and `ui/IconButton` (44×44), with the same ids (`#pwa-reload-button`, `#pwa-dismiss-button`).

### Every control in the entry form is 44px (finding 2)
Where a control's visual already fits the form, it grows by a pixel or two. Where it is a small pill, the pill keeps its look and sits inside an invisible 44px box, which is DESIGN.md's rule. The box takes the focus outline off itself and draws it on the pill, as the navbar's sync badge does (`focus-visible:outline-none` on the button, `group-focus-visible:outline-*` on the pill).
- **The note, date and template-name inputs** take `min-h-[44px]`: 42px to 44px.
- **The amount field:** the input fills its frame (`min-h-[44px]`), and the frame loses its vertical padding, so a tap anywhere on it lands on the input. The frame stays 46px with its border.
- **The apply button** ("✓ ฿30.00") is a 44px box holding the same bordered pill.
- **"Save as a quick template":** the label is the hit box, so it takes `min-h-[44px]`. The box around it trades `p-3` for `px-3 py-1`, plus room under the name field when it is open. The checkbox keeps its size.
- **The template chips and the debt payoff chips** (`TransactionForm`'s quick chips) become 44px boxes around the same neutral pill. Wrapped rows sit flush, with no vertical gap, because the boxes already space them.
- **Quick Add's own template list** (`QuickAddModal`): its two buttons become 44px tall and the delete cross becomes a 44×44 box. Its pill grows from 30px to 46px instead of hiding the box, because two buttons share one pill.
- **The save-rule chip** (`SaveRuleChip`) and **the suggestion chip** (`CategorySuggestionChip`): "Save rule" and "Apply" become 44px boxes around the same filled pill. Their dismiss crosses become `ui/IconButton`s, with the same `aria-label` and ids. A negative margin keeps each chip from growing by more than a few pixels.
- **Exempt, as audit 013 and DESIGN.md section 4 record:** the operator keys and the +100 / +500 / +1,000 chips (calculator keys, 32px), the note field's microphone (32px), and the shortcut row's text links. The probe lists them separately, so they stay visible.
- **Every id, name and test id stays on the same element:** `input[name="amount_expression"]`, `#repay-amount-math`, `#repay-wallet-select`, `#confirm-repay-btn`, the `-apply-btn`, `-preset-chip-`, `-save-template-checkbox`, `-template-name`, `-save-rule-btn`, `-save-rule-dismiss`, `-suggestion-apply` and `-suggestion-dismiss` suffixes, `#repay-payoff-*`, and `quickadd-preset-chip-`, `-apply-` and `-delete-`.

### Icons say what happened, or nothing (finding 3)
- **"Calculated: ฿30.00"** takes `Calculator`. The badge reports a worked formula, and the field already shows `Calculator` when it is empty.
- **"Auto-categorized: Food & Dining"** takes `Tags`, the Categories tab's icon. The badge reports that a category was filled in, and ADR `0033` gave the CSV import's classify button the same icon.
- **The suggestion chip** ("Looks like Transport") takes `Tags` for the same reason. It proposes a category.
- **"This payment settles the debt in full."** takes `CheckCircle2`. It reports an outcome, the debt reaching zero, in the income colour it already used.
- `Sparkles` is no longer imported anywhere in `src/`. CLAUDE.md gains a Do NOT line for decorative sparkle icons.

### A first run is not a filtered list (finding 4)
- **First run** means the ledger has no live transaction: `rawTransactions` (every row) has none with `isDeleted` false. Then the list card shows:
  - title "No transactions yet";
  - subtitle "Add your first one with Add transaction above, or import a CSV from Import / export.";
  - the `ArrowLeftRight` icon (the Transactions tab's own icon), not `Search`.
- **First run wins over every filter**: a search, a range, a wallet, a category, a type or a diary day. With nothing recorded, no filter is the reason the list is empty.
- **A ledger whose rows are all deleted counts as having none**, as the owner defined it ("no live transactions at all"). With Show deleted off it shows the first-run copy. Turning Show deleted on lists the deleted rows, so the list is no longer empty.
- **Otherwise** the filtered copy and icon stay as they are: "No transactions match your current filters." under `Search`.
- **"Above" is true at every width.** `PageHeader` puts "Add transaction" and "Import / export" on the right of the title from `sm`, and stacks them under the title below `sm`. Either way they sit above the filter row and the list. The copy names both buttons rather than pointing at a direction alone.
- **No button is repeated inside the empty state.** A second "Add transaction" would give `getByRole` two matches, and specs are strict.
- **It is `ui/EmptyState`**, the page's existing pattern, with its `subtitle` prop.

## Verification
- **Unit:** `unit/transactions-page.test.tsx` gains first-run and filtered-empty tests. A negative control runs the new test against the old `TransactionsView.tsx`. `ReloadPrompt` gets no unit test. It reads `virtual:pwa-register/react`, which the unit suite would have to stub module-wide, and its placement is a CSS calc that jsdom does not lay out. The browser probe below covers it.
- **E2E:** `tests/transaction.spec.ts` keeps its filtered-empty assertion word for word, and a fresh-guest assertion on the first-run copy is added.
- **Browser probe** (scratchpad `touch65.cjs`, not in the repo):
  - It opens Quick Add, the Transactions Add modal and the repay modal at 390×844 (touch) and 1280×800, in light and dark, with a template and a debt seeded through `localStorage` before load.
  - It lists every visible interactive element under 44px, with the exemptions above listed separately.
  - It waits for the real offline-ready toast on a production build (`vite preview`) and checks its box against every nav button, including what `elementFromPoint` returns at each button's centre.
  - Viewport screenshots only, before and after.

### Results (2026-10-02)
- **Lint** clean. **Unit** 592/592 (588 + 4). **Negative control:** against the old `TransactionsView.tsx`, 3 of the 4 new tests fail. The fourth guards the unchanged filtered copy, so it passes on both. Restored: 21/21.
- **Playwright** 408/408 (136 per browser) on the third full run. Runs 1 and 2 lost one or two WebKit clicks each to the known "waiting for stable" timeout, on controls this phase did not touch. Each of those specs passed on its own re-run.
- **Probe:** controls under 44px in Quick Add / the Add modal / the repay modal went from 11 / 9 / 7 to 0 / 0 / 0. The suggestion chip, behind a locally fulfilled `/api/classify`, measures Apply 52×44 and dismiss 44×44. Keyboard focus draws the outline on the pill, not the box.
- **Toast:** production before, at 390, sat at y 680 to 824 over all five nav buttons. A local `vite preview` build after sits at y 620 to 764, clear of every nav button and 14px above Quick Add. 1280 is unchanged.
  - The update state cannot be triggered without a second deploy. It renders the same `aside` in the same position, so its placement was checked from the code; only its title, body and primary button differ.
- **Entry chunk:** 186,724 B, 76 B smaller than Phase 54's.

## Consequences
- **Phones:** the toast covers about 145px of page content above the nav until it is dismissed, instead of the nav itself. A toast is transient, and the nav is the only way between pages.
- **The form is a little taller:** about 2px per field, 14px for the template row, and 18px for each row of chips.
- **Quick Add still lists templates twice**, once in its own list and once as the form's chips. That is part of finding 7's duplication and stays open with it.
