import React from 'react';
import { ChevronRight, Wallet as WalletGlyph } from 'lucide-react';
import type { Wallet } from '../../types';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';
import { AllocationBar } from '../ui/AllocationBar';
import { EmptyState } from '../ui/EmptyState';
import { getWalletIcon } from '../../utils/walletIcons';
import { walletTypeLabel } from '../wallet/walletFormStyles';
import { DashboardLink } from './DashboardLink';

interface WalletsSectionProps {
  /** Active wallets only (`useWallets().wallets`). */
  wallets: Wallet[];
  /** `walletShares(wallets)`: a wallet at or below zero has no entry. */
  shares: ReadonlyMap<string, number>;
  onTransfer: () => void;
  onAddWallet: () => void;
  onManageWallets: () => void;
  onOpenWallet: (walletId: string) => void;
}

/**
 * Spec 6.1 item 4: a plain heading with its links, then one card holding the
 * AllocationBar and a row per wallet. It replaces the carded wallet grid, its
 * "Tap to inspect" line and the per-card share bars.
 *
 * The links keep the old hero's ids (`#hero-transfer-funds-btn`,
 * `#hero-add-wallet-btn`, `#hero-manage-all-wallets-btn`), and each row keeps
 * `#dashboard-wallet-card-{id}`: the Playwright suite drives all four. Each
 * row is now a real `<button>`. Since Phase 59 it opens the Wallets page
 * with that wallet selected (ADR 0034); "Manage wallets" opens the page.
 */
export const WalletsSection: React.FC<WalletsSectionProps> = ({
  wallets,
  shares,
  onTransfer,
  onAddWallet,
  onManageWallets,
  onOpenWallet,
}) => (
  <section aria-labelledby="dashboard-wallets-heading" className="flex flex-col gap-3">
    <div className="flex items-baseline justify-between gap-x-5 gap-y-1 flex-wrap">
      <h2 id="dashboard-wallets-heading" className="text-base font-semibold text-fg">
        Wallets
      </h2>
      <div className="flex items-center gap-x-5 flex-wrap">
        {/* Called with no argument: the click event must never reach
            `onOpenTransfer(walletId?)` as a wallet id (transfer-preview.spec.ts
            expects the form's own defaults). */}
        <DashboardLink id="hero-transfer-funds-btn" onClick={() => onTransfer()}>
          Transfer
        </DashboardLink>
        <DashboardLink id="hero-add-wallet-btn" onClick={() => onAddWallet()}>
          Add wallet
        </DashboardLink>
        <DashboardLink id="hero-manage-all-wallets-btn" onClick={() => onManageWallets()}>
          Manage wallets
        </DashboardLink>
      </div>
    </div>

    <Card className="flex flex-col gap-5">
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
            emptyCaption="No money in your wallets yet"
            segments={wallets.map((wallet) => ({
              id: wallet.id,
              label: wallet.name,
              value: Number(wallet.balance),
              color: wallet.color,
            }))}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  className="w-full min-w-0 flex items-center gap-3.5 px-4 py-3.5 rounded-inner bg-surface-2 border border-line hover:border-line-strong text-left transition-control duration-150 cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className="w-10 h-10 shrink-0 rounded-control flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${wallet.color} 18%, transparent)`, color: wallet.color }}
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
    </Card>
  </section>
);
