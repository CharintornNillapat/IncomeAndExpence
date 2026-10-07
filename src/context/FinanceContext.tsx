import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import {
  User,
  AuthSession,
  Wallet,
  Category,
  KeywordRule,
  Transaction,
  TransactionEdit,
  WalletEdit,
  DebtEdit,
  Debt,
  DiaryEntry,
  ImportRowValidation,
  TransactionType,
  Preset,
} from '../types';
import type { AccountData } from '../utils/accountExport';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  onDataApiUnauthorized,
  loadSupabase,
  whenSupabaseLoads,
  sessionMayExist,
  isAuthApiError,
  isAuthSessionMissingError,
} from '../lib/supabase';
import {
  TransactionSchema,
  WalletSchema,
  WalletEditSchema,
  DebtSchema,
  DebtEditSchema,
  DiarySchema,
  KeywordMappingSchema,
  CategorySchema,
  PresetSchema,
  formatZodIssues,
} from '../utils/zodSchemas';
import { APP_CURRENCY, formatCurrencyAmount } from '../utils/currency';
import { roundToCents } from '../utils/money';
import { todayIsoDate } from '../utils/date';
import { walletTotal } from '../selectors/wallets';
import { paletteExhausted, usedColors } from '../selectors/categories';
import { IDENTITY_COLORS } from '../utils/identityPalette';
import { isMovementCategory, SYSTEM_CATEGORY_COLOR } from '../selectors/ledger';
import { dedupeCategoriesByName, withDefaultDescriptions } from '../utils/categoryUtils';
import { migrateCategoryColors, migrateWalletColors } from '../utils/identityColorMigration';
import { generateIdempotencyKey } from '../utils/ids';

/**
 * Outcome of a validated write. Every mutating call reports failure this way
 * rather than throwing or failing silently, so views can surface the reason
 * without a try/catch at each call site.
 */
export interface MutationResult {
  success: boolean;
  error?: string;
}

/**
 * The volatile half of the context value: every state member. Before T15, this
 * also held the six mutators whose `useCallback` deps included hot state
 * (`transactions`, `wallets`, `debts`, `categories`, `diaryEntries`); T15
 * ref-mirrored that hot state (see `walletsRef` etc. in `FinanceProvider`) so
 * those callbacks no longer need it in their own deps, and moved them into
 * `FinanceActionsContextType` below. Only plain state values remain here now,
 * so a consumer of this context re-renders on every write that touches a member
 * it reads - there is no longer a stable subset hiding in this half.
 */
export interface FinanceStateContextType {
  // Auth & Security
  currentUser: User;
  isAuthenticated: boolean;
  isSyncing: boolean;
  /**
   * Why the last cloud load failed, or `null` after a clean one (Phase 53b).
   * The navbar badge shows "Sync failed" from it and retries through
   * `refreshFromCloud`. A load that read some tables still applied them.
   */
  syncError: string | null;

  // Wallets
  wallets: Wallet[];
  totalNetWorth: number;

  // Categories & Configurable Keyword Rules
  categories: Category[];
  keywordRules: KeywordRule[];

  // Transaction Templates ("quick presets")
  presets: Preset[];

  // Transactions
  transactions: Transaction[];

  // Debts
  debts: Debt[];

  // Holistic Diary
  diaryEntries: DiaryEntry[];

  // Filters
  showSoftDeleted: boolean;
}

/**
 * The stable half: callbacks whose deps are only `[]`, `[isAuthenticated]`,
 * `[currentUser.id]`, or another already-stable callback, so their identities
 * hold for an entire session, plus the `useState` setter `setShowSoftDeleted`.
 * A component reading only from here does not re-render because of a ledger
 * write.
 *
 * `addTransaction`, `softDeleteTransaction`, `restoreTransaction`,
 * `commitBulkImport`, and `upsertDiaryEntry` joined this half
 * in T15: each now reads the hot state it needs through a ref mirror
 * (`walletsRef`/`transactionsRef`/`debtsRef`/`categoriesRef`/`diaryEntriesRef`)
 * instead of closing over the state variable directly, so their `useCallback`
 * deps no longer include it.
 */
export interface FinanceActionsContextType {
  // Auth & Security
  /** The signed-in user's real sessions (ADR 0024); `sessions: null` when the list is unavailable. */
  listMySessions: () => Promise<{ sessions: AuthSession[] | null; error?: string }>;
  /** Revokes every session but this one (`signOut({ scope: 'others' })`). */
  signOutOtherDevices: () => Promise<MutationResult>;
  /** Signs this device out (or every device with `everywhere`) and clears it of the account's data (F5, ADR 0024). */
  signOut: (options?: { everywhere?: boolean }) => Promise<void>;
  /**
   * Erases the signed-in account and everything in it (`delete_user_account`,
   * ADR 0072), then signs this device out and clears it. `confirmation` is the
   * phrase the person typed; the server refuses anything but `DELETE`.
   */
  deleteAccount: (confirmation: string) => Promise<MutationResult>;
  /**
   * Replaces this browser's guest data with a backup (Phase 99, ADR 0075).
   * Guest only: signed in, the cloud is the record and the next load would
   * replace it. `data` comes from `parseAccountBackup`, the Zod check every
   * restore goes through. Templates stay unless they name a wallet or category
   * the backup does not hold.
   */
  restoreBackup: (data: AccountData) => MutationResult;

  // Wallets
  // `balance` is omitted: the opening balance is supplied via `initialBalance`.
  /**
   * `initialBalance` becomes an ADJUSTMENT "Opening balance" row when non-zero
   * (F7, ADR 0024). `idempotencyKey` names one Add Wallet form: signed in, a
   * retry after a lost response returns the same wallet. Omitted, a fresh key
   * is used.
   */
  addWallet: (
    wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted' | 'balance'>,
    initialBalance: number,
    idempotencyKey?: string
  ) => Promise<MutationResult>;
  deleteWallet: (id: string) => Promise<MutationResult>;
  /** A wallet's name, type and colour (Phase 59, ADR 0034). Never its balance, which moves only through the ledger. */
  editWallet: (id: string, details: WalletEdit) => Promise<MutationResult>;
  /** Archives or unarchives a wallet. An archived wallet leaves net worth and the pickers; its rows stay. */
  setWalletArchived: (id: string, archived: boolean) => Promise<MutationResult>;

  // Categories & Configurable Keyword Rules
  addCategory: (data: { name: string; type: TransactionType; color: string; icon?: string; description?: string }) => Promise<MutationResult>;
  updateCategory: (id: string, updates: { name?: string; color?: string; icon?: string; description?: string }) => Promise<MutationResult>;
  deleteCategory: (id: string) => Promise<MutationResult>;
  addKeywordRule: (keyword: string, categoryId: string) => Promise<MutationResult>;
  deleteKeywordRule: (id: string) => Promise<MutationResult>;

  // Transaction Templates ("quick presets")
  addPreset: (data: {
    name: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    description: string;
    categoryId?: string;
    walletId?: string;
  }) => Promise<MutationResult>;
  updatePreset: (
    id: string,
    updates: Partial<{ name: string; amount: number; description: string; categoryId: string; walletId: string }>
  ) => Promise<MutationResult>;
  deletePreset: (id: string) => Promise<MutationResult>;
  /** Applies a saved template as a brand-new transaction dated today (or `transactionDate`, if given), reusing `addTransaction` rather than duplicating its ledger/wallet-balance logic. */
  applyPreset: (id: string, transactionDate?: string) => Promise<{ success: boolean; error?: string; txId?: string }>;

  // Transactions
  addTransaction: (tx: {
    amount: number;
    rawInput?: string;
    description: string;
    walletId: string;
    destinationWalletId?: string;
    categoryId?: string;
    debtId?: string;
    type: TransactionType;
    transactionDate: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; error?: string; txId?: string }>;
  softDeleteTransaction: (id: string) => Promise<MutationResult>;
  restoreTransaction: (id: string) => Promise<MutationResult>;
  /**
   * Edits a live transaction (ADR 0033): reverses its old effect on the wallets
   * and applies the new one. Signed in, it is one `update_transaction` RPC, with
   * no fallback when the function is missing. A repayment or an adjustment
   * edits only its note and date.
   */
  updateTransaction: (id: string, edit: TransactionEdit) => Promise<MutationResult>;
  /**
   * `importKey` names one import PREVIEW (ADR 0023): a retry of the same
   * preview after a lost response replays instead of importing twice. A new
   * preview must get a new key - reusing one across files would silently turn
   * a second import into a replay of the first. Omitted, a fresh key is used.
   */
  commitBulkImport: (
    validRows: ImportRowValidation[],
    importKey?: string
  ) => Promise<MutationResult & { insertedCount: number; totalAmount: number; skippedCount: number }>;

  // Debts
  addDebt: (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => Promise<MutationResult>;
  /**
   * A debt's name, borrowed total, interest, minimum payment and due date
   * (Phase 60, ADR 0035). Never what is still owed or whether it is settled,
   * which move only through repayments and Mark as paid off.
   */
  editDebt: (debtId: string, details: DebtEdit) => Promise<MutationResult>;
  settleDebt: (debtId: string) => Promise<MutationResult>;
  deleteDebt: (debtId: string) => Promise<MutationResult>;

  // Holistic Diary
  upsertDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<MutationResult>;
  deleteDiaryEntry: (id: string) => Promise<MutationResult>;

  // Filters & State helpers
  setShowSoftDeleted: (show: boolean) => void;
  refreshFromCloud: () => Promise<void>;
}

const FinanceStateContext = createContext<FinanceStateContextType | undefined>(undefined);
const FinanceActionsContext = createContext<FinanceActionsContextType | undefined>(undefined);

// Local Storage Safe Fallback Helper
function safeGetLocalStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch (err) {
    console.warn(`[SafeStorage] Fallback for ${key}`, err);
    return fallback;
  }
}

// Tables mirrored into local state. Every one of them re-runs the full loader on
// any row change, so cross-device sync stays consistent at the cost of a refetch.
const SYNCED_TABLES = ['wallets', 'transactions', 'debts', 'diary_entries', 'categories'] as const;

// Maps a `transactions` row from Supabase (snake_case) to the domain type.
function mapTransactionRow(row: any): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    destinationWalletId: row.destination_wallet_id || undefined,
    categoryId: row.category_id || undefined,
    debtId: row.debt_id || undefined,
    amount: parseFloat(row.amount) || 0,
    type: row.type,
    description: row.description,
    rawInput: row.raw_input || undefined,
    transactionDate: row.transaction_date,
    idempotencyKey: row.idempotency_key || undefined,
    isDeleted: row.is_deleted || false,
    createdBy: row.created_by || row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Maps a `wallets` row from Supabase (snake_case) to the domain type.
function mapWalletRow(row: any): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    currency: APP_CURRENCY,
    balance: parseFloat(row.balance) || 0,
    color: row.color || 'stone',
    icon: row.icon || 'wallet',
    isArchived: row.is_archived || false,
    isDeleted: row.is_deleted || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Maps a `debts` row from Supabase (snake_case) to the domain type.
function mapDebtRow(row: any): Debt {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    totalAmount: parseFloat(row.total_amount) || 0,
    remainingAmount: parseFloat(row.remaining_amount) || 0,
    interestRate: row.interest_rate ? parseFloat(row.interest_rate) : undefined,
    minimumPayment: row.minimum_payment ? parseFloat(row.minimum_payment) : undefined,
    dueDate: row.due_date || undefined,
    isSettled: row.is_settled || false,
    isDeleted: row.is_deleted || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Shape returned by the `transfer_funds` RPC.
interface TransferFundsResult {
  reused: boolean;
  transaction: any;
  source_balance: number | string;
  dest_balance: number | string;
}

// Shape returned by the ADR 0023 ledger RPCs (`record_transaction`,
// `set_transaction_deleted`): the row, plus the balances the database committed
// for every wallet and debt the write touched. A leg the write did not touch is
// null. `reused` / `changed` mark a replay or a no-op.
interface LedgerWriteResult {
  reused?: boolean;
  changed?: boolean;
  transaction: any;
  source_balance: number | string | null;
  dest_balance: number | string | null;
  debt_remaining: number | string | null;
  debt_settled: boolean | null;
}

// Supabase-js reports a request that never got an answer (offline, a dropped
// connection, a timeout) as an error with no SQLSTATE; every error PostgREST or
// Postgres itself returns carries one. After a write RPC, the first kind means
// the outcome is UNKNOWN - the database may well have committed - so the
// caller must re-read rather than trust its rollback snapshot (ADR 0023).
// F5 (ADR 0024): every key that can hold an account's data on this device.
// `resetToGuestState` removes all of them on sign-out.
const LEDGER_STORAGE_KEYS = [
  'pf_wallets',
  'pf_categories',
  'pf_keywords',
  'pf_presets',
  'pf_transactions',
  'pf_debts',
  'pf_diary',
  'pf_user',
  'pf_sessions',
  'pf_device_fingerprint',
] as const;

// Shape returned by `create_wallet` (ADR 0024). `transaction` is the opening
// row, null for a zero opening.
interface CreateWalletResult {
  reused: boolean;
  wallet: any;
  transaction: any | null;
}

// Shape returned by `import_transactions`.
interface ImportTransactionsResult {
  reused: boolean;
  inserted_ids: string[];
  balances: { id: string; balance: number | string }[];
}

// F8 (ADR 0024): an import whose repayments to one debt add up to more than it
// owes. Formatted here, from either this client's debt or the server's
// `DEBT_OVERPAYMENT` detail - money is never formatted in SQL.
function importOverpaymentMessage(debtName: string, remaining: number): string {
  return `These repayments to ${debtName} add up to more than the ${formatCurrencyAmount(remaining)} remaining`;
}

function isUnknownOutcomeError(err: { code?: string } | null): boolean {
  return !!err && !err.code;
}

// ADR 0024 (amended): whether `auth.getUser()` failed because the auth server
// no longer honours this session - revoked by "sign out other devices", the
// user deleted, the refresh token gone - as opposed to not being able to ask:
// offline and 5xx are `AuthRetryableFetchError`, and 429 is excluded, so none
// of them ever signs anyone out.
function isSessionRejectedError(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (!isAuthApiError(error)) return false;
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.code === 'refresh_token_not_found' ||
    error.code === 'refresh_token_already_used'
  );
}

// Focus and visibility often fire together, and focus fires on every switch
// back to the window; a check this recent answers for them.
const SESSION_CHECK_MIN_GAP_MS = 10_000;
// How often a visible, signed-in app re-asks with no wake event at all - a
// phone left open on the desk.
const SESSION_CHECK_INTERVAL_MS = 60_000;

// True only when the RPC itself is absent, i.e. the migration has not been
// applied yet. Deliberately narrow: any other database error must surface and
// trigger a rollback rather than silently falling back to the legacy path.
function isMissingRpcError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42883' || err.code === 'PGRST202') return true;
  return (err.message || '').toLowerCase().includes('could not find the function');
}

/** What `seed_starter_account()` decided for an empty wallet read (ADR 0039). */
type SeedOutcome = 'seeded' | 'not-new' | 'busy' | 'failed';

// Shape returned by `update_transaction` (ADR 0033): the row, and the balance of
// every wallet on either side of the edit.
interface UpdateTransactionResult {
  changed: boolean;
  transaction: any;
  balances: { id: string; balance: number | string }[];
}

// ADR 0033: a repayment's or an adjustment's money is fixed once written; only
// these three types can change type, amount or wallets, and only among
// themselves.
const MONEY_EDITABLE_TYPES: ReadonlySet<TransactionType> = new Set(['INCOME', 'EXPENSE', 'TRANSFER']);

// The wallet movements one live transaction stands for: wallet id to signed
// amount. Term for term `_ledger_apply_effect` with sign +1 - the source moves by
// its type's direction, a transfer's destination receives the amount. An edit's
// net movement is the new row's effects minus the old row's.
function walletEffects(
  tx: Pick<Transaction, 'type' | 'amount' | 'walletId' | 'destinationWalletId'>
): Map<string, number> {
  const effects = new Map<string, number>();
  const sourceSign = tx.type === 'INCOME' || tx.type === 'ADJUSTMENT' ? 1 : -1;
  effects.set(tx.walletId, sourceSign * tx.amount);
  if (tx.type === 'TRANSFER' && tx.destinationWalletId) {
    effects.set(tx.destinationWalletId, (effects.get(tx.destinationWalletId) ?? 0) + tx.amount);
  }
  return effects;
}

