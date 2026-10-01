import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isSpending, isIncome, sumSpending, sumIncome, spendingByCategory, groupByDay } from '../src/selectors/ledger';
import { rangeBounds, inRange, filterByRange, formatRangeLabel } from '../src/selectors/timeRange';
import { activeWallets, archivedWallets, walletActivity, walletTotal, debtRemaining, netWorth } from '../src/selectors/wallets';
import { PAGE_STEP, visibleRows, hasMoreRows } from '../src/selectors/pagination';
import { shiftIsoDate } from '../src/utils/date';
import { buildLookupMap } from '../src/utils/mapUtils';
import type { Category, Debt, Transaction, Wallet } from '../src/types';

/**
 * Phase 55b (ADR 0028, spec section 5): one definition of the money numbers.
 *
 * Before this phase the dashboard's Expense card, its category chart, the
 * monthly insights and the diary each decided for themselves what "spending"
 * meant - two of them counted debt repayments, one did not, and the chart
 * grouped by name. These tests pin the one definition every screen now reads.
 *
 * Pure modules, node environment. "Today" is passed in, never read from the
 * clock, and the zone is pinned to Bangkok like `date-format.test.ts`.
 */
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Bangkok';
});
afterAll(() => {
  process.env.TZ = originalTz;
});

const TODAY = '2026-09-28';

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false },
  { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'x', color: '#F59E6B', isSystem: true, isDeleted: false },
  { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'x', color: '#8FA8C8', isSystem: true, isDeleted: false },
  { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
  { id: 'cat-adjust', name: 'Balance Adjustment', type: 'ADJUSTMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
];
const BY_ID = buildLookupMap(CATEGORIES);

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'amount' | 'type'>): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    userId: 'usr-1',
    walletId: 'wal-cash',
    description: 'seeded',
    transactionDate: TODAY,
    isDeleted: false,
    createdBy: 'usr-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Every kind of row the ledger holds, on one day. Exactly ฿150.50 of it is spending and ฿1,000 income. */
const MIXED: Transaction[] = [
  tx({ type: 'EXPENSE', amount: 100.25, categoryId: 'cat-food' }),
  tx({ type: 'EXPENSE', amount: 50.25, categoryId: 'cat-groceries' }),
  tx({ type: 'EXPENSE', amount: 999, categoryId: 'cat-food', isDeleted: true }),
  tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary' }),
  tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main' }),
  tx({ type: 'DEBT_REPAYMENT', amount: 300, categoryId: 'cat-debt', debtId: 'debt-1' }),
  tx({ type: 'ADJUSTMENT', amount: -40, categoryId: 'cat-adjust' }),
  tx({ type: 'ADJUSTMENT', amount: 60, categoryId: 'cat-adjust' }),
  // Filed by hand as an EXPENSE under a system category: the select is unfiltered.
  tx({ type: 'EXPENSE', amount: 70, categoryId: 'cat-debt' }),
  tx({ type: 'INCOME', amount: 80, categoryId: 'cat-adjust' }),
];

describe('L1: what counts as spending and income', () => {
  it('counts EXPENSE and INCOME only, and never a deleted row', () => {
    expect(sumSpending(MIXED, BY_ID)).toBe(150.5);
    expect(sumIncome(MIXED, BY_ID)).toBe(1000);
  });

  it('excludes transfers, debt repayments and adjustments, whatever their sign', () => {
    for (const type of ['TRANSFER', 'DEBT_REPAYMENT', 'ADJUSTMENT'] as const) {
      const row = MIXED.find((t) => t.type === type)!;
      expect(isSpending(row, BY_ID)).toBe(false);
      expect(isIncome(row, BY_ID)).toBe(false);
    }
  });

  it('excludes a row filed under the Debt Repayment or Balance Adjustment category', () => {
    expect(isSpending(tx({ type: 'EXPENSE', amount: 1, categoryId: 'cat-debt' }), BY_ID)).toBe(false);
    expect(isIncome(tx({ type: 'INCOME', amount: 1, categoryId: 'cat-adjust' }), BY_ID)).toBe(false);
  });

  it('still counts an uncategorized expense, or one whose category is unknown', () => {
    expect(isSpending(tx({ type: 'EXPENSE', amount: 1 }), BY_ID)).toBe(true);
    expect(isSpending(tx({ type: 'EXPENSE', amount: 1, categoryId: 'cat-gone' }), BY_ID)).toBe(true);
  });

  it('rounds the total to cents, not to floating-point noise', () => {
    const cents = [0.1, 0.2].map((amount) => tx({ type: 'EXPENSE', amount }));
    expect(sumSpending(cents, BY_ID)).toBe(0.3);
  });
});

