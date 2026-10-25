# Build report: T806

Phase 147, branch `phase-147-update-prompt`. Final task of the phase; ships the phase.

## 1. Files changed (6 files)

- `AGENTS.md`
- `README.md`
- `docs/audit/decisions/0107-ask-before-updating-the-offline-app.md`
- `docs/audit/baseline-metrics.md`
- `docs/audit/refactor-log.md`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

Docs-only task; no tests added. Stage 02 step 4 and stage 03 step 6 do not apply.

Pre-edit verification runs provided the exact measured figures:
- Full unit suite: 69 files, 1510 passed in 61.55 s (`workflow/stages/02_build/output/logs/T806-unit.log`).
- Playwright test list: 183 tests in 36 files (549 runs across 3 projects).
- Production build: `index-B-nRqlko.js` 194,593 B / 56,963 B gzip, `index-CNaxMlAk.css` 53,359 B / 10,451 B gzip, all app JS 886,298 B / 269,230 B gzip (39 files).
- Service worker inspection (`dist/sw.js`): `SKIP_WAITING true`, `clientsClaim false`, `skipWaiting calls 1`, `in listener true`.
- Playwright full run: no full run in Phase 147 (docs-only task, code unchanged since T805; T805 ran `tests/toast-layering.spec.ts` on 3 browsers, 6 passed; T803 full run stands: 543 passed, 6 skipped across 3 projects in 9.7 min).

## 3. Gates

1. **Unit suite:** 69 files, 1510 passed in 61.55 s. Log: `workflow/stages/02_build/output/logs/T806-unit.log`.
2. **Playwright test list:** `Total: 549 tests in 36 files` (183 tests, 36 specs, 549 runs).
3. **Production build:** exit 0; `dist/assets` measurements match spec expectations down to the byte:
   - `index-B-nRqlko.js`: 194,593 B / 56,963 B gzip
   - `index-CNaxMlAk.css`: 53,359 B / 10,451 B gzip
   - All app JS: 886,298 B / 269,230 B gzip (39 files)
4. **Service worker inspection (`dist/sw.js`):**
   - `SKIP_WAITING true`
   - `clientsClaim false`
   - `skipWaiting calls 1`
   - `in listener true`
5. **Commit sha (Gate 6):** `git log` verified commit for T805 (`d6261d4`).
6. **Stale counts check (Gate 7):** `git grep -n -E "1506 tests|68 files" -- AGENTS.md README.md docs/contexts/` returned exit code 1 (no stale counts found).
7. **Line counts (Gate 8):** `(Get-Content ...).Count` verified:
   - `docs/audit/task-ledger.md`: 183 lines
   - `docs/audit/refactor-log.md`: 150 lines
   - `docs/audit/baseline-metrics.md`: 183 lines
   The counts 183 and 183 match the references in `refactor-log.md` Deliberately not done.
8. **Line endings (Gate 9 & 10):** `bareLF 0` on all 6 touched files; `git ls-files --eol` confirms `w/crlf`.
9. **Em dashes (Gate 11):** 0 em dashes added in `git diff -U0 HEAD` and 0 in `task-T806-spec.md`.
10. **Diff stat (Gate 12):** `AGENTS.md` and `README.md` 1 line each, ADR 0107 1 line, plus the three audit files.
11. **Scope (Gate 13):** `git status --porcelain` confirms only the 5 target files, `docs/audit/task-ledger.md`, the three pre-existing line-ending-only files from section 4 item 3, and `workflow/stages/*/output/` files.
12. **Cleanup:** `dist` removed.

## 4. Deliberately not done

- A "reload when idle" timer, countdown or changelog in the notice (ADR 0107 Not done).
- Playwright update test, which needs two builds and a real deploy.
- Real-browser update check (owner's post-merge check).
- Removing the Vitest alias and stub (`unit/fixtures/virtualPwaRegisterReact.ts`), kept as harmless and reserved for a separate task.
- The `vite.config.ts:12` comment wording ("until user confirms reload"), a code file outside this docs task.
- No full Playwright run in Phase 147 (T805 ran the one `pwa-dev` spec on three browsers; CI runs the full suite on the PR).
- `docs/contexts/ui-and-e2e.md` left untouched; its Playwright count (183 / 36 / 549) still matches.
- Archiving `task-ledger.md` (183 lines) and `baseline-metrics.md` (183 lines), both past the ~150-line threshold in `docs/audit/README.md` for a fourth phase; left for a separate task.
- Post-merge deploy record placeholders (`docs <sha>`, `merged <sha>`, `Measured at <sha>`, T806 Commit cell, and branch line `:125`) are reserved for the owner on `main` after merge.
