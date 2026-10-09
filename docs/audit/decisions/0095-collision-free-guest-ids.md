# 0095: A guest record's id is unique within one millisecond

**Status:** Accepted. Code `a26b103`, branch `phase-119-robust-guest-ids`; not merged. No migration; live drift run `37899237043`: no drift, 20 migrations.
- **Fixes** the failure of `main` CI after Phase 118 (ADR `0094`, Release): run `37885529942`.

**Date:** 2026-10-09

## Context

1. **Every record a guest made had the id `<prefix>-${Date.now()}`:** wallets (`w-`), categories (`cat-`), transactions (`tx-`), debts (`debt-`), smart rules (`kr-`), quick templates (`preset-`) and diary entries (`diary-`). A guest's CSV import used `tx-import-${Date.now()}-<row>` for its rows and `import-${Date.now()}-<row>` for their keys.
2. **Two records of one kind made in the same millisecond shared an id.** Every edit and delete finds a record by id, so the guard or the write reached both. A wallet's opening-balance row (`tx-opening-<wallet id>`) inherited its wallet's.
3. **`main` CI after Phase 118 failed on it.** `template-context`'s edit test made two templates in one millisecond on CI's runner: one id, so the duplicate-name check (`p.id !== id`) skipped both and a rename to a used name went through. The pull request's run had passed on timing. With `Date.now()` frozen the test failed every time.
4. **A person cannot make two of one kind in one millisecond,** so the live app was not hit in practice. Code that makes records in a loop can, and so can a test.
5. **Signed-in records are not affected:** their ids come from the database.

## Decision

1. **`generateEntityId(prefix)`** (`src/utils/ids.ts`) returns `<prefix>-<ms>-<12 hex>`:
   - **The time** keeps an id readable and roughly ordered, as before.
   - **48 random bits** keep two ids from one millisecond apart. Ten thousand in one millisecond, in the test, are all distinct.
   - **The bits come from `crypto.getRandomValues`,** which, unlike `crypto.randomUUID`, works outside a secure context: the LAN dev server over `http` (CLAUDE.md, `generateIdempotencyKey`). With no `crypto` at all it falls back to `Math.random`, which still separates ids in practice.
2. **All seven kinds use it,** with their old prefixes. **The guest CSV import draws one `import-<ms>-<hex>` per import** and builds each row's id (`tx-import-...-<row>`) and key (`import-...-<row>`) from it, so two imports never share either. A re-import still adds new rows: there is no dedupe (ADR `0019`).
3. **Stored ids are kept.** Nothing in `src/`, `unit/` or `tests/` parses an id or checks its prefix, so a device's old `w-1790...` ids and new `w-1790...-a1b2c3d4e5f6` ids live side by side. No migration of stored data.
4. **Left as it is:** `csvExchange`'s `previewId` (`preview-${Date.now()}`), which names a transient import preview and is never stored; and `generateIdempotencyKey`, already random.

## Tests

- **`unit/entity-ids.test.tsx` (new, 11), with `Date.now()` frozen for every test:**
  - **the helper (3):** 10,000 ids in one millisecond are distinct and keep the prefix and the time; distinct with `crypto.randomUUID` missing; distinct with no `crypto` at all.
  - **the call sites (8):** two wallets (and their two opening rows), two categories, two transactions (deleting one leaves the other), two debts, two rules, two templates (a rename to the other's name is refused), two diary entries, and two CSV imports (distinct row ids and keys), each made in the same millisecond.
  - **All 11 failed first,** the call sites on the old ids and the helper against a stub that returned the old format.
- **`unit/template-context.test.tsx`, the test that failed on `main`:** the same file with `Date.now()` frozen failed before and passes 6 of 6 now; the unchanged file passed 10 runs in 10.

- **Gate:** lint clean; unit 1331/1331 in 60 files (42 s); Playwright 485 passed, 6 skipped, 1 failed of 492 (11.4 m, 4 workers). The failure was the WebKit painting stall (ADR `0058`) on `gotoTab`'s Transactions tab click in `soft-delete.spec.ts`, with no assertion reached: the trace's last frame came 234 ms before the click, and none after. Repeated per the owner's rule: 60 of 60 on WebKit. No migration; live drift run `37899237043`: no drift, 20 migrations.

## Bundle

`main` at `28473b4` built in a worktree with `.env`, gzip level 9 on both sides. The entry 194,599 / 56,884 to 194,826 / 56,963 B (+227 / +79 gzip: `generateEntityId` and its eight callers are in it); all app JS 881,167 / 268,064 to 881,394 / 268,083 (+227 / +19; other chunks' gzip moves a few bytes with the entry's hash), 40 files; cold start still three scripts.
