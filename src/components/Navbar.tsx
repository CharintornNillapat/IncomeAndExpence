import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet as WalletIcon,
  TrendingDown,
  BookHeart,
  Tags,
  ShieldCheck,
  PlusCircle,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { NavbarSyncBadge, NavbarBalanceAndAuth } from './navbar/NavbarLedgerStatus';
import { useTheme } from '../hooks/useTheme';

export type ActiveTab = 'dashboard' | 'transactions' | 'wallets' | 'debts' | 'diary' | 'categories' | 'security';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  onOpenAuth: () => void;
}

interface NavItemConfig {
  id: ActiveTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'wallets', label: 'Wallets', icon: WalletIcon },
  { id: 'debts', label: 'Debt Payoff', icon: TrendingDown },
  { id: 'diary', label: 'Holistic Diary', icon: BookHeart },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'security', label: 'Security & Sessions', icon: ShieldCheck },
];

/**
 * T34: props-only app-shell chrome. Finance-context reads that used to live
 * here (net worth, sync/auth status) now live in `NavbarLedgerStatus.tsx`'s
 * two components, so a ledger write no longer re-renders this header at all
 * - only `NavbarSyncBadge`/`NavbarBalanceAndAuth` re-render. `React.memo` is
 * meaningful now that this component has no context subscription of its own
 * (see CLAUDE.md's re-render rule): its only remaining inputs are `activeTab`
 * and the three callback props, all of which App.tsx already keeps stable
 * except when `activeTab` itself changes.
 */
export const Navbar: React.FC<NavbarProps> = React.memo(({ activeTab, setActiveTab, onOpenQuickAdd, onOpenAuth }) => {
  const { theme, cycleTheme } = useTheme();

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
                <NavbarSyncBadge onOpenAuth={onOpenAuth} />
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

            <NavbarBalanceAndAuth onOpenAuth={onOpenAuth} />

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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={item.id}
                id={`nav-tab-${item.id}`}
                data-testid={`nav-tab-${item.id}`}
                aria-current={isActive ? 'page' : undefined}
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
              </motion.button>
            );
          })}
        </nav>
      </div>
    </header>
  );
});

Navbar.displayName = 'Navbar';
