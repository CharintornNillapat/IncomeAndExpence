import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Plus, ChevronRight } from 'lucide-react';
import { AnimatedCounter } from '../AnimatedCounter';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../../utils/currency';

interface TotalWealthHeroProps {
  totalNetWorth: number;
  activeWalletCount: number;
  onOpenTransfer: () => void;
  onOpenAddWallet: () => void;
  onOpenManageWallets: () => void;
}

export const TotalWealthHero: React.FC<TotalWealthHeroProps> = React.memo(({
  totalNetWorth,
  activeWalletCount,
  onOpenTransfer,
  onOpenAddWallet,
  onOpenManageWallets,
}) => {
  return (
    <div className="bg-surface-1 text-fg rounded-xl p-4 sm:p-6 lg:p-8 border border-line relative overflow-hidden backdrop-blur-sm">
      {/* Subtle background decoration */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-fill/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-transfer-fill/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-income-fill animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-fg-secondary">
              Total Money Across All Wallets
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-income-tint text-income border border-income-line">
              {activeWalletCount} Accounts Active
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-mono tabular-nums tracking-tight text-fg">
                <AnimatedCounter
                  value={totalNetWorth}
                  currencyPrefix={APP_CURRENCY_SYMBOL}
                  duration={1.4}
                />
              </h1>
              <span className="text-xs sm:text-sm md:text-base font-semibold font-mono text-brand">
                {APP_CURRENCY} Total
              </span>
            </div>
          </div>

          <p className="hidden sm:block text-xs sm:text-sm text-fg-muted max-w-xl">
            Cumulative liquid capital, bank balances, reserve savings, and investment assets across all registered accounts.
          </p>
        </div>

        {/* Quick Actions in Hero with tactile 44px touch targets */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1 sm:pt-0">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-transfer-funds-btn"
            type="button"
            onClick={onOpenTransfer}
            className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-brand-fill hover:bg-brand-fill-hover rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-white shrink-0" />
            <span>Transfer Funds</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-add-wallet-btn"
            type="button"
            onClick={onOpenAddWallet}
            className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-fg bg-surface-2 hover:bg-surface-3 border border-line rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-brand shrink-0" />
            <span>Add Wallet</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-manage-all-wallets-btn"
            type="button"
            onClick={onOpenManageWallets}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-fg bg-surface-2 hover:bg-surface-3 border border-line rounded-lg transition-all cursor-pointer"
          >
            <span>Manage All Wallets</span>
            <ChevronRight className="w-4 h-4 text-fg-muted" />
          </motion.button>
        </div>
      </div>
    </div>
  );
});

TotalWealthHero.displayName = 'TotalWealthHero';
