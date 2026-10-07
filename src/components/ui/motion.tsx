import { cloneElement, useEffect, useState, type ReactElement } from 'react';

/**
 * Phase 106 (ADR 0082): the app's motion without framer-motion. The tweens
 * are CSS keyframes in `index.css` (`motion-*`); this file holds the two
 * things CSS cannot do alone - keeping a leaving element mounted for its exit,
 * and sliding a selection pill from one button to the next. Both skip motion
 * entirely when the person asks for less (`prefers-reduced-motion`).
 */

/** DESIGN.md MOTION 1: every tween is 200 ms, ease-out. */
export const MOTION_MS = 200;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface PresenceProps {
  /** One keyed element, or nothing. A new key waits for the old one's exit (framer's `mode="wait"`). */
  children?: ReactElement | false | null;
  exitMs?: number;
}

/**
 * Keeps its child mounted for `exitMs` after it goes, marked `data-leaving`
 * so its `motion-*` class plays the exit, then shows what came next. The same
 * key coming back mid-exit is kept, not remounted. The leaving element is its
 * latest render, so a dialog's content does not revert while it closes.
 */
export function Presence({ children, exitMs = MOTION_MS }: PresenceProps) {
  const next = children || null;
  const [shown, setShown] = useState(next);
  const [leaving, setLeaving] = useState(false);

  // Decided during render, as ADR 0057's resets are: a passive effect would
  // paint one frame of the wrong child first.
  if (next && shown && next.key === shown.key) {
    if (shown !== next) setShown(next);
    if (leaving) setLeaving(false);
  } else if (!shown) {
    if (next) setShown(next);
  } else if (prefersReducedMotion()) {
    setShown(next);
    setLeaving(false);
  } else if (!leaving) {
    setLeaving(true);
  }

  useEffect(() => {
    if (!leaving) return;
    // A timer, not `animationend`: a WebKit window that paints no frame
    // (ADR 0058) must still close its dialog.
    const timer = setTimeout(() => {
      setLeaving(false);
      setShown(null);
    }, exitMs);
    return () => clearTimeout(timer);
  }, [leaving, exitMs]);

  return shown ? cloneElement(shown as ReactElement<{ 'data-leaving'?: boolean }>, { 'data-leaving': leaving || undefined }) : null;
}

/**
 * framer-motion's `layoutId` for a selection pill: slides `pill`, now inside
 * the selected button, from the same place inside `from`, the button selected
 * before. Width and height are animated rather than scaled, so the pill's
 * corners stay round. Does nothing without the Web Animations API (jsdom).
 */
export function slidePill(pill: HTMLElement | null | undefined, from: HTMLElement | null | undefined): void {
  const button = pill?.parentElement;
  if (!pill || !from || !button || typeof pill.animate !== 'function' || prefersReducedMotion()) return;
  const to = pill.getBoundingClientRect();
  const inside = button.getBoundingClientRect();
  const before = from.getBoundingClientRect();
  const left = before.left + (to.left - inside.left);
  const top = before.top + (to.top - inside.top);
  pill.animate(
    [
      {
        transform: `translate(${left - to.left}px, ${top - to.top}px)`,
        width: `${before.width - (inside.width - to.width)}px`,
        height: `${before.height - (inside.height - to.height)}px`,
      },
      { transform: 'none', width: `${to.width}px`, height: `${to.height}px` },
    ],
    { duration: MOTION_MS, easing: 'ease-out' },
  );
}
