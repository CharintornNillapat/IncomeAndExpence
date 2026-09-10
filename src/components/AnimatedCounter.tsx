import React, { useEffect, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  currencyPrefix?: string;
  currencySuffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  currencyPrefix = '',
  currencySuffix = '',
  decimals = 2,
  duration = 1.2,
  className = '',
}) => {
  const count = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState<string>('0.00');

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // snappy cubic-bezier spring-like ease
      onUpdate: (latest) => {
        setDisplayValue(
          latest.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        );
      },
    });

    return () => controls.stop();
  }, [value, decimals, duration, count]);

  return (
    <span className={`inline-flex items-baseline font-mono ${className}`}>
      {currencyPrefix && <span className="mr-0.5">{currencyPrefix}</span>}
      <span>{displayValue}</span>
      {currencySuffix && <span className="ml-1 text-xs font-sans opacity-80">{currencySuffix}</span>}
    </span>
  );
};
