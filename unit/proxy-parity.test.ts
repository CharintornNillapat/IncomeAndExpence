import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * The two proxies' shared code stays the same in both files (ADR 0065).
 *
 * `api/classify.ts` and `api/insights.ts` each carry their own copy of the
 * caller check, the token check, the count and the helpers they use, on
 * purpose: a shared module would be the functions' first runtime import, which
 * nothing local can prove Vercel resolves (ADR 0032, 0064). The cost is two
 * copies to keep in step, and this file is what keeps them so.
 *
 * Each top-level declaration is compared as code: printed back from its syntax
 * tree without comments, so a comment or a line break may differ and a
 * changed token, branch or constant may not.
 */

interface Proxy {
  declarations: Map<string, string>;
  statements: string[];
}

const printer = ts.createPrinter({ removeComments: true });

function read(path: string): Proxy {
  const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const code = (node: ts.Node) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  const declarations = new Map<string, string>();
  const statements: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) declarations.set(declaration.name.getText(source), code(statement));
    } else if (
      ts.isFunctionDeclaration(statement) || ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)
    ) {
      declarations.set(statement.name!.getText(source), code(statement));
    } else {
      statements.push(code(statement));
    }
  }
  return { declarations, statements };
}

const classify = read('api/classify.ts');
const insights = read('api/insights.ts');

/** What a signed-in request goes through before either proxy's own work. */
const SHARED = [
  // Responses and request parsing the checks use.
  'json', 'isPlainObject', 'FORBIDDEN_KEYS', 'MAX_CATEGORIES', 'MAX_CATEGORY_NAME_LENGTH',
  // Server-Timing (ADR 0050).
  'Timings', 'timed', 'serverTimingHeader',
  // The caller and token check (ADR 0032, 0064) and the key set prefetch (ADR 0065).
  'KEYS_TIMEOUT_MS', 'KEYS_TTL_MS', 'KEYS_REFRESH_MIN_MS', 'UUID', 'ALGORITHMS', 'Algorithm', 'SigningKey',
  'signingKeys', 'keysInFlight', 'issuerFor', 'Caller', 'base64url', 'jsonPart', 'fetchSigningKeys',
  'fetchSigningKeysOnce', 'currentSigningKeys', 'prefetchSigningKeys', 'verifyToken', 'checkCaller',
  // The per-account count (ADR 0049).
  'AI_REQUESTS_PER_MINUTE', 'QUOTA_TIMEOUT_MS', 'checkQuota',
  // The entry point and TypeSafe's answer handling (ADR 0022, 0053).
  'POST', 'TYPESAFE_ENDPOINT', 'MODEL', 'UPSTREAM_TIMEOUT_MS', 'upstreamRetryAfter',
];

/** Declared in both, and different on purpose: each proxy's own request and question. */
const OWN = ['handle', 'validate'];

describe('the proxies share their checks as identical code', () => {
  it.each(SHARED)('%s is the same code in both proxies', (name) => {
    expect(classify.declarations.has(name), `api/classify.ts declares ${name}`).toBe(true);
    expect(insights.declarations.has(name), `api/insights.ts declares ${name}`).toBe(true);
    expect(insights.declarations.get(name)).toBe(classify.declarations.get(name));
  });

  it('starts the key set fetch when each proxy loads', () => {
    expect(classify.statements).toContain('prefetchSigningKeys();');
    expect(insights.statements).toContain('prefetchSigningKeys();');
  });

  it('has no top-level statement but the prefetch outside a declaration', () => {
    expect(classify.statements).toEqual(['prefetchSigningKeys();']);
    expect(insights.statements).toEqual(['prefetchSigningKeys();']);
  });

  it('differs only where a proxy does its own work, for every name both declare', () => {
    const both = [...classify.declarations.keys()].filter((name) => insights.declarations.has(name));
    const differ = both.filter((name) => classify.declarations.get(name) !== insights.declarations.get(name));

    expect(differ.sort()).toEqual([...OWN].sort());
  });

  it('lists every shared name in SHARED or OWN, so a new one is a decision', () => {
    const both = [...classify.declarations.keys()].filter((name) => insights.declarations.has(name));

    expect(both.sort()).toEqual([...SHARED, ...OWN].sort());
  });
});
