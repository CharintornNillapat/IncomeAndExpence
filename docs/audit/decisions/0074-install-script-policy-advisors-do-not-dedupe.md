# 0074: Install scripts are an allow-list; the advisors re-read; the Do NOT list keeps what is stated nowhere else; the slow local runs are the machine

**Status:** Accepted. Released: build `ab357f9`, docs `03133a6`, hash backfill `dd4d969`, merged into `main` as `83161ad` (PR #49); Vercel `dpl_8q6Kn4Atybvfvw1DDKBiUQvWeWLB` READY in `icn1`. No migration, and no change to `src/`.
- **Amends** ADR `0067`'s advisor triage: the accepted `SECURITY DEFINER` count is eleven signatures, not nine.

**Date:** 2026-10-06

## Context

1. **Vercel's build warned about esbuild's install script.** Its npm printed "1 package has install scripts not yet covered by allowScripts: esbuild@0.25.12 (postinstall: node install.js)". npm now reads an `allowScripts` field in `package.json`. In the current release the field only warns about scripts nobody has reviewed, and npm's documentation says "a future release will block unreviewed install scripts". This project has exactly one dependency with an install script: `npm approve-scripts --allow-scripts-pending` lists `esbuild@0.25.12` and nothing else.
2. **What esbuild's script does** (`node_modules/esbuild/install.js`, read in full):
   - when npm skipped the optional `@esbuild/<platform>` package that carries the binary, it installs or downloads that package;
   - on Linux and macOS it replaces the `esbuild` command-line shim with a hard link to the binary;
   - it checks the binary's version.

   Vite calls esbuild's JavaScript API, which finds the binary in the optional package itself. The lockfile carries the optional packages, and nothing here runs the `esbuild` command.
3. **CLAUDE.md's advisor note said "nine" `SECURITY DEFINER` functions.** That count dates from ADR `0067`'s triage. Phase 93 added a second `transfer_funds` signature (ADR `0069`), and Phase 96 added `delete_user_account` (ADR `0072`).
4. **The Do NOT list repeated its own file.** It had 133 rules, and most of them restated, sometimes word for word, a rule its parent section already gives with the reason. That made the list long to read for little gain, and gave every rule two places to fall out of date.
5. **The last two local Playwright runs took 11.8 and 11.1 min**, against 7.4 to 7.9 min in Phases 94 and 95, on a suite that grew by 6 runs.

## Decision

### 1. `allowScripts`: esbuild's script is denied

- `npm deny-scripts esbuild` wrote `"allowScripts": { "esbuild": false }` to `package.json`. The lockfile is unchanged, and nothing is pending (`npm approve-scripts --allow-scripts-pending`: "No packages with unreviewed install scripts").
- **Why deny rather than approve:** the script does nothing this project uses (Context 2). Denying it means no install-time code from esbuild runs at all, and a later esbuild version needs no new approval. An approval would have been pinned to `0.25.12` and would come back as a warning on every esbuild upgrade.
- **The rule from here on** (CLAUDE.md, "Known Constraints"): a new dependency with an install script shows in `npm approve-scripts --allow-scripts-pending`. Approve it pinned or deny it, one package at a time and on purpose, never with `--all`.
- **Verified:**
  - `npm ci` from clean installs 475 packages with no install-script warning;
  - esbuild's API transforms a TypeScript sample (`esbuild 0.25.12`, `export const a=2;`);
  - `npm run build` on that install gives an entry script, stylesheet, `AccountModal`, `DiaryView`, `accountExport` and five vendor chunks byte-identical to production's Phase 97 files (10 of 10);
  - the Linux side is CI's `npm ci` in the Playwright container, and the Vercel preview build of this branch (see Verification).

### 2. The advisors, read again on 2026-10-06

- **Security:**
  - `authenticated_security_definer_function_executable`, 11 findings. That's ten functions, since `transfer_funds` has two signatures until the 20260909 one is dropped; `delete_user_account` is the new one.
  - `rls_enabled_no_policy` on `ai_request_counts` (ADR `0049`).
  - Leaked password protection off (the owner's).
- **Performance:**
  - five unindexed foreign keys (measured in ADR `0073`: no index until `public.transactions` passes 100,000 rows);
  - three unused indexes.
- **Nothing new.** CLAUDE.md now says eleven signatures, ten functions, and why.

### 3. The Do NOT list keeps only what is stated nowhere else

- **96 of 133 rules were removed.** Each one is removed only where its parent section states the same rule as a rule, not just as a description. The table below names the section and the sentence that still carries it.
- **A script made the edit and refused to run otherwise:**
  - every quoted sentence must exist outside the Do NOT section;
  - every rule's opening words must match exactly one Do NOT line.
- **37 rules stay**, the ones no section states, for example:
  - the `DISABLE_HMR` handling;
  - the browser cache in CI;
  - `pull_request_target`;
  - the fifth request-intercepting spec;
  - `Server-Timing` contents;
  - the identity palette's hues;
  - the worktree `.env` for bundle measurements.

  Rules where a section only describes the behaviour also stay, for example probes before applying a migration, PGlite's version, and the CSP's `'unsafe-inline'`.
- **No rule changed meaning; no section changed.** The heading now says that the list holds only the rules stated nowhere else.
- **Size:** CLAUDE.md went from 798 lines / 161,676 B to 702 / 146,536 before this phase's additions (the install-script rule, the advisors line, the heading's sentence).

### 4. The slow local runs are the machine, evenly

- **Measured:** each spec's summed test time in two local full runs, compared with `main` CI on the same code (run `37426684622`, Phase 97's merge):

  | | Phase 97 local | Phase 98 local | CI |
  |---|---|---|---|
  | Wall time | 11.1 min | 10.7 min | 285 s (6 jobs) |
  | Summed test time | 2,543 s | 2,412 s | 1,219 s |

