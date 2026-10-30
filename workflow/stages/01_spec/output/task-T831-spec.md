# T831 spec: fix the five react-hooks/exhaustive-deps warnings in FinanceContext.tsx

Phase 161, branch `phase-161-finance-hooks-lint` (cut from `main` at `883a6a6`), slug `finance-hooks-lint`. First task of the phase; T832 (wire ESLint into `npm run lint` and CI) follows and depends on this task leaving `npm run lint:hooks` at 0 warnings and 0 errors. This task does not ship the phase: `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` are T832's. Reviewer tier: strict (`fin-reviewer-strict`, Opus) for every review round. Money path (`src/context/FinanceContext.tsx`): the orchestrator pauses for the owner after this spec, and the PR is merged by the owner.

## 1. Goal

Clear the five `react-hooks/exhaustive-deps` warnings `npm run lint:hooks` reports in `src/context/FinanceContext.tsx`, with no behaviour change: no extra re-render, no extra effect run, no change of callback identity a context subscriber could observe, and no change to any money arithmetic. After this task `npm run lint:hooks` reports 0 warnings and 0 errors across `src api`, so T832 can wire it into `npm run lint`.

## 2. Target files

```
docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md
docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md
unit/rerender-matrix.test.tsx
src/context/FinanceContext.tsx
```

- `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md` is new; write it first, before any test or code (Edit 8).
- **ADR decision: a new ADR 0115, not an amendment of ADR 0113.** ADR 0113 is the opt-in decision: its title and D2 ("not added to `npm run lint`, not added to CI") are what Phase 161 reverses, and its D6 is the deferral this phase carries out. Amending it would leave an ADR titled "opt-in" describing a required lint. The repo's precedent for a reversal is a new ADR that names the one it supersedes (ADR 0090 after ADR 0078). ADR 0113 gets only a pointer on its Status line (Edit 9). ADR 0115 covers the whole phase: D1 and D2 are this task, D3 is T832's, whose spec fixes its exact script and flags.
- Bookkeeping, always allowed: `docs/audit/task-ledger.md` (Edits 10 and 11 plus the T831 row) and `workflow/stages/02_build/output/*`.

## 3. Context to read

- `docs/contexts/client-state.md`: the ref-mirror rule that keeps the actions context stable (`client-state.md:7`), the three things that stay in `FinanceProvider` for every slice and `unit/rerender-matrix.test.tsx` (`:12`), and the unit harness notes (`:128-130`, in particular "flush effects first" before an action whose guard reads a ref mirror, which the new test does with `settle()`).
- `docs/contexts/ui-and-e2e.md`: only its Playwright section, for the Playwright gate (ports, chromium first).

## 4. Current behaviour

`npm run lint:hooks` on `883a6a6` (run for this spec) prints exactly five problems, all warnings, all in `src/context/FinanceContext.tsx`, and `0 errors`:

| Line | Hook | What the rule asks for |
|---|---|---|
| 881 | `resetToGuestState` (`useCallback`, `:839-881`, deps `[]`) | `setDiaryEntries`, `setKeywordRules`, `setPresets` |
| 967 | `loadSupabaseData` (`useCallback`, `:920-967`, deps `[seedInitialUserAccount]`) | `setDiaryEntries`, `setKeywordRules` |
| 1320 | `restoreBackup` (`useCallback`, `:1306-1320`, deps `[isAuthenticated]`) | `setDiaryEntries`, `setKeywordRules`, `setPresets` |
| 1710 | `deleteCategory` (`useCallback`, `:1669-1710`, deps `[isAuthenticated, markLocalWrite]`) | `keywordRulesRef` |
| 2094 | `applyPreset` (`useCallback`, `:2067-2094`, deps `[addTransaction]`) | `presetsRef` |

All five are `useCallback`s; none is an effect. Where each missing name is used: `resetToGuestState` calls `setKeywordRules(DEFAULT_KEYWORD_RULES)`, `setPresets([])` and `setDiaryEntries([])` (`:871`, `:872`, `:875`); `loadSupabaseData` passes `setKeywordRules` and `setDiaryEntries` to `readCloudSlices` (`:938`, `:941`); `restoreBackup` calls all three (`:1315-1317`); `deleteCategory` reads `keywordRulesRef.current` in its in-use guard (`:1679`); `applyPreset` reads `presetsRef.current` (`:2068`).

