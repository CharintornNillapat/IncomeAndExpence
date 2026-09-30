import { Category, Transaction, Wallet } from '../types';
import { isMovementCategory, UNCATEGORIZED_NAME } from './ledger';

/**
 * Spec L6, L7, L10 and L13 (ADR 0028): how a transaction row names itself.
 * Each rule keeps a string the spec's checklist forbids off the screen: a raw
 * enum (`DEBT_REPAYMENT`), the default description "Transaction", "No
 * category" on a transfer, and "General" on an adjustment. The rows adopt
 * these with the page redesign.
 */

const SYSTEM_LABEL = {
  DEBT_REPAYMENT: 'Debt repayment',
  ADJUSTMENT: 'Balance adjustment',
} as const;

/** L10: the system Debt Repayment / Balance Adjustment categories. Matched by type, since signed-in rows carry uuids. */
export function isSystemMovementCategory(category: Category | undefined): boolean {
  return isMovementCategory(category);
}

/** L10: a category's display name. A system movement category reads as words, whatever its stored name. */
export function systemCategoryLabel(category: Category): string {
  return category.type === 'DEBT_REPAYMENT' || category.type === 'ADJUSTMENT' ? SYSTEM_LABEL[category.type] : category.name;
}

/**
 * The label for a row's category chip, or `null` when the row has no chip.
 * L7: a transfer has none, so it can never read "No category". L13: every
 * adjustment reads "Balance adjustment", whatever category it carries.
 */
export function categoryLabel(tx: Transaction, category: Category | undefined): string | null {
  if (tx.type === 'TRANSFER') return null;
  if (tx.type === 'ADJUSTMENT' || tx.type === 'DEBT_REPAYMENT') return SYSTEM_LABEL[tx.type];
  return category ? systemCategoryLabel(category) : UNCATEGORIZED_NAME;
}

/** The form's own placeholder text when the note is left blank (`TransactionForm`). */
const DEFAULT_DESCRIPTION = 'Transaction';

/** L6: an empty description, or the form's default "Transaction", says nothing of its own. */
export function hasOwnDescription(tx: Transaction): boolean {
  const text = tx.description.trim();
  return text !== '' && text !== DEFAULT_DESCRIPTION;
}

/** L6, L7: the row's title - "Transfer" for a transfer, else the description, else the category label. */
export function displayTitle(tx: Transaction, category: Category | undefined): string {
  if (tx.type === 'TRANSFER') return 'Transfer';
  return hasOwnDescription(tx) ? tx.description : (categoryLabel(tx, category) ?? UNCATEGORIZED_NAME);
}

const UNKNOWN_WALLET = 'Unknown wallet';

/** What `transfer_funds` writes when a transfer is sent with no note. */
const DEFAULT_TRANSFER_DESCRIPTION = 'Transfer between wallets';

/**
 * L6, L7: the line under the title - "Main → Cash" for a transfer, else the
 * wallet, flagged when the title was a fallback. A transfer's title is always
 * "Transfer", so a note the user wrote follows its wallets ("Main → Cash ·
 * Funds transfer") rather than vanishing from the row (Phase 58a, ADR 0031).
 */
export function secondaryLine(tx: Transaction, wallets: ReadonlyMap<string, Wallet>): string {
  const name = (id: string | undefined) => (id && wallets.get(id)?.name) || UNKNOWN_WALLET;
  if (tx.type === 'TRANSFER') {
    const route = `${name(tx.walletId)} → ${name(tx.destinationWalletId)}`;
    return hasOwnDescription(tx) && tx.description.trim() !== DEFAULT_TRANSFER_DESCRIPTION
      ? `${route} · ${tx.description.trim()}`
      : route;
  }
  return hasOwnDescription(tx) ? name(tx.walletId) : `No description · ${name(tx.walletId)}`;
}
