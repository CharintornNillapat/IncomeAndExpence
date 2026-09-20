import { z } from 'zod';

/**
 * Flattens a validation failure into one human-readable line.
 *
 * Every write path surfaces validation errors the same way, so the message can
 * go straight into the error banner a view already renders.
 */
export function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join('; ');
}

export const TransactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0').max(999999999.99, 'Amount too large'),
  rawInput: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_REPAYMENT']),
  description: z.string().min(1, 'Description is required').max(255),
  walletId: z.string().min(1, 'Please select a money source / wallet'),
  destinationWalletId: z.string().optional(),
  categoryId: z.string().optional(),
  debtId: z.string().optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  idempotencyKey: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'TRANSFER') {
      return !!data.destinationWalletId && data.walletId !== data.destinationWalletId;
    }
    return true;
  },
  {
    message: 'Transfer requires a distinct destination wallet',
    path: ['destinationWalletId'],
  }
).refine(
  (data) => {
    if (data.type === 'DEBT_REPAYMENT') {
      return !!data.debtId;
    }
    return true;
  },
  {
    message: 'Debt repayment requires selecting an active debt goal',
    path: ['debtId'],
  }
);

export const WalletSchema = z.object({
  name: z.string().min(1, 'Wallet name is required').max(100),
  type: z.enum(['CASH', 'BANK_ACCOUNT', 'CREDIT_CARD', 'E_WALLET', 'INVESTMENT', 'SAVINGS']),
  currency: z.literal('THB'),
  initialBalance: z.number().min(0, 'Initial balance cannot be negative'),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const DebtSchema = z.object({
  name: z.string().min(1, 'Debt title is required').max(100),
  totalAmount: z.number().positive('Total debt amount must be positive'),
  remainingAmount: z.number().min(0, 'Remaining debt cannot be negative'),
  interestRate: z.number().min(0).max(100).optional(),
  minimumPayment: z.number().min(0).optional(),
  dueDate: z.string().optional(),
});

export const DiarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mood: z.number().int().min(1).max(5),
  workout: z.boolean(),
  workoutNote: z.string().max(255).optional(),
  foodQuality: z.enum(['HEALTHY', 'AVERAGE', 'JUNK']),
  notes: z.string().max(1000).optional(),
});

export const CategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(60, 'Category name is too long'),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_REPAYMENT']),
  color: z.string().min(1, 'A color is required'),
  icon: z.string().optional(),
});

export const KeywordMappingSchema = z.object({
  // trim() runs before min(1) so a whitespace-only keyword is rejected rather
  // than normalizing to an empty string.
  keyword: z.string().trim().min(1, 'Keyword cannot be empty').toLowerCase(),
  categoryId: z.string().min(1, 'Category is required'),
});

export const PresetSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(60, 'Template name is too long'),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive('Amount must be greater than 0').max(999999999.99, 'Amount too large'),
  description: z.string().trim().min(1, 'Description is required').max(255),
  categoryId: z.string().optional(),
  walletId: z.string().optional(),
});

export const AuthLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
