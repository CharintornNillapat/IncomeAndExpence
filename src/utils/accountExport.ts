import { z } from 'zod';
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

/**
 * Reading a backup back (Phase 99, ADR 0075). The file is untrusted input, so
 * it is accepted only in exactly the shape `buildAccountExport` writes:
 * strict objects (an unknown field is refused, not dropped), enums, calendar
 * days, ISO timestamps, ADR 0024's sign rule, counts that match, ids unique
 * per slice, and every reference resolving inside the file (soft-deleted rows
 * count). The first few problems are named by path, e.g. `transactions[3].walletId`.
 */
export const MAX_BACKUP_CHARS = 20_000_000;

const id = z.string().min(1).max(100);
const text = z.string().max(10_000);
const timestamp = z.iso.datetime();
const day = z.iso.date();
const money = z.number().finite().refine((n) => Math.abs(n) <= 999_999_999.99, 'Amount too large');
const TX_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_REPAYMENT'] as const;

const WalletRow = z.strictObject({
  id, userId: id, name: text, type: z.enum(['CASH', 'BANK_ACCOUNT', 'CREDIT_CARD', 'E_WALLET', 'INVESTMENT', 'SAVINGS']),
  currency: z.literal(APP_CURRENCY), balance: money, color: text, icon: text, isArchived: z.boolean(),
  isDeleted: z.boolean(), createdAt: timestamp, updatedAt: timestamp,
});
const TransactionRow = z.strictObject({
  id, userId: id, walletId: id, destinationWalletId: id.optional(), categoryId: id.optional(), debtId: id.optional(),
  amount: money, type: z.enum(TX_TYPES), description: text, rawInput: text.optional(), transactionDate: day,
  idempotencyKey: text.optional(), isDeleted: z.boolean(), createdBy: text, createdAt: timestamp, updatedAt: timestamp,
});
const DebtRow = z.strictObject({
  id, userId: id, name: text, totalAmount: money, remainingAmount: money, interestRate: z.number().finite().optional(),
  minimumPayment: money.optional(), dueDate: day.optional(), isSettled: z.boolean(), isDeleted: z.boolean(),
  createdAt: timestamp, updatedAt: timestamp,
});
const CategoryRow = z.strictObject({
  id, userId: id.nullable().optional(), name: text, type: z.enum(TX_TYPES), icon: text, color: text,
  description: text.optional(), isSystem: z.boolean(), isDeleted: z.boolean(),
});
const KeywordRuleRow = z.strictObject({
  id, userId: id.nullable().optional(), keyword: text, categoryId: id, createdAt: timestamp,
});
const DiaryEntryRow = z.strictObject({
  id, userId: id, date: day, mood: z.number().int().min(1).max(5), workout: z.boolean(), workoutNote: text.optional(),
  foodQuality: z.enum(['HEALTHY', 'AVERAGE', 'JUNK']), notes: text.optional(), isDeleted: z.boolean(),
  createdAt: timestamp, updatedAt: timestamp,
});
const count = z.number().int().min(0);

const BackupSchema = z
  .strictObject({
    format: z.literal('finlife-tracker-export'),
    version: z.literal(1),
    exportedAt: timestamp,
    source: z.enum(['account', 'this-device']),
    currency: z.literal(APP_CURRENCY),
    counts: z.strictObject({ wallets: count, transactions: count, debts: count, categories: count, keywordRules: count, diaryEntries: count }),
    wallets: z.array(WalletRow),
    transactions: z.array(TransactionRow),
    debts: z.array(DebtRow),
    categories: z.array(CategoryRow),
    keywordRules: z.array(KeywordRuleRow),
    diaryEntries: z.array(DiaryEntryRow),
  })
  .superRefine((file, ctx) => {
    const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids: Record<string, Set<string>> = {};
    for (const slice of ['wallets', 'transactions', 'debts', 'categories', 'keywordRules', 'diaryEntries'] as const) {
      const rows = file[slice];
      if (file.counts[slice] !== rows.length) fail(['counts', slice], `says ${file.counts[slice]}, the file holds ${rows.length}`);
      const seen = new Set<string>();
      rows.forEach((row, i) => {
        if (seen.has(row.id)) fail([slice, i, 'id'], 'the same id appears twice');
        seen.add(row.id);
      });
      ids[slice] = seen;
    }
    file.transactions.forEach((t, i) => {
      if (t.type === 'ADJUSTMENT' ? t.amount === 0 : t.amount <= 0) {
        fail(['transactions', i, 'amount'], t.type === 'ADJUSTMENT' ? 'an adjustment cannot be zero' : 'must be more than zero');
      }
      if (!ids.wallets.has(t.walletId)) fail(['transactions', i, 'walletId'], 'no wallet in the file has this id');
      if (t.destinationWalletId && !ids.wallets.has(t.destinationWalletId)) fail(['transactions', i, 'destinationWalletId'], 'no wallet in the file has this id');
      if (t.categoryId && !ids.categories.has(t.categoryId)) fail(['transactions', i, 'categoryId'], 'no category in the file has this id');
      if (t.debtId && !ids.debts.has(t.debtId)) fail(['transactions', i, 'debtId'], 'no debt in the file has this id');
    });
    file.keywordRules.forEach((r, i) => {
      if (!ids.categories.has(r.categoryId)) fail(['keywordRules', i, 'categoryId'], 'no category in the file has this id');
    });
  });

const pathText = (path: PropertyKey[]) =>
  path.reduce<string>((out, part) => (typeof part === 'number' ? `${out}[${part}]` : out ? `${out}.${String(part)}` : String(part)), '');

export type ParsedBackup = { ok: true; backup: AccountExport } | { ok: false; error: string };

/** Never throws: anything but a valid version-1 backup is `{ ok: false }` with a reason a person can act on. */
export function parseAccountBackup(fileText: string): ParsedBackup {
  if (fileText.length > MAX_BACKUP_CHARS) return { ok: false, error: 'The file is too large to be a backup from this app.' };
  let raw: unknown;
  try {
    raw = JSON.parse(fileText);
  } catch {
    return { ok: false, error: 'This is not a JSON file.' };
  }
  const result = BackupSchema.safeParse(raw);
  if (result.success) return { ok: true, backup: result.data as AccountExport };
  const shown = result.error.issues.slice(0, 3).map((i) => `${pathText(i.path) || 'file'}: ${i.message}`);
  const more = result.error.issues.length - shown.length;
  return { ok: false, error: shown.join('; ') + (more > 0 ? `; and ${more} more` : '') };
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
