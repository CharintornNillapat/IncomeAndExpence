import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cashFlow, leftOverFor, monthToDate, spendingByCategory } from '../src/selectors/ledger';
import { walletShares } from '../src/selectors/wallets';
import { dailySpendingSeries, moodSpendingDays } from '../src/selectors/diary';
import { greetingFor, formatLongDate, formatShortDate, formatWeekdayDate, formatMonthName, shiftIsoDate } from '../src/utils/date';
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

describe('leftOverFor: the Left over card (owner spec 5.1)', () => {
  it('counts L1 only, and every field', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 13103, categoryId: 'cat-salary' }),
      tx({ type: 'EXPENSE', amount: 9000.22, categoryId: 'cat-food' }),
      tx({ type: 'EXPENSE', amount: 996, categoryId: 'cat-food' }),
      tx({ type: 'TRANSFER', amount: 300, destinationWalletId: 'wal-main' }),
      tx({ type: 'DEBT_REPAYMENT', amount: 5000, categoryId: 'cat-debt', debtId: 'debt-1' }),
      tx({ type: 'ADJUSTMENT', amount: -7900, categoryId: 'cat-adjust' }),
      tx({ type: 'EXPENSE', amount: 123, categoryId: 'cat-food', isDeleted: true }),
    ];
    const result = leftOverFor(rows, 'MONTH', TODAY, 1000, BY_ID);
    expect(result.income).toBe(13103);
    expect(result.spending).toBe(9996.22);
    expect(result.leftOver).toBe(3106.78);
    expect(result.spentPercent).toBeCloseTo((9996.22 / 13103) * 100, 10);
    expect(result.keptPercent).toBeCloseTo((3106.78 / 13103) * 100, 10);
    const expectedSpentShare = (9996.22 / 13103) * 100;
    expect(result.spentShare).toBeCloseTo(expectedSpentShare, 10);
    expect(result.keptShare).toBeCloseTo(100 - expectedSpentShare, 10);
    expect(result.afterDebtDue).toBe(2106.78);
  });

  it('picks rows according to the range (L2)', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 10, transactionDate: TODAY }),
      tx({ type: 'INCOME', amount: 10, transactionDate: shiftIsoDate(TODAY, -7) }),
      tx({ type: 'INCOME', amount: 10, transactionDate: shiftIsoDate(TODAY, -8) }),
      tx({ type: 'INCOME', amount: 10, transactionDate: shiftIsoDate(TODAY, -30) }),
      tx({ type: 'INCOME', amount: 10, transactionDate: shiftIsoDate(TODAY, -31) }),
    ];
    expect(leftOverFor(rows, 'DAY', TODAY, 0, BY_ID).income).toBe(10);
    expect(leftOverFor(rows, 'WEEK', TODAY, 0, BY_ID).income).toBe(20);
    expect(leftOverFor(rows, 'MONTH', TODAY, 0, BY_ID).income).toBe(40);
    expect(leftOverFor(rows, 'ALL', TODAY, 0, BY_ID).income).toBe(50);
  });

  it('computes afterDebtDue for MONTH only, to the cent', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 10.3 }),
      tx({ type: 'EXPENSE', amount: 10 }),
    ];
    expect(leftOverFor(rows, 'MONTH', TODAY, 0.1, BY_ID).afterDebtDue).toBe(0.2);
    expect(leftOverFor(rows, 'DAY', TODAY, 0.1, BY_ID).afterDebtDue).toBeNull();
    expect(leftOverFor(rows, 'WEEK', TODAY, 0.1, BY_ID).afterDebtDue).toBeNull();
    expect(leftOverFor(rows, 'ALL', TODAY, 0.1, BY_ID).afterDebtDue).toBeNull();

    const monthZero = leftOverFor(rows, 'MONTH', TODAY, 0, BY_ID);
    expect(monthZero.afterDebtDue).toBe(monthZero.leftOver);
  });

  it('shows a full spent bar when left over is negative', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 100 }),
      tx({ type: 'EXPENSE', amount: 250.5 }),
    ];
    const result = leftOverFor(rows, 'MONTH', TODAY, 50, BY_ID);
    expect(result.leftOver).toBe(-150.5);
    expect(result.keptPercent).toBeCloseTo(-150.5, 10);
    expect(result.spentShare).toBe(100);
    expect(result.keptShare).toBe(0);
    expect(result.afterDebtDue).toBe(-200.5);
  });

  it('handles spending equal to income', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 500 }),
      tx({ type: 'EXPENSE', amount: 500 }),
    ];
    const result = leftOverFor(rows, 'MONTH', TODAY, 0, BY_ID);
    expect(result.leftOver).toBe(0);
    expect(result.keptPercent).toBe(0);
    expect(result.spentShare).toBe(100);
    expect(result.keptShare).toBe(0);
  });

  it('handles no income and empty rows', () => {
    const expenseOnly = leftOverFor([tx({ type: 'EXPENSE', amount: 40 })], 'MONTH', TODAY, 0, BY_ID);
    expect(expenseOnly.keptPercent).toBeNull();
    expect(expenseOnly.spentShare).toBe(100);
    expect(expenseOnly.keptShare).toBe(0);

    const empty = leftOverFor([], 'MONTH', TODAY, 0, BY_ID);
    expect(empty).toEqual({
      income: 0,
      spending: 0,
      leftOver: 0,
      spentPercent: null,
      keptPercent: null,
      spentShare: 0,
      keptShare: 0,
      afterDebtDue: 0,
    });
    for (const val of Object.values(empty)) {
      if (typeof val === 'number') {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });

  for (const zone of ['UTC', 'Asia/Bangkok'] as const) {
    describe(`in ${zone}`, () => {
      beforeAll(() => {
        process.env.TZ = zone;
      });
      afterAll(() => {
        process.env.TZ = 'Asia/Bangkok';
      });

      it('respects day and month bounds in this zone', () => {
        const today = '2026-10-17';
        const monthRows = [
          tx({ type: 'EXPENSE', amount: 7, transactionDate: '2026-09-17' }),
          tx({ type: 'EXPENSE', amount: 11, transactionDate: '2026-09-16' }),
        ];
        expect(leftOverFor(monthRows, 'MONTH', today, 0, BY_ID).spending).toBe(7);

        const dayRows = [
          tx({ type: 'EXPENSE', amount: 5, transactionDate: '2026-10-17' }),
          tx({ type: 'EXPENSE', amount: 12, transactionDate: '2026-10-16' }),
        ];
        expect(leftOverFor(dayRows, 'DAY', today, 0, BY_ID).spending).toBe(5);
      });
    });
  }
});

