import type { InsightsRequest, InsightsResponse, SpendingSummary } from '../src/types.ts';

/**
 * Monthly spending-insight proxy (ADR 0020).
 *
 * A SIBLING of `api/classify.ts`, not an action on it. That endpoint's
 * validator is shaped tightly around `text` + `categories`; forking it to
 * carry a second, differently-shaped question would weaken exactly the thing
 * it exists to protect.
 *
 * It MUST be reached through a named method export (`export function POST`),
 * never `export default`. Vercel's Node runtime invokes a default export with
 * the legacy `(req, res) => void` signature and DISCARDS the returned
 * `Response`, so the request hangs until the gateway times out - 60s, zero
 * bytes, visible only in the deployment's runtime log. This already shipped
 * once on `classify` and had to be hot-fixed. `tsc` cannot see it and the
 * Playwright suite cannot either, because the suite mocks this endpoint.
 *
 * SECURITY: the client sends only an aggregate. The question wording lives
 * here and is never client-supplied - if a caller could pass
 * `instructions`/`criteria`/`model`/`state`/`questions`, this would be an open
 * relay for arbitrary Jev prompts billed to this project's key.
 *
 * PRIVACY: the body carries no transaction text, no ids, no wallet names and
 * no individual amounts - see `SpendingSummary` in `src/types.ts`. Nothing
 * here is logged.
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const UPSTREAM_TIMEOUT_MS = 8000;

const MAX_CATEGORIES = 60;
const MAX_CATEGORY_NAME_LENGTH = 60;

/** Keys that would let a caller rewrite the question. Presence is a hard reject. */
const FORBIDDEN_KEYS = ['instructions', 'criteria', 'model', 'state', 'questions'];

const PATTERN_INSTRUCTIONS =
  'This is an aggregated month of one person\'s personal spending, by category, with the previous ' +
  'month alongside it for comparison. No individual transactions are included. ' +
  'Which single pattern best describes this month?';

const PATTERN_CRITERIA: Record<string, string> = {
  CATEGORY_SPIKE:
    'One category rose sharply against last month and dominates the change. Choose this when a single category is the story.',
  IMPROVED_SAVING:
    'Total spending fell meaningfully against last month, with no single category driving it. Choose this when the month is simply cheaper.',
  NEW_RECURRING:
    'A category with no previous spending has appeared several times, suggesting a new regular cost rather than a one-off purchase.',
  STEADY:
    'Nothing moved unusually. Spending is broadly in line with last month. Choose this when none of the others genuinely fit.',
};

const FOCUS_INSTRUCTIONS =
  'Given the same aggregated month, which single spending category is most worth drawing the person\'s attention to? ' +
  'Choose "none" when the month is better described as a whole than by any one category.';

const NONE_KEY = 'none';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates the aggregate. Bounds exist so a caller cannot pad the criteria to
 * burn credits, and so a malformed summary produces a 400 rather than a
 * confusing upstream answer.
 */
function validate(body: unknown): SpendingSummary | string {
  if (!isPlainObject(body)) return 'Body must be a JSON object.';

  for (const key of FORBIDDEN_KEYS) {
    if (key in body) return `Field "${key}" is not accepted; question wording is server-owned.`;
  }

  const { summary } = body as Partial<InsightsRequest>;
  if (!isPlainObject(summary)) return 'Field "summary" is required.';

  if (typeof summary.month !== 'string' || !/^\d{4}-\d{2}$/.test(summary.month)) {
    return 'Field "summary.month" must be YYYY-MM.';
  }

  if (!Array.isArray(summary.categories)) return 'Field "summary.categories" must be an array.';
  if (summary.categories.length === 0) return 'Field "summary.categories" must not be empty.';
  if (summary.categories.length > MAX_CATEGORIES) return `At most ${MAX_CATEGORIES} categories.`;

  const seen = new Set<string>();
  for (const raw of summary.categories) {
    if (!isPlainObject(raw)) return 'Each category must be an object.';
    const { name, current, previous, txCount } = raw;
    if (typeof name !== 'string' || name.trim().length === 0) return 'Each category needs a name.';
    if (name.length > MAX_CATEGORY_NAME_LENGTH) return 'A category name is too long.';
    // A duplicate name would silently collapse two options into one criteria key.
    if (seen.has(name)) return 'Category names must be unique.';
    seen.add(name);
    if (!isFiniteNumber(current) || !isFiniteNumber(previous) || !isFiniteNumber(txCount)) {
      return 'Category totals must be finite numbers.';
    }
  }

  if (!isPlainObject(summary.totals)) return 'Field "summary.totals" is required.';
  const { income, expense, net, previousExpense } = summary.totals;
  if (
    !isFiniteNumber(income) ||
    !isFiniteNumber(expense) ||
    !isFiniteNumber(net) ||
    !isFiniteNumber(previousExpense)
  ) {
    return 'Totals must be finite numbers.';
  }

  return summary as unknown as SpendingSummary;
}

