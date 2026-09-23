import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import {
  User,
  SessionDevice,
  Wallet,
  Category,
  KeywordRule,
  Transaction,
  Debt,
  DiaryEntry,
  ImportRowValidation,
  TransactionType,
  Preset,
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  TransactionSchema,
  WalletSchema,
  DebtSchema,
  DiarySchema,
  KeywordMappingSchema,
  CategorySchema,
  PresetSchema,
  formatZodIssues,
} from '../utils/zodSchemas';
import { APP_CURRENCY } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { dedupeCategoriesByName, withDefaultDescriptions } from '../utils/categoryUtils';
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
  sessions: SessionDevice[];
  currentSession: SessionDevice | null;

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
  revokeSession: (sessionId: string) => void;
  revokeAllOtherSessions: () => void;
  signOut: () => Promise<void>;

  // Wallets
  // `balance` is omitted: the opening balance is supplied via `initialBalance`.
  addWallet: (wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted' | 'balance'>, initialBalance: number) => Promise<MutationResult>;
  deleteWallet: (id: string) => Promise<MutationResult>;

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
  commitBulkImport: (validRows: ImportRowValidation[]) => Promise<{ insertedCount: number; totalAmount: number; skippedCount: number }>;

  // Debts
  addDebt: (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => Promise<MutationResult>;
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

// Money helper: all balances are Decimal(15,2), so every arithmetic result is
// normalised back to whole cents to avoid float drift accumulating in the ledger.
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
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

// True only when the RPC itself is absent, i.e. the migration has not been
// applied yet. Deliberately narrow: any other database error must surface and
// trigger a rollback rather than silently falling back to the legacy path.
function isMissingRpcError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42883' || err.code === 'PGRST202') return true;
  return (err.message || '').toLowerCase().includes('could not find the function');
}

// Device detection helper for Active Authorized Sessions
function detectCurrentDevice(): { deviceName: string; userAgent: string; deviceFingerprint: string; ipAddress: string } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Web Client';
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone/i.test(ua)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(ua)) os = 'iPad (iPadOS)';
  else if (/Android/i.test(ua)) os = 'Android Device';
  else if (/Linux/i.test(ua)) os = 'Linux Workstation';

  let browser = 'Web Browser';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Microsoft Edge';

  let deviceFingerprint = '';
  try {
    deviceFingerprint = localStorage.getItem('pf_device_fingerprint') || '';
    if (!deviceFingerprint) {
      deviceFingerprint = 'fp-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem('pf_device_fingerprint', deviceFingerprint);
    }
  } catch {
    deviceFingerprint = 'fp-client-session';
  }

  return {
    deviceName: `${browser} on ${os}`,
    userAgent: ua,
    deviceFingerprint,
    ipAddress: '127.0.0.1 (Current Client)',
  };
}

