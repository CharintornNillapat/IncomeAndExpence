import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useFinanceActions } from '../../context/FinanceContext';
import { WalletType } from '../../types';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../../utils/currency';
import {
  FieldTone,
  LABEL_CLASS,
  OPTION_CLASS,
  ERROR_BANNER_CLASS,
  PRIMARY_BUTTON_CLASS,
  WALLET_COLOR_PALETTE,
  WALLET_TYPE_OPTIONS,
  inputClass,
  selectClass,
} from './walletFormStyles';

/**
 * Element ids are supplied by the caller rather than derived from a prefix:
 * `WalletsView` and `WalletPopupModal` already ship different, non-parallel ids
 * (`new-wallet-init-balance` vs `modal-new-wallet-balance`), and the Playwright
 * specs target the view's ids directly.
 */
export interface AddWalletFormIds {
  name: string;
  type: string;
  currency: string;
  balance: string;
  submit: string;
}

interface AddWalletFormProps {
  ids: AddWalletFormIds;
  tone: FieldTone;
  /** Extra classes for the <form> element (the modal centres and caps its width). */
  className?: string;
  /** Called after the wallet is successfully created. */
  onCreated: () => void;
}

/**
 * The create-wallet form shared by the Wallets view and the wallet pop-up modal.
 *
 * Owns its own draft state. On a rejected write the form stays populated so the
 * user can correct the input instead of losing it.
 */
export const AddWalletForm: React.FC<AddWalletFormProps> = ({
  ids,
  tone,
  className = '',
  onCreated,
}) => {
  const { addWallet } = useFinanceActions();

  const [walletName, setWalletName] = useState<string>('');
  const [walletType, setWalletType] = useState<WalletType>('BANK_ACCOUNT');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [walletColor, setWalletColor] = useState<string>(WALLET_COLOR_PALETTE[0]);
  const [createWalletError, setCreateWalletError] = useState<string | null>(null);

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateWalletError(null);

    const res = await addWallet(
      {
        name: walletName.trim(),
        type: walletType,
        currency: APP_CURRENCY,
        color: walletColor,
        icon: walletType.toLowerCase(),
      },
      initialBalance
    );

    // Keep the form open and populated when the write is rejected, so the user
    // can correct the input rather than losing it.
    if (!res.success) {
      setCreateWalletError(res.error || 'Failed to create wallet');
      return;
    }

    setWalletName('');
    setInitialBalance(0);
    onCreated();
  };

  return (
    <form onSubmit={handleCreateWallet} className={`space-y-4 ${className}`.trim()}>
      <div>
        <label className={LABEL_CLASS}>Wallet Name *</label>
        <input
          id={ids.name}
          type="text"
          required
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          placeholder="e.g. Checking Account, Cash"
          className={inputClass(tone)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className={LABEL_CLASS}>Type</label>
          <select
            id={ids.type}
            value={walletType}
            onChange={(e) => setWalletType(e.target.value as WalletType)}
            className={selectClass(tone)}
          >
            {WALLET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className={OPTION_CLASS}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Currency</label>
          <div
            id={ids.currency}
            className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-mono"
          >
            {APP_CURRENCY} ({APP_CURRENCY_SYMBOL})
          </div>
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS}>Starting Balance ({APP_CURRENCY_SYMBOL})</label>
        <input
          id={ids.balance}
          type="number"
          step="0.01"
          min="0"
          value={initialBalance}
          onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
          className={`${inputClass(tone)} font-mono`}
        />
      </div>

      <div>
        <label className={`${LABEL_CLASS} mb-1.5`}>Theme Color</label>
        <div className="flex flex-wrap items-center gap-2.5">
          {WALLET_COLOR_PALETTE.map((c) => (
            <motion.button
              whileTap={{ scale: 0.9 }}
              key={c}
              type="button"
              onClick={() => setWalletColor(c)}
              className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                walletColor === c
                  ? 'scale-125 ring-2 ring-stone-900 dark:ring-stone-100 ring-offset-2 dark:ring-offset-stone-900'
                  : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="pt-2">
        {createWalletError && (
          <div className={`${ERROR_BANNER_CLASS} mb-3`}>{createWalletError}</div>
        )}

        <motion.button
          whileTap={{ scale: 0.96 }}
          id={ids.submit}
          type="submit"
          className={PRIMARY_BUTTON_CLASS}
        >
          Add Wallet
        </motion.button>
      </div>
    </form>
  );
};
