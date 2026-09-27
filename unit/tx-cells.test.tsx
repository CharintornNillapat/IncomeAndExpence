// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TxAmount } from '../src/components/transaction/TxCells';
import { txTypeMetaFor, TX_TYPE_META } from '../src/components/transaction/txTypeMeta';
import { MINUS } from '../src/utils/currency';

/**
 * ADR 0024: an ADJUSTMENT's amount is signed, so its glyph comes from the
 * amount, not the type - `TX_TYPE_META.ADJUSTMENT` alone rendered every upward
 * correction as a debit. And the sign must never reach `formatCurrencyAmount`,
 * which renders `฿-1,000.00`.
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

  it('leaves every other type exactly as it was', () => {
    expect(text(<TxAmount amount={50} type="EXPENSE" />)).toBe(`${MINUS}฿50.00`);
    expect(text(<TxAmount amount={50} type="INCOME" />)).toBe('+฿50.00');
    expect(text(<TxAmount amount={50} type="TRANSFER" />)).toBe(`${MINUS}฿50.00`);
  });
});

describe('txTypeMetaFor', () => {
  it('gives an upward adjustment the credit treatment and a downward one the debit treatment', () => {
    expect(txTypeMetaFor('ADJUSTMENT', 250).sign).toBe('+');
    expect(txTypeMetaFor('ADJUSTMENT', 250).tint).toBe(TX_TYPE_META.INCOME.tint);
    expect(txTypeMetaFor('ADJUSTMENT', -250).sign).toBe(MINUS);
    expect(txTypeMetaFor('ADJUSTMENT', -250).label).toBe('Adjustment');
  });

  it('is the plain table for every other type, whatever the amount', () => {
    expect(txTypeMetaFor('EXPENSE', 50)).toBe(TX_TYPE_META.EXPENSE);
    expect(txTypeMetaFor('INCOME', 50)).toBe(TX_TYPE_META.INCOME);
  });
});
