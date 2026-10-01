// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { DiaryView } from '../src/views/DiaryView';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { monthGrid, monthKeyOf, shiftIsoDate, shiftMonth, todayIsoDate } from '../src/utils/date';
import { daySpending, diaryMonth } from '../src/selectors/diary';
import type { DiaryEntry, Transaction } from '../src/types';

/**
 * Phase 61 (ADR 0036, spec 6.5): the Daily diary, mounted inside the real
 * `FinanceProvider` in guest mode and seeded through localStorage. A fresh
 * guest has no diary entries and no transactions.
 */
let originalTz: string | undefined;
beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = 'Asia/Bangkok';
});
afterAll(() => {
  process.env.TZ = originalTz;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const TODAY = todayIsoDate();
const YESTERDAY = shiftIsoDate(TODAY, -1);

function entryRow(overrides: Partial<DiaryEntry> & Pick<DiaryEntry, 'id' | 'date'>): DiaryEntry {
  return {
    userId: 'guest',
    mood: 3,
    workout: false,
    foodQuality: 'AVERAGE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1;
  return {
    id: `seed-${seq}`,
    userId: 'guest',
    walletId: 'wal-cash',
    categoryId: 'cat-food',
    description: `row ${seq}`,
    transactionDate: TODAY,
    isDeleted: false,
    createdBy: 'guest',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function mount(options: { entries?: DiaryEntry[]; rows?: Transaction[]; onOpenDayTransactions?: (date: string) => void } = {}) {
  if (options.entries) localStorage.setItem('pf_diary', JSON.stringify(options.entries));
  if (options.rows) localStorage.setItem('pf_transactions', JSON.stringify(options.rows));
  return render(
    <FinanceProvider>
      <DiaryView onOpenDayTransactions={options.onOpenDayTransactions} />
    </FinanceProvider>
  );
}

const byId = (id: string) => document.getElementById(id);
const pressed = (id: string) => byId(id)!.getAttribute('aria-pressed');
const EMOJI = /\p{Extended_Pictographic}/u;

describe('the page header', () => {
  it('is titled "Daily diary" with Export JSON, the one export on the page', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Daily diary' })).toBeTruthy();
    expect(byId('export-diary-btn')!.textContent).toBe('Export JSON');
  });
});

describe('the entry form', () => {
  it("opens on today's saved entry, not on defaults", () => {
    mount({
      entries: [entryRow({ id: 'today', date: TODAY, mood: 2, workout: true, workoutNote: 'Swim', foodQuality: 'JUNK', notes: 'Long day' })],
    });
    expect(pressed('mood-btn-2')).toBe('true');
    expect(pressed('activity-btn-workout')).toBe('true');
    expect((byId('diary-workout-note') as HTMLInputElement).value).toBe('Swim');
    expect(pressed('food-btn-junk')).toBe('true');
    expect((byId('diary-notes-textarea') as HTMLTextAreaElement).value).toBe('Long day');
  });

  it('starts a day with no entry with no mood, a rest day, average meals and an empty note, and waits for a mood', () => {
    mount();
    for (const level of [1, 2, 3, 4, 5]) expect(pressed(`mood-btn-${level}`)).toBe('false');
    expect(pressed('activity-btn-rest')).toBe('true');
    expect(byId('diary-workout-note')).toBeNull();
    expect(pressed('food-btn-average')).toBe('true');
    expect((byId('diary-notes-textarea') as HTMLTextAreaElement).value).toBe('');
    const save = byId('save-diary-entry-btn') as HTMLButtonElement;
    expect(save.textContent).toBe('Save entry');
    expect(save.disabled).toBe(true);
    expect(byId('diary-save-status')!.textContent).toBe('Pick a mood to save.');

    fireEvent.click(byId('mood-btn-4')!);
    expect(save.disabled).toBe(false);
  });

  it('labels each mood with its number and word, and has no emoji anywhere', () => {
    mount({ entries: [entryRow({ id: 'a', date: YESTERDAY, notes: 'ok' })] });
    expect(byId('mood-btn-1')!.textContent).toBe('1Very low');
    expect(byId('mood-btn-3')!.textContent).toBe('3Neutral');
    expect(byId('mood-btn-5')!.textContent).toBe('5Great');
    expect(byId('food-btn-healthy')!.textContent).toBe('Clean / home');
    expect(byId('food-btn-junk')!.textContent).toBe('Fast food / junk');
    expect(EMOJI.test(document.body.textContent ?? '')).toBe(false);
  });

  it('draws the selected Mood, Activity and Meals option in one style, never a colour by meaning', () => {
    mount();
    fireEvent.click(byId('mood-btn-5')!);
    fireEvent.click(byId('activity-btn-workout')!);
    fireEvent.click(byId('food-btn-junk')!);
    const selected = ['mood-btn-5', 'activity-btn-workout', 'food-btn-junk'].map((id) => byId(id)!.className);
    expect(new Set(selected).size).toBe(1);
    expect(selected[0]).toContain('bg-selected');
    fireEvent.click(byId('food-btn-healthy')!);
    expect(byId('food-btn-healthy')!.className).toBe(selected[0]);
    for (const cls of selected) expect(cls).not.toMatch(/income|expense|pending/);
  });

  it("says what the day cost so far, from spending only", () => {
    mount({
      rows: [
        tx({ type: 'EXPENSE', amount: 120 }),
        tx({ type: 'EXPENSE', amount: 30.5 }),
        tx({ type: 'INCOME', amount: 999, categoryId: 'cat-salary' }),
        tx({ type: 'TRANSFER', amount: 50, destinationWalletId: 'wal-main-checking', categoryId: undefined }),
        tx({ type: 'EXPENSE', amount: 7, isDeleted: true }),
      ],
    });
    expect(byId('diary-day-spending')!.textContent).toBe(`Today · spent ${formatCurrencyAmount(150.5)} in 2 transactions so far`);
  });

  it('steps a day back and forward, never past today, and the picker stops at today', () => {
    mount();
    // The form remounts for each day, so the buttons are looked up each time.
    const next = () => byId('diary-next-day-btn') as HTMLButtonElement;
    expect(next().disabled).toBe(true);
    expect((byId('diary-date-picker') as HTMLInputElement).max).toBe(TODAY);

    fireEvent.click(byId('diary-prev-day-btn')!);
    expect(byId('diary-day-spending')!.textContent).toBe('Yesterday · no spending');
    expect(next().disabled).toBe(false);
    fireEvent.click(next());
    expect(byId('diary-day-spending')!.textContent).toBe('Today · no spending so far');

    // A future date typed into the picker is ignored.
    fireEvent.change(byId('diary-date-picker')!, { target: { value: shiftIsoDate(TODAY, 3) } });
    expect(byId('diary-day-spending')!.textContent).toBe('Today · no spending so far');
  });

  it('saves the entry and says so', async () => {
    mount();
    fireEvent.click(byId('mood-btn-4')!);
    fireEvent.change(byId('diary-notes-textarea')!, { target: { value: 'Quiet day' } });
    fireEvent.click(byId('save-diary-entry-btn')!);

    await waitFor(() => expect(byId('diary-save-status')!.textContent).toMatch(/^Diary entry logged for /));
    expect(screen.getByTestId('diary-entry-notes').textContent).toBe('Quiet day');
    expect(pressed('mood-btn-4')).toBe('true');
  });
});

describe('the calendar', () => {
  it('starts the week on Monday and marks logged days, today and the future', () => {
    const logged = shiftIsoDate(TODAY, -2);
    mount({ entries: [entryRow({ id: 'a', date: logged })] });
    const firstOfMonth = `${monthKeyOf(TODAY)}-01`;
    const firstCell = monthGrid(monthKeyOf(TODAY))[0].findIndex((cell) => cell === firstOfMonth);
    expect(firstCell).toBe((new Date(Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7)) - 1, 1).getDay() + 6) % 7);

    const todayBtn = byId(`diary-cal-day-${TODAY}`)!;
    expect(todayBtn.className).toContain('ring-focus');
    expect(todayBtn.getAttribute('aria-pressed')).toBe('true');
    if (monthKeyOf(logged) === monthKeyOf(TODAY)) {
      expect(byId(`diary-cal-day-${logged}`)!.className).toContain('bg-logged');
      expect(byId(`diary-cal-day-${logged}`)!.getAttribute('aria-label')).toMatch(/, logged$/);
      expect(byId('diary-calendar-count')!.textContent).toMatch(/^1 day logged in /);
    }
    const future = shiftIsoDate(TODAY, 1);
    if (monthKeyOf(future) === monthKeyOf(TODAY)) {
      expect((byId(`diary-cal-day-${future}`) as HTMLButtonElement).disabled).toBe(true);
      expect(byId(`diary-cal-day-${future}`)!.className).toContain('text-fg-disabled');
    }
    expect((byId('diary-cal-next-month-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it("loads a clicked day's entry into the form", () => {
    const day = shiftIsoDate(TODAY, -5);
    mount({ entries: [entryRow({ id: 'a', date: day, mood: 1, foodQuality: 'HEALTHY' })] });
    if (monthKeyOf(day) !== monthKeyOf(TODAY)) fireEvent.click(byId('diary-cal-prev-month-btn')!);
    fireEvent.click(byId(`diary-cal-day-${day}`)!);
    expect(pressed('mood-btn-1')).toBe('true');
    expect(pressed('food-btn-healthy')).toBe('true');
    expect(byId(`diary-cal-day-${day}`)!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('recent entries', () => {
  it('shows each day newest first with its spending, mood, summary and note', () => {
    mount({
      entries: [
        entryRow({ id: 'old', date: shiftIsoDate(TODAY, -3), mood: 3 }),
        entryRow({ id: 'new', date: YESTERDAY, mood: 4, workout: true, foodQuality: 'HEALTHY', notes: 'Walked to work' }),
      ],
      rows: [tx({ type: 'EXPENSE', amount: 80, transactionDate: YESTERDAY }), tx({ type: 'EXPENSE', amount: 20, transactionDate: YESTERDAY })],
    });
    const rows = Array.from(document.querySelectorAll('[id^="diary-card-"]')).map((el) => el.id);
    expect(rows).toEqual(['diary-card-new', 'diary-card-old']);

    const row = byId('diary-card-new')!;
    expect(row.textContent).toContain(`${MINUS}${formatCurrencyAmount(100)}`);
    expect(within(row).getByRole('img', { name: 'Mood 4 of 5' })).toBeTruthy();
    expect(row.textContent).toContain('Good · Workout · Clean / home meals · 2 transactions');
    expect(within(row).getByTestId('diary-entry-notes').textContent).toBe('Walked to work');
    expect(byId('diary-card-old')!.textContent).toContain('Neutral · Rest day · Average meals · No transactions');
  });

  it('hands "N transactions" off to the Transactions page for that day', () => {
    const open = vi.fn();
    mount({ entries: [entryRow({ id: 'a', date: YESTERDAY })], rows: [tx({ type: 'EXPENSE', amount: 5, transactionDate: YESTERDAY })], onOpenDayTransactions: open });
    fireEvent.click(byId(`diary-day-tx-link-${YESTERDAY}`)!);
    expect(open).toHaveBeenCalledWith(YESTERDAY);
  });

  it('keeps Edit and Delete in each entry\'s menu', () => {
    mount({ entries: [entryRow({ id: 'a', date: YESTERDAY, mood: 5 })] });
    expect(byId('delete-diary-a')).toBeNull();
    fireEvent.click(byId('diary-menu-btn-a')!);
    expect(byId('edit-diary-a')!.textContent).toBe('Edit entry');
    expect(byId('delete-diary-a')!.textContent).toBe('Delete entry…');

    fireEvent.click(byId('edit-diary-a')!);
    expect(pressed('mood-btn-5')).toBe('true');
  });

  it('asks before deleting; Cancel keeps the entry, and a confirmed delete moves focus to the next entry', async () => {
    mount({ entries: [entryRow({ id: 'a', date: YESTERDAY }), entryRow({ id: 'b', date: shiftIsoDate(TODAY, -4) })] });
    fireEvent.click(byId('diary-menu-btn-a')!);
    fireEvent.click(byId('delete-diary-a')!);
    const dialog = screen.getByRole('dialog', { name: 'Delete diary entry' });
    expect(dialog.textContent).toContain("Its mood, activity, meals and notes are removed. That day's transactions are not touched.");
    fireEvent.click(within(dialog).getByText('Cancel'));
    expect(byId('diary-card-a')).toBeTruthy();

    fireEvent.click(byId('diary-menu-btn-a')!);
    fireEvent.click(byId('delete-diary-a')!);
    fireEvent.click(byId('confirm-destructive-btn')!);
    await waitFor(() => expect(byId('diary-card-a')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(byId('diary-menu-btn-b')));
  });
});

describe('the date and diary helpers', () => {
  it('monthGrid starts on Monday and pads with nulls', () => {
    // September 2026 starts on a Tuesday and has 30 days.
    const weeks = monthGrid('2026-09');
    expect(weeks[0]).toEqual([null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // February 2027 starts on a Monday: no lead.
    expect(monthGrid('2027-02')[0][0]).toBe('2027-02-01');
    // A month starting on Sunday puts it last.
    expect(monthGrid('2026-11')[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
  });

  it('shiftMonth crosses years both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', -21)).toBe('2024-12');
  });

  it('daySpending counts live spending only, and diaryMonth live entries of one month', () => {
    const rows = [
      tx({ type: 'EXPENSE', amount: 10.1, transactionDate: '2026-09-28' }),
      tx({ type: 'EXPENSE', amount: 0.2, transactionDate: '2026-09-28' }),
      tx({ type: 'DEBT_REPAYMENT', amount: 500, transactionDate: '2026-09-28', categoryId: 'cat-debt' }),
      tx({ type: 'EXPENSE', amount: 99, transactionDate: '2026-09-27' }),
    ];
    expect(daySpending(rows, '2026-09-28')).toEqual({ spending: 10.3, count: 2 });
    const month = diaryMonth(
      [entryRow({ id: 'a', date: '2026-09-01' }), entryRow({ id: 'b', date: '2026-10-01' }), entryRow({ id: 'c', date: '2026-09-02', isDeleted: true })],
      '2026-09'
    );
    expect([...month]).toEqual(['2026-09-01']);
  });
});
