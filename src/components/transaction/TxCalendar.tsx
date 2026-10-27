import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/IconButton';
import { Money } from '../ui/Money';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatMonthYear, formatWeekdayDate, monthGrid, shiftMonth } from '../../utils/date';
import { HEAT_LEVELS, type DayTotals } from '../../selectors/ledger';

export interface TxCalendarDay extends DayTotals {
  heat: number;
}

/**
 * Cell background classes keyed by heat level (`1` to `HEAT_LEVELS`,
 * `docs/design/transactions-2026-10/spec.md` section 2 O3, ADR 0109 D5).
 */
export const HEAT_CLASS: Record<number, string> = {
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
};

/**
 * Legend labels keyed by heat level (`1` to `HEAT_LEVELS`,
 * `docs/design/transactions-2026-10/spec.md` section 2 O3, ADR 0109 D5).
 */
export const HEAT_LEGEND: Record<number, string> = {
  1: 'Up to a third of the top day',
  2: 'Up to two thirds',
  3: 'Over two thirds',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface TxCalendarProps {
  monthKey: string;
  onChangeMonth: (monthKey: string) => void;
  canGoNext: boolean;
  today: string;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  days: ReadonlyMap<string, TxCalendarDay>;
  month: { income: number; spending: number; net: number };
}

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${formatCurrencyAmount(n)}`;
}

function cellLabel(iso: string, day: TxCalendarDay | undefined, isToday: boolean): string {
  const base = day
    ? `${formatWeekdayDate(iso)}, spent ${formatCurrencyAmount(day.spending)}, net ${signed(day.net)}, ${day.count} ${day.count === 1 ? 'transaction' : 'transactions'}`
    : `${formatWeekdayDate(iso)}, no transactions`;
  return isToday ? `${base}, today` : base;
}

function dayClass(isSelected: boolean, day: TxCalendarDay | undefined, isToday: boolean, isDisabled: boolean): string {
  const base =
    'w-full min-h-[44px] sm:min-h-[56px] rounded-inner tabular-nums flex flex-col items-center justify-center gap-0.5 transition-control duration-150';
  if (isDisabled) return `${base} text-fg-disabled cursor-not-allowed`;
  const heatFill = day && day.heat > 0 ? HEAT_CLASS[day.heat] : undefined;
  const fill = isSelected
    ? 'bg-brand-fill text-white font-semibold'
    : heatFill
      ? `${heatFill} text-fg font-semibold`
      : day
        ? 'font-semibold text-fg hover:bg-surface-3'
        : 'text-fg-secondary hover:bg-surface-3 hover:text-fg';
  const ring = isToday ? (isSelected ? 'ring-2 ring-inset ring-white' : 'ring-2 ring-inset ring-focus') : '';
  return `${base} ${fill} cursor-pointer ${ring}`.trim();
}

export const TxCalendar: React.FC<TxCalendarProps> = ({
  monthKey,
  onChangeMonth,
  canGoNext,
  today,
  selectedDay,
  onSelectDay,
  days,
  month,
}) => {
  const weeks = monthGrid(monthKey);

  return (
    <Card padding="none" className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="tx-cal-heading" className="text-base font-semibold text-fg">
          {formatMonthYear(monthKey)}
        </h2>
        <div className="flex items-center -mr-2">
          <IconButton
            id="tx-cal-prev-month-btn"
            label="Previous month"
            onClick={() => onChangeMonth(shiftMonth(monthKey, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </IconButton>
          <IconButton
            id="tx-cal-next-month-btn"
            label="Next month"
            disabled={!canGoNext}
            onClick={() => onChangeMonth(shiftMonth(monthKey, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span id="tx-cal-month-in" className="text-fg-secondary">
          In <Money value={month.income} showPlus className="font-semibold text-income" />
        </span>
        <span id="tx-cal-month-out" className="text-fg-secondary">
          Out <Money value={-month.spending} className="font-semibold text-expense" />
        </span>
        <span id="tx-cal-month-net" className="text-fg-secondary">
          Net{' '}
          <Money
            value={month.net}
            showPlus
            className={`font-semibold ${month.net < 0 ? 'text-expense' : 'text-fg'}`}
          />
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div aria-hidden="true" className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((day) => (
            <span key={day} className="text-[11px] font-semibold text-fg-muted text-center py-1">
              {day}
            </span>
          ))}
        </div>
        {weeks.map((week, index) => (
          <div key={index} className="grid grid-cols-7 gap-0.5">
            {week.map((iso, cell) => {
              if (!iso) return <span key={cell} />;
              const day = days.get(iso);
              const isToday = iso === today;
              const isSelected = iso === selectedDay;
              const isDisabled = iso > today && !days.has(iso);
              return (
                <button
                  key={iso}
                  id={`tx-cal-day-${iso}`}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  aria-label={cellLabel(iso, day, isToday)}
                  onClick={() => onSelectDay(iso)}
                  className={dayClass(isSelected, day, isToday, isDisabled)}
                >
                  <span className="text-xs">{Number(iso.slice(8))}</span>
                  {day && (
                    // ponytail: an amount too wide for a cell is clipped by truncate; the full figure is in the label and the panel.
                    <span
                      className={`hidden sm:block max-w-full truncate text-[11px] leading-none px-0.5 ${
                        isSelected ? 'text-white' : day.net < 0 ? 'text-expense' : 'text-fg'
                      }`}
                    >
                      <Money value={day.net} showPlus />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-fg-secondary">
        <ul id="tx-cal-legend" className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
          {Array.from({ length: HEAT_LEVELS }, (_, i) => i + 1).map((level) => (
            <li key={level} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`w-3 h-3 rounded-sm ${HEAT_CLASS[level]}`} />
              {HEAT_LEGEND[level]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-3 rounded-sm ring-2 ring-inset ring-focus" />
            Today
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-3 rounded-sm bg-brand-fill" />
            Selected day
          </li>
        </ul>
        <p className="text-fg-muted">Shading is spending against the month&apos;s highest day.</p>
      </div>
    </Card>
  );
};
