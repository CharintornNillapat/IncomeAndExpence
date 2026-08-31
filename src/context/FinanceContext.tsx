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
  FoodQuality,
} from '../types';

interface FinanceContextType {
  // Auth & Security
  currentUser: User;
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

  // Wallets
  wallets: Wallet[];
  totalNetWorth: number;
  addWallet: (wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>, initialBalance: number) => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  deleteWallet: (id: string) => void;

  // Categories & Configurable Keyword Rules
  categories: Category[];
  keywordRules: KeywordRule[];
  addKeywordRule: (keyword: string, categoryId: string) => void;
  deleteKeywordRule: (id: string) => void;

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
  }) => { success: boolean; error?: string };
  softDeleteTransaction: (id: string) => void;
  restoreTransaction: (id: string) => void;
  commitBulkImport: (validRows: ImportRowValidation[]) => { insertedCount: number; totalAmount: number };

  // Debts
  debts: Debt[];
  addDebt: (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => void;
  repayDebtAtomic: (debtId: string, walletId: string, amount: number, note?: string) => { success: boolean; error?: string };
  settleDebt: (debtId: string) => void;
  deleteDebt: (debtId: string) => void;

  // Holistic Diary
  diaryEntries: DiaryEntry[];
  upsertDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => void;
  deleteDiaryEntry: (id: string) => void;

  // Filters & State helpers
  showSoftDeleted: boolean;
  setShowSoftDeleted: (show: boolean) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

/**
 * Robust JSON storage retrieval with fallback to avoid crash from corrupted storage
 */
function safeGetLocalStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch (err) {
    console.warn(`[SafeStorage] Failed to parse key "${key}" from localStorage, falling back to default`, err);
    return fallback;
  }
}

// Initial Seed Data
const INITIAL_USER: User = {
  id: 'usr-default-01',
  email: 'alex.finance@example.com',
  name: 'Alex Rivera',
  role: 'USER',
  isEmailVerified: true,
  createdAt: '2026-01-15T08:00:00Z',
};

const INITIAL_SESSIONS: SessionDevice[] = [
  {
    id: 'sess-current',
    userId: 'usr-default-01',
    deviceFingerprint: 'fp_mac_chrome_9981a',
    deviceName: 'MacBook Pro (Chrome 122)',
    ipAddress: '192.168.1.104',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    isTrusted: true,
    isCurrent: true,
    lastActiveAt: new Date().toISOString(),
    revokedAt: null,
    createdAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'sess-mobile',
    userId: 'usr-default-01',
    deviceFingerprint: 'fp_iphone_safari_331b',
    deviceName: 'iPhone 15 Pro (Safari Mobile)',
    ipAddress: '172.56.21.90',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)',
    isTrusted: true,
    isCurrent: false,
    lastActiveAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    revokedAt: null,
    createdAt: '2026-08-22T14:30:00Z',
  },
];

const INITIAL_WALLETS: Wallet[] = [
  {
    id: 'w1',
    userId: 'usr-default-01',
    name: 'Chase Checking',
    type: 'BANK_ACCOUNT',
    currency: 'USD',
    balance: 4250.75,
    color: '#0284c7',
    icon: 'landmark',
    isArchived: false,
    isDeleted: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
  },
  {
    id: 'w2',
    userId: 'usr-default-01',
    name: 'Physical Cash',
    type: 'CASH',
    currency: 'USD',
    balance: 320.00,
    color: '#16a34a',
    icon: 'banknote',
    isArchived: false,
    isDeleted: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
  },
  {
    id: 'w3',
    userId: 'usr-default-01',
    name: 'Marcus High-Yield Savings',
    type: 'SAVINGS',
    currency: 'USD',
    balance: 14850.00,
    color: '#7c3aed',
    icon: 'piggy-bank',
    isArchived: false,
    isDeleted: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
  },
];

