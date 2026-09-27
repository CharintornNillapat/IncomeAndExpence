import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet as WalletIcon,
  TrendingDown,
  BookHeart,
  Tags,
  Plus,
  MoreHorizontal,
  UserCog,
  ChevronRight,
} from 'lucide-react';
import { ActiveTab } from './Navbar';
import { Modal } from './Modal';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  onOpenAccount: () => void;
}

interface NavItemConfig {
  id: ActiveTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}

/**
 * ADR 0024: five slots a thumb can hit - Home, Transactions, a centre Quick
 * Add, Wallets, More - instead of seven 9-px-labelled ones. The three tabs
 * that moved into More keep their `mobile-nav-tab-*` ids and `aria-current`,
 * so the selector contract survives the move.
 */
const PRIMARY_LEFT: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Txns', icon: ArrowLeftRight },
];
const PRIMARY_RIGHT: NavItemConfig[] = [
  { id: 'wallets', label: 'Wallets', shortLabel: 'Wallets', icon: WalletIcon },
];
const MORE_ITEMS: NavItemConfig[] = [
  { id: 'debts', label: 'Debt Payoff', shortLabel: 'Debts', icon: TrendingDown },
  { id: 'diary', label: 'Daily Diary', shortLabel: 'Diary', icon: BookHeart },
  { id: 'categories', label: 'Categories', shortLabel: 'Categories', icon: Tags },
];
const MORE_TAB_IDS = new Set<ActiveTab>(MORE_ITEMS.map((i) => i.id));

const slotClass = (isActive: boolean) =>
  `relative flex flex-col items-center justify-center min-h-[52px] py-1 px-0.5 rounded-lg transition-colors duration-150 cursor-pointer ${
    isActive
      ? 'text-fg font-bold'
      : 'text-fg-muted hover:text-fg'
  }`;

const SlotBody: React.FC<{ icon: React.FC<{ className?: string }>; label: string; isActive: boolean }> = ({
  icon: Icon,
  label,
  isActive,
}) => (
  <>
    {isActive && (
      <motion.div
        layoutId="mobileActiveTabPill"
        className="absolute inset-x-1 inset-y-1 bg-brand-tint rounded-lg -z-10"
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    )}
    <Icon
      className={`w-5 h-5 transition-colors duration-150 ${
        isActive ? 'text-brand' : 'text-fg-muted'
      }`}
    />
    <span
      className={`text-[11px] tracking-tight mt-0.5 truncate max-w-full leading-tight ${
        isActive ? 'text-fg font-bold' : 'text-fg-secondary font-medium'
      }`}
    >
      {label}
    </span>
  </>
);

export const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onOpenAccount,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isMoreActive = MORE_TAB_IDS.has(activeTab);

  const renderTab = (item: NavItemConfig) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        id={`mobile-nav-tab-${item.id}`}
        data-testid={`mobile-nav-tab-${item.id}`}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
        type="button"
        onClick={() => setActiveTab(item.id)}
        className={slotClass(isActive)}
      >
        <SlotBody icon={item.icon} label={item.shortLabel} isActive={isActive} />
      </button>
    );
  };

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-surface-1/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom,0.5rem)]"
      >
        <div className="grid grid-cols-5 items-center px-1 py-1.5 max-w-lg mx-auto">
          {PRIMARY_LEFT.map(renderTab)}

          {/* Centre Quick Add: the app's most frequent action, one thumb away. */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              id="mobile-nav-quick-add-btn"
              data-testid="mobile-nav-quick-add-btn"
              aria-label="Add a transaction"
              onClick={onOpenQuickAdd}
              className="w-12 h-12 -mt-5 rounded-xl bg-brand-fill hover:bg-brand-fill-hover text-white shadow-quick-add flex items-center justify-center transition-colors duration-150 cursor-pointer border-4 border-surface-1"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {PRIMARY_RIGHT.map(renderTab)}

          <button
            type="button"
            id="mobile-nav-more-btn"
            data-testid="mobile-nav-more-btn"
            aria-label="More"
            aria-haspopup="dialog"
            aria-expanded={isMoreOpen}
            data-active={isMoreActive ? 'true' : undefined}
            onClick={() => setIsMoreOpen(true)}
            className={slotClass(isMoreActive)}
          >
            <SlotBody icon={MoreHorizontal} label="More" isActive={isMoreActive} />
          </button>
        </div>
      </nav>

      {/* A sibling of <nav>, never a child: the nav's backdrop-filter makes it
          the containing block for fixed descendants, which would clip the
          sheet's full-screen overlay to the bar. */}
      <Modal
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        title="More"
        panelId="mobile-nav-more-sheet"
        titleId="mobile-nav-more-title"
        bodyClassName="space-y-1.5"
      >
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`mobile-nav-tab-${item.id}`}
              data-testid={`mobile-nav-tab-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                setActiveTab(item.id);
              }}
              className={`w-full min-h-[52px] flex items-center gap-3 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-brand-tint text-brand'
                  : 'text-fg hover:bg-surface-2'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>
          );
        })}
        <div className="border-t border-line pt-1.5">
          <button
            id="mobile-nav-account-btn"
            type="button"
            onClick={() => {
              setIsMoreOpen(false);
              onOpenAccount();
            }}
            className="w-full min-h-[52px] flex items-center gap-3 px-3 rounded-lg text-sm font-semibold text-fg hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <UserCog className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left">Account &amp; Security</span>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>
        </div>
      </Modal>
    </>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';