- **Per spec, local runs take 1.5 to 3.3 times their CI time, most between 1.7 and 2.5.** No spec stands out. The largest, `account-and-mobile-nav.spec.ts` (251 s), is 2.3 times CI, like the rest. The two local runs agree spec by spec.
- **CI has not slowed:** `main` ran 323 s in Phase 95, then 304 s and 285 s. So no change in the app or the tests made tests slower. The local slowdown is the machine, applied evenly.
- **Conditions during the measurement:**
  - 12 logical CPUs;
  - 6.2 of 15.7 GB free;
  - VS Code and Brave open;
  - 3 days since the last boot.
- **The unit suite showed the same effect, and one more cause:**
  - 84.5 s right after `npm ci`, which deletes `node_modules` and the caches in it;
  - then 42.9 and 42.8 s, as CLAUDE.md's "~40 s" says.

  The Playwright warm-up likewise took 12.0 s, against 3.4 s with warm caches.
- **No change:** local workers stay at 4 (ADR `0055`). A local run on this machine takes 10 to 12 min while other work runs. Before reading a local slowdown as a regression, compare it with CI's time for the same code.

## Verification

- `npm run lint` clean.
- `npm run test:unit` 1061/1061 in 41 files.
- Playwright 462 passed + 6 skipped of 468 in 10.7 min, first run, no failure.
- The drift replay is unchanged: 18 migrations, 17 functions, 68 function grants.
- **On CI:** the pull request's run `37431460824` passed every job in 285 s, 462 passed and 6 skipped with no flaky test, unit 1061, and its eight `npm ci` installs on Linux printed no install-script warning; the drift workflow on the branch (`37431460417`) found no drift with all 18 migrations.
- **On the preview:** the Vercel preview (`dpl_6gw57CuAxfUDaaRTc85WNfSYaLcE`, READY in `icn1`) installs and goes straight to `npm run build`, without the four `npm warn install-scripts` lines Phase 97's production build printed there.

