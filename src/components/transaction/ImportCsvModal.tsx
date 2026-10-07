import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Download, CheckCircle2, AlertCircle, Tags } from 'lucide-react';
import { useFinanceActions, useFinanceState } from '../../context/FinanceContext';
import { ImportPreviewSummary, ImportRowValidation } from '../../types';
import { todayIsoDate } from '../../utils/date';
import { formatCurrencyAmount } from '../../utils/currency';
import { generateIdempotencyKey } from '../../utils/ids';
import { parseAndValidateTransactionCsv } from '../../utils/csvExchange';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import { useTransientFlash } from '../../hooks/useTransientFlash';
import { OPTION_CLASS } from '../../utils/formStyles';
import { matchSmartDescription } from '../../utils/smartMatcher';
import { toClassifyCandidates } from '../../utils/jevClassifier';
import type { JevSuggestion } from '../../utils/jevClassifier';
import { classifyBatch } from '../../utils/batchClassifier';
import type { BatchClassifyProgress } from '../../utils/batchClassifier';

// Caps the CSV dry-run preview's rendered rows so a large import doesn't put
// thousands of `<tr>`s in the DOM at once - the summary counts above the
// table already total the whole file, and every valid row still commits
// regardless of whether it was rendered in this preview.
const CSV_PREVIEW_ROW_CAP = 100;

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The two-step CSV import (ADR 0019, 0022, 0023), moved out of
 * `TransactionsView` unchanged in Phase 58a (ADR 0031): the same state,
 * handlers, ids and copy. It subscribes to the finance state it needs itself,
 * so the page's list does not re-render for a preview it never shows.
 *
 * It stays mounted while closed, as it did inside the view, so a preview and
 * its classification survive a close only through the explicit reset below.
 */
