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
          name: 'wallet-new-name',
          type: 'wallet-new-type',
          currency: 'wallet-new-currency',
          balance: 'wallet-new-init-balance',
          submit: 'wallet-new-save-btn',
        }}
        onCreated={onClose}
      />
    </Modal>
  );
};
