import React from 'react';

interface ProgressMeterProps {
  /** Raw progress value - clamped to [0, 100] internally regardless of input, so a caller's own unclamped math can never overflow the bar. */
  percent: number;
  /** A raw color (e.g. a category's or wallet's own hex) for the fill - takes priority over `barClassName` when given. */
  color?: string;
  /** A Tailwind background class for the fill when no per-instance `color` applies. */
  barClassName?: string;
  heightClassName?: string;
  className?: string;
}

/**
 * T46: the progress-bar shell repeated across `DebtCardItem`,
 * `DebtPayoffOverview`, `CategoryExpenseDistribution`, and
 * `WalletAccountsGrid` - same track/fill/rounding structure at each, only
 * height and fill color differing. `CategoryExpenseDistribution` rendered
 * its fill width with no clamping at all (`${percent}%` directly), so a
 * category whose amount briefly exceeds the computed total - e.g. a stale
 * `totalExpenseAmount` snapshot mid-render - could overflow the bar past
 * 100%; every caller now goes through this single `Math.min(100,
 * Math.max(0, percent))`.
 */
export const ProgressMeter: React.FC<ProgressMeterProps> = ({
  percent,
  color,
  barClassName = 'bg-emerald-500',
  heightClassName = 'h-2',
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={`w-full ${heightClassName} bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden ${className}`.trim()}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${color ? '' : barClassName}`.trim()}
        style={color ? { width: `${clamped}%`, backgroundColor: color } : { width: `${clamped}%` }}
      />
    </div>
  );
};
