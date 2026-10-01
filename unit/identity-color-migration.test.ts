import { describe, it, expect } from 'vitest';
import {
  migrateCategoryColors,
  migrateWalletColors,
  SHIPPED_CATEGORY_COLORS,
  STARTER_WALLET_COLORS,
} from '../src/utils/identityColorMigration';
import { IDENTITY_COLORS } from '../src/utils/identityPalette';
import { SYSTEM_CATEGORY_COLOR } from '../src/selectors/ledger';
import type { Category, TransactionType, Wallet } from '../src/types';

/**
 * Phase 63 (ADR 0038, spec 5.1): the one-time colour migration for what a
 * device stores. `supabase/tests/20261002_phase63.probe.sql` pins the same
 * cases against the SQL twin.
 */
function cat(id: string, name: string, color: string, type: TransactionType = 'EXPENSE', isDeleted = false): Category {
  return { id, name, type, icon: 'tag', color, isSystem: true, isDeleted };
}

function wallet(id: string, name: string, color: string, isDeleted = false): Wallet {
  return {
    id, userId: 'guest', name, type: 'CASH', currency: 'THB', balance: 0, color, icon: 'cash',
    isArchived: false, isDeleted, createdAt: '', updatedAt: '',
  };
}

const TYPES: Record<string, TransactionType> = {
  'Primary Salary': 'INCOME', 'Freelance & Side Gig': 'INCOME', 'Debt Repayment': 'DEBT_REPAYMENT', 'Balance Adjustment': 'ADJUSTMENT',
};
const shippedOld = () => SHIPPED_CATEGORY_COLORS.map((m, i) => cat(`c${i}`, m.name, m.from, TYPES[m.name] ?? 'EXPENSE'));
const colorOf = (list: Category[], id: string) => list.find((c) => c.id === id)!.color;

describe('migrateCategoryColors', () => {
  it("moves each shipped category to spec 5.1's colour, the System pair to grey", () => {
    const out = migrateCategoryColors(shippedOld());
    expect(out.map((c) => c.color)).toEqual(SHIPPED_CATEGORY_COLORS.map((m) => m.to));
    expect(colorOf(out, 'c0')).toBe('#E879A6');
    expect(colorOf(out, 'c7')).toBe(SYSTEM_CATEGORY_COLOR);
    expect(colorOf(out, 'c8')).toBe(SYSTEM_CATEGORY_COLOR);
  });

  it('matches the name trimmed and case-insensitively, and the old colour case-insensitively, across every copy', () => {
    const out = migrateCategoryColors([
      cat('a', 'Food & Dining', '#f87171'),
      cat('b', '  food & dining ', '#F87171'),
      cat('c', 'FOOD & DINING', '#f87171'),
    ]);
    expect(out.map((c) => c.color)).toEqual(['#E879A6', '#E879A6', '#E879A6']);
  });

  it('leaves a colour someone picked, a deleted row, and a name that never shipped', () => {
    const out = migrateCategoryColors([
      cat('picked', 'Groceries', '#C7B38A'),
      cat('gone', 'Groceries', '#fb923c', 'EXPENSE', true),
      cat('mine', 'Snacks', '#f87171'),
    ]);
    expect(colorOf(out, 'picked')).toBe('#C7B38A');
    expect(colorOf(out, 'gone')).toBe('#fb923c');
    expect(colorOf(out, 'mine')).toBe('#f87171');
  });

  it('L9: takes the first free identity colour when another category already holds the target', () => {
    const out = migrateCategoryColors([...shippedOld(), cat('pets', 'Pets', '#e879a6'), cat('gym', 'Gym', '#D9A066')]);
    // Rose is Pets', Tan is Gym's, so Food & Dining takes Blue, the next free one.
    expect(colorOf(out, 'c0')).toBe('#6C8EEF');
    expect(colorOf(out, 'pets')).toBe('#e879a6');
    const live = out.filter((c) => c.type === 'EXPENSE' || c.type === 'INCOME').map((c) => c.color.toLowerCase());
    expect(new Set(live).size).toBe(live.length);
  });

  it('keeps the old colour when all twelve are taken', () => {
    const taken = IDENTITY_COLORS.map((hex, i) => cat(`x${i}`, `Custom ${i}`, hex));
    const out = migrateCategoryColors([...taken, cat('food', 'Food & Dining', '#f87171')]);
    expect(colorOf(out, 'food')).toBe('#f87171');
  });

  it('never counts the System pair as a collision, and a System category never takes a palette colour', () => {
    const out = migrateCategoryColors([
      cat('debt', 'Debt Repayment', '#f43f5e', 'DEBT_REPAYMENT'),
      cat('adj', 'Balance Adjustment', '#94a3b8', 'ADJUSTMENT'),
      ...IDENTITY_COLORS.map((hex, i) => cat(`x${i}`, `Custom ${i}`, hex)),
    ]);
    expect(colorOf(out, 'debt')).toBe(SYSTEM_CATEGORY_COLOR);
    expect(colorOf(out, 'adj')).toBe(SYSTEM_CATEGORY_COLOR);
  });

  it('is idempotent, and returns untouched rows as they were', () => {
    const input = [...shippedOld(), cat('pets', 'Pets', '#E879A6')];
    const once = migrateCategoryColors(input);
    expect(migrateCategoryColors(once)).toEqual(once);
    expect(once.find((c) => c.id === 'pets')).toBe(input.find((c) => c.id === 'pets'));
  });
});

describe('migrateWalletColors', () => {
  it('moves the starter wallets, guest and signed-in names alike', () => {
    const out = migrateWalletColors(STARTER_WALLET_COLORS.map((m, i) => wallet(`w${i}`, m.name, m.from.toUpperCase())));
    expect(out.map((w) => w.color)).toEqual(STARTER_WALLET_COLORS.map((m) => m.to));
  });

  it('leaves a picked colour, a deleted wallet and any other name, and is idempotent', () => {
    const input = [
      wallet('picked', 'Cash Wallet', '#E879A6'),
      wallet('gone', 'Cash Wallet', '#16a34a', true),
      wallet('mine', 'Cash', '#16a34a'),
    ];
    const out = migrateWalletColors(input);
    expect(out.map((w) => w.color)).toEqual(['#E879A6', '#16a34a', '#16a34a']);
    expect(migrateWalletColors(out)).toEqual(out);
  });
});
