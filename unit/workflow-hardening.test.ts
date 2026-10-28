import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * The CI workflows' supply-chain and token rules (Phase 91, ADR 0067).
 *
 * Read line by line, not parsed: the repository has no YAML parser and these
 * rules do not need one. Each holds for every file in .github/workflows/, so a
 * new workflow is held to them from its first commit.
 */

const DIR = new URL('../.github/workflows/', import.meta.url);
const WORKFLOWS = readdirSync(DIR).filter((file) => /\.ya?ml$/.test(file)).sort();
const read = (file: string) => readFileSync(new URL(file, DIR), 'utf8').replace(/\r\n/g, '\n');

/** Each job's lines, by job id: the block under `jobs:` at two spaces' indent. */
function jobs(text: string): Map<string, string[]> {
  const lines = text.split('\n');
  const start = lines.indexOf('jobs:');
  const result = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of lines.slice(start + 1)) {
    const id = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (id) {
      current = [];
      result.set(id[1], current);
    } else if (/^\S/.test(line)) {
      break;
    } else if (current) {
      current.push(line);
    }
  }
  return result;
}

/** An action pinned to a full commit, with the release it is in the comment. */
const PINNED = /^\s*(?:-\s+)?uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;

describe('.github/workflows', () => {
  it('has the two workflows these rules were written for', () => {
    expect(WORKFLOWS).toEqual(['playwright.yml', 'schema-drift.yml']);
  });

  describe.each(WORKFLOWS)('%s', (file) => {
    const text = read(file);
    const uses = text.split('\n').filter((line) => /^\s*(?:-\s+)?uses:/.test(line));

    it('pins every action to a 40-character commit, with its release as a comment', () => {
      expect(uses.length).toBeGreaterThan(0);
      expect(uses.filter((line) => !PINNED.test(line))).toEqual([]);
    });

    it('grants nothing at the top level', () => {
      expect(text).toMatch(/^permissions: \{\}$/m);
      expect(text.match(/^permissions:/gm)).toHaveLength(1);
    });

    it('gives every job exactly `contents: read`', () => {
      const all = jobs(text);
      expect(all.size).toBeGreaterThan(0);
      for (const [id, lines] of all) {
        const at = lines.indexOf('    permissions:');
        expect(at, `${id} declares permissions`).toBeGreaterThanOrEqual(0);
        // The lines nested under `permissions:`, up to the next key of the job.
        const granted: string[] = [];
        for (const line of lines.slice(at + 1)) {
          if (!/^ {6}\S/.test(line)) break;
          granted.push(line);
        }
        expect(granted, `${id}'s permissions`).toEqual(['      contents: read']);
      }
    });

    it('keeps the token out of .git/config at every checkout', () => {
      const checkouts = uses.filter((line) => line.includes('actions/checkout@')).length;
      expect(checkouts).toBeGreaterThan(0);
      expect(text.match(/^ {10}persist-credentials: false$/gm)?.length ?? 0).toBe(checkouts);
    });

    it('is never triggered by pull_request_target, which runs a fork\'s change with this repository\'s secrets', () => {
      expect(text).not.toMatch(/pull_request_target/);
    });
  });

  it('uses secrets only in the drift check, and only its two', () => {
    const used = WORKFLOWS.flatMap((file) =>
      [...read(file).matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => `${file}: ${m[1]}`));
    expect(used.sort()).toEqual(['schema-drift.yml: SUPABASE_DRIFT_DB_CA', 'schema-drift.yml: SUPABASE_DRIFT_DB_URL']);
  });
});

/**
 * Phase 154 (ADR 0111): the seven checks `main` requires, read from its branch
 * protection on 2026-10-28 (`gh api repos/{owner}/{repo}/branches/main/protection`).
 * A pull request that starts no run never reports them, so a docs-only one
 * waited for the owner's bypass. Renaming a job or changing the matrix changes
 * these names, and the branch protection must change with them.
 */
const REQUIRED = [
  'E2E (chromium 1/2)',
  'E2E (chromium 2/2)',
  'E2E (firefox 1/2)',
  'E2E (firefox 2/2)',
  'E2E (webkit 1/2)',
  'E2E (webkit 2/2)',
  'Type-check and unit tests',
];

/** The condition on every step of `checks` and `e2e`: `changes` found code. */
const WHEN_CODE = "needs.changes.outputs.code == 'true'";

