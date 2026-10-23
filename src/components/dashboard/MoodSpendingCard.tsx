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
 * Owner spec 4.4, decision A. The strip lays out the diary days `moodSpendingDays`
 * returns for the page's period, at most five, oldest on the left. There are no
 * placeholder days, so no selector change.
 */
export const MoodSpendingCard: React.FC<MoodSpendingCardProps> = ({ mood, today, todayLogged, onOpenDiary }) => {
  const hint = prompt(mood.loggedCount);
  return (
    <section aria-labelledby="dashboard-mood-title" className="min-w-0">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div>
            <h2 id="dashboard-mood-title" className="text-base font-semibold text-fg">
              Mood and spending
            </h2>
            <p className="text-sm text-fg-muted mt-0.5">From your daily diary</p>
          </div>
          <Button id="dashboard-log-mood-btn" variant="soft" onClick={onOpenDiary}>
            {todayLogged ? "Edit today's entry" : `Log today (${formatWeekdayDate(today)})`}
          </Button>
        </div>

        {mood.days.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {[...mood.days].reverse().map((day) => (
              <li
                key={day.date}
                className="flex-1 basis-24 min-w-0 flex flex-col items-center gap-1.5 rounded-inner bg-mood-tile px-2 py-2.5 text-center"
              >
                <span className="text-xs text-fg-muted">{formatWeekdayDate(day.date)}</span>
                <MoodMeter mood={day.mood} />
                <Money
                  value={-day.spending}
                  className={`text-xs font-semibold ${day.spending > 0 ? 'text-expense' : 'text-fg-muted'}`}
                />
              </li>
            ))}
          </ul>
        )}

        {hint && <Inset className="px-3.5 py-3 text-sm text-fg-secondary leading-relaxed">{hint}</Inset>}
      </Card>
    </section>
  );
};
