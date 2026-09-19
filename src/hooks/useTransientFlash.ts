import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A value that self-clears after `durationMs` - replaces the repeated
 * `setX(value); setTimeout(() => setX(cleared), N)` shape used by every
 * success/status banner in this app. `flash` cancels any pending clear before
 * arming a new one, so a rapid second flash doesn't get cut short by the
 * first timer.
 */
export function useTransientFlash<T>(clearedValue: T, defaultDurationMs = 3000) {
  const [value, setValue] = useState<T>(clearedValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setValue(clearedValue);
  }, [clearedValue]);

  const flash = useCallback(
    (next: T, durationMs: number = defaultDurationMs, onClear?: () => void) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setValue(next);
      timerRef.current = setTimeout(() => {
        setValue(clearedValue);
        onClear?.();
      }, durationMs);
    },
    [clearedValue, defaultDurationMs]
  );

  return { value, flash, clear } as const;
}
