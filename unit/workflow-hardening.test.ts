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
