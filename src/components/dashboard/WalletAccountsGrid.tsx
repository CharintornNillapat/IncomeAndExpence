import React from 'react';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, ChevronRight, ArrowLeftRight, Landmark, Banknote, PiggyBank, CreditCard, Coins } from 'lucide-react';
import { Wallet, WalletType } from '../../types';
import { AnimatedCounter } from '../AnimatedCounter';
import { getCurrencySymbol } from '../../utils/currency';

interface WalletAccountsGridProps {
  wallets: Wallet[];
  totalNetWorth: number;
  onOpenWalletModal: (tab: 'OVERVIEW' | 'TRANSFER' | 'ADD_WALLET', walletId?: string) => void;
}

const getWalletIcon = (type: WalletType) => {
  switch (type) {
    case 'BANK_ACCOUNT': return Landmark;
    case 'CASH': return Banknote;
    case 'SAVINGS': return PiggyBank;
    case 'CREDIT_CARD': return CreditCard;
    default: return Coins;
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 24,
      stiffness: 300,
    },
  },
};

export const WalletAccountsGrid: React.FC<WalletAccountsGridProps> = React.memo(({
  wallets,
  totalNetWorth,
  onOpenWalletModal,
}) => {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3.5 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-stone-900 dark:bg-stone-800 text-white flex items-center justify-center shadow-xs shrink-0 border border-stone-800 dark:border-stone-700">
            <WalletIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Your Wallets & Accounts</h2>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {wallets.length} Accounts
              </span>
            </div>
            <p className="hidden sm:block text-xs text-stone-500 dark:text-stone-400">
              Balances across checking, cash, savings, and credit lines
            </p>
          </div>
        </div>
      </div>

      {/* Wallets Cards Grid with Stagger & Tap scale */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {wallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          const percentOfNetWorth = totalNetWorth > 0 ? (wallet.balance / totalNetWorth) * 100 : 0;

          return (
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.97 }}
              key={wallet.id}
              id={`dashboard-wallet-card-${wallet.id}`}
              onClick={() => onOpenWalletModal('OVERVIEW', wallet.id)}
              className="group bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent bar based on wallet color */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: wallet.color }}
              />

              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-stone-800 dark:group-hover:text-stone-100 truncate">
                        {wallet.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider block truncate">
                        {wallet.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-1 rounded-lg text-stone-300 dark:text-stone-600 group-hover:text-stone-700 dark:group-hover:text-stone-300 group-hover:bg-stone-100 dark:group-hover:bg-stone-800 transition-colors shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-3.5 sm:mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 block">
                    Balance
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                      wallet.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-white'
                    }`}>
                      <AnimatedCounter
                        value={wallet.balance}
                        currencyPrefix={getCurrencySymbol(wallet.currency)}
                        duration={1.2}
                      />
                    </span>
                    <span className="text-[11px] font-semibold font-mono text-stone-400 dark:text-stone-500">{wallet.currency}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 sm:mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
                <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 mb-1.5">
                  <span>Share of Total</span>
                  <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                    {percentOfNetWorth > 0 ? `${percentOfNetWorth.toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, Math.max(0, percentOfNetWorth))}%`,
                      backgroundColor: wallet.color 
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2.5 pt-1 text-[11px]">
                  <span className="text-stone-400 dark:text-stone-500 text-[10px]">Tap to inspect</span>
                  <button
                    id={`wallet-quick-transfer-${wallet.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWalletModal('TRANSFER', wallet.id);
                    }}
                    className="min-h-[44px] -my-2 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

WalletAccountsGrid.displayName = 'WalletAccountsGrid';
