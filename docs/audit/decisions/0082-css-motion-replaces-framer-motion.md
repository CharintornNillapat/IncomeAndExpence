# 0082: framer-motion is gone; CSS keyframes, `Presence` and one Web Animations call run the app's motion, which now honours reduced motion

**Status:** Accepted. Code `c595339`, docs `52134be`, draft PR #57; not merged.
- **Amends** ADR `0043`: `Modal`'s Tab trap and Escape listener are layout effects, registered in the commit that moves focus in.
- **Amends** ADR `0026` and `0029` (the motion rules): the tweens keep their values and run without a library.
- **Keeps** ADR `0010`: the deferred shell modals still mount on first open and keep their exit animation.

**Date:** 2026-10-07

## Context

1. **The weight.** framer-motion was the `vendor-motion` chunk, 129,389 B raw and 42,296 B gzipped, loaded on every cold start (19% of the startup JS): `App.tsx` (the tab slide), `Modal` (eager through `AuthModal`) and `MobileBottomNav` imported it.
2. **What it did, by call site.** Every use was one of two things: keep a leaving element mounted for its exit, or slide a selection pill between buttons.

   | File | framer-motion | What it animated |
   |---|---|---|
   | `App.tsx` | `AnimatePresence mode="wait"`, variants with `custom` | the tab slide: ±48 px and opacity over 200 ms, the old page out, then the new one in |
   | `Modal.tsx` | `AnimatePresence`, two `motion.div` | the scrim's fade, and the panel rising 24 px, 200 ms ease-out, in and out |
   | `ui/SegmentedControl.tsx` | `layoutId` (namespaced by `useId()`) | the selection pill sliding to the chosen option, 200 ms |
   | `MobileBottomNav.tsx` | `layoutId` | the nav's pill sliding between slots, 200 ms |
   | `TransactionForm.tsx` | two `AnimatePresence` | the suggestion chip (default mode) and the rule chip (`mode="wait"`) leaving |
   | `CategorySuggestionChip.tsx`, `SaveRuleChip.tsx` | `motion.div` | dropping in and out by 4 px, 150 ms |
   | `ui/Card.tsx` | a comment only | - |
3. **Reduced motion was ignored.** framer-motion follows `prefers-reduced-motion` only under a `MotionConfig reducedMotion="user"`, and the app had none, so every slide and rise ran for a person who asked for less motion. Nothing in `index.css` covered it either.

## Decision

1. **`src/components/ui/motion.tsx`** holds the two things CSS cannot do alone:
   - **`Presence`** keeps its one keyed child mounted for `exitMs` (200, or 150 for the chips) after it goes, marked `data-leaving`, then shows what came next, as `mode="wait"` did. The same key coming back mid-exit is kept, not remounted. The leaving child is its latest render, so a dialog's content does not revert while it closes. It decides during render (ADR `0057`'s pattern) and unmounts on a **timer, never `animationend`**, so a WebKit window that paints no frame (ADR `0058`) still closes its dialog.
   - **`slidePill`** is `layoutId` for a pill: it animates the pill, now inside the selected button, from the same place inside the button selected before, with the Web Animations API. It animates width and height rather than scale, so the corners stay round, and it measures the old button at the moment of the switch, as framer did, so a scroll or a resize since cannot leave it stale.
2. **The tweens are `motion-*` keyframe classes in `index.css`,** with framer's values: `motion-scrim` and `motion-sheet` (`Modal`), `motion-page` (the tab slide, whose direction is `--page-dir` on `<main>`, read live by the leaving page as `custom` gave it the latest direction), `motion-chip`. Ease-out is framer's `easeOut`, cubic-bezier(0, 0, 0.58, 1).
3. **Reduced motion turns all of it off:** the keyframe classes are `animation: none` under `prefers-reduced-motion: reduce`, `Presence` swaps at once and `slidePill` does nothing.
4. **One visible difference, on purpose:** when Jev changes its mid-confidence suggestion while one is shown, the old chip now leaves over 150 ms before the new one drops in. framer's default mode drew both at once for those 150 ms, stacked.
5. **`framer-motion` leaves `package.json`** with `motion-dom` and `motion-utils`. `tslib`, which `vite.config.ts` grouped into `vendor-motion`, now goes with `vendor-supabase`, its only other user.
6. **`Modal`'s Tab trap and Escape listener are layout effects** (found by this phase's WebKit check, below). Focus moves in a layout effect; the listeners were passive effects, a task later, so a key pressed as soon as focus was inside could be lost.

