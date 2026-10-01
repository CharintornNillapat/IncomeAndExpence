// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { WalletsView } from '../src/views/WalletsView';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { todayIsoDate } from '../src/utils/date';
import type { Transaction, Wallet } from '../src/types';

/**
 * Phase 59 (ADR 0034, spec 6.3): the Wallets page, mounted inside the real
 * `FinanceProvider` in guest mode, seeded through localStorage the way a
 * returning guest's ledger is. A fresh guest has the three starter wallets:
 * Main Checking ฿2,500, Cash Wallet ฿150 and Savings Reserve ฿5,000.
 *
 * jsdom has no `matchMedia`, which `useMediaQuery` reads as narrow. The wide
 * layout's tests install one that matches every query.
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
});

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

const TODAY = todayIsoDate();

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1;
  return {
    id: `seed-${seq}`,
    userId: 'guest',
    walletId: 'wal-cash',
    description: `row ${seq}`,
    transactionDate: TODAY,
    isDeleted: false,
    createdBy: 'guest',
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, seq)).toISOString(),
    updatedAt: '',
    ...overrides,
  };
}

function walletRow(overrides: Partial<Wallet> & Pick<Wallet, 'id' | 'name'>): Wallet {
  return {
    userId: 'guest',
    type: 'CASH',
    currency: 'THB',
    balance: 0,
    color: '#16a34a',
    icon: 'cash',
    isArchived: false,
    isDeleted: false,
    createdAt: '2026-09-18T02:15:00.000Z',
    updatedAt: '2026-09-18T02:15:00.000Z',
    ...overrides,
  };
}

function mount(
  options: { rows?: Transaction[]; wallets?: Wallet[]; props?: Partial<React.ComponentProps<typeof WalletsView>> } = {}
) {
  if (options.rows) localStorage.setItem('pf_transactions', JSON.stringify(options.rows));
  if (options.wallets) localStorage.setItem('pf_wallets', JSON.stringify(options.wallets));
  return render(
    <FinanceProvider>
      <WalletsView {...options.props} />
    </FinanceProvider>
  );
}

const byId = (id: string) => document.getElementById(id);
const selectWallet = (id: string) => fireEvent.click(byId(`wallet-entity-${id}`)!);
const openMenu = () => fireEvent.click(byId('wallet-detail-menu-btn')!);

describe('the page header', () => {
  it('is titled "Wallets" and totals the active wallets', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Wallets' })).toBeTruthy();
    expect(screen.getByText(`${formatCurrencyAmount(7650)} across 3 wallets`)).toBeTruthy();
  });

  it('leaves an archived or deleted wallet out of the total and the count', () => {
    mount({
      wallets: [
        walletRow({ id: 'a', name: 'Kept', balance: 100 }),
        walletRow({ id: 'b', name: 'Shelved', balance: 40, isArchived: true }),
        walletRow({ id: 'c', name: 'Gone', balance: 60, isDeleted: true }),
      ],
    });
    expect(screen.getByText(`${formatCurrencyAmount(100)} across 1 wallet`)).toBeTruthy();
    expect(byId('wallet-entity-b')).toBeNull();
    expect(byId('wallet-entity-c')).toBeNull();
  });
});

describe('one render path per width', () => {
  it('from lg, selects the first wallet and shows it inline, with no sheet', () => {
    wide();
    mount();
    expect(byId('wallet-entity-wal-main-checking')!.getAttribute('aria-pressed')).toBe('true');
    expect(byId('wallet-detail-title')!.textContent).toBe('Main Checking');
    expect(screen.queryByRole('dialog')).toBeNull();

    selectWallet('wal-cash');
    expect(byId('wallet-detail-title')!.textContent).toBe('Cash Wallet');
    expect(byId('wallet-entity-wal-main-checking')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('below lg, shows no detail until a wallet is tapped, then exactly one, in a sheet', () => {
    mount();
    expect(byId('wallet-detail-meta')).toBeNull();
    for (const row of document.querySelectorAll('[id^="wallet-entity-"]')) expect(row.getAttribute('aria-pressed')).toBe('false');

    selectWallet('wal-cash');
    const sheet = screen.getByRole('dialog', { name: 'Cash Wallet' });
    expect(within(sheet).getByText(/^Cash · created /)).toBeTruthy();
    expect(document.querySelectorAll('#wallet-detail-meta')).toHaveLength(1);
    // The sheet's title names the wallet, so the detail does not say it again.
    expect(byId('wallet-detail-title')).toBeNull();
  });
});

describe('closing the sheet (audit 008 finding 1)', () => {
  it('gives focus back to the wallet row that opened it', () => {
    mount();
    const row = byId('wallet-entity-wal-cash')!;
    row.focus();
    fireEvent.click(row);
    expect(screen.getByRole('dialog', { name: 'Cash Wallet' })).toBeTruthy();
    // A keyboard user moves into the sheet before closing it.
    byId('wallet-edit-btn')!.focus();
    expect(document.activeElement).toBe(byId('wallet-edit-btn'));

    // The sheet stays in the DOM through its exit animation; focus moves at once.
    fireEvent.click(byId('wallet-detail-close-btn')!);
    expect(document.activeElement).toBe(byId('wallet-entity-wal-cash'));
  });
});

describe('the Dashboard hand-off', () => {
  it('selects the named wallet and consumes it once', () => {
    wide();
    const consume = vi.fn();
    mount({ props: { initialSelectedWalletId: 'wal-cash', onConsumeInitialSelectedWallet: consume } });
    expect(byId('wallet-detail-title')!.textContent).toBe('Cash Wallet');
    expect(consume).toHaveBeenCalledTimes(1);
  });
});

describe('the detail header', () => {
  it('reads "type · created <date>" in the local calendar day, and its menu holds Archive and Delete', () => {
    wide();
    mount();
    expect(byId('wallet-detail-meta')!.textContent).toMatch(/^Bank Account · created [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    expect(byId('archive-wallet-wal-main-checking')).toBeNull();

    openMenu();
    expect(byId('archive-wallet-wal-main-checking')!.textContent).toBe('Archive wallet');
    expect(byId('delete-wallet-wal-main-checking')!.textContent).toBe('Delete wallet…');
  });
});

describe('delete', () => {
  it("says what happens to the wallet's transactions and balance, then falls back to the first wallet", async () => {
    wide();
    mount({
      rows: [
        tx({ type: 'EXPENSE', amount: 10, categoryId: 'cat-food' }),
        tx({ type: 'TRANSFER', amount: 5, walletId: 'wal-main-checking', destinationWalletId: 'wal-cash' }),
        tx({ type: 'EXPENSE', amount: 99, categoryId: 'cat-food', isDeleted: true }),
      ],
    });
    selectWallet('wal-cash');
    openMenu();
    fireEvent.click(byId('delete-wallet-wal-cash')!);

    const dialog = screen.getByRole('dialog', { name: 'Delete wallet' });
    expect(dialog.textContent).toContain('Its 2 transactions stay in your history and still count toward spending and income.');
    expect(dialog.textContent).toContain(`Its ${formatCurrencyAmount(150)} balance leaves your wallet total and net worth.`);

    fireEvent.click(byId('confirm-destructive-btn')!);
    await waitFor(() => expect(byId('wallet-entity-wal-cash')).toBeNull());
    expect(byId('wallet-detail-title')!.textContent).toBe('Main Checking');
  });
});

describe('archive and unarchive', () => {
  it('moves a wallet out of the list and the total into "Archived", and back', async () => {
    wide();
    mount();
    selectWallet('wal-cash');
    openMenu();
    fireEvent.click(byId('archive-wallet-wal-cash')!);
    expect(screen.getByRole('dialog', { name: 'Archive wallet' }).textContent).toContain('You can unarchive it from the Archived list.');
    fireEvent.click(byId('confirm-destructive-btn')!);

    await waitFor(() => expect(byId('wallet-entity-wal-cash')).toBeNull());
    expect(screen.getByText(`${formatCurrencyAmount(7500)} across 2 wallets`)).toBeTruthy();
    const toggle = byId('wallet-archived-toggle')!;
    expect(toggle.textContent).toContain('Archived (1)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    fireEvent.click(byId('wallet-unarchive-btn-wal-cash')!);
    await waitFor(() => expect(byId('wallet-entity-wal-cash')).toBeTruthy());
    expect(screen.getByText(`${formatCurrencyAmount(7650)} across 3 wallets`)).toBeTruthy();
    expect(byId('wallet-archived-toggle')).toBeNull();
  });
});

describe('edit', () => {
  it('renames the wallet and closes the form', async () => {
    wide();
    mount();
    selectWallet('wal-cash');
    fireEvent.click(byId('wallet-edit-btn')!);
    fireEvent.change(byId('wallet-edit-name')!, { target: { value: 'Pocket money' } });
    fireEvent.click(byId('wallet-edit-save-btn')!);

    await waitFor(() => expect(byId('wallet-edit-form')).toBeNull());
    expect(byId('wallet-detail-title')!.textContent).toBe('Pocket money');
    expect(byId('wallet-entity-wal-cash')!.textContent).toContain('Pocket money');
    // The balance did not move.
    expect(byId('wallet-detail-balance')!.textContent).toBe(formatCurrencyAmount(150));
  });

  it('keeps a credit card in debt from becoming another type, and keeps the form open with the reason', async () => {
    wide();
    mount({ wallets: [walletRow({ id: 'visa', name: 'Visa', type: 'CREDIT_CARD', balance: -500 })] });
    fireEvent.click(byId('wallet-edit-btn')!);
    fireEvent.change(byId('wallet-edit-type')!, { target: { value: 'CASH' } });
    fireEvent.click(byId('wallet-edit-save-btn')!);

    await waitFor(() => expect(byId('wallet-edit-error')!.textContent).toContain('A wallet with a negative balance can only be a credit card'));
    expect(byId('wallet-edit-form')).toBeTruthy();
    expect(byId('wallet-detail-meta')!.textContent).toMatch(/^Credit Card · /);
  });
});

describe('the colour choice (audit 008 finding 2)', () => {
  const IDENTITY = ['#D9A066', '#6C8EEF', '#4FB7A8', '#F59E6B', '#E879A6', '#7DA2F0', '#B69CF5', '#5CC8B8', '#C7B38A', '#8FA8C8', '#D98FD0', '#9C8CD9'];

  it("offers exactly spec section 1's twelve identity colours, and saves the one picked", async () => {
    wide();
    mount();
    selectWallet('wal-cash');
    fireEvent.click(byId('wallet-edit-btn')!);
    const swatches = [...byId('wallet-edit-form')!.querySelectorAll('button[aria-label^="Colour "]')];
    expect(swatches.map((s) => s.getAttribute('aria-label')!.replace('Colour ', ''))).toEqual(IDENTITY);

    fireEvent.click(swatches[4]);
    expect(swatches[4].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(byId('wallet-edit-save-btn')!);
    await waitFor(() => expect(byId('wallet-edit-form')).toBeNull());
    // The selected row's tile now carries the new colour.
    const tile = byId('wallet-entity-wal-cash')!.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(tile.style.color).toBe('rgb(232, 121, 166)');
  });
});

describe("the wallet's own activity", () => {
  it('signs a transfer by its direction, folds a cancelling adjustment pair, and hands rows off', () => {
    wide();
    const openTx = vi.fn();
    const viewAll = vi.fn();
    const transfer = tx({ type: 'TRANSFER', amount: 50, walletId: 'wal-cash', destinationWalletId: 'wal-main-checking', description: 'To checking' });
    const up = tx({ type: 'ADJUSTMENT', amount: 20, categoryId: 'cat-adjust' });
    const down = tx({ type: 'ADJUSTMENT', amount: -20, categoryId: 'cat-adjust' });
    mount({ rows: [transfer, up, down], props: { onOpenTransaction: openTx, onOpenWalletTransactions: viewAll } });

    selectWallet('wal-cash');
    expect(byId(`wallet-tx-${transfer.id}`)!.textContent).toContain(`${MINUS}${formatCurrencyAmount(50)}`);
    expect(byId(`wallet-adjustment-pair-wal-cash-${TODAY}`)).toBeTruthy();
    expect(byId(`wallet-tx-${up.id}`)).toBeNull();

    fireEvent.click(byId(`wallet-tx-${transfer.id}`)!);
    expect(openTx).toHaveBeenCalledWith(transfer.id);

    selectWallet('wal-main-checking');
    expect(byId(`wallet-tx-${transfer.id}`)!.textContent).toContain(`+${formatCurrencyAmount(50)}`);
    expect(byId(`wallet-adjustment-pair-wal-cash-${TODAY}`)).toBeNull();

    fireEvent.click(byId('wallet-view-all-tx-btn')!);
    expect(viewAll).toHaveBeenCalledWith('wal-main-checking');
  });
});

describe('Adjust balance', () => {
  it('writes the signed difference as an adjustment, which lowers the balance', async () => {
    wide();
    mount();
    selectWallet('wal-cash');
    fireEvent.click(byId('wallet-adjust-btn-wal-cash')!);
    fireEvent.change(byId('wallet-adjust-input')!, { target: { value: '100' } });
    fireEvent.click(byId('wallet-adjust-save-btn')!);

    await waitFor(() => expect(byId('wallet-detail-balance')!.textContent).toBe(formatCurrencyAmount(100)));
    expect(byId('wallet-adjust-input')).toBeNull();
    const row = [...document.querySelectorAll('[id^="wallet-tx-"]')].find((b) => b.textContent?.includes('Manual balance adjustment'));
    expect(row!.textContent).toContain(`${MINUS}${formatCurrencyAmount(50)}`);
  });
});
