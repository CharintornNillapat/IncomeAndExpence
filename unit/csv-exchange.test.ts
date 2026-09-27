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

/**
 * F8 (ADR 0024): a CSV repayment names its debt. Without a Debt column an
 * imported DEBT_REPAYMENT debited the wallet, linked nothing, never moved the
 * debt, and skipped ADR 0016's guard.
 */
import { transactionsToCsv } from '../src/utils/csvExchange';
import type { Debt, Transaction, Category } from '../src/types';

const DEBTS = [
  { id: 'd-loan', name: 'Student Loan', isDeleted: false, remainingAmount: 4500 },
  { id: 'd-car', name: 'Car', isDeleted: false, remainingAmount: 900 },
  { id: 'd-old', name: 'Closed Loan', isDeleted: true, remainingAmount: 0 },
  { id: 'd-dup-1', name: 'Family', isDeleted: false, remainingAmount: 100 },
  { id: 'd-dup-2', name: 'family', isDeleted: false, remainingAmount: 200 },
] as unknown as Debt[];

const debtCsv = (...lines: string[]) => ['Date,Wallet,Type,Amount,Description,Debt', ...lines].join('\n');

describe('parseAndValidateTransactionCsv - debts (F8)', () => {
  it('resolves a repayment\'s Debt column to the debt, case-insensitively', async () => {
    const preview = await parseAndValidateTransactionCsv(
      debtCsv('2026-09-28,Cash,DEBT_REPAYMENT,500,Loan payment,student loan'),
      WALLETS,
      DEBTS
    );
    expect(preview.rows[0]).toMatchObject({ isValid: true, debtId: 'd-loan', debtName: 'student loan' });
  });

  it('marks a repayment with no debt invalid, and says why', async () => {
    const preview = await parseAndValidateTransactionCsv(debtCsv('2026-09-28,Cash,DEBT_REPAYMENT,500,Loan payment,'), WALLETS, DEBTS);
    expect(preview.rows[0].isValid).toBe(false);
    expect(preview.rows[0].errorMessage).toContain('Debt column');
  });

  it('marks an unknown or deleted debt invalid', async () => {
    const preview = await parseAndValidateTransactionCsv(
      debtCsv('2026-09-28,Cash,DEBT_REPAYMENT,5,a,Mortgage', '2026-09-28,Cash,DEBT_REPAYMENT,5,b,Closed Loan'),
      WALLETS,
      DEBTS
    );
    expect(preview.rows.map((r) => r.isValid)).toEqual([false, false]);
    expect(preview.rows[0].errorMessage).toContain("Debt 'Mortgage' not found");
  });

  it('refuses to guess between two debts with the same name', async () => {
    const preview = await parseAndValidateTransactionCsv(debtCsv('2026-09-28,Cash,DEBT_REPAYMENT,5,x,Family'), WALLETS, DEBTS);
    expect(preview.rows[0].isValid).toBe(false);
    expect(preview.rows[0].errorMessage).toContain('ambiguous');
  });

  it('ignores a Debt column on any other type', async () => {
    const preview = await parseAndValidateTransactionCsv(debtCsv('2026-09-28,Cash,EXPENSE,5,x,Car'), WALLETS, DEBTS);
    expect(preview.rows[0]).toMatchObject({ isValid: true });
    expect(preview.rows[0].debtId).toBeUndefined();
  });
});

describe('transactionsToCsv - the Debt column (F8)', () => {
  it('writes the debt name on a repayment, and nothing on other rows', () => {
    const txs = [
      { id: 't1', walletId: 'w-cash', type: 'DEBT_REPAYMENT', debtId: 'd-loan', amount: 500, description: 'Loan', transactionDate: '2026-09-28', isDeleted: false },
      { id: 't2', walletId: 'w-cash', type: 'EXPENSE', amount: 50, description: 'Lunch', transactionDate: '2026-09-28', isDeleted: false },
    ] as unknown as Transaction[];
    const out = transactionsToCsv(txs, WALLETS, [] as Category[], DEBTS).split(/\r?\n/);
    expect(out[0]).toContain('Debt');
    const header = out[0].split(',');
    const debtIndex = header.indexOf('Debt');
    expect(out[1].split(',')[debtIndex]).toBe('Student Loan');
    expect(out[2].split(',')[debtIndex]).toBe('');
  });

  it('round-trips: an exported repayment re-imports with its debt', async () => {
    const txs = [
      { id: 't1', walletId: 'w-cash', type: 'DEBT_REPAYMENT', debtId: 'd-car', amount: 300, description: 'Car payment', transactionDate: '2026-09-28', isDeleted: false },
    ] as unknown as Transaction[];
    const preview = await parseAndValidateTransactionCsv(transactionsToCsv(txs, WALLETS, [] as Category[], DEBTS), WALLETS, DEBTS);
    expect(preview.rows[0]).toMatchObject({ isValid: true, type: 'DEBT_REPAYMENT', debtId: 'd-car', amount: 300 });
  });
});
