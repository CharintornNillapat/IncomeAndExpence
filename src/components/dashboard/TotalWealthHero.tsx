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
    <div className="bg-stone-900 dark:bg-stone-900/90 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-stone-800 dark:border-stone-800/80 relative overflow-hidden backdrop-blur-sm">
      {/* Subtle background decoration */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-300 dark:text-stone-300">
              Total Money Across All Wallets
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
              {activeWalletCount} Accounts Active
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-mono tracking-tight text-white">
                <AnimatedCounter
                  value={totalNetWorth}
                  currencyPrefix={APP_CURRENCY_SYMBOL}
                  duration={1.4}
                />
              </h1>
              <span className="text-xs sm:text-sm md:text-base font-semibold font-mono text-emerald-400">
                {APP_CURRENCY} Total
              </span>
            </div>
          </div>

          <p className="hidden sm:block text-xs sm:text-sm text-stone-400 max-w-xl">
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
            className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-stone-900 bg-emerald-400 hover:bg-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-stone-950 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-stone-950 shrink-0" />
            <span>Transfer Funds</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-add-wallet-btn"
            type="button"
            onClick={onOpenAddWallet}
            className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-stone-800 hover:bg-stone-700 dark:bg-stone-800/80 dark:hover:bg-stone-700 border border-stone-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Add Wallet</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-manage-all-wallets-btn"
            type="button"
            onClick={onOpenManageWallets}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 rounded-xl transition-all cursor-pointer"
          >
            <span>Manage All Wallets</span>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </motion.button>
        </div>
      </div>
    </div>
  );
});

TotalWealthHero.displayName = 'TotalWealthHero';
