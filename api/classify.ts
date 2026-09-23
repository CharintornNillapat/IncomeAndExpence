import type { ClassifyCandidate, ClassifyRequest, ClassifyResponse } from '../src/types.ts';

/**
 * Jev classification proxy.
 *
 * This exists because the browser *cannot* call TypeSafe directly, not merely
 * because it shouldn't: an `OPTIONS` preflight to
 * `https://api.typesafe.ai/v1/systemone` with `Origin: http://localhost:3000`
 * returns `400 - Disallowed CORS origin`. Keeping `TYPESAFE_API_KEY` out of the
 * client bundle is a second, independent reason. See ADR 0011.
 *
 * Vercel zero-config: the project is `framework: "vite"` on Node 24.x, so a root
 * `api/` directory is served as functions with no `vercel.json`. The
 * web-standard `(Request) => Response` handler signature is used so that no
 * `@vercel/node` dependency is needed.
 *
 * SECURITY: the client sends only free text plus candidate labels. The question
 * wording lives here and is never client-supplied. If a caller could pass
 * `instructions`/`criteria`/`model`/`state`, this endpoint would be an open
 * relay for arbitrary Jev prompts billed to this project's key.
 *
 * Never log `text` - it is ledger content.
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const UPSTREAM_TIMEOUT_MS = 8000;

/** Matches `TransactionSchema`'s description bound in `src/utils/zodSchemas.ts`. */
const MAX_TEXT_LENGTH = 255;
const MAX_CATEGORIES = 60;
const MAX_CATEGORY_NAME_LENGTH = 60;
const MAX_CATEGORY_ID_LENGTH = 64;

/** Keys that would let a caller rewrite the question. Presence is a hard reject. */
const FORBIDDEN_KEYS = ['instructions', 'criteria', 'model', 'state', 'questions'];

const CATEGORY_INSTRUCTIONS =
  'This is a short note a person wrote to describe one personal-finance transaction in their own ledger. ' +
  'It may be in Thai or English, may be an abbreviation, a merchant name, or a few words. ' +
  'Which of these categories does the transaction belong to? ' +
  'Choose "other" only when none of the listed categories genuinely fit.';

const TYPE_INSTRUCTIONS =
  'This is a short note a person wrote to describe one personal-finance transaction in their own ledger. ' +
  'It may be in Thai or English. Does it describe money the person spent, or money they received?';

const TYPE_CRITERIA = {
  EXPENSE: 'Money going out: a purchase, a bill, a payment, a fee, anything the person spent.',
  INCOME: 'Money coming in: salary, a refund, a gift received, a sale, freelance payment.',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Returns the validated payload, or an error string. Deliberately strict: an
 * unexpected shape is rejected rather than coerced, because every accepted
 * request spends the project's TypeSafe credits.
 */
function validate(body: unknown): { text: string; categories: ClassifyCandidate[] } | string {
  if (!isPlainObject(body)) return 'Body must be a JSON object.';

  for (const key of FORBIDDEN_KEYS) {
    if (key in body) return `Field "${key}" is not accepted; question wording is server-owned.`;
  }

  const { text, categories } = body as Partial<ClassifyRequest>;

  if (typeof text !== 'string') return 'Field "text" must be a string.';
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Field "text" must not be empty.';
  if (trimmed.length > MAX_TEXT_LENGTH) return `Field "text" exceeds ${MAX_TEXT_LENGTH} characters.`;

  if (!Array.isArray(categories)) return 'Field "categories" must be an array.';
  if (categories.length === 0) return 'Field "categories" must not be empty.';
  if (categories.length > MAX_CATEGORIES) return `At most ${MAX_CATEGORIES} categories are accepted.`;

  const clean: ClassifyCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of categories) {
    if (!isPlainObject(candidate)) return 'Each category must be an object.';
    const { id, name } = candidate as Partial<ClassifyCandidate>;
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_CATEGORY_ID_LENGTH) {
      return 'Each category needs a non-empty "id" string.';
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_CATEGORY_NAME_LENGTH) {
      return 'Each category needs a non-empty "name" string.';
    }
    // A duplicate id would silently collapse two options into one criteria key.
    if (seen.has(id)) return 'Category ids must be unique.';
    seen.add(id);
    clean.push({ id, name: name.trim() });
  }

  return { text: trimmed, categories: clean };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    // 404, not 500: an unconfigured deployment should look exactly like a
    // missing endpoint so the client trips the same availability latch and
    // falls back to keyword rules silently. See ADR 0011.
    return json({ error: 'Classification is not configured.' }, 404);
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
  const { text, categories } = validated;

  // Category ids are `cat-*` locally and uuids in Supabase, so a literal
  // "other" id cannot occur - but a collision would silently swallow the escape
  // option, so pick a sentinel that cannot collide rather than assuming.
  const otherKey = categories.some((c) => c.id === 'other') ? '__other__' : 'other';

  const categoryCriteria: Record<string, string> = {};
  for (const candidate of categories) {
    categoryCriteria[candidate.id] = candidate.name;
  }
  categoryCriteria[otherKey] = 'None of the listed categories genuinely fit this note.';

  let upstream: Response;
  try {
    upstream = await fetch(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // A bare string, matching the probes that produced the measured
        // confidences in ADR 0011. The "what is this text" framing lives in
        // the instructions, so there is nothing to name here.
        state: text,
        model: MODEL,
        // Independent questions over the same state go in ONE request - they
        // run in parallel upstream and cost one round-trip, not two.
        questions: {
          category: { type: 'choice', instructions: CATEGORY_INSTRUCTIONS, criteria: categoryCriteria },
          txtype: { type: 'choice', instructions: TYPE_INSTRUCTIONS, criteria: TYPE_CRITERIA },
        },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Timeout or network failure. The client treats any non-200 as "no
    // suggestion", so the status here only matters for log triage.
    return json({ error: 'Classification upstream unavailable.' }, 503);
  }

  if (!upstream.ok) {
    // 429 (rate limited) and 529 (overloaded) are transient; 401 means this
    // deployment's key is wrong. None of that is actionable by the browser, and
    // the upstream body may echo request content, so nothing is forwarded.
    console.error('[classify] upstream returned', upstream.status);
    return json({ error: 'Classification upstream error.' }, upstream.status === 401 ? 502 : 503);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: 'Classification upstream returned malformed JSON.' }, 502);
  }

  const answers = isPlainObject(payload) && isPlainObject(payload.answers) ? payload.answers : null;
  const category = answers && isPlainObject(answers.category) ? answers.category : null;
  const txtype = answers && isPlainObject(answers.txtype) ? answers.txtype : null;

  if (!category || !txtype) {
    return json({ error: 'Classification upstream returned an unexpected shape.' }, 502);
  }

  const chosen = typeof category.choice === 'string' ? category.choice : otherKey;
  const detectedType = txtype.choice === 'INCOME' ? 'INCOME' : 'EXPENSE';

  const response: ClassifyResponse = {
    categoryId: chosen === otherKey ? null : chosen,
    categoryConfidence: typeof category.confidence === 'number' ? category.confidence : 0,
    detectedType,
    typeConfidence: typeof txtype.confidence === 'number' ? txtype.confidence : 0,
  };

  return json(response, 200);
}
