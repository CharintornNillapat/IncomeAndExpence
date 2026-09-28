import React, { useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './ui/IconButton';

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

  // Escape-to-close was missing from every hand-rolled modal (none of them
  // wired a keydown listener); wiring it once here is a genuine gap fix.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (closeOnBackdropClick && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={resolvedTitleId}
            aria-label={!resolvedTitleId ? ariaLabel : undefined}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`bg-surface-1 rounded-t-xl sm:rounded-lg w-full ${maxWidthClassName} max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-modal border border-line overflow-hidden ${panelClassName}`}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
