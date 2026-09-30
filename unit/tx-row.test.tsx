// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { TransactionRow } from '../src/components/transaction/TransactionRow';
import { DayGroupHeader } from '../src/components/transaction/DayGroupHeader';
import { formatDayLabel } from '../src/utils/date';
import { buildLookupMap } from '../src/utils/mapUtils';
import { MINUS } from '../src/utils/currency';
import type { Category, Transaction, Wallet } from '../src/types';

/**
 * Phase 56 (ADR 0029, spec 4.9 and 4.10): the shared transaction row and the
 * day header above a group of them. Both are built now and adopted by the
 * page redesign, so what is pinned here is what the pages will rely on: the
 * row names itself through the L6/L7/L10/L13 selectors (no "No category", no
 * "General", no raw enum), signs a transfer only inside one wallet, and the
 * day header carries the L11 net in the spec's colours.
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

const CATEGORIES = buildLookupMap<Category>([
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false },
  { id: 'adj', name: 'General', type: 'ADJUSTMENT', icon: 'x', color: '#6B7385', isSystem: true, isDeleted: false },
]);

const WALLETS = buildLookupMap<Wallet>([
  { id: 'main', userId: 'u', name: 'Main', type: 'BANK_ACCOUNT', currency: 'THB', balance: 0, color: '#6C8EEF', icon: 'x', isArchived: false, isDeleted: false, createdAt: '', updatedAt: '' },
  { id: 'cash', userId: 'u', name: 'Cash', type: 'CASH', currency: 'THB', balance: 0, color: '#D9A066', icon: 'x', isArchived: false, isDeleted: false, createdAt: '', updatedAt: '' },
]);

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type'>): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    userId: 'u',
    walletId: 'cash',
    amount: 100,
    description: 'Lunch',
    transactionDate: '2026-09-28',
    isDeleted: false,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const rowText = (t: Transaction, walletId?: string) =>
  render(
    <TransactionRow tx={t} category={t.categoryId ? CATEGORIES.get(t.categoryId) : undefined} wallets={WALLETS} walletId={walletId} />,
  ).container.textContent ?? '';

describe('TransactionRow', () => {
  it('shows a transfer as "Transfer", From → To, unsigned, and with no category chip (L7)', () => {
    const transfer = tx({ type: 'TRANSFER', walletId: 'main', destinationWalletId: 'cash', amount: 500, description: 'Move' });
    const text = rowText(transfer);
    expect(text).toContain('Transfer');
    expect(text).toContain('Main → Cash');
    expect(text).toContain('฿500.00');
    expect(text).not.toContain(`+฿500.00`);
    expect(text).not.toContain(`${MINUS}฿500.00`);
    expect(text).not.toContain('No category');
    expect(text).not.toContain('Uncategorized');
  });

  // Phase 58a (ADR 0031): the Transactions page groups rows under a day
  // header, but each row still carries its own ISO date for assistive
  // technology and for `presets.spec.ts`, which filters rows by it.
  it('carries its date as hidden text when asked to', () => {
    const { container } = render(
      <TransactionRow tx={tx({ type: 'EXPENSE', transactionDate: '2026-09-18' })} category={undefined} wallets={WALLETS} dateText="2026-09-18" />,
    );
    const date = [...container.querySelectorAll('.sr-only')].find((el) => el.textContent?.includes('2026-09-18'));
    expect(date).toBeTruthy();
    expect(container.textContent).toContain('2026-09-18');
  });

  it('prints no date unless asked to', () => {
    expect(rowText(tx({ type: 'EXPENSE', transactionDate: '2026-09-18' }))).not.toContain('2026-09-18');
  });

  it('signs a transfer by direction inside one wallet', () => {
    const transfer = tx({ type: 'TRANSFER', walletId: 'main', destinationWalletId: 'cash', amount: 500 });
    expect(rowText(transfer, 'cash')).toContain('+฿500.00');
    cleanup();
    expect(rowText(transfer, 'main')).toContain(`${MINUS}฿500.00`);
  });

  it('titles a row with no description after its category (L6)', () => {
    const text = rowText(tx({ type: 'EXPENSE', categoryId: 'cat-food', description: '' }));
    expect(text).toContain('Food & Dining');
    expect(text).toContain('No description · Cash');
    expect(text).toContain(`${MINUS}฿100.00`);
  });

  it('reads an adjustment as "Balance adjustment", never its stored "General" (L13)', () => {
    const text = rowText(tx({ type: 'ADJUSTMENT', categoryId: 'adj', amount: -40, description: 'Opening balance' }));
    expect(text).toContain('Balance adjustment');
    expect(text).not.toContain('General');
    expect(text).not.toContain('ADJUSTMENT');
    expect(text).toContain(`${MINUS}฿40.00`);
  });

  it('reads a repayment as "Debt repayment", never the raw enum (L10)', () => {
    const text = rowText(tx({ type: 'DEBT_REPAYMENT', amount: 300, description: 'Card' }));
    expect(text).toContain('Debt repayment');
    expect(text).not.toContain('DEBT_REPAYMENT');
  });

  it('puts the colour on the chip dot only', () => {
    const { container } = render(
      <TransactionRow tx={tx({ type: 'EXPENSE', categoryId: 'cat-food' })} category={CATEGORIES.get('cat-food')} wallets={WALLETS} />,
    );
    const dot = container.querySelector('[aria-hidden="true"][style]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('rgb(232, 121, 166)');
  });

  it('is a real button that reports its row when it can be selected, and marks the selected one', () => {
    const onSelect = vi.fn();
    const t = tx({ type: 'EXPENSE' });
    render(<TransactionRow tx={t} category={undefined} wallets={WALLETS} onSelect={onSelect} selected id="row-1" />);
    const row = document.getElementById('row-1')!;
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('type')).toBe('button');
    expect(row.getAttribute('aria-current')).toBe('true');
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith(t);
  });

  it('is not a button when nothing can select it, and renders the meta slot', () => {
    render(<TransactionRow tx={tx({ type: 'INCOME' })} category={undefined} wallets={WALLETS} meta={<span>2026-09-18</span>} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('2026-09-18')).toBeTruthy();
  });

  it('marks a deleted row', () => {
    expect(rowText(tx({ type: 'EXPENSE', isDeleted: true }))).toContain('[Soft Deleted]');
  });
});

describe('formatDayLabel', () => {
  it('names today and yesterday before the date', () => {
    expect(formatDayLabel('2026-09-28', '2026-09-28')).toBe('Today · Mon, Sep 28');
    expect(formatDayLabel('2026-09-27', '2026-09-28')).toBe('Yesterday · Sun, Sep 27');
  });

  it('shows any other day in this year as weekday, month and day', () => {
    expect(formatDayLabel('2026-09-20', '2026-09-28')).toBe('Sun, Sep 20');
  });

  it('adds the year for a day in another year', () => {
    expect(formatDayLabel('2025-12-31', '2026-09-28')).toBe('Wed, Dec 31, 2025');
  });

  it('steps across a month boundary for "Yesterday"', () => {
    expect(formatDayLabel('2026-09-30', '2026-10-01')).toBe('Yesterday · Wed, Sep 30');
  });
});

describe('DayGroupHeader', () => {
  it('shows a negative net in the expense colour with one minus sign', () => {
    render(<DayGroupHeader date="2026-09-27" today="2026-09-28" net={-150.25} />);
    const net = screen.getByText(`${MINUS}฿150.25`);
    expect(net.className).toContain('text-expense');
    expect(screen.getByText('Yesterday · Sun, Sep 27')).toBeTruthy();
  });

  it('shows a positive net signed, in the primary text colour, not income green (spec section 3)', () => {
    render(<DayGroupHeader date="2026-09-20" today="2026-09-28" net={1200} />);
    const net = screen.getByText('+฿1,200.00');
    expect(net.className).toContain('text-fg');
    expect(net.className).not.toContain('text-income');
  });

  it('shows a zero net unsigned', () => {
    render(<DayGroupHeader date="2026-09-20" today="2026-09-28" net={0} />);
    expect(screen.getByText('฿0.00')).toBeTruthy();
  });
});
