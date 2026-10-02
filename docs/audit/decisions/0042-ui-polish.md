# 0042: The update toast sits under every sheet, an empty wallet bar says why, and Quick Add says each thing once

**Status:** Accepted, not yet released. Branch `phase-66-ui-polish`, cut from `main` at `1036ee0`; not committed, pending the owner's review of the diff and the test results.
- **Closes** the release check's open gap from Phase 65 (the toast covers the mobile More sheet's rows), and audit 013 findings 6 (the ฿0 allocation track has no caption) and 7 (Quick Add repeats its title, the formula result and the formula help).
- **Amends** ADR `0041`'s "Unchanged: `z-50`" line: the toast is `z-45` now.
- **Keeps** Quick Add's two template lists, by the owner's decision (see Consequences).

**Date:** 2026-10-02

## Context

- **The toast and the sheets.** `ReloadPrompt` is `fixed ... z-50`. `Modal`'s overlay is `fixed inset-0 z-50` and is not portalled, so every dialog renders where its caller sits. Two layers with the same z-index paint in DOM order. `App.tsx` renders, in order: `Navbar`, `<main>` (every view, and so every view-level dialog), `MobileBottomNav` (the More sheet), `AuthModal`, `ReloadPrompt`, the footer, then the four lazy shell modals (Quick Add, Transfer, Add wallet, Account). So the toast drew over everything rendered before it and under everything after it. Quick Add, Transfer, Add wallet and Account covered it only because they come later in the DOM; the More sheet, `AuthModal` and every view's dialog did not.
  - **Measured before** (scratchpad `layers66.cjs` on a `vite preview` build of `main`, the real offline-ready toast): at 390 the toast spans y 620 to 764 and the More sheet's Debt payoff (594 to 646), Daily diary (652 to 704) and Categories (710 to 762) rows sit under it. `elementFromPoint` at each row's centre returns the toast, and a click on Debt payoff times out. The probe also found what the release check had not looked at: the Transactions page's Add transaction dialog does not cover the toast either, at 390 or at 1280.
  - The view's `motion.div` wrapper ends its page transition at `x: 0`, which framer-motion writes as `transform: none`, so it leaves no stacking context behind and a view's dialog competes with the toast at the root.
- **Finding 6.** At ฿0 the wallet allocation bar on the Dashboard and the Wallets page is an empty track (`line` on `surface-1`, about 1.18:1) with nothing under it. Since Phase 54 every new account starts there. The Cash flow card's empty bar, just above it on the Dashboard, already says "Nothing earned or spent in this period" (`text-xs text-fg-muted`).
- **Finding 7.** In Quick Add:
  - the dialog is titled "Quick Record Transaction" / "Add an expense or income instantly", and the form inside it opens with its own "Record Transaction" / "Log an expense or income";
  - a formula's result shows in the "Calculated: ฿30.00" badge and again on the "✓ ฿30.00" apply button;
  - formula help appears three times: the placeholder ("e.g. 500+500 or 1500*0.7"), the "Supports inline arithmetic: + - * / ()" line under the field, and an ⓘ beside the label whose text only hover can show and focus cannot reach.
  - The Transactions page's Add dialog repeats the same way ("Record New Transaction" / "Add an expense or income" over the form's heading). The repay modal does not: `lockType` already hides the form's header there.

## Decision

### Layer order: the toast goes under the sheets (the open gap)
- **`ReloadPrompt` is `z-45`.** One class changes. The order, bottom to top:

  | Layer | z-index | Elements |
  |---|---|---|
  | Page content | auto, and `z-30` for an open `OverflowMenu` | views, cards, menus |
  | Chrome | 40 | the sticky header (`Navbar`), the mobile bottom nav |
  | Toast | 45 | `ReloadPrompt` |
  | Dialogs and sheets | 50 | every `Modal`: the More sheet, `AuthModal`, view dialogs, the shell modals, `ConfirmDialog` |

- **Why this and not a portal or a new scale.** `Modal` is already the one dialog primitive and already sits at `z-50`. Ranking the toast between the chrome and the dialogs is the smallest change that makes the order hold whatever the DOM order is, and it keeps the toast above everything it is meant to cover: the page, the header and the nav. Portalling `Modal` would move every dialog in the app to fix one fixed element. Moving `ReloadPrompt` to the end of `App.tsx` would only flip which dialogs lose.
- **Position unchanged.** Phase 65's `bottom-[calc(5rem+env(safe-area-inset-bottom,0.5rem))] md:bottom-5 right-5` stays, so it still clears the nav at 390 and keeps its corner from `md`.
- **Desktop.** From `md` the bottom nav is hidden and the header is at the top, so nothing at `z-40` meets the toast; it still sits over page content, and an open dialog's scrim now covers it there too.
- **A Tailwind v4 bare value.** `z-45` is generated from the number; the build emits `.z-45{z-index:45}`. No token or theme entry is needed.

