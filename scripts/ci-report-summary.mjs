// Phase 86 (ADR 0062): reads the JSON report that `playwright merge-reports`
// writes from every shard's blob and prints a Markdown summary, one row per
// browser, for the merge job's step summary. A browser short of tests reads
// as a shard that never uploaded, before anyone opens the HTML report.
//
//   node scripts/ci-report-summary.mjs playwright-report/results.json >> "$GITHUB_STEP_SUMMARY"
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/ci-report-summary.mjs <results.json>');
  process.exit(2);
}

const report = JSON.parse(readFileSync(file, 'utf8'));
const byProject = new Map();
const notable = [];

function walk(suite, path) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const row = byProject.get(test.projectName) ?? { tests: 0, expected: 0, flaky: 0, unexpected: 0, skipped: 0 };
      row.tests += 1;
      row[test.status] = (row[test.status] ?? 0) + 1;
      byProject.set(test.projectName, row);
      if (test.status === 'unexpected' || test.status === 'flaky') {
        notable.push(`- ${test.status === 'flaky' ? 'Flaky' : 'Failed'}: ${test.projectName} › ${[...here, spec.title].join(' › ')}`);
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, here);
}
for (const suite of report.suites ?? []) walk(suite, []);

const lines = [
  '### Playwright, all shards',
  '',
  '| Browser | Tests | Passed | Flaky | Failed | Skipped |',
  '|---|---|---|---|---|---|',
];
for (const [name, r] of [...byProject].sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`| ${name} | ${r.tests} | ${r.expected} | ${r.flaky} | ${r.unexpected} | ${r.skipped} |`);
}
if (byProject.size === 0) lines.push('| (no results) | 0 | 0 | 0 | 0 | 0 |');
if (notable.length > 0) lines.push('', ...notable);
if (report.errors?.length) lines.push('', `${report.errors.length} error(s) outside any test; see the HTML report.`);
lines.push('', 'The HTML report, with every kept trace, is the `playwright-report-unified` artifact.');
console.log(lines.join('\n'));
