import { chromium } from '@playwright/test';

/**
 * Phase 81 (ADR 0057): load the PWA server on port 3100 once before any test.
 *
 * Playwright starts both webServers before this runs, but a webServer counts as
 * ready when its HTML answers, and Vite compiles modules only when a browser
 * asks for them. Each server keeps its own transform cache, and vite-plugin-pwa
 * builds its development service worker on first request, so the first page on
 * 3100 used to pay for all of it inside `toast-layering.spec.ts`. That load took
 * 28.5 s and 29.4 s in Phase 80's full run and 34 s on a first run of the day,
 * against 3 to 6 s once the server is warm.
 *
 * One page in a throwaway browser, here, while no worker is running yet: the
 * app's module graph is compiled and the service worker built, so the spec's own
 * first load is a warm one. The tests keep every timeout they had.
 *
 * A failure warns and carries on. Every other spec runs on port 3000, so a
 * broken 3100 should fail the two toast tests, not the whole run.
 */
const PWA_DEV_URL = 'http://localhost:3100/';
const WARMUP_TIMEOUT_MS = 120_000;

export default async function globalSetup(): Promise<void> {
  const started = Date.now();
  const browser = await chromium.launch().catch((error: unknown) => {
    console.warn(`[warmup] skipped: chromium did not launch (${String(error)})`);
    return null;
  });
  if (!browser) return;
  try {
    const page = await browser.newPage();
    await page.goto(PWA_DEV_URL, { timeout: WARMUP_TIMEOUT_MS });
    // The development service worker is built on its first request; waiting for
    // it to be active means the toast spec's own install is a warm one too.
    const active = await page.evaluate(
      (ms) =>
        Promise.race([
          navigator.serviceWorker.ready.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
        ]),
      WARMUP_TIMEOUT_MS - (Date.now() - started),
    );
    if (!active) throw new Error('no service worker became active');
    console.log(`[warmup] ${PWA_DEV_URL} loaded and its service worker active in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  } catch (error) {
    console.warn(`[warmup] ${PWA_DEV_URL} did not finish its first load: ${String(error)}`);
  } finally {
    await browser.close();
  }
}
