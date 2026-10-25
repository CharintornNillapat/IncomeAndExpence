# Build report: T808

Phase 148, branch `phase-148-add-entry-close`. Final task of the phase; ships the phase.

## 1. Files changed (7 files)

- `AGENTS.md`
- `README.md`
- `docs/contexts/ui-and-e2e.md`
- `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md`
- `docs/audit/refactor-log.md`
- `docs/audit/baseline-metrics.md`
- `docs/audit/task-ledger.md` (bookkeeping: T807 commit cell filled, T808 row marked done)

## 2. Tests added and fail-then-pass evidence

Docs-only task; no tests added. Stage 02 step 4 and stage 03 step 6 do not apply.

Pre-edit verification runs provided the exact measured figures:
- Full unit suite: 69 files, 1510 passed in 76.30 s (`workflow/stages/02_build/output/logs/T808-unit.log`).
- Playwright test list: 187 tests in 36 files (561 runs across 3 projects).
- Production build: `index-D4N64t3V.js` 194,626 B / 56,981 B gzip, `index-CNaxMlAk.css` 53,359 B / 10,451 B gzip, all app JS 886,331 B / 269,276 B gzip (39 files).
- Playwright full run: no full run in T808 (docs-only task, code unchanged since T807; T807 build and review each ran `npm test`: 555 passed, 6 skipped across 36 specs, 561 runs in 10.2 min and 10.4 min).

## 3. Gates

1. **Unit suite (Gate 1):** 69 files, 1510 passed in 76.30 s. Log: `workflow/stages/02_build/output/logs/T808-unit.log`.
2. **Playwright test list (Gate 2):** `Total: 561 tests in 36 files` (187 tests in 36 files, 561 runs).
3. **Production build (Gate 3 & 4):** exit 0; `dist/assets` measurements match spec expectations:
   - `index-D4N64t3V.js`: 194,626 B / 56,981 B gzip
   - `index-CNaxMlAk.css`: 53,359 B / 10,451 B gzip
   - All app JS: 886,331 B / 269,276 B gzip (39 files)
4. **Commit sha (Gate 5):** `git log --format=%h -1 --grep="(T807)"` verified commit for T807 (`29ce4ba`).
5. **Stale counts check (Gate 6):** `git grep -n -E "183 tests|549 runs|\(549|543 pass|sole cause|does not change"` returned exit code 1 (no stale counts found).
6. **Line counts (Gate 7):** `(Get-Content ...).Count` verified:
   - `docs/audit/task-ledger.md`: 192 lines
   - `docs/audit/refactor-log.md`: 161 lines
   - `docs/audit/baseline-metrics.md`: 193 lines
   The counts 192 and 193 match the references in `refactor-log.md` Deliberately not done.
7. **Line endings (Gate 8 & 9):** `bareLF 0` on all 7 touched files; `git ls-files --eol` confirms `w/crlf`.
8. **Em dashes (Gate 10):** 0 em dashes added in `git diff -U0 HEAD`, 0 in `task-T808-spec.md` and 0 in this build report.
9. **Diff stat (Gate 11):** `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md` 1 line each, ADR 0108 3 lines, plus the three audit files.
10. **Scope (Gate 12):** `git status --porcelain` confirms only the 6 target files, `docs/audit/task-ledger.md`, the untracked Phase 149 design files left untouched, and `workflow/stages/*/output/` files.
11. **Cleanup:** `dist` removed.

## 4. Deliberately not done

- The production check, still owed by the owner after deploy: signed in, reload, press "Add entry" once, and popup must stay open.
- Eliminating slow path for click before idle callback runs (ADR 0108 Not done).
- Guard on scrim click, loading state on trigger buttons (ADR 0108 Not done).
- Text edit of ADR 0010 or ADR 0104; amendments live in ADR 0108 only.
- Full Playwright run in T808 (docs-only, code unchanged since `29ce4ba`).
- Untracked Phase 149 design docs left untouched in working tree (`docs/audit/decisions/0109-transactions-table-and-calendar-views.md` and `docs/design/transactions-2026-10/`).
- Archiving `task-ledger.md` (192 lines) and `baseline-metrics.md` (193 lines), both past the ~150-line threshold in `docs/audit/README.md` for a fifth phase, left for a separate task.
- Post-merge deploy record placeholders (`docs <sha>`, `merged <sha>`, `Measured at <sha>`, T808 Commit cell, and branch line `:134`) are reserved for the owner on `main` after merge.