### An empty wallet bar says why (finding 6)
- **`AllocationBar` takes an optional `emptyCaption`.** When no segment has a positive value and the prop is set, it renders the bar and, under it, `<p className="text-xs text-fg-muted">` with the caption, in a `flex flex-col gap-2` wrapper: the Cash flow card's size, token and spacing. With any positive segment, or without the prop, it renders the bar alone, as before. One mechanism, two callers.
- **Copy:** "No money in your wallets yet", on the Dashboard's Wallets card (`WalletsSection`) and the Wallets page's list (`WalletList`). It says why the bar is empty in the user's terms. "Yet" fits the case that made this a finding, a new account at ฿0, and it stays true for a wallet spent down to ฿0 or a credit card below it, since the bar only ever shares positive balances.
- **The bar's own name is unchanged** ("Share of money by wallet: nothing to show"), so the screen-reader text Phase 56 pinned stays as it is.
- **Each page renders it once.** The Dashboard has one Wallets card and the Wallets page one list, through one render path at every width.

### Quick Add says each thing once (finding 7)
- **One title.** `TransactionForm` no longer renders a heading. Every caller puts it inside a titled `Modal`: Quick Add ("Quick Record Transaction"), the Transactions page's Add dialog ("Record New Transaction") and the repay modal (which hid it already). The type toggle stays where the heading row was, full width (`grid grid-cols-2 w-full`), still hidden by `lockType`. No prop is added, and ADR `0013`'s contract (the EXPENSE/INCOME toggle, the note first, the selects always mounted) is untouched.
- **One formula result.** The "Calculated: ฿30.00" badge keeps the figure; `express-input.spec.ts` and `transaction.spec.ts` read it. The apply button says what it does instead: "✓ Use result" (on one line), title "Replace the formula with its result". Its id (`-apply-btn`), its 44px box and its outline-on-the-pill stay.
- **Formula help once: the placeholder.** The "Supports inline arithmetic" line and the ⓘ are removed. The ⓘ could not be reached by keyboard or touch. The line's `+ - * / ()` repeated the operator keys right beside it. The placeholder shows an example exactly when the field is empty, which is when the hint is needed, and the operator keys stay visible after.
  - Without the line, the operator keys keep their place on the right from `sm` (`sm:ml-auto`), and an error still shows on the left.
  - At 390 the keys' mobile-only label "Quick operators:" wrapped onto two lines (audit 013's reproduction note 7). It is "Operators:" now, on one line.
- **The same change reaches the transfer form**, which also uses `InlineMathInput`: one help (its placeholder) and "Use result".
- **Unchanged:** `userTouchedRef`, the `seed` logic, every id, name and test id (`input[name="amount_expression"]`, `#repay-amount-math`, `#repay-wallet-select`, `#confirm-repay-btn`, the `-apply-btn`, `-op-`, `-chip-` and `-preset-chip-` suffixes, `quickadd-preset-*`), and the dialog name `addQuickTransaction` finds (`/Quick Record Transaction/i`).

## Verification
- **E2E with the real toast.** The toast exists only once a service worker has installed, and `npm run dev`, the suite's server, registers none.
  - **vite-plugin-pwa's `devOptions` gives an honest path.** `vite.config.ts` sets `devOptions: { enabled: mode === 'pwa-dev' }`, and Playwright's `webServer` gains a second entry, `npx vite --port=3100 --strictPort --mode pwa-dev`. There the plugin registers its development service worker (`dev-sw.js?dev-sw`), `useRegisterSW` reports `offlineReady`, and the real `ReloadPrompt` renders "Ready to use offline". Checked in chromium, firefox and webkit before any test was written.
  - `npm run dev` and `vite build` never pass that mode, so the main server and the production bundle do not change. The plugin writes `dev-dist/` in that mode, which `.gitignore` now lists.
  - `suppressWarnings: true` (a documented `devOptions` field) silences workbox's "glob patterns match no files" warning, which a dev server, with no build to precache, printed on every run. The toast still appears in all three engines with it.
  - **`tests/toast-layering.spec.ts`** runs on port 3100 (its own `baseURL`); every other spec stays on 3000, where no toast can cover a control. It injects nothing and intercepts no request, so it is not a request-intercepting spec.
    - At 390: the toast and the five nav buttons each hit themselves; with More open, the Debt payoff, Daily diary and Categories rows each hit themselves at their centre (polled), at least one of them overlaps the toast's box (so the check cannot pass vacuously), and a click on Debt payoff opens the page.
    - At 1280: on the Transactions page the toast hits itself; with Add transaction open, the toast's centre lands on the dialog's scrim.
