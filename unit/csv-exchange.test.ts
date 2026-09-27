import { describe, it, expect } from 'vitest';
import { parseAndValidateTransactionCsv } from '../src/utils/csvExchange';
import type { Wallet } from '../src/types';

/**
 * The CSV importer's dry-run validation (ADR 0019), which no Playwright spec
 * can reach row by row. ADR 0024 adds a signed ADJUSTMENT.
 */
const WALLETS = [
  { id: 'w-cash', name: 'Cash', isDeleted: false },
  { id: 'w-card', name: 'Card', isDeleted: false },
] as unknown as Wallet[];

const csv = (...lines: string[]) => ['Date,Wallet,Type,Amount,Description', ...lines].join('\n');

describe('parseAndValidateTransactionCsv - amounts', () => {
  it('accepts a negative ADJUSTMENT and keeps its sign', async () => {
    const preview = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,ADJUSTMENT,-1000,Correction'), WALLETS);
    expect(preview.rows[0]).toMatchObject({ isValid: true, type: 'ADJUSTMENT', amount: -1000 });
  });

  it('rejects a zero ADJUSTMENT', async () => {
    const preview = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,ADJUSTMENT,0,Nothing'), WALLETS);
    expect(preview.rows[0].isValid).toBe(false);
  });

  it('still rejects a negative amount on every other type', async () => {
    const preview = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,EXPENSE,-50,Refund?'), WALLETS);
    expect(preview.rows[0].isValid).toBe(false);
    expect(preview.rows[0].errorMessage).toContain('positive');
  });
});