function sameMoney(a: Transaction, b: Transaction): boolean {
  return (
    a.type === b.type &&
    a.amount === b.amount &&
    a.walletId === b.walletId &&
    (a.destinationWalletId ?? null) === (b.destinationWalletId ?? null)
  );
}

function sameEdit(a: Transaction, b: Transaction): boolean {
  return (
    sameMoney(a, b) &&
    (a.categoryId ?? null) === (b.categoryId ?? null) &&
    a.description === b.description &&
    a.transactionDate === b.transactionDate &&
    (a.rawInput ?? null) === (b.rawInput ?? null)
  );
}

// ADR 0033's rules, in `update_transaction`'s own words, checked before any
// optimistic write so a refused edit never flickers on screen. The server checks
// them again under its locks.
function editRuleError(tx: Transaction, next: Transaction, wallets: Wallet[]): string | null {
  if (tx.isDeleted) return 'Restore this transaction before editing it';
  if (!MONEY_EDITABLE_TYPES.has(tx.type)) {
    if (!sameMoney(tx, next) || (tx.categoryId ?? null) !== (next.categoryId ?? null)) {
      return 'Only the note and date of a debt repayment or an adjustment can change';
    }
    return null;
  }
  if (!MONEY_EDITABLE_TYPES.has(next.type)) {
    return 'A transaction can only become income, an expense or a transfer';
  }
  if (next.type === 'TRANSFER' && next.categoryId) return 'A transfer has no category';
  if (next.type !== 'TRANSFER' && next.destinationWalletId) return 'Only a transfer has a destination wallet';
  // A wallet the row already uses may since have been deleted; a newly chosen
  // one must be live.
  for (const chosen of [next.walletId, next.destinationWalletId]) {
    if (!chosen || chosen === tx.walletId || chosen === tx.destinationWalletId) continue;
    if (!wallets.some((w) => w.id === chosen && !w.isDeleted)) return 'Wallet not found or has been deleted';
  }
  return null;
}

// Row shape returned by `list_my_sessions` (ADR 0024).
interface SessionRow {
  id: string;
  created_at: string;
  last_active: string | null;
  not_after: string | null;
  user_agent: string | null;
  ip: string | null;
  is_current: boolean;
}

// Initial Default Seed Data
const DEFAULT_USER: User = {
  id: 'usr-guest-01',
  email: 'guest@finlife.local',
  name: 'FinLife User',
  role: 'USER',
  isEmailVerified: false,
  createdAt: new Date().toISOString(),
};

/**
 * Each `description` is the text Jev receives as that option's `criteria`
 * (ADR 0012), not decoration. Phase 39 sent bare names and `Netflix
 * subscription` came back as the `other` escape option at 0.93 confidence -
 * a correct answer to a badly posed question, since no name here reads as a
 * subscription bucket. `cat-housing`'s wording is the direct fix for that.
 *
 * Only the EXPENSE and INCOME rows are ever sent (`toClassifyCandidates`
 * filters the rest), but the last two carry descriptions anyway because the
 * Categories hub shows the field for every category.
 */
const DEFAULT_SYSTEM_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#E879A6', description: 'Eating out, restaurants, street food, cafes, coffee, snacks, bars and food delivery.', isSystem: true, isDeleted: false },
  { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#F59E6B', description: 'Supermarket, market and convenience-store runs for food and household supplies cooked or used at home.', isSystem: true, isDeleted: false },
  { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'car', color: '#5CC8B8', description: 'Petrol, taxis, ride-hailing, trains, buses, parking, tolls and vehicle servicing.', isSystem: true, isDeleted: false },
  { id: 'cat-shopping', name: 'Shopping & Apparel', type: 'EXPENSE', icon: 'shopping-bag', color: '#B69CF5', description: 'Clothes, shoes, electronics, gadgets, homeware, gifts and other one-off personal purchases.', isSystem: true, isDeleted: false },
  { id: 'cat-housing', name: 'Housing & Utilities', type: 'EXPENSE', icon: 'home', color: '#7DA2F0', description: 'Rent, electricity, water, internet and phone bills, insurance, and recurring subscriptions like Netflix or Spotify.', isSystem: true, isDeleted: false },
  { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'briefcase', color: '#8FA8C8', description: 'Regular wages, monthly salary, payroll and bonuses from a main employer.', isSystem: true, isDeleted: false },
  { id: 'cat-freelance', name: 'Freelance & Side Gig', type: 'INCOME', icon: 'laptop', color: '#D98FD0', description: 'Client work, commissions, side-project earnings, tips, refunds and money received outside a regular salary.', isSystem: true, isDeleted: false },
  { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'credit-card', color: SYSTEM_CATEGORY_COLOR, description: 'Payments made against a tracked loan or credit-card balance.', isSystem: true, isDeleted: false },
  { id: 'cat-adjust', name: 'Balance Adjustment', type: 'ADJUSTMENT', icon: 'sliders', color: SYSTEM_CATEGORY_COLOR, description: 'Manual corrections that reconcile a wallet balance to its real-world value.', isSystem: true, isDeleted: false },
];

