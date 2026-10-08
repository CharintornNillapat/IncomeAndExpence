// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { TransactionForm } from '../src/components/TransactionForm';
import { WalletTransferForm } from '../src/components/wallet/WalletTransferForm';
import { FinanceProvider } from '../src/context/FinanceContext';
import { overdraftBy } from '../src/selectors/wallets';
import type { Category, Wallet } from '../src/types';

/**
 * Phase 109 (ADR 0085, audit findings 4 and 11). Money leaving a wallet that
 * is not a credit card warns when it takes the wallet below zero, in the
 * entry form as the transfer form already did; it never blocks (ADR 0014).
 * A credit card owes by design, so it is never overdrawn. In Income mode the
 * wallet field is the one that receives the money.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const wallet = (id: string, name: string, type: Wallet['type'], balance: number): Wallet => ({
  id, userId: 'guest', name, type, balance, currency: 'THB', color: '#5CC8B8', icon: 'x',
  isArchived: false, isDeleted: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '',
});
const CASH = wallet('wal-cash', 'Cash', 'CASH', 500);
const CARD = wallet('wal-card', 'Card', 'CREDIT_CARD', -100);
const FOOD: Category = { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false };
const PAY: Category = { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'x', color: '#8FA8C8', isSystem: true, isDeleted: false };

describe('overdraftBy', () => {
  it('is how far below zero a wallet goes, and 0 for a credit card or at zero', () => {
    expect(overdraftBy(CASH, -50.25)).toBe(50.25);
    expect(overdraftBy(CASH, 0)).toBe(0);
    expect(overdraftBy(CASH, 10)).toBe(0);
    expect(overdraftBy(CARD, -900)).toBe(0);
  });
});

describe('the entry form', () => {
  function mountForm() {
    render(
      <FinanceProvider>
        <TransactionForm idPrefix="t" wallets={[CASH, CARD]} categories={[FOOD, PAY]} onSubmitTransaction={vi.fn(async () => ({ success: true }))} />
      </FinanceProvider>,
    );
    const note = (value: string) => fireEvent.change(document.querySelector('[id$="-desc"]')!, { target: { value } });
    const warning = () => screen.queryByTestId('t-overdraft-warning');
    const submit = document.getElementById('confirm-t-btn') as HTMLButtonElement;
    return { note, warning, submit };
  }

  it('warns when an expense takes the wallet below zero, and still lets it be saved', () => {
    const { note, warning, submit } = mountForm();
    note('lunch 500');
    expect(warning()).toBeNull();
    note('lunch 600.5');
    expect(warning()!.textContent).toBe('This overdraws Cash by ฿100.50.');
    expect(submit.disabled).toBe(false);
  });

  it('does not warn for a credit card, or for income', () => {
    const { note, warning } = mountForm();
    note('lunch 600');
    fireEvent.change(document.getElementById('t-wallet-select')!, { target: { value: 'wal-card' } });
    expect(warning()).toBeNull();

    fireEvent.change(document.getElementById('t-wallet-select')!, { target: { value: 'wal-cash' } });
    expect(warning()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(warning()).toBeNull();
  });

  it('names the wallet field for the way the money goes (finding 11)', () => {
    mountForm();
    expect(screen.getByLabelText('Paying Wallet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(screen.getByLabelText('Receiving Wallet')).toBeTruthy();
    expect(screen.queryByLabelText('Paying Wallet')).toBeNull();
  });
});

/**
 * Phase 114 (ADR 0090): a screen reader hears the warning through a polite
 * status region, when it appears and when the paying wallet or its balance
 * changes, never on a keystroke that only moves the amount. A change to the
 * region's text is what gets announced, so the tests count those.
 */
