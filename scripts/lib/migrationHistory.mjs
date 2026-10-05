// Phase 89 (ADR 0065): the history row for a migration applied by hand.
//
// A migration run in the Supabase SQL editor changes the schema but leaves
// supabase_migrations.schema_migrations without its row, and the drift check
// (ADR 0063) then reports the file as missing. This writes the one statement
// that records it, in the shape the live history already holds: the UTC time
// as the version, the file name without its date as the name, who ran it in
// created_by, and no statements.
//
// Used by scripts/migration-history.mjs and unit/migration-history.test.ts.
import { basename } from 'node:path';
import { migrationFiles, migrationName } from './migrationReplay.mjs';

/** What a hand-applied row is marked with unless told otherwise. */
export const DEFAULT_CREATED_BY = 'owner, SQL editor';

/** A moment as a history version: `YYYYMMDDHHMMSS`, in UTC. */
export function utcVersion(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/\D/g, '');
}

/**
 * The migration file an argument names, as a path or a bare file name. It
 * must be one of supabase/migrations/'s files: the history only records those.
 */
export function resolveMigration(arg) {
  const file = basename(String(arg ?? '').replace(/\\/g, '/'));
  if (!migrationFiles().includes(file)) {
    throw new Error(`Not a file in supabase/migrations/: ${arg}`);
  }
  return file;
}

const literal = value => `'${String(value).replace(/'/g, "''")}'`;

/**
 * The insert that records `file`. Idempotent: if the name or the version is
 * already in the history it inserts nothing, and `returning` shows which (a
 * row back means it was recorded now, none means it already was).
 */
export function historyInsert({ file, version = utcVersion(), createdBy = DEFAULT_CREATED_BY }) {
  if (!/^\d{14}$/.test(version)) throw new Error(`A version is 14 digits, YYYYMMDDHHMMSS in UTC: ${version}`);
  if (!String(createdBy).trim()) throw new Error('created_by must say who applied it');
  const name = migrationName(resolveMigration(file));
  return `-- Records ${resolveMigration(file)} in the migration history (ADR 0065).
-- Run it right after the migration succeeds, in the same SQL editor tab.
-- ${version} is the UTC time this was printed: print it when you apply the
-- migration, not ahead of time. Idempotent: a name or version already in the
-- history inserts nothing (no row returned).
insert into supabase_migrations.schema_migrations (version, name, created_by)
select ${literal(version)}, ${literal(name)}, ${literal(createdBy)}
 where not exists (select 1 from supabase_migrations.schema_migrations where name = ${literal(name)})
   and not exists (select 1 from supabase_migrations.schema_migrations where version = ${literal(version)})
returning version, name, created_by;
`;
}