// Phase 54 (ADR 0040): the starter wallets open at 0, so the app shows no money
// nobody entered and an opening writes no ledger row. The signed-in copy is
// `seed_starter_account()`; change both together (ADR 0039).
const DEFAULT_STARTER_WALLETS: Wallet[] = [
  {
    id: 'wal-main-checking',
    userId: 'usr-guest-01',
    name: 'Main Checking',
    type: 'BANK_ACCOUNT',
    currency: APP_CURRENCY,
    balance: 0,
    color: '#6C8EEF',
    icon: 'landmark',
    isArchived: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wal-cash',
    userId: 'usr-guest-01',
    name: 'Cash Wallet',
    type: 'CASH',
    currency: APP_CURRENCY,
    balance: 0,
    color: '#D9A066',
    icon: 'banknote',
    isArchived: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wal-savings',
    userId: 'usr-guest-01',
    name: 'Savings Reserve',
    type: 'SAVINGS',
    currency: APP_CURRENCY,
    balance: 0,
    color: '#4FB7A8',
    icon: 'piggy-bank',
    isArchived: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_KEYWORD_RULES: KeywordRule[] = [
  { id: 'kw-1', userId: 'usr-guest-01', keyword: 'coffee', categoryId: 'cat-food', createdAt: new Date().toISOString() },
  { id: 'kw-2', userId: 'usr-guest-01', keyword: 'groceries', categoryId: 'cat-groceries', createdAt: new Date().toISOString() },
  { id: 'kw-3', userId: 'usr-guest-01', keyword: 'fuel', categoryId: 'cat-transport', createdAt: new Date().toISOString() },
  { id: 'kw-4', userId: 'usr-guest-01', keyword: 'salary', categoryId: 'cat-salary', createdAt: new Date().toISOString() },
];

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => safeGetLocalStorage('pf_user', DEFAULT_USER));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Spec 5.1's colour migration (ADR 0038) runs on what this device stores;
  // the cloud's rows move by SQL, never by a remap on the Supabase load.
  const [wallets, setWallets] = useState<Wallet[]>(() => migrateWalletColors(safeGetLocalStorage('pf_wallets', DEFAULT_STARTER_WALLETS)));
  const [categories, setCategories] = useState<Category[]>(() =>
    migrateCategoryColors(
      withDefaultDescriptions(
        dedupeCategoriesByName(safeGetLocalStorage('pf_categories', DEFAULT_SYSTEM_CATEGORIES)),
        DEFAULT_SYSTEM_CATEGORIES
      )
    )
  );
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>(() => safeGetLocalStorage('pf_keywords', DEFAULT_KEYWORD_RULES));
  // Local-only, like `sessions`: no `presets` table exists in the Supabase
  // migrations, so these never leave `localStorage` regardless of
  // `isAuthenticated` - unlike `categories`/`keywordRules`, which sync when
  // authenticated. A template is a personal shortcut, not shared ledger data.
  const [presets, setPresets] = useState<Preset[]>(() => safeGetLocalStorage('pf_presets', []));
  const [transactions, setTransactions] = useState<Transaction[]>(() => safeGetLocalStorage('pf_transactions', []));
  const [debts, setDebts] = useState<Debt[]>(() => safeGetLocalStorage<Debt[]>('pf_debts', []));
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => safeGetLocalStorage('pf_diary', []));

  const [showSoftDeleted, setShowSoftDeleted] = useState<boolean>(false);

  // Client-side Idempotency Guard (P0-5)
  const inFlightIdempotencyKeys = useRef<Set<string>>(new Set());

  // T17 (ADR 0003): ids of rows this client just wrote to Supabase. The
  // realtime subscription below checks incoming `postgres_changes` events
  // against this set and drops any event whose row id is present - that event
  // is this client's own write echoing back over the wire, not new
  // information from another device. Every mutator that writes to one of the
  // 5 `SYNCED_TABLES` and learns the affected row's id calls `markLocalWrite`
  // with it. Each id expires on its own timer (`LOCAL_ECHO_SUPPRESS_MS`)
  // rather than only being removed when consumed, so an id that never
  // produces an echo (e.g. the realtime channel was disconnected, or RLS
  // suppressed the broadcast) cannot linger for the rest of the session.
  const recentLocalWriteIds = useRef<Set<string>>(new Set());
  const LOCAL_ECHO_SUPPRESS_MS = 5000;
  const markLocalWrite = useCallback((id?: string | null) => {
    if (!id) return;
    recentLocalWriteIds.current.add(id);
    setTimeout(() => {
      recentLocalWriteIds.current.delete(id);
    }, LOCAL_ECHO_SUPPRESS_MS);
  }, []);

  // ADR 0023: after a ledger RPC succeeds, its balances are what the database
  // committed - relative to whatever the row held, which may include another
  // device's write this client has not seen. They replace the optimistic
  // values, which were computed from this client's own (possibly stale) copy.
  // A null leg was not touched and is left alone.
  const adoptLedgerState = useCallback((
    result: LedgerWriteResult,
    ids: { walletId?: string | null; destWalletId?: string | null; debtId?: string | null }
  ) => {
    const sourceBalance = result.source_balance === null ? NaN : Number(result.source_balance);
    const destBalance = result.dest_balance === null ? NaN : Number(result.dest_balance);
    setWallets((prev) =>
      prev.map((w) => {
        if (ids.walletId && w.id === ids.walletId && Number.isFinite(sourceBalance)) {
          return { ...w, balance: sourceBalance };
        }
        if (ids.destWalletId && w.id === ids.destWalletId && Number.isFinite(destBalance)) {
          return { ...w, balance: destBalance };
        }
        return w;
      })
    );

    const debtRemaining = result.debt_remaining === null ? NaN : Number(result.debt_remaining);
    if (ids.debtId && Number.isFinite(debtRemaining)) {
      const updatedAt = new Date().toISOString();
      setDebts((prev) =>
        prev.map((d) =>
          d.id === ids.debtId
            ? { ...d, remainingAmount: debtRemaining, isSettled: result.debt_settled === true, updatedAt }
            : d
        )
      );
    }
  }, []);

  // T15: latest-value mirrors of the hot state the volatile mutators read by
  // closure. Each ref is updated in its own `useEffect` (never inside a `setState`
  // updater - StrictMode double-invokes those, which would desync the mirror from
  // committed state). A mutator that reads `xRef.current` instead of `x` no longer
  // needs `x` in its own `useCallback` deps, so its identity stops churning on
  // every write and it can move from `FinanceStateContextType` to
  // `FinanceActionsContextType`. The `useEffect` runs after commit, before the
  // next paint, so by the time a user event can invoke a mutator the mirror is
  // already current; nothing here reads a ref during the render that wrote it.
  const walletsRef = useRef<Wallet[]>(wallets);
  const transactionsRef = useRef<Transaction[]>(transactions);
  const debtsRef = useRef<Debt[]>(debts);
  const categoriesRef = useRef<Category[]>(categories);
  const diaryEntriesRef = useRef<DiaryEntry[]>(diaryEntries);
  const keywordRulesRef = useRef<KeywordRule[]>(keywordRules);
  const presetsRef = useRef<Preset[]>(presets);

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  useEffect(() => {
    debtsRef.current = debts;
  }, [debts]);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  useEffect(() => {
    diaryEntriesRef.current = diaryEntries;
  }, [diaryEntries]);
  useEffect(() => {
    keywordRulesRef.current = keywordRules;
  }, [keywordRules]);
  useEffect(() => {
    presetsRef.current = presets;
  }, [presets]);

  // T16 (ADR 0003): batched localStorage writer. Each state-slice effect below
  // marks its key dirty in `pendingWritesRef` instead of writing immediately;
  // one debounced timer flushes every dirty key together, collapsing what used
  // to be up to 8 independent synchronous `JSON.stringify` calls per render
  // cycle into a single batch. `flushPendingWrites` is also invoked
  // synchronously from `pagehide`/`visibilitychange` below so a debounce window
  // in flight when a PWA tab is backgrounded is never lost.
  const STORAGE_WRITE_DEBOUNCE_MS = 250;
  const pendingWritesRef = useRef<Map<string, unknown>>(new Map());
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skips the write effects on their initial mount pass, when every slice's
  // value is exactly what `safeGetLocalStorage` just read from storage - so the
  // batched writer never re-serializes hydration data straight back over
  // itself. Set `true` by the effect declared immediately after the write
  // effects below, which - because React runs a commit's passive effects in
  // declaration order - is guaranteed to fire after all of them on mount.
  const didMountRef = useRef(false);

  const flushPendingWrites = useCallback(() => {
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    pendingWritesRef.current.forEach((value, key) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn(`[SafeStorage] Failed to persist ${key}`, err);
      }
    });
    pendingWritesRef.current.clear();
  }, []);

  const scheduleStorageWrite = useCallback((key: string, value: unknown) => {
    pendingWritesRef.current.set(key, value);
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(flushPendingWrites, STORAGE_WRITE_DEBOUNCE_MS);
  }, [flushPendingWrites]);

  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_wallets', wallets);
  }, [wallets, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_categories', categories);
  }, [categories, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_keywords', keywordRules);
  }, [keywordRules, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_presets', presets);
  }, [presets, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_transactions', transactions);
  }, [transactions, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_debts', debts);
  }, [debts, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_diary', diaryEntries);
  }, [diaryEntries, scheduleStorageWrite]);
  useEffect(() => {
    if (didMountRef.current) scheduleStorageWrite('pf_user', currentUser);
  }, [currentUser, scheduleStorageWrite]);
  useEffect(() => {
    didMountRef.current = true;
    // ADR 0024 retired the browser-built session list. Its two keys held a
    // fabricated device record and a random fingerprint; nothing reads them
    // any more, so an existing install sheds them once, here.
    for (const retiredKey of ['pf_sessions', 'pf_device_fingerprint']) {
      try {
        localStorage.removeItem(retiredKey);
      } catch {
        // Storage unavailable: there is nothing to shed either.
      }
    }
  }, []);

  // Mandatory flush points: a PWA gets backgrounded aggressively on mobile, and
  // `visibilitychange`->hidden fires before `pagehide` and on more platforms
  // (notably iOS Safari, which does not reliably fire `pagehide` on swipe-away),
  // so both are wired to the same synchronous flush rather than relying on one.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingWrites();
    };
    const handlePageHide = () => flushPendingWrites();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingWrites();
    };
  }, [flushPendingWrites]);

  // The sum of every active wallet (spec L3's first term, ADR 0028). Named
  // "net worth" before debts entered the picture; the debt-inclusive figure is
  // `netWorth(wallets, debts)` in `src/selectors/wallets.ts`.
  const totalNetWorth = useMemo(() => walletTotal(wallets), [wallets]);

  // `loadSupabaseData` and `seedInitialUserAccount` call each other. Routing the
  // back-edge through a ref breaks the dependency cycle so both can be memoised
  // with empty/stable deps instead of being rebuilt on every render.
  const loadSupabaseDataRef = useRef<((userId: string) => Promise<void>) | null>(null);

  // Phase 30: guards against concurrent seed attempts. The auth-state effect
  // below both awaits `getSession()` directly and subscribes to
  // `onAuthStateChange`, which fires its own initial event for the same
  // session - and in dev, StrictMode double-invokes the whole effect on
  // mount. Any combination of those can call `loadSupabaseData` more than
  // once for the same brand-new (wallets-empty) account before the first
  // seed's insert lands, and each concurrent call would independently see
  // "empty" and insert its own full set of starter wallets/categories - the
  // root cause of "each default category appearing 2-3 times" in every
  // category picker. This ref stops one tab calling `seed_starter_account()`
  // twice at once; the function's own per-account lock covers every other
  // caller (ADR 0039).
  const isSeedingRef = useRef(false);

  // T69: bumped once per successful `loadSupabaseData` commit. `addTransaction`
  // snapshots this alongside its rollback state; if a realtime reload lands
  // mid-flight (another device wrote while this one's write was in-flight),
  // the snapshot is server truth that is now stale, and restoring it on
  // failure would silently discard what the other device just committed. A
  // plain ref-identity check on `walletsRef` cannot tell this apart from the
  // ordinary case, because `addTransaction` writes its own optimistic update
  // to that same ref before awaiting - the ref always differs from the
  // snapshot by the time any catch block runs, for either reason. Only a
  // counter tied specifically to `loadSupabaseData` commits can distinguish
  // "no concurrent reload happened" from "one did."
  const cloudRevisionRef = useRef(0);

  // ADR 0023: when the last CLEAN load finished (`Date.now()`), set beside the
  // `cloudRevisionRef` bump. The wake trigger reloads only once this is older
  // than `CLOUD_STALE_AFTER_MS`, so a phone unlocked twice a minute does not
  // re-read the whole account each time. A failed load leaves it old, so the
  // next wake retries.
  const lastCloudLoadAtRef = useRef(0);

  // F5 (ADR 0024): bumped by every reset to guest state. A cloud load that was
  // in flight when the user signed out checks it after each read and stops,
  // instead of landing the account's rows in the guest's state afterwards.
  const authEpochRef = useRef(0);

  // F5 (ADR 0024): what signing out leaves on this device - nothing of the
  // account. Runs on an explicit sign-out AND on a `SIGNED_OUT` auth event (a
  // device signed out by another's "sign out other devices"):
  //   1. drop the batched writer's queue, which holds the account's ledger.
  //      Defence in depth, not the main guard: step 3's writes overwrite the
  //      same keys before the 250 ms flush (a control that removed this step
  //      failed no test). It closes the window before those effects run, e.g.
  //      a `pagehide` flush landing in between;
  //   2. remove every ledger key, templates included (they never sync, so this
  //      deletes them for good - the sign-out confirmation says so);
  //   3. reset every slice to what a brand-new device shows, which schedules
  //      fresh writes of those guest defaults over the same keys.
  // `authEpochRef` stops a cloud load that was in flight from landing after.
  const resetToGuestState = useCallback(() => {
    authEpochRef.current += 1;

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    pendingWritesRef.current.clear();

    for (const key of LEDGER_STORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage can be unavailable (private mode); the in-memory reset below
        // still holds.
      }
    }

    setIsAuthenticated(false);
    setSyncError(null);
    setCurrentUser(DEFAULT_USER);
    setWallets(DEFAULT_STARTER_WALLETS);
    setCategories(withDefaultDescriptions(dedupeCategoriesByName(DEFAULT_SYSTEM_CATEGORIES), DEFAULT_SYSTEM_CATEGORIES));
    setKeywordRules(DEFAULT_KEYWORD_RULES);
    setPresets([]);
    setTransactions([]);
    setDebts([]);
    setDiaryEntries([]);

    recentLocalWriteIds.current.clear();
    inFlightIdempotencyKeys.current.clear();
    lastCloudLoadAtRef.current = 0;
  }, []);

  // ADR 0039: the server decides whether an account is new. An empty wallet
  // read is not evidence: row-level security answers a read made without a
  // valid session with zero rows and no error, and seeding on that alone
  // seeded one account five extra times. `seed_starter_account()` refuses a
  // call with no session, seeds only an account that has never had a wallet or
  // category row (deleted ones included), and serialises concurrent calls. A
  // missing function seeds nothing: there is no client-side fallback.
  //   'seeded'   - it seeded, and the reload it ran has the new rows;
  //   'not-new'  - the account was seeded before; carry on loading;
  //   'busy'     - a seed is already running in this tab, which will reload;
  //   'failed'   - no answer worth trusting; keep what is on screen.
  const seedInitialUserAccount = useCallback(async (userId: string): Promise<SeedOutcome> => {
    if (isSeedingRef.current) return 'busy';
    isSeedingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('seed_starter_account');
      if (error) {
        console.error(
          isMissingRpcError(error)
            ? '[Seed] seed_starter_account is missing; the database needs the Phase 64 migration'
            : '[Seed Error]',
          error
        );
        return 'failed';
      }
      if ((data as { seeded?: boolean } | null)?.seeded !== true) return 'not-new';
      await loadSupabaseDataRef.current?.(userId);
      return 'seeded';
    } catch (err) {
      console.error('[Seed Error]', err);
      return 'failed';
    } finally {
      isSeedingRef.current = false;
    }
  }, []);

  // Fetch all user data from Supabase
  const loadSupabaseData = useCallback(async (userId: string) => {
    setIsSyncing(true);
    // Tables whose read failed. A slice that did load still applies; a failed
    // one keeps its current local value rather than being blanked.
    const failedReads: string[] = [];
    // F5: a sign-out during this load makes every later slice stale.
    const epoch = authEpochRef.current;
    const signedOutMeanwhile = () => authEpochRef.current !== epoch;
    try {
      // 1. Wallets
      const { data: wData, error: wErr } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });
      if (signedOutMeanwhile()) return;

      if (wErr) failedReads.push('wallets');
      if (!wErr && wData) {
        const mappedWallets: Wallet[] = wData.map(mapWalletRow);

        // An empty read may be a new account or a read without a session; only
        // the server can tell (ADR 0039). Nothing is applied until it has.
        if (mappedWallets.length === 0) {
          const outcome = await seedInitialUserAccount(userId);
          if (outcome === 'seeded' || outcome === 'busy' || signedOutMeanwhile()) return;
          if (outcome === 'failed') {
            setSyncError('Could not read wallets');
            return;
          }
        }
        setWallets(mappedWallets);
      }

      // 2. Categories
      const { data: cData, error: cErr } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (signedOutMeanwhile()) return;

      if (cErr) failedReads.push('categories');
      if (!cErr && cData && cData.length > 0) {
        const mappedCategories: Category[] = cData.map((row) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          type: row.type,
          icon: row.icon || 'tag',
          color: row.color || 'stone',
          // NULL (column never written) must map to `undefined`, not `''` -
          // that is what makes the row eligible for the shipped default.
          description: row.description ?? undefined,
          isSystem: row.is_system || false,
          isDeleted: row.is_deleted || false,
        }));
        setCategories(
          withDefaultDescriptions(dedupeCategoriesByName(mappedCategories), DEFAULT_SYSTEM_CATEGORIES)
        );
      }

      // 3. Keyword Rules
      const { data: krData, error: krErr } = await supabase
        .from('keyword_rules')
        .select('*');
      if (signedOutMeanwhile()) return;

      if (krErr) failedReads.push('keyword_rules');
      if (!krErr && krData) {
        setKeywordRules(
          krData.map((row) => ({
            id: row.id,
            userId: row.user_id,
            keyword: row.keyword,
            categoryId: row.category_id,
            createdAt: row.created_at,
          }))
        );
      }

      // 4. Debts
      const { data: dData, error: dErr } = await supabase
        .from('debts')
        .select('*')
        .order('created_at', { ascending: false });
      if (signedOutMeanwhile()) return;

      if (dErr) failedReads.push('debts');
      if (!dErr && dData) {
        setDebts(dData.map(mapDebtRow));
      }

      // 5. Transactions
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (signedOutMeanwhile()) return;

      if (txErr) failedReads.push('transactions');
      if (!txErr && txData) {
        setTransactions(txData.map(mapTransactionRow));
      }

      // 6. Diary Entries
      const { data: diaryData, error: diaryErr } = await supabase
        .from('diary_entries')
        .select('*')
        .order('date', { ascending: false });
      if (signedOutMeanwhile()) return;

      if (diaryErr) failedReads.push('diary_entries');
      if (!diaryErr && diaryData) {
        setDiaryEntries(
          diaryData.map((row) => ({
            id: row.id,
            userId: row.user_id,
            date: row.date,
            mood: row.mood,
            workout: row.workout || false,
            workoutNote: row.workout_note || undefined,
            foodQuality: row.food_quality,
            notes: row.notes || undefined,
            isDeleted: row.is_deleted || false,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }))
        );
      }

      // Only a clean load counts as a reload (ADR 0022). A load that read
      // nothing is not new server truth, and bumping for it disarmed T69's
      // rollback in any write in flight: that write would re-fetch instead of
      // restoring, the re-fetch would fail the same way, and its optimistic
      // debit would stay on screen for money that never moved.
      if (failedReads.length === 0) {
        cloudRevisionRef.current += 1;
        lastCloudLoadAtRef.current = Date.now();
        setSyncError(null);
      } else {
        console.error('[Supabase Sync Error] could not read:', failedReads.join(', '));
        setSyncError(`Could not read ${failedReads.join(', ')}`);
      }
    } catch (err) {
      console.error('[Supabase Sync Error]', err);
      // A sign-out during the load already reset this; a guest has nothing to sync.
      if (!signedOutMeanwhile()) setSyncError('Could not reach the server');
    } finally {
      setIsSyncing(false);
    }
  }, [seedInitialUserAccount]);

  // Keep the ref pointing at the current loader for `seedInitialUserAccount`.
  useEffect(() => {
    loadSupabaseDataRef.current = loadSupabaseData;
  }, [loadSupabaseData]);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    // Without credentials there is nothing to talk to: stay unauthenticated so
    // every write takes the local-storage path and no request is attempted.
    if (!isSupabaseConfigured) {
      setIsAuthenticated(false);
      return;
    }

    let authSubscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const setupAuth = async (client: SupabaseClient) => {
      const { data: { session } } = await client.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        setIsAuthenticated(true);
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || 'user@supabase.io',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          role: 'USER',
          isEmailVerified: !!session.user.email_confirmed_at,
          createdAt: session.user.created_at,
        });
        await loadSupabaseData(session.user.id);
      } else {
        setIsAuthenticated(false);
      }

      const { data } = client.auth.onAuthStateChange(async (event, newSession) => {
        // F5 (ADR 0024): signed out - here or remotely - clears this device.
        // Only this event: a guest's INITIAL_SESSION also has no session, and
        // resetting on it would wipe a guest ledger on every page load.
        if (event === 'SIGNED_OUT') {
          resetToGuestState();
          return;
        }
        if (newSession?.user) {
          setIsAuthenticated(true);
          setCurrentUser({
            id: newSession.user.id,
            email: newSession.user.email || 'user@supabase.io',
            name: newSession.user.user_metadata?.name || newSession.user.email?.split('@')[0] || 'User',
            role: 'USER',
            isEmailVerified: !!newSession.user.email_confirmed_at,
            createdAt: newSession.user.created_at,
          });
          await loadSupabaseData(newSession.user.id);
        } else {
          setIsAuthenticated(false);
        }
      });
      authSubscription = data.subscription;
    };

    // Phase 107 (ADR 0083): the client loads at boot only when a session may
    // exist. A guest's load skips it, and this listener starts whenever it
    // does load: the sign-in dialog opening, another tab signing in.
    if (!sessionMayExist()) setIsAuthenticated(false);
    const stopWaiting = whenSupabaseLoads((client) => void setupAuth(client));
    if (sessionMayExist()) {
      loadSupabase().catch((err) => {
        console.error('[Supabase Load Error]', err);
        if (!cancelled) setSyncError('Could not reach the server');
      });
    }

    return () => {
      cancelled = true;
      stopWaiting();
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, [loadSupabaseData, resetToGuestState]);

  // Signs THIS device out, or every device with `everywhere`. supabase-js
  // defaults to the global scope, so the local one is passed explicitly: a
  // plain "Sign out" must not end the user's other sessions (ADR 0024).
  // The device is cleared either way, even if the network call fails - the
  // library drops its own session locally regardless, and a shared device is
  // the case this exists for.
  const signOut = useCallback(async (options?: { everywhere?: boolean }) => {
    // No client means no session was ever resumed or started here (ADR 0083).
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut({ scope: options?.everywhere ? 'global' : 'local' });
      if (error) console.error('[Sign Out Failed]', error);
    }
    resetToGuestState();
  }, [resetToGuestState]);

  // ADR 0024 (amended): asks the auth server whether this session still
  // exists. "Sign out other devices" revokes the other sessions' refresh
  // tokens, but their access tokens are JWTs that PostgREST and Realtime keep
  // accepting until they expire - up to an hour - and supabase-js notices only
  // at its next refresh. `getUser()` is the call that checks the session
  // itself (GoTrue answers `session_not_found`).
  //   - A rejected session signs this device out and clears it. On
  //     `session_not_found` supabase-js has already dropped the session and
  //     emitted SIGNED_OUT, so the reset has run and the epoch says so; any
  //     other rejection (`user_not_found`, a dead refresh token) is signed
  //     out here.
  //   - No answer (offline, 5xx, 429) keeps the session. Wiping a device's
  //     ledger because the network blinked would be worse than a late eviction.
  // One check at a time; `throttle` lets the chatty triggers skip a check
  // made within the last `SESSION_CHECK_MIN_GAP_MS`.
  const sessionCheckRef = useRef<Promise<void> | null>(null);
  const lastSessionCheckAtRef = useRef(0);
  const verifySession = useCallback((options?: { throttle?: boolean }): Promise<void> => {
    if (sessionCheckRef.current) return sessionCheckRef.current;
    if (options?.throttle && Date.now() - lastSessionCheckAtRef.current < SESSION_CHECK_MIN_GAP_MS) {
      return Promise.resolve();
    }
    lastSessionCheckAtRef.current = Date.now();
    const epoch = authEpochRef.current;
    const check = (async () => {
      try {
        const { error } = await supabase.auth.getUser();
        if (!error || authEpochRef.current !== epoch) return;
        if (!isSessionRejectedError(error)) {
          console.warn('[Session Check] no answer from the auth server; keeping the session', error);
          return;
        }
        console.warn('[Session Check] this session was revoked; signing this device out', error);
        await signOut();
      } catch (err) {
        console.warn('[Session Check] failed; keeping the session', err);
      }
    })().finally(() => {
      sessionCheckRef.current = null;
    });
    sessionCheckRef.current = check;
    return check;
  }, [signOut]);

  // Real-time Subscriptions across all tables for Cross-Device Sync (PC <-> Phone)
  //
  // T17 (ADR 0003) hardening of what was previously an unfiltered,
  // undebounced, unsuppressed subscription:
  //   - `filter: user_id=eq.<id>` on every table, so this client's socket only
  //     ever receives change events for rows it owns. All 5 `SYNCED_TABLES`
  //     carry a `user_id` column - confirmed via `mapWalletRow`/
  //     `mapTransactionRow`/`mapDebtRow` above and the inline categories/
  //     diary_entries mappings in `loadSupabaseData` below, every one of which
  //     already reads `row.user_id` - and via `20260909_transfer_funds.sql`'s
  //     own schema comment for `wallets`/`transactions`. This repo has no
  //     tracked schema migration to check directly (see that file's header),
  //     so the client's own read/write columns are the available evidence.
  //   - Self-echo suppression: a change whose row id is in
  //     `recentLocalWriteIds` is this client's own write echoing back, not
  //     new information, so it is consumed (removed from the set) and dropped
  //     instead of triggering a reload.
  //   - One debounced reload shared across every event on the channel, so a
  //     burst (a multi-row CSV import, a transfer's two wallet updates plus
  //     its transaction insert) collapses into a single `loadSupabaseData`
  //     call `REALTIME_RELOAD_DEBOUNCE_MS` after the last event, instead of
  //     one call per row change.
  //   - `loadSupabaseData` is read through `loadSupabaseDataRef` instead of
  //     being closed over directly, dropping it from this effect's deps -
  //     the channel no longer tears down and resubscribes every time that
  //     callback's identity changes.
  //
  // ADR 0023 adds reconnection reconciliation to the same effect, so one
  // debounced reload serves every trigger and none of them runs signed out:
  //   - `online` -> reload. Anything written while this device was offline.
  //   - `visibilitychange` to visible -> reload, but only if the last clean
  //     load is older than `CLOUD_STALE_AFTER_MS`.
  //   - the channel reporting SUBSCRIBED after CHANNEL_ERROR / TIMED_OUT /
  //     CLOSED -> reload. Postgres changes emitted while the socket was down
  //     are not replayed on reconnect; the only way to see them is to read.
  // There is no offline write queue: a write attempted offline still fails and
  // rolls back. These triggers only re-read.
  //
  // The same triggers - plus window `focus`, a once-a-minute tick while
  // visible, the effect's own mount (a PWA reopened after being revoked) and
  // any 401 from the Data API - also run `verifySession`, so a device signed
  // out from another one clears itself within a minute instead of an hour.
  useEffect(() => {
    if (!isAuthenticated || !currentUser.id) return;

    const REALTIME_RELOAD_DEBOUNCE_MS = 400;
    const CLOUD_STALE_AFTER_MS = 30_000;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        loadSupabaseDataRef.current?.(currentUser.id);
      }, REALTIME_RELOAD_DEBOUNCE_MS);
    };

    let channelDropped = false;
    const channel = SYNCED_TABLES.reduce(
      (ch, table) =>
        ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${currentUser.id}` },
          (payload: { new?: { id?: string } | null; old?: { id?: string } | null }) => {
            const rowId = payload.new?.id ?? payload.old?.id;
            if (rowId && recentLocalWriteIds.current.has(rowId)) {
              recentLocalWriteIds.current.delete(rowId);
              return;
            }
            scheduleReload();
          }
        ),
      supabase.channel('schema-db-changes')
    ).subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        // The first SUBSCRIBED follows the initial load; only a return from a
        // drop means events may have been missed.
        if (channelDropped) {
          channelDropped = false;
          scheduleReload();
          void verifySession();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        channelDropped = true;
      }
    });

    const handleOnline = () => {
      scheduleReload();
      void verifySession();
    };
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void verifySession({ throttle: true });
      if (Date.now() - lastCloudLoadAtRef.current >= CLOUD_STALE_AFTER_MS) scheduleReload();
    };
    const handleFocus = () => void verifySession({ throttle: true });
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);
    const sessionTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void verifySession();
    }, SESSION_CHECK_INTERVAL_MS);
    const stopUnauthorized = onDataApiUnauthorized(() => void verifySession());
    void verifySession();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
      clearInterval(sessionTimer);
      stopUnauthorized();
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser.id, verifySession]);

  const refreshFromCloud = useCallback(async () => {
    if (currentUser.id) {
      await loadSupabaseData(currentUser.id);
    }
  }, [currentUser.id, loadSupabaseData]);

  // ADR 0024: the signed-in user's real sessions, from `auth.sessions`.
  // `sessions: null` means the list is unavailable - signed out, or a project
  // without the Phase 52 migration - and the caller says so rather than
  // showing an empty list that would read as "no other devices".
  const listMySessions = useCallback(async (): Promise<{ sessions: AuthSession[] | null; error?: string }> => {
    if (!isAuthenticated) return { sessions: null };
    const { data, error } = await supabase.rpc('list_my_sessions');
    if (error) {
      if (!isMissingRpcError(error)) console.error('[List Sessions Failed]', error);
      return { sessions: null, error: isMissingRpcError(error) ? undefined : error.message };
    }
    const rows = (data ?? []) as SessionRow[];
    return {
      sessions: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        lastActive: row.last_active ?? row.created_at,
        notAfter: row.not_after,
        userAgent: row.user_agent,
        ip: row.ip,
        isCurrent: row.is_current,
      })),
    };
  }, [isAuthenticated]);

  // Revokes every session except this one - the supported GoTrue operation.
  // Those devices find out at their next `verifySession` (a wake, focus,
  // reconnect or the one-minute tick) or token refresh, whichever is first,
  // and clear themselves through the SIGNED_OUT handler. There is no per-device revoke: that would
  // mean writing to the `auth` schema, which Supabase does not support.
  const signOutOtherDevices = useCallback(async (): Promise<MutationResult> => {
    if (!isAuthenticated) return { success: false, error: 'Sign in to manage your devices' };
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      console.error('[Sign Out Other Devices Failed]', error);
      return { success: false, error: error.message || 'Could not sign out your other devices' };
    }
    return { success: true };
  }, [isAuthenticated]);

  // ADR 0072: the one hard delete. `delete_user_account` removes the auth user,
  // and every table that references it cascades, so the account, its email and
  // every row go in one database transaction, and every device's session ends.
  //   - On success this device signs out and clears itself, like any sign-out.
  //   - A missing function deletes nothing; the person is told, and stays in.
  //   - No SQLSTATE is an unknown outcome: the delete may have committed. The
  //     auth server is asked (`verifySession`), and a deleted account's session
  //     is rejected there, which signs this device out.
  const deleteAccount = useCallback(async (confirmation: string): Promise<MutationResult> => {
    if (!isAuthenticated) return { success: false, error: 'Sign in to delete your account' };
    const { error } = await supabase.rpc('delete_user_account', { p_confirm: confirmation });
    if (error) {
      if (isMissingRpcError(error)) {
        return { success: false, error: 'Account deletion needs a database update that has not been applied yet. Nothing was deleted.' };
      }
      if (isUnknownOutcomeError(error)) {
        await verifySession();
        return { success: false, error: 'We could not confirm whether your account was deleted. If it was, this device has been signed out.' };
      }
      console.error('[Delete Account Failed]', error);
      return { success: false, error: error.message || 'Could not delete your account' };
    }
    await signOut();
    return { success: true };
  }, [isAuthenticated, signOut, verifySession]);

  const restoreBackup = useCallback((data: AccountData): MutationResult => {
    if (isAuthenticated) {
      return { success: false, error: 'Sign out first. A backup restores into this browser in guest mode, not into an account.' };
    }
    // Rows from an account carry its uuid; on this device they are the guest's.
    const asGuest = <T extends { userId?: string | null }>(rows: T[]): T[] => rows.map((row) => ({ ...row, userId: DEFAULT_USER.id }));
    const walletIds = new Set(data.wallets.map((w) => w.id));
    const categoryIds = new Set(data.categories.map((c) => c.id));
    setWallets(asGuest(data.wallets));
    setTransactions(asGuest(data.transactions));
    setDebts(asGuest(data.debts));
    setCategories(asGuest(data.categories));
    setKeywordRules(asGuest(data.keywordRules));
    setDiaryEntries(asGuest(data.diaryEntries));
    setPresets((prev) =>
      prev.filter((p) => (!p.walletId || walletIds.has(p.walletId)) && (!p.categoryId || categoryIds.has(p.categoryId)))
    );
    inFlightIdempotencyKeys.current.clear();
    return { success: true };
  }, [isAuthenticated]);

  // Wallets CRUD
  const addWallet = useCallback(async (
    data: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted' | 'balance'>,
    initialBalance: number,
    idempotencyKey?: string
  ): Promise<MutationResult> => {
    const validation = WalletSchema.safeParse({ ...data, initialBalance });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    // F7 (ADR 0024): a user-created wallet's opening balance is a ledger row -
    // an ADJUSTMENT of the signed amount, so a credit card opening in debt
    // gets a negative one. Zero writes no row. The starter wallets open at 0
    // (ADR 0040), so they write no opening row either and need no exemption.
    const opening = roundToCents(initialBalance);
    const openingDate = todayIsoDate();

    if (isAuthenticated) {
      // One atomic RPC: the wallet at 0, then the opening row applied through
      // the same helper as every other ledger write, replayable on the key.
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_wallet', {
        p_name: data.name,
        p_type: data.type,
        p_currency: data.currency,
        p_color: data.color,
        p_icon: data.icon,
        p_opening_balance: opening,
        p_opening_date: openingDate,
        p_idempotency_key: idempotencyKey || generateIdempotencyKey(),
      });

      if (!rpcError) {
        const payload = rpcData as CreateWalletResult | null;
        if (!payload?.wallet) {
          // It may have committed; re-read rather than guess.
          await refreshFromCloud();
          return { success: false, error: 'create_wallet returned an unexpected response' };
        }
        const createdWallet = mapWalletRow(payload.wallet);
        markLocalWrite(createdWallet.id);
        setWallets((prev) => [...prev.filter((w) => w.id !== createdWallet.id), createdWallet]);
        if (payload.transaction) {
          const openingRow = mapTransactionRow(payload.transaction);
          markLocalWrite(openingRow.id);
          setTransactions((prev) => [openingRow, ...prev.filter((t) => t.id !== openingRow.id)]);
        }
        return { success: true };
      }

      if (!isMissingRpcError(rpcError)) {
        console.error('[Create Wallet Failed]', rpcError);
        if (isUnknownOutcomeError(rpcError)) await refreshFromCloud();
        return { success: false, error: rpcError.message || 'Failed to create wallet' };
      }
      console.warn('[create_wallet RPC unavailable, using non-atomic fallback]', rpcError.message);

      // Fallback for a project without the Phase 52 migration: the wallet,
      // then its opening row - checked now, where it used to be discarded, and
      // undone (soft-deleted, never hard-deleted) if the row is rejected.
      const { data: inserted, error } = await supabase
        .from('wallets')
        .insert({
          user_id: currentUser.id,
          name: data.name,
          type: data.type,
          currency: data.currency,
          balance: opening,
          color: data.color,
          icon: data.icon,
          is_archived: false,
          is_deleted: false,
        })
        .select()
        .single();

      if (error || !inserted) {
        return { success: false, error: error?.message || 'Failed to create wallet' };
      }
      markLocalWrite(inserted.id);

      if (opening !== 0) {
        const { data: openingRow, error: rowError } = await supabase
          .from('transactions')
          .insert({
            user_id: currentUser.id,
            wallet_id: inserted.id,
            amount: opening,
            type: 'ADJUSTMENT',
            description: 'Opening balance',
            transaction_date: openingDate,
            idempotency_key: `opening:${inserted.id}`,
            is_deleted: false,
            created_by: currentUser.id,
          })
          .select()
          .single();

        if (rowError) {
          console.error('[Create Wallet Opening Row Failed]', rowError);
          markLocalWrite(inserted.id);
          const { error: undoError } = await supabase
            .from('wallets')
            .update({ is_deleted: true, updated_at: new Date().toISOString() })
            .eq('id', inserted.id);
          if (undoError) console.error('[Create Wallet Compensation Failed]', undoError);
          return { success: false, error: rowError.message || 'Failed to record the opening balance' };
        }
        if (openingRow) {
          const mappedRow = mapTransactionRow(openingRow);
          markLocalWrite(mappedRow.id);
          setTransactions((prev) => [mappedRow, ...prev]);
        }
      }

      setWallets((prev) => [...prev, mapWalletRow(inserted)]);
    } else {
      const now = new Date().toISOString();
      const newWalletId = `w-${Date.now()}`;
      const newWallet: Wallet = {
        ...data,
        id: newWalletId,
        userId: currentUser.id,
        balance: opening,
        isArchived: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      setWallets((prev) => [...prev, newWallet]);
      if (opening !== 0) {
        const openingRow: Transaction = {
          id: `tx-opening-${newWalletId}`,
          userId: currentUser.id,
          walletId: newWalletId,
          amount: opening,
          type: 'ADJUSTMENT',
          description: 'Opening balance',
          transactionDate: openingDate,
          idempotencyKey: `opening:${newWalletId}`,
          isDeleted: false,
          createdBy: currentUser.id,
          createdAt: now,
          updatedAt: now,
        };
        setTransactions((prev) => [openingRow, ...prev]);
      }
    }

    return { success: true };
  }, [isAuthenticated, currentUser.id, markLocalWrite, refreshFromCloud]);

  // Provider-internal helper (T64: not on the public actions context - its
  // callers are `deleteWallet`, `editWallet` and `setWalletArchived` below).
  // Snapshots for rollback and checks the Supabase result rather than
  // discarding it (T66), matching `addTransaction`'s established
  // error/rollback shape.
  //
  // The row it sends carries only the columns `updates` names (Phase 59): a
  // column it does not name is absent from the request, not sent as
  // `undefined`, so an edit of a wallet's name can never carry a balance.
  const updateWallet = useCallback(async (id: string, updates: Partial<Wallet>): Promise<MutationResult> => {
    const previousWallets = walletsRef.current;

    // Optimistic update
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w))
    );

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(id);
      const columns: Record<string, unknown> = {
        name: updates.name,
        type: updates.type,
        currency: updates.currency,
        color: updates.color,
        icon: updates.icon,
        is_archived: updates.isArchived,
        is_deleted: updates.isDeleted,
        balance: updates.balance,
      };
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [column, value] of Object.entries(columns)) if (value !== undefined) row[column] = value;
      const { error } = await supabase.from('wallets').update(row).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Update Wallet Failed]', err);
      setWallets(previousWallets);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to update wallet'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  const deleteWallet = useCallback(async (id: string): Promise<MutationResult> => {
    return updateWallet(id, { isDeleted: true });
  }, [updateWallet]);

  // Phase 59 (ADR 0034): the Wallets page's Edit. Name, type and colour only;
  // the icon follows the type, as `AddWalletForm` sets it. The current
  // balance is read for the schema's credit-card rule and never written.
  const editWallet = useCallback(async (id: string, details: WalletEdit): Promise<MutationResult> => {
    const wallet = walletsRef.current.find((w) => w.id === id && !w.isDeleted);
    if (!wallet) return { success: false, error: 'Wallet not found or has been deleted' };
    const validation = WalletEditSchema.safeParse({ ...details, balance: Number(wallet.balance) });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    const { name, type, color } = validation.data;
    return updateWallet(id, { name, type, color, icon: type.toLowerCase() });
  }, [updateWallet]);

  const setWalletArchived = useCallback(async (id: string, archived: boolean): Promise<MutationResult> => {
    const wallet = walletsRef.current.find((w) => w.id === id && !w.isDeleted);
    if (!wallet) return { success: false, error: 'Wallet not found or has been deleted' };
    if (Boolean(wallet.isArchived) === archived) return { success: true };
    return updateWallet(id, { isArchived: archived });
  }, [updateWallet]);

  // Categories CRUD (Phase 30)
  const addCategory = useCallback(async (
    data: { name: string; type: TransactionType; color: string; icon?: string; description?: string }
  ): Promise<MutationResult> => {
    const validation = CategorySchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    const cleanedName = validation.data.name;
    // A blank description is stored as absent rather than as `''`. Both behave
    // identically for a user-created category (it can never match a shipped
    // default by name), but `undefined` is the honest representation of "not
    // written" and keeps the column NULL rather than empty-string. See ADR 0012.
    const cleanedDescription = validation.data.description || undefined;
    // Guards the taxonomy the way `seedInitialUserAccount`'s new re-entrancy
    // guard prevents duplicates at seed time - this closes the other half of
    // the same bug class, a user (or a retried form submit) creating a
    // second "Groceries".
    const isDuplicate = categoriesRef.current.some(
      (c) => !c.isDeleted && c.name.trim().toLowerCase() === cleanedName.toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, error: `A category named "${cleanedName}" already exists` };
    }
    // L9 (ADR 0037): the picker disables a colour in use; this is the same rule
    // at the write, so a stale form cannot hand two categories one colour. Once
    // all twelve are taken, colours may repeat (audit 012 finding 1).
    const usedNow = usedColors(categoriesRef.current);
    const colorOwner = usedNow.get(validation.data.color.toLowerCase());
    if (colorOwner && !paletteExhausted(IDENTITY_COLORS, usedNow)) {
      return { success: false, error: `That colour is used by ${colorOwner}` };
    }

    if (isAuthenticated) {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert({
          user_id: currentUser.id,
          name: cleanedName,
          type: validation.data.type,
          icon: validation.data.icon || 'tag',
          color: validation.data.color,
          description: cleanedDescription,
          is_system: false,
        })
        .select()
        .single();

      if (error || !inserted) {
        return { success: false, error: error?.message || 'Failed to create category' };
      }

      setCategories((prev) => [
        ...prev,
        {
          id: inserted.id,
          userId: inserted.user_id,
          name: inserted.name,
          type: inserted.type,
          icon: inserted.icon || 'tag',
          color: inserted.color || 'stone',
          description: inserted.description ?? undefined,
          isSystem: inserted.is_system || false,
          isDeleted: inserted.is_deleted || false,
        },
      ]);
      markLocalWrite(inserted.id);
    } else {
      const newCategory: Category = {
        id: `cat-${Date.now()}`,
        userId: currentUser.id,
        name: cleanedName,
        type: validation.data.type,
        icon: validation.data.icon || 'tag',
        color: validation.data.color,
        description: cleanedDescription,
        isSystem: false,
        isDeleted: false,
      };
      setCategories((prev) => [...prev, newCategory]);
    }

    return { success: true };
  }, [isAuthenticated, currentUser.id, markLocalWrite]);

  // Rename/recolor/re-icon only - `type` is intentionally not editable here. A
  // category's type is load-bearing for existing transactions recorded under
  // it (and, for DEBT_REPAYMENT/ADJUSTMENT, for the fixed system taxonomy
  // other mutators resolve by type); changing it after the fact would make
  // those historical records visually inconsistent with what they actually
  // were when recorded.
  const updateCategory = useCallback(async (id: string, updates: { name?: string; color?: string; icon?: string; description?: string }): Promise<MutationResult> => {
    const current = categoriesRef.current.find((c) => c.id === id);
    if (!current) {
      return { success: false, error: 'Category not found' };
    }
    // L10 (ADR 0037): Debt repayment and Balance adjustment are locked. They are
    // matched by type everywhere, and the page shows them under fixed names.
    if (isMovementCategory(current)) {
      return { success: false, error: "System categories can't be edited" };
    }
    // L9, only when the colour actually changes: a category still on a colour it
    // shares from before L9 can be renamed without being made to pick a new one.
    if (updates.color !== undefined && updates.color.toLowerCase() !== current.color.toLowerCase()) {
      const usedByOthers = usedColors(categoriesRef.current, id);
      const colorOwner = usedByOthers.get(updates.color.toLowerCase());
      if (colorOwner && !paletteExhausted(IDENTITY_COLORS, usedByOthers)) {
        return { success: false, error: `That colour is used by ${colorOwner}` };
      }
    }
    let cleanedUpdates = updates;
    // This path does not run `CategorySchema` (it is a partial update, and the
    // schema requires name/type/color), so the 120-char bound is enforced here
    // by hand the same way the name is trimmed by hand below. `''` is kept, not
    // normalized away: it is how a user clears a description, and
    // `withDefaultDescriptions` refills only `undefined`. See ADR 0012.
    if (updates.description !== undefined) {
      const cleaned = updates.description.trim();
      if (cleaned.length > 120) {
        return { success: false, error: 'Description is too long' };
      }
      cleanedUpdates = { ...cleanedUpdates, description: cleaned };
    }
    if (updates.name !== undefined) {
      const cleaned = updates.name.trim();
      if (!cleaned) {
        return { success: false, error: 'Category name is required' };
      }
      const isDuplicate = categoriesRef.current.some(
        (c) => c.id !== id && !c.isDeleted && c.name.trim().toLowerCase() === cleaned.toLowerCase()
      );
      if (isDuplicate) {
        return { success: false, error: `A category named "${cleaned}" already exists` };
      }
      // Spreads `cleanedUpdates`, not `updates` - spreading the raw input here
      // would discard the trimmed description computed just above.
      cleanedUpdates = { ...cleanedUpdates, name: cleaned };
    }

    const previousCategories = categoriesRef.current;

    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...cleanedUpdates } : c)));

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(id);
      const { error } = await supabase
        .from('categories')
        .update({
          ...(cleanedUpdates.name !== undefined ? { name: cleanedUpdates.name } : {}),
          ...(cleanedUpdates.color !== undefined ? { color: cleanedUpdates.color } : {}),
          ...(cleanedUpdates.icon !== undefined ? { icon: cleanedUpdates.icon } : {}),
          ...(cleanedUpdates.description !== undefined ? { description: cleanedUpdates.description } : {}),
        })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Update Category Failed]', err);
      setCategories(previousCategories);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to update category'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  // Soft-deletes, but only once guarded: a system default (its type is relied
  // on elsewhere by type, not just by id) or a category still referenced by
  // an active transaction or a keyword rule would otherwise leave those
  // records pointing at a category no active picker or lookup can resolve.
  const deleteCategory = useCallback(async (id: string): Promise<MutationResult> => {
    const category = categoriesRef.current.find((c) => c.id === id);
    if (!category) {
      return { success: false, error: 'Category not found' };
    }
    if (category.isSystem) {
      return { success: false, error: 'Default categories cannot be deleted' };
    }
    const isInUse =
      transactionsRef.current.some((t) => t.categoryId === id && !t.isDeleted) ||
      keywordRulesRef.current.some((r) => r.categoryId === id);
    if (isInUse) {
      return { success: false, error: 'This category is used by existing transactions or keyword rules and cannot be deleted' };
    }

    const previousCategories = categoriesRef.current;

    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isDeleted: true } : c)));

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(id);
      const { error } = await supabase.from('categories').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Delete Category Failed]', err);
      setCategories(previousCategories);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to delete category'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  // Keyword rules CRUD
  const addKeywordRule = useCallback(async (keyword: string, categoryId: string): Promise<MutationResult> => {
    const validation = KeywordMappingSchema.safeParse({ keyword, categoryId });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    // The schema trims and lower-cases the keyword, so use its parsed output.
    const cleaned = validation.data.keyword;

    if (isAuthenticated) {
      const { data, error } = await supabase
        .from('keyword_rules')
        .insert({
          user_id: currentUser.id,
          keyword: cleaned,
          category_id: categoryId,
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to save keyword rule' };
      }

      setKeywordRules((prev) => [
        {
          id: data.id,
          userId: data.user_id,
          keyword: data.keyword,
          categoryId: data.category_id,
          createdAt: data.created_at,
        },
        ...prev,
      ]);
    } else {
      const newRule: KeywordRule = {
        id: `kr-${Date.now()}`,
        userId: currentUser.id,
        keyword: cleaned,
        categoryId,
        createdAt: new Date().toISOString(),
      };
      setKeywordRules((prev) => [newRule, ...prev]);
    }

    return { success: true };
  }, [isAuthenticated, currentUser.id]);

  // Hard delete, not soft: `KeywordRule` has no `isDeleted` field and no
  // migration adds one - it is categorization config, not a financial record,
  // so CLAUDE.md's soft-delete rule does not apply here.
  const deleteKeywordRule = useCallback(async (id: string): Promise<MutationResult> => {
    const previousIndex = keywordRulesRef.current.findIndex((r) => r.id === id);
    const previousRule = previousIndex >= 0 ? keywordRulesRef.current[previousIndex] : undefined;

    setKeywordRules((prev) => prev.filter((r) => r.id !== id));

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      const { error } = await supabase.from('keyword_rules').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Delete Keyword Rule Failed]', err);
      // Local removal drops the row from the array rather than flipping a
      // flag, so rollback re-inserts it at its original index instead of
      // restoring a snapshot of the whole array.
      if (previousRule) {
        setKeywordRules((prev) => {
          const next = [...prev];
          next.splice(previousIndex, 0, previousRule);
          return next;
        });
      }
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to delete keyword rule'),
      };
    }
  }, [isAuthenticated]);

  // Preset (quick-template) CRUD. Local-only (see the `presets` state
  // declaration above) - hard delete, like keyword rules, since a template is
  // configuration, not a financial record `isDeleted` needs to protect.
  const addPreset = useCallback(async (data: {
    name: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    description: string;
    categoryId?: string;
    walletId?: string;
  }): Promise<MutationResult> => {
    const validation = PresetSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    const cleaned = validation.data;
    const isDuplicate = presetsRef.current.some(
      (p) => p.name.trim().toLowerCase() === cleaned.name.toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, error: `A template named "${cleaned.name}" already exists` };
    }

    const newPreset: Preset = {
      id: `preset-${Date.now()}`,
      userId: currentUser.id,
      name: cleaned.name,
      type: cleaned.type,
      amount: cleaned.amount,
      description: cleaned.description,
      categoryId: cleaned.categoryId,
      walletId: cleaned.walletId,
      createdAt: new Date().toISOString(),
    };
    setPresets((prev) => [newPreset, ...prev]);
    return { success: true };
  }, [currentUser.id]);

  const updatePreset = useCallback(async (
    id: string,
    updates: Partial<{ name: string; amount: number; description: string; categoryId: string; walletId: string }>
  ): Promise<MutationResult> => {
    const existing = presetsRef.current.find((p) => p.id === id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }

    let cleanedUpdates = updates;
    if (updates.name !== undefined) {
      const cleanedName = updates.name.trim();
      if (!cleanedName) {
        return { success: false, error: 'Template name is required' };
      }
      const isDuplicate = presetsRef.current.some(
        (p) => p.id !== id && p.name.trim().toLowerCase() === cleanedName.toLowerCase()
      );
      if (isDuplicate) {
        return { success: false, error: `A template named "${cleanedName}" already exists` };
      }
      cleanedUpdates = { ...updates, name: cleanedName };
    }
    if (updates.amount !== undefined && !(updates.amount > 0)) {
      return { success: false, error: 'Amount must be greater than 0' };
    }
    if (updates.description !== undefined && !updates.description.trim()) {
      return { success: false, error: 'Description is required' };
    }

    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...cleanedUpdates } : p)));
    return { success: true };
  }, []);

  const deletePreset = useCallback(async (id: string): Promise<MutationResult> => {
    const exists = presetsRef.current.some((p) => p.id === id);
    if (!exists) {
      return { success: false, error: 'Template not found' };
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
    return { success: true };
  }, []);

  // Transactions CRUD
  const addTransaction = useCallback(async (data: {
    amount: number;
    rawInput?: string;
    description: string;
    walletId: string;
    destinationWalletId?: string;
    categoryId?: string;
    debtId?: string;
    type: TransactionType;
    transactionDate: string;
    idempotencyKey?: string;
  }) => {
    const validation = TransactionSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    // Resolve every participating wallet BEFORE mutating any state. Zod only proves
    // the ids are well-formed and distinct; it cannot prove they still resolve to a
    // live wallet. Without this, a transfer to a missing/soft-deleted destination
    // debits the source and credits nobody.
    const sourceWallet = walletsRef.current.find((w) => w.id === data.walletId && !w.isDeleted);
    if (!sourceWallet) {
      return { success: false, error: 'Source wallet not found or has been deleted' };
    }

    let destWallet: Wallet | undefined;
    if (data.type === 'TRANSFER') {
      if (!data.destinationWalletId || data.destinationWalletId === data.walletId) {
        return { success: false, error: 'Transfer requires a distinct destination wallet' };
      }
      destWallet = walletsRef.current.find((w) => w.id === data.destinationWalletId && !w.isDeleted);
      if (!destWallet) {
        return { success: false, error: 'Destination wallet not found or has been deleted' };
      }
    }

    const clientKey = data.idempotencyKey || generateIdempotencyKey();

    // P0-5 Idempotency Guard: prevent concurrent duplicate submissions
    if (inFlightIdempotencyKeys.current.has(clientKey)) {
      return { success: false, error: 'Duplicate transaction submission in progress.' };
    }

    // Check if already processed
    const existingTx = transactionsRef.current.find((t) => t.idempotencyKey === clientKey);
    if (existingTx) {
      return { success: true, txId: existingTx.id };
    }

    // ADR 0016: a repayment may not exceed what is actually owed. Zod proves
    // `debtId` is present for a DEBT_REPAYMENT; it cannot prove the debt still
    // resolves, nor that the payment fits inside the remaining balance - the
    // same gap the wallet resolution above exists to close.
    //
    // The position of this block is load-bearing in both directions. It must
    // sit AFTER the `existingTx` replay check, or retrying a payment that
    // already settled its debt would be rejected for exceeding a remainder its
    // own earlier success drove to zero. It must sit BEFORE the
    // `inFlightIdempotencyKeys.add` below, because the `finally` that releases
    // the key belongs to a `try` that only begins after the optimistic writes:
    // an early return past this line leaks the key forever, and
    // `useIdempotencyKey` reuses it on retry, so the user would correct the
    // amount and be told "Duplicate transaction submission in progress" for the
    // rest of the form's life.
    const targetDebt =
      data.type === 'DEBT_REPAYMENT' && data.debtId
        ? debtsRef.current.find((d) => d.id === data.debtId && !d.isDeleted)
        : undefined;
    if (data.type === 'DEBT_REPAYMENT' && data.debtId) {
      if (!targetDebt) {
        return { success: false, error: 'Debt goal not found or has been deleted' };
      }
      if (data.amount > targetDebt.remainingAmount) {
        return {
          success: false,
          error: `Payment exceeds the ${formatCurrencyAmount(targetDebt.remainingAmount)} remaining on ${targetDebt.name}`,
        };
      }
    }

    inFlightIdempotencyKeys.current.add(clientKey);

    // Snapshot state for rollback if network/database fails. `transactions` is
    // included so a failed balance write cannot leave an orphan ledger row behind.
    // Read via the T15 refs rather than the closured state: this function no longer
    // depends on `wallets`/`debts`/`transactions` to stay stable across renders,
    // but the ref mirrors are updated in `useEffect` after every commit, so by the
    // time any event handler can invoke this callback they hold the same values
    // the closured state would have.
    const previousWallets = walletsRef.current;
    const previousDebts = debtsRef.current;
    const previousTransactions = transactionsRef.current;
    // T69: see `cloudRevisionRef`'s own comment for why this, not a ref-identity
    // check, is what detects a concurrent realtime reload landing mid-flight.
    const cloudRevisionAtStart = cloudRevisionRef.current;

    // Optimistic balance calculation, derived from the resolved wallets up front so
    // the state updater below stays a pure mapping with no assignment side effects.
    let sourceNewBalance: number | null = null;
    if (data.type === 'EXPENSE' || data.type === 'DEBT_REPAYMENT' || data.type === 'TRANSFER') {
      sourceNewBalance = roundToCents(sourceWallet.balance - data.amount);
    } else if (data.type === 'INCOME' || data.type === 'ADJUSTMENT') {
      sourceNewBalance = roundToCents(sourceWallet.balance + data.amount);
    }

    const destNewBalance: number | null =
      data.type === 'TRANSFER' && destWallet
        ? roundToCents(destWallet.balance + data.amount)
        : null;

    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === sourceWallet.id && sourceNewBalance !== null) {
          return { ...w, balance: sourceNewBalance };
        }
        if (destWallet && w.id === destWallet.id && destNewBalance !== null) {
          return { ...w, balance: destNewBalance };
        }
        return w;
      })
    );

    // Optimistic debt calculation. The `Math.max(0, ...)` floor is unreachable
    // for new writes now that the guard above rejects an overpayment outright,
    // and is kept deliberately rather than removed as dead code (ADR 0016):
    // `debtsRef.current` can be stale against a concurrent repayment from
    // another device, and without the floor that race writes a *negative*
    // remaining balance instead of clamping. Guard first, floor second.
    //
    // Computed ONCE, here, and reused by the remote write below (ADR 0022).
    // That write used to re-read `debtsRef.current` after the insert's
    // `await` - by which point the ref-mirror effect had already moved it to
    // this optimistic value - and subtract the payment a second time, sending
    // Supabase ฿2,500 for a ฿1,000 payment off ฿4,500. The floor hid it
    // whenever the payment settled the debt.
    const debtNewRemaining: number | null = targetDebt
      ? Math.max(0, roundToCents(targetDebt.remainingAmount - data.amount))
      : null;

    if (targetDebt && debtNewRemaining !== null) {
      const debtUpdatedAt = new Date().toISOString();
      setDebts((prev) =>
        prev.map((d) =>
          d.id === targetDebt.id
            ? { ...d, remainingAmount: debtNewRemaining, isSettled: debtNewRemaining === 0, updatedAt: debtUpdatedAt }
            : d
        )
      );
    }

    // Track which remote writes committed so a mid-sequence failure can be undone.
    let insertedTxId: string | null = null;
    let sourceDebited = false;
    let destCredited = false;
    // ADR 0023: set when a ledger RPC may have committed without telling us.
    let rpcOutcomeUnknown = false;

    try {
      if (isAuthenticated) {
        // Transfers go through a single database transaction. The RPC locks both
        // wallets, applies relative balance updates and inserts the ledger row
        // atomically, so a partial failure cannot debit one side without
        // crediting the other. ADR 0069: no p_user_id, so PostgREST reaches
        // the Phase 93 overload, which takes the user from the session alone.
        if (data.type === 'TRANSFER' && destWallet) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('transfer_funds', {
            p_source_wallet_id: sourceWallet.id,
            p_dest_wallet_id: destWallet.id,
            p_amount: data.amount,
            p_idempotency_key: clientKey,
            p_notes: data.description,
            p_date: data.transactionDate,
            p_raw_input: data.rawInput || null,
          });

          if (rpcError) {
            // Only an unapplied migration falls through to the legacy path;
            // every other error is a real failure and must roll back.
            if (!isMissingRpcError(rpcError)) throw rpcError;
            console.warn('[transfer_funds RPC unavailable, using non-atomic fallback]', rpcError.message);
          } else {
            const payload = rpcData as TransferFundsResult | null;
            // A successful call that returned something unexpected must not fall
            // through to the legacy path - the RPC may already have moved the
            // money, and writing again would double-spend.
            if (!payload?.transaction) {
              throw new Error('transfer_funds returned an unexpected response');
            }

            const mapped = mapTransactionRow(payload.transaction);
            const nextSourceBalance = Number(payload.source_balance);
            const nextDestBalance = Number(payload.dest_balance);

            // Replace rather than prepend: on an idempotent replay the row may
            // already be present locally.
            setTransactions((prev) => [mapped, ...prev.filter((t) => t.id !== mapped.id)]);

            // Reconcile against the balances the database actually committed.
            // This also corrects the optimistic debit when `reused` is true and
            // no new money actually moved.
            setWallets((prev) =>
              prev.map((w) => {
                if (w.id === sourceWallet.id && Number.isFinite(nextSourceBalance)) {
                  return { ...w, balance: nextSourceBalance };
                }
                if (w.id === destWallet.id && Number.isFinite(nextDestBalance)) {
                  return { ...w, balance: nextDestBalance };
                }
                return w;
              })
            );
            markLocalWrite(mapped.id);
            markLocalWrite(sourceWallet.id);
            markLocalWrite(destWallet.id);

            return { success: true, txId: mapped.id };
          }
        }

        const validCategoryId = data.categoryId && categoriesRef.current.some((c) => c.id === data.categoryId)
          ? data.categoryId
          : null;

        // Every other type is one atomic RPC (ADR 0023): the database locks the
        // wallet and debt, applies RELATIVE updates, re-checks the ADR 0016
        // overpayment guard under that lock, and replays on `clientKey`, so a
        // retry after a lost response cannot write twice. Nothing below this
        // block runs unless the function is missing.
        if (data.type !== 'TRANSFER') {
          markLocalWrite(sourceWallet.id);
          if (targetDebt) markLocalWrite(targetDebt.id);
          const { data: rpcData, error: rpcError } = await supabase.rpc('record_transaction', {
            p_wallet_id: sourceWallet.id,
            p_amount: data.amount,
            p_type: data.type,
            p_description: data.description,
            p_transaction_date: data.transactionDate,
            p_idempotency_key: clientKey,
            p_category_id: validCategoryId,
            p_debt_id: data.debtId || null,
            p_raw_input: data.rawInput || null,
          });

          if (rpcError) {
            if (!isMissingRpcError(rpcError)) {
              if (isUnknownOutcomeError(rpcError)) rpcOutcomeUnknown = true;
              throw rpcError;
            }
            console.warn('[record_transaction RPC unavailable, using non-atomic fallback]', rpcError.message);
          } else {
            const payload = rpcData as LedgerWriteResult | null;
            // The RPC may already have committed; falling through to the legacy
            // path would write a second time, and restoring the snapshot would
            // hide a write that happened. Re-read instead.
            if (!payload?.transaction) {
              rpcOutcomeUnknown = true;
              throw new Error('record_transaction returned an unexpected response');
            }

            const mapped = mapTransactionRow(payload.transaction);
            markLocalWrite(mapped.id);
            // Replace rather than prepend: a replay returns a row that may
            // already be present locally.
            setTransactions((prev) => [mapped, ...prev.filter((t) => t.id !== mapped.id)]);
            adoptLedgerState(payload, { walletId: sourceWallet.id, debtId: targetDebt?.id ?? null });
            return { success: true, txId: mapped.id };
          }
        }

        const { data: insertedTx, error: txErr } = await supabase
          .from('transactions')
          .insert({
            user_id: currentUser.id,
            wallet_id: data.walletId,
            destination_wallet_id: data.destinationWalletId || null,
            category_id: validCategoryId,
            debt_id: data.debtId || null,
            amount: data.amount,
            type: data.type,
            description: data.description,
            raw_input: data.rawInput || null,
            transaction_date: data.transactionDate,
            idempotency_key: clientKey,
            is_deleted: false,
            created_by: currentUser.id,
          })
          .select()
          .single();

        if (txErr) throw txErr;

        let createdTxId = clientKey;
        if (insertedTx) {
          createdTxId = insertedTx.id;
          insertedTxId = insertedTx.id;
          const mapped = mapTransactionRow(insertedTx);
          setTransactions((prev) => [mapped, ...prev]);
          markLocalWrite(mapped.id);
        }

        // Update wallet balances in Supabase and check errors
        if (sourceNewBalance !== null) {
          markLocalWrite(sourceWallet.id);
          const { error: wErr1 } = await supabase.from('wallets').update({ balance: sourceNewBalance }).eq('id', sourceWallet.id);
          if (wErr1) throw wErr1;
          sourceDebited = true;
        }
        if (destWallet && destNewBalance !== null) {
          markLocalWrite(destWallet.id);
          const { error: wErr2 } = await supabase.from('wallets').update({ balance: destNewBalance }).eq('id', destWallet.id);
          if (wErr2) throw wErr2;
          destCredited = true;
        }

        // Update debt in Supabase and check errors. Writes the value computed
        // before any `setState` - never a post-`await` re-read of the ref.
        if (targetDebt && debtNewRemaining !== null) {
          markLocalWrite(targetDebt.id);
          const { error: dErr } = await supabase.from('debts').update({
            remaining_amount: debtNewRemaining,
            is_settled: debtNewRemaining === 0,
            updated_at: new Date().toISOString(),
          }).eq('id', targetDebt.id);
          if (dErr) throw dErr;
        }

        return { success: true, txId: createdTxId };
      } else {
        // Fields are mapped explicitly rather than spread, so caller-only keys
        // (e.g. the form's `date`) never leak into the persisted ledger row.
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          walletId: data.walletId,
          destinationWalletId: data.destinationWalletId,
          categoryId: data.categoryId,
          debtId: data.debtId,
          amount: data.amount,
          type: data.type,
          description: data.description,
          rawInput: data.rawInput,
          transactionDate: data.transactionDate,
          idempotencyKey: clientKey,
          isDeleted: false,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTransactions((prev) => [newTx, ...prev]);
        return { success: true, txId: newTx.id };
      }
    } catch (err: unknown) {
      console.error('[Add Transaction Failed]', err);

      // The server's ADR 0016 guard, re-checked under the debt's row lock:
      // this client's copy of the debt was stale (another device paid).
      const rpcFailure = err as { message?: string; details?: string };
      const serverOverpayment = rpcFailure?.message === 'DEBT_OVERPAYMENT';

      if (cloudRevisionRef.current !== cloudRevisionAtStart) {
        // T69: a realtime reload landed while this write was in flight, so
        // `previousWallets`/`previousDebts`/`previousTransactions` are a stale
        // pre-fetch snapshot, not server truth - restoring them would silently
        // discard whatever another device just committed. Re-fetch instead of
        // guessing which parts of the snapshot are still valid.
        await refreshFromCloud();
      } else {
        // Rollback optimistic local state. Wallets, debts and transactions are
        // restored together so the ledger and the balances can never disagree.
        setWallets(previousWallets);
        setDebts(previousDebts);
        setTransactions(previousTransactions);

        // ADR 0023: the rollback is only a guess when the RPC may have
        // committed, or when the server just proved this client's debt stale.
        // Re-read. If that read fails too (offline), the rollback stands until
        // the reconnect reload corrects it.
        if (rpcOutcomeUnknown || serverOverpayment) {
          await refreshFromCloud();
        }
      }

      if (serverOverpayment && targetDebt) {
        const serverRemaining = Number(rpcFailure.details);
        return {
          success: false,
          error: `Payment exceeds the ${formatCurrencyAmount(
            Number.isFinite(serverRemaining) ? serverRemaining : targetDebt.remainingAmount
          )} remaining on ${targetDebt.name}`,
        };
      }

      // Compensate any remote writes that already committed. The three writes are
      // not a single database transaction, so a failure part-way through leaves the
      // source debited with nothing credited unless we explicitly undo it.
      if (isAuthenticated) {
        try {
          if (destCredited && destWallet) {
            markLocalWrite(destWallet.id);
            await supabase.from('wallets').update({ balance: destWallet.balance }).eq('id', destWallet.id);
          }
          if (sourceDebited) {
            markLocalWrite(sourceWallet.id);
            await supabase.from('wallets').update({ balance: sourceWallet.balance }).eq('id', sourceWallet.id);
          }
          if (insertedTxId) {
            // Soft delete only - financial records are never hard deleted.
            markLocalWrite(insertedTxId);
            await supabase
              .from('transactions')
              .update({ is_deleted: true, updated_at: new Date().toISOString() })
              .eq('id', insertedTxId);
          }
        } catch (compErr) {
          console.error('[Add Transaction Compensation Failed]', compErr);
        }
      }

      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      const detailedError =
        postgrestErr?.message ||
        postgrestErr?.details ||
        postgrestErr?.hint ||
        (err instanceof Error ? err.message : 'Database error');
      return { success: false, error: detailedError };
    } finally {
      inFlightIdempotencyKeys.current.delete(clientKey);
    }
  }, [currentUser.id, isAuthenticated, markLocalWrite, adoptLedgerState, refreshFromCloud]);

  // Fires a saved template as a brand-new transaction. Deliberately reuses
  // `addTransaction` instead of its own insert/balance-update path - CLAUDE.md's
  // "no second repayment code path" lesson (T64) applies here too: the ledger
  // and wallet-balance logic must have exactly one implementation.
  const applyPreset = useCallback(async (id: string, transactionDate?: string) => {
    const preset = presetsRef.current.find((p) => p.id === id);
    if (!preset) {
      return { success: false, error: 'Template not found' };
    }

    const walletId =
      preset.walletId && walletsRef.current.some((w) => w.id === preset.walletId && !w.isDeleted)
        ? preset.walletId
        : walletsRef.current.find((w) => !w.isDeleted)?.id;
    if (!walletId) {
      return { success: false, error: 'No wallet available to apply this template' };
    }

    const categoryId =
      preset.categoryId && categoriesRef.current.some((c) => c.id === preset.categoryId && !c.isDeleted)
        ? preset.categoryId
        : undefined;

    return addTransaction({
      amount: preset.amount,
      description: preset.description,
      walletId,
      categoryId,
      type: preset.type,
      transactionDate: transactionDate || todayIsoDate(),
    });
  }, [addTransaction]);

  // Soft-delete and restore are exact inverses: both flip `isDeleted` and undo or
  // re-apply the transaction's effect on wallet balances. `sign` is +1 when removing
  // the transaction from the ledger and -1 when putting it back, so one body covers
  // both directions and the two can no longer drift apart.
  const setTransactionDeleted = useCallback(async (id: string, deleted: boolean): Promise<MutationResult> => {
    const tx = transactionsRef.current.find((t) => t.id === id);
    if (!tx) return { success: false, error: 'Transaction not found' };
    if (tx.isDeleted === deleted) return { success: true };

    const sign = deleted ? 1 : -1;

    // Snapshot for rollback before any optimistic write, mirroring
    // `addTransaction`'s pattern above.
    const previousTransactions = transactionsRef.current;
    const previousWallets = walletsRef.current;
    const previousDebts = debtsRef.current;

    // Resolve every participating wallet and compute both new balances BEFORE
    // any setState call. This function used to assign `sourceNewBal`/
    // `destNewBal` from inside the `setWallets` updater and read them back
    // immediately after - but the preceding `setTransactions` call already
    // schedules a state update, so React no longer takes the synchronous
    // first-call fast path for the `setWallets` call that follows it, and the
    // updater does not run before the read. Both variables silently stayed
    // `null`, and the two remote wallet-balance UPDATEs below never fired,
    // desyncing the cloud balance from the local one on every soft-delete and
    // restore. Computing the values here keeps both updaters pure mappings
    // with no assignment side effects, so there is nothing left to race.
    const sourceWallet = walletsRef.current.find((w) => w.id === tx.walletId);
    const destWallet = tx.destinationWalletId
      ? walletsRef.current.find((w) => w.id === tx.destinationWalletId)
      : undefined;

    let sourceNewBal: number | null = null;
    if (sourceWallet) {
      if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT' || tx.type === 'TRANSFER') {
        sourceNewBal = roundToCents(sourceWallet.balance + sign * tx.amount);
      } else if (tx.type === 'INCOME' || tx.type === 'ADJUSTMENT') {
        sourceNewBal = roundToCents(sourceWallet.balance - sign * tx.amount);
      }
    }

    const destNewBal: number | null =
      tx.type === 'TRANSFER' && destWallet
        ? roundToCents(destWallet.balance - sign * tx.amount)
        : null;

    // ADR 0016: the debt moves with the wallet. Before this, soft-deleting a
    // DEBT_REPAYMENT refunded the wallet and left `remainingAmount` decremented
    // - free money, repeatable - while restoring debited the wallet again with
    // no debt movement at all, charging twice for one reduction. No spec
    // covered it: `soft-delete.spec.ts`'s balance-invariant test uses an
    // EXPENSE, so nothing had ever driven a repayment through delete/restore.
    //
    // Resolved and computed here, beside the wallet balances, for the reason
    // spelled out above: reading a value assigned inside a `setState` updater
    // is the exact race that silently broke this function's wallet writes in
    // T63. Any of the defensive cases - not a repayment, no `debtId`, the debt
    // since deleted - leaves this null and lets the wallet reversal proceed
    // alone, mirroring how a missing `sourceWallet` is already handled.
    const targetDebt =
      tx.type === 'DEBT_REPAYMENT' && tx.debtId
        ? debtsRef.current.find((d) => d.id === tx.debtId && !d.isDeleted)
        : undefined;

    // `sign` is +1 when deleting (give the debt back) and -1 when restoring
    // (take it again). No upper cap on the reversal: restoring a repayment
    // written before the ADR 0016 guard can push `remainingAmount` above
    // `totalAmount`, and capping would silently discard the difference - the
    // same sin as clamping an overpayment. `ProgressBar` and the payoff
    // block's `displayPercent` both clamp, so it renders as 100% rather than
    // breaking.
    const debtNewRemaining: number | null = targetDebt
      ? Math.max(0, roundToCents(targetDebt.remainingAmount + sign * tx.amount))
      : null;

    // Optimistic local writes
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleted: deleted, updatedAt: new Date().toISOString() } : t))
    );

    setWallets((prev) =>
      prev.map((w) => {
        if (sourceWallet && w.id === sourceWallet.id && sourceNewBal !== null) {
          return { ...w, balance: sourceNewBal };
        }
        if (destWallet && w.id === destWallet.id && destNewBal !== null) {
          return { ...w, balance: destNewBal };
        }
        return w;
      })
    );

    // `isSettled` is recomputed in both directions, so reversing the payment
    // that settled a debt un-settles it and makes its card actionable again.
    if (targetDebt && debtNewRemaining !== null) {
      setDebts((prev) =>
        prev.map((d) =>
          d.id === targetDebt.id
            ? {
                ...d,
                remainingAmount: debtNewRemaining,
                isSettled: debtNewRemaining === 0,
                updatedAt: new Date().toISOString(),
              }
            : d
        )
      );
    }

    if (!isAuthenticated) {
      return { success: true };
    }

    // Track which remote writes committed so a mid-sequence failure can be
    // undone precisely, mirroring `addTransaction`'s compensation pattern.
    // Wallet balances are written FIRST and the `is_deleted` flag LAST: the
    // flag is what makes the row count as active/inactive again, so a wallet
    // write failing must leave the cloud row in its pre-change state with
    // only the already-committed balance writes to compensate - not a
    // flipped flag pointing at balances that were never actually written.
    let sourceWalletUpdated = false;
    let destWalletUpdated = false;
    let debtUpdated = false;
    // ADR 0023: set when the RPC may have committed without telling us.
    let rpcOutcomeUnknown = false;

    try {
      // One atomic RPC (ADR 0023): the database locks the row, its wallets and
      // its debt, reverses or reapplies the effect as RELATIVE updates, and
      // flips the flag - or does nothing if the row is already in the asked-for
      // state, which is what makes a retried delete safe. The balances it
      // returns replace the optimistic ones. The legacy sequence below runs
      // only when the function is missing.
      markLocalWrite(id);
      if (sourceWallet) markLocalWrite(sourceWallet.id);
      if (destWallet) markLocalWrite(destWallet.id);
      if (targetDebt) markLocalWrite(targetDebt.id);
      const { data: rpcData, error: rpcError } = await supabase.rpc('set_transaction_deleted', {
        p_transaction_id: id,
        p_deleted: deleted,
      });

      if (rpcError) {
        if (!isMissingRpcError(rpcError)) {
          if (isUnknownOutcomeError(rpcError)) rpcOutcomeUnknown = true;
          throw rpcError;
        }
        console.warn('[set_transaction_deleted RPC unavailable, using non-atomic fallback]', rpcError.message);
      } else {
        const payload = rpcData as LedgerWriteResult | null;
        if (!payload?.transaction) {
          rpcOutcomeUnknown = true;
          throw new Error('set_transaction_deleted returned an unexpected response');
        }
        const mapped = mapTransactionRow(payload.transaction);
        setTransactions((prev) => prev.map((t) => (t.id === mapped.id ? mapped : t)));
        adoptLedgerState(payload, {
          walletId: tx.walletId,
          destWalletId: tx.destinationWalletId ?? null,
          debtId: targetDebt?.id ?? null,
        });
        return { success: true };
      }

      if (sourceNewBal !== null && sourceWallet) {
        markLocalWrite(sourceWallet.id);
        const { error } = await supabase.from('wallets').update({ balance: sourceNewBal }).eq('id', sourceWallet.id);
        if (error) throw error;
        sourceWalletUpdated = true;
      }
      if (destNewBal !== null && destWallet) {
        markLocalWrite(destWallet.id);
        const { error } = await supabase.from('wallets').update({ balance: destNewBal }).eq('id', destWallet.id);
        if (error) throw error;
        destWalletUpdated = true;
      }

      // Written with the wallet balances and before the `is_deleted` flag, for
      // the reason the flag is written last: the flag is what makes the row
      // count as active, so a balance or debt write failing must leave the
      // cloud row in its pre-change state.
      if (targetDebt && debtNewRemaining !== null) {
        markLocalWrite(targetDebt.id);
        const { error: debtError } = await supabase
          .from('debts')
          .update({
            remaining_amount: debtNewRemaining,
            is_settled: debtNewRemaining === 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetDebt.id);
        if (debtError) throw debtError;
        debtUpdated = true;
      }

      markLocalWrite(id);
      const { error: txError } = await supabase
        .from('transactions')
        .update({ is_deleted: deleted, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (txError) throw txError;

      return { success: true };
    } catch (err: unknown) {
      console.error('[Set Transaction Deleted Failed]', err);

      // Roll back the optimistic local state. Wallets and the transaction flag
      // are restored together so the ledger and the balances can never disagree.
      setTransactions(previousTransactions);
      setWallets(previousWallets);
      setDebts(previousDebts);

      // Compensate any remote wallet or debt writes that already committed -
      // the wallet writes, the debt write and the flag write are not a single
      // database transaction, so a failure part-way through leaves a balance
      // changed with nothing to reflect it unless explicitly undone.
      try {
        if (sourceWalletUpdated && sourceWallet) {
          markLocalWrite(sourceWallet.id);
          await supabase.from('wallets').update({ balance: sourceWallet.balance }).eq('id', sourceWallet.id);
        }
        if (destWalletUpdated && destWallet) {
          markLocalWrite(destWallet.id);
          await supabase.from('wallets').update({ balance: destWallet.balance }).eq('id', destWallet.id);
        }
        if (debtUpdated && targetDebt) {
          markLocalWrite(targetDebt.id);
          await supabase
            .from('debts')
            .update({
              remaining_amount: targetDebt.remainingAmount,
              is_settled: targetDebt.isSettled,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetDebt.id);
        }
      } catch (compErr) {
        console.error('[Set Transaction Deleted Compensation Failed]', compErr);
      }

      // ADR 0023: the rollback above is a guess when the RPC may have
      // committed. Re-read; if that fails too (offline), the rollback stands
      // until the reconnect reload corrects it.
      if (rpcOutcomeUnknown) {
        await refreshFromCloud();
      }

      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      const detailedError =
        postgrestErr?.message ||
        postgrestErr?.details ||
        postgrestErr?.hint ||
        (err instanceof Error ? err.message : 'Database error');
      return { success: false, error: detailedError };
    }
  }, [isAuthenticated, markLocalWrite, adoptLedgerState, refreshFromCloud]);

  const softDeleteTransaction = useCallback(
    (id: string) => setTransactionDeleted(id, true),
    [setTransactionDeleted]
  );

  const restoreTransaction = useCallback(
    (id: string) => setTransactionDeleted(id, false),
    [setTransactionDeleted]
  );

  // ADR 0033: edits a live transaction. The net wallet movement is the new row's
  // effects minus the old row's (`walletEffects`), computed here from the refs
  // BEFORE any setState (ADR 0022). Signed in, `update_transaction` does the same
  // under its locks and the balances it returns replace these optimistic ones.
  const updateTransaction = useCallback(async (id: string, edit: TransactionEdit): Promise<MutationResult> => {
    const tx = transactionsRef.current.find((t) => t.id === id);
    if (!tx) return { success: false, error: 'Transaction not found' };

    // A repayment or an adjustment keeps its formula with its amount, which
    // cannot change; for the others a blank formula is none.
    const next: Transaction = {
      ...tx,
      type: edit.type,
      amount: roundToCents(edit.amount),
      walletId: edit.walletId,
      destinationWalletId: edit.destinationWalletId || undefined,
      categoryId: edit.categoryId || undefined,
      description: edit.description,
      transactionDate: edit.transactionDate,
      rawInput: MONEY_EDITABLE_TYPES.has(tx.type) ? edit.rawInput?.trim() || undefined : tx.rawInput,
    };

    const ruleError = editRuleError(tx, next, walletsRef.current);
    if (ruleError) return { success: false, error: ruleError };

    const validation = TransactionSchema.safeParse({
      amount: next.amount,
      rawInput: next.rawInput,
      type: next.type,
      description: next.description,
      walletId: next.walletId,
      destinationWalletId: next.destinationWalletId,
      categoryId: next.categoryId,
      debtId: next.debtId,
      transactionDate: next.transactionDate,
    });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    // Nothing to write - the server would answer `changed: false` too.
    if (sameEdit(tx, next)) return { success: true };

    const deltas = new Map<string, number>();
    if (!sameMoney(tx, next)) {
      for (const [walletId, amount] of walletEffects(tx)) deltas.set(walletId, (deltas.get(walletId) ?? 0) - amount);
      for (const [walletId, amount] of walletEffects(next)) deltas.set(walletId, (deltas.get(walletId) ?? 0) + amount);
    }
    const newBalances = new Map<string, number>();
    for (const wallet of walletsRef.current) {
      const delta = deltas.get(wallet.id);
      if (delta) newBalances.set(wallet.id, roundToCents(wallet.balance + delta));
    }

    const previousTransactions = transactionsRef.current;
    const previousWallets = walletsRef.current;
    // T69: see `cloudRevisionRef`.
    const cloudRevisionAtStart = cloudRevisionRef.current;
    // The version this edit was made against, for the server's stale guard -
    // read before the optimistic write below replaces it.
    const expectedUpdatedAt = tx.updatedAt;

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...next, updatedAt: new Date().toISOString() } : t))
    );
    if (newBalances.size > 0) {
      setWallets((prev) =>
        prev.map((w) => (newBalances.has(w.id) ? { ...w, balance: newBalances.get(w.id)! } : w))
      );
    }

    if (!isAuthenticated) return { success: true };

    const undo = async (reread: boolean) => {
      if (cloudRevisionRef.current !== cloudRevisionAtStart) {
        // A realtime reload landed mid-flight, so the snapshot is stale.
        await refreshFromCloud();
        return;
      }
      setTransactions(previousTransactions);
      setWallets(previousWallets);
      if (reread) await refreshFromCloud();
    };

    markLocalWrite(id);
    for (const walletId of deltas.keys()) markLocalWrite(walletId);

    const { data, error } = await supabase.rpc('update_transaction', {
      p_transaction_id: id,
      p_expected_updated_at: expectedUpdatedAt,
      p_type: next.type,
      p_amount: next.amount,
      p_wallet_id: next.walletId,
      p_destination_wallet_id: next.destinationWalletId ?? null,
      p_category_id: next.categoryId ?? null,
      p_description: next.description,
      p_transaction_date: next.transactionDate,
      p_raw_input: next.rawInput ?? null,
    });

    if (error) {
      console.error('[Update Transaction Failed]', error);
      // No legacy fallback (ADR 0033): an edit written as absolute balances
      // could not be made atomic, so it waits for the migration instead.
      if (isMissingRpcError(error)) {
        await undo(false);
        return { success: false, error: 'Editing needs the latest database update. Nothing was changed.' };
      }
      if (error.message === 'TRANSACTION_CHANGED') {
        await undo(true);
        return { success: false, error: 'This transaction changed on another device. Check it and try again.' };
      }
      // ADR 0023: no SQLSTATE means the edit may have committed. Re-read.
      await undo(isUnknownOutcomeError(error));
      return { success: false, error: error.message || 'Database error' };
    }

    const payload = data as UpdateTransactionResult | null;
    if (!payload?.transaction) {
      await undo(true);
      return { success: false, error: 'update_transaction returned an unexpected response' };
    }

    const mapped = mapTransactionRow(payload.transaction);
    setTransactions((prev) => prev.map((t) => (t.id === mapped.id ? mapped : t)));
    const committed = new Map<string, number>();
    for (const row of payload.balances ?? []) {
      const balance = Number(row.balance);
      if (Number.isFinite(balance)) committed.set(row.id, balance);
    }
    if (committed.size > 0) {
      setWallets((prev) => prev.map((w) => (committed.has(w.id) ? { ...w, balance: committed.get(w.id)! } : w)));
    }
    return { success: true };
  }, [isAuthenticated, markLocalWrite, refreshFromCloud]);

  // Bulk CSV Import
  const commitBulkImport = useCallback(async (validRows: ImportRowValidation[], importKey?: string) => {
    // Only active records may be referenced. Importing into a soft-deleted wallet
    // would mutate the balance of a wallet the user has already removed.
    const walletMapByName = new Map<string, Wallet>(
      walletsRef.current.filter((w) => !w.isDeleted).map((w) => [w.name.trim().toLowerCase(), w])
    );
    const categoryMapByName = new Map<string, Category>(
      categoriesRef.current.filter((c) => !c.isDeleted).map((c) => [c.name.trim().toLowerCase(), c])
    );

    const newTxs: Transaction[] = [];
    const dbPayloads: any[] = [];
    // The same rows in `import_transactions`' shape (ADR 0023): ids already
    // resolved, keyed by row index so the server can derive each row's key.
    const rpcRows: Record<string, unknown>[] = [];
    const walletDeltas: Record<string, number> = {};
    // F8 (ADR 0024): the sum of this batch's repayments per debt, for the
    // aggregate guard and the guest decrement.
    const debtTotals: Record<string, number> = {};
    let totalAmt = 0;
    let skippedCount = 0;

    for (const row of validRows) {
      if (!row.isValid) {
        skippedCount += 1;
        continue;
      }

      const sourceWallet = walletMapByName.get(row.walletName.trim().toLowerCase());
      if (!sourceWallet) {
        skippedCount += 1;
        continue;
      }

      const destWallet = row.destinationWalletName
        ? walletMapByName.get(row.destinationWalletName.trim().toLowerCase())
        : undefined;

      // A transfer whose destination cannot be resolved would debit the source and
      // credit nobody, destroying money. Skip the row instead.
      if (row.type === 'TRANSFER' && !destWallet) {
        skippedCount += 1;
        continue;
      }

      // A resolved id wins over the name (ADR 0019): it is what the import
      // preview's two categorization layers and its manual override write, and
      // unlike a name it cannot collide or fail to resolve. The name lookup
      // stays as the fallback for a plain CSV that names its categories.
      const categoryById = row.categoryId
        ? categoriesRef.current.find((c) => c.id === row.categoryId && !c.isDeleted)
        : undefined;
      const cat =
        categoryById ??
        (row.categoryName ? categoryMapByName.get(row.categoryName.trim().toLowerCase()) : undefined);

      // F8 (ADR 0024): a repayment pays off the debt the preview resolved. One
      // whose debt has since been deleted is skipped, like a missing wallet. A
      // repayment row with no debt at all (only reachable by a caller that
      // bypasses the preview) moves the wallet alone, as the server allows.
      const repaidDebt =
        row.type === 'DEBT_REPAYMENT' && row.debtId
          ? debtsRef.current.find((d) => d.id === row.debtId && !d.isDeleted)
          : undefined;
      if (row.type === 'DEBT_REPAYMENT' && row.debtId && !repaidDebt) {
        skippedCount += 1;
        continue;
      }
      if (repaidDebt) {
        debtTotals[repaidDebt.id] = roundToCents((debtTotals[repaidDebt.id] || 0) + row.amount);
      }

      totalAmt += row.amount;

      if (isAuthenticated) {
        dbPayloads.push({
          user_id: currentUser.id,
          wallet_id: sourceWallet.id,
          destination_wallet_id: destWallet?.id || null,
          category_id: cat?.id || null,
          debt_id: repaidDebt?.id ?? null,
          amount: row.amount,
          type: row.type,
          description: row.description,
          transaction_date: row.date,
          idempotency_key: `import-${Date.now()}-${row.rowIndex}`,
          is_deleted: false,
          created_by: currentUser.id,
        });
        rpcRows.push({
          row_index: row.rowIndex,
          wallet_id: sourceWallet.id,
          destination_wallet_id: destWallet?.id ?? null,
          category_id: cat?.id ?? null,
          debt_id: repaidDebt?.id ?? null,
          amount: row.amount,
          type: row.type,
          description: row.description,
          transaction_date: row.date,
        });
      } else {
        const tx: Transaction = {
          id: `tx-import-${Date.now()}-${row.rowIndex}`,
          userId: currentUser.id,
          walletId: sourceWallet.id,
          destinationWalletId: destWallet?.id,
          categoryId: cat?.id,
          debtId: repaidDebt?.id,
          amount: row.amount,
          type: row.type,
          description: row.description,
          transactionDate: row.date,
          idempotencyKey: `import-${Date.now()}-${row.rowIndex}`,
          isDeleted: false,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newTxs.push(tx);
      }

      if (row.type === 'EXPENSE' || row.type === 'DEBT_REPAYMENT' || row.type === 'TRANSFER') {
        walletDeltas[sourceWallet.id] = (walletDeltas[sourceWallet.id] || 0) - row.amount;
      } else if (row.type === 'INCOME' || row.type === 'ADJUSTMENT') {
        walletDeltas[sourceWallet.id] = (walletDeltas[sourceWallet.id] || 0) + row.amount;
      }

      if (row.type === 'TRANSFER' && destWallet) {
        walletDeltas[destWallet.id] = (walletDeltas[destWallet.id] || 0) + row.amount;
      }
    }

    // F8 (ADR 0024): ADR 0016's guard, in aggregate and before anything moves.
    // Two rows that each fit a debt's remainder can still overpay it together.
    // The server re-checks under its row lock; this is the same rule against
    // this client's copy, and the only check the guest path has.
    for (const [debtId, total] of Object.entries(debtTotals)) {
      const target = debtsRef.current.find((d) => d.id === debtId);
      if (target && total > target.remainingAmount) {
        return {
          success: false,
          error: importOverpaymentMessage(target.name, target.remainingAmount),
          insertedCount: 0,
          totalAmount: 0,
          skippedCount,
        };
      }
    }

    if (isAuthenticated && dbPayloads.length > 0) {
      // One atomic RPC (ADR 0023): every row inserted and one RELATIVE update
      // per wallet, in a single database transaction, or nothing at all. It
      // replays on `importKey`, so retrying the same preview after a lost
      // response cannot import twice. A failure therefore has nothing to
      // compensate. The legacy sequence below runs only when the function is
      // missing.
      const { data: rpcData, error: rpcError } = await supabase.rpc('import_transactions', {
        p_import_key: importKey || generateIdempotencyKey(),
        p_rows: rpcRows,
      });

      if (!rpcError || !isMissingRpcError(rpcError)) {
        const payload = rpcData as ImportTransactionsResult | null;
        if (rpcError || !Array.isArray(payload?.inserted_ids)) {
          console.error('[Bulk Import Failed]', rpcError ?? payload);
          // It may have committed. Re-read so the screen shows what the
          // server holds; a retry of this preview replays rather than
          // importing twice.
          if (!rpcError || isUnknownOutcomeError(rpcError)) {
            await refreshFromCloud();
          }
          // The server's aggregate guard, under its row lock: this client's
          // debts were stale. The app formats the money, never SQL.
          const overpaid = rpcError?.message === 'DEBT_OVERPAYMENT';
          if (overpaid) await refreshFromCloud();
          const serverRemaining = Number(rpcError?.details);
          return {
            success: false,
            error: overpaid
              ? importOverpaymentMessage(rpcError?.hint || 'this debt', Number.isFinite(serverRemaining) ? serverRemaining : 0)
              : rpcError?.message || 'import_transactions returned an unexpected response',
            insertedCount: 0,
            totalAmount: 0,
            skippedCount,
          };
        }

        // The inserted rows arrive by reload, as they did before; their
        // realtime echoes coalesce into at most one more.
        await refreshFromCloud();
        return {
          success: true,
          insertedCount: payload!.inserted_ids.length,
          totalAmount: roundToCents(totalAmt),
          skippedCount,
        };
      }
      console.warn('[import_transactions RPC unavailable, using non-atomic fallback]', rpcError.message);

      // The inserted rows' realtime echoes are not suppressed: the explicit
      // `refreshFromCloud()` below reloads this client's state regardless, and
      // the debounced realtime handler coalesces the resulting burst of
      // per-row events into at most one more reload rather than one per row.
      // `.select('id')` is for compensation, not echo suppression.
      //
      // ADR 0022: a rejected insert returns before any balance write - it
      // used to be discarded, so a failed import still moved money - and a
      // balance write that fails after the insert is undone the way
      // `addTransaction` undoes one. Balance writes here are absolute
      // (`walletsRef` + delta) - which is why this is only the fallback for a
      // project without ADR 0023's `import_transactions`.
      let insertedIds: string[] = [];
      let insertCommitted = false;
      const writtenWallets: { id: string; previousBalance: number }[] = [];
      try {
        const { data: insertedRows, error: insertErr } = await supabase
          .from('transactions')
          .insert(dbPayloads)
          .select('id');
        if (insertErr) throw insertErr;
        insertCommitted = true;
        insertedIds = (insertedRows ?? []).map((row: { id: string }) => row.id);

        // Sequential, not `Promise.all`: compensation needs to know exactly
        // which writes landed before the one that failed.
        for (const [wId, delta] of Object.entries(walletDeltas)) {
          const targetW = walletsRef.current.find((w) => w.id === wId);
          if (!targetW) continue;
          markLocalWrite(wId);
          const { error: walletErr } = await supabase
            .from('wallets')
            .update({ balance: roundToCents(targetW.balance + delta) })
            .eq('id', wId);
          if (walletErr) throw walletErr;
          writtenWallets.push({ id: wId, previousBalance: targetW.balance });
        }
      } catch (err: unknown) {
        console.error('[Bulk Import Failed]', err);

        // Nothing to undo when the insert itself was rejected.
        if (insertCommitted) {
          try {
            for (const w of writtenWallets) {
              markLocalWrite(w.id);
              const { error: restoreErr } = await supabase
                .from('wallets')
                .update({ balance: w.previousBalance })
                .eq('id', w.id);
              if (restoreErr) console.error('[Bulk Import Compensation Failed]', restoreErr);
            }
            // Soft delete only - financial records are never hard deleted.
            if (insertedIds.length > 0) {
              const { error: undoErr } = await supabase
                .from('transactions')
                .update({ is_deleted: true, updated_at: new Date().toISOString() })
                .in('id', insertedIds);
              if (undoErr) console.error('[Bulk Import Compensation Failed]', undoErr);
            }
          } catch (compErr) {
            console.error('[Bulk Import Compensation Failed]', compErr);
          }
          await refreshFromCloud();
        }

        const postgrestErr = err as { message?: string; details?: string; hint?: string };
        const detailedError =
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Database error');
        return { success: false, error: detailedError, insertedCount: 0, totalAmount: 0, skippedCount };
      }

      await refreshFromCloud();
      return {
        success: true,
        insertedCount: insertedIds.length,
        totalAmount: roundToCents(totalAmt),
        skippedCount,
      };
    } else {
      setWallets((prev) =>
        prev.map((w) => {
          const delta = walletDeltas[w.id] || 0;
          return delta !== 0 ? { ...w, balance: roundToCents(w.balance + delta) } : w;
        })
      );
      setTransactions((prev) => [...newTxs, ...prev]);
      // F8: the debts move with the rows, with `addTransaction`'s floor and
      // settle rule. The aggregate guard above means the floor never engages.
      if (Object.keys(debtTotals).length > 0) {
        const debtUpdatedAt = new Date().toISOString();
        setDebts((prev) =>
          prev.map((d) => {
            const paid = debtTotals[d.id];
            if (!paid) return d;
            const remaining = Math.max(0, roundToCents(d.remainingAmount - paid));
            return { ...d, remainingAmount: remaining, isSettled: remaining === 0, updatedAt: debtUpdatedAt };
          })
        );
      }
    }

    return {
      success: true,
      insertedCount: newTxs.length,
      totalAmount: roundToCents(totalAmt),
      skippedCount,
    };
  }, [isAuthenticated, currentUser.id, refreshFromCloud, markLocalWrite]);

  // Debts CRUD
  const addDebt = useCallback(async (
    data: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>
  ): Promise<MutationResult> => {
    const validation = DebtSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    if (isAuthenticated) {
      const { data: inserted, error } = await supabase
        .from('debts')
        .insert({
          user_id: currentUser.id,
          name: data.name,
          total_amount: data.totalAmount,
          remaining_amount: data.remainingAmount,
          interest_rate: data.interestRate || 0,
          minimum_payment: data.minimumPayment || 0,
          due_date: data.dueDate || null,
          is_settled: data.remainingAmount <= 0,
          is_deleted: false,
        })
        .select()
        .single();

      if (error || !inserted) {
        return { success: false, error: error?.message || 'Failed to create debt goal' };
      }

      setDebts((prev) => [mapDebtRow(inserted), ...prev]);
      markLocalWrite(inserted.id);
    } else {
      const newDebt: Debt = {
        ...data,
        id: `debt-${Date.now()}`,
        userId: currentUser.id,
        isSettled: data.remainingAmount <= 0,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDebts((prev) => [newDebt, ...prev]);
    }

    return { success: true };
  }, [isAuthenticated, currentUser.id, markLocalWrite]);

  // Phase 60 (ADR 0035): the Debt payoff page's Edit. The debt is read from
  // the ref before any state moves (ADR 0022), so the remainder the schema
  // checks Borrowed against is the one on screen. The update names only the
  // edited columns: `remaining_amount` and `is_settled` are never sent, so an
  // edit cannot overwrite a repayment that landed after this device loaded.
  const editDebt = useCallback(async (debtId: string, details: DebtEdit): Promise<MutationResult> => {
    const debt = debtsRef.current.find((d) => d.id === debtId && !d.isDeleted);
    if (!debt) return { success: false, error: 'Debt not found or has been deleted' };
    const validation = DebtEditSchema.safeParse({ ...details, remainingAmount: Number(debt.remainingAmount) });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    const { name, totalAmount, interestRate, minimumPayment, dueDate } = validation.data;
    // A zero rate or minimum reads back as absent (`mapDebtRow`), so it is
    // stored that way here too.
    const edited = {
      name,
      totalAmount,
      interestRate: interestRate || undefined,
      minimumPayment: minimumPayment || undefined,
      dueDate: dueDate || undefined,
    };

    const previousDebts = debtsRef.current;
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, ...edited, updatedAt: new Date().toISOString() } : d))
    );

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(debtId);
      const { error } = await supabase
        .from('debts')
        .update({
          name: edited.name,
          total_amount: edited.totalAmount,
          interest_rate: edited.interestRate ?? 0,
          minimum_payment: edited.minimumPayment ?? 0,
          due_date: edited.dueDate ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', debtId);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Edit Debt Failed]', err);
      setDebts(previousDebts);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to update debt'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  const settleDebt = useCallback(async (debtId: string): Promise<MutationResult> => {
    const previousDebts = debtsRef.current;

    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, remainingAmount: 0, isSettled: true, updatedAt: new Date().toISOString() } : d))
    );

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(debtId);
      const { error } = await supabase
        .from('debts')
        .update({ remaining_amount: 0, is_settled: true, updated_at: new Date().toISOString() })
        .eq('id', debtId);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Settle Debt Failed]', err);
      setDebts(previousDebts);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to settle debt'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  const deleteDebt = useCallback(async (debtId: string): Promise<MutationResult> => {
    const previousDebts = debtsRef.current;

    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, isDeleted: true, updatedAt: new Date().toISOString() } : d))
    );

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(debtId);
      const { error } = await supabase
        .from('debts')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', debtId);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Delete Debt Failed]', err);
      setDebts(previousDebts);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to delete debt'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  // Holistic Diary CRUD
  const upsertDiaryEntry = useCallback(async (
    entryData: Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ): Promise<MutationResult> => {
    const validation = DiarySchema.safeParse(entryData);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    if (isAuthenticated) {
      const existing = diaryEntriesRef.current.find((e) => e.date === entryData.date && !e.isDeleted);
      const { data: upserted, error } = existing
        ? await supabase
            .from('diary_entries')
            .update({
              mood: entryData.mood,
              workout: entryData.workout,
              workout_note: entryData.workoutNote || null,
              food_quality: entryData.foodQuality,
              notes: entryData.notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single()
        : await supabase
            .from('diary_entries')
            .insert({
              user_id: currentUser.id,
              date: entryData.date,
              mood: entryData.mood,
              workout: entryData.workout,
              workout_note: entryData.workoutNote || null,
              food_quality: entryData.foodQuality,
              notes: entryData.notes || null,
            })
            .select()
            .single();

      if (error) {
        return { success: false, error: error.message || 'Failed to save diary entry' };
      }

      markLocalWrite(existing?.id ?? upserted?.id);
      await refreshFromCloud();
    } else {
      setDiaryEntries((prev) => {
        const existingIdx = prev.findIndex((e) => e.date === entryData.date && !e.isDeleted);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            ...entryData,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        } else {
          const newEntry: DiaryEntry = {
            ...entryData,
            id: `diary-${Date.now()}`,
            userId: currentUser.id,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return [newEntry, ...prev];
        }
      });
    }

    return { success: true };
  }, [isAuthenticated, currentUser.id, refreshFromCloud, markLocalWrite]);

  const deleteDiaryEntry = useCallback(async (id: string): Promise<MutationResult> => {
    const previousDiaryEntries = diaryEntriesRef.current;

    setDiaryEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isDeleted: true, updatedAt: new Date().toISOString() } : e))
    );

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(id);
      const { error } = await supabase
        .from('diary_entries')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Delete Diary Entry Failed]', err);
      setDiaryEntries(previousDiaryEntries);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to delete diary entry'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);

  // Memoised so the provider only hands consumers a new object when something they
  // can actually observe has changed. Without this, every render of the provider
  // produced a fresh value and re-rendered every consumer, defeating the React.memo
  // and useCallback layers throughout the app.
  //
  // The value is split in two so the two halves can invalidate independently: this
  // one carries only state now. Before T15 it also carried the six volatile
  // mutators; those have all moved to `actionsValue` below, so this memo changes
  // identity only when a state member itself changes, never on the six mutators'
  // account (they no longer have hot-state deps to change on).
  const stateValue = useMemo(
    () => ({
      currentUser,
      isAuthenticated,
      isSyncing,
      syncError,
      wallets,
      totalNetWorth,
      categories,
      keywordRules,
      presets,
      transactions,
      debts,
      diaryEntries,
      showSoftDeleted,
    }),
    [
      currentUser,
      isAuthenticated,
      isSyncing,
      syncError,
      wallets,
      totalNetWorth,
      categories,
      keywordRules,
      presets,
      transactions,
      debts,
      diaryEntries,
      showSoftDeleted,
    ]
  );

  // The stable half. Every dependency here is a `useCallback` keyed on `[]`,
  // `[isAuthenticated]`, `[currentUser.id]`, another already-stable callback, or
  // the `useState` setter, so this object's identity survives a ledger write and
  // a consumer reading only actions does not re-render because of one.
  //
  // `addTransaction`, `softDeleteTransaction`, `restoreTransaction`,
  // `commitBulkImport`, and `upsertDiaryEntry` joined this half in T15.
  //
  // `updateWallet` is deliberately absent from this object (T64): callers get
  // the narrow `deleteWallet`, `editWallet` and `setWalletArchived` instead,
  // so no screen can send a wallet's balance as a column write.
  const actionsValue = useMemo(
    () => ({
      listMySessions,
      signOutOtherDevices,
      signOut,
      deleteAccount,
      restoreBackup,
      addWallet,
      deleteWallet,
      editWallet,
      setWalletArchived,
      addCategory,
      updateCategory,
      deleteCategory,
      addKeywordRule,
      deleteKeywordRule,
      addPreset,
      updatePreset,
      deletePreset,
      applyPreset,
      addTransaction,
      softDeleteTransaction,
      restoreTransaction,
      updateTransaction,
      commitBulkImport,
      addDebt,
      editDebt,
      settleDebt,
      deleteDebt,
      upsertDiaryEntry,
      deleteDiaryEntry,
      setShowSoftDeleted,
      refreshFromCloud,
    }),
    [
      listMySessions,
      signOutOtherDevices,
      signOut,
      deleteAccount,
      restoreBackup,
      addWallet,
      deleteWallet,
      editWallet,
      setWalletArchived,
      addCategory,
      updateCategory,
      deleteCategory,
      addKeywordRule,
      deleteKeywordRule,
      addPreset,
      updatePreset,
      deletePreset,
      applyPreset,
      addTransaction,
      softDeleteTransaction,
      restoreTransaction,
      updateTransaction,
      commitBulkImport,
      addDebt,
      editDebt,
      settleDebt,
      deleteDebt,
      upsertDiaryEntry,
      deleteDiaryEntry,
      refreshFromCloud,
    ]
  );

  // Actions is the outer provider: its value is the one that almost never changes,
  // so React can bail out of re-rendering that subtree's consumers independently of
  // the state provider nested inside it.
  return (
    <FinanceActionsContext.Provider value={actionsValue}>
      <FinanceStateContext.Provider value={stateValue}>
        {children}
      </FinanceStateContext.Provider>
    </FinanceActionsContext.Provider>
  );
};

// The return types below are annotated explicitly rather than inferred. `useContext`
// comes from React's untyped JS fallback when React type definitions are absent,
// which makes an inferred return type collapse to `any` and silently disables type
// checking in every consumer of these hooks.

/** Subscribe to the volatile half. Re-renders the caller on every ledger write. */
export function useFinanceState(): FinanceStateContextType {
  const context = useContext(FinanceStateContext);
  if (!context) {
    throw new Error('useFinanceState must be used within a FinanceProvider');
  }
  return context;
}

/** Subscribe to the stable half. Does not re-render the caller on a ledger write. */
export function useFinanceActions(): FinanceActionsContextType {
  const context = useContext(FinanceActionsContext);
  if (!context) {
    throw new Error('useFinanceActions must be used within a FinanceProvider');
  }
  return context;
}
