import { Category, Wallet } from '../types';
import { isMovementCategory, SYSTEM_CATEGORY_COLOR } from '../selectors/ledger';
import { IDENTITY_COLORS } from './identityPalette';

/**
 * Spec 5.1's one-time colour migration (Phase 63, ADR 0038), for what this
 * device stores. `supabase/migrations/20261002_phase63_identity_colors.sql`
 * does the same for the cloud, step for step, plus spec 5.1's rows that exist
 * only in one owner's account; keep the two in step.
 *
 * A row moves only while it still holds the colour it shipped with, matched by
 * trimmed, case-insensitive name and the old colour. A colour someone picked
 * themselves is theirs, and a deleted row is left as it is.
 */
interface ColorMove {
  name: string;
  from: string;
  to: string;
}

/** In the order the collision rule walks them: spec 5.1's table. */
export const SHIPPED_CATEGORY_COLORS: ReadonlyArray<ColorMove> = [
  { name: 'Food & Dining', from: '#f87171', to: '#E879A6' },
  { name: 'Groceries', from: '#fb923c', to: '#F59E6B' },
  { name: 'Housing & Utilities', from: '#38bdf8', to: '#7DA2F0' },
  { name: 'Shopping & Apparel', from: '#a78bfa', to: '#B69CF5' },
  { name: 'Transport & Fuel', from: '#facc15', to: '#5CC8B8' },
  { name: 'Primary Salary', from: '#4ade80', to: '#8FA8C8' },
  { name: 'Freelance & Side Gig', from: '#34d399', to: '#D98FD0' },
  { name: 'Debt Repayment', from: '#f43f5e', to: SYSTEM_CATEGORY_COLOR },
  { name: 'Balance Adjustment', from: '#94a3b8', to: SYSTEM_CATEGORY_COLOR },
];

/** The starter wallets: a guest's (`Main Checking`) and a new account's (`Checking Account`). */
export const STARTER_WALLET_COLORS: ReadonlyArray<ColorMove> = [
  { name: 'Main Checking', from: '#0284c7', to: '#6C8EEF' },
  { name: 'Checking Account', from: '#0284c7', to: '#6C8EEF' },
  { name: 'Cash Wallet', from: '#16a34a', to: '#D9A066' },
  { name: 'Savings Reserve', from: '#7c3aed', to: '#4FB7A8' },
];

const nameKey = (name: string) => name.trim().toLowerCase();
const matches = (row: { name: string; color: string; isDeleted: boolean }, move: ColorMove) =>
  !row.isDeleted && nameKey(row.name) === nameKey(move.name) && row.color.toLowerCase() === move.from;

/**
 * Moves each shipped category still on its old colour, every copy of a name
 * alike. L9 holds on the way: when another live Expense or Income category of a
 * different name already has the target, the group takes the first free
 * identity colour instead, and keeps its old one if none is free. The System
 * pair shares `SYSTEM_CATEGORY_COLOR` by design and is never a collision.
 * Idempotent: a second pass finds nothing on an old colour.
 */
export function migrateCategoryColors(categories: Category[]): Category[] {
  let result = categories;
  for (const move of SHIPPED_CATEGORY_COLORS) {
    const group = result.filter((c) => matches(c, move));
    if (group.length === 0) continue;

    let target: string | null = move.to;
    if (!isMovementCategory(group[0])) {
      const taken = new Set(
        result
          .filter((c) => !c.isDeleted && !isMovementCategory(c) && nameKey(c.name) !== nameKey(move.name))
          .map((c) => c.color.toLowerCase())
      );
      if (taken.has(target.toLowerCase())) {
        target = IDENTITY_COLORS.find((hex) => !taken.has(hex.toLowerCase())) ?? null;
      }
    }
    if (target === null) continue;

    const color = target;
    result = result.map((c) => (matches(c, move) ? { ...c, color } : c));
  }
  return result;
}

/** Moves each starter wallet still on its old colour. Wallets have no uniqueness rule. */
export function migrateWalletColors(wallets: Wallet[]): Wallet[] {
  return wallets.map((w) => {
    const move = STARTER_WALLET_COLORS.find((m) => matches(w, m));
    return move ? { ...w, color: move.to } : w;
  });
}
