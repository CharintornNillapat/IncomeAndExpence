import React from 'react';
import { History } from 'lucide-react';
import type { Category, Wallet } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ActivityFeed } from '../transaction/ActivityFeed';
import { ActivityItem } from '../../selectors/adjustments';
import { DashboardLink } from './DashboardLink';

interface RecentActivityCardProps {
  /** The newest activity, already folded by `foldAdjustmentPairs` (L8) and cut to length, newest first. */
  items: ActivityItem[];
  /** Each day's L11 net over all of that day's rows (`groupByDay`), not only the ones shown. */
  dayNets: ReadonlyMap<string, number>;
  wallets: ReadonlyMap<string, Wallet>;
  categories: ReadonlyMap<string, Category>;
  today: string;
  onViewAll: () => void;
  /** Opens the row on the Transactions page with its edit panel (Phase 58b). Without it the rows are plain text. */
  onOpenTransaction?: (txId: string) => void;
}

/**
 * Spec 6.1 item 6: the newest activity grouped by day (L11), with a balance
 * adjustment that was immediately undone folded into one row that expands
 * (L8). The Transactions page still lists both rows of a pair.
 *
 * Since Phase 58b each row is a button that opens it on the Transactions page
 * with its edit panel (audit 005 finding 4). Each shows its description
 * exactly once, which `transaction.spec.ts` and `storage-persistence.spec.ts`
 * rely on. The feed itself is `ActivityFeed` since Phase 59, shared with the
 * Wallets page; the `dashboard-` id prefix is this card's own.
 */
export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  items,
  dayNets,
  wallets,
  categories,
  today,
  onViewAll,
  onOpenTransaction,
}) => (
  <Card padding="none" className="h-full flex flex-col">
    <div className="flex items-baseline justify-between gap-4 px-6 pt-6 pb-3">
      <h2 className="text-base font-semibold text-fg">Recent activity</h2>
      <DashboardLink id="dashboard-view-all-transactions-btn" onClick={onViewAll}>
        View all
      </DashboardLink>
    </div>

    {items.length === 0 ? (
      <EmptyState icon={History} title="No transactions recorded yet" subtitle="Your latest activity will show here." />
    ) : (
      <div className="px-2 pb-3">
        <ActivityFeed
          items={items}
          dayNets={dayNets}
          wallets={wallets}
          categories={categories}
          today={today}
          idPrefix="dashboard"
          onOpenTransaction={onOpenTransaction}
        />
      </div>
    )}
  </Card>
);
