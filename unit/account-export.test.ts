import { describe, expect, it } from 'vitest';
import { buildAccountExport, parseAccountBackup, MAX_BACKUP_CHARS, type AccountData } from '../src/utils/accountExport';
import type { Category, DiaryEntry, Debt, KeywordRule, Transaction, Wallet } from '../src/types';

/*
 * The whole-account export (Phase 97, ADR 0073): every row the app holds,
 * soft-deleted ones included, each field the type declares and nothing else,
 * timestamps as `toISOString()`, calendar days untouched.
 */

const USER = '00000000-0000-0000-0000-000000000097';
// Supabase sends microseconds and an offset; a guest row has `toISOString()`.
const PG_TS = '2026-10-06T03:57:41.123456+00:00';
const PG_TS_ISO = '2026-10-06T03:57:41.123Z';

const wallets: Wallet[] = [
  { id: 'w-2', userId: USER, name: 'Cash', type: 'CASH', currency: 'THB', balance: -12.5, color: '#123456', icon: 'wallet', isArchived: true, isDeleted: false, createdAt: PG_TS, updatedAt: PG_TS },
  { id: 'w-1', userId: USER, name: 'Old bank', type: 'BANK_ACCOUNT', currency: 'THB', balance: 0, color: '#654321', icon: 'bank', isArchived: false, isDeleted: true, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' },
];
const transactions: Transaction[] = [
  { id: 't-1', userId: USER, walletId: 'w-2', destinationWalletId: 'w-1', categoryId: 'c-1', debtId: 'd-1', amount: 60, type: 'EXPENSE', description: 'ข้าวมันไก่ 60', rawInput: '30+30', transactionDate: '2026-10-06', idempotencyKey: 'k-1', isDeleted: false, createdBy: USER, createdAt: PG_TS, updatedAt: PG_TS },
  { id: 't-0', userId: USER, walletId: 'w-1', amount: -5, type: 'ADJUSTMENT', description: 'deleted fix', transactionDate: '2026-01-01', isDeleted: true, createdBy: USER, createdAt: PG_TS, updatedAt: PG_TS },
];
const debts: Debt[] = [
  { id: 'd-1', userId: USER, name: 'Loan', totalAmount: 1000, remainingAmount: 400, interestRate: 3.5, minimumPayment: 100, dueDate: '2027-01-31', isSettled: false, isDeleted: false, createdAt: PG_TS, updatedAt: PG_TS },
];
const categories: Category[] = [
  { id: 'c-1', userId: USER, name: 'Food', type: 'EXPENSE', icon: 'utensils', color: '#aaaaaa', description: '', isSystem: false, isDeleted: false },
  { id: 'c-0', userId: USER, name: 'Gone', type: 'INCOME', icon: 'tag', color: '#bbbbbb', isSystem: false, isDeleted: true },
];
const keywordRules: KeywordRule[] = [{ id: 'r-1', userId: USER, keyword: 'ข้าว', categoryId: 'c-1', createdAt: PG_TS }];
const diaryEntries: DiaryEntry[] = [
  { id: 'e-1', userId: USER, date: '2026-10-05', mood: 4, workout: true, workoutNote: 'run', foodQuality: 'HEALTHY', notes: 'ok', isDeleted: false, createdAt: PG_TS, updatedAt: PG_TS },
];

const data: AccountData = { wallets, transactions, debts, categories, keywordRules, diaryEntries };
const AT = new Date('2026-10-06T05:00:00.000Z');

/** What a row should look like in the file: the same fields, timestamps normalised. */
const expected = <T extends object>(row: T): T => {
  const out = { ...row } as Record<string, unknown>;
  for (const key of ['createdAt', 'updatedAt']) {
    if (out[key] === PG_TS) out[key] = PG_TS_ISO;
  }
  return out as T;
};

describe('the whole-account export (Phase 97, ADR 0073)', () => {
  it('holds every row of every slice, soft-deleted ones included, with every field', () => {
    const file = buildAccountExport(data, { signedIn: true, exportedAt: AT });
    expect(file.counts).toEqual({ wallets: 2, transactions: 2, debts: 1, categories: 2, keywordRules: 1, diaryEntries: 1 });
    expect(file.wallets).toEqual(expect.arrayContaining(wallets.map(expected)));
    expect(file.transactions).toEqual(expect.arrayContaining(transactions.map(expected)));
    expect(file.debts).toEqual(debts.map(expected));
    expect(file.categories).toEqual(expect.arrayContaining(categories.map(expected)));
    expect(file.keywordRules).toEqual(keywordRules.map(expected));
    expect(file.diaryEntries).toEqual(diaryEntries.map(expected));
  });

  it('survives a JSON round trip unchanged', () => {
    const file = buildAccountExport(data, { signedIn: false, exportedAt: AT });
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  it('says what it is, when it was made and where the data came from', () => {
    const cloud = buildAccountExport(data, { signedIn: true, exportedAt: AT });
    expect(cloud).toMatchObject({ format: 'finlife-tracker-export', version: 1, exportedAt: '2026-10-06T05:00:00.000Z', source: 'account', currency: 'THB' });
    expect(buildAccountExport(data, { signedIn: false, exportedAt: AT }).source).toBe('this-device');
  });

  it('writes timestamps as toISOString and never moves a calendar day', () => {
    const file = buildAccountExport(data, { signedIn: true, exportedAt: AT });
    const t1 = file.transactions.find((t) => t.id === 't-1')!;
    expect(t1.createdAt).toBe(PG_TS_ISO);
    expect(t1.transactionDate).toBe('2026-10-06');
    expect(file.debts[0].dueDate).toBe('2027-01-31');
    expect(file.diaryEntries[0].date).toBe('2026-10-05');
    expect(file.keywordRules[0].createdAt).toBe(PG_TS_ISO);
  });

  it('keeps a timestamp it cannot read as it was, rather than failing the export', () => {
    const odd = { ...data, wallets: [{ ...wallets[0], createdAt: 'not a date' }] };
    expect(buildAccountExport(odd, { signedIn: true, exportedAt: AT }).wallets[0].createdAt).toBe('not a date');
  });

  it('gives the same file for the same data in any order', () => {
    const shuffled: AccountData = {
      wallets: [...wallets].reverse(),
      transactions: [...transactions].reverse(),
      debts,
      categories: [...categories].reverse(),
      keywordRules,
      diaryEntries,
    };
    expect(JSON.stringify(buildAccountExport(shuffled, { signedIn: true, exportedAt: AT }))).toBe(
      JSON.stringify(buildAccountExport(data, { signedIn: true, exportedAt: AT }))
    );
  });

  it('writes only the fields a type declares, so nothing else stored on a row leaves the device', () => {
    // A guest ledger is parsed from localStorage, so a row can carry anything.
    const leaky = {
      ...data,
      wallets: [{ ...wallets[0], access_token: 'eyJ.secret', password: 'hunter2' } as Wallet],
      transactions: [{ ...transactions[0], session: { refresh_token: 'r' } } as unknown as Transaction],
    };
    const text = JSON.stringify(buildAccountExport(leaky, { signedIn: false, exportedAt: AT }));
    for (const secret of ['access_token', 'eyJ.secret', 'password', 'hunter2', 'refresh_token', 'session']) {
      expect(text).not.toContain(secret);
    }
  });

  it('leaves an absent optional field out instead of writing null', () => {
    const t0 = buildAccountExport(data, { signedIn: true, exportedAt: AT }).transactions.find((t) => t.id === 't-0')!;
    expect('destinationWalletId' in t0).toBe(false);
    expect('rawInput' in t0).toBe(false);
  });
});

/*
 * Restoring that file (Phase 99, ADR 0075). The file is untrusted input: a
 * backup is read only through `parseAccountBackup`, which accepts exactly
 * what the export writes and refuses anything else with the row it stopped at.
 */
describe('reading a backup back (Phase 99, ADR 0075)', () => {
  const file = () => JSON.parse(JSON.stringify(buildAccountExport(data, { signedIn: true, exportedAt: AT })));
  const text = (value: unknown) => JSON.stringify(value);
  const refused = (value: unknown) => {
    const result = parseAccountBackup(typeof value === 'string' ? value : text(value));
    expect(result.ok).toBe(false);
    return 'error' in result ? result.error : '';
  };

  it('reads back exactly what the export wrote', () => {
    const result = parseAccountBackup(text(file()));
    expect(result.ok).toBe(true);
    if (!('backup' in result)) return;
    expect(result.backup).toEqual(file());
    expect(result.backup.transactions.find((t) => t.id === 't-0')?.isDeleted).toBe(true);
  });

  it('refuses text that is not JSON', () => {
    expect(refused('{"format":')).toMatch(/not a JSON file/);
  });

  it('refuses another file format or a later version', () => {
    expect(refused({ ...file(), format: 'something-else' })).toMatch(/format/);
    expect(refused({ ...file(), version: 2 })).toMatch(/version/);
  });

  it('refuses a field the export never writes, and names where it is', () => {
    const f = file();
    f.wallets[0].password = 'x';
    expect(refused(f)).toMatch(/wallets\[0\]/);
  });

  it('refuses a wrong type, an unknown enum value and a bad calendar day', () => {
    const a = file();
    a.wallets[0].balance = '100';
    expect(refused(a)).toMatch(/wallets\[0\]\.balance/);
    const b = file();
    b.transactions[0].type = 'GIFT';
    expect(refused(b)).toMatch(/transactions\[0\]\.type/);
    const c = file();
    c.diaryEntries[0].date = '2026-13-40';
    expect(refused(c)).toMatch(/diaryEntries\[0\]\.date/);
  });

  it('refuses a negative amount on any type but ADJUSTMENT, and a zero adjustment', () => {
    const a = file();
    a.transactions.find((t: { type: string }) => t.type === 'EXPENSE').amount = -60;
    expect(refused(a)).toMatch(/amount/);
    const b = file();
    b.transactions.find((t: { type: string }) => t.type === 'ADJUSTMENT').amount = 0;
    expect(refused(b)).toMatch(/amount/);
  });

  it('refuses counts that disagree with the rows', () => {
    const f = file();
    f.counts.transactions = 5;
    expect(refused(f)).toMatch(/counts\.transactions/);
  });

  it('refuses a row that points at a wallet, category or debt the file does not hold', () => {
    const a = file();
    a.transactions[0].walletId = 'w-missing';
    expect(refused(a)).toMatch(/transactions\[0\]\.walletId/);
    const b = file();
    b.keywordRules[0].categoryId = 'c-missing';
    expect(refused(b)).toMatch(/keywordRules\[0\]\.categoryId/);
    const c = file();
    c.transactions.find((t: { debtId?: string }) => t.debtId).debtId = 'd-missing';
    expect(refused(c)).toMatch(/debtId/);
  });

  it('refuses two rows with one id', () => {
    const f = file();
    f.wallets[1].id = f.wallets[0].id;
    f.transactions = f.transactions.map((t: { walletId: string; destinationWalletId?: string }) => ({ ...t, walletId: f.wallets[0].id, destinationWalletId: undefined }));
    expect(refused(f)).toMatch(/wallets\[1\]\.id/);
  });

  it('refuses a file over the size limit before parsing it', () => {
    expect(refused(' '.repeat(MAX_BACKUP_CHARS + 1))).toMatch(/too large/);
  });
});
