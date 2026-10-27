// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { TransactionsView } from '../src/views/TransactionsView';
import { TransactionDetails } from '../src/components/transaction/TransactionDrawer';
import { RecentActivityCard } from '../src/components/dashboard/RecentActivityCard';
import { buildLookupMap } from '../src/utils/mapUtils';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { formatDayLabel, formatMonthYear, monthKeyOf, shiftIsoDate, shiftMonth, todayIsoDate } from '../src/utils/date';
import { cashFlow, dailyTotals, heatLevel } from '../src/selectors/ledger';
import { monthBounds } from '../src/selectors/timeRange';
import type { Transaction, Wallet } from '../src/types';
import { seedGuestLedger, SAMPLE_STUDENT_LOAN } from './fixtures/guestLedger';

/**
 * Phase 58a (ADR 0031, spec 6.2): the Transactions page, mounted inside the
 * real `FinanceProvider` in guest mode, seeded through localStorage the way
 * a returning guest's ledger is. The provider is inert under test (no
 * Supabase, no realtime), so delete and restore run the real guest path.
 *
 * jsdom has no `matchMedia`, so the page takes its narrow layout: the
 * selected row's panel opens as a sheet. The wide layout is checked in the
 * browser (MCP) and by the Playwright suite at 1280px.
 */
let originalTz: string | undefined;
beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = 'Asia/Bangkok';
});
afterAll(() => {
  process.env.TZ = originalTz;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1;
  return {
    id: `seed-${seq}`,
    userId: 'guest',
    walletId: 'wal-cash',
    description: `row ${seq}`,
    transactionDate: todayIsoDate(),
    isDeleted: false,
    createdBy: 'guest',
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, seq)).toISOString(),
    updatedAt: '',
    ...overrides,
  };
}

function wide() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function mount(rows: Transaction[], props: Parameters<typeof TransactionsView>[0] = {}) {
  localStorage.setItem('pf_transactions', JSON.stringify(rows));
  return render(
    <FinanceProvider>
      <TransactionsView {...props} />
    </FinanceProvider>
  );
}

const rowButtons = () => [...document.querySelectorAll('button[id^="tx-row-"]')];

describe('the summary line follows the filters on the L1 definition', () => {
  it('counts income and spending only: no transfer, repayment, adjustment or deleted row', () => {
    mount([
      tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary' }),
      tx({ type: 'EXPENSE', amount: 250, categoryId: 'cat-food' }),
      tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main-checking' }),
      tx({ type: 'ADJUSTMENT', amount: -40, categoryId: 'cat-adjust' }),
      tx({ type: 'DEBT_REPAYMENT', amount: 300, categoryId: 'cat-debt', debtId: 'debt-1' }),
      tx({ type: 'EXPENSE', amount: 999, categoryId: 'cat-food', isDeleted: true }),
    ]);
    const summary = screen.getByText('Transfers and balance adjustments are not counted').parentElement!;
    expect(summary.textContent).toContain(`In +${formatCurrencyAmount(1000)}`);
    expect(summary.textContent).toContain(`Out ${MINUS}${formatCurrencyAmount(250)}`);
    expect(summary.textContent).toContain('All time');
  });
});

describe('rows are grouped by day, newest first', () => {
  it('heads each day with its L11 net and keeps each row\'s ISO date in the row', () => {
    const yesterday = shiftIsoDate(todayIsoDate(), -1);
    mount([
      tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Lunch' }),
      tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main-checking', description: 'Funds transfer' }),
      tx({ type: 'INCOME', amount: 700, categoryId: 'cat-salary', description: 'Pay', transactionDate: yesterday }),
    ]);
    const headers = screen.getAllByText(/^(Today|Yesterday) · /);
    expect(headers.map((h) => h.textContent)).toEqual([expect.stringMatching(/^Today/), expect.stringMatching(/^Yesterday/)]);
    expect(headers[0].parentElement!.textContent).toContain(`${MINUS}${formatCurrencyAmount(100)}`);
    expect(headers[1].parentElement!.textContent).toContain(`+${formatCurrencyAmount(700)}`);

    const pay = rowButtons().find((b) => b.textContent?.includes('Pay'))!;
    expect(pay.textContent).toContain(yesterday);
    // A transfer's own note stays visible under its wallets.
    expect(rowButtons().some((b) => b.textContent?.includes('Cash Wallet → Main Checking · Funds transfer'))).toBe(true);
  });
});

describe('L12: 25 rows at a time', () => {
  it('shows 25, then loads the rest, and the button goes when nothing is left', () => {
    mount(Array.from({ length: 30 }, (_, i) => tx({ type: 'EXPENSE', amount: 10 + i, categoryId: 'cat-food' })));
    expect(rowButtons()).toHaveLength(25);
    const more = screen.getByRole('button', { name: 'Load 5 more' });
    expect(more.id).toBe('tx-load-more-btn');
    fireEvent.click(more);
    expect(rowButtons()).toHaveLength(30);
    expect(screen.queryByRole('button', { name: /^Load \d+ more$/ })).toBeNull();
    expect(screen.getByText('Showing 30 of 30')).toBeTruthy();
  });

  it('starts again from 25 when a filter changes', () => {
    mount(Array.from({ length: 30 }, (_, i) => tx({ type: 'EXPENSE', amount: 10 + i, categoryId: 'cat-food' })));
    fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
    expect(rowButtons()).toHaveLength(30);
    fireEvent.click(document.getElementById('tx-filter-type-expense')!);
    expect(rowButtons()).toHaveLength(25);
  });
});

describe('an empty list says why it is empty (Phase 65, ADR 0041)', () => {
  const FIRST_RUN = 'No transactions yet';
  const FIRST_RUN_HELP = 'Add your first one with Add transaction above, or import a CSV from Import / export.';
  const FILTERED = 'No transactions match your current filters.';

  it('a ledger with no transaction is a first run, not a filtered list', () => {
    mount([]);
    expect(screen.getByText(FIRST_RUN)).toBeTruthy();
    expect(screen.getByText(FIRST_RUN_HELP)).toBeTruthy();
    expect(screen.queryByText(FILTERED)).toBeNull();
  });

  it('a first run wins over a filter the user sets', () => {
    mount([]);
    fireEvent.click(document.getElementById('tx-filter-type-income')!);
    fireEvent.change(document.getElementById('tx-filter-range')!, { target: { value: 'DAY' } });
    expect(screen.getByText(FIRST_RUN)).toBeTruthy();
    expect(screen.queryByText(FILTERED)).toBeNull();
  });

  it('a filter that hides every row keeps the filtered copy', () => {
    mount([tx({ type: 'EXPENSE', amount: 80, categoryId: 'cat-food' })]);
    expect(rowButtons()).toHaveLength(1);
    fireEvent.click(document.getElementById('tx-filter-type-income')!);
    expect(rowButtons()).toHaveLength(0);
    expect(screen.getByText(FILTERED)).toBeTruthy();
    expect(screen.queryByText(FIRST_RUN)).toBeNull();
  });

  it('only deleted rows count as no transaction: the first-run copy, until Show deleted lists them', () => {
    mount([tx({ type: 'EXPENSE', amount: 80, categoryId: 'cat-food', isDeleted: true })]);
    expect(rowButtons()).toHaveLength(0);
    expect(screen.getByText(FIRST_RUN)).toBeTruthy();
    expect(screen.queryByText(FILTERED)).toBeNull();
    fireEvent.click(screen.getByLabelText('Show deleted'));
    expect(rowButtons()).toHaveLength(1);
    expect(screen.queryByText(FIRST_RUN)).toBeNull();
  });
});

