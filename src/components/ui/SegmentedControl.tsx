import { useLayoutEffect, useRef } from 'react';
import { slidePill } from './motion';

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

// Both sizes keep a 44px hit box (DESIGN.md §4) in both directions, so a short
// label ("All") is not narrower than the floor; `sm` differs only in padding.
const SIZE_CLASS: Record<SegmentedControlSize, string> = {
  sm: 'min-h-[44px] min-w-[44px] px-3.5 py-1.5 text-xs',
  md: 'min-h-[44px] min-w-[44px] py-2 px-2 sm:px-3 text-xs',
};

/**
 * T48: pill-in-tray switcher shared by the dashboard period filter, the
 * transaction-type toggle, and the auth mode tabs - same tray/pill markup at
 * each, only option count, label text, and container layout differing. The
 * active pill is a sibling behind the label rather than an instant
 * background-class swap, so switching options slides the pill across (a
 * 200 ms tween since Phase 53b, not a spring). Since Phase 106 (ADR 0082) the
 * slide is `slidePill`, from the button selected before, within this control
 * only; framer-motion's `layoutId` did it until then.
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
  const isTabs = mode === 'tabs';
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const previous = useRef(value);

  useLayoutEffect(() => {
    if (previous.current === value) return;
    const button = buttons.current.get(value);
    slidePill(button?.querySelector<HTMLElement>('[data-pill]'), buttons.current.get(previous.current));
    previous.current = value;
  }, [value]);

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
            ref={(el) => {
              if (el) buttons.current.set(option.value, el);
              else buttons.current.delete(option.value);
            }}
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
              <span data-pill className="absolute inset-0 z-0 bg-control-active rounded-button" />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