describe('L1: the category chart is the same money as the spending total', () => {
  it('groups by category id, sorts largest first, and adds up to sumSpending exactly', () => {
    const rows = spendingByCategory(MIXED, BY_ID);
    expect(rows.map((r) => r.name)).toEqual(['Food & Dining', 'Groceries']);
    expect(rows.map((r) => r.amount)).toEqual([100.25, 50.25]);
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(sumSpending(MIXED, BY_ID));
  });

  it('keeps two categories that share a name apart', () => {
    const twins = buildLookupMap([
      { ...CATEGORIES[0], id: 'a' },
      { ...CATEGORIES[0], id: 'b' },
    ]);
    const rows = spendingByCategory(
      [tx({ type: 'EXPENSE', amount: 1, categoryId: 'a' }), tx({ type: 'EXPENSE', amount: 2, categoryId: 'b' })],
      twins
    );
    expect(rows).toHaveLength(2);
  });

  it('collects uncategorized spending into one "Uncategorized" row', () => {
    const rows = spendingByCategory([tx({ type: 'EXPENSE', amount: 5 }), tx({ type: 'EXPENSE', amount: 6, categoryId: 'cat-gone' })], BY_ID);
    expect(rows).toEqual([expect.objectContaining({ categoryId: null, name: 'Uncategorized', amount: 11 })]);
  });
});

