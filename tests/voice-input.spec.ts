import { test, expect, type Page } from '@playwright/test';

/**
 * Voice input for the omni note (ADR 0018).
 *
 * WHY EVERY TEST STUBS THE API. Real recognition needs a microphone, a vendor
 * network round-trip and audio a test cannot produce, so it is untestable by
 * construction. On top of that, the three Playwright projects genuinely
 * disagree - measured on localhost before this spec was written:
 *
 *   chromium   SpeechRecognition: function   webkitSpeechRecognition: function
 *   firefox    both undefined
 *   webkit     both undefined
 *
 * So the mic renders in chromium and is absent in the other two by default.
 * Every test below therefore installs or removes the API itself via
 * `addInitScript` before `goto`, and none relies on what the browser ships.
 *
 * This is an init script, NOT a `page.route` interception - it does not
 * breach the rule that `jev-classify.spec.ts` is the only spec in this suite
 * that intercepts requests.
 */

interface SpeechHandle {
  startCount: number;
  emit(transcript: string, isFinal: boolean): boolean;
  fail(code: string): boolean;
}

declare global {
  interface Window {
    __speech?: SpeechHandle;
  }
}

/** Installs a fake `SpeechRecognition` plus a `window.__speech` hook to drive it. */
async function installSpeechMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Handler = ((event: unknown) => void) | null;

    let active: MockRecognition | null = null;

    class MockRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;

      start(): void {
        active = this;
        const handle = window.__speech;
        if (handle) handle.startCount += 1;
        if (this.onstart) this.onstart();
      }

      stop(): void {
        this.finish();
      }

      abort(): void {
        this.finish();
      }

      private finish(): void {
        if (active === this) active = null;
        if (this.onend) this.onend();
      }
    }

    window.__speech = {
      startCount: 0,
      emit(transcript: string, isFinal: boolean): boolean {
        if (!active || !active.onresult) return false;
        // Shape matches what the hook reads: results[i][0].transcript + isFinal.
        active.onresult({
          results: { length: 1, 0: { isFinal, length: 1, 0: { transcript } } },
        });
        return true;
      },
      fail(code: string): boolean {
        const target = active;
        if (!target || !target.onerror) return false;
        active = null;
        target.onerror({ error: code });
        // A real engine ends the session after an error.
        if (target.onend) target.onend();
        return true;
      },
    };

    const ctor = MockRecognition as unknown;
    Object.defineProperty(window, 'SpeechRecognition', { value: ctor, configurable: true, writable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: ctor, configurable: true, writable: true });
  });
}

/** Removes the API entirely, so the progressive-enhancement path can be asserted on any browser. */
async function removeSpeechApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true, writable: true });
  });
}

async function emit(page: Page, transcript: string, isFinal: boolean): Promise<void> {
  const delivered = await page.evaluate(
    ([text, final]) => window.__speech?.emit(text as string, final as boolean) ?? false,
    [transcript, isFinal] as const
  );
  // A silently undelivered transcript would make every assertion below vacuous.
  expect(delivered, 'no live recognition session to emit into').toBe(true);
}

async function openQuickAdd(page: Page) {
  await page.locator('#navbar-quick-add-btn').click();
  const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(modal).toBeVisible();
  return modal;
}

/** Opens Quick Add with the mock installed and dictation already running. */
async function startDictation(page: Page) {
  const modal = await openQuickAdd(page);
  await modal.locator('[id$="-voice-btn"]').click();
  await expect(modal.getByTestId('tx-voice-listening')).toBeVisible();
  return modal;
}

