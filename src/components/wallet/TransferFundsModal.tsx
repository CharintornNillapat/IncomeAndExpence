import React from 'react';
import { useWallets } from '../../hooks/useWallets';
import { useTransientFlash } from '../../hooks/useTransientFlash';
import { WalletTransferForm } from './WalletTransferForm';
import { Modal } from '../Modal';

interface TransferFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Preselects the source wallet (e.g. a wallet card's own "Transfer" shortcut). */
  initialSourceWalletId?: string;
}

/**
 * T41: the single canonical transfer modal, self-subscribing like
 * `QuickAddModal` so it can be mounted once at shell level (`App.tsx`) and
 * reached identically from `DashboardView` (hero button, wallet cards) and
 * `WalletsView`'s own header button - one modal, one id set, regardless of
 * which view triggered it. `Modal` unmounts its children while closed, so
 * `WalletTransferForm` remounts with fresh state on every open; no `key`
 * trick is needed to pick up a new `initialSourceWalletId`.
 */
export const TransferFundsModal: React.FC<TransferFundsModalProps> = ({
  isOpen,
  onClose,
  initialSourceWalletId,
}) => {
  const { wallets } = useWallets();
  // Preserves the retired WalletPopupModal TRANSFER tab's success flash
  // verbatim - `tests/wallet-forms.spec.ts` asserts on this exact text.
  const { value: transferStatus, flash: flashTransferStatus } = useTransientFlash<string | null>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Funds"
      bodyClassName="space-y-4 sm:space-y-5"
    >
      <WalletTransferForm
        wallets={wallets}
        tone="subtle"
        errorPlacement="top"
        statusMessage={transferStatus}
        initialSourceWalletId={initialSourceWalletId}
        ids={{
          source: 'transfer-source-wallet',
          dest: 'transfer-dest-wallet',
          amount: 'transfer-amount-math',
          note: 'transfer-note',
          submit: 'execute-transfer-btn',
        }}
        onTransferred={() => {
          flashTransferStatus('Transfer completed successfully!', 1000, onClose);
        }}
      />
    </Modal>
  );
};
