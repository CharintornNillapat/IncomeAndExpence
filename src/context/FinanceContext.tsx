import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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
} from '../types';
import { supabase } from '../lib/supabase';

interface FinanceContextType {
  // Auth & Security
  currentUser: User;
  isAuthenticated: boolean;
  isSyncing: boolean;
  sessions: SessionDevice[];
  currentSession: SessionDevice | null;
  revokeSession: (sessionId: string) => void;
  revokeAllOtherSessions: () => void;
  simulateNewDeviceLogin: (email: string) => { requiresOtp: boolean; message: string };
  triggerOtpChallenge: () => void;
  verifyOtp: (code: string) => boolean;
  verifyOtpCode: (code: string) => boolean;
  otpPending: boolean;
  activeOtpCode: string;
  signOut: () => Promise<void>;

  // Wallets
  wallets: Wallet[];
  totalNetWorth: number;
  addWallet: (wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>, initialBalance: number) => Promise<void>;
  updateWallet: (id: string, updates: Partial<Wallet>) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;

  // Categories & Configurable Keyword Rules
  categories: Category[];
  keywordRules: KeywordRule[];
  addKeywordRule: (keyword: string, categoryId: string) => Promise<void>;
  deleteKeywordRule: (id: string) => Promise<void>;

  // Transactions
  transactions: Transaction[];
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
  }) => Promise<{ success: boolean; error?: string }>;
  softDeleteTransaction: (id: string) => Promise<void>;
  restoreTransaction: (id: string) => Promise<void>;
  commitBulkImport: (validRows: ImportRowValidation[]) => Promise<{ insertedCount: number; totalAmount: number }>;

  // Debts
  debts: Debt[];
  addDebt: (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => Promise<void>;
  repayDebtAtomic: (debtId: string, walletId: string, amount: number, note?: string) => Promise<{ success: boolean; error?: string }>;
  settleDebt: (debtId: string) => Promise<void>;
  deleteDebt: (debtId: string) => Promise<void>;

  // Holistic Diary
  diaryEntries: DiaryEntry[];
  upsertDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<void>;
  deleteDiaryEntry: (id: string) => Promise<void>;

  // Filters & State helpers
  showSoftDeleted: boolean;
  setShowSoftDeleted: (show: boolean) => void;
  refreshFromCloud: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

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

const DEFAULT_SYSTEM_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#f87171', isSystem: true, isDeleted: false },
  { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#fb923c', isSystem: true, isDeleted: false },
  { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'car', color: '#facc15', isSystem: true, isDeleted: false },
  { id: 'cat-shopping', name: 'Shopping & Apparel', type: 'EXPENSE', icon: 'shopping-bag', color: '#a78bfa', isSystem: true, isDeleted: false },
  { id: 'cat-housing', name: 'Housing & Utilities', type: 'EXPENSE', icon: 'home', color: '#38bdf8', isSystem: true, isDeleted: false },
  { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'briefcase', color: '#4ade80', isSystem: true, isDeleted: false },
  { id: 'cat-freelance', name: 'Freelance & Side Gig', type: 'INCOME', icon: 'laptop', color: '#34d399', isSystem: true, isDeleted: false },
  { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'credit-card', color: '#f43f5e', isSystem: true, isDeleted: false },
  { id: 'cat-adjust', name: 'Balance Adjustment', type: 'ADJUSTMENT', icon: 'sliders', color: '#94a3b8', isSystem: true, isDeleted: false },
];

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => safeGetLocalStorage('pf_user', DEFAULT_USER));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [wallets, setWallets] = useState<Wallet[]>(() => safeGetLocalStorage('pf_wallets', []));
  const [categories, setCategories] = useState<Category[]>(() => safeGetLocalStorage('pf_categories', DEFAULT_SYSTEM_CATEGORIES));
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>(() => safeGetLocalStorage('pf_keywords', []));
  const [transactions, setTransactions] = useState<Transaction[]>(() => safeGetLocalStorage('pf_transactions', []));
  const [debts, setDebts] = useState<Debt[]>(() => safeGetLocalStorage('pf_debts', []));
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => safeGetLocalStorage('pf_diary', []));

  const [sessions, setSessions] = useState<SessionDevice[]>(() => initializeSessionList(currentUser.id));
  const [showSoftDeleted, setShowSoftDeleted] = useState<boolean>(false);

  // OTP State
  const [otpPending, setOtpPending] = useState<boolean>(false);
  const [activeOtpCode, setActiveOtpCode] = useState<string>('123456');

  // Cache state to localStorage for instant offline access
  useEffect(() => {
    localStorage.setItem('pf_wallets', JSON.stringify(wallets));
  }, [wallets]);
  useEffect(() => {
    localStorage.setItem('pf_categories', JSON.stringify(categories));
  }, [categories]);
  useEffect(() => {
    localStorage.setItem('pf_keywords', JSON.stringify(keywordRules));
  }, [keywordRules]);
  useEffect(() => {
    localStorage.setItem('pf_transactions', JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    localStorage.setItem('pf_debts', JSON.stringify(debts));
  }, [debts]);
  useEffect(() => {
    localStorage.setItem('pf_diary', JSON.stringify(diaryEntries));
  }, [diaryEntries]);
  useEffect(() => {
    localStorage.setItem('pf_user', JSON.stringify(currentUser));
  }, [currentUser]);
  useEffect(() => {
    localStorage.setItem('pf_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Net Worth aggregation
  const totalNetWorth = useMemo(() => {
    return wallets
      .filter((w) => !w.isDeleted && !w.isArchived)
      .reduce((sum, w) => sum + Number(w.balance || 0), 0);
  }, [wallets]);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.isCurrent && !s.revokedAt) || null;
  }, [sessions]);

  // Fetch all user data from Supabase
  const loadSupabaseData = async (userId: string) => {
    setIsSyncing(true);
    try {
      // 1. Wallets
      const { data: wData, error: wErr } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!wErr && wData) {
        const mappedWallets: Wallet[] = wData.map((row) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          type: row.type,
          currency: row.currency || 'USD',
          balance: parseFloat(row.balance) || 0,
          color: row.color || 'stone',
          icon: row.icon || 'wallet',
          isArchived: row.is_archived || false,
          isDeleted: row.is_deleted || false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
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
          isSystem: row.is_system || false,
          isDeleted: row.is_deleted || false,
        }));
        setCategories(mappedCategories);
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
        setDebts(
          dData.map((row) => ({
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
          }))
        );
      }

      // 5. Transactions
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!txErr && txData) {
        setTransactions(
          txData.map((row) => ({
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
          }))
        );
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
    } catch (err) {
      console.error('[Supabase Sync Error]', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Seed initial starter account on Supabase if new user
  const seedInitialUserAccount = async (userId: string) => {
    try {
      // 1. Create starter wallets
      const { data: newWallets } = await supabase
        .from('wallets')
        .insert([
          {
            user_id: userId,
            name: 'Checking Account',
            type: 'BANK_ACCOUNT',
            currency: 'USD',
            balance: 2500.0,
            color: '#0284c7',
            icon: 'landmark',
          },
          {
            user_id: userId,
            name: 'Cash Wallet',
            type: 'CASH',
            currency: 'USD',
            balance: 150.0,
            color: '#16a34a',
            icon: 'banknote',
          },
          {
            user_id: userId,
            name: 'Savings Reserve',
            type: 'SAVINGS',
            currency: 'USD',
            balance: 8000.0,
            color: '#7c3aed',
            icon: 'piggy-bank',
          },
        ])
        .select();

      // 2. Insert standard categories for user
      const { data: newCategories } = await supabase
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
      await loadSupabaseData(userId);
    } catch (err) {
      console.error('[Seed Error]', err);
    }
  };

  // Listen to Supabase Auth state changes
  useEffect(() => {
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

      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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
  }, []);

  // Real-time Subscriptions across all tables for Cross-Device Sync (PC <-> Phone)
  useEffect(() => {
    if (!isAuthenticated || !currentUser.id) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets' },
        () => {
          loadSupabaseData(currentUser.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          loadSupabaseData(currentUser.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts' },
        () => {
          loadSupabaseData(currentUser.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'diary_entries' },
        () => {
          loadSupabaseData(currentUser.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          loadSupabaseData(currentUser.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser.id]);

  const refreshFromCloud = async () => {
    if (currentUser.id) {
      await loadSupabaseData(currentUser.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(DEFAULT_USER);
  };

  // Sessions handling
  const revokeSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, revokedAt: new Date().toISOString() } : s))
    );
  };

  const revokeAllOtherSessions = () => {
    setSessions((prev) =>
      prev.map((s) => (!s.isCurrent ? { ...s, revokedAt: new Date().toISOString() } : s))
    );
  };

  const triggerOtpChallenge = () => {
    setActiveOtpCode('123456');
    setOtpPending(true);
  };

  const simulateNewDeviceLogin = (email: string) => {
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setActiveOtpCode(randomOtp);
    setOtpPending(true);
    return {
      requiresOtp: true,
      message: `Unrecognized device detected. 6-digit OTP sent to ${email} (Demo Code: ${randomOtp})`,
    };
  };

  const verifyOtp = (code: string) => {
    if (code.trim() === activeOtpCode || code.trim() === '123456') {
      setOtpPending(false);
      return true;
    }
    return false;
  };

  const verifyOtpCode = verifyOtp;

  // Wallets CRUD
  const addWallet = async (
    data: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>,
    initialBalance: number
  ) => {
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

      if (!error && inserted) {
        const newW: Wallet = {
          id: inserted.id,
          userId: inserted.user_id,
          name: inserted.name,
          type: inserted.type,
          currency: inserted.currency,
          balance: parseFloat(inserted.balance) || 0,
          color: inserted.color,
          icon: inserted.icon,
          isArchived: false,
          isDeleted: false,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        };
        setWallets((prev) => [...prev, newW]);

        if (initialBalance > 0) {
          await supabase.from('transactions').insert({
            user_id: currentUser.id,
            wallet_id: inserted.id,
            amount: initialBalance,
            raw_input: initialBalance.toString(),
            type: 'ADJUSTMENT',
            description: `Initial balance setup for ${data.name}`,
            transaction_date: new Date().toISOString().slice(0, 10),
            idempotency_key: `init-${inserted.id}`,
            is_deleted: false,
            created_by: currentUser.id,
          });
        }
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
  };

  const updateWallet = async (id: string, updates: Partial<Wallet>) => {
    // Optimistic update
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w))
    );

    if (isAuthenticated) {
      await supabase
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
    }
  };

  const deleteWallet = async (id: string) => {
    await updateWallet(id, { isDeleted: true });
  };

  // Keyword rules CRUD
  const addKeywordRule = async (keyword: string, categoryId: string) => {
    const cleaned = keyword.trim().toLowerCase();
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

      if (!error && data) {
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
      }
    } else {
      const newRule: KeywordRule = {
        id: `kr-${Date.now()}`,
        userId: currentUser.id,
        keyword: cleaned,
        categoryId,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setKeywordRules((prev) => [newRule, ...prev]);
    }
  };

  const deleteKeywordRule = async (id: string) => {
    setKeywordRules((prev) => prev.filter((r) => r.id !== id));
    if (isAuthenticated) {
      await supabase.from('keyword_rules').delete().eq('id', id);
    }
  };

  // Transactions CRUD
  const addTransaction = async (data: {
    amount: number;
    rawInput?: string;
    description: string;
    walletId: string;
    destinationWalletId?: string;
    categoryId?: string;
    debtId?: string;
    type: TransactionType;
    transactionDate: string;
  }) => {
    const clientKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Optimistic balance calculation
    let sourceNewBalance: number | null = null;
    let destNewBalance: number | null = null;

    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === data.walletId) {
          let newBal = w.balance;
          if (data.type === 'EXPENSE' || data.type === 'DEBT_REPAYMENT' || data.type === 'TRANSFER') {
            newBal = Math.round((w.balance - data.amount) * 100) / 100;
          } else if (data.type === 'INCOME' || data.type === 'ADJUSTMENT') {
            newBal = Math.round((w.balance + data.amount) * 100) / 100;
          }
          sourceNewBalance = newBal;
          return { ...w, balance: newBal };
        }
        if (data.type === 'TRANSFER' && w.id === data.destinationWalletId) {
          const newBal = Math.round((w.balance + data.amount) * 100) / 100;
          destNewBalance = newBal;
          return { ...w, balance: newBal };
        }
        return w;
      })
    );

    // Optimistic debt calculation
    if (data.type === 'DEBT_REPAYMENT' && data.debtId) {
      setDebts((prev) =>
        prev.map((d) => {
          if (d.id === data.debtId) {
            const newRem = Math.max(0, Math.round((d.remainingAmount - data.amount) * 100) / 100);
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

    if (isAuthenticated) {
      try {
        const { data: insertedTx, error: txErr } = await supabase
          .from('transactions')
          .insert({
            user_id: currentUser.id,
            wallet_id: data.walletId,
            destination_wallet_id: data.destinationWalletId || null,
            category_id: data.categoryId || null,
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

        if (insertedTx) {
          const mapped: Transaction = {
            id: insertedTx.id,
            userId: insertedTx.user_id,
            walletId: insertedTx.wallet_id,
            destinationWalletId: insertedTx.destination_wallet_id || undefined,
            categoryId: insertedTx.category_id || undefined,
            debtId: insertedTx.debt_id || undefined,
            amount: parseFloat(insertedTx.amount),
            type: insertedTx.type,
            description: insertedTx.description,
            rawInput: insertedTx.raw_input || undefined,
            transactionDate: insertedTx.transaction_date,
            idempotencyKey: insertedTx.idempotency_key,
            isDeleted: false,
            createdBy: insertedTx.created_by,
            createdAt: insertedTx.created_at,
            updatedAt: insertedTx.updated_at,
          };
          setTransactions((prev) => [mapped, ...prev]);
        }

        // Update wallet balances in Supabase
        if (sourceNewBalance !== null) {
          await supabase.from('wallets').update({ balance: sourceNewBalance }).eq('id', data.walletId);
        }
        if (destNewBalance !== null && data.destinationWalletId) {
          await supabase.from('wallets').update({ balance: destNewBalance }).eq('id', data.destinationWalletId);
        }

        // Update debt in Supabase
        if (data.type === 'DEBT_REPAYMENT' && data.debtId) {
          const targetDebt = debts.find((d) => d.id === data.debtId);
          if (targetDebt) {
            const updatedRem = Math.max(0, Math.round((targetDebt.remainingAmount - data.amount) * 100) / 100);
            await supabase.from('debts').update({
              remaining_amount: updatedRem,
              is_settled: updatedRem === 0,
              updated_at: new Date().toISOString(),
            }).eq('id', data.debtId);
          }
        }

        return { success: true };
      } catch (err: unknown) {
        console.error('[Add Transaction Failed]', err);
        return { success: false, error: err instanceof Error ? err.message : 'Database error' };
      }
    } else {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        userId: currentUser.id,
        ...data,
        idempotencyKey: clientKey,
        isDeleted: false,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
      return { success: true };
    }
  };

  const softDeleteTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx || tx.isDeleted) return;

    // Optimistic soft delete
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleted: true, updatedAt: new Date().toISOString() } : t))
    );

    // Revert balance
    let sourceNewBal: number | null = null;
    let destNewBal: number | null = null;

    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === tx.walletId) {
          let b = w.balance;
          if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT' || tx.type === 'TRANSFER') {
            b = Math.round((w.balance + tx.amount) * 100) / 100;
          } else if (tx.type === 'INCOME' || tx.type === 'ADJUSTMENT') {
            b = Math.round((w.balance - tx.amount) * 100) / 100;
          }
          sourceNewBal = b;
          return { ...w, balance: b };
        }
        if (tx.type === 'TRANSFER' && w.id === tx.destinationWalletId) {
          const b = Math.round((w.balance - tx.amount) * 100) / 100;
          destNewBal = b;
          return { ...w, balance: b };
        }
        return w;
      })
    );

    if (isAuthenticated) {
      await supabase.from('transactions').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (sourceNewBal !== null) {
        await supabase.from('wallets').update({ balance: sourceNewBal }).eq('id', tx.walletId);
      }
      if (destNewBal !== null && tx.destinationWalletId) {
        await supabase.from('wallets').update({ balance: destNewBal }).eq('id', tx.destinationWalletId);
      }
    }
  };

  const restoreTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx || !tx.isDeleted) return;

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleted: false, updatedAt: new Date().toISOString() } : t))
    );

    let sourceNewBal: number | null = null;
    let destNewBal: number | null = null;

    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === tx.walletId) {
          let b = w.balance;
          if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT' || tx.type === 'TRANSFER') {
            b = Math.round((w.balance - tx.amount) * 100) / 100;
          } else if (tx.type === 'INCOME' || tx.type === 'ADJUSTMENT') {
            b = Math.round((w.balance + tx.amount) * 100) / 100;
          }
          sourceNewBal = b;
          return { ...w, balance: b };
        }
        if (tx.type === 'TRANSFER' && w.id === tx.destinationWalletId) {
          const b = Math.round((w.balance + tx.amount) * 100) / 100;
          destNewBal = b;
          return { ...w, balance: b };
        }
        return w;
      })
    );

    if (isAuthenticated) {
      await supabase.from('transactions').update({ is_deleted: false, updated_at: new Date().toISOString() }).eq('id', id);
      if (sourceNewBal !== null) {
        await supabase.from('wallets').update({ balance: sourceNewBal }).eq('id', tx.walletId);
      }
      if (destNewBal !== null && tx.destinationWalletId) {
        await supabase.from('wallets').update({ balance: destNewBal }).eq('id', tx.destinationWalletId);
      }
    }
  };

  // Bulk CSV Import
  const commitBulkImport = async (validRows: ImportRowValidation[]) => {
    const walletMapByName = new Map<string, Wallet>(wallets.map((w) => [w.name.trim().toLowerCase(), w]));
    const categoryMapByName = new Map<string, Category>(categories.map((c) => [c.name.trim().toLowerCase(), c]));

    const newTxs: Transaction[] = [];
    const dbPayloads: any[] = [];
    const walletDeltas: Record<string, number> = {};
    let totalAmt = 0;

    for (const row of validRows) {
      if (!row.isValid) continue;

      const sourceWallet = walletMapByName.get(row.walletName.trim().toLowerCase());
      if (!sourceWallet) continue;

      const destWallet = row.destinationWalletName
        ? walletMapByName.get(row.destinationWalletName.trim().toLowerCase())
        : undefined;

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
      await supabase.from('transactions').insert(dbPayloads);
      for (const [wId, delta] of Object.entries(walletDeltas)) {
        const targetW = wallets.find((w) => w.id === wId);
        if (targetW) {
          const updatedB = Math.round((targetW.balance + delta) * 100) / 100;
          await supabase.from('wallets').update({ balance: updatedB }).eq('id', wId);
        }
      }
      await refreshFromCloud();
    } else {
      setWallets((prev) =>
        prev.map((w) => {
          const delta = walletDeltas[w.id] || 0;
          return delta !== 0 ? { ...w, balance: Math.round((w.balance + delta) * 100) / 100 } : w;
        })
      );
      setTransactions((prev) => [...newTxs, ...prev]);
    }

    return { insertedCount: dbPayloads.length || newTxs.length, totalAmount: Math.round(totalAmt * 100) / 100 };
  };

  // Debts CRUD
  const addDebt = async (
    data: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>
  ) => {
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

      if (!error && inserted) {
        setDebts((prev) => [
          {
            id: inserted.id,
            userId: inserted.user_id,
            name: inserted.name,
            totalAmount: parseFloat(inserted.total_amount),
            remainingAmount: parseFloat(inserted.remaining_amount),
            interestRate: inserted.interest_rate ? parseFloat(inserted.interest_rate) : undefined,
            minimumPayment: inserted.minimum_payment ? parseFloat(inserted.minimum_payment) : undefined,
            dueDate: inserted.due_date || undefined,
            isSettled: inserted.is_settled,
            isDeleted: false,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at,
          },
          ...prev,
        ]);
      }
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
  };

  const repayDebtAtomic = async (debtId: string, walletId: string, amount: number, note?: string) => {
    const debt = debts.find((d) => d.id === debtId);
    const wallet = wallets.find((w) => w.id === walletId);

    if (!debt) return { success: false, error: 'Debt goal not found' };
    if (!wallet) return { success: false, error: 'Selected wallet not found' };
    if (amount <= 0) return { success: false, error: 'Repayment amount must be positive' };

    return addTransaction({
      amount,
      rawInput: amount.toString(),
      description: note ? `Debt Repayment: ${debt.name} (${note})` : `Debt Repayment: ${debt.name}`,
      walletId,
      categoryId: 'cat-debt',
      debtId,
      type: 'DEBT_REPAYMENT',
      transactionDate: new Date().toISOString().slice(0, 10),
    });
  };

  const settleDebt = async (debtId: string) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, remainingAmount: 0, isSettled: true, updatedAt: new Date().toISOString() } : d))
    );
    if (isAuthenticated) {
      await supabase.from('debts').update({ remaining_amount: 0, is_settled: true, updated_at: new Date().toISOString() }).eq('id', debtId);
    }
  };

  const deleteDebt = async (debtId: string) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, isDeleted: true, updatedAt: new Date().toISOString() } : d))
    );
    if (isAuthenticated) {
      await supabase.from('debts').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', debtId);
    }
  };

  // Holistic Diary CRUD
  const upsertDiaryEntry = async (
    entryData: Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ) => {
    if (isAuthenticated) {
      const existing = diaryEntries.find((e) => e.date === entryData.date && !e.isDeleted);
      if (existing) {
        await supabase
          .from('diary_entries')
          .update({
            mood: entryData.mood,
            workout: entryData.workout,
            workout_note: entryData.workoutNote || null,
            food_quality: entryData.foodQuality,
            notes: entryData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('diary_entries').insert({
          user_id: currentUser.id,
          date: entryData.date,
          mood: entryData.mood,
          workout: entryData.workout,
          workout_note: entryData.workoutNote || null,
          food_quality: entryData.foodQuality,
          notes: entryData.notes || null,
        });
      }
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
  };

  const deleteDiaryEntry = async (id: string) => {
    setDiaryEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isDeleted: true, updatedAt: new Date().toISOString() } : e))
    );
    if (isAuthenticated) {
      await supabase.from('diary_entries').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isSyncing,
        sessions,
        currentSession,
        revokeSession,
        revokeAllOtherSessions,
        simulateNewDeviceLogin,
        triggerOtpChallenge,
        verifyOtp,
        verifyOtpCode,
        otpPending,
        activeOtpCode,
        signOut,
        wallets,
        totalNetWorth,
        addWallet,
        updateWallet,
        deleteWallet,
        categories,
        keywordRules,
        addKeywordRule,
        deleteKeywordRule,
        transactions,
        addTransaction,
        softDeleteTransaction,
        restoreTransaction,
        commitBulkImport,
        debts,
        addDebt,
        repayDebtAtomic,
        settleDebt,
        deleteDebt,
        diaryEntries,
        upsertDiaryEntry,
        deleteDiaryEntry,
        showSoftDeleted,
        setShowSoftDeleted,
        refreshFromCloud,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
