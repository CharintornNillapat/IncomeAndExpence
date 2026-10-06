// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { NetWorthCard } from '../src/components/dashboard/NetWorthCard';
import { CashFlowCard } from '../src/components/dashboard/CashFlowCard';
import { CategorySpendingCard } from '../src/components/dashboard/CategorySpendingCard';
import { DebtWarningBanner } from '../src/components/dashboard/DebtWarningBanner';
import { DebtPayoffCard } from '../src/components/dashboard/DebtPayoffCard';
import { RecentActivityCard } from '../src/components/dashboard/RecentActivityCard';
import { MoodSpendingCard } from '../src/components/dashboard/MoodSpendingCard';
import { WalletsSection } from '../src/components/dashboard/WalletsSection';
import { cashFlow, groupByDay, spendingByCategory } from '../src/selectors/ledger';
import { debtRemaining, netWorth, walletShares, walletTotal } from '../src/selectors/wallets';
import { debtPlan } from '../src/selectors/debts';
import { foldAdjustmentPairs } from '../src/selectors/adjustments';
import { moodSpendingDays } from '../src/selectors/diary';
import { buildLookupMap } from '../src/utils/mapUtils';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import type { Category, Debt, DiaryEntry, Transaction, Wallet } from '../src/types';

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
        <CashFlowCard flow={flow} periodName="past 30 days" periodDates="Aug 29 – Sep 28" />
        <CategorySpendingCard rows={rows} total={flow.spending} />
      </>
    );
    const spending = formatCurrencyAmount(4844.97);
    expect(screen.getByTestId('metric-card-expense').textContent).toContain(`${MINUS}${spending}`);
    const categoryCard = screen.getByRole('heading', { name: 'Spending by category' }).closest('div')!.parentElement!;
    expect(categoryCard.textContent).toContain(spending);
    const rowSum = rows.reduce((sum, row) => sum + row.amount, 0);
    expect(rowSum).toBeCloseTo(flow.spending, 10);
  });

  it('leaves repayments, adjustments and transfers out of the category rows', () => {
    render(<CategorySpendingCard rows={spendingByCategory(ROWS, CATEGORIES)} total={cashFlow(ROWS, CATEGORIES).spending} />);
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toHaveLength(2);
    expect(names.join(' ')).not.toMatch(/DEBT_REPAYMENT|General|Transfer|adjustment/i);
  });
});

describe('Left over follows the net rule (spec section 3)', () => {
  it('is signed and in the primary text colour when positive', () => {
    render(<CashFlowCard flow={cashFlow([tx({ type: 'INCOME', amount: 500 }), tx({ type: 'EXPENSE', amount: 200 })], CATEGORIES)} periodName="today" periodDates="Sep 28" />);
    const net = screen.getByTestId('metric-card-net').lastElementChild!;
    expect(net.textContent).toBe(`+${formatCurrencyAmount(300)}`);
    expect(net.className).toContain('text-fg');
    expect(net.className).not.toContain('text-income');
  });

  it('is signed and red when negative, and says when there was no income', () => {
    render(<CashFlowCard flow={cashFlow([tx({ type: 'EXPENSE', amount: 200 })], CATEGORIES)} periodName="today" periodDates="Sep 28" />);
    const net = screen.getByTestId('metric-card-net').lastElementChild!;
    expect(net.textContent).toBe(`${MINUS}${formatCurrencyAmount(200)}`);
    expect(net.className).toContain('text-expense');
    expect(screen.getByText('No income in this period')).toBeTruthy();
  });
});

describe('acceptance check 3: net worth is wallets minus debt', () => {
  it("shows the spec's sample figure, ฿9,595.48, with the debt signed", () => {
    const debts = [debt('spay', 'SPayLater', 17000, 13173.7, '2027-01-01'), debt('easy', 'SEasy Cash', 10500, 9403.3, '2028-04-01')];
    render(
      <NetWorthCard
        netWorth={netWorth(WALLET_LIST, debts)}
        walletTotal={walletTotal(WALLET_LIST)}
        walletCount={WALLET_LIST.length}
        debtRemaining={debtRemaining(debts)}
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
    render(<NetWorthCard netWorth={-38850} walletTotal={7650} walletCount={3} debtRemaining={46500} />);
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
    expect(note.textContent).toContain('SPayLater needs ฿4,391.23 a month to be cleared by Jan 1, 2027');
    expect(note.textContent).toContain('surplus of ฿3,106.78');
    expect(note.textContent).not.toContain('—');
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
    expect(needed.map((el) => el.textContent)).toEqual(['฿4,391.23 / month needed', '฿522.41 / month needed']);
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
        onTransfer={() => {}}
        onAddWallet={() => {}}
        onManageWallets={() => {}}
        onOpenWallet={() => {}}
      />
    );
    expect(screen.getAllByText('No money in your wallets yet')).toHaveLength(1);
  });
});
