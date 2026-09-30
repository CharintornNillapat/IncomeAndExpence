import { describe, it, expect } from 'vitest';
import { categoryLabel, systemCategoryLabel, isSystemMovementCategory, displayTitle, secondaryLine } from '../src/selectors/display';
import { foldAdjustmentPairs, describeAdjustmentPair } from '../src/selectors/adjustments';
import { usedColors } from '../src/selectors/categories';
import { buildLookupMap } from '../src/utils/mapUtils';
import type { Category, Transaction, Wallet } from '../src/types';

/**
 * Phase 55b (ADR 0028, spec L6, L7, L8, L9, L10 and L13): how a row names
 * itself. Built and pinned here; the screens adopt them with the page
 * redesign, where the rows that show them are rebuilt.
 *
 * Each rule removes a string the spec's checklist forbids from reaching the
 * UI: a raw enum (`DEBT_REPAYMENT`), the default description "Transaction",
 * "No category" on a transfer, and "General" on an adjustment.
 */
const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false },
  // Signed-in rows carry uuids, so the system categories are found by type, never by id.
  { id: '7f3a-debt', name: 'DEBT_REPAYMENT', type: 'DEBT_REPAYMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
  { id: '9c1b-adjust', name: 'General', type: 'ADJUSTMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
];
const CATS = buildLookupMap(CATEGORIES);

const WALLETS = buildLookupMap<Wallet>([
  { id: 'main', userId: 'u', name: 'Main', type: 'BANK_ACCOUNT', currency: 'THB', balance: 0, color: '#6C8EEF', icon: 'x', isArchived: false, isDeleted: false, createdAt: '', updatedAt: '' },
  { id: 'cash', userId: 'u', name: 'Cash', type: 'CASH', currency: 'THB', balance: 0, color: '#D9A066', icon: 'x', isArchived: false, isDeleted: false, createdAt: '', updatedAt: '' },
]);

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type'>): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    userId: 'u',
    walletId: 'cash',
    amount: 100,
    description: 'Lunch',
    transactionDate: '2026-09-28',
    isDeleted: false,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('L10 and L13: system categories read as words, the same on every screen', () => {
  it('names the two system categories by type, whatever the stored name', () => {
    expect(systemCategoryLabel(CATS.get('7f3a-debt')!)).toBe('Debt repayment');
    expect(systemCategoryLabel(CATS.get('9c1b-adjust')!)).toBe('Balance adjustment');
    expect(systemCategoryLabel(CATS.get('cat-food')!)).toBe('Food & Dining');
  });

  it('knows which categories are system movements rather than income or spending', () => {
    expect(isSystemMovementCategory(CATS.get('7f3a-debt'))).toBe(true);
    expect(isSystemMovementCategory(CATS.get('9c1b-adjust'))).toBe(true);
    expect(isSystemMovementCategory(CATS.get('cat-food'))).toBe(false);
    expect(isSystemMovementCategory(undefined)).toBe(false);
  });

  it('labels every adjustment "Balance adjustment", with or without a category', () => {
    expect(categoryLabel(tx({ type: 'ADJUSTMENT', amount: -5 }), undefined)).toBe('Balance adjustment');
    expect(categoryLabel(tx({ type: 'ADJUSTMENT', amount: -5, categoryId: 'cat-food' }), CATS.get('cat-food'))).toBe('Balance adjustment');
  });

  it('labels a repayment "Debt repayment", and an uncategorized row "Uncategorized"', () => {
    expect(categoryLabel(tx({ type: 'DEBT_REPAYMENT' }), undefined)).toBe('Debt repayment');
    expect(categoryLabel(tx({ type: 'EXPENSE' }), undefined)).toBe('Uncategorized');
    expect(categoryLabel(tx({ type: 'EXPENSE', categoryId: 'cat-food' }), CATS.get('cat-food'))).toBe('Food & Dining');
  });
});

describe('L7: a transfer names its wallets and has no category', () => {
  const transfer = tx({ type: 'TRANSFER', walletId: 'main', destinationWalletId: 'cash', description: 'Transfer between wallets' });

  it('has no category chip at all, so never "No category"', () => {
    expect(categoryLabel(transfer, undefined)).toBeNull();
  });

  it('is titled "Transfer", with "From → To" underneath', () => {
    expect(displayTitle(transfer, undefined)).toBe('Transfer');
    expect(secondaryLine(transfer, WALLETS)).toBe('Main → Cash');
  });

  // Phase 58a (ADR 0031): the title is always "Transfer", so a note the user
  // wrote would otherwise vanish from the row. It rides on the second line.
  it('keeps a note the user wrote on the second line', () => {
    const noted = tx({ type: 'TRANSFER', walletId: 'main', destinationWalletId: 'cash', description: 'Funds transfer' });
    expect(secondaryLine(noted, WALLETS)).toBe('Main → Cash · Funds transfer');
  });

  it('adds nothing for an empty note or either default', () => {
    for (const description of ['', '  ', 'Transaction', 'Transfer between wallets']) {
      const plain = tx({ type: 'TRANSFER', walletId: 'main', destinationWalletId: 'cash', description });
      expect(secondaryLine(plain, WALLETS)).toBe('Main → Cash');
    }
  });
});

describe('L6: an empty or default description falls back to the category', () => {
  it('uses the category name for an empty description or the default "Transaction"', () => {
    for (const description of ['', '   ', 'Transaction']) {
      const row = tx({ type: 'EXPENSE', categoryId: 'cat-food', description });
      expect(displayTitle(row, CATS.get('cat-food'))).toBe('Food & Dining');
      expect(secondaryLine(row, WALLETS)).toBe('No description · Cash');
    }
  });

  it('keeps a real description, with the wallet underneath', () => {
    const row = tx({ type: 'EXPENSE', categoryId: 'cat-food', description: 'ข้าวมันไก่ 60' });
    expect(displayTitle(row, CATS.get('cat-food'))).toBe('ข้าวมันไก่ 60');
    expect(secondaryLine(row, WALLETS)).toBe('Cash');
  });
});

describe('L8: a pair of adjustments that cancel out folds into one item', () => {
  it('folds an equal and opposite pair on the same wallet and day, where the first one stood', () => {
    const before = tx({ type: 'EXPENSE' });
    const up = tx({ type: 'ADJUSTMENT', amount: 250 });
    const other = tx({ type: 'INCOME' });
    const down = tx({ type: 'ADJUSTMENT', amount: -250 });
    const items = foldAdjustmentPairs([before, up, other, down]);
    expect(items.map((i) => i.kind)).toEqual(['tx', 'adjustment-pair', 'tx']);
    const pair = items[1];
    expect(pair.kind === 'adjustment-pair' && pair.transactions.map((t) => t.id)).toEqual([up.id, down.id]);
  });

  it('leaves a pair alone on different wallets, different days, or unequal amounts', () => {
    const base = tx({ type: 'ADJUSTMENT', amount: 250 });
    for (const other of [
      tx({ type: 'ADJUSTMENT', amount: -250, walletId: 'main' }),
      tx({ type: 'ADJUSTMENT', amount: -250, transactionDate: '2026-09-27' }),
      tx({ type: 'ADJUSTMENT', amount: -249.99 }),
      tx({ type: 'ADJUSTMENT', amount: 250 }),
    ]) {
      expect(foldAdjustmentPairs([base, other]).every((i) => i.kind === 'tx')).toBe(true);
    }
  });

  it('pairs each adjustment once, and never a deleted one', () => {
    const a = tx({ type: 'ADJUSTMENT', amount: 10 });
    const b = tx({ type: 'ADJUSTMENT', amount: -10 });
    const c = tx({ type: 'ADJUSTMENT', amount: -10 });
    expect(foldAdjustmentPairs([a, b, c]).map((i) => i.kind)).toEqual(['adjustment-pair', 'tx']);
    expect(foldAdjustmentPairs([a, { ...b, isDeleted: true }]).map((i) => i.kind)).toEqual(['tx', 'tx']);
  });

  it('describes the folded pair in the spec words', () => {
    expect(describeAdjustmentPair('Cash')).toBe('2 balance adjustments on Cash that cancel out · net ฿0.00');
  });
});

describe('L9: a colour one category uses is not offered to another', () => {
  it('maps each colour in use to the category using it, case-insensitively, skipping deleted ones', () => {
    const used = usedColors([
      ...CATEGORIES,
      { id: 'gone', name: 'Old', type: 'EXPENSE', icon: 'x', color: '#F59E6B', isSystem: false, isDeleted: true },
    ]);
    expect(used.get('#e879a6')).toBe('Food & Dining');
    expect(used.has('#f59e6b')).toBe(false);
  });

  it('frees the colour of the category being edited', () => {
    expect(usedColors(CATEGORIES, 'cat-food').has('#e879a6')).toBe(false);
  });
});
