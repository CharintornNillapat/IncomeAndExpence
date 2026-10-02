// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { TransactionsView } from '../src/views/TransactionsView';
import { TransactionDetails } from '../src/components/transaction/TransactionDrawer';
import { RecentActivityCard } from '../src/components/dashboard/RecentActivityCard';
import { buildLookupMap } from '../src/utils/mapUtils';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { shiftIsoDate, todayIsoDate } from '../src/utils/date';
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

function mount(rows: Transaction[]) {
  localStorage.setItem('pf_transactions', JSON.stringify(rows));
  return render(
    <FinanceProvider>
      <TransactionsView />
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
