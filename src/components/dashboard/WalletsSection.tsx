import { identityDisplayColor } from '../../utils/identityPalette';
import React from 'react';
import { ChevronRight, Wallet as WalletGlyph } from 'lucide-react';
import type { Wallet } from '../../types';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';
import { AllocationBar } from '../ui/AllocationBar';
import { EmptyState } from '../ui/EmptyState';
import { getWalletIcon } from '../../utils/walletIcons';
import { emptyWalletsCaption, walletTypeLabel } from '../wallet/walletFormStyles';
import { APP_CURRENCY } from '../../utils/currency';
import { DashboardLink } from './DashboardLink';

interface WalletsSectionProps {
  /** Active wallets only (`useWallets().wallets`). */
  wallets: Wallet[];
  /** `walletShares(wallets)`: a wallet at or below zero has no entry. */
  shares: ReadonlyMap<string, number>;
  /** `netWorth` (L3): the wallet total minus what active debts still owe. */
  netWorth: number;
  walletTotal: number;
  debtRemaining: number;
  onTransfer: () => void;
  onAddWallet: () => void;
  onManageWallets: () => void;
  onOpenWallet: (walletId: string) => void;
}

/**
 * Owner spec 4.4: one card holding net worth with its wallets-minus-debt caption,
 * then the share bar and a row per active wallet, with Transfer, Add wallet and
 * Manage wallets.
 *
 * It keeps the three wallet action ids (`#dashboard-wallets-transfer-btn`,
 * `#dashboard-wallets-add-btn`, `#dashboard-wallets-manage-btn`) and `#dashboard-wallet-card-{id}`,
 * which the suite drives.
 * Net worth keeps `data-testid="net-worth-card"` (`theme.spec.ts`) and is the
 * one figure with the currency code.
 */
export const WalletsSection: React.FC<WalletsSectionProps> = ({
  wallets,
  shares,
  netWorth,
  walletTotal,
  debtRemaining,
  onTransfer,
  onAddWallet,
  onManageWallets,
  onOpenWallet,
}) => (
  <section aria-label="Net worth and wallets" className="min-w-0">
    <Card className="flex flex-col gap-4">
      <div data-testid="net-worth-card" className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">Net worth</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            In {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}{' '}
            <Money value={walletTotal} className="text-fg-secondary" />
            {' · debt '}
            <Money
              value={-debtRemaining}
              className={debtRemaining > 0 ? 'text-expense' : 'text-fg-secondary'}
            />
          </p>
        </div>
        <p className="flex items-baseline gap-1.5 shrink-0">
          <Money
            value={netWorth}
            className={`text-2xl font-semibold tracking-tight ${netWorth < 0 ? 'text-expense' : 'text-fg'}`}
          />
          <span className="text-xs text-fg-muted">{APP_CURRENCY}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 pt-4 border-t border-line">
        <h3 id="dashboard-wallets-heading" className="text-sm font-medium text-fg-secondary">
          Wallets
        </h3>
        {/* Called with no argument: the click event must never reach
            `onOpenTransfer(walletId?)` as a wallet id (transfer-preview.spec.ts
            expects the form's own defaults). */}
        <DashboardLink id="dashboard-wallets-transfer-btn" onClick={() => onTransfer()}>
          Transfer
        </DashboardLink>
      </div>

      {wallets.length === 0 ? (
        <EmptyState
          icon={WalletGlyph}
          title="No wallets yet"
          subtitle="Add a wallet to start tracking where your money is."
        />
      ) : (
        <>
          <AllocationBar
            label="Share of money by wallet"
            emptyCaption={emptyWalletsCaption(wallets)}
            segments={wallets.map((wallet) => ({
              id: wallet.id,
              label: wallet.name,
              value: Number(wallet.balance),
              color: wallet.color,
            }))}
          />
          <div className="flex flex-col gap-1">
            {wallets.map((wallet) => {
              const Icon = getWalletIcon(wallet.type);
              const share = shares.get(wallet.id);
              const balance = Number(wallet.balance);
              return (
                <button
                  key={wallet.id}
                  id={`dashboard-wallet-card-${wallet.id}`}
                  type="button"
                  onClick={() => onOpenWallet(wallet.id)}
                  className="w-full min-w-0 min-h-[44px] flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-control hover:bg-surface-2 text-left transition-control duration-150 cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className="w-9 h-9 shrink-0 rounded-control flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${identityDisplayColor(wallet.color)} 18%, transparent)`, color: identityDisplayColor(wallet.color) }}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-fg truncate">{wallet.name}</span>
                    {/* Wraps rather than truncates, so the share survives a narrow row. */}
                    <span className="block text-xs text-fg-muted">
                      {walletTypeLabel(wallet.type)}
                      {share !== undefined && ` · ${share.toFixed(1)}%`}
                    </span>
                  </span>
                  <Money value={balance} className={`shrink-0 text-base font-semibold ${balance < 0 ? 'text-expense' : 'text-fg'}`} />
                  <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-fg-muted" />
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-x-6 pt-3 border-t border-line">
        <DashboardLink id="dashboard-wallets-add-btn" onClick={() => onAddWallet()}>
          Add wallet
        </DashboardLink>
        <DashboardLink id="dashboard-wallets-manage-btn" onClick={() => onManageWallets()}>
          Manage wallets
        </DashboardLink>
      </div>
    </Card>
  </section>
);