- **Unit:** `ui-display` (the caption shows with `emptyCaption` at ฿0 and a negative balance, not with a positive one, not without the prop), `dashboard` (the Wallets card captions an all-zero list once, and not the seeded one), `wallets-page` (a fresh guest sees it once; a positive wallet beside a negative card hides it).
- **E2E, Quick Add:** `transaction.spec.ts` asserts one heading in the dialog, no "Log an expense or income", the placeholder as the only help, the result in the badge and not on "Use result", and that "Use result" replaces `120/4` with `30`.
- **Probe** (scratchpad `layers66.cjs`, `vite preview`, real service worker, `elementFromPoint`), before and after. See Results.

### Results (2026-10-02)
- **Lint** clean. **Unit** 596/596 (592 + 4).
- **Playwright** 417/417 (139 per browser: chromium, firefox, webkit) on both full runs: 6.0 m, then 6.2 m after `suppressWarnings` was added. No flake in either.
- **Negative controls:**
  - `ReloadPrompt` back at `z-50`: both `toast-layering.spec.ts` tests fail on chromium, at the assertions that matter ("debts row is unobstructed": expected `own`, received `toast`; the desktop dialog check: expected `dialog`, received `own`). Restored to `z-45`: 2/2.
  - `emptyCaption` removed from `WalletList`: "says the wallets hold no money for a fresh guest" fails. Restored: 2/2.
- **Probe**, `layers66.cjs` on `vite preview` with the real toast (y 620 to 764 at 390), `elementFromPoint` at each centre:

  | Check | Before (`z-50`) | After (`z-45`) |
  |---|---|---|
  | More sheet, Debt payoff (y 594 to 646) | toast | the row |
  | More sheet, Daily diary (652 to 704) | toast | the row |
  | More sheet, Categories (710 to 762) | toast | the row |
  | More sheet, Account & Security (775 to 827), close button | the row | the row |
  | Click on Debt payoff | times out | opens Debt payoff |
  | Toast centre, More open, 390 | toast | the Daily diary row |
  | Toast centre, Transactions Add dialog, 390 | toast | the dialog |
  | Five nav buttons, 390, no sheet | each hits itself | each hits itself |
  | Toast centre, no dialog, 390 and 1280 | toast | toast |
  | Toast centre, Transactions Add dialog, 1280 | toast | the dialog's scrim |
  | Toast centre, Quick Add and Account, 1280 | the scrim | the scrim |

- **Touch probe** (`touch65.cjs --toast`, 390 touch and 1280, light and dark): 0 controls under 44px in Quick Add (29), the Transactions Add dialog (27) and the repay modal (20), beyond the documented calculator keys, microphone and shortcut links. The toast keeps y 620 to 764 at 390 (CSS bottom 80px) and `bottom: 20px` at 1280, overlapping no nav button.
- **Smoke** (`smoke65.cjs` pointed at the preview): 192/192 across six views at 1280, 1024 and 390, light and dark.
- **Screenshots** (viewport only): Quick Add shows one heading, "Calculated: ฿30.00" once and "✓ Use result" on one line; "Operators:" fits on one line at 390. The caption shows on the Dashboard and the Wallets page in both themes.
- **Bundle:** entry `index-*.js` 186,724 B, unchanged in size (`z-50` and `z-45` are the same length). The lazy `TransactionForm` chunk is 25,486 B (25.85 kB before) and `InlineMathInput` 5,983 B (6.44 kB before).

## Consequences
- **While a sheet is open the toast is behind its scrim.** It comes back when the sheet closes; it is never dismissed by opening one.
- **A future fixed element picks its layer from the table above.** A toast or banner goes at 45, under the dialogs; a dialog is a `Modal`.
- **`npm test` starts a second dev server** on port 3100. Free that port, or leave a server of the same app on it, before a local run (`reuseExistingServer` reuses what answers there).
- **The form has no heading of its own.** A new caller that renders it outside a titled `Modal` must give it one.
- **Quick Add still lists templates twice:** its own list logs a template at once, and the form's chips prefill the form. `presets.spec.ts` asserts both inside Quick Add (`quickadd-preset-*` at `:46` and `:70`, the form's `-preset-chip-` at `:97`), so removing either is a behaviour and spec decision, not a polish fix. **Owner's decision (2026-10-02): keep both**, as designed: the list logs a template in one tap and the chips prefill the form for editing first. Not a finding.
