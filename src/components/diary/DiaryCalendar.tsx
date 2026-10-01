import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthName, formatMonthYear, formatWeekdayDate, monthGrid, monthKeyOf, shiftMonth } from '../../utils/date';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/IconButton';

interface DiaryCalendarProps {
  /** The month shown, `YYYY-MM`. */
  monthKey: string;
  onChangeMonth: (monthKey: string) => void;
  today: string;
  /** The day in the form. */
  selectedDate: string;
  /** The logged days in this month (`diaryMonth`). */
  loggedDates: Set<string>;
  onSelectDay: (date: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayClass(isSelected: boolean, isLogged: boolean, isToday: boolean, isFuture: boolean): string {
  const base = 'w-full min-h-[44px] rounded-inner text-xs tabular-nums flex items-center justify-center transition-control duration-150';
  if (isFuture) return `${base} text-fg-disabled cursor-not-allowed`;
  const fill = isSelected
    ? 'bg-brand-fill text-white font-semibold'
    : isLogged
      ? 'bg-logged text-fg font-semibold hover:bg-surface-3'
      : 'text-fg-secondary hover:bg-surface-3 hover:text-fg';
  // Today's ring sits inside the box so it never clips against a neighbour.
  return `${base} ${fill} cursor-pointer ${isToday ? 'ring-2 ring-inset ring-focus' : ''}`.trim();
}

/**
 * Spec 6.5: the month's days, Monday first. A logged day sits on `logged`,
 * today has the focus-coloured ring, and a future day is disabled. A click
 * loads that day into the form, whose day is drawn in the brand fill.
 */
export const DiaryCalendar: React.FC<DiaryCalendarProps> = ({ monthKey, onChangeMonth, today, selectedDate, loggedDates, onSelectDay }) => {
  const weeks = monthGrid(monthKey);
  const isCurrentMonth = monthKey >= monthKeyOf(today);
  const count = loggedDates.size;

  return (
    <Card padding="none" className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="diary-calendar-heading" className="text-base font-semibold text-fg">
          {formatMonthYear(monthKey)}
        </h2>
        <div className="flex items-center -mr-2">
          <IconButton id="diary-cal-prev-month-btn" label="Previous month" onClick={() => onChangeMonth(shiftMonth(monthKey, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </IconButton>
          <IconButton
            id="diary-cal-next-month-btn"
            label="Next month"
            disabled={isCurrentMonth}
            onClick={() => onChangeMonth(shiftMonth(monthKey, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </IconButton>
        </div>
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
              const isFuture = iso > today;
              const isLogged = loggedDates.has(iso);
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              const state = [isToday ? 'today' : '', isLogged ? 'logged' : isFuture ? 'future' : 'not logged'].filter(Boolean).join(', ');
              return (
                <button
                  key={iso}
                  id={`diary-cal-day-${iso}`}
                  type="button"
                  disabled={isFuture}
                  aria-pressed={isSelected}
                  aria-label={`${formatWeekdayDate(iso)}, ${state}`}
                  onClick={() => onSelectDay(iso)}
                  className={dayClass(isSelected, isLogged, isToday, isFuture)}
                >
                  {Number(iso.slice(8))}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-fg-secondary">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-3 rounded-sm bg-logged" />
            Logged
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-3 rounded-sm ring-2 ring-inset ring-focus" />
            Today
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-3 rounded-sm bg-brand-fill" />
            In the form
          </li>
        </ul>
        <p id="diary-calendar-count">
          {count} {count === 1 ? 'day' : 'days'} logged in {formatMonthName(monthKey)}
        </p>
      </div>
    </Card>
  );
};