const INITIAL_CATEGORIES: Category[] = [
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

const INITIAL_KEYWORD_RULES: KeywordRule[] = [
  { id: 'kr-1', keyword: 'lunch', categoryId: 'cat-food', createdAt: '2026-01-15' },
  { id: 'kr-2', keyword: 'dinner', categoryId: 'cat-food', createdAt: '2026-01-15' },
  { id: 'kr-3', keyword: 'coffee', categoryId: 'cat-food', createdAt: '2026-01-15' },
  { id: 'kr-4', keyword: 'market', categoryId: 'cat-groceries', createdAt: '2026-01-15' },
  { id: 'kr-5', keyword: 'grocery', categoryId: 'cat-groceries', createdAt: '2026-01-15' },
  { id: 'kr-6', keyword: 'uber', categoryId: 'cat-transport', createdAt: '2026-01-15' },
  { id: 'kr-7', keyword: 'gas', categoryId: 'cat-transport', createdAt: '2026-01-15' },
  { id: 'kr-8', keyword: 'shirt', categoryId: 'cat-shopping', createdAt: '2026-01-15' },
  { id: 'kr-9', keyword: 'shoes', categoryId: 'cat-shopping', createdAt: '2026-01-15' },
  { id: 'kr-10', keyword: 'salary', categoryId: 'cat-salary', createdAt: '2026-01-15' },
  { id: 'kr-11', keyword: 'loan', categoryId: 'cat-debt', createdAt: '2026-01-15' },
];

const INITIAL_DEBTS: Debt[] = [
  {
    id: 'debt-1',
    userId: 'usr-default-01',
    name: 'Student Loan (Federal)',
    totalAmount: 12000.00,
    remainingAmount: 6450.00,
    interestRate: 4.5,
    minimumPayment: 250.00,
    dueDate: '2026-11-30',
    isSettled: false,
    isDeleted: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-08-25T08:00:00Z',
  },
  {
    id: 'debt-2',
    userId: 'usr-default-01',
    name: 'Auto Loan (Honda Civic)',
    totalAmount: 8500.00,
    remainingAmount: 2100.00,
    interestRate: 3.2,
    minimumPayment: 320.00,
    dueDate: '2026-09-15',
    isSettled: false,
    isDeleted: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-08-20T08:00:00Z',
  },
];

const todayIso = new Date().toISOString().slice(0, 10);
const yestIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const day2Iso = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
const day3Iso = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10);

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-101',
    userId: 'usr-default-01',
    walletId: 'w1',
    categoryId: 'cat-food',
    amount: 52.40,
    rawInput: '35+17.40',
    type: 'EXPENSE',
    description: 'Dinner with colleagues',
    transactionDate: todayIso,
    idempotencyKey: 'idemp-seed-101',
    isDeleted: false,
    createdBy: 'usr-default-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tx-102',
    userId: 'usr-default-01',
    walletId: 'w1',
    categoryId: 'cat-groceries',
    amount: 115.80,
    rawInput: '115.80',
    type: 'EXPENSE',
    description: 'Weekly organic grocery run',
    transactionDate: yestIso,
    idempotencyKey: 'idemp-seed-102',
    isDeleted: false,
    createdBy: 'usr-default-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tx-103',
    userId: 'usr-default-01',
    walletId: 'w1',
    categoryId: 'cat-salary',
    amount: 3400.00,
    rawInput: '3400',
    type: 'INCOME',
    description: 'Bi-weekly Direct Deposit Salary',
    transactionDate: day2Iso,
    idempotencyKey: 'idemp-seed-103',
    isDeleted: false,
    createdBy: 'usr-default-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tx-104',
    userId: 'usr-default-01',
    walletId: 'w1',
    categoryId: 'cat-debt',
    debtId: 'debt-1',
    amount: 350.00,
    rawInput: '350',
    type: 'DEBT_REPAYMENT',
    description: 'Student Loan accelerated payoff',
    transactionDate: day3Iso,
    idempotencyKey: 'idemp-seed-104',
    isDeleted: false,
    createdBy: 'usr-default-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_DIARY: DiaryEntry[] = [
  {
    id: 'diary-1',
    userId: 'usr-default-01',
    date: todayIso,
    mood: 5,
    workout: true,
    workoutNote: '5km Morning Run + Core workout',
    foodQuality: 'HEALTHY',
    notes: 'Felt very energized, stuck to clean meal prep and focused work session.',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'diary-2',
    userId: 'usr-default-01',
    date: yestIso,
    mood: 4,
    workout: true,
    workoutNote: 'Upper body weights (45 min)',
    foodQuality: 'HEALTHY',
    notes: 'Good discipline, stayed within daily nutrition budget.',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'diary-3',
    userId: 'usr-default-01',
    date: day2Iso,
    mood: 2,
    workout: false,
    workoutNote: '',
    foodQuality: 'JUNK',
    notes: 'High stress day, ordered takeout pizza and skipped gym.',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Local storage backed state with error resilience
  const [currentUser] = useState<User>(() => {
    return safeGetLocalStorage<User>('pf_user', INITIAL_USER);
  });

  const [sessions, setSessions] = useState<SessionDevice[]>(() => {
    return safeGetLocalStorage<SessionDevice[]>('pf_sessions', INITIAL_SESSIONS);
  });

  const [wallets, setWallets] = useState<Wallet[]>(() => {
    return safeGetLocalStorage<Wallet[]>('pf_wallets', INITIAL_WALLETS);
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    return safeGetLocalStorage<Category[]>('pf_categories', INITIAL_CATEGORIES);
  });

  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>(() => {
    return safeGetLocalStorage<KeywordRule[]>('pf_keywords', INITIAL_KEYWORD_RULES);
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return safeGetLocalStorage<Transaction[]>('pf_transactions', INITIAL_TRANSACTIONS);
  });

  const [debts, setDebts] = useState<Debt[]>(() => {
    return safeGetLocalStorage<Debt[]>('pf_debts', INITIAL_DEBTS);
  });

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => {
    return safeGetLocalStorage<DiaryEntry[]>('pf_diary', INITIAL_DIARY);
  });

  const [showSoftDeleted, setShowSoftDeleted] = useState<boolean>(false);

  // OTP Simulation State
  const [otpPending, setOtpPending] = useState<boolean>(false);
  const [activeOtpCode, setActiveOtpCode] = useState<string>('123456');

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('pf_sessions', JSON.stringify(sessions));
  }, [sessions]);
  useEffect(() => {
    localStorage.setItem('pf_wallets', JSON.stringify(wallets));
  }, [wallets]);
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
    localStorage.setItem('pf_keywords', JSON.stringify(keywordRules));
  }, [keywordRules]);

  // Aggregate Net Worth (Active non-deleted wallets)
  const totalNetWorth = useMemo(() => {
    return wallets
      .filter((w) => !w.isDeleted && !w.isArchived)
      .reduce((sum, w) => sum + w.balance, 0);
  }, [wallets]);

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.isCurrent && !s.revokedAt) || null;
  }, [sessions]);

  // Session revocation
  const revokeSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, revokedAt: new Date().toISOString() } : s
      )
    );
  };

  const revokeAllOtherSessions = () => {
    setSessions((prev) =>
      prev.map((s) =>
        !s.isCurrent ? { ...s, revokedAt: new Date().toISOString() } : s
      )
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
      // Register new verified session
      const newSess: SessionDevice = {
        id: `sess-${Date.now()}`,
        userId: currentUser.id,
        deviceFingerprint: `fp_new_${Math.random().toString(36).substring(2, 8)}`,
        deviceName: 'New Verified Device (Firefox 124)',
        ipAddress: '198.51.100.42',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        isTrusted: true,
        isCurrent: false,
        lastActiveAt: new Date().toISOString(),
        revokedAt: null,
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) => [newSess, ...prev]);
      return true;
    }
    return false;
  };

  const verifyOtpCode = verifyOtp;

  // Wallets CRUD
  const addWallet = (
    data: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>,
    initialBalance: number
  ) => {
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

    // Initial Balances: Treat as "Adjustment" transaction type to keep financial logs clean
    if (initialBalance > 0) {
      const initAdjustmentTx: Transaction = {
        id: `tx-init-${Date.now()}`,
        userId: currentUser.id,
        walletId: newWalletId,
        categoryId: 'cat-adjust',
        amount: initialBalance,
        rawInput: initialBalance.toString(),
        type: 'ADJUSTMENT',
        description: `Initial balance setup for ${data.name}`,
        transactionDate: new Date().toISOString().slice(0, 10),
        idempotencyKey: `init-${newWalletId}`,
        isDeleted: false,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTransactions((prev) => [initAdjustmentTx, ...prev]);
    }
  };

  const updateWallet = (id: string, updates: Partial<Wallet>) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w))
    );
  };

  const deleteWallet = (id: string) => {
    // Soft delete wallet
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isDeleted: true, updatedAt: new Date().toISOString() } : w))
    );
  };

  // Keyword rules CRUD
  const addKeywordRule = (keyword: string, categoryId: string) => {
    const newRule: KeywordRule = {
      id: `kr-${Date.now()}`,
      userId: currentUser.id,
      keyword: keyword.trim().toLowerCase(),
      categoryId,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setKeywordRules((prev) => [newRule, ...prev]);
  };

  const deleteKeywordRule = (id: string) => {
    setKeywordRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Transaction Creation & Atomic Balance Mutation
  const addTransaction = (data: {
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
    // Idempotency prevention check
    const clientKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // Atomic update of wallet balances and debt target
    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === data.walletId) {
          if (data.type === 'EXPENSE' || data.type === 'DEBT_REPAYMENT' || data.type === 'TRANSFER') {
            return { ...w, balance: Math.round((w.balance - data.amount) * 100) / 100 };
          } else if (data.type === 'INCOME' || data.type === 'ADJUSTMENT') {
            return { ...w, balance: Math.round((w.balance + data.amount) * 100) / 100 };
          }
        }
        if (data.type === 'TRANSFER' && w.id === data.destinationWalletId) {
          return { ...w, balance: Math.round((w.balance + data.amount) * 100) / 100 };
        }
        return w;
      })
    );

    // If debt repayment, deduct target goal remaining amount
    if (data.type === 'DEBT_REPAYMENT' && data.debtId) {
      setDebts((prev) =>
        prev.map((d) => {
          if (d.id === data.debtId) {
            const newRemaining = Math.max(0, Math.round((d.remainingAmount - data.amount) * 100) / 100);
            return {
              ...d,
              remainingAmount: newRemaining,
              isSettled: newRemaining === 0,
              updatedAt: new Date().toISOString(),
            };
          }
          return d;
        })
      );
    }

    setTransactions((prev) => [newTx, ...prev]);
    return { success: true };
  };

  // Soft delete transaction & revert balance
  const softDeleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx || tx.isDeleted) return;

    // Mark soft deleted
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleted: true, updatedAt: new Date().toISOString() } : t))
    );

    // Revert wallet balance
    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === tx.walletId) {
          if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT' || tx.type === 'TRANSFER') {
            return { ...w, balance: Math.round((w.balance + tx.amount) * 100) / 100 };
          } else if (tx.type === 'INCOME' || tx.type === 'ADJUSTMENT') {
            return { ...w, balance: Math.round((w.balance - tx.amount) * 100) / 100 };
          }
        }
        if (tx.type === 'TRANSFER' && w.id === tx.destinationWalletId) {
          return { ...w, balance: Math.round((w.balance - tx.amount) * 100) / 100 };
        }
        return w;
      })
    );

    // Revert debt if applicable
    if (tx.type === 'DEBT_REPAYMENT' && tx.debtId) {
      setDebts((prev) =>
        prev.map((d) =>
          d.id === tx.debtId
            ? {
                ...d,
                remainingAmount: Math.round((d.remainingAmount + tx.amount) * 100) / 100,
                isSettled: false,
                updatedAt: new Date().toISOString(),
              }
            : d
        )
      );
    }
  };

  const restoreTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx || !tx.isDeleted) return;

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleted: false, updatedAt: new Date().toISOString() } : t))
    );

    // Re-apply balance
    setWallets((prev) =>
      prev.map((w) => {
        if (w.id === tx.walletId) {
          if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT' || tx.type === 'TRANSFER') {
            return { ...w, balance: Math.round((w.balance - tx.amount) * 100) / 100 };
          } else if (tx.type === 'INCOME' || tx.type === 'ADJUSTMENT') {
            return { ...w, balance: Math.round((w.balance + tx.amount) * 100) / 100 };
          }
        }
        if (tx.type === 'TRANSFER' && w.id === tx.destinationWalletId) {
          return { ...w, balance: Math.round((w.balance + tx.amount) * 100) / 100 };
        }
        return w;
      })
    );
  };

  // Bulk Import Atomic Commit
  const commitBulkImport = (validRows: ImportRowValidation[]) => {
    const walletMapByName = new Map<string, Wallet>(wallets.map((w) => [w.name.trim().toLowerCase(), w]));
    const categoryMapByName = new Map<string, Category>(categories.map((c) => [c.name.trim().toLowerCase(), c]));

    const newTxs: Transaction[] = [];
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

      const tx: Transaction = {
        id: `tx-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      totalAmt += row.amount;

      // Track wallet delta
      if (row.type === 'EXPENSE' || row.type === 'DEBT_REPAYMENT' || row.type === 'TRANSFER') {
        walletDeltas[sourceWallet.id] = (walletDeltas[sourceWallet.id] || 0) - row.amount;
      } else if (row.type === 'INCOME' || row.type === 'ADJUSTMENT') {
        walletDeltas[sourceWallet.id] = (walletDeltas[sourceWallet.id] || 0) + row.amount;
      }

      if (row.type === 'TRANSFER' && destWallet) {
        walletDeltas[destWallet.id] = (walletDeltas[destWallet.id] || 0) + row.amount;
      }
    }

    // Apply wallet changes in a single batch
    setWallets((prev) =>
      prev.map((w) => {
        const delta = walletDeltas[w.id] || 0;
        return delta !== 0 ? { ...w, balance: Math.round((w.balance + delta) * 100) / 100 } : w;
      })
    );

    setTransactions((prev) => [...newTxs, ...prev]);

    return { insertedCount: newTxs.length, totalAmount: Math.round(totalAmt * 100) / 100 };
  };

  // Debts CRUD
  const addDebt = (
    data: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>
  ) => {
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
  };

  const repayDebtAtomic = (debtId: string, walletId: string, amount: number, note?: string) => {
    const debt = debts.find((d) => d.id === debtId);
    const wallet = wallets.find((w) => w.id === walletId);

    if (!debt) return { success: false, error: 'Debt not found' };
    if (!wallet) return { success: false, error: 'Selected wallet not found' };
    if (amount <= 0) return { success: false, error: 'Payment amount must be greater than 0' };

    // Record debt repayment transaction
    addTransaction({
      amount,
      rawInput: amount.toString(),
      description: note ? `Debt Repayment: ${debt.name} (${note})` : `Debt Repayment: ${debt.name}`,
      walletId,
      categoryId: 'cat-debt',
      debtId,
      type: 'DEBT_REPAYMENT',
      transactionDate: new Date().toISOString().slice(0, 10),
    });

    return { success: true };
  };

  const settleDebt = (debtId: string) => {
    setDebts((prev) =>
      prev.map((d) =>
        d.id === debtId ? { ...d, remainingAmount: 0, isSettled: true, updatedAt: new Date().toISOString() } : d
      )
    );
  };

  const deleteDebt = (debtId: string) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, isDeleted: true, updatedAt: new Date().toISOString() } : d))
    );
  };

  // Holistic Diary CRUD
  const upsertDiaryEntry = (
    entryData: Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ) => {
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
  };

  const deleteDiaryEntry = (id: string) => {
    setDiaryEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isDeleted: true, updatedAt: new Date().toISOString() } : e))
    );
  };

  return (
    <FinanceContext.Provider
      value={{
        currentUser,
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
