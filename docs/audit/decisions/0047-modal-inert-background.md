# 0047: The page behind a dialog is inert, marked beside the dialog, never on #root

**Status:** Accepted. Implemented on branch `phase-71-modal-inert-bg`, draft PR. Not merged yet.
- **Closes** ADR `0043`'s one open item: "nothing beyond `aria-modal` keeps a screen reader's virtual cursor out of the page behind a dialog".
- **Keeps** ADR `0042`'s decision not to portal `Modal`, ADR `0043`'s focus trap and top-of-stack rule, and audit 008's return of focus to the opener.

**Date:** 2026-10-03

## Context

- **What a screen reader could do.** ADR `0043` keeps Tab inside an open dialog, but a screen reader's virtual cursor does not move by Tab. With `aria-modal="true"` alone, some screen reader and browser pairs still let it read and activate the page behind the scrim: the header, the nav, the view under the dialog.
- **`inert` closes that gap.** An inert element and everything under it cannot take focus or pointer input, and is left out of the accessibility tree. It is supported in every engine the suite runs (Chromium, Firefox, WebKit).
- **The request was to put `inert` (or `aria-hidden`) on `#root`. That cannot work here.**
  - `Modal` is not portalled (ADR `0042`), so every dialog renders inside `#root`.
  - Both `inert` and `aria-hidden` apply to the whole subtree, and a descendant cannot opt back out. Marking `#root` disables the open dialog along with the page.
  - **Shown as a mutation:** marking the top-level container of the dialog's tree, the unit suite's stand-in for `#root`, fails 19 of the 25 tests in `unit/modal-focus.test.tsx`. Focus cannot enter the dialog, and Tab cannot move inside it.
- **Portalling `Modal` to `<body>` was not chosen,** because ADR `0042` settles the layer order by DOM order with `Modal` in place, and a portal would change that for every dialog at once. Marking the siblings reaches the same accessibility result without moving any DOM.

## Decision

- **While a dialog is open, every element beside the path from the top dialog's overlay up to `<body>` is `inert`.**
  - At each level, every sibling of the path gets `inert`: the view's other content, `<main>`'s siblings, the header and nav, and anything else in `<body>` beside `#root`.
  - `script`, `style`, `link`, `meta`, `template` and `noscript` are skipped.
  - The dialog and its ancestors are never marked, so the dialog stays fully usable.
