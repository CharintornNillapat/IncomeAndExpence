import React from 'react';
import { formatCurrencyAmount, MINUS } from '../../utils/currency';

interface MoneyProps {
  value: number;
  /** Prefix a positive value with `+`. Negative values always carry `MINUS`. */
  showPlus?: boolean;
  className?: string;
}

/**
 * A static amount in mono tabular numerals (DESIGN.md §2), replacing
 * `AnimatedCounter` (ADR 0026, superseding 0009). The number is the final
 * value on the first frame: no count-up from zero, no re-tween when a balance
 * changes.
 *
 * A negative value renders as `−฿1,000.00` (U+2212 before the symbol), the
 * shape `TxAmount` already uses, instead of `formatCurrencyAmount`'s own
 * `฿-1,000.00`. The digits themselves still come from `formatCurrencyAmount`.
 */
export const Money: React.FC<MoneyProps> = ({ value, showPlus = false, className = '' }) => {
  const sign = value < 0 ? MINUS : showPlus && value > 0 ? '+' : '';
  return (
    <span className={`font-mono tabular-nums ${className}`.trim()}>
      {sign}
      {formatCurrencyAmount(Math.abs(value))}
    </span>
  );
};
