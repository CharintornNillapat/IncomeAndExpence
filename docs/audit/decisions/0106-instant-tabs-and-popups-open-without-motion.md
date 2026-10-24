# 0106: Instant tabs and popups open without motion

**Status:** Accepted
**Date:** 2026-10-24

## Context

The owner reported that switching tabs and opening popups on desktop (Brave) feels like "blinking".

Investigation of the current motion implementation revealed two distinct sources of visual blanking:

1. **Tab switches blank the page for 200 ms.** In `src/App.tsx`, active views are rendered inside `<Suspense><Presence><div key={activeTab} className="motion-page w-full">{renderActiveView()}</div></Presence></Suspense>`. `Presence` (`src/components/ui/motion.tsx`) retains the previous keyed child for 200 ms marked `data-leaving` while `motion-page-out` animates its opacity from 1 to 0 and translates it along `--page-dir`. Only after 200 ms does `Presence` mount the next view with `motion-page-in` (animating opacity from 0 to 1). Consequently, the page area is effectively blank for 200 ms on every tab change. Furthermore, the slide animation contradicts `DESIGN.md:11` (MOTION 1: "hover, focus, and 150 to 200ms state transitions only; nothing moves on its own") and `docs/contexts/ui-and-e2e.md:24` ("no entrance animations").
2. **Popups fade and rise into view.** `src/components/Modal.tsx` wraps its scrim and panel in `Presence`, applying `motion-scrim` (running `motion-fade-in` 200 ms from opacity 0) and `motion-sheet` (running `motion-rise-in` 200 ms with opacity from 0 and translateY from 24 px). Since `Modal` is the universal dialog primitive used by Quick Add, Auth, Account, Transfer Funds, Add Wallet, and all confirmations, every modal appears with an entrance delay and fade.

## Decision

1. **A tab change is instant.**
   - `src/App.tsx` removes `Presence` from the view container, removes the `motion-page` class, and drops the `direction` state and `--page-dir` CSS property.
   - `showTab` is stabilized with `useCallback` with empty dependencies (`[]`).
   - `key={activeTab}` is preserved (ADR 0005) so the view remounts cleanly, and `Suspense` wraps the view directly (displaying `#view-loading-fallback` only when a lazy chunk is genuinely pending, though ADR 0104 preloads them at idle).
   - In `src/index.css`, `@keyframes motion-page-in`, `@keyframes motion-page-out`, `.motion-page`, and `.motion-page[data-leaving]` are removed.
2. **A popup opens instantly; it still fades out on close.**
   - In `src/index.css`, `@keyframes motion-fade-in`, `@keyframes motion-rise-in`, `.motion-scrim { animation: motion-fade-in ... }`, and `.motion-sheet { animation: motion-rise-in ... }` are removed.
   - On close, the exit animations are preserved: `Modal` retains `Presence`, `motion-scrim`, `motion-sheet`, and `[data-leaving]` exit rules (`motion-fade-out` and `motion-rise-out` 200 ms forwards).
   - Why the exit stays: the owner's complaint was about the viewport or popup flashing blank on open; a closing modal reveals content that is already rendered beneath it, avoiding blank frames. Keeping the exit preserves ADR 0010's shell modal latching and focus restoration (`Modal.tsx:203-231`).
3. **Reduced motion.**
   - `.motion-page` is removed from `@media (prefers-reduced-motion: reduce)`. `.motion-scrim` and `.motion-sheet` remain in the reduced motion block to suppress the exit tweens.

## Amends

- **ADR 0082 (CSS keyframe tweens):** Removes the `motion-page` keyframes and the `motion-scrim`/`motion-sheet` entrance keyframes. Retains the exit keyframes (`motion-fade-out`, `motion-rise-out`) and chip tweens (`motion-drop-in`, `motion-drop-out`).
- **ADR 0026 (motion section, lines 60-75):** Removes the 200 ms tab slide and direction tracking. Retains ADR 0005 (`key={activeTab}`) and ADR 0010 (deferred shell modal mounting).

## Verification

- `tests/reduced-motion.spec.ts`: Updates the baseline animations list to `['slide', 'motion-fade-out', 'motion-rise-out']` and asserts that none of `motion-page-in`, `motion-page-out`, `motion-fade-in`, or `motion-rise-in` are started during tab switches and dialog interactions.
- Full unit test suite and Playwright suite across 3 browsers pass.

## Not done

- Removing the dialog close exit animations (`motion-fade-out`, `motion-rise-out`).
- Removing chip suggestion tweens (`motion-chip`), `slidePill`, or the period filter selection slide.
- Any change to `src/components/ui/motion.tsx` (`Presence` is retained).