**Why the rule cannot see they are stable.** Every missing name comes from one of the three slice store hooks, destructured at `FinanceContext.tsx:579`, `:584` and `:587`: `useKeywordRuleStore` (`KeywordRulesContext.tsx:60-67`), `useTemplateStore` (`TemplateContext.tsx:48-55`) and `useDiaryEntriesState` (`DiaryContext.tsx:67-74`). Each returns its own `useState` setter and `useRef` object. React keeps a `useState` setter and a `useRef` object the same object for the component's whole lifetime, so the values never change; the rule only knows that for a `useState`/`useRef` call in the same component, not for one returned through a custom hook. The slices' own mutation hooks already list the same values in their deps, with no behaviour cost: `TemplateContext.tsx:97`, `:124`, `:133`; `KeywordRulesContext.tsx:117`, `:158`; `DiaryContext.tsx:169`, `:203`.

**Who observes the identities.** `useCallback` compares deps with `Object.is`, so adding a value that is the same object on every render never produces a new function. The identities matter here:

- the auth listener effect has deps `[loadSupabaseData, resetToGuestState]` (`:975-1050`); a new identity would unsubscribe and re-run it;
- `signOut` (`:1058-1065`, deps `[resetToGuestState]`), `refreshFromCloud` (`:1234-1238`, deps `[currentUser.id, loadSupabaseData]`) and `deleteAccount` (`:1288-1304`) derive from them;
- `actionsValue` (`:3066-3120`) lists `signOut`, `restoreBackup`, `deleteCategory`, `applyPreset` and `refreshFromCloud`; a new identity of any one re-renders every `useFinanceActions()` subscriber;
- `unit/rerender-matrix.test.tsx:115-138` pins that indirectly: a template or rule write re-renders no view outside its own (`:128-135`), which only holds while the actions object keeps its identity. No test asserts the identity itself.

**Coverage today, per callback** (unit, then Playwright):

| Callback | Unit | Playwright |
|---|---|---|
| `resetToGuestState` (881) | `unit/authenticated-ledger.test.tsx`: "sign-out leaves nothing behind" `:2485-2583`, "a cloud load still in flight at sign-out" `:2585`, "a device signed out from another device" `:2939`, smart rules "sign-out puts back the guest defaults" `:2475`, diary "sign-out empties it" `:2399`, failed-load "clears on sign-out" `:989`; `unit/ledger-guards.test.tsx:897` (sign-out clears cached insights); `unit/supabase-lazy-provider.test.tsx:127` (sign-out without a client) | No spec signs in (Stop and ask first). `tests/auth.spec.ts:96` mounts the provider as a guest, which runs the auth listener effect that depends on it |
| `loadSupabaseData` (967) | `unit/authenticated-ledger.test.tsx`: `:859` (signs in and loads), `:879-946` (F6), `:948-1000` (failed load never silent), `:2684` (which loads show Syncing), `:3115` (seed through `seed_starter_account`); `unit/navbar-sync-badge.test.tsx` | None signed in; `tests/auth.spec.ts:96` (a guest load asks nothing of Supabase) |
| `restoreBackup` (1320) | `unit/backup-restore.test.tsx:72-130`; `unit/authenticated-ledger.test.tsx:2812-2833` (refused while signed in) | `tests/account-and-mobile-nav.spec.ts:124`, `:150` |
| `deleteCategory` (1710) | `unit/categories-page.test.tsx:263-291`; `unit/authenticated-ledger.test.tsx:2464` (a category a rule uses cannot be deleted) | `tests/categories.spec.ts:122`, `:142` |
| `applyPreset` (2094) | `unit/template-context.test.tsx:105`, `:117`; `unit/rerender-matrix.test.tsx:109` | `tests/presets.spec.ts:51`, `:183` |

Behaviour (what each callback does) is well covered; identity is covered only through the matrix's render counts. The new test (section 6) closes that gap.

## 5. Parity map

None. No arithmetic changes: the `addTransaction` / `setTransactionDeleted` / `setTransactionsDeleted` rows of `AGENTS.md`'s parity map are untouched (no body line of any callback changes, only five dependency arrays and one doc comment). `applyPreset` still goes through `addTransaction` unchanged, and `restoreBackup` still applies `backupAsGuest`'s slices unchanged.

## 6. Tests to add

