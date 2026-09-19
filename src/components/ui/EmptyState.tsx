import React from 'react';

interface EmptyStateProps {
  icon: React.FC<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * T47: modeled on `RecentTransactionsTable`'s existing empty-state shape
 * (icon + title + subtitle), which was the only view/component in the app
 * that had one at all. Adopted at the surfaces that previously rendered
 * nothing - or a bare line of text - when their list was empty.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, action, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center py-10 ${className}`.trim()}>
      <Icon className="w-8 h-8 text-stone-300 dark:text-stone-600" />
      <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">{title}</p>
      {subtitle && <p className="text-[11px] text-stone-400 dark:text-stone-500 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
