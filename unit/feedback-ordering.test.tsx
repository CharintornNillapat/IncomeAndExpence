// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act, renderHook } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { TransactionsView } from '../src/views/TransactionsView';
import { TransactionDetails } from '../src/components/transaction/TransactionDrawer';
import { WalletDetail } from '../src/components/wallet/WalletDetail';
import { useTransientFlash } from '../src/hooks/useTransientFlash';
import { todayIsoDate } from '../src/utils/date';
import type { Transaction, Wallet } from '../src/types';

/**
 * Phase 80 (ADR 0056): feedback must belong to the event that produced it.
 *
 * Phase 79 found a live region whose text an effect replaced after a later
 * update. The same family here is a result arriving after the user moved on:
 * a save, restore, edit or adjustment for one row or wallet that finishes
 * after another is open. Each test holds the first action's promise open,
 * switches, then lets it settle, and checks that nothing it says lands on
 * the second. Each has a same-row twin, so the check is not vacuous.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

type Result = { success: boolean; error?: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const byId = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T | null;

const CASH: Wallet = {
  id: 'wal-cash', userId: 'u', name: 'Cash Wallet', type: 'CASH', currency: 'THB', balance: 500,
  color: '#D9A066', icon: 'x', isArchived: false, isDeleted: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '',
};
const MAIN: Wallet = { ...CASH, id: 'wal-main', name: 'Main Checking', balance: 900, color: '#6C8EEF' };

function row(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id, userId: 'guest', walletId: CASH.id, type: 'EXPENSE', amount: 150, description: `Row ${id}`,
    transactionDate: '2026-09-01', isDeleted: false, createdBy: 'guest',
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', ...overrides,
  };
}

function details(tx: Transaction, handlers: Partial<Record<'onSave' | 'onDelete' | 'onRestore', (...args: never[]) => Promise<Result>>>) {
  return (
    <TransactionDetails
      tx={tx}
      category={undefined}
      wallets={new Map([[CASH.id, CASH]])}
      walletList={[CASH]}
      categoryList={[]}
      onSave={handlers.onSave ?? vi.fn()}
      onDelete={handlers.onDelete ?? vi.fn()}
      onRestore={handlers.onRestore ?? vi.fn()}
    />
  );
}

describe('a transaction\'s save that finishes after another row is open (ADR 0056)', () => {
  async function saveThenSwitch(outcome: Result, switchTo: Transaction | null) {
    const save = deferred<Result>();
    const { rerender } = render(details(row('a'), { onSave: () => save.promise }));
    fireEvent.change(byId('tx-edit-description')!, { target: { value: 'Edited A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    if (switchTo) rerender(details(switchTo, {}));
    await act(async () => save.resolve(outcome));
  }

  it('says "Changes saved" on its own row', async () => {
    await saveThenSwitch({ success: true }, null);
    expect(screen.getByRole('status').textContent).toBe('Changes saved');
  });

  it('does not say "Changes saved" on the row opened meanwhile', async () => {
    await saveThenSwitch({ success: true }, row('b'));
    expect(byId('tx-edit-description')!.value).toBe('Row b');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('does not show its error on the row opened meanwhile', async () => {
    await saveThenSwitch({ success: false, error: 'Could not save A' }, row('b'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows its error on its own row', async () => {
    await saveThenSwitch({ success: false, error: 'Could not save A' }, null);
    expect(screen.getByRole('alert').textContent).toBe('Could not save A');
  });

  it('does not hold the new row\'s buttons while it is still in flight', () => {
    const save = deferred<Result>();
    const { rerender } = render(details(row('a'), { onSave: () => save.promise }));
    fireEvent.change(byId('tx-edit-description')!, { target: { value: 'Edited A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(byId<HTMLButtonElement>('tx-delete-btn-a')!.disabled).toBe(true);

    rerender(details(row('b'), {}));
    expect(byId<HTMLButtonElement>('tx-delete-btn-b')!.disabled).toBe(false);
  });

  it('keeps "Changes saved" when the saved version arrives, and takes it as the baseline', async () => {
    const save = deferred<Result>();
    const { rerender } = render(details(row('a'), { onSave: () => save.promise }));
    fireEvent.change(byId('tx-edit-description')!, { target: { value: 'Edited A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await act(async () => save.resolve({ success: true }));

    rerender(details(row('a', { description: 'Edited A', updatedAt: '2026-09-02T00:00:00.000Z' }), { onSave: () => save.promise }));
    expect(byId('tx-edit-description')!.value).toBe('Edited A');
    expect(screen.getByRole('status').textContent).toBe('Changes saved');

    // A keystroke right after the new version is the user's, not reset.
    fireEvent.change(byId('tx-edit-description')!, { target: { value: 'Edited again' } });
    expect(byId('tx-edit-description')!.value).toBe('Edited again');
  });
});

describe('a restore that finishes after another deleted row is open (ADR 0056)', () => {
  async function restoreThenSwitch(switchTo: Transaction | null) {
    const restore = deferred<Result>();
    const { rerender } = render(details(row('a', { isDeleted: true }), { onRestore: () => restore.promise }));
    fireEvent.click(byId<HTMLButtonElement>('tx-restore-btn-a')!);
    if (switchTo) rerender(details(switchTo, {}));
    await act(async () => restore.resolve({ success: false, error: 'Could not restore A' }));
  }

  it('shows its error on its own row', async () => {
    await restoreThenSwitch(null);
    expect(screen.getByRole('alert').textContent).toBe('Could not restore A');
  });

  it('does not show its error on the row opened meanwhile', async () => {
    await restoreThenSwitch(row('b', { isDeleted: true }));
    expect(byId('tx-restore-btn-b')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a wallet\'s edit or adjustment that finishes after another wallet is selected (ADR 0056)', () => {
  function walletDetail(wallet: Wallet, handlers: { onEdit?: () => Promise<Result>; onAdjust?: () => Promise<Result> }) {
    return (
      <WalletDetail
        wallet={wallet}
        items={[]}
        dayNets={new Map()}
        wallets={new Map([[CASH.id, CASH], [MAIN.id, MAIN]])}
        categories={new Map()}
        today="2026-09-01"
        onTransferOut={vi.fn()}
        onAdjustBalance={handlers.onAdjust ?? vi.fn()}
        onEdit={handlers.onEdit ?? vi.fn()}
        onRequestArchive={vi.fn()}
        onRequestDelete={vi.fn()}
        onViewAllTransactions={vi.fn()}
        onOpenTransaction={vi.fn()}
      />
    );
  }

  async function editThenSwitch(switchTo: Wallet | null) {
    const edit = deferred<Result>();
    const { rerender } = render(walletDetail(CASH, { onEdit: () => edit.promise }));
    fireEvent.click(byId('wallet-edit-btn')!);
    fireEvent.change(byId('wallet-edit-name')!, { target: { value: 'Cash renamed' } });
    fireEvent.submit(byId('wallet-edit-form')!);
    if (switchTo) {
      rerender(walletDetail(switchTo, {}));
      fireEvent.click(byId('wallet-edit-btn')!);
      fireEvent.change(byId('wallet-edit-name')!, { target: { value: 'Main draft' } });
      expect(byId<HTMLButtonElement>('wallet-edit-save-btn')!.disabled).toBe(false);
    }
    await act(async () => edit.resolve({ success: true }));
  }

  it('closes its own editor when it succeeds', async () => {
    await editThenSwitch(null);
    expect(byId('wallet-edit-form')).toBeNull();
  });

  it('does not close the next wallet\'s editor or lose its draft', async () => {
    await editThenSwitch(MAIN);
    expect(byId('wallet-edit-form')).not.toBeNull();
    expect(byId('wallet-edit-name')!.value).toBe('Main draft');
  });

  async function adjustThenSwitch(switchTo: Wallet | null) {
    const adjust = deferred<Result>();
    const { rerender } = render(walletDetail(CASH, { onAdjust: () => adjust.promise }));
    fireEvent.click(byId(`wallet-adjust-btn-${CASH.id}`)!);
    fireEvent.click(byId('wallet-adjust-save-btn')!);
    if (switchTo) {
      rerender(walletDetail(switchTo, {}));
      fireEvent.click(byId(`wallet-adjust-btn-${switchTo.id}`)!);
    }
    await act(async () => adjust.resolve({ success: false, error: 'Could not adjust Cash' }));
  }

  it('shows a failed adjustment on its own wallet', async () => {
    await adjustThenSwitch(null);
    expect(screen.getByText('Could not adjust Cash')).not.toBeNull();
  });

  it('does not show a failed adjustment on the next wallet\'s editor', async () => {
    await adjustThenSwitch(MAIN);
    expect(byId('wallet-adjust-input')).not.toBeNull();
    expect(screen.queryByText('Could not adjust Cash')).toBeNull();
  });
});

describe('the Transactions list under rapid events (ADR 0056)', () => {
  function seedRows(count: number): Transaction[] {
    return Array.from({ length: count }, (_, i) =>
      row(`r${String(i).padStart(3, '0')}`, {
        description: i % 2 === 0 ? `Even ${i}` : `Odd ${i}`,
        transactionDate: todayIsoDate(),
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString(),
      })
    );
  }

  function mount(rows: Transaction[]) {
    localStorage.setItem('pf_transactions', JSON.stringify(rows));
    return render(
      <FinanceProvider>
        <TransactionsView />
      </FinanceProvider>
    );
  }

  const shown = () => document.querySelectorAll('button[id^="tx-row-"]').length;

  // Pins the behaviour, not the old window: under `act` jsdom flushes effects
  // before the next event, so the effect version passes this too. The window
  // (a click on the new list before its reset effect ran) is closed by
  // construction: the reset now happens in the render that shows the list.
  it('keeps a "Load more" pressed on the list the search just settled on', async () => {
    mount(seedRows(80));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.change(byId('tx-search-input')!, { target: { value: 'Even' } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(shown()).toBe(25);
    fireEvent.click(byId<HTMLButtonElement>('tx-load-more-btn')!);
    expect(shown()).toBe(40);
  });

  it('starts from the top when the search settles after a Load more on the old list', async () => {
    mount(seedRows(80));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.change(byId('tx-search-input')!, { target: { value: 'Even' } });
    // Pressed on the unfiltered list, before the search applied: a filter
    // change still starts from the top.
    await act(async () => {
      fireEvent.click(byId<HTMLButtonElement>('tx-load-more-btn')!);
      vi.advanceTimersByTime(250);
    });
    expect(shown()).toBe(25);
  });

  it('still starts the list from the top when a filter changes, and again when it changes back', async () => {
    mount(seedRows(80));
    expect(shown()).toBe(25);
    fireEvent.click(byId<HTMLButtonElement>('tx-load-more-btn')!);
    expect(shown()).toBe(50);

    fireEvent.change(byId<HTMLSelectElement>('tx-filter-range')!, { target: { value: 'DAY' } });
    expect(shown()).toBe(25);
    fireEvent.click(byId<HTMLButtonElement>('tx-load-more-btn')!);
    expect(shown()).toBe(50);
    fireEvent.change(byId<HTMLSelectElement>('tx-filter-range')!, { target: { value: 'ALL' } });
    expect(shown()).toBe(25);
  });
});

describe('useTransientFlash under rapid flashes', () => {
  it('lets the last flash run its full time, not the first one\'s', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransientFlash<string | null>(null, 1000));

    act(() => result.current.flash('first'));
    act(() => vi.advanceTimersByTime(800));
    act(() => result.current.flash('second'));
    act(() => vi.advanceTimersByTime(800));
    // 1.6 s after the first: its timer would have cleared by now.
    expect(result.current.value).toBe('second');
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.value).toBeNull();
  });

  it('a clear between two flashes does not cut the second one short', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransientFlash<string | null>(null, 1000));

    act(() => result.current.flash('first'));
    act(() => result.current.clear());
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.flash('second'));
    act(() => vi.advanceTimersByTime(900));
    expect(result.current.value).toBe('second');
  });
});
