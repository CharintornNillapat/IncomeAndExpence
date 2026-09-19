import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet as WalletIcon,
  TrendingDown,
  BookHeart,
  Tags,
  ShieldCheck
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

interface NavItemConfig {
  id: ActiveTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Txns', icon: ArrowLeftRight },
  { id: 'wallets', label: 'Wallets', shortLabel: 'Wallets', icon: WalletIcon },
  { id: 'debts', label: 'Debts', shortLabel: 'Debts', icon: TrendingDown },
  { id: 'diary', label: 'Diary', shortLabel: 'Diary', icon: BookHeart },
  { id: 'categories', label: 'Categories', shortLabel: 'Categories', icon: Tags },
  { id: 'security', label: 'Security', shortLabel: 'Security', icon: ShieldCheck },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(({
  activeTab,
  setActiveTab,
}) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-white/95 dark:bg-stone-950/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0.5rem)]"
    >
      <div className="grid grid-cols-7 items-center justify-between px-1 py-1.5 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              whileTap={{ scale: 0.88 }}
              key={item.id}
              id={`mobile-nav-tab-${item.id}`}
              data-testid={`mobile-nav-tab-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[48px] py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-stone-950 dark:text-white font-bold'
                  : 'text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              {/* Active pill indicator backdrop */}
              {isActive && (
                <motion.div
                  layoutId="mobileActiveTabPill"
                  className="absolute inset-x-1 inset-y-1 bg-stone-100 dark:bg-stone-800 rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive ? 'scale-110 text-stone-900 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'
                  }`}
                />
              </div>

              <span className={`text-[9px] tracking-tight mt-0.5 truncate max-w-full leading-tight ${
                isActive ? 'text-stone-900 dark:text-white font-bold' : 'text-stone-500 dark:text-stone-400 font-medium'
              }`}>
                {item.shortLabel}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';