**Why this is a characterization test, not a red test.** The change cannot alter behaviour (section 4), so no behavioural test can fail before it; the owner's order allows a characterization test where coverage is thin. The failing-first half of the task is the lint itself: `npm run lint:hooks` reports 5 warnings on the unfixed code and 0 after (gate 2). The test's teeth are shown by a control: a temporary unstable dependency turns it red (gate 6).

**The test** (Edit 7): a new `describe('the stable actions (T831)')` appended to `unit/rerender-matrix.test.tsx`, reusing the file's `Probe`, `latest` and `settle`. It mounts one guest `FinanceProvider`, records the actions object, then writes to every slice the five callbacks touch (transactions and wallets, categories, rules, templates, diary), calls `applyPreset`, `deleteCategory` and `signOut` (which runs `resetToGuestState`), and asserts the actions object and `signOut`, `refreshFromCloud`, `restoreBackup`, `deleteCategory` and `applyPreset` are each `toBe` the ones recorded at mount. `refreshFromCloud` carries `loadSupabaseData`'s identity; `signOut` carries `resetToGuestState`'s. In the unit environment `supabase` is unset until loaded (`src/lib/supabase.ts:73`) and a guest never loads it, so `signOut` makes no request (as `unit/supabase-lazy-provider.test.tsx:127` relies on).

**How it behaves:**

- On the unfixed code it passes (gate 6, step a). That is the point: it pins today's identities.
- With the control edit (below) it fails at `expect(latest!.actions).toBe(before)` with Vitest's `toBe` "Object.is equality" failure (gate 6, step c).
- After Edits 1 to 6 it passes (gates 4 and 5).

**Stage 02 step 4 and stage 03 step 6 under this spec.** "Fails for the reason the spec gives" is replaced by: (a) the new test passes on the unfixed `FinanceContext.tsx` and `npm run lint:hooks` reports exactly the five warnings in section 4; (b) the control edit makes the new test fail as above. The builder runs (a) and (b) and logs them. The reviewer repeats (a) through the stash check (stash only `src/context/FinanceContext.tsx`; it is `w/crlf`, so stashing is safe), expecting the new test to **pass** and `npm run lint:hooks` to print the five warnings, then pops and confirms `git status --porcelain` is unchanged. The reviewer does not repeat (b) (its stage allows no other code edit); it checks the builder's red log.

Control edit, old text:

```
  }, [isAuthenticated, markLocalWrite, keywordRulesRef]);
```

Control edit, new text:

```
  }, [isAuthenticated, markLocalWrite, keywordRulesRef, transactions]);
```

(`transactions` is the hot state at `FinanceContext.tsx:585`; the first write in the test changes it, so `deleteCategory` and `actionsValue` get new identities.) Apply it after Edits 1 to 6, run the new test, save the failure, then undo it by hand so the line is Edit 4's new text again. Gate 1 then proves it is gone.

## 7. Edits

Order: Edits 8 and 9 (ADRs) first, then Edit 7 (test), then gate 6 step a, then Edits 1 to 6, then gate 6 steps b and c, then Edits 10 and 11 and the ledger row, then the gates. Keep each file's line endings: `FinanceContext.tsx`, `rerender-matrix.test.tsx` and ADR 0113 are CRLF in the working tree (`git ls-files --eol`: `w/crlf`); write the new ADR 0115 with CRLF, like 0113 and 0114; `docs/audit/task-ledger.md` is LF (`w/lf`). No line in any edit changes beyond the text below.

### Edit 1 (`FinanceContext.tsx:880-881`): `resetToGuestState`

Edit 1, old text:

```
    loadedUserIdRef.current = null;
  }, []);
```

Edit 1, new text:

```
    loadedUserIdRef.current = null;
  }, [setKeywordRules, setPresets, setDiaryEntries]);
```

### Edit 2 (`FinanceContext.tsx:967`): `loadSupabaseData`

Edit 2, old text:

```
  }, [seedInitialUserAccount]);
```

Edit 2, new text:

```
  }, [seedInitialUserAccount, setKeywordRules, setDiaryEntries]);
```

### Edit 3 (`FinanceContext.tsx:1318-1320`): `restoreBackup`

Edit 3, old text:

```
    inFlightIdempotencyKeys.current.clear();
    return { success: true };
  }, [isAuthenticated]);
```

