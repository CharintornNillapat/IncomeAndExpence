import React, { useState } from 'react';
import { ArrowLeftRight, History, Pencil, SlidersHorizontal } from 'lucide-react';
import type { Category, Wallet, WalletEdit, WalletType } from '../../types';
import type { MutationResult } from '../../context/FinanceContext';
import { Card, Inset } from '../ui/Card';
import { Money } from '../ui/Money';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { OverflowMenu } from '../ui/OverflowMenu';
import { ActivityFeed } from '../transaction/ActivityFeed';
import { DashboardLink } from '../dashboard/DashboardLink';
import { ActivityItem } from '../../selectors/adjustments';
import { getWalletIcon } from '../../utils/walletIcons';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../../utils/currency';
import { formatShortDate, toIsoDate } from '../../utils/date';
import { ERROR_BANNER_CLASS, LABEL_CLASS, OPTION_CLASS, inputClass, selectClass } from '../../utils/formStyles';
import { identityColorName } from '../../utils/identityPalette';
import { WALLET_TYPE_OPTIONS, walletTypeLabel } from './walletFormStyles';
import { IDENTITY_COLORS } from '../../utils/identityPalette';

interface WalletDetailProps {
  wallet: Wallet;
  /** This wallet's newest live rows, folded by `foldAdjustmentPairs` (L8) and cut to length. */
  items: ActivityItem[];
  /** Each day's L11 net over all of this wallet's rows that day. */
  dayNets: ReadonlyMap<string, number>;
  /** Every wallet, deleted ones too, so a transfer names its other side. */
  wallets: ReadonlyMap<string, Wallet>;
  categories: ReadonlyMap<string, Category>;
  today: string;
  /**
   * Inside the bottom sheet below `lg`, whose title already names the wallet:
   * the header then leaves the name out rather than say it twice.
   */
  inSheet?: boolean;
  onTransferOut: (walletId: string) => void;
  /** Sets the balance by writing the signed difference as an ADJUSTMENT row (ADR 0024). */
  onAdjustBalance: (walletId: string, newBalance: number) => Promise<MutationResult>;
  onEdit: (walletId: string, details: WalletEdit) => Promise<MutationResult>;
  onRequestArchive: (wallet: Wallet) => void;
  onRequestDelete: (wallet: Wallet) => void;
  onViewAllTransactions: (walletId: string) => void;
  onOpenTransaction: (txId: string) => void;
}

/**
 * Spec 6.3's detail (Phase 59, ADR 0034): the selected wallet's header with
 * Edit and a "⋯" menu (Archive, Delete), its balance with Transfer out and
 * Adjust balance, and its recent activity, where a transfer is signed by its
 * direction into or out of this wallet.
 *
 * The Adjust balance editor moved here unchanged from the retired
 * `WalletPopupModal`, ids included (`#wallet-adjust-btn-{id}`,
 * `#wallet-adjust-input`, `#wallet-adjust-save-btn`). It stays a bespoke
 * one-field form, not `TransactionForm` (CLAUDE.md).
 *
 * One instance per wallet (`key={wallet.id}`, ADR 0056). An edit or an
 * adjustment still in flight when another wallet is selected finishes on the
 * old instance, which is gone, so it cannot close or fill in the new wallet's
 * editor. Before, an effect on `wallet.id` closed the editors, and a late
 * save then closed the next wallet's editor too, with its draft.
 */
export const WalletDetail: React.FC<WalletDetailProps> = (props) => <WalletDetailBody key={props.wallet.id} {...props} />;

