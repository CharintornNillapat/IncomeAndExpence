// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isInsideHorizontalScroller, isZoomedIn } from '../src/utils/swipeGuard';

/**
 * ADR 0024: a swipe that starts inside a horizontal scroller belongs to that
 * scroller, not to the tab swipe on `<main>`. jsdom has no layout, so the
 * scroller's overflow is stubbed with `scrollWidth`/`clientWidth`.
 */
function sized(el: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  return el;
}

let main: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  main = document.createElement('main');
  document.body.appendChild(main);
});

function tableIn(overflowX: string, scrollWidth: number, clientWidth: number) {
  const wrapper = sized(document.createElement('div'), scrollWidth, clientWidth);
  wrapper.style.overflowX = overflowX;
  const cell = document.createElement('td');
  const table = document.createElement('table');
  table.appendChild(document.createElement('tr')).appendChild(cell);
  wrapper.appendChild(table);
  main.appendChild(wrapper);
  return cell;
}

describe('isInsideHorizontalScroller', () => {
  it('claims a swipe that starts deep inside an overflowing auto scroller', () => {
    expect(isInsideHorizontalScroller(tableIn('auto', 800, 360), main)).toBe(true);
  });

  it('claims one inside an overflow-x: scroll element too', () => {
    expect(isInsideHorizontalScroller(tableIn('scroll', 800, 360), main)).toBe(true);
  });

  it('leaves the swipe to the tabs when the scroller\'s content fits', () => {
    expect(isInsideHorizontalScroller(tableIn('auto', 360, 360), main)).toBe(false);
  });

  it('leaves it to the tabs for content that clips instead of scrolling', () => {
    expect(isInsideHorizontalScroller(tableIn('hidden', 800, 360), main)).toBe(false);
  });

  it('leaves it to the tabs for a plain element', () => {
    const p = main.appendChild(document.createElement('p'));
    expect(isInsideHorizontalScroller(p, main)).toBe(false);
  });

  it('never looks past the boundary', () => {
    // An overflowing scroller ABOVE <main> is not the swipe's business.
    const outer = sized(document.createElement('div'), 800, 360);
    outer.style.overflowX = 'auto';
    document.body.appendChild(outer);
    outer.appendChild(main);
    const p = main.appendChild(document.createElement('p'));
    expect(isInsideHorizontalScroller(p, main)).toBe(false);
  });

  it('handles a non-element target', () => {
    expect(isInsideHorizontalScroller(null, main)).toBe(false);
    expect(isInsideHorizontalScroller(document, main)).toBe(false);
  });
});

/**
 * ADR 0068: with zoom allowed, a one-finger drag while zoomed in pans the page,
 * so it must not also change the tab. jsdom has no visualViewport; each test
 * stubs it.
 */
describe('isZoomedIn', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'visualViewport');
  });

  const withScale = (scale: number) =>
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { scale } });

  it('is false at the page\'s own scale', () => {
    withScale(1);
    expect(isZoomedIn()).toBe(false);
  });

  it('is true once the page is pinch-zoomed in', () => {
    withScale(1.5);
    expect(isZoomedIn()).toBe(true);
  });

  it('ignores rounding just above 1', () => {
    withScale(1.005);
    expect(isZoomedIn()).toBe(false);
  });

  it('counts a browser without visualViewport as not zoomed', () => {
    Reflect.deleteProperty(window, 'visualViewport');
    expect(isZoomedIn()).toBe(false);
  });
});