/** Renders the aggregate as the compact text Jev reasons over. No raw ledger content. */
function toState(summary: SpendingSummary): string {
  const lines = summary.categories.map((c) => {
    const delta =
      c.changePercent === null
        ? 'no prior month'
        : `${c.changePercent >= 0 ? '+' : ''}${Math.round(c.changePercent)}% vs last month`;
    return `- ${c.name}: ${c.current.toFixed(2)} this month (${c.previous.toFixed(2)} last month, ${delta}), ${c.txCount} transactions`;
  });

  return [
    `Month: ${summary.month}`,
    `Total spending: ${summary.totals.expense.toFixed(2)} (last month: ${summary.totals.previousExpense.toFixed(2)})`,
    `Total income: ${summary.totals.income.toFixed(2)}`,
    `Net: ${summary.totals.net.toFixed(2)}`,
    'By category:',
    ...lines,
  ].join('\n');
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    // 404, not 500: an unconfigured deployment must look exactly like a
    // missing endpoint so the client trips its availability latch and falls
    // back to the local pattern silently. Same reasoning as ADR 0011.
    return json({ error: 'Insights are not configured.' }, 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be valid JSON.' }, 400);
  }

  const validated = validate(body);
  if (typeof validated === 'string') {
    return json({ error: validated }, 400);
  }
  const summary = validated;

  // Category names are the option keys so the answer round-trips as a name the
  // client can match. A category literally called "none" would collide with
  // the escape option, so pick a sentinel that cannot.
  const noneKey = summary.categories.some((c) => c.name === NONE_KEY) ? '__none__' : NONE_KEY;

  const focusCriteria: Record<string, string> = {};
  for (const category of summary.categories) {
    focusCriteria[category.name] = `${category.name}: ${category.current.toFixed(2)} spent across ${category.txCount} transactions this month.`;
  }
  focusCriteria[noneKey] = 'No single category is the story; the month is better described as a whole.';

  let upstream: Response;
  try {
    upstream = await fetch(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: toState(summary),
        model: MODEL,
        // Both questions over the same state in ONE request - they run in
        // parallel upstream and cost one round-trip, not two.
        questions: {
          pattern: { type: 'choice', instructions: PATTERN_INSTRUCTIONS, criteria: PATTERN_CRITERIA },
          focus: { type: 'choice', instructions: FOCUS_INSTRUCTIONS, criteria: focusCriteria },
        },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: 'Insights upstream unavailable.' }, 503);
  }

  if (!upstream.ok) {
    // The upstream body may echo request content, so nothing is forwarded.
    console.error('[insights] upstream returned', upstream.status);
    return json({ error: 'Insights upstream error.' }, upstream.status === 401 ? 502 : 503);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: 'Insights upstream returned malformed JSON.' }, 502);
  }

  const answers = isPlainObject(payload) && isPlainObject(payload.answers) ? payload.answers : null;
  const pattern = answers && isPlainObject(answers.pattern) ? answers.pattern : null;
  const focus = answers && isPlainObject(answers.focus) ? answers.focus : null;

  if (!pattern || !focus) {
    return json({ error: 'Insights upstream returned an unexpected shape.' }, 502);
  }

  // An unrecognized choice degrades to STEADY rather than 502ing: the client
  // can always render STEADY, and a usable card beats an error.
  const chosenPattern =
    typeof pattern.choice === 'string' && pattern.choice in PATTERN_CRITERIA
      ? (pattern.choice as InsightsResponse['pattern'])
      : 'STEADY';

  const chosenFocus =
    typeof focus.choice === 'string' && focus.choice !== noneKey && focus.choice in focusCriteria
      ? focus.choice
      : null;

  const response: InsightsResponse = {
    pattern: chosenPattern,
    focus: chosenFocus,
    confidence: isFiniteNumber(pattern.confidence) ? pattern.confidence : 0,
  };

  return json(response, 200);
}
