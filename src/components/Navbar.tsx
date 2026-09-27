import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet as WalletIcon,
  TrendingDown,
  BookHeart,
  Tags,
  PlusCircle,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { NavbarSyncBadge, NavbarBalanceAndAuth } from './navbar/NavbarLedgerStatus';
import { useTheme } from '../hooks/useTheme';

// 'security' left the tab bar in ADR 0024: it is the Account & Security modal
// now, opened from the navbar's account button and the mobile More sheet.
export type ActiveTab = 'dashboard' | 'transactions' | 'wallets' | 'debts' | 'diary' | 'categories';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  onOpenAuth: () => void;
  onOpenAccount: () => void;
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
  { id: 'diary', label: 'Daily Diary', icon: BookHeart },
  { id: 'categories', label: 'Categories', icon: Tags },
];

/**
 * T34: props-only app-shell chrome. Finance-context reads that used to live
 * here (net worth, sync/auth status) now live in `NavbarLedgerStatus.tsx`'s
 * two components, so a ledger write no longer re-renders this header at all
 * - only `NavbarSyncBadge`/`NavbarBalanceAndAuth` re-render. `React.memo` is
 * meaningful now that this component has no context subscription of its own
 * (see CLAUDE.md's re-render rule): its only remaining inputs are `activeTab`
 * and the four callback props, all of which App.tsx already keeps stable
 * except when `activeTab` itself changes.
 */
export const Navbar: React.FC<NavbarProps> = React.memo(({ activeTab, setActiveTab, onOpenQuickAdd, onOpenAuth, onOpenAccount }) => {
  const { theme, cycleTheme } = useTheme();

  const renderThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4 text-pending" />;
      case 'dark':
        return <Moon className="w-4 h-4 text-brand" />;
      case 'system':
      default:
        return <Monitor className="w-4 h-4 text-fg-secondary" />;
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
    <header className="sticky top-0 z-40 bg-surface-1 border-b border-line transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top brand & live net worth row */}
        <div className="h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo, App Title & Condensed Sync Badge */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="FinLife"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-contain bg-surface-2 border border-line"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-2 text-brand hidden items-center justify-center font-black text-xs sm:text-sm border border-line">
                FL
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Title hidden on mobile */}
                <h1 className="hidden sm:block text-base font-bold text-fg tracking-tight whitespace-nowrap">
                  FinLife Tracker
                </h1>

                {/* Condensed Sync Badge */}
                <NavbarSyncBadge onOpenAuth={onOpenAuth} />
              </div>
              <p className="text-xs text-fg-secondary hidden md:block truncate">
                Track money and daily habits
              </p>
            </div>
          </div>

          {/* Right Action Row: Theme Toggle + Live Balance + Sign In + Quick Add with uniform heights */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Theme Toggle Button (Light / Dark / System) */}
            <button
              type="button"
              id="navbar-theme-toggle-btn"
              onClick={cycleTheme}
              title={`Theme: ${getThemeLabel()} (Click to cycle)`}
              aria-label={`Current theme is ${getThemeLabel()}. Click to switch.`}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-fg-secondary transition-colors cursor-pointer"
            >
              {renderThemeIcon()}
              <span className="sr-only">Toggle theme</span>
            </button>

            <NavbarBalanceAndAuth onOpenAuth={onOpenAuth} onOpenAccount={onOpenAccount} />

            {/* Quick Action Button with consistent height & styling */}
            <button
              id="navbar-quick-add-btn"
              type="button"
              onClick={onOpenQuickAdd}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-brand-fill hover:bg-brand-fill-hover text-white px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-white shrink-0" />
              <span className="hidden sm:inline">Add Entry</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs Bar (Hidden on mobile, uses MobileBottomNav instead) */}
        <nav
          aria-label="Desktop Navigation"
          className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-line md:justify-start lg:justify-between"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                data-testid={`nav-tab-${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer shrink-0 md:shrink ${
                  isActive
                    ? 'bg-brand-tint text-brand'
                    : 'text-fg-secondary hover:text-fg hover:bg-surface-2'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand' : 'text-fg-muted'} shrink-0`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
});

Navbar.displayName = 'Navbar';
