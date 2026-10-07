import React, { useId, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { Presence } from './ui/motion';
import { closeDialogEntry, dialogEntryOf, isLiveDialogEntry, isOwnTraversal, openDialogEntry } from '../utils/modalHistory';

// Phase 67 (ADR 0043, spec section 10 item 12): what a keyboard can reach
// inside a dialog. Read at keydown time, so a field that appears later counts.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

// Hidden by markup or style, not by size: jsdom has no layout, and a check on
// layout alone would let the unit suite pass on a rule the browser applies
// differently. `display` does not inherit, so every ancestor up to the panel
// is read; `visibility` does, so the element's own value is enough.
function isReachable(el: HTMLElement, panel: HTMLElement): boolean {
  const tabindex = el.getAttribute('tabindex');
  if (tabindex !== null && Number(tabindex) < 0) return false;
  if (el.matches(':disabled') || el.closest('[inert]')) return false;
  const own = getComputedStyle(el);
  if (own.visibility === 'hidden' || own.visibility === 'collapse') return false;
  for (let node: HTMLElement | null = el; node && node !== panel.parentElement; node = node.parentElement) {
    if (node.hidden || getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

// A dialog rendered inside this one (AccountModal's confirmations) owns its
// own controls, including while it plays its exit tween after closing.
function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.closest('[role="dialog"]') === panel && isReachable(el, panel),
  );
}

// Open dialogs, oldest first. A ConfirmDialog opens over the Wallets and
// Categories sheets (as a sibling) and inside AccountModal (as a child); only
// the last one opened answers Tab and Escape, so a confirmation never closes
// or traps the sheet under it.
const openDialogs: object[] = [];

// Phase 71 (ADR 0047): while a dialog is open, everything outside it is inert,
// so a screen reader's virtual cursor stays inside (aria-modal alone does not
// hold it). Modal is not portalled (ADR 0042), so the dialog sits inside
// #root and #root itself cannot be marked: inert applies to the whole subtree.
// Instead every element beside the path from the top dialog's overlay up to
// <body> is marked. Only elements marked here are unmarked, and the marks are
// recomputed whenever the stack changes, so a confirmation over a sheet makes
// the sheet inert too and gives it back when it closes.
const overlayOf = new Map<object, HTMLElement>();
const markedInert = new Set<Element>();
const NOT_CONTENT = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT']);
let backgroundWatcher: MutationObserver | null = null;

function topOverlay(): HTMLElement | undefined {
  const top = openDialogs[openDialogs.length - 1];
  return top ? overlayOf.get(top) : undefined;
}

function syncBackgroundInert() {
  for (const el of markedInert) el.removeAttribute('inert');
  markedInert.clear();
  const overlay = topOverlay();
  if (overlay?.isConnected) {
    for (let node: Element = overlay; node !== document.body && node.parentElement; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling === node || NOT_CONTENT.has(sibling.tagName) || sibling.hasAttribute('inert')) continue;
        sibling.setAttribute('inert', '');
        markedInert.add(sibling);
      }
    }
  }
  // Something mounted beside the path while a dialog is open (the update
  // toast, another dialog's exit) is marked too. Only childList changes
  // outside the top dialog resync; typing inside it never does.
  if (openDialogs.length > 0 && !backgroundWatcher) {
    backgroundWatcher = new MutationObserver((records) => {
      const current = topOverlay();
      if (current && records.some((r) => r.addedNodes.length > 0 && r.target !== current && r.target.contains(current))) {
        syncBackgroundInert();
      }
    });
    backgroundWatcher.observe(document.body, { childList: true, subtree: true });
  } else if (openDialogs.length === 0 && backgroundWatcher) {
    backgroundWatcher.disconnect();
    backgroundWatcher = null;
  }
}

// Leaving the stack and giving the background back come before focus returns
// to the opener: the opener is in the background, and focus() on an inert
// element does nothing.
function releaseDialog(token: object) {
  const index = openDialogs.lastIndexOf(token);
  if (index !== -1) openDialogs.splice(index, 1);
  overlayOf.delete(token);
  syncBackgroundInert();
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Renders the standard title/subtitle/close-button header row. Ignored if `header` is given. */
  title?: string;
  subtitle?: string;
  /** Replaces the standard header entirely for callers with custom chrome (icon badges, tabs) - must include its own close affordance. */
  header?: React.ReactNode;
  /** Optional non-scrolling action bar rendered below the body. */
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  /** Appended to the panel's own classes for per-caller layout needs (e.g. a wider dialog). */
  panelClassName?: string;
  /** Appended to the scrollable body wrapper's classes. */
  bodyClassName?: string;
  panelId?: string;
  titleId?: string;
  closeButtonId?: string;
  showCloseButton?: boolean;
  showMobileHandle?: boolean;
  closeOnBackdropClick?: boolean;
  /** Accessible name for the dialog when no `title` is given (e.g. a custom `header`). */
  ariaLabel?: string;
}

