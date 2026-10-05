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

/**
 * Formula injection (ADR 0068): a text cell a spreadsheet would run as a
 * formula is written with a leading apostrophe, and the importer takes exactly
 * that apostrophe off again.
 */
describe('transactionsToCsv - formula injection (ADR 0068)', () => {
  const NAMED_WALLETS = [
    ...WALLETS,
    { id: 'w-calc', name: '=Wallet', isDeleted: false },
    { id: 'w-plus', name: '+Plus', isDeleted: false },
  ] as unknown as Wallet[];
  const CATEGORIES = [{ id: 'c-at', name: '@Category' }] as unknown as Category[];
  const NAMED_DEBTS = [{ id: 'd-minus', name: '-Debt', isDeleted: false, remainingAmount: 900 }] as unknown as Debt[];

  const row = (overrides: Record<string, unknown>) =>
    ({ id: 't', walletId: 'w-cash', type: 'EXPENSE', amount: 50, description: 'Lunch', transactionDate: '2026-09-28', isDeleted: false, ...overrides }) as unknown as Transaction;

  const parse = (text: string) => {
    const lines = text.split(/\r?\n/);
    const header = lines[0].split(',');
    return { header, cells: (i: number) => lines[i].split(',') };
  };

  it('escapes every text column that starts like a formula', () => {
    const txs = [
      row({ walletId: 'w-calc', categoryId: 'c-at', description: '=HYPERLINK(1)', rawInput: '-5+3' }),
      row({ type: 'TRANSFER', walletId: 'w-cash', destinationWalletId: 'w-plus', description: '@SUM(1)' }),
      row({ type: 'DEBT_REPAYMENT', debtId: 'd-minus', description: '+cmd' }),
    ];
    const { header, cells } = parse(transactionsToCsv(txs, NAMED_WALLETS, CATEGORIES, NAMED_DEBTS));
    const col = (line: number, name: string) => cells(line)[header.indexOf(name)];
    expect(col(1, 'Wallet')).toBe("'=Wallet");
    expect(col(1, 'Category')).toBe("'@Category");
    expect(col(1, 'Description')).toBe("'=HYPERLINK(1)");
    expect(col(1, 'Raw Calculation')).toBe("'-5+3");
    expect(col(2, 'Destination Wallet')).toBe("'+Plus");
    expect(col(2, 'Description')).toBe("'@SUM(1)");
    expect(col(3, 'Debt')).toBe("'-Debt");
    expect(col(3, 'Description')).toBe("'+cmd");
  });

  it('escapes a leading tab or carriage return', () => {
    const out = transactionsToCsv([row({ description: '\tTab' }), row({ description: '\rReturn' })], WALLETS, []);
    expect(out).toContain("'\tTab");
    expect(out).toContain("'\rReturn");
  });

  it('leaves the amount alone, so a negative adjustment stays a number', () => {
    const { header, cells } = parse(transactionsToCsv([row({ type: 'ADJUSTMENT', amount: -50 })], WALLETS, []));
    expect(cells(1)[header.indexOf('Amount')]).toBe('-50.00');
  });

  it('leaves ordinary text alone, a formula character later in it included', () => {
    const { header, cells } = parse(transactionsToCsv([row({ description: 'Lunch = 60 - 5' })], WALLETS, []));
    expect(cells(1)[header.indexOf('Description')]).toBe('Lunch = 60 - 5');
  });

  it('round-trips every text column back to what was stored', async () => {
    const txs = [
      row({ walletId: 'w-calc', description: '=HYPERLINK(1)' }),
      row({ type: 'TRANSFER', walletId: 'w-plus', destinationWalletId: 'w-calc', description: "'=already quoted" }),
      row({ type: 'DEBT_REPAYMENT', debtId: 'd-minus', description: "''@two quotes" }),
      row({ type: 'ADJUSTMENT', amount: -50, description: "'plain apostrophe" }),
    ];
    const preview = await parseAndValidateTransactionCsv(transactionsToCsv(txs, NAMED_WALLETS, CATEGORIES, NAMED_DEBTS), NAMED_WALLETS, NAMED_DEBTS);
    expect(preview.rows.map((r) => r.isValid)).toEqual([true, true, true, true]);
    expect(preview.rows.map((r) => r.description)).toEqual(['=HYPERLINK(1)', "'=already quoted", "''@two quotes", "'plain apostrophe"]);
    expect(preview.rows[0].walletName).toBe('=Wallet');
    expect(preview.rows[1]).toMatchObject({ walletName: '+Plus', destinationWalletName: '=Wallet' });
    expect(preview.rows[2]).toMatchObject({ debtId: 'd-minus', debtName: '-Debt' });
    expect(preview.rows[3].amount).toBe(-50);
  });

  it('round-trips a category name', async () => {
    const preview = await parseAndValidateTransactionCsv(
      transactionsToCsv([row({ categoryId: 'c-at' })], WALLETS, CATEGORIES),
      WALLETS
    );
    expect(preview.rows[0].categoryName).toBe('@Category');
  });
});
