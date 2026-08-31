import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ViewLoadingFallback } from './components/ViewLoadingFallback';
import { TransactionForm } from './components/TransactionForm';
import { AuthModal } from './components/AuthModal';
import { ReloadPrompt } from './components/ReloadPrompt';
import { X } from 'lucide-react';

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

const pageTransition = {
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
  const { wallets, categories, addTransaction } = useFinance();

  const handleTabChange = (newTab: ActiveTab) => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    const newIndex = TABS_ORDER.indexOf(newTab);
    if (currentIndex !== -1 && newIndex !== -1 && currentIndex !== newIndex) {
      setDirection(newIndex > currentIndex ? 1 : -1);
    }
    setActiveTab(newTab);
  };

  const handleNextTab = () => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    if (currentIndex < TABS_ORDER.length - 1) {
      setDirection(1);
      setActiveTab(TABS_ORDER[currentIndex + 1]);
    }
  };

  const handlePrevTab = () => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setDirection(-1);
      setActiveTab(TABS_ORDER[currentIndex - 1]);
    }
  };

  // Touch swipe gesture hook for iOS/Android native app feel
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleNextTab(),
    onSwipedRight: () => handlePrevTab(),
    delta: 40,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  });

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => handleTabChange(tab as ActiveTab)} />;
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
        return <DashboardView onNavigate={(tab) => handleTabChange(tab as ActiveTab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans flex flex-col selection:bg-stone-900 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area with Touch Swipe Gestures, Framer Slide Animations & Suspense */}
      <main
        {...swipeHandlers}
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 sm:pb-8 overflow-x-hidden touch-pan-y"
      >
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
            <Suspense fallback={<ViewLoadingFallback />}>
              {renderActiveView()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (block sm:hidden) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      {/* Auth Modal for Supabase Login / Register */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
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
      <AnimatePresence>
        {isQuickAddOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsQuickAddOpen(false);
            }}
          >
            <motion.div 
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-record-modal-title"
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-stone-200/80 dark:border-stone-800"
            >
              {/* Mobile Sheet Handle */}
              <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" onClick={() => setIsQuickAddOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
              </div>

              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100/80 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h3 id="quick-record-modal-title" className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                    Quick Record Transaction
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 hidden sm:block">
                    Add an expense, income, or wallet transfer instantly
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  id="close-quick-record-modal-btn"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-70px)] sm:max-h-[calc(90vh-80px)] overscroll-contain">
                <TransactionForm
                  wallets={wallets.filter((w) => !w.isDeleted)}
                  categories={categories.filter((c) => !c.isDeleted)}
                  onSubmitTransaction={(data) => {
                    addTransaction({
                      ...data,
                      transactionDate: data.date,
                    });
                    setIsQuickAddOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

