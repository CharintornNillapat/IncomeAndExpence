import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Tag } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { matchSmartDescription } from '../utils/smartMatcher';
import { formatCurrencyAmount } from '../utils/currency';

export const KeywordRulesView: React.FC = () => {
  const { keywordRules, categories, addKeywordRule, deleteKeywordRule } = useFinance();

  const [keyword, setKeyword] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Sandbox Test
  const [testInput, setTestInput] = useState<string>('500 buy new shirt');

  const matchResult = matchSmartDescription(testInput, keywordRules, categories);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError(null);

    const res = await addKeywordRule(keyword, selectedCategoryId);

    // Keep the typed keyword when the rule is rejected.
    if (!res.success) {
      setRuleError(res.error || 'Failed to save keyword rule');
      return;
    }

    setKeyword('');
  };

  const categoryMap = new Map<string, typeof categories[0]>(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Auto-Categorization Rules</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Set up keywords to automatically assign categories to matching transactions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Add Rule + Live Test Sandbox (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add Rule Form */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
              <Plus className="w-4 h-4 text-stone-700 dark:text-stone-300" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">Add Keyword Rule</h3>
            </div>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                  Trigger Keyword / Phrase *
                </label>
                <input
                  id="new-keyword-input"
                  type="text"
                  required
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g., starbucks, netflix, gas, groceries"
                  className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
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
                <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs font-medium">
                  {ruleError}
                </div>
              )}

              <button
                id="save-keyword-rule-btn"
                type="submit"
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer"
              >
                Add Rule
              </button>
            </form>
          </div>

          {/* Smart Parser Live Sandbox */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs space-y-4">
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
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Extracted Amount:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {matchResult.extractedAmount ? formatCurrencyAmount(matchResult.extractedAmount) : 'None detected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Matched Category:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {matchResult.categoryName || 'No keyword matched'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Inferred Type:</span>
                <span className="font-mono text-stone-800 dark:text-stone-200">{matchResult.type || 'EXPENSE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Cleaned Description:</span>
                <span className="text-stone-800 dark:text-stone-200 font-medium">"{matchResult.cleanDescription}"</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Configured Rules Table (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs space-y-4">
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
        </div>
      </div>
    </div>
  );
};
