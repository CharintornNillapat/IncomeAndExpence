// Times an account's erasure (delete_user_account, ADR 0072) on a replayed
// database, with and without indexes on the five foreign keys that have none
// (ADR 0067, 0073). Not shipped and not run in CI; ADR 0073 records its output.
//
//   node scripts/bench-cascade-delete.mjs
//
// Each wallet, category and debt the cascade deletes makes Postgres find the
// rows that reference it: with no index on transactions.wallet_id,
// destination_wallet_id, category_id, debt_id or keyword_rules.category_id,
// that is a scan of the whole table, every account's rows included.
import { performance } from 'node:perf_hooks';
import { applyMigrations, createDatabase } from './lib/migrationReplay.mjs';

const TARGET = '00000000-0000-4000-8000-000000097000';
const uid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const FK_INDEXES = `
  create index transactions_wallet_id_idx on public.transactions (wallet_id);
  create index transactions_destination_wallet_id_idx on public.transactions (destination_wallet_id);
  create index transactions_category_id_idx on public.transactions (category_id);
  create index transactions_debt_id_idx on public.transactions (debt_id);
  create index keyword_rules_category_id_idx on public.keyword_rules (category_id);
`;

/** One account's rows: `w` wallets, `c` categories, `d` debts, `t` transactions, `r` rules, `e` diary days. */
const seedAccount = (user, { w, c, d, t, r, e }) => `
  insert into auth.users (id, email, aud, role) values ('${user}', '${user}@bench.invalid', 'authenticated', 'authenticated');
  insert into public.wallets (user_id, name, type, balance)
    select '${user}', 'W' || g, 'CASH', 0 from generate_series(1, ${w}) g;
  insert into public.categories (user_id, name, type)
    select '${user}', 'C' || g, 'EXPENSE' from generate_series(1, ${c}) g;
  insert into public.debts (user_id, name, total_amount, remaining_amount)
    select '${user}', 'D' || g, 1000, 500 from generate_series(1, ${d}) g;
  insert into public.transactions (user_id, wallet_id, destination_wallet_id, category_id, debt_id, amount, type, description)
    select '${user}',
           w.ids[1 + g % ${w}],
           case when g % 10 = 0 then w.ids[1 + (g + 1) % ${w}] end,
           c.ids[1 + g % ${c}],
           case when ${d} > 0 and g % 20 = 0 then d.ids[1 + g % greatest(${d}, 1)] end,
           10, case when ${d} > 0 and g % 20 = 0 then 'DEBT_REPAYMENT' else 'EXPENSE' end, 'bench'
    from generate_series(1, ${t}) g,
         (select array_agg(id) ids from public.wallets where user_id = '${user}') w,
         (select array_agg(id) ids from public.categories where user_id = '${user}') c,
         (select array_agg(id) ids from public.debts where user_id = '${user}') d;
  insert into public.keyword_rules (user_id, keyword, category_id)
    select '${user}', 'k' || g, c.ids[1 + g % ${c}]
    from generate_series(1, ${r}) g, (select array_agg(id) ids from public.categories where user_id = '${user}') c;
  insert into public.diary_entries (user_id, date, mood, food_quality)
    select '${user}', date '2020-01-01' + g, 3, 'AVERAGE' from generate_series(1, ${e}) g;
`;

// The account erased: a heavy user. Live's largest today has 103 transactions.
const HEAVY = { w: 20, c: 40, d: 10, t: 20000, r: 200, e: 1000 };
// Live's shape on 2026-10-06: 2 accounts, 30 wallets, 20 categories, 103 transactions.
const LIVE = { w: 15, c: 11, d: 1, t: 103, r: 5, e: 3 };
const OTHER = { w: 5, c: 15, d: 2, t: 1000, r: 10, e: 100 };

const SCENARIOS = [
  { name: 'live today', target: LIVE, others: 1, other: LIVE },
  { name: 'heavy account alone', target: HEAVY, others: 0 },
  { name: 'heavy + 100k other rows', target: HEAVY, others: 100, other: OTHER },
  { name: 'heavy + 500k other rows', target: HEAVY, others: 500, other: OTHER },
];

const RUNS = 3;

async function timeDelete(db) {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    await db.exec('begin');
    const start = performance.now();
    await db.query(`delete from auth.users where id = $1`, [TARGET]);
    times.push(performance.now() - start);
    const left = await db.query(`select count(*)::int n from public.transactions where user_id = $1`, [TARGET]);
    if (left.rows[0].n !== 0) throw new Error('the cascade left transactions behind');
    await db.exec('rollback');
  }
  return times.sort((a, b) => a - b)[Math.floor(RUNS / 2)];
}

for (const s of SCENARIOS) {
  const db = await createDatabase();
  await applyMigrations(db);
  let sql = seedAccount(TARGET, s.target);
  for (let i = 1; i <= s.others; i++) sql += seedAccount(uid(0x97100 + i), s.other);
  await db.exec(sql);
  await db.exec('analyze');
  const total = (await db.query('select count(*)::int n from public.transactions')).rows[0].n;
  const without = await timeDelete(db);
  await db.exec(FK_INDEXES + 'analyze;');
  const withIdx = await timeDelete(db);
  console.log(
    `${s.name.padEnd(26)} transactions ${String(total).padStart(7)}  without ${without.toFixed(0).padStart(6)} ms  with ${withIdx.toFixed(0).padStart(5)} ms`
  );
  await db.close();
}
