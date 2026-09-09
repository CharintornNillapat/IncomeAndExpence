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
  LogOut,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../utils/currency';
import { AnimatedCounter } from './AnimatedCounter';
import { useTheme } from '../hooks/useTheme';

export type ActiveTab = 'dashboard' | 'transactions' | 'wallets' | 'debts' | 'diary' | 'keywords' | 'security';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenQuickAdd, onOpenAuth }) => {
  const { totalNetWorth, isAuthenticated, isSyncing, currentUser, signOut, otpPending } = useFinance();
  const { theme, cycleTheme } = useTheme();

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'wallets', label: 'Wallets', icon: WalletIcon },
    { id: 'debts', label: 'Debt Payoff', icon: TrendingDown },
    { id: 'diary', label: 'Holistic Diary', icon: BookHeart },
    { id: 'keywords', label: 'Smart Rules', icon: Sparkles },
    { id: 'security', label: 'Security & Sessions', icon: ShieldCheck },
  ];

  const renderThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'dark':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      case 'system':
      default:
        return <Monitor className="w-4 h-4 text-stone-500 dark:text-stone-400" />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
      default:
        return 'System';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 shadow-2xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top brand & live net worth row */}
        <div className="h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo, App Title & Condensed Sync Badge */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="FinLife"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-stone-900 shadow-xs border border-stone-800"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-stone-900 text-emerald-400 hidden items-center justify-center font-black text-xs sm:text-sm shadow-xs border border-stone-800">
                FL
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Title hidden on mobile */}
                <h1 className="hidden sm:block text-base font-bold text-stone-900 dark:text-white tracking-tight whitespace-nowrap">
                  FinLife Tracker
                </h1>

                {/* Condensed Sync Badge */}
                {isAuthenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    <Cloud className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="sm:hidden">{isSyncing ? 'Syncing...' : 'Synced'}</span>
                    <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
                  </span>
                ) : (
                  <button
                    id="navbar-sync-badge-btn"
                    type="button"
                    onClick={onOpenAuth}
                    title="Click to authenticate & enable cloud sync"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <CloudOff className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="sm:hidden">Local</span>
                    <span className="hidden sm:inline">Local Only (Click to Sync)</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 hidden md:block truncate">
                Full-Stack Personal Finance & Holistic Lifestyle Management
              </p>
            </div>
          </div>

          {/* Right Action Row: Theme Toggle + Live Balance + Sign In + Quick Add with uniform heights */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Theme Toggle Button (Light / Dark / System) */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.04 }}
              type="button"
              id="navbar-theme-toggle-btn"
              onClick={cycleTheme}
              title={`Theme: ${getThemeLabel()} (Click to cycle)`}
              aria-label={`Current theme is ${getThemeLabel()}. Click to switch.`}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            >
              {renderThemeIcon()}
              <span className="sr-only">Toggle theme</span>
            </motion.button>

            {/* Live Net Worth aggregated query */}
            <div className="text-right hidden md:block pr-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 block">
                Total Balance
              </span>
              <span className="text-sm sm:text-base font-bold font-mono text-stone-900 dark:text-white tracking-tight">
                <AnimatedCounter
                  value={totalNetWorth}
                  currencyPrefix={APP_CURRENCY_SYMBOL}
                  duration={1.2}
                />{' '}
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 font-mono">
                  {APP_CURRENCY}
                </span>
              </span>
            </div>

            {/* Auth status action with consistent 44px min touch target */}
            {isAuthenticated ? (
              <div className="min-h-[44px] flex items-center gap-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-2.5 rounded-xl text-xs">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="max-w-[80px] sm:max-w-[120px] truncate font-semibold text-stone-700 dark:text-stone-200 hidden xs:inline">
                  {currentUser.name || currentUser.email}
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  id="navbar-signout-btn"
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
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
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400 shrink-0" />
                <span>Sign In</span>
              </motion.button>
            )}

            {/* Quick Action Button with consistent height & styling */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              id="navbar-quick-add-btn"
              type="button"
              onClick={onOpenQuickAdd}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-stone-900 dark:bg-emerald-600 hover:bg-stone-800 dark:hover:bg-emerald-500 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
              <span className="hidden sm:inline">Add Entry</span>
              <span className="sm:hidden">Add</span>
            </motion.button>
          </div>
        </div>

        {/* Desktop Navigation Tabs Bar (Hidden on mobile, uses MobileBottomNav instead) */}
        <nav 
          aria-label="Desktop Navigation"
          className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-stone-100 dark:border-stone-800 md:justify-start lg:justify-between"
        >
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
                className={`min-h-[40px] sm:min-h-[44px] inline-flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 md:shrink ${
                  isActive
                    ? 'bg-stone-900 dark:bg-stone-800 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500 dark:text-stone-400'} shrink-0`} />
                <span>{item.label}</span>
                {item.id === 'security' && otpPending && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
