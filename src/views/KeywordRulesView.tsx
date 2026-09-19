import React, { useState, useMemo } from 'react';
import { Sparkles, Plus, Trash2, Tag } from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { matchSmartDescription } from '../utils/smartMatcher';
import { formatCurrencyAmount } from '../utils/currency';
import { buildLookupMap } from '../utils/mapUtils';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { LABEL_CLASS, inputClass, ERROR_BANNER_CLASS, PRIMARY_BUTTON_COMPACT_CLASS } from '../utils/formStyles';

export const KeywordRulesView: React.FC = () => {
  const { keywordRules, categories } = useFinanceState();
  const { addKeywordRule, deleteKeywordRule } = useFinanceActions();

  const [keyword, setKeyword] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');

  // Sandbox Test
  const [testInput, setTestInput] = useState<string>('500 buy new shirt');

  const matchResult = useMemo(
    () => matchSmartDescription(testInput, keywordRules, categories),
    [testInput, keywordRules, categories]
  );

  // Keeps the typed keyword when the rule is rejected.
  const { error: ruleError, handleSubmit: submitKeywordRule } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save keyword rule',
    onSuccess: () => setKeyword(''),
  });

  const handleAddRule = (e: React.FormEvent) =>
    submitKeywordRule(e, () => addKeywordRule(keyword, selectedCategoryId));

  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Auto-Categorization Rules"
        subtitle="Set up keywords to automatically assign categories to matching transactions"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Add Rule + Live Test Sandbox (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add Rule Form */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
              <Plus className="w-4 h-4 text-stone-700 dark:text-stone-300" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">Add Keyword Rule</h3>
            </div>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>
                  Trigger Keyword / Phrase *
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
                <label className={LABEL_CLASS}>
                  Assign to Category *
                </label>
                <select
                  id="keyword-category-select"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              {ruleError && (
                <div className={ERROR_BANNER_CLASS}>
                  {ruleError}
                </div>
              )}

              <button
                id="save-keyword-rule-btn"
                type="submit"
                className={PRIMARY_BUTTON_COMPACT_CLASS}
              >
                Add Rule
              </button>
            </form>
          </Card>

          {/* Smart Parser Live Sandbox */}
          <Card padding="lg" className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">Try Quick-Input Test</h3>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                Type sample text:
              </label>
              <input
                id="test-parser-input"
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="e.g. 500 buy new shirt or 45 uber to airport"
                className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              />
            </div>

            <div className="bg-stone-50 dark:bg-stone-800/80 rounded-xl p-3.5 border border-stone-100 dark:border-stone-700 space-y-2 text-xs">
              <div className="flex justify-between" data-testid="metric-extracted-amount">
                <span className="text-stone-500 dark:text-stone-400">Extracted Amount:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {matchResult.extractedAmount ? formatCurrencyAmount(matchResult.extractedAmount) : 'None detected'}
                </span>
              </div>
              <div className="flex justify-between" data-testid="metric-matched-category">
                <span className="text-stone-500 dark:text-stone-400">Matched Category:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {matchResult.categoryName || 'No keyword matched'}
                </span>
              </div>
              <div className="flex justify-between" data-testid="metric-inferred-type">
                <span className="text-stone-500 dark:text-stone-400">Inferred Type:</span>
                <span className="font-mono text-stone-800 dark:text-stone-200">{matchResult.type || 'EXPENSE'}</span>
              </div>
              <div className="flex justify-between" data-testid="metric-cleaned-description">
                <span className="text-stone-500 dark:text-stone-400">Cleaned Description:</span>
                <span className="text-stone-800 dark:text-stone-200 font-medium">"{matchResult.cleanDescription}"</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Configured Rules Table (7 cols) */}
        <Card padding="lg" className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">Configured Keyword Mappings</h3>
            </div>
            <span className="text-xs text-stone-400 dark:text-stone-500">{keywordRules.length} rules active</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-100 dark:border-stone-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-semibold border-b border-stone-200 dark:border-stone-800">
                <tr>
                  <th className="py-3 px-4">Keyword</th>
                  <th className="py-3 px-4">Mapped Category</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {keywordRules.map((rule) => {
                  const cat = categoryMap.get(rule.categoryId);
                  return (
                    <tr key={rule.id} id={`rule-row-${rule.id}`} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="py-3 px-4 font-mono font-semibold text-stone-900 dark:text-stone-100">
                        "{rule.keyword}"
                      </td>
                      <td className="py-3 px-4">
                        {cat ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
                            style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                          >
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-500">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => deleteKeywordRule(rule.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
