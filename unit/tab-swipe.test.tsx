// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useTabSwipe } from '../src/hooks/useTabSwipe';

/**
 * The tab swipe on `<main>` (Phase 124, ADR 0100): touch handlers in place of
 * react-swipeable, with its rule kept. A swipe changes tab when the finger
 * travels at least 40px sideways and further sideways than up or down; a
 * swipe to the left is the next tab. ADR 0024's scroller guard and ADR 0068's
 * zoom guard still decide first. `SWIPE_CASES` was run against react-swipeable
 * 7.0.2 with the same options before the swap, and it agreed on every case.
 */

const SWIPE_CASES: Array<[string, number, number, 'next' | 'prev' | null]> = [
  ['a swipe to the left opens the next tab', -60, 5, 'next'],
  ['a swipe to the right opens the previous tab', 60, -5, 'prev'],
  ['exactly 40px sideways is enough', -40, 0, 'next'],
  ['39px sideways is not', -39, 0, null],
  ['a diagonal with equal travel is not sideways', -50, 50, null],
  ['a mostly vertical drag is a scroll, not a swipe', -50, -60, null],
  ['a vertical drag past 40px is still not a swipe', 30, 45, null],
];

function Harness({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const handlers = useTabSwipe(onNext, onPrev);
  return (
    <main data-testid="main" {...handlers}>
      <div data-testid="inner" />
    </main>
  );
}

const at = (x: number, y: number) => ({ clientX: x, clientY: y });

function swipe(el: Element, dx: number, dy: number) {
  fireEvent.touchStart(el, { touches: [at(200, 300)] });
  fireEvent.touchMove(el, { touches: [at(200 + dx, 300 + dy)] });
  fireEvent.touchEnd(el, { touches: [], changedTouches: [at(200 + dx, 300 + dy)] });
}

function mount() {
  const onNext = vi.fn();
  const onPrev = vi.fn();
  const view = render(<Harness onNext={onNext} onPrev={onPrev} />);
  const outcome = () => (onNext.mock.calls.length ? 'next' : onPrev.mock.calls.length ? 'prev' : null);
  return { ...view, onNext, onPrev, outcome };
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'visualViewport');
});

describe('useTabSwipe: direction and threshold', () => {
  it.each(SWIPE_CASES)('%s', (_name, dx, dy, expected) => {
    const { getByTestId, outcome } = mount();
    swipe(getByTestId('inner'), dx, dy);
    expect(outcome()).toBe(expected);
  });

  it('fires once per gesture, and a lone touchend after it does nothing', () => {
    const { getByTestId, onNext } = mount();
    swipe(getByTestId('inner'), -80, 0);
    fireEvent.touchEnd(getByTestId('inner'), { touches: [], changedTouches: [at(0, 300)] });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('ignores a two-finger gesture (a pinch)', () => {
    const { getByTestId, outcome } = mount();
    const el = getByTestId('inner');
    fireEvent.touchStart(el, { touches: [at(200, 300), at(260, 300)] });
    fireEvent.touchEnd(el, { touches: [], changedTouches: [at(100, 300)] });
    expect(outcome()).toBe(null);
  });
});

describe('useTabSwipe: the guards decide first', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves a swipe that starts in an overflowing horizontal scroller to the scroller (ADR 0024)', () => {
    const { getByTestId, outcome } = mount();
    const inner = getByTestId('inner');
    inner.style.overflowX = 'auto';
    Object.defineProperty(inner, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(inner, 'clientWidth', { configurable: true, value: 300 });
    swipe(inner, -80, 0);
    expect(outcome()).toBe(null);
  });

  it('pans the page instead while pinch-zoomed in (ADR 0068)', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { scale: 2 } });
    const { getByTestId, outcome } = mount();
    swipe(getByTestId('inner'), -80, 0);
    expect(outcome()).toBe(null);
  });
});
