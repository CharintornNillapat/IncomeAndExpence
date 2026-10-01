import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useSwipeable, SwipeEventData } from 'react-swipeable';
import { FinanceProvider } from './context/FinanceContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ViewLoadingFallback } from './components/ViewLoadingFallback';
import { AuthModal } from './components/AuthModal';
import { ReloadPrompt } from './components/ReloadPrompt';
import { isInsideHorizontalScroller } from './utils/swipeGuard';

// Ordered tab hierarchy for native-like swipe gestures
const TABS_ORDER: ActiveTab[] = [
  'dashboard',
  'transactions',
  'wallets',
  'debts',
  'diary',
  'categories',
];

// Lazy-loaded route views for optimized bundle size & code splitting
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const TransactionsView = lazy(() => import('./views/TransactionsView').then(m => ({ default: m.TransactionsView })));
const WalletsView = lazy(() => import('./views/WalletsView').then(m => ({ default: m.WalletsView })));
const DebtsView = lazy(() => import('./views/DebtsView').then(m => ({ default: m.DebtsView })));
const DiaryView = lazy(() => import('./views/DiaryView').then(m => ({ default: m.DiaryView })));
const CategoriesView = lazy(() => import('./views/CategoriesView').then(m => ({ default: m.CategoriesView })));

// ADR 0010: deferred shell modals. Each is unreachable until its trigger is
// clicked, and (Quick Add, Transfer) uniquely reaches `vendor-math` - lazy
// importing keeps that weight off the initial critical path. See the ADR for
// why a bare `React.lazy` swap alone is insufficient (and would break the
// exit animation / delayed-close flash) and why `AuthModal`/`ReloadPrompt`
// are not deferred the same way.
const QuickAddModal = lazy(() => import('./components/QuickAddModal').then(m => ({ default: m.QuickAddModal })));
const TransferFundsModal = lazy(() => import('./components/wallet/TransferFundsModal').then(m => ({ default: m.TransferFundsModal })));
const AddWalletModal = lazy(() => import('./components/wallet/AddWalletModal').then(m => ({ default: m.AddWalletModal })));
// ADR 0024: what used to be the Security tab. Same deferred, latched mounting.
const AccountModal = lazy(() => import('./components/account/AccountModal').then(m => ({ default: m.AccountModal })));

// Page slide animation variants for smooth forward/backward transitions
const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 48 : direction < 0 ? -48 : 0,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -48 : direction < 0 ? 48 : 0,
    opacity: 0,
  }),
};

// DESIGN.md MOTION 1: a 200 ms tween, no spring overshoot (Phase 53b).
const pageTransition: Transition = {
  duration: 0.2,
  ease: 'easeOut',
};

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
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
  const handleTabChange = useCallback(
    (newTab: ActiveTab) => {
      const currentIndex = TABS_ORDER.indexOf(activeTab);
      const newIndex = TABS_ORDER.indexOf(newTab);
      if (currentIndex !== -1 && newIndex !== -1 && currentIndex !== newIndex) {
        setDirection(newIndex > currentIndex ? 1 : -1);
      }
      setActiveTab(newTab);
    },
    [activeTab]
  );

  const handleNextTab = useCallback(() => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    if (currentIndex < TABS_ORDER.length - 1) {
      setDirection(1);
      setActiveTab(TABS_ORDER[currentIndex + 1]);
    }
  }, [activeTab]);

  const handlePrevTab = useCallback(() => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setDirection(-1);
      setActiveTab(TABS_ORDER[currentIndex - 1]);
    }
  }, [activeTab]);

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

  // Touch swipe gesture hook for iOS/Android native app feel. ADR 0024: a
  // swipe that starts inside a horizontal scroller (a wide table) scrolls that
  // element and does not also change the tab.
  const startsInScroller = (e: SwipeEventData) => {
    const target = e.event.target;
    return isInsideHorizontalScroller(target, target instanceof Element ? target.closest('main') : null);
  };
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (!startsInScroller(e)) handleNextTab();
    },
    onSwipedRight: (e) => {
      if (!startsInScroller(e)) handlePrevTab();
    },
    delta: 40,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  });

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
        return <DiaryView />;
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

      {/* Main Content Area with Touch Swipe Gestures, Framer Slide Animations & Suspense */}
      <main
        {...swipeHandlers}
        className="flex-1 max-w-7xl w-full mx-auto px-4 pt-4 pb-24 md:px-10 md:pt-8 md:pb-12 overflow-x-hidden touch-pan-y"
      >
        <Suspense fallback={<ViewLoadingFallback view={activeTab} />}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
              className="w-full"
            >
              {renderActiveView()}
            </motion.div>
          </AnimatePresence>
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

      {/* Footer (with safe bottom margin on mobile) */}
      <footer className="border-t border-line bg-surface-1 py-6 mt-6 sm:mt-12 mb-16 sm:mb-0 text-center text-xs text-fg-secondary transition-control duration-200">
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

