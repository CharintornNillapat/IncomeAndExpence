import React from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudOff, UserCheck, LogIn, UserCog } from 'lucide-react';
import { useFinanceState } from '../../context/FinanceContext';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../../utils/currency';
import { AnimatedCounter } from '../AnimatedCounter';

/**
 * T34: the only finance-context subscribers in the Navbar area. `Navbar.tsx`
 * itself now takes only props (activeTab, callbacks) and no longer calls
 * `useFinanceState()`/`useFinanceActions()`, so a ledger write re-renders
 * these two small pieces instead of the whole app-shell header - matching
 * CLAUDE.md's "no component above view level subscribes to finance state"
 * rule, which this file previously violated.
 *
 * Split into two components (not one) because their DOM lives in two
 * different, non-adjacent places in Navbar's markup: the sync badge sits in
 * the left logo cluster, the balance+auth cluster sits in the right action
 * row. Keeping them separate preserves the exact DOM structure and sibling
 * order Navbar had before this extraction, rather than wrapping both in a
 * single component that could only occupy one spot in the tree.
 */

interface NavbarSyncBadgeProps {
  onOpenAuth: () => void;
}

export const NavbarSyncBadge: React.FC<NavbarSyncBadgeProps> = ({ onOpenAuth }) => {
  const { isAuthenticated, isSyncing } = useFinanceState();

  return isAuthenticated ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-income-tint text-income border border-income-line whitespace-nowrap">
      <Cloud className={`w-3 h-3 text-income ${isSyncing ? 'animate-spin' : ''}`} />
      <span className="sm:hidden">{isSyncing ? 'Syncing...' : 'Synced'}</span>
      <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
    </span>
  ) : (
    <button
      id="navbar-sync-badge-btn"
      type="button"
      onClick={onOpenAuth}
      title="Click to authenticate & enable cloud sync"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pending-tint text-pending border border-pending-line hover:border-pending transition-colors cursor-pointer whitespace-nowrap"
    >
      <CloudOff className="w-3 h-3 text-pending shrink-0" />
      <span className="sm:hidden">Local</span>
      <span className="hidden sm:inline">Local Only (Click to Sync)</span>
    </button>
  );
};

interface NavbarBalanceAndAuthProps {
  onOpenAuth: () => void;
  /** Opens Account & Security (ADR 0024), which now holds sign-out. */
  onOpenAccount: () => void;
}

export const NavbarBalanceAndAuth: React.FC<NavbarBalanceAndAuthProps> = ({ onOpenAuth, onOpenAccount }) => {
  const { totalNetWorth, isAuthenticated, currentUser } = useFinanceState();

  return (
    <>
      {/* Live Net Worth aggregated query */}
      <div className="text-right hidden md:block pr-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted block">
          Total Balance
        </span>
        <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-fg tracking-tight">
          <AnimatedCounter
            value={totalNetWorth}
            currencyPrefix={APP_CURRENCY_SYMBOL}
            duration={1.2}
          />{' '}
          <span className="text-xs font-semibold text-fg-secondary font-mono">
            {APP_CURRENCY}
          </span>
        </span>
      </div>

      {/* Auth status action with consistent 44px min touch target. Signed in,
          the name pill opens Account & Security, which holds sign-out behind a
          confirmation (ADR 0024: sign-out clears this device). */}
      {isAuthenticated ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          id="navbar-account-btn"
          onClick={onOpenAccount}
          title="Account & Security"
          aria-label="Account & Security"
          className="min-h-[44px] inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 border border-line py-1.5 px-2.5 rounded-lg text-xs transition-colors cursor-pointer"
        >
          <UserCheck className="w-3.5 h-3.5 text-income shrink-0" />
          <span className="max-w-[80px] sm:max-w-[120px] truncate font-semibold text-fg hidden xs:inline">
            {currentUser.name || currentUser.email}
          </span>
        </motion.button>
      ) : (
        <>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            id="navbar-signin-btn"
            onClick={onOpenAuth}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-fg px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold border border-line transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-fg-secondary shrink-0" />
            <span>Sign In</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            id="navbar-account-btn"
            onClick={onOpenAccount}
            title="Account & Security"
            aria-label="Account & Security"
            className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-fg-secondary transition-colors cursor-pointer"
          >
            <UserCog className="w-4 h-4" />
          </motion.button>
        </>
      )}
    </>
  );
};
