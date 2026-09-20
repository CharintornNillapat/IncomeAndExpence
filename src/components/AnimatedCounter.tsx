import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useMotionValue } from 'framer-motion';
import { CURRENCY_DISPLAY_OPTIONS } from '../utils/currency';

interface AnimatedCounterProps {
  value: number;
  currencyPrefix?: string;
  duration?: number;
}

/**
 * ADR 0009: the animated value is written directly to this span's
 * `textContent` on every animation frame instead of through `setState`, so a
 * count-up animation no longer costs a React re-render per frame. The ref'd
 * span below must stay childless - giving it React children would put it
 * back under reconciliation on every parent re-render, exactly the cost this
 * removes.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  currencyPrefix = '',
  duration = 1.2,
}) => {
  const count = useMotionValue(0);
  const valueRef = useRef<HTMLSpanElement>(null);

  // Seeds the same '0.00' the old `useState` initializer showed synchronously
  // on mount, before the animation effect below arms - runs once, before
  // paint, so there is no empty-span flash.
  useLayoutEffect(() => {
    if (valueRef.current) {
      valueRef.current.textContent = (0).toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS);
    }
  }, []);

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // snappy cubic-bezier spring-like ease
      onUpdate: (latest) => {
        if (valueRef.current) {
          valueRef.current.textContent = latest.toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS);
        }
      },
    });

    return () => controls.stop();
  }, [value, duration, count]);

  return (
    <span className="inline-flex items-baseline font-mono">
      {currencyPrefix && <span className="mr-0.5">{currencyPrefix}</span>}
      <span ref={valueRef} />
    </span>
  );
};
