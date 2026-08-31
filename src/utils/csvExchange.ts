import Papa from 'papaparse';
import { Transaction, Wallet, Category, DiaryEntry, ImportPreviewSummary, ImportRowValidation, TransactionType } from '../types';

export function exportTransactionsToCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[]
): void {
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const rows = transactions
    .filter((tx) => !tx.isDeleted)
    .map((tx) => ({
      Date: tx.transactionDate,
      Wallet: walletMap.get(tx.walletId) || 'Unknown Wallet',
      'Destination Wallet': tx.destinationWalletId ? walletMap.get(tx.destinationWalletId) || '' : '',
      Category: tx.categoryId ? categoryMap.get(tx.categoryId) || 'Uncategorized' : '',
      Type: tx.type,
      Amount: tx.amount.toFixed(2),
      Description: tx.description,
      'Raw Calculation': tx.rawInput || '',
      'Idempotency Key': tx.idempotencyKey || '',
    }));

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDiaryToJson(diaryEntries: DiaryEntry[]): void {
  const activeEntries = diaryEntries.filter((e) => !e.isDeleted);
  const avgMood =
    activeEntries.length > 0
      ? activeEntries.reduce((acc, curr) => acc + curr.mood, 0) / activeEntries.length
      : 0;
  const workoutCount = activeEntries.filter((e) => e.workout).length;
  const workoutRate = activeEntries.length > 0 ? (workoutCount / activeEntries.length) * 100 : 0;

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalEntries: activeEntries.length,
      averageMood: Math.round(avgMood * 100) / 100,
      workoutRatePercent: Math.round(workoutRate * 10) / 10,
    },
    entries: activeEntries,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `holistic_diary_export_${new Date().toISOString().slice(0, 10)}.json`);
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
  categories: Category[]
): Promise<ImportPreviewSummary> {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''),
      complete: (results) => {
        const walletMap = new Map(wallets.map((w) => [w.name.trim().toLowerCase(), w]));
        const categoryMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));

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
              parsedDate = d.toISOString().slice(0, 10);
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

          // Validate Amount
          const numAmount = parseFloat(rawAmount);
          if (isNaN(numAmount) || numAmount <= 0) {
            errors.push('Amount must be a positive number');
          }

          // Check category if provided
          if (rawCategory && !categoryMap.get(rawCategory.toLowerCase()) && parsedType !== 'TRANSFER') {
            // Soft warning, can still import as uncategorized or notify
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
