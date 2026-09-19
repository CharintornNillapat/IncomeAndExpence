import React from 'react';

export type BadgeTone = 'neutral' | 'amber';
export type BadgeSize = 'sm' | 'md';
export type ChipRounding = 'sm' | 'md' | 'full';

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
}

const BADGE_SIZE_CLASS: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-2 py-0.5 text-[11px] gap-1',
};

/**
 * T45: only the tones actually duplicated across the app today. `neutral`
 * matches the plain "Today"/"Yesterday" day-badge (`DiaryView.tsx`,
 * `DiaryEntryCard.tsx` - identical markup at both sites); `amber` matches
 * the debt-repayment badge (`TransactionTableRow.tsx`, both sizes). Each
 * tone owns its own font-weight rather than a shared base class, since the
 * two existing badges genuinely differ there (`font-bold` vs `font-medium`).
 */
const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold rounded',
  amber:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 font-medium rounded',
};

/**
 * T45: small pill/tag primitive. Two sizes (matching the app's compact-mobile
 * vs table-cell chip scale) and two tones (see `BADGE_TONE_CLASS`). Also
 * fixes the invalid `py-0.2` class present at the sites this replaces -
 * `py-0.2` is not a real Tailwind padding step, so it silently resolved to
 * no vertical padding at all.
 */
export const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral', size = 'sm', icon, className = '' }) => {
  const classes = ['inline-flex items-center', BADGE_SIZE_CLASS[size], BADGE_TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {icon}
      {children}
    </span>
  );
};

export type CategoryChipSize = 'sm' | 'md';

interface CategoryChipProps {
  name: string;
  color: string;
  size?: CategoryChipSize;
  rounded?: ChipRounding;
  /** A small color dot before the name - only the mobile/compact chip variants used one. */
  showDot?: boolean;
  className?: string;
}

const CHIP_SIZE_CLASS: Record<CategoryChipSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-2 py-0.5 text-[11px] gap-1.5',
};

const CHIP_DOT_SIZE_CLASS: Record<CategoryChipSize, string> = {
  sm: 'w-1 h-1',
  md: 'w-1.5 h-1.5',
};

const CHIP_ROUNDED_CLASS: Record<ChipRounding, string> = {
  sm: 'rounded',
  md: 'rounded-md',
  full: 'rounded-full',
};

/**
 * T45: single canonical tint for a category's own color, replacing the
 * `${color}15` / `${color}20` / `${color}25` alpha drift found across
 * `KeywordRulesView.tsx`, `TransactionTableRow.tsx`, and
 * `RecentTransactionsTable.tsx` (ui-ux-audit-report.md finding). 20% was
 * chosen as the middle value already in use, minimizing the visual delta at
 * the two sites that move (15%->20%, 25%->20%) versus picking either extreme.
 */
export function categoryTint(color: string): React.CSSProperties {
  return { backgroundColor: `${color}20`, color };
}

/**
 * T45: the category-name chip repeated (with drifting rounding, sizing, and
 * tint alpha) across `TransactionTableRow`, `RecentTransactionsTable`, and
 * `KeywordRulesView`. `rounded` defaults to `'md'` but each of the three
 * existing shapes (`rounded`, `rounded-md`, `rounded-full`) is preserved
 * exactly at its call site via this prop - collapsing them to one value
 * would be a real rounding change, not just a duplication fix.
 */
export const CategoryChip: React.FC<CategoryChipProps> = ({
  name,
  color,
  size = 'md',
  rounded = 'md',
  showDot = false,
  className = '',
}) => {
  const classes = [
    'inline-flex items-center font-medium truncate',
    CHIP_SIZE_CLASS[size],
    CHIP_ROUNDED_CLASS[rounded],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} style={categoryTint(color)}>
      {showDot && <span className={`${CHIP_DOT_SIZE_CLASS[size]} rounded-full shrink-0`} style={{ backgroundColor: color }} />}
      <span className="truncate">{name}</span>
    </span>
  );
};
