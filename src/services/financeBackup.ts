/*
 * Phase 121 (ADR 0097): the backup restore's row rewriting, moved out of
 * `FinanceContext.tsx` unchanged. Parsing stays in `utils/accountExport.ts`
 * (`parseAccountBackup`); the provider still refuses a signed-in restore and
 * replaces the slices itself, beside the sign-out reset (ADR 0075).
 */
import type { Preset } from '../types';
import type { AccountData } from '../utils/accountExport';

/**
 * A parsed backup as this device's guest data: every row takes `guestUserId`
 * (rows from an account carry its uuid), and `keepPreset` says whether a
 * template survives, which it does unless it names a wallet or category the
 * backup does not hold.
 */
export function backupAsGuest(data: AccountData, guestUserId: string) {
  const asGuest = <T extends { userId?: string | null }>(rows: T[]): T[] => rows.map((row) => ({ ...row, userId: guestUserId }));
  const walletIds = new Set(data.wallets.map((w) => w.id));
  const categoryIds = new Set(data.categories.map((c) => c.id));
  return {
    wallets: asGuest(data.wallets),
    transactions: asGuest(data.transactions),
    debts: asGuest(data.debts),
    categories: asGuest(data.categories),
    keywordRules: asGuest(data.keywordRules),
    diaryEntries: asGuest(data.diaryEntries),
    keepPreset: (p: Preset) => (!p.walletId || walletIds.has(p.walletId)) && (!p.categoryId || categoryIds.has(p.categoryId)),
  };
}
