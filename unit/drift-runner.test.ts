import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  applyMigrations,
  buildDriftCheck,
  catalogSelect,
  CATALOG_SEARCH_PATH,
  createDatabase,
  expectedRows,
  migrationFiles,
  readCatalog,
  readRepoFile,
} from '../scripts/lib/migrationReplay.mjs';
import { historyInsert } from '../scripts/lib/migrationHistory.mjs';
import { connectionConfig, connectPostgres, countsByKind, EXIT, runDriftCheck } from '../scripts/lib/driftRunner.mjs';

/**
 * The scheduled drift check (Phase 90, ADR 0066), rehearsed on PGlite.
 *
 * One database plays the live project: every migration replayed, the history
 * recorded with `npm run migration:print-history`'s statement, and
 * supabase/ops/20261005_phase90_schema_drift_reader.sql applied. The runner
 * connects to it as schema_drift_reader (SET ROLE stands in for logging in) and
 * runs exactly what the workflow runs, minus the network: `connectPostgres` is
 * tested on its own below, against a port that refuses.
 */

type Row = { kind: string; name: string; detail: string };
type Db = Awaited<ReturnType<typeof createDatabase>>;

const READER = 'schema_drift_reader';
const ROLE_SCRIPT = readRepoFile('supabase', 'ops', '20261005_phase90_schema_drift_reader.sql');

let db: Db;
let catalog: Row[];
let expected: Row[];
let summaryPath: string;
let logged: string[];

