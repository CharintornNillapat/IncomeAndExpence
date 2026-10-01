import React from 'react';
import { Card, Inset } from '../ui/Card';
import { Button } from '../ui/Button';
import { Money } from '../ui/Money';
import { MOOD_DAYS_SHOWN, MoodSpending } from '../../selectors/diary';
import { formatWeekdayDate } from '../../utils/date';
import { MoodMeter } from '../diary/MoodMeter';

interface MoodSpendingCardProps {
  mood: MoodSpending;
  today: string;
  /** Today already has a diary entry, so the button edits it instead of starting one. */
  todayLogged: boolean;
  onOpenDiary: () => void;
}

function prompt(loggedCount: number): string | null {
  if (loggedCount >= MOOD_DAYS_SHOWN) return null;
  if (loggedCount === 0) return 'No diary days logged in this period. Log a day to see your mood beside your spending.';
  return `Only ${loggedCount} ${loggedCount === 1 ? 'day' : 'days'} logged in this period. Log more days to see a pattern.`;
}

/**
 * Spec 6.1 item 6: the diary's mood beside that day's spending, for the days
 * logged in the page's period. Spending is signed as well as red, so the
 * colour never carries the meaning alone (spec section 7).
 */
export const MoodSpendingCard: React.FC<MoodSpendingCardProps> = ({ mood, today, todayLogged, onOpenDiary }) => {
  const hint = prompt(mood.loggedCount);
  return (
    <Card className="h-full flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-fg">Mood &amp; spending</h2>
        <p className="text-sm text-fg-muted mt-0.5">From your Daily Diary</p>
      </div>

      {mood.days.length > 0 && (
        <ul className="flex flex-col gap-3">
          {mood.days.map((day) => (
            <li key={day.date} className="flex items-center justify-between gap-3">
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium text-fg">{formatWeekdayDate(day.date)}</span>
                <MoodMeter mood={day.mood} />
              </span>
              <Money
                value={-day.spending}
                className={`text-sm font-semibold ${day.spending > 0 ? 'text-expense' : 'text-fg-muted'}`}
              />
            </li>
          ))}
        </ul>
      )}

      {hint && <Inset className="px-3.5 py-3 text-sm text-fg-secondary leading-relaxed">{hint}</Inset>}

      <Button id="dashboard-log-mood-btn" block onClick={onOpenDiary} className="mt-auto">
        {todayLogged ? "Edit today's entry" : `Log today (${formatWeekdayDate(today)})`}
      </Button>
    </Card>
  );
};
