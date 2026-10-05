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
import { buildDriftCheck, expectedRows, migrationFiles, replayAll } from './lib/migrationReplay.mjs';

const { db, catalog } = await replayAll();
await db.close();

const expected = expectedRows(catalog);
const kinds = new Map();
for (const row of expected) kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
console.error(`schema-drift: ${migrationFiles().length} migrations replayed from empty; expected rows: `
  + [...kinds].map(([kind, n]) => `${n} ${kind}`).join(', '));

process.stdout.write(buildDriftCheck(expected));
