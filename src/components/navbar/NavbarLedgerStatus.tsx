import React, { useSyncExternalStore } from 'react';
import { AlertTriangle, Circle, RefreshCw, UserCheck, LogIn, UserCog } from 'lucide-react';
import { useFinanceActions, useFinanceState } from '../../context/FinanceContext';
import { APP_CURRENCY } from '../../utils/currency';
import { Money } from '../ui/Money';

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

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** `navigator.onLine`, re-read on the browser's own `online`/`offline` events. */
const useIsOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

const PILL = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap';
const MUTED_PILL = `${PILL} bg-surface-2 text-fg-secondary border-line`;

/**
 * DESIGN.md §4's one sync indicator, in five states (Phase 53b, T194). A guest
 * sees Local; a signed-in user sees, in this order of precedence, Offline,
 * Syncing (the only state that moves, and only while a load runs), Sync failed
 * (a button that retries) or Synced.
 *
 * Each button keeps its pill small but its hit box at 44px: the negative
 * vertical margin stops the taller box from pushing the navbar row apart.
 * `#navbar-sync-badge-btn` stays the guest button's id (the selector
 * contract); every signed-in state sits inside `#navbar-sync-status`.
 */
export const NavbarSyncBadge: React.FC<NavbarSyncBadgeProps> = ({ onOpenAuth }) => {
  const { isAuthenticated, isSyncing, syncError } = useFinanceState();
  const { refreshFromCloud } = useFinanceActions();
  const isOnline = useIsOnline();

  if (!isAuthenticated) {
    return (
      <button
        id="navbar-sync-badge-btn"
        type="button"
        onClick={onOpenAuth}
        title="Sign in to sync across devices"
        className="group inline-flex items-center min-h-[44px] min-w-[44px] -my-3 cursor-pointer"
      >
        <span className={`${MUTED_PILL} group-hover:border-brand transition-colors duration-150`}>
          <Circle className="w-2.5 h-2.5 shrink-0" />
          <span>Local</span>
        </span>
      </button>
    );
  }

  let badge: React.ReactNode;
  if (!isOnline) {
    badge = (
      <span className={MUTED_PILL} title="Offline: showing the data saved on this device">
        <Circle className="w-2.5 h-2.5 shrink-0" />
        <span>Offline</span>
      </span>
    );
  } else if (isSyncing) {
    badge = (
      <span className={`${PILL} bg-pending-tint text-pending border-pending-line`}>
        <RefreshCw className="w-3 h-3 shrink-0 motion-safe:animate-spin" />
        <span>Syncing</span>
      </span>
    );
  } else if (syncError) {
    badge = (
      <button
        type="button"
        onClick={() => void refreshFromCloud()}
        title={`${syncError}. Tap to try again.`}
        aria-label="Sync failed. Try again"
        className="group inline-flex items-center min-h-[44px] min-w-[44px] -my-3 cursor-pointer"
      >
        <span className={`${PILL} bg-expense-tint text-expense border-expense-line group-hover:border-expense transition-colors duration-150`}>
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Sync failed</span>
        </span>
      </button>
    );
  } else {
    badge = (
      <span className={`${PILL} bg-income-tint text-income border-income-line`}>
        <span className="w-2 h-2 rounded-full bg-income-fill shrink-0" />
        <span>Synced</span>
      </span>
    );
  }

  return (
    <span id="navbar-sync-status" role="status" className="inline-flex items-center">
      {badge}
    </span>
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
          <Money value={totalNetWorth} />{' '}
          <span className="text-xs font-semibold text-fg-secondary font-mono">
            {APP_CURRENCY}
          </span>
        </span>
      </div>

      {/* Auth status action with consistent 44px min touch target. Signed in,
          the name pill opens Account & Security, which holds sign-out behind a
          confirmation (ADR 0024: sign-out clears this device). */}
      {isAuthenticated ? (
        <button
          type="button"
          id="navbar-account-btn"
          onClick={onOpenAccount}
          title="Account & Security"
          aria-label="Account & Security"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-surface-3 border border-line py-1.5 px-2.5 rounded-lg text-xs transition-colors cursor-pointer"
        >
          <UserCheck className="w-3.5 h-3.5 text-income shrink-0" />
          <span className="max-w-[80px] sm:max-w-[120px] truncate font-semibold text-fg hidden xs:inline">
            {currentUser.name || currentUser.email}
          </span>
        </button>
      ) : (
        <>
          <button
            type="button"
            id="navbar-signin-btn"
            onClick={onOpenAuth}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-fg px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold border border-line transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-fg-secondary shrink-0" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            id="navbar-account-btn"
            onClick={onOpenAccount}
            title="Account & Security"
            aria-label="Account & Security"
            className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-fg-secondary transition-colors cursor-pointer"
          >
            <UserCog className="w-4 h-4" />
          </button>
        </>
      )}
    </>
  );
};
