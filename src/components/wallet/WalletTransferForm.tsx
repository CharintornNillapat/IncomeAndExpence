import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, ArrowRight, AlertCircle, AlertTriangle, CheckCircle2, Wallet as WalletIcon } from 'lucide-react';
import { useFinanceActions } from '../../context/FinanceContext';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { Wallet } from '../../types';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../../utils/currency';
import { roundToCents } from '../../utils/money';
import { todayIsoDate } from '../../utils/date';
import { getWalletIcon } from '../../utils/walletIcons';
import { InlineMathInput } from '../InlineMathInput';
import { EmptyState } from '../ui/EmptyState';
import {
  FieldTone,
  LABEL_CLASS,
  OPTION_CLASS,
  ERROR_BANNER_CLASS,
  inputClass,
} from '../../utils/formStyles';

export interface WalletTransferFormIds {
  source: string;
  dest: string;
  amount: string;
  note: string;
  submit: string;
  swap: string;
  transferAll: string;
}

interface WalletTransferFormProps {
  /** Active (non-deleted) wallets only - a soft-deleted wallet must never be selectable. */
  wallets: Wallet[];
  ids: WalletTransferFormIds;
  tone: FieldTone;
  /**
   * Preselects the source wallet. The caller passes the wallet the user tapped
   * so a transfer starts from the account they were already looking at.
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

interface TransferWalletPanelProps {
  label: string;
  wallet: Wallet | undefined;
  wallets: Wallet[];
  selectId: string;
  value: string;
  onChange: (walletId: string) => void;
  /** The projected balance once this transfer commits, or `null` while there is no valid amount. */
  afterBalance: number | null;
  testId: string;
  afterTestId: string;
}

/**
 * One side of the transfer. Deliberately local to this file rather than a
 * shared primitive: the icon-badge + name + balance block exists in four other
 * places (`WalletsView`, `WalletAccountsGrid`, `WalletPopupModal` twice) and
 * they have already diverged on size and weight, so per ADR `0006` forcing
 * convergence would be a visual regression rather than a cleanup.
 *
 * The `<select>` stays the real, visible control - it is only restyled to sit
 * inside the panel. `tests/wallet-forms.spec.ts` asserts both selectors are
 * visible and reads them with `.inputValue()`, so it must remain a form
 * control, not a div that looks like one.
 */
