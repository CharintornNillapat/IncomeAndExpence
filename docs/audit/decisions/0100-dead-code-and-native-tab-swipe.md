# 0100: Dead code and an alias removed; the tab swipe is the app's own, and react-swipeable is gone

**Status:** Accepted. Code `ec15847`, docs `aca4e3a`, on branch `phase-124-dead-code-and-dep-pruning`; not merged. No migration.
- **Supersedes** the use of `react-swipeable` in `App.tsx` (the swipe since before ADR `0024`); ADR `0024`'s scroller guard and ADR `0068`'s zoom guard are unchanged and still decide first.
- **Removes** `SectionHeader` (spec section 4, ADR `0029`), unused since Phase 62 (ADR `0037`).

**Date:** 2026-10-10

## Context

1. **A whole-repo audit for over-engineering** (2026-10-10, after Phase 123) listed five cuts in a tree that was otherwise lean:
   - `SectionHeader`, 40 lines with no caller;
   - `User.role`, `UserRole`, `isEmailVerified` and `createdAt`, written in three places and never read;
   - `renderLocalInsight`, a three-line wrapper with no caller;
   - `WALLET_COLOR_PALETTE`, a second name for `IDENTITY_COLORS`;
   - `react-swipeable`, a dependency driving one handler with two directions and a 40px threshold.
2. **The owner's brief:** make all five; keep the swipe's 40px threshold, its horizontal-dominance rule and the `swipeBelongsElsewhere` guard; uninstall the package; test the touch logic.
3. **Each `delete` was checked first** with a search of `src/`, `unit/`, `tests/`, `api/` and `scripts/`, comments and strings included. Only `PageHeader`'s comment and `CLAUDE.md` named `SectionHeader`. No test builds a `User`, and nothing reads `currentUser` beyond `id`, `email` and `name`.

## Decision

### 1. The tab swipe is `useTabSwipe`

`src/hooks/useTabSwipe.ts` returns `onTouchStart` and `onTouchEnd`, which `App.tsx` spreads on `<main>` where react-swipeable's handlers were.
- **Start:** one finger records where it landed. A second finger clears the start, so a pinch never changes tab.
- **End:** the change is measured from `changedTouches[0]`. The tab changes only when `|dx| >= 40` and `|dx| > |dy|`. That is react-swipeable 7.0.2's own rule with the app's `delta: 40`: a swipe starts once either axis reaches `delta`, and its direction is horizontal only when `|dx|` is strictly larger. A finger moving left (`dx < 0`) opens the next tab, as `onSwipedLeft` did.
- **The guards come next, unchanged:** `isZoomedIn()` (ADR `0068`) and `isInsideHorizontalScroller(target, target.closest('main'))` (ADR `0024`), on the touch's own target. They moved from `App.tsx` into the hook with the handlers.
- **Not carried over, because the app's options turned them off:** mouse tracking (`trackMouse: false`) and scroll prevention (`preventScrollOnSwipe: false`). `<main>` keeps `touch-pan-y`.

**Shown equivalent, not argued:**
- `unit/tab-swipe.test.tsx` has eleven cases: both directions, exactly 40 and 39px, an equal diagonal, two vertical drags, one change per gesture, a two-finger start, a scroller under the finger, and a zoomed page.
- Before the swap, the same file was run with its harness on react-swipeable, configured exactly as `App.tsx` had it, and all eleven passed. It was then pointed at the hook, where it first failed (no such module) and then passed. The library copy was not kept, since the package is gone.

### 2. Dead code and an alias, removed

| Cut | Where | Lines (added / removed) |
|---|---|---|
| `SectionHeader`, and its mention in `PageHeader`'s comment | `src/components/ui/` | 0 / 40, 2 / 3 |
| `role`, `UserRole`, `isEmailVerified`, `createdAt` | `src/types.ts`, `FinanceContext.tsx` (the guest default and both session mappings) | 0 / 5, 0 / 9 |
| `renderLocalInsight` | `src/utils/spendingSummary.ts` | 0 / 5 |
| `WALLET_COLOR_PALETTE` | `walletFormStyles.ts`; `AddWalletForm` and `WalletDetail` import `IDENTITY_COLORS` (`WalletDetail` takes the comment's one fact) | 0 / 10, 4 / 3, 6 / 3 |
| react-swipeable's handler and the guard | `App.tsx`, into `src/hooks/useTabSwipe.ts` | 3 / 22, 45 / 0 |

**`User` is now `{ id, email, name }`:** all a screen reads. A device's stored `pf_user` may still carry the old fields. They are ignored and drop out at the next write, so no migration is needed.

`WALLET_COLOR_PALETTE`'s comment kept one fact worth keeping: a wallet on a colour outside the twelve keeps it until another is picked. That sentence moved to the colour picker in `WalletDetail`.

### 3. Size

- **Source:** `src/` loses 100 lines and gains 60, 45 of them the new hook.
- **Tests:** `unit/` gains the 99-line test.
- **Dependencies:** `package.json` loses one, and the lockfile loses its entry and nothing else.
- **Bundle:** `main` at `8ef7c65` against the branch, both built with the repo's `.env`, gzip level 9:

| Chunk | Before | After | Delta |
|---|---|---|---|
| Entry | `index-B8wLrv24.js` 195,458 / 57,105 B | `index-BLSMm3p4.js` 191,674 / 55,793 B | **-3,784 / -1,312 gzip** |
| All app JS (40 files) | 882,026 / 268,262 B | 878,223 / 266,908 B | -3,803 / -1,354 gzip |

react-swipeable sat in the entry chunk, because no `manualChunks` rule named it. So every first load carried it, and the cut comes off the cold start. The built files hold no trace of it.

## Verification

- **Lint** is clean. The `User` cut type-checks with no other change, which is the proof nothing read the fields.
- **Build** is clean.
- **Unit:** 1375/1375 in 62 files, then shuffled 1375/1375 (seed `1791595131349`).
- **Playwright:** 486 passed, 6 skipped, 0 failed of 492 (8.2 m, 4 workers), first run. No spec exercises a swipe: a synthesised one never completes in Chromium (ADR `0024`), so the hook's cases are the unit test's.
- **Schema:** no migration. `npm run schema:drift` replays the 21 migrations from empty with the expected rows unchanged.

## Consequences

- **One dependency fewer,** and 1.3 KB gzip off the entry chunk.
- **The swipe's touch behaviour on a real phone is still unverified**, as it was with the library (ADR `0024`), and it is still the owner's open check. The rule is the library's own, but react-swipeable also read `touchmove`, and real hardware can deliver events differently from jsdom.
- **A new field on `User` needs a reader.** The three removed ones had none since they were added.
