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
import { historyInsert } from '../scripts/lib/migrationHistory.mjs';

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
    expect(migrationFiles()).toHaveLength(20);
  });

  it('builds the eight tables and what the live project holds', () => {
    expect(catalog.filter(r => r.kind === 'table').map(r => r.name).sort()).toEqual([
      'ai_request_counts', 'categories', 'debts', 'diary_entries',
      'keyword_rules', 'profiles', 'transactions', 'wallets',
    ]);
    // The counts read from the live project on 2026-10-05, less Phase 93's
    // two SELECT policies, plus its transfer_funds overload (ADR 0069) and
    // Phase 96's delete_user_account (ADR 0072), less the 20260909
    // transfer_funds signature Phase 114 drops (ADR 0090).
    expect(count(catalog, 'column')).toBe(75);
    expect(count(catalog, 'constraint')).toBe(28);
    expect(count(catalog, 'index')).toBe(17);
    expect(count(catalog, 'policy')).toBe(7);
    expect(count(catalog, 'function')).toBe(16);
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

  it('records exactly the four missing files, so the history matched every Phase 87 file', async () => {
    await backfill();
    // Phase 87's thirteen; later files are recorded when they are applied.
    const phase87Files = migrationFiles().filter(file => file < '20261005');
    expect(phase87Files).toHaveLength(13);
    expect(await names()).toEqual(phase87Files.map(migrationName).sort());
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
  beforeAll(async () => {
    // The files after Phase 87, recorded as a migration applied in the SQL
    // editor is: with `npm run migration:print-history`'s statement (ADR 0065).
    for (const file of migrationFiles().filter(f => f >= '20261005')) {
      await db.exec(historyInsert({ file, version: `${file.slice(0, 8)}${String(migrationFiles().indexOf(file)).padStart(6, '0')}` }));
    }
  });

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
  it('passes on a database at Phase 87 with the live history, and leaves it as it was', async () => {
    const probeDb = await createDatabase();
    try {
      // The schema it was written for: it re-runs the Phase 73 file, which
      // since Phase 88 would put back the function without the session check.
      await applyMigrations(probeDb, migrationFiles().filter(file => file < '20261005'));
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

describe('the probes against the schema the migrations build', () => {
  const runProbe = async (probe: string, files: string[], applied: boolean, setup = '') => {
    const probeDb = await createDatabase();
    try {
      await applyMigrations(probeDb, files);
      if (setup) await probeDb.exec(setup);
      const before = await readCatalog(probeDb);
      const results = await probeDb.exec(inlineProbe(probe, { applied }));
      const after = await readCatalog(probeDb);
      return { rows: results.flatMap(r => r.rows), before, after };
    } finally {
      await probeDb.close();
    }
  };
  const upTo87 = () => migrationFiles().filter(file => file < '20261005');

  it('Phase 88, before its migrations: applies them, passes and rolls back', async () => {
    const { rows, before, after } = await runProbe('20261005_phase88.probe.sql', upTo87(), false);
    expect(rows).toContainEqual({ result: 'PHASE 88 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 88, after its migrations: passes against every file', async () => {
    const { rows } = await runProbe('20261005_phase88.probe.sql', migrationFiles(), true);
    expect(rows).toContainEqual({ result: 'PHASE 88 PROBE OK' });
  }, 60_000);

  const upTo92 = () => migrationFiles().filter(file => file < '20261006');

  it('Phase 93, before its migrations: applies them, passes and rolls back', async () => {
    const { rows, before, after } = await runProbe('20261006_phase93.probe.sql', upTo92(), false);
    expect(rows).toContainEqual({ result: 'PHASE 93 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  // The baseline no longer creates the two policies Phase 93 drops, so a
  // replay never has them. Live does until the migration runs: put them back
  // as the dashboard made them, and the probe must see them dropped.
  it('Phase 93, on the live shape with both SELECT policies: drops them and passes', async () => {
    const livePolicies = ['categories', 'keyword_rules'].map(tbl =>
      `create policy "Users can view system and their own ${tbl === 'categories' ? 'categories' : 'keyword rules'}"
         on public.${tbl} for select to authenticated using (user_id is null or (select auth.uid()) = user_id);`).join('\n');
    const { rows, before, after } = await runProbe('20261006_phase93.probe.sql', upTo92(), false, livePolicies);
    expect(before.filter(r => r.kind === 'policy')).toHaveLength(9);
    expect(rows).toContainEqual({ result: 'PHASE 93 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  // Its section 4 checks that the 20260909 signature still moves money, which
  // Phase 102 ends on purpose; the Phase 102 probe checks the refusal instead.
  // Phase 114 drops that signature, so both stop before it.
  const upTo113 = () => migrationFiles().filter(file => !file.includes('_phase114_'));
  const upTo101 = () => upTo113().filter(file => !file.includes('_phase102_'));

  it('Phase 93, after its migrations: passes against every file up to Phase 102', async () => {
    const { rows, before, after } = await runProbe('20261006_phase93.probe.sql', upTo101(), true);
    expect(rows).toContainEqual({ result: 'PHASE 93 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 102, before its migration: applies it, passes and rolls back', async () => {
    const { rows, before, after } = await runProbe('20261006_phase102.probe.sql', upTo101(), false);
    expect(rows).toContainEqual({ result: 'PHASE 102 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 102, after its migration: passes against every file up to Phase 114', async () => {
    const { rows, before, after } = await runProbe('20261006_phase102.probe.sql', upTo113(), true);
    expect(rows).toContainEqual({ result: 'PHASE 102 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 102: the probe fails on the schema before it, with the migration left out', async () => {
    const probeDb = await createDatabase();
    try {
      await applyMigrations(probeDb, upTo101());
      await expect(probeDb.exec(inlineProbe('20261006_phase102.probe.sql', { applied: true }))).rejects.toThrow(
        /the old signature is still security definer/
      );
    } finally {
      await probeDb.close();
    }
  }, 60_000);

  it('Phase 114, before its migration: applies it, passes and rolls back', async () => {
    const { rows, before, after } = await runProbe('20261008_phase114.probe.sql', upTo113(), false);
    expect(rows).toContainEqual({ result: 'PHASE 114 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 114, after its migration: passes against every file', async () => {
    const { rows, before, after } = await runProbe('20261008_phase114.probe.sql', migrationFiles(), true);
    expect(rows).toContainEqual({ result: 'PHASE 114 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 114: the probe fails on the schema before it, with the migration left out', async () => {
    const probeDb = await createDatabase();
    try {
      await applyMigrations(probeDb, upTo113());
      await expect(probeDb.exec(inlineProbe('20261008_phase114.probe.sql', { applied: true }))).rejects.toThrow(
        /the 20260909 signature is still there/
      );
    } finally {
      await probeDb.close();
    }
  }, 60_000);

  const upTo95 = () => migrationFiles().filter(file => !file.includes('_phase96_'));

  it('Phase 96, before its migration: applies it, passes and rolls back', async () => {
    const { rows, before, after } = await runProbe('20261006_phase96.probe.sql', upTo95(), false);
    expect(rows).toContainEqual({ result: 'PHASE 96 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 96, after its migration: passes against every file', async () => {
    const { rows, before, after } = await runProbe('20261006_phase96.probe.sql', migrationFiles(), true);
    expect(rows).toContainEqual({ result: 'PHASE 96 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 73, re-run against the Phase 88 function: still passes', async () => {
    const { rows, before, after } = await runProbe('20261003_phase73.probe.sql', migrationFiles(), true);
    expect(rows).toContainEqual({ result: 'PHASE 73 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);
});
