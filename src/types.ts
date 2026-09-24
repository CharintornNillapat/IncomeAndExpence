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
  /**
   * Optional user-authored hint describing what belongs in this category. Its
   * primary consumer is the Jev classifier, which receives it as part of the
   * option's `criteria` (ADR 0012) - a bare name is the weakest signal the
   * `choice` primitive accepts.
   *
   * `undefined` means never set, which makes a system category eligible for the
   * shipped default (`withDefaultDescriptions`). `''` means the user
   * deliberately cleared it and is never refilled.
   */
  description?: string;
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

/**
 * A saved transaction template ("quick preset") a user can re-apply to log a
 * recurring EXPENSE/INCOME in one tap instead of re-typing the same amount,
 * description, category, and wallet every time. Restricted to EXPENSE/INCOME
 * only - TRANSFER (needs a destination wallet) and DEBT_REPAYMENT (needs an
 * active debt target) don't fit a one-tap replay the same way, and adding
 * those fields here would mostly sit unused.
 */
export interface Preset {
  id: string;
  userId?: string | null;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  categoryId?: string;
  walletId?: string;
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
  /**
   * A resolved category id, set when something already knows which category
   * this row belongs to - a keyword-rule hit, a Jev answer, or a manual
   * override in the import preview (ADR 0019). `commitBulkImport` prefers it
   * over the name lookup, which stays as the fallback for a plain CSV.
   *
   * Deliberately the *only* field this phase added. Confidence and
   * applied/suggested state are preview-only and live in a view-level map:
   * this type is the commit payload and should not accrete UI state.
   */
  categoryId?: string;
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

/**
 * Wire contract for the Jev classification proxy (`api/classify.ts`).
 *
 * These live here, beside the domain models, so the browser client
 * (`src/utils/jevClassifier.ts`) and the serverless function import the *same*
 * declarations and cannot drift. The function imports them `import type`, which
 * TypeScript erases, so there is no runtime coupling between the Vercel bundle
 * and the app bundle.
 *
 * The client deliberately sends only text plus candidate labels. The Jev
 * question wording (`instructions`/`criteria`) is owned by the server - if the
 * client could supply it, the endpoint would be an open relay for arbitrary
 * prompts billed to this project's TypeSafe key. See ADR 0011.
 */
export interface ClassifyCandidate {
  /** Real `Category.id`, used directly as the Jev option key so the answer round-trips. */
  id: string;
  /** `Category.name`. On its own this is the weakest signal the model can get. */
  name: string;
  /**
   * `Category.description`, omitted entirely when blank. The proxy renders a
   * described option as `"<name>: <description>"` (ADR 0012).
   */
  description?: string;
}

export interface ClassifyRequest {
  text: string;
  categories: ClassifyCandidate[];
}

/**
 * `categoryId` is `null` when Jev picked the `other` escape option, meaning
 * "none of these categories fit" - which the client renders as no suggestion
 * at all rather than as a low-confidence guess.
 */
export interface ClassifyResponse {
  categoryId: string | null;
  categoryConfidence: number;
  /** Jev's independent read of the text, *not* derived from the chosen category. */
  detectedType: 'INCOME' | 'EXPENSE';
  typeConfidence: number;
}

/**
 * Wire contract for the monthly-insights proxy (`api/insights.ts`), ADR 0020.
 *
 * Lives here for the same reason the classify contract does: the browser
 * client and the serverless function import the *same* declarations and
 * cannot drift.
 *
 * WHAT IS DELIBERATELY ABSENT IS THE POINT. There is no transaction
 * description, no `rawInput`, no id of any kind, no wallet name, no
 * individual amount and no individual date. Only aggregates leave the
 * device. Category *names* are sent because an id means nothing to a model
 * and the name carries the entire semantic signal - the residual that a
 * user-authored category name therefore leaves the device is recorded in
 * ADR 0020 rather than glossed over.
 */
export interface SpendingCategorySummary {
  /** Category name only. Never an id. */
  name: string;
  /** This month's total for the category. */
  current: number;
  /** Last month's total, `0` when the category is new. */
  previous: number;
  /** Signed percentage change; `null` when there is no prior month to compare. */
  changePercent: number | null;
  /** How many transactions made up `current` - the signal for "recurring". */
  txCount: number;
}

export interface SpendingSummary {
  /** `YYYY-MM`. A calendar month, never a timestamp. */
  month: string;
  categories: SpendingCategorySummary[];
  totals: {
    income: number;
    expense: number;
    net: number;
    previousExpense: number;
  };
}

/**
 * The fixed vocabulary the model chooses from. Adding a member means changing
 * the server's criteria, this type and the renderer together - deliberate
 * coupling, and what stops the model returning a verdict the renderer cannot
 * express.
 */
export type InsightPattern = 'CATEGORY_SPIKE' | 'IMPROVED_SAVING' | 'NEW_RECURRING' | 'STEADY';

export interface InsightsRequest {
  summary: SpendingSummary;
}

export interface InsightsResponse {
  pattern: InsightPattern;
  /** Category name the verdict is about, or `null` for a whole-month pattern. */
  focus: string | null;
  confidence: number;
}
