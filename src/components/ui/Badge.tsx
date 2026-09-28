import React from 'react';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
}

const BADGE_SIZE_CLASS: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-2 py-0.5 text-[11px] gap-1',
};

/**
 * T45: small tag for the plain "Today"/"Yesterday" day label (`DiaryView.tsx`,
 * `DiaryEntryCard.tsx` - identical markup at both sites). Also fixed the
 * invalid `py-0.2` class present at the sites it replaced - `py-0.2` is not a
 * real Tailwind padding step, so it silently resolved to no vertical padding.
 *
 * Phase 56 (ADR 0029): the `amber` tone is gone. Its only use was the debt
 * repayment badge, which is now a grey system `Chip` (audit 003 finding 3:
 * amber is for problems, and a repayment is not one). Category chips moved
 * to `ui/Chip`.
 */
export const Badge: React.FC<BadgeProps> = ({ children, size = 'sm', icon, className = '' }) => {
  const classes = ['inline-flex items-center bg-surface-3 text-fg font-bold rounded-sm', BADGE_SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {icon}
      {children}
    </span>
  );
};
