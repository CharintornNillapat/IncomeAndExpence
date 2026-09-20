import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal';
import { ERROR_BANNER_CLASS } from '../../utils/formStyles';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Red destructive styling + warning icon vs. the neutral stone treatment. Defaults to true - this primitive exists for irreversible deletes. */
  isDestructive?: boolean;
  /** Disables both buttons and swaps the confirm label to a busy state while an async `onConfirm` is in flight. */
  isLoading?: boolean;
  /** Shown as an `ERROR_BANNER_CLASS` banner below the description when a confirmed action's write failed - the dialog stays open (caller's responsibility) so the user sees why, instead of it silently closing on a rejected write. */
  error?: string | null;
}

/**
 * T42: shared confirmation dialog over `Modal.tsx`, for irreversible actions
 * only (wallet delete, debt delete) - never for transaction soft-delete,
 * which is reversible via restore and where a confirm would be pure friction.
 * The two side-by-side compact buttons are their own shape (not the
 * full-width single-column `PRIMARY_BUTTON_CLASS`/`SECONDARY_BUTTON_CLASS`
 * forms use), so they stay local classes rather than forcing a mismatched
 * shared one - the same call `WalletPopupModal`'s inline Save/Cancel balance
 * editor buttons already made.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
  isDestructive = true,
  isLoading = false,
  error = null,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidthClassName="max-w-sm"
      showMobileHandle={false}
      closeOnBackdropClick={!isLoading}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            id="cancel-confirm-btn"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            id="confirm-destructive-btn"
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900'
            }`}
          >
            {isLoading ? 'Working…' : confirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        {isDestructive && (
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        )}
        <div className="flex-1 pt-1.5 space-y-2">
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{description}</p>
          {error && <div className={ERROR_BANNER_CLASS}>{error}</div>}
        </div>
      </div>
    </Modal>
  );
};
