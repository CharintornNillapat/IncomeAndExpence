import React from 'react';

export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarTone = 'income' | 'expense' | 'brand' | 'pending';

interface ProgressBarProps {
  /** Raw progress value - clamped to [0, 100] here, so a caller's own unclamped math can never overflow the bar. */
  percent: number;
  /** The fill's meaning (spec section 3): payoff progress is `income`. */
  tone?: ProgressBarTone;
  /** A raw colour (a category's or wallet's own) for the fill; takes priority over `tone`. */
  color?: string;
  /** Track height: 6, 8 or 10px (spec 4.11 allows 5 to 10). */
  size?: ProgressBarSize;
  /** Names the bar for assistive technology when no visible label is tied to it. */
  label?: string;
  className?: string;
}

const SIZE_CLASS: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
};

const TONE_CLASS: Record<ProgressBarTone, string> = {
  income: 'bg-income-fill',
  expense: 'bg-expense-fill',
  brand: 'bg-brand-fill',
  pending: 'bg-pending-fill',
};

/**
 * Spec 4.11 (ADR 0029): a `--border` track with a fill coloured by context.
 * It replaces `ProgressMeter` (T46), keeping its clamp - the reason it
 * existed: `CategoryExpenseDistribution` once drew an unclamped width past
 * 100%. It prints no number; every caller keeps its own `toFixed(1)` label,
 * which the Playwright suite reads (`20.0%`, `55.0%`).
 *
 * The width change is a 200ms tween, inside DESIGN.md's 150 to 200ms.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  tone = 'income',
  color,
  size = 'md',
  label,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={`w-full ${SIZE_CLASS[size]} bg-line rounded-full overflow-hidden ${className}`.trim()}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-out ${color ? '' : TONE_CLASS[tone]}`.trim()}
        style={color ? { width: `${clamped}%`, backgroundColor: color } : { width: `${clamped}%` }}
      />
    </div>
  );
};