beforeAll(async () => {
  db = await createDatabase();
  await applyMigrations(db);
  catalog = await readCatalog(db);
  expected = expectedRows(catalog);
  await db.exec(`
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text,
      created_by text, idempotency_key text, rollback text[]);
  `);
  for (const [i, file] of migrationFiles().entries()) {
    await db.exec(historyInsert({ file, version: `${file.slice(0, 8)}${String(i).padStart(6, '0')}` }));
  }
  await db.exec(ROLE_SCRIPT);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(() => {
  summaryPath = join(mkdtempSync(join(tmpdir(), 'drift-')), 'summary.md');
  writeFileSync(summaryPath, '');
  logged = [];
});

/** A connection as `role`: what the workflow gets from SUPABASE_DRIFT_DB_URL. */
const connectAs = (role: string | null) => async () => {
  if (role) await db.exec(`set role ${role}`);
  return {
    query: async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows,
    close: async () => { await db.exec('reset role'); },
  };
};

const check = (connect = connectAs(READER)) =>
  runDriftCheck({ connect, expected, migrations: migrationFiles().length, summaryPath, log: (line: string) => logged.push(line), now: new Date('2026-10-05T10:00:00Z') });

const summary = () => readFileSync(summaryPath, 'utf8');

/** Runs `sql` as the reader, then switches back. */
async function asReader<T>(work: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${READER}`);
  try {
    return await work();
  } finally {
    await db.exec('reset role');
  }
}

describe('the schema_drift_reader role', () => {
  it('can log in, and is nothing more', async () => {
    const { rows } = await db.query<Record<string, unknown>>(
      `select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication, rolbypassrls, rolconnlimit
         from pg_roles where rolname = '${READER}'`);
    expect(rows).toEqual([{
      rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
      rolinherit: false, rolreplication: false, rolbypassrls: false, rolconnlimit: 2,
    }]);
  });

  it('is read-only and short-lived by default when it logs in', async () => {
    const { rows } = await db.query<{ setconfig: string[] }>(
      `select setconfig from pg_db_role_setting where setrole = '${READER}'::regrole`);
    expect(rows[0].setconfig.sort()).toEqual([
      'default_transaction_read_only=on', 'idle_in_transaction_session_timeout=60s', 'statement_timeout=30s',
    ]);
  });

  it('changes nothing when the script runs again', async () => {
    const before = await readCatalog(db);
    await db.exec(ROLE_SCRIPT);
    expect(await readCatalog(db)).toEqual(before);
  });

  it.each(['transactions', 'wallets', 'debts', 'categories', 'profiles', 'ai_request_counts'])(
    'cannot read a row of public.%s', async (table) => {
      await expect(asReader(() => db.query(`select * from public.${table} limit 1`))).rejects.toThrow(/permission denied/);
    });

  it('reads the history and cannot write to it', async () => {
    const { rows } = await asReader(() => db.query<{ n: number }>('select count(*)::int as n from supabase_migrations.schema_migrations'));
    expect(rows[0].n).toBe(migrationFiles().length);
    await expect(asReader(() => db.query("insert into supabase_migrations.schema_migrations (version, name) values ('1', 'x')")))
      .rejects.toThrow(/permission denied/);
  });

  it('cannot call an app function', async () => {
    await expect(asReader(() => db.query('select public.consume_ai_quota()'))).rejects.toThrow(/permission denied/);
  });

  it('sees the catalog exactly as an admin login does', async () => {
    const asRole = await asReader(async () => {
      await db.exec(`set search_path to ${CATALOG_SEARCH_PATH}`);
      return (await db.query<Row>(`select kind, name, detail from (${catalogSelect()}) c order by kind, name, detail`)).rows;
    });
    expect(asRole).toEqual(catalog);
  });

  it('needs USAGE on extensions, or defaults print with the schema and read as drift', async () => {
    // Put back only what the role script granted, so a missing grant still fails the tests after this one.
    const { rows: [{ had }] } = await db.query<{ had: boolean }>(`select has_schema_privilege('${READER}', 'extensions', 'USAGE') as had`);
    expect(had).toBe(true);
    await db.exec(`revoke usage on schema extensions from ${READER}`);
    try {
      const asRole = await asReader(async () => {
        await db.exec(`set search_path to ${CATALOG_SEARCH_PATH}`);
        return (await db.query<Row>(`select kind, name, detail from (${catalogSelect()}) c order by kind, name, detail`)).rows;
      });
      expect(asRole).not.toEqual(catalog);
      expect(asRole.find(r => r.name === 'wallets.id')?.detail).toContain('extensions.uuid_generate_v4()');
    } finally {
      if (had) await db.exec(`grant usage on schema extensions to ${READER}`);
    }
  });
});

describe('runDriftCheck', () => {
  it('exits 0 and reports no drift when live matches the migrations', async () => {
    expect(await check()).toBe(EXIT.CLEAN);
    expect(logged).toEqual([`schema-drift: no drift. Live matches all ${migrationFiles().length} migrations (as ${READER}).`]);
    expect(summary()).toContain('## Schema drift: none');
    expect(summary()).toContain(`Live compared with ${migrationFiles().length} migrations replayed from empty, as \`${READER}\`, at 2026-10-05 10:00 UTC.`);
    expect(summary()).toContain('| migration | 15 | 15 |  |  |');
  });

  it('exits 1 and names each row when the schema and the history drift', async () => {
    await db.exec(`
      create index debts_name_idx on public.debts (name);
      drop policy "Users manage their own debts" on public.debts;
      delete from supabase_migrations.schema_migrations where name = 'transfer_funds';
    `);
    try {
      expect(await check()).toBe(EXIT.DRIFT);
      expect(logged[0]).toBe('schema-drift: 3 row(s) of drift:');
      expect(summary()).toContain('## Schema drift: 3 rows');
      expect(summary()).toContain('| only in the database | index | debts_name_idx | CREATE INDEX debts_name_idx ON public.debts USING btree (name) |');
      expect(summary()).toContain('| only in the repo | migration | transfer_funds |   |');
      expect(summary()).toContain('| only in the repo | policy | debts.Users manage their own debts |');
      expect(summary()).toContain('| index | 17 | 18 |  | 1 |');
      expect(summary()).toContain('| migration | 15 | 14 | 1 |  |');
    } finally {
      await db.exec(`
        drop index public.debts_name_idx;
        create policy "Users manage their own debts" on public.debts for all to authenticated
          using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
      `);
      await db.exec(historyInsert({ file: '20260909_transfer_funds.sql', version: '20260909000001' }));
    }
    expect(await check()).toBe(EXIT.CLEAN);
  });

  it('finds the same rows as the SQL editor query', async () => {
    await db.exec('create index debts_name_idx on public.debts (name);');
    try {
      const results = await db.exec(buildDriftCheck(expected));
      const editor = results[results.length - 1].rows;
      expect(await check()).toBe(EXIT.DRIFT);
      expect(editor).toEqual([{ side: 'only in the database', kind: 'index', name: 'debts_name_idx', detail: 'CREATE INDEX debts_name_idx ON public.debts USING btree (name)' }]);
      expect(logged[1]).toContain('only in the database: index debts_name_idx');
    } finally {
      await db.exec('drop index public.debts_name_idx;');
    }
  });

  it('exits 2 rather than compare as an admin login', async () => {
    expect(await check(connectAs(null))).toBe(EXIT.NOT_CHECKED);
    expect(summary()).toContain('## Schema drift: not checked');
    expect(summary()).toMatch(/can reach \d+ app table\(s\); connect as schema_drift_reader/);
  });

  it('exits 2 when the reader has been granted an app table', async () => {
    await db.exec(`grant select on public.debts to ${READER}`);
    try {
      expect(await check()).toBe(EXIT.NOT_CHECKED);
      expect(logged[0]).toBe(`schema-drift: not checked: the connected role (${READER}) can reach 1 app table(s); connect as schema_drift_reader (supabase/ops/20261005_phase90_schema_drift_reader.sql) instead`);
    } finally {
      await db.exec(`revoke select on public.debts from ${READER}`);
    }
  });

  it('exits 2, not 0, when the query fails', async () => {
    await db.exec(`revoke select on supabase_migrations.schema_migrations from ${READER}`);
    try {
      expect(await check()).toBe(EXIT.NOT_CHECKED);
      expect(logged[0]).toMatch(/^schema-drift: not checked: the check failed \(.*permission denied/);
    } finally {
      await db.exec(`grant select on supabase_migrations.schema_migrations to ${READER}`);
    }
  });

  it('exits 2 when it cannot connect, and keeps the password out of what it prints', async () => {
    const url = 'postgres://schema_drift_reader.project:not-the-real-password@127.0.0.1:1/postgres?sslmode=disable';
    const code = await runDriftCheck({
      connect: () => connectPostgres(url), expected, migrations: 15, summaryPath, log: (line: string) => logged.push(line),
    });
    expect(code).toBe(EXIT.NOT_CHECKED);
    expect(logged[0]).toMatch(/^schema-drift: not checked: no connection \(.*ECONNREFUSED/);
    expect(`${logged.join('\n')}${summary()}`).not.toContain('not-the-real-password');
  });

  it('leaves the reader with no open transaction after a run', async () => {
    await check();
    const { rows } = await db.query<{ ro: string }>("select current_setting('transaction_read_only') as ro");
    expect(rows[0].ro).toBe('off');
    expect((await db.query<{ u: string }>('select current_user as u')).rows[0].u).not.toBe(READER);
  });
});

