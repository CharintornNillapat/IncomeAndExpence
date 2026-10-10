import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ViewLoadingFallback } from './components/ViewLoadingFallback';
import { Presence } from './components/ui/motion';
import { AuthModal } from './components/AuthModal';
import { ReloadPrompt } from './components/ReloadPrompt';
import { useTabSwipe } from './hooks/useTabSwipe';
import { TAB_ORDER, tabFromHash, titleForTab, urlForTab } from './utils/tabRoute';
import { dialogEntryOf } from './utils/modalHistory';

// Lazy-loaded route views for optimized bundle size & code splitting
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const TransactionsView = lazy(() => import('./views/TransactionsView').then(m => ({ default: m.TransactionsView })));
const WalletsView = lazy(() => import('./views/WalletsView').then(m => ({ default: m.WalletsView })));
const DebtsView = lazy(() => import('./views/DebtsView').then(m => ({ default: m.DebtsView })));
const DiaryView = lazy(() => import('./views/DiaryView').then(m => ({ default: m.DiaryView })));
const CategoriesView = lazy(() => import('./views/CategoriesView').then(m => ({ default: m.CategoriesView })));

// ADR 0010: deferred shell modals. Each is unreachable until its trigger is
// clicked, and (Quick Add, Transfer) reaches the entry forms' chunks - lazy
// importing keeps that weight off the initial critical path. See the ADR for
// why a bare `React.lazy` swap alone is insufficient (and would break the
// exit animation / delayed-close flash) and why `AuthModal`/`ReloadPrompt`
// are not deferred the same way.
const QuickAddModal = lazy(() => import('./components/QuickAddModal').then(m => ({ default: m.QuickAddModal })));
const TransferFundsModal = lazy(() => import('./components/wallet/TransferFundsModal').then(m => ({ default: m.TransferFundsModal })));
const AddWalletModal = lazy(() => import('./components/wallet/AddWalletModal').then(m => ({ default: m.AddWalletModal })));
// ADR 0024: what used to be the Security tab. Same deferred, latched mounting.
const AccountModal = lazy(() => import('./components/account/AccountModal').then(m => ({ default: m.AccountModal })));