Edit 3, new text:

```
    inFlightIdempotencyKeys.current.clear();
    return { success: true };
  }, [isAuthenticated, setKeywordRules, setDiaryEntries, setPresets]);
```

### Edit 4 (`FinanceContext.tsx:1707-1710`): `deleteCategory`

Edit 4, old text:

```
          (err instanceof Error ? err.message : 'Failed to delete category'),
      };
    }
  }, [isAuthenticated, markLocalWrite]);
```

Edit 4, new text:

```
          (err instanceof Error ? err.message : 'Failed to delete category'),
      };
    }
  }, [isAuthenticated, markLocalWrite, keywordRulesRef]);
```

### Edit 5 (`FinanceContext.tsx:2094`): `applyPreset`

Edit 5, old text:

```
  }, [addTransaction]);
```

Edit 5, new text:

```
  }, [addTransaction, presetsRef]);
```

### Edit 6 (`FinanceContext.tsx:123-125`): the actions interface's doc comment stays true

The comment says the stable half's deps are "only" `[]`, `[isAuthenticated]`, `[currentUser.id]` or a stable callback; after Edits 1 to 5, `restoreBackup`, `deleteCategory` and `applyPreset` (all in `actionsValue`) also list a slice setter or ref.

Edit 6, old text:

```
 * The stable half: callbacks whose deps are only `[]`, `[isAuthenticated]`,
 * `[currentUser.id]`, or another already-stable callback, so their identities
 * hold for an entire session, plus the `useState` setter `setShowSoftDeleted`.
```

Edit 6, new text:

```
 * The stable half: callbacks whose deps are only `[]`, `[isAuthenticated]`,
 * `[currentUser.id]`, another already-stable callback, or a slice's `useState`
 * setter or ref (ADR 0115), so their identities hold for an entire session,
 * plus the `useState` setter `setShowSoftDeleted`.
```

### Edit 7 (`unit/rerender-matrix.test.tsx`, appended after line 139): the identity test

Append after the file's last line (`});` closing `describe('the re-render matrix')`), with one blank line between. No import changes: every name used is already imported (`render`, `act`, `FinanceProvider`, `IDENTITY_COLORS`, `nextColor`, `todayIsoDate`, `expect`, `describe`, `it`). The existing test is not touched.

Edit 7, new text:

```
describe('the stable actions (T831)', () => {
  it('keep their identity through a write to every slice and a sign-out', async () => {
    render(
      <FinanceProvider>
        <Probe />
      </FinanceProvider>,
    );
    await settle();
    const before = latest!.actions;
    const run = async (name: string, write: () => Promise<{ success: boolean; error?: string }>) => {
      let result: { success: boolean; error?: string } = { success: false };
      await act(async () => { result = await write(); });
      expect(result, name).toMatchObject({ success: true });
      await settle();
    };

    await run('transaction save', () => latest!.actions.addTransaction({
      amount: 50, type: 'EXPENSE', walletId: 'wal-main-checking', categoryId: 'cat-food', description: 'Lunch', transactionDate: todayIsoDate(),
    }));
    await run('category add', () => latest!.actions.addCategory({
      name: 'Pets', type: 'EXPENSE', color: nextColor(IDENTITY_COLORS, latest!.state.categories),
    }));
    const pets = latest!.state.categories.find((c) => c.name === 'Pets')!;
    await run('rule add', () => latest!.ruleActions.addKeywordRule('kibble', pets.id));
    await run('template add', () => latest!.templateActions.addPreset({ name: 'Coffee', type: 'EXPENSE', amount: 60, description: 'Coffee' }));
    const preset = latest!.templates.presets.find((p) => p.name === 'Coffee')!;
    await run('template apply', () => latest!.actions.applyPreset(preset.id));
    await run('diary save', () => latest!.diaryActions.upsertDiaryEntry({ date: todayIsoDate(), mood: 4, workout: false, foodQuality: 'HEALTHY' }));
    const rule = latest!.rules.keywordRules.find((r) => r.keyword === 'kibble')!;
    await run('rule delete', () => latest!.ruleActions.deleteKeywordRule(rule.id));
    await run('category delete', () => latest!.actions.deleteCategory(pets.id));
    await run('sign-out', async () => { await latest!.actions.signOut(); return { success: true }; });

    // useCallback compares deps with Object.is; a slice setter or ref is the
    // same object on every render, so none of these may change (ADR 0115).
    expect(latest!.actions).toBe(before);
    for (const name of ['signOut', 'refreshFromCloud', 'restoreBackup', 'deleteCategory', 'applyPreset'] as const) {
      expect(latest!.actions[name], name).toBe(before[name]);
    }
  });
});
```

