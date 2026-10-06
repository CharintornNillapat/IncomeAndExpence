import { APP_CURRENCY } from './currency';
import type { Category, DiaryEntry, Debt, KeywordRule, Transaction, Wallet } from '../types';

/**
 * The whole-account export (Phase 97, ADR 0073): every row the app holds for
 * this account or device, soft-deleted ones included, in one JSON file.
 *
 * Each type has a field list below, and a row is written through it, so a
 * field the type does not declare never reaches the file (a guest row is
 * parsed from localStorage and can carry anything). `Required<T>` makes the
 * lists exhaustive: a new field on a type fails `tsc` until it is listed here.
 * `timestamp` fields are rewritten with `toISOString()` (Supabase sends
 * microseconds and `+00:00`); calendar days (`YYYY-MM-DD`) are never parsed.
 */
type FieldKind = 'keep' | 'timestamp';
type Fields<T> = { [K in keyof Required<T>]: FieldKind };

const WALLET: Fields<Wallet> = {
  id: 'keep', userId: 'keep', name: 'keep', type: 'keep', currency: 'keep', balance: 'keep', color: 'keep',
  icon: 'keep', isArchived: 'keep', isDeleted: 'keep', createdAt: 'timestamp', updatedAt: 'timestamp',
};
const TRANSACTION: Fields<Transaction> = {
  id: 'keep', userId: 'keep', walletId: 'keep', destinationWalletId: 'keep', categoryId: 'keep', debtId: 'keep',
  amount: 'keep', type: 'keep', description: 'keep', rawInput: 'keep', transactionDate: 'keep',
  idempotencyKey: 'keep', isDeleted: 'keep', createdBy: 'keep', createdAt: 'timestamp', updatedAt: 'timestamp',
};
const DEBT: Fields<Debt> = {
  id: 'keep', userId: 'keep', name: 'keep', totalAmount: 'keep', remainingAmount: 'keep', interestRate: 'keep',
  minimumPayment: 'keep', dueDate: 'keep', isSettled: 'keep', isDeleted: 'keep', createdAt: 'timestamp',
  updatedAt: 'timestamp',
};
const CATEGORY: Fields<Category> = {
  id: 'keep', userId: 'keep', name: 'keep', type: 'keep', icon: 'keep', color: 'keep', description: 'keep',
  isSystem: 'keep', isDeleted: 'keep',
};
const KEYWORD_RULE: Fields<KeywordRule> = {
  id: 'keep', userId: 'keep', keyword: 'keep', categoryId: 'keep', createdAt: 'timestamp',
};
const DIARY_ENTRY: Fields<DiaryEntry> = {
  id: 'keep', userId: 'keep', date: 'keep', mood: 'keep', workout: 'keep', workoutNote: 'keep',
  foodQuality: 'keep', notes: 'keep', isDeleted: 'keep', createdAt: 'timestamp', updatedAt: 'timestamp',
};

export interface AccountData {
  wallets: Wallet[];
  transactions: Transaction[];
  debts: Debt[];
  categories: Category[];
  keywordRules: KeywordRule[];
  diaryEntries: DiaryEntry[];
}

export interface AccountExport extends AccountData {
  format: 'finlife-tracker-export';
  version: 1;
  exportedAt: string;
  /** `account`: the signed-in account's cloud rows; `this-device`: a guest's browser storage. */
  source: 'account' | 'this-device';
  currency: typeof APP_CURRENCY;
  counts: Record<keyof AccountData, number>;
}

/** A timestamp as `toISOString()`; one that does not parse is kept as it was, never dropped. */
const isoTimestamp = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
};

const writeRows = <T extends { id: string }>(rows: T[], fields: Fields<T>): T[] =>
  [...rows]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, kind] of Object.entries(fields) as [keyof T & string, FieldKind][]) {
        const value = row[key];
        if (value === undefined) continue;
        out[key] = kind === 'timestamp' ? isoTimestamp(value) : value;
      }
      return out as T;
    });

export function buildAccountExport(
  data: AccountData,
  { signedIn, exportedAt }: { signedIn: boolean; exportedAt: Date }
): AccountExport {
  const rows: AccountData = {
    wallets: writeRows(data.wallets, WALLET),
    transactions: writeRows(data.transactions, TRANSACTION),
    debts: writeRows(data.debts, DEBT),
    categories: writeRows(data.categories, CATEGORY),
    keywordRules: writeRows(data.keywordRules, KEYWORD_RULE),
    diaryEntries: writeRows(data.diaryEntries, DIARY_ENTRY),
  };
  return {
    format: 'finlife-tracker-export',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    source: signedIn ? 'account' : 'this-device',
    currency: APP_CURRENCY,
    counts: {
      wallets: rows.wallets.length,
      transactions: rows.transactions.length,
      debts: rows.debts.length,
      categories: rows.categories.length,
      keywordRules: rows.keywordRules.length,
      diaryEntries: rows.diaryEntries.length,
    },
    ...rows,
  };
}

/** Saves `payload` as a pretty-printed JSON download. Throws if the browser cannot make the file. */
export function saveJsonFile(payload: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