describe('dailySpendingSeries: the Left over sparkline (owner spec 5.2)', () => {
  it('WEEK is 8 points, oldest first, zero-filled', () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 40, categoryId: 'cat-food', transactionDate: shiftIsoDate(TODAY, -7) }),
      tx({ type: 'EXPENSE', amount: 25, transactionDate: TODAY }),
      tx({ type: 'EXPENSE', amount: 12.5, categoryId: 'cat-food', transactionDate: shiftIsoDate(TODAY, -3) }),
    ];
    const series = dailySpendingSeries(rows, 'WEEK', TODAY, BY_ID);
    expect(series).toHaveLength(8);
    expect(series!.map((p) => p.date)).toEqual([-7, -6, -5, -4, -3, -2, -1, 0].map((n) => shiftIsoDate(TODAY, n)));
    expect(series!.map((p) => p.spending)).toEqual([40, 0, 0, 0, 12.5, 0, 0, 25]);
  });

  it('MONTH is 31 points', () => {
    const series = dailySpendingSeries([], 'MONTH', TODAY, BY_ID);
    expect(series).toHaveLength(31);
    expect(series![0].date).toBe(shiftIsoDate(TODAY, -30));
    expect(series![30].date).toBe(TODAY);
    expect(series!.every((p) => p.spending === 0)).toBe(true);
  });

  it('DAY and ALL have no series', () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 40, categoryId: 'cat-food', transactionDate: shiftIsoDate(TODAY, -7) }),
      tx({ type: 'EXPENSE', amount: 25, transactionDate: TODAY }),
      tx({ type: 'EXPENSE', amount: 12.5, categoryId: 'cat-food', transactionDate: shiftIsoDate(TODAY, -3) }),
    ];
    expect(dailySpendingSeries(rows, 'DAY', TODAY, BY_ID)).toBeNull();
    expect(dailySpendingSeries(rows, 'ALL', TODAY, BY_ID)).toBeNull();
  });

  it('L1 only, summed and rounded per day', () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 0.1, categoryId: 'cat-food', transactionDate: TODAY }),
      tx({ type: 'EXPENSE', amount: 0.2, categoryId: 'cat-food', transactionDate: TODAY }),
      tx({ type: 'INCOME', amount: 500, categoryId: 'cat-salary', transactionDate: TODAY }),
      tx({ type: 'TRANSFER', amount: 300, destinationWalletId: 'wal-main', transactionDate: TODAY }),
      tx({ type: 'DEBT_REPAYMENT', amount: 1000, categoryId: 'cat-debt', debtId: 'debt-1', transactionDate: TODAY }),
      tx({ type: 'EXPENSE', amount: 70, categoryId: 'cat-debt', transactionDate: TODAY }),
      tx({ type: 'ADJUSTMENT', amount: -50, categoryId: 'cat-adjust', transactionDate: TODAY }),
      tx({ type: 'EXPENSE', amount: 9, categoryId: 'cat-food', isDeleted: true, transactionDate: TODAY }),
    ];
    const series = dailySpendingSeries(rows, 'WEEK', TODAY, BY_ID);
    expect(series).toHaveLength(8);
    expect(series![7].spending).toBe(0.3);
  });

  it('only the range days', () => {
    const weekRows = [
      tx({ type: 'EXPENSE', amount: 5, transactionDate: shiftIsoDate(TODAY, -8) }),
      tx({ type: 'EXPENSE', amount: 6, transactionDate: shiftIsoDate(TODAY, 1) }),
    ];
    const weekSeries = dailySpendingSeries(weekRows, 'WEEK', TODAY, BY_ID);
    expect(weekSeries).toHaveLength(8);
    expect(weekSeries![0].date).toBe(shiftIsoDate(TODAY, -7));
    expect(weekSeries![7].date).toBe(TODAY);
    expect(weekSeries!.every((p) => p.spending === 0)).toBe(true);

    const monthRows = [
      tx({ type: 'EXPENSE', amount: 7, transactionDate: shiftIsoDate(TODAY, -31) }),
    ];
    const monthSeries = dailySpendingSeries(monthRows, 'MONTH', TODAY, BY_ID);
    expect(monthSeries).toHaveLength(31);
    expect(monthSeries!.every((p) => p.spending === 0)).toBe(true);
  });

  it("adds up to the card's Spending", () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 100.1, transactionDate: shiftIsoDate(TODAY, -30) }),
      tx({ type: 'EXPENSE', amount: 200.2, transactionDate: shiftIsoDate(TODAY, -7) }),
      tx({ type: 'EXPENSE', amount: 0.7, transactionDate: shiftIsoDate(TODAY, -1) }),
      tx({ type: 'EXPENSE', amount: 50, transactionDate: TODAY }),
      tx({ type: 'INCOME', amount: 999, transactionDate: shiftIsoDate(TODAY, -2) }),
    ];
    for (const range of ['WEEK', 'MONTH'] as const) {
      const series = dailySpendingSeries(rows, range, TODAY, BY_ID)!;
      const sum = series.reduce((total, p) => total + p.spending, 0);
      expect(sum).toBeCloseTo(leftOverFor(rows, range, TODAY, 0, BY_ID).spending, 10);
    }
  });

  it('future-dated row: intended gap where card counts but sparkline does not', () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 100.1, transactionDate: shiftIsoDate(TODAY, -30) }),
      tx({ type: 'EXPENSE', amount: 200.2, transactionDate: shiftIsoDate(TODAY, -7) }),
      tx({ type: 'EXPENSE', amount: 0.7, transactionDate: shiftIsoDate(TODAY, -1) }),
      tx({ type: 'EXPENSE', amount: 50, transactionDate: TODAY }),
      tx({ type: 'INCOME', amount: 999, transactionDate: shiftIsoDate(TODAY, -2) }),
      tx({ type: 'EXPENSE', amount: 30, categoryId: 'cat-food', transactionDate: shiftIsoDate(TODAY, 1) }),
    ];
    for (const range of ['WEEK', 'MONTH'] as const) {
      const flow = leftOverFor(rows, range, TODAY, 0, BY_ID);
      expect(flow.spending).toBeCloseTo((range === 'WEEK' ? 250.9 : 351) + 30, 10);
      const series = dailySpendingSeries(rows, range, TODAY, BY_ID)!;
      expect(series.find((p) => p.date === shiftIsoDate(TODAY, 1))).toBeUndefined();
      expect(series).toHaveLength(range === 'WEEK' ? 8 : 31);
      const sum = series.reduce((total, p) => total + p.spending, 0);
      expect(sum).toBeCloseTo(flow.spending - 30, 10);
    }
  });

  for (const zone of ['UTC', 'Asia/Bangkok'] as const) {
    describe(`in ${zone}`, () => {
      beforeAll(() => {
        process.env.TZ = zone;
      });
      afterAll(() => {
        process.env.TZ = 'Asia/Bangkok';
      });

      it('respects day and month bounds across time zones and year ends', () => {
        expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(zone === 'UTC' ? 0 : -420);

        const today = '2026-10-17';
        const weekSeries = dailySpendingSeries([], 'WEEK', today, BY_ID)!;
        expect(weekSeries).toHaveLength(8);
        expect(weekSeries[0].date).toBe('2026-10-10');
        expect(weekSeries[7].date).toBe('2026-10-17');

        const monthSeries = dailySpendingSeries([], 'MONTH', today, BY_ID)!;
        expect(monthSeries).toHaveLength(31);
        expect(monthSeries[0].date).toBe('2026-09-17');

        const yearEndToday = '2027-01-03';
        const yearEndWeek = dailySpendingSeries([], 'WEEK', yearEndToday, BY_ID)!;
        expect(yearEndWeek[0].date).toBe('2026-12-27');
        expect(yearEndWeek.map((p) => p.date)).toEqual([
          '2026-12-27',
          '2026-12-28',
          '2026-12-29',
          '2026-12-30',
          '2026-12-31',
          '2027-01-01',
          '2027-01-02',
          '2027-01-03',
        ]);
      });
    });
  }
});