### Edit 8 (new file `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`): ADR 0115

The file's whole content is the block below (CRLF on disk), ending with one newline.

Edit 8, new text:

```
# 0115: the React hooks lint joins npm run lint

**Status:** Accepted. To be implemented in Phase 161 (T831: D1 and D2; T832: D3). Carries out ADR 0113 D6, and supersedes ADR 0113 D2 once T832 lands.

**Date:** 2026-10-30

## Context

ADR 0113 added `npm run lint:hooks` (`eslint src api`, the two React hooks rules only) as an opt-in script, not part of `npm run lint` or CI (D2), and left the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` for a later money-path phase (D6). On `883a6a6` the script reports exactly those five warnings and 0 errors:

- `resetToGuestState` (line 881) asks for `setKeywordRules`, `setPresets` and `setDiaryEntries`;
- `loadSupabaseData` (line 967) asks for `setKeywordRules` and `setDiaryEntries`;
- `restoreBackup` (line 1320) asks for `setKeywordRules`, `setDiaryEntries` and `setPresets`;
- `deleteCategory` (line 1710) asks for `keywordRulesRef`;
- `applyPreset` (line 2094) asks for `presetsRef`.

Every name comes from the three slice store hooks (`useKeywordRuleStore`, `useTemplateStore` and `useDiaryEntriesState`), each of which returns its own `useState` setter and `useRef` object. React keeps both the same object for the component's lifetime, but the rule cannot see that through a custom hook's return value. The slices' own mutation hooks already list the same values in their dependency arrays.

The identities matter: the auth listener effect depends on `loadSupabaseData` and `resetToGuestState`, and the actions context value lists `signOut`, `restoreBackup`, `deleteCategory`, `applyPreset` and `refreshFromCloud`, so a new identity would re-run the effect or re-render every actions subscriber.

## Decision

- **D1: List the stable values.** Each of the five `useCallback` dependency arrays gains exactly the names the rule reports. No callback body changes, no other dependency changes, and no disable comment is added. `useCallback` compares dependencies with `Object.is` and each added value is the same object on every render, so every callback keeps its identity for a session as before, and no money arithmetic changes.
- **D2: A characterization test proves it.** A behaviour-neutral change has no test that fails before it. `unit/rerender-matrix.test.tsx` gains a test that the actions object and `signOut`, `refreshFromCloud`, `restoreBackup`, `deleteCategory` and `applyPreset` keep their identity through a write to every slice and a sign-out. It passes before and after the change; a temporary unstable dependency turns it red. The failing-first half is `npm run lint:hooks`: 5 warnings before, 0 after.
- **D3: The rules join `npm run lint` (T832).** With `npm run lint:hooks` at 0 warnings and 0 errors across `src api`, ESLint becomes part of `npm run lint`, so a hooks warning fails it. CI's type-check job already runs `npm run lint`. `AGENTS.md`'s Commands line and tier rows say so. T832's spec fixes the exact script and flags and whether any workflow file changes.

## Consequences

- `FinanceContext.tsx` changes in five dependency arrays and one doc comment; no runtime behaviour, render count or bundle logic changes.
- One unit test is added (1625 tests in 73 files).
- After T832, a new `exhaustive-deps` warning anywhere in `src` or `api` fails `npm run lint` locally and in CI.

## Not done

- The three bare `// eslint-disable-next-line` sites ADR 0113 left (`DiaryView.tsx`, `TransactionsView.tsx`, `WalletsView.tsx`).
- The React Compiler rules, the recommended preset, type-aware rules, `eslint` 10 and `--cache` (as ADR 0113).

## Release

