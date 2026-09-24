import React, { useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, WifiOff } from 'lucide-react';
import type { Category, Transaction } from '../../types';
import { buildSpendingSummary, hasEnoughData, renderInsight } from '../../utils/spendingSummary';
import { fetchInsight, readCachedVerdict } from '../../utils/insightsClient';

interface SpendingInsightsCardProps {
  transactions: Transaction[];
  categories: Category[];
  userId: string;
}

const COLLAPSE_KEY = 'pf_insights_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    // Private mode or blocked site data. The toggle still works for this
    // session; it just will not be remembered.
  }
}

/**
 * The monthly wrap-up (ADR 0020).
 *
 * Shell copied from `CategoryExpenseDistribution` so the two sit together as
 * siblings rather than as a card and a bolt-on.
 *
 * The model picks a pattern; the sentences are rendered here from the app's
 * own numbers, so nothing on this card can disagree with the distribution
 * beside it. When the verdict came from the local rule instead, that is
 * marked quietly - it is a different provenance, not a failure, and this card
 * has no error state by construction.
 */
export const SpendingInsightsCard: React.FC<SpendingInsightsCardProps> = ({
  transactions,
  categories,
  userId,
}) => {
  const summary = React.useMemo(
    () => buildSpendingSummary(transactions, categories),
    [transactions, categories]
  );

  // Seeded from the cache so a return visit within the same month shows the
  // wrap-up immediately, with no request and no button press.
  const [lines, setLines] = useState<string[] | null>(() => {
    const cached = readCachedVerdict(userId, summary.month);
    return cached ? renderInsight(summary, cached.verdict) : null;
  });
  const [fromModel, setFromModel] = useState<boolean>(
    () => readCachedVerdict(userId, summary.month)?.fromModel ?? false
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readCollapsed);

  const enoughData = hasEnoughData(summary);

  /*
   * The cache is read once, synchronously, in the `lines` initializer above -
   * that seed is what makes a warm month cost no request at all, since the
   * Generate button only renders while `lines` is null. So everything that
   * reaches here wants the network: a first generation, or a Refresh.
   */
  const generate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    // `fetchInsight` never throws and never rejects, so there is no catch
    // here and no error branch below - by design (ADR 0020).
    const result = await fetchInsight(summary, userId);
    setLines(renderInsight(summary, result.verdict));
    setFromModel(result.fromModel);
    setIsGenerating(false);
  };

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    writeCollapsed(next);
  };

  return (
    <div
      data-testid="insights-card"
      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs transition-colors"
    >
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0 text-stone-600 dark:text-stone-400" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate">Monthly Spending Insights</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {lines && !isCollapsed && (
            <button
              type="button"
              id="insights-refresh-btn"
              onClick={generate}
              disabled={isGenerating}
              aria-label="Refresh insights"
              title="Refresh insights"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:text-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            id="insights-collapse-btn"
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand insights' : 'Collapse insights'}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:text-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-5">
          {!enoughData ? (
            <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-8">
              No spending recorded this month yet.
            </p>
          ) : isGenerating ? (
            // Skeleton rather than a spinner: it occupies the height the
            // sentences will, so the card below does not jump when they land.
            <div data-testid="insights-skeleton" className="space-y-2.5 animate-pulse py-1">
              <div className="h-3 rounded bg-stone-200 dark:bg-stone-800 w-11/12" />
              <div className="h-3 rounded bg-stone-200 dark:bg-stone-800 w-full" />
              <div className="h-3 rounded bg-stone-200 dark:bg-stone-800 w-8/12" />
            </div>
          ) : lines ? (
            <div className="space-y-3">
              <div data-testid="insights-body" className="space-y-2">
                {lines.map((line, i) => (
                  <p key={i} className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                    {line}
                  </p>
                ))}
              </div>

              {!fromModel && (
                <p
                  data-testid="insights-offline-note"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-stone-400 dark:text-stone-500"
                >
                  <WifiOff className="w-3 h-3 shrink-0" />
                  Offline summary &mdash; generated on this device.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-xs text-stone-500 dark:text-stone-400 text-center">
                Summarize how this month compares with last.
              </p>
              <button
                type="button"
                id="insights-generate-btn"
                onClick={generate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate insights
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
