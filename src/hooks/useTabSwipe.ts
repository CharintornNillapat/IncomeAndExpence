import { useRef } from 'react';
import type React from 'react';
import { isInsideHorizontalScroller, isZoomedIn } from '../utils/swipeGuard';

/** How far a finger must travel sideways to change tab, as react-swipeable's `delta` was. */
const SWIPE_DELTA = 40;

/**
 * The tab swipe on `<main>` (Phase 124, ADR 0100), in place of react-swipeable
 * with the options the app gave it (`delta: 40`, touch only, no scroll
 * prevention). A swipe changes tab when the finger ends at least 40px to the
 * side of where it started and further sideways than up or down; to the left
 * is the next tab. A second finger cancels the gesture (a pinch).
 *
 * ADR 0024: a swipe that starts inside a horizontal scroller (a wide table)
 * scrolls that element and does not also change the tab. ADR 0068: neither
 * does a drag while the page is pinch-zoomed in, which pans the page.
 */
export function useTabSwipe(onNext: () => void, onPrev: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    start.current = e.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const from = start.current;
    const touch = e.changedTouches[0];
    start.current = null;
    if (!from || !touch) return;

    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.abs(dx) < SWIPE_DELTA || Math.abs(dx) <= Math.abs(dy)) return;

    const target = e.target;
    if (isZoomedIn() || isInsideHorizontalScroller(target, target instanceof Element ? target.closest('main') : null)) return;

    if (dx < 0) onNext();
    else onPrev();
  };

  return { onTouchStart, onTouchEnd };
}
