// Phase 90 (ADR 0066): run the drift check against a live database over a
// connection, instead of printing it for the SQL editor.
//
// `runDriftCheck` takes a `connect()` that returns `{ query(sql, params), close() }`:
// `connectPostgres` (node-postgres) on the scheduled workflow, or a PGlite
// database in the unit tests. It returns the process exit code:
//   0  the live catalog and history match the migrations;
//   1  drift: rows only in the repo or only in the database (an unrecorded
//      migration is one of them);
//   2  not checked: no connection, a credential that can read app data, or a
//      query that failed. Never reported as "no drift".
import { appendFileSync } from 'node:fs';
import { CATALOG_SEARCH_PATH, buildDriftQuery } from './migrationReplay.mjs';

export const EXIT = { CLEAN: 0, DRIFT: 1, NOT_CHECKED: 2 };

/**
 * Who the connection is and what it could touch. The check refuses to run as
 * a role that can read or write a table in public, or that bypasses
 * row-level security: the secret it runs with must be the read-only role
 * (supabase/ops/20261005_phase90_schema_drift_reader.sql), not a copy of an
 * admin login.
 */
const PRIVILEGES = `
select r.rolname as role,
       r.rolsuper as superuser,
       r.rolbypassrls as bypassrls,
       (select count(*)::int
          from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
           and has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')) as data_tables
  from pg_roles r
 where r.rolname = current_user`;

class NotChecked extends Error {}

/**
 * The drift rows, read inside one read-only transaction that is rolled back.
 * Throws NotChecked when the connection is not one the check may use.
 */
export async function readDrift(db, expected) {
  await db.query('begin read only');
  try {
    await db.query(`set local search_path to ${CATALOG_SEARCH_PATH}`);
    await db.query("set local statement_timeout = '30s'");
    const [{ read_only: readOnly }] = await db.query("select current_setting('transaction_read_only') as read_only");
    if (readOnly !== 'on') throw new NotChecked('the transaction is not read-only');

    const [who] = await db.query(PRIVILEGES);
    if (!who) throw new NotChecked('the connected role is not in pg_roles');
    if (who.superuser || who.bypassrls || who.data_tables > 0) {
      throw new NotChecked(
        `the connected role (${who.role}) can ${who.data_tables > 0 ? `reach ${who.data_tables} app table(s)` : 'bypass row-level security'}; `
        + 'connect as schema_drift_reader (supabase/ops/20261005_phase90_schema_drift_reader.sql) instead');
    }

    const rows = await db.query(buildDriftQuery(), [JSON.stringify(expected)]);
    return { role: who.role, rows };
  } finally {
    await db.query('rollback').catch(() => undefined);
  }
}

