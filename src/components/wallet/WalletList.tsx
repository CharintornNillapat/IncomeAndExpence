import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { Wallet } from '../../types';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';
import { AllocationBar } from '../ui/AllocationBar';
import { Button } from '../ui/Button';
import { getWalletIcon } from '../../utils/walletIcons';
import { walletTypeLabel } from './walletFormStyles';

interface WalletListProps {
  /** Active wallets (`useWallets().wallets`), in their stored order. */
  wallets: Wallet[];
  /** `archivedWallets(allWallets)`: listed under a collapsed "Archived" group to unarchive. */
  archived: Wallet[];
  /** `walletShares(wallets)`: a wallet at or below zero has no entry. */
  shares: ReadonlyMap<string, number>;
  /** The wallet whose details show. Undefined below `lg` until one is tapped. */
  selectedId?: string;
  onSelect: (walletId: string) => void;
  onAddWallet: () => void;
  onUnarchive: (walletId: string) => void;
  /** The wallet an unarchive is in flight for, so its button cannot be pressed twice. */
  unarchivingId?: string | null;
}

/**
 * Spec 6.3's master list (Phase 59, ADR 0034): the AllocationBar, one row per
 * active wallet, a dashed "Add wallet", and the archived wallets folded away
 * under a toggle.
 *
 * Each row is a `<button id="wallet-entity-{id}">` holding
 * `data-testid="wallet-balance-{id}"`: the Playwright suite reads a balance
 * through that pair. The selected row has `TransactionRow`'s selected look
 * (DESIGN.md: `brand-soft` and the inset violet edge, not the spec's
 * `#1C1930`).
 */
export const WalletList: React.FC<WalletListProps> = ({
  wallets,
  archived,
  shares,
  selectedId,
  onSelect,
  onAddWallet,
  onUnarchive,
  unarchivingId,
}) => {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <Card className="flex flex-col gap-4">
      {wallets.length > 0 && (
        <AllocationBar
          label="Share of money by wallet"
          segments={wallets.map((wallet) => ({
            id: wallet.id,
            label: wallet.name,
            value: Number(wallet.balance),
            color: wallet.color,
          }))}
        />
      )}

      <ul className="flex flex-col gap-2">
        {wallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          const share = shares.get(wallet.id);
          const balance = Number(wallet.balance);
          const isSelected = wallet.id === selectedId;
          return (
            <li key={wallet.id}>
              <button
                id={`wallet-entity-${wallet.id}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(wallet.id)}
                className={`w-full min-w-0 flex items-center gap-3 px-3.5 py-3 rounded-inner border text-left transition-control duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-soft border-brand-soft-line shadow-[inset_3px_0_0_var(--focus)]'
                    : 'bg-surface-2 border-line hover:border-line-strong'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-10 h-10 shrink-0 rounded-control flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${wallet.color} 18%, transparent)`, color: wallet.color }}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-fg break-words">{wallet.name}</span>
                  <span className="block text-xs text-fg-muted">
                    {walletTypeLabel(wallet.type)}
                    {share !== undefined && ` · ${share.toFixed(1)}%`}
                  </span>
                </span>
                <span data-testid={`wallet-balance-${wallet.id}`} className="shrink-0">
                  <Money value={balance} className={`text-sm font-semibold ${balance < 0 ? 'text-expense' : 'text-fg'}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        id="wallet-list-add-btn"
        type="button"
        onClick={() => onAddWallet()}
        className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-inner border border-dashed border-line-strong text-sm font-medium text-fg-secondary hover:text-fg transition-control duration-150 cursor-pointer"
      >
        <Plus aria-hidden="true" className="w-4 h-4" />
        Add wallet
      </button>

      {archived.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <button
            id="wallet-archived-toggle"
            type="button"
            aria-expanded={showArchived}
            aria-controls="wallet-archived-list"
            onClick={() => setShowArchived((open) => !open)}
            className="min-h-[44px] -mx-2 px-2 flex items-center justify-between gap-2 rounded-control text-sm font-medium text-fg-secondary hover:text-fg transition-control duration-150 cursor-pointer"
          >
            <span>Archived ({archived.length})</span>
            {showArchived ? (
              <ChevronUp aria-hidden="true" className="w-4 h-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="w-4 h-4" />
            )}
          </button>
          {showArchived && (
            <ul id="wallet-archived-list" className="flex flex-col gap-2">
              {archived.map((wallet) => (
                <li
                  key={wallet.id}
                  id={`wallet-archived-${wallet.id}`}
                  className="flex items-center gap-3 px-3.5 py-2 rounded-inner border border-line"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-fg-secondary truncate">{wallet.name}</span>
                    <Money value={Number(wallet.balance)} className="block text-xs text-fg-muted" />
                  </span>
                  <Button
                    id={`wallet-unarchive-btn-${wallet.id}`}
                    variant="secondary"
                    disabled={unarchivingId === wallet.id}
                    onClick={() => onUnarchive(wallet.id)}
                  >
                    Unarchive
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};
