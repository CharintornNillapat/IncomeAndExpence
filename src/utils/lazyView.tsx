import { use, type ComponentType } from 'react';

type PreloadablePromise<T> = Promise<T> & (
  | { status?: undefined; value?: undefined }
  | { status: 'fulfilled'; value: T }
);

export interface LazyView<P extends object> {
  View: ComponentType<P>;
  preload: () => Promise<void>;
}

export function lazyView<P extends object>(load: () => Promise<ComponentType<P>>): LazyView<P> {
  let memo: PreloadablePromise<ComponentType<P>> | null = null;

  const getPromise = (): PreloadablePromise<ComponentType<P>> => {
    if (!memo) {
      const p = load().then(
        (Component) => {
          // React's use() reads status === 'fulfilled' to skip suspending on preloaded views
          p.status = 'fulfilled';
          p.value = Component;
          return Component;
        },
        (error: unknown) => {
          memo = null;
          throw error;
        }
      ) as PreloadablePromise<ComponentType<P>>;
      memo = p;
    }
    return memo;
  };

  const View: ComponentType<P> = (props: P) => {
    const Component = use(getPromise());
    return <Component {...props} />;
  };

  const preload = (): Promise<void> => {
    return getPromise().then(
      () => undefined,
      () => undefined
    );
  };

  return { View, preload };
}

export function runWhenIdle(fn: () => void): () => void {
  const win = typeof window !== 'undefined' ? window : undefined;
  if (win && typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {
    const id = win.requestIdleCallback(fn, { timeout: 3000 });
    return () => win.cancelIdleCallback(id);
  }
  if (typeof requestIdleCallback === 'function' && typeof cancelIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 1000);
  return () => clearTimeout(id);
}