// Helper to initialize session list with current device guaranteed
function initializeSessionList(userId: string): SessionDevice[] {
  const saved = safeGetLocalStorage<SessionDevice[]>('pf_sessions', []);
  const dev = detectCurrentDevice();
  const currentId = `sess-${dev.deviceFingerprint}`;

  const hasCurrent = saved.some((s) => s.id === currentId && !s.revokedAt);
  if (hasCurrent) {
    return saved.map((s) => ({
      ...s,
      isCurrent: s.id === currentId,
      lastActiveAt: s.id === currentId ? new Date().toISOString() : s.lastActiveAt,
    }));
  }

  const currentSess: SessionDevice = {
    id: currentId,
    userId: userId || 'usr-guest-01',
    deviceFingerprint: dev.deviceFingerprint,
    deviceName: dev.deviceName,
    ipAddress: dev.ipAddress,
    userAgent: dev.userAgent,
    isTrusted: true,
    isCurrent: true,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  return [currentSess, ...saved.filter((s) => s.id !== currentId)];
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
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#f87171', description: 'Eating out, restaurants, street food, cafes, coffee, snacks, bars and food delivery.', isSystem: true, isDeleted: false },
  { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#fb923c', description: 'Supermarket, market and convenience-store runs for food and household supplies cooked or used at home.', isSystem: true, isDeleted: false },
  { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'car', color: '#facc15', description: 'Petrol, taxis, ride-hailing, trains, buses, parking, tolls and vehicle servicing.', isSystem: true, isDeleted: false },
  { id: 'cat-shopping', name: 'Shopping & Apparel', type: 'EXPENSE', icon: 'shopping-bag', color: '#a78bfa', description: 'Clothes, shoes, electronics, gadgets, homeware, gifts and other one-off personal purchases.', isSystem: true, isDeleted: false },
  { id: 'cat-housing', name: 'Housing & Utilities', type: 'EXPENSE', icon: 'home', color: '#38bdf8', description: 'Rent, electricity, water, internet and phone bills, insurance, and recurring subscriptions like Netflix or Spotify.', isSystem: true, isDeleted: false },
  { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'briefcase', color: '#4ade80', description: 'Regular wages, monthly salary, payroll and bonuses from a main employer.', isSystem: true, isDeleted: false },
  { id: 'cat-freelance', name: 'Freelance & Side Gig', type: 'INCOME', icon: 'laptop', color: '#34d399', description: 'Client work, commissions, side-project earnings, tips, refunds and money received outside a regular salary.', isSystem: true, isDeleted: false },
  { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'credit-card', color: '#f43f5e', description: 'Payments made against a tracked loan or credit-card balance.', isSystem: true, isDeleted: false },
  { id: 'cat-adjust', name: 'Balance Adjustment', type: 'ADJUSTMENT', icon: 'sliders', color: '#94a3b8', description: 'Manual corrections that reconcile a wallet balance to its real-world value.', isSystem: true, isDeleted: false },
];

const DEFAULT_STARTER_WALLETS: Wallet[] = [
  {
    id: 'wal-main-checking',
    userId: 'usr-guest-01',
    name: 'Main Checking',
    type: 'BANK_ACCOUNT',
    currency: APP_CURRENCY,
    balance: 2500.0,
    color: '#0284c7',
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
    balance: 150.0,
    color: '#16a34a',
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
    balance: 5000.0,
    color: '#7c3aed',
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

const DEFAULT_STARTER_DEBTS: Debt[] = [
  {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => safeGetLocalStorage('pf_user', DEFAULT_USER));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [wallets, setWallets] = useState<Wallet[]>(() => safeGetLocalStorage('pf_wallets', DEFAULT_STARTER_WALLETS));
  const [categories, setCategories] = useState<Category[]>(() =>
    withDefaultDescriptions(
      dedupeCategoriesByName(safeGetLocalStorage('pf_categories', DEFAULT_SYSTEM_CATEGORIES)),
      DEFAULT_SYSTEM_CATEGORIES
    )
  );
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>(() => safeGetLocalStorage('pf_keywords', DEFAULT_KEYWORD_RULES));
  // Local-only, like `sessions`: no `presets` table exists in the Supabase
  // migrations, so these never leave `localStorage` regardless of
  // `isAuthenticated` - unlike `categories`/`keywordRules`, which sync when
  // authenticated. A template is a personal shortcut, not shared ledger data.
  const [presets, setPresets] = useState<Preset[]>(() => safeGetLocalStorage('pf_presets', []));
  const [transactions, setTransactions] = useState<Transaction[]>(() => safeGetLocalStorage('pf_transactions', []));
  const [debts, setDebts] = useState<Debt[]>(() => safeGetLocalStorage('pf_debts', DEFAULT_STARTER_DEBTS));
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => safeGetLocalStorage('pf_diary', []));

  const [sessions, setSessions] = useState<SessionDevice[]>(() => initializeSessionList(currentUser.id));
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
    if (didMountRef.current) scheduleStorageWrite('pf_sessions', sessions);
  }, [sessions, scheduleStorageWrite]);

  useEffect(() => {
    didMountRef.current = true;
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

  // Net Worth aggregation
  const totalNetWorth = useMemo(() => {
    return wallets
      .filter((w) => !w.isDeleted && !w.isArchived)
      .reduce((sum, w) => sum + Number(w.balance || 0), 0);
  }, [wallets]);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.isCurrent && !s.revokedAt) || null;
  }, [sessions]);

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
  // category picker. This ref makes the insert step itself race-proof
  // regardless of how many times it's triggered.
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

  // Seed initial starter account on Supabase if new user
  const seedInitialUserAccount = useCallback(async (userId: string) => {
    if (isSeedingRef.current) return;
    isSeedingRef.current = true;
    try {
      // 1. Create starter wallets
      await supabase
        .from('wallets')
        .insert([
          {
            user_id: userId,
            name: 'Checking Account',
            type: 'BANK_ACCOUNT',
            currency: APP_CURRENCY,
            balance: 2500.0,
            color: '#0284c7',
            icon: 'landmark',
          },
          {
            user_id: userId,
            name: 'Cash Wallet',
            type: 'CASH',
            currency: APP_CURRENCY,
            balance: 150.0,
            color: '#16a34a',
            icon: 'banknote',
          },
          {
            user_id: userId,
            name: 'Savings Reserve',
            type: 'SAVINGS',
            currency: APP_CURRENCY,
            balance: 8000.0,
            color: '#7c3aed',
            icon: 'piggy-bank',
          },
        ])
        .select();

      // 2. Insert standard categories for user.
      //
      // `description` is deliberately NOT written here. Leaving the column NULL
      // keeps the shipped default live: `withDefaultDescriptions` supplies the
      // current wording on every load, so improving a default's criteria text
      // reaches existing accounts on their next reload instead of being frozen
      // at whatever shipped the day they signed up. The column only ever holds
      // a description the user typed themselves. See ADR 0012.
      await supabase
        .from('categories')
        .insert(
          DEFAULT_SYSTEM_CATEGORIES.map((c) => ({
            user_id: userId,
            name: c.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
            is_system: true,
          }))
        )
        .select();

      // Refresh data
      await loadSupabaseDataRef.current?.(userId);
    } catch (err) {
      console.error('[Seed Error]', err);
    } finally {
      isSeedingRef.current = false;
    }
  }, []);

  // Fetch all user data from Supabase
  const loadSupabaseData = useCallback(async (userId: string) => {
    setIsSyncing(true);
    try {
      // 1. Wallets
      const { data: wData, error: wErr } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!wErr && wData) {
        const mappedWallets: Wallet[] = wData.map(mapWalletRow);
        setWallets(mappedWallets);

        // Auto-seed default wallet if account is completely empty
        if (mappedWallets.length === 0) {
          await seedInitialUserAccount(userId);
          return;
        }
      }

      // 2. Categories
      const { data: cData, error: cErr } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

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

      if (!dErr && dData) {
        setDebts(dData.map(mapDebtRow));
      }

      // 5. Transactions
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!txErr && txData) {
        setTransactions(txData.map(mapTransactionRow));
      }

      // 6. Diary Entries
      const { data: diaryData, error: diaryErr } = await supabase
        .from('diary_entries')
        .select('*')
        .order('date', { ascending: false });

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

      cloudRevisionRef.current += 1;
    } catch (err) {
      console.error('[Supabase Sync Error]', err);
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

    const setupAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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

      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
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

    setupAuth();

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, [loadSupabaseData]);

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
  useEffect(() => {
    if (!isAuthenticated || !currentUser.id) return;

    const REALTIME_RELOAD_DEBOUNCE_MS = 400;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        loadSupabaseDataRef.current?.(currentUser.id);
      }, REALTIME_RELOAD_DEBOUNCE_MS);
    };

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
    ).subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser.id]);

  const refreshFromCloud = useCallback(async () => {
    if (currentUser.id) {
      await loadSupabaseData(currentUser.id);
    }
  }, [currentUser.id, loadSupabaseData]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setCurrentUser(DEFAULT_USER);
  }, []);

  // Sessions handling
  const revokeSession = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, revokedAt: new Date().toISOString() } : s))
    );
  }, []);

  const revokeAllOtherSessions = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) => (!s.isCurrent ? { ...s, revokedAt: new Date().toISOString() } : s))
    );
  }, []);

  // Wallets CRUD
  const addWallet = useCallback(async (
    data: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted' | 'balance'>,
    initialBalance: number
  ): Promise<MutationResult> => {
    const validation = WalletSchema.safeParse({ ...data, initialBalance });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    if (isAuthenticated) {
      const { data: inserted, error } = await supabase
        .from('wallets')
        .insert({
          user_id: currentUser.id,
          name: data.name,
          type: data.type,
          currency: data.currency,
          balance: initialBalance,
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

      setWallets((prev) => [...prev, mapWalletRow(inserted)]);
      markLocalWrite(inserted.id);

      if (initialBalance > 0) {
        await supabase.from('transactions').insert({
          user_id: currentUser.id,
          wallet_id: inserted.id,
          amount: initialBalance,
          raw_input: initialBalance.toString(),
          type: 'ADJUSTMENT',
          description: `Initial balance setup for ${data.name}`,
          transaction_date: todayIsoDate(),
          idempotency_key: `init-${inserted.id}`,
          is_deleted: false,
          created_by: currentUser.id,
        });
      }
    } else {
      const newWalletId = `w-${Date.now()}`;
      const newWallet: Wallet = {
        ...data,
        id: newWalletId,
        userId: currentUser.id,
        balance: initialBalance,
        isArchived: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setWallets((prev) => [...prev, newWallet]);
    }

    return { success: true };
  }, [isAuthenticated, currentUser.id, markLocalWrite]);

  // Provider-internal helper (T64: not on the public actions context - its
  // only caller is `deleteWallet` below). Snapshots for rollback and checks
  // the Supabase result rather than discarding it (T66), matching
  // `addTransaction`'s established error/rollback shape.
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
      const { error } = await supabase
        .from('wallets')
        .update({
          name: updates.name,
          type: updates.type,
          currency: updates.currency,
          color: updates.color,
          icon: updates.icon,
          is_archived: updates.isArchived,
          is_deleted: updates.isDeleted,
          balance: updates.balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
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

    // Optimistic debt calculation
    if (data.type === 'DEBT_REPAYMENT' && data.debtId) {
      setDebts((prev) =>
        prev.map((d) => {
          if (d.id === data.debtId) {
            const newRem = Math.max(0, roundToCents(d.remainingAmount - data.amount));
            return {
              ...d,
              remainingAmount: newRem,
              isSettled: newRem === 0,
              updatedAt: new Date().toISOString(),
            };
          }
          return d;
        })
      );
    }

    // Track which remote writes committed so a mid-sequence failure can be undone.
    let insertedTxId: string | null = null;
    let sourceDebited = false;
    let destCredited = false;

    try {
      if (isAuthenticated) {
        // Transfers go through a single database transaction. The RPC locks both
        // wallets, applies relative balance updates and inserts the ledger row
        // atomically, so a partial failure cannot debit one side without
        // crediting the other.
        if (data.type === 'TRANSFER' && destWallet) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('transfer_funds', {
            p_user_id: currentUser.id,
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

        // Update debt in Supabase and check errors
        if (data.type === 'DEBT_REPAYMENT' && data.debtId) {
          const targetDebt = debtsRef.current.find((d) => d.id === data.debtId);
          if (targetDebt) {
            const updatedRem = Math.max(0, roundToCents(targetDebt.remainingAmount - data.amount));
            markLocalWrite(data.debtId);
            const { error: dErr } = await supabase.from('debts').update({
              remaining_amount: updatedRem,
              is_settled: updatedRem === 0,
              updated_at: new Date().toISOString(),
            }).eq('id', data.debtId);
            if (dErr) throw dErr;
          }
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
  }, [currentUser.id, isAuthenticated, markLocalWrite, refreshFromCloud]);

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

    try {
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

      // Compensate any remote wallet writes that already committed - the two
      // wallet writes and the flag write are not a single database
      // transaction, so a failure part-way through leaves a wallet balance
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
      } catch (compErr) {
        console.error('[Set Transaction Deleted Compensation Failed]', compErr);
      }

      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      const detailedError =
        postgrestErr?.message ||
        postgrestErr?.details ||
        postgrestErr?.hint ||
        (err instanceof Error ? err.message : 'Database error');
      return { success: false, error: detailedError };
    }
  }, [isAuthenticated, markLocalWrite]);

  const softDeleteTransaction = useCallback(
    (id: string) => setTransactionDeleted(id, true),
    [setTransactionDeleted]
  );

  const restoreTransaction = useCallback(
    (id: string) => setTransactionDeleted(id, false),
    [setTransactionDeleted]
  );

  // Bulk CSV Import
  const commitBulkImport = useCallback(async (validRows: ImportRowValidation[]) => {
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
    const walletDeltas: Record<string, number> = {};
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

      const cat = row.categoryName
        ? categoryMapByName.get(row.categoryName.trim().toLowerCase())
        : undefined;

      totalAmt += row.amount;

      if (isAuthenticated) {
        dbPayloads.push({
          user_id: currentUser.id,
          wallet_id: sourceWallet.id,
          destination_wallet_id: destWallet?.id || null,
          category_id: cat?.id || null,
          amount: row.amount,
          type: row.type,
          description: row.description,
          transaction_date: row.date,
          idempotency_key: `import-${Date.now()}-${row.rowIndex}`,
          is_deleted: false,
          created_by: currentUser.id,
        });
      } else {
        const tx: Transaction = {
          id: `tx-import-${Date.now()}-${row.rowIndex}`,
          userId: currentUser.id,
          walletId: sourceWallet.id,
          destinationWalletId: destWallet?.id,
          categoryId: cat?.id,
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

    if (isAuthenticated && dbPayloads.length > 0) {
      // The batch insert has no `.select()`, so the inserted transactions'
      // server-generated ids are never learned client-side - they cannot be
      // added to `recentLocalWriteIds` and their own realtime echoes are not
      // suppressed. The explicit `refreshFromCloud()` below already reloads
      // this client's state regardless, and the debounced realtime handler
      // coalesces the resulting burst of per-row events into at most one more
      // reload rather than one per inserted row.
      await supabase.from('transactions').insert(dbPayloads);
      await Promise.all(
        Object.entries(walletDeltas).map(async ([wId, delta]) => {
          const targetW = walletsRef.current.find((w) => w.id === wId);
          if (targetW) {
            const updatedB = roundToCents(targetW.balance + delta);
            markLocalWrite(wId);
            await supabase.from('wallets').update({ balance: updatedB }).eq('id', wId);
          }
        })
      );
      await refreshFromCloud();
    } else {
      setWallets((prev) =>
        prev.map((w) => {
          const delta = walletDeltas[w.id] || 0;
          return delta !== 0 ? { ...w, balance: roundToCents(w.balance + delta) } : w;
        })
      );
      setTransactions((prev) => [...newTxs, ...prev]);
    }

    return {
      insertedCount: dbPayloads.length || newTxs.length,
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
      sessions,
      currentSession,
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
      sessions,
      currentSession,
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
  // `updateWallet` is deliberately absent from this object (T64): it has no
  // external caller, only `deleteWallet` (below) uses it internally, so it
  // stays a provider-local helper instead of public API surface.
  const actionsValue = useMemo(
    () => ({
      revokeSession,
      revokeAllOtherSessions,
      signOut,
      addWallet,
      deleteWallet,
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
      commitBulkImport,
      addDebt,
      settleDebt,
      deleteDebt,
      upsertDiaryEntry,
      deleteDiaryEntry,
      setShowSoftDeleted,
      refreshFromCloud,
    }),
    [
      revokeSession,
      revokeAllOtherSessions,
      signOut,
      addWallet,
      deleteWallet,
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
      commitBulkImport,
      addDebt,
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