- **Only marks it made are removed.** The marked elements are recorded; an element that already had `inert` is not touched, and keeps it after the dialog closes.
- **Recomputed whenever the dialog stack changes** (ADR `0043`'s `openDialogs`):
  - **A confirmation beside a sheet** (Wallets, Categories): the sheet's overlay is on a sibling branch, so the sheet becomes inert under the confirmation and comes back when it closes.
  - **A confirmation inside a dialog** (`AccountModal`): the parent's own controls around it become inert; the parent stays the path, so its frame is not marked.
  - **When the last dialog closes,** every mark is removed.
- **Something mounted beside the path while a dialog is open is marked too** (the update toast, another dialog's exit). One `MutationObserver` on `<body>` runs only while a dialog is open, and only resyncs when nodes are added outside the top dialog. Typing inside the dialog never triggers it.
- **The background is released before focus goes back.** React runs the return-focus cleanup (audit 008) before the stack cleanup, and `focus()` on an inert element does nothing in a browser. So the return-focus cleanup leaves the stack and recomputes the marks first, then focuses the opener; the stack cleanup's own release is then a no-op.
- **No `aria-hidden`.** `inert` already removes the background from the accessibility tree, so `aria-hidden` on the same elements would add nothing, and one more attribute would mean one more thing to keep in step.

## Verification

- **Unit** (`unit/modal-focus.test.tsx`, +6; 19 -> 25). `focus()` is patched in these tests to refuse an inert element, as a browser does: jsdom stores the attribute but does not apply it. The six tests:
  - the background is marked, the dialog is not, and everything is cleared on close with focus back on the opener;
  - an element that was already inert keeps it;
  - a confirmation beside, and inside, a sheet: the sheet's controls are inert under it, come back when it closes with focus on the button that opened it, and nothing stays marked after the sheet closes;
  - an element mounted beside an open dialog is marked;
  - unmounting an open dialog clears every mark.
- **Mutations, each caught:**

  | Mutation | Tests failed (of 25) |
  |---|---|
  | focus returned before the background is released | 3 |
  | no marks on open | 5 |
  | an existing `inert` overwritten (and later removed) | 1 |
  | no watcher for late additions | 1 |
  | marks computed from the bottom dialog, not the top | 3 |
  | the top-level container marked instead (the `#root` proposal) | 19 |

- **E2E** (`tests/account-and-mobile-nav.spec.ts`, +1, each engine enforcing it): with Quick Add open at 1280, the navbar's Quick Add button is inside an inert subtree, the dialog is not, `focus()` on that button is refused and focus stays in the dialog. After Escape, focus is back on the button and no `[inert]` remains.
  - **Negative control:** against `main`'s `Modal.tsx` it fails on chromium: `backgroundInert: false`, `backgroundTakesFocus: true`, `focusInDialog: false`.
  - **Playwright's role queries do not account for `inert`,** so the spec checks focus, not the accessibility tree.
- **The accessibility tree** (scratchpad `runner/ax71.mjs`, Chromium's `Accessibility.getFullAXTree` over the DevTools protocol, on a `vite preview` build at 1280; it reads the button, link, heading and dialog names a screen reader is given):
  - with Quick Add open, **all 38** background names exposed before it opened are gone, and the dialog and its close button are exposed; after Escape all 38 are back (5/5);
  - **the same probe on production (`main`'s `Modal`) fails:** with Quick Add open, "FinLife Tracker", "Local", "Sign In", "Account & Security", "Add entry", "Good evening", "NET WORTH" and the rest are still exposed.
- **ADR `0043`'s probes on the same build, unchanged:** `modalfocus.cjs`, every Tab stop inside Quick Add at 1280 and 390 and the More sheet wrapping; `nested67.cjs`, 22/22 in chromium, firefox and webkit.
- **Gate:** lint clean; unit 672/672 in 29 files (666 + 6).
  - **Playwright, two full runs: 425/426 each.** Each lost one WebKit click to a "waiting for element to be visible, enabled and stable" timeout, on `#open-add-debt-btn`, a page button clicked before any dialog opens (`debt-repayment.spec.ts:101`, then `:139`). That spec then passed 55/55 on WebKit (`--repeat-each=5`).
  - **The same WebKit timeouts happen without this change.** Two WebKit-only runs on this branch went 140/141 and 141/141; two with `main`'s `Modal.tsx` went 140/141 and 140/141. Every failure was a timeout on an unrelated control, and none an assertion. They are the local WebKit timeouts that earlier phases' gates also recorded (Phase 55a onward, in the baseline metrics), not this change.
- **Bundle:** entry `index-*.js` 188,651 -> 189,481 B (+830 B), 54,246 -> 54,403 B gzip (+157 B).

## Consequences

- **Screen readers stay in the dialog** wherever `inert` is honoured. Not tested with a screen reader on a device.
- **The page behind a dialog cannot be clicked or focused,** even where the scrim does not cover it. Nothing in the app relied on that: every dialog is modal, and the scrim already covers the page.
- **A live region behind a dialog is silent while it is open,** because inert content is left out of the accessibility tree.
  - The one that matters is the navbar's sync status (`#navbar-sync-status`, `role="status"`). A "Sync failed" that happens while a dialog is open is not announced, but the badge still shows it when the dialog closes.
  - The live regions inside dialogs (the form's result, error banners, "Checking rows...") are in the dialog and are unaffected.
- **Any new fixed element outside `#root`** (a portal, a third-party widget) is marked like the rest while a dialog is open. One that must stay usable during a dialog would need its own exception here.
- **A new dialog primitive must go through `Modal`,** or the stack, the trap and these marks will not know about it (`CLAUDE.md` already forbids hand-rolled dialogs).
