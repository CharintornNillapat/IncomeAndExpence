// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { DebtsView } from '../src/views/DebtsView';
import { DebtEditSchema } from '../src/utils/zodSchemas';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { formatShortDate, shiftIsoDate, todayIsoDate } from '../src/utils/date';
import { debtPlan, requiredMonthly } from '../src/selectors/debts';
import type { Debt, Transaction } from '../src/types';
import { SAMPLE_STUDENT_LOAN } from './fixtures/guestLedger';

/**
 * Phase 60 (ADR 0035, spec 6.4): the Debt payoff page, mounted inside the real
 * `FinanceProvider` in guest mode and seeded through localStorage. A fresh
 * guest has no debt (ADR 0040); the tests that read one seed
 * `SAMPLE_STUDENT_LOAN`: Student Loan, ฿4,500 of ฿10,000 still owed, 4.5% APR,
 * due 2026-12-31.
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

const TODAY = todayIsoDate();

function debtRow(overrides: Partial<Debt> & Pick<Debt, 'id' | 'name'>): Debt {
  return {
    userId: 'guest',
    totalAmount: 10000,
    remainingAmount: 5000,
    isSettled: false,
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function income(amount: number): Transaction {
  return {
    id: `seed-income-${amount}`,
    userId: 'guest',
    walletId: 'wal-main-checking',
    categoryId: 'cat-salary',
    amount,
    type: 'INCOME',
    description: 'Salary',
    transactionDate: TODAY,
    isDeleted: false,
    createdBy: 'guest',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function spent(amount: number): Transaction {
  return { ...income(amount), id: `seed-spent-${amount}`, categoryId: 'cat-food', type: 'EXPENSE', description: 'Dinner' };
}

function mount(options: { debts?: Debt[]; rows?: Transaction[] } = {}) {
  if (options.debts) localStorage.setItem('pf_debts', JSON.stringify(options.debts));
  if (options.rows) localStorage.setItem('pf_transactions', JSON.stringify(options.rows));
  return render(
    <FinanceProvider>
      <DebtsView />
    </FinanceProvider>
  );
}

const byId = (id: string) => document.getElementById(id);
const cardIds = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll('[id^="debt-card-"]')).map((el) => el.id.replace('debt-card-', ''));
const activeSection = () => screen.getByRole('region', { name: 'Active debts' });
const openMenu = (id: string) => fireEvent.click(byId(`debt-menu-btn-${id}`)!);

describe('the page header', () => {
  it('is titled "Debt payoff" and counts the active debts', () => {
    mount({ debts: [SAMPLE_STUDENT_LOAN] });
    expect(screen.getByRole('heading', { level: 1, name: 'Debt payoff' })).toBeTruthy();
    expect(screen.getByText('1 active debt · sorted by due date')).toBeTruthy();
    expect(byId('open-add-debt-btn')!.textContent).toBe('Add debt');
  });

  it('leaves paid-off and deleted debts out of the count', () => {
    mount({
      debts: [
        debtRow({ id: 'a', name: 'Owed', dueDate: '2027-01-31' }),
        debtRow({ id: 'b', name: 'Also owed' }),
        debtRow({ id: 'c', name: 'Done', remainingAmount: 0, isSettled: true }),
        debtRow({ id: 'd', name: 'Gone', isDeleted: true }),
      ],
    });
    expect(screen.getByText('2 active debts · sorted by due date')).toBeTruthy();
    expect(byId('debt-card-d')).toBeNull();
  });
});

describe('the order of the cards', () => {
  it('lists the active debts nearest due date first, overdue at the top and undated last, then the paid-off ones', () => {
    mount({
      debts: [
        debtRow({ id: 'undated', name: 'Undated' }),
        debtRow({ id: 'later', name: 'Later', dueDate: shiftIsoDate(TODAY, 200) }),
        debtRow({ id: 'paid', name: 'Paid', remainingAmount: 0, isSettled: true, dueDate: shiftIsoDate(TODAY, 1) }),
        debtRow({ id: 'sooner', name: 'Sooner', dueDate: shiftIsoDate(TODAY, 60) }),
        debtRow({ id: 'overdue', name: 'Overdue', dueDate: shiftIsoDate(TODAY, -10) }),
      ],
    });
    expect(cardIds(activeSection())).toEqual(['overdue', 'sooner', 'later', 'undated']);

    const paidOff = screen.getByRole('region', { name: 'Paid off (1)' });
    expect(cardIds(paidOff)).toEqual(['paid']);
    expect(within(paidOff).getByText('100% Fully Settled!')).toBeTruthy();
    expect(within(paidOff).getByText('✓ Debt Fully Settled')).toBeTruthy();
    // A paid-off card has no actions but its menu.
    expect(byId('open-repay-modal-paid')).toBeNull();
    expect(byId('settle-debt-paid')).toBeNull();
  });
});

describe('a debt card', () => {
  it('tags its interest and its due date with the months left, or says it is overdue', () => {
    const due = shiftIsoDate(TODAY, 200);
    mount({
      debts: [
        debtRow({ id: 'apr', name: 'Card', interestRate: 4.5, dueDate: due }),
        debtRow({ id: 'free', name: 'Family', dueDate: shiftIsoDate(TODAY, -3) }),
        debtRow({ id: 'none', name: 'Someday' }),
      ],
    });
    const plan = debtPlan(
      [debtRow({ id: 'apr', name: 'Card', dueDate: due })],
      TODAY,
      0
    );
    const months = plan.items[0].monthsLeft!;
    const apr = byId('debt-card-apr')!;
    expect(within(apr).getByText('4.5% APR')).toBeTruthy();
    expect(within(apr).getByText(`Due ${formatShortDate(due)} · ~${months} ${months === 1 ? 'month' : 'months'}`)).toBeTruthy();

    const free = byId('debt-card-free')!;
    expect(within(free).getByText('Interest-free')).toBeTruthy();
    expect(within(free).getByText(`Overdue · due ${formatShortDate(shiftIsoDate(TODAY, -3))}`).className).toContain('text-expense');

    expect(within(byId('debt-card-none')!).getAllByText('No due date')).toHaveLength(2);
  });

  it('shows what is still owed, the share paid, and Borrowed, Repaid and Needed / month', () => {
    mount({ debts: [SAMPLE_STUDENT_LOAN] });
    const card = byId('debt-card-debt-starter-01')!;
    expect(card.textContent).toContain(`Still owed${formatCurrencyAmount(4500)}`);
    expect(card.textContent).toContain('55.0% paid');
    expect(card.textContent).toContain(`Borrowed${formatCurrencyAmount(10000)}`);
    expect(card.textContent).toContain(`Repaid${formatCurrencyAmount(5500)}`);
    const required = requiredMonthly(debtRow({ id: 'x', name: 'x', remainingAmount: 4500, dueDate: '2026-12-31' }), TODAY);
    expect(card.textContent).toContain(`Needed / month${formatCurrencyAmount(required!)}`);
  });

  it('keeps Edit and Delete in its ⋯ menu, which holds nothing until opened', () => {
    mount({ debts: [debtRow({ id: 'a', name: 'Car' })] });
    expect(byId('edit-debt-a')).toBeNull();
    expect(byId('delete-debt-a')).toBeNull();
    expect(byId('debt-menu-btn-a')!.getAttribute('aria-label')).toBe('More actions for Car');

    openMenu('a');
    expect(byId('edit-debt-a')!.textContent).toBe('Edit debt');
    expect(byId('delete-debt-a')!.textContent).toBe('Delete debt…');
  });
});

describe('the summary', () => {
  // ฿12,000 owed, due in about seven months: far more a month than nothing left over.
  const big = () => debtRow({ id: 'big', name: 'Big', totalAmount: 12000, remainingAmount: 12000, dueDate: shiftIsoDate(TODAY, 210) });

  it('totals what is still owed and paid off', () => {
    mount({ debts: [big(), debtRow({ id: 'done', name: 'Done', totalAmount: 3000, remainingAmount: 0, isSettled: true })] });
    expect(screen.getByTestId('debt-summary-owed').textContent).toBe(`Still owed${formatCurrencyAmount(12000)}of ${formatCurrencyAmount(15000)} borrowed`);
    expect(screen.getByTestId('debt-summary-paid').textContent).toBe(`Paid off20.0%${formatCurrencyAmount(3000)} repaid`);
  });

  it('warns when the debts need more a month than the past 30 days left, which left nothing over', () => {
    mount({ debts: [big()] });
    const required = requiredMonthly(big(), TODAY)!;
    const box = screen.getByTestId('debt-summary-plan');
    expect(box.getAttribute('role')).toBe('note');
    // Audit 009 finding 1: with no surplus, the gap would only repeat the total.
    expect(box.textContent).toBe(
      `Needed per month to hit every due date${formatCurrencyAmount(required)}The past 30 days left no surplus (${formatCurrencyAmount(0)})`
    );
    // The debt that alone outruns the surplus shows its figures in the warning colour (L5).
    const card = byId('debt-card-big')!;
    expect(within(card).getByText(/^Due /).className).toContain('text-pending-body');
  });

  it('names a negative surplus with its sign', () => {
    mount({ debts: [big()], rows: [spent(700)] });
    expect(screen.getByTestId('debt-summary-plan').textContent).toContain(
      `The past 30 days left no surplus (${MINUS}${formatCurrencyAmount(700)})`
    );
  });

  it('states the gap against a surplus that is there but too small', () => {
    mount({ debts: [big()], rows: [income(1000)] });
    const required = requiredMonthly(big(), TODAY)!;
    expect(screen.getByTestId('debt-summary-plan').textContent).toBe(
      `Needed per month to hit every due date${formatCurrencyAmount(required)}${formatCurrencyAmount(required - 1000)} more than the past 30 days' surplus of ${formatCurrencyAmount(1000)}`
    );
  });

  it('reads "On track" once the surplus covers the plan', () => {
    mount({ debts: [big()], rows: [income(50000)] });
    const required = requiredMonthly(big(), TODAY)!;
    const box = screen.getByTestId('debt-summary-plan');
    expect(box.getAttribute('role')).toBeNull();
    expect(box.textContent).toBe(`On track${formatCurrencyAmount(required)}a month meets every due date, within what you have left over`);
    expect(within(byId('debt-card-big')!).getByText(/^Due /).className).not.toContain('text-pending-body');
  });

  it('says repayments are not spending', () => {
    mount({ debts: [SAMPLE_STUDENT_LOAN] });
    expect(byId('debts-caption')!.textContent).toBe("Debt repayments move money out of a wallet but aren't counted as spending.");
  });
});

describe('Mark as paid off', () => {
  it('asks first, and Cancel leaves the debt as it was', () => {
    mount({ debts: [debtRow({ id: 'a', name: 'Car', remainingAmount: 4000 })] });
    fireEvent.click(byId('settle-debt-a')!);

    const dialog = screen.getByRole('dialog', { name: 'Mark as paid off' });
    expect(dialog.textContent).toContain(
      `Mark "Car" as paid off? This sets what is still owed (${formatCurrencyAmount(4000)}) to zero without recording a payment or moving money. To pay from a wallet, use Make repayment.`
    );
    fireEvent.click(within(dialog).getByText('Cancel'));
    expect(cardIds(activeSection())).toEqual(['a']);
    expect(screen.queryByRole('region', { name: /^Paid off/ })).toBeNull();
  });

  it('on confirm, moves the debt to Paid off and gives focus to its menu', async () => {
    mount({ debts: [debtRow({ id: 'a', name: 'Car', remainingAmount: 4000 })] });
    const settle = byId('settle-debt-a')!;
    settle.focus();
    fireEvent.click(settle);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Mark as paid off' })).getByText('Mark as paid off', { selector: 'button' }));

    await waitFor(() => expect(cardIds(screen.getByRole('region', { name: 'Paid off (1)' }))).toEqual(['a']));
    expect(screen.getByText('Every debt is paid off.')).toBeTruthy();
    expect(screen.getByText('No active debts')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(byId('debt-menu-btn-a')));
  });
});

describe('Edit', () => {
  const openEdit = (id: string) => {
    openMenu(id);
    fireEvent.click(byId(`edit-debt-${id}`)!);
    return screen.getByRole('dialog', { name: 'Edit debt' });
  };
  const field = (id: string) => byId(id) as HTMLInputElement;

  it('opens on the debt, shows what is still owed without offering it, and saves', async () => {
    mount({ debts: [debtRow({ id: 'a', name: 'Car', interestRate: 3, minimumPayment: 250, dueDate: '2027-03-31' })] });
    const dialog = openEdit('a');
    expect(field('edit-debt-name').value).toBe('Car');
    expect(field('edit-debt-total').value).toBe('10000');
    expect(field('edit-debt-interest').value).toBe('3');
    expect(field('edit-debt-min-payment').value).toBe('250');
    expect(field('edit-debt-due-date').value).toBe('2027-03-31');
    expect(within(dialog).getByText(formatCurrencyAmount(5000))).toBeTruthy();
    expect(byId('edit-debt-remaining')).toBeNull();

    fireEvent.change(field('edit-debt-name'), { target: { value: 'Car loan' } });
    fireEvent.change(field('edit-debt-total'), { target: { value: '12000' } });
    fireEvent.change(field('edit-debt-interest'), { target: { value: '' } });
    fireEvent.click(byId('save-edit-debt-btn')!);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit debt' })).toBeNull());
    const card = byId('debt-card-a')!;
    expect(within(card).getByRole('heading', { name: 'Car loan' })).toBeTruthy();
    expect(card.textContent).toContain(`Borrowed${formatCurrencyAmount(12000)}`);
    expect(card.textContent).toContain(`Still owed${formatCurrencyAmount(5000)}`);
    expect(within(card).getByText('Interest-free')).toBeTruthy();
  });

  it('refuses a borrowed total below what is still owed, and stays open with the reason', async () => {
    mount({ debts: [debtRow({ id: 'a', name: 'Car' })] });
    openEdit('a');
    fireEvent.change(field('edit-debt-total'), { target: { value: '4999.99' } });
    fireEvent.click(byId('save-edit-debt-btn')!);

    await waitFor(() =>
      expect(byId('edit-debt-error')!.textContent).toBe(`Borrowed can't be less than what is still owed (${formatCurrencyAmount(5000)})`)
    );
    expect(screen.getByRole('dialog', { name: 'Edit debt' })).toBeTruthy();
    expect(byId('debt-card-a')!.textContent).toContain(`Borrowed${formatCurrencyAmount(10000)}`);
  });
});

describe('Delete', () => {
  it('is reached through the menu, keeps the repayments, and gives focus to Add debt', async () => {
    mount({ debts: [debtRow({ id: 'a', name: 'Car' }), debtRow({ id: 'b', name: 'Bike' })] });
    openMenu('a');
    fireEvent.click(byId('delete-debt-a')!);
    const dialog = screen.getByRole('dialog', { name: 'Delete debt' });
    expect(dialog.textContent).toContain('Delete "Car"? It leaves your payoff goals. Its repayment transactions stay in your history.');

    fireEvent.click(byId('confirm-destructive-btn')!);
    await waitFor(() => expect(byId('debt-card-a')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(byId('open-add-debt-btn')));
  });
});

describe('DebtEditSchema', () => {
  const base = { name: 'Car', totalAmount: 5000, remainingAmount: 5000 };
  const ok = (data: object) => DebtEditSchema.safeParse({ ...base, ...data }).success;

  it('lets Borrowed equal what is still owed, and not a cent less', () => {
    expect(ok({})).toBe(true);
    expect(ok({ totalAmount: 4999.99 })).toBe(false);
  });

  it('bounds the rate at 0 to 100, and needs a name and a positive total', () => {
    expect(ok({ interestRate: 100 })).toBe(true);
    expect(ok({ interestRate: 100.1 })).toBe(false);
    expect(ok({ interestRate: -1 })).toBe(false);
    expect(ok({ name: '   ' })).toBe(false);
    expect(ok({ totalAmount: 0, remainingAmount: 0 })).toBe(false);
    expect(ok({ minimumPayment: Number.NaN })).toBe(false);
  });

  it('takes a blank optional field as cleared, and a due date only as YYYY-MM-DD', () => {
    expect(ok({ interestRate: undefined, minimumPayment: undefined, dueDate: undefined })).toBe(true);
    expect(ok({ dueDate: '2027-03-31' })).toBe(true);
    expect(ok({ dueDate: '31/03/2027' })).toBe(false);
  });
});
