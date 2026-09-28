import React from 'react';

type DashboardLinkProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

/**
 * A text link in a Dashboard header (spec 6.1: "Transfer", "Manage wallets",
 * "All debts", "View all"). Each one moves within the app rather than to a
 * URL, so it is a `<button>` drawn as a link, with the 44px hit box every
 * control keeps (DESIGN.md §4). Text links are a listed exception to
 * `ui/Button`.
 */
export const DashboardLink: React.FC<DashboardLinkProps> = ({ className = '', children, ...rest }) => (
  <button
    type="button"
    className={`inline-flex items-center min-h-[44px] -my-2.5 text-sm font-medium text-brand hover:underline underline-offset-2 transition-control duration-150 cursor-pointer ${className}`.trim()}
    {...rest}
  >
    {children}
  </button>
);
