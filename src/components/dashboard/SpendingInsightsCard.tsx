import React, { useState } from 'react';
import { ChartLine, RefreshCw, ChevronDown, ChevronUp, WifiOff, LogIn } from 'lucide-react';
import type { Category, Transaction } from '../../types';
import { buildSpendingSummary, hasEnoughData, renderInsight } from '../../utils/spendingSummary';
import { fetchInsight, readCachedVerdict } from '../../utils/insightsClient';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { formatMonthName, shiftIsoDate } from '../../utils/date';

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
 * Since Phase 57 it sits full width under the Dashboard's rows, on the same
 * card shell as the cards around it, titled with the two months it compares.
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
  // A guest's summary is always local (ADR 0088), and says so differently.
  const [signInNeeded, setSignInNeeded] = useState(false);
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
    setSignInNeeded(result.signInNeeded === true);
    setIsGenerating(false);
  };

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    writeCollapsed(next);
  };

  // Phase 57 (ADR 0030): the card keeps its own calendar-month comparison
  // (ADR 0020) and names it, so it never claims the Dashboard's period.
  const period = `${formatMonthName(summary.month)} vs ${formatMonthName(shiftIsoDate(`${summary.month}-01`, -1).slice(0, 7))}`;

  return (
    <div data-testid="insights-card" className="bg-surface-1 rounded-card border border-line p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 pt-0.5">
          {/* Audit 005 finding 1: a line chart names what the card compares (this
              month against last), where the sparkle only said a model was involved. */}
          <ChartLine aria-hidden="true" className="w-4 h-4 shrink-0 mt-1 text-fg-secondary" />
          <h2 className="text-base font-semibold text-fg">Spending insights · {period}</h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {lines && !isCollapsed && (
            <IconButton
              id="insights-refresh-btn"
              label="Refresh insights"
              onClick={generate}
              disabled={isGenerating}
              className="-my-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            </IconButton>
          )}
          <IconButton
            id="insights-collapse-btn"
            label={isCollapsed ? 'Expand insights' : 'Collapse insights'}
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            className="-my-2 -mr-2"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </IconButton>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4">
          {!enoughData ? (
            <p className="text-sm text-fg-muted text-center py-6">
              No spending recorded this month yet.
            </p>
          ) : isGenerating ? (
            // Skeleton rather than a spinner: it occupies the height the
            // sentences will, so the card below does not jump when they land.
            // Static since Phase 53b (DESIGN.md §4: skeletons do not pulse).
            <div data-testid="insights-skeleton" role="status" aria-label="Writing your summary" className="space-y-2.5 py-1">
              <div className="h-3 rounded-sm bg-surface-3 w-11/12" />
              <div className="h-3 rounded-sm bg-surface-3 w-full" />
              <div className="h-3 rounded-sm bg-surface-3 w-8/12" />
            </div>
          ) : lines ? (
            <div className="space-y-3">
              <div data-testid="insights-body" className="space-y-2">
                {lines.map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-fg-secondary">
                    {line}
                  </p>
                ))}
              </div>

              {!fromModel && signInNeeded && (
                <p
                  data-testid="insights-signin-note"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted"
                >
                  <LogIn className="w-3 h-3 shrink-0" />
                  Written on this device. Sign in for a summary from Jev.
                </p>
              )}
              {!fromModel && !signInNeeded && (
                <p
                  data-testid="insights-offline-note"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted"
                >
                  <WifiOff className="w-3 h-3 shrink-0" />
                  Offline summary, generated on this device.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-fg-secondary text-center">
                Summarize how this month compares with last.
              </p>
              <Button id="insights-generate-btn" onClick={generate} icon={<ChartLine aria-hidden="true" className="w-3.5 h-3.5" />}>
                Generate insights
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
