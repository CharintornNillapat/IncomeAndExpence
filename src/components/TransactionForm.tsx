import React, { useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { InlineMathInput } from './InlineMathInput';
import { Wallet, Category, TransactionType, Preset } from '../types';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { useDescriptionClassifier } from '../hooks/useDescriptionClassifier';
import { CategorySuggestionChip } from './transaction/CategorySuggestionChip';
import type { JevSuggestion } from '../utils/jevClassifier';
import { matchSmartDescription } from '../utils/smartMatcher';
import { parseExpressInput } from '../utils/expressInput';
import { safeEvaluateMath } from '../utils/mathEvaluator';
import { roundToCents } from '../utils/money';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { LABEL_TEXT_CLASS, OPTION_CLASS, ERROR_BANNER_CLASS } from '../utils/formStyles';
import { SegmentedControl } from './ui/SegmentedControl';

interface TransactionFormProps {
  wallets: Wallet[];
  categories: Category[];
  /** Distinguishes this mount when more than one `TransactionForm` can be in the DOM at once (e.g. the page-level Add modal alongside the Quick Add modal). */
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
  /**
   * Renders the "Transfer Funds" shortcut link below the submit button.
   * Omitted means no link at all: TRANSFER left this form's type toggle in
   * ADR 0013, and a link that goes nowhere is worse than no link.
   */
  onRequestTransfer?: () => void;
  /** Renders the "Repay Debt" shortcut link below the submit button. Same contract as `onRequestTransfer`. */
  onRequestRepayDebt?: () => void;
  onSubmitTransaction: (tx: {
    amount: number;
    rawInput: string;
    description: string;
    walletId: string;
    categoryId?: string;
    debtId?: string;
    type: TransactionType;
    date: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; error?: string } | void> | { success: boolean; error?: string } | void;
}

/**
 * This form's "apply a stored value" chip - used by the saved-template chips
 * and the debt payoff chips (ADR 0015). Deliberately stone, not the emerald
 * of `InlineMathInput`'s quick-amount chips: those *add to* what is already
 * typed, these *replace* it with a target figure.
 */
const QUICK_CHIP_CLASS =
  'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer';

export const TransactionForm: React.FC<TransactionFormProps> = ({
  wallets,
  categories,
  formTestId,
  idPrefix,
  presetType,
  lockType = false,
  presetDebtId,
  presetWalletId,
  onRequestTransfer,
  onRequestRepayDebt,
  onSubmitTransaction,
}) => {
  const formId = useId();
  const { keywordRules, debts, presets } = useFinanceState();
  const { addPreset } = useFinanceActions();

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
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [debtId, setDebtId] = useState<string>(presetDebtId || activeDebts[0]?.id || debts[0]?.id || '');
  const [date, setDate] = useState<string>(todayIsoDate());

  // Drives `InlineMathInput`'s `seed` prop. Both the express note parser and
  // an applied template push through here; bumping `key` is what makes the
  // push land even when the text is unchanged from a previous seed.
  const [amountSeed, setAmountSeed] = useState<{ key: number; value: string }>({ key: 0, value: '' });
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('');
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);

  // Ids for the three fields a caller-supplied shell (DebtsView's repay
  // modal) already has Playwright specs targeting by a specific legacy
  // name. Every other field keeps its default `useId()`-derived id
  // regardless of `idPrefix`.
  const mathInputId = idPrefix ? `${idPrefix}-amount-math` : `${formId}-math-input`;
  const walletSelectId = idPrefix ? `${idPrefix}-wallet-select` : `${formId}-wallet`;
  const submitBtnId = idPrefix ? `confirm-${idPrefix}-btn` : `${formId}-submit-btn`;
  // Prefix for everything added after those three legacy names (ADR 0015's
  // payoff block). Falls back to the generated id so a form mounted without
  // an `idPrefix` still gets unique ids.
  const idBase = idPrefix || formId;

  // Keep walletId in sync when wallets are loaded
  React.useEffect(() => {
    if (wallets.length > 0 && (!walletId || !wallets.some((w) => w.id === walletId))) {
      setWalletId(wallets[0].id);
    }
  }, [wallets, walletId]);

  const [autoMatchedCategory, setAutoMatchedCategory] = useState<string | null>(null);
  const { value: isSubmitted, flash: flashSubmitted } = useTransientFlash(false, 2500);
  // One key per armed form. Retrying after a failure reuses it so the retry is
  // deduplicated rather than double-spending; it is regenerated only on success.
  const { idempotencyKey: submitKey, rotateIdempotencyKey } = useIdempotencyKey();

  // Once the user picks a category or type by hand - or types in the amount
  // field - a later automatic write must not overwrite it. Refs rather than
  // state: every path that flips one of these already triggers its own render.
  //
  // `amount` is the load-bearing one (ADR 0013). Without it, a note ending in
  // digits would silently replace an amount the user already entered, which is
  // both wrong and what `csv`/`soft-delete`/`presets` depend on not happening.
  const userTouchedRef = React.useRef({ category: false, type: false, amount: false });

  /** The last expression the note parser pushed, so an unchanged parse is not re-seeded on every keystroke. */
  const lastSeededExprRef = React.useRef<string | null>(null);

  const { isSubmitting, error: submitError, handleSubmit: submitTransaction } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save transaction',
    onSuccess: () => {
      setDescription('');
      setAutoMatchedCategory(null);
      // Clear the amount too: with the note now driving it, leaving a stale
      // amount behind after a successful save invites double-recording it.
      setAmountSeed((prev) => ({ key: prev.key + 1, value: '' }));
      lastSeededExprRef.current = null;
      // Both are declared below this closure; it only ever runs at submit time.
      clearSuggestion();
      userTouchedRef.current = { category: false, type: false, amount: false };
      rotateIdempotencyKey();
      flashSubmitted(true);
    },
  });

  const handleAmountEvaluated = React.useCallback((val: number | null, raw: string, valid: boolean) => {
    setAmount(val);
    setRawAmountInput(raw);
    setIsAmountValid(valid);
  }, []);

  const handleAmountUserEdit = React.useCallback(() => {
    userTouchedRef.current.amount = true;
  }, []);

  /**
   * Async half of the two-layer categorization (ADR 0011). The keyword matcher
   * below stays the first and authoritative layer; this is armed only on a miss.
   */
  const {
    suggestion,
    classify,
    clear: clearSuggestion,
    dismiss: dismissSuggestion,
  } = useDescriptionClassifier(categories);

  const applySuggestion = React.useCallback(
    (s: JevSuggestion, { force }: { force: boolean }) => {
      if (!force && userTouchedRef.current.category) return;
      setCategoryId(s.categoryId);
      if (force || !userTouchedRef.current.type) {
        setType(s.type);
      }
      setAutoMatchedCategory(s.categoryName);
      clearSuggestion();
    },
    [clearSuggestion]
  );

  // A high-confidence answer fills the fields outright, matching what the
  // keyword matcher has always done. Anything weaker renders a chip instead
  // and waits to be tapped.
  React.useEffect(() => {
    if (suggestion && suggestion.strength === 'AUTO_FILL') {
      applySuggestion(suggestion, { force: false });
    }
  }, [suggestion, applySuggestion]);

  /**
   * The express note field (ADR 0013). Three things happen here, in order:
   *
   *   1. The amount is parsed out of the note and pushed into the amount field
   *      - unless the user has taken that field over by hand.
   *   2. The keyword matcher runs on the *stripped* text (layer 1, sync, free).
   *   3. Jev is consulted only on a rule miss (layer 2).
   *
   * Step 1 runs even on a locked-type form: pulling "4000" out of "pay off
   * loan 4000" is type-agnostic. Steps 2 and 3 do not, for the reasons below.
   */
  const handleDescriptionChange = (text: string) => {
    setDescription(text);

    const parsed = parseExpressInput(text);
    if (
      parsed.amountExpression &&
      !userTouchedRef.current.amount &&
      parsed.amountExpression !== lastSeededExprRef.current
    ) {
      lastSeededExprRef.current = parsed.amountExpression;
      setAmountSeed((prev) => ({ key: prev.key + 1, value: parsed.amountExpression as string }));
    }

    // A locked-type form (e.g. debt repayment) has no business letting the
    // matcher silently switch `type` out from under it, and auto-tagging a
    // category is irrelevant when the type - and thus the category - is
    // already fixed by the caller. The classifier is skipped for the same
    // reason, which also means a repay modal never issues a network call.
    if (lockType) return;

    // Both layers see the note with the amount stripped out: "ข้าวมันไก่ 60"
    // classifies as "ข้าวมันไก่". The ledger still stores the full text.
    const textToClassify = parsed.cleanDescription || text;
    const match = matchSmartDescription(textToClassify, keywordRules, categories);

    if (match.categoryId) {
      setCategoryId(match.categoryId);
      if (match.type) {
        setType(match.type);
      }
      setAutoMatchedCategory(match.categoryName || null);
      // A rule hit is authoritative and free: drop any pending or displayed
      // suggestion and make no network call at all.
      clearSuggestion();
    } else {
      setAutoMatchedCategory(null);
      classify(textToClassify);
    }
  };

  // Prefills the form from a saved template. The amount field is re-seeded via
  // `amountSeed` (see its declaration above); category/wallet are only applied
  // if they still resolve to a live option, since a template can outlive the
  // category or wallet it was created against.
  const handleApplyPreset = (preset: Preset) => {
    setType(preset.type);
    setDescription(preset.description);
    setAutoMatchedCategory(null);
    // A template is an explicit user choice of category, type and amount, so it
    // counts as touching all three - a classification or a note-parsed amount
    // racing in behind it must not win.
    clearSuggestion();
    userTouchedRef.current = { category: true, type: true, amount: true };
    if (preset.categoryId && categories.some((c) => c.id === preset.categoryId)) {
      setCategoryId(preset.categoryId);
    }
    if (preset.walletId && wallets.some((w) => w.id === preset.walletId)) {
      setWalletId(preset.walletId);
    }
    setAmountSeed((prev) => ({ key: prev.key + 1, value: preset.amount.toString() }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    let effectiveAmount = amount;
    const effectiveRaw = rawAmountInput;
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
    // The note is stored exactly as typed, amount and all (ADR 0013): stripping
    // it here would be lossy, and a wrong parse would mangle the note as well
    // as the amount.
    let finalDescription = description.trim();
    if (!finalDescription) {
      if (type === 'DEBT_REPAYMENT' && selectedDebt) {
        finalDescription = `Debt Repayment: ${selectedDebt.name}`;
      } else {
        finalDescription = 'Transaction';
      }
    }

    const debtCategory = categories.find((c) => c.type === 'DEBT_REPAYMENT' || c.name.toLowerCase().includes('debt'));

    // Presets only support EXPENSE/INCOME (see `Preset` in types.ts), so a
    // DEBT_REPAYMENT/ADJUSTMENT submission never triggers a save even if the
    // checkbox was left checked from a prior EXPENSE/INCOME entry.
    const shouldSaveTemplate =
      !lockType && saveAsTemplate && (type === 'EXPENSE' || type === 'INCOME') && templateName.trim().length > 0;
    const finalCategoryId =
      type === 'EXPENSE' || type === 'INCOME' || type === 'ADJUSTMENT' ? categoryId : type === 'DEBT_REPAYMENT' ? debtCategory?.id : undefined;

    submitTransaction(e, async () => {
      const res = await onSubmitTransaction({
        amount: finalAmount,
        rawInput: effectiveRaw,
        description: finalDescription,
        walletId: finalWalletId,
        categoryId: finalCategoryId,
        debtId: type === 'DEBT_REPAYMENT' ? debtId : undefined,
        type,
        date,
        idempotencyKey: submitKey,
      });

      const failed = res && typeof res === 'object' && 'success' in res && !res.success;
      if (failed || !shouldSaveTemplate) {
        return res;
      }

      const presetRes = await addPreset({
        name: templateName.trim(),
        type,
        amount: finalAmount,
        description: finalDescription,
        categoryId: finalCategoryId,
        walletId: finalWalletId,
      });
      if (presetRes.success) {
        setSaveAsTemplate(false);
        setTemplateName('');
        setTemplateSaveError(null);
      } else {
        setTemplateSaveError(presetRes.error || 'Failed to save template');
      }
      return res;
    });
  };

  /*
   * Debt payoff shortcuts (ADR 0015). Everything below is derived on render -
   * `InlineMathInput.onAmountEvaluated` already fires on every keystroke, so
   * no effect, no debounce and no context change is involved.
   *
   * Looks the target up in `debts` rather than `activeDebts`, matching
   * `handleSubmit`: a caller can pin an already-settled debt through
   * `presetDebtId`, and it resolving to a zero remainder is the correct
   * outcome - there is nothing left to pay off, so no chips render.
   */
  const repayTargetDebt =
    type === 'DEBT_REPAYMENT' ? debts.find((d) => d.id === debtId) ?? null : null;
  const remainingDebt = repayTargetDebt?.remainingAmount ?? 0;
  const minimumDue = repayTargetDebt?.minimumPayment ?? 0;
  // At or above the remainder the minimum is "Pay in full" wearing a different
  // label, and it would trip the overpayment warning as well.
  const showMinimumChip = minimumDue > 0 && minimumDue < remainingDebt;

  /**
   * Pushes a value into the amount field without remounting it, and latches
   * the field as user-owned.
   *
   * The latch has to be set here because `InlineMathInput`'s `seed` effect
   * deliberately never fires `onUserEdit` - same reasoning as
   * `handleApplyPreset` above. A chip is an explicit choice of amount and
   * outranks the note parser from this point on (ADR 0013).
   */
  const seedPayoffAmount = (value: number) => {
    userTouchedRef.current.amount = true;
    setAmountSeed((prev) => ({ key: prev.key + 1, value: String(value) }));
  };

  const showShortcuts = !lockType && Boolean(onRequestTransfer || onRequestRepayDebt);
  const shortcutLinkClass =
    'font-semibold text-stone-700 dark:text-stone-300 underline underline-offset-2 hover:text-stone-900 dark:hover:text-white cursor-pointer transition-colors';

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
          <p className="text-xs text-stone-500 dark:text-stone-400">Log an expense or income</p>
        </div>

        {/* Transaction Type Segmented Toggle with mobile touch targets.
            EXPENSE/INCOME only (ADR 0013) - transfers belong to
            `TransferFundsModal` and repayments to `DebtsView`, both linked
            from the shortcut row at the bottom of this form. */}
        <SegmentedControl<TransactionType>
          className="grid grid-cols-2 sm:flex w-full sm:w-auto"
          value={type}
          onChange={(t) => {
            setType(t);
            userTouchedRef.current.type = true;
          }}
          options={(['EXPENSE', 'INCOME'] as TransactionType[]).map((t) => ({
            value: t,
            id: `${formId}-type-${t.toLowerCase()}`,
            label: t.charAt(0) + t.slice(1).toLowerCase(),
          }))}
        />
      </div>
      )}

      {/* Quick templates: reuses a saved preset (name/amount/description/category/wallet)
          to prefill the fields below instead of re-typing a recurring entry. Hidden on a
          locked-type form (e.g. the debt repay modal), which has no business letting a
          template silently override its fixed type. */}
      {!lockType && presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mr-0.5">
            Templates
          </span>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              id={`${formId}-preset-chip-${preset.id}`}
              onClick={() => handleApplyPreset(preset)}
              className={QUICK_CHIP_CLASS}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      {/* 1. The omni note - the field that drives the whole form. It fills the
             amount below it, the category, and the type. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <label htmlFor={`${formId}-desc`} className={LABEL_TEXT_CLASS}>
            Note
          </label>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            Type the amount right in the note
          </span>
        </div>
        <div className="relative">
          <input
            id={`${formId}-desc`}
            type="text"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            autoComplete="off"
            placeholder={
              type === 'DEBT_REPAYMENT'
                ? 'e.g., Monthly student loan payment 4000'
                : 'e.g. ข้าวมันไก่ 60, bts 45, or ค่าไฟ 1200'
            }
            className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
          />
        </div>

        {/*
          Mid-confidence classifications only. A high-confidence one has already
          filled the fields and reports itself through the badge on the Category
          label, and anything below the floor is silent. Non-blocking by
          construction: the form stays usable and submittable while this sits here.
        */}
        <AnimatePresence>
          {suggestion && suggestion.strength === 'SUGGEST' && (
            <CategorySuggestionChip
              key={suggestion.categoryId}
              suggestion={suggestion}
              idPrefix={formId}
              onApply={() => applySuggestion(suggestion, { force: true })}
              onDismiss={dismissSuggestion}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 2. Amount - pre-filled from the note above, always editable, and still
             a full inline-math field in its own right. */}
      <InlineMathInput
        id={mathInputId}
        label="Transaction Amount"
        placeholder="e.g. 500+500 or 1500*0.7"
        currencyPrefix={APP_CURRENCY_SYMBOL}
        seed={amountSeed}
        required
        onAmountEvaluated={handleAmountEvaluated}
        onUserEdit={handleAmountUserEdit}
      />

      {/* 2b. Debt payoff shortcuts (ADR 0015). Each chip seeds the amount
             field above rather than replacing it, so `#repay-amount-math`
             remains the single control `tests/debts.spec.ts` fills. Hidden
             once there is nothing left to pay off. */}
      {repayTargetDebt && remainingDebt > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-1">
          <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mr-0.5">
            Quick payoff
          </span>
          <button
            type="button"
            id={`${idBase}-payoff-full`}
            onClick={() => seedPayoffAmount(remainingDebt)}
            className={QUICK_CHIP_CLASS}
          >
            Pay in full <strong className="font-mono">{formatCurrencyAmount(remainingDebt)}</strong>
          </button>
          <button
            type="button"
            id={`${idBase}-payoff-half`}
            onClick={() => seedPayoffAmount(roundToCents(remainingDebt / 2))}
            className={QUICK_CHIP_CLASS}
          >
            50% <strong className="font-mono">{formatCurrencyAmount(roundToCents(remainingDebt / 2))}</strong>
          </button>
          {showMinimumChip && (
            <button
              type="button"
              id={`${idBase}-payoff-minimum`}
              onClick={() => seedPayoffAmount(minimumDue)}
              className={QUICK_CHIP_CLASS}
            >
              Minimum due <strong className="font-mono">{formatCurrencyAmount(minimumDue)}</strong>
            </button>
          )}
        </div>
      )}

      {/* 3. Wallet & Category. Always visible - there is no "Edit details"
             collapse any more (ADR 0013), so an auto-matched category can be
             overridden in one click instead of two. */}
      <div className="space-y-4 pt-1">
        <div className={`grid grid-cols-1 gap-4 ${presetDebtId ? '' : 'sm:grid-cols-2'}`}>
          {/* Source Wallet */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={walletSelectId} className={LABEL_TEXT_CLASS}>
              Paying Wallet
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

          {/* Target Debt for repayments (only when the caller hasn't already
              pinned one via presetDebtId), OR Category for regular transactions */}
          {type === 'DEBT_REPAYMENT' && !presetDebtId ? (
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
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label htmlFor={`${formId}-category`} className={LABEL_TEXT_CLASS}>
                  Category
                </label>
                {/* The one place an automatic categorization reports itself.
                    Sits on the label of the field it wrote, which is now always
                    on screen, so overriding it is a single click. */}
                {autoMatchedCategory && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Auto-categorized: <strong>{autoMatchedCategory}</strong>
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  id={`${formId}-category`}
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setAutoMatchedCategory(null);
                    // An explicit pick outranks the model from here on.
                    userTouchedRef.current.category = true;
                    dismissSuggestion();
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

      {/* Save-as-template: only offered for EXPENSE/INCOME (the two types `Preset`
          supports - see types.ts) on a form that isn't locked to one fixed type. */}
      {!lockType && (type === 'EXPENSE' || type === 'INCOME') && (
        <div className="flex flex-col gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 p-3">
          <label
            htmlFor={`${formId}-save-template-checkbox`}
            className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer"
          >
            <input
              id={`${formId}-save-template-checkbox`}
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => {
                setSaveAsTemplate(e.target.checked);
                if (!e.target.checked) setTemplateSaveError(null);
              }}
              className="rounded border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 focus:ring-stone-400 cursor-pointer"
            />
            Save as a quick template
          </label>
          {saveAsTemplate && (
            <input
              id={`${formId}-template-name`}
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name, e.g. Morning Coffee"
              className="w-full text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            />
          )}
          {templateSaveError && (
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{templateSaveError}</p>
          )}
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
            {isSubmitting ? 'Saving...' : `Record ${type === 'DEBT_REPAYMENT' ? 'Debt Payment' : 'Transaction'}`}
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

      {/* 6. Ways out. TRANSFER and DEBT_REPAYMENT left the type toggle above,
             so this is what keeps them one tap away instead of a dead end.
             Each link renders only if its caller wired a handler. */}
      {showShortcuts && (
        <p className="text-center text-xs text-stone-500 dark:text-stone-400 pt-1">
          Need to{' '}
          {onRequestTransfer && (
            <button
              type="button"
              id={`${formId}-shortcut-transfer`}
              onClick={onRequestTransfer}
              className={shortcutLinkClass}
            >
              Transfer Funds
            </button>
          )}
          {onRequestTransfer && onRequestRepayDebt && ' or '}
          {onRequestRepayDebt && (
            <button
              type="button"
              id={`${formId}-shortcut-repay-debt`}
              onClick={onRequestRepayDebt}
              className={shortcutLinkClass}
            >
              Repay Debt
            </button>
          )}
          ?
        </p>
      )}
    </form>
  );
};
