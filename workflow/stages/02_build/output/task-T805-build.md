# Build report: T805

Phase 147, branch `phase-147-update-prompt`. First task of the phase; does not ship the phase.

## 1. Files changed (8 files)

- `docs/audit/decisions/0107-ask-before-updating-the-offline-app.md`
- `vite.config.ts`
- `src/components/ReloadPrompt.tsx`
- `unit/reload-prompt.test.tsx`
- `docs/contexts/ui-and-e2e.md`
- `vitest.config.ts` (conditional target: added `resolve.alias` for `virtual:pwa-register/react` to resolve under Vitest without plugin)
- `unit/fixtures/virtualPwaRegisterReact.ts` (conditional target: stub for `virtual:pwa-register/react`)
- `docs/audit/task-ledger.md` (bookkeeping: added Phase 147 section and T805 row)

## 2. Tests added and fail-then-pass evidence

Added `unit/reload-prompt.test.tsx` with 4 unit tests in a jsdom environment:
1. `vite.config.ts asks before updating`: asserts that `vite.config.ts` declares `registerType: 'prompt'` and not `registerType: 'autoUpdate'`.
2. `shows the notice and Reload asks the library to update`: asserts `<ReloadPrompt />` renders notice when `needRefresh` is true, Reload button `#pwa-reload-btn` calls `updateServiceWorker(true)`, and Dismiss `#pwa-dismiss-btn` calls reset setters.
3. `renders nothing when not offlineReady and not needRefresh`: asserts null render when both flags are false.
4. `renders offline ready notice with no reload button when offlineReady is true`: asserts "Ready to use offline" copy and absence of `#pwa-reload-btn`.

### Red run

Command: `npx vitest run unit/reload-prompt.test.tsx`
Log: `workflow/stages/02_build/output/logs/T805-red.log`

Result: 1 failed | 3 passed (4 tests) in 1.56s.
Failure output:
```
 FAIL  unit/reload-prompt.test.tsx > PWA update prompt policy (ADR 0107) > vite.config.ts asks before updating
AssertionError: expected 'import tailwindcss from \'@tailwindcs…' to contain 'registerType: \'prompt\''
- Expected
+ Received
- registerType: 'prompt'
+ import tailwindcss from '@tailwindcss/vite';
+ import react from '@vitejs/plugin-react';
+ import { defineConfig } from 'vite';
+ import { VitePWA } from 'vite-plugin-pwa';
+ ...
+         registerType: 'autoUpdate',
```

### Green run

Command: `npx vitest run unit/reload-prompt.test.tsx`
Result: 4 passed (4 tests) in 1.35s.

## 3. Gates

1. **`npm run lint`:** clean (node-globals 133 src files clean, safe-ids 133 src files clean, `tsc --noEmit` clean, `tsc -p api/tsconfig.json` clean).
2. **Targeted unit test:** `npx vitest run unit/reload-prompt.test.tsx` -> 1 file, 4 tests passed (1.35s).
3. **Full unit suite:** `npm run test:unit` -> 69 files passed, 1510 tests passed (59.69s). Log: `workflow/stages/02_build/output/logs/T805-unit.log`. (Rises from 1506 tests / 68 files to 1510 / 69 as expected).
4. **Targeted Playwright Chromium:** `npx playwright test tests/toast-layering.spec.ts --project=chromium` -> 2 passed (41.8s).
5. **Targeted Playwright 3 browsers:** `npx playwright test tests/toast-layering.spec.ts` -> 6 passed (24.7s) across Chromium, Firefox, WebKit.
6. **Production build:** `npm run build` -> built in 15.23s, clean production bundle.
7. **Gate 5 check on `dist/sw.js`:**
   Command:
   ```
   node -e "const s=require('fs').readFileSync('dist/sw.js','utf8');console.log('SKIP_WAITING',s.includes('SKIP_WAITING'));console.log('clientsClaim',/clientsClaim|\.clients\.claim\(\)/.test(s));console.log('skipWaiting call',/self\.skipWaiting\(\)/.test(s))"
   ```
   Output:
   ```
   SKIP_WAITING true
   clientsClaim false
   skipWaiting call true
   ```
   Note on `skipWaiting call true`: Inspection of `dist/sw.js` confirms that `self.skipWaiting()` appears exactly once in the file, inside the `message` event handler:
   `self.addEventListener("message",s=>{s.data&&"SKIP_WAITING"===s.data.type&&self.skipWaiting()})`
   In Workbox's template (`sw-template.js:33-41`), when `skipWaiting` is false (prompt mode), Workbox generates the `SKIP_WAITING` message event listener which itself calls `self.skipWaiting()`. No top-level/install-time `self.skipWaiting()` exists.
8. **Ports check:** verified no stale dev servers on ports 3000 and 3100 before Playwright runs.
9. **Line endings:** `w/crlf` verified on all touched files.
10. **Em dashes:** 0 em dashes added across all touched files and diffs.
11. **Scope:** `git status --porcelain` lists only the target files, conditional targets (`vitest.config.ts`, `unit/fixtures/virtualPwaRegisterReact.ts`), and bookkeeping files.

## 4. Deliberately not done

- A "reload when idle" timer, countdown, or changelog in the notice.
- Playwright update test (requires two builds and a real deploy).
- Updating counts in `AGENTS.md`, `README.md`, or creating refactor log / baseline metrics entries (reserved for phase closing task T806).
