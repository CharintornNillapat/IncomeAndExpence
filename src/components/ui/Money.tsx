import React from 'react';
import { formatCurrencyAmount, MINUS } from '../../utils/currency';

interface MoneyProps {
  value: number;
  /** Prefix a positive value with `+`. Negative values always carry `MINUS`. */
  showPlus?: boolean;
  className?: string;
}

/**
 * A static amount in tabular numerals, replacing `AnimatedCounter` (ADR 0026,
 * superseding 0009). The number is the final value on the first frame: no
 * count-up from zero, no re-tween when a balance changes. Since ADR 0027 it is
 * set in the body face with `tabular-nums`, not a monospace one.
 *
 * A negative value renders as `−฿1,000.00` (U+2212 before the symbol). The
 * digits come from `formatCurrencyAmount` over the absolute value, so the sign
 * is printed once, here.
 */
export const Money: React.FC<MoneyProps> = ({ value, showPlus = false, className = '' }) => {
  const sign = value < 0 ? MINUS : showPlus && value > 0 ? '+' : '';
  return (
    <span className={`tabular-nums ${className}`.trim()}>
      {sign}
      {formatCurrencyAmount(Math.abs(value))}
    </span>
  );
};