export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({ isOpen, onClose }) => {
  const { wallets, categories, keywordRules, debts } = useFinanceState();
  const { commitBulkImport } = useFinanceActions();

  // CSV Import State
  const [importPreview, setImportPreview] = useState<ImportPreviewSummary | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importCommitError, setImportCommitError] = useState<string | null>(null);
  const [isCommittingImport, setIsCommittingImport] = useState<boolean>(false);
  // A ref as well as the state: a fast double-tap lands both clicks before the
  // disabled state commits, and the second click would start a second commit
  // (the guest path's keys are per-row and `Date.now()`-based, and the legacy
  // signed-in fallback has no replay). This is an in-flight guard, not import
  // dedupe - ADR 0019 and `csv.spec.ts` still expect two separate imports of
  // the same row to produce two rows.
  const commitInFlightRef = useRef<boolean>(false);
  // The current preview's import key (ADR 0023), armed when a file is parsed.
  const importKeyRef = useRef<string | null>(null);
  const [isParsingCsv, setIsParsingCsv] = useState<boolean>(false);
  const { value: importSuccessMsg, flash: flashImportSuccess, clear: clearImportSuccess } = useTransientFlash<string | null>(null);

  /*
   * Layer 2 state (ADR 0019). All preview-only: none of it reaches
   * `commitBulkImport`, which reads `categoryId` off the row and nothing else.
   * `ImportRowValidation` is the commit payload and deliberately does not
   * carry confidence or applied/suggested state.
   */
  const [rowSuggestions, setRowSuggestions] = useState<Map<number, JevSuggestion>>(new Map());
  const [classifyProgress, setClassifyProgress] = useState<BatchClassifyProgress | null>(null);
  const [classifyNote, setClassifyNote] = useState<string | null>(null);
  const classifyAbortRef = useRef<AbortController | null>(null);

  // While the run waits out a rate limit (ADR 0052), a once-a-second clock
  // for the countdown. It runs only during that wait.
  const resumesAt = classifyProgress?.resumesAt;
  const [waitClock, setWaitClock] = useState(() => Date.now());
  useEffect(() => {
    if (resumesAt === undefined) return;
    setWaitClock(Date.now());
    const timer = setInterval(() => setWaitClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resumesAt]);
  const waitSeconds = resumesAt === undefined ? null : Math.max(0, Math.ceil((resumesAt - waitClock) / 1000));

  /*
   * What a screen reader hears about the run (ADR 0054, 0055): one polite
   * live region, changed only when a pause starts, when it ends, when the
   * run is cancelled, and when any run finishes (its note, word for word).
   * The countdown is outside it, so a pause is announced once, not every
   * second.
   *
   * Pause and resume are announced where the batch reports them
   * (`reportProgress` below), never from an effect. An effect runs after its
   * render, so on a slow machine the run could finish and queue its note
   * first, and the effect's late "resumed" then replaced the note for good
   * (WebKit on CI, ADR 0055). Set in event order, the note is always last.
   */
  const [announcement, setAnnouncement] = useState('');
  const wasPausedRef = useRef(false);

  const activeCategoriesForForm = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);

  // Handle CSV File Selection (Step 1: Dry-Run Parse)
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileError(null);
    setImportCommitError(null);
    clearImportSuccess();
    setIsParsingCsv(true);

    resetClassification();

    try {
      const text = await file.text();
      const preview = await parseAndValidateTransactionCsv(text, wallets, debts);
      // Layer 1 runs here, synchronously and for free, before the preview is
      // ever shown (ADR 0011's ordering, applied to the bulk path).
      setImportPreview(applyRuleLayer(preview));
      // One key per preview (ADR 0023): a retry of THIS preview after a lost
      // response replays; the next file gets a new key and imports again,
      // which is what ADR 0019's "no dedupe" requires.
      importKeyRef.current = generateIdempotencyKey();
    } catch (err: any) {
      setImportFileError(err.message || 'Failed to parse CSV file');
    } finally {
      setIsParsingCsv(false);
    }
  };

  /*
   * ------------------------------------------------------------------
   * The importer's two categorization layers (ADR 0019)
   * ------------------------------------------------------------------
   */

  /**
   * A row is eligible when it is valid and its `categoryName` does not resolve
   * to a live category of the row's own type. That covers "no Category
   * column", "names a category you do not have" and, since ADR 0085, "names
   * one of another type" - in each case the row was going to commit
   * uncategorized, so filling it can only improve on the status quo.
   */
  const isEligibleForCategorization = useCallback(
    (row: ImportRowValidation): boolean => {
      if (!row.isValid) return false;
      if (row.categoryId) return false;
      if (!row.categoryName) return true;
      const named = row.categoryName.trim().toLowerCase();
      return !categories.some((c) => !c.isDeleted && c.type === row.type && c.name.trim().toLowerCase() === named);
    },
    [categories]
  );

  const resetClassification = () => {
    classifyAbortRef.current?.abort();
    classifyAbortRef.current = null;
    setRowSuggestions(new Map());
    setClassifyProgress(null);
    setClassifyNote(null);
    setAnnouncement('');
  };

  /** Layer 1: the synchronous keyword matcher, authoritative and free. */
  const applyRuleLayer = (preview: ImportPreviewSummary): ImportPreviewSummary => ({
    ...preview,
    rows: preview.rows.map((row) => {
      if (!isEligibleForCategorization(row)) return row;
      const match = matchSmartDescription(row.description, keywordRules, categories);
      // A rule may only supply a category whose type agrees with the row's.
      // `type` drives the wallet debit direction in `commitBulkImport` and is
      // never changed here, so a disagreement means the rule does not apply.
      if (!match.categoryId || match.type !== row.type) return row;
      return { ...row, categoryId: match.categoryId };
    }),
  });

  const uncategorizedRows = useMemo(
    () => (importPreview ? importPreview.rows.filter(isEligibleForCategorization) : []),
    [importPreview, isEligibleForCategorization]
  );

  const ruleMatchedCount = useMemo(
    () => (importPreview ? importPreview.rows.filter((r) => r.isValid && r.categoryId).length : 0),
    [importPreview]
  );

  /** Layer 2: Jev, on the rows Layer 1 did not resolve, behind an explicit tap. */
  const handleClassifyRemaining = async () => {
    if (!importPreview || uncategorizedRows.length === 0) return;

    const controller = new AbortController();
    classifyAbortRef.current = controller;
    setClassifyNote(null);
    // Emptied so the same sentence in a later run counts as a change and is read.
    setAnnouncement('');
    wasPausedRef.current = false;
    setClassifyProgress({ done: 0, total: uncategorizedRows.length });

    /** Progress for the countdown, and a pause's start and end for the region, in the order they happen. */
    const reportProgress = (progress: BatchClassifyProgress) => {
      setClassifyProgress(progress);
      // A cancelled run has announced its cancel; nothing after it is news.
      if (controller.signal.aborted) return;
      const paused = progress.resumesAt !== undefined;
      if (progress.resumesAt !== undefined && !wasPausedRef.current) {
        const seconds = Math.max(1, Math.ceil((progress.resumesAt - Date.now()) / 1000));
        setAnnouncement(
          `Rate limit reached. Classification paused for about ${seconds} second${seconds === 1 ? '' : 's'}, then it continues on its own.`
        );
      } else if (!paused && wasPausedRef.current) {
        setAnnouncement('Rate limit cleared. Classification resumed.');
      }
      wasPausedRef.current = paused;
    };

    const candidates = toClassifyCandidates(categories);
    const result = await classifyBatch(
      uncategorizedRows.map((r) => ({ id: r.rowIndex, text: r.description })),
      categories,
      candidates,
      { onProgress: reportProgress, signal: controller.signal }
    );

    classifyAbortRef.current = null;
    setClassifyProgress(null);

    if (controller.signal.aborted) return;

    if (result.unavailable) {
      // A very different message from "nothing matched": the endpoint is not
      // there (an unconfigured deployment, or the dev server, which does not
      // serve `api/`). The import still commits perfectly well without it.
      const unavailableNote = 'Jev is unavailable right now. Import still works, and categories stay blank.';
      setClassifyNote(unavailableNote);
      setAnnouncement(unavailableNote);
      return;
    }

    // Only AUTO_FILL is written. SUGGEST is held in `rowSuggestions` for the
    // user to accept with one click, mirroring the live form's gate exactly.
    setImportPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => {
          const suggestion = result.suggestions.get(row.rowIndex);
          if (!suggestion || !isEligibleForCategorization(row)) return row;
          // A category whose type disagrees with the row's is demoted to a
          // suggestion, never applied - the row's own `type` is authoritative
          // because it drives the wallet debit direction.
          if (suggestion.strength !== 'AUTO_FILL' || suggestion.type !== row.type) return row;
          return { ...row, categoryId: suggestion.categoryId };
        }),
      };
    });

    setRowSuggestions(result.suggestions);

    // Only an answer of the row's own type is applied or offered (ADR 0085),
    // so only those are counted.
    const rowTypes = new Map(importPreview.rows.map((r) => [r.rowIndex, r.type]));
    const fitting = Array.from(result.suggestions).filter(([rowIndex, s]) => s.type === rowTypes.get(rowIndex));
    const autoFilled = fitting.filter(([, s]) => s.strength === 'AUTO_FILL').length;
    const note =
      `Classified ${fitting.length} of ${uncategorizedRows.length}: ${autoFilled} applied, ` +
      `${fitting.length - autoFilled} to confirm. ${result.attempted} request${result.attempted === 1 ? '' : 's'} sent.` +
      // ADR 0052: the rate limit asked for longer than the importer waits.
      (result.rateLimited ? ' Stopped early: the rate limit asked for a wait of over a minute, so the rest stay blank.' : '');
    setClassifyNote(note);
    // Every finished run reads out its note, with its counts (ADR 0055; ADR
    // 0054 did this only after a pause). It also closes a pause whose resume
    // landed in the same render as the finish, which WebKit showed can happen.
    setAnnouncement(note);
  };

  /** A manual pick, or accepting a mid-confidence suggestion. Always wins. */
  const setRowCategory = (rowIndex: number, categoryId: string) => {
    setImportPreview((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((row) =>
              row.rowIndex === rowIndex ? { ...row, categoryId: categoryId || undefined } : row
            ),
          }
        : prev
    );
  };

  // Handle Commit Import (Step 2). Signed in, `commitBulkImport` commits the
  // whole preview in one database transaction (ADR 0023); only its fallback
  // for an unmigrated project inserts first and compensates (ADR 0022).
  const handleCommitImport = async () => {
    if (!importPreview || importPreview.validRowsCount === 0) return;
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    setIsCommittingImport(true);
    setImportCommitError(null);

    try {
      const validRows = importPreview.rows.filter((r) => r.isValid);
      const result = await commitBulkImport(validRows, importKeyRef.current ?? undefined);

      if (!result.success) {
        // Keep the preview open and populated so the user can retry.
        setImportCommitError(result.error || 'The import could not be saved.');
        return;
      }

      const skippedNote = result.skippedCount > 0
        ? ` ${result.skippedCount} row${result.skippedCount === 1 ? '' : 's'} skipped (unknown or deleted wallet).`
        : '';
      setImportPreview(null);
      resetClassification();
      flashImportSuccess(
        `Successfully imported ${result.insertedCount} transactions (${formatCurrencyAmount(result.totalAmount)})!${skippedNote}`,
        2000,
        onClose
      );
    } finally {
      commitInFlightRef.current = false;
      setIsCommittingImport(false);
    }
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sampleCsv = `Date,Wallet,Category,Type,Amount,Description,DestinationWallet\n${todayIsoDate()},Chase Checking,Food & Dining,EXPENSE,35.50,Lunch with team,\n${todayIsoDate()},Chase Checking,Salary,INCOME,3200.00,Monthly Paycheck,\n${todayIsoDate()},Chase Checking,,TRANSFER,500.00,Savings Deposit,Marcus High-Yield Savings`;
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setImportPreview(null);
        setImportCommitError(null);
        // Aborts a run still in flight - closing the modal must not leave
        // requests walking a list nobody is looking at any more.
        resetClassification();
      }}
      title="Two-Step CSV Transaction Import"
      subtitle="Step 1: check the rows. Step 2: import them."
      maxWidthClassName="max-w-3xl"
      bodyClassName="space-y-6"
    >
      {/* Step 1: Upload File */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-fg-secondary">
            Select CSV File
          </label>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="text-xs text-brand hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" /> Download Sample CSV Template
          </button>
        </div>

        <input
          id="csv-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvFileUpload}
          className="w-full text-xs text-fg-secondary file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-fill file:text-white hover:file:bg-brand-fill-hover cursor-pointer border border-line-input bg-surface-2 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-focus"
        />

        {isParsingCsv && (
          <p role="status" className="text-xs text-fg-secondary">Checking rows...</p>
        )}

        {importFileError && (
          <div className="p-3 rounded-lg bg-expense-tint border border-expense-line text-expense text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{importFileError}</span>
          </div>
        )}

        {importSuccessMsg && (
          <div className="p-3 rounded-lg bg-income-tint border border-income-line text-income text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Dry Run Preview Summary & Table */}
      {importPreview && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-4 gap-3 bg-surface-2 p-3 rounded-lg border border-line text-xs">
            <div>
              <span className="text-fg-secondary block">Total Rows</span>
              <span className="font-bold text-fg text-sm">{importPreview.totalRows}</span>
            </div>
            <div>
              <span className="text-fg-secondary block">Valid Rows</span>
              <span className="font-bold text-income text-sm">{importPreview.validRowsCount}</span>
            </div>
            <div>
              <span className="text-fg-secondary block">Errors / Invalid</span>
              <span className="font-bold text-expense text-sm">{importPreview.invalidRowsCount}</span>
            </div>
            <div>
              <span className="text-fg-secondary block">Total Amount</span>
              <span className="font-bold text-fg text-sm">{formatCurrencyAmount(importPreview.totalAmount)}</span>
            </div>
          </div>

          {/*
            The importer's two categorization layers (ADR 0019). Layer 1 has
            already run by the time this renders - it is synchronous and
            free. Layer 2 is behind this button on purpose: nothing touches
            the network or spends TypeSafe credits until it is pressed,
            which is also how you skip it when offline or in a hurry.
          */}
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
            {/*
              Mounted, empty, with the preview, so the first change is already
              to a live region (ADR 0054). Visually hidden: everything in it
              is also on screen, as the countdown or the note.
            */}
            <p
              data-testid="csv-classify-announcer"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {announcement}
            </p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-fg-secondary">
                <strong className="font-bold text-fg">{ruleMatchedCount}</strong>{' '}
                matched by rules &middot;{' '}
                <strong className="font-bold text-fg">{uncategorizedRows.length}</strong>{' '}
                uncategorized
              </span>

              {uncategorizedRows.length > 0 && !classifyProgress && (
                <Button id="csv-classify-btn" onClick={handleClassifyRemaining} icon={<Tags className="w-3.5 h-3.5" />}>
                  Classify remaining with Jev
                </Button>
              )}

              {classifyProgress && (
                <Button
                  id="csv-classify-cancel-btn"
                  variant="secondary"
                  onClick={() => {
                    classifyAbortRef.current?.abort();
                    // A cancelled run applies nothing (`handleClassifyRemaining` returns first).
                    setAnnouncement('Classification cancelled. No categories were filled in.');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>

            {classifyProgress && (
              <div data-testid="csv-classify-progress" className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-fg-secondary">
                  Classifying {classifyProgress.done} of {classifyProgress.total} with Jev
                  {waitSeconds === null ? (
                    <>&hellip;</>
                  ) : (
                    <span data-testid="csv-classify-wait">. Rate limit reached, continuing in {waitSeconds} s.</span>
                  )}
                </span>
                <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full bg-brand-fill transition-all"
                    style={{
                      width: `${classifyProgress.total > 0 ? (classifyProgress.done / classifyProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {classifyNote && !classifyProgress && (
              <p data-testid="csv-classify-note" className="text-[11px] font-medium text-fg-secondary">
                {classifyNote}
              </p>
            )}
          </div>

          {/* Dry Run Row Table */}
          <div className="max-h-60 overflow-y-auto rounded-lg border border-line text-xs">
            <table className="w-full text-left">
              {/* One of DESIGN.md's two blurs: rows scroll under this sticky header. */}
              <thead className="bg-surface-2/90 backdrop-blur-sm text-fg-secondary sticky top-0 font-semibold">
                <tr>
                  <th className="p-2">Row</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Wallet</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Description / Error</th>
                  <th className="p-2">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {importPreview.rows.slice(0, CSV_PREVIEW_ROW_CAP).map((row) => (
                  <tr key={row.rowIndex} className={row.isValid ? 'bg-surface-1' : 'bg-expense-tint'}>
                    <td className="p-2 text-fg-secondary">{row.rowIndex}</td>
                    <td className="p-2">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-income font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-expense font-semibold text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-fg-secondary">{row.date}</td>
                    <td className="p-2 text-fg-secondary">{row.walletName}</td>
                    <td className="p-2 font-bold text-fg">{formatCurrencyAmount(row.amount)}</td>
                    <td className="p-2">
                      {row.isValid ? (
                        <span className="text-fg-secondary">{row.description}</span>
                      ) : (
                        <span className="text-expense font-medium">{row.errorMessage}</span>
                      )}
                    </td>
                    {/*
                      The override channel. A manual pick writes `categoryId`
                      directly and always wins - neither layer ever revisits a
                      row, and `commitBulkImport` prefers the id it finds here.
                    */}
                    <td className="p-2">
                      {row.isValid ? (
                        <div className="flex flex-col gap-1">
                          <select
                            data-testid={`csv-row-category-${row.rowIndex}`}
                            value={row.categoryId || ''}
                            onChange={(e) => setRowCategory(row.rowIndex, e.target.value)}
                            className="w-full max-w-[10rem] text-xs rounded-lg border border-line-input bg-surface-2 px-1.5 py-1 text-fg focus:outline-none focus:ring-2 focus:ring-focus cursor-pointer"
                          >
                            <option value="" className={OPTION_CLASS}>
                              Uncategorized
                            </option>
                            {/* The row's own type only (ADR 0085): its type decides the
                                money's direction, so another type's category would be dropped. */}
                            {activeCategoriesForForm.filter((c) => c.type === row.type).map((c) => (
                              <option key={c.id} value={c.id} className={OPTION_CLASS}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          {(() => {
                            const suggestion = rowSuggestions.get(row.rowIndex);
                            // A category of another type is never offered (ADR 0085):
                            // the commit would drop it, so the click would do nothing.
                            if (!suggestion || suggestion.type !== row.type) return null;
                            // Applied: report it. Not applied (mid-confidence): offer
                            // it as one click.
                            if (row.categoryId === suggestion.categoryId) {
                              return (
                                <span
                                  data-testid={`csv-row-confidence-${row.rowIndex}`}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand"
                                >
                                  {Math.round(suggestion.confidence * 100)}%
                                </span>
                              );
                            }
                            return (
                              <button
                                type="button"
                                data-testid={`csv-row-confidence-${row.rowIndex}`}
                                onClick={() => setRowCategory(row.rowIndex, suggestion.categoryId)}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-fg-secondary underline underline-offset-2 hover:text-fg cursor-pointer text-left"
                              >
                                {suggestion.categoryName} ({Math.round(suggestion.confidence * 100)}%)
                              </button>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-fg-muted">No category</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {importPreview.rows.length > CSV_PREVIEW_ROW_CAP && (
                <tfoot>
                  <tr>
                    <td colSpan={7} className="p-2 text-center text-fg-secondary italic">
                      +{importPreview.rows.length - CSV_PREVIEW_ROW_CAP} more rows omitted from preview
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Same banner as the Step 1 file error, so the modal reads as one surface. */}
          {importCommitError && (
            <div
              id="import-commit-error"
              role="alert"
              className="p-3 rounded-lg bg-expense-tint border border-expense-line text-expense text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Import failed: {importCommitError}</span>
            </div>
          )}

          {/* Step 2 Confirmation Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-line">
            <p className="text-xs text-fg-secondary">
              Commit inserts every valid row, then updates wallet balances. If the insert fails, nothing changes.
            </p>
            <Button
              id="commit-import-btn"
              disabled={importPreview.validRowsCount === 0 || isCommittingImport}
              onClick={handleCommitImport}
              className="shrink-0"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              <span>
                {isCommittingImport ? 'Importing…' : `Confirm & Commit (${importPreview.validRowsCount} Rows)`}
              </span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
