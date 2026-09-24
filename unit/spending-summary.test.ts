import { describe, it, expect } from 'vitest';
import {
  buildSpendingSummary,
  selectLocalPattern,
  renderInsight,
} from '../src/utils/spendingSummary';
import type { Category, SpendingSummary, Transaction } from '../src/types';

/**
 * Phase 48's coverage gap (ADR 0021).
 *
 * `spendingSummary.ts` decides which of four patterns describes a month by
 * comparing against three numeric thresholds. `tests/insights.spec.ts` covers
 * the card end to end, but it cannot land a month on exactly +40% or exactly
 * three transactions — seeding those through the transaction form would mean
 * arithmetic in the test to hit a boundary that the form then rounds. So the
 * thresholds shipped untested at their edges, which is where a threshold's
 * bugs actually live.
 *
 * Pure module, node environment, no mocks. `now` is injected rather than
 * faked, because `buildSpendingSummary` already takes it as a parameter.
 */

// 2026-09-15, local. Months are local calendar months throughout this module.
const NOW = new Date(2026, 8, 15);

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: 'c', isSystem: true, isDeleted: false },
  { id: 'cat-transport', name: 'Transport', type: 'EXPENSE', icon: 'x', color: 'c', isSystem: true, isDeleted: false },
  { id: 'cat-debt', name: 'Debt', type: 'DEBT_REPAYMENT', icon: 'x', color: 'c', isSystem: true, isDeleted: false },
];

let seq = 0;

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'amount' | 'transactionDate'>): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    userId: 'usr-1',
    walletId: 'wal-1',
    type: 'EXPENSE',
    description: 'seeded',
    isDeleted: false,
    createdBy: 'usr-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A summary built by hand, for the selector tests where precision beats realism. */
function summaryOf(
  categories: SpendingSummary['categories'],
  totals: Partial<SpendingSummary['totals']> = {}
): SpendingSummary {
  const expense = totals.expense ?? categories.reduce((sum, c) => sum + c.current, 0);
  return {
    month: '2026-09',
    categories,
    totals: {
      income: totals.income ?? 0,
      expense,
      net: totals.net ?? (totals.income ?? 0) - expense,
      previousExpense: totals.previousExpense ?? 0,
    },
  };
}

describe('buildSpendingSummary — what counts as spending', () => {
  it('counts EXPENSE and DEBT_REPAYMENT, and excludes TRANSFER', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 200, transactionDate: '2026-09-03', categoryId: 'cat-debt', type: 'DEBT_REPAYMENT' }),
        // Moves money between the user's own wallets and spends nothing.
        tx({ amount: 500, transactionDate: '2026-09-04', categoryId: 'cat-food', type: 'TRANSFER' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.totals.expense).toBe(300);
    expect(summary.categories.map((c) => [c.name, c.current])).toEqual([
      ['Debt', 200],
      ['Food & Dining', 100],
    ]);
  });

  it('excludes soft-deleted rows from both the totals and the categories', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 999, transactionDate: '2026-09-02', categoryId: 'cat-transport', isDeleted: true }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.totals.expense).toBe(100);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0].name).toBe('Food & Dining');
  });

  it('counts INCOME toward the totals but never into a spending category', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 5000, transactionDate: '2026-09-01', type: 'INCOME', categoryId: 'cat-food' }),
        tx({ amount: 200, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.totals.income).toBe(5000);
    expect(summary.totals.expense).toBe(200);
    expect(summary.totals.net).toBe(4800);
    expect(summary.categories).toEqual([
      expect.objectContaining({ name: 'Food & Dining', current: 200, txCount: 1 }),
    ]);
  });

  it('buckets a row with no resolvable category as Uncategorized', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 70, transactionDate: '2026-09-02' }),
        tx({ amount: 30, transactionDate: '2026-09-03', categoryId: 'cat-deleted-since' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories).toEqual([
      expect.objectContaining({ name: 'Uncategorized', current: 100, txCount: 2 }),
    ]);
  });

  it('sorts categories by this month\'s total, descending', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 10, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 900, transactionDate: '2026-09-02', categoryId: 'cat-transport' }),
        tx({ amount: 400, transactionDate: '2026-09-02', categoryId: 'cat-debt', type: 'DEBT_REPAYMENT' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories.map((c) => c.name)).toEqual(['Transport', 'Debt', 'Food & Dining']);
  });
});

