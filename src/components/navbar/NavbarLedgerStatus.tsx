import React, { useSyncExternalStore } from 'react';
import { AlertTriangle, Circle, RefreshCw, UserCheck, LogIn, UserCog } from 'lucide-react';
import { useFinanceActions, useFinanceState } from '../../context/FinanceContext';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

/**
 * T34: the only finance-context subscribers in the Navbar area. `Navbar.tsx`
 * itself now takes only props (activeTab, callbacks) and no longer calls
 * `useFinanceState()`/`useFinanceActions()`, so a ledger write re-renders
 * these two small pieces instead of the whole app-shell header - matching
 * CLAUDE.md's "no component above view level subscribes to finance state"
 * rule, which this file previously violated.
 *
 * Split into two components (not one) because Navbar places them apart: the
 * theme toggle sits between the sync badge and the account controls in the
 * right action row (Phase 55a).
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

/*
 * A badge button's 44px box is invisible, so the global focus outline would
 * float around empty space. It moves onto the visible pill instead (ADR 0029).
 */
const BADGE_BUTTON =
  'group inline-flex items-center min-h-[44px] min-w-[44px] -my-3 cursor-pointer focus-visible:outline-none';
const PILL_FOCUS = 'group-focus-visible:outline-2 group-focus-visible:outline-focus group-focus-visible:outline-offset-2';
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
        className={BADGE_BUTTON}
      >
        <span className={`${MUTED_PILL} ${PILL_FOCUS} group-hover:border-brand transition-colors duration-150`}>
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
        className={BADGE_BUTTON}
      >
        <span className={`${PILL} ${PILL_FOCUS} bg-expense-tint text-expense border-expense-line group-hover:border-expense transition-colors duration-150`}>
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Sync failed</span>
        </span>
      </button>
    );
  } else {
    // Spec section 4.1: a green dot and the word, no pill. The dot is the
    // only status dot in the app (ADR 0026).
    badge = (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary whitespace-nowrap">
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

interface NavbarAuthProps {
  onOpenAuth: () => void;
  /** Opens Account & Security (ADR 0024), which now holds sign-out. */
  onOpenAccount: () => void;
}

/**
 * The header's account controls. Until Phase 55a this also showed the total
 * balance; spec section 4.1 took it out of the header, since the dashboard
 * already shows it, and with it this component's `totalNetWorth` subscription.
 */
export const NavbarAuth: React.FC<NavbarAuthProps> = ({ onOpenAuth, onOpenAccount }) => {
  const { isAuthenticated, currentUser } = useFinanceState();

  return (
    <>
      {/* Auth status action with consistent 44px min touch target. Signed in,
          the name pill opens Account & Security, which holds sign-out behind a
          confirmation (ADR 0024: sign-out clears this device). */}
      {isAuthenticated ? (
        <Button
          id="navbar-account-btn"
          variant="secondary"
          onClick={onOpenAccount}
          title="Account & Security"
          aria-label="Account & Security"
          className="min-w-[44px]"
          icon={<UserCheck className="w-3.5 h-3.5 text-income shrink-0" />}
        >
          <span className="max-w-[80px] sm:max-w-[120px] truncate text-fg hidden xs:inline">
            {currentUser.name || currentUser.email}
          </span>
        </Button>
      ) : (
        <>
          <Button
            id="navbar-signin-btn"
            variant="secondary"
            onClick={onOpenAuth}
            icon={<LogIn className="w-3.5 h-3.5 shrink-0" />}
          >
            <span>Sign In</span>
          </Button>
          {/* The wrapper owns the breakpoint, so `hidden` never competes with the button's own `inline-flex`. */}
          <span className="hidden sm:inline-flex">
            <IconButton id="navbar-account-btn" label="Account & Security" bordered onClick={onOpenAccount}>
              <UserCog className="w-4 h-4" />
            </IconButton>
          </span>
        </>
      )}
    </>
  );
};