One pull request for Phase 161, on the pause list (a money path), merged by the owner, never auto-merged. No database migration and no production touch points.
```

### Edit 9 (`docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md:3`): pointer to ADR 0115

Edit 9, old text:

```
**Status:** Accepted. To be implemented in Phase 158 (T827).
```

Edit 9, new text:

```
**Status:** Accepted. To be implemented in Phase 158 (T827). D6's follow-on is ADR 0115 (Phase 161), which supersedes D2 once T832 wires ESLint into `npm run lint`.
```

### Edit 10 (`docs/audit/task-ledger.md`): the Phase 161 section

Insert after the Phase 160 table (after the T830 row, `task-ledger.md:122`) and before `## Backlog`, with one blank line on each side. Then add the T831 row directly under its header row (stage 02 step 6): `#` `T831`; Task `Fix the five react-hooks/exhaustive-deps warnings in FinanceContext.tsx by listing the slice setters and refs the rule asks for, no behaviour change; identity characterization test; ADR 0115`; Files: the four Target files plus `docs/audit/task-ledger.md`, each in backticks, comma separated, in section 2's order; Status `in-progress`, then `done`; Commit empty; Gate result in the compact "Gate N ..." style of the Phase 159 and 160 rows.

Edit 10, new text:

```
## Phase 161 - FinanceContext hooks lint (ADR 0115)

Branch `phase-161-finance-hooks-lint`, cut from `main` at `883a6a6`. No migration. A money path: the PR is merged by the owner.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
```

### Edit 11 (`docs/audit/task-ledger.md:141`): the Backlog row's Status

The row stays open for T832, which sets it to `done in Phase 161 (T831, T832)`.

Edit 11, old text:

```
| Fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094) and wire ESLint into `npm run lint` and CI, including AGENTS.md's Commands line and the tier rows; a money-path phase, merged by the owner | Phase 158, T827's spec | todo |
```

Edit 11, new text:

```
| Fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094) and wire ESLint into `npm run lint` and CI, including AGENTS.md's Commands line and the tier rows; a money-path phase, merged by the owner | Phase 158, T827's spec | partly done in Phase 161 (T831): the five warnings are fixed; T832 wires ESLint into `npm run lint` and CI |
```

## 8. Gates

