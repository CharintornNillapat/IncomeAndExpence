import React from 'react';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet as WalletIcon, 
  TrendingDown, 
  BookHeart, 
  Sparkles, 
  ShieldCheck, 
  PlusCircle, 
  Lock 
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export type ActiveTab = 'dashboard' | 'transactions' | 'wallets' | 'debts' | 'diary' | 'keywords' | 'security';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenQuickAdd }) => {
  const { totalNetWorth, currentSession, otpPending } = useFinance();

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'wallets', label: 'Wallets', icon: WalletIcon },
    { id: 'debts', label: 'Debt Payoff', icon: TrendingDown },
    { id: 'diary', label: 'Holistic Diary', icon: BookHeart },
    { id: 'keywords', label: 'Smart Rules', icon: Sparkles },
    { id: 'security', label: 'Security & Sessions', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top brand & live net worth row */}
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
              PF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-stone-900 tracking-tight">FinLife Tracker</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">
                Full-Stack Personal Finance & Holistic Lifestyle Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Live Net Worth aggregated query */}
            <div className="text-right">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                Total Net Worth
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-stone-900 tracking-tight">
                ${totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Quick Action Button */}
            <button
              id="navbar-quick-add-btn"
              type="button"
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-stone-300" />
              <span className="hidden sm:inline">Add Entry</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-stone-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span>{item.label}</span>
                {item.id === 'security' && otpPending && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
