# 0005 — Keep the AnimatePresence remount on tab change

**Status:** Accepted
**Date:** 2026-09-17

## Context

`App.tsx:134-136` wraps the active view in `<AnimatePresence mode="wait" custom={direction}>` with `key={activeTab}`. This fully unmounts and remounts the view subtree on every tab change, discarding all view-local state — filters, search terms, in-progress form input, scroll position — every time the user switches tabs. The `<Suspense>` boundary (`App.tsx:145-147`) currently sits *inside* that keyed `motion.div`, so `tests/helpers.ts`'s `gotoTab` helper explicitly waits for `#view-loading-fallback` to detach on every tab switch — meaning the lazy chunk is re-fetched-from-cache and re-mounted every time, not just on first visit.

Two different problems are tangled together here: (1) the remount itself, and (2) where the Suspense boundary sits relative to it.

## Options considered

**(a) Keep the remount as-is, do nothing.**

**(b) Keep the remount (it is arguably correct product behavior — each tab is a clean slate), but hoist `<Suspense>` outside the keyed `motion.div`** so the loading fallback only appears on a genuinely uncached first visit to a view, not the animation transition itself. This is task T11.

**(c) Keep all 7 views mounted simultaneously** (e.g. render all of them and toggle `display`/visibility), preserving every view's local state indefinitely.

## Decision

**(b).** The remount-on-tab-change is a deliberate design choice, not a bug: `TransactionsView`'s search/filter state, `DiaryView`'s draft note, and similar view-local state are not meant to persist silently across a full tab switch away and back — a fresh view each time is simpler to reason about and matches most users' mental model of "leaving and returning to a page." (c) is explicitly rejected: keeping all 7 views mounted means all 7 subscribe to context and hold state simultaneously, which is strictly worse for both memory and the re-render surface this whole plan is trying to shrink.

What *is* worth fixing is purely mechanical: T11 hoists the `<Suspense>` boundary out from inside the keyed `motion.div`, so Suspense's fallback is tied to whether the chunk is loaded, not to whether the animation key changed. This is the one change from this decision that ships as a task.

## Consequences

- View-local state (search terms, filters, scroll position, draft diary notes) is lost on every tab switch, by design. This is not a bug to "silently fix" in some later cleanup pass — anyone tempted to add persistence here should read this ADR first.
- T11's specific risk: `tests/helpers.ts:gotoTab` asserts on `#view-loading-fallback` reaching count 0 as part of confirming a tab switch completed. Moving the Suspense boundary changes exactly when that element appears and disappears, so this is the single assertion most likely to break from T11 and needs direct attention during that task, not just a full-suite green light.

## Revisit if

A future product decision explicitly wants tab-switch state persistence (e.g. "don't lose my search filter when I glance at another tab"). At that point, option (c) — or a narrower per-view opt-in to staying mounted — should be re-evaluated as a deliberate feature, not folded into this refactor.
