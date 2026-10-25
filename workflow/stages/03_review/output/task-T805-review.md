## Round 1

### 1. Metadata

- Task: T805, Ask before updating the offline app (ADR 0107)
- Date: 2026-10-25
- Round: 1
- Verdict: APPROVED
- Target files: `docs/audit/decisions/0107-ask-before-updating-the-offline-app.md`, `vite.config.ts`, `src/components/ReloadPrompt.tsx`, `unit/reload-prompt.test.tsx`, `docs/contexts/ui-and-e2e.md`; conditional `vitest.config.ts`, `unit/fixtures/virtualPwaRegisterReact.ts`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all: none ignored.

### 2. Summary

`registerType` goes from `'autoUpdate'` to `'prompt'`, so a new worker waits and the existing `ReloadPrompt` notice (previously dead for updates) asks before reloading. ADR 0107, one comment line in `ReloadPrompt.tsx`, one context bullet, a 4-test unit file and the ledger's Phase 147 section are added. The builder also added a Vitest alias plus a stub for the virtual module (a conditional target).

### 3. Invariants and parity

- Parity map: none touched (spec section 5). Confirmed.
- Scope: `git diff --stat` shows 5 modified files, `git status --porcelain` adds the ADR, the test, the stub, the spec and the build report. All are listed by the spec, announced in the build report, or bookkeeping. No unannounced file.
- `vite.config.ts` diff: only the `registerType` value plus a one-line comment. Nothing else touched (globPatterns, devOptions, manualChunks untouched).
- `ReloadPrompt.tsx` diff: one comment line only; no logic or markup change.
- `vitest.config.ts`: alias only affects Vitest; `vite build` never reads it (header comment, ADR 0021). Production bundle unaffected.
- Line endings: all changed or new files `w/crlf` (index `i/lf` for tracked ones, as before). 
- Em dashes: 0 in added diff lines and in the three new untracked files.
- ADR 0107 does not contradict ADR 0041 or 0042; Amends section is present.
- Gate 5 on the real `dist/sw.js`: `SKIP_WAITING true`, `clientsClaim false`, `skipWaiting call true`. `skipWaiting` occurs exactly once, inside the `message` listener (`"SKIP_WAITING"===s.data.type&&self.skipWaiting()`), so no install-time skip and the premise in spec 4.7 holds. The spec's expected third line (`false`) came from a regex that also matches the message handler; the build report explains this correctly.

### 4. Gates run

- `npm run lint`: exit 0 (node-globals 133 files clean, safe-ids 133 files clean, both `tsc` runs clean). Log `workflow/stages/03_review/output/logs/T805-lint.log`.
- `npx vitest run unit/reload-prompt.test.tsx`: 1 file, 4 tests passed, 0 failed, 0 skipped.
- `npm run test:unit`: 69 files passed, 1510 tests passed, 0 failed, 0 skipped (59.18s). Log `.../logs/T805-unit.log`.
- Red check (stage 03 step 6): `git status --porcelain` recorded, `git stash push -- vite.config.ts`, `npx vitest run unit/reload-prompt.test.tsx`: 1 failed, 3 passed; the failure is `vite.config.ts asks before updating`, `expected ... to contain 'registerType: 'prompt''`. `git stash pop --index`, `git status --porcelain` identical to the recorded one, `vite.config.ts` diff intact. Log `.../logs/T805-red.log`.
- Ports 3000 and 3100 were free before Playwright.
- `npx playwright test tests/toast-layering.spec.ts --project=chromium`: 2 passed, 0 failed (13.1s). Log `.../logs/T805-e2e-chr.log`.
- `npx playwright test tests/toast-layering.spec.ts` (3 browsers): 6 passed, 0 failed (24.0s). Log `.../logs/T805-e2e-all.log`. The "1 failed" command the orchestrator saw in the builder's pane did not reproduce; both of my runs exit 0.
- `npm run build`: exit 0. Log `.../logs/T805-build.log`.

### 5. Not verified

- Whether `vi.mock` alone (without the alias and stub) would have resolved `virtual:pwa-register/react`. The spec asked the builder to try the factory first and say which happened; the build report only says the alias was added. My attempt to check this with a scratch config could not resolve `vitest` from outside the repo, and an edit to `vitest.config.ts` is outside what this stage allows. Result: the alias is harmless and keeps all 4 tests green, but it may be unneeded.
- Real update behaviour in a browser (two builds and a deploy), by design not tested (spec section 6).
- The `ReloadPrompt` hook mock stands in for the library; the library's `prompt` branch is checked only by reading the spec's cited code and the built worker.

### 6. Blocking

none.

### 7. Non-blocking

- `docs/audit/decisions/0107-ask-before-updating-the-offline-app.md` Verification line 33 records `skipWaiting call false`, but the real output is `true` (the single call is inside the `SKIP_WAITING` message listener). The prose around it is right; the parenthetical should read `skipWaiting call true, only inside the SKIP_WAITING message listener`. T806 or a later touch can fix it.
- The build report does not state whether the `vi.mock`-only attempt failed before the alias was added (spec section 2 asked for this). If it would have passed, the alias and stub could be dropped to keep `vitest.config.ts` untouched.
- Comment in `vite.config.ts` reads "until user confirms reload"; "until the user confirms" is cleaner.

### 8. Rule candidates

none.
