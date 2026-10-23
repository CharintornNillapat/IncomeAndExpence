// @vitest-environment jsdom
import React, { Suspense, useState, act } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { lazyView, runWhenIdle } from '../src/utils/lazyView';

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => cleanup());

describe('lazyView', () => {
  it('preload requests the loader once', async () => {
    const Component: React.FC = () => <div>View content</div>;
    const loader = vi.fn().mockResolvedValue(Component);
    const { View, preload } = lazyView(loader);

    await preload();
    await preload();

    render(
      <Suspense fallback={<div>Loading</div>}>
        <View />
      </Suspense>
    );

    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByText('View content')).toBeDefined();
  });

  it('a preloaded view renders without committing the fallback', async () => {
    let fallbackRenderCount = 0;
    const Fallback: React.FC = () => {
      fallbackRenderCount++;
      return <div>Fallback</div>;
    };

    const ViewA: React.FC = () => <div>View A</div>;
    const ViewB: React.FC = () => <div>View B</div>;

    const lazyA = lazyView(async () => ViewA);
    const lazyB = lazyView(async () => ViewB);

    await lazyA.preload();

    let setTab: (tab: 'A' | 'B') => void = () => {};
    const TestApp: React.FC = () => {
      const [tab, _setTab] = useState<'A' | 'B'>('A');
      setTab = _setTab;
      return (
        <Suspense fallback={<Fallback />}>
          {tab === 'A' ? <lazyA.View /> : <lazyB.View />}
        </Suspense>
      );
    };

    render(<TestApp />);
    expect(screen.getByText('View A')).toBeDefined();
    const countBeforeSwitch = fallbackRenderCount;

    await lazyB.preload();

    await act(async () => {
      setTab('B');
    });

    expect(screen.getByText('View B')).toBeDefined();
    expect(fallbackRenderCount).toBe(countBeforeSwitch);
  });

  it('an unpreloaded view suspends, then renders', async () => {
    let resolveView: (comp: React.FC) => void = () => {};
    const loaderPromise = new Promise<React.FC>((resolve) => {
      resolveView = resolve;
    });
    const loader = vi.fn().mockImplementation(() => loaderPromise);
    const { View } = lazyView(loader);

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading skeleton</div>}>
          <View />
        </Suspense>
      );
    });

    expect(screen.getByText('Loading skeleton')).toBeDefined();

    const ViewComponent: React.FC = () => <div>Resolved View</div>;
    await act(async () => {
      resolveView(ViewComponent);
    });

    expect(screen.getByText('Resolved View')).toBeDefined();
  });

  it('a failed preload is forgotten', async () => {
    let callCount = 0;
    const ViewComp: React.FC = () => <div>Success View</div>;
    const loader = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Network failure');
      }
      return ViewComp;
    });

    const { View, preload } = lazyView(loader);

    await expect(preload()).resolves.toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading</div>}>
          <View />
        </Suspense>
      );
    });

    expect(screen.getByText('Success View')).toBeDefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('runWhenIdle uses requestIdleCallback when present and setTimeout when not', () => {
    const originalRequestIdleCallback = (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    const originalCancelIdleCallback = (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;

    try {
      const cancelMock = vi.fn();
      const idleMock = vi.fn().mockReturnValue(42);
      (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = idleMock;
      (window as unknown as { cancelIdleCallback: unknown }).cancelIdleCallback = cancelMock;

      const callback = vi.fn();
      const cancel = runWhenIdle(callback);

      expect(idleMock).toHaveBeenCalledTimes(1);
      expect(idleMock).toHaveBeenCalledWith(callback, { timeout: 3000 });

      cancel();
      expect(cancelMock).toHaveBeenCalledWith(42);

      delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
      delete (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;

      vi.useFakeTimers();
      const timeoutCallback = vi.fn();
      runWhenIdle(timeoutCallback);

      vi.advanceTimersByTime(999);
      expect(timeoutCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(timeoutCallback).toHaveBeenCalledTimes(1);

      const cancelledCallback = vi.fn();
      const cancelEarly = runWhenIdle(cancelledCallback);
      cancelEarly();
      vi.advanceTimersByTime(1500);
      expect(cancelledCallback).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      if (originalRequestIdleCallback) {
        (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = originalRequestIdleCallback;
      } else {
        delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
      }
      if (originalCancelIdleCallback) {
        (window as unknown as { cancelIdleCallback: unknown }).cancelIdleCallback = originalCancelIdleCallback;
      } else {
        delete (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;
      }
    }
  });
});
