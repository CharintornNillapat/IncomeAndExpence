import React from 'react';
import { Money } from '../ui/Money';
import { formatDayLabel } from '../../utils/date';

interface DayGroupHeaderProps {
  /** The group's local calendar day, `YYYY-MM-DD` (a `DayGroup.date` from `groupByDay`). */
  date: string;
  /** Today's local date, passed in so every header in a list reads the same "today". */
  today: string;
  /** The day's L11 net (`DayGroup.net`): income minus spending, no transfer, repayment or adjustment. */
  net: number;
  className?: string;
}

/**
 * Spec 4.10 (ADR 0029): the heading above a day of transactions - "Yesterday
 * · Sun, Sep 27" on the left, that day's net on the right, on the inset
 * surface.
 *
 * The net follows spec section 3's rule for a net figure: the primary text
 * colour when it is zero or more, the expense colour when it is negative,
 * and never income green. It is always signed.
 */
export const DayGroupHeader: React.FC<DayGroupHeaderProps> = ({ date, today, net, className = '' }) => (
  <div className={`flex items-center justify-between gap-3 px-4 py-2 bg-surface-2 text-xs ${className}`.trim()}>
    <span className="font-semibold text-fg-secondary">{formatDayLabel(date, today)}</span>
    <Money value={net} showPlus className={`font-semibold ${net < 0 ? 'text-expense' : 'text-fg'}`} />
  </div>
);
