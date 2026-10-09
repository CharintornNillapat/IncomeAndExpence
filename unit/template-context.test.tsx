// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { FinanceProvider, useFinanceActions, useFinanceState } from '../src/context/FinanceContext';
import { useTemplateActions, useTemplateState } from '../src/context/TemplateContext';
import { todayIsoDate } from '../src/utils/date';

/**
 * Phase 118 (ADR 0094): the quick templates. They live on this device only.
 * These pin what the three writes accept and refuse, what the batched writer
 * stores, and what `applyPreset` records, and pass against the code from
 * before the move.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

let latest: {
  state: ReturnType<typeof useFinanceState>;
  actions: ReturnType<typeof useFinanceActions>;
  templates: ReturnType<typeof useTemplateState>;
  templateActions: ReturnType<typeof useTemplateActions>;
} | null = null;
function Probe() {
  latest = {
    state: useFinanceState(),
    actions: useFinanceActions(),
    templates: useTemplateState(),
    templateActions: useTemplateActions(),
  };
  return null;
}
// The templates' own contexts (Phase 118, ADR 0094).
const templates = () => latest!.templates.presets;
const templateWrite = () => latest!.templateActions;

const COFFEE = { name: 'Coffee', type: 'EXPENSE' as const, amount: 60, description: 'Morning coffee', categoryId: 'cat-food', walletId: 'wal-cash' };

async function mount() {
  render(<FinanceProvider><Probe /></FinanceProvider>);
  // A tick, so the ref mirrors have run, as they have by a person's first tap.
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}
async function run<T>(write: () => Promise<T>): Promise<T> {
  let result!: T;
  await act(async () => { result = await write(); });
  return result;
}

describe('the quick templates', () => {
  it('a new template is shown first and refused under a name already used, in any case', async () => {
    await mount();
    expect(await run(() => templateWrite().addPreset({ ...COFFEE, name: '  Coffee ' }))).toEqual({ success: true });
    expect(await run(() => templateWrite().addPreset({ ...COFFEE, name: 'Lunch', amount: 120 }))).toEqual({ success: true });
    expect(templates().map((p) => [p.name, p.amount])).toEqual([['Lunch', 120], ['Coffee', 60]]);
    expect(await run(() => templateWrite().addPreset({ ...COFFEE, name: 'COFFEE' })))
      .toEqual({ success: false, error: 'A template named "COFFEE" already exists' });
    expect(templates()).toHaveLength(2);
  });

  it('an edit is checked before it is applied', async () => {
    await mount();
    await run(() => templateWrite().addPreset(COFFEE));
    await run(() => templateWrite().addPreset({ ...COFFEE, name: 'Lunch' }));
    const id = templates().find((p) => p.name === 'Coffee')!.id;

    expect(await run(() => templateWrite().updatePreset('nope', { amount: 1 }))).toEqual({ success: false, error: 'Template not found' });
    expect(await run(() => templateWrite().updatePreset(id, { name: '   ' }))).toEqual({ success: false, error: 'Template name is required' });
    expect(await run(() => templateWrite().updatePreset(id, { name: 'lunch' })))
      .toEqual({ success: false, error: 'A template named "lunch" already exists' });
    expect(await run(() => templateWrite().updatePreset(id, { amount: 0 }))).toEqual({ success: false, error: 'Amount must be greater than 0' });
    expect(await run(() => templateWrite().updatePreset(id, { description: ' ' }))).toEqual({ success: false, error: 'Description is required' });

    expect(await run(() => templateWrite().updatePreset(id, { name: ' Flat white ', amount: 75 }))).toEqual({ success: true });
    expect(templates().find((p) => p.id === id)).toMatchObject({ name: 'Flat white', amount: 75, description: 'Morning coffee' });
  });

  it('a delete removes the one template, and a second delete says it is gone', async () => {
    await mount();
    await run(() => templateWrite().addPreset(COFFEE));
    const id = templates()[0].id;
    expect(await run(() => templateWrite().deletePreset(id))).toEqual({ success: true });
    expect(templates()).toEqual([]);
    expect(await run(() => templateWrite().deletePreset(id))).toEqual({ success: false, error: 'Template not found' });
  });

  it('is written to pf_presets by the batched writer and read back on the next load', async () => {
    const first = render(<FinanceProvider><Probe /></FinanceProvider>);
    await run(() => templateWrite().addPreset(COFFEE));
    // Longer than the writer's 250 ms debounce.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));
    const stored = JSON.parse(localStorage.getItem('pf_presets') ?? '[]');
    expect(stored).toEqual([expect.objectContaining({ name: 'Coffee', amount: 60, walletId: 'wal-cash', categoryId: 'cat-food' })]);

    first.unmount();
    latest = null;
    render(<FinanceProvider><Probe /></FinanceProvider>);
    expect(templates()).toEqual(stored);
  });

  it('applying one records a transaction through the ledger, dated today, from its own wallet and category', async () => {
    await mount();
    await run(() => templateWrite().addPreset(COFFEE));
    const result = await run(() => latest!.actions.applyPreset(templates()[0].id));
    expect(result).toMatchObject({ success: true });
    expect(latest!.state.transactions).toEqual([expect.objectContaining({
      amount: 60, type: 'EXPENSE', description: 'Morning coffee', walletId: 'wal-cash', categoryId: 'cat-food', transactionDate: todayIsoDate(),
    })]);
    expect(latest!.state.wallets.find((w) => w.id === 'wal-cash')!.balance).toBe(-60);
    expect(await run(() => latest!.actions.applyPreset('nope'))).toEqual({ success: false, error: 'Template not found' });
  });

  it('a template whose wallet and category are gone uses the first wallet and no category', async () => {
    await mount();
    await run(() => templateWrite().addPreset({ ...COFFEE, walletId: 'wal-gone', categoryId: 'cat-gone' }));
    expect(await run(() => latest!.actions.applyPreset(templates()[0].id))).toMatchObject({ success: true });
    const [tx] = latest!.state.transactions;
    expect(tx.walletId).toBe(latest!.state.wallets[0].id);
    expect(tx.categoryId).toBeUndefined();
  });
});
