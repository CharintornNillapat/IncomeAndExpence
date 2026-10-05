// Phase 89 (ADR 0065): print the statement that records a hand-applied
// migration in the live project's history.
//
//   npm run migration:print-history -- supabase/migrations/<file>.sql
//   npm run migration:print-history -- <file>.sql --by="owner, SQL editor" --version=20261005085236
//
// Prints one idempotent insert into supabase_migrations.schema_migrations to
// paste into the SQL editor right after the migration itself. The version is
// the current UTC time unless --version gives one; created_by is
// "owner, SQL editor" unless --by says otherwise. It reads no database and
// writes nothing: the output is the whole effect.
import { historyInsert } from './lib/migrationHistory.mjs';

const args = process.argv.slice(2);
const option = name => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg === undefined ? undefined : arg.slice(name.length + 3);
};
const files = args.filter(a => !a.startsWith('--'));
const unknown = args.filter(a => a.startsWith('--') && !/^--(by|version)=/.test(a));

if (files.length !== 1 || unknown.length > 0) {
  console.error('Usage: npm run migration:print-history -- <supabase/migrations/file.sql> [--by="who, where"] [--version=YYYYMMDDHHMMSS]');
  process.exit(2);
}

try {
  process.stdout.write(historyInsert({ file: files[0], version: option('version'), createdBy: option('by') }));
} catch (error) {
  console.error(`migration-history: ${error.message}`);
  process.exit(1);
}
