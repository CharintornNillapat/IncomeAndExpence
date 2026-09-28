import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cashFlow, spendingByCategory } from '../src/selectors/ledger';
import { walletShares } from '../src/selectors/wallets';
import { moodSpendingDays } from '../src/selectors/diary';
import { greetingFor, formatLongDate, formatShortDate, formatWeekdayDate, shiftIsoDate } from '../src/utils/date';
import { buildLookupMap } from '../src/utils/mapUtils';
import type { Category, DiaryEntry, Transaction, Wallet } from '../src/types';

/**
 * Phase 57 (ADR 0030): the figures the redesigned Dashboard adds on top of
 * ADR 0028's selectors - the cash-flow card, each wallet's share, the mood
 * card's days - and the dates its header prints.
 *
 * Pure modules, node environment, "today" passed in and the zone pinned to
 * Bangkok like `selectors-ledger.test.ts`.
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

function entry(date: string, mood: number, overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: `diary-${date}`,
    userId: 'usr-1',
    date,
    mood,
    workout: false,
    foodQuality: 'AVERAGE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('cashFlow: the Cash flow card, on the L1 definition', () => {
  const ROWS: Transaction[] = [
    tx({ type: 'INCOME', amount: 13103, categoryId: 'cat-salary' }),
    tx({ type: 'EXPENSE', amount: 9000.22, categoryId: 'cat-food' }),
    tx({ type: 'EXPENSE', amount: 996, categoryId: 'cat-food' }),
    tx({ type: 'TRANSFER', amount: 300, destinationWalletId: 'wal-main' }),
    tx({ type: 'DEBT_REPAYMENT', amount: 5000, categoryId: 'cat-debt', debtId: 'debt-1' }),
    tx({ type: 'ADJUSTMENT', amount: -7900, categoryId: 'cat-adjust' }),
    tx({ type: 'EXPENSE', amount: 123, categoryId: 'cat-food', isDeleted: true }),
  ];

  it('counts income and spending only, and leaves the rest over', () => {
    expect(cashFlow(ROWS, BY_ID)).toEqual({
      income: 13103,
      spending: 9996.22,
      leftOver: 3106.78,
      spentPercent: (9996.22 / 13103) * 100,
    });
  });

  it("spends exactly the category chart's total (acceptance check 1)", () => {
    const chartTotal = spendingByCategory(ROWS, BY_ID).reduce((sum, row) => sum + row.amount, 0);
    expect(cashFlow(ROWS, BY_ID).spending).toBeCloseTo(chartTotal, 10);
  });

  it('goes negative when spending passes income', () => {
    const flow = cashFlow([tx({ type: 'INCOME', amount: 100 }), tx({ type: 'EXPENSE', amount: 250.5 })], BY_ID);
    expect(flow.leftOver).toBe(-150.5);
    expect(flow.spentPercent).toBeCloseTo(250.5, 10);
  });

  it('has no spent share without income', () => {
    expect(cashFlow([tx({ type: 'EXPENSE', amount: 40 })], BY_ID).spentPercent).toBeNull();
    expect(cashFlow([], BY_ID)).toEqual({ income: 0, spending: 0, leftOver: 0, spentPercent: null });
  });
});

describe("walletShares: each wallet's part of the AllocationBar", () => {
  it('shares the positive balances of active wallets', () => {
    const shares = walletShares([
      wallet({ id: 'cash', balance: 27900 }),
      wallet({ id: 'main', balance: 2663.55 }),
      wallet({ id: 'sub', balance: 1608.93 }),
    ]);
    const total = 27900 + 2663.55 + 1608.93;
    expect(shares.get('cash')).toBeCloseTo((27900 / total) * 100, 10);
    expect(shares.get('main')).toBeCloseTo((2663.55 / total) * 100, 10);
    expect(shares.get('sub')).toBeCloseTo((1608.93 / total) * 100, 10);
  });

  it('gives no share to a wallet at or below zero, and does not let it shrink the others', () => {
    const shares = walletShares([
      wallet({ id: 'cash', balance: 750 }),
      wallet({ id: 'main', balance: 250 }),
      wallet({ id: 'card', balance: -3000, type: 'CREDIT_CARD' }),
      wallet({ id: 'empty', balance: 0 }),
    ]);
    expect(shares.get('cash')).toBe(75);
    expect(shares.get('main')).toBe(25);
    expect(shares.has('card')).toBe(false);
    expect(shares.has('empty')).toBe(false);
  });

  it('leaves out archived and deleted wallets', () => {
    const shares = walletShares([
      wallet({ id: 'cash', balance: 100 }),
      wallet({ id: 'old', balance: 900, isArchived: true }),
      wallet({ id: 'gone', balance: 900, isDeleted: true }),
    ]);
    expect(shares.get('cash')).toBe(100);
    expect(shares.has('old')).toBe(false);
    expect(shares.has('gone')).toBe(false);
  });
});

describe("moodSpendingDays: the mood card's diary days and what each one spent", () => {
  const ROWS: Transaction[] = [
    tx({ type: 'EXPENSE', amount: 340, categoryId: 'cat-food', transactionDate: '2026-09-05' }),
    tx({ type: 'EXPENSE', amount: 500, categoryId: 'cat-debt', transactionDate: '2026-09-05' }),
    tx({ type: 'TRANSFER', amount: 900, transactionDate: '2026-09-05', destinationWalletId: 'wal-main' }),
    tx({ type: 'EXPENSE', amount: 531.25, categoryId: 'cat-food', transactionDate: '2026-09-03' }),
    tx({ type: 'EXPENSE', amount: 60, categoryId: 'cat-food', transactionDate: '2026-09-03', isDeleted: true }),
  ];
  const ENTRIES: DiaryEntry[] = [
    entry('2026-09-03', 3),
    entry('2026-09-05', 4),
    entry('2026-09-10', 2),
    entry('2026-09-11', 5, { isDeleted: true }),
    entry('2026-08-01', 1),
  ];

  it('lists live entries in the range, newest first, with that day\'s L1 spending', () => {
    const result = moodSpendingDays(ENTRIES, ROWS, BY_ID, 'MONTH', TODAY);
    expect(result.loggedCount).toBe(3);
    expect(result.days).toEqual([
      { date: '2026-09-10', mood: 2, spending: 0 },
      { date: '2026-09-05', mood: 4, spending: 340 },
      { date: '2026-09-03', mood: 3, spending: 531.25 },
    ]);
  });

  it('keeps only the newest five, but counts every logged day in the range', () => {
    const many = Array.from({ length: 7 }, (_, i) => entry(shiftIsoDate(TODAY, -i), 3));
    const result = moodSpendingDays(many, [], BY_ID, 'MONTH', TODAY);
    expect(result.loggedCount).toBe(7);
    expect(result.days.map((d) => d.date)).toEqual(many.slice(0, 5).map((e) => e.date));
  });

  it('follows the range: ALL reaches last month, DAY only today', () => {
    expect(moodSpendingDays(ENTRIES, ROWS, BY_ID, 'ALL', TODAY).loggedCount).toBe(4);
    expect(moodSpendingDays(ENTRIES, ROWS, BY_ID, 'DAY', TODAY).loggedCount).toBe(0);
  });
});

describe('dashboard header dates', () => {
  it('greets by the local hour', () => {
    expect(greetingFor(0)).toBe('Good evening');
    expect(greetingFor(4)).toBe('Good evening');
    expect(greetingFor(5)).toBe('Good morning');
    expect(greetingFor(11)).toBe('Good morning');
    expect(greetingFor(12)).toBe('Good afternoon');
    expect(greetingFor(17)).toBe('Good afternoon');
    expect(greetingFor(18)).toBe('Good evening');
    expect(greetingFor(23)).toBe('Good evening');
  });

  it('prints the long date with its weekday', () => {
    expect(formatLongDate('2026-09-28')).toBe('Monday, Sep 28, 2026');
    expect(formatLongDate('2027-01-01')).toBe('Friday, Jan 1, 2027');
  });

  it('prints a short date with its year', () => {
    expect(formatShortDate('2027-01-01')).toBe('Jan 1, 2027');
    expect(formatShortDate('2028-04-01')).toBe('Apr 1, 2028');
  });

  it('prints a nearby day with its weekday and no year', () => {
    expect(formatWeekdayDate('2026-09-28')).toBe('Mon, Sep 28');
    expect(formatWeekdayDate('2026-09-05')).toBe('Sat, Sep 5');
  });
});
