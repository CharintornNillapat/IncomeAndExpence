// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { CashFlowCard } from '../src/components/dashboard/CashFlowCard';
import { LeftOverCard } from '../src/components/dashboard/LeftOverCard';
import { CategorySpendingCard } from '../src/components/dashboard/CategorySpendingCard';
import { DebtWarningBanner } from '../src/components/dashboard/DebtWarningBanner';
import { DebtPayoffCard } from '../src/components/dashboard/DebtPayoffCard';
import { RecentActivityCard } from '../src/components/dashboard/RecentActivityCard';
import { MoodSpendingCard } from '../src/components/dashboard/MoodSpendingCard';
import { WalletsSection } from '../src/components/dashboard/WalletsSection';
import { cashFlow, groupByDay, leftOverFor, monthToDate, spendingByCategory, type CategorySpend } from '../src/selectors/ledger';
import { debtRemaining, netWorth, walletShares, walletTotal } from '../src/selectors/wallets';
import { debtPlan } from '../src/selectors/debts';
import { foldAdjustmentPairs } from '../src/selectors/adjustments';
import { dailySpendingSeries, moodSpendingDays } from '../src/selectors/diary';
import { buildLookupMap } from '../src/utils/mapUtils';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import type { Category, Debt, DiaryEntry, Transaction, Wallet } from '../src/types';
import type { TimeRange } from '../src/selectors/timeRange';

/**
 * Phase 57 (ADR 0030, spec 6.1): the redesigned Dashboard's cards, rendered
 * from the same selectors `DashboardView` calls, against spec 10's
 * acceptance checks that a card can fail on its own: one Spending figure, the
 * net worth sum, the L5 banner, the L8 fold, no raw enum or placeholder
 * label, and signs that never leave the meaning to colour.
 *
 * The view itself needs the finance context; its wiring is covered by the
 * Playwright suite, which lands on this page in every test.
 */
let originalTz: string | undefined;
beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = 'Asia/Bangkok';
});
afterAll(() => {
  process.env.TZ = originalTz;
});
afterEach(() => cleanup());

const TODAY = '2026-09-28';