/**
 * Shared modal shell (T22): backdrop, panel motion, mobile bottom-sheet
 * responsiveness, click-outside-to-close, Escape-to-close, and the
 * `role="dialog"`/`aria-modal` pair, extracted from 9 hand-rolled copies of
 * this same boilerplate across the app. The panel uses `flex flex-col` with
 * the header/footer as non-shrinking siblings and the body as `flex-1
 * overflow-y-auto`, so a sticky header with a scrollable body falls out of
 * flexbox rather than the calc(vh - fixed px) each hand-rolled copy used.
 *
 * Phase 53b (DESIGN.md §5): the scrim is a solid dim with no blur, the panel
 * is opaque, and it moves on a 200 ms tween with no scale or spring overshoot.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  header,
  footer,
  maxWidthClassName = 'max-w-md',
  panelClassName = '',
  bodyClassName = '',
  panelId,
  titleId,
  closeButtonId,
  showCloseButton = true,
  showMobileHandle = true,
  closeOnBackdropClick = true,
  ariaLabel,
}) => {
  const generatedTitleId = useId();
  // `titleId` also works with a custom `header` (no `title` string): the
  // caller puts that id on their own heading element inside `header` and the
  // dialog still gets a proper `aria-labelledby` link to it.
  const resolvedTitleId = titleId || (title ? `modal-title-${generatedTitleId}` : undefined);

  const panelRef = useRef<HTMLDivElement>(null);
  const stackToken = useRef({});
  const isTopDialog = () => openDialogs[openDialogs.length - 1] === stackToken.current;

  // Audit 008 finding 1: closing a dialog or sheet used to drop keyboard
  // focus to <body>, so a keyboard user started again from the top. The
  // element that had focus when it opened (the wallet row, the button) gets
  // it back when it closes, however it closes, if it is still on the page.
  // This cleanup runs before the stack effect's, so it releases the dialog
  // first (ADR 0047): the opener is still inert until then.
  //
  // Phase 82 (ADR 0058): this and the stack effect below are layout effects,
  // so the background is inert and focus is inside in the commit that puts the
  // dialog on the page, and both are given back in the commit that closes it.
  // As passive effects they ran a task later whenever the dialog opened on a
  // default-priority update (Quick Add's lazy chunk resolving), and the first
  // frame showed a dialog over a live page. They stay in this order: this one
  // must read the opener before the stack effect moves focus into the panel.
  // The app renders only in the browser, so there is no server render to warn.
  const returnFocusTo = useRef<HTMLElement | null>(null);
  // Phase 83 (ADR 0059): the control that had focus inside the panel when
  // these effects were last torn down while the dialog stayed open. React
  // does that to every newly mounted component in development (StrictMode
  // runs its effects, their cleanups, then the effects again, a task after
  // the commit), and would to a dialog inside a hidden <Activity>. The
  // cleanup below hands focus to the opener, so without this the re-run
  // moved it to the first control: a person's caret, or Playwright's fill
  // between its focus and its typing, left the field they were in.
  const focusInside = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const token = stackToken.current;
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    returnFocusTo.current = opener;
    return () => {
      const active = document.activeElement;
      focusInside.current = active instanceof HTMLElement && panelRef.current?.contains(active) ? active : null;
      releaseDialog(token);
      // Enough when the dialog unmounts. When it only closes, its controls stay
      // on the page for the exit tween, and React puts focus back on the one
      // that had it once this cleanup's commit step is done; the effect below
      // moves it to the opener after that.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // The closing commit's layout step runs after React has restored focus to
  // the closing dialog's control, so the opener gets it here, before paint.
  useLayoutEffect(() => {
    if (isOpen) return;
    // A real close: the next open starts from the first control again.
    focusInside.current = null;
    const opener = returnFocusTo.current;
    returnFocusTo.current = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }, [isOpen]);

  // Phase 67 (ADR 0043): focus goes into the dialog when it opens. Declared
  // after the return-focus effect, so that one has already recorded the opener.
  // The panel is in the DOM from the first frame of its entrance tween. A
  // field that focused itself (autoFocus, or a child's own layout effect,
  // which runs first) keeps focus; a child that focuses in a passive effect
  // runs after this and takes it, as before.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const token = stackToken.current;
    openDialogs.push(token);
    const panel = panelRef.current;
    if (panel?.parentElement) overlayOf.set(token, panel.parentElement);
    syncBackgroundInert();
    const kept = focusInside.current;
    focusInside.current = null;
    if (panel && kept?.isConnected && panel.contains(kept)) {
      kept.focus({ preventScroll: true });
    } else if (panel && !panel.contains(document.activeElement)) {
      (focusableIn(panel)[0] ?? panel).focus({ preventScroll: true });
    }
    return () => releaseDialog(token);
  }, [isOpen]);

  // Phase 67 (ADR 0043): Tab and Shift+Tab stay inside the top dialog. Capture
  // phase, so the focused element is read before any handler inside the panel
  // runs: OverflowMenu closes on Tab and unmounts the item that had focus.
  // Between the first and last control the browser moves focus itself; only
  // the two ends and a focus that has left the panel are steered here.
  // A layout effect, like the focus above (Phase 106, ADR 0082): a key pressed
  // as soon as focus is inside must find the listener, and a passive effect
  // ran a task later, which lost an Escape on WebKit about one time in ten.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented || !isTopDialog()) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusableIn(panel);
      const active = document.activeElement;
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const go = (el: HTMLElement) => {
        e.preventDefault();
        el.focus();
      };
      if (!(active instanceof HTMLElement) || active === panel || !panel.contains(active)) {
        go(e.shiftKey ? last : first);
        return;
      }
      if (items.includes(active)) {
        if (e.shiftKey && active === first) go(last);
        else if (!e.shiftKey && active === last) go(first);
        return;
      }
      // Focus sits on something Tab cannot reach (a menu item, a heading with
      // tabIndex -1): wrap only if nothing reachable lies beyond it.
      const following = items.some((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      const preceding = items.some((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
      if (!e.shiftKey && !following) go(first);
      else if (e.shiftKey && !preceding) go(last);
    };
    document.addEventListener('keydown', handleTab, true);
    return () => document.removeEventListener('keydown', handleTab, true);
  }, [isOpen]);

  // Phase 113 (ADR 0089): the dialog has a history entry of its own while it
  // is open, so Back closes it (the listener below) rather than changing the
  // tab under it. A real close takes the entry off a microtask later
  // (modalHistory). StrictMode's effect re-run opens over the entry its own
  // cleanup just closed, so it replaces that entry rather than adding one.
  const historyToken = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const token = openDialogEntry();
    historyToken.current = token;
    return () => closeDialogEntry(token);
  }, [isOpen]);

  // Back, like Escape, closes only the top dialog, through the same onClose,
  // so focus returns to the opener as it does on Escape. Landing on another
  // open dialog's entry (the one under this) is a Back; landing on a closed
  // dialog's entry is a Forward that modalHistory steps back off, and a
  // traversal the app made itself (a closed dialog's entry coming off) is
  // neither: both are ignored here.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const handlePopState = (e: PopStateEvent) => {
      if (isOwnTraversal(e) || !isTopDialog()) return;
      const landed = dialogEntryOf(e.state);
      if (landed === historyToken.current || (landed !== null && !isLiveDialogEntry(landed))) return;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);

  // Escape-to-close was missing from every hand-rolled modal (none of them
  // wired a keydown listener); wiring it once here is a genuine gap fix.
  // Only the top dialog answers, and it marks the event handled, so the sheet
  // under a confirmation stays open whichever listener the browser calls first.
  // A layout effect for the same reason as the Tab trap's.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !isTopDialog()) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Presence>
      {isOpen && (
        <div
          className="motion-scrim fixed inset-0 z-50 bg-scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (closeOnBackdropClick && e.target === e.currentTarget) onClose();
          }}
        >
          {/* tabIndex -1: the fallback focus target when a dialog holds no
              control (ADR 0043). The panel is a container, not a control, so
              the global :focus-visible outline is turned off on it alone; it
              would otherwise ring the whole dialog, and the dialog is already
              the only thing on screen above the scrim. */}
          <div
            ref={panelRef}
            tabIndex={-1}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={resolvedTitleId}
            aria-label={!resolvedTitleId ? ariaLabel : undefined}
            className={`motion-sheet bg-surface-1 rounded-t-xl sm:rounded-lg w-full ${maxWidthClassName} max-h-[92vh] sm:max-h-[90vh] pb-[env(safe-area-inset-bottom)] sm:pb-0 flex flex-col shadow-modal border border-line overflow-hidden focus-visible:outline-none ${panelClassName}`}
          >
            {showMobileHandle && (
              <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer shrink-0" onClick={onClose}>
                <div className="w-12 h-1.5 rounded-full bg-surface-3" />
              </div>
            )}

            {header}

            {!header && title && (
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-line flex items-center justify-between shrink-0">
                <div>
                  <h3 id={resolvedTitleId} className="text-base sm:text-lg font-bold text-fg">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs text-fg-secondary hidden sm:block">{subtitle}</p>
                  )}
                </div>
                {showCloseButton && (
                  <IconButton id={closeButtonId} label="Close modal" onClick={onClose} className="-mr-2">
                    <X className="w-5 h-5" />
                  </IconButton>
                )}
              </div>
            )}

            <div className={`flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="px-4 sm:px-6 py-3 border-t border-line shrink-0">
                {footer}
              </div>
            )}
          </div>
        </div>
      )}
    </Presence>
  );
};
