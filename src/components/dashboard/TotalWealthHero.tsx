import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Plus, ChevronRight } from 'lucide-react';
import { AnimatedCounter } from '../AnimatedCounter';
import { WalletsCurrencyBreakdown } from '../../utils/currency';

interface TotalWealthHeroProps {
  currencyBreakdown: WalletsCurrencyBreakdown;
  activeWalletCount: number;
  onOpenTransfer: () => void;
  onOpenAddWallet: () => void;
  onOpenManageWallets: () => void;
}

export const TotalWealthHero: React.FC<TotalWealthHeroProps> = React.memo(({
  currencyBreakdown,
  activeWalletCount,
  onOpenTransfer,
  onOpenAddWallet,
  onOpenManageWallets,
}) => {
  return (
    <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
              Total Money Across All Wallets
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              {activeWalletCount} Accounts Active
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight text-white">
                <AnimatedCounter
                  value={currencyBreakdown.primaryTotal}
                  currencyPrefix={currencyBreakdown.primarySymbol}
                  duration={1.4}
                />
              </h1>
              <span className="text-sm sm:text-base font-semibold font-mono text-emerald-400">
                {currencyBreakdown.primaryCurrency} Total Balance
              </span>
            </div>

            {!currencyBreakdown.isSingleCurrency && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-stone-400 font-medium">Currency Breakdown:</span>
                {currencyBreakdown.groups.map((group) => (
                  <span
                    key={group.currency}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700 text-xs font-mono font-bold text-stone-200"
                  >
                    <span className="text-emerald-400">{group.symbol}</span>
                    <AnimatedCounter value={group.total} duration={1.2} />
                    <span className="text-[10px] text-stone-400 font-sans">{group.currency} ({group.count})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm text-stone-400 max-w-xl">
            Cumulative liquid capital, bank balances, reserve savings, and investment assets across all registered accounts.
          </p>
        </div>

        {/* Quick Actions in Hero with tactile micro-interactions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-transfer-funds-btn"
            type="button"
            onClick={onOpenTransfer}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-stone-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-stone-950" />
            <span>Transfer Funds</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-add-wallet-btn"
            type="button"
            onClick={onOpenAddWallet}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Wallet</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            id="hero-manage-all-wallets-btn"
            type="button"
            onClick={onOpenManageWallets}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 rounded-xl transition-all cursor-pointer"
          >
            <span>Manage All</span>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </motion.button>
        </div>
      </div>
    </div>
  );
});

TotalWealthHero.displayName = 'TotalWealthHero';