describe('buildSpendingSummary — month boundaries are sliced, never parsed', () => {
  /*
   * `txMonth` slices `transactionDate` rather than constructing a `Date` from
   * it. `CLAUDE.md` documents why: `new Date('2026-09-01')` parses as UTC
   * midnight, which at UTC+7 is 07:00 on the 1st — so the first hours of a
   * month would fall into the previous one. Both boundary days are pinned
   * here because a regression would move exactly these two rows and nothing
   * else, which is precisely the kind of drift nobody notices.
   */
  it('puts the first day of the month in the current month', () => {
    const summary = buildSpendingSummary(
      [tx({ amount: 120, transactionDate: '2026-09-01', categoryId: 'cat-food' })],
      CATEGORIES,
      NOW
    );

    expect(summary.month).toBe('2026-09');
    expect(summary.totals.expense).toBe(120);
    expect(summary.totals.previousExpense).toBe(0);
  });

  it('puts the last day of the previous month in the previous month', () => {
    const summary = buildSpendingSummary(
      [tx({ amount: 120, transactionDate: '2026-08-31', categoryId: 'cat-food' })],
      CATEGORIES,
      NOW
    );

    expect(summary.totals.expense).toBe(0);
    expect(summary.totals.previousExpense).toBe(120);
  });

  it('rolls the previous month across a year boundary', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 50, transactionDate: '2027-01-04', categoryId: 'cat-food' }),
        tx({ amount: 80, transactionDate: '2026-12-30', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      new Date(2027, 0, 10)
    );

    expect(summary.month).toBe('2027-01');
    expect(summary.totals.expense).toBe(50);
    expect(summary.totals.previousExpense).toBe(80);
  });

  it('ignores months either side of the two-month window', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 40, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 700, transactionDate: '2026-07-15', categoryId: 'cat-food' }),
        tx({ amount: 700, transactionDate: '2026-10-01', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.totals.expense).toBe(40);
    expect(summary.totals.previousExpense).toBe(0);
  });
});

describe('buildSpendingSummary — changePercent', () => {
  it('is null on a first-ever month rather than a fabricated 100%', () => {
    const summary = buildSpendingSummary(
      [tx({ amount: 250, transactionDate: '2026-09-02', categoryId: 'cat-food' })],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].previous).toBe(0);
    expect(summary.categories[0].changePercent).toBeNull();
  });

  it('is null for a category that is new even when the month itself is not', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-08-10', categoryId: 'cat-transport' }),
        tx({ amount: 250, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    const food = summary.categories.find((c) => c.name === 'Food & Dining');
    expect(food?.previous).toBe(0);
    expect(food?.changePercent).toBeNull();
  });

  it('is a signed percentage when there is a prior figure to compare', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 175, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].changePercent).toBe(75);
  });

  it('is negative when a category shrank', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 200, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 150, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].changePercent).toBe(-25);
  });
});

