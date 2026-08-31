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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
            <WalletIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900">Your Wallets & Accounts</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {wallets.length} Accounts
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Balances across checking, cash, savings, and credit lines
            </p>
          </div>
        </div>
      </div>

      {/* Wallets Cards Grid with Stagger & Tap scale */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {wallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          const percentOfNetWorth = totalNetWorth > 0 ? (wallet.balance / totalNetWorth) * 100 : 0;

          return (
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.96 }}
              key={wallet.id}
              id={`dashboard-wallet-card-${wallet.id}`}
              onClick={() => onOpenWalletModal('OVERVIEW', wallet.id)}
              className="group bg-white rounded-2xl border border-stone-200 hover:border-stone-400 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent bar based on wallet color */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: wallet.color }}
              />

              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-stone-800 line-clamp-1">
                        {wallet.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                        {wallet.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-1 rounded-lg text-stone-300 group-hover:text-stone-700 group-hover:bg-stone-100 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    Balance
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                      wallet.balance < 0 ? 'text-rose-600' : 'text-stone-900'
                    }`}>
                      <AnimatedCounter
                        value={wallet.balance}
                        currencyPrefix={getCurrencySymbol(wallet.currency)}
                        duration={1.2}
                      />
                    </span>
                    <span className="text-[11px] font-semibold font-mono text-stone-400">{wallet.currency}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
                  <span>Share of Total</span>
                  <span className="font-mono font-bold text-stone-700">
                    {percentOfNetWorth > 0 ? `${percentOfNetWorth.toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, Math.max(0, percentOfNetWorth))}%`,
                      backgroundColor: wallet.color 
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 text-[11px]">
                  <span className="text-stone-400 text-[10px]">Click to inspect</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWalletModal('TRANSFER', wallet.id);
                    }}
                    className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
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
