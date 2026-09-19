import { Category, KeywordRule, TransactionType } from '../types';
import { buildLookupMap } from './mapUtils';

export interface SmartMatchResult {
  categoryId?: string;
  categoryName?: string;
  type?: TransactionType;
  extractedAmount?: number;
  cleanDescription: string;
}

/**
 * Parses user input like "500 buy new shirt" or "coffee with team"
 * Extracts numbers and matches configurable keyword rules without hardcoding.
 */
export function matchSmartDescription(
  inputText: string,
  keywordRules: KeywordRule[],
  categories: Category[]
): SmartMatchResult {
  const trimmed = inputText.trim();
  if (!trimmed) {
    return { cleanDescription: '' };
  }

  const categoryMap = buildLookupMap(categories);

  // Check for leading amount e.g. "500 coffee" or "25.50 lunch"
  let extractedAmount: number | undefined = undefined;
  let textToMatch = trimmed;

  const leadingAmountMatch = trimmed.match(/^([\d.,]+)\s+(.+)$/);
  if (leadingAmountMatch) {
    const rawNum = leadingAmountMatch[1].replace(/,/g, '');
    const parsed = parseFloat(rawNum);
    if (!isNaN(parsed) && parsed > 0) {
      extractedAmount = parsed;
      textToMatch = leadingAmountMatch[2];
    }
  }

  const lower = textToMatch.toLowerCase();

  // Find matching keyword rule from configurable rules list
  let matchedCategoryId: string | undefined = undefined;
  let matchedType: TransactionType | undefined = undefined;

  for (const rule of keywordRules) {
    const kw = rule.keyword.trim().toLowerCase();
    if (kw && lower.includes(kw)) {
      const cat = categoryMap.get(rule.categoryId);
      if (cat) {
        matchedCategoryId = cat.id;
        matchedType = cat.type;
        break;
      }
    }
  }

  const matchedCat = matchedCategoryId ? categoryMap.get(matchedCategoryId) : undefined;

  return {
    categoryId: matchedCategoryId,
    categoryName: matchedCat?.name,
    type: matchedType,
    extractedAmount,
    cleanDescription: textToMatch,
  };
}