describe('selectLocalPattern — thresholds, at the edge', () => {
  /*
   * Each threshold is pinned twice: once at the value that must fire, once one
   * unit short. A single-sided test passes just as happily against a constant
   * that drifted the wrong way.
   */

  it('CATEGORY_SPIKE fires at exactly +40%', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 140, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].changePercent).toBe(40);
    expect(selectLocalPattern(summary)).toEqual({
      pattern: 'CATEGORY_SPIKE',
      focus: 'Food & Dining',
      confidence: 1,
    });
  });

  it('CATEGORY_SPIKE does not fire at +39%', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 139, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].changePercent).toBe(39);
    expect(selectLocalPattern(summary).pattern).toBe('STEADY');
  });

  it('NEW_RECURRING fires at exactly 3 transactions in a category with no prior spend', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 60, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 60, transactionDate: '2026-09-09', categoryId: 'cat-food' }),
        tx({ amount: 60, transactionDate: '2026-09-14', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].txCount).toBe(3);
    expect(summary.categories[0].previous).toBe(0);
    expect(selectLocalPattern(summary)).toEqual({
      pattern: 'NEW_RECURRING',
      focus: 'Food & Dining',
      confidence: 1,
    });
  });

  it('NEW_RECURRING does not fire at 2 transactions', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 60, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 60, transactionDate: '2026-09-09', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.categories[0].txCount).toBe(2);
    expect(selectLocalPattern(summary).pattern).toBe('STEADY');
  });

  it('NEW_RECURRING ignores a frequent category that also spent last month', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 55, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 20, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
        tx({ amount: 20, transactionDate: '2026-09-09', categoryId: 'cat-food' }),
        tx({ amount: 20, transactionDate: '2026-09-14', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    // Frequent, but not new: `previous` is 55, so it is not a habit forming.
    expect(summary.categories[0].txCount).toBe(3);
    expect(summary.categories[0].previous).toBe(55);
    expect(selectLocalPattern(summary).pattern).not.toBe('NEW_RECURRING');
  });

  it('IMPROVED_SAVING fires at exactly a 10% reduction', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 90, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(summary.totals.previousExpense).toBe(100);
    expect(summary.totals.expense).toBe(90);
    expect(selectLocalPattern(summary)).toEqual({
      pattern: 'IMPROVED_SAVING',
      focus: null,
      confidence: 1,
    });
  });

  it('IMPROVED_SAVING does not fire at a 9% reduction', () => {
    const summary = buildSpendingSummary(
      [
        tx({ amount: 100, transactionDate: '2026-08-10', categoryId: 'cat-food' }),
        tx({ amount: 91, transactionDate: '2026-09-02', categoryId: 'cat-food' }),
      ],
      CATEGORIES,
      NOW
    );

    expect(selectLocalPattern(summary).pattern).toBe('STEADY');
  });

  it('IMPROVED_SAVING does not fire without a previous month to improve on', () => {
    const summary = summaryOf(
      [{ name: 'Food & Dining', current: 10, previous: 0, changePercent: null, txCount: 1 }],
      { previousExpense: 0 }
    );

    expect(selectLocalPattern(summary).pattern).toBe('STEADY');
  });

  it('STEADY names the biggest category as its focus, and null when there is none', () => {
    const withSpend = summaryOf([
      { name: 'Transport', current: 300, previous: 290, changePercent: 3.45, txCount: 2 },
      { name: 'Food & Dining', current: 100, previous: 95, changePercent: 5.26, txCount: 1 },
    ], { previousExpense: 385 });

    expect(selectLocalPattern(withSpend)).toEqual({
      pattern: 'STEADY',
      focus: 'Transport',
      confidence: 1,
    });

    expect(selectLocalPattern(summaryOf([]))).toEqual({
      pattern: 'STEADY',
      focus: null,
      confidence: 1,
    });
  });
});