const TransferWalletPanel: React.FC<TransferWalletPanelProps> = ({
  label,
  wallet,
  wallets,
  selectId,
  value,
  onChange,
  afterBalance,
  testId,
  afterTestId,
}) => {
  const Icon = wallet ? getWalletIcon(wallet.type) : WalletIcon;
  const isOverdrawn = afterBalance !== null && afterBalance < 0;

  return (
    <div
      data-testid={testId}
      className="flex h-full flex-col gap-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 sm:p-3.5 transition-colors"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
        {label}
      </span>

      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
          style={{ backgroundColor: wallet?.color || '#a8a29e' }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-xs font-bold text-stone-900 dark:text-stone-100 border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
        >
          {wallets.map((w) => (
            <option key={w.id} value={w.id} className={OPTION_CLASS}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-auto">
        <div
          className={`font-mono text-sm font-bold tabular-nums transition-colors ${
            afterBalance !== null
              ? 'text-stone-400 dark:text-stone-500 line-through decoration-1'
              : 'text-stone-900 dark:text-stone-100'
          }`}
        >
          {formatCurrencyAmount(wallet?.balance ?? 0)}
        </div>
        {afterBalance !== null && (
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3 shrink-0 text-stone-400 dark:text-stone-500" />
            <span
              data-testid={afterTestId}
              className={`font-mono text-sm font-bold tabular-nums ${
                isOverdrawn
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {formatCurrencyAmount(afterBalance)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The wallet-to-wallet transfer form, owned by `TransferFundsModal` (ADR `0008`
 * put it at shell level; ADR `0013` made it the app's only transfer surface).
 *
 * Owns the draft state and the submit path, including the idempotency key: one
 * key is armed per form, reused when a failed transfer is retried so the retry
 * is deduplicated rather than double-spending, and rotated only after success.
 *
 * Per ADR `0014` it renders a live source -> destination preview. The preview
 * arithmetic mirrors `addTransaction`'s exactly (`FinanceContext.tsx`'s
 * source/dest balance computation) via the shared `roundToCents`, so what the
 * user sees is what the ledger commits.
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
  // Drives the "Transfer all" chip through `InlineMathInput`'s `seed` prop,
  // which pushes a value in without remounting.
  const [amountSeed, setAmountSeed] = useState<{ key: number; value: string }>({ key: 0, value: '' });
  const { idempotencyKey: transferKey, rotateIdempotencyKey } = useIdempotencyKey();

  const { isSubmitting: isTransferring, error: transferError, handleSubmit: submitTransfer } = useSubmitHandler({
    defaultErrorMessage: 'Failed to complete transfer',
    onSuccess: () => {
      // Clear the armed amount immediately so the form cannot be resubmitted.
      // Rotating the key also remounts the amount input, clearing its value.
      setTransferAmount(null);
      setTransferRaw('');
      setTransferValid(false);
      rotateIdempotencyKey();
      onTransferred();
    },
  });

  const sourceWallet = wallets.find((w) => w.id === sourceWalletId);
  const destWallet = wallets.find((w) => w.id === destWalletId);

  const canSubmit =
    !isTransferring &&
    transferValid &&
    transferAmount !== null &&
    !!sourceWalletId &&
    !!destWalletId &&
    sourceWalletId !== destWalletId;

  // The preview mirrors `addTransaction`'s own balance math for a TRANSFER.
  const hasPreview = transferValid && transferAmount !== null && transferAmount > 0;
  const sourceAfter =
    hasPreview && sourceWallet ? roundToCents(sourceWallet.balance - (transferAmount as number)) : null;
  const destAfter =
    hasPreview && destWallet ? roundToCents(destWallet.balance + (transferAmount as number)) : null;
  const isOverdrawn = sourceAfter !== null && sourceAfter < 0;

  /*
   * Selecting the wallet that currently sits on the other side swaps the two
   * rather than leaving one stale. Before ADR `0014` the destination `<select>`
   * simply filtered the source out of its option list, so changing the source
   * to the destination's wallet left `destWalletId` pointing at a wallet that
   * was no longer in the list - invisible then, but it would render a preview
   * for a wallet the user is not looking at.
   */
  const handleSourceChange = (walletId: string) => {
    if (walletId === destWalletId) setDestWalletId(sourceWalletId);
    setSourceWalletId(walletId);
  };

  const handleDestChange = (walletId: string) => {
    if (walletId === sourceWalletId) setSourceWalletId(destWalletId);
    setDestWalletId(walletId);
  };

  const handleSwap = () => {
    setSourceWalletId(destWalletId);
    setDestWalletId(sourceWalletId);
  };

  const handleTransferAll = () => {
    if (!sourceWallet) return;
    setAmountSeed((prev) => ({ key: prev.key + 1, value: String(sourceWallet.balance) }));
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || transferAmount === null) return;

    return submitTransfer(e, () =>
      addTransaction({
        amount: transferAmount,
        rawInput: transferRaw,
        description: transferNote || 'Transfer between wallets',
        walletId: sourceWalletId,
        destinationWalletId: destWalletId,
        type: 'TRANSFER',
        transactionDate: todayIsoDate(),
        idempotencyKey: transferKey,
      })
    );
  };

  const errorBanner = transferError && (
    <div className={`${ERROR_BANNER_CLASS} flex items-center gap-2`}>
      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
      <span>{transferError}</span>
    </div>
  );

  // A transfer needs two sides. Previously both ids degraded to '' here and the
  // submit button sat permanently disabled with no explanation.
  if (wallets.length < 2) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="You need two wallets to transfer"
        subtitle="Add a second wallet and you can move money between them."
      />
    );
  }

  return (
    <form onSubmit={handleExecuteTransfer} className="space-y-4">
      {statusMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorPlacement === 'top' && errorBanner}

      {/* Source -> Destination. Stacks on mobile with the arrow rotated a
          quarter turn, so the direction reads top-to-bottom instead. */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-stretch">
        <TransferWalletPanel
          label="From"
          wallet={sourceWallet}
          wallets={wallets}
          selectId={ids.source}
          value={sourceWalletId}
          onChange={handleSourceChange}
          afterBalance={sourceAfter}
          testId="transfer-panel-source"
          afterTestId="transfer-balance-after-source"
        />

        <div className="flex items-center justify-center">
          <motion.button
            whileTap={{ scale: 0.9 }}
            id={ids.swap}
            type="button"
            onClick={handleSwap}
            aria-label="Swap source and destination wallets"
            title="Swap source and destination"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-300 dark:hover:border-stone-600 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 rotate-90 sm:rotate-0" />
          </motion.button>
        </div>

        <TransferWalletPanel
          label="To"
          wallet={destWallet}
          wallets={wallets}
          selectId={ids.dest}
          value={destWalletId}
          onChange={handleDestChange}
          afterBalance={destAfter}
          testId="transfer-panel-dest"
          afterTestId="transfer-balance-after-dest"
        />
      </div>

      {/* Warn, never block: a CREDIT_CARD wallet legitimately carries a negative
          balance, so `canSubmit` deliberately ignores this (ADR `0014`). */}
      {isOverdrawn && sourceAfter !== null && (
        <div
          data-testid="transfer-overdraft-warning"
          className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-medium text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            This overdraws <strong>{sourceWallet?.name}</strong> by{' '}
            {formatCurrencyAmount(Math.abs(sourceAfter))}.
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <InlineMathInput
          key={transferKey}
          id={ids.amount}
          label={`Transfer Amount (${APP_CURRENCY_SYMBOL})`}
          placeholder={amountPlaceholder}
          seed={amountSeed}
          required
          disabled={isTransferring}
          onAmountEvaluated={(val, raw, valid) => {
            setTransferAmount(val);
            setTransferRaw(raw);
            setTransferValid(valid);
          }}
        />
        {!isTransferring && sourceWallet && sourceWallet.balance > 0 && (
          <div className="flex justify-end">
            <button
              id={ids.transferAll}
              type="button"
              onClick={handleTransferAll}
              className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 underline underline-offset-2 cursor-pointer transition-colors"
            >
              Transfer all ({formatCurrencyAmount(sourceWallet.balance)})
            </button>
          </div>
        )}
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor={ids.note}>
          Note
        </label>
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