describe('monthToDate: the month comparison line (owner spec 5.3)', () => {
  it('mid-month, L1 only, every field', () => {
    const today = '2026-10-17';
    const rows = [
      tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary', transactionDate: '2026-10-01' }),
      tx({ type: 'EXPENSE', amount: 300, categoryId: 'cat-food', transactionDate: '2026-10-17' }),
      tx({ type: 'EXPENSE', amount: 99, categoryId: 'cat-food', transactionDate: '2026-10-18' }),
      tx({ type: 'EXPENSE', amount: 1, categoryId: 'cat-food', transactionDate: '2026-09-30' }),
      tx({ type: 'INCOME', amount: 800, categoryId: 'cat-salary', transactionDate: '2026-09-01' }),
      tx({ type: 'EXPENSE', amount: 200, categoryId: 'cat-food', transactionDate: '2026-09-17' }),
      tx({ type: 'EXPENSE', amount: 500, categoryId: 'cat-food', transactionDate: '2026-09-18' }),
      tx({ type: 'TRANSFER', amount: 400, destinationWalletId: 'wal-main', transactionDate: '2026-09-10' }),
      tx({ type: 'DEBT_REPAYMENT', amount: 100, categoryId: 'cat-debt', debtId: 'debt-1', transactionDate: '2026-09-10' }),
      tx({ type: 'EXPENSE', amount: 60, categoryId: 'cat-debt', transactionDate: '2026-09-10' }),
      tx({ type: 'ADJUSTMENT', amount: -50, categoryId: 'cat-adjust', transactionDate: '2026-09-10' }),
      tx({ type: 'EXPENSE', amount: 70, categoryId: 'cat-food', isDeleted: true, transactionDate: '2026-09-10' }),
    ];
    const result = monthToDate(rows, today, BY_ID);
    expect(result.days).toBe(17);
    expect(result.thisMonth).toEqual({ start: '2026-10-01', end: '2026-10-17', spending: 300, leftOver: 700 });
    expect(result.lastMonth).toEqual({ start: '2026-09-01', end: '2026-09-17', spending: 200, leftOver: 600 });
    expect(result.spendingChange).toBeCloseTo(50, 10);
    expect(result.leftOverChange).toBeCloseTo((100 / 600) * 100, 10);
  });

  it('the 31st against a 30-day month', () => {
    const today = '2026-10-31';
    const rows = [
      tx({ type: 'EXPENSE', amount: 10, transactionDate: '2026-10-30' }),
      tx({ type: 'EXPENSE', amount: 45, transactionDate: '2026-10-31' }),
      tx({ type: 'EXPENSE', amount: 20, transactionDate: '2026-09-30' }),
    ];
    const result = monthToDate(rows, today, BY_ID);
    expect(result.days).toBe(30);
    expect(result.thisMonth.end).toBe('2026-10-30');
    expect(result.thisMonth.spending).toBe(10);
    expect(result.lastMonth.end).toBe('2026-09-30');
    expect(result.lastMonth.spending).toBe(20);
    expect(result.spendingChange).toBeCloseTo(-50, 10);
  });

  it('March 29 to 31 against February, leap and non-leap', () => {
    for (const today of ['2028-03-29', '2028-03-30', '2028-03-31'] as const) {
      const leap = monthToDate([], today, BY_ID);
      expect(leap.days).toBe(29);
      expect(leap.lastMonth).toEqual({ start: '2028-02-01', end: '2028-02-29', spending: 0, leftOver: 0 });
      expect(leap.thisMonth.end).toBe('2028-03-29');
    }

    const nonLeapRows = [
      tx({ type: 'EXPENSE', amount: 5, transactionDate: '2027-02-28' }),
      tx({ type: 'EXPENSE', amount: 8, transactionDate: '2027-03-29' }),
    ];
    for (const today of ['2027-03-29', '2027-03-30', '2027-03-31'] as const) {
      const nonLeap = monthToDate(nonLeapRows, today, BY_ID);
      expect(nonLeap.days).toBe(28);
      expect(nonLeap.lastMonth.end).toBe('2027-02-28');
      expect(nonLeap.thisMonth.end).toBe('2027-03-28');
      if (today === '2027-03-29') {
        expect(nonLeap.lastMonth.spending).toBe(5);
        expect(nonLeap.thisMonth.spending).toBe(0);
      }
    }

    const march28 = monthToDate([], '2028-03-28', BY_ID);
    expect(march28.days).toBe(28);
  });

  it('January against the previous December', () => {
    const decRows = [
      tx({ type: 'EXPENSE', amount: 12, transactionDate: '2026-12-15' }),
      tx({ type: 'EXPENSE', amount: 13, transactionDate: '2026-12-16' }),
    ];
    const midJan = monthToDate(decRows, '2027-01-15', BY_ID);
    expect(midJan.days).toBe(15);
    expect(midJan.lastMonth.start).toBe('2026-12-01');
    expect(midJan.lastMonth.end).toBe('2026-12-15');
    expect(midJan.lastMonth.spending).toBe(12);

    const endJan = monthToDate([], '2027-01-31', BY_ID);
    expect(endJan.days).toBe(31);
    expect(endJan.lastMonth.end).toBe('2026-12-31');
    expect(endJan.thisMonth.end).toBe('2027-01-31');

    const startJan = monthToDate([], '2027-01-01', BY_ID);
    expect(startJan.days).toBe(1);
    expect(startJan.lastMonth.start).toBe('2026-12-01');
    expect(startJan.lastMonth.end).toBe('2026-12-01');
  });

  it('no figure last month', () => {
    const rows = [tx({ type: 'EXPENSE', amount: 50, transactionDate: '2026-10-05' })];
    const result = monthToDate(rows, '2026-10-17', BY_ID);
    expect(result.lastMonth.spending).toBe(0);
    expect(result.lastMonth.leftOver).toBe(0);
    expect(result.spendingChange).toBeNull();
    expect(result.leftOverChange).toBeNull();

    const empty = monthToDate([], '2026-10-17', BY_ID);
    expect(empty.thisMonth.spending).toBe(0);
    expect(empty.thisMonth.leftOver).toBe(0);
    expect(empty.lastMonth.spending).toBe(0);
    expect(empty.lastMonth.leftOver).toBe(0);
    expect(empty.spendingChange).toBeNull();
    expect(empty.leftOverChange).toBeNull();

    expect(Number.isFinite(empty.days)).toBe(true);
    expect(Number.isFinite(empty.thisMonth.spending)).toBe(true);
    expect(Number.isFinite(empty.thisMonth.leftOver)).toBe(true);
    expect(Number.isFinite(empty.lastMonth.spending)).toBe(true);
    expect(Number.isFinite(empty.lastMonth.leftOver)).toBe(true);
  });

  it('a negative base', () => {
    const today = '2026-10-17';
    const rows = [
      tx({ type: 'INCOME', amount: 100, transactionDate: '2026-09-01' }),
      tx({ type: 'EXPENSE', amount: 300, transactionDate: '2026-09-05' }),
      tx({ type: 'INCOME', amount: 100, transactionDate: '2026-10-01' }),
      tx({ type: 'EXPENSE', amount: 200, transactionDate: '2026-10-05' }),
    ];
    const result = monthToDate(rows, today, BY_ID);
    expect(result.spendingChange).toBeCloseTo((-100 / 300) * 100, 10);
    expect(result.leftOverChange).toBeCloseTo(50, 10);
  });

  it('cents', () => {
    const today = '2026-10-17';
    const rows = [
      tx({ type: 'EXPENSE', amount: 0.1, transactionDate: '2026-09-03' }),
      tx({ type: 'EXPENSE', amount: 0.2, transactionDate: '2026-09-03' }),
    ];
    const result = monthToDate(rows, today, BY_ID);
    expect(result.lastMonth.spending).toBe(0.3);
  });

  for (const zone of ['UTC', 'Asia/Bangkok'] as const) {
    describe(`in ${zone}`, () => {
      beforeAll(() => {
        process.env.TZ = zone;
      });
      afterAll(() => {
        process.env.TZ = 'Asia/Bangkok';
      });

      it('respects day bounds and leap years across time zones', () => {
        expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(zone === 'UTC' ? 0 : -420);

        const leap = monthToDate([], '2028-03-31', BY_ID);
        expect(leap.days).toBe(29);
        expect(leap.lastMonth.end).toBe('2028-02-29');

        const nonLeap = monthToDate([], '2027-03-31', BY_ID);
        expect(nonLeap.days).toBe(28);
        expect(nonLeap.lastMonth.end).toBe('2027-02-28');

        const yearStart = monthToDate([], '2027-01-01', BY_ID);
        expect(yearStart.days).toBe(1);
        expect(yearStart.lastMonth.start).toBe('2026-12-01');

        const thirtyDay = monthToDate([], '2026-10-31', BY_ID);
        expect(thirtyDay.days).toBe(30);
      });
    });
  }
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

  it('names a calendar month', () => {
    expect(formatMonthName('2026-09')).toBe('September');
    expect(formatMonthName('2026-01')).toBe('January');
  });

  it('prints a nearby day with its weekday and no year', () => {
    expect(formatWeekdayDate('2026-09-28')).toBe('Mon, Sep 28');
    expect(formatWeekdayDate('2026-09-05')).toBe('Sat, Sep 5');
  });
});
