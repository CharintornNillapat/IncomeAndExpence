import { test, expect } from '@playwright/test';

/**
 * `AuthModal.handleAuth` checks `isSupabaseConfigured` before anything else:
 * when true it makes a real Supabase network call, when false it
 * short-circuits to a "Cloud sync is not configured" message before its own
 * Zod validation even runs. Which branch fires depends on whether a `.env`
 * with real credentials exists - true in a local dev checkout, false in CI
 * (playwright.yml never sets these secrets, per audit correction C4). To stay
 * deterministic in both, this spec only exercises what never reaches
 * `handleAuth`: modal open/close, mode switching, and native HTML5
 * constraint validation (email format, password length). It deliberately
 * never submits a syntactically valid credential pair.
 */
test.describe('Auth modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens from the navbar, defaults to Sign In, and closes', async ({ page }) => {
    await page.locator('#navbar-signin-btn').click();

    const emailInput = page.locator('#auth-email-input');
    await expect(emailInput).toBeVisible();
    await expect(page.locator('#auth-password-input')).toBeVisible();
    // Sign In mode has no name field.
    await expect(page.locator('#auth-name-input')).toHaveCount(0);

    await page.locator('#auth-close-btn').click();
    await expect(emailInput).not.toBeVisible();
  });

  test('switching to Create Account reveals the name field; switching back removes it', async ({ page }) => {
    await page.locator('#navbar-signin-btn').click();

    await page.locator('#auth-tab-signup').click();
    const nameInput = page.locator('#auth-name-input');
    await expect(nameInput).toBeVisible();

    await page.locator('#auth-tab-signin').click();
    await expect(nameInput).toHaveCount(0);
  });

  test('Forgot password mode hides the password field and offers a way back', async ({ page }) => {
    await page.locator('#navbar-signin-btn').click();
    await page.locator('#auth-forgot-password-link').click();

    await expect(page.locator('#auth-password-input')).toHaveCount(0);
    await expect(page.getByText('Reset Password')).toBeVisible();

    await page.locator('#auth-back-to-signin-link').click();
    await expect(page.locator('#auth-password-input')).toBeVisible();
  });

  test('native validation blocks submission of a malformed email before the app ever sees it', async ({ page }) => {
    await page.locator('#navbar-signin-btn').click();

    const emailInput = page.locator('#auth-email-input');
    await emailInput.fill('not-an-email');
    await page.locator('#auth-password-input').fill('validpass123');

    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('native validation enforces the 6-character password minimum', async ({ page }) => {
    await page.locator('#navbar-signin-btn').click();

    await page.locator('#auth-email-input').fill('valid@example.com');
    const passwordInput = page.locator('#auth-password-input');
    await passwordInput.fill('abc');

    const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });
});
