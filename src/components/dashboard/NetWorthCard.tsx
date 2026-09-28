import React from 'react';
import { Card, Inset } from '../ui/Card';
import { Money } from '../ui/Money';
import { APP_CURRENCY } from '../../utils/currency';

interface NetWorthCardProps {
  /** Spec L3: the wallet total minus what active debts still owe. */
  netWorth: number;
  walletTotal: number;
  walletCount: number;
  debtRemaining: number;
}

/**
 * Spec 6.1 item 2: the hero's left card. The one figure on the page that
 * carries the currency code; every other amount shows ฿ alone (spec 4.8).
 */
export const NetWorthCard: React.FC<NetWorthCardProps> = ({ netWorth, walletTotal, walletCount, debtRemaining }) => (
  <Card padding="lg" className="h-full flex flex-col gap-5">
    <div data-testid="net-worth-card" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">Net worth</h2>
        <span className="text-xs text-fg-muted">Wallets − debt</span>
      </div>

      <p className="flex items-baseline gap-2 flex-wrap">
        {/* Spec section 3: a net figure is the primary text colour, red only when negative. */}
        <Money value={netWorth} className={`text-4xl font-semibold tracking-tight ${netWorth < 0 ? 'text-expense' : 'text-fg'}`} />
        <span className="text-sm text-fg-muted">{APP_CURRENCY}</span>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Inset className="px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-fg-muted">
            In {walletCount} {walletCount === 1 ? 'wallet' : 'wallets'}
          </span>
          <Money value={walletTotal} className="text-base font-semibold text-fg truncate" />
        </Inset>
        <Inset className="px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-fg-muted">Debt remaining</span>
          <Money value={-debtRemaining} className={`text-base font-semibold truncate ${debtRemaining > 0 ? 'text-expense' : 'text-fg'}`} />
        </Inset>
      </div>
    </div>
  </Card>
);