test.describe('Voice input for the omni note', () => {
  test('the mic is absent when the browser has no Speech API', async ({ page }) => {
    await removeSpeechApi(page);
    await page.goto('/');

    const modal = await openQuickAdd(page);

    // Progressive enhancement: no button, and the form is entirely usable.
    await expect(modal.locator('[id$="-voice-btn"]')).toHaveCount(0);

    await modal.locator('input[name="amount_expression"]').fill('75');
    await modal.locator('input[id$="-desc"]').fill('typed with no mic');
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('tapping the mic starts a session and shows the listening state', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await openQuickAdd(page);
    const micButton = modal.locator('[id$="-voice-btn"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-pressed', 'false');

    await micButton.click();

    await expect(modal.getByTestId('tx-voice-listening')).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__speech?.startCount)).toBe(1);
  });

  test('an interim transcript lands live and the final one supersedes it', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await startDictation(page);
    const note = modal.locator('input[id$="-desc"]');

    await emit(page, 'coffee 1', false);
    await expect(note).toHaveValue('coffee 1');

    // Superseded, not appended to - the hook rebuilds the transcript rather
    // than accumulating it.
    await emit(page, 'coffee 120', true);
    await expect(note).toHaveValue('coffee 120');
  });

  test('a transcript drives the whole form exactly like typing', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await startDictation(page);
    await emit(page, 'coffee 120', true);

    // parseExpressInput ran: the amount was pulled out of the spoken note.
    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('120');

    // smartMatcher ran on the *stripped* text: "coffee" is a seeded rule.
    await expect(modal.getByText(/Auto-categorized:/i)).toBeVisible();
    await expect(modal.locator('select[id$="-category"]')).toHaveValue('cat-food');

    // And the ledger still gets the note exactly as spoken, amount and all.
    await expect(modal.locator('input[id$="-desc"]')).toHaveValue('coffee 120');
  });

  test('dictation appends to text already in the note instead of replacing it', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await openQuickAdd(page);
    await modal.locator('input[id$="-desc"]').fill('office');

    await modal.locator('[id$="-voice-btn"]').click();
    await expect(modal.getByTestId('tx-voice-listening')).toBeVisible();

    await emit(page, 'coffee 120', true);

    // This form has no undo, so a mis-tapped mic must not be able to destroy
    // typed text.
    await expect(modal.locator('input[id$="-desc"]')).toHaveValue('office coffee 120');
  });

  test('a hand-typed amount survives a transcript ending in digits', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await openQuickAdd(page);

    // Typing in the amount field latches it (ADR 0013). Three other spec
    // files depend on this rule; voice is a new entry point into it.
    await modal.locator('input[name="amount_expression"]').fill('999');

    await modal.locator('[id$="-voice-btn"]').click();
    await expect(modal.getByTestId('tx-voice-listening')).toBeVisible();
    await emit(page, 'coffee 120', true);

    // The note took the transcript...
    await expect(modal.locator('input[id$="-desc"]')).toHaveValue('coffee 120');
    // ...but the amount the user typed by hand is untouched.
    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('999');
  });

  test('a blocked microphone disables the button and says why, and the form still submits', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await startDictation(page);
    await page.evaluate(() => window.__speech?.fail('not-allowed'));

    // Disabled with a reason rather than hidden: a button that vanishes the
    // instant it is tapped is worse than one that explains itself.
    const micButton = modal.locator('[id$="-voice-btn"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeDisabled();
    await expect(modal.getByTestId('tx-voice-error')).toContainText(/Microphone access is blocked/i);
    await expect(modal.getByTestId('tx-voice-listening')).toHaveCount(0);

    await modal.locator('input[name="amount_expression"]').fill('75');
    await modal.locator('input[id$="-desc"]').fill('typed after denial');
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('a spoken note raises the smart-rule offer on a category override', async ({ page }) => {
    await installSpeechMock(page);
    await page.goto('/');

    const modal = await startDictation(page);
    // Misses all four seeded rules, so nothing auto-categorizes it.
    await emit(page, 'netflix 250', true);

    await modal.locator('select[id$="-category"]').selectOption('cat-housing');

    // ADR 0017's chip cannot tell a spoken note from a typed one, which is
    // the whole point of routing voice through handleDescriptionChange.
    const chip = modal.getByTestId('tx-save-rule');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('netflix');
    await expect(chip).not.toContainText('250');
  });
});
