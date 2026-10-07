// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Presence, slidePill, MOTION_MS } from '../src/components/ui/motion';

/**
 * Phase 106 (ADR 0082): what framer-motion's `AnimatePresence mode="wait"`
 * and `layoutId` did, without framer-motion. jsdom runs no CSS animation, so
 * these pin the lifecycle (what is mounted when, and marked how) and the
 * Web Animations call, not the pixels.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function reduceMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: on && query === '(prefers-reduced-motion: reduce)' }));
}

const box = (key: string, text = key) => (
  <div key={key} data-testid="box">
    {text}
  </div>
);

describe('Presence', () => {
  it('shows a child at once, keeps it marked as leaving for the exit, then unmounts it', () => {
    vi.useFakeTimers();
    const { rerender, queryByTestId } = render(<Presence>{box('a')}</Presence>);
    expect(queryByTestId('box')!.hasAttribute('data-leaving')).toBe(false);

    rerender(<Presence>{null}</Presence>);
    expect(queryByTestId('box')!.hasAttribute('data-leaving')).toBe(true);

    act(() => vi.advanceTimersByTime(MOTION_MS - 1));
    expect(queryByTestId('box')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(queryByTestId('box')).toBeNull();
  });

  it('keeps showing the latest render of the leaving child, not its first', () => {
    vi.useFakeTimers();
    const { rerender, getByTestId } = render(<Presence>{box('a', 'first')}</Presence>);
    rerender(<Presence>{box('a', 'latest')}</Presence>);
    rerender(<Presence>{null}</Presence>);
    expect(getByTestId('box').textContent).toBe('latest');
  });

  it('waits for the leaving child before showing the next key', () => {
    vi.useFakeTimers();
    const { rerender, getAllByTestId } = render(<Presence>{box('a')}</Presence>);
    rerender(<Presence>{box('b')}</Presence>);
    expect(getAllByTestId('box').map((el) => el.textContent)).toEqual(['a']);

    act(() => vi.advanceTimersByTime(MOTION_MS));
    expect(getAllByTestId('box').map((el) => el.textContent)).toEqual(['b']);
    expect(getAllByTestId('box')[0].hasAttribute('data-leaving')).toBe(false);
  });

  it('takes the same key back mid-exit without unmounting it', () => {
    vi.useFakeTimers();
    const { rerender, getByTestId } = render(<Presence>{box('a')}</Presence>);
    const node = getByTestId('box');
    rerender(<Presence>{null}</Presence>);
    rerender(<Presence>{box('a')}</Presence>);
    expect(getByTestId('box')).toBe(node);
    expect(node.hasAttribute('data-leaving')).toBe(false);

    act(() => vi.advanceTimersByTime(MOTION_MS * 2));
    expect(getByTestId('box')).toBe(node);
  });

  it('honours its own exit time', () => {
    vi.useFakeTimers();
    const { rerender, queryByTestId } = render(<Presence exitMs={150}>{box('a')}</Presence>);
    rerender(<Presence exitMs={150}>{null}</Presence>);
    act(() => vi.advanceTimersByTime(150));
    expect(queryByTestId('box')).toBeNull();
  });

  it('with reduced motion, removes and swaps at once', () => {
    reduceMotion(true);
    const { rerender, queryByTestId } = render(<Presence>{box('a')}</Presence>);
    rerender(<Presence>{box('b')}</Presence>);
    expect(queryByTestId('box')!.textContent).toBe('b');
    rerender(<Presence>{null}</Presence>);
    expect(queryByTestId('box')).toBeNull();
  });
});

describe('slidePill', () => {
  // jsdom has no layout, so each element reports the rectangle it is given.
  function placed<T extends HTMLElement>(el: T, left: number, top: number, width: number, height: number): T {
    el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
    return el;
  }

  function scene() {
    const from = placed(document.createElement('button'), 0, 0, 100, 40);
    const to = placed(document.createElement('button'), 120, 0, 60, 40);
    // The pill sits 4px inside its button on every side, as the mobile nav's does.
    const pill = placed(document.createElement('span'), 124, 4, 52, 32);
    to.appendChild(pill);
    const animate = vi.fn();
    (pill as unknown as { animate: typeof animate }).animate = animate;
    return { from, pill, animate };
  }

  it('slides the pill from the same place in the previous button, width and height included', () => {
    const { from, pill, animate } = scene();
    slidePill(pill, from);
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: 'translate(-120px, 0px)', width: '92px', height: '32px' },
        { transform: 'none', width: '52px', height: '32px' },
      ],
      { duration: MOTION_MS, easing: 'ease-out' },
    );
  });

  it('does nothing with reduced motion, without a previous button, or without the API', () => {
    const { from, pill, animate } = scene();
    reduceMotion(true);
    slidePill(pill, from);
    reduceMotion(false);
    slidePill(pill, undefined);
    slidePill(null, from);
    expect(animate).not.toHaveBeenCalled();

    const bare = placed(document.createElement('span'), 0, 0, 10, 10);
    document.createElement('button').appendChild(bare);
    expect(() => slidePill(bare, from)).not.toThrow();
  });
});
