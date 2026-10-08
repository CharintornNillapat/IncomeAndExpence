// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { Profiler, Suspense } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { FinanceProvider, useFinanceActions } from '../src/context/FinanceContext';
import { useDiaryActions, useDiaryState } from '../src/context/DiaryContext';
import { DashboardView } from '../src/views/DashboardView';
import { DiaryView } from '../src/views/DiaryView';
import { TransactionsView } from '../src/views/TransactionsView';
import { todayIsoDate } from '../src/utils/date';

/**
 * Phase 116 (ADR 0092): the diary has contexts of its own, composed under
 * FinanceProvider. A diary write re-renders what shows the diary and nothing
 * else; a ledger write is unchanged. Counted with React's Profiler on the real
 * views. Before the move a diary write also re-rendered the Transactions page.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));

let latest: {
  actions: ReturnType<typeof useFinanceActions>;
  diary: ReturnType<typeof useDiaryState>;
  diaryActions: ReturnType<typeof useDiaryActions>;
} | null = null;
function Probe() {
  latest = { actions: useFinanceActions(), diary: useDiaryState(), diaryActions: useDiaryActions() };
  return null;
}

describe('re-renders', () => {
  it('a diary write re-renders the Dashboard and the Diary, not the Transactions page', async () => {
    const renders: Record<string, number> = { dashboard: 0, diary: 0, transactions: 0 };
    const onRender = (id: string) => { renders[id] += 1; };
    const take = () => { const counted = { ...renders }; for (const k in renders) renders[k] = 0; return counted; };
    render(
      <FinanceProvider>
        <Probe />
        <Suspense fallback={null}>
          <Profiler id="dashboard" onRender={onRender}><DashboardView /></Profiler>
          <Profiler id="diary" onRender={onRender}><DiaryView /></Profiler>
          <Profiler id="transactions" onRender={onRender}><TransactionsView /></Profiler>
        </Suspense>
      </FinanceProvider>,
    );
    await settle();
    take();

    await act(async () => {
      await latest!.diaryActions.upsertDiaryEntry({ date: todayIsoDate(), mood: 4, workout: false, foodQuality: 'HEALTHY' });
    });
    await settle();
    const diaryWrite = take();
    expect(diaryWrite.transactions).toBe(0);
    expect(diaryWrite.dashboard).toBeGreaterThan(0);
    expect(diaryWrite.diary).toBeGreaterThan(0);

    // A ledger write still reaches all three: the Diary shows each day's spending.
    await act(async () => {
      await latest!.actions.addTransaction({
        amount: 50, type: 'EXPENSE', walletId: 'wal-main-checking', description: 'Lunch', transactionDate: todayIsoDate(),
      });
    });
    await settle();
    const ledgerWrite = take();
    expect(ledgerWrite.transactions).toBeGreaterThan(0);
    expect(ledgerWrite.dashboard).toBeGreaterThan(0);
    expect(ledgerWrite.diary).toBeGreaterThan(0);
  });
});

describe('a guest diary on this device', () => {
  it('is written to pf_diary by the batched writer and read back on the next load', async () => {
    const first = render(<FinanceProvider><Probe /></FinanceProvider>);
    await act(async () => {
      await latest!.diaryActions.upsertDiaryEntry({ date: '2026-10-07', mood: 2, workout: true, workoutNote: 'Swim', foodQuality: 'JUNK' });
    });
    // Longer than the writer's 250 ms debounce.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));
    const stored = JSON.parse(localStorage.getItem('pf_diary') ?? '[]');
    expect(stored).toEqual([expect.objectContaining({ date: '2026-10-07', mood: 2, workoutNote: 'Swim', foodQuality: 'JUNK' })]);

    first.unmount();
    latest = null;
    render(<FinanceProvider><Probe /></FinanceProvider>);
    expect(latest!.diary.diaryEntries).toEqual(stored);
  });
});
