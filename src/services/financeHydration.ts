/*
 * Phase 121 (ADR 0097): the cloud load's reads and row mapping, moved out of
 * `FinanceContext.tsx` unchanged. The provider still owns everything that
 * decides what a load means: `isSyncing`, the auth epoch, the clean-load
 * bookkeeping (`cloudRevisionRef`, `lastCloudLoadAtRef`, `syncError` on a
 * clean or failed load) and the starter seed. This module only reads the six
 * tables in order and hands each mapped slice to the setter it is given.
 */
import type { Category, Debt, DiaryEntry, KeywordRule, Transaction, Wallet } from '../types';
import { supabase } from '../lib/supabase';
import { APP_CURRENCY } from '../utils/currency';
import { dedupeCategoriesByName, withDefaultDescriptions } from '../utils/categoryUtils';
import { mapDiaryRow } from '../context/DiaryContext';
import { mapKeywordRuleRow } from '../context/KeywordRulesContext';

/** What `seed_starter_account()` decided for an empty wallet read (ADR 0039). */
export type SeedOutcome = 'seeded' | 'not-new' | 'busy' | 'update-needed' | 'failed';

// Maps a `transactions` row from Supabase (snake_case) to the domain type.
export function mapTransactionRow(row: any): Transaction {
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
export function mapWalletRow(row: any): Wallet {
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
export function mapDebtRow(row: any): Debt {
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

// Maps a `categories` row from Supabase (snake_case) to the domain type.
function mapCategoryRow(row: any): Category {
  return {
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
  };
}

export interface CloudReadDeps {
  /** F5 (ADR 0024): true once a sign-out has happened since the load began. Checked after every read. */
  signedOutMeanwhile: () => boolean;
  /** Asks the server whether an empty account is new (ADR 0039). */
  seed: (userId: string) => Promise<SeedOutcome>;
  /** The shipped categories whose descriptions backfill an unset one (ADR 0012). */
  defaultCategories: Category[];
  setWallets: (wallets: Wallet[]) => void;
  setCategories: (categories: Category[]) => void;
  setKeywordRules: (rules: KeywordRule[]) => void;
  setDebts: (debts: Debt[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setDiaryEntries: (entries: DiaryEntry[]) => void;
  setSyncError: (error: string | null) => void;
}

/**
 * Reads the account's six tables in order and applies each slice that read.
 * Returns the tables whose read failed (a failed one keeps its local value),
 * or `null` when the load stopped early: a sign-out meanwhile, a seed that
 * reloaded or is reloading, or a seed that could not run (its `syncError` is
 * already set). A thrown error propagates to the caller's catch.
 */
export async function readCloudSlices(userId: string, deps: CloudReadDeps): Promise<string[] | null> {
  const { signedOutMeanwhile } = deps;
  const failedReads: string[] = [];

  // 1. Wallets
  const { data: wData, error: wErr } = await supabase
    .from('wallets')
    .select('*')
    .order('created_at', { ascending: true });
  if (signedOutMeanwhile()) return null;

  if (wErr) failedReads.push('wallets');
  if (!wErr && wData) {
    const mappedWallets: Wallet[] = wData.map(mapWalletRow);

    // An empty read may be a new account or a read without a session; only
    // the server can tell (ADR 0039). Nothing is applied until it has.
    if (mappedWallets.length === 0) {
      const outcome = await deps.seed(userId);
      if (outcome === 'seeded' || outcome === 'busy' || signedOutMeanwhile()) return null;
      if (outcome === 'update-needed') {
        // No trailing period: the sync badge adds ". Tap to try again."
        deps.setSyncError('Setting up this account needs the latest database update');
        return null;
      }
      if (outcome === 'failed') {
        deps.setSyncError('Could not read wallets');
        return null;
      }
    }
    deps.setWallets(mappedWallets);
  }

  // 2. Categories
  const { data: cData, error: cErr } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
  if (signedOutMeanwhile()) return null;

  if (cErr) failedReads.push('categories');
  if (!cErr && cData && cData.length > 0) {
    const mappedCategories: Category[] = cData.map(mapCategoryRow);
    deps.setCategories(withDefaultDescriptions(dedupeCategoriesByName(mappedCategories), deps.defaultCategories));
  }

  // 3. Keyword Rules
  const { data: krData, error: krErr } = await supabase
    .from('keyword_rules')
    .select('*');
  if (signedOutMeanwhile()) return null;

  if (krErr) failedReads.push('keyword_rules');
  if (!krErr && krData) {
    deps.setKeywordRules(krData.map(mapKeywordRuleRow));
  }

  // 4. Debts
  const { data: dData, error: dErr } = await supabase
    .from('debts')
    .select('*')
    .order('created_at', { ascending: false });
  if (signedOutMeanwhile()) return null;

  if (dErr) failedReads.push('debts');
  if (!dErr && dData) {
    deps.setDebts(dData.map(mapDebtRow));
  }

  // 5. Transactions
  const { data: txData, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (signedOutMeanwhile()) return null;

  if (txErr) failedReads.push('transactions');
  if (!txErr && txData) {
    deps.setTransactions(txData.map(mapTransactionRow));
  }

  // 6. Diary Entries
  const { data: diaryData, error: diaryErr } = await supabase
    .from('diary_entries')
    .select('*')
    .order('date', { ascending: false });
  if (signedOutMeanwhile()) return null;

  if (diaryErr) failedReads.push('diary_entries');
  if (!diaryErr && diaryData) {
    deps.setDiaryEntries(diaryData.map(mapDiaryRow));
  }

  return failedReads;
}