const MainApp: React.FC = () => {
  // ADR 0088: the tab is in the URL's hash, so a refresh or a bookmark opens it.
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => tabFromHash(window.location.hash));
  const [direction, setDirection] = useState<number>(0);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  // T41 (Phase 23): Transfer Funds and Add Wallet are each mounted once here,
  // the same self-subscribing-shell-component pattern as QuickAddModal, so
  // DashboardView's hero/wallet-card triggers and WalletsView's own header
  // buttons open the exact same modal instance regardless of which view is
  // active - a modal owned by one view's local state could never be reached
  // from the other.
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferSourceWalletId, setTransferSourceWalletId] = useState<string | undefined>(undefined);
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState<boolean>(false);
  // ADR 0010: latches, not mirrors of the `isOpen*` state above. Each flips to
  // `true` on first open and never flips back, so the lazy-loaded modal below
  // mounts once and stays mounted - only `isOpen` toggles thereafter, exactly
  // as it did before these were deferred. Gating on the bare `isOpen` state
  // instead would unmount the modal (and its exit animation) the instant it
  // closes.
  const [hasOpenedQuickAdd, setHasOpenedQuickAdd] = useState<boolean>(false);
  const [hasOpenedTransfer, setHasOpenedTransfer] = useState<boolean>(false);
  const [hasOpenedAddWallet, setHasOpenedAddWallet] = useState<boolean>(false);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [hasOpenedAccount, setHasOpenedAccount] = useState<boolean>(false);
  // T40: seeds TransactionsView's wallet filter when a wallet's activity
  // hands off via "View all" (the Wallets page since Phase 59). Cleared by TransactionsView
  // itself right after it reads the value, so a later, unrelated navigation
  // to the tab does not inherit a stale filter.
  const [transactionsWalletFilter, setTransactionsWalletFilter] = useState<string | undefined>(undefined);
  // Phase 58b: the same hand-off for one row - a Dashboard Recent activity row
  // opens on the Transactions page with its edit panel. Cleared the same way.
  const [transactionsSelectedTx, setTransactionsSelectedTx] = useState<string | undefined>(undefined);
  // Phase 59 (ADR 0034): a Dashboard wallet row opens the Wallets page with
  // that wallet selected. Cleared by WalletsView the same way.
  const [walletsSelectedWallet, setWalletsSelectedWallet] = useState<string | undefined>(undefined);
  // Phase 61 (ADR 0036): a diary entry's "N transactions" opens the
  // Transactions page filtered to that day. Cleared by TransactionsView.
  const [transactionsDayFilter, setTransactionsDayFilter] = useState<string | undefined>(undefined);

  // PWA app shortcut "Quick Add Transaction" launches to `/?action=quick-add`.
  // Strip the query param immediately so it doesn't linger in the address bar
  // or get treated as app state on subsequent navigations, then open the
  // modal through the same latch+flag pair its own trigger button uses.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'quick-add') {
      window.history.replaceState({}, '', window.location.pathname);
      setHasOpenedQuickAdd(true);
      setIsQuickAddOpen(true);
    }
  }, []);

  // T1 (Phase 2): MainApp no longer subscribes to the finance context. It did so
  // only to feed the quick-add modal, which meant every financial write
  // re-rendered this entire component - and everything it renders inline
  // (Navbar, the swipe wrapper, the active view, MobileBottomNav, AuthModal,
  // ReloadPrompt, the footer). That logic now lives in QuickAddModal, which
  // subscribes for itself.

  // T3 (Phase 2): stabilized with useCallback so Navbar / MobileBottomNav /
  // the active view don't receive a new function identity on every render -
  // each still depends on `activeTab` (it reads the current tab to compute
  // `direction`), so identity only changes when the tab actually changes,
  // not on every unrelated re-render of MainApp.
  const showTab = useCallback(
    (newTab: ActiveTab) => {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      const newIndex = TAB_ORDER.indexOf(newTab);
      if (currentIndex !== newIndex) setDirection(newIndex > currentIndex ? 1 : -1);
      setActiveTab(newTab);
    },
    [activeTab]
  );

  // ADR 0088 (audit finding 14): every move to another tab is a history entry,
  // so Back and Forward walk between tabs instead of leaving the app. Opening
  // the tab already open adds none.
  const handleTabChange = useCallback(
    (newTab: ActiveTab) => {
      if (newTab !== activeTab) {
        const url = urlForTab(newTab, window.location.pathname, window.location.search);
        // ADR 0089: a tab change from inside a dialog (Quick Add's Repay
        // debt, the More sheet) takes the closing dialog's entry, so Back
        // returns to the tab the dialog was opened on.
        if (dialogEntryOf(window.history.state) !== null) window.history.replaceState(null, '', url);
        else window.history.pushState(null, '', url);
      }
      showTab(newTab);
    },
    [activeTab, showTab]
  );

  // ADR 0089: the title names the tab, for history entries and bookmarks.
  useEffect(() => {
    document.title = titleForTab(activeTab);
  }, [activeTab]);

  // Back, Forward and a hash typed into the address bar (a fragment navigation
  // fires `popstate` too) show the tab the URL now names.
  useEffect(() => {
    const onPopState = () => showTab(tabFromHash(window.location.hash));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [showTab]);

  const handleNextTab = useCallback(() => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex < TAB_ORDER.length - 1) handleTabChange(TAB_ORDER[currentIndex + 1]);
  }, [activeTab, handleTabChange]);

  const handlePrevTab = useCallback(() => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex > 0) handleTabChange(TAB_ORDER[currentIndex - 1]);
  }, [activeTab, handleTabChange]);

  const handleNavigate = useCallback(
    (tab: string) => handleTabChange(tab as ActiveTab),
    [handleTabChange]
  );

  const handleOpenQuickAdd = useCallback(() => {
    setHasOpenedQuickAdd(true);
    setIsQuickAddOpen(true);
  }, []);
  const handleCloseQuickAdd = useCallback(() => setIsQuickAddOpen(false), []);
  const handleOpenAuth = useCallback(() => setIsAuthModalOpen(true), []);
  const handleCloseAuth = useCallback(() => setIsAuthModalOpen(false), []);

  const handleOpenTransfer = useCallback((walletId?: string) => {
    setHasOpenedTransfer(true);
    setTransferSourceWalletId(walletId);
    setIsTransferModalOpen(true);
  }, []);
  const handleCloseTransfer = useCallback(() => setIsTransferModalOpen(false), []);
  const handleOpenAddWallet = useCallback(() => {
    setHasOpenedAddWallet(true);
    setIsAddWalletModalOpen(true);
  }, []);
  const handleCloseAddWallet = useCallback(() => setIsAddWalletModalOpen(false), []);
  const handleOpenAccount = useCallback(() => {
    setHasOpenedAccount(true);
    setIsAccountOpen(true);
  }, []);
  const handleCloseAccount = useCallback(() => setIsAccountOpen(false), []);

  const handleOpenWalletTransactions = useCallback(
    (walletId: string) => {
      setTransactionsWalletFilter(walletId);
      handleTabChange('transactions');
    },
    [handleTabChange]
  );
  const handleConsumeTransactionsWalletFilter = useCallback(() => setTransactionsWalletFilter(undefined), []);
  const handleOpenTransaction = useCallback(
    (txId: string) => {
      setTransactionsSelectedTx(txId);
      handleTabChange('transactions');
    },
    [handleTabChange]
  );
  const handleConsumeTransactionsSelectedTx = useCallback(() => setTransactionsSelectedTx(undefined), []);
  const handleOpenDayTransactions = useCallback(
    (date: string) => {
      setTransactionsDayFilter(date);
      handleTabChange('transactions');
    },
    [handleTabChange]
  );
  const handleConsumeTransactionsDayFilter = useCallback(() => setTransactionsDayFilter(undefined), []);
  const handleOpenWallet = useCallback(
    (walletId?: string) => {
      setWalletsSelectedWallet(walletId);
      handleTabChange('wallets');
    },
    [handleTabChange]
  );
  const handleConsumeWalletsSelectedWallet = useCallback(() => setWalletsSelectedWallet(undefined), []);

  // TRANSFER and DEBT_REPAYMENT left TransactionForm's type toggle in ADR 0013,
  // so the form links out to their dedicated flows instead. These are the only
  // callbacks in the app that let a modal hand off to another surface; they
  // follow handleOpenWalletTransactions above - close what you came from first,
  // then open the destination.
  const handleQuickAddTransfer = useCallback(() => {
    setIsQuickAddOpen(false);
    handleOpenTransfer();
  }, [handleOpenTransfer]);
  const handleQuickAddRepayDebt = useCallback(() => {
    setIsQuickAddOpen(false);
    handleTabChange('debts');
  }, [handleTabChange]);
  const handleNavigateToDebts = useCallback(() => handleTabChange('debts'), [handleTabChange]);

  // Touch swipe between tabs, with the scroller and zoom guards (useTabSwipe).
  const swipeHandlers = useTabSwipe(handleNextTab, handlePrevTab);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={handleNavigate}
            onOpenTransfer={handleOpenTransfer}
            onOpenAddWallet={handleOpenAddWallet}
            onOpenWallet={handleOpenWallet}
            onOpenTransaction={handleOpenTransaction}
          />
        );
      case 'transactions':
        return (
          <TransactionsView
            initialWalletFilter={transactionsWalletFilter}
            onConsumeInitialWalletFilter={handleConsumeTransactionsWalletFilter}
            initialSelectedTxId={transactionsSelectedTx}
            onConsumeInitialSelectedTx={handleConsumeTransactionsSelectedTx}
            initialDayFilter={transactionsDayFilter}
            onConsumeInitialDayFilter={handleConsumeTransactionsDayFilter}
            onOpenTransfer={handleOpenTransfer}
            onNavigateToDebts={handleNavigateToDebts}
          />
        );
      case 'wallets':
        return (
          <WalletsView
            onOpenTransfer={handleOpenTransfer}
            onOpenAddWallet={handleOpenAddWallet}
            onOpenWalletTransactions={handleOpenWalletTransactions}
            onOpenTransaction={handleOpenTransaction}
            initialSelectedWalletId={walletsSelectedWallet}
            onConsumeInitialSelectedWallet={handleConsumeWalletsSelectedWallet}
          />
        );
      case 'debts':
        return <DebtsView />;
      case 'diary':
        return <DiaryView onOpenDayTransactions={handleOpenDayTransactions} />;
      case 'categories':
        return <CategoriesView />;
      default:
        return (
          <DashboardView
            onNavigate={handleNavigate}
            onOpenTransfer={handleOpenTransfer}
            onOpenAddWallet={handleOpenAddWallet}
            onOpenWallet={handleOpenWallet}
            onOpenTransaction={handleOpenTransaction}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-fg font-sans flex flex-col selection:bg-brand-fill selection:text-white transition-control duration-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenQuickAdd={handleOpenQuickAdd}
        onOpenAuth={handleOpenAuth}
        onOpenAccount={handleOpenAccount}
      />

      {/* Main Content Area with Touch Swipe Gestures, Framer Slide Animations & Suspense.
          At least the viewport under the header (56px, 64px from `md`), so the
          footer starts below the fold while a view's chunk loads or a tab's
          exit tween empties it. As `flex-1` alone it sat at the bottom of the
          screen until the Dashboard arrived and pushed it off, most of the
          desktop load's layout shift (Phase 84, ADR 0060). */}
      {/* `--page-dir` steers the tab slide (`motion-page`, ADR 0082): the new
          page comes in from 48px on the side it lies, the old one leaves
          toward the other, both over 200 ms. */}
      <main
        {...swipeHandlers}
        style={{ '--page-dir': direction } as React.CSSProperties}
        className="flex-1 min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] md:min-h-[calc(100dvh-4rem-env(safe-area-inset-top))] max-w-7xl w-full mx-auto px-4 pt-4 pb-24 md:px-10 md:pt-8 md:pb-12 overflow-x-hidden touch-pan-y"
      >
        <Suspense fallback={<ViewLoadingFallback view={activeTab} />}>
          <Presence>
            <div key={activeTab} className="motion-page w-full">
              {renderActiveView()}
            </div>
          </Presence>
        </Suspense>
      </main>

      {/* Bottom navigation under 768px (md:hidden), where the header's tabs hide (spec section 8) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenQuickAdd={handleOpenQuickAdd}
        onOpenAccount={handleOpenAccount}
      />

      {/* Auth Modal for Supabase Login / Register */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuth}
      />

      {/* PWA Service Worker Update / Offline Prompt */}
      <ReloadPrompt />

      {/* Footer. Below `md` its bottom margin is the mobile nav's height: a
          52px tab, 12px of padding and a 1px top border (4rem + 1px), plus the
          nav's own safe-area expression (ADR 0070, 0071). */}
      <footer className="border-t border-line bg-surface-1 py-6 mt-6 sm:mt-12 mb-[calc(4rem+1px+env(safe-area-inset-bottom,0.5rem))] md:mb-0 text-center text-xs text-fg-secondary transition-control duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>FinLife Tracker · Track money and daily habits</p>
        </div>
      </footer>

      {/* Quick Add Modal / Responsive Mobile Bottom Sheet with Glassmorphism.
          ADR 0010: lazy-loaded, mounted on first open via the `hasOpened*`
          latch, and never unmounted after - only `isOpen` toggles thereafter. */}
      {hasOpenedQuickAdd && (
        <Suspense fallback={null}>
          <QuickAddModal
            isOpen={isQuickAddOpen}
            onClose={handleCloseQuickAdd}
            onRequestTransfer={handleQuickAddTransfer}
            onRequestRepayDebt={handleQuickAddRepayDebt}
          />
        </Suspense>
      )}

      {/* Transfer Funds & Add Wallet Modals (T41) - single shell-level instances shared by DashboardView and WalletsView */}
      {hasOpenedTransfer && (
        <Suspense fallback={null}>
          <TransferFundsModal
            isOpen={isTransferModalOpen}
            onClose={handleCloseTransfer}
            initialSourceWalletId={transferSourceWalletId}
          />
        </Suspense>
      )}
      {hasOpenedAddWallet && (
        <Suspense fallback={null}>
          <AddWalletModal isOpen={isAddWalletModalOpen} onClose={handleCloseAddWallet} />
        </Suspense>
      )}
      {hasOpenedAccount && (
        <Suspense fallback={null}>
          <AccountModal isOpen={isAccountOpen} onClose={handleCloseAccount} onRequestSignIn={handleOpenAuth} />
        </Suspense>
      )}
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <MainApp />
    </FinanceProvider>
  );
}