function watch(region: HTMLElement) {
  let changes = 0;
  const observer = new MutationObserver((records) => { changes += records.length; });
  observer.observe(region, { childList: true, characterData: true, subtree: true });
  return { changes: () => (changes += observer.takeRecords().length), stop: () => observer.disconnect() };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the overdraft announcement', () => {
  it('in the entry form: on appearance and a wallet change, not on each keystroke', async () => {
    const view = render(
      <FinanceProvider>
        <TransactionForm idPrefix="t" wallets={[CASH, CARD]} categories={[FOOD, PAY]} onSubmitTransaction={vi.fn(async () => ({ success: true }))} />
      </FinanceProvider>,
    );
    const note = (value: string) => fireEvent.change(document.querySelector('[id$="-desc"]')!, { target: { value } });
    const region = screen.getByTestId('t-overdraft-announcer');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');

    note('lunch 500');
    expect(region.textContent).toBe('');
    note('lunch 600');
    expect(region.textContent).toBe('This overdraws Cash by ฿100.00.');

    const watcher = watch(region);
    note('lunch 6000');
    note('lunch 60000');
    await settle();
    expect(watcher.changes()).toBe(0);
    expect(screen.getByTestId('t-overdraft-warning').textContent).toBe('This overdraws Cash by ฿59,500.00.');
    watcher.stop();

    // The balance changes under it (a sync): announced again, with the new figure.
    view.rerender(
      <FinanceProvider>
        <TransactionForm idPrefix="t" wallets={[{ ...CASH, balance: 400 }, CARD]} categories={[FOOD, PAY]} onSubmitTransaction={vi.fn(async () => ({ success: true }))} />
      </FinanceProvider>,
    );
    expect(screen.getByTestId('t-overdraft-announcer').textContent).toBe('This overdraws Cash by ฿59,600.00.');

    // A credit card is never overdrawn: the region empties.
    fireEvent.change(document.getElementById('t-wallet-select')!, { target: { value: 'wal-card' } });
    expect(screen.getByTestId('t-overdraft-announcer').textContent).toBe('');
  });

  it('in the transfer form: on appearance, not while the amount grows', async () => {
    const ids = { source: 'src', dest: 'dst', amount: 'xfer-amt', note: 'note', submit: 'xfer-submit', swap: 'swap', transferAll: 'xfer-all' };
    render(
      <FinanceProvider>
        <WalletTransferForm wallets={[CASH, CARD]} ids={ids} tone="plain" onTransferred={() => {}} />
      </FinanceProvider>,
    );
    const region = screen.getByTestId('transfer-overdraft-announcer');
    expect(region.getAttribute('role')).toBe('status');
    fireEvent.change(document.getElementById('src')!, { target: { value: 'wal-cash' } });
    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '700' } });
    expect(region.textContent).toBe('This overdraws Cash by ฿200.00.');

    const watcher = watch(region);
    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '7000' } });
    await settle();
    expect(watcher.changes()).toBe(0);
    watcher.stop();

    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '70' } });
    expect(region.textContent).toBe('');
  });
});

describe('the transfer form', () => {
  const ids = { source: 'src', dest: 'dst', amount: 'xfer-amt', note: 'note', submit: 'xfer-submit', swap: 'swap', transferAll: 'xfer-all' };

  it('warns for a cash source going below zero, and not for a credit card', () => {
    render(
      <FinanceProvider>
        <WalletTransferForm wallets={[CASH, CARD]} ids={ids} tone="plain" onTransferred={() => {}} />
      </FinanceProvider>,
    );
    fireEvent.change(document.getElementById('src')!, { target: { value: 'wal-cash' } });
    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '700' } });
    expect(screen.getByTestId('transfer-overdraft-warning').textContent).toBe('This overdraws Cash by ฿200.00.');

    fireEvent.change(document.getElementById('src')!, { target: { value: 'wal-card' } });
    expect((document.getElementById('src') as HTMLSelectElement).value).toBe('wal-card');
    expect(screen.queryByTestId('transfer-overdraft-warning')).toBeNull();
  });
});
