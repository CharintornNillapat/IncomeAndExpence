# T780 spec: updatePreset validates with PresetSchema.partial() (CS-02)

Phase 140 (branch `phase-140-gemini-trial`). Source: `docs/audit/audit-2026-10-16.md` finding CS-02 (low).

## 1. Goal

Validate partial template updates in `updatePreset` (`src/context/TemplateContext.tsx`) through `PresetSchema.partial().safeParse(updates)` instead of manual field checks, so `updatePreset` enforces `MAX_AMOUNT`, length caps (`name` <= 60, `description` <= 255) and trims both `name` and `description` just like `addPreset`.

## 2. Target files

- `src/context/TemplateContext.tsx`
- `unit/template-context.test.tsx`
- `docs/audit/task-ledger.md` (bookkeeping)

No ADR (closes a low audit finding using existing `PresetSchema` rules; no new rule or architecture). No `refactor-log.md` or `baseline-metrics.md` entry unless the owner closes Phase 140 in a later task.

## 3. Context to read

`docs/contexts/client-state.md` (covers `src/context/TemplateContext.tsx`, the "Every write" Zod validation rule at line 23, and the `MAX_AMOUNT` / `MAX_AMOUNT_ERROR` rule at line 50). Nothing else.

## 4. Current behaviour

- `src/context/TemplateContext.tsx:71-76`: `addPreset` validates its input with `PresetSchema.safeParse(data)` (`src/utils/zodSchemas.ts:168-175`), which trims `name` (1..60 chars) and `description` (1..255 chars) and bounds `amount` to `> 0` and `<= MAX_AMOUNT` (`MAX_AMOUNT_ERROR`), returning `{ success: false, error: formatZodIssues(validation.error) }` on failure.
- `src/context/TemplateContext.tsx:99-131`: `updatePreset` checks `existing` in `presetsRef.current` (`lines 103-106`), then performs manual ad-hoc checks (`lines 108-127`):
  - `lines 109-121`: trims `updates.name`, rejects empty string with `'Template name is required'`, checks case-insensitive duplicate against other presets in `presetsRef.current`, and sets `cleanedUpdates = { ...updates, name: cleanedName }`. It never checks `name.length <= 60`.
  - `lines 122-124`: checks `if (updates.amount !== undefined && !(updates.amount > 0))` and returns `'Amount must be greater than 0'`, omitting the `<= MAX_AMOUNT` check. An amount above `MAX_AMOUNT` is saved into `pf_presets` and later fails `TransactionSchema` when applied via `applyPreset`.
  - `lines 125-127`: checks `if (updates.description !== undefined && !updates.description.trim())` and returns `'Description is required'`, omitting `description.trim()` on `cleanedUpdates` and omitting the 255-character cap.
- `unit/template-context.test.tsx:63-78`: tests `updatePreset` for missing id, whitespace-only name, duplicate name, `amount: 0`, whitespace-only description, and trimming `name` (`' Flat white '`), but does not test `amount > MAX_AMOUNT` or trimming `description`.

## 5. Parity map

none.

## 6. Tests to add

In `unit/template-context.test.tsx`:
1. Import `MAX_AMOUNT` and `MAX_AMOUNT_ERROR` from `'../src/utils/money'`.
2. In the second test (`'an edit is checked before it is applied'`, `unit/template-context.test.tsx:63-78`):
   - After line 73 (`expect(await run(() => templateWrite().updatePreset(id, { amount: 0 }))).toEqual({ success: false, error: 'Amount must be greater than 0' });`), add:
     ```ts
     expect(await run(() => templateWrite().updatePreset(id, { amount: MAX_AMOUNT + 1 }))).toEqual({ success: false, error: MAX_AMOUNT_ERROR });
     ```
   - Update lines 76-77 so the valid `updatePreset` call also passes an untrimmed `description: '  Oat flat white  '` and asserts both `name` and `description` are trimmed:
     ```ts
     expect(await run(() => templateWrite().updatePreset(id, { name: ' Flat white ', amount: 75, description: '  Oat flat white  ' }))).toEqual({ success: true });
     expect(templates().find((p) => p.id === id)).toMatchObject({ name: 'Flat white', amount: 75, description: 'Oat flat white' });
     ```

**Why it fails today (red run):**
Before editing `src/context/TemplateContext.tsx`, run `npx vitest run unit/template-context.test.tsx` and save the output to `workflow/stages/02_build/output/logs/T780-red.log`. It must fail on `updatePreset(id, { amount: MAX_AMOUNT + 1 })` returning `{ success: true }` instead of `{ success: false, error: MAX_AMOUNT_ERROR }`.

**Source change after the red run (`src/context/TemplateContext.tsx:108-129`):**
Replace lines 108-129 inside `updatePreset` with:

```ts
    const validation = PresetSchema.partial().safeParse(updates);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    const cleanedUpdates = validation.data;
    if (cleanedUpdates.name !== undefined) {
      const isDuplicate = presetsRef.current.some(
        (p) => p.id !== id && p.name.trim().toLowerCase() === cleanedUpdates.name!.toLowerCase()
      );
      if (isDuplicate) {
        return { success: false, error: `A template named "${cleanedUpdates.name}" already exists` };
      }
    }

    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...cleanedUpdates } : p)));
```

**Ledger (`docs/audit/task-ledger.md`):**
- Add row `T780` under `## Phase 140 - Gemini trial (no ADR)` with Task `updatePreset validates with PresetSchema.partial(): amount cap and description trim (CS-02)`, Files `` `src/context/TemplateContext.tsx`, `unit/template-context.test.tsx` ``, Status `done`, empty Commit, and Gate result.
- Add a Backlog row at the end of `## Backlog`:
  `| updatePreset in TemplateContext.tsx skips amount cap validation and description trimming | Audit 2026-10-16 (T759), finding CS-02, low; \`src/context/TemplateContext.tsx:108-127\` | done in Phase 140 (T780) |`

## 7. Gates

Changed paths: `src/context/TemplateContext.tsx`, `unit/template-context.test.tsx`, `docs/audit/task-ledger.md`. Union of tiers (`src/context/` tier + `unit/` tier):

```
npm run lint
npx vitest run unit/template-context.test.tsx unit/entity-ids.test.tsx unit/rerender-matrix.test.tsx
npm run test:unit
npx playwright test tests/presets.spec.ts --project=chromium
npx playwright test tests/presets.spec.ts
```

Check ports 3000 and 3100 for stale dev servers before Playwright. Save full-suite output to `workflow/stages/02_build/output/logs/`. Also check line endings and em dashes:

```
git ls-files --eol src/context/TemplateContext.tsx unit/template-context.test.tsx docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
```

Expect `w/crlf` on all three files and `0` em dashes.

## 8. Production touch points

none.

## 9. Out of scope

- `addPreset` and `deletePreset` in `src/context/TemplateContext.tsx`.
- `PresetSchema` in `src/utils/zodSchemas.ts` (it already has `.trim()`, length bounds, and `MAX_AMOUNT`).
- Any other audit finding (`CS-03`, `SL-01`, `AP-01`, `AP-02`, etc.).
- `src/context/FinanceContext.tsx` (`applyPreset`).