## Release (2026-10-06)

- **Merge:** PR #49 merged into `main` as `83161ad`, whose tree is identical to `dd4d969`. Vercel `dpl_8q6Kn4Atybvfvw1DDKBiUQvWeWLB` is READY in production (`icn1`); a function answers from `icn1`. Its install step reads "up to date in 2s" and goes straight to `npm run build`, with none of the four `npm warn install-scripts` lines Phase 97's production build printed there. It serves the same entry script, stylesheet and chunks as Phase 97, byte for byte (10 of 10), as no app code changed.
- **CI:** `main` CI on the merge (run `37436490898`) passed every job with no flaky test and no install-script warning in 274 s end to end, 24 s of it the merge job (unit 1061; 462 passed, 6 skipped).

## Consequences

- **A future npm that blocks unreviewed install scripts changes nothing here.** esbuild's script is reviewed and denied, and a new one is decided when it arrives.
- **Before adding a Do NOT, check whether its section says it.** If it does, strengthen the section instead. The list is for the rules that have no section.
- **A slow local run is compared with CI first.**

## Appendix: the 96 removed rules and where each is stated

| Removed Do NOT (opening words) | Section | The sentence that states it |
|---|---|---|
| Do NOT import the root `mathjs` | Known Constraints or Gotchas | Always import `{ evaluate }` from `mathjs/number`, never full `mathjs`. |
| Do NOT bypass the Zod schemas | Validation & the MutationResult pattern | All write paths validate with Zod (`src/utils/zodSchemas.ts`) **before** mutating state or hitting the network |
| Do NOT perform hard deletions | Coding Conventions | The one hard delete is account deletion (`delete_user_account`, ADR `0072`), which erases the whole account. |
| Do NOT let `delete_user_account` take | Phase 96 (ADR `0072`) | **A new table that holds an account's data references `auth.users` with `ON DELETE CASCADE` and joins the probe's `rows_of` count** |
| Do NOT write an export row with a spread | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | **Signed in, it refuses while a load runs or after one failed a read** |
| Do NOT hardcode production API credentials | Known Constraints or Gotchas | do not commit production secrets here. |
| Do NOT add redundant state management | State: context + domain hooks | Do not add another state library (Redux, Zustand). |
| Do NOT introduce a second currency | Currency: THB only | The app is single-currency (Thai Baht) and must stay that way unless the ledger gains real conversion. |
| Do NOT format money or dates inline | Currency: THB only | Do not hand-roll `฿` + `toFixed(2)` or `toLocaleString(...)` |
| Do NOT re-add a TRANSFER option | Transaction entry: one configurable engine | Do not re-add a TRANSFER type here. |
| Do NOT let the note parser overwrite | Express note entry: the note drives the form | **A manual edit to the amount field permanently disables extraction for that entry.** |
| Do NOT give the debt payoff preview | Debt repayment: the payoff block mirrors the ledger | **A repayment cannot exceed what is owed, at either layer (ADR `0016`, amending `0015`).** |
| Do NOT let the smart-rule chip write | Smart rules: the form offers one, it never writes one unasked | **"No existing rule matches" is an invariant, not a politeness.** |
| Do NOT make a rule write a precondition | Smart rules: the form offers one, it never writes one unasked | Do not make the rule write a precondition of the transaction write. |
| Do NOT give voice input a pipeline | Voice input: the transcript is typing | **Voice has no pipeline of its own, and must not get one.** |
| Do NOT feature-detect `SpeechRecognition` | Voice input: the transcript is typing | **Dictation appends to whatever was in the note, never replaces it.** |
| Do NOT give each CSV worker its own wait | CSV import: the same two layers, before anything commits | then holds **every** worker until `resumesAt` |
| Do NOT put the import's countdown | CSV import: the same two layers, before anything commits | The countdown is never in it. |
| Do NOT read a 429 as the guest firewall's | Categorization: rules first, Jev second | No other upstream header crosses, and no other status gets a `Retry-After`. |
| Do NOT let the CSV importer classify automatically | CSV import: the same two layers, before anything commits | **De-duplicate before dispatch, never via the cache alone.** |
| Do NOT widen `classifyDescription`'s contract | CSV import: the same two layers, before anything commits | **`classifyDescription`'s signature and behaviour are frozen.** |
| Do NOT add CSV import deduplication | CSV import: the same two layers, before anything commits | **There is no import deduplication, deliberately.** |
| Do NOT let a model emit a currency figure | Monthly insights: the model judges, the app states the numbers | **Every ฿ amount comes from `formatCurrencyAmount` over ledger data** |
| Do NOT send raw ledger content to `/api/insights` | Monthly insights: the model judges, the app states the numbers | Do not add an error branch |
| Do NOT delete or bypass `smartMatcher.ts` | Categorization: rules first, Jev second | Two layers, in a fixed order. Do not reverse them and do not collapse them into one. |
| Do NOT let `classifyDescription()` throw | Categorization: rules first, Jev second | **`classifyDescription()` must never throw or reject.** |
| Do NOT accept Jev question wording | Categorization: rules first, Jev second | **rejects any client-supplied `instructions`/`criteria`/`model`/`state`/`questions`** |
| Do NOT add a `VITE_`-prefixed TypeSafe key | Categorization: rules first, Jev second | **`TYPESAFE_API_KEY` has no `VITE_` prefix** so Vite cannot inline it |
| Do NOT raise CI's 2 workers per runner | Testing | 3 workers in one job saved only 7 to 13% and made every test about a third slower. |
| Do NOT reset a panel's feedback in an effect | State: context + domain hooks | **A panel for one entity is keyed by its id** |
| Do NOT reset state in an effect when an input changes | State: context + domain hooks | **"Reset when an input changes" happens during render:** |
| Do NOT move `InlineMathInput`'s seed back | Express note entry: the note drives the form | **A seed is applied during render and is never reported back** (ADR `0057`). |
| Do NOT set a live region's text from a passive effect | State: context + domain hooks | **Text a live region speaks is set where its event happens** (ADR `0055`). |
| Do NOT put unit tests under `tests/` | Unit tests: what the browser cannot reach | **The directory is `unit/`, not `tests/unit/`, and that is load-bearing.** |
| Do NOT move Vitest config onto `vite.config.ts` | Unit tests: what the browser cannot reach | **`vitest.config.ts` is its own file, never a `test` key on `vite.config.ts`.** |
| Do NOT use `process`, `Buffer` | Categorization: rules first, Jev second | **An exception takes a reason:** |
| Do NOT export a symbol from `src/` solely | Unit tests: what the browser cannot reach | **Nothing in `src/` was widened to be testable.** |
| Do NOT test a ref-mirror, ordering or post-`await` | Unit tests: what the browser cannot reach | `act()` flushes React before the awaited code resumes, which made F1's double write come out correct |
| Do NOT build a remote write from a ref read | State: context + domain hooks | **The same rule holds across an `await`: never build a remote write from a ref read after the optimistic `setState` it mirrors.** |
| Do NOT apply balance changes after a failed insert | Categorization: rules first, Jev second | **Both proxies pass an upstream 429 through as 429** |
| Do NOT send a signed-in ledger write as an absolute balance | Atomic ledger writes (ADR `0023`) | **The legacy absolute-write paths remain only as the missing-function fallback** |
| Do NOT add an overdraft check to the ledger RPCs | Atomic ledger writes (ADR `0023`) | **No overdraft check in SQL** (ADR `0014`). The dropped `create_ledger_transaction` had one; do not reintroduce it. |
| Do NOT treat an RPC error without a SQLSTATE | Atomic ledger writes (ADR `0023`) | **An error with no SQLSTATE is an unknown outcome** |
| Do NOT `create or replace` (or otherwise replace) | The migrations rebuild the live schema (Phase 87, ADR `0063`) | **It holds nothing a later file drops** |
| Do NOT call `supabase.auth.signOut()` without | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | **`signOut()` passes `scope: 'local'` explicitly.** supabase-js defaults to `'global'` |
| Do NOT reset to guest state on any auth event | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | keep that check after every `await` in `loadSupabaseData`. |
| Do NOT reintroduce a browser-built session list | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | Never reintroduce a browser-built session list. |
| Do NOT rely on token refresh alone | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | **A revoked device evicts itself within a minute** |
| Do NOT sign a device out because `getUser()` | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | **A 401 is a reason to check, never a sign-out by itself** |
| Do NOT allow a negative amount on any type but ADJUSTMENT | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | **every other type stays strictly positive** |
| Do NOT give the starter wallets or a new account | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | **The starter wallets open at ฿0.00** (ADR `0040`) |
| Do NOT migrate an existing account's | Phase 54 (ADR `0040`) | **New accounts only.** Accounts already seeded and stored guest ledgers keep their balances |
| Do NOT render the mobile More sheet inside | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | The More sheet renders as a **sibling** of `<nav>`, never a child |
| Do NOT animate a balance, scale a control | Coding Conventions | No framer `whileHover` / `whileTap`, no `scale-*` for a selected state, no springs, no entrance animations. |
| Do NOT place a fixed element below `md` | Accounts, sessions, sign-out and the ledger's edges (ADR `0024`) | Any other fixed element added below `md` must clear the nav the same way. |
| Do NOT spin or pulse an icon while the app waits | Coding Conventions | Continuous motion (`animate-spin`, `animate-pulse`) only while real work runs. |
| Do NOT give a toast or banner `z-50` | Coding Conventions | Give a new fixed element a layer from this list by meaning, never a tie with `Modal`. |
| Do NOT give `TransactionForm` a heading back | Transaction entry: one configurable engine | **The form has no heading of its own** |
| Do NOT move `Modal`'s opener or stack effect | Coding Conventions | **Focus returns to the opener in a second layout effect on close**, not only in the cleanup |
| Do NOT move focus in `Modal` without giving back | Coding Conventions | **An open dialog keeps its focus when React re-runs its effects** |
| Do NOT trace only retries on CI | Testing | **CI keeps the trace of a test's first failed attempt** |
| Do NOT turn CI's trace screenshots back on | Testing | **CI's trace has no screencast** |
| Do NOT drop `<main>`'s minimum height | Coding Conventions | a new weight, subset or face needs its row measured the same way. |
| Do NOT make `Modal`'s "reachable" check depend on layout | Coding Conventions | "Reachable" is computed at key-press time from markup and computed style, never layout |
| Do NOT let a cloud load fail without setting `syncError` | State: context + domain hooks | **A failed cloud load is never silent** (ADR `0026`). |
| Do NOT sign a transfer outside one wallet's own view | Coding Conventions | signs a transfer inside one wallet's own view only. |
| Do NOT compute spending, income, a net figure | Money rules: compute through `src/selectors/` (ADR `0028`) | computes it there, never with its own inline filter. |
| Do NOT count a debt repayment, an adjustment or a transfer | Money rules: compute through `src/selectors/` (ADR `0028`) | A transfer, a debt repayment and an adjustment are neither. |
| Do NOT hand-type a button's classes | Coding Conventions | **Buttons are `ui/Button` and `ui/IconButton`** (ADR `0029`), never a re-typed class string. |
| Do NOT colour a chip's background or text | Coding Conventions | `Chip` (neutral pill, item colour on a 7px dot only) |
| Do NOT give `updateTransaction` a legacy fallback | Phase 58b (ADR `0033`) | **`updateTransaction` has no legacy fallback.** |
| Do NOT move `update_transaction`'s replay check | Atomic ledger writes (ADR `0023`) | **its replay check runs before its stale guard** |
| Do NOT route editing through `TransactionForm` | Transaction entry: one configurable engine | **Editing is not an entry flow and does not go through this form** |
| Do NOT let an `/api/*` proxy call TypeSafe before | Categorization: rules first, Jev second | TypeSafe is never called on a 401 or 503. |
| Do NOT accept a token signed with `none` or HS256 | Categorization: rules first, Jev second | ES256 or RS256 only, so `none` and HS256 are refused |
| Do NOT re-run a migration whose function a later file | Phase 88 (ADR `0064`) | **Never re-run a migration a later file has replaced.** |
| Do NOT change one proxy's shared code without the other | Categorization: rules first, Jev second | **`unit/proxy-parity.test.ts` fails when they differ** |
| Do NOT await the key set prefetch at load | Categorization: rules first, Jev second | Nothing awaits it and it never rejects |
| Do NOT write a migration's history row by hand | The migrations rebuild the live schema (Phase 87, ADR `0063`) | **A migration applied in the SQL editor gets its history row from `npm run migration:print-history -- supabase/migrations/<file>.sql`** |
| Do NOT send `p_user_id` to `transfer_funds` from the client | Atomic transfers | The client calls it, sending no `p_user_id` |
| Do NOT give the drift check a credential that can read app data | The migrations rebuild the live schema (Phase 87, ADR `0063`) | It refuses (exit 2) a role that is a superuser, bypasses row-level security or can reach any table in `public`. |
| Do NOT let the drift check accept an unverified certificate | The migrations rebuild the live schema (Phase 87, ADR `0063`) | TLS is always verified |
| Do NOT send an `Authorization` header from a guest | Categorization: rules first, Jev second | A guest must send no `Authorization` header at all. |
| Do NOT escape a CSV cell's formula start in the Amount column | CSV import: the same two layers, before anything commits | **Amount is never escaped:** |
| Do NOT add a second `Content-Security-Policy` header | Response headers: frames refused, the CSP enforced (ADR `0068`, `0070`) | **A new external origin needs its entry in the policy first.** |
| Do NOT add `report-to` or a `Reporting-Endpoints` header | Response headers: frames refused, the CSP enforced (ADR `0068`, `0070`) | **`report-uri` alone, never `report-to`:** |
| Do NOT send a wallet's `balance` through | Wallet surface ownership (ADR `0034`, amending `0008`) | which sends only the columns it is given - never `balance`, which moves only through the ledger. |
| Do NOT bring back a wallet popup | Wallet surface ownership (ADR `0034`, amending `0008`) | Do not reintroduce a wallet popup on the Dashboard. |
| Do NOT offer an archived wallet in a new-entry picker | Wallet surface ownership (ADR `0034`, amending `0008`) | leaves net worth (`isActiveWallet`) and every new-entry picker |
| Do NOT send `remaining_amount` or `is_settled` through `editDebt` | Debt payoff page: an edit never touches what is owed (ADR `0035`) | **`DebtEditSchema` refuses a borrowed total below what is still owed.** |
| Do NOT write a debt off without the Mark as paid off confirmation | Debt repayment: the payoff block mirrors the ledger | "Mark as paid off" confirms first |
| Do NOT start the diary form from defaults | Daily diary: the form starts from the day's own entry (ADR `0036`) | **No future day can be logged:** |
| Do NOT colour a diary option by how good it is | Daily diary: the form starts from the day's own entry (ADR `0036`) | No emoji and no colour by meaning, anywhere on the page. |
| Do NOT make a System category row a button | Categories page: one colour each, a locked System group (ADR `0037`) | a System row is not a button and names itself with `systemCategoryLabel` |
| Do NOT seed from the client. | Phase 64 (ADR `0039`) | **The server decides whether an account is new.** |
| Do NOT remap colours on the Supabase load | Categories page: one colour each, a locked System group (ADR `0037`) | runs in two places that must move together: |
