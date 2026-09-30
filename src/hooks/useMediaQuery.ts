import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches, kept current as the window changes.
 *
 * For a component that must render in one place or another by width, such as
 * the Transactions drawer (inline beside the list at `xl`, a bottom sheet
 * below). Hiding one copy with CSS would leave both in the DOM, and the
 * Playwright suite's strict `getByText` and `toHaveCount` count hidden copies
 * (Phase 58a, ADR 0031). Without `matchMedia` it reports `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );
  const getSnapshot = () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
