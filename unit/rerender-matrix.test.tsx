// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { appendFileSync } from 'node:fs';
import { Profiler, Suspense } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { FinanceProvider, useFinanceActions, useFinanceState } from '../src/context/FinanceContext';
import { useDiaryActions } from '../src/context/DiaryContext';
import { useKeywordRulesActions, useKeywordRulesState } from '../src/context/KeywordRulesContext';
import { useTemplateActions, useTemplateState } from '../src/context/TemplateContext';
import { DashboardView } from '../src/views/DashboardView';
import { TransactionsView } from '../src/views/TransactionsView';
import { WalletsView } from '../src/views/WalletsView';
import { DebtsView } from '../src/views/DebtsView';
import { CategoriesView } from '../src/views/CategoriesView';
import { DiaryView } from '../src/views/DiaryView';
import { IDENTITY_COLORS } from '../src/utils/identityPalette';
import { nextColor } from '../src/selectors/categories';
import { todayIsoDate } from '../src/utils/date';

/**
 * Phase 117 (ADR 0093): how many times each of the six views re-renders on each
 * kind of write, counted with React's Profiler on the real views under one
 * guest FinanceProvider. ADR 0093 holds the table before and after the rules
 * slice; set RERENDER_MATRIX_OUT to a file path to have the counts written
 * there.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const VIEWS = ['dashboard', 'transactions', 'wallets', 'debts', 'categories', 'diary'] as const;
type View = (typeof VIEWS)[number];
type Counts = Record<View, number>;

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));

let latest: {
  state: ReturnType<typeof useFinanceState>;
  actions: ReturnType<typeof useFinanceActions>;
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
    diaryActions: useDiaryActions(),
    rules: useKeywordRulesState(),
    ruleActions: useKeywordRulesActions(),
    templates: useTemplateState(),
    templateActions: useTemplateActions(),
  };
  return null;
}

async function measure(): Promise<Record<string, Counts>> {
  const renders = Object.fromEntries(VIEWS.map((v) => [v, 0])) as Counts;
  const onRender = (id: string) => { renders[id as View] += 1; };
  const take = (): Counts => {
    const counted = { ...renders };
    for (const v of VIEWS) renders[v] = 0;
    return counted;
  };
  render(
    <FinanceProvider>
      <Probe />
      <Suspense fallback={null}>
        <Profiler id="dashboard" onRender={onRender}><DashboardView /></Profiler>
        <Profiler id="transactions" onRender={onRender}><TransactionsView /></Profiler>
        <Profiler id="wallets" onRender={onRender}><WalletsView /></Profiler>
        <Profiler id="debts" onRender={onRender}><DebtsView /></Profiler>
        <Profiler id="categories" onRender={onRender}><CategoriesView /></Profiler>
        <Profiler id="diary" onRender={onRender}><DiaryView /></Profiler>
      </Suspense>
    </FinanceProvider>,
  );
  await settle();
  take();

  const rows: Record<string, Counts> = {};
  const step = async (name: string, write: () => Promise<{ success: boolean; error?: string }>) => {
    let result: { success: boolean; error?: string } = { success: false };
    await act(async () => { result = await write(); });
    expect(result, name).toMatchObject({ success: true });
    await settle();
    rows[name] = take();
  };

  await step('transaction save', () => latest!.actions.addTransaction({
    amount: 50, type: 'EXPENSE', walletId: 'wal-main-checking', categoryId: 'cat-food', description: 'Lunch', transactionDate: todayIsoDate(),
  }));
  await step('category add', () => latest!.actions.addCategory({
    name: 'Pets', type: 'EXPENSE', color: nextColor(IDENTITY_COLORS, latest!.state.categories),
  }));
  const pets = latest!.state.categories.find((c) => c.name === 'Pets')!;
  await step('category edit', () => latest!.actions.updateCategory(pets.id, { name: 'Pet care' }));
  await step('rule add', () => latest!.ruleActions.addKeywordRule('kibble', pets.id));
  const rule = latest!.rules.keywordRules.find((r) => r.keyword === 'kibble')!;
  await step('rule delete', () => latest!.ruleActions.deleteKeywordRule(rule.id));
  await step('template add', () => latest!.templateActions.addPreset({ name: 'Coffee', type: 'EXPENSE', amount: 60, description: 'Coffee' }));
  const preset = latest!.templates.presets.find((p) => p.name === 'Coffee')!;
  await step('template edit', () => latest!.templateActions.updatePreset(preset.id, { amount: 65 }));
  // Using a template is a ledger write (`applyPreset` through `addTransaction`).
  await step('template apply', () => latest!.actions.applyPreset(preset.id));
  await step('template delete', () => latest!.templateActions.deletePreset(preset.id));
  await step('diary save', () => latest!.diaryActions.upsertDiaryEntry({ date: todayIsoDate(), mood: 4, workout: false, foodQuality: 'HEALTHY' }));
  return rows;
}

describe('the re-render matrix', () => {
  it('counts each view per write', async () => {
    const rows = await measure();
    const out = process.env.RERENDER_MATRIX_OUT;
    if (out) appendFileSync(out, JSON.stringify(rows) + '\n');

    // Every view shows transactions and category names, so those writes reach all six.
    for (const write of ['transaction save', 'template apply', 'category add', 'category edit']) {
      for (const view of VIEWS) expect(rows[write][view], `${write}: ${view}`).toBeGreaterThan(0);
    }
    // Only the Categories page shows the rules (its usage counts). The one
    // Transactions commit is the CSV import dialog, mounted while closed on
    // purpose (ADR 0031), whose preview applies the rules; the page does not render.
    for (const write of ['rule add', 'rule delete']) {
      expect(rows[write], write).toEqual({ dashboard: 0, transactions: 1, wallets: 0, debts: 0, categories: 1, diary: 0 });
    }
    // Phase 118 (ADR 0094): no view shows the templates, only the entry form
    // and Quick Add, inside their dialogs.
    for (const write of ['template add', 'template edit', 'template delete']) {
      expect(rows[write], write).toEqual({ dashboard: 0, transactions: 0, wallets: 0, debts: 0, categories: 0, diary: 0 });
    }
    // Phase 116: a diary save reaches the Dashboard and the diary only.
    expect(rows['diary save']).toEqual({ dashboard: 1, transactions: 0, wallets: 0, debts: 0, categories: 0, diary: 1 });
  });
});
