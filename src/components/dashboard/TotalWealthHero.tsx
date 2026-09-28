import React from 'react';
import { ArrowLeftRight, Plus, ChevronRight } from 'lucide-react';
import { Money } from '../ui/Money';
import { Button } from '../ui/Button';
import { APP_CURRENCY } from '../../utils/currency';

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
    <div className="bg-surface-1 text-fg rounded-xl p-4 sm:p-6 lg:p-8 border border-line">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-fg-secondary">
              Total Money Across All Wallets
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-surface-2 text-fg-secondary border border-line">
              {activeWalletCount} {activeWalletCount === 1 ? 'wallet' : 'wallets'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-4xl sm:text-[40px] sm:leading-[48px] font-bold tracking-tight text-fg">
              <Money value={totalNetWorth} />
            </h1>
            <span className="text-xs sm:text-sm font-semibold text-fg-secondary">
              {APP_CURRENCY}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-fg-muted">
            Sum of every active wallet's balance.
          </p>
        </div>

        {/* Quick actions, each at least 44px tall */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1 sm:pt-0">
          <Button
            id="hero-transfer-funds-btn"
            onClick={onOpenTransfer}
            className="flex-1 sm:flex-initial"
            icon={<ArrowLeftRight className="w-4 h-4 shrink-0" />}
          >
            <span>Transfer Funds</span>
          </Button>

          <Button
            id="hero-add-wallet-btn"
            variant="secondary"
            onClick={onOpenAddWallet}
            className="flex-1 sm:flex-initial"
            icon={<Plus className="w-4 h-4 text-brand shrink-0" />}
          >
            <span>Add Wallet</span>
          </Button>

          <Button
            id="hero-manage-all-wallets-btn"
            variant="secondary"
            onClick={onOpenManageWallets}
            className="w-full sm:w-auto"
          >
            <span>Manage All Wallets</span>
            <ChevronRight className="w-4 h-4 text-fg-muted" />
          </Button>
        </div>
      </div>
    </div>
  );
});

TotalWealthHero.displayName = 'TotalWealthHero';