## Verification

- **Red first:** `unit/motion.test.tsx` (8 tests: mount, exit and unmount on time, latest render kept, wait for the next key, same key kept, custom exit time, reduced motion, the slide's keyframes and its three no-ops) failed before `motion.tsx` existed. Negative controls: removing the "same key comes back" branch and the reduced-motion branch each failed their test.
- **Reduced motion, in the browser:** `tests/reduced-motion.spec.ts` records every `animationstart` and Web Animations call while it switches the Dashboard's period, opens and closes Quick Add and changes tab. Without the setting it sees all seven (`motion-page-in`, the pill's slide, `motion-fade-in`, `motion-rise-in`, `motion-fade-out`, `motion-rise-out`, `motion-page-out`); with `reducedMotion: 'reduce'` it sees none, on all three browsers.
- **WebKit, the dialogs:** the new spec's first version pressed Escape as soon as the dialog showed, and lost it on WebKit; the same steps on `main` (framer-motion) lost it 1 run in 3, so that was a known race the dialogs-by-keyboard spec avoids by waiting for focus. Waiting for focus as that spec does, `main` passed 20/20, but this branch lost one Escape in 10: the key reached `document` with focus on the dialog's close button and nothing handled it, because `Modal`'s listener was not registered yet. Two unit tests press Escape and Shift+Tab from a sibling's layout effect, after focus moves in and before any passive effect: both failed on the passive listeners and pass on layout ones. On WebKit the two Escape tests then passed 30/30.
- **What a person sees:** `main` and this branch, built and served side by side, screenshotted in Chromium and WebKit after each tween had finished (2 s): the Dashboard after switching period, Quick Add open, Quick Add closed by Escape, the mobile Wallets tab, the mobile More sheet. Eight of ten are identical byte for byte; two Chromium ones differ in 15 and 5 pixels by at most 3 of 255, the anti-aliased corner of the dialog's form card and of the header's Add button (framer-motion left inline styles on its elements, which changes how a corner is rasterised). At 700 ms the mobile Wallets tab also differed, by the lazy page still loading, not by a tween. The tweens themselves were not compared frame by frame; their keyframes carry framer's values.
- **Bundle:** in the table below and in baseline metrics.
- **Gate:** in the refactor log. `unit/proxy-contract.test.ts`'s Server-Timing check failed once in a full unit run (28.8 ms against its 15 ms bound for a local token check) and passed alone three times; it measures wall-clock time under the suite's load and touches nothing here.

### Bundle (gzip -9, both sides built with `.env`; `main` is `aa72a75`, whose entry production serves)

| Cold start | `main` | Phase 106 | Change |
|---|---|---|---|
| `index` (entry) | 191,611 / 55,071 | 192,536 / 55,413 | +925 / +342 |
| `vendor-motion` | 129,389 / 42,296 | - | gone |
| `vendor-react` | 193,822 / 60,257 | 193,822 / 60,257 | 0 |
| `vendor-supabase` | 226,458 / 58,353 | 227,036 / 58,546 | +578 / +193 (`tslib`) |
| `vendor-icons` | 24,742 / 5,319 | 24,742 / 5,319 | 0 |
| **JS** | **766,022 / 221,296** | **638,136 / 179,535** | **−127,886 / −41,761 (−18.9%)** |
| `index.css` | 51,229 / 9,852 | 52,877 / 10,138 | +1,648 / +286 (the keyframes) |
| **JS and CSS** | **817,251 / 231,148** | **691,013 / 189,673** | **−126,238 / −41,475 (−17.9%)** |

All app JS 1,004,186 / 307,785 to 875,762 / 265,840 B (−128,424 / −41,945); every lazy chunk that imported framer-motion is 36 B smaller. `sw.js` 4,236 / 1,598 to 4,181 / 1,592; precache 58 to 57 entries (1,180.22 KiB).
