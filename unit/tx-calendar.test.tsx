// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { TxCalendar, HEAT_CLASS, HEAT_LEGEND, type TxCalendarDay } from '../src/components/transaction/TxCalendar';
import { TxDayPanel } from '../src/components/transaction/TxDayPanel';
import { HEAT_LEVELS } from '../src/selectors/ledger';
import { formatCurrencyAmount, MINUS } from '../src/utils/currency';
import { formatDayLabel, formatWeekdayDate } from '../src/utils/date';
import type { Category, Transaction, Wallet } from '../src/types';

afterEach(() => {
  cleanup();
});

const TODAY = '2026-10-20';
const MONTH_KEY = '2026-10';

const WALLETS = new Map<string, Wallet>([
  [
    'wal-cash',
    {
      id: 'wal-cash',
      userId: 'guest',
      name: 'Cash',
      type: 'CASH',
      balance: 1000,
      currency: 'THB',
      color: '#10B981',
      icon: 'Wallet',
      isArchived: false,
      isDeleted: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
]);

const CATEGORIES = new Map<string, Category>([
  [
    'cat-food',
    {
      id: 'cat-food',
      name: 'Food & Dining',
      type: 'EXPENSE',
      icon: 'Utensils',
      color: '#F43F5E',
      isSystem: true,
      isDeleted: false,
    },
  ],
]);

function makeTx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount'>): Transaction {
  return {
    userId: 'guest',
    walletId: 'wal-cash',
    categoryId: 'cat-food',
    description: 'Lunch',
    transactionDate: TODAY,
    isDeleted: false,
    createdBy: 'guest',
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z',
    ...overrides,
  };
}

const byId = (id: string) => document.getElementById(id);

describe('TxCalendar and TxDayPanel (ADR 0109)', () => {
  it('1. renders 31 day buttons for October 2026, places 2026-10-01 in the fourth cell (Monday first), and labels weekdays Mon to Sun', () => {
    const { container } = render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={new Map()}
        month={{ income: 0, spending: 0, net: 0 }}
      />,
    );

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[id^="tx-cal-day-"]'));
    expect(buttons).toHaveLength(31);
    expect(buttons[0].id).toBe('tx-cal-day-2026-10-01');
    expect(buttons[30].id).toBe('tx-cal-day-2026-10-31');

    const rows = container.querySelectorAll('.grid.grid-cols-7');
    const weekdayCells = Array.from(rows[0].children).map((el) => el.textContent);
    expect(weekdayCells).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

    const firstWeekChildren = Array.from(rows[1].children);
    expect(firstWeekChildren[0].tagName).toBe('SPAN');
    expect(firstWeekChildren[1].tagName).toBe('SPAN');
    expect(firstWeekChildren[2].tagName).toBe('SPAN');
    expect(firstWeekChildren[3].id).toBe('tx-cal-day-2026-10-01');
  });

  it('2. formats aria-label for a spending day, a one-row day, an empty day, and appends ", today" on today', () => {
    const days = new Map<string, TxCalendarDay>([
      ['2026-10-21', { income: 0, spending: 735, net: -735, count: 4, heat: 3 }],
      ['2026-10-19', { income: 100, spending: 0, net: 100, count: 1, heat: 0 }],
    ]);

    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today="2026-10-25"
        selectedDay="2026-10-21"
        onSelectDay={() => {}}
        days={days}
        month={{ income: 100, spending: 735, net: -635 }}
      />,
    );

    expect(byId('tx-cal-day-2026-10-21')!.getAttribute('aria-label')).toBe(
      `Wed, Oct 21, spent ฿735.00, net ${MINUS}฿735.00, 4 transactions`,
    );
    expect(byId('tx-cal-day-2026-10-19')!.getAttribute('aria-label')).toContain('1 transaction');
    expect(byId('tx-cal-day-2026-10-22')!.getAttribute('aria-label')).toBe('Thu, Oct 22, no transactions');
    expect(byId('tx-cal-day-2026-10-25')!.getAttribute('aria-label')).toBe('Sun, Oct 25, no transactions, today');
  });

  it('3. sets aria-pressed="true" only on selectedDay and calls onSelectDay with the clicked ISO date', () => {
    const onSelectDay = vi.fn();
    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay="2026-10-15"
        onSelectDay={onSelectDay}
        days={new Map()}
        month={{ income: 0, spending: 0, net: 0 }}
      />,
    );

    expect(byId('tx-cal-day-2026-10-15')!.getAttribute('aria-pressed')).toBe('true');
    expect(byId(`tx-cal-day-${TODAY}`)!.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(byId('tx-cal-day-2026-10-12')!);
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-12');
  });

  it('4. disables a future day with no entry, enables a future day with an entry, and enables today and past days', () => {
    const days = new Map<string, TxCalendarDay>([
      ['2026-10-25', { income: 0, spending: 120, net: -120, count: 1, heat: 3 }],
    ]);

    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={days}
        month={{ income: 0, spending: 120, net: -120 }}
      />,
    );

    expect((byId('tx-cal-day-2026-10-10') as HTMLButtonElement).disabled).toBe(false);
    expect((byId(`tx-cal-day-${TODAY}`) as HTMLButtonElement).disabled).toBe(false);
    expect((byId('tx-cal-day-2026-10-22') as HTMLButtonElement).disabled).toBe(true);
    expect((byId('tx-cal-day-2026-10-25') as HTMLButtonElement).disabled).toBe(false);
  });

  it('5. applies bg-heat-1|2|3 for heat 1..3, none for heat 0, and bg-brand-fill with no bg-heat-* on the selected cell', () => {
    const days = new Map<string, TxCalendarDay>([
      ['2026-10-01', { income: 200, spending: 0, net: 200, count: 1, heat: 0 }],
      ['2026-10-02', { income: 0, spending: 100, net: -100, count: 1, heat: 1 }],
      ['2026-10-03', { income: 0, spending: 200, net: -200, count: 1, heat: 2 }],
      ['2026-10-04', { income: 0, spending: 300, net: -300, count: 1, heat: 3 }],
      ['2026-10-05', { income: 0, spending: 300, net: -300, count: 1, heat: 3 }],
    ]);

    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay="2026-10-05"
        onSelectDay={() => {}}
        days={days}
        month={{ income: 200, spending: 900, net: -700 }}
      />,
    );

    expect(byId('tx-cal-day-2026-10-01')!.className).not.toMatch(/bg-heat-/);
    expect(byId('tx-cal-day-2026-10-02')!.className).toContain('bg-heat-1');
    expect(byId('tx-cal-day-2026-10-03')!.className).toContain('bg-heat-2');
    expect(byId('tx-cal-day-2026-10-04')!.className).toContain('bg-heat-3');
    expect(byId('tx-cal-day-2026-10-05')!.className).toContain('bg-brand-fill');
    expect(byId('tx-cal-day-2026-10-05')!.className).not.toMatch(/bg-heat-/);
  });

  it('6. renders net text inside a hidden sm:block span (−฿735.00 for negative, +฿500.00 for positive) and omits it when a day has no entry', () => {
    const days = new Map<string, TxCalendarDay>([
      ['2026-10-10', { income: 0, spending: 735, net: -735, count: 2, heat: 3 }],
      ['2026-10-11', { income: 500, spending: 0, net: 500, count: 1, heat: 0 }],
    ]);

    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={days}
        month={{ income: 500, spending: 735, net: -235 }}
      />,
    );

    const negSpan = byId('tx-cal-day-2026-10-10')!.querySelectorAll('span')[1];
    expect(negSpan.className).toContain('hidden');
    expect(negSpan.className).toContain('sm:block');
    expect(negSpan.textContent).toBe(`${MINUS}฿735.00`);

    const posSpan = byId('tx-cal-day-2026-10-11')!.querySelectorAll('span')[1];
    expect(posSpan.className).toContain('hidden');
    expect(posSpan.className).toContain('sm:block');
    expect(posSpan.textContent).toBe('+฿500.00');

    expect(byId('tx-cal-day-2026-10-12')!.querySelectorAll('span')).toHaveLength(1);
  });

  it('7. defines HEAT_LEVELS keys in HEAT_CLASS and HEAT_LEGEND, and renders each swatch label plus Today and Selected day in the legend', () => {
    expect(Object.keys(HEAT_CLASS)).toHaveLength(HEAT_LEVELS);
    expect(Object.keys(HEAT_LEGEND)).toHaveLength(HEAT_LEVELS);

    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={new Map()}
        month={{ income: 0, spending: 0, net: 0 }}
      />,
    );

    const legend = byId('tx-cal-legend')!;
    for (let level = 1; level <= HEAT_LEVELS; level += 1) {
      expect(legend.textContent).toContain(HEAT_LEGEND[level]);
    }
    expect(legend.textContent).toContain('Today');
    expect(legend.textContent).toContain('Selected day');
  });

  it('8. renders #tx-cal-heading, steps prev/next month via onChangeMonth, disables next when !canGoNext, and steps December to 2027-01', () => {
    const onChangeMonth = vi.fn();
    const { rerender } = render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={onChangeMonth}
        canGoNext={false}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={new Map()}
        month={{ income: 0, spending: 0, net: 0 }}
      />,
    );

    expect(byId('tx-cal-heading')!.textContent).toBe('October 2026');
    expect((byId('tx-cal-prev-month-btn') as HTMLButtonElement).disabled).toBe(false);
    expect((byId('tx-cal-next-month-btn') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(byId('tx-cal-prev-month-btn')!);
    expect(onChangeMonth).toHaveBeenCalledWith('2026-09');

    rerender(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={onChangeMonth}
        canGoNext={true}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={new Map()}
        month={{ income: 0, spending: 0, net: 0 }}
      />,
    );

    expect((byId('tx-cal-next-month-btn') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(byId('tx-cal-next-month-btn')!);
    expect(onChangeMonth).toHaveBeenCalledWith('2026-11');

    rerender(
      <TxCalendar
        monthKey="2026-12"
        onChangeMonth={onChangeMonth}
        canGoNext={true}
        today="2027-01-10"
        selectedDay={null}
        onSelectDay={() => {}}
        days={new Map()}
        month={{ income: 0, spending: 0, net: 0 }}
      />,
    );

    fireEvent.click(byId('tx-cal-next-month-btn')!);
    expect(onChangeMonth).toHaveBeenCalledWith('2027-01');
  });

  it('9. renders #tx-cal-month-in, #tx-cal-month-out and #tx-cal-month-net through formatCurrencyAmount', () => {
    render(
      <TxCalendar
        monthKey={MONTH_KEY}
        onChangeMonth={() => {}}
        canGoNext={false}
        today={TODAY}
        selectedDay={TODAY}
        onSelectDay={() => {}}
        days={new Map()}
        month={{ income: 1500, spending: 2235.5, net: -735.5 }}
      />,
    );

    expect(byId('tx-cal-month-in')!.textContent).toContain(`+${formatCurrencyAmount(1500)}`);
    expect(byId('tx-cal-month-out')!.textContent).toContain(formatCurrencyAmount(-2235.5));
    expect(byId('tx-cal-month-net')!.textContent).toContain(formatCurrencyAmount(-735.5));
  });

  it('10. renders TxDayPanel with formatDayLabel, insets, #tx-row-* buttons, #tx-cal-add-btn, empty state, day=null state, and conditional diary link', () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn();
    const onOpenDiary = vi.fn();

    const { rerender } = render(
      <TxDayPanel
        day={null}
        today={TODAY}
        totals={undefined}
        rows={[]}
        categories={CATEGORIES}
        wallets={WALLETS}
        selectedTxId={null}
        onSelect={onSelect}
        onAdd={onAdd}
        hasDiaryEntry={false}
      />,
    );

    expect(byId('tx-cal-panel-title')!.textContent).toBe('Pick a day');
    expect(byId('tx-cal-add-btn')).toBeNull();
    expect(byId('tx-cal-diary-link')).toBeNull();

    rerender(
      <TxDayPanel
        day={TODAY}
        today={TODAY}
        totals={undefined}
        rows={[]}
        categories={CATEGORIES}
        wallets={WALLETS}
        selectedTxId={null}
        onSelect={onSelect}
        onAdd={onAdd}
        hasDiaryEntry={false}
        onOpenDiary={onOpenDiary}
      />,
    );

    expect(byId('tx-cal-panel-title')!.textContent).toBe(formatDayLabel(TODAY, TODAY));
    expect(byId('tx-cal-panel-empty')!.textContent).toBe('No transactions on this day');
    expect(byId('tx-cal-diary-link')).toBeNull();

    const addBtn = byId('tx-cal-add-btn')!;
    expect(addBtn.textContent).toContain(`Add transaction on ${formatWeekdayDate(TODAY)}`);
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);

    const row = makeTx({ id: 'tx-1', type: 'EXPENSE', amount: 180, description: 'Noodles' });
    rerender(
      <TxDayPanel
        day={TODAY}
        today={TODAY}
        totals={{ income: 500, spending: 180, net: 320 }}
        rows={[row]}
        categories={CATEGORIES}
        wallets={WALLETS}
        selectedTxId="tx-1"
        onSelect={onSelect}
        onAdd={onAdd}
        hasDiaryEntry={true}
        onOpenDiary={onOpenDiary}
      />,
    );

    expect(byId('tx-cal-panel-in')!.textContent).toContain(`+${formatCurrencyAmount(500)}`);
    expect(byId('tx-cal-panel-out')!.textContent).toContain(formatCurrencyAmount(-180));
    expect(byId('tx-cal-panel-net')!.textContent).toContain(`+${formatCurrencyAmount(320)}`);
    expect(byId('tx-cal-panel-empty')).toBeNull();

    const txRowBtn = byId('tx-row-tx-1')!;
    expect(txRowBtn.getAttribute('aria-current')).toBe('true');
    fireEvent.click(txRowBtn);
    expect(onSelect).toHaveBeenCalledWith(row);

    const diaryLink = byId('tx-cal-diary-link')!;
    expect(diaryLink.textContent).toContain('Open this day in Daily diary');
    fireEvent.click(diaryLink);
    expect(onOpenDiary).toHaveBeenCalledTimes(1);
  });
});