describe('countsByKind', () => {
  it('counts live rows from the migrations and the two kinds of difference', () => {
    const rows = [{ kind: 'index', name: 'a', detail: '' }, { kind: 'index', name: 'b', detail: '' }];
    expect(countsByKind(rows, [
      { side: 'only in the repo', kind: 'index', name: 'a', detail: '' },
      { side: 'only in the database', kind: 'index', name: 'c', detail: '' },
      { side: 'only in the database', kind: 'trigger', name: 't', detail: '' },
    ])).toEqual([
      { kind: 'index', repo: 2, live: 2, onlyRepo: 1, onlyLive: 1 },
      { kind: 'trigger', repo: 0, live: 1, onlyRepo: 0, onlyLive: 1 },
    ]);
  });
});

describe('connectionConfig', () => {
  it('drops every ssl parameter from the URL and always checks the certificate', () => {
    const config = connectionConfig('postgres://u.ref:p%40ss@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=no-verify&sslrootcert=x&uselibpqcompat=true&options=-c%20a%3Db');
    expect(config.connectionString).toBe('postgres://u.ref:p%40ss@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?options=-c+a%3Db');
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('checks against the project CA when one is given', () => {
    expect(connectionConfig('postgresql://u:p@h/db', 'PEM').ssl).toEqual({ ca: 'PEM', rejectUnauthorized: true });
  });

  it.each([['an https URL', 'https://example.test/'], ['not a URL', 'host=x user=y']])('refuses %s', (_label, url) => {
    expect(() => connectionConfig(url)).toThrow(/SUPABASE_DRIFT_DB_URL is not a/);
  });
});

describe('npm run schema:drift -- --live', () => {
  it('exits 2 without SUPABASE_DRIFT_DB_URL, so a missing secret never reads as no drift', () => {
    const run = spawnSync(process.execPath, ['scripts/schema-drift.mjs', '--live'], {
      env: { ...process.env, SUPABASE_DRIFT_DB_URL: '' }, encoding: 'utf8',
    });
    expect(run.status).toBe(EXIT.NOT_CHECKED);
    expect(run.stderr).toContain('--live needs SUPABASE_DRIFT_DB_URL');
    expect(run.stdout).toBe('');
  });
});
