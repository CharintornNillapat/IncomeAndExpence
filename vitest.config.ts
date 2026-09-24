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
  test: {
    /*
     * MANDATORY, not a preference.
     *
     * Vitest's default `include` is `**\/*.{test,spec}.?(c|m)[jt]s?(x)`, which
     * collects all 22 Playwright specs under `tests/`. Left at the default,
     * `npm run test:unit` loads `tests/wallets.spec.ts` under Node and fails in
     * twenty-two unrelated ways. The mirror-image trap lives in
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
  },
});
