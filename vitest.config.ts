import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit test runner (ADR 0021).
 *
 * This file is its own config rather than a `test` key on `vite.config.ts`,
 * and that is load-bearing: **`vite build` never reads it.** Zero production
 * bundle impact is therefore structural rather than a matter of discipline —
 * there is no path by which a test-only plugin, alias or transform can reach
 * the production build, because the production build does not load the file
 * that would declare them. It also keeps `VitePWA` and the Tailwind plugin
 * out of the test path, which neither suite needs.
 *
 * No plugins: esbuild compiles TSX straight from `tsconfig.json`'s
 * `jsx: "react-jsx"`, so `@vitejs/plugin-react` would only add Fast Refresh,
 * which is meaningless in a non-interactive run.
 */
export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register/react': path.resolve(__dirname, 'unit/fixtures/virtualPwaRegisterReact.ts'),
    },
  },
  test: {
    /*
     * MANDATORY, not a preference.
     *
     * Vitest's default `include` is `**\/*.{test,spec}.?(c|m)[jt]s?(x)`, which
     * collects every Playwright spec under `tests/` (34 today). Left at the
     * default, `npm run test:unit` loads `tests/wallets.spec.ts` under Node and
     * fails once per spec, in ways unrelated to the code. The mirror-image trap lives in
     * `playwright.config.ts` — see the `testMatch` pin there.
     */
    include: ['unit/**/*.test.{ts,tsx}'],

    /*
     * Node by default. The two pure-module suites never touch jsdom's
     * `AbortSignal`, `fetch` or timer surfaces, all of which differ from Node's
     * in ways that produce failures about the environment rather than about the
     * code. The two DOM suites opt in per file with:
     *
     *   // @vitest-environment jsdom
     */
    environment: 'node',

    // Every suite either stubs `fetch` or mounts a provider that owns
    // module-level state; overlapping files in one process would leak both.
    isolate: true,

    // Testing Library's wait bound, for every file (ADR 0096).
    setupFiles: ['unit/setup.ts'],
  },
});
