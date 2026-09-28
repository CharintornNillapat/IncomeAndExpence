import React from 'react';
import { Wallet as WalletIcon, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { Wallet } from '../../types';
import { Money } from '../ui/Money';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { EmptyState } from '../ui/EmptyState';
import { getWalletIcon } from '../../utils/walletIcons';

interface WalletAccountsGridProps {
  wallets: Wallet[];
  totalNetWorth: number;
  /** Opens the WalletPopupModal's Overview tab for this wallet (card click). */
  onOpenWallet: (walletId: string) => void;
  /** Opens the shared TransferFundsModal seeded to this wallet (T41 - the modal's own TRANSFER tab was retired in T39). */
  onOpenTransfer: (walletId: string) => void;
}

export const WalletAccountsGrid: React.FC<WalletAccountsGridProps> = React.memo(({
  wallets,
  totalNetWorth,
  onOpenWallet,
  onOpenTransfer,
}) => {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3 bg-surface-1 p-3.5 sm:p-5 rounded-xl border border-line transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-brand-tint flex items-center justify-center shrink-0 border border-brand-line">
            <WalletIcon className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-fg">Your Wallets & Accounts</h2>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand border border-brand-line">
                {wallets.length} Accounts
              </span>
            </div>
            <p className="hidden sm:block text-xs text-fg-secondary">
              Balances across checking, cash, savings, and credit lines
            </p>
          </div>
        </div>
      </div>

      {/* Wallet cards grid */}
      {wallets.length === 0 ? (
        <Card>
          <EmptyState
            icon={WalletIcon}
            title="No wallets yet"
            subtitle="Add a wallet to start tracking balances, transfers, and transactions"
          />
        </Card>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {wallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          const percentOfNetWorth = totalNetWorth > 0 ? (wallet.balance / totalNetWorth) * 100 : 0;

          return (
            <div
              key={wallet.id}
              id={`dashboard-wallet-card-${wallet.id}`}
              onClick={() => onOpenWallet(wallet.id)}
              className="group bg-surface-1 rounded-xl border border-line hover:border-brand p-4 sm:p-5 transition-colors duration-150 cursor-pointer flex flex-col justify-between relative overflow-hidden"
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
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-fg truncate">
                        {wallet.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider block truncate">
                        {wallet.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-1 rounded-lg text-fg-muted group-hover:text-fg-secondary group-hover:bg-surface-2 transition-colors shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-3.5 sm:mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted block">
                    Balance
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                      wallet.balance < 0 ? 'text-expense' : 'text-fg'
                    }`}>
                      <Money value={wallet.balance} />
                    </span>
                    <span className="text-[11px] font-semibold text-fg-muted">{wallet.currency}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 sm:mt-4 pt-3 border-t border-line">
                <div className="flex items-center justify-between text-[10px] text-fg-secondary mb-1.5">
                  <span>Share of Total</span>
                  <span className="font-bold text-fg-secondary">
                    {percentOfNetWorth > 0 ? `${percentOfNetWorth.toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <ProgressBar percent={percentOfNetWorth} color={wallet.color} size="sm" label={`${wallet.name} share of total`} />

                <div className="flex items-center justify-between mt-2.5 pt-1 text-[11px]">
                  <span className="text-fg-muted text-[10px]">Tap to inspect</span>
                  <button
                    id={`wallet-quick-transfer-${wallet.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTransfer(wallet.id);
                    }}
                    className="min-h-[44px] -my-2 inline-flex items-center gap-1 text-transfer font-semibold hover:underline cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
});

WalletAccountsGrid.displayName = 'WalletAccountsGrid';
