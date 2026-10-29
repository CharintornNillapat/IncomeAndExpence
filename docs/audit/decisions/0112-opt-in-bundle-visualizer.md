# 0112: opt-in bundle visualizer

**Status:** Accepted. To be implemented in Phase 156 (T825).
The owner approved adding the dev dependency rollup-plugin-visualizer on 2026-10-29.

**Date:** 2026-10-29

## Context

Bundle sizes in FinLife Tracker are tracked only as hand-measured totals in `docs/audit/baseline-metrics.md` (the entry chunk, all app JS, and CSS); nothing shows what is inside a chunk or how dependencies contribute to chunk size. A long-standing Backlog row asked for `rollup-plugin-visualizer` to provide bundle-size visibility.

Adding a dependency is on AGENTS.md's Stop and ask first list. The owner explicitly approved adding this single dev dependency (`rollup-plugin-visualizer@7.1.1`) and its dependency tree on 2026-10-29, and no other.

## Decision

- **D1: Version pinned exactly.** Pin `rollup-plugin-visualizer` to exact version `7.1.1` (published 2026-08-14; optional peers `rollup 2.x || 3.x || 4.x` and `rolldown 1.x` cover Vite 6.4.3's Rollup 4.63.1; `engines.node >=22` satisfies the repo's Node 24.x requirement).
- **D2: Opt-in by Vite mode, not an environment variable.** Use `vite build --mode analyze` and branch on `mode === 'analyze'` in `vite.config.ts`. The configuration already receives `mode` for `pwa-dev` (ADR 0042). Using mode requires no `cross-env` package and no shell-specific environment syntax, so a single `npm run analyze` script works consistently across Git Bash, PowerShell, and CI. Application code under `src/` never reads `import.meta.env.MODE` (only `import.meta.env.DEV`, which is false in both default and analyze builds), ensuring the generated bundle matches the default production build.
- **D3: Output written to git-ignored cache outside dist.** The report is configured as `filename: '.cache/bundle-stats.html'`. Writing outside `dist/` is essential because the PWA plugin configures `workbox.globPatterns` as `**/*.{js,css,html,ico,png,svg,json,woff2}` (`vite.config.ts:67`), which would otherwise precache an in-dist HTML report into the service worker manifest. The directory `.cache/` is already git-ignored (`.gitignore:62`).
- **D4: Gzip sizes enabled.** Configure `gzipSize: true` because `docs/audit/baseline-metrics.md` tracks gzip byte figures. Keep other visualizer options at their defaults (`open: false`).

## Consequences

- One dev dependency added (`rollup-plugin-visualizer` 7.1.1), adding 27 packages to `package-lock.json` (`open`, `yargs`, `picomatch`, `source-map`, and their subtrees). Runtime dependencies remain unchanged at 7.
- A static import in `vite.config.ts` loads when Vite starts dev or build modes (adds negligible startup overhead; vitest uses a separate `vitest.config.ts` and does not load `vite.config.ts`).
- Vercel and CI `npm ci` fetch the additional packages during install.
- `vite.config.ts` is not included in `tsconfig.json`'s `include`, so `tsc` does not type-check it directly.
- The analyze build writes to `dist/` in addition to creating the report. Although the resulting assets are byte-identical to a default build, deployment builds should always use `npm run build`.

## Not done

- A size budget or CI gate on the treemap report.
- Uploading the visualizer report as a CI workflow artifact.
- Brotli size calculation.
- Adding `cross-env` or any other CLI wrapper dependency.
- React Compiler evaluation (tracked in a separate Backlog item).

## Release

One pull request for Phase 156. No database migration, no production touch points, and no files on the pause list. The pull request is eligible for automated merge (`gh pr merge --auto --merge`).
