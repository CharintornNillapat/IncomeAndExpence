export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface SessionDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  isTrusted: boolean;
  isCurrent: boolean;
  lastActiveAt: string;
  revokedAt?: string | null;
  createdAt: string;
}

export type WalletType = 'CASH' | 'BANK_ACCOUNT' | 'CREDIT_CARD' | 'E_WALLET' | 'INVESTMENT' | 'SAVINGS';

/**
 * The app is single-currency (Thai Baht). Keeping this as a one-member union
 * rather than `string` makes every write site a compile error if another
 * currency is ever introduced without handling conversion.
 */
export type CurrencyCode = 'THB';

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  type: WalletType;
  currency: CurrencyCode;
  balance: number; // Decimal(15,2)
  color: string;
  icon: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT' | 'DEBT_REPAYMENT';

export interface Category {
  id: string;
  userId?: string | null;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isSystem: boolean;
  isDeleted: boolean;
}

export interface KeywordRule {
  id: string;
  userId?: string | null;
  keyword: string;
  categoryId: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  destinationWalletId?: string;
  categoryId?: string;
  debtId?: string;
  amount: number; // Decimal(15,2)
  type: TransactionType;
  description: string;
  rawInput?: string; // original e.g. "500+500"
  transactionDate: string; // YYYY-MM-DD
  idempotencyKey?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate?: number; // %
  minimumPayment?: number;
  dueDate?: string;
  isSettled: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FoodQuality = 'HEALTHY' | 'AVERAGE' | 'JUNK';

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mood: number; // 1 to 5
  workout: boolean;
  workoutNote?: string;
  foodQuality: FoodQuality;
  notes?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRowValidation {
  rowIndex: number;
  date: string;
  walletName: string;
  categoryName?: string;
  amount: number;
  type: TransactionType;
  description: string;
  destinationWalletName?: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface ImportPreviewSummary {
  previewId: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  totalAmount: number;
  rows: ImportRowValidation[];
}
