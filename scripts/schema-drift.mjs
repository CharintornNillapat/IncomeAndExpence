// Phase 87 (ADR 0063): is the live database what supabase/migrations/ says it
// is?
//
//   npm run schema:drift > drift-check.sql
//
// Builds the database from every migration in PGlite, reads its catalog
// (supabase/catalog.sql), and writes one SQL query that carries that catalog
// and the migration names as its expected rows. Run the query on the live
// project (the SQL editor, or MCP's execute_sql): it compares them with the
// live catalog and the live migration history, and returns only the rows that
// differ. No rows means no drift.
//
// The query is read-only: it creates a temporary view (schema_catalog) and
// sets the session's search path.
//
// Phase 90 (ADR 0066): with SUPABASE_DRIFT_DB_URL set, it connects and runs
// the comparison itself, in a read-only transaction, and exits
//   0 no drift, 1 drift (an unrecorded migration included), 2 not checked.
// `--live` requires the URL (exit 2 without it), so a missing secret on the
// scheduled workflow can never pass as "no drift". SUPABASE_DRIFT_DB_CA, when
// set, is the CA certificate (PEM) the server's certificate is checked against.
// GITHUB_STEP_SUMMARY, when set, gets the Markdown report.
import { connectPostgres, EXIT, runDriftCheck } from './lib/driftRunner.mjs';
import { buildDriftCheck, expectedRows, migrationFiles, replayAll } from './lib/migrationReplay.mjs';

const live = process.argv.includes('--live');
const url = process.env.SUPABASE_DRIFT_DB_URL?.trim();
if (live && !url) {
  console.error('schema-drift: --live needs SUPABASE_DRIFT_DB_URL (the schema_drift_reader connection string). Not checked.');
  process.exit(EXIT.NOT_CHECKED);
}

const { db, catalog } = await replayAll();
await db.close();

const expected = expectedRows(catalog);
const kinds = new Map();
for (const row of expected) kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
console.error(`schema-drift: ${migrationFiles().length} migrations replayed from empty; expected rows: `
  + [...kinds].map(([kind, n]) => `${n} ${kind}`).join(', '));

if (!url) {
  process.stdout.write(buildDriftCheck(expected));
} else {
  process.exitCode = await runDriftCheck({
    connect: () => connectPostgres(url, { ca: process.env.SUPABASE_DRIFT_DB_CA?.trim() || undefined }),
    expected,
    migrations: migrationFiles().length,
    summaryPath: process.env.GITHUB_STEP_SUMMARY || undefined,
  });
}
