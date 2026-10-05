import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  applyMigrations,
  buildDriftCheck,
  createDatabase,
  expectedRows,
  inlineProbe,
  migrationFiles,
  migrationName,
  readCatalog,
  readRepoFile,
} from '../scripts/lib/migrationReplay.mjs';

/**
 * The migrations rebuild the live schema from empty (Phase 87, ADR 0063).
 *
 * Until Phase 87 nothing in the repo created the tables the app stores its
 * data in: they were built in the Supabase dashboard, so a database made from
 * supabase/migrations/ failed at the first file. These tests replay every
 * migration into PGlite (PostgreSQL 17, in process) on top of
 * supabase/replay/prelude.sql, the stand-in for what Supabase provides. The
 * replayed catalog was compared with the live project's on 2026-10-05 and
 * matched it object for object (ADR 0063); `npm run schema:drift` makes that
 * comparison again.
 */

type CatalogRow = { kind: string; name: string; detail: string };
type Db = Awaited<ReturnType<typeof createDatabase>>;

const BASELINE = '20260901_baseline_schema.sql';
const count = (catalog: CatalogRow[], kind: string) => catalog.filter(r => r.kind === kind).length;

let db: Db;
let catalog: CatalogRow[];

beforeAll(async () => {
  db = await createDatabase();
  await applyMigrations(db);
  catalog = await readCatalog(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('every migration, from empty', () => {
  it('applies in file order, starting from the baseline', () => {
    expect(migrationFiles()[0]).toBe(BASELINE);
    expect(migrationFiles()).toHaveLength(13);
  });

  it('builds the eight tables and what the live project holds', () => {
    expect(catalog.filter(r => r.kind === 'table').map(r => r.name).sort()).toEqual([
      'ai_request_counts', 'categories', 'debts', 'diary_entries',
      'keyword_rules', 'profiles', 'transactions', 'wallets',
    ]);
    // The counts read from the live project on 2026-10-05.
    expect(count(catalog, 'column')).toBe(75);
    expect(count(catalog, 'constraint')).toBe(28);
    expect(count(catalog, 'index')).toBe(17);
    expect(count(catalog, 'policy')).toBe(9);
    expect(count(catalog, 'function')).toBe(15);
    expect(count(catalog, 'trigger')).toBe(2);
    expect(count(catalog, 'publication')).toBe(5);
  });

  it('keeps both idempotency indexes on transactions', () => {
    const def = (name: string) => catalog.find(r => r.kind === 'index' && r.name === name)?.detail;
    expect(def('transactions_user_idempotency_uidx')).toBe(
      'CREATE UNIQUE INDEX transactions_user_idempotency_uidx ON public.transactions USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL)');
    expect(def('transactions_user_idempotency_key_uniq')).toBe(
      'CREATE UNIQUE INDEX transactions_user_idempotency_key_uniq ON public.transactions USING btree (user_id, idempotency_key) WHERE ((idempotency_key IS NOT NULL) AND (is_deleted = false))');
  });

  it('ends with handle_new_user hardened by Phase 52 and no profile write policy', () => {
    const fn = catalog.find(r => r.kind === 'function' && r.name === 'handle_new_user()');
    expect(fn?.detail).toContain('security definer set search_path=public, pg_temp');
    // Phase 58s dropped it; the baseline must never bring it back.
    expect(catalog.filter(r => r.kind === 'policy' && r.name.startsWith('profiles.')).map(r => r.name))
      .toEqual(['profiles.Users can view their own profile']);
    expect(catalog.find(r => r.kind === 'table grant' && r.name === 'profiles to authenticated')?.detail).toBe('SELECT');
    expect(catalog.find(r => r.kind === 'table grant' && r.name === 'profiles to anon')?.detail).toBe('none');
  });
});

describe('the baseline on a database that already has everything', () => {
  it('changes nothing, which is what running it on the live project does', async () => {
    await applyMigrations(db, [BASELINE]);
    expect(await readCatalog(db)).toEqual(catalog);
  });
});

// The live project's history before Phase 87: nine of the thirteen files.
const LIVE_HISTORY: Array<[string, string]> = [
    ['20260919224758', 'dedupe_categories'],
    ['20260923031509', 'add_category_description'],
    ['20260927003804', 'ledger_rpcs'],
    ['20260927031656', 'phase52_security_ledger'],
    ['20260930113737', 'phase58s_profiles_hardening'],
    ['20260930123944', 'phase58b_update_transaction'],
    ['20261002013725', 'phase63_identity_colors'],
    ['20261002041331', 'phase64_seed_starter_account'],
    ['20261002061331', 'phase54_zero_starter_seed'],
];

/** The live project's history table, with its nine rows. */
const createLiveHistory = (target: Db) => target.exec(`
  create schema supabase_migrations;
  create table supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text,
    created_by text, idempotency_key text, rollback text[]);
  insert into supabase_migrations.schema_migrations (version, name) values
    ${LIVE_HISTORY.map(([v, n]) => `('${v}', '${n}')`).join(', ')};
`);

describe('the migration history backfill', () => {
  const backfill = () => db.exec(readRepoFile('supabase', 'ops', '20261005_phase87_record_migration_history.sql'));
  const names = async () =>
    (await db.query<{ name: string }>('select name from supabase_migrations.schema_migrations order by name')).rows.map(r => r.name);

  beforeAll(async () => {
    await createLiveHistory(db);
  });

  it('records exactly the four missing files, so the history matches every file', async () => {
    await backfill();
    expect(await names()).toEqual(migrationFiles().map(migrationName).sort());
  });

  it('inserts nothing when run again', async () => {
    await backfill();
    expect(await names()).toHaveLength(13);
  });

  it('marks what it backfilled', async () => {
    const { rows } = await db.query<{ version: string; name: string }>(
      "select version, name from supabase_migrations.schema_migrations where created_by like 'phase87 backfill%' order by version");
    expect(rows).toEqual([
      { version: '20260901000000', name: 'baseline_schema' },
      { version: '20260909000000', name: 'transfer_funds' },
      { version: '20261002000000', name: 'phase64_dedupe_categories' },
      { version: '20261003000000', name: 'phase73_ai_request_quota' },
    ]);
  });
});

describe('the drift query', () => {
  const drift = async () => {
    const results = await db.exec(buildDriftCheck(expectedRows(catalog)));
    return results[results.length - 1].rows as Array<CatalogRow & { side: string }>;
  };

  it('finds nothing on a database that matches the repo', async () => {
    expect(await drift()).toEqual([]);
  });

  it('names an object the database lost and one the repo does not know', async () => {
    await db.exec(`
      begin;
      drop policy "Users manage their own debts" on public.debts;
      create index debts_name_idx on public.debts (name);
      delete from supabase_migrations.schema_migrations where name = 'transfer_funds';
    `);
    try {
      const rows = await drift();
      expect(rows.map(r => `${r.side}: ${r.kind} ${r.name}`)).toEqual([
        'only in the database: index debts_name_idx',
        'only in the repo: migration transfer_funds',
        'only in the repo: policy debts.Users manage their own debts',
      ]);
    } finally {
      await db.exec('rollback;');
    }
    expect(await drift()).toEqual([]);
  });
});

describe('the live probe (supabase/tests/20261005_phase87.probe.sql)', () => {
  it('passes on a replayed database with the live history, and leaves it as it was', async () => {
    const probeDb = await createDatabase();
    try {
      await applyMigrations(probeDb);
      await createLiveHistory(probeDb);
      const before = await readCatalog(probeDb);
      const results = await probeDb.exec(inlineProbe('20261005_phase87.probe.sql'));
      expect(results.flatMap(r => r.rows)).toContainEqual({ result: 'PHASE 87 PROBE OK' });
      // It rolled back: the history still has nine rows.
      const { rows } = await probeDb.query('select count(*)::int as n from supabase_migrations.schema_migrations');
      expect(rows).toEqual([{ n: 9 }]);
      expect(await readCatalog(probeDb)).toEqual(before);
    } finally {
      await probeDb.close();
    }
  }, 60_000);
});
