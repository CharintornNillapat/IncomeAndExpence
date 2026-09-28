// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TxAmount } from '../src/components/transaction/TxCells';
import { txTypeMetaFor, transferDirection, TX_TYPE_META } from '../src/components/transaction/txTypeMeta';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { Money } from '../src/components/ui/Money';

/**
 * ADR 0024: an ADJUSTMENT's amount is signed, so its glyph comes from the
 * amount, not the type - `TX_TYPE_META.ADJUSTMENT` alone rendered every upward
 * correction as a debit. And the sign is printed exactly once.
 *
 * ADR 0027 (Phase 55a, spec sections 3 and 4.8): a transfer is unsigned except
 * inside one wallet's own view, and an adjustment or a repayment is grey.
 */
afterEach(() => cleanup());

const text = (el: React.ReactElement) => render(el).container.textContent;

describe('TxAmount', () => {
  it('shows a downward adjustment as one minus sign and the absolute amount', () => {
    expect(text(<TxAmount amount={-1000} type="ADJUSTMENT" />)).toBe(`${MINUS}฿1,000.00`);
  });

  it('shows an upward adjustment with a plus sign', () => {
    expect(text(<TxAmount amount={250} type="ADJUSTMENT" />)).toBe('+฿250.00');
  });

  it('signs income and expense, and leaves a transfer unsigned', () => {
    expect(text(<TxAmount amount={50} type="EXPENSE" />)).toBe(`${MINUS}฿50.00`);
    expect(text(<TxAmount amount={50} type="INCOME" />)).toBe('+฿50.00');
    expect(text(<TxAmount amount={50} type="TRANSFER" />)).toBe('฿50.00');
  });

  it('signs a transfer by its direction inside one wallet', () => {
    expect(text(<TxAmount amount={50} type="TRANSFER" direction="OUT" />)).toBe(`${MINUS}฿50.00`);
    expect(text(<TxAmount amount={50} type="TRANSFER" direction="IN" />)).toBe('+฿50.00');
  });
});

describe('TxAmount colour (ADR 0027, spec section 3)', () => {
  const colour = (el: React.ReactElement) => render(el).container.firstElementChild!.className;

  it('colours an adjustment grey in both directions, never income or expense', () => {
    for (const amount of [250, -250]) {
      const c = colour(<TxAmount amount={amount} type="ADJUSTMENT" />);
      expect(c).toContain('text-adjust');
      expect(c).not.toContain('text-income');
      expect(c).not.toContain('text-expense');
    }
  });

  it('gives each other type its own hue', () => {
    expect(colour(<TxAmount amount={50} type="INCOME" />)).toContain('text-income');
    expect(colour(<TxAmount amount={50} type="EXPENSE" />)).toContain('text-expense');
    expect(colour(<TxAmount amount={50} type="TRANSFER" />)).toContain('text-transfer');
    expect(colour(<TxAmount amount={50} type="TRANSFER" direction="OUT" />)).toContain('text-transfer');
    expect(colour(<TxAmount amount={50} type="DEBT_REPAYMENT" />)).toContain('text-adjust');
  });

  it('lets a site override the colour and nothing else', () => {
    const el = <TxAmount amount={50} type="INCOME" colorClassName="text-expense" />;
    expect(colour(el)).toContain('text-expense');
    expect(colour(el)).not.toContain('text-income');
  });
});

describe('txTypeMetaFor', () => {
  it('gives an adjustment its sign from the amount and keeps the grey', () => {
    expect(txTypeMetaFor('ADJUSTMENT', 250).sign).toBe('+');
    expect(txTypeMetaFor('ADJUSTMENT', 250).tint).toBe(TX_TYPE_META.ADJUSTMENT.tint);
    expect(txTypeMetaFor('ADJUSTMENT', -250).sign).toBe(MINUS);
    expect(txTypeMetaFor('ADJUSTMENT', -250).label).toBe('Adjustment');
  });

  it('is the plain table for every other type, whatever the amount', () => {
    expect(txTypeMetaFor('EXPENSE', 50)).toBe(TX_TYPE_META.EXPENSE);
    expect(txTypeMetaFor('INCOME', 50)).toBe(TX_TYPE_META.INCOME);
    expect(txTypeMetaFor('TRANSFER', 50)).toBe(TX_TYPE_META.TRANSFER);
  });

  it('ignores a direction on anything but a transfer', () => {
    expect(txTypeMetaFor('EXPENSE', 50, 'IN')).toBe(TX_TYPE_META.EXPENSE);
  });
});

describe('transferDirection', () => {
  const tx = { type: 'TRANSFER' as const, walletId: 'main', destinationWalletId: 'cash' };

  it('is OUT for the source wallet, IN for the destination, and undefined otherwise', () => {
    expect(transferDirection(tx, 'main')).toBe('OUT');
    expect(transferDirection(tx, 'cash')).toBe('IN');
    expect(transferDirection(tx, 'savings')).toBeUndefined();
  });

  it('is undefined for a transaction that is not a transfer', () => {
    expect(transferDirection({ ...tx, type: 'EXPENSE' }, 'main')).toBeUndefined();
  });
});

describe('negative amounts (spec section 4.8)', () => {
  it('formatCurrencyAmount puts U+2212 before the symbol', () => {
    expect(formatCurrencyAmount(-1000)).toBe(`${MINUS}฿1,000.00`);
    expect(formatCurrencyAmount(1234.5)).toBe('฿1,234.50');
    expect(formatCurrencyAmount(0)).toBe('฿0.00');
  });

  it('Money prints the sign once', () => {
    expect(text(<Money value={-1000} />)).toBe(`${MINUS}฿1,000.00`);
  });
});
