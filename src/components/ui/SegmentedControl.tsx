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
}

const SIZE_CLASS: Record<SegmentedControlSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'py-2 px-2 sm:px-3 text-xs',
};

/**
 * T48: pill-in-tray switcher shared by the dashboard period filter, the
 * transaction-type toggle, and the auth mode tabs - same tray/pill markup at
 * each, only option count, label text, and container layout differing. The
 * active pill is a `layoutId`-animated sibling behind the label rather than
 * an instant background-class swap, so switching options springs the pill
 * across. `layoutId` is namespaced with `useId()` so multiple controls
 * mounted at once (e.g. the dashboard period filter and the quick-add
 * transaction-type toggle it renders alongside) never share a layout
 * animation.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fill = false,
  className = '',
}: SegmentedControlProps<T>) {
  const instanceId = useId();

  return (
    <div
      className={`bg-stone-100 dark:bg-stone-800 p-1 rounded-xl gap-1 border border-stone-200 dark:border-stone-700 ${className}`.trim()}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <motion.button
            key={option.value}
            id={option.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(option.value)}
            className={`relative text-center font-semibold rounded-lg transition-colors cursor-pointer truncate ${
              fill ? 'flex-1' : ''
            } ${SIZE_CLASS[size]} ${
              isActive
                ? 'text-stone-900 dark:text-white'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`.trim()}
          >
            {isActive && (
              <motion.span
                layoutId={`${instanceId}-pill`}
                className="absolute inset-0 z-0 bg-white dark:bg-stone-700 rounded-lg shadow-xs"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