Tier rows (`AGENTS.md`, Tiered verification gates): `src/context/` (lint; related unit; full unit; affected specs on chromium, then without a project filter), `unit/` (lint; the changed file; full unit), the money-path row (section 6 states why the proof is a characterization test plus the lint's red-then-green), and the docs rows for the ADRs and ledger (stated counts and paths checked in gates 1 and 9). Run from the repo root in Git Bash. `D` is the log folder: `workflow/stages/02_build/output/logs/` for the builder, `workflow/stages/03_review/output/logs/` for the reviewer.

**Save the helper** (both stages), extracted from this spec by script, never retyped:

```
D=workflow/stages/02_build/output/logs/; H=${D}T831-gates.cjs
node -e 'const fs=require("fs");const s=fs.readFileSync("workflow/stages/01_spec/output/task-T831-spec.md","utf8").replace(/\r\n/g,"\n");const m=/^Gate helper:\n\n```js\n([\s\S]*?)\n```$/m.exec(s);fs.writeFileSync(process.argv[1],m[1]+"\n")' $H
```

Gate helper:

```js
// T831 gate helper: text landed. Run from the repo root after all edits.
const fs = require('fs');
const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '');
const cnt = (s, t) => s.split(t).length - 1;
const spec = rd('workflow/stages/01_spec/output/task-T831-spec.md');
const re = /^Edit (\d+), (old|new) text:\n\n(`{3,})[^\n]*\n([\s\S]*?)\n\3$/gm;
const b = {};
let m;
while ((m = re.exec(spec))) (b[m[1]] ??= {})[m[2]] = m[4];
const F = rd('src/context/FinanceContext.tsx');
const T = rd('unit/rerender-matrix.test.tsx');
const A15 = rd('docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md');
const A13 = rd('docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md');
const L = rd('docs/audit/task-ledger.md');
let bad = 0;
const chk = (name, ok) => { console.log(name, ok ? 'OK' : 'BAD'); if (!ok) bad++; };
for (const n of [1, 2, 3, 4, 5, 6]) {
  chk(`edit${n} new once`, cnt(F, b[n].new) === 1);
  chk(`edit${n} old gone`, cnt(F, b[n].old) === 0);
}
chk('control gone', !F.includes('keywordRulesRef, transactions]'));
chk('edit7 once', cnt(T, b[7].new) === 1);
chk('edit7 at end', T.trimEnd().endsWith(b[7].new.trimEnd()));
chk('edit7 one blank line before', T.includes('\n});\n\n' + b[7].new));
chk('edit8 whole file', A15 === b[8].new + '\n');
chk('edit9 new once', cnt(A13, b[9].new) === 1);
chk('edit9 old gone', cnt(A13, b[9].old + '\n') === 0);
chk('edit10 once', cnt(L, b[10].new) === 1);
chk('edit11 new once', cnt(L, b[11].new) === 1);
chk('edit11 old gone', cnt(L, b[11].old) === 0);
chk('ledger heading once', cnt(L, '## Phase 161 - ') === 1);
chk('ledger T831 row once', L.split('\n').filter((l) => l.startsWith('| T831 |')).length === 1);
const i160 = L.indexOf('## Phase 160 - ');
const i161 = L.indexOf('## Phase 161 - ');
const iRow = L.indexOf('| T831 |');
const iBack = L.indexOf('## Backlog');
chk('ledger order', i160 >= 0 && i160 < i161 && i161 < iRow && iRow < iBack);
console.log('bad', bad);
process.exit(bad ? 1 : 0);
```

**Gate 1: text landed.** `node $H` prints `bad 0` and exits 0. Before any edit it prints BAD lines (at least every `new once`), as a control.

**Gate 2: the hooks lint, red then green.** Before Edits 1 to 6: `npm run lint:hooks 2>&1 | tee ${D}T831-hooks-before.log` prints the five warnings of section 4 at lines 881, 967, 1320, 1710 and 2094 and `✖ 5 problems (0 errors, 5 warnings)`. After all edits: `npm run lint:hooks -- --max-warnings 0 2>&1 | tee ${D}T831-hooks-after.log; echo exit=${PIPESTATUS[0]}` prints no warning or error line and `exit=0`. This is the 0 warnings and 0 errors across `src api` that T832 depends on. (The line numbers in the "before" run hold only before Edit 6, which adds a line above them; the builder runs it before any `FinanceContext.tsx` edit. The reviewer's stash check in gate 6 reproduces it.)

**Gate 3: `npm run lint`.** `npm run lint 2>&1 | tee ${D}T831-lint.log`: exit 0 (node-globals guard, safe-id guard, both `tsc` runs).

**Gate 4: the changed and related unit files.**

```
npx vitest run unit/rerender-matrix.test.tsx
npx vitest run unit/rerender-matrix.test.tsx unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx unit/supabase-lazy-provider.test.tsx unit/backup-restore.test.tsx unit/categories-page.test.tsx unit/template-context.test.tsx unit/navbar-sync-badge.test.tsx
```

The first prints 2 tests passed (the matrix and the new test); the second, 8 files passed, 0 failed. Record the counts.

**Gate 5: full unit run.** `npm run test:unit 2>&1 | tee ${D}T831-unit.log`: `Test Files  73 passed (73)` and `Tests  1625 passed (1625)` (the 1624 `AGENTS.md:11` states, plus the new test). If the baseline has moved, the count is the baseline plus 1; say so.

**Gate 6: the characterization proof (section 6).**

- a. Builder, after Edits 8, 9 and 7 and before any `FinanceContext.tsx` edit: `npx vitest run unit/rerender-matrix.test.tsx 2>&1 | tee ${D}T831-pre.log` passes (2 tests), and gate 2's "before" run shows the five warnings.
- b. Builder, after Edits 1 to 6: apply the control edit (section 6).
- c. Builder: `npx vitest run unit/rerender-matrix.test.tsx -t "stable actions" 2>&1 | tee ${D}T831-red.log` fails 1 test at `expect(latest!.actions).toBe(before)` with the `Object.is equality` message. Undo the control edit by hand; gate 1's `control gone` confirms it. Quote the command and failure lines in the build report.
- Reviewer (stage 03 step 6): record `git status --porcelain`; `git stash push -- src/context/FinanceContext.tsx`; `npx vitest run unit/rerender-matrix.test.tsx` must pass (2 tests); `npm run lint:hooks` must print the five warnings at 881, 967, 1320, 1710 and 2094; `git stash pop --index`; `git status --porcelain` identical to the recorded one. Check the builder's `T831-red.log` for step c.

**Gate 7: Playwright, the affected specs.** Check ports 3000 and 3100 for stale dev servers first. Never edit `src/` while it runs.

Builder (stage 02):

```
npx playwright test tests/categories.spec.ts tests/presets.spec.ts tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts --project=chromium
```

Reviewer (stage 03), once, all three browsers:

```
npx playwright test tests/categories.spec.ts tests/presets.spec.ts tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts
```

Each saved to `${D}T831-e2e.log`; 0 failed. These cover `deleteCategory`, `applyPreset`, `restoreBackup` and the guest mount of the auth listener effect (section 4's table). No spec signs in, so `loadSupabaseData` and `resetToGuestState`'s signed-in paths have unit coverage only.

**Gate 8: diff shape, only deps and the comment.** `git diff --numstat -- src/context/FinanceContext.tsx` prints `9	8` (Edits 1 to 5: one line each, 5 and 5; Edit 6: 4 and 3). `git diff -U0 -- src/context/FinanceContext.tsx` shows 6 hunks: five whose one removed and one added line both start with `  }, [`, and one in the comment at lines 123 to 126 whose lines all start with ` * `. `git diff --numstat -- unit/rerender-matrix.test.tsx` prints `42	0`: Edit 7's 41 lines plus the one blank line before them, and 0 deletions.

**Gate 9: stated counts and paths match.** Every path ADR 0115 and the ledger name exists (`git ls-files` or the new file); `883a6a6` resolves (`git cat-file -t 883a6a6` prints `commit`); `git branch --show-current` prints `phase-161-finance-hooks-lint`; the five line numbers in ADR 0115 match `T831-hooks-before.log`; the 1625 and 73 in ADR 0115 match gate 5. `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` have no diff (`git diff --stat HEAD -- AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md` is empty).

**Gate 10: no em dash, line endings kept.**

```
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md unit/rerender-matrix.test.tsx src/context/FinanceContext.tsx docs/audit/task-ledger.md workflow/stages/01_spec/output/task-T831-spec.md workflow/stages/02_build/output/task-T831-build.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');const crlf=s.split('\r\n').length-1;console.log(f,'crlf',crlf,'bareLF',s.split('\n').length-1-crlf)}" docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md unit/rerender-matrix.test.tsx src/context/FinanceContext.tsx docs/audit/task-ledger.md
```

Pass: `0` added em dashes; every listed file `0`; the four CRLF files `bareLF 0`; `docs/audit/task-ledger.md` `crlf 0`.

**Gate 11: scope.** `git status --porcelain` lists as modified only `src/context/FinanceContext.tsx`, `unit/rerender-matrix.test.tsx`, `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md` and `docs/audit/task-ledger.md`, and as untracked only `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`, `workflow/stages/01_spec/output/task-T831-spec.md` and `workflow/stages/02_build/output/task-T831-build.md` (logs are gitignored). `eslint.config.js`, `package.json`, `package-lock.json`, `AGENTS.md`, `.github/workflows/` and the three slice context files are untouched.

## 9. Production touch points

None. No migration, no live SQL, no `/api/*` request, no dependency, no workflow or `vercel.json` edit. The pause after this spec comes from the money path (`src/context/FinanceContext.tsx`), not from a touch point.

## 10. Out of scope

- Wiring ESLint into `npm run lint` or CI, `package.json`'s scripts, `eslint.config.js`, `AGENTS.md`'s Commands line, tier rows and stated test count (1624 at `AGENTS.md:11`): all T832's, which ships the phase with `refactor-log.md` and `baseline-metrics.md`.
- Any callback body, any other dependency array, the order of existing deps, the `useCallback` / `useMemo` structure, `actionsValue`, `stateValue`, the ref mirrors and the slice hooks (`DiaryContext.tsx`, `KeywordRulesContext.tsx`, `TemplateContext.tsx`). In particular, do not move `setKeywordRules` and friends to a ref, wrap them, or add an `eslint-disable` comment: D1 is to list them.
- Other comments in `FinanceContext.tsx` that describe deps (for example `:3054-3057`): only Edit 6 changes.
- The three bare `// eslint-disable-next-line` sites (`DiaryView.tsx:48`, `TransactionsView.tsx:152`, `WalletsView.tsx:78`).
- The existing `it('counts each view per write')` in `unit/rerender-matrix.test.tsx`, and its `step`, `measure` and `Probe`.
- ADR 0113's other lines (its Status keeps "To be implemented"; only the sentence of Edit 9 is added).
