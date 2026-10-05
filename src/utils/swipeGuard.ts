/**
 * Whether a swipe that started at `target` began inside a horizontal scroller
 * (ADR 0024). `App.tsx` changes tabs on a horizontal swipe anywhere in
 * `<main>`, so scrolling a wide table sideways used to throw the user onto the
 * next tab. A swipe that starts in something that can itself scroll sideways
 * belongs to that element.
 *
 * A computed-style check, not a per-table flag: any element with
 * `overflow-x: auto | scroll` whose content is actually wider than it counts,
 * so a scroller added later is covered without anyone remembering to mark it.
 * An `overflow-x-auto` wrapper whose content fits does NOT block the swipe.
 *
 * Walks up from `target` to `boundary` (exclusive) - normally the `<main>` the
 * swipe handlers live on - and stops at the document root without one.
 */
export function isInsideHorizontalScroller(target: EventTarget | null, boundary: Element | null): boolean {
  let el: Element | null = target instanceof Element ? target : null;
  while (el && el !== boundary && el !== document.documentElement) {
    const { overflowX } = window.getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Whether the page is pinch-zoomed in (ADR 0068). Zoom is allowed since Phase
 * 92, and a person zoomed in moves around the page with the same one-finger
 * sideways drag that changes tabs, so `App.tsx` ignores a swipe while zoomed.
 * Without `visualViewport` (an old browser) the page counts as not zoomed,
 * which keeps the swipe as it was.
 */
export function isZoomedIn(): boolean {
  const scale = window.visualViewport?.scale ?? 1;
  return scale > 1.01;
}
