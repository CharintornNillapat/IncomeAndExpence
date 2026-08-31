import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet as WalletIcon, 
  TrendingDown, 
  BookHeart, 
  Sparkles, 
  ShieldCheck, 
  PlusCircle, 
  Cloud,
  CloudOff,
  UserCheck,
  LogIn,
  LogOut
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { getWalletsCurrencyBreakdown } from '../utils/currency';
import { AnimatedCounter } from './AnimatedCounter';

export type ActiveTab = 'dashboard' | 'transactions' | 'wallets' | 'debts' | 'diary' | 'keywords' | 'security';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenQuickAdd, onOpenAuth }) => {
  const { wallets, isAuthenticated, isSyncing, currentUser, signOut, otpPending } = useFinance();

  const currencyBreakdown = useMemo(() => {
    return getWalletsCurrencyBreakdown(wallets);
  }, [wallets]);

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
            <img
              src="/pwa-192x192.png"
              alt="FinLife"
              className="w-10 h-10 rounded-xl object-contain bg-stone-900 shadow-xs border border-stone-800 shrink-0"
              onError={(e) => {
                // In case image isn't loaded yet, fallback gracefully
                const target = e.currentTarget;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-emerald-400 hidden items-center justify-center font-black text-sm shadow-xs border border-stone-800 shrink-0">
              FL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-stone-900 tracking-tight">FinLife Tracker</h1>
                {isAuthenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Cloud className={`w-3 h-3 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                  >
                    <CloudOff className="w-3 h-3 text-amber-600" />
                    <span>Local Only (Click to Sync)</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">
                Full-Stack Personal Finance & Holistic Lifestyle Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-5">
            {/* Live Net Worth aggregated query */}
            <div className="text-right hidden xs:block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                Total Balance
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-stone-900 tracking-tight">
                {currencyBreakdown.isSingleCurrency ? (
                  <>
                    <AnimatedCounter
                      value={currencyBreakdown.primaryTotal}
                      currencyPrefix={currencyBreakdown.primarySymbol}
                      duration={1.2}
                    />{' '}
                    <span className="text-xs font-semibold text-stone-500 font-mono">
                      {currencyBreakdown.primaryCurrency}
                    </span>
                  </>
                ) : (
                  <span className="text-xs sm:text-sm font-semibold">
                    {currencyBreakdown.groups
                      .slice(0, 2)
                      .map((g) => `${g.symbol}${g.total.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${g.currency}`)
                      .join(' • ')}
                  </span>
                )}
              </span>
            </div>

            {/* Auth status action */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 py-1 px-2 rounded-xl text-xs">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="max-w-[90px] sm:max-w-[120px] truncate font-medium text-stone-700 hidden sm:inline">
                  {currentUser.name || currentUser.email}
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  id="navbar-signout-btn"
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                id="navbar-signin-btn"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-200 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-stone-600" />
                <span>Sign In</span>
              </motion.button>
            )}

            {/* Quick Action Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              id="navbar-quick-add-btn"
              type="button"
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-stone-300" />
              <span className="hidden sm:inline">Add Entry</span>
            </motion.button>
          </div>
        </div>

        {/* Navigation Tabs bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-stone-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
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
              </motion.button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

