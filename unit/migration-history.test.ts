import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_CREATED_BY, historyInsert, resolveMigration, utcVersion } from '../scripts/lib/migrationHistory.mjs';

/**
 * `npm run migration:print-history` (Phase 89, ADR 0065): the statement that
 * records a migration applied by hand in the SQL editor. The drift query test
 * in `migration-replay.test.ts` records the post-Phase 87 files with it and
 * then finds no drift, so its rows are the ones the drift check expects.
 */

const FILE = '20261005_wallet_default_thb.sql';

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  // The live project's table, as information_schema shows it.
  await db.exec(`
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text,
      created_by text, idempotency_key text, rollback text[]);
  `);
});

afterAll(async () => {
  await db?.close();
});

const history = async () =>
  (await db.query<{ version: string; name: string; created_by: string; statements: string[] | null }>(
    'select version, name, created_by, statements from supabase_migrations.schema_migrations order by version')).rows;

/** Runs a printed statement; the rows its `returning` gives back. */
const run = async (sql: string) => {
  const results = await db.exec(sql);
  return results[results.length - 1].rows;
};

describe('utcVersion', () => {
  it('writes a moment as YYYYMMDDHHMMSS in UTC, whatever the offset it was given in', () => {
    expect(utcVersion(new Date('2026-10-05T08:52:36.789Z'))).toBe('20261005085236');
    expect(utcVersion(new Date('2026-10-05T15:52:36+07:00'))).toBe('20261005085236');
    expect(utcVersion(new Date('2026-12-31T23:59:59Z'))).toBe('20261231235959');
  });
});

describe('resolveMigration', () => {
  it.each([
    [`supabase/migrations/${FILE}`],
    [`supabase\\migrations\\${FILE}`],
    [`./supabase/migrations/${FILE}`],
    [FILE],
  ])('finds the file from %s', (arg) => {
    expect(resolveMigration(arg)).toBe(FILE);
  });

  it.each([
    ['a file that does not exist', '20261005_nothing.sql'],
    ['a probe, which is not a migration', 'supabase/tests/20261005_phase88.probe.sql'],
    ['nothing', ''],
  ])('refuses %s', (_label, arg) => {
    expect(() => resolveMigration(arg)).toThrow('Not a file in supabase/migrations/');
  });
});

describe('historyInsert', () => {
  it('records the file under its name without the date, at the version, as the owner in the SQL editor', async () => {
    expect(await run(historyInsert({ file: FILE, version: '20261005085237' }))).toEqual([
      { version: '20261005085237', name: 'wallet_default_thb', created_by: DEFAULT_CREATED_BY },
    ]);
    expect(await history()).toEqual([
      { version: '20261005085237', name: 'wallet_default_thb', created_by: 'owner, SQL editor', statements: null },
    ]);
  });

  it('inserts nothing when run again, and says so by returning no row', async () => {
    expect(await run(historyInsert({ file: FILE, version: '20261005085237' }))).toEqual([]);
    expect(await history()).toHaveLength(1);
  });

  it('inserts nothing for a name already recorded at another time', async () => {
    expect(await run(historyInsert({ file: FILE, version: '20261006000000' }))).toEqual([]);
    expect(await history()).toHaveLength(1);
  });

  it('inserts nothing at a version another file already holds', async () => {
    expect(await run(historyInsert({ file: '20261005_phase88_quota_checks_session.sql', version: '20261005085237' }))).toEqual([]);
    expect(await history()).toHaveLength(1);
  });

  it('keeps a quote in created_by as written', async () => {
    await run(historyInsert({ file: '20261003_phase73_ai_request_quota.sql', version: '20261003000001', createdBy: "owner's laptop, SQL editor" }));
    expect((await history()).find(r => r.name === 'phase73_ai_request_quota')?.created_by).toBe("owner's laptop, SQL editor");
  });

  it('uses the time it is printed when no version is given', () => {
    const before = utcVersion();
    const sql = historyInsert({ file: FILE });
    const version = /select '(\d{14})'/.exec(sql)?.[1];
    expect(version! >= before && version! <= utcVersion()).toBe(true);
  });

  it.each([
    ['a short version', { version: '2026' }, 'A version is 14 digits'],
    ['a version with separators', { version: '2026-10-05T08:52' }, 'A version is 14 digits'],
    ['an empty created_by', { createdBy: '  ' }, 'created_by must say who applied it'],
    ['an unknown file', { file: 'nope.sql' }, 'Not a file in supabase/migrations/'],
  ])('refuses %s', (_label, options, message) => {
    expect(() => historyInsert({ file: FILE, ...options })).toThrow(message);
  });
});
