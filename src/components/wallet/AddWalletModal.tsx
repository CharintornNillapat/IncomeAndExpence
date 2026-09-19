import React from 'react';
import { AddWalletForm } from './AddWalletForm';
import { Modal } from '../Modal';

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * T41: the single canonical add-wallet modal, mounted once at shell level so
 * the same modal (and the same ids) is reachable from `DashboardView`'s hero
 * button and `WalletsView`'s own header button alike.
 */
export const AddWalletModal: React.FC<AddWalletModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Wallet"
      bodyClassName="space-y-4 sm:space-y-5"
    >
      <AddWalletForm
        tone="subtle"
        ids={{
          name: 'new-wallet-name',
          type: 'new-wallet-type',
          currency: 'new-wallet-currency',
          balance: 'new-wallet-init-balance',
          submit: 'save-new-wallet-btn',
        }}
        onCreated={onClose}
      />
    </Modal>
  );
};
