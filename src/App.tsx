import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { WalletsView } from './views/WalletsView';
import { DebtsView } from './views/DebtsView';
import { DiaryView } from './views/DiaryView';
import { KeywordRulesView } from './views/KeywordRulesView';
import { SecurityView } from './views/SecurityView';
import { TransactionForm } from './components/TransactionForm';
import { AuthModal } from './components/AuthModal';
import { ReloadPrompt } from './components/ReloadPrompt';
import { X } from 'lucide-react';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const { wallets, categories, addTransaction } = useFinance();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setActiveTab(tab as ActiveTab)} />;
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
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col selection:bg-stone-900 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {renderActiveView()}
      </main>

      {/* Auth Modal for Supabase Login / Register */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* PWA Service Worker Update / Offline Prompt */}
      <ReloadPrompt />

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>FinLife Tracker — Full-Stack Personal Finance & Holistic Lifestyle Management</p>
          <p className="text-stone-400 font-mono text-[11px]">Supabase Realtime Cloud Sync • Safe Math.js • Single-Tx Repayments</p>
        </div>
      </footer>

      {/* Quick Add Modal / Responsive Mobile Bottom Sheet */}
      {isQuickAddOpen && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQuickAddOpen(false);
          }}
        >
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-record-modal-title"
            className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 sm:zoom-in-100 slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200"
          >
            {/* Mobile Sheet Handle */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" onClick={() => setIsQuickAddOpen(false)}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300" />
            </div>

            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 id="quick-record-modal-title" className="text-base sm:text-lg font-bold text-stone-900">
                  Quick Record Transaction
                </h3>
                <p className="text-xs text-stone-500 hidden sm:block">
                  Add an expense, income, or wallet transfer instantly
                </p>
              </div>
              <button
                type="button"
                id="close-quick-record-modal-btn"
                onClick={() => setIsQuickAddOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:bg-stone-200 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
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
          </div>
        </div>
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

