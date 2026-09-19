import React, { useState, useId } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { InlineMathInput } from './InlineMathInput';
import { Wallet, Category, TransactionType } from '../types';
import { useFinanceState } from '../context/FinanceContext';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { matchSmartDescription } from '../utils/smartMatcher';
import { safeEvaluateMath } from '../utils/mathEvaluator';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { LABEL_TEXT_CLASS, OPTION_CLASS, ERROR_BANNER_CLASS } from '../utils/formStyles';

interface TransactionFormProps {
  wallets: Wallet[];
  categories: Category[];
  /** Distinguishes this mount when more than one `TransactionForm` can be in the DOM at once (e.g. the Dashboard's inline form alongside the Quick Add modal). */
  formTestId?: string;
  /**
   * Overrides this form's internal field ids for the amount input, wallet
   * select, and submit button (`${idPrefix}-amount-math`,
   * `${idPrefix}-wallet-select`, `confirm-${idPrefix}-btn`) instead of the
   * default `useId()`-derived ones. Exists so a caller embedding this form
   * in its own purpose-built shell (e.g. `DebtsView`'s repay modal) can keep
   * ids its own Playwright specs already depend on. Every other field keeps
   * its default id - only these three have a caller-visible legacy name to
   * preserve.
   */
  idPrefix?: string;
  /** Pins the transaction type on mount instead of defaulting to `'EXPENSE'`. */
  presetType?: TransactionType;
  /** Hides the type segmented toggle (and this form's own header row) for a caller that only ever wants one fixed type - e.g. a debt-repayment-only modal. Form state for the type is preserved, just not user-editable. */
  lockType?: boolean;
  /** Pins the debt-repayment target and hides the "Debt Target" selector, for a caller that already knows which debt is being repaid. */
  presetDebtId?: string;
  /** Pins the initially-selected source wallet instead of defaulting to `wallets[0]`. The selector itself stays editable. */
  presetWalletId?: string;
  onSubmitTransaction: (tx: {
    amount: number;
    rawInput: string;
    description: string;
    walletId: string;
    destinationWalletId?: string;
    categoryId?: string;
    debtId?: string;
    type: TransactionType;
    date: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; error?: string } | void> | { success: boolean; error?: string } | void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  wallets,
  categories,
  formTestId,
  idPrefix,
  presetType,
  lockType = false,
  presetDebtId,
  presetWalletId,
  onSubmitTransaction,
}) => {
  const formId = useId();
  const { keywordRules, debts } = useFinanceState();

  const activeDebts = React.useMemo(
    () => debts.filter((d) => !d.isDeleted && !d.isSettled),
    [debts]
  );

  const [amount, setAmount] = useState<number | null>(null);
  const [rawAmountInput, setRawAmountInput] = useState<string>('');
  const [isAmountValid, setIsAmountValid] = useState<boolean>(false);

  const [description, setDescription] = useState<string>('');
  const [type, setType] = useState<TransactionType>(presetType || 'EXPENSE');
  const [walletId, setWalletId] = useState<string>(presetWalletId || wallets[0]?.id || '');
  const [destinationWalletId, setDestinationWalletId] = useState<string>(wallets[1]?.id || '');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [debtId, setDebtId] = useState<string>(presetDebtId || activeDebts[0]?.id || debts[0]?.id || '');
  const [date, setDate] = useState<string>(todayIsoDate());

  // Ids for the three fields a caller-supplied shell (DebtsView's repay
  // modal) already has Playwright specs targeting by a specific legacy
  // name. Every other field keeps its default `useId()`-derived id
  // regardless of `idPrefix`.
  const mathInputId = idPrefix ? `${idPrefix}-amount-math` : `${formId}-math-input`;
  const walletSelectId = idPrefix ? `${idPrefix}-wallet-select` : `${formId}-wallet`;
  const submitBtnId = idPrefix ? `confirm-${idPrefix}-btn` : `${formId}-submit-btn`;

  // Keep walletId in sync when wallets are loaded
  React.useEffect(() => {
    if (wallets.length > 0 && (!walletId || !wallets.some((w) => w.id === walletId))) {
      setWalletId(wallets[0].id);
    }
  }, [wallets, walletId]);

  // Keep destinationWalletId valid: it must resolve to a real wallet and must never
  // collide with the source, otherwise the form looks fine but the transfer is
  // rejected as "requires a distinct destination wallet".
  React.useEffect(() => {
    const candidates = wallets.filter((w) => w.id !== walletId);
    if (candidates.length === 0) {
      if (destinationWalletId) setDestinationWalletId('');
      return;
    }
    if (!destinationWalletId || !candidates.some((w) => w.id === destinationWalletId)) {
      setDestinationWalletId(candidates[0].id);
    }
  }, [wallets, walletId, destinationWalletId]);

  const [autoMatchedCategory, setAutoMatchedCategory] = useState<string | null>(null);
  const [showManualOverrides, setShowManualOverrides] = useState<boolean>(false);
  const { value: isSubmitted, flash: flashSubmitted } = useTransientFlash(false, 2500);
  // One key per armed form. Retrying after a failure reuses it so the retry is
  // deduplicated rather than double-spending; it is regenerated only on success.
  const { idempotencyKey: submitKey, rotateIdempotencyKey } = useIdempotencyKey();

  const { isSubmitting, error: submitError, handleSubmit: submitTransaction } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save transaction',
    onSuccess: () => {
      setDescription('');
      setAutoMatchedCategory(null);
      setShowManualOverrides(false);
      rotateIdempotencyKey();
      flashSubmitted(true);
    },
  });

  const handleAmountEvaluated = React.useCallback((val: number | null, raw: string, valid: boolean) => {
    setAmount(val);
    setRawAmountInput(raw);
    setIsAmountValid(valid);
  }, []);

  // Smart Description Keyword Matcher
  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    // A locked-type form (e.g. debt repayment) has no business letting the
    // matcher silently switch `type` out from under it, and auto-tagging a
    // category is irrelevant when the type - and thus the category - is
    // already fixed by the caller.
    if (lockType) return;
    const match = matchSmartDescription(text, keywordRules, categories);

    if (match.categoryId) {
      setCategoryId(match.categoryId);
      if (match.type) {
        setType(match.type);
      }
      setAutoMatchedCategory(match.categoryName || null);
    } else {
      setAutoMatchedCategory(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    let effectiveAmount = amount;
    let effectiveRaw = rawAmountInput;
    let effectiveValid = isAmountValid;

    if (effectiveAmount === null || !effectiveValid) {
      if (rawAmountInput) {
        const evalRes = safeEvaluateMath(rawAmountInput);
        if (evalRes.isValid && evalRes.value !== null && evalRes.value > 0) {
          effectiveAmount = evalRes.value;
          effectiveValid = true;
        }
      }
    }

    const effectiveWalletId = walletId || wallets[0]?.id;
    if (!effectiveValid || effectiveAmount === null || effectiveAmount <= 0 || !effectiveWalletId) {
      return;
    }
    // Narrowed to non-null/non-empty here, so the closure below can rely on
    // these without TypeScript re-widening the outer `let`s.
    const finalAmount = effectiveAmount;
    const finalWalletId = effectiveWalletId;

    const selectedDebt = debts.find((d) => d.id === debtId);
    let finalDescription = description.trim();
    if (!finalDescription) {
      if (type === 'TRANSFER') {
        finalDescription = 'Transfer';
      } else if (type === 'DEBT_REPAYMENT' && selectedDebt) {
        finalDescription = `Debt Repayment: ${selectedDebt.name}`;
      } else {
        finalDescription = 'Transaction';
      }
    }

    const debtCategory = categories.find((c) => c.type === 'DEBT_REPAYMENT' || c.name.toLowerCase().includes('debt'));

    submitTransaction(e, () =>
      onSubmitTransaction({
        amount: finalAmount,
        rawInput: effectiveRaw,
        description: finalDescription,
        walletId: finalWalletId,
        destinationWalletId: type === 'TRANSFER' ? destinationWalletId : undefined,
        categoryId: type === 'EXPENSE' || type === 'INCOME' || type === 'ADJUSTMENT' ? categoryId : type === 'DEBT_REPAYMENT' ? debtCategory?.id : undefined,
        debtId: type === 'DEBT_REPAYMENT' ? debtId : undefined,
        type,
        date,
        idempotencyKey: submitKey,
      })
    );
  };

  const selectedWallet = wallets.find((w) => w.id === walletId);
  const matchedCategoryObj = categories.find((c) => c.id === categoryId);
  const destinationWalletOptions = React.useMemo(
    () => wallets.filter((w) => w.id !== walletId),
    [wallets, walletId]
  );

  // Determine if manual fields should be collapsed by default
  const isAutoParsed = Boolean(autoMatchedCategory);
  const isCollapsed = isAutoParsed && !showManualOverrides;

  return (
    <form
      id={`${formId}-form`}
      data-testid={formTestId}
      onSubmit={handleSubmit}
      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-4 sm:p-6 space-y-5 transition-colors"
    >
      {!lockType && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">Record Transaction</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">Log an expense, income, transfer, or debt payment</p>
        </div>

        {/* Transaction Type Segmented Toggle with mobile touch targets */}
        <div className="grid grid-cols-4 sm:flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl gap-1 w-full sm:w-auto border border-stone-200 dark:border-stone-700">
          {(['EXPENSE', 'INCOME', 'TRANSFER', 'DEBT_REPAYMENT'] as TransactionType[]).map((t) => (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={t}
              type="button"
              id={`${formId}-type-${t.toLowerCase()}`}
              onClick={() => {
                setType(t);
                if (isAutoParsed) setShowManualOverrides(true);
              }}
              className={`py-2 px-2 sm:px-3 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer truncate ${
                type === t
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {t === 'DEBT_REPAYMENT' ? 'Debt' : t.charAt(0) + t.slice(1).toLowerCase()}
            </motion.button>
          ))}
        </div>
      </div>
      )}

      {/* 1. Safe Inline Math Input Component */}
      <InlineMathInput
        id={mathInputId}
        label="Transaction Amount"
        placeholder="e.g. 500+500 or 1500*0.7"
        currencyPrefix={APP_CURRENCY_SYMBOL}
        required
        onAmountEvaluated={handleAmountEvaluated}
      />

      {/* 2. Smart Description Input with auto-tagging */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <label htmlFor={`${formId}-desc`} className={LABEL_TEXT_CLASS}>
            Description / Note
          </label>
          {autoMatchedCategory && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Auto-categorized: <strong>{autoMatchedCategory}</strong>
            </span>
          )}
        </div>
        <div className="relative">
          <input
            id={`${formId}-desc`}
            type="text"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder={type === 'DEBT_REPAYMENT' ? 'e.g., Monthly student loan payment' : 'e.g., lunch with team or groceries'}
            className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
          />
        </div>
      </div>

      {/* Smart Auto-Fill Notification & Manual Toggle */}
      {isAutoParsed && (
        <div className="flex items-center justify-between p-3 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Applied <strong>{matchedCategoryObj?.name}</strong> • Paying from <strong>{selectedWallet?.name}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowManualOverrides(!showManualOverrides)}
            className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 underline cursor-pointer flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            {showManualOverrides ? 'Hide details' : 'Edit details'}
          </button>
        </div>
      )}

      {/* 3. Source Wallet & Destination/Category/Debt Selectors (Collapsed when auto-matched unless expanded) */}
      {!isCollapsed && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-150">
          <div className={`grid grid-cols-1 gap-4 ${presetDebtId ? '' : 'sm:grid-cols-2'}`}>
            {/* Source Wallet */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={walletSelectId} className={LABEL_TEXT_CLASS}>
                {type === 'TRANSFER' ? 'From Wallet' : 'Paying Wallet'}
              </label>
              <select
                id={walletSelectId}
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id} className={OPTION_CLASS}>
                    {w.name} ({formatCurrencyAmount(w.balance)})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Wallet for transfers, Target Debt for repayments (only when the
                caller hasn't already pinned one via presetDebtId), OR Category for regular transactions */}
            {type === 'TRANSFER' ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-dest-wallet`} className={LABEL_TEXT_CLASS}>
                  To Wallet
                </label>
                <select
                  id={`${formId}-dest-wallet`}
                  value={destinationWalletId}
                  onChange={(e) => setDestinationWalletId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                >
                  {destinationWalletOptions.map((w) => (
                    <option key={w.id} value={w.id} className={OPTION_CLASS}>
                      {w.name} ({formatCurrencyAmount(w.balance)})
                    </option>
                  ))}
                </select>
              </div>
            ) : type === 'DEBT_REPAYMENT' && !presetDebtId ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-debt`} className={LABEL_TEXT_CLASS}>
                  Debt Target
                </label>
                <select
                  id={`${formId}-debt`}
                  value={debtId}
                  onChange={(e) => setDebtId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                >
                  {debts.map((d) => (
                    <option key={d.id} value={d.id} className={OPTION_CLASS}>
                      {d.name} ({formatCurrencyAmount(d.remainingAmount)} remaining)
                    </option>
                  ))}
                </select>
              </div>
            ) : type === 'DEBT_REPAYMENT' ? null : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-category`} className={LABEL_TEXT_CLASS}>
                  Category
                </label>
                <div className="relative">
                  <select
                    id={`${formId}-category`}
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setAutoMatchedCategory(null);
                    }}
                    className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className={OPTION_CLASS}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 4. Date Picker */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-date`} className={LABEL_TEXT_CLASS}>
              Transaction Date
            </label>
            <input
              id={`${formId}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 [color-scheme:light] dark:[color-scheme:dark] transition-colors"
            />
          </div>
        </div>
      )}

      {/* 5. Submit Button */}
      <div className="pt-2">
        <motion.button
          whileTap={!isSubmitting && isAmountValid && amount !== null ? { scale: 0.96 } : {}}
          id={submitBtnId}
          type="submit"
          disabled={isSubmitting || !isAmountValid || amount === null}
          className={`w-full min-h-[48px] py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            !isSubmitting && isAmountValid && amount !== null
              ? 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 shadow-sm'
              : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
          }`}
        >
          <span>
            {isSubmitting
              ? 'Saving...'
              : `Record ${type === 'TRANSFER' ? 'Transfer' : type === 'DEBT_REPAYMENT' ? 'Debt Payment' : 'Transaction'}`}
          </span>
          {amount !== null && isAmountValid && (
            <span className="font-mono text-xs bg-stone-800 dark:bg-stone-200 px-2 py-0.5 rounded text-stone-200 dark:text-stone-800">
              {formatCurrencyAmount(amount)}
            </span>
          )}
          <ArrowRight className="w-4 h-4" />
        </motion.button>

        {submitError && (
          <div className={`${ERROR_BANNER_CLASS} flex items-center gap-2 mt-2`}>
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {isSubmitted && (
          <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2">
            ✓ Transaction successfully logged!
          </p>
        )}
      </div>
    </form>
  );
};

