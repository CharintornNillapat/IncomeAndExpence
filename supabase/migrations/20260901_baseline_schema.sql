-- =============================================================================
-- Phase 87 (ADR 0063): the schema the app started from, which no migration in
-- this repo created. It was built in the Supabase dashboard before the first
-- migration here (20260909_transfer_funds.sql), and every later file assumes
-- it. Without this file a database built from supabase/migrations/ alone
-- fails at the first one.
--
-- What it holds, read from the live project on 2026-10-05:
--   - the uuid-ossp extension (every id defaults to uuid_generate_v4());
--   - the seven tables as they stood before the first migration: no
--     categories.description (20260923) and no wallets.idempotency_key
--     (20260928), which later files add;
--   - their check and foreign-key constraints, six indexes and row-level
--     security;
--   - seven of the nine row-level security policies (no migration created
--     any);
--   - transactions_user_idempotency_uidx, the non-partial unique index ADR
--     0023 found and left in place (see below);
--   - handle_new_user() and its on_auth_user_created trigger on auth.users.
--     Phase 52 only altered the function; its body here is the live one;
--   - the five tables in the supabase_realtime publication.
--
-- What it leaves out: anything a later migration drops, so that running this
-- file can never bring it back: the profiles "update their own profile"
-- policy (removed in Phase 58s) and the two "view system and their own"
-- SELECT policies on categories and keyword_rules (removed in Phase 93).
--
-- Safe on a database that already has all of it, which is the live project:
-- every statement is `if not exists` or checks the catalog first, so nothing
-- is replaced. A plain `create or replace` of handle_new_user would reset the
-- search_path Phase 52 set on it. supabase/tests/20261005_phase87.probe.sql
-- runs this file on the live schema inside BEGIN ... ROLLBACK and checks that
-- it changed nothing.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;


-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid not null primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text default 'User',
  role       text default 'USER' check (role in ('USER', 'ADMIN')),
  created_at timestamptz default now()
);

create table if not exists public.wallets (
  id          uuid not null default uuid_generate_v4() primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('CASH', 'BANK_ACCOUNT', 'CREDIT_CARD', 'E_WALLET', 'INVESTMENT', 'SAVINGS')),
  currency    text not null default 'USD',
  balance     numeric(15,2) not null default 0.00,
  color       text not null default 'stone',
  icon        text not null default 'wallet',
  is_archived boolean not null default false,
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id         uuid not null default uuid_generate_v4() primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_REPAYMENT')),
  icon       text not null default 'tag',
  color      text not null default 'stone',
  is_system  boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id               uuid not null default uuid_generate_v4() primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null,
  total_amount     numeric(15,2) not null,
  remaining_amount numeric(15,2) not null,
  interest_rate    numeric(5,2) default 0.0,
  minimum_payment  numeric(15,2) default 0.0,
  due_date         date,
  is_settled       boolean not null default false,
  is_deleted       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.transactions (
  id                    uuid not null default uuid_generate_v4() primary key,
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  wallet_id             uuid not null references public.wallets (id) on delete cascade,
  destination_wallet_id uuid references public.wallets (id) on delete set null,
  category_id           uuid references public.categories (id) on delete set null,
  debt_id               uuid references public.debts (id) on delete set null,
  amount                numeric(15,2) not null,
  type                  text not null check (type in ('INCOME', 'EXPENSE', 'TRANSFER', 'DEBT_REPAYMENT', 'ADJUSTMENT')),
  description           text not null,
  raw_input             text,
  transaction_date      date not null default current_date,
  idempotency_key       text,
  is_deleted            boolean not null default false,
  created_by            text not null default 'USER',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.diary_entries (
  id           uuid not null default uuid_generate_v4() primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         date not null default current_date,
  mood         smallint not null check (mood >= 1 and mood <= 5),
  workout      boolean not null default false,
  workout_note text,
  food_quality text not null check (food_quality in ('HEALTHY', 'AVERAGE', 'JUNK')),
  notes        text,
  is_deleted   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.keyword_rules (
  id          uuid not null default uuid_generate_v4() primary key,
  user_id     uuid default auth.uid() references auth.users (id) on delete cascade,
  keyword     text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at  timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 2. Indexes
--
-- transactions_user_idempotency_uidx is not partial on is_deleted: a key on a
-- soft-deleted row still blocks a new row with the same key. That matches the
-- ledger RPCs' replay rule (ADR 0023: a retry replays against any row with
-- its key, live or deleted, so a deleted intent is never resurrected), so it
-- is recorded as it is rather than dropped. 20260909_transfer_funds.sql adds
-- the partial transactions_user_idempotency_key_uniq beside it.
-- -----------------------------------------------------------------------------
create index if not exists categories_user_name_idx on public.categories (user_id, name);
create index if not exists debts_user_created_idx on public.debts (user_id, created_at desc);
create index if not exists diary_entries_user_date_idx on public.diary_entries (user_id, date desc);
create index if not exists keyword_rules_user_idx on public.keyword_rules (user_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date desc, created_at desc);
create index if not exists wallets_user_created_idx on public.wallets (user_id, created_at);
create unique index if not exists transactions_user_idempotency_uidx
  on public.transactions (user_id, idempotency_key)
  where idempotency_key is not null;


-- -----------------------------------------------------------------------------
-- 3. Row-level security and its policies
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.wallets       enable row level security;
alter table public.categories    enable row level security;
alter table public.debts         enable row level security;
alter table public.transactions  enable row level security;
alter table public.diary_entries enable row level security;
alter table public.keyword_rules enable row level security;

do $$
declare
  p record;
begin
  for p in
    select * from (values
      ('categories',    'Users can manage their own categories',             'all',    'user_id'),
      ('debts',         'Users manage their own debts',                      'all',    'user_id'),
      ('diary_entries', 'Users can manage their own diary entries',          'all',    'user_id'),
      ('keyword_rules', 'Users can manage their own keyword rules',          'all',    'user_id'),
      ('profiles',      'Users can view their own profile',                  'select', 'id'),
      ('transactions',  'Users can manage their own transactions',           'all',    'user_id'),
      ('wallets',       'Users can access their own wallets',                'all',    'user_id')
    ) as t(tbl, name, cmd, owner_col)
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = p.tbl and policyname = p.name
    ) then
      if p.cmd = 'select' then
        execute format(
          'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = %I)',
          p.name, p.tbl, p.owner_col);
      else
        execute format(
          'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)',
          p.name, p.tbl, p.owner_col, p.owner_col);
      end if;
    end if;
  end loop;
end
$$;


-- -----------------------------------------------------------------------------
-- 4. A profile row for every new account
--
-- Created only when missing, never replaced: Phase 52 set its search_path and
-- grants (20260928_phase52_security_ledger.sql), and Phase 58s added
-- handle_user_updated beside it.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    execute $fn$
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $body$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$body$
$fn$;
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;


-- -----------------------------------------------------------------------------
-- 5. Realtime: the tables the app subscribes to
--
-- Skipped where there is no supabase_realtime publication (a plain
-- PostgreSQL).
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['categories', 'debts', 'diary_entries', 'transactions', 'wallets'] loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;
