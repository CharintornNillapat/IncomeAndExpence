import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useFinanceActions } from '../../context/FinanceContext';
import { Wallet } from '../../types';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../../utils/currency';
import { todayIsoDate } from '../../utils/date';
import { InlineMathInput } from '../InlineMathInput';
import {
  FieldTone,
  LABEL_CLASS,
  OPTION_CLASS,
  ERROR_BANNER_CLASS,
  inputClass,
  selectClass,
} from './walletFormStyles';

export interface WalletTransferFormIds {
  source: string;
  dest: string;
  amount: string;
  note: string;
  submit: string;
}

interface WalletTransferFormProps {
  /** Active (non-deleted) wallets only - a soft-deleted wallet must never be selectable. */
  wallets: Wallet[];
  ids: WalletTransferFormIds;
  tone: FieldTone;
  /**
   * Preselects the source wallet. The pop-up modal passes the wallet it was
   * opened on so a transfer starts from the account the user just tapped.
   */
  initialSourceWalletId?: string;
  amountPlaceholder?: string;
  /**
   * The modal shows the error above the fields alongside its status banner; the
   * view shows it just above the submit button.
   */
  errorPlacement?: 'top' | 'bottom';
  /** Optional success banner text, rendered at the top. Only the modal uses this. */
  statusMessage?: string | null;
  /** Called after the transfer commits successfully. */
  onTransferred: () => void;
}

/**
 * The wallet-to-wallet transfer form shared by the Wallets view and the wallet
 * pop-up modal.
 *
 * Owns the draft state and the submit path, including the idempotency key: one
 * key is armed per form, reused when a failed transfer is retried so the retry
 * is deduplicated rather than double-spending, and rotated only after success.
 */
export const WalletTransferForm: React.FC<WalletTransferFormProps> = ({
  wallets,
  ids,
  tone,
  initialSourceWalletId,
  amountPlaceholder = 'e.g. 500 or 1200/2',
  errorPlacement = 'bottom',
  statusMessage = null,
  onTransferred,
}) => {
  const { addTransaction } = useFinanceActions();

  // Seed the destination to the first wallet that is not the source, so the two
  // sides never start out identical (which would leave submit disabled).
  const seedSource = initialSourceWalletId || wallets[0]?.id || '';
  const [sourceWalletId, setSourceWalletId] = useState<string>(seedSource);
  const [destWalletId, setDestWalletId] = useState<string>(
    wallets.find((w) => w.id !== seedSource)?.id || ''
  );
  const [transferAmount, setTransferAmount] = useState<number | null>(null);
  const [transferRaw, setTransferRaw] = useState<string>('');
  const [transferValid, setTransferValid] = useState<boolean>(false);
  const [transferNote, setTransferNote] = useState<string>('Funds transfer');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferKey, setTransferKey] = useState<string>(() => crypto.randomUUID());

  const canSubmit =
    !isTransferring &&
    transferValid &&
    transferAmount !== null &&
    !!sourceWalletId &&
    !!destWalletId &&
    sourceWalletId !== destWalletId;

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTransferring) return;
    if (!canSubmit || transferAmount === null) return;

    setTransferError(null);
    setIsTransferring(true);

    try {
      const res = await addTransaction({
        amount: transferAmount,
        rawInput: transferRaw,
        description: transferNote || 'Transfer between wallets',
        walletId: sourceWalletId,
        destinationWalletId: destWalletId,
        type: 'TRANSFER',
        transactionDate: todayIsoDate(),
        idempotencyKey: transferKey,
      });

      if (res && !res.success) {
        setTransferError(res.error || 'Failed to complete transfer');
        return;
      }

      // Clear the armed amount immediately so the form cannot be resubmitted.
      // Rotating the key also remounts the amount input, clearing its value.
      setTransferAmount(null);
      setTransferRaw('');
      setTransferValid(false);
      setTransferKey(crypto.randomUUID());
      onTransferred();
    } finally {
      setIsTransferring(false);
    }
  };

  const errorBanner = transferError && (
    <div className={`${ERROR_BANNER_CLASS} flex items-center gap-2`}>
      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
      <span>{transferError}</span>
    </div>
  );

  return (
    <form onSubmit={handleExecuteTransfer} className="space-y-4">
      {statusMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorPlacement === 'top' && errorBanner}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className={LABEL_CLASS}>From Wallet</label>
          <select
            id={ids.source}
            value={sourceWalletId}
            onChange={(e) => setSourceWalletId(e.target.value)}
            className={selectClass(tone)}
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id} className={OPTION_CLASS}>
                {w.name} ({formatCurrencyAmount(w.balance)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>To Wallet</label>
          <select
            id={ids.dest}
            value={destWalletId}
            onChange={(e) => setDestWalletId(e.target.value)}
            className={selectClass(tone)}
          >
            {wallets
              .filter((w) => w.id !== sourceWalletId)
              .map((w) => (
                <option key={w.id} value={w.id} className={OPTION_CLASS}>
                  {w.name} ({formatCurrencyAmount(w.balance)})
                </option>
              ))}
          </select>
        </div>
      </div>

      <InlineMathInput
        key={transferKey}
        id={ids.amount}
        label={`Transfer Amount (${APP_CURRENCY_SYMBOL})`}
        placeholder={amountPlaceholder}
        required
        disabled={isTransferring}
        onAmountEvaluated={(val, raw, valid) => {
          setTransferAmount(val);
          setTransferRaw(raw);
          setTransferValid(valid);
        }}
      />

      <div>
        <label className={LABEL_CLASS}>Note</label>
        <input
          id={ids.note}
          type="text"
          value={transferNote}
          onChange={(e) => setTransferNote(e.target.value)}
          placeholder="e.g. Savings transfer"
          className={inputClass(tone)}
        />
      </div>

      {errorPlacement === 'bottom' && errorBanner}

      <div className="pt-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          id={ids.submit}
          type="submit"
          disabled={!canSubmit}
          className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            canSubmit
              ? 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 shadow-xs'
              : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>
            {isTransferring
              ? 'Transferring...'
              : `Transfer ${formatCurrencyAmount(transferAmount ?? 0)}`}
          </span>
        </motion.button>
      </div>
    </form>
  );
};