describe('L2: one time range, with today passed in', () => {
  const dated = (transactionDate: string) => tx({ type: 'EXPENSE', amount: 1, transactionDate });

  it('keeps the dashboard boundaries exactly: WEEK is today - 7 inclusive, MONTH today - 30', () => {
    expect(rangeBounds('WEEK', TODAY)).toEqual({ start: '2026-09-21', end: null });
    expect(rangeBounds('MONTH', TODAY)).toEqual({ start: '2026-08-29', end: null });
    expect(rangeBounds('DAY', TODAY)).toEqual({ start: TODAY, end: TODAY });
    expect(rangeBounds('ALL', TODAY)).toEqual({ start: null, end: null });
  });

  it('includes the first day of the range and excludes the day before it', () => {
    const week = rangeBounds('WEEK', TODAY);
    expect(inRange('2026-09-21', week)).toBe(true);
    expect(inRange('2026-09-20', week)).toBe(false);
  });

  it('filters rows by range and leaves ALL untouched', () => {
    const rows = [dated('2026-09-28'), dated('2026-09-27'), dated('2026-08-29'), dated('2026-08-28')];
    expect(filterByRange(rows, 'DAY', TODAY)).toHaveLength(1);
    expect(filterByRange(rows, 'MONTH', TODAY)).toHaveLength(3);
    expect(filterByRange(rows, 'ALL', TODAY)).toBe(rows);
  });

  it('labels the range with the real dates, as the spec example does', () => {
    expect(formatRangeLabel('MONTH', TODAY)).toBe('Aug 29 – Sep 28');
    expect(formatRangeLabel('WEEK', TODAY)).toBe('Sep 21 – Sep 28');
    expect(formatRangeLabel('DAY', TODAY)).toBe('Sep 28');
    expect(formatRangeLabel('ALL', TODAY)).toBe('All time');
  });

  it('names the year when the range crosses one', () => {
    expect(formatRangeLabel('MONTH', '2026-01-10')).toBe('Dec 11, 2025 – Jan 10, 2026');
  });

  it('steps calendar days across month and year ends', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftIsoDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

function wallet(overrides: Partial<Wallet> & Pick<Wallet, 'id' | 'balance'>): Wallet {
  return {
    userId: 'usr-1',
    name: overrides.id,
    type: 'CASH',
    currency: 'THB',
    color: '#D9A066',
    icon: 'wallet',
    isArchived: false,
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function debt(overrides: Partial<Debt> & Pick<Debt, 'id' | 'remainingAmount'>): Debt {
  return {
    userId: 'usr-1',
    name: overrides.id,
    totalAmount: 20000,
    isSettled: false,
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('L3: net worth is wallets minus what is still owed', () => {
  const WALLETS = [
    wallet({ id: 'cash', balance: 1500.1 }),
    wallet({ id: 'main', balance: 20000.2 }),
    wallet({ id: 'card', balance: -3000, type: 'CREDIT_CARD' }),
    wallet({ id: 'old', balance: 999, isArchived: true }),
    wallet({ id: 'gone', balance: 999, isDeleted: true }),
  ];
  const DEBTS = [
    debt({ id: 'spay', remainingAmount: 13173.7 }),
    debt({ id: 'easy', remainingAmount: 9403.3 }),
    debt({ id: 'paid', remainingAmount: 500, isSettled: true }),
    debt({ id: 'deleted', remainingAmount: 500, isDeleted: true }),
  ];

  it('counts active wallets only: not archived, not deleted, credit cards included', () => {
    expect(activeWallets(WALLETS).map((w) => w.id)).toEqual(['cash', 'main', 'card']);
    expect(walletTotal(WALLETS)).toBe(18500.3);
  });

  it('subtracts the remainder of active debts only', () => {
    expect(debtRemaining(DEBTS)).toBe(22577);
    expect(netWorth(WALLETS, DEBTS)).toBe(-4076.7);
  });

  it('is the wallet total when there is no debt', () => {
    expect(netWorth(WALLETS, [])).toBe(walletTotal(WALLETS));
  });

  it('lists the archived wallets apart, never a deleted one (Phase 59)', () => {
    expect(archivedWallets(WALLETS).map((w) => w.id)).toEqual(['old']);
  });
});

describe("spec 6.3: one wallet's activity (Phase 59)", () => {
  it('takes every live row that moved the wallet, a transfer from either side, newest first', () => {
    const spent = tx({ type: 'EXPENSE', amount: 10, walletId: 'cash', transactionDate: '2026-09-26' });
    const sentOut = tx({ type: 'TRANSFER', amount: 20, walletId: 'cash', destinationWalletId: 'main', transactionDate: '2026-09-28' });
    const cameIn = tx({ type: 'TRANSFER', amount: 30, walletId: 'main', destinationWalletId: 'cash', transactionDate: '2026-09-27' });
    const elsewhere = tx({ type: 'EXPENSE', amount: 40, walletId: 'main', transactionDate: '2026-09-28' });
    const deleted = tx({ type: 'EXPENSE', amount: 50, walletId: 'cash', isDeleted: true });

    expect(walletActivity([spent, sentOut, cameIn, elsewhere, deleted], 'cash').map((t) => t.id)).toEqual([
      sentOut.id,
      cameIn.id,
      spent.id,
    ]);
  });

  it('orders rows of one day by when they were recorded, latest first', () => {
    const early = tx({ type: 'EXPENSE', amount: 1, walletId: 'cash', createdAt: '2026-09-28T01:00:00.000Z' });
    const late = tx({ type: 'EXPENSE', amount: 2, walletId: 'cash', createdAt: '2026-09-28T09:00:00.000Z' });
    expect(walletActivity([early, late], 'cash').map((t) => t.id)).toEqual([late.id, early.id]);
  });
});

describe('L11: each day nets income against spending, and nothing else', () => {
  it('groups newest day first and nets each day by the L1 definition', () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 40, transactionDate: '2026-09-27' }),
      tx({ type: 'INCOME', amount: 100, transactionDate: '2026-09-28' }),
      tx({ type: 'EXPENSE', amount: 30, transactionDate: '2026-09-28' }),
      tx({ type: 'TRANSFER', amount: 500, transactionDate: '2026-09-28' }),
      tx({ type: 'ADJUSTMENT', amount: -80, transactionDate: '2026-09-28' }),
      tx({ type: 'DEBT_REPAYMENT', amount: 60, transactionDate: '2026-09-27' }),
    ];
    const days = groupByDay(rows, BY_ID);
    expect(days.map((d) => d.date)).toEqual(['2026-09-28', '2026-09-27']);
    expect(days.map((d) => d.net)).toEqual([70, -40]);
    expect(days[0].transactions).toHaveLength(4);
  });
});

describe('L12: the list loads 25 at a time', () => {
  const rows = Array.from({ length: 60 }, (_, i) => i);

  it('shows the first page, then 25 more per step, and knows when it has run out', () => {
    expect(PAGE_STEP).toBe(25);
    expect(visibleRows(rows, PAGE_STEP)).toHaveLength(25);
    expect(hasMoreRows(rows, PAGE_STEP)).toBe(true);
    expect(visibleRows(rows, PAGE_STEP * 3)).toHaveLength(60);
    expect(hasMoreRows(rows, PAGE_STEP * 3)).toBe(false);
  });
});
