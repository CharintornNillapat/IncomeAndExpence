import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /*
   * Pinned, and redundant today on purpose (ADR 0021).
   *
   * Playwright's DEFAULT `testMatch` is `**\/*.@(spec|test).?(c|m)[jt]s?(x)` —
   * note the `@(spec|test)`. It collects `*.test.ts` as readily as `*.spec.ts`,
   * so unit tests placed anywhere under `tests/` would be swept into the E2E
   * run and silently break the 321-run contract. They live in `unit/` instead,
   * which `testDir` cannot see; this pin is the second lock, so a future
   * "let's tidy the unit tests under tests/" reads as the breaking change it
   * is rather than as housekeeping. The mirror-image trap (vitest's default
   * `include` collecting all 22 specs here) is pinned in `vitest.config.ts`.
   */
  testMatch: '**/*.spec.ts',
  /*
   * Phase 81 (ADR 0057): runs after both webServers answer and before any
   * worker starts. It loads port 3100 once, so `toast-layering.spec.ts` no
   * longer pays for that server's first compile inside its own timeouts.
   */
  globalSetup: './tests/global-setup.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /*
   * Two workers on CI (Phase 55, T202). Each CI job now runs one browser, and
   * GitHub's ubuntu runners have 4 vCPUs. Kept only if three consecutive CI
   * runs stay green, since the Vite dev server compiles each module on first
   * request.
   *
   * Four locally (Phase 79, ADR 0055). Left unset, Playwright takes half the
   * logical CPUs: 6 on the 12-thread machine these phases run on. Measured
   * there, every Firefox test three times (441 runs): 6 workers took 10.4 m
   * with 2 `page.goto` timeouts and ten tests over 20 s (slowest 42.5 s);
   * 4 workers took 10.2 m with none failed and none over 12.1 s. The extra
   * workers bought no speed, only the tail that crossed the 30 s navigation
   * timeout. `--workers=N` still overrides it for one run.
   */
  workers: process.env.CI ? 2 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /*
   * Timeouts below bound *failure* only - an auto-retrying assertion resolves
   * the moment its condition holds, so raising these does not slow a green run.
   * The extra headroom is for Firefox, which is consistently the slowest of the
   * three engines at first paint of a `React.lazy` view chunk served by the
   * Vite dev server, especially with workers running in parallel.
   */
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,

    /*
     * Pin the OS preference so useTheme's 'system' mode resolves to a known
     * value. Without this the theme spec depends on whatever the host reports,
     * which differs between local machines and CI.
     */
    colorScheme: 'light',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run local dev servers before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      /*
       * Phase 66 (ADR 0042): the same app with vite-plugin-pwa's development
       * service worker, so the real PWA toast appears. Only
       * `toast-layering.spec.ts` uses it (its own `baseURL`); every other spec
       * stays on port 3000, where no service worker registers and no toast
       * can sit over a control.
       */
      command: 'npx vite --port=3100 --strictPort --mode pwa-dev',
      url: 'http://localhost:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
