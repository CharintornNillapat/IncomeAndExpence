import React, { useEffect, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';
import { CURRENCY_DISPLAY_OPTIONS } from '../utils/currency';

interface AnimatedCounterProps {
  value: number;
  currencyPrefix?: string;
  duration?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  currencyPrefix = '',
  duration = 1.2,
}) => {
  const count = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState<string>('0.00');

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // snappy cubic-bezier spring-like ease
      onUpdate: (latest) => {
        setDisplayValue(latest.toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS));
      },
    });

    return () => controls.stop();
  }, [value, duration, count]);

  return (
    <span className="inline-flex items-baseline font-mono">
      {currencyPrefix && <span className="mr-0.5">{currencyPrefix}</span>}
      <span>{displayValue}</span>
    </span>
  );
};
