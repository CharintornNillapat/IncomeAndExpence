import Papa from 'papaparse';
import { todayIsoDate, toIsoDate } from './date';
import { Transaction, Wallet, Category, Debt, ImportPreviewSummary, ImportRowValidation, TransactionType } from '../types';

/**
 * The export's CSV text. Pure, so the column set is testable without a DOM
 * download. `Debt` (F8, ADR 0024) holds a repayment's debt name, which is what
 * lets an exported repayment re-import against the same debt.
 */
export function transactionsToCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[],
  debts: Debt[] = []
): string {
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const debtMap = new Map(debts.map((d) => [d.id, d.name]));

  const rows = transactions
    .filter((tx) => !tx.isDeleted)
    .map((tx) => ({
      Date: tx.transactionDate,
      Wallet: walletMap.get(tx.walletId) || 'Unknown Wallet',
      'Destination Wallet': tx.destinationWalletId ? walletMap.get(tx.destinationWalletId) || '' : '',
      Category: tx.categoryId ? categoryMap.get(tx.categoryId) || 'Uncategorized' : '',
      Debt: tx.type === 'DEBT_REPAYMENT' && tx.debtId ? debtMap.get(tx.debtId) || '' : '',
      Type: tx.type,
      Amount: tx.amount.toFixed(2),
      Description: tx.description,
      'Raw Calculation': tx.rawInput || '',
      'Idempotency Key': tx.idempotencyKey || '',
    }));

  return Papa.unparse(rows);
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[],
  debts: Debt[] = []
): void {
  const csv = transactionsToCsv(transactions, wallets, categories, debts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `transactions_export_${todayIsoDate()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Step 1: Parses CSV and runs dry-run validations
 */
export function parseAndValidateTransactionCsv(
  fileContent: string,
  wallets: Wallet[],
  debts: Debt[] = []
): Promise<ImportPreviewSummary> {
  // F8: only live debts can be paid. Grouped by lower-cased name so an
  // ambiguous name is refused rather than guessed.
  const liveDebtsByName = new Map<string, Debt[]>();
  for (const d of debts) {
    if (d.isDeleted) continue;
    const key = d.name.trim().toLowerCase();
    liveDebtsByName.set(key, [...(liveDebtsByName.get(key) ?? []), d]);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''),
      complete: (results) => {
        const walletMap = new Map(wallets.map((w) => [w.name.trim().toLowerCase(), w]));

        const validationRows: ImportRowValidation[] = [];
        let validCount = 0;
        let invalidCount = 0;
        let totalAmount = 0;

        const dataRows = results.data as Array<Record<string, string>>;

        dataRows.forEach((row, idx) => {
          const rowIndex = idx + 2; // account for header
          const rawDate = (row['date'] || row['transactiondate'] || '').trim();
          const rawWallet = (row['wallet'] || row['walletname'] || row['sourcewallet'] || '').trim();
          const rawDestWallet = (row['destinationwallet'] || row['towallet'] || '').trim();
          const rawCategory = (row['category'] || row['categoryname'] || '').trim();
          const rawType = (row['type'] || row['transactiontype'] || 'EXPENSE').trim().toUpperCase();
          const rawAmount = (row['amount'] || '0').replace(/[^0-9.-]+/g, '');
          const description = (row['description'] || row['note'] || 'Imported Transaction').trim();
          const rawDebt = (row['debt'] || row['debtname'] || '').trim();

          const errors: string[] = [];

          // Validate Date (YYYY-MM-DD or standard parseable)
          let parsedDate = rawDate;
          if (!rawDate) {
            errors.push('Missing date');
          } else {
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) {
              errors.push('Invalid date format');
            } else {
              // Read back the local calendar day. `new Date(...)` parses a bare
              // ISO date as UTC midnight but a locale format like `09/10/2026`
              // as local midnight; in UTC+7 taking the local components is
              // correct for both, whereas `toISOString` shifts the latter back
              // a day.
              parsedDate = toIsoDate(d);
            }
          }

          // Validate Wallet
          const foundWallet = walletMap.get(rawWallet.toLowerCase());
          if (!rawWallet) {
            errors.push('Missing wallet column');
          } else if (!foundWallet) {
            errors.push(`Wallet '${rawWallet}' not found`);
          }

          // Validate Type
          const validTypes: TransactionType[] = ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_REPAYMENT'];
          const parsedType = (validTypes.includes(rawType as TransactionType) ? rawType : 'EXPENSE') as TransactionType;

          // Validate Transfer destination wallet
          if (parsedType === 'TRANSFER') {
            if (!rawDestWallet) {
              errors.push('Transfer requires destination wallet');
            } else if (!walletMap.get(rawDestWallet.toLowerCase())) {
              errors.push(`Destination wallet '${rawDestWallet}' not found`);
            }
          }

          // F8 (ADR 0024): a repayment must name exactly one live debt. Without
          // one it would debit the wallet and pay nothing off. The column is
          // ignored on every other type.
          let resolvedDebtId: string | undefined;
          if (parsedType === 'DEBT_REPAYMENT') {
            const matches = rawDebt ? liveDebtsByName.get(rawDebt.toLowerCase()) ?? [] : [];
            if (!rawDebt) {
              errors.push('Debt repayment needs a Debt column naming a debt');
            } else if (matches.length === 0) {
              errors.push(`Debt '${rawDebt}' not found`);
            } else if (matches.length > 1) {
              errors.push(`Debt name '${rawDebt}' is ambiguous`);
            } else {
              resolvedDebtId = matches[0].id;
            }
          }

          // Validate Amount. An ADJUSTMENT is the signed correction (ADR 0024):
          // any non-zero amount; every other type must be positive.
          const numAmount = parseFloat(rawAmount);
          if (isNaN(numAmount)) {
            errors.push('Amount must be a positive number');
          } else if (parsedType === 'ADJUSTMENT') {
            if (numAmount === 0) errors.push('An adjustment must not be zero');
          } else if (numAmount <= 0) {
            errors.push('Amount must be a positive number');
          }

          const isValid = errors.length === 0;
          if (isValid) {
            validCount++;
            totalAmount += Math.round(numAmount * 100) / 100;
          } else {
            invalidCount++;
          }

          validationRows.push({
            rowIndex,
            date: parsedDate,
            walletName: rawWallet,
            destinationWalletName: rawDestWallet || undefined,
            categoryName: rawCategory || undefined,
            debtName: resolvedDebtId ? rawDebt : undefined,
            debtId: resolvedDebtId,
            amount: isNaN(numAmount) ? 0 : Math.round(numAmount * 100) / 100,
            type: parsedType,
            description,
            isValid,
            errorMessage: errors.join(', '),
          });
        });

        resolve({
          previewId: `preview-${Date.now()}`,
          totalRows: dataRows.length,
          validRowsCount: validCount,
          invalidRowsCount: invalidCount,
          totalAmount: Math.round(totalAmount * 100) / 100,
          rows: validationRows,
        });
      },
      error: (err) => reject(err),
    });
  });
}
