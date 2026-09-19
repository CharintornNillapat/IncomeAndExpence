import React from 'react';
import { Card } from './Card';

interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * T43: the page-level header banner - icon-free title + subtitle on the
 * left, an optional trailing action slot - repeated near-verbatim across all
 * 7 views. Built on `Card` (T44) so both primitives share one visual
 * language; `action` is rendered as-is rather than wrapped in a second flex
 * container, since every existing caller already supplies its own
 * single-root action markup (a bare button, or its own `<div className="flex
 * ...">` wrapping several).
 *
 * Adopting this standardizes every view's banner from `shadow-2xs` onto
 * `Card`'s `shadow-xs`, and - for the two banners that used stepped
 * `p-4 sm:p-5`/`gap-3 sm:gap-4` (`TransactionsView`, `DashboardView`'s
 * "Periodic Cashflow" section) - onto the flat `p-5`/`gap-4` every other view
 * already used. Both are deliberate, minor spacing unifications the phase
 * brief explicitly asked for, not unnoticed regressions.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action, className = '' }) => {
  return (
    <Card
      padding="md"
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`.trim()}
    >
      <div>
        <h2 className="text-base font-bold text-stone-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-stone-500 dark:text-stone-400">{subtitle}</p>}
      </div>
      {action}
    </Card>
  );
};