describe('selectLocalPattern — precedence when several patterns hold at once', () => {
  /*
   * The selector returns on the first match, so the order of its branches IS
   * the precedence rule. Built by hand rather than from transactions: these
   * summaries must satisfy three conditions simultaneously, which is fiddly to
   * arrange through the ledger and obvious to read here.
   */
  const spike = { name: 'Spike', current: 200, previous: 100, changePercent: 100, txCount: 1 };
  const recurring = { name: 'New Habit', current: 50, previous: 0, changePercent: null, txCount: 3 };
  const quiet = { name: 'Quiet', current: 50, previous: 40, changePercent: 25, txCount: 2 };

  it('spike beats new-recurring and improved-saving', () => {
    // All three hold: a +100% category, a 3-transaction newcomer, and spending
    // far below last month's.
    const summary = summaryOf([spike, recurring], { previousExpense: 1000 });
    expect(selectLocalPattern(summary)).toEqual({
      pattern: 'CATEGORY_SPIKE',
      focus: 'Spike',
      confidence: 1,
    });
  });

  it('new-recurring beats improved-saving once no spike qualifies', () => {
    const summary = summaryOf([recurring, quiet], { previousExpense: 1000 });
    expect(selectLocalPattern(summary)).toEqual({
      pattern: 'NEW_RECURRING',
      focus: 'New Habit',
      confidence: 1,
    });
  });

  it('improved-saving beats steady once no category qualifies', () => {
    const summary = summaryOf([quiet], { previousExpense: 1000 });
    expect(selectLocalPattern(summary)).toEqual({
      pattern: 'IMPROVED_SAVING',
      focus: null,
      confidence: 1,
    });
  });

  it('steady is the floor', () => {
    const summary = summaryOf([quiet], { previousExpense: 10 });
    expect(selectLocalPattern(summary).pattern).toBe('STEADY');
  });

  it('picks the largest of several qualifying spikes, not the steepest', () => {
    const summary = summaryOf(
      [
        { name: 'Big', current: 900, previous: 500, changePercent: 80, txCount: 4 },
        { name: 'Steep', current: 60, previous: 5, changePercent: 1100, txCount: 1 },
      ],
      { previousExpense: 505 }
    );

    // Sorted by `current`, so the category carrying real money wins over a
    // tiny one with a dramatic ratio.
    expect(selectLocalPattern(summary).focus).toBe('Big');
  });
});

describe('renderInsight — the app states the numbers', () => {
  const summary = summaryOf(
    [
      { name: 'Food & Dining', current: 1400, previous: 1000, changePercent: 40, txCount: 5 },
      { name: 'Transport', current: 600, previous: 0, changePercent: null, txCount: 3 },
    ],
    { income: 5000, previousExpense: 1000 }
  );

  it('renders the spike sentence from the summary, not the verdict', () => {
    const lines = renderInsight(summary, { pattern: 'CATEGORY_SPIKE', focus: 'Food & Dining', confidence: 0.9 });

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('You spent ฿2,000.00 this month across 2 categories.');
    expect(lines[1]).toContain('Food & Dining');
    expect(lines[1]).toContain('฿1,400.00');
    expect(lines[1]).toContain('up 40%');
    expect(lines[1]).toContain('฿1,000.00');
    expect(lines[2]).toBe('Income covered it with ฿3,000.00 left over.');
  });

  it('renders the new-recurring sentence with the transaction count', () => {
    const lines = renderInsight(summary, { pattern: 'NEW_RECURRING', focus: 'Transport', confidence: 0.9 });

    expect(lines[1]).toContain('Transport is new this month');
    expect(lines[1]).toContain('appears 3 times');
    expect(lines[1]).toContain('฿600.00');
  });

  it('renders the improved-saving sentence from the two months\' totals', () => {
    const saving = summaryOf(
      [{ name: 'Food & Dining', current: 400, previous: 1000, changePercent: -60, txCount: 2 }],
      { income: 5000, previousExpense: 1000 }
    );
    const lines = renderInsight(saving, { pattern: 'IMPROVED_SAVING', focus: null, confidence: 0.9 });

    expect(lines[1]).toContain('฿600.00 less');
    expect(lines[1]).toContain('฿1,000.00');
  });

  it('says how far past income a month went, when it went past', () => {
    const overspent = summaryOf(
      [{ name: 'Food & Dining', current: 900, previous: 800, changePercent: 12.5, txCount: 2 }],
      { income: 500, previousExpense: 800 }
    );
    const lines = renderInsight(overspent, { pattern: 'STEADY', focus: null, confidence: 0.9 });

    expect(lines[2]).toBe('That is ฿400.00 more than came in.');
  });

  it('uses the singular when exactly one category spent', () => {
    const single = summaryOf([{ name: 'Food & Dining', current: 100, previous: 0, changePercent: null, txCount: 1 }]);
    expect(renderInsight(single, { pattern: 'STEADY', focus: null, confidence: 1 })[0]).toBe(
      'You spent ฿100.00 this month across 1 category.'
    );
  });

  it('says so plainly when the month is empty', () => {
    const lines = renderInsight(summaryOf([]), { pattern: 'STEADY', focus: null, confidence: 1 });
    expect(lines[1]).toBe('There is no spending recorded this month yet.');
  });
});

