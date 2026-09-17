import React, { useState, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { FinanceProvider } from './context/FinanceContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ViewLoadingFallback } from './components/ViewLoadingFallback';
import { QuickAddModal } from './components/QuickAddModal';
import { AuthModal } from './components/AuthModal';
import { ReloadPrompt } from './components/ReloadPrompt';

// Ordered tab hierarchy for native-like swipe gestures
const TABS_ORDER: ActiveTab[] = [
  'dashboard',
  'transactions',
  'wallets',
  'debts',
  'diary',
  'keywords',
  'security',
];

// Lazy-loaded route views for optimized bundle size & code splitting
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const TransactionsView = lazy(() => import('./views/TransactionsView').then(m => ({ default: m.TransactionsView })));
const WalletsView = lazy(() => import('./views/WalletsView').then(m => ({ default: m.WalletsView })));
const DebtsView = lazy(() => import('./views/DebtsView').then(m => ({ default: m.DebtsView })));
const DiaryView = lazy(() => import('./views/DiaryView').then(m => ({ default: m.DiaryView })));
const KeywordRulesView = lazy(() => import('./views/KeywordRulesView').then(m => ({ default: m.KeywordRulesView })));
const SecurityView = lazy(() => import('./views/SecurityView').then(m => ({ default: m.SecurityView })));

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

const pageTransition: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [direction, setDirection] = useState<number>(0);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // T1 (Phase 2): MainApp no longer calls useFinance(). It previously did so
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

  const handleOpenQuickAdd = useCallback(() => setIsQuickAddOpen(true), []);
  const handleCloseQuickAdd = useCallback(() => setIsQuickAddOpen(false), []);
  const handleOpenAuth = useCallback(() => setIsAuthModalOpen(true), []);
  const handleCloseAuth = useCallback(() => setIsAuthModalOpen(false), []);

  // Touch swipe gesture hook for iOS/Android native app feel
  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleNextTab,
    onSwipedRight: handlePrevTab,
    delta: 40,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  });

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'transactions':
        return <TransactionsView />;
      case 'wallets':
        return <WalletsView />;
      case 'debts':
        return <DebtsView />;
      case 'diary':
        return <DiaryView />;
      case 'keywords':
        return <KeywordRulesView />;
      case 'security':
        return <SecurityView />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans flex flex-col selection:bg-stone-900 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenQuickAdd={handleOpenQuickAdd}
        onOpenAuth={handleOpenAuth}
      />

      {/* Main Content Area with Touch Swipe Gestures, Framer Slide Animations & Suspense */}
      <main
        {...swipeHandlers}
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 sm:pb-8 overflow-x-hidden touch-pan-y"
      >
        <Suspense fallback={<ViewLoadingFallback />}>
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

      {/* Mobile Fixed Bottom Navigation Bar (block sm:hidden) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      {/* Auth Modal for Supabase Login / Register */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuth}
      />

      {/* PWA Service Worker Update / Offline Prompt */}
      <ReloadPrompt />

      {/* Footer (with safe bottom margin on mobile) */}
      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 py-6 mt-6 sm:mt-12 mb-16 sm:mb-0 text-center text-xs text-stone-500 dark:text-stone-400 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>FinLife Tracker — Full-Stack Personal Finance & Holistic Lifestyle Management</p>
          <p className="text-stone-400 dark:text-stone-500 font-mono text-[11px]">Supabase Realtime Cloud Sync • Safe Math.js • Single-Tx Repayments</p>
        </div>
      </footer>

      {/* Quick Add Modal / Responsive Mobile Bottom Sheet with Glassmorphism */}
      <QuickAddModal isOpen={isQuickAddOpen} onClose={handleCloseQuickAdd} />
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

