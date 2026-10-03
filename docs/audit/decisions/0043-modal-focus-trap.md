# 0043: A dialog takes focus when it opens and keeps Tab until it closes

**Status:** Accepted and released. **Its open screen-reader item is closed by ADR `0047`** (2026-10-03): the page behind a dialog is inert. Commit `5234613`, merged into `main` as `d2f735e` (PR #16); Vercel `dpl_9uk8JX9RkeU4fgUF9HT5as6PA54T` is READY in production, where the section 10 probe passes 372/372. `main`'s CI went green with PR #17 (`3dd9068`, push run `37075229294`), which fixed a time zone flaw in an unrelated diary test.
- **Closes** spec section 10 item 12's keyboard half ("ใช้งานด้วยคีย์บอร์ดได้ครบ"): the acceptance probe's three remaining failures, "item12 dialog takes focus" at 1280 and 390, and "item12 transaction row opens by keyboard and moves focus to its panel" at 390.
- **Keeps** audit 008 finding 1's return of focus to the opener, and OverflowMenu's own Escape (ADR `0029`).
- **Amends** `Modal`'s Escape (T22): with one dialog open over another, Escape closes only the top one. Before, every open `Modal` closed on the same key press.

**Date:** 2026-10-02

## Context

- **What `Modal` did.** `src/components/Modal.tsx` is the one dialog and sheet primitive: `role="dialog"`, `aria-modal="true"`, an overlay `fixed inset-0 z-50`, not portalled. It closed on Escape (a `document` keydown listener) and gave focus back to the opener on close (audit 008, an effect that records `document.activeElement` on open). It never moved focus into the dialog, and Tab was not held there.
- **Measured before** (scratchpad `modalfocus.cjs`, six Tab presses after opening by keyboard, on a `vite preview` build of `main` at `6354c08`):

  | Opener | Width | Tab stops after opening |
  |---|---|---|
  | `#navbar-quick-add-btn` + Enter | 1280 | all six outside: `time-filter-day`, `-week`, `-month`, `-all`, `hero-transfer-funds-btn`, `hero-add-wallet-btn` (the Dashboard behind the scrim) |
  | `#mobile-nav-quick-add-btn` + Enter | 390 | two outside (`mobile-nav-tab-wallets`, `mobile-nav-more-btn`), then into the dialog |
  | `#mobile-nav-more-btn` + Enter | 390 | the sheet's five controls, then `BODY` |

  A Transactions row (`#tx-row-*`) opened with Enter at 390 shows its sheet with focus still on the row. The acceptance probe (`accept10.cjs`) scored 369/372, and the three failures were these.
- **The 1280 Transactions drawer is not a `Modal`.** It is an `aside` that moves focus to its title (`drawerTitleRef`) and passed. It is unchanged.
- **Dialogs open over dialogs.** A `ConfirmDialog` (itself a `Modal`) opens over:
  - the Wallets page's sheet below `lg` (archive, delete), rendered as a **sibling** after it;
  - the Categories page's edit sheet below `lg` (delete), also a sibling;
  - `AccountModal` (sign out; sign out other devices or everywhere), rendered **inside** its body, so its panel is a DOM descendant of Account's panel.

  With one Escape listener per dialog on `document`, Escape on any of these confirmations closed the sheet under it too.
- **OverflowMenu sits inside a `Modal`** (the Wallets sheet). Its items are `tabIndex={-1}` and exist only while it is open; it stops its own Escape with a React `stopPropagation`, which stops the native event before a `document` listener. On Tab it closes itself and unmounts the focused item.
- **No `Modal` caller uses `autoFocus`**, and every caller's header ends in a close button (`title` with the default `showCloseButton`, or a custom `header` that carries its own).

## Decision

All of it lives in `Modal.tsx`. No caller changes.

### Focus goes in on open
- An effect on `isOpen`, declared **after** the return-focus effect so that one has already recorded the opener, focuses the first reachable control in the panel (`panelRef` on the panel's `motion.div`). The panel is in the DOM from the first frame of its entrance tween, so this does not wait for the animation.
- **If focus is already inside the panel, it stays.** An `autoFocus` field (focused during React's commit) or a child's own effect (child effects run before the parent's) wins.
- **No control at all:** the panel itself takes focus. It carries `tabIndex={-1}` for that.
- **Which control.** In practice the first control is the close button in every dialog's header. That is deliberate: focusing a field would open the phone keyboard over a sheet the user may only have opened to read, and the close button is the one control every dialog has.

### Tab stays inside
- **One `keydown` listener on `document`, in the capture phase.** It reads the focused element before any handler inside the panel runs; OverflowMenu's Tab handler would otherwise unmount the focused item first.
- **The browser moves focus between the first and last control itself.** The trap steps in only at the two ends (Tab on the last goes to the first, Shift+Tab on the first goes to the last), when focus has left the panel (it is brought back: Tab to the first, Shift+Tab to the last), and when focus sits on something Tab cannot reach (a menu item, a `tabIndex={-1}` heading) with nothing reachable beyond it.
- **Reachable is computed at key-press time**, so a field that appears after opening counts. The selector is `a[href]`, `area[href]`, enabled `button`/`input` (not `type="hidden"`)/`select`/`textarea`, `iframe`, `audio[controls]`, `video[controls]`, `[contenteditable]` (not `"false"`) and `[tabindex]`, then filtered:
  - a negative `tabindex` is out (the diary page's 1x1 date input pattern);
  - `:disabled` (covers a disabled `fieldset`) and anything under `[inert]` are out;
  - `visibility: hidden` or `collapse` on the element is out (`visibility` inherits, so its own computed value is enough);
  - the `hidden` attribute or `display: none` on the element or any ancestor up to the panel is out (`display` does not inherit, so the walk is needed).

  It reads markup and computed style, never layout. jsdom has no layout, and a size check would make the unit suite and the browser disagree.
- **A dialog inside this one owns its own controls**, including while it plays its 200 ms exit tween after closing: a control counts only if its nearest `[role="dialog"]` is this panel.

### Only the top dialog answers
- A module-level stack records open dialogs in the order they opened (pushed by the open effect, removed in its cleanup, so membership follows `isOpen`, not the exit tween).
- **Tab and Escape act only for the top one.** Escape also calls `preventDefault()`, and both listeners skip an event already handled. That makes the outcome independent of listener order; the Escape listener re-registers whenever a caller passes a new inline `onClose`, so its order is not stable.
- **Effect:** Escape on a confirmation closes the confirmation and gives focus back to what opened it inside the sheet (the menu trigger or the Delete button); a second Escape closes the sheet. OverflowMenu's own Escape is untouched, since it never reaches `document`.

### No visual change
- The panel has `tabIndex={-1}` and `focus-visible:outline-none`. The global `:focus-visible` rule (ADR `0029`) would otherwise ring the whole dialog when it is the focus target, which happens only for a dialog with no control; the panel is a container, not a control, and it is already the only thing above the scrim. The comment in the code says so. A click on a blank part of the panel now focuses the panel instead of `<body>`, which keeps focus inside the dialog; a mouse focus does not match `:focus-visible`, so nothing draws.
- Focus moved by the open effect after a mouse click does not match `:focus-visible` either (the browsers' heuristic), so a mouse user sees no ring appear on the close button; a keyboard user does.

### Rejected
- **`inert` on everything outside the dialog.** `Modal` is not portalled, so the dialog sits inside the app root it would make inert. Portalling every dialog to fix focus is the change ADR `0042` already declined for layering.
- **A focus-trap library.** A dependency in the entry chunk for what is about 130 lines in `Modal.tsx`, comments included.
- **Sentinel elements** before and after the panel. They add stops a screen reader announces, and they do not cover a dialog rendered inside another.

## Verification
- **Unit** (`unit/modal-focus.test.tsx`, jsdom, 19 tests): focus on open; an `autoFocus` field keeps it; a dialog with no control focuses itself and keeps Tab; both wraps; each unreachable kind alone after the last control (disabled button, disabled field, `tabIndex -1` field, `display: none` ancestor, `hidden` attribute, `visibility: hidden`, a hidden input); Tab between two middle controls is left to the browser; focus outside is brought back; a control that appears later counts; Escape closes and returns focus; OverflowMenu's Escape stays the menu's and a menu at the end wraps; a confirmation beside and inside a sheet traps and closes alone.
- **E2E** (`tests/account-and-mobile-nav.spec.ts`, intercepts nothing): Quick Add opened with Enter at 1280 focuses its close button, Shift+Tab wraps inside, 40 Tabs never leave the dialog, Escape returns focus to the button; at 390 a Transactions row opened with Enter puts focus on its sheet's close button and Escape returns it to the row.
- **Probes** (scratchpad `modalfocus.cjs`, `accept10.cjs`) on a `vite preview` build, before and after.

### Results (2026-10-02)
- **Lint** clean. **Unit** 615/615 (596 + 19, in 28 files).
- **Playwright** 423 runs (141 tests per browser; +2 tests, +6 runs):
  - full run 1: 420/423 in 7.4 m. The three failures were timeouts, and no assertion failed: a Firefox `page.goto` at 30 s (`account-and-mobile-nav.spec.ts:108`), and two WebKit clicks "waiting for element to be visible, enabled and stable" on page buttons this phase does not touch (`#wallet-adjust-btn-wal-main-checking` at `account-and-mobile-nav.spec.ts:134`, `#tx-open-add-modal-btn` at `toast-layering.spec.ts:82`). Both are the known intermittents recorded in earlier phases;
  - both specs alone, all three browsers: 48/48;
  - full run 2: **423/423** in 6.8 m.
- **The new E2E checks** passed 12/12 over two repeats on all three browsers before the full runs.
- **Negative controls, unit** (each change made alone in `Modal.tsx`, then restored and re-run 19/19):

  | Removed | Failing tests |
  |---|---|
  | the open-time `focus()` | 5: focus on open, no-control dialog, Shift+Tab wrap, both nested tests |
  | the Tab listener | 7: both wraps, focus brought back, a late control, the menu-at-the-end wrap, both nested tests |
  | the top-of-stack check (`isTopDialog` always true) | 2: both nested tests |
  | the own-dialog filter | 1: the nested test with the confirmation inside the sheet |
  | the whole reachability filter | 3: both wraps, focus brought back |
  | the "already inside" skip | 1: an `autoFocus` field keeps focus |
  | the `visibility` check alone; the ancestor walk alone; the negative-`tabindex` check alone | 3; 3; 1 ("skips a tabIndex -1 field") |
  | `:disabled` together with the selector's `:not([disabled])` | 2: a disabled button, a disabled field (each alone passes: they cover each other, and `:disabled` is kept for a disabled `fieldset`) |

- **Negative controls, E2E** (chromium): with `main`'s `Modal.tsx`, both new tests fail at the initial-focus assertion (`#close-quick-record-modal-btn`, `#tx-drawer-close-btn` not focused). With only the Tab listener removed, the Quick Add test fails at the first Shift+Tab (focus leaves the dialog).
- **An E2E locator trap found on the way:** on the date input's calendar-picker stop, focus is inside the input's closed user-agent shadow root, and Playwright's `:focus` locator matches nothing there although `document.activeElement` is the input. The first version of the check used `:focus` and failed on that stop; it reads `document.activeElement` now, with a comment. The trap was right; the locator was wrong.
- **Probes** on a `vite preview` build (with `.env`), before (`main`) and after:

  | Probe | Before | After |
  |---|---|---|
  | `modalfocus.cjs` 1280 Quick Add | 6 of 6 stops outside (the Dashboard) | 6 of 6 inside: `type-expense`, `type-income`, `desc`, `voice-btn`, `math-input`, `op-+` |
  | `modalfocus.cjs` 390 Quick Add | 2 outside, then inside | 6 of 6 inside, from `type-expense` |
  | `modalfocus.cjs` 390 More sheet | 5 inside, then `BODY` | 5 inside, then wraps to Debt payoff |
  | `accept10.cjs` item 12 | 11/14 | **14/14** |
  | `accept10.cjs` total | 369/372 | **372/372** |

  The item 12 lines that changed: "dialog takes focus" FAIL to PASS at 1280 and 390; "transaction row opens by keyboard and moves focus to its panel" at 390 FAIL (`tx-row-acc-tx-1`, not in a dialog) to PASS (`tx-drawer-close-btn`). The 1280 drawer line was already PASS (`tx-drawer-title`) and is unchanged.
- **Nesting and the ring, in a real browser** (scratchpad `nested67.cjs` on the preview; chromium, firefox and webkit, light and dark; 22/22 each):
  - Quick Add opened with the mouse at 1280 focuses its close button with no outline drawn, the panel draws none, and the next Tab draws the ring;
  - at 390 a wallet row opened with Enter focuses the sheet's close button; the menu's Archive opens the confirmation, which takes focus and keeps Tab among its three buttons; Escape closes the confirmation alone and focus is back on the sheet's menu trigger; a second Escape closes the sheet and focus is back on the wallet row;
  - at 390 the Categories edit sheet takes focus and 30 Tabs stay inside it.
- **Bundle:** entry `index-*.js` 186,724 B to **188,651 B (+1,927 B raw)**, 54,246 B gzip at level 9 (Phase 66: 53,346 B, so +900 B). `Modal` is in the entry chunk. `focus-visible:outline-none` was already used by three controls, so the CSS gains no rule.

## Consequences
- **A `Modal` caller does not manage focus.** Initial focus, the trap, Escape and the return are the primitive's. A field that should take focus on open uses `autoFocus` and `Modal` leaves it there.
- **A new dialog is a `Modal`.** A hand-rolled overlay would have none of this, which `CLAUDE.md` already forbade for other reasons.
- **Escape on a stacked dialog closes one layer.** A spec that expected one Escape to close a confirmation and its sheet together would now need two; none did.
- **Assistive technology outside the Tab order.** `aria-modal="true"` asks a screen reader to keep its virtual cursor in the dialog, but support varies and nothing makes the page behind truly inert. Not tested with a screen reader in this phase. That would need the portal this ADR rejected. Open, low.
- **The 1280 Transactions drawer is not a dialog** and still does not trap; it is a side panel on the page, by design (ADR `0031`).
