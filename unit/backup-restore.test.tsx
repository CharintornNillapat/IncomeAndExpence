// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FinanceProvider, useFinanceState } from '../src/context/FinanceContext';
import { AccountModal } from '../src/components/account/AccountModal';
import { buildAccountExport } from '../src/utils/accountExport';
import type { Category, Debt, DiaryEntry, KeywordRule, Preset, Transaction, Wallet } from '../src/types';

/**
 * Restoring a backup (Phase 99, ADR 0075) in guest mode, through the real
 * `AccountModal` over the real `FinanceProvider`. The signed-in refusal is in
 * `authenticated-ledger.test.tsx`; the file checks are in `account-export.test.ts`.
 */
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const ACCOUNT = '00000000-0000-4000-8000-000000000099';
const TS = '2026-10-01T08:00:00.000Z';
const wallets: Wallet[] = [
  { id: 'w-bak-1', userId: ACCOUNT, name: 'Backup bank', type: 'BANK_ACCOUNT', currency: 'THB', balance: 940, color: '#335577', icon: 'bank', isArchived: false, isDeleted: false, createdAt: TS, updatedAt: TS },
  { id: 'w-bak-2', userId: ACCOUNT, name: 'Old cash', type: 'CASH', currency: 'THB', balance: 0, color: '#775533', icon: 'wallet', isArchived: false, isDeleted: true, createdAt: TS, updatedAt: TS },
];
const categories: Category[] = [
  { id: 'c-bak-1', userId: ACCOUNT, name: 'Backup food', type: 'EXPENSE', icon: 'utensils', color: '#aa3355', isSystem: false, isDeleted: false },
];
const debts: Debt[] = [
  { id: 'd-bak-1', userId: ACCOUNT, name: 'Backup loan', totalAmount: 1000, remainingAmount: 600, isSettled: false, isDeleted: false, createdAt: TS, updatedAt: TS },
];
const transactions: Transaction[] = [
  { id: 't-bak-1', userId: ACCOUNT, walletId: 'w-bak-1', categoryId: 'c-bak-1', amount: 60, type: 'EXPENSE', description: 'Backup lunch', transactionDate: '2026-10-01', isDeleted: false, createdBy: 'USER', createdAt: TS, updatedAt: TS },
  { id: 't-bak-2', userId: ACCOUNT, walletId: 'w-bak-1', amount: 5, type: 'EXPENSE', description: 'Backup deleted', transactionDate: '2026-09-30', isDeleted: true, createdBy: 'USER', createdAt: TS, updatedAt: TS },
];
const keywordRules: KeywordRule[] = [{ id: 'r-bak-1', userId: ACCOUNT, keyword: 'lunch', categoryId: 'c-bak-1', createdAt: TS }];
const diaryEntries: DiaryEntry[] = [
  { id: 'e-bak-1', userId: ACCOUNT, date: '2026-10-01', mood: 4, workout: false, foodQuality: 'HEALTHY', isDeleted: false, createdAt: TS, updatedAt: TS },
];
const BACKUP = JSON.stringify(
  buildAccountExport({ wallets, transactions, debts, categories, keywordRules, diaryEntries }, { signedIn: true, exportedAt: new Date(TS) })
);

let latest: ReturnType<typeof useFinanceState> | null = null;
function Probe() {
  latest = useFinanceState();
  return null;
}
const state = () => latest!;

function mount() {
  render(
    <FinanceProvider>
      <AccountModal isOpen onClose={() => {}} onRequestSignIn={() => {}} />
      <Probe />
    </FinanceProvider>
  );
}

const pick = (content: string) => {
  const input = document.getElementById('account-import-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([content], 'finlife-export-2026-10-01.json', { type: 'application/json' })] } });
};
const dialog = async () => {
  await screen.findByText("Replace this browser's data with the backup?");
  const dialogs = screen.getAllByRole('dialog');
  return dialogs[dialogs.length - 1];
};

describe('restoring a backup as a guest (Phase 99, ADR 0075)', () => {
  it('shows what the file holds, changes nothing until confirmed, then replaces every slice', async () => {
    mount();
    const before = state().wallets.map((w) => w.id);
    expect(before).not.toContain('w-bak-1');

    pick(BACKUP);
    const box = await dialog();
    expect(box.textContent).toContain('2 wallets, 2 transactions, 1 debt, 1 category, 1 smart rule and 1 diary entry');
    expect(box.textContent).toContain('This browser holds 0 transactions now');
    expect(state().wallets.map((w) => w.id)).toEqual(before);

    fireEvent.click(within(box).getByRole('button', { name: 'Replace with backup' }));
    expect(await screen.findByText(/Restored the backup/)).toBeTruthy();
    expect(state().wallets.map((w) => w.id).sort()).toEqual(['w-bak-1', 'w-bak-2']);
    expect(state().transactions.map((t) => t.id).sort()).toEqual(['t-bak-1', 't-bak-2']);
    expect(state().transactions.find((t) => t.id === 't-bak-2')?.isDeleted).toBe(true);
    expect(state().debts.map((d) => d.remainingAmount)).toEqual([600]);
    expect(state().categories.map((c) => c.id)).toEqual(['c-bak-1']);
    expect(state().keywordRules.map((r) => r.keyword)).toEqual(['lunch']);
    expect(state().diaryEntries.map((e) => e.id)).toEqual(['e-bak-1']);
    // An account's rows become the guest's on this device.
    expect(new Set(state().transactions.map((t) => t.userId))).toEqual(new Set([state().currentUser.id]));

    // The batched writer stores it, so a reload keeps it.
    await waitFor(() => expect(JSON.parse(localStorage.getItem('pf_transactions') ?? '[]')).toHaveLength(2));
    expect(JSON.parse(localStorage.getItem('pf_wallets') ?? '[]').map((w: Wallet) => w.id).sort()).toEqual(['w-bak-1', 'w-bak-2']);
  });

  it('refuses a file that is not a backup, says where, and opens no dialog', async () => {
    mount();
    const before = state().wallets;
    const bad = JSON.parse(BACKUP);
    bad.transactions[0].walletId = 'w-nowhere';
    pick(JSON.stringify(bad));
    expect(await screen.findByText(/This file cannot be restored: transactions\[0\]\.walletId/)).toBeTruthy();
    expect(screen.queryByText("Replace this browser's data with the backup?")).toBeNull();
    expect(state().wallets).toBe(before);
  });

  it('changes nothing when the dialog is cancelled', async () => {
    mount();
    const before = state().wallets;
    pick(BACKUP);
    fireEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText("Replace this browser's data with the backup?")).toBeNull());
    expect(state().wallets).toBe(before);
  });

  it('keeps a template that still has its wallet and category, and drops one that does not', async () => {
    const keep: Preset = { id: 'p-keep', name: 'Lunch', type: 'EXPENSE', amount: 60, description: 'Lunch', walletId: 'w-bak-1', categoryId: 'c-bak-1', createdAt: TS };
    const gone: Preset = { id: 'p-gone', name: 'Bus', type: 'EXPENSE', amount: 15, description: 'Bus', walletId: 'wal-main-checking', createdAt: TS };
    const bare: Preset = { id: 'p-bare', name: 'Note only', type: 'EXPENSE', amount: 1, description: 'x', createdAt: TS };
    localStorage.setItem('pf_presets', JSON.stringify([keep, gone, bare]));
    mount();
    pick(BACKUP);
    fireEvent.click(within(await dialog()).getByRole('button', { name: 'Replace with backup' }));
    await waitFor(() => expect(state().presets.map((p) => p.id).sort()).toEqual(['p-bare', 'p-keep']));
  });
});