/** A job's steps, each its lines from one `      - ` to the next. */
function steps(lines: string[]): string[][] {
  const result: string[][] = [];
  for (const line of lines) {
    if (/^ {6}- /.test(line)) result.push([line]);
    else result.at(-1)?.push(line);
  }
  return result;
}

describe('playwright.yml reports the required checks on every pull request (ADR 0111)', () => {
  const text = read('playwright.yml');
  const all = jobs(text);
  const job = (id: string) => all.get(id) ?? [];
  /** A job's own key at four spaces, e.g. `    needs: changes`. */
  const key = (id: string, name: string) => job(id).find((line) => line.startsWith(`    ${name}: `));

  it('has no paths filter on pull_request, so every pull request starts a run', () => {
    const lines = text.split('\n');
    const at = lines.indexOf('  pull_request:');
    expect(at).toBeGreaterThan(0);
    const block: string[] = [];
    for (const line of lines.slice(at + 1)) {
      if (!/^ {4}/.test(line)) break;
      block.push(line);
    }
    expect(block.filter((line) => /^\s+paths(-ignore)?:/.test(line))).toEqual([]);
  });

  it('names its jobs so the matrix expands to exactly the required checks', () => {
    const matrix = (name: string) =>
      /\[ (.+) \]/.exec(job('e2e').find((line) => line.startsWith(`        ${name}: [`)) ?? '')?.[1].split(', ') ?? [];
    const e2e = key('e2e', 'name')?.slice('    name: '.length) ?? '';
    const names = matrix('project').flatMap((project) =>
      matrix('shard').map((shard) => e2e.replace('${{ matrix.project }}', project).replace('${{ matrix.shard }}', shard)));
    expect([key('checks', 'name')?.slice('    name: '.length), ...names].sort()).toEqual(REQUIRED);
  });

  it('skips the steps of checks and e2e, never the jobs, on a docs-only pull request', () => {
    for (const id of ['checks', 'e2e']) {
      expect(job(id).filter((line) => line.startsWith('    if:')), `${id} has no job-level if`).toEqual([]);
      expect(key(id, 'needs'), `${id} needs changes`).toMatch(/\bchanges\b/);
      const each = steps(job(id));
      expect(each.length, `${id} has steps`).toBeGreaterThan(0);
      for (const step of each) {
        expect(step.find((line) => line.startsWith('        if: ')) ?? '', `${id}: ${step[0].trim()}`).toContain(WHEN_CODE);
      }
    }
    expect(key('merge-reports', 'if')).toContain(WHEN_CODE);
  });

  it('counts a pull request as docs-only only when every changed file is under docs/ or anti-slop/ or ends in .md', () => {
    const changes = job('changes').join('\n');
    expect(changes).toMatch(/^ {10}fetch-depth: 2$/m);
    expect(changes).toContain('git diff --name-only --no-renames HEAD^1 HEAD');
    const pattern = /grep -Ev '([^']+)'/.exec(changes)?.[1];
    expect(pattern).toBeDefined();
    const docsOnly = new RegExp(pattern ?? '');
    const docs = [
      'docs/audit/task-ledger.md',
      'docs/design/tokens.json',
      'anti-slop/rules.txt',
      'README.md',
      'AGENTS.md',
      '.claude/agents/fin-reviewer.md',
      'workflow/stages/01_spec/CONTEXT.md',
    ];
    const code = [
      'src/App.tsx',
      'unit/workflow-hardening.test.ts',
      '.github/workflows/playwright.yml',
      'package-lock.json',
      '.gitignore',
      'docs.ts',
      'src/docs/notes.ts',
      'notes.mdx',
      'README.md.bak',
      'workflow/stages/02_build/output/logs/T822-unit.log',
    ];
    expect(docs.filter((file) => !docsOnly.test(file))).toEqual([]);
    expect(code.filter((file) => docsOnly.test(file))).toEqual([]);
  });

  it('uses the docs-only set of the push filter and of the Release rule in AGENTS.md', () => {
    expect(text.match(/^ {4}paths-ignore: .*$/gm)).toEqual(["    paths-ignore: [ 'docs/**', 'anti-slop/**', '**/*.md' ]"]);
    const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
    expect(agents).toContain('outside `docs/`, `anti-slop/` and `*.md`');
  });
});
