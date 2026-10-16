# T752 spec: point archived comment references at live docs

Phase 126 (`phase-126-icm-tuneup`). The last task of the phase. Comments only.

## 1. Goal

Five comments in four files point at docs that now live only in `docs/audit/archive/` (or, for framer-motion, describe a library that is gone). Point each at the live doc that holds the reason, and word each comment so it says only what that doc says. No behaviour change.

## 2. Target files

```
src/components/transaction/txTypeMeta.ts
src/components/ui/Card.tsx
src/components/ui/OverflowMenu.tsx
tests/categories.spec.ts
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T752 row, the Phase 126 heading and the Backlog row, see section 9a), `workflow/stages/02_build/output/*`.

No ADR (a comments-only edit counts as doc-only, `AGENTS.md` Workflow). No `docs/audit/baseline-metrics.md` section: no bundle or test count changes, and `AGENTS.md` says a doc-only phase adds none in that case.

## 3. Context to read

None. This is a comments-only task (`AGENTS.md` routing table). The exact replacement text is below; the facts it rests on are cited in section 4, so the builder needs no context file.

## 4. Current behaviour

Each claim below was checked against the file on `86d0849`.

1. `src/components/transaction/txTypeMeta.ts:21` reads `(see docs/audit/ui-ux-audit-report.md finding D).` That report was archived in Phase 125 (`docs/audit/refactor-log.md:42`). `docs/audit/decisions/0006-ui-primitive-inventory.md` lists `TX_TYPE_META` in its inventory table as the Phase 21 (T35) design-token primitive. ADR 0006 does not say it was the "single most duplicated" fragment, so the citation must not read as support for that phrase.
2. `src/components/ui/Card.tsx:23-28` lists four reasons a shell stayed local and ends `see docs/audit/refactor-log.md Phase 25 for the audited list of each.` The live refactor log starts at Phase 125 (`docs/audit/refactor-log.md:5`); Phase 25 is only in the archive. ADR 0006's Consequences say `Card`'s padding enum is "deliberately closed" and the Phase 25 shells stayed local "because their padding didn't match any of the four values". That is the stepped-padding reason. ADR 0006 gives no source for the background or className reasons.
3. `src/components/ui/Card.tsx:26-27` names "its own framer-motion hover/tap animation". ADR 0082 removed framer-motion; its call-site table lists `ui/Card.tsx` as "a comment only". `package.json` has no framer-motion entry.
4. `src/components/ui/OverflowMenu.tsx:42-44` says the rule is "recorded in `test-selector-contract.md`". The live `docs/audit/test-selector-contract.md` has no line about it (grep for `OverflowMenu`, `only while` finds nothing). The rule lives in `docs/contexts/ui-and-e2e.md:39`: "`OverflowMenu`'s items exist only while open ... A spec asserting an action is absent opens the menu first."
5. `tests/categories.spec.ts:6-9` calls the cause "`FinanceContext.tsx`'s `seedInitialUserAccount` race" and points at "`docs/audit/decisions` and `refactor-log.md` Phase 30". ADR 0039 (`docs/audit/decisions/0039-server-side-seed-and-dedupe.md`) says the fix is now on the server: `seed_starter_account()` seeds an account only once, a dedupe cleared the copies, and Phase 30's `isSeedingRef` guard "no longer guards inserts, only one tab's calls". `src/context/FinanceContext.tsx:766-769` agrees.

## 5. Parity map

None. No row of `AGENTS.md`'s cross-file parity map covers a comment.

## 6. Tests to add

None. Only comment lines change, so no behaviour can change. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

Replace each `old` block with its `new` block exactly. Keep the leading ` * ` and indentation. Change no other line.

### Edit 1: `src/components/transaction/txTypeMeta.ts:21`

old:
```
 * (see docs/audit/ui-ux-audit-report.md finding D).
```
new:
```
 * (ADR 0006 lists it in the UI primitive inventory).
```

### Edits 2 and 3: `src/components/ui/Card.tsx:23-28`

One block, because the framer-motion clause (line 26) and the archive pointer (line 28) sit in the same sentence.

old:
```
 * Adopted only where an existing shell already matches this shape losslessly;
 * a shell with stepped responsive padding (e.g. `p-4 sm:p-5`), a non-white
 * background, a conditional per-state className, or its own framer-motion
 * hover/tap animation is a genuinely different shape and was left local - see
 * `docs/audit/refactor-log.md` Phase 25 for the audited list of each.
```
new:
```
 * Adopted only where an existing shell already matches this shape losslessly.
 * A shell with stepped responsive padding (e.g. `p-4 sm:p-5`) stays local
 * because the padding enum is deliberately closed (ADR 0006). A shell with a
 * non-white background or a conditional per-state className is a different
 * shape and stays local too.
```

### Edit 4: `src/components/ui/OverflowMenu.tsx:44`

old:
```
 * reason (recorded in `test-selector-contract.md`).
```
new:
```
 * reason (`docs/contexts/ui-and-e2e.md`).
```

### Edit 5: `tests/categories.spec.ts:6-9`

old:
```
 * pins the fix for the triple-duplicated default categories bug
 * (`FinanceContext.tsx`'s `seedInitialUserAccount` race; see
 * `docs/audit/decisions` and `refactor-log.md` Phase 30 for the root cause).
```
new:
```
 * pins the triple-duplicated default categories bug. ADR 0039 moved the fix
 * to the server, in place of Phase 30's client-side guard:
 * `seed_starter_account()` seeds an account only once, and a dedupe cleared
 * the existing copies.
```

### Edit 6: `docs/audit/refactor-log.md`, the Phase 126 entry (lines 22 to 29)

- Line 22, heading: change `T751` to `T751-T752`. Leave the dates and the `<sha>` placeholders as they are.
- Line 24, after the brief's sentence, add: `T752, the phase's last task, rewords five code comments that pointed into \`docs/audit/archive/\` so each cites a live doc (ADR \`0006\`, \`0039\`, \`docs/contexts/ui-and-e2e.md\`) and drops the framer-motion mention ADR \`0082\` made stale.` (without the backslashes; they only escape the backticks here).
- **Changed:** append `; T752: comments in \`src/components/transaction/txTypeMeta.ts\`, \`src/components/ui/Card.tsx\`, \`src/components/ui/OverflowMenu.tsx\` and \`tests/categories.spec.ts\``.
- **Verified:** append T752's gate results from section 8, with the real counts.
- **Surprises:** append anything T752 finds; if nothing, leave the line as it is.
- **Deliberately not done:** append `T752 left ADR \`0006\`'s own pointers to archived refactor-log notes, and \`Card.tsx\`'s stale \`rounded-xl\` (the code uses \`rounded-card\`), as they are.`

## 8. Gates

Comments-only row for the four code files; docs row for `refactor-log.md` and the ledger.

```
npm run lint
```

The reviewer confirms only comment lines changed. This must print nothing:

```
git diff -U0 -- src/components/transaction/txTypeMeta.ts src/components/ui/Card.tsx src/components/ui/OverflowMenu.tsx tests/categories.spec.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' | grep -vE '^[+-] \*'
```

No archived pointer is left. This must print nothing:

```
grep -nE "ui-ux-audit-report|refactor-log|test-selector-contract|framer-motion" src/components/transaction/txTypeMeta.ts src/components/ui/Card.tsx src/components/ui/OverflowMenu.tsx tests/categories.spec.ts
```

Every path and symbol the new text names resolves:

```
ls docs/audit/decisions/0006-ui-primitive-inventory.md docs/audit/decisions/0039-server-side-seed-and-dedupe.md docs/audit/decisions/0082-css-motion-replaces-framer-motion.md docs/contexts/ui-and-e2e.md
grep -n "create or replace function public.seed_starter_account" -i supabase/migrations/20261002_phase64_seed_starter_account.sql
grep -n "isSeedingRef" src/context/FinanceContext.tsx
```

Zero em dashes in every touched file (Bash; `$'\xe2\x80\x94'` is the em dash's UTF-8 bytes). Every count must be 0:

```
grep -c $'\xe2\x80\x94' src/components/transaction/txTypeMeta.ts src/components/ui/Card.tsx src/components/ui/OverflowMenu.tsx tests/categories.spec.ts docs/audit/refactor-log.md docs/audit/task-ledger.md
```

No Vitest or Playwright run: a comments-only file takes the comments-only row in place of its folder's row, and that row includes no code tier.

## 9. Production touch points

None. No SQL, no `/api/*`, no deploy, no dashboard. Commits are the orchestrator's, on the owner's `commit T752` order.

### 9a. Ledger bookkeeping (allowed, not a target)

- Add the T752 row under Phase 126: `| T752 | Point five archived comment references at live docs (ADR \`0006\`, \`0039\`, \`docs/contexts/ui-and-e2e.md\`); drop the stale framer-motion mention | \`src/components/transaction/txTypeMeta.ts\`, \`src/components/ui/Card.tsx\`, \`src/components/ui/OverflowMenu.tsx\`, \`tests/categories.spec.ts\`, \`docs/audit/refactor-log.md\` | done | | <gate results> |`. Leave `Commit` empty.
- Phase 126 heading: change `(docs only, amends ADR \`0101\`)` to `(docs and code comments only, amends ADR \`0101\`)`. Leave the `Branch ...` line under it as it is.
- Backlog row "Four code comments point into `docs/audit/archive/`" (line 41): change its Status cell to `done in Phase 126 (T752)`.

## 10. Out of scope

- Any other comment, in these files or elsewhere, including:
  - ADR 0006's own references to archived `refactor-log.md` Phase 21/25/26/28 notes;
  - `Card.tsx:22`'s `rounded-xl` (the code uses `rounded-card`) and its "non-white background" wording;
  - `txTypeMeta.ts`'s "single most duplicated" phrase and its Phase 55a and Phase 59 paragraphs;
  - `OverflowMenu.tsx`'s bullet list above line 42;
  - `tests/categories.spec.ts`'s lines 4 and 5 and every comment inside the tests.
- Any code, test assertion, import or whitespace outside the blocks in section 7.
- `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, any ADR, `docs/audit/baseline-metrics.md`.
- The `docs/audit/archive/` folder: do not open it.
