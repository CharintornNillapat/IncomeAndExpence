// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { FinanceProvider, useFinanceActions, useFinanceState } from '../src/context/FinanceContext';
import { useDiaryActions, useDiaryState } from '../src/context/DiaryContext';
import { useKeywordRulesActions, useKeywordRulesState } from '../src/context/KeywordRulesContext';
import { useTemplateActions, useTemplateState } from '../src/context/TemplateContext';
import { generateEntityId } from '../src/utils/ids';
import { IDENTITY_COLORS } from '../src/utils/identityPalette';
import { nextColor } from '../src/selectors/categories';

/**
 * Phase 119 (ADR 0095): a record made on this device gets an id no other
 * record shares, even when two are made in the same millisecond. Every id here
 * was `<prefix>-${Date.now()}` before, and Phase 118's main CI run made two
 * templates in one millisecond: they shared an id, so an edit or delete of one
 * reached both. The clock is frozen for every test in this file.
 */

const FROZEN = 1_790_000_000_000;
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(FROZEN);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('generateEntityId', () => {
  it('keeps the prefix and the time, and never repeats within one millisecond', () => {
    const ids = Array.from({ length: 10_000 }, () => generateEntityId('tx'));
    expect(new Set(ids).size).toBe(10_000);
    for (const id of ids) expect(id).toMatch(new RegExp(`^tx-${FROZEN}-[0-9a-f]{12}$`));
  });

  it('works where crypto.randomUUID is missing, as on the LAN dev server over http', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    const ids = Array.from({ length: 1_000 }, () => generateEntityId('w'));
    expect(new Set(ids).size).toBe(1_000);
  });

  it('works with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = Array.from({ length: 1_000 }, () => generateEntityId('w'));
    expect(new Set(ids).size).toBe(1_000);
    for (const id of ids) expect(id).toMatch(new RegExp(`^w-${FROZEN}-[0-9a-f]{12}$`));
  });
});

let latest: {
  state: ReturnType<typeof useFinanceState>;
  actions: ReturnType<typeof useFinanceActions>;
  diary: ReturnType<typeof useDiaryState>;
  diaryActions: ReturnType<typeof useDiaryActions>;
  rules: ReturnType<typeof useKeywordRulesState>;
  ruleActions: ReturnType<typeof useKeywordRulesActions>;
  templates: ReturnType<typeof useTemplateState>;
  templateActions: ReturnType<typeof useTemplateActions>;
} | null = null;
function Probe() {
  latest = {
    state: useFinanceState(),
    actions: useFinanceActions(),
    diary: useDiaryState(),
    diaryActions: useDiaryActions(),
    rules: useKeywordRulesState(),
    ruleActions: useKeywordRulesActions(),
    templates: useTemplateState(),
    templateActions: useTemplateActions(),
  };
  return null;
}
async function run<T>(write: () => Promise<T>): Promise<T> {
  let result!: T;
  await act(async () => { result = await write(); });
  // A tick, so the ref mirrors have run before the next write.
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  return result;
}
const twoNew = <T extends { id: string }>(before: T[], after: T[]) => {
  const known = new Set(before.map((r) => r.id));
  return after.filter((r) => !known.has(r.id)).map((r) => r.id);
};

describe('two guest records of one kind in the same millisecond', () => {
  beforeEach(async () => {
    render(<FinanceProvider><Probe /></FinanceProvider>);
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  });

  it('wallets, and their opening-balance rows', async () => {
    const before = latest!.state.wallets;
    for (const name of ['Wallet A', 'Wallet B']) {
      expect(await run(() => latest!.actions.addWallet({ name, type: 'CASH', currency: 'THB', color: '#6C8EEF', icon: 'wallet' }, 100))).toMatchObject({ success: true });
    }
    const ids = twoNew(before, latest!.state.wallets);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(new Set(latest!.state.transactions.map((t) => t.id)).size).toBe(2);
  });

  it('categories', async () => {
    const before = latest!.state.categories;
    for (const name of ['Pets', 'Plants']) {
      expect(await run(() => latest!.actions.addCategory({ name, type: 'EXPENSE', color: nextColor(IDENTITY_COLORS, latest!.state.categories) })))
        .toMatchObject({ success: true });
    }
    const ids = twoNew(before, latest!.state.categories);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('transactions, so deleting one leaves the other', async () => {
    for (const description of ['Lunch', 'Dinner']) {
      expect(await run(() => latest!.actions.addTransaction({
        amount: 50, type: 'EXPENSE', walletId: 'wal-main-checking', categoryId: 'cat-food', description, transactionDate: '2026-10-09',
      }))).toMatchObject({ success: true });
    }
    const [first, second] = latest!.state.transactions;
    expect(first.id).not.toBe(second.id);
    expect(await run(() => latest!.actions.softDeleteTransaction(first.id))).toMatchObject({ success: true });
    expect(latest!.state.transactions.filter((t) => t.isDeleted).map((t) => t.description)).toEqual([first.description]);
  });

  it('debts', async () => {
    for (const name of ['Loan A', 'Loan B']) {
      expect(await run(() => latest!.actions.addDebt({ name, totalAmount: 1000, remainingAmount: 1000 }))).toMatchObject({ success: true });
    }
    const ids = latest!.state.debts.map((d) => d.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('smart rules', async () => {
    const before = latest!.rules.keywordRules;
    for (const keyword of ['kibble', 'litter']) {
      expect(await run(() => latest!.ruleActions.addKeywordRule(keyword, 'cat-food'))).toEqual({ success: true });
    }
    const ids = twoNew(before, latest!.rules.keywordRules);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('quick templates, so a rename to the other one\'s name is refused', async () => {
    for (const name of ['Coffee', 'Lunch']) {
      expect(await run(() => latest!.templateActions.addPreset({ name, type: 'EXPENSE', amount: 60, description: name }))).toEqual({ success: true });
    }
    const [lunch, coffee] = latest!.templates.presets;
    expect(lunch.id).not.toBe(coffee.id);
    expect(await run(() => latest!.templateActions.updatePreset(coffee.id, { name: 'lunch' })))
      .toEqual({ success: false, error: 'A template named "lunch" already exists' });
  });

  it('diary entries', async () => {
    for (const date of ['2026-10-08', '2026-10-09']) {
      expect(await run(() => latest!.diaryActions.upsertDiaryEntry({ date, mood: 3, workout: false, foodQuality: 'AVERAGE' }))).toEqual({ success: true });
    }
    const ids = latest!.diary.diaryEntries.map((e) => e.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('two CSV imports: their rows and their keys', async () => {
    const row = { rowIndex: 1, date: '2026-10-09', walletName: 'Main Checking', amount: 10, type: 'EXPENSE' as const, description: 'Imported', isValid: true };
    for (let i = 0; i < 2; i++) {
      expect(await run(() => latest!.actions.commitBulkImport([row]))).toMatchObject({ success: true, insertedCount: 1 });
    }
    const txs = latest!.state.transactions;
    expect(txs).toHaveLength(2);
    expect(new Set(txs.map((t) => t.id)).size).toBe(2);
    expect(new Set(txs.map((t) => t.idempotencyKey)).size).toBe(2);
  });
});
