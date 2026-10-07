import { describe, it, expect } from 'vitest';
import { monthsLeft, requiredMonthly, isOverdue, sortByDueDate, debtPlan, monthlySurplus, payoffPercent } from '../src/selectors/debts';
import { buildLookupMap } from '../src/utils/mapUtils';
import type { Category, Debt, Transaction } from '../src/types';

/**
 * Phase 55b (ADR 0028, spec L4 and L5): what each debt needs per month to be
 * paid off by its due date, and when the whole plan outruns what the user
 * actually has left over.
 *
 * The first two cases are the spec's own worked example, computed on
 * 2026-09-28. Since ADR 0087 a month left is a monthly payment date from
 * today up to the due date: SPayLater (฿13,173.70, due 2027-01-15) has four
 * (Sep 28, Oct 28, Nov 28, Dec 28) and needs ฿3,293.43 a month; SEasy Cash
 * (฿9,403.30, due 2028-04-10) has 19 and needs ฿494.91. The spec's own
 * figures (3 and 18 months, ฿4,391.23 and ฿522.41) left a payment date out.
 *
 * Pure module, no clock: "today" is an argument. All dates are ISO strings
 * compared as strings, so no timezone is involved.
 */
const TODAY = '2026-09-28';

function debt(overrides: Partial<Debt> & Pick<Debt, 'id' | 'remainingAmount'>): Debt {
  return {
    userId: 'usr-1',
    name: overrides.id,
    totalAmount: 20000,
    isSettled: false,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const SPAY = debt({ id: 'spay', name: 'SPayLater', remainingAmount: 13173.7, dueDate: '2027-01-15' });
const SEASY = debt({ id: 'seasy', name: 'SEasy Cash', remainingAmount: 9403.3, dueDate: '2028-04-10' });

describe('L4 (ADR 0087): monthsLeft counts the monthly payment dates from today to the due date', () => {
  it('matches the spec example, recounted', () => {
    expect(monthsLeft('2027-01-15', TODAY)).toBe(4);
    expect(monthsLeft('2028-04-10', TODAY)).toBe(19);
  });

  it("gives the audit's case about three months, not one", () => {
    // 6 Oct, 6 Nov and 6 Dec all fall before 31 Dec.
    expect(monthsLeft('2026-12-31', '2026-10-06')).toBe(3);
  });

  it("counts a payment date that falls on the due date, and not one a day after", () => {
    expect(monthsLeft('2026-12-06', '2026-10-06')).toBe(3);
    expect(monthsLeft('2026-12-05', '2026-10-06')).toBe(2);
    expect(monthsLeft('2026-10-31', TODAY)).toBe(2);
    expect(monthsLeft('2026-11-01', TODAY)).toBe(2);
    expect(monthsLeft('2026-12-01', TODAY)).toBe(3);
  });

  it('is one when due today, later this month, or already past', () => {
    expect(monthsLeft(TODAY, TODAY)).toBe(1);
    expect(monthsLeft('2026-09-30', TODAY)).toBe(1);
    expect(monthsLeft('2025-01-01', TODAY)).toBe(1);
  });

  it("moves a month-end payment date to a shorter month's last day", () => {
    // From 31 January the next date is 28 February (29 in a leap year).
    expect(monthsLeft('2027-02-28', '2027-01-31')).toBe(2);
    expect(monthsLeft('2027-02-27', '2027-01-31')).toBe(1);
    expect(monthsLeft('2028-02-29', '2028-01-31')).toBe(2);
    expect(monthsLeft('2028-02-28', '2028-01-31')).toBe(1);
  });

  it('crosses a year', () => {
    expect(monthsLeft('2027-03-15', '2026-11-20')).toBe(4);
  });
});

describe('L4: required per month', () => {
  it('matches the spec example to the cent', () => {
    expect(requiredMonthly(SPAY, TODAY)).toBe(3293.43);
    expect(requiredMonthly(SEASY, TODAY)).toBe(494.91);
  });

  it('asks for the whole remainder once a debt is overdue', () => {
    const late = debt({ id: 'late', remainingAmount: 800, dueDate: '2026-09-01' });
    expect(isOverdue(late, TODAY)).toBe(true);
    expect(requiredMonthly(late, TODAY)).toBe(800);
  });

  it('is not overdue on its due date', () => {
    expect(isOverdue(debt({ id: 'd', remainingAmount: 1, dueDate: TODAY }), TODAY)).toBe(false);
  });

  it('has no figure for a debt with no due date, and nothing for a settled or deleted one', () => {
    expect(requiredMonthly(debt({ id: 'open', remainingAmount: 500 }), TODAY)).toBeNull();
    expect(requiredMonthly({ ...SPAY, isSettled: true }, TODAY)).toBeNull();
    expect(requiredMonthly({ ...SPAY, isDeleted: true }, TODAY)).toBeNull();
    expect(isOverdue(debt({ id: 'open', remainingAmount: 500 }), TODAY)).toBe(false);
  });
});

describe('sortByDueDate (spec section 6.4)', () => {
  it('puts the nearest due date first and undated debts last, without mutating the input', () => {
    const open = debt({ id: 'open', remainingAmount: 1 });
    const input = [SEASY, open, SPAY];
    expect(sortByDueDate(input).map((d) => d.id)).toEqual(['spay', 'seasy', 'open']);
    expect(input.map((d) => d.id)).toEqual(['seasy', 'open', 'spay']);
  });
});

describe('L5: the plan against what is left over', () => {
  it('totals the required payments and names the shortfall', () => {
    const plan = debtPlan([SPAY, SEASY], TODAY, 3000);
    // ฿3,293.43 + ฿494.91 since ADR 0087.
    expect(plan.totalRequired).toBe(3788.34);
    expect(plan.shortfall).toBe(788.34);
    expect(plan.showWarning).toBe(true);
    expect(plan.items.map((i) => [i.debt.id, i.exceedsSurplus])).toEqual([
      ['spay', true],
      ['seasy', false],
    ]);
  });

  it('shows no warning when the surplus covers every payment', () => {
    const plan = debtPlan([SPAY, SEASY], TODAY, 5000);
    expect(plan.showWarning).toBe(false);
    expect(plan.shortfall).toBe(0);
  });

  it('warns on a negative surplus even for a small payment', () => {
    expect(debtPlan([SEASY], TODAY, -10).showWarning).toBe(true);
  });

  it('leaves out settled, deleted and undated debts, and warns about nothing when none is left', () => {
    const plan = debtPlan(
      [{ ...SPAY, isSettled: true }, { ...SEASY, isDeleted: true }, debt({ id: 'open', remainingAmount: 9 })],
      TODAY,
      0
    );
    expect(plan.totalRequired).toBe(0);
    expect(plan.showWarning).toBe(false);
    expect(plan.items.map((i) => [i.debt.id, i.required])).toEqual([['open', null]]);
  });
});

describe('L5: the surplus is income minus spending over the past 30 days (L1, L2)', () => {
  const CATEGORIES: Category[] = [
    { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
  ];
  let seq = 0;
  const tx = (overrides: Partial<Transaction> & Pick<Transaction, 'amount' | 'type' | 'transactionDate'>): Transaction => ({
    id: `tx-${++seq}`,
    userId: 'usr-1',
    walletId: 'wal-1',
    description: 'seeded',
    isDeleted: false,
    createdBy: 'usr-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });

  it('counts only income and spending inside the MONTH range', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 20000, transactionDate: '2026-09-01' }),
      tx({ type: 'EXPENSE', amount: 12000.5, transactionDate: '2026-08-29' }),
      tx({ type: 'EXPENSE', amount: 5000, transactionDate: '2026-08-28' }),
      tx({ type: 'DEBT_REPAYMENT', amount: 3000, transactionDate: '2026-09-10', categoryId: 'cat-debt' }),
      tx({ type: 'TRANSFER', amount: 7000, transactionDate: '2026-09-10' }),
    ];
    expect(monthlySurplus(rows, TODAY, buildLookupMap(CATEGORIES))).toBe(7999.5);
  });
});

describe('payoffPercent: the share of what was borrowed that is paid off (ADR 0079)', () => {
  it('is (total - remaining) / total, as a percentage', () => {
    expect(payoffPercent(10000, 4500, 0)).toBe(((10000 - 4500) / 10000) * 100);
    expect(payoffPercent(10000, 10000, 0)).toBe(0);
    expect(payoffPercent(10000, 0, 0)).toBe(100);
  });

  it('is clamped to 0 to 100, so no screen prints a negative or an overflowing share (ADR 0084)', () => {
    // A row from before the Add Debt check, or a reversed overpayment (ADR 0016, uncapped).
    expect(payoffPercent(1000, 1500, 0)).toBe(0);
    expect(payoffPercent(1000, -500, 0)).toBe(100);
  });

  it('returns the caller\'s own figure when nothing was borrowed, whatever is owed', () => {
    // No database check stops a zero total, and a restored backup can carry one.
    expect(payoffPercent(0, 0, 100)).toBe(100);
    expect(payoffPercent(0, 250, 100)).toBe(100);
    expect(payoffPercent(0, 250, 0)).toBe(0);
    expect(payoffPercent(-10, 0, 7)).toBe(7);
  });

  it('gives exactly the figures of the four inline formulas it replaces', () => {
    const pairs: Array<[number, number]> = [
      [10000, 4500], [28254.21, 22577], [13173.7, 13173.7], [9403.3, 0.01], [0.03, 0.01], [999999999.99, 123456.78],
    ];
    for (const [total, remaining] of pairs) {
      const repaid = total - remaining;
      // DebtCard and useDebts: repaid first, then the share.
      expect(Object.is(payoffPercent(total, remaining, 100), total > 0 ? (repaid / total) * 100 : 100)).toBe(true);
      // DebtPayoffCard and TransactionForm: the difference inline.
      expect(Object.is(payoffPercent(total, remaining, 0), total > 0 ? ((total - remaining) / total) * 100 : 0)).toBe(true);
    }
  });
});