const CATEGORY_LIST: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false },
  { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'x', color: '#F59E6B', isSystem: true, isDeleted: false },
  { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'x', color: '#8FA8C8', isSystem: true, isDeleted: false },
  { id: 'cat-debt', name: 'DEBT_REPAYMENT', type: 'DEBT_REPAYMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
  // A trap: an adjustment category whose stored name is one the spec forbids on screen (L13).
  { id: 'cat-adjust', name: 'General', type: 'ADJUSTMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
];
const CATEGORIES = buildLookupMap(CATEGORY_LIST);

function wallet(id: string, name: string, balance: number, overrides: Partial<Wallet> = {}): Wallet {
  return {
    id,
    userId: 'u',
    name,
    type: 'BANK_ACCOUNT',
    currency: 'THB',
    balance,
    color: '#6C8EEF',
    icon: 'x',
    isArchived: false,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const WALLET_LIST = [
  wallet('cash', 'Cash', 27900, { type: 'CASH', color: '#D9A066' }),
  wallet('main', 'Main', 2663.55),
  wallet('sub', 'Sub', 1608.93, { color: '#4FB7A8' }),
];
const WALLETS = buildLookupMap(WALLET_LIST);

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    userId: 'u',
    walletId: 'cash',
    description: `row ${seq}`,
    transactionDate: TODAY,
    isDeleted: false,
    createdBy: 'u',
    createdAt: `2026-09-28T00:00:${String(seq).padStart(2, '0')}.000Z`,
    updatedAt: '',
    ...overrides,
  };
}

function debt(id: string, name: string, total: number, remaining: number, dueDate?: string): Debt {
  return { id, userId: 'u', name, totalAmount: total, remainingAmount: remaining, dueDate, isSettled: false, isDeleted: false, createdAt: '', updatedAt: '' };
}

describe('acceptance check 1: one Spending figure', () => {
  const ROWS = [
    tx({ type: 'INCOME', amount: 13103, categoryId: 'cat-salary' }),
    tx({ type: 'EXPENSE', amount: 2484.97, categoryId: 'cat-groceries' }),
    tx({ type: 'EXPENSE', amount: 2360, categoryId: 'cat-food' }),
    tx({ type: 'EXPENSE', amount: 70, categoryId: 'cat-debt' }),
    tx({ type: 'DEBT_REPAYMENT', amount: 5000, categoryId: 'cat-debt', debtId: 'spay' }),
    tx({ type: 'TRANSFER', amount: 300, destinationWalletId: 'main' }),
    tx({ type: 'ADJUSTMENT', amount: -40, categoryId: 'cat-adjust' }),
  ];

  it('prints the same total on the Cash flow card and the category card', () => {
    const flow = cashFlow(ROWS, CATEGORIES);
    const rows = spendingByCategory(ROWS, CATEGORIES);
    render(
      <>
        <CashFlowCard kind="spending" amount={flow.spending} />
        <CategorySpendingCard
          rows={rows}
          total={flow.spending}
          monthToDate={monthToDate(ROWS, TODAY, CATEGORIES)}
          onOpenDetails={() => {}}
        />
      </>
    );
    const spending = formatCurrencyAmount(4844.97);
    expect(screen.getByTestId('metric-card-expense').textContent).toContain(`${MINUS}${spending}`);
    const categoryCard = screen.getByRole('region', { name: 'Spending by category' });
    expect(categoryCard.textContent).toContain(spending);
    const rowSum = rows.reduce((sum, row) => sum + row.amount, 0);
    expect(rowSum).toBeCloseTo(flow.spending, 10);
  });

  it('leaves repayments, adjustments and transfers out of the category rows', () => {
    render(
      <CategorySpendingCard
        rows={spendingByCategory(ROWS, CATEGORIES)}
        total={cashFlow(ROWS, CATEGORIES).spending}
        monthToDate={monthToDate(ROWS, TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toHaveLength(2);
    expect(names.join(' ')).not.toMatch(/DEBT_REPAYMENT|General|Transfer|adjustment/i);
  });
});

describe('Left over follows the net rule (spec section 3)', () => {
  it('is signed and in the primary text colour when positive', () => {
    const rows = [tx({ type: 'INCOME', amount: 500 }), tx({ type: 'EXPENSE', amount: 200 })];
    render(<LeftOverCard data={leftOverFor(rows, 'DAY', TODAY, 0, CATEGORIES)} series={null} periodName="today" periodDates="Sep 28" />);
    const net = screen.getByText(`+${formatCurrencyAmount(300)}`);
    expect(net.textContent).toBe(`+${formatCurrencyAmount(300)}`);
    expect(net.className).toContain('text-fg');
    expect(net.className).not.toContain('text-income');
  });

  it('is signed and red when negative, and says when there was no income', () => {
    const rows = [tx({ type: 'EXPENSE', amount: 200 })];
    render(<LeftOverCard data={leftOverFor(rows, 'DAY', TODAY, 0, CATEGORIES)} series={null} periodName="today" periodDates="Sep 28" />);
    const net = screen.getByText(`${MINUS}${formatCurrencyAmount(200)}`);
    expect(net.textContent).toBe(`${MINUS}${formatCurrencyAmount(200)}`);
    expect(net.className).toContain('text-expense');
    expect(screen.getByText('No income this period')).toBeTruthy();
  });

  it('sets the figure at the Hero size', () => {
    const rows = [tx({ type: 'INCOME', amount: 500 }), tx({ type: 'EXPENSE', amount: 200 })];
    render(<LeftOverCard data={leftOverFor(rows, 'DAY', TODAY, 0, CATEGORIES)} series={null} periodName="today" periodDates="Sep 28" />);
    const net = screen.getByText(`+${formatCurrencyAmount(300)}`);
    expect(net.className).toContain('text-hero');
    expect(net.className).not.toContain('text-4xl');
  });
});

describe('Left over card (owner spec 4.2)', () => {
  it('shows left over, kept share, after debt due, and spent/kept bar for MONTH with a debt due', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 10000, categoryId: 'cat-salary' }),
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food' }),
    ];
    render(
      <LeftOverCard
        data={leftOverFor(rows, 'MONTH', TODAY, 1500, CATEGORIES)}
        series={null}
        periodName="past 30 days"
        periodDates="Aug 29 – Sep 28"
      />
    );
    expect(screen.getByText('+฿7,000.00')).toBeTruthy();
    expect(screen.getByText(/70% of income kept/)).toBeTruthy();
    expect(screen.getByText('฿5,500.00')).toBeTruthy();
    expect(screen.getByText(/after debt due/)).toBeTruthy();
    expect(screen.getByText('Spent 30%')).toBeTruthy();
    expect(screen.getByText('Kept 70%')).toBeTruthy();
  });

  it('omits after-debt line outside MONTH', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 10000, categoryId: 'cat-salary' }),
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food' }),
    ];
    render(
      <LeftOverCard
        data={leftOverFor(rows, 'DAY', TODAY, 1500, CATEGORIES)}
        series={null}
        periodName="today"
        periodDates="Sep 28"
      />
    );
    expect(screen.queryByText(/after debt due/)).toBeNull();
  });

  it('shows spent more than earned and negative figures with text-expense when spending passed income', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary' }),
      tx({ type: 'EXPENSE', amount: 1200, categoryId: 'cat-food' }),
    ];
    render(
      <LeftOverCard
        data={leftOverFor(rows, 'MONTH', TODAY, 100, CATEGORIES)}
        series={null}
        periodName="past 30 days"
        periodDates="Aug 29 – Sep 28"
      />
    );
    expect(screen.getByText(/Spent 20% more than earned/)).toBeTruthy();
    const figure = screen.getByText(`${MINUS}฿200.00`);
    expect(figure.className).toContain('text-expense');
    const afterDebt = screen.getByText(`${MINUS}฿300.00`);
    expect(afterDebt.className).toContain('text-expense');
  });

  it('renders a sparkline with an accessible name and valid points', () => {
    const rows = [tx({ type: 'EXPENSE', amount: 2500, categoryId: 'cat-food' })];
    const series = dailySpendingSeries(rows, 'WEEK', TODAY, CATEGORIES);
    const { container } = render(
      <LeftOverCard
        data={leftOverFor(rows, 'WEEK', TODAY, 0, CATEGORIES)}
        series={series}
        periodName="this week"
        periodDates="Sep 21 – Sep 28"
      />
    );
    const img = screen.getByRole('img', { name: 'Daily spending, this week: highest ฿2,500.00 on Mon, Sep 28' });
    expect(img).toBeTruthy();
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeTruthy();
    const pointsAttr = polyline!.getAttribute('points') ?? '';
    const pairs = pointsAttr.trim().split(/\s+/);
    expect(pairs).toHaveLength(8);
    for (const pair of pairs) {
      expect(pair).not.toContain('NaN');
      const coords = pair.split(',');
      expect(coords).toHaveLength(2);
      expect(Number.isFinite(parseFloat(coords[0]))).toBe(true);
      expect(Number.isFinite(parseFloat(coords[1]))).toBe(true);
    }
  });

  it('renders no sparkline when series is null', () => {
    const rows = [tx({ type: 'EXPENSE', amount: 2500, categoryId: 'cat-food' })];
    render(
      <LeftOverCard
        data={leftOverFor(rows, 'DAY', TODAY, 0, CATEGORIES)}
        series={null}
        periodName="today"
        periodDates="Sep 28"
      />
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('handles a new account with no transactions', () => {
    const data = leftOverFor([], 'MONTH', TODAY, 0, CATEGORIES);
    const series = dailySpendingSeries([], 'MONTH', TODAY, CATEGORIES);
    const { container, unmount } = render(
      <LeftOverCard
        data={data}
        series={series}
        periodName="past 30 days"
        periodDates="Aug 29 – Sep 28"
      />
    );
    expect(screen.getByText('฿0.00')).toBeTruthy();
    expect(container.querySelector('p')).toBeNull();
    expect(screen.queryByText(/after debt due/)).toBeNull();
    expect(screen.queryByText(/No income/)).toBeNull();
    expect(screen.getByRole('img', { name: 'Daily spending, past 30 days: nothing spent' })).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);

    unmount();
    const dataWithNeeded = leftOverFor([], 'MONTH', TODAY, 1500, CATEGORIES);
    const { container: container2 } = render(
      <LeftOverCard
        data={dataWithNeeded}
        series={series}
        periodName="past 30 days"
        periodDates="Aug 29 – Sep 28"
      />
    );
    expect(container2.querySelector('p')).toBeNull();
    expect(screen.queryByText(/after debt due/)).toBeNull();
  });

  it('renders Income and Spending cards correctly', () => {
    const { unmount } = render(<CashFlowCard kind="income" amount={10000} />);
    expect(screen.getByRole('heading', { name: 'Income' })).toBeTruthy();
    const incomeAmount = screen.getByText(`+${formatCurrencyAmount(10000)}`);
    expect(incomeAmount.className).toContain('text-income');

    unmount();
    render(<CashFlowCard kind="spending" amount={3000} />);
    expect(screen.getByRole('heading', { name: 'Spending' })).toBeTruthy();
    const spendingAmount = screen.getByText(`${MINUS}${formatCurrencyAmount(3000)}`);
    expect(spendingAmount.className).toContain('text-expense');
  });

  describe('No NaN, Infinity or bare percent, in any period (Amendment 1)', () => {
    const RANGES: Array<{ range: TimeRange; periodName: string }> = [
      { range: 'DAY', periodName: 'today' },
      { range: 'WEEK', periodName: 'this week' },
      { range: 'MONTH', periodName: 'past 30 days' },
      { range: 'ALL', periodName: 'all time' },
    ];

    const DATASETS: Array<{ name: string; rows: Transaction[] }> = [
      { name: 'empty', rows: [] },
      { name: 'income only', rows: [tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary', transactionDate: TODAY })] },
      { name: 'spending only', rows: [tx({ type: 'EXPENSE', amount: 250, categoryId: 'cat-food', transactionDate: '2026-09-25' })] },
      {
        name: 'income 1000 with spending 300',
        rows: [
          tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary', transactionDate: TODAY }),
          tx({ type: 'EXPENSE', amount: 300, categoryId: 'cat-food', transactionDate: '2026-09-25' }),
        ],
      },
      {
        name: 'spending past income',
        rows: [
          tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary', transactionDate: TODAY }),
          tx({ type: 'EXPENSE', amount: 1200, categoryId: 'cat-food', transactionDate: '2026-09-25' }),
        ],
      },
      {
        name: 'income 3 with spending 1',
        rows: [
          tx({ type: 'INCOME', amount: 3, categoryId: 'cat-salary', transactionDate: TODAY }),
          tx({ type: 'EXPENSE', amount: 1, categoryId: 'cat-food', transactionDate: '2026-09-25' }),
        ],
      },
    ];

    it.each(RANGES)('renders cleanly without NaN, Infinity or bare % for %s', ({ range, periodName }) => {
      for (const { rows } of DATASETS) {
        for (const needed of [0, 1500]) {
          const data = leftOverFor(rows, range, TODAY, needed, CATEGORIES);
          const series = dailySpendingSeries(rows, range, TODAY, CATEGORIES);
          const { container, unmount } = render(
            <LeftOverCard
              data={data}
              series={series}
              periodName={periodName}
              periodDates="x"
            />
          );
          expect(container.innerHTML).not.toMatch(/NaN|Infinity/);

          const ariaLabels = Array.from(container.querySelectorAll('[aria-label]'))
            .map((el) => el.getAttribute('aria-label') ?? '')
            .join(' ');
          const combined = `${container.textContent ?? ''} ${ariaLabels}`;
          expect(combined).not.toMatch(/NaN|Infinity/);
          expect(combined).not.toMatch(/(^|[^0-9])%/);

          unmount();
        }
      }
    });
  });
});

describe('acceptance check 3: net worth is wallets minus debt', () => {
  it("shows the spec's sample figure, ฿9,595.48, with the debt signed", () => {
    const debts = [debt('spay', 'SPayLater', 17000, 13173.7, '2027-01-01'), debt('easy', 'SEasy Cash', 10500, 9403.3, '2028-04-01')];
    render(
      <WalletsSection
        wallets={WALLET_LIST}
        shares={walletShares(WALLET_LIST)}
        netWorth={netWorth(WALLET_LIST, debts)}
        walletTotal={walletTotal(WALLET_LIST)}
        debtRemaining={debtRemaining(debts)}
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    const card = screen.getByTestId('net-worth-card');
    expect(card.textContent).toContain('฿9,595.48');
    expect(card.textContent).toContain('THB');
    expect(card.textContent).toContain('In 3 wallets');
    expect(card.textContent).toContain('฿32,172.48');
    expect(card.textContent).toContain(`${MINUS}฿22,577.00`);
    expect(screen.getByText('฿9,595.48').className).toContain('text-fg');
  });

  it('turns red when debt passes what the wallets hold (spec section 3)', () => {
    render(
      <WalletsSection
        wallets={WALLET_LIST}
        shares={walletShares(WALLET_LIST)}
        netWorth={-38850}
        walletTotal={7650}
        debtRemaining={46500}
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    const figure = screen.getByText(`${MINUS}฿38,850.00`);
    expect(figure.className).toContain('text-expense');
  });
});

describe('acceptance check 4: L4 figures and the L5 banner', () => {
  const debts = [debt('spay', 'SPayLater', 17000, 13173.7, '2027-01-01'), debt('easy', 'SEasy Cash', 10500, 9403.3, '2028-04-01')];

  it('names the one debt that outruns the surplus, with its L4 figure', () => {
    const plan = debtPlan(debts, TODAY, 3106.78);
    const onReview = vi.fn();
    render(<DebtWarningBanner plan={plan} onReviewPlan={onReview} />);
    const note = screen.getByRole('note');
    // Four payment dates to 1 Jan 2027 (ADR 0087), still more than the surplus.
    expect(note.textContent).toContain('SPayLater needs ฿3,293.43 a month to be cleared by Jan 1, 2027');
    expect(note.textContent).toContain('surplus of ฿3,106.78');
    expect(note.textContent).not.toContain('\u2014');
    fireEvent.click(within(note).getByRole('button', { name: 'Review plan' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when the plan fits', () => {
    const { container } = render(<DebtWarningBanner plan={debtPlan(debts, TODAY, 10000)} onReviewPlan={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('marks only the debt that needs more than the surplus', () => {
    render(<DebtPayoffCard plan={debtPlan(debts, TODAY, 3106.78)} paid={5677.21} total={28254.21} progressPercent={20.1} onOpenDebts={() => {}} />);
    const needed = screen.getAllByText(/\/ month needed/);
    expect(needed.map((el) => el.textContent)).toEqual(['฿3,293.43 / month needed', '฿494.91 / month needed']);
    expect(needed[0].className).toContain('text-pending');
    expect(needed[1].className).not.toContain('text-pending');
    expect(screen.getByText(/due Jan 1, 2027/)).toBeTruthy();
  });

  it('reads a debt with nothing borrowed as 100% paid, as the Debt payoff page does (ADR 0080)', () => {
    render(<DebtPayoffCard plan={debtPlan([debt('zero', 'Gift', 0, 0), debt('owed', 'Gift owed', 0, 250)], TODAY, 5000)} paid={-250} total={0} progressPercent={0} onOpenDebts={() => {}} />);
    expect(screen.getByLabelText('Gift payoff progress').getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getAllByText(/^100\.0% · no due date$/)).toHaveLength(2);
  });

  it('says Overdue in red once a due date has passed', () => {
    render(<DebtPayoffCard plan={debtPlan([debt('late', 'Late loan', 1000, 400, '2026-08-01')], TODAY, 5000)} paid={600} total={1000} progressPercent={60} onOpenDebts={() => {}} />);
    const overdue = screen.getByText(/^Overdue/);
    expect(overdue.className).toContain('text-expense');
  });
});

describe('Recent activity: L8 fold, L11 nets, and no placeholder labels', () => {
  const ROWS = [
    tx({ type: 'EXPENSE', amount: 300, categoryId: 'cat-food', description: 'Camel 300' }),
    tx({ type: 'ADJUSTMENT', amount: 7900, categoryId: 'cat-adjust', description: '' }),
    tx({ type: 'ADJUSTMENT', amount: -7900, categoryId: 'cat-adjust', description: '' }),
    tx({ type: 'TRANSFER', amount: 300, walletId: 'main', destinationWalletId: 'cash', description: 'Transaction' }),
    tx({ type: 'DEBT_REPAYMENT', amount: 500, categoryId: 'cat-debt', description: '' }),
    tx({ type: 'INCOME', amount: 1000, transactionDate: '2026-09-27', description: 'กิจนิมนต์' }),
  ];

  function renderCard() {
    const nets = new Map(groupByDay(ROWS, CATEGORIES).map((day) => [day.date, day.net]));
    return render(
      <RecentActivityCard
        items={foldAdjustmentPairs(ROWS)}
        dayNets={nets}
        wallets={WALLETS}
        categories={CATEGORIES}
        today={TODAY}
        onViewAll={() => {}}
      />
    );
  }

  it('folds a cancelling adjustment pair into one row that expands', () => {
    renderCard();
    const pair = screen.getByRole('button', { name: /2 balance adjustments on Cash that cancel out/ });
    expect(pair.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByText('Balance adjustment')).toHaveLength(0);
    fireEvent.click(pair);
    expect(pair.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('Balance adjustment').length).toBeGreaterThanOrEqual(2);
  });

  it('groups by day with the L11 net: transfers, repayments and adjustments do not move it', () => {
    renderCard();
    expect(screen.getByText('Today · Mon, Sep 28').parentElement!.textContent).toContain(`${MINUS}${formatCurrencyAmount(300)}`);
    expect(screen.getByText('Yesterday · Sun, Sep 27').parentElement!.textContent).toContain(`+${formatCurrencyAmount(1000)}`);
  });

  it('prints no raw enum, "General", "No category" or the default "Transaction"', () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /cancel out/ }));
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/DEBT_REPAYMENT|ADJUSTMENT|General|No category|\bTransaction\b/);
    expect(text).toContain('Main → Cash');
    expect(text).toContain('Debt repayment');
  });

  it('shows each description once', () => {
    renderCard();
    expect(screen.getAllByText('Camel 300')).toHaveLength(1);
    expect(screen.getAllByText('กิจนิมนต์')).toHaveLength(1);
  });

  it('sits in a named region containing the View all button and activity items', () => {
    const { container } = renderCard();
    const region = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(region).getByRole('button', { name: 'View all' })).toBeTruthy();
    for (const el of container.querySelectorAll('[id^="dashboard-tx-"]')) {
      expect(region.contains(el)).toBe(true);
    }
  });
});

describe('Mood & spending', () => {
  const entries: DiaryEntry[] = [
    { id: 'd1', userId: 'u', date: '2026-09-05', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
    { id: 'd2', userId: 'u', date: '2026-09-03', mood: 4, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
  ];
  const rows = [tx({ type: 'EXPENSE', amount: 340, transactionDate: '2026-09-05' })];

  it('draws the mood as a labelled meter and signs the spending', () => {
    render(<MoodSpendingCard mood={moodSpendingDays(entries, rows, CATEGORIES, 'MONTH', TODAY)} today={TODAY} todayLogged={false} onOpenDiary={() => {}} />);
    expect(screen.getByRole('img', { name: 'Mood 3 of 5' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mood 4 of 5' })).toBeTruthy();
    expect(screen.getByText(`${MINUS}${formatCurrencyAmount(340)}`).className).toContain('text-expense');
    expect(screen.getByText('Only 2 days logged in this period. Log more days to see a pattern.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log today (Mon, Sep 28)' })).toBeTruthy();
  });

  it('offers to edit today once it is logged', () => {
    render(<MoodSpendingCard mood={moodSpendingDays(entries, rows, CATEGORIES, 'MONTH', TODAY)} today={TODAY} todayLogged onOpenDiary={() => {}} />);
    expect(screen.getByRole('button', { name: "Edit today's entry" })).toBeTruthy();
  });
});

describe('Wallets section', () => {
  it('keeps the ids the suite drives, and each row opens its wallet', () => {
    const onOpen = vi.fn();
    const onTransfer = vi.fn();
    const { container } = render(
      <WalletsSection
        wallets={WALLET_LIST}
        shares={walletShares(WALLET_LIST)}
        netWorth={netWorth(WALLET_LIST, [])}
        walletTotal={walletTotal(WALLET_LIST)}
        debtRemaining={0}
        onTransfer={onTransfer}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={onOpen}
      />
    );
    for (const id of ['hero-transfer-funds-btn', 'hero-add-wallet-btn', 'hero-manage-all-wallets-btn']) {
      expect(container.querySelector(`button#${id}`)).not.toBeNull();
    }
    fireEvent.click(container.querySelector('#hero-transfer-funds-btn')!);
    expect(onTransfer).toHaveBeenCalledWith();

    const row = container.querySelector('button#dashboard-wallet-card-main')!;
    expect(row.textContent).toContain('Bank Account · 8.3%');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith('main');
    expect(screen.getByRole('img', { name: /Share of money by wallet: Cash 86\.7%/ })).toBeTruthy();
    expect(screen.queryByText('No money in your wallets yet')).toBeNull();
  });

  // Phase 66 (ADR 0042, audit 013 finding 6): a new account's wallets are all
  // at ฿0, and the empty bar says so once.
  it('captions the empty bar when no wallet holds money, once', () => {
    const empty = WALLET_LIST.map((w) => ({ ...w, balance: 0 }));
    render(
      <WalletsSection
        wallets={empty}
        shares={walletShares(empty)}
        netWorth={netWorth(empty, [])}
        walletTotal={walletTotal(empty)}
        debtRemaining={0}
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    expect(screen.getAllByText('No money in your wallets yet')).toHaveLength(1);
  });

  // Phase 109 (ADR 0085, audit finding 8): wallets below zero are not empty.
  it('gives the total, not "no money", when the wallets add up to less than zero', () => {
    const owing = WALLET_LIST.map((w, i) => ({ ...w, balance: i === 0 ? -1200 : 0 }));
    render(
      <WalletsSection
        wallets={owing}
        shares={walletShares(owing)}
        netWorth={netWorth(owing, [])}
        walletTotal={walletTotal(owing)}
        debtRemaining={0}
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    expect(screen.queryByText('No money in your wallets yet')).toBeNull();
    expect(screen.getAllByText(`Your wallets add up to ${MINUS}฿1,200.00`)).toHaveLength(1);
  });
});

describe('Net worth and wallets card (owner spec 4.4)', () => {
  const debts = [debt('spay', 'SPayLater', 17000, 13173.7, '2027-01-01'), debt('easy', 'SEasy Cash', 10500, 9403.3, '2028-04-01')];

  it('renders net worth block, wallets heading, buttons, and single net worth figure', () => {
    const { container } = render(
      <WalletsSection
        wallets={WALLET_LIST}
        shares={walletShares(WALLET_LIST)}
        netWorth={netWorth(WALLET_LIST, debts)}
        walletTotal={walletTotal(WALLET_LIST)}
        debtRemaining={debtRemaining(debts)}
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    const region = screen.getByRole('region', { name: 'Net worth and wallets' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Net worth' })).toBeTruthy();
    expect(within(region).getByRole('heading', { level: 3, name: 'Wallets' })).toBeTruthy();
    expect(within(region).getByTestId('net-worth-card')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Transfer' })).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Add wallet' })).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Manage wallets' })).toBeTruthy();
    expect(container.querySelector('button#dashboard-wallet-card-main')).not.toBeNull();
    expect(region.querySelectorAll('[data-testid="net-worth-card"]')).toHaveLength(1);
    expect(screen.getAllByText('฿9,595.48')).toHaveLength(1);
  });

  it('renders a new account with three 0-balance wallets without NaN, Infinity or bare %', () => {
    const empty = WALLET_LIST.map((w) => ({ ...w, balance: 0 }));
    render(
      <WalletsSection
        wallets={empty}
        shares={walletShares(empty)}
        netWorth={0}
        walletTotal={0}
        debtRemaining={0}
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    const region = screen.getByRole('region', { name: 'Net worth and wallets' });
    expect(region.textContent).toContain('In 3 wallets');
    expect(region.textContent).toContain('฿0.00');
    expect(region.textContent).toContain('No money in your wallets yet');

    const text = region.textContent || '';
    const labels = Array.from(region.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label') || '').join(' ');
    const combined = `${text} ${labels}`;
    expect(combined).not.toMatch(/NaN|Infinity/);
    expect(combined).not.toMatch(/(^|[^0-9])%/);
  });
});

describe('Mood and spending card (owner spec 4.4, decision A)', () => {
  const entries: DiaryEntry[] = [
    { id: 'd1', userId: 'u', date: '2026-09-05', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
    { id: 'd2', userId: 'u', date: '2026-09-03', mood: 4, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
  ];
  const rows = [tx({ type: 'EXPENSE', amount: 340, transactionDate: '2026-09-05' })];

  it('lays out days oldest on the left', () => {
    render(<MoodSpendingCard mood={moodSpendingDays(entries, rows, CATEGORIES, 'MONTH', TODAY)} today={TODAY} todayLogged={false} onOpenDiary={() => {}} />);
    const region = screen.getByRole('region', { name: 'Mood and spending' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Mood and spending' })).toBeTruthy();
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Thu, Sep 3');
    expect(within(items[0]).getByRole('img', { name: 'Mood 4 of 5' })).toBeTruthy();
    expect(items[1].textContent).toContain('Sat, Sep 5');
    expect(items[1].textContent).toContain(`${MINUS}฿340.00`);
  });

  it('shows at most five days, oldest of the five first, with no prompt when 5 are shown', () => {
    const sixEntries: DiaryEntry[] = [
      { id: 'd-22', userId: 'u', date: '2026-09-22', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: 'd-23', userId: 'u', date: '2026-09-23', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: 'd-24', userId: 'u', date: '2026-09-24', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: 'd-25', userId: 'u', date: '2026-09-25', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: 'd-26', userId: 'u', date: '2026-09-26', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: 'd-27', userId: 'u', date: '2026-09-27', mood: 3, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: '', updatedAt: '' },
    ];
    render(<MoodSpendingCard mood={moodSpendingDays(sixEntries, rows, CATEGORIES, 'MONTH', TODAY)} today={TODAY} todayLogged={false} onOpenDiary={() => {}} />);
    const region = screen.getByRole('region', { name: 'Mood and spending' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain('Wed, Sep 23');
    expect(items[4].textContent).toContain('Sun, Sep 27');
    expect(within(region).queryByText(/logged in this period/)).toBeNull();
  });

  it('renders empty prompt when no diary days are logged', () => {
    render(<MoodSpendingCard mood={moodSpendingDays([], rows, CATEGORIES, 'MONTH', TODAY)} today={TODAY} todayLogged={false} onOpenDiary={() => {}} />);
    const region = screen.getByRole('region', { name: 'Mood and spending' });
    expect(within(region).queryByRole('list')).toBeNull();
    expect(within(region).getByText('No diary days logged in this period. Log a day to see your mood beside your spending.')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Log today (Mon, Sep 28)' })).toBeTruthy();

    const text = region.textContent || '';
    const labels = Array.from(region.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label') || '').join(' ');
    const combined = `${text} ${labels}`;
    expect(combined).not.toMatch(/NaN|Infinity/);
    expect(combined).not.toMatch(/(^|[^0-9])%/);
  });
});

describe('Spending by category card (owner spec 4.3)', () => {
  it('shows top five categories, rest row, and donut geometry', () => {
    const rows: CategorySpend[] = [
      { categoryId: 'a', name: 'A', amount: 700, color: '#111111' },
      { categoryId: 'b', name: 'B', amount: 600, color: '#222222' },
      { categoryId: 'c', name: 'C', amount: 500, color: '#333333' },
      { categoryId: 'd', name: 'D', amount: 400, color: '#444444' },
      { categoryId: 'e', name: 'E', amount: 300, color: '#555555' },
      { categoryId: 'f', name: 'F', amount: 200, color: '#666666' },
      { categoryId: 'g', name: 'G', amount: 100, color: '#777777' },
    ];
    const { container } = render(
      <CategorySpendingCard
        rows={rows}
        total={2800}
        monthToDate={monthToDate([], TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(6);
    expect(listItems[0].textContent).toContain('25.0%');
    expect(listItems[0].textContent).toContain('฿700.00');
    expect(listItems[5].textContent).toContain('2 more categories');
    expect(listItems[5].textContent).toContain('10.7%');
    expect(listItems[5].textContent).not.toContain('฿');

    expect(
      screen.getByRole('img', {
        name: 'Spending by category: A 25.0%, B 21.4%, C 17.9%, D 14.3%, E 10.7%, 2 more categories 10.7%',
      })
    ).toBeTruthy();

    const circles = container.querySelectorAll('svg circle');
    expect(circles).toHaveLength(7);
    const card = screen.getByRole('region', { name: 'Spending by category' });
    expect(card.textContent).toContain('฿2,800.00');
    expect(card.textContent).toContain('total spent');
  });

  it('renders one segment with stroke-dasharray 100 0 for a single category', () => {
    const rows: CategorySpend[] = [
      { categoryId: 'a', name: 'Food', amount: 500, color: '#111111' },
    ];
    const { container } = render(
      <CategorySpendingCard
        rows={rows}
        total={500}
        monthToDate={monthToDate([], TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    expect(
      screen.getByRole('img', {
        name: 'Spending by category: Food 100.0%',
      })
    ).toBeTruthy();
    const circles = container.querySelectorAll('svg circle');
    expect(circles).toHaveLength(2);
    expect(circles[1].getAttribute('stroke-dasharray')).toBe('100 0');
  });

  it('renders empty state when rows is empty and total is 0', () => {
    render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={monthToDate([], TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    expect(screen.getByText('No spending in this period.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('September 1 to 28:')).toBeTruthy();
  });

  it('renders month line with spending down', () => {
    const txs = [
      tx({ type: 'INCOME', amount: 10000, categoryId: 'cat-salary', transactionDate: '2026-09-01' }),
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food', transactionDate: '2026-09-10' }),
      tx({ type: 'EXPENSE', amount: 6000, categoryId: 'cat-food', transactionDate: '2026-08-10' }),
    ];
    const mtd = monthToDate(txs, TODAY, CATEGORIES);
    render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={mtd}
        onOpenDetails={() => {}}
      />
    );
    expect(screen.getByText('September 1 to 28:')).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Spending by category' });
    expect(card.textContent).toContain('฿3,000.00 spent, against ฿6,000.00 in August 1 to 28.');
    expect(card.textContent).toContain('+฿7,000.00 left over.');
    const pill = screen.getByText(`${MINUS}50% vs Aug`);
    expect(pill.className).toContain('bg-adjust-tint');
  });

  it('renders month line with spending up', () => {
    const txs = [
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food', transactionDate: '2026-09-10' }),
      tx({ type: 'EXPENSE', amount: 2400, categoryId: 'cat-food', transactionDate: '2026-08-10' }),
    ];
    const mtd = monthToDate(txs, TODAY, CATEGORIES);
    render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={mtd}
        onOpenDetails={() => {}}
      />
    );
    const pill = screen.getByText('+25% vs Aug');
    expect(pill.className).toContain('bg-expense-tint');
    const leftOverEl = screen.getByText(`${MINUS}฿3,000.00`);
    expect(leftOverEl.className).toContain('text-expense');
  });

  it('renders month line when there was no spending last month', () => {
    const txs = [
      tx({ type: 'INCOME', amount: 10000, categoryId: 'cat-salary', transactionDate: '2026-09-01' }),
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food', transactionDate: '2026-09-10' }),
    ];
    const mtd = monthToDate(txs, TODAY, CATEGORIES);
    render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={mtd}
        onOpenDetails={() => {}}
      />
    );
    expect(screen.queryByText(/vs Aug/)).toBeNull();
    const card = screen.getByRole('region', { name: 'Spending by category' });
    expect(card.textContent).toContain('against ฿0.00 in August 1 to 28.');
    const text = card.textContent || '';
    const labels = Array.from(card.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label') || '').join(' ');
    const combined = `${text} ${labels}`;
    expect(combined).not.toMatch(/NaN|Infinity/);
    expect(combined).not.toMatch(/(^|[^0-9])%/);
  });

  it('handles day 1 correctly', () => {
    const txs = [
      tx({ type: 'INCOME', amount: 10000, categoryId: 'cat-salary', transactionDate: '2026-09-01' }),
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food', transactionDate: '2026-09-10' }),
      tx({ type: 'EXPENSE', amount: 6000, categoryId: 'cat-food', transactionDate: '2026-08-10' }),
    ];
    const mtd = monthToDate(txs, '2026-10-01', CATEGORIES);
    render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={mtd}
        onOpenDetails={() => {}}
      />
    );
    expect(screen.getByText('October 1:')).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Spending by category' });
    expect(card.textContent).toContain('in September 1.');
  });

  it('calls onOpenDetails when clicking Details button', () => {
    const onOpenDetails = vi.fn();
    render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={monthToDate([], TODAY, CATEGORIES)}
        onOpenDetails={onOpenDetails}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('has no NaN, Infinity or bare % across scenarios', () => {
    const checkCard = (card: HTMLElement) => {
      const text = card.textContent || '';
      const labels = Array.from(card.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label') || '').join(' ');
      const combined = `${text} ${labels}`;
      expect(combined).not.toMatch(/NaN|Infinity/);
      expect(combined).not.toMatch(/(^|[^0-9])%/);
    };

    // Scenario 1: Top five and rest
    const rows4: CategorySpend[] = [
      { categoryId: 'a', name: 'A', amount: 700, color: '#111111' },
      { categoryId: 'b', name: 'B', amount: 600, color: '#222222' },
      { categoryId: 'c', name: 'C', amount: 500, color: '#333333' },
      { categoryId: 'd', name: 'D', amount: 400, color: '#444444' },
      { categoryId: 'e', name: 'E', amount: 300, color: '#555555' },
      { categoryId: 'f', name: 'F', amount: 200, color: '#666666' },
      { categoryId: 'g', name: 'G', amount: 100, color: '#777777' },
    ];
    const { unmount: unmount1 } = render(
      <CategorySpendingCard
        rows={rows4}
        total={2800}
        monthToDate={monthToDate([], TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    checkCard(screen.getByRole('region', { name: 'Spending by category' }));
    unmount1();

    // Scenario 2: Empty
    const { unmount: unmount2 } = render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={monthToDate([], TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    checkCard(screen.getByRole('region', { name: 'Spending by category' }));
    unmount2();

    // Scenario 3: Spending up
    const txs8 = [
      tx({ type: 'EXPENSE', amount: 3000, categoryId: 'cat-food', transactionDate: '2026-09-10' }),
      tx({ type: 'EXPENSE', amount: 2400, categoryId: 'cat-food', transactionDate: '2026-08-10' }),
    ];
    const { unmount: unmount3 } = render(
      <CategorySpendingCard
        rows={[]}
        total={0}
        monthToDate={monthToDate(txs8, TODAY, CATEGORIES)}
        onOpenDetails={() => {}}
      />
    );
    checkCard(screen.getByRole('region', { name: 'Spending by category' }));
    unmount3();
  });
});

describe('Debt payoff card (owner spec 4.3)', () => {
  const debts = [
    debt('spay', 'SPayLater', 17000, 13173.7, '2027-01-01'),
    debt('easy', 'SEasy Cash', 10500, 9403.3, '2028-04-01'),
  ];

  it('renders overall block and Needed this month with surplus 10000', () => {
    render(
      <DebtPayoffCard
        plan={debtPlan(debts, TODAY, 10000)}
        paid={5677.21}
        total={28254.21}
        progressPercent={20.1}
        onOpenDebts={() => {}}
      />
    );
    const percentEl = screen.getByText('20.1%');
    expect(percentEl.className).toContain('text-income');
    const card = screen.getByRole('region', { name: 'Debt payoff' });
    expect(card.textContent).toContain('20.1% paid off');
    expect(card.textContent).toContain('฿5,677.21 of ฿28,254.21');
    expect(screen.getByText('Needed this month')).toBeTruthy();
    const needed = screen.getByText('฿3,788.34');
    expect(needed.className).toContain('text-expense');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('renders warning banner inside the card when surplus is exceeded', () => {
    const onOpenDebts = vi.fn();
    render(
      <DebtPayoffCard
        plan={debtPlan(debts, TODAY, 3106.78)}
        paid={5677.21}
        total={28254.21}
        progressPercent={20.1}
        onOpenDebts={onOpenDebts}
      />
    );
    const card = screen.getByRole('region', { name: 'Debt payoff' });
    const note = within(card).getByRole('note');
    expect(note.textContent).toContain('SPayLater needs ฿3,293.43 a month');
    fireEvent.click(within(note).getByRole('button', { name: 'Review plan' }));
    expect(onOpenDebts).toHaveBeenCalledTimes(1);
  });
});
