import { useId } from 'react';
import { motion } from 'framer-motion';

export type SegmentedControlSize = 'sm' | 'md';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  /** Preserves a call site's existing element id (e.g. `#time-filter-week`) for tests that select by it. */
  id?: string;
}

interface SegmentedControlProps<T extends string> {
  options: Array<SegmentedControlOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedControlSize;
  /** Equal-width buttons (e.g. two-tab auth switcher) instead of content-sized pills. */
  fill?: boolean;
  /** Tray-level layout classes (display/alignment/width) - callers keep their own flex/grid shape here. */
  className?: string;
  /**
   * `pressed` (default): a group of toggle buttons, the selected one `aria-pressed`.
   * `tabs`: a tablist that switches what is shown below it, the selected tab `aria-selected` (spec 6.6).
   */
  mode?: SegmentedControlMode;
  /** Names the group or tablist for assistive technology. */
  ariaLabel?: string;
}

export type SegmentedControlMode = 'pressed' | 'tabs';

// Both sizes keep a 44px hit box (DESIGN.md §4); `sm` differs only in padding.
const SIZE_CLASS: Record<SegmentedControlSize, string> = {
  sm: 'min-h-[44px] px-3.5 py-1.5 text-xs',
  md: 'min-h-[44px] py-2 px-2 sm:px-3 text-xs',
};

/**
 * T48: pill-in-tray switcher shared by the dashboard period filter, the
 * transaction-type toggle, and the auth mode tabs - same tray/pill markup at
 * each, only option count, label text, and container layout differing. The
 * active pill is a `layoutId`-animated sibling behind the label rather than
 * an instant background-class swap, so switching options slides the pill
 * across (a 200 ms tween since Phase 53b, not a spring). `layoutId` is namespaced with `useId()` so multiple controls
 * mounted at once (e.g. the dashboard period filter and the quick-add
 * transaction-type toggle it renders alongside) never share a layout
 * animation.
 *
 * Phase 56 (spec 4.6, ADR 0029): a bordered card-coloured tray, the selected
 * option on `control-active` in bold, and the selection exposed in ARIA -
 * `aria-pressed` for a toggle group, `role="tab"` + `aria-selected` for tabs.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fill = false,
  className = '',
  mode = 'pressed',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const instanceId = useId();
  const isTabs = mode === 'tabs';

  return (
    <div
      role={isTabs ? 'tablist' : 'group'}
      aria-label={ariaLabel}
      className={`bg-surface-1 p-1 rounded-control gap-1 border border-line ${className}`.trim()}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            id={option.id}
            type="button"
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? isActive : undefined}
            aria-pressed={isTabs ? undefined : isActive}
            onClick={() => onChange(option.value)}
            className={`relative text-center rounded-button transition-control duration-150 cursor-pointer truncate ${
              fill ? 'flex-1' : ''
            } ${SIZE_CLASS[size]} ${
              isActive
                ? 'text-fg font-bold'
                : 'text-fg-secondary font-semibold hover:text-fg'
            }`.trim()}
          >
            {isActive && (
              <motion.span
                layoutId={`${instanceId}-pill`}
                className="absolute inset-0 z-0 bg-control-active rounded-button"
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