const WalletDetailBody: React.FC<WalletDetailProps> = ({
  wallet,
  items,
  dayNets,
  wallets,
  categories,
  today,
  inSheet = false,
  onTransferOut,
  onAdjustBalance,
  onEdit,
  onRequestArchive,
  onRequestDelete,
  onViewAllTransactions,
  onOpenTransaction,
}) => {
  const Icon = getWalletIcon(wallet.type);
  const balance = Number(wallet.balance);

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustedBalance, setAdjustedBalance] = useState(balance);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<WalletEdit>({ name: wallet.name, type: wallet.type, color: wallet.color });
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openAdjust = () => {
    setAdjustedBalance(balance);
    setAdjustError(null);
    setIsEditing(false);
    setIsAdjusting(true);
  };

  const saveAdjust = async () => {
    setIsSavingAdjust(true);
    setAdjustError(null);
    const result = await onAdjustBalance(wallet.id, adjustedBalance);
    setIsSavingAdjust(false);
    if (!result.success) {
      setAdjustError(result.error || 'Failed to adjust the balance');
      return;
    }
    setIsAdjusting(false);
  };

  const openEdit = () => {
    setDraft({ name: wallet.name, type: wallet.type, color: wallet.color });
    setEditError(null);
    setIsAdjusting(false);
    setIsEditing(true);
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingEdit(true);
    setEditError(null);
    const result = await onEdit(wallet.id, { ...draft, name: draft.name.trim() });
    setIsSavingEdit(false);
    if (!result.success) {
      setEditError(result.error || 'Failed to save the wallet');
      return;
    }
    setIsEditing(false);
  };

  // `createdAt` is an instant; `toIsoDate` reads its local calendar day
  // (never a UTC slice), which `date-boundary.spec.ts` pins at UTC+7.
  const created = formatShortDate(toIsoDate(new Date(wallet.createdAt)));

  // In the sheet the Modal's panel is the surface; a card inside it would be a second one.
  const Shell = inSheet ? SheetBody : Card;

  return (
    <Shell className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="w-[52px] h-[52px] shrink-0 rounded-inner flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${wallet.color} 18%, transparent)`, color: wallet.color }}
        >
          <Icon className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          {!inSheet && (
            <h2 id="wallet-detail-title" className="text-lg font-semibold text-fg break-words">
              {wallet.name}
            </h2>
          )}
          <p id="wallet-detail-meta" className="text-sm text-fg-secondary">
            {walletTypeLabel(wallet.type)} · created {created}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            id="wallet-edit-btn"
            variant="secondary"
            onClick={openEdit}
            aria-expanded={isEditing}
            icon={<Pencil aria-hidden="true" className="w-3.5 h-3.5" />}
          >
            Edit
          </Button>
          <OverflowMenu
            label={`More actions for ${wallet.name}`}
            triggerId="wallet-detail-menu-btn"
            items={[
              { id: `archive-wallet-${wallet.id}`, label: 'Archive wallet', onSelect: () => onRequestArchive(wallet) },
              { id: `delete-wallet-${wallet.id}`, label: 'Delete wallet…', tone: 'danger', onSelect: () => onRequestDelete(wallet) },
            ]}
          />
        </div>
      </div>

      {isEditing && (
        <form id="wallet-edit-form" onSubmit={saveEdit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="wallet-edit-name" className={LABEL_CLASS}>Name</label>
            <input
              id="wallet-edit-name"
              type="text"
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className={inputClass('plain')}
            />
          </div>
          <div>
            <label htmlFor="wallet-edit-type" className={LABEL_CLASS}>Type</label>
            <select
              id="wallet-edit-type"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as WalletType }))}
              className={selectClass('plain')}
            >
              {WALLET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className={OPTION_CLASS}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className={`${LABEL_CLASS} mb-1.5`}>Color</legend>
            {/* The twelve identity colours (audit 008), the Categories page's own.
                A wallet on any other colour keeps it until another is picked.
                A 28px swatch inside a 44px hit box, as in `AddWalletForm`. */}
            <div className="flex flex-wrap items-center gap-1">
              {IDENTITY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, color }))}
                  aria-label={identityColorName(color)}
                  aria-pressed={draft.color === color}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-full cursor-pointer"
                >
                  <span
                    className={`w-7 h-7 rounded-full ${draft.color === color ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface-1' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          {editError && <div id="wallet-edit-error" className={ERROR_BANNER_CLASS}>{editError}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button id="wallet-edit-save-btn" type="submit" disabled={isSavingEdit || draft.name.trim() === ''}>
              Save changes
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <Inset className="px-5 py-4 flex flex-col gap-4">
        {/* Side by side only from `xl`, where the detail is 8/12 wide; narrower, the buttons sit under the figure. */}
        <div className={`flex flex-col gap-4 justify-between ${inSheet ? '' : 'xl:flex-row xl:items-end'}`.trim()}>
          <div className="min-w-0">
            <span className="block text-sm text-fg-secondary">Current balance</span>
            <div className="flex items-baseline gap-2 mt-1">
              <div id="wallet-detail-balance" className={`text-[40px] leading-tight font-bold ${balance < 0 ? 'text-expense' : 'text-fg'}`}>
                <Money value={balance} />
              </div>
              <span className="text-sm font-semibold text-fg-secondary">{APP_CURRENCY}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              id="wallet-transfer-out-btn"
              variant="secondary"
              onClick={() => onTransferOut(wallet.id)}
              icon={<ArrowLeftRight aria-hidden="true" className="w-3.5 h-3.5 text-transfer" />}
            >
              Transfer out
            </Button>
            <Button
              id={`wallet-adjust-btn-${wallet.id}`}
              variant="secondary"
              onClick={openAdjust}
              aria-expanded={isAdjusting}
              icon={<SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5" />}
            >
              Adjust balance
            </Button>
          </div>
        </div>

        {isAdjusting && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label htmlFor="wallet-adjust-input" className="text-xs font-semibold text-fg-secondary">
              Set balance ({APP_CURRENCY_SYMBOL})
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                id="wallet-adjust-input"
                type="number"
                step="0.01"
                value={adjustedBalance}
                onChange={(e) => setAdjustedBalance(parseFloat(e.target.value) || 0)}
                className="w-full min-h-[44px] text-sm px-3 py-2 rounded-control border border-line-input bg-surface-2 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus"
              />
              <div className="flex items-center gap-2 shrink-0">
                <Button id="wallet-adjust-save-btn" onClick={saveAdjust} disabled={isSavingAdjust}>
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setIsAdjusting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
            <p className="text-xs text-fg-muted">The difference is recorded as a balance adjustment.</p>
            {adjustError && <div className={ERROR_BANNER_CLASS}>{adjustError}</div>}
          </div>
        )}
      </Inset>

      <section aria-labelledby="wallet-activity-heading" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="wallet-activity-heading" className="text-base font-semibold text-fg min-w-0 break-words">
            Recent activity in {wallet.name}
          </h3>
          <DashboardLink id="wallet-view-all-tx-btn" className="shrink-0" onClick={() => onViewAllTransactions(wallet.id)}>
            View all
          </DashboardLink>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" subtitle="Transactions in this wallet will show here." />
        ) : (
          <div className="-mx-2">
            <ActivityFeed
              items={items}
              dayNets={dayNets}
              wallets={wallets}
              categories={categories}
              today={today}
              idPrefix="wallet"
              walletId={wallet.id}
              onOpenTransaction={onOpenTransaction}
            />
          </div>
        )}
      </section>
    </Shell>
  );
};

const SheetBody: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={className}>{children}</div>
);
