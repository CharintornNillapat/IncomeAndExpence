-- =============================================================================
-- Phase 63 (ADR 0038): spec 5.1's one-time colour migration. DATA ONLY.
--
-- Moves every shipped category and starter wallet that still holds the colour
-- it shipped with onto spec section 1's identity palette, plus spec 5.1's own
-- rows (the categories "camel" and "กิจนิมนต์", and the wallets Cash, Main and
-- Sub). `src/utils/identityColorMigration.ts` does the same for what a device
-- stores; the two must move together.
--
-- Rules, matching the client step for step:
--   - A row moves only while it is live and still holds its old colour,
--     matched by trimmed, case-insensitive name and the old colour,
--     case-insensitive. A colour someone picked themselves is left alone, and
--     so is a deleted row.
--   - Every copy of a name moves together (the pre-Phase-30 seeding race left
--     some accounts with several live copies of each shipped category; this
--     migration recolours them all and removes none - the owner's decision).
--   - L9: categories are walked in spec 5.1's order, one account at a time.
--     When another live Expense or Income category of a different name in the
--     same account already holds the target, the group takes the first free
--     identity colour in palette order, and keeps its old colour if none is
--     free. Debt Repayment and Balance Adjustment share #6B7385 by design and
--     are never a collision.
--   - The named rows match by name and old colour in any account. When this
--     was written only the owner's account held them.
--
-- Safety: one DO block, so it lands whole or not at all. Idempotent: a second
-- run finds no live row on an old colour and changes nothing. No schema change,
-- no grant, no row inserted or deleted.
--
-- Probe: supabase/tests/20261002_phase63.probe.sql.
-- =============================================================================

do $phase63$
declare
  palette constant text[] := array[
    '#D9A066', '#6C8EEF', '#4FB7A8', '#F59E6B', '#E879A6', '#7DA2F0',
    '#B69CF5', '#5CC8B8', '#C7B38A', '#8FA8C8', '#D98FD0', '#9C8CD9'
  ];
  step record;
  account uuid;
  is_movement boolean;
  target text;
  taken text[];
  n bigint;
  moved_categories bigint := 0;
  moved_wallets bigint := 0;
begin
  for step in
    select * from (values
      (1,  'food & dining',        '#f87171', '#E879A6'),
      (2,  'groceries',            '#fb923c', '#F59E6B'),
      (3,  'housing & utilities',  '#38bdf8', '#7DA2F0'),
      (4,  'shopping & apparel',   '#a78bfa', '#B69CF5'),
      (5,  'transport & fuel',     '#facc15', '#5CC8B8'),
      (6,  'camel',                '#facc15', '#C7B38A'),
      (7,  'primary salary',       '#4ade80', '#8FA8C8'),
      (8,  'freelance & side gig', '#34d399', '#D98FD0'),
      (9,  'กิจนิมนต์',              '#34d399', '#9C8CD9'),
      (10, 'debt repayment',       '#f43f5e', '#6B7385'),
      (11, 'balance adjustment',   '#94a3b8', '#6B7385')
    ) as m(ord, name_key, from_color, to_color)
    order by ord
  loop
    for account, is_movement in
      select c.user_id, bool_or(c.type::text in ('DEBT_REPAYMENT', 'ADJUSTMENT'))
      from public.categories c
      where not c.is_deleted
        and lower(btrim(c.name)) = step.name_key
        and lower(c.color) = step.from_color
      group by c.user_id
    loop
      target := step.to_color;

      if not is_movement then
        select coalesce(array_agg(distinct lower(c.color)), '{}') into taken
        from public.categories c
        where c.user_id = account
          and not c.is_deleted
          and c.type::text not in ('DEBT_REPAYMENT', 'ADJUSTMENT')
          and lower(btrim(c.name)) <> step.name_key;

        if lower(target) = any(taken) then
          -- No row leaves `target` null: the group keeps its old colour.
          select p into target
          from unnest(palette) with ordinality as u(p, i)
          where lower(p) <> all(taken)
          order by i
          limit 1;
        end if;
      end if;

      if target is not null then
        update public.categories c
        set color = target
        where c.user_id = account
          and not c.is_deleted
          and lower(btrim(c.name)) = step.name_key
          and lower(c.color) = step.from_color;
        get diagnostics n = row_count;
        moved_categories := moved_categories + n;
      end if;
    end loop;
  end loop;

  -- `updated_at` moves as it does on any edit through `updateWallet`.
  update public.wallets w
  set color = m.to_color, updated_at = now()
  from (values
    ('main checking',    '#0284c7', '#6C8EEF'),
    ('checking account', '#0284c7', '#6C8EEF'),
    ('cash wallet',      '#16a34a', '#D9A066'),
    ('savings reserve',  '#7c3aed', '#4FB7A8'),
    ('cash',             '#ef4444', '#D9A066'),
    ('main',             '#16a34a', '#6C8EEF'),
    ('sub',              '#0284c7', '#4FB7A8')
  ) as m(name_key, from_color, to_color)
  where not w.is_deleted
    and lower(btrim(w.name)) = m.name_key
    and lower(w.color) = m.from_color;
  get diagnostics moved_wallets = row_count;

  raise notice 'phase63: % category rows and % wallet rows moved', moved_categories, moved_wallets;
end;
$phase63$;
