import React, { useMemo, useState } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { useFinanceActions, useFinanceState } from '../../context/FinanceContext';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { matchSmartDescription } from '../../utils/smartMatcher';
import { formatCurrencyAmount } from '../../utils/currency';
import { buildLookupMap } from '../../utils/mapUtils';
import { isMovementCategory } from '../../selectors/ledger';
import { systemCategoryLabel } from '../../selectors/display';
import { ERROR_BANNER_CLASS, LABEL_CLASS, OPTION_CLASS, inputClass, selectClass } from '../../utils/formStyles';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { typeLabel } from './categoryLabels';

/**
 * The Categories page's Smart rules tab: the keyword-rule form, the sandbox
 * and the rules table, moved out of `CategoriesView` unchanged in behaviour.
 * Spec section 11 leaves this tab un-redesigned, so it only takes the shared
 * tokens and copy rules: types read as words (L10), headings in sentence case,
 * and no decorative heading icons. Every element id and `data-testid` that
 * `keywords.spec.ts` and `smart-rules.spec.ts` use is kept.
 */
export const SmartRulesPanel: React.FC = () => {
  const { categories, keywordRules } = useFinanceState();
  const { addKeywordRule, deleteKeywordRule } = useFinanceActions();

  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  const [keyword, setKeyword] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(activeCategories[0]?.id || '');
  const [testInput, setTestInput] = useState<string>('500 buy new shirt');

  const matchResult = useMemo(
    () => matchSmartDescription(testInput, keywordRules, categories),
    [testInput, keywordRules, categories]
  );

  const { error: ruleError, handleSubmit: submitKeywordRule } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save keyword rule',
    onSuccess: () => setKeyword(''),
  });

  const handleAddRule = (e: React.FormEvent) => submitKeywordRule(e, () => addKeywordRule(keyword, selectedCategoryId));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-5 flex flex-col gap-6">
        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-fg">Add a keyword rule</h2>

          <form onSubmit={handleAddRule} className="space-y-4">
            <div>
              <label htmlFor="new-keyword-input" className={LABEL_CLASS}>
                Keyword or phrase
              </label>
              <input
                id="new-keyword-input"
                type="text"
                required
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., starbucks, netflix, gas, groceries"
                className={inputClass('plain')}
              />
            </div>

            <div>
              <label htmlFor="keyword-category-select" className={LABEL_CLASS}>
                Category
              </label>
              <select
                id="keyword-category-select"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className={selectClass('plain')}
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id} className={OPTION_CLASS}>
                    {isMovementCategory(c) ? systemCategoryLabel(c) : `${c.name} (${typeLabel(c.type)})`}
                  </option>
                ))}
              </select>
            </div>

            {ruleError && <div className={ERROR_BANNER_CLASS}>{ruleError}</div>}

            <Button id="save-keyword-rule-btn" type="submit" block>
              Add rule
            </Button>
          </form>
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-fg">Try a note</h2>

          <div>
            <label htmlFor="test-parser-input" className={LABEL_CLASS}>
              Sample note
            </label>
            <input
              id="test-parser-input"
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="e.g. 500 buy new shirt or 45 uber to airport"
              className={inputClass('plain')}
            />
          </div>

          <div className="bg-surface-2 rounded-inner p-3.5 border border-line space-y-2 text-xs">
            <div className="flex justify-between gap-3" data-testid="metric-extracted-amount">
              <span className="text-fg-secondary">Amount</span>
              <span className="font-bold text-fg">
                {matchResult.extractedAmount ? formatCurrencyAmount(matchResult.extractedAmount) : 'None found'}
              </span>
            </div>
            <div className="flex justify-between gap-3" data-testid="metric-matched-category">
              <span className="text-fg-secondary">Category</span>
              <span className="font-semibold text-fg">{matchResult.categoryName || 'No keyword matched'}</span>
            </div>
            <div className="flex justify-between gap-3" data-testid="metric-inferred-type">
              <span className="text-fg-secondary">Type</span>
              <span className="text-fg">{typeLabel(matchResult.type || 'EXPENSE')}</span>
            </div>
            <div className="flex justify-between gap-3" data-testid="metric-cleaned-description">
              <span className="text-fg-secondary">Note without the amount</span>
              <span className="text-fg font-medium text-right break-words min-w-0">"{matchResult.cleanDescription}"</span>
            </div>
          </div>
        </Card>
      </div>

      <Card padding="lg" className="lg:col-span-7 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-fg">Keyword rules</h2>
          <span className="text-xs text-fg-muted">
            {keywordRules.length} {keywordRules.length === 1 ? 'rule' : 'rules'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-inner border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-fg-secondary uppercase tracking-wider font-semibold border-b border-line">
              <tr>
                <th className="py-3 px-4">Keyword</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keywordRules.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      icon={Tag}
                      title="No keyword rules yet"
                      subtitle="Add one to file matching notes under a category automatically"
                    />
                  </td>
                </tr>
              ) : (
                keywordRules.map((rule) => {
                  const cat = categoryMap.get(rule.categoryId);
                  return (
                    <tr key={rule.id} id={`rule-row-${rule.id}`} className="hover:bg-surface-2">
                      <td className="py-3 px-4 font-semibold text-fg break-words">"{rule.keyword}"</td>
                      <td className="py-3 px-4">
                        {cat ? (
                          <Chip label={isMovementCategory(cat) ? systemCategoryLabel(cat) : cat.name} color={cat.color} />
                        ) : (
                          <span className="text-fg-muted">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <IconButton label="Delete rule" tone="danger" onClick={() => deleteKeywordRule(rule.id)} className="-my-2">
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
