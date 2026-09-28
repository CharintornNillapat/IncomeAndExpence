import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal';
import { ERROR_BANNER_CLASS } from '../../utils/formStyles';
import { Button } from './Button';

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
 * Its two buttons are the shared `Button` (Phase 56): secondary to cancel,
 * danger (or primary, for a non-destructive confirm) to proceed.
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
          <Button id="cancel-confirm-btn" variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            id="confirm-destructive-btn"
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Working…' : confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        {isDestructive && (
          <div className="w-9 h-9 rounded-lg bg-expense-tint text-expense flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        )}
        <div className="flex-1 pt-1.5 space-y-2">
          <p className="text-xs text-fg-secondary leading-relaxed">{description}</p>
          {error && <div className={ERROR_BANNER_CLASS}>{error}</div>}
        </div>
      </div>
    </Modal>
  );
};