describe('the selected row\'s panel holds Delete and Restore', () => {
  it('deletes through the panel, hides the row, and restores it from Show deleted', async () => {
    mount([tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Panel target' })]);
    const row = () => rowButtons().find((b) => b.textContent?.includes('Panel target'));

    fireEvent.click(row()!);
    expect(row()!.getAttribute('aria-current')).toBe('true');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(row()).toBeUndefined());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(document.getElementById('tx-show-deleted')!);
    await waitFor(() => expect(row()?.textContent).toContain('[Soft Deleted]'));

    fireEvent.click(row()!);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(row()?.textContent).not.toContain('[Soft Deleted]'));
  });

  it('shows a failed delete instead of discarding it', async () => {
    const t = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food' });
    const wallets = buildLookupMap<Wallet>([
      { id: 'wal-cash', userId: 'u', name: 'Cash Wallet', type: 'CASH', currency: 'THB', balance: 0, color: '#D9A066', icon: 'x', isArchived: false, isDeleted: false, createdAt: '', updatedAt: '' },
    ]);
    const onDelete = vi.fn().mockResolvedValue({ success: false, error: 'The server did not answer.' });
    render(
      <TransactionDetails
        tx={t}
        category={undefined}
        wallets={wallets}
        walletList={[...wallets.values()]}
        categoryList={[]}
        onSave={vi.fn()}
        onDelete={onDelete}
        onRestore={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The server did not answer.');
    expect(onDelete).toHaveBeenCalledWith(t.id);
  });
});

describe('the panel edits a live row (Phase 58b, ADR 0033)', () => {
  const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;

  it('keeps Save disabled until something changes, then saves the edit through the ledger', async () => {
    mount([tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Edit target' })]);
    const row = () => rowButtons().find((b) => b.textContent?.includes('Edit target'))!;
    fireEvent.click(row());
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(field('tx-edit-amount')!, { target: { value: '150+25' } });
    expect(within(dialog).getByText(`= ${formatCurrencyAmount(175)}`)).toBeTruthy();
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    await waitFor(() => expect(row().textContent).toContain(formatCurrencyAmount(175)));
    expect(await within(dialog).findByText('Changes saved')).toBeTruthy();
    // The saved row is the new baseline, so there is nothing left to save.
    await waitFor(() => expect(save.disabled).toBe(true));
  });

  it('says why Save is off when the edit is incomplete', async () => {
    mount([tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Edit target' })]);
    fireEvent.click(rowButtons()[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(field('tx-edit-amount')!, { target: { value: '0' } });
    expect(within(dialog).getByRole('status').textContent).toBe('Enter an amount greater than zero');
    expect((within(dialog).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('swaps Category and Wallet for From and To when the row becomes a transfer', async () => {
    mount([tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Edit target' })]);
    fireEvent.click(rowButtons()[0]);
    await screen.findByRole('dialog');
    expect(field('tx-edit-category')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-edit-type-transfer')!);
    expect(field('tx-edit-category')).toBeNull();
    expect(field('tx-edit-from')!.value).toBe('wal-cash');
    expect(field('tx-edit-to')!.value).not.toBe('wal-cash');
    expect(field('tx-edit-to')!.value).not.toBe('');
    // A second wallet was chosen for it, so the transfer can be saved as it stands.
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(false);
  });

  // Phase 109 (ADR 0085, audit finding 3).
  const categoryValues = () => Array.from((field('tx-edit-category') as HTMLSelectElement).options).map((o) => o.value);

  it("lists the row type's categories only, with No category", async () => {
    mount([tx({ type: 'INCOME', amount: 900, categoryId: 'cat-salary', description: 'Pay' })]);
    fireEvent.click(rowButtons()[0]);
    await screen.findByRole('dialog');
    expect(categoryValues()).toEqual(['', 'cat-salary', 'cat-freelance']);
    expect(field('tx-edit-category')!.value).toBe('cat-salary');
  });

  it("keeps a legacy row's own category, so saving its note leaves it as it was", async () => {
    mount([tx({ type: 'EXPENSE', amount: 60, categoryId: 'cat-adjust', description: 'Old lunch' })]);
    fireEvent.click(rowButtons()[0]);
    const dialog = await screen.findByRole('dialog');
    expect(categoryValues()).toEqual(['', 'cat-food', 'cat-groceries', 'cat-transport', 'cat-shopping', 'cat-housing', 'cat-adjust']);
    expect(field('tx-edit-category')!.value).toBe('cat-adjust');

    fireEvent.change(field('tx-edit-description')!, { target: { value: 'Old lunch, noodles' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Changes saved')).toBeTruthy();
    // Written by the batched writer, 250 ms later.
    const stored = () => JSON.parse(localStorage.getItem('pf_transactions') ?? '[]')[0];
    await waitFor(() => expect(stored().description).toBe('Old lunch, noodles'));
    expect(stored().categoryId).toBe('cat-adjust');
  });

  it("switching type clears a category of the old type, and switching back restores the row's own", async () => {
    mount([tx({ type: 'EXPENSE', amount: 60, categoryId: 'cat-food', description: 'Lunch' })]);
    fireEvent.click(rowButtons()[0]);
    await screen.findByRole('dialog');
    fireEvent.click(document.getElementById('tx-edit-type-income')!);
    expect(categoryValues()).toEqual(['', 'cat-salary', 'cat-freelance']);
    expect(field('tx-edit-category')!.value).toBe('');

    fireEvent.click(document.getElementById('tx-edit-type-expense')!);
    expect(field('tx-edit-category')!.value).toBe('cat-food');
  });

  it("offers only a repayment's note and date", async () => {
    // A fresh guest has no debt since ADR 0040, so the one it names is seeded.
    seedGuestLedger({ debts: [SAMPLE_STUDENT_LOAN] });
    mount([tx({ type: 'DEBT_REPAYMENT', amount: 300, categoryId: 'cat-debt', debtId: 'debt-starter-01', description: 'Loan pay' })]);
    fireEvent.click(rowButtons()[0]);
    const dialog = await screen.findByRole('dialog');
    expect(field('tx-edit-amount')).toBeNull();
    expect(field('tx-edit-wallet')).toBeNull();
    expect(document.getElementById('tx-edit-type-income')).toBeNull();
    expect(field('tx-edit-description')!.value).toBe('Loan pay');
    expect(field('tx-edit-date')).not.toBeNull();
    expect(within(dialog).getByText('Only the note and date of a debt repayment can change.')).toBeTruthy();
    // Its money is read-only, so the panel names where it went (audit 007 finding 2).
    expect(within(dialog).getByText('Wallet').nextElementSibling!.textContent).toBe('Cash Wallet');
    expect(within(dialog).getByText('Debt').nextElementSibling!.textContent).toBe('Student Loan');
  });

  it("names an adjustment's wallet, and no debt", async () => {
    mount([tx({ type: 'ADJUSTMENT', amount: -40, categoryId: 'cat-adjust', description: 'Recount' })]);
    fireEvent.click(rowButtons()[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Wallet').nextElementSibling!.textContent).toBe('Cash Wallet');
    expect(within(dialog).queryByText('Debt')).toBeNull();
  });

  it('shows a failed save instead of discarding it', async () => {
    const t = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food' });
    const wallets = buildLookupMap<Wallet>([
      { id: 'wal-cash', userId: 'u', name: 'Cash Wallet', type: 'CASH', currency: 'THB', balance: 0, color: '#D9A066', icon: 'x', isArchived: false, isDeleted: false, createdAt: '', updatedAt: '' },
    ]);
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'This transaction changed on another device. Check it and try again.' });
    render(
      <TransactionDetails
        tx={t}
        category={undefined}
        wallets={wallets}
        walletList={[...wallets.values()]}
        categoryList={[]}
        onSave={onSave}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    fireEvent.change(field('tx-edit-description')!, { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This transaction changed on another device. Check it and try again.');
    expect(onSave).toHaveBeenCalledWith(t.id, expect.objectContaining({ description: 'Dinner', amount: 150, type: 'EXPENSE' }));
  });

  it('takes a newer version of the row as its baseline, such as one a cloud reload brings', () => {
    const t = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Before', updatedAt: '2026-09-01T00:00:00.000Z' });
    const props = {
      category: undefined,
      wallets: new Map<string, Wallet>(),
      walletList: [],
      categoryList: [],
      onSave: vi.fn(),
      onDelete: vi.fn(),
      onRestore: vi.fn(),
    };
    const { rerender } = render(<TransactionDetails tx={t} {...props} />);
    expect(field('tx-edit-description')!.value).toBe('Before');

    rerender(<TransactionDetails tx={{ ...t, description: 'After', updatedAt: '2026-09-02T00:00:00.000Z' }} {...props} />);
    expect(field('tx-edit-description')!.value).toBe('After');
  });

  it('opens the row a Dashboard hand-off names, and reports the hand-off as used', async () => {
    const target = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Handed off' });
    localStorage.setItem('pf_transactions', JSON.stringify([tx({ type: 'EXPENSE', amount: 10, categoryId: 'cat-food' }), target]));
    const consumed = vi.fn();
    render(
      <FinanceProvider>
        <TransactionsView initialSelectedTxId={target.id} onConsumeInitialSelectedTx={consumed} />
      </FinanceProvider>
    );
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByRole('textbox', { name: 'Note' }) as HTMLInputElement).value).toBe('Handed off');
    expect(consumed).toHaveBeenCalledTimes(1);
  });
});

describe("the Dashboard's Recent activity rows open their row (Phase 58b)", () => {
  it('calls the hand-off with the row id, from a button whose id is the Dashboard\'s own', () => {
    const t = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Recent row' });
    const onOpenTransaction = vi.fn();
    render(
      <RecentActivityCard
        items={[{ kind: 'tx', tx: t }]}
        dayNets={new Map()}
        wallets={new Map()}
        categories={new Map()}
        today={todayIsoDate()}
        onViewAll={vi.fn()}
        onOpenTransaction={onOpenTransaction}
      />
    );
    const button = document.getElementById(`dashboard-tx-${t.id}`)!;
    expect(button.tagName).toBe('BUTTON');
    expect(document.querySelector('[id^="tx-row-"]')).toBeNull();
    fireEvent.click(button);
    expect(onOpenTransaction).toHaveBeenCalledWith(t.id);
  });
});

describe("the Daily diary's day hand-off (Phase 61, ADR 0036)", () => {
  it('shows that one day only, says so in a chip, and the chip or a range change clears it', () => {
    const day = shiftIsoDate(todayIsoDate(), -3);
    localStorage.setItem(
      'pf_transactions',
      JSON.stringify([
        tx({ type: 'EXPENSE', amount: 40, categoryId: 'cat-food', description: 'On the day', transactionDate: day }),
        tx({ type: 'EXPENSE', amount: 60, categoryId: 'cat-food', description: 'Another day', transactionDate: shiftIsoDate(day, -1) }),
      ])
    );
    const consume = vi.fn();
    render(
      <FinanceProvider>
        <TransactionsView initialDayFilter={day} onConsumeInitialDayFilter={consume} />
      </FinanceProvider>
    );
    expect(consume).toHaveBeenCalledTimes(1);
    expect(rowButtons().map((b) => b.textContent).join(' ')).toContain('On the day');
    expect(rowButtons()).toHaveLength(1);
    const chip = document.getElementById('tx-day-filter')!;
    expect(chip.textContent).toMatch(/^Only [A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
    // The range select agrees with the chip instead of saying "All time" (audit 010 finding 1).
    const rangeSelect = document.getElementById('tx-filter-range') as HTMLSelectElement;
    expect(rangeSelect.selectedOptions[0].textContent).toBe('One day');
    expect(rangeSelect.selectedOptions[0].disabled).toBe(true);

    fireEvent.click(chip);
    expect(document.getElementById('tx-day-filter')).toBeNull();
    expect(rowButtons()).toHaveLength(2);
    expect(rangeSelect.selectedOptions[0].textContent).toBe('All time');
    expect([...rangeSelect.options].map((o) => o.textContent)).not.toContain('One day');
  });

  it('a range change drops the day filter', () => {
    const day = shiftIsoDate(todayIsoDate(), -3);
    localStorage.setItem('pf_transactions', JSON.stringify([tx({ type: 'EXPENSE', amount: 40, categoryId: 'cat-food', transactionDate: day })]));
    render(
      <FinanceProvider>
        <TransactionsView initialDayFilter={day} />
      </FinanceProvider>
    );
    fireEvent.change(document.getElementById('tx-filter-range')!, { target: { value: 'ALL' } });
    expect(document.getElementById('tx-day-filter')).toBeNull();
  });
});

describe('the view switch (ADR 0109 D6)', () => {
  const TX_VIEW_KEY = 'pf_tx_view';

  it('renders the Transactions view tablist with Table selected and a labelled tabpanel', () => {
    mount([tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food' })]);
    const tablist = screen.getByRole('tablist', { name: 'Transactions view' });
    const tableTab = within(tablist).getByRole('tab', { name: 'Table' });
    const calTab = within(tablist).getByRole('tab', { name: 'Calendar' });
    expect(tableTab.id).toBe('tx-view-table');
    expect(tableTab.getAttribute('aria-selected')).toBe('true');
    expect(calTab.id).toBe('tx-view-calendar');
    expect(calTab.getAttribute('aria-selected')).toBe('false');

    const panel = document.getElementById('tx-view-panel')!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('tx-view-table');
  });

  it('switches to Calendar, stores the preference, hides rows while keeping filters, and switches back', () => {
    mount([tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food', description: 'Switch row', transactionDate: shiftIsoDate(todayIsoDate(), -1) })]);
    expect(rowButtons()).toHaveLength(1);

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect(document.getElementById('tx-view-calendar')!.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('tx-view-table')!.getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('tx-view-panel')!.getAttribute('aria-labelledby')).toBe('tx-view-calendar');
    expect(localStorage.getItem(TX_VIEW_KEY)).toBe('calendar');
    expect(rowButtons()).toHaveLength(0);
    expect(document.getElementById('tx-search-input')).not.toBeNull();
    expect(document.getElementById('tx-filter-range')).toBeNull();
    expect(document.getElementById('tx-filter-wallet')).not.toBeNull();
    expect(document.getElementById('tx-filter-category')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-view-table')!);
    expect(document.getElementById('tx-view-table')!.getAttribute('aria-selected')).toBe('true');
    expect(rowButtons()).toHaveLength(1);
  });

  it('opens Calendar on arrival when stored in localStorage', () => {
    localStorage.setItem(TX_VIEW_KEY, 'calendar');
    mount([tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food' })]);
    expect(document.getElementById('tx-view-calendar')?.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('tx-cal-heading')).not.toBeNull();
    expect(rowButtons()).toHaveLength(1);
    fireEvent.click(document.getElementById('tx-filter-type-income')!);
    expect(rowButtons()).toHaveLength(0);
  });

  it('always opens Table on a hand-off without overwriting the stored calendar preference', () => {
    const seeded = tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food' });
    for (const props of [
      { initialDayFilter: todayIsoDate() },
      { initialWalletFilter: 'wal-cash' },
      { initialSelectedTxId: seeded.id },
    ]) {
      cleanup();
      localStorage.clear();
      localStorage.setItem(TX_VIEW_KEY, 'calendar');
      mount([seeded], props);
      expect(document.getElementById('tx-view-table')?.getAttribute('aria-selected')).toBe('true');
      expect(localStorage.getItem(TX_VIEW_KEY)).toBe('calendar');
    }
  });

  it('mounts on Table when localStorage.getItem throws', () => {
    const rows = [tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food' })];
    localStorage.setItem('pf_transactions', JSON.stringify(rows));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => { if (key !== TX_VIEW_KEY) return null;
      throw new Error('blocked');
    });
    render(
      <FinanceProvider>
        <TransactionsView />
      </FinanceProvider>
    );
    expect(document.getElementById('tx-view-table')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('the Table view, from lg (ADR 0109 D3)', () => {
  it('renders a table with caption, seven columnheaders, no sort buttons, and day rowgroups with L11 nets', () => {
    wide();
    const yesterday = shiftIsoDate(todayIsoDate(), -1);
    mount([
      tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Lunch' }),
      tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main-checking', description: 'Funds transfer' }),
      tx({ type: 'INCOME', amount: 700, categoryId: 'cat-salary', description: 'Pay', transactionDate: yesterday }),
    ]);

    const table = document.querySelector('table')!;
    expect(table).not.toBeNull();
    expect(table.querySelector('caption')?.textContent).toBe('Transactions, newest first');
    const colHeaders = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(colHeaders).toEqual(['', 'Date', 'Note', 'Category', 'Wallet', 'Amount', 'Actions']);
    expect(table.querySelector('thead button')).toBeNull();

    const rowgroups = [...table.querySelectorAll('th[scope="rowgroup"]')];
    expect(rowgroups).toHaveLength(2);
    expect(rowgroups.map((th) => th.getAttribute('colspan'))).toEqual(['7', '7']);
    expect(rowgroups[0].textContent).toMatch(/^Today · /);
    expect(rowgroups[0].textContent).toContain(`${MINUS}${formatCurrencyAmount(100)}`);
    expect(rowgroups[1].textContent).toMatch(/^Yesterday · /);
    expect(rowgroups[1].textContent).toContain(`+${formatCurrencyAmount(700)}`);
  });

  it('populates a row button with the note, signed amount and ISO date, and shows the wallet and category cells', () => {
    wide();
    const today = todayIsoDate();
    const lunch = tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', walletId: 'wal-cash', description: 'Lunch', transactionDate: today });
    mount([lunch]);

    const walletName = document.querySelector('#tx-filter-wallet option[value="wal-cash"]')!.textContent!;
    const categoryName = document.querySelector('#tx-filter-category option[value="cat-food"]')!.textContent!;

    const btn = document.getElementById(`tx-row-${lunch.id}`)!;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Lunch');
    expect(btn.textContent).toContain(`${MINUS}${formatCurrencyAmount(100)}`);
    expect(btn.textContent).toContain(today);
    expect(btn.textContent).toContain(categoryName);

    const tr = btn.closest('tr')!;
    expect(tr.textContent).toContain(walletName);
    expect(tr.textContent).toContain(categoryName);
  });

  it('renders a transfer row with the wallet route only, an empty Category cell, and the note in Note', () => {
    wide();
    const transfer = tx({
      type: 'TRANSFER',
      amount: 500,
      walletId: 'wal-cash',
      destinationWalletId: 'wal-main-checking',
      description: 'Funds transfer',
    });
    mount([transfer]);

    const btn = document.getElementById(`tx-row-${transfer.id}`)!;
    const cells = [...btn.closest('tr')!.querySelectorAll('td')];
    expect(cells[2].textContent).toContain('Funds transfer');
    expect(cells[3].textContent).toBe('');
    expect(cells[4].textContent).toBe('Cash Wallet → Main Checking');
  });

  it('shows No note for an empty description and keeps the category title in the button text', () => {
    wide();
    const noNote = tx({ type: 'EXPENSE', amount: 80, categoryId: 'cat-food', description: '' });
    mount([noNote]);

    const categoryName = document.querySelector('#tx-filter-category option[value="cat-food"]')!.textContent!;
    const btn = document.getElementById(`tx-row-${noNote.id}`)!;
    expect(btn.textContent).toContain('No note');
    expect(btn.textContent).toContain(categoryName);
    expect(btn.textContent!.split(categoryName).length - 1).toBe(1);
  });

  it('renders the income Amount cell with + and formatCurrencyAmount inside an aria-hidden element', () => {
    wide();
    const income = tx({ type: 'INCOME', amount: 700, categoryId: 'cat-salary', description: 'Pay' });
    mount([income]);

    const btn = document.getElementById(`tx-row-${income.id}`)!;
    const amountTd = btn.closest('tr')!.querySelectorAll('td')[5];
    expect(amountTd.textContent).toBe(`+${formatCurrencyAmount(700)}`);
    expect(amountTd.querySelector('[aria-hidden="true"]')?.textContent).toBe(`+${formatCurrencyAmount(700)}`);
  });

  it('loads 25 rows at a time in the Table view (L12)', () => {
    const rowButtons = () => [...document.querySelectorAll('table button[id^="tx-row-"]')];
    wide();
    mount(Array.from({ length: 30 }, (_, i) => tx({ type: 'EXPENSE', amount: 10 + i, categoryId: 'cat-food' })));
    expect(rowButtons()).toHaveLength(25);
    const more = document.getElementById('tx-load-more-btn')!;
    expect(more.textContent).toBe('Load 5 more');
    fireEvent.click(more);
    expect(rowButtons()).toHaveLength(30);
    expect(document.getElementById('tx-load-more-btn')).toBeNull();
    expect(screen.getByText('Showing 30 of 30')).toBeTruthy();
  });

  it('opens the inline #tx-drawer and marks aria-current on the selected row button', () => {
    wide();
    const row = tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Pick me' });
    mount([row]);

    const btn = document.getElementById(`tx-row-${row.id}`)!;
    fireEvent.click(btn);
    expect(document.getElementById('tx-drawer')).not.toBeNull();
    expect(document.querySelector(`table #tx-row-${row.id}`)?.getAttribute('aria-current')).toBe('true');
  });

  it('confirms before deleting from the row menu, cancels cleanly, and soft-deletes on confirm', async () => {
    wide();
    const row = tx({ type: 'EXPENSE', amount: 120, categoryId: 'cat-food', description: 'Menu delete target' });
    mount([row]);

    fireEvent.click(document.getElementById(`tx-menu-btn-${row.id}`)!);
    fireEvent.click(document.getElementById(`tx-menu-delete-btn-${row.id}`)!);

    const dialog = await screen.findByRole('dialog', { name: 'Delete this transaction?' });
    expect(dialog).toBeTruthy();
    expect(document.getElementById(`tx-row-${row.id}`)).not.toBeNull();

    fireEvent.click(document.getElementById('confirm-cancel-btn')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.getElementById(`tx-row-${row.id}`)).not.toBeNull();

    fireEvent.click(document.getElementById(`tx-menu-btn-${row.id}`)!);
    fireEvent.click(document.getElementById(`tx-menu-delete-btn-${row.id}`)!);
    await screen.findByRole('dialog', { name: 'Delete this transaction?' });
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    await waitFor(() => expect(document.getElementById(`tx-row-${row.id}`)).toBeNull());
    fireEvent.click(document.getElementById('tx-show-deleted')!);
    await waitFor(() => expect(document.getElementById(`tx-row-${row.id}`)?.textContent).toContain('[Soft Deleted]'));
  });

  it('offers only Restore in a deleted row menu and restores the row on click', async () => {
    wide();
    const row = tx({ type: 'EXPENSE', amount: 120, categoryId: 'cat-food', description: 'Restore target', isDeleted: true });
    mount([row]);

    fireEvent.click(document.getElementById('tx-show-deleted')!);
    const rowBtn = await waitFor(() => {
      const el = document.getElementById(`tx-row-${row.id}`);
      expect(el?.textContent).toContain('[Soft Deleted]');
      return el!;
    });
    expect(rowBtn).toBeTruthy();

    fireEvent.click(document.getElementById(`tx-menu-btn-${row.id}`)!);
    expect(document.getElementById(`tx-menu-edit-btn-${row.id}`)).toBeNull();
    expect(document.getElementById(`tx-menu-delete-btn-${row.id}`)).toBeNull();
    const restoreBtn = document.getElementById(`tx-menu-restore-btn-${row.id}`)!;
    expect(restoreBtn).not.toBeNull();

    fireEvent.click(restoreBtn);
    await waitFor(() => expect(document.getElementById(`tx-row-${row.id}`)?.textContent).not.toContain('[Soft Deleted]'));
  });

  it('narrow guard: renders the list without a table or row menus below lg', () => {
    mount([tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Narrow row' })]);
    expect(document.querySelector('table')).toBeNull();
    expect(document.querySelector('[id^="tx-menu-btn-"]')).toBeNull();
    expect(rowButtons()).toHaveLength(1);
  });
});


describe('the Calendar view (ADR 0109)', () => {
  it('1. hides #tx-filter-range, #tx-day-filter and <table> in Calendar view while keeping the other filters, and keeps #tx-filter-range in Table view', () => {
    wide();
    const today = todayIsoDate();
    const yesterday = shiftIsoDate(today, -1);
    mount(
      [
        tx({ type: 'EXPENSE', amount: 80, categoryId: 'cat-food', description: 'Yesterday lunch', transactionDate: yesterday }),
        tx({ type: 'EXPENSE', amount: 120, categoryId: 'cat-food', description: 'Today coffee', transactionDate: today }),
      ],
      { initialDayFilter: yesterday },
    );

    expect(document.getElementById('tx-filter-range')).not.toBeNull();
    expect(document.getElementById('tx-day-filter')).not.toBeNull();
    expect(document.querySelector('table')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect(document.getElementById('tx-cal-heading')?.textContent).toBe(formatMonthYear(monthKeyOf(today)));
    expect(document.querySelector('table')).toBeNull();
    expect(document.getElementById('tx-filter-range')).toBeNull();
    expect(document.getElementById('tx-day-filter')).toBeNull();
    expect(document.getElementById('tx-search-input')).not.toBeNull();
    expect(document.getElementById('tx-filter-wallet')).not.toBeNull();
    expect(document.getElementById('tx-filter-category')).not.toBeNull();
    expect(document.getElementById('tx-filter-type-all')).not.toBeNull();
    expect(document.getElementById('tx-show-deleted')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-view-table')!);
    expect(document.getElementById('tx-filter-range')).not.toBeNull();
  });

  it('2. matches cashFlow on #tx-cal-month-in/out/net and dailyTotals on each day cell aria-label (transfers move count only)', () => {
    const today = todayIsoDate();
    const day1 = `${monthKeyOf(today)}-01`;
    const day2 = `${monthKeyOf(today)}-02`;
    const rows = [
      tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary', transactionDate: day1 }),
      tx({ type: 'EXPENSE', amount: 250, categoryId: 'cat-food', transactionDate: day1 }),
      tx({ type: 'TRANSFER', amount: 400, destinationWalletId: 'wal-main-checking', transactionDate: day1 }),
      tx({ type: 'EXPENSE', amount: 180, categoryId: 'cat-shopping', transactionDate: day2 }),
    ];
    mount(rows);
    fireEvent.click(document.getElementById('tx-view-calendar')!);

    const catMap = new Map(
      JSON.parse(localStorage.getItem('pf_categories') ?? '[]').map((c: { id: string }) => [c.id, c]),
    );
    const cf = cashFlow(rows, catMap as never);
    expect(document.getElementById('tx-cal-month-in')?.textContent).toContain(`+${formatCurrencyAmount(cf.income)}`);
    expect(document.getElementById('tx-cal-month-out')?.textContent).toContain(formatCurrencyAmount(-cf.spending));
    expect(document.getElementById('tx-cal-month-net')?.textContent).toContain(
      `${cf.leftOver > 0 ? '+' : ''}${formatCurrencyAmount(cf.leftOver)}`,
    );

    const dt = dailyTotals(rows, catMap as never);
    const d1 = dt.get(day1)!;
    expect(d1.count).toBe(3);
    expect(document.getElementById(`tx-cal-day-${day1}`)?.getAttribute('aria-label')).toContain(
      `spent ${formatCurrencyAmount(d1.spending)}, net +${formatCurrencyAmount(d1.net)}, 3 transactions`,
    );
    const d2 = dt.get(day2)!;
    expect(document.getElementById(`tx-cal-day-${day2}`)?.getAttribute('aria-label')).toContain(
      `spent ${formatCurrencyAmount(d2.spending)}, net ${formatCurrencyAmount(d2.net)}, 1 transaction`,
    );
  });

  it('3. defaults selected day to today, lists only today\'s rows, updates dayFilter on day click, and carries it back to Table (D10)', () => {
    const today = todayIsoDate();
    const otherDay = today.endsWith('-01') ? shiftIsoDate(today, 1) : `${monthKeyOf(today)}-01`;
    mount([
      tx({ type: 'EXPENSE', amount: 60, categoryId: 'cat-food', description: 'Other day item', transactionDate: otherDay }),
      tx({ type: 'EXPENSE', amount: 90, categoryId: 'cat-food', description: 'Today item', transactionDate: today }),
    ]);

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect(document.getElementById(`tx-cal-day-${today}`)?.getAttribute('aria-pressed')).toBe('true');
    const initialPanelRows = Array.from(document.querySelectorAll('#tx-cal-panel button[id^="tx-row-"]'));
    expect(initialPanelRows).toHaveLength(1);
    expect(initialPanelRows[0].textContent).toContain('Today item');

    fireEvent.click(document.getElementById(`tx-cal-day-${otherDay}`)!);
    expect(document.getElementById(`tx-cal-day-${otherDay}`)?.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById(`tx-cal-day-${today}`)?.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('tx-cal-panel-title')?.textContent).toBe(formatDayLabel(otherDay, today));
    const panelRows = Array.from(document.querySelectorAll('#tx-cal-panel button[id^="tx-row-"]'));
    expect(panelRows).toHaveLength(1);
    expect(panelRows[0].textContent).toContain('Other day item');

    fireEvent.click(document.getElementById('tx-view-table')!);
    expect(document.getElementById('tx-day-filter')).not.toBeNull();
    expect(rowButtons()).toHaveLength(1);
    expect(rowButtons()[0].textContent).toContain('Other day item');
  });

  it('4. steps to the previous month (selecting its latest day with rows or Pick a day when empty), steps back to today, and includes monthBounds.end', () => {
    const today = todayIsoDate();
    const prevMonth = shiftMonth(monthKeyOf(today), -1);
    const prevMid = `${prevMonth}-15`;
    const prevEnd = monthBounds(prevMonth).end!;

    mount([
      tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Mid prev', transactionDate: prevMid }),
      tx({ type: 'EXPENSE', amount: 200, categoryId: 'cat-food', description: 'End prev', transactionDate: prevEnd }),
    ]);

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    fireEvent.click(document.getElementById('tx-cal-prev-month-btn')!);

    expect(document.getElementById('tx-cal-heading')?.textContent).toBe(formatMonthYear(prevMonth));
    expect(document.getElementById(`tx-cal-day-${prevEnd}`)?.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('tx-cal-panel-title')?.textContent).toBe(formatDayLabel(prevEnd, today));
    expect(document.querySelector('#tx-cal-panel button[id^="tx-row-"]')?.textContent).toContain('End prev');

    // Step one more month back (empty month)
    fireEvent.click(document.getElementById('tx-cal-prev-month-btn')!);
    expect(document.getElementById('tx-cal-panel-title')?.textContent).toBe('Pick a day');
    expect(document.getElementById('tx-cal-add-btn')).toBeNull();

    // Step forward twice back to current month -> selects today again
    fireEvent.click(document.getElementById('tx-cal-next-month-btn')!);
    fireEvent.click(document.getElementById('tx-cal-next-month-btn')!);
    expect(document.getElementById(`tx-cal-day-${today}`)?.getAttribute('aria-pressed')).toBe('true');
  });

  it('5. disables #tx-cal-next-month-btn when no row is ahead, enables it when a later-month row exists, and disables only empty future days (D12)', () => {
    const today = todayIsoDate();
    const nextMonth = shiftMonth(monthKeyOf(today), 1);
    const futureDay = `${nextMonth}-05`;
    const emptyFutureDay = `${nextMonth}-06`;

    const { unmount } = mount([]);
    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect((document.getElementById('tx-cal-next-month-btn') as HTMLButtonElement).disabled).toBe(true);
    unmount();

    mount([tx({ type: 'EXPENSE', amount: 220, categoryId: 'cat-food', description: 'Scheduled bill', transactionDate: futureDay })]);
    fireEvent.click(document.getElementById('tx-view-calendar')!);
    const nextBtn = document.getElementById('tx-cal-next-month-btn') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    expect(document.getElementById('tx-cal-heading')?.textContent).toBe(formatMonthYear(nextMonth));
    expect((document.getElementById(`tx-cal-day-${futureDay}`) as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById(`tx-cal-day-${emptyFutureDay}`) as HTMLButtonElement).disabled).toBe(true);
  });

  it('6. shades the larger spending day with bg-heat-3, the smaller with bg-heat-N (heatLevel), and gives an income-only day no bg-heat-*', () => {
    const today = todayIsoDate();
    const m = monthKeyOf(today);
    const d1 = `${m}-01`;
    const d2 = `${m}-02`;
    const d3 = `${m}-03`;
    const dSelected = `${m}-04`;
    const smaller = 100;
    const larger = 300;

    mount(
      [
        tx({ type: 'EXPENSE', amount: smaller, categoryId: 'cat-food', transactionDate: d1 }),
        tx({ type: 'EXPENSE', amount: larger, categoryId: 'cat-food', transactionDate: d2 }),
        tx({ type: 'INCOME', amount: 500, categoryId: 'cat-salary', transactionDate: d3 }),
      ],
      { initialDayFilter: dSelected },
    );

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    const expectedSmallHeat = heatLevel(smaller, larger);
    expect(document.getElementById(`tx-cal-day-${d2}`)?.className).toContain('bg-heat-3');
    expect(document.getElementById(`tx-cal-day-${d1}`)?.className).toContain(`bg-heat-${expectedSmallHeat}`);
    expect(document.getElementById(`tx-cal-day-${d3}`)?.className).not.toMatch(/bg-heat-/);
  });

  it('7. applies the type filter and Show deleted in the Calendar view', () => {
    const today = todayIsoDate();
    mount([
      tx({ type: 'INCOME', amount: 500, categoryId: 'cat-salary', description: 'Pay', transactionDate: today }),
      tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Coffee', transactionDate: today }),
      tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food', description: 'Deleted snack', transactionDate: today, isDeleted: true }),
    ]);

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect(document.getElementById('tx-cal-month-in')?.textContent).toContain(`+${formatCurrencyAmount(500)}`);
    expect(document.querySelectorAll('#tx-cal-panel button[id^="tx-row-"]')).toHaveLength(2);

    fireEvent.click(document.getElementById('tx-filter-type-expense')!);
    expect(document.getElementById('tx-cal-month-in')?.textContent).toContain(formatCurrencyAmount(0));
    expect(document.querySelectorAll('#tx-cal-panel button[id^="tx-row-"]')).toHaveLength(1);

    fireEvent.click(document.getElementById('tx-show-deleted')!);
    expect(document.getElementById(`tx-cal-day-${today}`)?.getAttribute('aria-label')).toContain('2 transactions');
    expect(document.querySelectorAll('#tx-cal-panel button[id^="tx-row-"]')).toHaveLength(2);
  });

  it('8. opens TransactionDetails inside Modal at wide in the Calendar view with no inline #tx-drawer (D11)', async () => {
    wide();
    const today = todayIsoDate();
    const row = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Wide calendar row', transactionDate: today });
    mount([row]);

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    fireEvent.click(document.getElementById(`tx-row-${row.id}`)!);

    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByRole('textbox', { name: 'Note' }) as HTMLInputElement).value).toBe('Wide calendar row');
    expect(document.getElementById('tx-drawer')).toBeNull();
  });

  it('9. clears selection on switching views in both directions (wide aside and narrow sheet)', async () => {
    wide();
    const today = todayIsoDate();
    const row = tx({ type: 'EXPENSE', amount: 150, categoryId: 'cat-food', description: 'Selected row', transactionDate: today });
    const { unmount } = mount([row]);

    fireEvent.click(document.getElementById(`tx-row-${row.id}`)!);
    expect(document.getElementById('tx-drawer')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect(document.getElementById('tx-drawer')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(document.getElementById('tx-view-table')!);
    expect(document.getElementById('tx-drawer')).toBeNull();
    unmount();

    // Narrow: open sheet from the list, switch to Calendar -> no dialog
    delete (window as { matchMedia?: unknown }).matchMedia;
    mount([row]);
    fireEvent.click(document.getElementById(`tx-row-${row.id}`)!);
    expect(await screen.findByRole('dialog')).toBeTruthy();

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('10. opens the Add modal pre-filled with the selected day from #tx-cal-add-btn and resets to today when reopened from the header', async () => {
    const today = todayIsoDate();
    const pickedDay = today.endsWith('-01') ? shiftIsoDate(today, -1) : `${monthKeyOf(today)}-01`;
    mount([]);

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    if (monthKeyOf(pickedDay) !== monthKeyOf(today)) {
      fireEvent.click(document.getElementById('tx-cal-prev-month-btn')!);
    }
    fireEvent.click(document.getElementById(`tx-cal-day-${pickedDay}`)!);
    fireEvent.click(document.getElementById('tx-cal-add-btn')!);

    const dialog = await screen.findByRole('dialog', { name: 'Record New Transaction' });
    const dateInput = within(dialog).getByLabelText('Transaction Date') as HTMLInputElement;
    expect(dateInput.value).toBe(pickedDay);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Record New Transaction' })).toBeNull());

    fireEvent.click(document.getElementById('tx-open-add-modal-btn')!);
    const dialogAgain = await screen.findByRole('dialog', { name: 'Record New Transaction' });
    expect((within(dialogAgain).getByLabelText('Transaction Date') as HTMLInputElement).value).toBe(today);
  });

  it('11. renders #tx-cal-diary-link only when the selected day has a diary entry and onOpenDiaryDay is passed', () => {
    const today = todayIsoDate();
    const otherDay = today.endsWith('-01') ? shiftIsoDate(today, 1) : `${monthKeyOf(today)}-01`;
    localStorage.setItem(
      'pf_diary',
      JSON.stringify([
        {
          id: 'diary-1',
          userId: 'guest',
          date: today,
          mood: 4,
          workout: false,
          foodQuality: 'HEALTHY',
          isDeleted: false,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ]),
    );
    const onOpenDiaryDay = vi.fn();
    const { unmount } = mount([tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food', transactionDate: today })], {
      onOpenDiaryDay,
    });

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    const link = document.getElementById('tx-cal-diary-link')!;
    expect(link).not.toBeNull();
    fireEvent.click(link);
    expect(onOpenDiaryDay).toHaveBeenCalledWith(today);

    // Day with no diary entry -> link absent
    fireEvent.click(document.getElementById(`tx-cal-day-${otherDay}`)!);
    expect(document.getElementById('tx-cal-diary-link')).toBeNull();
    unmount();

    // No onOpenDiaryDay prop -> link absent even when entry exists
    mount([tx({ type: 'EXPENSE', amount: 50, categoryId: 'cat-food', transactionDate: today })]);
    fireEvent.click(document.getElementById('tx-view-calendar')!);
    expect(document.getElementById('tx-cal-diary-link')).toBeNull();
  });
});

describe('selection and the bulk bar (ADR 0109 O1)', () => {
  it('wide: a checkbox column with a select-all header', () => {
    wide();
    const today = todayIsoDate();
    const lunch = tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Lunch', transactionDate: today });
    mount([lunch]);

    const selectAll = document.getElementById('tx-select-all') as HTMLInputElement;
    expect(selectAll).not.toBeNull();
    expect(selectAll.getAttribute('type')).toBe('checkbox');
    expect(selectAll.getAttribute('aria-label')).toBe('Select all loaded rows');

    const rowCheckbox = document.getElementById(`tx-select-row-${lunch.id}`) as HTMLInputElement;
    expect(rowCheckbox).not.toBeNull();
    expect(rowCheckbox.getAttribute('type')).toBe('checkbox');
    expect(rowCheckbox.getAttribute('aria-label')).toBe('Select Lunch');

    expect(document.getElementById('tx-bulk-bar')).toBeNull();
  });

  it('wide: selecting shows the bar with the count, the net and the uncounted note', () => {
    wide();
    const today = todayIsoDate();
    const lunch = tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Lunch', transactionDate: today });
    const salary = tx({ type: 'INCOME', amount: 700, categoryId: 'cat-salary', description: 'Salary', transactionDate: today });
    const transfer = tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main-checking', description: 'Transfer', transactionDate: today });
    mount([lunch, salary, transfer]);

    const lunchBox = document.getElementById(`tx-select-row-${lunch.id}`) as HTMLInputElement;
    const salaryBox = document.getElementById(`tx-select-row-${salary.id}`) as HTMLInputElement;
    const transferBox = document.getElementById(`tx-select-row-${transfer.id}`) as HTMLInputElement;

    fireEvent.click(lunchBox);
    fireEvent.click(salaryBox);

    const bar = document.getElementById('tx-bulk-bar')!;
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('role')).toBe('region');
    expect(bar.getAttribute('aria-label')).toBe('Bulk actions');

    const count = document.getElementById('tx-bulk-count')!;
    expect(count.textContent).toBe('2 selected');
    expect(count.getAttribute('role')).toBe('status');

    const net = document.getElementById('tx-bulk-net')!;
    expect(net.textContent).toContain(`+${formatCurrencyAmount(600)}`);
    expect(net.textContent).not.toContain('not counted');

    fireEvent.click(transferBox);
    expect(count.textContent).toBe('3 selected');
    expect(net.textContent).toContain(`+${formatCurrencyAmount(600)}`);
    expect(net.textContent).toContain('Transfers, repayments, adjustments and deleted rows are not counted');

    const clearBtn = document.getElementById('tx-bulk-clear-btn')!;
    fireEvent.click(clearBtn);

    expect(document.getElementById('tx-bulk-bar')).toBeNull();
    expect(lunchBox.checked).toBe(false);
    expect(salaryBox.checked).toBe(false);
    expect(transferBox.checked).toBe(false);
  });

  it('wide: select-all covers the loaded rows only', () => {
    wide();
    const rows = Array.from({ length: 30 }, (_, i) =>
      tx({ type: 'EXPENSE', amount: 10 + i, description: `Item ${i + 1}` })
    );
    mount(rows);

    const selectAll = document.getElementById('tx-select-all') as HTMLInputElement;
    expect(selectAll.checked).toBe(false);

    fireEvent.click(selectAll);
    expect(selectAll.checked).toBe(true);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('25 selected');

    const loadMoreBtn = document.getElementById('tx-load-more-btn')!;
    fireEvent.click(loadMoreBtn);

    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(true);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('25 selected');

    fireEvent.click(selectAll);
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('30 selected');

    fireEvent.click(selectAll);
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(false);
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
  });

  it('wide: a selection drops a row a filter hides, and a view switch clears it', () => {
    wide();
    const salary = tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary', description: 'Salary' });
    const lunch = tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Lunch' });
    mount([salary, lunch]);

    fireEvent.click(document.getElementById(`tx-select-row-${salary.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${lunch.id}`)!);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('2 selected');

    fireEvent.click(document.getElementById('tx-filter-type-income')!);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('1 selected');

    fireEvent.click(document.getElementById('tx-filter-type-all')!);
    fireEvent.click(document.getElementById(`tx-select-row-${lunch.id}`)!);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('2 selected');

    fireEvent.click(document.getElementById('tx-view-calendar')!);
    fireEvent.click(document.getElementById('tx-view-table')!);
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
  });

  it('wide: a row button still opens the edit panel and does not toggle the checkbox', () => {
    wide();
    const lunch = tx({ type: 'EXPENSE', amount: 100, categoryId: 'cat-food', description: 'Lunch' });
    mount([lunch]);

    const rowBtn = document.getElementById(`tx-row-${lunch.id}`)!;
    const checkbox = document.getElementById(`tx-select-row-${lunch.id}`) as HTMLInputElement;

    fireEvent.click(rowBtn);
    expect(document.getElementById('tx-drawer-title')?.textContent).toContain('Lunch');
    expect(checkbox.checked).toBe(false);
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
  });

  it('wide: bulk Delete confirms, cancels cleanly, deletes together and lands focus on select-all', async () => {
    wide();
    const tx1 = tx({ type: 'EXPENSE', amount: 100, description: 'Lunch' });
    const tx2 = tx({ type: 'EXPENSE', amount: 200, description: 'Dinner' });
    const tx3 = tx({ type: 'INCOME', amount: 1000, description: 'Salary' });
    mount([tx1, tx2, tx3]);

    fireEvent.click(document.getElementById(`tx-select-row-${tx1.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${tx2.id}`)!);

    const deleteBtn = document.getElementById('tx-bulk-delete-btn')!;
    fireEvent.click(deleteBtn);

    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 transactions?' });
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('They leave your lists and totals and reverse their effect on your wallets and debts. You can restore them from Show deleted.');

    fireEvent.click(document.getElementById('confirm-cancel-btn')!);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete 2 transactions?' })).toBeNull());
    expect(document.getElementById(`tx-select-row-${tx1.id}`)).not.toBeNull();
    expect((document.getElementById(`tx-select-row-${tx1.id}`) as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById(`tx-select-row-${tx2.id}`) as HTMLInputElement).checked).toBe(true);
    expect(document.getElementById('tx-bulk-bar')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    await screen.findByRole('dialog', { name: 'Delete 2 transactions?' });
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete 2 transactions?' })).toBeNull());
    expect(document.getElementById(`tx-row-${tx1.id}`)).toBeNull();
    expect(document.getElementById(`tx-row-${tx2.id}`)).toBeNull();
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe('tx-select-all'));

    fireEvent.click(document.getElementById('tx-show-deleted')!);
    expect(document.getElementById(`tx-row-${tx1.id}`)?.textContent).toContain('[Soft Deleted]');
    expect(document.getElementById(`tx-row-${tx2.id}`)?.textContent).toContain('[Soft Deleted]');
  });

  it('wide: bulk Delete dialog freezes count so it never reads "Delete 0 transactions?"', async () => {
    wide();
    const tx1 = tx({ type: 'EXPENSE', amount: 100, description: 'Lunch' });
    const tx2 = tx({ type: 'EXPENSE', amount: 200, description: 'Dinner' });
    mount([tx1, tx2]);

    fireEvent.click(document.getElementById(`tx-select-row-${tx1.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${tx2.id}`)!);

    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 transactions?' });
    expect(dialog).not.toBeNull();

    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    expect(screen.queryByRole('dialog', { name: 'Delete 0 transactions?' })).toBeNull();
    expect(document.querySelector('[id^="modal-title-"]')?.textContent).not.toContain('Delete 0 transactions?');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('wide: an all-deleted selection offers Restore, shows no net, restores without a dialog', async () => {
    wide();
    const tx1 = tx({ type: 'EXPENSE', amount: 100, description: 'Lunch', isDeleted: true });
    const tx2 = tx({ type: 'EXPENSE', amount: 200, description: 'Dinner', isDeleted: true });
    const tx3 = tx({ type: 'INCOME', amount: 1000, description: 'Salary' });
    mount([tx1, tx2, tx3]);

    fireEvent.click(document.getElementById('tx-show-deleted')!);
    fireEvent.click(document.getElementById(`tx-select-row-${tx1.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${tx2.id}`)!);

    expect(document.getElementById('tx-bulk-restore-btn')).not.toBeNull();
    expect(document.getElementById('tx-bulk-delete-btn')).toBeNull();
    expect(document.getElementById('tx-bulk-net')?.textContent).toContain('Deleted rows are not in your totals');

    fireEvent.click(document.getElementById('tx-bulk-restore-btn')!);
    expect(screen.queryByRole('dialog')).toBeNull();

    await waitFor(() => expect(document.activeElement?.id).toBe('tx-select-all'));
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
    expect(document.getElementById(`tx-row-${tx1.id}`)?.textContent).not.toContain('[Soft Deleted]');
    expect(document.getElementById(`tx-row-${tx2.id}`)?.textContent).not.toContain('[Soft Deleted]');
  });

  it('wide: row-menu Delete lands focus on a neighbour', async () => {
    wide();
    const today = todayIsoDate();
    const row1 = tx({ type: 'EXPENSE', amount: 10, description: 'Item 1', createdAt: '2026-09-01T00:00:03.000Z', transactionDate: today });
    const row2 = tx({ type: 'EXPENSE', amount: 20, description: 'Item 2', createdAt: '2026-09-01T00:00:02.000Z', transactionDate: today });
    const row3 = tx({ type: 'EXPENSE', amount: 30, description: 'Item 3', createdAt: '2026-09-01T00:00:01.000Z', transactionDate: today });
    const { unmount } = mount([row1, row2, row3]);

    fireEvent.click(document.getElementById(`tx-menu-btn-${row2.id}`)!);
    fireEvent.click(document.getElementById(`tx-menu-delete-btn-${row2.id}`)!);
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);
    await waitFor(() => expect(document.activeElement?.id).toBe(`tx-row-${row3.id}`));

    fireEvent.click(document.getElementById(`tx-menu-btn-${row3.id}`)!);
    fireEvent.click(document.getElementById(`tx-menu-delete-btn-${row3.id}`)!);
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);
    await waitFor(() => expect(document.activeElement?.id).toBe(`tx-row-${row1.id}`));

    fireEvent.click(document.getElementById(`tx-menu-btn-${row1.id}`)!);
    fireEvent.click(document.getElementById(`tx-menu-delete-btn-${row1.id}`)!);
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);
    await waitFor(() => expect(document.activeElement?.id).toBe('tx-search-input'));
    unmount();

    const solitary = tx({ type: 'EXPENSE', amount: 10, description: 'Solitary', transactionDate: today });
    mount([solitary]);
    fireEvent.click(document.getElementById('tx-show-deleted')!);
    fireEvent.click(document.getElementById(`tx-menu-btn-${solitary.id}`)!);
    fireEvent.click(document.getElementById(`tx-menu-delete-btn-${solitary.id}`)!);
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);
    await waitFor(() => expect(document.activeElement?.id).toBe(`tx-menu-btn-${solitary.id}`));
  });

  it('narrow: Select mode', async () => {
    const today = todayIsoDate();
    const tx1 = tx({ type: 'EXPENSE', amount: 100, description: 'Lunch', createdAt: '2026-09-01T00:00:02.000Z', transactionDate: today });
    const tx2 = tx({ type: 'EXPENSE', amount: 200, description: 'Dinner', createdAt: '2026-09-01T00:00:01.000Z', transactionDate: today });
    mount([tx1, tx2]);

    expect(document.getElementById('tx-select-all')).toBeNull();
    expect(document.getElementById(`tx-select-row-${tx1.id}`)).toBeNull();

    const selectModeBtn = document.getElementById('tx-select-mode-btn')!;
    expect(selectModeBtn).not.toBeNull();
    expect(selectModeBtn.textContent).toContain('Select');

    fireEvent.click(selectModeBtn);

    const bar = document.getElementById('tx-bulk-bar')!;
    expect(bar).not.toBeNull();
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('z-40');
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('0 selected');
    expect((document.getElementById('tx-bulk-delete-btn') as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => expect(document.activeElement?.id).toBe(`tx-select-row-${tx1.id}`));

    expect(document.querySelectorAll('button[id^="tx-row-"]')).toHaveLength(0);
    expect(document.querySelectorAll('[id^="tx-row-"]')).toHaveLength(2);

    const label1 = document.getElementById(`tx-select-row-${tx1.id}`)!.closest('label')!;
    fireEvent.click(label1);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('1 selected');

    const label2 = document.getElementById(`tx-select-row-${tx2.id}`)!.closest('label')!;
    fireEvent.click(label2);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('2 selected');

    const cancelBtn = document.getElementById('tx-bulk-clear-btn')!;
    expect(cancelBtn.textContent).toBe('Cancel');
    fireEvent.click(cancelBtn);

    expect(document.getElementById('tx-bulk-bar')).toBeNull();
    expect(document.getElementById(`tx-select-row-${tx1.id}`)).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe('tx-select-mode-btn'));

    fireEvent.click(document.getElementById('tx-select-mode-btn')!);
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('0 selected');
  });

  it('narrow: Delete completes and exits the mode', async () => {
    const today = todayIsoDate();
    const tx1 = tx({ type: 'EXPENSE', amount: 100, description: 'Lunch', createdAt: '2026-09-01T00:00:03.000Z', transactionDate: today });
    const tx2 = tx({ type: 'EXPENSE', amount: 200, description: 'Dinner', createdAt: '2026-09-01T00:00:02.000Z', transactionDate: today });
    const tx3 = tx({ type: 'EXPENSE', amount: 300, description: 'Snack', createdAt: '2026-09-01T00:00:01.000Z', transactionDate: today });
    mount([tx1, tx2, tx3]);

    fireEvent.click(document.getElementById('tx-select-mode-btn')!);
    fireEvent.click(document.getElementById(`tx-select-row-${tx1.id}`)!.closest('label')!);
    fireEvent.click(document.getElementById(`tx-select-row-${tx2.id}`)!.closest('label')!);

    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    await screen.findByRole('dialog', { name: 'Delete 2 transactions?' });
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.getElementById(`tx-row-${tx1.id}`)).toBeNull();
    expect(document.getElementById(`tx-row-${tx2.id}`)).toBeNull();
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe('tx-select-mode-btn'));
  });

  it('narrow: outside the mode the list is today\'s', () => {
    const tx1 = tx({ type: 'EXPENSE', amount: 100, description: 'Lunch' });
    mount([tx1]);

    const rowBtn = document.getElementById(`tx-row-${tx1.id}`)!;
    expect(rowBtn.tagName.toLowerCase()).toBe('button');
    fireEvent.click(rowBtn);
    expect(screen.getByRole('dialog', { name: 'Lunch' })).not.toBeNull();
    expect(document.getElementById('tx-select-mode-btn')).not.toBeNull();
  });
});