describe('renderInsight — a verdict the ledger cannot support', () => {
  /*
   * The model picks a `focus` by category NAME. A stale cache, a renamed
   * category or a plain hallucination can therefore name something absent from
   * the summary. The card has no error state by construction (ADR 0020), so
   * the renderer must fall through to phrasing the numbers do support rather
   * than print a name the ledger cannot back.
   */
  const summary = summaryOf(
    [{ name: 'Food & Dining', current: 300, previous: 200, changePercent: 50, txCount: 2 }],
    { income: 1000, previousExpense: 200 }
  );

  it('falls back to steady phrasing when the focus category does not exist', () => {
    const lines = renderInsight(summary, { pattern: 'CATEGORY_SPIKE', focus: 'Yacht Maintenance', confidence: 0.99 });

    expect(lines[1]).toBe('Food & Dining led at ฿300.00, with no unusual movement anywhere else.');
    expect(lines.join(' ')).not.toContain('Yacht Maintenance');
  });

  it('falls back when a spike verdict names a category with no prior month', () => {
    const newOnly = summaryOf([
      { name: 'Transport', current: 120, previous: 0, changePercent: null, txCount: 1 },
    ]);
    const lines = renderInsight(newOnly, { pattern: 'CATEGORY_SPIKE', focus: 'Transport', confidence: 0.99 });

    // There is no honest "up N%" to state, so it does not state one.
    expect(lines[1]).toBe('Transport led at ฿120.00, with no unusual movement anywhere else.');
    expect(lines[1]).not.toContain('up ');
  });

  it('falls back when a new-recurring verdict names a missing category', () => {
    const lines = renderInsight(summary, { pattern: 'NEW_RECURRING', focus: 'Yacht Maintenance', confidence: 0.99 });
    expect(lines[1]).toContain('led at');
  });

  it('falls back when an improved-saving verdict contradicts the totals', () => {
    // Spending went UP, so there is no saving to commend.
    const worse = summaryOf(
      [{ name: 'Food & Dining', current: 900, previous: 200, changePercent: 350, txCount: 2 }],
      { income: 1000, previousExpense: 200 }
    );
    const lines = renderInsight(worse, { pattern: 'IMPROVED_SAVING', focus: null, confidence: 0.99 });

    expect(lines[1]).toContain('led at');
    expect(lines.join(' ')).not.toContain('less than last month');
  });

  it('never emits a currency figure absent from the summary', () => {
    /*
     * The executable form of ADR 0020's central claim: the model chooses the
     * pattern, the app states the amounts. Every ฿ figure in every rendered
     * variant must be derivable from `summary` alone.
     */
    const derivable = new Set(
      [
        summary.totals.expense,
        summary.totals.income,
        summary.totals.net,
        Math.abs(summary.totals.net),
        summary.totals.previousExpense,
        Math.abs(summary.totals.previousExpense - summary.totals.expense),
        ...summary.categories.flatMap((c) => [c.current, c.previous]),
      ].map((n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    );

    const patterns = ['CATEGORY_SPIKE', 'IMPROVED_SAVING', 'NEW_RECURRING', 'STEADY'] as const;
    for (const pattern of patterns) {
      for (const focus of ['Food & Dining', null, 'Yacht Maintenance']) {
        const rendered = renderInsight(summary, { pattern, focus, confidence: 1 }).join(' ');
        const figures = rendered.match(/฿[\d,]+\.\d{2}/g) ?? [];
        expect(figures.length).toBeGreaterThan(0);
        for (const figure of figures) {
          expect(derivable, `${pattern}/${focus} emitted ${figure}`).toContain(figure.slice(1));
        }
      }
    }
  });
});