/** Per kind: rows the migrations expect, rows live has, and how many differ each way. */
export function countsByKind(expected, drift) {
  const kinds = new Map();
  const at = kind => kinds.get(kind) ?? kinds.set(kind, { kind, repo: 0, live: 0, onlyRepo: 0, onlyLive: 0 }).get(kind);
  for (const row of expected) at(row.kind).repo += 1;
  for (const row of drift) {
    if (row.side === 'only in the repo') at(row.kind).onlyRepo += 1;
    else at(row.kind).onlyLive += 1;
  }
  for (const k of kinds.values()) k.live = k.repo - k.onlyRepo + k.onlyLive;
  return [...kinds.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

const cell = (text, max = 160) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return (flat.length > max ? `${flat.slice(0, max - 1)}…` : flat).replace(/\|/g, '\\|') || ' ';
};

/** The GitHub job summary (Markdown) for one result. */
export function summaryMarkdown({ outcome, role, expected, drift = [], reason, migrations, at }) {
  const lines = [];
  if (outcome === EXIT.NOT_CHECKED) {
    lines.push('## Schema drift: not checked', '', `Live was not compared: ${reason}.`, '');
    return lines.join('\n');
  }
  lines.push(outcome === EXIT.CLEAN ? '## Schema drift: none' : `## Schema drift: ${drift.length} row${drift.length === 1 ? '' : 's'}`, '');
  lines.push(`Live compared with ${migrations} migrations replayed from empty, as \`${role}\`, at ${at}.`, '');
  lines.push('| Kind | Migrations | Live | Only in the repo | Only live |', '|---|---:|---:|---:|---:|');
  for (const k of countsByKind(expected, drift)) {
    lines.push(`| ${k.kind} | ${k.repo} | ${k.live} | ${k.onlyRepo || ''} | ${k.onlyLive || ''} |`);
  }
  if (drift.length > 0) {
    lines.push('', '### Rows that differ', '', '| Side | Kind | Name | Detail |', '|---|---|---|---|');
    for (const row of drift) lines.push(`| ${row.side} | ${cell(row.kind)} | ${cell(row.name)} | ${cell(row.detail)} |`);
    lines.push('', 'A migration missing from the history: record it with `npm run migration:print-history` (ADR 0065). '
      + 'Anything else: a change made outside a migration file, to bring back into one (ADR 0063).');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Connects, compares, reports and closes. `log` gets plain lines; the job
 * summary is appended to `summaryPath` when given (GITHUB_STEP_SUMMARY).
 */
export async function runDriftCheck({ connect, expected, migrations, summaryPath, log = console.log, now = new Date() }) {
  const at = `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const report = result => {
    if (summaryPath) appendFileSync(summaryPath, summaryMarkdown({ ...result, expected, migrations, at }));
    return result.outcome;
  };

  let db;
  try {
    db = await connect();
  } catch (error) {
    const reason = `no connection (${error instanceof Error ? error.message : String(error)})`;
    log(`schema-drift: not checked: ${reason}`);
    return report({ outcome: EXIT.NOT_CHECKED, reason });
  }

  try {
    const { role, rows } = await readDrift(db, expected);
    if (rows.length === 0) {
      log(`schema-drift: no drift. Live matches all ${migrations} migrations (as ${role}).`);
      return report({ outcome: EXIT.CLEAN, role });
    }
    log(`schema-drift: ${rows.length} row(s) of drift:`);
    for (const row of rows) log(`  ${row.side}: ${row.kind} ${row.name}${row.detail ? `  [${cell(row.detail, 200)}]` : ''}`);
    return report({ outcome: EXIT.DRIFT, role, drift: rows });
  } catch (error) {
    const reason = error instanceof NotChecked ? error.message : `the check failed (${error instanceof Error ? error.message : String(error)})`;
    log(`schema-drift: not checked: ${reason}`);
    return report({ outcome: EXIT.NOT_CHECKED, reason });
  } finally {
    await db.close?.().catch?.(() => undefined);
  }
}

/**
 * node-postgres settings for a connection string. Any `ssl*` parameter in the
 * URL is dropped so it cannot loosen what is set here: TLS, with the
 * certificate checked, against `ca` when given (the project's CA, from
 * SUPABASE_DRIFT_DB_CA) and the system's otherwise. Never unverified.
 */
export function connectionConfig(url, ca) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SUPABASE_DRIFT_DB_URL is not a URL');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('SUPABASE_DRIFT_DB_URL is not a postgres:// URL');
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith('ssl') || key === 'uselibpqcompat') parsed.searchParams.delete(key);
  }
  return {
    connectionString: parsed.toString(),
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
    application_name: 'schema-drift',
  };
}

/** A node-postgres client in the shape `runDriftCheck` expects. */
export async function connectPostgres(url, { ca } = {}) {
  const config = connectionConfig(url, ca);
  const { default: pg } = await import('pg');
  const client = new pg.Client(config);
  client.on('error', () => undefined);
  await client.connect();
  return {
    query: async (sql, params) => (await client.query(sql, params)).rows,
    close: () => client.end(),
  };
}
