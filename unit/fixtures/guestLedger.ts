import type { Debt, Wallet } from '../../src/types';

/**
 * Sample guest ledger rows for the unit suites (ADR 0040).
 *
 * Until Phase 54 the provider's own guest defaults were the fixture: three
 * wallets holding ฿7,650 and a Student Loan with ฿4,500 left. The app now
 * opens its starters at ฿0.00 with no debt, so a suite that needs money or a
 * debt writes these rows to localStorage before it mounts `FinanceProvider`.
 * They are the old defaults, with the same ids, order and colours, so the
 * suites' numeric assertions keep their meaning.
 *
 * This file is not a test: `vitest.config.ts` collects `unit/**\/*.test.*`
 * only, and it lives under `unit/` so Playwright never sees it (ADR 0021).
 */

const STAMP = '2026-09-01T00:00:00.000Z';

export const SAMPLE_WALLETS: Wallet[] = [
  {
    id: 'wal-main-checking',
    userId: 'usr-guest-01',
    name: 'Main Checking',
    type: 'BANK_ACCOUNT',
    currency: 'THB',
    balance: 2500,
    color: '#6C8EEF',
    icon: 'landmark',
    isArchived: false,
    isDeleted: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: 'wal-cash',
    userId: 'usr-guest-01',
    name: 'Cash Wallet',
    type: 'CASH',
    currency: 'THB',
    balance: 150,
    color: '#D9A066',
    icon: 'banknote',
    isArchived: false,
    isDeleted: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: 'wal-savings',
    userId: 'usr-guest-01',
    name: 'Savings Reserve',
    type: 'SAVINGS',
    currency: 'THB',
    balance: 5000,
    color: '#4FB7A8',
    icon: 'piggy-bank',
    isArchived: false,
    isDeleted: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
];

export const SAMPLE_STUDENT_LOAN: Debt = {
  id: 'debt-starter-01',
  userId: 'usr-guest-01',
  name: 'Student Loan',
  totalAmount: 10000,
  remainingAmount: 4500,
  interestRate: 4.5,
  minimumPayment: 250,
  dueDate: '2026-12-31',
  isSettled: false,
  isDeleted: false,
  createdAt: STAMP,
  updatedAt: STAMP,
};

/**
 * Writes the given slices to the keys `FinanceProvider` hydrates from. Call it
 * after clearing localStorage and before rendering the provider. A slice left
 * out keeps the provider's own default (three ฿0.00 wallets, no debt).
 */
export function seedGuestLedger({ wallets, debts }: { wallets?: Wallet[]; debts?: Debt[] }): void {
  if (wallets) localStorage.setItem('pf_wallets', JSON.stringify(wallets));
  if (debts) localStorage.setItem('pf_debts', JSON.stringify(debts));
}
