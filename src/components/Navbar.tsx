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
import { NavbarSyncBadge, NavbarAuth } from './navbar/NavbarLedgerStatus';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
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
  { id: 'debts', label: 'Debt payoff', icon: TrendingDown },
  { id: 'diary', label: 'Daily diary', icon: BookHeart },
  { id: 'categories', label: 'Categories', icon: Tags },
];

/**
 * T34: props-only app-shell chrome. Finance-context reads that used to live
 * here (sync/auth status) now live in `NavbarLedgerStatus.tsx`'s two
 * components, so a ledger write no longer re-renders this header at all
 * - only `NavbarSyncBadge`/`NavbarAuth` re-render. `React.memo` is
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
        return <Sun className="w-4 h-4" />;
      case 'dark':
        return <Moon className="w-4 h-4" />;
      case 'system':
      default:
        return <Monitor className="w-4 h-4" />;
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

  /*
   * Spec section 4.1 (Phase 55a, T206): one sticky row, 64px (56px under
   * `md`). It used to be two rows in one sticky header - brand and balance,
   * then the tab bar - which read as two stacked headers. The total balance
   * left the header: the dashboard already shows it.
   *
   * The tabs sit left, straight after the logo. From `lg` they are text only;
   * between `md` and `lg` they are icons with the label kept for screen
   * readers; under `md` the bottom nav replaces them (spec section 8). The
   * visible title stays "FinLife Tracker" (not the spec's "FinLife"), because
   * `theme.spec.ts` finds the heading by that name. Every control keeps
   * CLAUDE.md's 44px floor rather than the spec's 40px header buttons.
   */
  return (
    <header className="sticky top-0 z-40 bg-header border-b border-line transition-control duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 md:h-16 flex items-center gap-2 sm:gap-3">
        <div className="relative shrink-0">
          <img
            src="/pwa-192x192.png"
            alt="FinLife"
            className="w-9 h-9 rounded-lg object-contain bg-surface-2 border border-line"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              if (target.nextElementSibling) {
                (target.nextElementSibling as HTMLElement).style.display = 'flex';
              }
            }}
          />
          <div className="w-9 h-9 rounded-lg bg-surface-2 text-brand hidden items-center justify-center font-bold text-xs border border-line">
            FL
          </div>
        </div>

        <h1 className="hidden xl:block text-base font-semibold text-fg tracking-tight whitespace-nowrap shrink-0">
          FinLife Tracker
        </h1>

        <nav
          aria-label="Desktop Navigation"
          // `p-1` is the focus outline's room: 2px offset + 2px width, which `overflow-x-auto` would otherwise clip (ADR 0029).
          className="hidden md:flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar p-1 md:ml-1 xl:ml-3"
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
                title={item.label}
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 rounded-button text-sm font-medium whitespace-nowrap transition-control duration-150 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-brand-soft text-brand-soft-text'
                    : 'text-fg-secondary hover:text-fg hover:bg-surface-3'
                }`}
              >
                {/* Icon only below 1280: six labels overflow the bar at 1024 (audit 007 finding 1, ADR 0037). */}
                <Icon className="w-4 h-4 shrink-0 xl:hidden" />
                <span className="sr-only xl:not-sr-only">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          <NavbarSyncBadge onOpenAuth={onOpenAuth} />

          <IconButton
            id="navbar-theme-toggle-btn"
            label={`Theme: ${getThemeLabel()}. Click to switch.`}
            bordered
            onClick={cycleTheme}
          >
            {renderThemeIcon()}
          </IconButton>

          <NavbarAuth onOpenAuth={onOpenAuth} onOpenAccount={onOpenAccount} />

          <Button
            id="navbar-quick-add-btn"
            size="header"
            onClick={onOpenQuickAdd}
            icon={<PlusCircle className="w-4 h-4 shrink-0" />}
          >
            <span className="hidden sm:inline">Add entry</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>
    </header>
  );
});

Navbar.displayName = 'Navbar';
